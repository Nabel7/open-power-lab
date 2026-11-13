---
title: Wind map
---

<style>
.wind-map { height: min(72vh, 640px); }
.wind-map .leaflet-image-layer { image-rendering: auto; }
.wind-arrow { color: rgb(16 20 24 / 0.55); font: 600 13px/1 var(--sans-serif); text-align: center; }
.wind-arrow span { display: inline-block; }
.time-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem 1.25rem; margin: 0 0 1rem; }
.time-bar .now { min-width: 11rem; font-weight: 600; font-variant-numeric: tabular-nums; }
.time-bar form { width: min(36rem, 100%) !important; }
.time-bar form > label,
.time-bar input[type="number"] { display: none; }
.play {
  height: 2.1rem; padding: 0 0.9rem; border: 1px solid var(--line-strong); border-radius: 7px;
  background: var(--surface); color: var(--ink); font: 500 13.5px var(--sans-serif); cursor: pointer;
}
.play:hover { border-color: var(--ink-faint); }
</style>

```js
import "../components/shell.js";
import {COLOURS, plotStyle, irishTime, escapeHtml} from "../components/format.js";
import {BOUNDS, COLUMNS, grid, windForecast, speedAt, windPicture} from "../components/weather.js";

const places = FileAttachment("../generation/dispatch-down/data/farm_locations.csv").csv({typed: true});
const farmList = FileAttachment("../generation/dispatch-down/data/farms.csv").csv({typed: true});
```

```js
// The forecast, fetched by your browser from Open-Meteo. If it can't be reached, say so.
const points = grid();
const forecast = await windForecast(points).catch((error) => ({error}));
```

```js
// Wind farms with a known position, one dot per farm (phases together).
const info = new Map(farmList.map((d) => [d.unit, d]));
const placedFarms = d3
  .groups(
    places.filter((d) => d.located_by && info.get(d.unit)?.technology !== "solar"),
    (d) => info.get(d.unit)?.farm_id ?? d.unit
  )
  .map(([id, rows]) => ({
    id,
    name: rows[0].farm_name,
    lat: rows[0].lat,
    lon: rows[0].lon,
    capacity: rows[0].capacity_mw || 0
  }));
const totalCapacity = d3.sum(placedFarms, (d) => d.capacity);

// Colours for wind speed: one hue, pale for calm to deep for strong (m/s at 100 m).
const colour = d3.scaleSequential([0, 25], d3.interpolateRgb("#eef7fb", "#0b3954")).clamp(true);
```

```js
// The hour shown: starts at the current hour, and a slider moves through the forecast.
const times = forecast.error ? [new Date()] : forecast.times;
const nowIndex = Math.max(0, d3.bisectLeft(times, new Date()) - 1);
const hourInput = Inputs.range([0, times.length - 1], {step: 1, value: nowIndex, label: "Hour"});
const hour = Generators.input(hourInput);

// Play: step through the hours, a little under twice a second, then stop at the end.
const playButton = html`<button class="play" type="button">▶ Play</button>`;
let playing = null;
const stop = () => {
  clearInterval(playing);
  playing = null;
  playButton.textContent = "▶ Play";
};
playButton.onclick = () => {
  if (playing) return stop();
  if (+hourInput.value >= times.length - 1) hourInput.value = 0;
  playButton.textContent = "❚❚ Pause";
  playing = setInterval(() => {
    const next = +hourInput.value + 1;
    if (next > times.length - 1) return stop();
    hourInput.value = next;
    hourInput.dispatchEvent(new Event("input", {bubbles: true}));
  }, 550);
};
invalidation.then(stop);
```

```js
// Every farm's wind speed, every hour, blended from the grid; and the capacity-weighted
// average over the farms, for the chart.
const atFarms = forecast.error
  ? []
  : times.map((time, h) => {
      const speeds = forecast.speed.map((s) => s[h]);
      const weighted = d3.sum(placedFarms, (f) => f.capacity * speedAt(f.lat, f.lon, speeds));
      return {time, speed: weighted / totalCapacity, max: d3.max(speeds)};
    });
const current = atFarms[hour];
```

