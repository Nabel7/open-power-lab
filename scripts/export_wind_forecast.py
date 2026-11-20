"""Write the files the "EirGrid's wind forecast" page reads (src/forecasts/data/wind-forecast/).

Run with isem-data's Python, so it can read isem-data's archive:

    ~/Developer/isem-data/.venv/bin/python scripts/export_wind_forecast.py

Every saved version of EirGrid's per-farm wind forecast (SEMO report BM-012, about four
a day since August 2026) is scored against what the farms could have produced: SEMO's
availability, with the same check as the dispatch-down figures. Not their output, which
is lowered by dispatch-down. The scoring is isem-data's forecast_accuracy.py; this only
writes small summaries.

| File           | One row per                                                       |
|----------------|-------------------------------------------------------------------|
| by_hours.csv   | hour ahead (0 to 95): average miss and bias                       |
| daily.csv      | trading day: the day-ahead version's miss and bias, and the latest |
| monthly.csv    | month: the same                                                   |
| halfhours.csv  | half-hour: day-ahead and latest forecasts, available, output      |
| meta.json      | headline figures, dates, farms covered                            |

"Day-ahead" is the version the auction had: the newest published by 09:00 UTC the day
before. "Latest" is the newest version published before each half-hour.
"""

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd
from isem_data import dispatch_down, storage
from isem_data import forecast_accuracy as fa

OUT = Path(__file__).resolve().parent.parent / "src" / "forecasts" / "data" / "wind-forecast"


def numbers(table: pd.DataFrame, places: int) -> pd.DataFrame:
    return table.round({c: places for c in table.select_dtypes("number").columns})


def scores(table: pd.DataFrame, forecast: str) -> pd.Series:
    error = table[forecast] - table["available_mw"]
    return pd.Series(
        {
            "mae_mw": error.abs().mean(),
            "bias_mw": error.mean(),
            "available_mw": table["available_mw"].mean(),
        }
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    farms = dispatch_down.farm_half_hours(
        storage.load("availability"),
        storage.load("metered"),
        storage.load("dispatch_instructions"),
        storage.load("units"),
    )
    totals = fa.version_totals(farms)

    # Each half-hour: the forecast the auction had, the latest one, and what happened.
    ahead = fa.day_ahead(totals)
    latest = fa.latest_before(totals)
    halfhours = ahead[["timestamp_utc", "day", "published_utc", "forecast_mw", "available_mw", "output_mw"]]
    halfhours = halfhours.rename(columns={"forecast_mw": "day_ahead_mw", "published_utc": "day_ahead_published_utc"})
    halfhours = halfhours.merge(
        latest[["timestamp_utc", "forecast_mw", "hours_ahead"]].rename(
            columns={"forecast_mw": "latest_mw", "hours_ahead": "latest_hours_ahead"}
        ),
        on="timestamp_utc",
    )

    # Whole trading days only, so every day and month counts the same half-hours.
    counts = halfhours.groupby("day")["timestamp_utc"].transform("size")
    halfhours = halfhours[counts >= 46].copy()

    day_scores = halfhours.groupby("day").apply(
        lambda d: pd.concat(
            [
                scores(d, "day_ahead_mw"),
                scores(d, "latest_mw").rename(lambda c: f"latest_{c}").drop("latest_available_mw"),
                pd.Series({"output_mw": d["output_mw"].mean()}),
            ]
        ),
        include_groups=False,
    )
    published = halfhours.groupby("day")["day_ahead_published_utc"].first()
    daily = day_scores.join(published).reset_index()

    halfhours["month"] = pd.to_datetime(halfhours["day"]).dt.strftime("%Y-%m")
    monthly = (
        halfhours.groupby("month")
        .apply(
            lambda m: pd.concat(
                [
                    scores(m, "day_ahead_mw"),
                    scores(m, "latest_mw").rename(lambda c: f"latest_{c}").drop("latest_available_mw"),
                    pd.Series({"days": m["day"].nunique()}),
                ]
            ),
            include_groups=False,
        )
        .reset_index()
    )

    by_hours = fa.by_hours_ahead(totals, step=1)
    by_hours = by_hours[by_hours["hours_ahead"] < 96]

    # Headline figures, all over the same whole days.
    first, last = halfhours["day"].min(), halfhours["day"].max()
    in_days = totals[(fa.trading_day(totals["timestamp_utc"]) >= first) & (fa.trading_day(totals["timestamp_utc"]) <= last)]
    bands = fa.by_hours_ahead(in_days, step=24).set_index("hours_ahead")["mae_mw"]
    whole = scores(halfhours, "day_ahead_mw")
    against_output = halfhours["day_ahead_mw"] - halfhours["output_mw"]
    used = halfhours.groupby("day")["day_ahead_published_utc"].first()
    fallbacks = [
        {"day": str(day), "published_utc": t.strftime("%Y-%m-%dT%H:%MZ")}
        for day, t in used.items()
        if t.date() != day - timedelta(days=1)
    ]
    meta = {
        "built_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "first_day": str(first),
        "last_day": str(last),
        "days": int(halfhours["day"].nunique()),
        "farms": int(totals["farms"].median()),
        "cutoff_hour_utc": fa.CUTOFF_HOUR_UTC,
        "day_ahead": {
            "mae_mw": round(float(whole["mae_mw"]), 1),
            "bias_mw": round(float(whole["bias_mw"]), 1),
            "available_mw": round(float(whole["available_mw"]), 1),
            "hours_ahead_min": round(float(halfhours["timestamp_utc"].sub(halfhours["day_ahead_published_utc"]).dt.total_seconds().min() / 3600), 1),
        },
        "latest": {
            "mae_mw": round(float((halfhours["latest_mw"] - halfhours["available_mw"]).abs().mean()), 1),
            "median_hours_ahead": round(float(halfhours["latest_hours_ahead"].median()), 1),
        },
        "against_output": {
            "mae_mw": round(float(against_output.abs().mean()), 1),
            "bias_mw": round(float(against_output.mean()), 1),
        },
        "mae_by_day_ahead": {f"{int(h // 24) + 1}": round(float(v), 1) for h, v in bands.items() if h < 96},
        "fallback_versions": fallbacks,
    }

    files = {
        "by_hours.csv": numbers(by_hours, 1),
        "daily.csv": numbers(daily, 1),
        "monthly.csv": numbers(monthly, 1),
        "halfhours.csv": numbers(halfhours.drop(columns=["month"]), 1),
    }
    for name, table in files.items():
        table.to_csv(OUT / name, index=False, date_format="%Y-%m-%dT%H:%MZ")
    (OUT / "meta.json").write_text(json.dumps(meta, indent=2, allow_nan=False) + "\n")
    for path in sorted(OUT.iterdir()):
        print(f"{path.name:14} {path.stat().st_size / 1000:7,.0f} kB")


if __name__ == "__main__":
    main()
