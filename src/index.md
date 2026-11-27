---
title: Open Power Lab
---

```js
import "./components/shell.js";
import {COLOURS, eurMwh, percent, gwh, shortDay, irishTime, relativeDay, plotStyle, key} from "./components/format.js";
import {grid, windForecast} from "./components/weather.js";
import {startStreaks, windVectors} from "./components/streaks.js";

const pricesDaily = FileAttachment("data/markets/prices_daily.csv").csv({typed: true});
const systemDaily = FileAttachment("data/markets/system_daily.csv").csv({typed: true});
const latest = FileAttachment("data/markets/latest.json").json();
const historyRaw = FileAttachment("generation/dispatch-down/data/history_monthly.csv").csv({typed: true});
const fleet = FileAttachment("data/batteries/fleet_hh.csv").csv({typed: true});
const batteryMeta = FileAttachment("data/batteries/meta.json").json();
```

```js
// The latest complete day of each kind, and the one before.
const priceDay = pricesDaily.at(-1);
const pricePrev = pricesDaily.at(-2);
const change = priceDay.avg - pricePrev.avg;
const systemDay = systemDaily.at(-1);
// The newest day ENTSO-E has that SEMO hasn't published yet (usually tomorrow), if any.
const aheadDay = (latest.ahead ?? []).at(-1);

// Ten years from EirGrid: 12-month averages, reported and weather-adjusted, all-island.
const asMonth = (m) => (m instanceof Date ? m : new Date(`${m}-01T00:00:00Z`));
const history = historyRaw.filter((d) => d.region === "ALL").map((d) => ({...d, month: asMonth(d.month)}));
const rolling = history.slice(11).map((d, i) => {
  const year = history.slice(i, i + 12);
  return {
    month: d.month,
    reported: (100 * d3.sum(year, (v) => v.lost_gwh)) / d3.sum(year, (v) => v.available_gwh),
    adjusted: d3.sum(year, (v) => v.adjusted_pct * v.available_normal_gwh) / d3.sum(year, (v) => v.available_normal_gwh)
  };
});
const last12 = rolling.at(-1);

// Batteries: the fleet's average charging (-) and discharging (+) by Irish hour.
const irishHour = (t) => +t.toLocaleString("en-IE", {timeZone: "Europe/Dublin", hour: "2-digit", hourCycle: "h23"});
const byHour = d3
  .rollups(fleet, (v) => d3.mean(v, (d) => d.discharging_mw - d.charging_mw), (d) => irishHour(d.timestamp_utc))
  .map(([hour, net]) => ({hour, net}))
  .sort((a, b) => a.hour - b.hour);

// The last 30 days, for the small lines in the figures.
const daily30 = pricesDaily.slice(-30);
const share30 = systemDaily.slice(-30);

// A small line in a stat tile.
const spark = (rows, x, y, colour) =>
  Plot.plot({
    width: 220,
    height: 34,
    margin: 2,
    axis: null,
    style: plotStyle,
    marks: [Plot.lineY(rows, {x, y, stroke: colour, strokeWidth: 1.5}), Plot.dot(rows.slice(-1), {x, y, fill: colour, r: 2.5})]
  });
```

```js
// Behind the introduction: streaks moving with this hour's forecast wind over Ireland,
// from the same forecast as the Wind map (kept in the browser for 30 minutes, so the two
// pages share one download). If the forecast can't be fetched, the intro stays plain.
const streakCanvas = document.createElement("canvas");
const wind = await windForecast(grid()).catch(() => null);
const nowHour = wind ? Math.max(0, d3.bisectLeft(wind.times, new Date()) - 1) : null;
const streakNote = wind
  ? html`<a href="./forecasts/wind-map" class="streak-note">Background: the forecast wind over Ireland this hour →</a>`
  : "";
```

```js
if (wind) {
  const vectors = windVectors(
    wind.speed.map((s) => s[nowHour]),
    wind.direction.map((d) => d[nowHour])
  );
  const stop = startStreaks(streakCanvas, vectors, {colour: "#0e8fb0"});
  invalidation.then(stop);
}
```

<div class="page-head hero-intro">
  <div class="streaks" aria-hidden="true">${streakCanvas}</div>
  <h1>Market intelligence for the all-island electricity market</h1>
  <p class="lede">Day-ahead prices, wind, storage and grid constraints across the I-SEM, with price forecasts scored against every auction.</p>
  <div class="meta">
    ${streakNote}
  </div>
</div>

<div class="stats three">
  <a class="stat" href="./markets/day-ahead" style="color: inherit; text-decoration: none;">
    <span class="label">Day-ahead average · ${shortDay(priceDay.day)}</span>
    <span class="value">${eurMwh(priceDay.avg)}<small>/MWh</small></span>
    <span class="sub"><span class="${change >= 0 ? "up" : "down"}">${change >= 0 ? "▲" : "▼"} ${eurMwh(Math.abs(change))}</span> on ${shortDay(pricePrev.day)} · range ${eurMwh(priceDay.low)} – ${eurMwh(priceDay.high)}</span>
    ${aheadDay ? html`<span class="sub">${relativeDay(aheadDay.day) || shortDay(new Date(`${aheadDay.day}T00:00Z`))}: <b>${eurMwh(aheadDay.avg)}</b> average (hourly)</span>` : ""}
    <div class="spark">${spark(daily30, "day", "avg", COLOURS.price)}</div>
  </a>
  <a class="stat" href="./generation/wind" style="color: inherit; text-decoration: none;">
    <span class="label">Wind share of demand · ${shortDay(systemDay.day)}</span>
    <span class="value">${systemDay.wind_share.toFixed(0)}%</span>
    <span class="sub">${gwh(systemDay.wind_mwh)} of wind, ${gwh(systemDay.demand_mwh)} of demand</span>
    <div class="spark">${spark(share30, "day", "wind_share", COLOURS.wind)}</div>
  </a>
  <a class="stat" href="./generation/dispatch-down/history" style="color: inherit; text-decoration: none;">
    <span class="label">Wind turned down, last 12 months</span>
    <span class="value">${percent(last12.reported)}</span>
    <span class="sub">${percent(last12.adjusted)} with normal wind · to ${d3.utcFormat("%b %Y")(last12.month)}</span>
    <div class="spark">${spark(rolling.slice(-60), "month", "reported", "var(--ink-muted)")}</div>
  </a>
