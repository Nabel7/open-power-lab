---
title: Dispatch-down since 2016
---

```js
import "../../components/shell.js";
import {COLOURS, REGION_NAMES, percent, gwh, key, plotStyle} from "../../components/format.js";

const monthlyRaw = FileAttachment("data/history_monthly.csv").csv({typed: true});
const yearly = FileAttachment("data/history_yearly.csv").csv({typed: true});
const season = FileAttachment("data/history_season.csv").csv({typed: true});
const meta = FileAttachment("data/history_meta.json").json();
const tracker = FileAttachment("data/monthly.csv").csv({typed: true});
```

```js
// "2016-01" may arrive as a date or as text, depending on how the file is read.
const asMonth = (m) => (m instanceof Date ? m : new Date(`${m}-01T00:00:00Z`));
const monthly = monthlyRaw.map((d) => ({...d, month: asMonth(d.month)}));
const monthLabel = d3.utcFormat("%B %Y");
const shortLabel = d3.utcFormat("%b %Y");
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const signed = (v, digits = 0) => {
  const rounded = Math.abs(v).toFixed(digits);
  return +rounded === 0 ? `${rounded}%` : `${v >= 0 ? "+" : "−"}${rounded}%`;
};

// Colours on this page: reported in dark grey, weather-adjusted in purple.
const REPORTED = "var(--ink-muted)";
const ADJUSTED = "var(--price)";
```

```js
const regionInput = Inputs.radio(["ALL", "ROI", "NI"], {value: "ALL", format: (d) => REGION_NAMES[d]});
regionInput.classList.add("segmented");
const region = Generators.input(regionInput);
```

```js
// The chosen region's months, each with its 12-month averages: energy lost over energy
// available, and the adjusted share weighted by the energy normal wind would have given.
const months = monthly.filter((d) => d.region === region);
const withRolling = months.map((d, i) => {
  if (i < 11) return {...d};
  const year = months.slice(i - 11, i + 1);
  return {
    ...d,
    reported12: (100 * d3.sum(year, (v) => v.lost_gwh)) / d3.sum(year, (v) => v.available_gwh),
    adjusted12: d3.sum(year, (v) => v.adjusted_pct * v.available_normal_gwh) / d3.sum(year, (v) => v.available_normal_gwh),
    wind12: 100 * (d3.mean(year, (v) => v.wind_cf) / d3.mean(year, (v) => v.normal_cf) - 1)
  };
});
const latest = withRolling.at(-1);
const years = yearly.filter((d) => d.region === region);
const firstYear = years[0];

// The same months this year and last, for a fair comparison of a part year.
const lastMonth = latest.month.getUTCMonth() + 1;
const thisYear = latest.month.getUTCFullYear();
const sameMonths = (year) => months.filter((d) => d.month.getUTCFullYear() === year && d.month.getUTCMonth() + 1 <= lastMonth);
const share = (rows) => (100 * d3.sum(rows, (d) => d.lost_gwh)) / d3.sum(rows, (d) => d.available_gwh);
const adjustedShare = (rows) => d3.sum(rows, (d) => d.adjusted_pct * d.available_normal_gwh) / d3.sum(rows, (d) => d.available_normal_gwh);
const windShare = (rows) => 100 * (d3.mean(rows, (d) => d.wind_cf) / d3.mean(rows, (d) => d.normal_cf) - 1);
const now = sameMonths(thisYear);
const before = sameMonths(thisYear - 1);
const span = lastMonth === 12 ? "the whole year" : `January to ${MONTH_NAMES[lastMonth - 1]}`;
const comparison = {
  reportedBefore: share(before),
  reportedNow: share(now),
  adjustedBefore: adjustedShare(before),
  adjustedNow: adjustedShare(now),
  windBefore: windShare(before),
  windNow: windShare(now)
};
const rise = comparison.reportedNow - comparison.reportedBefore;
const underlyingRise = comparison.adjustedNow - comparison.adjustedBefore;
// How much of a rise the weather accounts for, when there was a rise to explain.
const fromWind = rise > 0 ? (100 * (rise - underlyingRise)) / rise : null;
const windStory =
  `The wind went from ${signed(comparison.windBefore)} to ${signed(comparison.windNow)} on normal. ` +
  (fromWind == null
    ? "Reported dispatch-down didn't rise."
    : fromWind >= 100
      ? `The weather-adjusted figure didn't rise, so the whole ${rise.toFixed(1)}-point rise is the weather.`
      : fromWind <= 0
        ? `None of the ${rise.toFixed(1)}-point rise is the weather.`
        : `About ${d3.format(".0f")(fromWind)}% of the ${rise.toFixed(1)}-point rise is the weather.`);
