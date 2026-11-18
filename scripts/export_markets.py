"""Write the small market summary files the site reads (src/data/markets/).

Run with isem-data's Python, so it can read isem-data's archive:

    ~/Developer/isem-data/.venv/bin/python scripts/export_markets.py

| File              | One row per                                                   |
|-------------------|---------------------------------------------------------------|
| prices_hh.csv     | half-hour: SEM day-ahead price, and volume in each zone       |
| prices_recent.csv | the same, last 60 days only (for the Today page)              |
| prices_daily.csv  | trading day: average, lowest and highest price, negative hours |
| system_hh.csv     | half-hour, last 60 days: wind (actual, EirGrid forecast), demand |
| system_daily.csv  | Irish day: wind and demand energy, wind share, forecast error |
| latest.json       | the newest reading of each series, for the top-of-page strip  |

Day-ahead prices are the same in Ireland and Northern Ireland (one coupled market), so
there is one price; volumes are per zone.
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from isem_data import storage

OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "markets"
LOCAL = "Europe/Dublin"
RECENT_DAYS = 60


def local_day(times: pd.Series) -> pd.Series:
    return times.dt.tz_convert(LOCAL).dt.strftime("%Y-%m-%d")


def trading_day(times: pd.Series) -> pd.Series:
    """The market's trading day: it runs from 23:00 to 23:00 Irish time, so 23:00 on
    9 Nov belongs to the 10 Nov trading day. Prices are summarised by trading day."""
    return (times + pd.Timedelta(hours=1)).dt.tz_convert(LOCAL).dt.strftime("%Y-%m-%d")


def half_hours_in(days: pd.Index) -> pd.Series:
    """How many half-hours each Irish day has: 48, or 46 / 50 on clock-change days."""
    start = pd.to_datetime(days).tz_localize(LOCAL)
    end = (pd.to_datetime(days) + pd.Timedelta(days=1)).tz_localize(LOCAL)
    return pd.Series((end - start) / pd.Timedelta(minutes=30), index=days).astype(int)


def prices() -> tuple[pd.DataFrame, pd.DataFrame]:
    raw = storage.load("prices")
    table = raw.pivot_table(index="timestamp_utc", columns=["series", "region"], values="value")
    hh = pd.DataFrame(
        {
            "price": table[("dam_price_eur_mwh", "ROI")],
            "volume_roi_mw": table[("dam_volume_mw", "ROI")],
            "volume_ni_mw": table[("dam_volume_mw", "NI")],
        }
    ).reset_index()
    hh["day"] = trading_day(hh["timestamp_utc"])
    daily = hh.groupby("day").agg(
        avg=("price", "mean"),
        low=("price", "min"),
        high=("price", "max"),
        negative_hh=("price", lambda p: int((p < 0).sum())),
        half_hours=("price", "size"),
    )
    volume = hh.assign(total=hh["volume_roi_mw"] + hh["volume_ni_mw"]).groupby("day")["total"].sum() * 0.5
    daily["volume_mwh"] = volume
    # Volume-weighted average: what a MWh actually cost on the day.
    weighted = hh.assign(w=hh["volume_roi_mw"] + hh["volume_ni_mw"])
    weighted["pw"] = weighted["price"] * weighted["w"]
    sums = weighted.groupby("day")[["pw", "w"]].sum()
    daily["vwap"] = sums["pw"] / sums["w"]
    # Leave out days with half-hours missing, such as part-days at the edges.
    daily = daily[daily["half_hours"] == half_hours_in(daily.index)]
    return hh.drop(columns="day"), daily.reset_index()


def system() -> tuple[pd.DataFrame, pd.DataFrame]:
    wind = storage.load("wind")
    demand = storage.load("demand")
    both = pd.concat([wind, demand])
    both = both[both["region"] == "ALL"]
    table = both.pivot_table(index="timestamp_utc", columns="series", values="value")
    table = table.rename(
        columns={"wind_actual_mw": "wind", "wind_forecast_mw": "forecast", "demand_actual_mw": "demand"}
    )
    # Daily energy from 15-minute readings.
    q = table.reset_index()
    q["day"] = local_day(q["timestamp_utc"])
    q["error"] = q["forecast"] - q["wind"]
    daily = q.groupby("day").agg(
        wind_mwh=("wind", lambda s: s.sum() * 0.25),
        forecast_mwh=("forecast", lambda s: s.sum() * 0.25),
        demand_mwh=("demand", lambda s: s.sum() * 0.25),
        wind_peak_mw=("wind", "max"),
        demand_peak_mw=("demand", "max"),
        bias_mw=("error", "mean"),
        mae_mw=("error", lambda e: e.abs().mean()),
        readings=("wind", "count"),
    )
    daily["wind_share"] = 100 * daily["wind_mwh"] / daily["demand_mwh"]
    daily = daily[daily["readings"] >= 2 * half_hours_in(daily.index) - 4]  # (nearly) whole days
    # Half-hourly averages for the last RECENT_DAYS days, for the detailed charts.
    since = table.index.max().floor("D") - pd.Timedelta(days=RECENT_DAYS - 1)
    hh = table[table.index >= since].resample("30min").mean().reset_index()
    return hh, daily.reset_index()


def latest(prices_hh: pd.DataFrame, system_hh: pd.DataFrame, prices_daily, system_daily) -> dict:
    last_price_day = prices_daily.iloc[-1]
    prev_price_day = prices_daily.iloc[-2]
    # EirGrid's wind and demand figures sometimes arrive a day apart. Use the newest day and
    # half-hour that have both, so one late dataset never leaves a gap (or a NaN) in the strip.
    last_system_day = system_daily.dropna(subset=["wind_share"]).iloc[-1]
    newest = system_hh.dropna(subset=["wind", "demand"]).iloc[-1]
    return {
        "built_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "price_day": last_price_day["day"],
        "price_avg": round(float(last_price_day["avg"]), 2),
        "price_avg_change": round(float(last_price_day["avg"] - prev_price_day["avg"]), 2),
        "price_low": round(float(last_price_day["low"]), 2),
        "price_high": round(float(last_price_day["high"]), 2),
        "price_vwap": round(float(last_price_day["vwap"]), 2),
        "price_last_utc": prices_hh["timestamp_utc"].max().strftime("%Y-%m-%dT%H:%MZ"),
        "system_day": last_system_day["day"],
        "wind_share": round(float(last_system_day["wind_share"]), 1),
        "system_last_utc": newest["timestamp_utc"].strftime("%Y-%m-%dT%H:%MZ"),
        "wind_mw": round(float(newest["wind"])),
        "demand_mw": round(float(newest["demand"])),
    }


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    prices_hh, prices_daily = prices()
    system_hh, system_daily = system()
    numbers = lambda t, n: t.round({c: n for c in t.select_dtypes("number").columns})  # noqa: E731
    files = {
        "prices_hh.csv": numbers(prices_hh, 2),
        "prices_recent.csv": numbers(
            prices_hh[prices_hh["timestamp_utc"] >= prices_hh["timestamp_utc"].max().floor("D") - pd.Timedelta(days=RECENT_DAYS - 1)], 2
        ),
        "prices_daily.csv": numbers(prices_daily, 2),
        "system_hh.csv": numbers(system_hh, 1),
        "system_daily.csv": numbers(system_daily, 2),
    }
    for name, table in files.items():
        table.to_csv(OUT / name, index=False, date_format="%Y-%m-%dT%H:%MZ")
    info = latest(prices_hh, system_hh, prices_daily, system_daily)
    (OUT / "latest.json").write_text(json.dumps(info, indent=2) + "\n")
    for path in sorted(OUT.iterdir()):
        print(f"{path.name:18} {path.stat().st_size / 1000:7,.0f} kB")
    print(json.dumps(info, indent=2), file=sys.stderr)


if __name__ == "__main__":
    main()
