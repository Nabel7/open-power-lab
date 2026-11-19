---
title: EirGrid's wind forecast
---

```js
import "../components/shell.js";
import {COLOURS, mw, longDay, shortDay, monthName, irishTime, plotStyle, key, percent, asDay} from "../components/format.js";

const byHours = FileAttachment("data/wind-forecast/by_hours.csv").csv({typed: true});
const daily = FileAttachment("data/wind-forecast/daily.csv").csv({typed: true});
const monthly = FileAttachment("data/wind-forecast/monthly.csv").csv({typed: true});
const halfhours = FileAttachment("data/wind-forecast/halfhours.csv").csv({typed: true});
const meta = FileAttachment("data/wind-forecast/meta.json").json();
```

```js
// The forecast the auction had, and the latest one before each half-hour.
const AHEAD = COLOURS.wind;
const LATEST = "#7cc6d9";
const share = (x) => percent((100 * x) / meta.day_ahead.available_mw);
const days = [...daily].sort((a, b) => b.day - a.day);
const worst = d3.greatest(days, (d) => d.mae_mw);
```

```js
const dayInput = Inputs.select(days, {format: (d) => `${d3.utcFormat("%a %-d %b %Y")(d.day)}  ·  missed by ${mw(d.mae_mw)}`, value: days[0]});
const chosen = Generators.input(dayInput);

// A shortcut to the day the day-ahead forecast missed by most.
const worstButton = html`<button type="button" class="text-button">Show its worst day</button>`;
worstButton.onclick = () => {
  dayInput.value = worst;
  dayInput.dispatchEvent(new Event("input", {bubbles: true}));
};
```

```js
const theDay = halfhours.filter((d) => +d.day === +chosen.day);
```

<div class="page-head">
  <p class="crumbs">Forecasts / EirGrid's wind forecast</p>
  <h1>How good is EirGrid's wind forecast?</h1>
  <p class="lede">EirGrid forecasts every wind farm's output about four times a day, up to four days ahead, and the market trades on it. Every version since August is kept here and scored against what the farms could have produced. The forecast the market had before the day-ahead auction missed by <strong>${mw(meta.day_ahead.mae_mw)}</strong> on average: about ${share(meta.day_ahead.mae_mw)} of the wind available.</p>
  <div class="meta">
    <span>${meta.days} trading days, ${longDay(asDay(meta.first_day))} to ${longDay(asDay(meta.last_day))}</span>
    <span>The market's ${meta.farms} wind farms</span>
    <span>Source: EirGrid's per-farm forecasts and SEMO's availability (reports BM-012, BM-101)</span>
  </div>
</div>

<div class="stats">
  <div class="stat">
    <span class="label">The day-ahead forecast</span>
    <span class="value accent">${mw(meta.day_ahead.mae_mw)}</span>
    <span class="sub">Average miss, ${share(meta.day_ahead.mae_mw)} of the wind available. What the auction had</span>
  </div>
  <div class="stat">
    <span class="label">The latest forecast</span>
    <span class="value">${mw(meta.latest.mae_mw)}</span>
    <span class="sub">The newest before each half-hour, typically ${meta.latest.median_hours_ahead} hours ahead</span>
  </div>
  <div class="stat">
    <span class="label">Bias, day-ahead</span>
    <span class="value">${meta.day_ahead.bias_mw > 0 ? "+" : ""}${mw(meta.day_ahead.bias_mw)}</span>
    <span class="sub">Forecast minus available, on average: close to none</span>
  </div>
  <div class="stat">
    <span class="label">Scored against output instead</span>
    <span class="value">${mw(meta.against_output.mae_mw)}</span>
    <span class="sub">It would seem ${mw(meta.against_output.bias_mw)} too high: that's dispatch-down, not the forecast</span>
  </div>
</div>

