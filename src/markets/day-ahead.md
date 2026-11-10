---
title: Day-ahead prices
---

```js
import "../components/shell.js";
import {COLOURS, eurMwh, longDay, shortDay, monthName, irishTime, plotStyle, key} from "../components/format.js";

const pricesHH = FileAttachment("../data/markets/prices_hh.csv").csv({typed: true});
const pricesDaily = FileAttachment("../data/markets/prices_daily.csv").csv({typed: true});
const latest = FileAttachment("../data/markets/latest.json").json();
```

```js
const rangeInput = Inputs.radio(["30 days", "90 days", "1 year"], {value: "90 days"});
rangeInput.classList.add("segmented");
const range = Generators.input(rangeInput);
```

```js
// Everything on the page follows the chosen range, ending on the latest complete day.
const days = {"30 days": 30, "90 days": 90, "1 year": 366}[range];
const daily = pricesDaily.slice(-days);
const first = daily[0].day;
const last = d3.utcDay.offset(daily.at(-1).day, 1);
const toDay = new Intl.DateTimeFormat("en-CA", {timeZone: "Europe/Dublin"});
const toTime = new Intl.DateTimeFormat("en-IE", {timeZone: "Europe/Dublin", hour: "2-digit", minute: "2-digit"});
const halfHours = pricesHH
  .map((d) => {
    const time = toTime.format(d.timestamp_utc);
    return {...d, day: new Date(`${toDay.format(d.timestamp_utc)}T00:00Z`), time, slot: 2 * +time.slice(0, 2) + (time.slice(3) === "30" ? 1 : 0)};
  })
  .filter((d) => d.day >= first && d.day < last);
const slotName = (i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`;
// Heatmap colours, from pale to the price colour (CSS variables can't be blended, so set here).
const heatRange = ["#f3f0ff", "#4b2fc9"];

const volume = d3.sum(halfHours, (d) => (d.volume_roi_mw + d.volume_ni_mw) * 0.5);
const vwap = d3.sum(halfHours, (d) => d.price * (d.volume_roi_mw + d.volume_ni_mw)) / d3.sum(halfHours, (d) => d.volume_roi_mw + d.volume_ni_mw);
const negative = halfHours.filter((d) => d.price < 0).length;
const lowest = d3.least(halfHours, (d) => d.price);
const highest = d3.greatest(halfHours, (d) => d.price);

// Monthly statistics.
const months = d3
  .rollups(
    halfHours,
    (v) => ({
      avg: d3.mean(v, (d) => d.price),
      vwap: d3.sum(v, (d) => d.price * (d.volume_roi_mw + d.volume_ni_mw)) / d3.sum(v, (d) => d.volume_roi_mw + d.volume_ni_mw),
      low: d3.min(v, (d) => d.price),
      high: d3.max(v, (d) => d.price),
      negative: v.filter((d) => d.price < 0).length,
      volume: d3.sum(v, (d) => (d.volume_roi_mw + d.volume_ni_mw) * 0.5),
      days: new Set(v.map((d) => +d.day)).size
    }),
    (d) => +d3.utcMonth(d.day)
  )
  .map(([month, s]) => ({month: new Date(month), ...s}))
  .sort((a, b) => b.month - a.month);

// Daily volume in each zone.
const zoneVolumes = d3
  .rollups(halfHours, (v) => [d3.sum(v, (d) => d.volume_roi_mw * 0.5), d3.sum(v, (d) => d.volume_ni_mw * 0.5)], (d) => +d.day)
  .flatMap(([day, [roi, ni]]) => [
    {day: new Date(day), zone: "Ireland", gwh: roi / 1000},
    {day: new Date(day), zone: "Northern Ireland", gwh: ni / 1000}
  ]);
