---
title: Price forecasts
---

```js
import "../components/shell.js";
import {COLOURS, eurMwh, longDay, shortDay, monthName, shortMonth, irishTime, plotStyle, key, percent} from "../components/format.js";

const scores = FileAttachment("data/prices/scores.csv").csv({typed: true});
const monthly = FileAttachment("data/prices/monthly.csv").csv({typed: true});
const daily = FileAttachment("data/prices/daily.csv").csv({typed: true});
const halfhours = FileAttachment("data/prices/halfhours.csv").csv({typed: true});
const meta = FileAttachment("data/prices/meta.json").json();
```

```js
// One colour per method, the same on every chart.
const METHOD_COLOURS = {
  chronos2_wind: COLOURS.price,
  chronos2: "#c4b8ff",
  lightgbm_wind: "#d97706",
  lightgbm: "#f3c78f",
  week_average: "var(--ink-faint)",
  yesterday: "#a3abb4",
  last_week: "var(--line-strong)"
};
const label = (method) => meta.labels[method];
const score = (test, method) => scores.find((d) => d.test === test && d.method === method);

const withWind = score("wind", "chronos2_wind");
const alone = score("wind", "chronos2");
const simple = score("wind", "week_average");
const fitted = score("wind", "lightgbm_wind");
const better = 1 - withWind.MAE / alone.MAE;
const range = (d) => `${longDay(new Date(`${d.first_day}T00:00Z`))} to ${longDay(new Date(`${d.last_day}T00:00Z`))}`;

// Each delivery day of the wind test, newest first, with how far each method missed.
const toDay = new Intl.DateTimeFormat("en-CA", {timeZone: "Europe/Dublin"});
const dayOf = (t) => new Date(`${toDay.format(new Date(+t + 3600e3))}T00:00Z`); // 23:00 starts the next day
const byDay = d3.group(daily, (d) => +d.day);
const days = [...byDay.keys()].sort((a, b) => b - a).map((day) => {
  const misses = Object.fromEntries(byDay.get(day).map((d) => [d.method, d.mae]));
  return {day: new Date(day), ...misses};
});
const worst = d3.greatest(days, (d) => d.chronos2_wind);

// The scores of one test, best first.
function scoreTable(test) {
  return Inputs.table(scores.filter((d) => d.test === test), {
    columns: ["method", "MAE", "RMSE", "inside_range"],
    header: {method: "Method", MAE: "MAE", RMSE: "RMSE", inside_range: "Inside 80% range"},
    format: {method: label, MAE: eurMwh, RMSE: eurMwh, inside_range: (v) => (v == null ? "" : percent(v * 100))},
    layout: "auto",
    select: false
  });
}
```

```js
const dayInput = Inputs.select(days, {
  format: (d) => `${d3.utcFormat("%a %-d %b %Y")(d.day)}  ·  missed by ${eurMwh(d.chronos2_wind)}`,
  value: days[0]
});
const chosen = Generators.input(dayInput);

// A shortcut to the day it missed by most.
const worstButton = html`<button type="button" class="text-button">Show its worst day</button>`;
worstButton.onclick = () => {
  dayInput.value = worst;
  dayInput.dispatchEvent(new Event("input", {bubbles: true}));
};
```

```js
const order = ["chronos2_wind", "lightgbm_wind", "week_average"];
const theDay = halfhours.filter((d) => +dayOf(d.timestamp_utc) === +chosen.day);
const lines = order.flatMap((method) => theDay.map((d) => ({time: d.timestamp_utc, method, price: d[method]})));
```

<div class="page-head">
  <p class="crumbs">Forecasts / Price forecasts</p>
  <h1>Forecasting tomorrow's prices</h1>
  <p class="lede">Chronos-2 is a pre-trained AI model for time series, made by Amazon. It hasn't been trained on Irish prices at all. Each day it is shown only what was known before the day-ahead auction, asked for the next day's 48 half-hourly prices, and scored against what happened. Given EirGrid's wind forecast as well, its average miss falls by <strong>${Math.round(better * 100)}%</strong>. Its competitor, LightGBM, is fitted on Irish data alone and refitted every day.</p>
  <div class="meta">
    <span>Models: Chronos-2 (amazon/chronos-2), ${meta.context_days} days of history; LightGBM, fitted on every day before</span>
    <span>Scored to ${longDay(new Date(`${meta.wind.last_day}T00:00Z`))}; updated ${irishTime(new Date(meta.made))}</span>
    <span>Code: <a href="https://github.com/Nabel7/isem-forecast">isem-forecast</a></span>
  </div>
