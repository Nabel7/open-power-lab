---
title: Battery simulator
---

```js
import "../components/shell.js";
import {COLOURS, euros, monthName, longDay, plotStyle, key} from "../components/format.js";
import {simulate} from "../components/battery.js";

const pricesHH = FileAttachment("../data/markets/prices_hh.csv").csv({typed: true});
const batteryTotals = FileAttachment("../data/batteries/unit_totals.csv").csv({typed: true});
const batteryUnits = FileAttachment("../data/batteries/units.csv").csv({typed: true});
const batteryMeta = FileAttachment("../data/batteries/meta.json").json();
```

```js
const powerInput = Inputs.range([1, 100], {label: "Power, MW", step: 1, value: 10});
const hoursInput = Inputs.radio([1, 2, 4], {label: "Hours of storage", value: 2, format: (h) => `${h} h`});
const efficiencyInput = Inputs.range([60, 98], {label: "Round-trip efficiency, %", step: 1, value: 85});
const cyclesInput = Inputs.radio([1, 2], {label: "Cycles a day, at most", value: 1});
const periodInput = Inputs.radio(["30 days", "90 days", "1 year"], {label: "Period", value: "1 year"});
for (const input of [hoursInput, cyclesInput, periodInput]) input.classList.add("segmented");

const powerMw = Generators.input(powerInput);
const hours = Generators.input(hoursInput);
const efficiencyPct = Generators.input(efficiencyInput);
const cyclesPerDay = Generators.input(cyclesInput);
const period = Generators.input(periodInput);
```

```js
// Half-hours with their trading day (23:00 to 23:00 Irish time) and Irish clock time.
const toDay = new Intl.DateTimeFormat("en-CA", {timeZone: "Europe/Dublin"});
const toTime = new Intl.DateTimeFormat("en-IE", {timeZone: "Europe/Dublin", hour: "2-digit", minute: "2-digit"});
const allHalfHours = pricesHH.map((d) => ({
  price: d.price,
  timestamp_utc: d.timestamp_utc,
  day: new Date(`${toDay.format(new Date(+d.timestamp_utc + 3600e3))}T00:00Z`),
  time: toTime.format(d.timestamp_utc)
}));
// Only whole trading days (48 half-hours, or 46 / 50 on clock-change days).
const dayCounts = d3.rollup(allHalfHours, (v) => v.length, (d) => +d.day);
const wholeDays = allHalfHours.filter((d) => dayCounts.get(+d.day) >= 46);
```

```js
const efficiency = efficiencyPct / 100;
const battery = {powerMw, hours, efficiency, cyclesPerDay};
const lastDay = d3.max(wholeDays, (d) => d.day);
const span = {"30 days": 30, "90 days": 90, "1 year": 366}[period];
const firstDay = d3.utcDay.offset(lastDay, -(span - 1));
const results = simulate(wholeDays.filter((d) => d.day >= firstDay), battery);

const days = results.length;
const revenue = d3.sum(results, (d) => d.revenue);
const perMwYear = (revenue / days) * 365 / powerMw;
const discharged = d3.sum(results, (d) => d.discharged_mwh);
const cyclesUsed = discharged / (powerMw * hours) / days;
const best = d3.greatest(results, (d) => d.revenue);
const idleDays = results.filter((d) => d.revenue < 0.005).length;

// Typical day: how often it charges or discharges at each time of day.
const slots = d3
  .rollups(
    results.flatMap((r) => r.actions.map((a, i) => ({time: r.times[i], a}))),
    (v) => ({discharging: v.filter((d) => d.a === 1).length / v.length, charging: v.filter((d) => d.a === -1).length / v.length}),
    (d) => d.time
  )
  .map(([time, s]) => ({time, ...s}))
  .sort((a, b) => d3.ascending(a.time, b.time));

const months = d3
  .rollups(results, (v) => ({revenue: d3.sum(v, (d) => d.revenue), days: v.length, discharged: d3.sum(v, (d) => d.discharged_mwh)}), (d) => +d3.utcMonth(d.day))
  .map(([m, s]) => ({month: new Date(m), ...s, per_mw: s.revenue / powerMw}))
  .sort((a, b) => b.month - a.month);
```

