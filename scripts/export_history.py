"""Write the ten-year dispatch-down files the site reads (src/generation/dispatch-down/data/).

Run with a Python that has pandas, numpy, openpyxl and statsmodels (Anaconda has them all):

    python3 scripts/export_history.py            # downloads EirGrid's workbook, version 24
    python3 scripts/export_history.py --version 25
    python3 scripts/export_history.py --workbook path/to/DD-Summary-Report-V24.xlsx

Two sources:

- EirGrid's dispatch-down workbook ("DD Summary Report"), sheet "Wind & Solar Monthly
  Detailed": every month since 2016, wind only, for the island, Ireland and Northern
  Ireland. EirGrid publishes a new version about six weeks after each month ends.
- A wind index (scripts/history/wind_index.csv): how windy each month was at the island's
  wind farms, from ERA5 reanalysis wind at 100 m (via Open-Meteo, CC BY 4.0) at 12 points
  weighted by farm capacity, through a generic turbine curve. 2000 to October 2026.
  It is built by the analysis in the Partner vault (ml/weather-adjusted-dispatch-down:
  fetch_weather.py, then build_panel.py); copy its data/wind_index.csv here to extend it.

The weather adjustment asks: what would each month's dispatch-down have been with normal
wind for that time of year? For constraint and for curtailment separately, it fits the
share turned down against the month's wind (a fractional logit, curved, with an effect for
each year and each calendar month), then moves each month along that curve from its actual
wind to normal wind, keeping everything the wind didn't explain.

| File                 | One row per                                                   |
|----------------------|---------------------------------------------------------------|
| history_monthly.csv  | month and region: energy, reported and adjusted shares, wind  |
| history_yearly.csv   | year and region: the same, for whole years                    |
| history_season.csv   | calendar month: normal wind, and the share cut at the same wind |
| history_meta.json    | workbook version, months covered, fit checks, when built      |
"""

import argparse
import json
import urllib.request
import warnings
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import openpyxl
import pandas as pd
import statsmodels.api as sm
import statsmodels.formula.api as smf

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src/generation/dispatch-down/data"
WIND_INDEX = ROOT / "scripts/history/wind_index.csv"
CACHE = Path.home() / ".cache/irish-power-lab"
URL = "https://www.eirgrid.ie/sites/default/files/publications/DD-Summary-Report-V{}.xlsx"
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
# Workbook region codes and the site's names for them, and each region's first column.
REGIONS = {"AI": ("ALL", 2), "IE": ("ROI", 27), "NI": ("NI", 52)}
FIRST_YEAR = 2016  # the detailed monthly sheet starts here


