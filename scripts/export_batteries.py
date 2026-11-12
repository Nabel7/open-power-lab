"""Write the battery summaries the site reads (src/data/batteries/).

Run with isem-data's Python, so it can read isem-data's archive:

    ~/Developer/isem-data/.venv/bin/python scripts/export_batteries.py

Batteries are the units SEMO lists with fuel type BATTERY_STORAGE. From SEMO's reports:

- metered output (BM-086), half-hourly: + discharging to the grid, - charging. Idle
  batteries draw a little power for cooling and controls (about 0.2 MW), which shows
  as charging. SEMO keeps only 2-3 months of this, so the archive starts in September.
- availability (BM-101), whose highest value we take as each unit's size in MW.
- each unit's cleared day-ahead orders, half-hourly, for the past year: + bought, - sold.

| File            | One row per                                                  |
|-----------------|--------------------------------------------------------------|
| units.csv       | battery: name, company, region, size in MW                   |
| fleet_hh.csv    | half-hour: all batteries' charging and discharging, and price |
| unit_totals.csv | battery: energy in and out, and day-ahead value, whole period |
| dam_monthly.csv | month: the fleet's day-ahead purchases, sales and value       |
| meta.json       | periods covered, when built                                  |

"Value" means energy priced at the SEM day-ahead price in that half-hour. It is not
what the owners earned: batteries also trade intraday and in balancing, and much of
their income in Ireland comes from system services (DS3), none of which is here.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from isem_data import storage

OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "batteries"
LOCAL = "Europe/Dublin"


def numbers(table: pd.DataFrame, places: int) -> pd.DataFrame:
    return table.round({c: places for c in table.select_dtypes("number").columns})


def main() -> None:
    units = storage.load("units").drop_duplicates("unit", keep="last")
    batteries = units[units["fuel_type"] == "BATTERY_STORAGE"]
    names = storage.load("farm_names").set_index("unit")["semo_name"]
    availability = storage.load("availability")
    size = availability[availability["unit"].isin(batteries["unit"])].groupby("unit")["availability_mw"].max()

    table = batteries[["unit", "company", "region"]].copy()
    table["name"] = [names.get(u) or f"Battery {u}" for u in table["unit"]]
    table["size_mw"] = table["unit"].map(size)
    table = table.dropna(subset=["size_mw"]).sort_values("size_mw", ascending=False)

    price = storage.load("prices")
    price = price[(price["series"] == "dam_price_eur_mwh") & (price["region"] == "ROI")]
    price = price.set_index("timestamp_utc")["value"].rename("price")

    # Metered flows, half-hourly.
    metered = storage.load("metered")
    flows = metered[metered["unit"].isin(table["unit"])].join(price, on="timestamp_utc")
    flows = flows.dropna(subset=["price"])
    flows["out_mwh"] = flows["metered_mwh"].clip(lower=0)
    flows["in_mwh"] = (-flows["metered_mwh"]).clip(lower=0)
    flows["value_eur"] = flows["metered_mwh"] * flows["price"]

    fleet = flows.groupby("timestamp_utc").agg(
        discharging_mw=("out_mwh", lambda s: s.sum() * 2),
        charging_mw=("in_mwh", lambda s: s.sum() * 2),
        units=("unit", "nunique"),
    )
    fleet = fleet.join(price).reset_index()

    # Day-ahead orders, half-hourly: + bought (charging), - sold (discharging).
    orders = storage.load("orders")
    orders = orders[orders["unit"].isin(table["unit"])]
    orders = orders.groupby(["timestamp_utc", "unit"], as_index=False)["quantity_mw"].sum()
    orders = orders.join(price, on="timestamp_utc").dropna(subset=["price"])
    orders["sold_mwh"] = (-orders["quantity_mw"]).clip(lower=0) * 0.5
    orders["bought_mwh"] = orders["quantity_mw"].clip(lower=0) * 0.5
    orders["dam_value_eur"] = -orders["quantity_mw"] * 0.5 * orders["price"]

    first_metered = flows["timestamp_utc"].min()
    totals = (
        flows.groupby("unit")
        .agg(out_mwh=("out_mwh", "sum"), in_mwh=("in_mwh", "sum"), value_eur=("value_eur", "sum"))
        .join(
            orders[orders["timestamp_utc"] >= first_metered]
            .groupby("unit")
            .agg(dam_sold_mwh=("sold_mwh", "sum"), dam_bought_mwh=("bought_mwh", "sum"), dam_value_eur=("dam_value_eur", "sum"))
        )
        .fillna(0)
        .reset_index()
    )

    month = (orders["timestamp_utc"] + pd.Timedelta(hours=1)).dt.tz_convert(LOCAL).dt.strftime("%Y-%m")
    dam_monthly = orders.assign(month=month).groupby("month").agg(
        sold_mwh=("sold_mwh", "sum"),
        bought_mwh=("bought_mwh", "sum"),
        dam_value_eur=("dam_value_eur", "sum"),
        units=("unit", "nunique"),
        half_hours=("timestamp_utc", "nunique"),
    )
    dam_monthly = dam_monthly.reset_index()

    OUT.mkdir(parents=True, exist_ok=True)
    files = {
        "units.csv": numbers(table, 1),
        "fleet_hh.csv": numbers(fleet, 2),
        "unit_totals.csv": numbers(totals, 1),
        "dam_monthly.csv": numbers(dam_monthly, 1),
    }
    for name, data in files.items():
        data.to_csv(OUT / name, index=False, date_format="%Y-%m-%dT%H:%MZ")
    meta = {
        "built_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "metered_first_utc": first_metered.strftime("%Y-%m-%dT%H:%MZ"),
        "metered_last_utc": flows["timestamp_utc"].max().strftime("%Y-%m-%dT%H:%MZ"),
        "orders_first_utc": orders["timestamp_utc"].min().strftime("%Y-%m-%dT%H:%MZ"),
        "orders_last_utc": orders["timestamp_utc"].max().strftime("%Y-%m-%dT%H:%MZ"),
        "batteries": len(table),
        "size_mw": round(float(table["size_mw"].sum()), 1),
    }
    (OUT / "meta.json").write_text(json.dumps(meta, indent=2) + "\n")
    for path in sorted(OUT.iterdir()):
        print(f"{path.name:16} {path.stat().st_size / 1000:7,.0f} kB")
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