<div class="card">
  <div class="card-head"><span class="label">Average miss against hours ahead</span><span class="label">MW · every version, every half-hour · shaded: the hours the day-ahead auction's forecast covers</span></div>
  ${resize((width) =>
    Plot.plot({
      width,
      height: 280,
      marginLeft: 46,
      style: plotStyle,
      x: {label: "hours ahead", domain: [0, 96], ticks: d3.range(0, 97, 12)},
      y: {label: null, grid: true, domain: [0, d3.max(byHours, (d) => d.mae_mw) * 1.08]},
      marks: [
        Plot.rectX([{x1: meta.day_ahead.hours_ahead_min, x2: meta.day_ahead.hours_ahead_min + 24}], {x1: "x1", x2: "x2", fill: AHEAD, fillOpacity: 0.08}),
        Plot.lineY(byHours, {x: "hours_ahead", y: "mae_mw", stroke: AHEAD, strokeWidth: 2}),
        Plot.lineY(byHours, {x: "hours_ahead", y: (d) => Math.abs(d.bias_mw), stroke: "var(--ink-faint)", strokeDasharray: "3,3"}),
        Plot.ruleY([0], {stroke: "var(--line-strong)"}),
        Plot.tip(byHours, Plot.pointerX({x: "hours_ahead", y: "mae_mw", title: (d) => `${d.hours_ahead} to ${d.hours_ahead + 1} hours ahead\nAverage miss ${mw(d.mae_mw)} (${share(d.mae_mw)})\nBias ${d.bias_mw > 0 ? "+" : ""}${mw(d.bias_mw)}\n${d.half_hours.toLocaleString("en-IE")} half-hours`}))
      ]
    })
  )}
  <p class="label" style="margin-top: 0.4rem;"><span>${key(AHEAD)}Average miss</span><span>${key("var(--ink-faint)")}Size of the bias (dashed)</span></p>
  <p class="muted">The miss grows steadily with time: about ${mw(meta.mae_by_day_ahead["1"])} within a day, ${mw(meta.mae_by_day_ahead["2"])} on the second day, ${mw(meta.mae_by_day_ahead["3"])} on the third and ${mw(meta.mae_by_day_ahead["4"])} on the fourth. Weather forecasts lose skill with time, and the forecast follows.</p>
</div>

<div class="card" style="margin-top: 0.75rem;">
  <div class="card-head"><span class="label">One day</span><span class="label">MW, Irish time · shaded: available power the farms weren't allowed to produce</span></div>
  <div class="toolbar" style="margin: 0 0 0.5rem;">${dayInput}${worstButton}</div>
  ${resize((width) =>
    Plot.plot({
      width,
      height: 300,
      marginLeft: 46,
      style: plotStyle,
      x: {type: "utc", label: null, tickFormat: (t) => t.toLocaleTimeString("en-IE", {timeZone: "Europe/Dublin", hour: "2-digit", minute: "2-digit"})},
      y: {label: null, grid: true},
      marks: [
        Plot.areaY(theDay, {x: "timestamp_utc", y1: "output_mw", y2: "available_mw", fill: "var(--ink-faint)", fillOpacity: 0.15, curve: "step-after"}),
        Plot.lineY(theDay, {x: "timestamp_utc", y: "output_mw", stroke: "var(--ink-faint)", strokeWidth: 1.2, curve: "step-after"}),
        Plot.lineY(theDay, {x: "timestamp_utc", y: "available_mw", stroke: "var(--ink)", strokeWidth: 1.6, curve: "step-after"}),
        Plot.lineY(theDay, {x: "timestamp_utc", y: "latest_mw", stroke: LATEST, strokeWidth: 1.4, strokeDasharray: "4,3", curve: "step-after"}),
        Plot.lineY(theDay, {x: "timestamp_utc", y: "day_ahead_mw", stroke: AHEAD, strokeWidth: 2, curve: "step-after"}),
        Plot.ruleY([0], {stroke: "var(--line-strong)"}),
        Plot.tip(theDay, Plot.pointerX({x: "timestamp_utc", y: "available_mw", title: (d) => `${irishTime(d.timestamp_utc)}\nAvailable ${mw(d.available_mw)}\nProduced ${mw(d.output_mw)}\nDay-ahead forecast ${mw(d.day_ahead_mw)}\nLatest forecast ${mw(d.latest_mw)} (${d.latest_hours_ahead} h ahead)`}))
      ]
    })
  )}
  <p class="label" style="margin-top: 0.4rem;"><span>${key("var(--ink)")}Available</span><span>${key("var(--ink-faint)")}Produced</span><span>${key(AHEAD)}Day-ahead forecast: missed by ${mw(chosen.mae_mw)}</span><span>${key(LATEST)}Latest forecast: ${mw(chosen.latest_mae_mw)}</span></p>
  <p class="muted">The day-ahead forecast was published ${irishTime(chosen.day_ahead_published_utc)} (Irish time).</p>
</div>

