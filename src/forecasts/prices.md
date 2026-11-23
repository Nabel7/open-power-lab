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

// The live record (scripts/export_live.py): every forecast saved so far, and the scores.
const liveHalfhours = FileAttachment("data/live/halfhours.csv").csv({typed: true});
const liveDays = FileAttachment("data/live/days.csv").csv({typed: true});
const liveScores = FileAttachment("data/live/scores.csv").csv({typed: true});
const liveMeta = FileAttachment("data/live/meta.json").json();
// Hourly day-ahead prices from ENTSO-E, for days SEMO hasn't published yet.
const ahead = FileAttachment("../data/markets/prices_ahead.csv").csv({typed: true});
```

```js
import {asDay, irishDay, irishClock, relativeDay} from "../components/format.js";
import {LIVE_REPOSITORY, savedAt, fetchForecast} from "../components/live.js";

// Tomorrow's forecast, read from the public repository when the page opens: it is saved
// overnight, before the 09:00 UTC cut-off, often after the site's last build. Null until then.
const fetched = await fetchForecast(irishDay(1), (text) => d3.csvParse(text, d3.autoType));
```

```js
const isoDay = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d));
const LIVE_ORDER = ["chronos2_wind", "lightgbm_wind", "week_average"];

// The newest forecast: tomorrow's if it has been saved, otherwise the newest in the build.
const newest = (() => {
  const built = liveMeta.forecasts.at(-1);
  if (fetched && (!built || fetched.info.day > built.day)) return {info: fetched.info, rows: fetched.rows};
  if (!built) return null;
  return {info: built, rows: liveHalfhours.filter((d) => isoDay(d.day) === built.day)};
})();

// The price each half-hour turned out to be: SEMO's, or ENTSO-E's hour until SEMO publishes.
const semo = new Map(liveHalfhours.filter((d) => d.actual != null).map((d) => [+d.timestamp_utc, d.actual]));
const entsoe = new Map(ahead.map((d) => [+d.timestamp_utc, d.price]));
const resultOf = (t) => semo.get(+t) ?? entsoe.get(+t - (t.getUTCMinutes() === 30 ? 18e5 : 0)) ?? null;
const newestRows = newest ? newest.rows.map((d) => ({...d, actual: resultOf(d.timestamp_utc)})) : [];
const resultFrom = newestRows.length && newestRows.every((d) => semo.has(+d.timestamp_utc))
  ? "semo"
  : newestRows.some((d) => d.actual != null) ? "entsoe" : null;

const missOf = (day, method) => liveDays.find((d) => isoDay(d.day) === day && d.method === method)?.mae;
const STATUS = {
  scored: "Scored",
  waiting: "Waiting for SEMO",
  late: "Late: not counted",
  incomplete: "A method gave no forecast: not counted"
};
// Made without a wind forecast (none was published in time): the wind models are empty.
const noWind = (f) => f.wind_forecast_published_utc == null;
// Every forecast, newest first, with tomorrow's on top once it is saved.
const record = [
  ...(fetched && !liveMeta.forecasts.some((f) => f.day === fetched.info.day) ? [{...fetched.info, status: "auction"}] : []),
  ...liveMeta.forecasts.slice().reverse()
].map((f) => ({
  day: asDay(f.day),
  made: new Date(f.made_at_utc),
  in_time: f.in_time,
  can_count: f.in_time && !noWind(f),
  // A late forecast says so straight away, not only once it is scored.
  status: !f.in_time && f.status !== "late"
    ? "Late: won't count"
    : noWind(f) && f.status !== "late"
    ? `No wind forecast: ${f.status === "incomplete" ? "not counted" : "won't count"}`
    : f.status === "auction" ? "Waiting for the auction" : STATUS[f.status],
  ...Object.fromEntries(LIVE_ORDER.map((m) => [m, missOf(f.day, m)])),
  link: f.day
}));
const counted = liveMeta.days_counted;
const firstInTime = record.filter((f) => f.can_count).at(-1);
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

