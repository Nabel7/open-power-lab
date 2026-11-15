---
title: Dispatch-down
---

```js
import "../../components/shell.js";
import {COLOURS, REGION_NAMES, monthName, shortMonth as monthChip, dayName, percent, gwh, energy, euros, key, reasonKey, plotStyle} from "../../components/format.js";

const monthly = FileAttachment("data/monthly.csv").csv({typed: true});
const daily = FileAttachment("data/daily.csv").csv({typed: true});
const farms = FileAttachment("data/farms.csv").csv({typed: true});
const farmMonthly = FileAttachment("data/farm_monthly.csv").csv({typed: true});
const farmDaily = FileAttachment("data/farm_daily.csv").csv({typed: true});
const places = FileAttachment("data/farm_locations.csv").csv({typed: true});
const meta = FileAttachment("data/meta.json").json();
const island = FileAttachment("../../data/ireland.json").json(); // outline, from Natural Earth
```

```js
// Default to the latest month with most of its days covered, so a month that has
// only just started isn't the headline.
const allMonths = monthly.filter((d) => d.region === "ALL");
const mostlyCovered = allMonths.filter((d) => d.days_with_data >= 0.8 * d.days_in_month);
const monthInput = Inputs.radio(
  allMonths.map((d) => d.month),
  {value: (mostlyCovered.at(-1) ?? allMonths.at(-1)).month, format: monthChip}
);
monthInput.classList.add("chips");
const month = Generators.input(monthInput);
```

```js
const sameMonth = (date) =>
  date.getUTCFullYear() === month.getUTCFullYear() && date.getUTCMonth() === month.getUTCMonth();
const row = (region) => monthly.find((d) => d.region === region && sameMonth(d.month));
const all = row("ALL");
const roi = row("ROI");
const ni = row("NI");
const constraintShare = all.constraint_mwh / all.lost_mwh;

// Solar farms stay out of the wind figures. SEMO lists them as wind.
const solar = new Set(farms.filter((d) => d.technology === "solar").map((d) => d.unit));
const windDaily = farmDaily.filter((d) => !solar.has(d.unit));
const shortMonth = d3.utcFormat("%B")(month);

// Constraint vs curtailment as one bar, with a colour key underneath.
const split = html`<div class="split">
    <span style="width: ${100 * constraintShare}%; background: ${COLOURS.constraint}"></span>
    <span style="width: ${100 * (1 - constraintShare)}%; background: ${COLOURS.curtailment}"></span>
  </div>
  <p>${key(COLOURS.constraint)}Constraint: local grid full<br>
  ${key(COLOURS.curtailment)}Curtailment: too much for the island</p>
  <p>Less certain than the total. <a href="./methods">Why</a></p>`;
```

<div class="hero">
  <div>
    <p class="eyebrow">Monthly</p>
    <h1>In ${shortMonth}, <span class="headline-number">${percent(all.dispatch_down_pct)}</span> of Irish wind power was turned down</h1>
    <p class="lede">Wind farms were told to produce <strong>${gwh(all.lost_mwh)}</strong> less than the wind allowed, worth about <strong>${euros(all.lost_value_eur)}</strong> at market prices. About ${d3.format(".0f")(100 * constraintShare)}% of it was because the local grid was full.</p>
    ${monthInput}
    ${all.days_with_data < all.days_in_month
      ? html`<p class="muted chip-note">Partial month: ${all.days_with_data} of ${all.days_in_month} days have data</p>`
      : ""}
  </div>
</div>

