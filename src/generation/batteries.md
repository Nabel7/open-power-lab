---
title: Batteries
---

```js
import "../components/shell.js";
import {COLOURS, euros, shortMonth, irishTime, longDay, plotStyle, key} from "../components/format.js";

const units = FileAttachment("../data/batteries/units.csv").csv({typed: true});
const fleet = FileAttachment("../data/batteries/fleet_hh.csv").csv({typed: true});
const totals = FileAttachment("../data/batteries/unit_totals.csv").csv({typed: true});
const damMonthlyRaw = FileAttachment("../data/batteries/dam_monthly.csv").csv({typed: true});
const meta = FileAttachment("../data/batteries/meta.json").json();
```

```js
const mwh = (x) => `${d3.format(",.0f")(x)} MWh`;
// Months as dates, so charts treat them as time. (Reading the file already turns
// "2025-11" into a date; this also handles it arriving as text.)
const damMonthly = damMonthlyRaw.map((d) => ({...d, month: d.month instanceof Date ? d.month : new Date(`${d.month}-01T00:00Z`)}));
const gwhText = (x) => `${d3.format(",.1f")(x / 1000)} GWh`;
const clock = new Intl.DateTimeFormat("en-IE", {timeZone: "Europe/Dublin", hour: "2-digit", hour12: false});

// The whole metered period, fleet totals.
const out = d3.sum(totals, (d) => d.out_mwh);
const into = d3.sum(totals, (d) => d.in_mwh);
const value = d3.sum(totals, (d) => d.value_eur);
const sized = new Map(units.map((d) => [d.unit, d]));
const days = (new Date(meta.metered_last_utc) - new Date(meta.metered_first_utc)) / 864e5 + 1 / 48;

// The last 14 days, half-hourly, as + discharging and - charging.
const end = d3.max(fleet, (d) => d.timestamp_utc);
const recent = fleet.filter((d) => d.timestamp_utc > d3.utcDay.offset(end, -14));
const flows = recent.flatMap((d) => [
  {t: d.timestamp_utc, what: "Discharging", mw: d.discharging_mw},
  {t: d.timestamp_utc, what: "Charging", mw: -d.charging_mw}
]);

// By Irish hour of day, over the whole metered period.
const byHour = d3
  .rollups(
    fleet,
    (v) => ({out: d3.mean(v, (d) => d.discharging_mw), into: d3.mean(v, (d) => d.charging_mw), price: d3.mean(v, (d) => d.price)}),
    (d) => +clock.format(d.timestamp_utc)
  )
  .map(([hour, s]) => ({hour, ...s}))
  .sort((a, b) => a.hour - b.hour);

// One row per battery, biggest first.
const rows = totals
  .map((d) => ({...d, ...sized.get(d.unit)}))
  .filter((d) => d.size_mw)
  .map((d) => ({
    ...d,
    ratio: d.in_mwh > 0 ? d.out_mwh / d.in_mwh : NaN,
    per_mw: d.value_eur / d.size_mw
  }))
  .sort((a, b) => b.size_mw - a.size_mw || b.value_eur - a.value_eur);

const operators = d3
  .rollups(rows, (v) => ({units: v.length, size: d3.sum(v, (d) => d.size_mw), value: d3.sum(v, (d) => d.value_eur)}), (d) => d.company)
  .map(([company, s]) => ({company, ...s}))
  .sort((a, b) => b.size - a.size);
```

<div class="page-head">
  <p class="crumbs">Generation / Batteries</p>
  <h1>Batteries</h1>
  <p class="lede">The island's ${meta.batteries} grid batteries, ${d3.format(",.0f")(meta.size_mw)} MW in all: when they charge and discharge, and what that energy is worth at day-ahead prices.</p>
  <div class="meta">
    <span>Metered data ${longDay(new Date(meta.metered_first_utc))} to ${longDay(new Date(meta.metered_last_utc))}</span>
    <span>Day-ahead orders for the past year</span>
    <span>Source: SEMO balancing and market reports</span>
  </div>
</div>

<div class="stats">
  <div class="stat">
    <span class="label">Fleet</span>
    <span class="value">${d3.format(",.0f")(meta.size_mw)}<small>MW</small></span>
    <span class="sub">${meta.batteries} batteries, ${operators.length} operators; largest ${d3.format(",.0f")(rows[0].size_mw)} MW</span>
  </div>
  <div class="stat">
    <span class="label">Energy discharged</span>
    <span class="value">${gwhText(out)}</span>
    <span class="sub">and ${gwhText(into)} taken in, over ${d3.format(".0f")(days)} days</span>
  </div>
  <div class="stat">
    <span class="label">Out for every 1 MWh in</span>
    <span class="value">${d3.format(".2f")(out / into)}<small>MWh</small></span>
    <span class="sub">Includes power used while idle, so it's below true efficiency</span>
  </div>
  <div class="stat">
    <span class="label">Day-ahead value of their flows</span>
    <span class="value">${euros(value)}</span>
    <span class="sub">Discharges minus charges, at day-ahead prices. Not their income: see below</span>
  </div>
