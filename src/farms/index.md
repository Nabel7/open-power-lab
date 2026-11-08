---
title: Farms
---

<p class="eyebrow">Farms</p>

# Every wind farm, one page each

<p class="lede">Search for a farm, or sort by how much it lost. Open one to see its last two weeks half-hour by half-hour, when in the day it's held down, and its month-by-month figures.</p>

```js
import "../components/nav.js";
import {REGION_NAMES, monthName, percent, energy, euros} from "../components/format.js";

const farmList = FileAttachment("../data/farms.csv").csv({typed: true});
const farmMonthly = FileAttachment("../data/farm_monthly.csv").csv({typed: true});
```

```js
// Choose a month, or the whole period.
const months = [...new Set(farmMonthly.map((d) => +d.month))].sort().map((t) => new Date(t));
const periodInput = Inputs.select([null, ...months], {
  format: (m) => (m ? monthName(m) : "Whole period"),
  value: null
});
const period = Generators.input(periodInput);
```

```js
// One row per farm: its units added together (e.g. phases), for the chosen period.
const unitInfo = new Map(farmList.map((d) => [d.unit, d]));
const rows = period
  ? farmMonthly.filter((d) => +d.month === +period)
  : farmList;
const farms = d3
  .groups(rows, (d) => unitInfo.get(d.unit).farm_id)
  .map(([id, units]) => {
    const info = units.map((d) => unitInfo.get(d.unit));
    const lost = d3.sum(units, (d) => d.lost_mwh);
    const produced = d3.sum(units, (d) => d.produced_mwh);
    return {
      id,
      name: info[0].farm_name,
      technology: info[0].technology,
      region: [...new Set(info.map((d) => REGION_NAMES[d.region]))].join(", "),
      company: [...new Set(info.map((d) => d.company))].join(", "),
      lost,
      pct: lost + produced > 0 ? (100 * lost) / (lost + produced) : NaN,
      value: d3.sum(units, (d) => d.lost_value_eur),
      constraint: lost > 0 ? (100 * d3.sum(units, (d) => d.constraint_mwh)) / lost : NaN
    };
  });
const searchInput = Inputs.search(farms, {placeholder: "Search farms, companies, regions…"});
const found = Generators.input(searchInput);
```

<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; margin: 1.5rem 0 1rem;">
  ${searchInput}
  <span class="muted">Period</span> ${periodInput}
</div>

<div class="card" style="padding: 0.5rem 1rem;">

```js
Inputs.table(found, {
  columns: ["name", "lost", "pct", "constraint", "value", "region", "company"],
  header: {
    name: "Farm",
    lost: "Energy lost",
    pct: "Turned down",
    constraint: "Constraint share",
    value: "Market value",
    region: "Region",
    company: "Company"
  },
  format: {
    name: (name, i, data) => html`<a href="./${data[i].id}">${name}</a>${data[i].technology === "solar" ? html` <span class="muted">solar</span>` : ""}`,
    lost: energy,
    pct: percent,
    constraint: (v) => (isNaN(v) ? "–" : percent(v)),
    value: euros
  },
  sort: "lost",
  reverse: true,
  layout: "auto",
  select: false,
  rows: 25
})
```

</div>

<p class="muted">${farms.length} farms. Names come from SEMO's lists of registered units, or OpenStreetMap where the farm is on the map; units at the same farm (such as phases) are added together. Farms without a name are listed by their SEMO unit code; most of these are suppliers' grouped units rather than single farms.</p>