```

<div class="page-head">
  <p class="crumbs">Generation / Dispatch-down / Since 2016</p>
  <h1>Ten years of wind turned down</h1>
  <p class="lede">EirGrid's own monthly figures since 2016, with a weather adjustment: what each month would have been with normal wind for the time of year. Windy months lose a bigger share, so a windy year makes things look worse than they are, and a calm one hides a real rise.</p>
  <div class="meta">
    <span>Source: ${meta.workbook}, January 2016 to ${monthLabel(latest.month)}</span>
    <span>Wind only, solar left out</span>
    <span>Weather: ERA5 wind at 100 m</span>
  </div>
</div>

<div class="toolbar">${regionInput}</div>

<div class="stats">
  <div class="stat">
    <span class="label">Last 12 months, reported</span>
    <span class="value">${percent(latest.reported12)}</span>
    <span class="sub">Of the wind energy available, to ${shortLabel(latest.month)}</span>
  </div>
  <div class="stat">
    <span class="label">Last 12 months, weather-adjusted</span>
    <span class="value" style="color: ${ADJUSTED};">${percent(latest.adjusted12)}</span>
    <span class="sub">With normal wind for each month</span>
  </div>
  <div class="stat">
    <span class="label">Wind in the last 12 months</span>
    <span class="value">${signed(latest.wind12)}</span>
    <span class="sub">${latest.wind12 >= 0 ? "Windier" : "Calmer"} than normal at the island's wind farms</span>
  </div>
  <div class="stat">
    <span class="label">In ${firstYear.year}</span>
    <span class="value">${percent(firstYear.reported_pct)}</span>
    <span class="sub">${gwh(firstYear.lost_gwh * 1000)} lost, against ${gwh(years.find((d) => d.year === thisYear - 1)?.lost_gwh * 1000)} in ${thisYear - 1}</span>
  </div>
</div>

<div class="card">
  <div class="card-head">
    <span class="label">Share of available wind energy turned down, ${REGION_NAMES[region].toLowerCase()}</span>
    <span class="label"><span>${key(REPORTED)}Reported, 12-month average</span> <span>${key(ADJUSTED)}Weather-adjusted</span> <span>${key("var(--line-strong)")}Each month</span></span>
  </div>
  ${resize((width) =>
    Plot.plot({
      width,
      height: 320,
      marginLeft: 36,
      style: plotStyle,
      x: {type: "utc", label: null},
      y: {label: null, grid: true, tickFormat: (v) => `${v}%`},
      marks: [
        Plot.rectY(months, {x: "month", interval: "month", y: "reported_pct", fill: "var(--line-strong)", fillOpacity: 0.55, inset: width < 640 ? 0 : 0.5}),
        Plot.lineY(withRolling, {x: "month", y: "reported12", stroke: REPORTED, strokeWidth: 2}),
        Plot.lineY(withRolling, {x: "month", y: "adjusted12", stroke: ADJUSTED, strokeWidth: 2.25}),
        Plot.ruleY([0], {stroke: "var(--line-strong)"}),
        Plot.tip(withRolling, Plot.pointerX({
          x: "month",
          y: (d) => d.reported12 ?? d.reported_pct,
          title: (d) => [
            monthLabel(d.month),
            `This month: ${percent(d.reported_pct)} reported, ${percent(d.adjusted_pct)} adjusted`,
            `Wind ${signed(d.wind_vs_normal_pct)} on normal`,
            d.reported12 != null ? `12 months to here: ${percent(d.reported12)} reported, ${percent(d.adjusted12)} adjusted` : null
          ].filter(Boolean).join("\n")
        }))
      ]
    })
  )}
  <p class="muted" style="margin-top: 0.5rem;">The grey bars are single months; the lines are averages over the 12 months to each point, so seasons don't swamp the trend. When the purple line is below the grey one, the wind was stronger than normal.</p>
</div>

<div class="card" style="margin-top: 0.75rem;">
  <div class="card-head">
    <span class="label">How windy each month was, against normal for the time of year</span>
    <span class="label"><span>${key(COLOURS.wind)}Windier</span> <span>${key("var(--ink-faint)")}Calmer</span></span>
  </div>
  ${resize((width) =>
    Plot.plot({
      width,
      height: 140,
      marginLeft: 36,
      style: plotStyle,
      x: {type: "utc", label: null},
      y: {label: null, grid: true, tickFormat: (v) => `${v > 0 ? "+" : ""}${v}%`},
      marks: [
        Plot.rectY(months, {x: "month", interval: "month", y: "wind_vs_normal_pct", fill: (d) => (d.wind_vs_normal_pct >= 0 ? COLOURS.wind : "var(--ink-faint)"), fillOpacity: 0.8, inset: width < 640 ? 0 : 0.5}),
        Plot.ruleY([0], {stroke: "var(--line-strong)"}),
        Plot.tip(months, Plot.pointerX({x: "month", y: "wind_vs_normal_pct", title: (d) => `${monthLabel(d.month)}\nWind ${signed(d.wind_vs_normal_pct)} on normal\nCapacity factor ${d.wind_cf.toFixed(0)}% (normal ${d.normal_cf.toFixed(0)}%)`}))
      ]
    })
  )}
</div>

<div class="section">
  <div class="section-head">
    <div>
      <h2>What the adjustment shows</h2>
      <p>${REGION_NAMES[region]}, from EirGrid's figures.</p>
    </div>
  </div>
  <div class="grid grid-cols-3">
    <div class="card">
      <p class="label">${span}, ${thisYear - 1} → ${thisYear}</p>
      <p style="font-size: 1.05rem; line-height: 1.45; margin: 0.4rem 0;">Reported <strong>${percent(comparison.reportedBefore)} → ${percent(comparison.reportedNow)}</strong><br>Adjusted <strong style="color: ${ADJUSTED};">${percent(comparison.adjustedBefore)} → ${percent(comparison.adjustedNow)}</strong></p>
      <p class="muted">${windStory}</p>
    </div>
    <div class="card">
      <p class="label">The underlying level</p>
      <p style="font-size: 1.05rem; line-height: 1.45; margin: 0.4rem 0;">${years.filter((d) => d.year >= thisYear - 3).map((d) => html`<span>${d.year}${d.months < 12 ? "*" : ""} <strong style="color: ${ADJUSTED};">${percent(d.adjusted_pct)}</strong></span>`).reduce((a, b) => html`${a} · ${b}`)}</p>
      <p class="muted">Weather-adjusted, whole years. ${years.find((d) => d.year === 2021) ? `In 2021 it was ${percent(years.find((d) => d.year === 2021).adjusted_pct)}.` : ""} ${years.at(-1).months < 12 ? `*${thisYear} so far.` : ""}</p>
    </div>
    <div class="card">
      <p class="label">The same wind, a different season</p>
      <p style="font-size: 1.05rem; line-height: 1.45; margin: 0.4rem 0;">January <strong>${percent(season[0].constraint_pct + season[0].curtailment_pct)}</strong> · July <strong>${percent(season[6].constraint_pct + season[6].curtailment_pct)}</strong></p>
      <p class="muted">The share expected to be turned down at the same wind (a ${meta.season_wind_cf_pct}% capacity factor), at ${meta.season_level_year}'s level. All-island. Mostly constraint: see the chart below.</p>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-head">
    <div>
      <h2>Year by year</h2>
      <p>Bars: reported, split by reason. Marks: weather-adjusted.</p>
    </div>
    <span class="label"><span>${key(COLOURS.constraint)}Constraint</span> <span>${key(COLOURS.curtailment)}Curtailment</span> <span>${key(ADJUSTED)}Adjusted</span></span>
  </div>
  <div class="card">
    ${resize((width) =>
      Plot.plot({
        width,
        height: 260,
        marginLeft: 36,
        style: plotStyle,
        x: {label: null, tickFormat: (y) => (years.find((d) => d.year === y)?.months < 12 ? `${y}*` : `${y}`), padding: 0.25},
        y: {label: null, grid: true, tickFormat: (v) => `${v}%`},
        color: {domain: ["Constraint", "Curtailment"], range: [COLOURS.constraint, COLOURS.curtailment]},
        marks: [
          Plot.barY(
            years.flatMap((d) => [
              {year: d.year, reason: "Constraint", pct: d.constraint_pct},
              {year: d.year, reason: "Curtailment", pct: d.curtailment_pct}
            ]),
            {x: "year", y: "pct", fill: "reason", tip: {format: {y: (v) => `${v.toFixed(1)}%`, x: (y) => `${y}`}}}
          ),
          Plot.tickY(years, {x: "year", y: "adjusted_pct", stroke: ADJUSTED, strokeWidth: 3}),
          Plot.ruleY([0], {stroke: "var(--line-strong)"})
        ]
      })
    )}
    <p class="muted" style="margin-top: 0.5rem;">${years.at(-1).months < 12 ? `*${thisYear} is January to ${MONTH_NAMES[lastMonth - 1]} only, so it isn't comparable with whole years: compare the same months instead, above. ` : ""}Constraint means the local grid was full; curtailment, that the island as a whole couldn't take more wind. The two adjusted parts are fitted separately.</p>
  </div>
  <div class="card" style="margin-top: 0.75rem; padding: 0.4rem 0.9rem;">

