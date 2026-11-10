---
title: Today
---

```js
import "./components/shell.js";
import {COLOURS, eurMwh, mw, percent, gwh, longDay, shortDay, monthName, irishTime, asDay, plotStyle, key} from "./components/format.js";

const pricesDaily = FileAttachment("data/markets/prices_daily.csv").csv({typed: true});
const pricesRecent = FileAttachment("data/markets/prices_recent.csv").csv({typed: true});
const systemDaily = FileAttachment("data/markets/system_daily.csv").csv({typed: true});
const systemRecent = FileAttachment("data/markets/system_hh.csv").csv({typed: true});
const latest = FileAttachment("data/markets/latest.json").json();
const ddMonthly = FileAttachment("generation/dispatch-down/data/monthly.csv").csv({typed: true});
```

```js
// The latest complete day of each kind, and the one before.
const priceDay = pricesDaily.at(-1);
const pricePrev = pricesDaily.at(-2);
const change = priceDay.avg - pricePrev.avg;
const systemDay = systemDaily.at(-1);

// When the latest day's lowest and highest prices were, in Irish time.
const sameDay = (t, day) => t.toLocaleDateString("en-CA", {timeZone: "Europe/Dublin"}) === day.toISOString().slice(0, 10);
const dayHalfHours = pricesRecent.filter((d) => sameDay(d.timestamp_utc, priceDay.day));
const clock = (t) => t.toLocaleTimeString("en-IE", {timeZone: "Europe/Dublin", hour: "2-digit", minute: "2-digit"});
const lowAt = clock(dayHalfHours.find((d) => d.price === priceDay.low).timestamp_utc);
const highAt = clock(dayHalfHours.find((d) => d.price === priceDay.high).timestamp_utc);

// Dispatch-down: the latest month with most of its days covered.
const ddAll = ddMonthly.filter((d) => d.region === "ALL");
const dd = ddAll.filter((d) => d.days_with_data >= 0.8 * d.days_in_month).at(-1) ?? ddAll.at(-1);

// The last 7 days, for the charts.
const lastWeek = (rows) => {
  const end = d3.max(rows, (d) => d.timestamp_utc);
  return rows.filter((d) => d.timestamp_utc > d3.utcDay.offset(end, -7));
};
const prices7 = lastWeek(pricesRecent);
const system7 = lastWeek(systemRecent);
const daily30 = pricesDaily.slice(-30);
const share30 = systemDaily.slice(-30);

// A small line in a stat tile.
const spark = (rows, y, colour) =>
  Plot.plot({
    width: 220,
    height: 34,
    margin: 2,
    axis: null,
    style: plotStyle,
    marks: [Plot.lineY(rows, {x: "day", y, stroke: colour, strokeWidth: 1.5}), Plot.dot(rows.slice(-1), {x: "day", y, fill: colour, r: 2.5})]
  });
```

<div class="page-head">
  <p class="crumbs">Markets / Today</p>
  <h1>Irish electricity market</h1>
  <p class="lede">The latest day-ahead prices, wind and demand on the island of Ireland, from public SEMOpx and EirGrid data.</p>
  <div class="meta">
    <span>Day-ahead results: ${longDay(priceDay.day)}</span>
    <span>System data to ${irishTime(new Date(latest.system_last_utc))}</span>
    <span>Updated daily · not live</span>
  </div>
</div>

<div class="stats">
  <div class="stat">
    <span class="label">Day-ahead average · ${shortDay(priceDay.day)}</span>
    <span class="value">${eurMwh(priceDay.avg)}<small>/MWh</small></span>
    <span class="sub"><span class="${change >= 0 ? "up" : "down"}">${change >= 0 ? "▲" : "▼"} ${eurMwh(Math.abs(change))}</span> on ${shortDay(pricePrev.day)} · volume-weighted ${eurMwh(priceDay.vwap)}</span>
    <div class="spark">${spark(daily30, "avg", COLOURS.price)}</div>
  </div>
  <div class="stat">
    <span class="label">Day-ahead range · ${shortDay(priceDay.day)}</span>
    <span class="value">${eurMwh(priceDay.low)} – ${eurMwh(priceDay.high)}</span>
    <span class="sub">Lowest at ${lowAt}, highest at ${highAt}${priceDay.negative_hh ? ` · ${priceDay.negative_hh} negative half-hours` : ""}</span>
  </div>
  <div class="stat">
    <span class="label">Wind share of demand · ${shortDay(systemDay.day)}</span>
    <span class="value">${systemDay.wind_share.toFixed(0)}%</span>
    <span class="sub">${gwh(systemDay.wind_mwh)} of wind, ${gwh(systemDay.demand_mwh)} of demand</span>
    <div class="spark">${spark(share30, "wind_share", COLOURS.wind)}</div>
  </div>
  <a class="stat" href="./generation/dispatch-down/" style="color: inherit; text-decoration: none;">
    <span class="label">Wind turned down · ${monthName(dd.month)}</span>
    <span class="value">${percent(dd.dispatch_down_pct)}</span>
    <span class="sub">${gwh(dd.lost_mwh)} lost${dd.days_with_data < dd.days_in_month ? ` · ${dd.days_with_data} of ${dd.days_in_month} days` : ""} · see dispatch-down →</span>
  </a>