<div class="stats">
  <div class="stat">
    <span class="label">Energy lost</span>
    <span class="value">${gwh(all.lost_mwh)}</span>
    <p>${percent(all.dispatch_down_pct)} of what the wind allowed; ${gwh(all.produced_mwh)} was produced</p>
  </div>
  <div class="stat">
    <span class="label">Market value</span>
    <span class="value">${euros(all.lost_value_eur)}</span>
    <p>The lost energy at day-ahead prices. Not the owners' loss: some is compensated</p>
  </div>
  <div class="stat">
    <span class="label">Why it was lost</span>
    <span class="value accent">~${d3.format(".0f")(100 * constraintShare)}%</span>
    ${split}
  </div>
  <div class="stat">
    <span class="label">By region</span>
    <div class="pair">
      <div><span class="value">${percent(roi.dispatch_down_pct)}</span><div class="label">Ireland</div></div>
      <div><span class="value">${percent(ni.dispatch_down_pct)}</span><div class="label">N. Ireland</div></div>
    </div>
  </div>
</div>

```js
const days = daily
  .filter((d) => d.region === "ALL" && sameMonth(d.day))
  .flatMap((d) => [
    {day: d.day, reason: "Constraint", gwh: d.constraint_mwh / 1000},
    {day: d.day, reason: "Curtailment", gwh: d.curtailment_mwh / 1000}
  ]);

// For the small map: every placed unit, this month.
const where = new Map(places.filter((d) => d.located_by).map((d) => [d.unit, d]));
const dots = farmMonthly
  .filter((d) => sameMonth(d.month) && where.has(d.unit) && !solar.has(d.unit))
  .map((d) => ({...d, ...where.get(d.unit)}))
  .sort((a, b) => d3.ascending(a.lost_mwh, b.lost_mwh));
```

<div class="hatch" style="margin-top: clamp(2.5rem, 5vw, 4rem);"></div>

<div class="section">
  <div class="section-head">
    <div>
      <p class="label" style="margin-bottom: 0.8rem;">01 / Day by day</p>
      <h2 class="section-title">When it was lost, and where</h2>
    </div>
    ${reasonKey()}
  </div>
  <div class="grid grid-cols-3">
    <div class="card grid-colspan-2">
      <div class="card-head"><span class="label">Energy lost each day</span><span class="label">GWh · all-island · ${monthName(month)}</span></div>
      ${resize((width) =>
        Plot.plot({
          width,
          height: 300,
          marginLeft: 32,
          style: plotStyle,
          x: {type: "utc", label: null, tickFormat: dayName, ticks: Math.max(3, Math.floor(width / 110))},
          y: {label: null, grid: true, tickFormat: (v) => `${v}`},
          color: {domain: ["Constraint", "Curtailment"], range: [COLOURS.constraint, COLOURS.curtailment]},
          marks: [
            Plot.rectY(days, {
              x: "day",
              interval: "day",
              y: "gwh",
              fill: "reason",
              insetLeft: 1,
              insetRight: 1,
              tip: {format: {x: dayName, y: (v) => `${v.toFixed(1)} GWh`}}
            }),
            Plot.ruleY([0], {stroke: "var(--line-strong)"})
          ]
        })
      )}
    </div>
    <a class="card" href="./map" style="display: flex; flex-direction: column;">
      <div class="card-head"><span class="label">Where</span><span class="label">Open the map →</span></div>
      ${resize((width) =>
        Plot.plot({
          width,
          height: 300,
          margin: 4,
          style: plotStyle,
          projection: {
            type: "mercator",
            domain: {type: "MultiPoint", coordinates: [[-10.6, 51.4], [-5.4, 55.4]]}
          },
          r: {range: [1.5, 12]},
          marks: [
            Plot.geo(island, {fill: "var(--line)", fillOpacity: 0.6, stroke: "var(--line-strong)", strokeWidth: 0.75}),
            Plot.dot(dots, {
              x: "lon",
              y: "lat",
              r: "lost_mwh",
              fill: "var(--accent)",
              fillOpacity: (d) => 0.25 + (0.75 * Math.min(d.dispatch_down_pct, 50)) / 50,
              stroke: "var(--surface)",
              strokeWidth: 0.5
            })
          ]
        })
      )}
    </a>
  </div>
</div>

```js
// Leave out months with less than 80% of their days, which would look misleadingly low or high.
const shownMonths = new Set(mostlyCovered.map((d) => +d.month));
const byMonth = monthly.filter((d) => d.region !== "ALL" && shownMonths.has(+d.month));
```