```js
Inputs.table(years.slice().reverse(), {
  columns: ["year", "reported_pct", "adjusted_pct", "wind_vs_normal_pct", "constraint_pct", "curtailment_pct", "lost_gwh"],
  header: {year: "Year", reported_pct: "Reported", adjusted_pct: "Weather-adjusted", wind_vs_normal_pct: "Wind vs normal", constraint_pct: "Constraint", curtailment_pct: "Curtailment", lost_gwh: "Energy lost"},
  format: {
    year: (y) => (years.find((d) => d.year === y).months < 12 ? `${y} (${years.find((d) => d.year === y).months} months)` : `${y}`),
    reported_pct: percent,
    adjusted_pct: percent,
    wind_vs_normal_pct: (v) => signed(v),
    constraint_pct: percent,
    curtailment_pct: percent,
    lost_gwh: (v) => gwh(v * 1000)
  },
  layout: "auto",
  select: false,
  rows: 12
})
```

  </div>
</div>

<div class="section">
  <div class="section-head">
    <div>
      <h2>Why summer loses more of the same wind</h2>
      <p>All-island. Winter is windier, but at the same wind, far more is turned down in summer.</p>
    </div>
  </div>
  <div class="grid grid-cols-2">
    <div class="card">
      <div class="card-head"><span class="label">Normal wind by month</span><span class="label">Capacity factor, ERA5 2000–2025</span></div>
      ${resize((width) =>
        Plot.plot({
          width,
          height: 200,
          marginLeft: 36,
          style: plotStyle,
          x: {label: null, tickFormat: (m) => MONTH_NAMES[m - 1], padding: 0.2},
          y: {label: null, grid: true, tickFormat: (v) => `${v}%`},
          marks: [
            Plot.barY(season, {x: "month", y: "normal_cf", fill: COLOURS.wind, fillOpacity: 0.8, tip: {format: {x: (m) => MONTH_NAMES[m - 1], y: (v) => `${v.toFixed(0)}%`}}}),
            Plot.ruleY([0], {stroke: "var(--line-strong)"})
          ]
        })
      )}
    </div>
    <div class="card">
      <div class="card-head"><span class="label">Share turned down at the same wind</span><span class="label">${meta.season_wind_cf_pct}% capacity factor, ${meta.season_level_year} level</span></div>
      ${resize((width) =>
        Plot.plot({
          width,
          height: 200,
          marginLeft: 36,
          style: plotStyle,
          x: {label: null, tickFormat: (m) => MONTH_NAMES[m - 1], padding: 0.2},
          y: {label: null, grid: true, tickFormat: (v) => `${v}%`},
          color: {domain: ["Constraint", "Curtailment"], range: [COLOURS.constraint, COLOURS.curtailment]},
          marks: [
            Plot.barY(
              season.flatMap((d) => [
                {month: d.month, reason: "Constraint", pct: d.constraint_pct},
                {month: d.month, reason: "Curtailment", pct: d.curtailment_pct}
              ]),
              {x: "month", y: "pct", fill: "reason", tip: {format: {x: (m) => MONTH_NAMES[m - 1], y: (v) => `${v.toFixed(1)}%`}}}
            ),
            Plot.ruleY([0], {stroke: "var(--line-strong)"})
          ]
        })
      )}
    </div>
  </div>
  <p class="muted" style="margin-top: 0.75rem;">This page doesn't test why. Lower demand in summer, and grid lines taken out for maintenance in the summer months, are the obvious candidates.</p>
