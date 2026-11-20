---
title: Wind & demand
---

```js
import "../components/shell.js";
import {COLOURS, mw, gwh, longDay, monthName, irishTime, plotStyle, key} from "../components/format.js";

const systemHH = FileAttachment("../data/markets/system_hh.csv").csv({typed: true});
const systemDaily = FileAttachment("../data/markets/system_daily.csv").csv({typed: true});
const latest = FileAttachment("../data/markets/latest.json").json();
```

```js
const rangeInput = Inputs.radio(["7 days", "30 days", "60 days"], {value: "7 days"});
rangeInput.classList.add("segmented");
const range = Generators.input(rangeInput);
```

```js
const days = {"7 days": 7, "30 days": 30, "60 days": 60}[range];
const shortDayLocal = (t) => t.toLocaleDateString("en-IE", {timeZone: "Europe/Dublin", day: "numeric", month: "short"});
const end = d3.max(systemHH, (d) => d.timestamp_utc);
const recent = systemHH.filter((d) => d.timestamp_utc > d3.utcDay.offset(end, -days) && d.wind != null);
const dailyRange = systemDaily.slice(-days);

const windEnergy = d3.sum(dailyRange, (d) => d.wind_mwh);
const demandEnergy = d3.sum(dailyRange, (d) => d.demand_mwh);
const peak = d3.greatest(recent, (d) => d.wind);
// Forecast error = EirGrid's forecast minus what happened: positive means it expected too much wind.
const errors = recent.filter((d) => d.forecast != null).map((d) => d.forecast - d.wind);
const bias = d3.mean(errors);
const mae = d3.mean(errors, Math.abs);

// A year of daily figures, and monthly forecast error.
const months = d3
  .rollups(
    systemDaily,
    (v) => ({
      wind: d3.sum(v, (d) => d.wind_mwh),
      demand: d3.sum(v, (d) => d.demand_mwh),
      bias: d3.mean(v, (d) => d.bias_mw),
      mae: d3.mean(v, (d) => d.mae_mw),
      days: v.length
    }),
    (d) => +d3.utcMonth(d.day)
  )
  .map(([month, s]) => ({month: new Date(month), share: (100 * s.wind) / s.demand, ...s}))
  .sort((a, b) => b.month - a.month);
```

<div class="page-head">
  <p class="crumbs">Markets / Wind &amp; demand</p>
  <h1>Wind and demand</h1>
  <p class="lede">Wind output across the island, its share of demand, and EirGrid's wind forecast against what actually happened.</p>
  <div class="meta">
    <span>Latest reading: ${irishTime(new Date(latest.system_last_utc))}</span>
    <span>Source: EirGrid Smart Grid Dashboard (15-minute readings, shown as half-hour averages)</span>
  </div>
</div>

<div class="toolbar">${rangeInput}</div>

<div class="stats">
  <div class="stat">
    <span class="label">Wind share of demand</span>
    <span class="value">${((100 * windEnergy) / demandEnergy).toFixed(1)}%</span>
    <span class="sub">${gwh(windEnergy)} of wind, ${gwh(demandEnergy)} of demand (whole days)</span>
  </div>
  <div class="stat">
    <span class="label">Highest wind output</span>
    <span class="value">${d3.format(",.0f")(peak.wind)}<small>MW</small></span>
    <span class="sub">${irishTime(peak.timestamp_utc)}</span>
  </div>
  <div class="stat">
    <span class="label">EirGrid forecast, average error</span>
    <span class="value">${d3.format(",.0f")(mae)}<small>MW</small></span>
    <span class="sub">Mean absolute difference from what happened</span>
  </div>
  <div class="stat">
    <span class="label">EirGrid forecast, bias</span>
    <span class="value">${bias >= 0 ? "+" : "−"}${d3.format(",.0f")(Math.abs(bias))}<small>MW</small></span>
    <span class="sub">${bias >= 0 ? "Expected more wind than came, on average" : "Expected less wind than came, on average"}</span>
  </div>
</div>

<div class="card">
  <div class="card-head"><span class="label">Wind and demand</span><span class="label">MW, half-hourly</span></div>
  ${resize((width) =>
    Plot.plot({
      width,
      height: 280,
      marginLeft: 46,
      style: plotStyle,
      x: {type: "utc", label: null, tickFormat: shortDayLocal, ticks: Math.min(days, Math.floor(width / 90))},
      y: {label: null, grid: true},
      marks: [
        Plot.areaY(recent, {x: "timestamp_utc", y: "wind", fill: COLOURS.wind, fillOpacity: 0.25}),
        Plot.lineY(recent, {x: "timestamp_utc", y: "wind", stroke: COLOURS.wind, strokeWidth: 1.5}),
        Plot.lineY(recent, {x: "timestamp_utc", y: "demand", stroke: COLOURS.demand, strokeWidth: 1.5}),
        Plot.ruleY([0], {stroke: "var(--line-strong)"}),
        Plot.tip(recent, Plot.pointerX({x: "timestamp_utc", y: "demand", title: (d) => `${irishTime(d.timestamp_utc)}\nDemand ${mw(d.demand)}\nWind ${mw(d.wind)} (${((100 * d.wind) / d.demand).toFixed(0)}% of demand)`}))
      ]
    })
  )}
  <p class="label" style="margin-top: 0.5rem;"><span>${key(COLOURS.wind)}Wind</span><span>${key(COLOURS.demand)}Demand</span></p>
