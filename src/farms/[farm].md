---
title: Wind farm
---

<style>
.unit-list { margin: 0; padding: 0; list-style: none; }
.unit-list li { padding: 0.35rem 0; border-top: 1px solid var(--border); font-size: 14px; }
.unit-list li:first-child { border-top: none; }
.unit-list code { font-size: 12.5px; color: var(--ink-faint); }
.farm-map { height: 240px; border-radius: 10px; overflow: hidden; margin-top: 0.75rem; }
.dark-tiles .leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(0.85) contrast(0.9); }
.crumbs { margin: 0 0 1rem; font-size: 14px; }
</style>

```js
import "../components/nav.js";
import {COLOURS, REGION_NAMES, monthName, dayName, percent, energy, euros, shareDown} from "../components/format.js";

const farm = FileAttachment(`../data/farms/${observable.params.farm}.json`).json();
const farmList = FileAttachment("../data/farms.csv").csv({typed: true});
```

```js
// The browser tab shows the farm's name.
document.title = `${farm.name} | Irish Wind Dispatch-Down Tracker`;

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
const key = (colour) => html`<span style="color: ${colour}">■</span>`;
const ordinal = (n) => {
  const ending = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({1: "st", 2: "nd", 3: "rd"}[n % 10] ?? "th");
  return `${n}${ending}`;
};
```

<p class="crumbs"><a href="./">← All farms</a></p>

<p class="eyebrow">${farm.technology === "solar" ? "Solar farm" : "Wind farm"} · ${region}</p>

# ${farm.name}

<p class="lede">From ${period}, <strong>${percent(pct)}</strong> of the energy the ${farm.technology === "solar" ? "sun" : "wind"} allowed here was turned down: ${energy(lost)}, worth about ${euros(value)} at market prices. That's the ${rank === 1 ? "most" : `${ordinal(rank)} most`} of ${byFarm.length} farms.</p>

<div class="grid grid-cols-4" style="margin-top: 2rem;">
  <div class="card">
    <h2>Turned down</h2>
    <span class="big">${percent(pct)}</span>
    <p>of what the ${farm.technology === "solar" ? "sun" : "wind"} allowed</p>
  </div>
  <div class="card">
    <h2>Energy lost</h2>
    <span class="big">${energy(lost)}</span>
    <p>${energy(produced)} was produced</p>
  </div>
  <div class="card">
    <h2>Market value</h2>
    <span class="big">${euros(value)}</span>
    <p>The lost energy at day-ahead prices. Not the owners' loss</p>
  </div>
  <div class="card">
    <h2>Why it was lost</h2>
    <span class="big">${lost > 0 ? percent(100 * constraintShare) : "–"}</span>
    ${html`<div class="split">
      <span style="width: ${100 * constraintShare}%; background: ${COLOURS.constraint}"></span>
      <span style="width: ${100 * (1 - constraintShare)}%; background: ${COLOURS.curtailment}"></span>
    </div>`}
    <p>${key(COLOURS.constraint)} Constraint: local grid full<br>${key(COLOURS.curtailment)} Curtailment: too much for the island</p>
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