</div>

```js
// This site's own estimate for the latest month, from SEMO's data, beside EirGrid's.
const ours = tracker.find((d) => d.region === region && d.month.getTime() === latest.month.getTime());
```

<div class="note" style="margin-top: 2rem;">

**This page and the monthly tracker.** This page uses EirGrid's published figures, which come out about six weeks after each month. The [monthly pages](./) estimate the latest months sooner, from SEMO's market data, and run higher: ${ours ? html`for ${monthLabel(latest.month)}, ${percent(ours.dispatch_down_pct)} against EirGrid's ${percent(latest.reported_pct)}` : "they count the energy available differently"}. Where they differ, EirGrid's figure is the official one.

**How the adjustment works.** First, a wind index: hourly ERA5 wind at 100 m at 12 points weighted by where the wind farms are, turned into output with a typical turbine's power curve, giving each month's capacity factor. It uses no EirGrid data. "Normal" is the average for that calendar month over 2000–2025. Then, for constraint and curtailment separately, a model of the share turned down against the month's wind, with an allowance for each year and each calendar month. In plain terms: within the same year and season, how much more is cut when a month is windier? Each month is then moved along that curve from its actual wind to normal wind, keeping everything the wind didn't explain. Whole years are weighted by the energy normal wind would have given.

**How far to trust it.** Within each year and season, the wind explains about ${meta.wind_explains_pct}% of the month-to-month variation; a single month typically misses the fit by about ${meta.typical_monthly_miss_pts} points. The wind index tracks EirGrid's own availability figures closely (a correlation of 0.97, once fleet growth and season are removed). Shuffling the wind between years 2,000 times never produced an effect as strong as the real one. "Underlying" means everything except the wind (grid, fleet, demand, interconnectors, operating rules), and this doesn't separate those. The adjustment assumes a windy month has the same proportional effect every year; if the effect is growing, older years are slightly over- or under-adjusted.

**Sources.** Dispatch-down: ${html`<a href=${meta.workbook_url}>${meta.workbook}</a>`}, sheet "Wind & Solar Monthly Detailed", wind only. Weather: ERA5 reanalysis (Copernicus Climate Change Service) via [Open-Meteo](https://open-meteo.com/), CC BY 4.0. The code is in this site's repository (`scripts/export_history.py`).

</div>
