---
title: Datasets
---

```js
import "./components/shell.js";
import {irishTime} from "./components/format.js";

const latest = FileAttachment("data/markets/latest.json").json();
const meta = FileAttachment("generation/dispatch-down/data/meta.json").json();

const files = [
  ["Day-ahead prices", FileAttachment("data/markets/prices_hh.csv"), "Half-hourly SEM price and volume in each zone, past year"],
  ["Day-ahead prices", FileAttachment("data/markets/prices_daily.csv"), "Daily average, volume-weighted average, lowest, highest, negative half-hours"],
  ["Wind & demand", FileAttachment("data/markets/system_hh.csv"), "Half-hourly wind, EirGrid wind forecast and demand, last 60 days"],
  ["Wind & demand", FileAttachment("data/markets/system_daily.csv"), "Daily wind and demand energy, wind share, forecast bias and error, past year"],
  ["Dispatch-down", FileAttachment("generation/dispatch-down/data/monthly.csv"), "By month and region"],
  ["Dispatch-down", FileAttachment("generation/dispatch-down/data/daily.csv"), "By day and region"],
  ["Dispatch-down", FileAttachment("generation/dispatch-down/data/farms.csv"), "By farm, whole period"],
  ["Dispatch-down", FileAttachment("generation/dispatch-down/data/farm_monthly.csv"), "By farm and month"],
  ["Dispatch-down", FileAttachment("generation/dispatch-down/data/farm_daily.csv"), "By farm and day"],
  ["Dispatch-down", FileAttachment("generation/dispatch-down/data/farm_locations.csv"), "Farm positions, from OpenStreetMap (Open Database Licence)"],
  ["Dispatch-down since 2016", FileAttachment("generation/dispatch-down/data/history_monthly.csv"), "By month and region since 2016, from EirGrid: reported and weather-adjusted shares, wind against normal"],
  ["Dispatch-down since 2016", FileAttachment("generation/dispatch-down/data/history_yearly.csv"), "The same by year"],
  ["Dispatch-down since 2016", FileAttachment("generation/dispatch-down/data/history_season.csv"), "Normal wind by calendar month, and the share turned down at the same wind"],
  ["Batteries", FileAttachment("data/batteries/units.csv"), "Each grid battery: name, company, region, size in MW"],
  ["Batteries", FileAttachment("data/batteries/fleet_hh.csv"), "Half-hourly: all batteries' charging and discharging, with the day-ahead price"],
  ["Batteries", FileAttachment("data/batteries/unit_totals.csv"), "Each battery: energy in and out, and day-ahead value, over the metered period"],
  ["Batteries", FileAttachment("data/batteries/dam_monthly.csv"), "The batteries' day-ahead purchases, sales and value, by month"]
];
```

<div class="page-head">
  <p class="crumbs">Data / Datasets</p>
  <h1>Datasets</h1>
  <p class="lede">Every figure on this site comes from public data. Here is where it comes from, how often it's updated, and the files behind each page, free to reuse with the credits below.</p>
  <div class="meta">
    <span>Market data to ${irishTime(new Date(latest.system_last_utc))}</span>
    <span>Dispatch-down data ${meta.first_day} to ${meta.last_day}</span>
  </div>
</div>

<div class="section">
  <div class="section-head"><h2>Sources</h2></div>
  <div class="card" style="padding: 0.4rem 0.9rem;">

| Data | Source | Resolution | History here | Updated |
|---|---|---|---|---|
| Day-ahead prices and volumes | SEMOpx auction results, published by SEMO | 30 min | 1 year | Daily |
| Wind output, EirGrid wind forecast, demand | EirGrid [Smart Grid Dashboard](https://www.smartgriddashboard.com) | 15 min | 1 year | Daily |
| Wind farm dispatch instructions, availability, metered output, unit list | SEMO balancing market reports BM-037, BM-101, BM-086, BM-091 | Per instruction, 30 min | About 2 months | Daily |
| Battery availability and metered output | The same SEMO reports, for units listed as battery storage | 30 min | About 2 months | Daily |
| Battery day-ahead orders | Each unit's cleared orders in SEMOpx's day-ahead results | 30 min | 1 year | Daily |
| Farm names | SEMO's published lists of registered units | Per unit | Current | Now and then |
| Farm positions | [OpenStreetMap](https://www.openstreetmap.org) | Per farm | Current | Now and then |
| Dispatch-down since 2016 | EirGrid's [dispatch-down summary report](https://www.eirgrid.ie/sites/default/files/publications/DD-Summary-Report-V24.xlsx) (V24) | Monthly | Since January 2016 | When EirGrid publishes, about six weeks after each month |
| Wind index for the weather adjustment | ERA5 reanalysis (Copernicus Climate Change Service) via [Open-Meteo](https://open-meteo.com) (CC BY 4.0) | Hourly, 12 points | Since 2000 | With each new EirGrid report |
| Wind forecast (Wind map) | [Open-Meteo](https://open-meteo.com), fetched by your browser; "Weather data by Open-Meteo.com" (CC BY 4.0) | Hourly, about 30 km grid | Next 3 days | Each visit |

  </div>
  <p class="muted" style="margin-top: 0.6rem;">Updates are daily, not live. For live system data, use EirGrid's Smart Grid Dashboard.</p>
</div>

<div class="section">
  <div class="section-head"><h2>Files</h2></div>
  <div class="card" style="padding: 0.4rem 0.9rem;">

```js
Inputs.table(
  files.map(([area, file, about]) => ({area, file: file.name, about, link: file})),
  {
    columns: ["area", "file", "about"],
    header: {area: "Area", file: "File", about: "What's in it"},
    format: {file: (name, i, data) => html`<a href=${data[i].link.href} download=${name}>${name}</a>`},
    layout: "auto",
    select: false,
    rows: 12
  }
)
```

  </div>
  <p class="muted" style="margin-top: 0.6rem;">CSV files, with times in UTC unless the column is a day or month (Irish calendar). Energy in MWh, prices in €/MWh, money in euros.</p>
</div>

<div class="section">
  <div class="section-head"><h2>Licences and independence</h2></div>

Supported by EirGrid Group Data, used under the [EirGrid Group Open Data Licence](https://www.smartgriddashboard.com/ni/open-data-license). This site is independent and is not affiliated with or endorsed by EirGrid, SONI, SEMO or SEMOpx. The data is provided as is, and figures here are estimates; for official figures, use EirGrid's and SEMO's own publications.

Farm positions and map backgrounds are © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors. The farm positions file is available under the [Open Database Licence](https://opendatacommons.org/licenses/odbl/).

</div>