<div class="card" style="margin-top: 0.75rem;">
  <div class="card-head"><span class="label">The day-ahead forecast's miss, day by day</span><span class="label">MW · bars: day-ahead · dots: latest</span></div>
  ${resize((width) =>
    Plot.plot({
      width,
      height: 220,
      marginLeft: 46,
      style: plotStyle,
      x: {type: "utc", label: null},
      y: {label: null, grid: true},
      marks: [
        Plot.rectY(daily, {x1: "day", x2: (d) => d3.utcDay.offset(d.day, 1), y: "mae_mw", fill: AHEAD, fillOpacity: 0.75, inset: 0.5}),
        Plot.dot(daily, {x: (d) => d3.utcHour.offset(d.day, 12), y: "latest_mae_mw", r: 2, fill: LATEST}),
        Plot.ruleX([d3.utcHour.offset(chosen.day, 12)], {stroke: "var(--line-strong)"}),
        Plot.ruleY([0], {stroke: "var(--line-strong)"}),
        Plot.tip(daily, Plot.pointerX({x: (d) => d3.utcHour.offset(d.day, 12), y: "mae_mw", title: (d) => `${longDay(d.day)}\nDay-ahead missed by ${mw(d.mae_mw)} (bias ${d.bias_mw > 0 ? "+" : ""}${mw(d.bias_mw)})\nLatest missed by ${mw(d.latest_mae_mw)}\nAvailable on average ${mw(d.available_mw)}`}))
      ]
    })
  )}
</div>

<div class="section">
  <div class="section-head"><h2>By month</h2></div>
  <div class="card table-scroll" style="padding: 0.4rem 0.9rem;">

```js
Inputs.table([...monthly].reverse(), {
  columns: ["month", "mae_mw", "bias_mw", "latest_mae_mw", "available_mw", "days"],
  header: {month: "Month", mae_mw: "Day-ahead miss", bias_mw: "Day-ahead bias", latest_mae_mw: "Latest miss", available_mw: "Available, on average", days: "Days"},
  format: {month: monthName, mae_mw: mw, bias_mw: (v) => `${v > 0 ? "+" : ""}${mw(v)}`, latest_mae_mw: mw, available_mw: mw},
  layout: "auto",
  select: false
})
```

  </div>
  <p class="muted" style="margin-top: 0.5rem;">A month at the edges may be partial; "Days" says how many it has. Calmer months have smaller misses in MW simply because there's less wind to get wrong.</p>
</div>

<div class="section">
  <div class="section-head"><h2>How it's scored</h2></div>
  <div class="steps">
    <div class="step">
      <span class="label"><span>1</span><span>Every version</span></span>
      <h3>Kept as published</h3>
      <p>SEMO publishes EirGrid's forecast for each wind farm about four times a day, and keeps it online for about 90 days. Every version has been saved since August 2026, with the time it came out.</p>
    </div>
    <div class="step">
      <span class="label"><span>2</span><span>The truth</span></span>
      <h3>What the farms could produce</h3>
      <p>Each forecast is compared with the farms' available power (SEMO's availability, checked against their output as for the dispatch-down figures), not with what they produced. Output is lower whenever the grid turns farms down, and that's not the forecast's mistake.</p>
    </div>
    <div class="step">
      <span class="label"><span>3</span><span>The auction's forecast</span></span>
      <h3>As it stood the day before</h3>
      <p>The day-ahead auction closes at 11:00 Irish time the day before. Its forecast is the newest version published by ${String(meta.cutoff_hour_utc).padStart(2, "0")}:00 UTC that morning, which covers the day ${meta.day_ahead.hours_ahead_min} to about ${Math.round(meta.day_ahead.hours_ahead_min + 24)} hours ahead.</p>
    </div>
    <div class="step">
      <span class="label"><span>4</span><span>Like with like</span></span>
      <h3>The same farms on both sides</h3>
      <p>Only farms with both a forecast and an availability figure are added up: the market's ${meta.farms} wind farms. Smaller farms outside the market have a forecast but no availability, so they're left out.</p>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-head"><h2>Read with care</h2></div>
  <div class="card">
    <ul style="margin: 0; padding-left: 1.1rem;">
      <li><strong>Availability is declared by the farms.</strong> It's checked against what they produce when free to run, but it is still the farms' own figure.</li>
      <li><strong>A short record.</strong> SEMO keeps its per-farm data online for only two or three months, so this starts in September 2026 and grows by a day each day.</li>
      <li><strong>Hours ahead may be an hour off in summer.</strong> SEMO's publish times aren't labelled with a time zone. That can move a version's hours ahead by an hour; it can't change what it forecast.</li>
      <li><strong>Gaps.</strong> When no version came out on the morning before (${meta.fallback_versions.map((d) => shortDay(asDay(d.day))).join(", ") || "never, so far"}), the newest earlier one is used.</li>
    </ul>
  </div>
  <p class="muted" style="margin-top: 0.6rem;">Updated daily. For how the price moves with this forecast, see <a href="./prices">Price forecasts</a>. Download: ${html`<a href=${FileAttachment("data/wind-forecast/halfhours.csv").href} download>every half-hour</a>`} · ${html`<a href=${FileAttachment("data/wind-forecast/by_hours.csv").href} download>by hours ahead</a>`} · ${html`<a href=${FileAttachment("data/wind-forecast/daily.csv").href} download>by day</a>`}</p>
</div>