```js
// For comparison: the real batteries over their metered period, valued the same way.
const sizes = new Map(batteryUnits.map((d) => [d.unit, d.size_mw]));
const fleetValue = d3.sum(batteryTotals, (d) => d.value_eur);
const fleetMw = d3.sum(batteryTotals, (d) => sizes.get(d.unit) ?? 0);
const meteredFirst = new Date(`${batteryMeta.metered_first_utc.slice(0, 10)}T00:00Z`);
const meteredLast = new Date(`${batteryMeta.metered_last_utc.slice(0, 10)}T00:00Z`);
const sameDays = simulate(wholeDays.filter((d) => d.day >= d3.utcDay.offset(meteredFirst, 1) && d.day <= meteredLast), battery);
const simulatedPerMw = d3.sum(sameDays, (d) => d.revenue) / powerMw;
const topReal = batteryTotals
  .map((d) => ({...d, size: sizes.get(d.unit), per_mw: d.value_eur / sizes.get(d.unit)}))
  .filter((d) => d.size)
  .sort((a, b) => b.per_mw - a.per_mw)[0];
const topName = batteryUnits.find((d) => d.unit === topReal.unit)?.name ?? topReal.unit;
```

<div class="page-head">
  <p class="crumbs">Tools / Battery simulator</p>
  <h1>Battery simulator</h1>
  <p class="lede">What could a battery have earned trading on Irish day-ahead prices? Choose its size and efficiency; it finds the best charging and discharging for every day, using the real prices.</p>
  <div class="meta">
    <span>Prices: SEM day-ahead, half-hourly, to ${longDay(lastDay)}</span>
    <span>Runs in your browser</span>
  </div>
</div>

<div class="controls">
  ${powerInput}
  ${hoursInput}
  ${efficiencyInput}
  ${cyclesInput}
  ${periodInput}
</div>

<p class="muted" style="margin: -0.25rem 0 1rem;">A ${powerMw} MW battery holding ${d3.format(",.0f")(powerMw * hours)} MWh, ${d3.format(".0%")(efficiency)} round-trip, over ${days} days from ${longDay(results[0].day)}.</p>

<div class="stats">
  <div class="stat">
    <span class="label">Best possible revenue</span>
    <span class="value">${euros(revenue)}</span>
    <span class="sub">${euros(revenue / days)} a day on average</span>
  </div>
  <div class="stat">
    <span class="label">Per MW, per year</span>
    <span class="value">${euros(perMwYear)}</span>
    <span class="sub">The period's revenue scaled to a year</span>
  </div>
  <div class="stat">
    <span class="label">Cycles used</span>
    <span class="value">${d3.format(".2f")(cyclesUsed)}<small>a day</small></span>
    <span class="sub">${idleDays ? `${idleDays} days not worth trading` : "It traded every day"}</span>
  </div>
  <div class="stat">
    <span class="label">Best day</span>
    <span class="value">${euros(best.revenue)}</span>
    <span class="sub">${longDay(best.day)}</span>
  </div>
</div>

<div class="card">
  <div class="card-head"><span class="label">Revenue each day</span><span class="label">€, best possible</span></div>
  ${resize((width) =>
    Plot.plot({
      width,
      height: 240,
      marginLeft: 46,
      style: plotStyle,
      x: {type: "utc", label: null},
      y: {label: null, grid: true, tickFormat: (v) => euros(v)},
      marks: [
        // Bars when each day gets a couple of pixels; otherwise a filled step line, which
        // stays visible on a narrow screen.
        width / days >= 2
          ? Plot.rectY(results, {x: "day", interval: "day", y: "revenue", fill: COLOURS.discharge, fillOpacity: 0.85})
          : Plot.areaY(results, {x: "day", y: "revenue", fill: COLOURS.discharge, curve: "step"}),
        Plot.tip(results, Plot.pointerX({x: "day", y: "revenue", title: (d) => `${longDay(d.day)}\n${euros(d.revenue)}`})),
        Plot.ruleY([0], {stroke: "var(--line-strong)"})
      ]
    })
  )}
