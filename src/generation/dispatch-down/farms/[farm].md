---
title: Wind farm
---

<style>
.unit-list { margin: 0; padding: 0; list-style: none; }
.unit-list li { padding: 0.55rem 0; border-top: 1px solid var(--line); font-size: 14px; max-width: none !important; }
.unit-list li:first-child { border-top: none; padding-top: 0; }
.unit-list code { font-size: 11.5px; color: var(--ink-faint); }
.farm-map { height: 240px; overflow: hidden; }
</style>

```js
import "../../../components/shell.js";
import {COLOURS, REGION_NAMES, monthName, dayName, percent, energy, euros, shareDown, key, reasonKey, plotStyle} from "../../../components/format.js";

const farm = FileAttachment(`../data/farms/${observable.params.farm}.json`).json();
const farmList = FileAttachment("../data/farms.csv").csv({typed: true});
```

```js
// The browser tab shows the farm's name.
document.title = `${farm.name} | Dispatch down | Open Power Lab`;

// Totals over everything we have for this farm.
const lost = d3.sum(farm.daily, (d) => d.lost_mwh);
const produced = d3.sum(farm.daily, (d) => d.produced_mwh);
const constraint = d3.sum(farm.daily, (d) => d.constraint_mwh);
const value = d3.sum(farm.daily, (d) => d.lost_value_eur);
const pct = shareDown(farm.daily);
const constraintShare = lost > 0 ? constraint / lost : 0;

// Where it ranks among all farms, by energy lost.
const byFarm = d3.rollups(farmList, (v) => d3.sum(v, (d) => d.lost_mwh), (d) => d.farm_id);
const rank = byFarm.sort((a, b) => d3.descending(a[1], b[1])).findIndex(([id]) => id === farm.id) + 1;

const region = farm.regions.map((r) => REGION_NAMES[r]).join(" and ");
const period = `${dayName(new Date(farm.first_day))} to ${dayName(new Date(farm.last_day))} ${farm.last_day.slice(0, 4)}`;
const ordinal = (n) => {
  const ending = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({1: "st", 2: "nd", 3: "rd"}[n % 10] ?? "th");
  return `${n}${ending}`;
};
```

<div class="page-head">
  <p class="crumbs"><a href="./">← All farms</a></p>
  <p class="eyebrow">${farm.technology === "solar" ? "Solar farm" : "Wind farm"} · ${region}</p>
  <h1>${farm.name}</h1>
  <p class="lede">From ${period}, <strong>${percent(pct)}</strong> of the energy the ${farm.technology === "solar" ? "sun" : "wind"} allowed here was turned down: ${energy(lost)}, worth about ${euros(value)} at market prices. That's the ${rank === 1 ? "most" : `${ordinal(rank)} most`} of ${byFarm.length} farms.</p>
</div>

<div class="stats">
  <div class="stat">
    <span class="label">Turned down</span>
    <span class="value accent">${percent(pct)}</span>
    <p>of what the ${farm.technology === "solar" ? "sun" : "wind"} allowed</p>
  </div>
  <div class="stat">
    <span class="label">Energy lost</span>
    <span class="value">${energy(lost)}</span>
    <p>${energy(produced)} was produced</p>
  </div>
  <div class="stat">
    <span class="label">Market value</span>
    <span class="value">${euros(value)}</span>
    <p>The lost energy at day-ahead prices. Not the owners' loss</p>
  </div>
  <div class="stat">
    <span class="label">Why it was lost</span>
    <span class="value">${lost > 0 ? percent(100 * constraintShare) : "–"}</span>
    ${html`<div class="split">
      <span style="width: ${100 * constraintShare}%; background: ${COLOURS.constraint}"></span>
      <span style="width: ${100 * (1 - constraintShare)}%; background: ${COLOURS.curtailment}"></span>
    </div>`}
    <p>${key(COLOURS.constraint)}Constraint: local grid full<br>${key(COLOURS.curtailment)}Curtailment: too much for the island</p>
  </div>
</div>

```js
// The last 14 days, half-hour by half-hour. Times come as a start plus a position.
const start = new Date(farm.recent.start);
const halfHours = farm.recent.output_mw.map((output, i) => ({
  time: new Date(+start + i * 30 * 60 * 1000),
  available: farm.recent.available_mw[i],
  output,
  reason: {C: "Constraint", U: "Curtailment"}[farm.recent.reason[i]] ?? null
}));
const heldDown = halfHours.filter((d) => d.reason);
const recentMax = d3.max(halfHours, (d) => d.available) || 1;
```