</div>

<div class="stats">
  <div class="stat">
    <span class="label">Chronos-2 + wind forecast</span>
    <span class="value accent">${eurMwh(withWind.MAE)}<small>/MWh</small></span>
    <span class="sub">Average miss, ${meta.wind.days} days from ${shortDay(new Date(`${meta.wind.first_day}T00:00Z`))}. Prices only: ${eurMwh(alone.MAE)}</span>
  </div>
  <div class="stat">
    <span class="label">LightGBM + wind forecast</span>
    <span class="value">${eurMwh(fitted.MAE)}<small>/MWh</small></span>
    <span class="sub">Same days and inputs, fitted on Irish data</span>
  </div>
  <div class="stat">
    <span class="label">Average of the last 7 days</span>
    <span class="value">${eurMwh(simple.MAE)}<small>/MWh</small></span>
    <span class="sub">The best simple method: the bar to beat</span>
  </div>
  <div class="stat">
    <span class="label">Inside Chronos-2's 80% range</span>
    <span class="value">${percent(withWind.inside_range * 100)}</span>
    <span class="sub">Should be 80%. LightGBM's: ${percent(fitted.inside_range * 100)}</span>
  </div>
</div>

<div class="card">
  <div class="card-head"><span class="label">One day's forecast</span><span class="label">€/MWh, Irish time · shaded: Chronos-2's 80% range, with wind</span></div>
  <div class="toolbar" style="margin: 0 0 0.5rem;">${dayInput}${worstButton}</div>
  ${resize((width) =>
    Plot.plot({
      width,
      height: 300,
      marginLeft: 42,
      style: plotStyle,
      x: {type: "utc", label: null, tickFormat: (t) => t.toLocaleTimeString("en-IE", {timeZone: "Europe/Dublin", hour: "2-digit", minute: "2-digit"})},
      y: {label: null, grid: true},
      color: {domain: order, range: order.map((m) => METHOD_COLOURS[m])},
      marks: [
        Plot.areaY(theDay, {x: "timestamp_utc", y1: "chronos2_wind_low", y2: "chronos2_wind_high", fill: COLOURS.price, fillOpacity: 0.15, curve: "step-after"}),
        Plot.lineY(lines, {x: "time", y: "price", stroke: "method", strokeWidth: (d) => (d.method === "chronos2_wind" ? 2 : 1.4), strokeDasharray: (d) => (d.method === "week_average" ? "3,3" : null), curve: "step-after"}),
        Plot.lineY(theDay, {x: "timestamp_utc", y: "actual", stroke: "var(--ink)", strokeWidth: 1.6, curve: "step-after"}),
        Plot.ruleY([0], {stroke: "var(--line-strong)"}),
        Plot.tip(theDay, Plot.pointerX({x: "timestamp_utc", y: "actual", title: (d) => `${irishTime(d.timestamp_utc)}\nActual ${eurMwh(d.actual)}\n${label("chronos2_wind")} ${eurMwh(d.chronos2_wind)} (80%: ${eurMwh(d.chronos2_wind_low)} to ${eurMwh(d.chronos2_wind_high)})\n${label("lightgbm_wind")} ${eurMwh(d.lightgbm_wind)}\n${label("week_average")} ${eurMwh(d.week_average)}\nWind forecast ${d3.format(",.0f")(d.wind_forecast_mw)} MW`}))
      ]
    })
  )}
  <p class="label" style="margin-top: 0.4rem;"><span>${key("var(--ink)")}Actual</span><span>${key(COLOURS.price)}${label("chronos2_wind")}: missed by ${eurMwh(chosen.chronos2_wind)}</span><span>${key(METHOD_COLOURS.lightgbm_wind)}${label("lightgbm_wind")}: ${eurMwh(chosen.lightgbm_wind)}</span><span>${key(METHOD_COLOURS.week_average)}${label("week_average")}: ${eurMwh(chosen.week_average)}</span></p>
  ${resize((width) =>
    Plot.plot({
      width,
      height: 110,
      marginLeft: 42,
      style: plotStyle,
      x: {type: "utc", label: null, axis: null},
      y: {label: null, grid: true, ticks: 3, tickFormat: (v) => `${v / 1000}k`},
      marks: [
        Plot.areaY(theDay, {x: "timestamp_utc", y: "wind_forecast_mw", fill: COLOURS.wind, fillOpacity: 0.25, curve: "step-after"}),
        Plot.lineY(theDay, {x: "timestamp_utc", y: "wind_forecast_mw", stroke: COLOURS.wind, curve: "step-after"})
      ]
    })
  )}
  <p class="label"><span>${key(COLOURS.wind)}EirGrid's wind forecast for the day, MW, as it stood before the auction: what the model was given</span></p>