<div class="section">
  <div class="section-head">
    <div>
      <p class="label" style="margin-bottom: 0.8rem;">02 / Month by month</p>
      <h2 class="section-title">Share of available wind energy turned down</h2>
    </div>
    <span class="label"><span>${key(COLOURS.ROI)}Ireland</span> <span>${key(COLOURS.NI)}Northern Ireland</span></span>
  </div>
  <div class="card">
    ${resize((width) =>
      Plot.plot({
        width,
        height: 220,
        marginLeft: 36,
        style: plotStyle,
        fx: {label: null, tickFormat: monthName},
        x: {axis: null, domain: ["ROI", "NI"], padding: 0.4},
        y: {label: null, grid: true, tickFormat: (v) => `${v}%`},
        color: {domain: ["ROI", "NI"], range: [COLOURS.ROI, COLOURS.NI]},
        marks: [
          Plot.barY(byMonth, {
            fx: "month",
            x: "region",
            y: "dispatch_down_pct",
            fill: "region",
            tip: {
              channels: {Region: (d) => REGION_NAMES[d.region], Month: (d) => monthName(d.month)},
              format: {fx: false, x: false, fill: false, y: (v) => `${v.toFixed(1)}%`}
            }
          }),
          Plot.ruleY([0], {stroke: "var(--line-strong)"})
        ]
      })
    )}
    <p class="muted" style="margin-top: 0.75rem;">Months with less than 80% of their days covered are left out. For every month since 2016, from EirGrid's own figures and adjusted for the weather, see <a href="./history">ten years of dispatch-down →</a></p>
  </div>
</div>

```js
// This month, one row per farm page (units at the same farm added together).
const farmInfo = new Map(farms.map((d) => [d.unit, d]));
const topFarms = d3
  .groups(farmMonthly.filter((d) => sameMonth(d.month) && !solar.has(d.unit)), (d) => farmInfo.get(d.unit)?.farm_id ?? d.unit)
  .map(([id, units]) => {
    const info = units.map((d) => farmInfo.get(d.unit));
    const lost = d3.sum(units, (d) => d.lost_mwh);
    return {
      id,
      name: info[0]?.farm_name ?? id,
      company: [...new Set(info.map((d) => d?.company))].join(", "),
      region: REGION_NAMES[info[0]?.region] ?? "",
      lost,
      pct: (100 * lost) / (lost + d3.sum(units, (d) => d.produced_mwh)),
      value: d3.sum(units, (d) => d.lost_value_eur)
    };
  })
  .sort((a, b) => d3.descending(a.lost, b.lost))
  .slice(0, 10);
```

<div class="section">
  <div class="section-head">
    <div>
      <p class="label" style="margin-bottom: 0.8rem;">03 / Farms</p>
      <h2 class="section-title">Most affected farms</h2>
    </div>
    <a class="label" href="./farms/">All farms →</a>
  </div>
  <div class="card" style="padding: 0.5rem 1rem;">

```js
Inputs.table(topFarms, {
  // Name and numbers first, so they show on a phone without scrolling sideways.
  columns: ["name", "lost", "pct", "value", "company", "region"],
  header: {
    name: "Farm",
    lost: "Energy lost",
    pct: "Turned down",
    value: "Market value",
    company: "Company",
    region: "Region"
  },
  format: {
    name: (name, i, data) => html`<a href="./farms/${data[i].id}">${name}</a>`,
    lost: energy,
    pct: percent,
    value: euros
  },
  layout: "auto",
  select: false,
  sort: "lost",
  reverse: true,
  rows: 11
})
```

  </div>
  <p class="muted" style="margin-top: 0.9rem;">${monthName(month)}. The company is the one that sells the farm's output. Data from ${meta.first_day} to ${meta.last_day}${meta.missing_days.length ? `, except ${meta.missing_days.join(", ")} (no SEMO files)` : ""}. Updated ${meta.built_at_utc.slice(0, 10)}.</p>
</div>
