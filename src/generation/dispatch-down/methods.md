---
title: Methods & data
---

<div class="page-head">
  <p class="eyebrow">Methods &amp; data</p>
  <h1>How the figures are made</h1>
  <p class="lede">Everything here is calculated from public data published by SEMO, and checked against EirGrid's official monthly figures.</p>
</div>

```js
import "../../components/shell.js";
import {REGION_NAMES, monthName, percent, gwh, euros} from "../../components/format.js";

const monthly = FileAttachment("data/monthly.csv").csv({typed: true});
const meta = FileAttachment("data/meta.json").json();
```

```js
// How much of the island's wind energy the units in SEMO's reports make, by month.
const shares = monthly
  .filter((d) => d.region === "ALL" && d.days_with_data >= 0.8 * d.days_in_month)
  .map((d) => (100 * d.units_produced_mwh) / d.produced_mwh);
const coverage = `about ${d3.format(".0f")(d3.min(shares))}-${d3.format(".0f")(d3.max(shares))}%`;
```

<div class="section">

<p class="label" style="margin-bottom: 0.8rem;">01</p>

## What dispatch down is

Wind and solar farms are sometimes told by the grid operator, EirGrid, to produce less than the wind allows. That lost output is **dispatch down**. It has two causes:

- **Constraint:** the local grid can't carry the power, so farms in that area are held down.
- **Curtailment:** there is more wind than the whole island can take at once, for example to keep enough conventional generation running for stability, so farms are held down everywhere.

</div>

<div class="section">

<p class="label" style="margin-bottom: 0.8rem;">02</p>

## How it's calculated

Everything comes from public reports published by SEMO, the Single Electricity Market Operator:

<div class="steps">
  <div class="step"><div class="label"><span>01</span><span>BM-037</span></div><h3>Dispatch instructions</h3><p>Every instruction: when a constraint or curtailment was switched on and off. SEMO issues these twice; the later, fuller version is used where it exists.</p></div>
  <div class="step"><div class="label"><span>02</span><span>BM-101</span></div><h3>Availability</h3><p>Half-hourly MW each farm could have produced.</p></div>
  <div class="step"><div class="label"><span>03</span><span>BM-086</span></div><h3>Meter data</h3><p>Half-hourly energy each farm actually produced.</p></div>
  <div class="step"><div class="label"><span>04</span><span>BM-091</span></div><h3>Unit data</h3><p>Which units are wind farms, and the company behind each.</p></div>
</div>

EirGrid's [Smart Grid Dashboard](https://www.smartgriddashboard.com) adds total wind generation for the island and each region.

For each wind farm and half-hour:

- **Energy lost** = (available power − actual output) × half an hour, counted only while a constraint or curtailment instruction is in force, and never below zero.
- **Available power** is the farm's declared availability, checked against what the farm really makes. Some farms keep declaring their full availability while making far less, even when no instruction is holding them down: most likely turbines out of service. Without a check, those missing turbines would count as wind turned down. So each farm's output is compared with its declared availability over the past seven days, in the half-hours when it was free. If it made under 80% of what it declared, its availability is scaled down by that ratio until it recovers. A farm needs at least a day's worth of free half-hours in the week to be judged. In October 2026 this check took the island's figure from 18.1% to 16.3%.
- Constraint and curtailment are tracked separately, since a farm can be under both at once. When both are on, the loss counts as a **constraint**.
- A farm stays held down until an instruction releases it. If SEMO publishes no instructions at all for a day, every farm is treated as released from the start of that day, and counts as held down again only when a new instruction says so.
- **Dispatched down %** = energy lost ÷ (energy produced + energy lost): the share of the energy the wind allowed that wasn't produced. For the island and its regions, energy produced is **all wind generation**, from EirGrid's Smart Grid Dashboard, because the units in SEMO's reports don't cover every wind farm. On a farm's page it's that farm's own metered output.
- **Market value** = energy lost × the day-ahead price in that half-hour, for the farm's zone (Ireland or Northern Ireland). It is what the energy would have sold for, **not what the owners lost**: some dispatch down is compensated, and how much is disputed. It can be negative when prices are.

Days and months are Irish clock time.

</div>

<div class="section">

<p class="label" style="margin-bottom: 0.8rem;">03</p>

## How close is it to the official figures?