</div>

<div class="section first">
  <div class="grid grid-cols-2 featured">
    <a class="card feature" href="./generation/dispatch-down/history">
      <span class="label">Dispatch down since 2016</span>
      <strong>Most of the recent rise is the weather</strong>
      <p>Over the last 12 months the grid turned down ${percent(last12.reported)} of the wind energy available. With normal wind it would have been about ${percent(last12.adjusted)}. Ten years of official figures, adjusted for how windy each month was.</p>
      ${resize((width) =>
        Plot.plot({
          width,
          height: 110,
          marginLeft: 30,
          marginBottom: 20,
          style: plotStyle,
          x: {type: "utc", label: null, ticks: 5},
          y: {label: null, grid: true, ticks: 3, tickFormat: (v) => `${v}%`},
          marks: [
            Plot.lineY(rolling, {x: "month", y: "reported", stroke: "var(--ink-muted)", strokeWidth: 1.5}),
            Plot.lineY(rolling, {x: "month", y: "adjusted", stroke: "var(--price)", strokeWidth: 1.75}),
            Plot.ruleY([0], {stroke: "var(--line-strong)"})
          ]
        })
      )}
      <span class="label"><span>${key("var(--ink-muted)")}Reported</span> <span>${key("var(--price)")}With normal wind</span> <span>12-month averages</span></span>
    </a>
    <a class="card feature" href="./generation/batteries">
      <span class="label">Batteries</span>
      <strong>${batteryMeta.batteries} batteries, ${d3.format(",.0f")(batteryMeta.size_mw)} MW</strong>
      <p>The island's grid batteries charge overnight and in the middle of the day, when power is cheap, and discharge into the evening peak. Average by hour of the day, Irish time, since ${d3.utcFormat("%-d %B")(new Date(batteryMeta.metered_first_utc))}.</p>
      ${resize((width) =>
        Plot.plot({
          width,
          height: 110,
          marginLeft: 30,
          marginBottom: 20,
          style: plotStyle,
          x: {label: null, ticks: [0, 6, 12, 18], tickFormat: (h) => `${String(h).padStart(2, "0")}:00`},
          y: {label: null, grid: true, ticks: 3},
          marks: [
            Plot.rectY(byHour, {x1: "hour", x2: (d) => d.hour + 1, y: "net", fill: (d) => (d.net >= 0 ? COLOURS.discharge : COLOURS.charge), inset: 0.5}),
            Plot.ruleY([0], {stroke: "var(--line-strong)"})
          ]
        })
      )}
      <span class="label"><span>${key(COLOURS.discharge)}Discharging</span> <span>${key(COLOURS.charge)}Charging</span> <span>MW</span></span>
    </a>
    <a class="card feature" href="./forecasts/wind-map">
      <span class="label">Wind map</span>
      <strong>Watch the wind cross the island</strong>
      <p>Forecast wind at turbine height for the next three days, hour by hour, with every wind farm on the map, and live readings from Met Éireann's weather stations.</p>
    </a>
    <a class="card feature" href="./tools/battery-simulator">
      <span class="label">Battery simulator</span>
      <strong>What could a battery have earned?</strong>
      <p>Choose a battery's size, hours of storage and efficiency, and see the most it could have made trading on a year of real day-ahead prices, against what the island's real batteries did.</p>
    </a>
  </div>
</div>

<div class="section">
  <div class="section-head"><h2>All pages</h2></div>
  <div class="sitemap">
    <div>
      <p class="label">Markets</p>
      <a href="./markets/day-ahead">Day-ahead prices</a>
      <a href="./generation/wind">Wind &amp; demand</a>
      <a href="./generation/batteries">Batteries</a>
    </div>
    <div>
      <p class="label">Dispatch down</p>
      <a href="./generation/dispatch-down/">Monthly</a>
      <a href="./generation/dispatch-down/history">Since 2016</a>
      <a href="./generation/dispatch-down/farms/">Wind farms</a>
      <a href="./generation/dispatch-down/map">Farm map</a>
      <a href="./generation/dispatch-down/methods">Methods</a>
    </div>
    <div>
      <p class="label">Forecasts and tools</p>
      <a href="./forecasts/prices">Price forecasts</a>
      <a href="./forecasts/wind-map">Wind map</a>
      <a href="./forecasts/wind-forecast">EirGrid's wind forecast</a>
      <a href="./tools/battery-simulator">Battery simulator</a>
    </div>
    <div>
      <p class="label">Data</p>
      <a href="./data">Datasets, sources and licences</a>
    </div>
  </div>
</div>