<div class="card chart" style="margin-top: 1rem;">
  <h2>The last two weeks</h2>
  <h3>Output against what the ${farm.technology === "solar" ? "sun" : "wind"} allowed, MW, half-hour by half-hour. Shaded: held down by the grid operator. Times are your local time.</h3>
  ${resize((width) =>
    Plot.plot({
      width,
      height: 300,
      marginLeft: 44,
      style: {fontFamily: "var(--sans-serif)", fontSize: "12px"},
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
        Plot.ruleY([0], {stroke: "var(--border)"}),
        Plot.tip(halfHours, Plot.pointerX({
          x: "time",
          y: "output",
          channels: {"Could make (MW)": "available", "Made (MW)": "output", Instruction: (d) => d.reason ?? "none"},
          format: {x: (t) => d3.timeFormat("%-d %b %H:%M")(t), y: false}
        }))
      ]
    })
  )}
  <p class="muted" style="margin-top: 0.5rem;">${key("var(--ink)")} Made &nbsp; ${key("var(--ink-faint)")} Could have made (SEMO availability) &nbsp; ${key(COLOURS.constraint)} Constraint on &nbsp; ${key(COLOURS.curtailment)} Curtailment on. The gap inside a shaded band is energy lost to dispatch-down.</p>
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
const reasonColour = {domain: ["Constraint", "Curtailment"], range: [COLOURS.constraint, COLOURS.curtailment], legend: true};
```

<div class="grid grid-cols-2" style="margin-top: 1rem;">
  <div class="card chart">
    <h2>Energy lost each day</h2>
    <h3>MWh, ${period}</h3>
    ${resize((width) =>
      Plot.plot({
        width,
        height: 260,
        marginLeft: 44,
        style: {fontFamily: "var(--sans-serif)", fontSize: "12px"},
        x: {type: "utc", label: null, tickFormat: dayName, ticks: Math.max(2, Math.floor(width / 90))},
        y: {label: null, grid: true},
        color: reasonColour,
        marks: [
          Plot.rectY(days, {
            x: "day", interval: "day", y: "mwh", fill: "reason", insetLeft: 1, insetRight: 1, rx: 1.5,
            tip: {format: {x: dayName, y: (v) => `${d3.format(",.0f")(v)} MWh`}}
          }),
          Plot.ruleY([0], {stroke: "var(--border)"})
        ]
      })
    )}
  </div>
  <div class="card chart">
    <h2>When in the day</h2>
    <h3>MWh lost by hour of day (Irish time), whole period</h3>
    ${resize((width) =>
      Plot.plot({
        width,
        height: 260,
        marginLeft: 44,
        style: {fontFamily: "var(--sans-serif)", fontSize: "12px"},
        x: {label: null, tickFormat: (h) => `${String(h).padStart(2, "0")}:00`, ticks: [0, 6, 12, 18]},
        y: {label: null, grid: true},
        color: reasonColour,
        marks: [
          Plot.barY(hours, {
            x: "hour", y: "mwh", fill: "reason", rx: 1.5,
            tip: {channels: {"Held down": (d) => percent(100 * d.held) + " of half-hours"}, format: {x: (h) => `${h}:00`, y: (v) => `${d3.format(",.0f")(v)} MWh`}}
          }),
          Plot.ruleY([0], {stroke: "var(--border)"})
        ]
      })
    )}
  </div>
</div>

## Month by month

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

<div class="grid grid-cols-2" style="margin-top: 2rem;">
  <div class="card">
    <h2>About this farm</h2>
    ${html`<ul class="unit-list">
      <li>Sold by ${farm.companies.length ? farm.companies.join(", ") : "unknown"}</li>
      ${farm.capacity_mw ? html`<li>About ${d3.format(",.0f")(farm.capacity_mw)} MW, according to OpenStreetMap</li>` : ""}
      ${farm.units.map((u) => html`<li>${u.semo_name || "No name in SEMO's lists"} <code>${u.unit}</code><br><span class="muted">${u.company} · ${energy(u.lost_mwh)} lost</span></li>`)}
    </ul>`}
    <p class="muted" style="margin-top: 0.75rem;">${farm.units.length > 1 ? "These market units are matched to the same farm (for example, its phases), so the figures above add them together." : "SEMO's market unit for this farm."} Names are SEMO's own.</p>
  </div>
  <div class="card">
    <h2>Where</h2>
    ${farmMap}
  </div>
</div>

```js
// A small map with just this farm, if we know where it is.
let farmMap = html`<p>Not placed on the map yet: SEMO's name for it didn't match a wind farm on OpenStreetMap.</p>`;
if (farm.lat != null) {
  const box = html`<div class="farm-map"></div>`;
  farmMap = html`${box}<p class="muted" style="margin-top: 0.5rem;">Position from OpenStreetMap, matched by name. <a href="../map">Open the full map</a></p>`;
  box.classList.toggle("dark-tiles", dark);
  const map = L.map(box, {scrollWheelZoom: false, attributionControl: true}).setView([farm.lat, farm.lon], 9);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 13
  }).addTo(map);
  L.circleMarker([farm.lat, farm.lon], {radius: 9, color: dark ? "#1a1a19" : "#fff", weight: 2, fillColor: COLOURS.curtailment, fillOpacity: 0.95}).addTo(map);
  requestAnimationFrame(() => map.invalidateSize());
  invalidation.then(() => map.remove());
}
```

<p class="muted">Figures are estimates from SEMO's public data. See <a href="../methods">Methods &amp; data</a>.</p>