</div>

<div class="card" style="margin-top: 0.75rem;">
  <div class="card-head"><span class="label">Average miss, day by day</span><span class="label">€/MWh, lower is better</span></div>
  ${resize((width) =>
    Plot.plot({
      width,
      height: 240,
      marginLeft: 42,
      style: plotStyle,
      x: {type: "utc", label: null},
      y: {label: null, grid: true},
      marks: [
        Plot.lineY(daily.filter((d) => order.includes(d.method)), {x: "day", y: "mae", stroke: (d) => METHOD_COLOURS[d.method], z: "method", strokeWidth: (d) => (d.method === "chronos2_wind" ? 2 : 1.3), strokeDasharray: (d) => (d.method === "week_average" ? "3,3" : null)}),
        Plot.ruleX([chosen.day], {stroke: "var(--line-strong)"}),
        Plot.ruleY([0], {stroke: "var(--line-strong)"}),
        Plot.tip(days, Plot.pointerX({x: "day", y: "chronos2_wind", title: (d) => `${longDay(d.day)}\n${label("chronos2_wind")} ${eurMwh(d.chronos2_wind)}\n${label("lightgbm_wind")} ${eurMwh(d.lightgbm_wind)}\n${label("week_average")} ${eurMwh(d.week_average)}`}))
      ]
    })
  )}
  <p class="label" style="margin-top: 0.4rem;">${order.map((m) => html`<span>${key(METHOD_COLOURS[m])}${label(m)}</span>`)}</p>
  <p class="muted" style="margin-top: 0.4rem;">The worst days are sudden jumps in the price, up or down, beyond anything in the month before. The wind forecast warns of many of them, but not all.</p>
</div>

<div class="section">
  <div class="section-head"><h2>The scores</h2><p>Every method is scored on the same half-hours. MAE is the average size of the miss; RMSE is similar but counts big misses for more.</p></div>
  <div class="grid grid-cols-2">

  <div class="card">
    <div class="card-head"><span class="label">With the wind forecast</span><span class="label">${range(meta.wind)}</span></div>
    ${scoreTable("wind")}
    <p class="muted" style="margin-top: 0.5rem;">Starts once a month of before-the-auction wind forecasts had been kept. Since August 2026, ${meta.wind.half_hours.toLocaleString("en-IE")} half-hours.</p>
  </div>
  <div class="card">
    <div class="card-head"><span class="label">A year, prices only</span><span class="label">${range(meta.year)}</span></div>
    ${scoreTable("year")}
    <p class="muted" style="margin-top: 0.5rem;">Both models given nothing but the price history. Starts once LightGBM had a month to learn from. ${meta.year.half_hours.toLocaleString("en-IE")} half-hours.</p>
  </div>
  </div>
</div>

<div class="card" style="margin-top: 0.75rem;">
  <div class="card-head"><span class="label">A year, prices only: average miss by month</span><span class="label">€/MWh</span></div>
  ${resize((width) =>
    Plot.plot({
      width,
      height: 240,
      marginLeft: 42,
      style: plotStyle,
      marginRight: 28,
      x: {type: "utc", label: null, tickFormat: shortMonth},
      y: {label: null, grid: true, domain: [0, d3.max(monthly, (d) => d.mae)]},
      marks: [
        Plot.lineY(monthly.filter((d) => d.test === "year"), {x: "month", y: "mae", z: "method", stroke: (d) => METHOD_COLOURS[d.method], strokeWidth: (d) => (d.method === "chronos2" || d.method === "lightgbm" ? 2 : 1.3), marker: "circle-stroke"}),
        Plot.ruleY([0], {stroke: "var(--line-strong)"}),
        Plot.tip(monthly.filter((d) => d.test === "year"), Plot.pointer({x: "month", y: "mae", title: (d) => `${monthName(d.month)}\n${label(d.method)}: ${eurMwh(d.mae)}`}))
      ]
    })
  )}
  <p class="label" style="margin-top: 0.4rem;">${["chronos2", "lightgbm", "week_average", "yesterday", "last_week"].map((m) => html`<span>${key(METHOD_COLOURS[m])}${label(m)}</span>`)}</p>
  <p class="muted">On prices alone Chronos-2 was ahead of every other method in every month. LightGBM, with only Irish data to learn from, did no better than the 7-day average over the year. Every method misses most when the price moves for reasons outside the price history, as in October and November 2026.</p>