```

<div class="page-head">
  <p class="crumbs">Markets / Day-ahead</p>
  <h1>Day-ahead prices</h1>
  <p class="lede">Results of the SEM day-ahead auction, run by SEMOpx the day before delivery. Ireland and Northern Ireland are one coupled market, so they share one price; volumes are shown for each zone.</p>
  <div class="meta">
    <span>Latest complete day: ${longDay(pricesDaily.at(-1).day)}</span>
    <span>Source: SEMOpx, via SEMO's published market results</span>
    <span>Times are Irish time</span>
  </div>
</div>

<div class="toolbar">${rangeInput}<span class="muted">${longDay(first)} to ${longDay(daily.at(-1).day)}</span></div>

<div class="stats">
  <div class="stat">
    <span class="label">Average price</span>
    <span class="value">${eurMwh(d3.mean(halfHours, (d) => d.price))}<small>/MWh</small></span>
    <span class="sub">Volume-weighted ${eurMwh(vwap)}</span>
  </div>
  <div class="stat">
    <span class="label">Lowest half-hour</span>
    <span class="value">${eurMwh(lowest.price)}</span>
    <span class="sub">${irishTime(lowest.timestamp_utc)}${negative ? ` · ${negative} negative half-hours` : " · no negative prices"}</span>
  </div>
  <div class="stat">
    <span class="label">Highest half-hour</span>
    <span class="value">${eurMwh(highest.price)}</span>
    <span class="sub">${irishTime(highest.timestamp_utc)}</span>
  </div>
  <div class="stat">
    <span class="label">Volume traded</span>
    <span class="value">${d3.format(",.2f")(volume / 1e6)}<small>TWh</small></span>
    <span class="sub">Ireland and Northern Ireland together</span>
  </div>
</div>

<div class="card">
  <div class="card-head"><span class="label">Daily average price</span><span class="label">€/MWh · shaded: the day's lowest to highest half-hour</span></div>
  ${resize((width) =>
    Plot.plot({
      width,
      height: 280,
      marginLeft: 42,
      style: plotStyle,
      x: {type: "utc", label: null},
      y: {label: null, grid: true},
      marks: [
        Plot.areaY(daily, {x: "day", y1: "low", y2: "high", fill: COLOURS.price, fillOpacity: 0.15, curve: "step"}),
        Plot.lineY(daily, {x: "day", y: "avg", stroke: COLOURS.price, strokeWidth: 1.75, curve: "step"}),
        Plot.ruleY([0], {stroke: "var(--line-strong)"}),
        Plot.tip(daily, Plot.pointerX({x: "day", y: "avg", title: (d) => `${longDay(d.day)}\nAverage ${eurMwh(d.avg)} · volume-weighted ${eurMwh(d.vwap)}\nRange ${eurMwh(d.low)} – ${eurMwh(d.high)}${d.negative_hh ? `\n${d.negative_hh} negative half-hours` : ""}`}))
      ]
    })
  )}
</div>

<div class="card" style="margin-top: 0.75rem;">
  <div class="card-head"><span class="label">Every half-hour</span><span class="label">Each column is a day, each row a half-hour (Irish time). Darker is dearer.</span></div>
  ${resize((width) =>
    Plot.plot({
      width,
      height: 340,
      marginLeft: 46,
      style: plotStyle,
      x: {type: "utc", label: null},
      y: {label: null, domain: [48, 0], ticks: [0, 12, 24, 36], tickFormat: (i) => slotName(i)},
      color: {type: "linear", range: heatRange, interpolate: "lab", domain: [0, d3.quantile(halfHours, 0.98, (d) => d.price)], clamp: true, legend: true, label: "€/MWh", width: 280},
      marks: [
        Plot.rect(halfHours, {
          x1: "day",
          x2: (d) => d3.utcDay.offset(d.day, 1),
          y1: "slot",
          y2: (d) => d.slot + 1,
          fill: "price",
          tip: {channels: {Day: (d) => longDay(d.day), Time: "time", Price: (d) => `${eurMwh(d.price)}/MWh`}, format: {x1: false, x2: false, y1: false, y2: false, fill: false}}
        })
      ]
    })
  )}
  <p class="muted" style="margin-top: 0.5rem;">Clock-change days have 46 or 50 half-hours, so one hour repeats or is missing on those columns.</p>
</div>

<div class="grid grid-cols-2" style="margin-top: 0.75rem;">
  <div class="card">
    <div class="card-head"><span class="label">Volume by zone</span><span class="label">GWh per day</span></div>
    ${resize((width) =>
      Plot.plot({
        width,
        height: 240,
        marginLeft: 36,
        style: plotStyle,
        x: {type: "utc", label: null},
        y: {label: null, grid: true},
        color: {domain: ["Ireland", "Northern Ireland"], range: [COLOURS.ROI, COLOURS.NI]},
        marks: [
          Plot.areaY(zoneVolumes, {x: "day", y: "gwh", fill: "zone", curve: "step", tip: {format: {x: longDay, y: (v) => `${v.toFixed(1)} GWh`}}}),
          Plot.ruleY([0], {stroke: "var(--line-strong)"})
        ]
      })
    )}
    <p class="label" style="margin-top: 0.5rem;"><span>${key(COLOURS.ROI)}Ireland</span><span>${key(COLOURS.NI)}Northern Ireland</span></p>
  </div>
  <div class="card">
    <div class="card-head"><span class="label">Average price by time of day</span><span class="label">€/MWh, over the chosen range</span></div>
    ${resize((width) =>
      Plot.plot({
        width,
        height: 240,
        marginLeft: 42,
        style: plotStyle,
        x: {label: null, domain: d3.range(48).map((i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`), ticks: ["00:00", "06:00", "12:00", "18:00"]},
        y: {label: null, grid: true},
        marks: [
          Plot.barY(halfHours, Plot.groupX({y: "mean"}, {x: "time", y: "price", fill: COLOURS.price, fillOpacity: 0.85, tip: {format: {y: (v) => eurMwh(v)}}})),
          Plot.ruleY([0], {stroke: "var(--line-strong)"})
        ]
      })
    )}
  </div>
</div>

<div class="section">
  <div class="section-head"><h2>By month</h2></div>
  <div class="card" style="padding: 0.4rem 0.9rem;">

```js
Inputs.table(months, {
  columns: ["month", "avg", "vwap", "low", "high", "negative", "volume", "days"],
  header: {month: "Month", avg: "Average", vwap: "Volume-weighted", low: "Lowest", high: "Highest", negative: "Negative half-hours", volume: "Volume", days: "Days"},
  format: {month: monthName, avg: eurMwh, vwap: eurMwh, low: eurMwh, high: eurMwh, volume: (v) => `${d3.format(",.0f")(v / 1000)} GWh`},
  layout: "auto",
  select: false,
  rows: 14
})
```

  </div>
  <p class="muted" style="margin-top: 0.6rem;">Prices in €/MWh. A month at the edge of the range may be partial; "Days" says how many it has. Download: ${html`<a href=${FileAttachment("../data/markets/prices_hh.csv").href} download>half-hourly prices and volumes</a>`} · ${html`<a href=${FileAttachment("../data/markets/prices_daily.csv").href} download>daily summary</a>`}</p>
</div>