</div>

<div class="grid grid-cols-2" style="margin-top: 2rem;">
  <div class="card">
    <div class="card-head"><span class="label">A typical day</span><span class="label">How often it charges or discharges at each time</span></div>
    ${resize((width) =>
      Plot.plot({
        width,
        height: 230,
        marginLeft: 40,
        style: plotStyle,
        x: {label: null, domain: slots.map((d) => d.time), ticks: ["00:00", "06:00", "12:00", "18:00"]},
        y: {label: null, grid: true, tickFormat: (v) => `${Math.abs(v * 100).toFixed(0)}%`},
        marks: [
          Plot.barY(slots, {x: "time", y: "discharging", fill: COLOURS.discharge}),
          Plot.barY(slots, {x: "time", y: (d) => -d.charging, fill: COLOURS.charge}),
          Plot.ruleY([0], {stroke: "var(--line-strong)"}),
          Plot.tip(slots, Plot.pointerX({x: "time", y: "discharging", title: (d) => `${d.time}\nDischarging on ${(d.discharging * 100).toFixed(0)}% of days\nCharging on ${(d.charging * 100).toFixed(0)}%`}))
        ]
      })
    )}
    <p class="label" style="margin-top: 0.5rem;"><span>${key(COLOURS.discharge)}Discharging</span><span>${key(COLOURS.charge)}Charging</span><span>Irish time</span></p>
  </div>
  <div class="card">
    <div class="card-head"><span class="label">Against the real batteries</span><span class="label">Same days, same valuation</span></div>
    <p style="font-size: 15px; line-height: 1.6;">From ${longDay(d3.utcDay.offset(meteredFirst, 1))} to ${longDay(meteredLast)}, this battery, with the settings above, could have made at most <strong>${euros(simulatedPerMw)} per MW</strong> from day-ahead trading.</p>
    <p style="font-size: 15px; line-height: 1.6; margin-top: 0.75rem;">Over the same days, the island's real batteries' charging and discharging was worth <strong>${euros(fleetValue / fleetMw)} per MW</strong> at day-ahead prices, as a fleet. The best, ${topName}, reached <strong>${euros(topReal.per_mw)} per MW</strong>.</p>
    <p class="muted" style="margin-top: 0.75rem;">The real batteries' figure counts all their charging and discharging, including trades outside the day-ahead market and more than one cycle a day, so the best of them can beat this simulation at its default settings. Many others hold charge for grid-stability services instead of trading. See <a href="../generation/batteries">Batteries</a>.</p>
  </div>
</div>

<div class="section">
  <div class="section-head"><h2>By month</h2></div>
  <div class="card" style="padding: 0.4rem 0.9rem;">

```js
Inputs.table(months, {
  columns: ["month", "revenue", "per_mw", "discharged", "days"],
  header: {month: "Month", revenue: "Revenue", per_mw: "Per MW", discharged: "Energy sold", days: "Days"},
  format: {month: monthName, revenue: euros, per_mw: euros, discharged: (v) => `${d3.format(",.0f")(v)} MWh`},
  layout: "auto",
  select: false,
  rows: 14
})
```

  </div>
</div>

<div class="note" style="margin-top: 2rem;">

**How it works, and its limits.** For each trading day (23:00 to 23:00 Irish time), the simulator tries every way of charging, discharging or resting in each half-hour, at full power, and keeps the most profitable one the battery could physically follow. It starts and ends each day empty. Losses are taken when charging: storing what will later deliver 1 MWh costs 1 ÷ efficiency MWh from the grid. So this is **an upper bound**: it assumes perfect knowledge of the day's prices, day-ahead prices only, no partial power, no fees, no wear, and no income from system services. Real batteries earn less from trading, but also earn in other markets. The calculation has been checked against trying every possible schedule on thousands of small test days.

</div>