</div>

<div class="section">
  <div class="section-head"><h2>How it works</h2></div>
  <div class="steps">
    <div class="step">
      <span class="label"><span>1</span><span>The model</span></span>
      <h3>Pre-trained, not fitted</h3>
      <p>Chronos-2 learned how series tend to go on from a huge mix of real and made-up ones: sales, traffic, weather, energy. Like a language model reading words, it reads the history in chunks of 8 hours and continues it. Nothing is trained on Irish data, and nothing is tuned.</p>
    </div>
    <div class="step">
      <span class="label"><span>2</span><span>The test</span></span>
      <h3>One day at a time, no peeking</h3>
      <p>The auction for each day closes at 11:00 Irish time the day before. For every day, the model sees the last ${meta.context_days} days of prices before that, forecasts the day, and is scored. It came out in October 2025, before any of these prices, so it can't have seen them.</p>
    </div>
    <div class="step">
      <span class="label"><span>3</span><span>The wind</span></span>
      <h3>The forecast a trader had</h3>
      <p>EirGrid updates its wind forecast about four times a day. The model gets the version published by ${String(meta.wind.cutoff_hour_utc).padStart(2, "0")}:00 UTC the day before, at least an hour before the auction, for the past month and for the day ahead, and learns how the price moved with it.</p>
    </div>
    <div class="step">
      <span class="label"><span>4</span><span>The range</span></span>
      <h3>A range, not one number</h3>
      <p>For each half-hour it gives a central forecast (the median, scored above) and a range it expects the price to land in 80% of the time. So far the price landed inside about ${Math.round(withWind.inside_range * 100)}% of the time.</p>
    </div>
    <div class="step">
      <span class="label"><span>5</span><span>The competitor</span></span>
      <h3>LightGBM, fitted on Irish data</h3>
      <p>Hundreds of small decision trees, each correcting the ones before. Every day it is refitted on every day before, from a table of what was known before the auction: the time of day, the weekday, recent prices and the same wind forecast. Its settings were fixed before testing, not tuned on the results.</p>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-head"><h2>Read with care</h2></div>
  <div class="card">
    <ul style="margin: 0; padding-left: 1.1rem;">
      <li><strong>A short test.</strong> The wind test covers ${meta.wind.days} days, mostly a stormy autumn. A different season could score differently.</li>
      <li><strong>One competitor, set up once.</strong> LightGBM's set-up was chosen in advance. Two other set-ups were checked on the same days: forecasting the price itself, rather than the change from yesterday's average, scored ${eurMwh(meta.lightgbm_checks["forecast the price itself"])}; training on every day since November 2025 scored ${eurMwh(meta.lightgbm_checks["train on every day since November 2025"])}. Both still behind Chronos-2. A more carefully built model could do better.</li>
      <li><strong>LightGBM's ranges are much too narrow.</strong> Only ${percent(fitted.inside_range * 100)} of prices landed inside its 80% range: with a few weeks of data, its 10% and 90% models are too sure of themselves.</li>
      <li><strong>Peeking makes little difference here.</strong> Given EirGrid's later, revised wind forecast instead, which no trader had at auction time, it would have scored ${eurMwh(meta.wind.peeking_mae)}, only a little better than ${eurMwh(withWind.MAE)}. The forecast from the morning before was already close to the final one.</li>
      <li><strong>Gaps.</strong> When no forecast came out on the morning before (${meta.wind.fallback_versions.map((d) => shortDay(new Date(`${d.day}T00:00Z`))).join(", ") || "never, so far"}), the newest earlier one is used.</li>
      <li><strong>Updated by hand</strong>, not daily, for now. Not trading advice.</li>
    </ul>
  </div>
  <p class="muted" style="margin-top: 0.6rem;">Prices: SEMOpx day-ahead results, via SEMO. Wind forecasts: EirGrid's per-farm forecasts (SEMO report BM-012), added up for the island. Download: ${html`<a href=${FileAttachment("data/prices/halfhours.csv").href} download>every half-hour of the wind test</a>`} · ${html`<a href=${FileAttachment("data/prices/scores.csv").href} download>scores</a>`} · ${html`<a href=${FileAttachment("data/prices/monthly.csv").href} download>by month</a>`}</p>
</div>
