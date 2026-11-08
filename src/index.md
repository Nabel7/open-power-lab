---
title: Overview
---

```js
import "./components/nav.js";
import {COLOURS, REGION_NAMES, monthName, dayName, percent, gwh, energy, euros} from "./components/format.js";

const monthly = FileAttachment("data/monthly.csv").csv({typed: true});
const daily = FileAttachment("data/daily.csv").csv({typed: true});
const farms = FileAttachment("data/farms.csv").csv({typed: true});
const farmMonthly = FileAttachment("data/farm_monthly.csv").csv({typed: true});
const places = FileAttachment("data/farm_locations.csv").csv({typed: true});
const meta = FileAttachment("data/meta.json").json();
```

```js
// Default to the latest month with most of its days covered, so a month that has
// only just started isn't the headline.
const allMonths = monthly.filter((d) => d.region === "ALL");
const mostlyCovered = allMonths.filter((d) => d.days_with_data >= 0.8 * d.days_in_month);
const monthInput = Inputs.select(
  allMonths.map((d) => d.month),
  {value: (mostlyCovered.at(-1) ?? allMonths.at(-1)).month, format: monthName}
);
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
const shortMonth = d3.utcFormat("%B")(month);

// Constraint vs curtailment as one bar, with a colour key underneath.
const key = (colour) => html`<span style="color: ${colour}">■</span>`;
const split = html`<div class="split">
    <span style="width: ${100 * constraintShare}%; background: ${COLOURS.constraint}"></span>
    <span style="width: ${100 * (1 - constraintShare)}%; background: ${COLOURS.curtailment}"></span>
  </div>
  <p>${key(COLOURS.constraint)} Constraint: local grid full<br>
  ${key(COLOURS.curtailment)} Curtailment: too much for the island</p>`;
```

<p class="eyebrow">Irish wind power · ${monthName(month)}</p>

# In ${shortMonth}, <span class="headline-number">${percent(all.dispatch_down_pct)}</span> of Irish wind power was turned down

<p class="lede">Wind farms were told to produce ${gwh(all.lost_mwh)} less than the wind allowed, worth about ${euros(all.lost_value_eur)} at market prices. ${percent(100 * constraintShare)} of it was because the local grid was full.</p>

<div style="display: flex; align-items: center; gap: 0.75rem; margin: 1.5rem 0 2rem;">
  <span class="muted">Month</span> ${monthInput}
  ${all.days_with_data < all.days_in_month
    ? html`<span class="muted">Partial: ${all.days_with_data} of ${all.days_in_month} days have data</span>`
    : ""}
</div>

<div class="grid grid-cols-4">
  <div class="card">
    <h2>Energy lost</h2>
    <span class="big">${gwh(all.lost_mwh)}</span>
    <p>${percent(all.dispatch_down_pct)} of what the wind allowed; ${gwh(all.produced_mwh)} was produced</p>
  </div>
  <div class="card">
    <h2>Market value</h2>
    <span class="big">${euros(all.lost_value_eur)}</span>
    <p>The lost energy at day-ahead prices. Not the owners' loss: some is compensated</p>
  </div>
  <div class="card">
    <h2>Why it was lost</h2>
    <span class="big">${percent(100 * constraintShare)}</span>
    ${split}
  </div>
  <div class="card">
    <h2>By region</h2>
    <div style="display: flex; gap: 1.5rem;">
      <div><span class="big">${percent(roi.dispatch_down_pct)}</span><p>Ireland</p></div>
      <div><span class="big">${percent(ni.dispatch_down_pct)}</span><p>Northern Ireland</p></div>
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
  .filter((d) => sameMonth(d.month) && where.has(d.unit))
  .map((d) => ({...d, ...where.get(d.unit)}))
  .sort((a, b) => d3.ascending(a.lost_mwh, b.lost_mwh));