</div>

<div class="section" id="forecast">
  <div class="section-head">
    <div>
      <h2>EirGrid's wind forecast against what happened</h2>
      <p>Positive error means the forecast expected more wind than came.</p>
    </div>
  </div>
  <div class="card">
    <div class="card-head"><span class="label">Forecast and actual wind</span><span class="label">MW, half-hourly</span></div>
    ${resize((width) =>
      Plot.plot({
        width,
        height: 260,
        marginLeft: 46,
        style: plotStyle,
        x: {type: "utc", label: null, tickFormat: shortDayLocal, ticks: Math.min(days, Math.floor(width / 90))},
        y: {label: null, grid: true},
        marks: [
          Plot.lineY(recent, {x: "timestamp_utc", y: "forecast", stroke: COLOURS.forecast, strokeWidth: 1.5, strokeDasharray: "4 3"}),
          Plot.lineY(recent, {x: "timestamp_utc", y: "wind", stroke: COLOURS.wind, strokeWidth: 1.5}),
          Plot.ruleY([0], {stroke: "var(--line-strong)"}),
          Plot.tip(recent, Plot.pointerX({x: "timestamp_utc", y: "wind", title: (d) => `${irishTime(d.timestamp_utc)}\nActual ${mw(d.wind)}\nForecast ${mw(d.forecast)}\nError ${d.forecast - d.wind >= 0 ? "+" : "−"}${mw(Math.abs(d.forecast - d.wind))}`}))
        ]
      })
    )}
    <p class="label" style="margin-top: 0.5rem;"><span>${key(COLOURS.wind)}Actual</span><span><span class="key" style="background: none; border-top: 2px dashed var(--ink-faint); height: 0; width: 14px;"></span>EirGrid forecast</span></p>
  </div>

  <div class="grid grid-cols-2" style="margin-top: 0.75rem;">
    <div class="card">
      <div class="card-head"><span class="label">Daily forecast bias, past year</span><span class="label">MW, forecast minus actual</span></div>
      ${resize((width) =>
        Plot.plot({
          width,
          height: 220,
          marginLeft: 46,
          style: plotStyle,
          x: {type: "utc", label: null},
          y: {label: null, grid: true},
          marks: [
            Plot.rectY(systemDaily, {x: "day", interval: "day", y: "bias_mw", fill: (d) => (d.bias_mw >= 0 ? "var(--up)" : "var(--down)"), fillOpacity: 0.7, tip: {format: {x: longDay, y: (v) => `${v >= 0 ? "+" : "−"}${mw(Math.abs(v))}`, fill: false}}}),
            Plot.ruleY([0], {stroke: "var(--line-strong)"})
          ]
        })
      )}
    </div>
    <div class="card">
      <div class="card-head"><span class="label">Wind share of demand, past year</span><span class="label">% per day</span></div>
      ${resize((width) =>
        Plot.plot({
          width,
          height: 220,
          marginLeft: 36,
          style: plotStyle,
          x: {type: "utc", label: null},
          y: {label: null, grid: true, tickFormat: (v) => `${v}%`},
          marks: [
            Plot.rectY(systemDaily, {x: "day", interval: "day", y: "wind_share", fill: COLOURS.wind, fillOpacity: 0.8, tip: {format: {x: longDay, y: (v) => `${v.toFixed(0)}%`}}}),
            Plot.ruleY([0], {stroke: "var(--line-strong)"})
          ]
        })
      )}
    </div>
  </div>

  <div class="card" style="margin-top: 0.75rem; padding: 0.4rem 0.9rem;">

```js
Inputs.table(months, {
  columns: ["month", "wind", "demand", "share", "bias", "mae", "days"],
  header: {month: "Month", wind: "Wind", demand: "Demand", share: "Wind share", bias: "Forecast bias", mae: "Forecast error", days: "Days"},
  format: {
    month: monthName,
    wind: (v) => gwh(v),
    demand: (v) => gwh(v),
    share: (v) => `${v.toFixed(1)}%`,
    bias: (v) => `${v >= 0 ? "+" : "−"}${mw(Math.abs(v))}`,
    mae: (v) => mw(v)
  },
  layout: "auto",
  select: false,
  rows: 14
})
```

  </div>
  <div class="note" style="margin-top: 0.75rem;">

**About the forecast.** This is the wind forecast shown on EirGrid's Smart Grid Dashboard, in its latest revision. EirGrid updates it during the day, so it has often seen more recent weather than a forecast made the day before, and these errors are smaller than a day-ahead forecast's. The [Price forecasts](../forecasts/prices) page uses EirGrid's forecast as it stood before each day-ahead auction instead.

  </div>
</div>