</div>

<div class="grid grid-cols-2">
  <div class="card">
    <div class="card-head"><span class="label">Day-ahead price, last 7 days</span><a class="label" href="./markets/day-ahead">€/MWh, half-hourly · more →</a></div>
    ${resize((width) =>
      Plot.plot({
        width,
        height: 260,
        marginLeft: 42,
        style: plotStyle,
        x: {type: "utc", label: null, ticks: 7},
        y: {label: null, grid: true},
        marks: [
          Plot.ruleY([0], {stroke: "var(--line-strong)"}),
          Plot.lineY(prices7, {x: "timestamp_utc", y: "price", stroke: COLOURS.price, strokeWidth: 1.5, curve: "step-after"}),
          Plot.tip(prices7, Plot.pointerX({x: "timestamp_utc", y: "price", title: (d) => `${irishTime(d.timestamp_utc)}\n${eurMwh(d.price)}/MWh`}))
        ]
      })
    )}
  </div>
  <div class="card">
    <div class="card-head"><span class="label">Wind and demand, last 7 days</span><a class="label" href="./generation/wind">MW, half-hourly · more →</a></div>
    ${resize((width) =>
      Plot.plot({
        width,
        height: 260,
        marginLeft: 42,
        style: plotStyle,
        x: {type: "utc", label: null, ticks: 7},
        y: {label: null, grid: true},
        marks: [
          Plot.areaY(system7, {x: "timestamp_utc", y: "wind", fill: COLOURS.wind, fillOpacity: 0.25}),
          Plot.lineY(system7, {x: "timestamp_utc", y: "wind", stroke: COLOURS.wind, strokeWidth: 1.5}),
          Plot.lineY(system7, {x: "timestamp_utc", y: "demand", stroke: COLOURS.demand, strokeWidth: 1.5}),
          Plot.ruleY([0], {stroke: "var(--line-strong)"}),
          Plot.tip(system7, Plot.pointerX({x: "timestamp_utc", y: "demand", title: (d) => `${irishTime(d.timestamp_utc)}\nDemand ${mw(d.demand)}\nWind ${mw(d.wind)} (${(100 * d.wind / d.demand).toFixed(0)}%)`}))
        ]
      })
    )}
    <p class="label" style="margin-top: 0.5rem;"><span>${key(COLOURS.wind)}Wind</span><span>${key(COLOURS.demand)}Demand</span></p>
  </div>
</div>

<div class="card">
  <div class="card-head"><span class="label">Daily average day-ahead price, last 90 days</span><span class="label">€/MWh · bars show the day's range</span></div>
  ${resize((width) =>
    Plot.plot({
      width,
      height: 220,
      marginLeft: 42,
      style: plotStyle,
      x: {type: "utc", label: null},
      y: {label: null, grid: true},
      marks: [
        Plot.ruleX(pricesDaily.slice(-90), {x: "day", y1: "low", y2: "high", stroke: COLOURS.price, strokeOpacity: 0.3, strokeWidth: Math.max(1, width / 180)}),
        Plot.lineY(pricesDaily.slice(-90), {x: "day", y: "avg", stroke: COLOURS.price, strokeWidth: 1.75}),
        Plot.tip(pricesDaily.slice(-90), Plot.pointerX({x: "day", y: "avg", title: (d) => `${longDay(d.day)}\nAverage ${eurMwh(d.avg)}\nRange ${eurMwh(d.low)} – ${eurMwh(d.high)}`}))
      ]
    })
  )}
</div>

<div class="section">
  <div class="section-head"><h2>Explore</h2></div>
  <div class="links">
    <a href="./markets/day-ahead"><b>Day-ahead prices</b><span>A year of half-hourly prices, volumes by zone, monthly statistics</span></a>
    <a href="./generation/wind"><b>Wind &amp; demand</b><span>Wind output, its share of demand, and EirGrid's forecast against what happened</span></a>
    <a href="./generation/dispatch-down/"><b>Dispatch-down</b><span>How much wind is turned down, why, and at which of 200 farms</span></a>
    <a href="./data"><b>Datasets</b><span>Sources, licences and every file behind this site</span></a>
  </div>
</div>