<div class="page-head">
  <p class="crumbs">Forecasts / Wind map</p>
  <h1>Wind across the island</h1>
  <p class="lede">Forecast wind speed at 100 metres, about the height of a turbine's hub, hour by hour for the next three days, with the wind farms on top. Press play to watch the weather move.</p>
  <div class="meta">
    <span>Forecast: Open-Meteo, from national weather models</span>
    <span>Fetched by your browser${forecast.error ? "" : ` at ${irishTime(forecast.fetched)}`}</span>
    <span>Times are Irish time</span>
  </div>
</div>

${forecast.error
  ? html`<div class="note"><strong>The forecast couldn't be loaded.</strong> Open-Meteo didn't answer (${escapeHtml(String(forecast.error.message ?? forecast.error))}). It limits how often one visitor can ask, so please try again in a minute.</div>`
  : ""}

<div class="time-bar">
  ${playButton}
  <span class="now">${irishTime(times[hour])}</span>
  ${hourInput}
</div>

<div class="stats">
  <div class="stat">
    <span class="label">Average at the wind farms</span>
    <span class="value">${current ? current.speed.toFixed(1) : "–"}<small>m/s</small></span>
    <span class="sub">Weighted by each farm's size</span>
  </div>
  <div class="stat">
    <span class="label">Strongest on the map</span>
    <span class="value">${current ? current.max.toFixed(1) : "–"}<small>m/s</small></span>
    <span class="sub">Usually offshore or on high ground</span>
  </div>
  <div class="stat">
    <span class="label">Farms on the map</span>
    <span class="value">${placedFarms.length}</span>
    <span class="sub">${d3.format(",.0f")(totalCapacity)} MW with a known position</span>
  </div>
  <div class="stat">
    <span class="label">What turbines need</span>
    <span class="value" style="font-size: 1.15rem; line-height: 1.4;">3 → 12 → 25<small>m/s</small></span>
    <span class="sub">Typical: start turning, full output, shut down to protect themselves</span>
  </div>
</div>

<div class="card" style="padding: 0; overflow: hidden;">

```js
// The map is made once; the hour's picture, arrows and farm labels change on top of it.
const container = display(document.createElement("div"));
container.className = "wind-map";
const ireland = [
  [BOUNDS.south + 0.1, BOUNDS.west + 0.2],
  [BOUNDS.north - 0.1, BOUNDS.east - 0.1]
];
const map = L.map(container, {scrollWheelZoom: false, zoomSnap: 0.25}).fitBounds(ireland);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution:
    'Map &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Weather data by <a href="https://open-meteo.com/">Open-Meteo.com</a>',
  maxZoom: 11
}).addTo(map);
requestAnimationFrame(() => map.invalidateSize().fitBounds(ireland));

// Farm dots, sized by capacity. Each keeps its own label, refreshed every hour.
const radius = d3.scaleSqrt([0, d3.max(placedFarms, (d) => d.capacity) || 1], [2.5, 11]);
const farmLayer = L.layerGroup().addTo(map);
const farmDots = placedFarms.map((farm) => {
  const dot = L.circleMarker([farm.lat, farm.lon], {
    radius: radius(farm.capacity),
    color: "#ffffff",
    weight: 1,
    fillColor: "#101418",
    fillOpacity: 0.85
  }).addTo(farmLayer);
  dot.bindTooltip("", {direction: "top", offset: [0, -4]});
  dot.on("click", () => (location.href = `../generation/dispatch-down/farms/${encodeURIComponent(farm.id)}`));
  return {farm, dot};
});
invalidation.then(() => map.remove());
```

</div>

