"""Write the files for the live record on the Price forecasts page (src/forecasts/data/live/).

Run with isem-data's Python, so it can read isem-data's archive:

    ~/Developer/isem-data/.venv/bin/python scripts/export_live.py

Each morning, before the day-ahead auction, isem-forecast's live forecast for the next
day is saved in the public repository Nabel7/isem-live-forecasts, never to be replaced
(see its README). This reads that repository's forecasts/ folder (a copy on this machine:
ISEM_LIVE_FORECASTS, default ~/Developer/isem-live-forecasts) and scores each day against
SEMO's half-hourly prices once SEMO has published them all, as in the back-tests.

| File           | One row per                                                         |
|----------------|---------------------------------------------------------------------|
| halfhours.csv  | half-hour of every forecast day: each method's forecast, and the    |
|                | price once SEMO has it                                              |
| days.csv       | forecast day and method: its average miss and range, once scored    |
| scores.csv     | method: the score over every day that counts                        |
| meta.json      | every forecast's details (when made, which inputs), and the totals  |

A day counts towards the score when its forecast was made by the cut-off and every
method gave a forecast, so that all are scored on the same half-hours. Late days are
still shown, marked late.
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from isem_data import storage

OUT = Path(__file__).resolve().parent.parent / "src" / "forecasts" / "data" / "live"
LIVE = Path(os.environ.get("ISEM_LIVE_FORECASTS", "~/Developer/isem-live-forecasts")).expanduser()
REPOSITORY = "https://github.com/Nabel7/isem-live-forecasts"

METHODS = ["chronos2_wind", "lightgbm_wind", "yesterday", "week_average"]
RANGED = ["chronos2_wind", "lightgbm_wind"]  # the two that give an 80% range
BAR = "week_average"  # the bar to beat, as on the rest of the page
TOO_FEW_DAYS = 30  # below this the page says the record is too short to judge

HALFHOUR_COLUMNS = ["timestamp_utc", "day", "actual"] + [
    c for m in METHODS for c in ([m, f"{m}_low", f"{m}_high"] if m in RANGED else [m])
]
DAY_COLUMNS = ["day", "method", "mae", "inside_range", "counted"]
SCORE_COLUMNS = ["method", "MAE", "inside_range", "days_beaten", "days"]


def read_forecasts(folder: Path) -> tuple[pd.DataFrame, list[dict]]:
    """Every saved forecast: one wide row per half-hour, and each day's details."""
    tables, details = [], []
    for csv in sorted(folder.glob("*.csv")):
        info = json.loads(csv.with_suffix(".json").read_text())
        long = pd.read_csv(csv, parse_dates=["timestamp_utc"])
        wide = long.pivot(index="timestamp_utc", columns="method", values=["median", "low", "high"])
        table = pd.DataFrame(index=wide.index)
        for m in METHODS:
            table[m] = wide[("median", m)] if ("median", m) in wide else float("nan")
            if m in RANGED:
                for side in ["low", "high"]:
                    table[f"{m}_{side}"] = wide[(side, m)] if (side, m) in wide else float("nan")
        tables.append(table.assign(day=info["day"]).reset_index())
        details.append(info)
    if not tables:
        return pd.DataFrame(columns=[c for c in HALFHOUR_COLUMNS if c != "actual"]), []
    return pd.concat(tables, ignore_index=True), details


def semo_prices() -> pd.Series:
    """SEMO's half-hourly day-ahead prices (ROI; the same across the island), by UTC time."""
    raw = storage.load("prices")
    prices = raw[(raw["series"] == "dam_price_eur_mwh") & (raw["region"] == "ROI")]
    return prices.set_index("timestamp_utc")["value"].sort_index()


def score(halfhours: pd.DataFrame, details: list[dict]) -> tuple[pd.DataFrame, pd.DataFrame, dict]:
    """Each scored day's misses, the totals over the days that count, and each day's status."""
    info = {d["day"]: d for d in details}
    status, rows, counted_days = {}, [], []
    for day, table in halfhours.groupby("day", sort=True):
        if table["actual"].isna().any():
            status[day] = "waiting"  # SEMO hasn't published the whole day yet
            continue
        complete = table[METHODS].notna().all().all()
        counts = bool(info[day]["in_time"] and complete)
        status[day] = "scored" if counts else ("late" if not info[day]["in_time"] else "incomplete")
        for m in METHODS:
            miss = (table[m] - table["actual"]).abs()
            inside = (
                ((table[f"{m}_low"] <= table["actual"]) & (table["actual"] <= table[f"{m}_high"])).mean()
                if m in RANGED and table[f"{m}_low"].notna().all()
                else None
            )
            rows.append({"day": day, "method": m, "mae": miss.mean(), "inside_range": inside, "counted": counts})
        if counts:
            counted_days.append(table)
    days = pd.DataFrame(rows, columns=DAY_COLUMNS)

    totals = []
    if counted_days:
        counted = pd.concat(counted_days)
        by_day = days[days["counted"]].pivot(index="day", columns="method", values="mae")
        for m in METHODS:
            inside = (
                ((counted[f"{m}_low"] <= counted["actual"]) & (counted["actual"] <= counted[f"{m}_high"])).mean()
                if m in RANGED
                else None
            )
            totals.append(
                {
                    "method": m,
                    "MAE": (counted[m] - counted["actual"]).abs().mean(),
                    "inside_range": inside,
                    "days_beaten": None if m == BAR else int((by_day[m] < by_day[BAR]).sum()),
                    "days": len(by_day),
                }
            )
    scores = pd.DataFrame(totals, columns=SCORE_COLUMNS).astype({"days_beaten": "Int64", "days": "Int64"})
    return days, scores, status


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    halfhours, details = read_forecasts(LIVE / "forecasts")
    if len(halfhours):
        halfhours["actual"] = halfhours["timestamp_utc"].map(semo_prices())
    else:
        halfhours["actual"] = pd.Series(dtype=float)
    halfhours = halfhours[HALFHOUR_COLUMNS].sort_values("timestamp_utc")
    days, scores, status = score(halfhours, details)

    places = {c: 2 for c in halfhours.columns if c not in ("timestamp_utc", "day")}
    halfhours.round(places).to_csv(
        OUT / "halfhours.csv", index=False, date_format="%Y-%m-%dT%H:%MZ"
    )
    days.round({"mae": 2, "inside_range": 3}).to_csv(OUT / "days.csv", index=False)
    scores.round({"MAE": 2, "inside_range": 3}).to_csv(OUT / "scores.csv", index=False)

    keep = [
        "day", "made_at_utc", "cutoff_utc", "in_time", "wind_source", "wind_forecast_published_utc",
        "newest_price_source", "methods_without_forecast",
    ]
    forecasts = [{**{k: d.get(k) for k in keep}, "status": status.get(d["day"], "waiting")} for d in details]
    counted = sorted(d for d, s in status.items() if s == "scored")
    meta = {
        "made": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        "repository": REPOSITORY,
        "methods": METHODS,
        "bar": BAR,
        "too_few_days": TOO_FEW_DAYS,
        "days_counted": len(counted),
        "first_counted": counted[0] if counted else None,
        "last_counted": counted[-1] if counted else None,
        "forecasts": forecasts,
    }
    (OUT / "meta.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(
        f"Live record: {len(details)} forecast(s) in {LIVE / 'forecasts'}, "
        f"{len(counted)} day(s) counted -> {OUT}"
    )


if __name__ == "__main__":
    main()