```

<div class="grid grid-cols-3">
  <div class="card chart grid-colspan-2">
    <h2>Energy lost each day</h2>
    <h3>GWh, all-island, ${monthName(month)}</h3>
    ${resize((width) =>
      Plot.plot({
        width,
        height: 300,
        marginLeft: 36,
        style: {fontFamily: "var(--sans-serif)", fontSize: "12px"},
        x: {type: "utc", label: null, tickFormat: dayName},
        y: {label: null, grid: true, tickFormat: (v) => `${v}`},
        color: {
          domain: ["Constraint", "Curtailment"],
          range: [COLOURS.constraint, COLOURS.curtailment],
          legend: true
        },
        marks: [
          Plot.rectY(days, {
            x: "day",
            interval: "day",
            y: "gwh",
            fill: "reason",
            insetLeft: 1.5,
            insetRight: 1.5,
            rx: 2,
            tip: {format: {x: dayName, y: (v) => `${v.toFixed(1)} GWh`}}
          }),
          Plot.ruleY([0], {stroke: "var(--border)"})
        ]
      })
    )}
  </div>
  <a class="card chart" href="./map" style="text-decoration: none; display: flex; flex-direction: column;">
    <h2>Where</h2>
    <h3>Bigger = more lost, darker = bigger share. Open the map →</h3>
    ${resize((width) =>
      Plot.plot({
        width,
        height: 300,
        margin: 4,
        projection: {
          type: "mercator",
          domain: {type: "MultiPoint", coordinates: [[-10.6, 51.4], [-5.4, 55.4]]}
        },
        r: {range: [1.5, 12]},
        marks: [
          Plot.dot(dots, {
            x: "lon",
            y: "lat",
            r: "lost_mwh",
            fill: (d) => d3.interpolateOranges(Math.min(d.dispatch_down_pct, 50) / 50 * 0.85 + 0.15),
            stroke: "var(--surface)",
            strokeWidth: 0.75
          })
        ]
      })
    )}
  </a>
</div>

## Month by month

```js
// Leave out months with less than 80% of their days, which would look misleadingly low or high.
const shownMonths = new Set(mostlyCovered.map((d) => +d.month));
const byMonth = monthly.filter((d) => d.region !== "ALL" && shownMonths.has(+d.month));
```

<div class="card chart">
  <h2>Share of available wind energy turned down</h2>
  <h3>By region. Months with less than 80% of their days covered are left out.</h3>
  ${resize((width) =>
    Plot.plot({
      width,
      height: 240,
      marginLeft: 36,
      style: {fontFamily: "var(--sans-serif)", fontSize: "12px"},
      fx: {label: null, tickFormat: monthName},
      x: {axis: null, domain: ["ROI", "NI"]},
      y: {label: null, grid: true, tickFormat: (v) => `${v}%`},
      color: {
        domain: ["ROI", "NI"],
        range: [COLOURS.ROI, COLOURS.NI],
        legend: true,
        tickFormat: (r) => REGION_NAMES[r]
      },
      marks: [
        Plot.barY(byMonth, {
          fx: "month",
          x: "region",
          y: "dispatch_down_pct",
          fill: "region",
          rx: 3,
          tip: {
            channels: {Region: (d) => REGION_NAMES[d.region], Month: (d) => monthName(d.month)},
            format: {fx: false, x: false, fill: false, y: (v) => `${v.toFixed(1)}%`}
          }
        }),
        Plot.ruleY([0], {stroke: "var(--border)"})
      ]
    })
  )}
</div>

## Most affected farms

```js
// This month, one row per farm page (units at the same farm added together).
const farmInfo = new Map(farms.map((d) => [d.unit, d]));
const topFarms = d3
  .groups(farmMonthly.filter((d) => sameMonth(d.month)), (d) => farmInfo.get(d.unit)?.farm_id ?? d.unit)
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

<p class="muted">${monthName(month)}. The company is the one that sells the farm's output. Click a farm for its own page, or see <a href="./farms/">all farms</a>.</p>

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

<p class="muted">Data from ${meta.first_day} to ${meta.last_day}${meta.missing_days.length ? `, except ${meta.missing_days.join(", ")} (no SEMO files)` : ""}. Updated ${meta.built_at_utc.slice(0, 10)}.</p>