<div class="hatch" style="margin-top: clamp(2.5rem, 5vw, 4rem);"></div>

<div class="section">
<div class="section-head">
  <div>
    <p class="label" style="margin-bottom: 0.8rem;">01 / Half-hour by half-hour</p>
    <h2 class="section-title">The last two weeks</h2>
  </div>
  <span class="label" style="flex-wrap: wrap;"><span>${key("var(--ink)")}Made</span> <span>${key("var(--ink-faint)")}Could have made</span> <span>${key(COLOURS.constraint)}Constraint on</span> <span>${key(COLOURS.curtailment)}Curtailment on</span></span>
</div>
<div class="card">
  <div class="card-head"><span class="label">Output vs availability</span><span class="label">MW · your local time</span></div>
  ${resize((width) =>
    Plot.plot({
      width,
      height: 300,
      marginLeft: 40,
      style: plotStyle,
      x: {type: "utc", label: null},
      y: {label: null, grid: true, domain: [0, recentMax * 1.05]},
      color: {domain: ["Constraint", "Curtailment"], range: [COLOURS.constraint, COLOURS.curtailment]},
      marks: [
        // Background bands while a constraint or curtailment was on.
        Plot.rectY(heldDown, {
          x1: "time",
          x2: (d) => new Date(+d.time + 30 * 60 * 1000),
          y1: 0,
          y2: recentMax * 1.05,
          fill: "reason",
          fillOpacity: 0.14
        }),
        Plot.areaY(halfHours, {x: "time", y: "available", fill: "var(--ink-faint)", fillOpacity: 0.25, curve: "step-after"}),
        Plot.lineY(halfHours, {x: "time", y: "available", stroke: "var(--ink-faint)", strokeWidth: 1, curve: "step-after"}),
        Plot.lineY(halfHours, {x: "time", y: "output", stroke: "var(--ink)", strokeWidth: 1.5, curve: "step-after"}),
        Plot.ruleY([0], {stroke: "var(--line-strong)"}),
        Plot.tip(halfHours, Plot.pointerX({
          x: "time",
          y: "output",
          channels: {"Could make (MW)": "available", "Made (MW)": "output", Instruction: (d) => d.reason ?? "none"},
          format: {x: (t) => d3.timeFormat("%-d %b %H:%M")(t), y: false}
        }))
      ]
    })
  )}
  <p class="muted" style="margin-top: 0.75rem;">"Could have made" is SEMO's availability figure. The gap inside a shaded band is energy lost to dispatch down.</p>
</div>
</div>

```js
const days = farm.daily.flatMap((d) => [
  {day: new Date(d.day), reason: "Constraint", mwh: d.constraint_mwh},
  {day: new Date(d.day), reason: "Curtailment", mwh: d.curtailment_mwh}
]);
// Hour of day (Irish time), over the whole period.
const hours = d3
  .rollups(farm.hours, (v) => ({
    constraint: d3.sum(v, (d) => d.constraint_mwh),
    curtailment: d3.sum(v, (d) => d.curtailment_mwh),
    held: d3.sum(v, (d) => d.held_down_half_hours) / d3.sum(v, (d) => d.half_hours)
  }), (d) => d.hour)
  .flatMap(([hour, s]) => [
    {hour, reason: "Constraint", mwh: s.constraint, held: s.held},
    {hour, reason: "Curtailment", mwh: s.curtailment, held: s.held}
  ]);
const reasonColour = {domain: ["Constraint", "Curtailment"], range: [COLOURS.constraint, COLOURS.curtailment]};
```

<div class="section">
<div class="section-head">
  <div>
    <p class="label" style="margin-bottom: 0.8rem;">02 / The whole period</p>
    <h2 class="section-title">When it's held down</h2>
  </div>
  ${reasonKey()}