```js
// The live record's three cards.
const newestCard = newest ? html`<div class="card">
    <div class="card-head">
      <span class="label">${[relativeDay(newest.info.day), longDay(asDay(newest.info.day))].filter(Boolean).join(", ")}</span>
      <span class="label">Made ${irishClock(new Date(newest.info.made_at_utc))} Irish time, ${newest.info.in_time ? "before" : "after"} the ${irishClock(new Date(newest.info.cutoff_utc))} cut-off · <a href=${savedAt(newest.info.day)}>when it was saved</a></span>
    </div>
    ${resize((width) =>
      Plot.plot({
        width,
        height: 280,
        marginLeft: 42,
        style: plotStyle,
        x: {type: "utc", label: null, tickFormat: (t) => irishClock(t)},
        y: {label: null, grid: true},
        marks: [
          Plot.areaY(newestRows, {x: "timestamp_utc", y1: "chronos2_wind_low", y2: "chronos2_wind_high", fill: COLOURS.price, fillOpacity: 0.15, curve: "step-after"}),
          ...LIVE_ORDER.map((m) => Plot.lineY(newestRows, {x: "timestamp_utc", y: m, stroke: METHOD_COLOURS[m], strokeWidth: m === "chronos2_wind" ? 2 : 1.4, strokeDasharray: m === "week_average" ? "3,3" : null, curve: "step-after"})),
          Plot.lineY(newestRows, {x: "timestamp_utc", y: "actual", stroke: "var(--ink)", strokeWidth: 1.6, curve: "step-after"}),
          Plot.tip(newestRows, Plot.pointerX({x: "timestamp_utc", y: (d) => d.chronos2_wind ?? d.week_average, title: (d) => [irishTime(d.timestamp_utc), d.actual != null ? `Result ${eurMwh(d.actual)}` : null, `${label("chronos2_wind")} ${eurMwh(d.chronos2_wind)} (80%: ${eurMwh(d.chronos2_wind_low)} to ${eurMwh(d.chronos2_wind_high)})`, `${label("lightgbm_wind")} ${eurMwh(d.lightgbm_wind)}`, `${label("week_average")} ${eurMwh(d.week_average)}`, `${label("yesterday")} ${eurMwh(d.yesterday)}`].filter(Boolean).join("\n")}))
        ]
      })
    )}
    <p class="label" style="margin-top: 0.4rem;">${resultFrom ? html`<span>${key("var(--ink)")}Result${resultFrom === "entsoe" ? ", hourly from ENTSO-E" : ""}</span>` : ""}${LIVE_ORDER.map((m) => html`<span>${key(METHOD_COLOURS[m])}${label(m)}${resultFrom === "semo" ? `: missed by ${eurMwh(missOf(newest.info.day, m))}` : ""}</span>`)}</p>
    <p class="muted" style="margin-top: 0.4rem;">${resultFrom === "semo"
      ? "Scored against SEMO's half-hourly prices."
      : resultFrom === "entsoe"
      ? "The auction result is in: hourly prices from ENTSO-E for now. The day is scored once SEMO publishes its half-hours, the morning after."
      : "The day-ahead auction closes at 11:00 Irish time; the result is drawn in once the site has it, and the day is scored once SEMO publishes its half-hours, the morning after."} ${noWind(newest.info)
      ? "No wind forecast for this day had been published by the cut-off, so the two wind models gave no forecast and the day won't count; the 7-day average is still shown."
      : `Shaded: Chronos-2's 80% range. Wind forecast used: EirGrid's, published ${irishTime(new Date(newest.info.wind_forecast_published_utc))}.`}</p>
  </div>` : html`<div class="card"><p class="muted" style="margin: 0;">The first forecast is saved overnight, before the 09:00 UTC cut-off, for the next day.</p></div>`;

const scoreCard = html`<div class="card" style="margin-top: 0.75rem;">
    <div class="card-head"><span class="label">The score so far</span><span class="label">${counted ? `${counted} day${counted === 1 ? "" : "s"}, ${shortDay(asDay(liveMeta.first_counted))} to ${shortDay(asDay(liveMeta.last_counted))}` : "no days yet"}</span></div>
    ${counted ? Inputs.table(liveScores, {
      columns: ["method", "MAE", "inside_range", "days_beaten"],
      header: {method: "Method", MAE: "Average miss", inside_range: "Inside 80% range", days_beaten: `Days better than the ${label(liveMeta.bar).toLowerCase()}`},
      format: {method: label, MAE: eurMwh, inside_range: (v) => (v == null ? "" : percent(v * 100)), days_beaten: (v) => (v == null ? "" : `${v} of ${counted}`)},
      layout: "auto",
      select: false
    }) : html`<p class="muted" style="margin: 0;">${firstInTime ? `The first day forecast in time, ${longDay(firstInTime.day)}, is scored once SEMO publishes its prices, the morning after.` : "Nothing to score yet: no forecast so far was made in time with every method."}</p>`}
    ${counted && counted < liveMeta.too_few_days ? html`<p class="muted" style="margin-top: 0.5rem;">Only ${counted} day${counted === 1 ? "" : "s"}: too few to judge yet. The back-tests below cover ${meta.wind.days}. Scored the same way: the average miss over the same half-hours for every method.</p>` : ""}
  </div>`;

const recordCard = record.length ? html`<div class="card" style="margin-top: 0.75rem;">
    <div class="card-head"><span class="label">Every forecast</span><span class="label">Average miss, €/MWh</span></div>
    ${Inputs.table(record, {
      columns: ["day", "made", "status", ...LIVE_ORDER, "link"],
      header: {day: "Day", made: "Made (Irish time)", status: "", chronos2_wind: "Chronos-2", lightgbm_wind: "LightGBM", week_average: "7-day average", link: ""},
      format: {
        day: (d) => d3.utcFormat("%a %-d %b")(d),
        made: (d) => irishTime(d),
        chronos2_wind: eurMwh,
        lightgbm_wind: eurMwh,
        week_average: eurMwh,
        link: (day) => html`<a href=${savedAt(day)}>saved</a>`
      },
      layout: "auto",
      select: false
    })}
  </div>` : "";
```

<div class="section first">
  <div class="section-head"><h2>The live record</h2><p>Every night, before the 09:00 UTC cut-off, the next day's forecast is saved to <a href="https://github.com/Nabel7/isem-live-forecasts">a public repository</a>, where it can't be changed afterwards: each commit shows when it was saved. Each day is scored against SEMO's prices once SEMO publishes them, the morning after.</p></div>

${newestCard}

${scoreCard}

${recordCard}
</div>

<div class="section">
  <div class="section-head"><h2>The back-tests</h2><p>Days already past, each forecast afresh as if on the morning before its auction, seeing only what was known by then.</p></div>
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
      <li><strong>The back-tests are updated by hand</strong>; the live record every day. Not trading advice.</li>
    </ul>
  </div>
  <p class="muted" style="margin-top: 0.6rem;">Prices: SEMOpx day-ahead results, via SEMO. Wind forecasts: EirGrid's per-farm forecasts (SEMO report BM-012), added up for the island. Download: ${html`<a href=${FileAttachment("data/prices/halfhours.csv").href} download>every half-hour of the wind test</a>`} · ${html`<a href=${FileAttachment("data/prices/scores.csv").href} download>scores</a>`} · ${html`<a href=${FileAttachment("data/prices/monthly.csv").href} download>by month</a>`}</p>
</div>