```js
// This hour: the coloured picture, the direction arrows, and the farms' labels.
if (!forecast.error) {
  const speeds = forecast.speed.map((s) => s[hour]);
  const picture = L.imageOverlay(
    windPicture(speeds, (s) => colour(s)),
    [
      [BOUNDS.south, BOUNDS.west],
      [BOUNDS.north, BOUNDS.east]
    ],
    {opacity: 0.72, interactive: false}
  ).addTo(map);
  picture.bringToBack(); // under the farm dots

  // Arrows show where the wind is blowing TO (forecasts give where it comes FROM).
  const arrows = L.layerGroup(
    points
      .filter((p) => p.row % 2 === 1 && p.col % 2 === 1)
      .map((p) => {
        const i = p.row * COLUMNS + p.col;
        const to = (forecast.direction[i][hour] + 180) % 360;
        return L.marker([p.lat, p.lon], {
          interactive: false,
          icon: L.divIcon({
            className: "wind-arrow",
            html: `<span style="transform: rotate(${to}deg)">↑</span>`,
            iconSize: [14, 14]
          })
        });
      })
  ).addTo(map);

  for (const {farm, dot} of farmDots) {
    const speed = speedAt(farm.lat, farm.lon, speeds);
    dot.setTooltipContent(
      `<strong>${escapeHtml(farm.name)}</strong><br>${speed.toFixed(1)} m/s at 100 m${farm.capacity ? ` · ${d3.format(",.0f")(farm.capacity)} MW` : ""}<br><span class="muted">Click for the farm's page</span>`
    );
  }
  invalidation.then(() => {
    picture.remove();
    arrows.remove();
  });
}
```

```js
Plot.legend({
  color: {type: "linear", domain: [0, 25], range: ["#eef7fb", "#0b3954"], label: "Wind speed at 100 m (m/s); arrows show where it's blowing", ticks: [0, 3, 6, 9, 12, 15, 20, 25]},
  width: 340,
  style: plotStyle
})
```

<div class="card" style="margin-top: 2rem;">
  <div class="card-head"><span class="label">Average wind at the farms, next three days</span><span class="label">m/s at 100 m, weighted by farm size</span></div>
  ${resize((width) =>
    forecast.error
      ? html`<p class="muted">No forecast to show.</p>`
      : Plot.plot({
          width,
          height: 240,
          marginLeft: 36,
          style: plotStyle,
          x: {type: "utc", label: null, ticks: d3.utcDay, tickFormat: (t) => t.toLocaleDateString("en-IE", {timeZone: "Europe/Dublin", weekday: "short", day: "numeric", month: "short"})},
          y: {label: null, grid: true, domain: [0, Math.max(14, d3.max(atFarms, (d) => d.speed) + 1)]},
          marks: [
            Plot.ruleY([3, 12], {stroke: "var(--ink-faint)", strokeDasharray: "3 3"}),
            Plot.text([{y: 3, text: "Turbines start (typical)"}, {y: 12, text: "Full output (typical)"}], {x: times[0], y: "y", text: "text", textAnchor: "start", dy: -6, fill: "var(--ink-faint)"}),
            Plot.areaY(atFarms, {x: "time", y: "speed", fill: COLOURS.wind, fillOpacity: 0.18}),
            Plot.lineY(atFarms, {x: "time", y: "speed", stroke: COLOURS.wind, strokeWidth: 2}),
            Plot.ruleX([times[hour]], {stroke: "var(--ink)", strokeWidth: 1.5}),
            Plot.ruleY([0], {stroke: "var(--line-strong)"}),
            Plot.tip(atFarms, Plot.pointerX({x: "time", y: "speed", title: (d) => `${irishTime(d.time)}\n${d.speed.toFixed(1)} m/s at the farms`}))
          ]
        })
  )}
  <p class="muted" style="margin-top: 0.5rem;">The black line is the hour on the map. For the grid operator's own forecast of wind power, see <a href="../generation/wind#forecast">Wind &amp; demand</a>.</p>
</div>

<div class="note" style="margin-top: 2rem;">

**About this map.** The forecast comes from [Open-Meteo](https://open-meteo.com/), which combines national weather models, for a grid of about 170 points over the island, each about 30 km apart. Your browser fetches it when you open the page and keeps it for 30 minutes. The colours between points are blended, so small features such as a single hill or valley don't show. Wind speeds for turbines are typical values: each model of turbine differs. Farm positions come from OpenStreetMap, matched to SEMO's unit names.

</div>
