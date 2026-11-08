---
title: Methods & data
---

<p class="eyebrow">Methods & data</p>

# How the figures are made

<p class="lede">Everything here is calculated from public data published by SEMO, and checked against EirGrid's official monthly figures.</p>

```js
import "./components/nav.js";
import {REGION_NAMES, monthName, percent, gwh, euros} from "./components/format.js";

const monthly = FileAttachment("data/monthly.csv").csv({typed: true});
const meta = FileAttachment("data/meta.json").json();
```

## What dispatch-down is

Wind and solar farms are sometimes told by the grid operator, EirGrid, to produce less than the wind allows. That lost output is **dispatch-down**. It has two causes:

- **Constraint:** the local grid can't carry the power, so farms in that area are held down.
- **Curtailment:** there is more wind than the whole island can take at once, for example to keep enough conventional generation running for stability, so farms are held down everywhere.

## How it's calculated

Everything comes from public reports published by SEMO, the Single Electricity Market Operator:

| Report | What it gives, per farm |
|---|---|
| Daily Dispatch Instructions (BM-037) | Every instruction: when a constraint or curtailment was switched on and off |
| Average Outturn Availability (BM-101) | Half-hourly MW the farm could have produced |
| Daily Meter Data (BM-086) | Half-hourly energy the farm actually produced |
| Unit Data (BM-091) | Which units are wind farms, and the company behind each |

For each wind farm and half-hour:

- **Energy lost** = (availability − actual output) × half an hour, counted only while a constraint or curtailment instruction is in force, and never below zero.
- Constraint and curtailment are tracked separately, since a farm can be under both at once. When both are on, the loss counts as a **constraint**.
- **Dispatched down %** = energy lost ÷ (energy produced + energy lost): the share of the energy the wind allowed that wasn't produced.
- **Market value** = energy lost × the day-ahead price in that half-hour, for the farm's zone (Ireland or Northern Ireland). It is what the energy would have sold for, **not what the owners lost**: some dispatch-down is compensated, and how much is disputed. It can be negative when prices are.

Days and months are Irish clock time.

## How close is it to the official figures?

EirGrid publishes official monthly dispatch-down figures in its [dispatch-down summary workbook](https://www.eirgrid.ie/sites/default/files/publications/DD-Summary-Report-V23.xlsx), usually about a month after the month ends. Comparing September 2026 (our figures start on the 7th):

| | This site | EirGrid (official) |
|---|---|---|
| All-island | 24.3% | 22.7% |
| Ireland | 22.4% | 20.5% |
| Northern Ireland | 31.5% | 30.6% |
| Share that was constraint, all-island | 67% | 77% |

So the level is within about 2 percentage points, slightly high. This site counts somewhat more of the loss as curtailment than EirGrid does. Likely reasons: EirGrid uses one-minute readings where this uses half-hours, and EirGrid's own measure of available energy differs a little from SEMO's.

## Farm names and the map

SEMO's data identifies farms only by codes such as GU_405140. Their names come from SEMO's own lists of registered units: its yearly loss adjustment factor publication for Ireland, and its lists of registered units, which add Northern Ireland. Positions come from [OpenStreetMap](https://www.openstreetmap.org), which maps most wind farms on the island. Each named farm is matched to the OpenStreetMap farm with the most similar name, and a short list of hand corrections covers the rest (for example, Seecon and Uggool are the two phases of Galway Wind Park).

Each farm has its own page. Where two market units are matched to the same farm (usually its phases), the page adds them together; units with no name are listed by their SEMO code. About four in five farms have a name, and most of those are on the map. The ones that can't be placed are mostly suppliers' grouped units that don't name a farm, plus a few farms not on OpenStreetMap under SEMO's name. A match may occasionally be wrong.

## Known limits

- **Estimates, not official figures.** For official numbers, use EirGrid's.
- **Solar is probably included.** SEMO lists solar farms with the same fuel type as wind, so they can't yet be told apart.
- **Small farms are missing.** The farms here produce about 95% of the island's wind energy; the rest come from small farms that aren't separate market units.
- **Gaps.** When SEMO publishes no files for a day, that day is missing.${meta.missing_days.length ? ` Currently: ${meta.missing_days.join(", ")}.` : ""}
- **Some farms have no name.** About one in five units isn't in SEMO's published lists, so it's shown by its code (for example GU_504460); most are suppliers' grouped units.

## Months covered

```js
Inputs.table(
  monthly.map((d) => ({...d, region: REGION_NAMES[d.region], days: `${d.days_with_data} of ${d.days_in_month}`})),
  {
    columns: ["month", "region", "days", "dispatch_down_pct", "lost_mwh", "lost_value_eur"],
    header: {
      month: "Month",
      region: "Region",
      days: "Days with data",
      dispatch_down_pct: "Dispatched down",
      lost_mwh: "Lost",
      lost_value_eur: "Market value"
    },
    format: {
      month: monthName,
      dispatch_down_pct: percent,
      lost_mwh: gwh,
      lost_value_eur: euros
    },
    layout: "auto",
    rows: 12
  }
)
```

## Download the data

The summary files behind this site, free to reuse under the same licence (please keep the credit line):

```js
const downloads = [
  [FileAttachment("data/monthly.csv"), "by month and region"],
  [FileAttachment("data/daily.csv"), "by day and region"],
  [FileAttachment("data/farms.csv"), "by farm, whole period"],
  [FileAttachment("data/farm_monthly.csv"), "by farm and month"],
  [FileAttachment("data/farm_daily.csv"), "by farm and day"],
  [FileAttachment("data/farm_locations.csv"), "farm positions (from OpenStreetMap, under the ODbL)"]
];
display(html`<ul>${downloads.map(([file, what]) => html`<li><a href=${file.href} download=${file.name}>${file.name}</a>: ${what}</li>`)}</ul>`);
```

Energy is in MWh, values in euros. Data runs from ${meta.first_day} to ${meta.last_day}.

## Licence and independence

Supported by EirGrid Group Data, used under the [EirGrid Group Open Data Licence](https://www.smartgriddashboard.com/ni/open-data-license). This site is independent and is not affiliated with or endorsed by EirGrid, SONI or SEMO. The data is provided as is, and the figures here are estimates.

Farm positions and the map background are © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors. The farm positions file is available under the [Open Database Licence](https://opendatacommons.org/licenses/odbl/).