</div>
<div class="grid grid-cols-2">
  <div class="card">
    <div class="card-head"><span class="label">Energy lost each day</span><span class="label">MWh · ${period}</span></div>
    ${resize((width) =>
      Plot.plot({
        width,
        height: 260,
        marginLeft: 44,
        style: plotStyle,
        x: {type: "utc", label: null, tickFormat: dayName, ticks: Math.max(2, Math.floor(width / 90))},
        y: {label: null, grid: true},
        color: reasonColour,
        marks: [
          Plot.rectY(days, {
            x: "day", interval: "day", y: "mwh", fill: "reason", insetLeft: 1, insetRight: 1,
            tip: {format: {x: dayName, y: (v) => `${d3.format(",.0f")(v)} MWh`}}
          }),
          Plot.ruleY([0], {stroke: "var(--line-strong)"})
        ]
      })
    )}
  </div>
  <div class="card">
    <div class="card-head"><span class="label">When in the day</span><span class="label">MWh by hour · Irish time</span></div>
    ${resize((width) =>
      Plot.plot({
        width,
        height: 260,
        marginLeft: 44,
        style: plotStyle,
        x: {label: null, tickFormat: (h) => `${String(h).padStart(2, "0")}:00`, ticks: [0, 6, 12, 18]},
        y: {label: null, grid: true},
        color: reasonColour,
        marks: [
          Plot.barY(hours, {
            x: "hour", y: "mwh", fill: "reason",
            tip: {channels: {"Held down": (d) => percent(100 * d.held) + " of half-hours"}, format: {x: (h) => `${h}:00`, y: (v) => `${d3.format(",.0f")(v)} MWh`}}
          }),
          Plot.ruleY([0], {stroke: "var(--line-strong)"})
        ]
      })
    )}
  </div>
</div>

<div class="section">
<div class="section-head">
  <div>
    <p class="label" style="margin-bottom: 0.8rem;">03 / Month by month</p>
    <h2 class="section-title">The figures</h2>
  </div>
</div>
<div class="card" style="padding: 0.5rem 1rem;">

```js
Inputs.table(
  farm.monthly.map((d) => ({...d, month: new Date(d.month)})),
  {
    columns: ["month", "dispatch_down_pct", "lost_mwh", "constraint_mwh", "curtailment_mwh", "lost_value_eur", "produced_mwh"],
    header: {
      month: "Month",
      dispatch_down_pct: "Turned down",
      lost_mwh: "Lost",
      constraint_mwh: "Constraint",
      curtailment_mwh: "Curtailment",
      lost_value_eur: "Market value",
      produced_mwh: "Produced"
    },
    format: {
      month: monthName,
      dispatch_down_pct: percent,
      lost_mwh: energy,
      constraint_mwh: energy,
      curtailment_mwh: energy,
      lost_value_eur: euros,
      produced_mwh: energy
    },
    layout: "auto",
    select: false
  }
)
```

</div>
</div>

<div class="section">
<div class="grid grid-cols-2">
  <div class="card">
    <div class="card-head"><span class="label">About this farm</span></div>
    ${html`<ul class="unit-list">
      <li>Sold by ${farm.companies.length ? farm.companies.join(", ") : "unknown"}</li>
      ${farm.capacity_mw ? html`<li>About ${d3.format(",.0f")(farm.capacity_mw)} MW, according to OpenStreetMap</li>` : ""}
      ${farm.units.map((u) => html`<li>${u.semo_name || "No name in SEMO's lists"} <code>${u.unit}</code><br><span class="muted">${u.company} · ${energy(u.lost_mwh)} lost</span></li>`)}
    </ul>`}
    <p class="muted" style="margin-top: 0.75rem;">${farm.units.length > 1 ? "These market units are matched to the same farm (for example, its phases), so the figures above add them together." : "SEMO's market unit for this farm."} Names are SEMO's own.</p>
  </div>
  <div class="card">
    <div class="card-head"><span class="label">Where</span></div>
    ${farmMap}
  </div>
</div>
</div>

```js
// A small map with just this farm, if we know where it is.
let farmMap = html`<p>Not placed on the map yet: SEMO's name for it didn't match a wind farm on OpenStreetMap.</p>`;
if (farm.lat != null) {
  const box = html`<div class="farm-map"></div>`;
  farmMap = html`${box}<p class="muted" style="margin-top: 0.5rem;">Position from OpenStreetMap, matched by name. <a href="../map">Open the full map</a></p>`;
  const map = L.map(box, {scrollWheelZoom: false, attributionControl: true}).setView([farm.lat, farm.lon], 9);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 13
  }).addTo(map);
  L.circleMarker([farm.lat, farm.lon], {radius: 9, color: "#ffffff", weight: 2, fillColor: "#b88200", fillOpacity: 0.95}).addTo(map);
  requestAnimationFrame(() => map.invalidateSize());
  invalidation.then(() => map.remove());
}
```

<p class="muted">Figures are estimates from SEMO's public data. See <a href="../methods">Methods &amp; data</a>.</p>