def fetch_workbook(version):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"DD-Summary-Report-V{version}.xlsx"
    if not path.exists():
        request = urllib.request.Request(URL.format(version), headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(request, timeout=60) as response:
            path.write_bytes(response.read())
    return path


def read_workbook(path):
    """Monthly wind availability, generation and dispatch-down (MWh) for each region."""
    book = openpyxl.load_workbook(path, read_only=True, data_only=True)
    rows = list(book["Wind & Solar Monthly Detailed"].iter_rows(values_only=True))
    # Check the columns are where we expect: the sheet's layout has been stable, but say
    # so loudly if EirGrid changes it.
    assert rows[2][0] == "All Island Wind" and rows[2][25] == "Ireland Wind" and rows[2][50] == "Northern Ireland Wind", rows[2][:3]
    for _, start in REGIONS.values():
        labels = [str(v).split()[0] for v in rows[3][start : start + 7]]
        assert labels == ["Availability", "Generation", "Dispatch", "Constraints", "Transmission", "TSO", "Curtailments"], labels
    records = []
    year = None
    for row in rows:
        if isinstance(row[0], int):
            year = row[0]
        if not year or row[1] not in MONTHS:
            continue
        for code, (region, start) in REGIONS.items():
            if not isinstance(row[start], (int, float)) or not row[start]:
                continue
            records.append(
                {
                    "year": year,
                    "month": MONTHS.index(row[1]) + 1,
                    "jur": code,
                    "region": region,
                    "avail": float(row[start]),
                    "gen": float(row[start + 1]),
                    "dd": float(row[start + 2]),
                    "constraint": float(row[start + 3]),
                    "curtail": float(row[start + 6]),
                }
            )
    data = pd.DataFrame(records)

    # Check against EirGrid's own percentages sheet.
    sheet = list(book["DD Perc from 2011 to date"].iter_rows(values_only=True))
    years = {j: v for j, v in enumerate(sheet[2]) if isinstance(v, int)}
    published = []
    for row in sheet[4:]:
        if row[1] in MONTHS:
            for j, y in years.items():
                for k, code in enumerate(["NI", "IE", "AI"]):
                    if isinstance(row[j + k], (int, float)):
                        published.append({"year": y, "month": MONTHS.index(row[1]) + 1, "jur": code, "pct": row[j + k]})
    check = data.merge(pd.DataFrame(published), on=["year", "month", "jur"])
    # A few 2018 months differ by up to 0.07 points between the two sheets (EirGrid seems
    # to have revised one and not the other), so allow a tenth of a point.
    gap = (check.dd / check.avail - check.pct).abs().max()
    assert len(check) > 0.9 * len(data) and gap < 1e-3, f"workbook doesn't match its own percentages ({gap})"
    return data


def expit(x):
    return 1 / (1 + np.exp(-x))


def fit(d, column):
    """Share turned down against wind (curved), with an effect for each year and month."""
    return smf.glm(
        f"{column} ~ w + I(w**2) + C(year) + C(month)", data=d.sort_values("t"), family=sm.families.Binomial()
    ).fit(cov_type="HAC", cov_kwds={"maxlags": 6})


def curve(w, model):
    return model.params["w"] * w + model.params["I(w ** 2)"] * w**2


def adjust(d):
    """Each month moved along the fitted wind curve from its actual wind to normal wind."""
    d = d.sort_values("t").copy()
    d["adjusted"] = 0.0
    models = {}
    for part in ["constraint", "curtail"]:
        y = (d[part] / d.avail).clip(1e-5, 1 - 1e-5)
        d[f"y_{part}"] = y
        model = fit(d, f"y_{part}")
        models[part] = model
        d[f"{part}_adjusted"] = expit(np.log(y / (1 - y)) + curve(d.wn, model) - curve(d.w, model))
        d["adjusted"] += d[f"{part}_adjusted"]
    # Energy the wind would have allowed with normal wind: used to weight months together.
    d["avail_normal"] = d.avail * d.cf_norm / d.cf
    return d, models


def yearly(d):
    def one(v):
        return pd.Series(
            {
                "reported_pct": 100 * v.dd.sum() / v.avail.sum(),
                "adjusted_pct": 100 * (v.adjusted * v.avail_normal).sum() / v.avail_normal.sum(),
                "constraint_pct": 100 * v.constraint.sum() / v.avail.sum(),
                "curtailment_pct": 100 * v.curtail.sum() / v.avail.sum(),
                "wind_vs_normal_pct": 100 * (v.cf.mean() / v.cf_norm.mean() - 1),
                "available_gwh": v.avail.sum() / 1000,
                "lost_gwh": v.dd.sum() / 1000,
                "months": len(v),
            }
        )

    return d.groupby(["region", "year"]).apply(one).reset_index()


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--version", type=int, default=24, help="EirGrid workbook version to download")
    parser.add_argument("--workbook", type=Path, help="use this workbook instead of downloading")
    args = parser.parse_args()
    path = args.workbook or fetch_workbook(args.version)
    version = args.version if not args.workbook else path.stem

    eirgrid = read_workbook(path)
    wind = pd.read_csv(WIND_INDEX)
    panel = eirgrid.merge(wind[["year", "month", "jur", "cf", "cf_norm"]], on=["year", "month", "jur"], how="inner")
    missing = len(eirgrid) - len(panel)
    assert missing == 0, f"{missing} months have no wind index: extend scripts/history/wind_index.csv"
    panel["t"] = (panel.year - FIRST_YEAR) * 12 + panel.month
    panel["w"] = panel.cf * 10  # capacity factor in tens of percent
    panel["wn"] = panel.cf_norm * 10

    parts, checks = [], {}
    for code in REGIONS:
        adjusted, models = adjust(panel[panel.jur == code])
        parts.append(adjusted)
        if code == "AI":
            all_island, all_models = adjusted, models
    data = pd.concat(parts)

    # How much of the month-to-month variation (after year and season) the wind explains.
    a = all_island.assign(y_dd=all_island.dd / all_island.avail)
    base = smf.ols("y_dd ~ C(year) + C(month)", data=a).fit()
    full = smf.ols("y_dd ~ w + I(w**2) + C(year) + C(month)", data=a).fit()
    checks["wind_explains_pct"] = round(100 * (1 - full.ssr / base.ssr))
    checks["typical_monthly_miss_pts"] = round(100 * float(np.std(a.y_dd - full.fittedvalues)), 1)

    monthly = pd.DataFrame(
        {
            "month": pd.to_datetime(dict(year=data.year, month=data.month, day=1)).dt.strftime("%Y-%m"),
            "region": data.region,
            "available_gwh": (data.avail / 1000).round(2),
            "lost_gwh": (data.dd / 1000).round(2),
            "reported_pct": (100 * data.dd / data.avail).round(2),
            "constraint_pct": (100 * data.constraint / data.avail).round(2),
            "curtailment_pct": (100 * data.curtail / data.avail).round(2),
            "adjusted_pct": (100 * data.adjusted).round(2),
            "wind_cf": (100 * data.cf).round(1),
            "normal_cf": (100 * data.cf_norm).round(1),
            "wind_vs_normal_pct": (100 * (data.cf / data.cf_norm - 1)).round(1),
            "available_normal_gwh": (data.avail_normal / 1000).round(2),
        }
    ).sort_values(["region", "month"])
    monthly.to_csv(OUT / "history_monthly.csv", index=False)

    years = yearly(data).round(2)
    years.to_csv(OUT / "history_yearly.csv", index=False)

    # Season: the share the model expects at the same wind (capacity factor 25%) in each
    # calendar month, at the latest full year's level; and normal wind by month.
    level = int(all_island[all_island.groupby("year").month.transform("count") == 12].year.max())
    same = pd.DataFrame({"w": 2.5, "year": level, "month": range(1, 13)})
    normal = all_island.groupby("month").cf_norm.first()
    season = pd.DataFrame(
        {
            "month": range(1, 13),
            "normal_cf": (100 * normal.reindex(range(1, 13))).round(1).values,
            "constraint_pct": (100 * all_models["constraint"].predict(same)).round(2).values,
            "curtailment_pct": (100 * all_models["curtail"].predict(same)).round(2).values,
        }
    )
    season.to_csv(OUT / "history_season.csv", index=False)

    last = all_island.sort_values("t").iloc[-1]
    meta = {
        "built_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "workbook": f"EirGrid DD Summary Report V{version}" if isinstance(version, int) else str(version),
        "workbook_url": URL.format(version) if isinstance(version, int) else None,
        "first_month": f"{FIRST_YEAR}-01",
        "last_month": f"{int(last.year)}-{int(last.month):02d}",
        "season_level_year": level,
        "season_wind_cf_pct": 25,
        **checks,
    }
    (OUT / "history_meta.json").write_text(json.dumps(meta, indent=2) + "\n")

    # A short report, so a run can be checked by eye.
    ai = years[years.region == "ALL"].set_index("year")
    print(f"{meta['workbook']}: {meta['first_month']} to {meta['last_month']}")
    print(ai[["reported_pct", "adjusted_pct", "wind_vs_normal_pct", "months"]].round(1).to_string())
    print(f"Wind explains {checks['wind_explains_pct']}% of the variation left after year and season")


if __name__ == "__main__":
    main()