</div>

<div class="card">
  <div class="card-head"><span class="label">Charging when cheap, discharging when dear: the last 14 days</span><span class="label">All batteries, MW, half-hourly</span></div>
  ${resize((width) =>
    Plot.plot({
      width,
      height: 220,
      marginLeft: 46,
      style: plotStyle,
      x: {type: "utc", label: null, axis: null},
      y: {label: null, grid: true},
      color: {domain: ["Discharging", "Charging"], range: [COLOURS.discharge, COLOURS.charge]},
      marks: [
        Plot.areaY(flows, {x: "t", y: "mw", fill: "what", curve: "step-after"}),
        Plot.ruleY([0], {stroke: "var(--line-strong)"}),
        Plot.tip(recent, Plot.pointerX({x: "timestamp_utc", y: (d) => d.discharging_mw - d.charging_mw, title: (d) => `${irishTime(d.timestamp_utc)}\nDischarging ${d3.format(",.0f")(d.discharging_mw)} MW\nCharging ${d3.format(",.0f")(d.charging_mw)} MW\nPrice €${d3.format(",.2f")(d.price)}/MWh`}))
      ]
    })
  )}
  ${resize((width) =>
    Plot.plot({
      width,
      height: 150,
      marginLeft: 46,
      style: plotStyle,
      x: {type: "utc", label: null},
      y: {label: null, grid: true, tickFormat: (v) => `€${v}`},
      marks: [
        Plot.lineY(recent, {x: "timestamp_utc", y: "price", stroke: COLOURS.price, strokeWidth: 1.25, curve: "step-after"}),
        Plot.tip(recent, Plot.pointerX({x: "timestamp_utc", y: "price", title: (d) => `${irishTime(d.timestamp_utc)}\n€${d3.format(",.2f")(d.price)}/MWh`}))
      ]
    })
  )}
  <p class="label" style="margin-top: 0.5rem;"><span>${key(COLOURS.discharge)}Discharging (above the line)</span><span>${key(COLOURS.charge)}Charging (below)</span><span>${key(COLOURS.price)}Day-ahead price, €/MWh (lower chart)</span></p>
</div>

<div class="grid grid-cols-2" style="margin-top: 2rem;">
  <div class="card">
    <div class="card-head"><span class="label">When in the day they work</span><span class="label">Average MW by hour, Irish time</span></div>
    ${resize((width) =>
      Plot.plot({
        width,
        height: 220,
        marginLeft: 40,
        style: plotStyle,
        x: {label: null, ticks: [0, 6, 12, 18], tickFormat: (h) => `${String(h).padStart(2, "0")}:00`},
        y: {label: null, grid: true},
        marks: [
          Plot.rectY(byHour, {x1: "hour", x2: (d) => d.hour + 1, y: "out", fill: COLOURS.discharge, insetLeft: 1, insetRight: 1}),
          Plot.rectY(byHour, {x1: "hour", x2: (d) => d.hour + 1, y: (d) => -d.into, fill: COLOURS.charge, insetLeft: 1, insetRight: 1}),
          Plot.ruleY([0], {stroke: "var(--line-strong)"}),
          Plot.tip(byHour, Plot.pointerX({x: (d) => d.hour + 0.5, y: "out", title: (d) => `${String(d.hour).padStart(2, "0")}:00 to ${String(d.hour + 1).padStart(2, "0")}:00\nDischarging ${d3.format(",.0f")(d.out)} MW\nCharging ${d3.format(",.0f")(d.into)} MW`}))
        ]
      })
    )}
  </div>
  <div class="card">
    <div class="card-head"><span class="label">Day-ahead price by hour</span><span class="label">Average €/MWh, same period</span></div>
    ${resize((width) =>
      Plot.plot({
        width,
        height: 220,
        marginLeft: 40,
        style: plotStyle,
        x: {label: null, ticks: [0, 6, 12, 18], tickFormat: (h) => `${String(h).padStart(2, "0")}:00`},
        y: {label: null, grid: true, tickFormat: (v) => `€${v}`},
        marks: [
          Plot.rectY(byHour, {x1: "hour", x2: (d) => d.hour + 1, y: "price", fill: COLOURS.price, fillOpacity: 0.85, insetLeft: 1, insetRight: 1, tip: {format: {y: (v) => `€${d3.format(",.2f")(v)}`, x1: false, x2: false}}}),
          Plot.ruleY([0], {stroke: "var(--line-strong)"})
        ]
      })
    )}
  </div>