EirGrid publishes official monthly dispatch down figures in its [dispatch down summary workbook](https://www.eirgrid.ie/sites/default/files/publications/DD-Summary-Report-V24.xlsx), usually about six weeks after the month ends. This site's figures leave out 1-6 September (before our archive starts) and 27 October (SEMO published no files for it), so the comparison below uses EirGrid's figures for the same days. EirGrid publishes its daily figures only as charts, so those were read from the chart images and scaled to its monthly totals; they're approximate, to a few tenths of a point.

| Same days | This site | EirGrid (approx.) |
|---|---|---|
| September 2026 (7-30), all-island | 22.2% | 21.8% |
| September, Ireland | 20.2% | 19.8% |
| September, Northern Ireland | 29.3% | 29.1% |
| October 2026 (without the 27th), all-island | 16.3% | 15.8% |
| October, Ireland | 15.1% | 14.5% |
| October, Northern Ireland | 21.7% | 21.0% |
| Share that was constraint, Ireland, September / October | 79% / 71% | 73% / 60% (whole months) |

So the level is within about half a percentage point, slightly high. For comparison, EirGrid's official whole-month figures are 22.7% for September and 16.2% for October; the [ten-year page](./history) uses those. **The split between constraint and curtailment is less reliable than the total:** this site counts somewhat more of the loss as constraint than EirGrid does. A likely reason is that when a farm is under both at once, all of its loss counts as constraint here, where EirGrid divides it between the two. EirGrid also uses one-minute readings where this site uses half-hours, and its measure of available energy differs a little from SEMO's. The availability check catches farms that make far less than they declare, but a shorter or partial outage can still be counted as dispatch down here.

</div>

<div class="section">

<p class="label" style="margin-bottom: 0.8rem;">04</p>

## Farm names and the map

SEMO's data identifies farms only by codes such as GU_405140. Their names come from SEMO's own lists of registered units: its yearly loss adjustment factor publication for Ireland, and its lists of registered units, which add Northern Ireland. Positions come from [OpenStreetMap](https://www.openstreetmap.org), which maps most wind farms on the island. Each named farm is matched to the OpenStreetMap farm with the most similar name, and a short list of hand corrections covers the rest (for example, Seecon and Uggool are the two phases of Galway Wind Park).

Each farm has its own page. Where two market units are matched to the same farm (usually its phases), the page adds them together; units with no name are listed by their SEMO code. About four in five farms have a name, and most of those are on the map. The ones that can't be placed are mostly suppliers' grouped units that don't name a farm, plus a few farms not on OpenStreetMap under SEMO's name. A match may occasionally be wrong.

</div>

<div class="section">

<p class="label" style="margin-bottom: 0.8rem;">05</p>

## Known limits

- **Estimates, not official figures.** For official numbers, use EirGrid's.
- **Solar farms are left out by a rule of thumb.** SEMO lists solar farms with the same fuel type as wind. Island and regional figures leave out ${meta.solar_units} units that are named as solar, or that have no availability at night. Some could be missed. Solar farms keep their own pages.
- **Lost energy is only measured for some farms.** The units in SEMO's reports make ${coverage} of the island's wind energy; the rest come from farms that aren't separate market units. Any energy those farms lose isn't counted, though their output is.
- **Gaps.** When SEMO publishes no files for a day, that day is missing.${meta.missing_days.length ? ` Currently: ${meta.missing_days.join(", ")}.` : ""}
- **Some farms have no name.** About one in five units isn't in SEMO's published lists, so it's shown by its code (for example GU_504460); most are suppliers' grouped units.

</div>

<div class="section">

<p class="label" style="margin-bottom: 0.8rem;">06</p>

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

</div>

<div class="section">

<p class="label" style="margin-bottom: 0.8rem;">07</p>

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

Energy is in MWh, values in euros. In the monthly and daily files, `produced_mwh` is all wind generation and `units_produced_mwh` is what the units in SEMO's reports made. Data runs from ${meta.first_day} to ${meta.last_day}.

</div>

<div class="section">

<p class="label" style="margin-bottom: 0.8rem;">08</p>

## Licence and attribution

Supported by EirGrid Group Data, used under the [EirGrid Group Open Data Licence](https://www.smartgriddashboard.com/ni/open-data-license). Open Power Lab is not affiliated with or endorsed by EirGrid, SONI or SEMO. The data is provided as is, and the figures here are estimates.

Farm positions and the map background are © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors. The farm positions file is available under the [Open Database Licence](https://opendatacommons.org/licenses/odbl/).

</div>