</div>

<div class="section">
  <div class="section-head">
    <div>
      <h2>Each battery</h2>
      <p>${longDay(new Date(meta.metered_first_utc))} to ${longDay(new Date(meta.metered_last_utc))}. Click a column to sort.</p>
    </div>
  </div>
  <div class="card" style="padding: 0.4rem 0.9rem;">

```js
Inputs.table(rows, {
  columns: ["name", "company", "region", "size_mw", "out_mwh", "in_mwh", "ratio", "value_eur", "per_mw"],
  header: {
    name: "Battery",
    company: "Company",
    region: "Region",
    size_mw: "Size",
    out_mwh: "Discharged",
    in_mwh: "Taken in",
    ratio: "Out per 1 in",
    value_eur: "Day-ahead value",
    per_mw: "Value per MW"
  },
  format: {
    size_mw: (v) => `${d3.format(",.0f")(v)} MW`,
    out_mwh: mwh,
    in_mwh: mwh,
    ratio: (v) => (isNaN(v) ? "–" : d3.format(".2f")(v)),
    value_eur: euros,
    per_mw: euros,
    region: (v) => (v === "NI" ? "N. Ireland" : "Ireland")
  },
  layout: "auto",
  select: false,
  rows: 28
})
```

  </div>
  <p class="muted" style="margin-top: 0.6rem;">Batteries that mostly hold charge for grid-stability services, rather than trading, discharge little and show a low "out per 1 in" and a negative value: the power they use while idle still counts as taken in.</p>
</div>

<div class="section">
  <div class="section-head">
    <div>
      <h2>Their day-ahead trading over the year</h2>
      <p>What the batteries bought and sold in the day-ahead auction, month by month: the plan for the next day, not what they physically did.</p>
    </div>
    <span class="label"><span>${key(COLOURS.discharge)}Sold</span><span>${key(COLOURS.charge)}Bought</span></span>
  </div>
  <div class="grid grid-cols-2">
    <div class="card">
      <div class="card-head"><span class="label">Energy</span><span class="label">GWh per month</span></div>
      ${resize((width) =>
        Plot.plot({
          width,
          height: 220,
          marginLeft: 36,
          style: plotStyle,
          x: {type: "utc", label: null, tickFormat: shortMonth, ticks: Math.max(3, Math.floor(width / 90))},
          y: {label: null, grid: true},
          color: {domain: ["Sold", "Bought"], range: [COLOURS.discharge, COLOURS.charge]},
          marks: [
            Plot.rectY(damMonthly.flatMap((d) => [{month: d.month, what: "Sold", gwh: d.sold_mwh / 1000}, {month: d.month, what: "Bought", gwh: -d.bought_mwh / 1000}]), {x: "month", interval: "month", y: "gwh", fill: "what", insetLeft: 2, insetRight: 2, tip: {format: {x: shortMonth, y: (v) => `${d3.format(",.1f")(Math.abs(v))} GWh`}}}),
            Plot.ruleY([0], {stroke: "var(--line-strong)"})
          ]
        })
      )}
    </div>
    <div class="card">
      <div class="card-head"><span class="label">Day-ahead trading value</span><span class="label">Sales minus purchases, € per month</span></div>
      ${resize((width) =>
        Plot.plot({
          width,
          height: 220,
          marginLeft: 46,
          style: plotStyle,
          x: {type: "utc", label: null, tickFormat: shortMonth, ticks: Math.max(3, Math.floor(width / 90))},
          y: {label: null, grid: true, tickFormat: (v) => euros(v)},
          marks: [
            Plot.rectY(damMonthly, {x: "month", interval: "month", y: "dam_value_eur", fill: COLOURS.discharge, fillOpacity: 0.85, insetLeft: 2, insetRight: 2, tip: {format: {x: shortMonth, y: (v) => euros(v)}}}),
            Plot.ruleY([0], {stroke: "var(--line-strong)"})
          ]
        })
      )}
    </div>
  </div>
  <p class="muted" style="margin-top: 0.6rem;">The first and last months may be partial. Try the <a href="../tools/battery-simulator">battery simulator</a> to see what a battery could earn with perfect knowledge of these prices.</p>
</div>

<div class="note" style="margin-top: 2rem;">

**What this shows, and doesn't.** "Value" is energy priced at the day-ahead price in each half-hour: discharges add, charges subtract. It is not what the owners earned. Batteries also trade in the intraday auctions and the balancing market, and much of their income in Ireland has come from system services that keep the grid stable (DS3), none of which is in this data. Each battery's size is the highest availability it reported; its storage in MWh isn't published here. Names come from SEMO's lists; unnamed units are shown by their code.

</div>
