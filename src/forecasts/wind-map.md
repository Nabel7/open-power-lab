---
title: Wind map
---

<style>
.wind-map { height: min(72vh, 640px); }
.wind-map .grey-map { filter: grayscale(1) brightness(1.17); }
.wind-map .leaflet-image-layer { image-rendering: auto; mix-blend-mode: multiply; }
.wind-arrow { color: rgb(16 20 24 / 0.5); font: 600 13px/1 var(--sans-serif); text-align: center; }
.wind-arrow span { display: inline-block; }
.station {
  display: flex; align-items: center; justify-content: center; gap: 2px; box-sizing: border-box;
  border: 1.5px solid #101418; border-radius: 999px; background: #fff; color: #101418;
  font: 700 11px/1 var(--sans-serif); font-variant-numeric: tabular-nums; box-shadow: 0 1px 3px rgb(0 0 0 / 0.25);
}
.station i { display: inline-block; font-style: normal; font-weight: 600; }
.layer-toggle { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 1rem; margin: 0.75rem 0 0; font-size: 13.5px; }
.layer-toggle form { width: auto; }
.layer-toggle form > label { width: auto; }
.layer-toggle label { display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer; }
.station-key { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 16px; border: 1.5px solid #101418; border-radius: 999px; font: 700 10px/1 var(--sans-serif); }
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
import {BOUNDS, COLUMNS, PICTURE_WIDTH, PICTURE_HEIGHT, grid, windForecast, speedAt, windField, windPicture, measuredWind} from "../components/weather.js";

const places = FileAttachment("../generation/dispatch-down/data/farm_locations.csv").csv({typed: true});
const farmList = FileAttachment("../generation/dispatch-down/data/farms.csv").csv({typed: true});
```

```js
// The forecast, fetched by your browser from Open-Meteo. If it can't be reached, say so.
const points = grid();
const forecast = await windForecast(points).catch((error) => ({error}));
```

```js
// Measured wind at Met Éireann's stations, fetched by your browser now and again every
// 10 minutes (the stations report once an hour).
const measured = (async function* () {
  while (true) {
    const stations = await measuredWind().catch(() => []);
    yield {stations, checked: new Date()};
    await new Promise((resolve) => setTimeout(resolve, 10 * 60e3));
  }
})();
```

```js
const showMeasuredInput = Inputs.toggle({label: "Measured wind now", value: true});
const showMeasured = Generators.input(showMeasuredInput);
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

// Colours for wind speed (m/s at 100 m): pale yellow when calm, through green and blue,
// to deep purple in a storm. Each step is darker than the last, so stronger always reads
// as darker, and the change of hue makes the bands easy to tell apart.
const speedStops = [0, 4, 8, 12, 16, 20, 25];
const speedColours = ["#f4f9c4", "#c7e9b4", "#7fcdbb", "#41b6c4", "#1d91c0", "#2b5aa6", "#3d1a78"];
const colour = d3.scaleLinear(speedStops, speedColours).interpolate(d3.interpolateLab).clamp(true);
const rgb = (speed) => {
  const c = d3.rgb(colour(speed));
  return [c.r, c.g, c.b];
};
// Contour lines on the map, every 5 m/s.
const contourSteps = [5, 10, 15, 20, 25];
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
  [51.4, -10.6],
  [55.4, -5.4]
];
const map = L.map(container, {scrollWheelZoom: false, zoomSnap: 0.25}).fitBounds(ireland);

// Layers, bottom to top: the map in grey (so it doesn't fight the colours), the wind
// colours, the arrows, the farms, and the measured readings. The colours are multiplied
// onto the map, so roads, coasts and place names still show through.
for (const [name, z] of [["arrows", 420], ["farms", 500]]) {
  map.createPane(name).style.zIndex = z;
  map.getPane(name).style.pointerEvents = name === "farms" ? "auto" : "none";
}
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  className: "grey-map",
  maxZoom: 11,
  attribution:
    'Map &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Weather data by <a href="https://open-meteo.com/">Open-Meteo.com</a> · Observations &copy; <a href="https://www.met.ie/">Met Éireann</a>'
}).addTo(map);
requestAnimationFrame(() => map.invalidateSize().fitBounds(ireland));

// The wind picture: made once here, and given a new image every hour.
const blank = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
const picture = L.imageOverlay(
  blank,
  [
    [BOUNDS.south, BOUNDS.west],
    [BOUNDS.north, BOUNDS.east]
  ],
  {interactive: false}
).addTo(map);

// Farm dots, sized by capacity. Each keeps its own label, refreshed every hour.
const radius = d3.scaleSqrt([0, d3.max(placedFarms, (d) => d.capacity) || 1], [2.5, 11]);
const farmLayer = L.layerGroup().addTo(map);
const farmDots = placedFarms.map((farm) => {
  const dot = L.circleMarker([farm.lat, farm.lon], {
    pane: "farms",
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

  // A smooth field from the grid, coloured, with faint lines every 5 m/s. The lines are
  // drawn "atop" the colours, so they fade out at the edges with them.
  const field = windField(speeds);
  const canvas = windPicture(field, rgb);
  const context = canvas.getContext("2d");
  context.globalCompositeOperation = "source-atop";
  context.strokeStyle = "rgb(255 255 255 / 0.7)";
  context.lineWidth = 1.2;
  const path = d3.geoPath(null, context);
  for (const line of d3.contours().size([PICTURE_WIDTH, PICTURE_HEIGHT]).thresholds(contourSteps)(field)) {
    context.beginPath();
    path(line);
    context.stroke();
  }
  picture.setUrl(canvas.toDataURL());

  // Arrows show where the wind is blowing TO (forecasts give where it comes FROM).
  const arrows = L.layerGroup(
    points
      .filter((p) => p.row % 2 === 1 && p.col % 2 === 1)
      .map((p) => {
        const i = p.row * COLUMNS + p.col;
        const to = (forecast.direction[i][hour] + 180) % 360;
        return L.marker([p.lat, p.lon], {
          pane: "arrows",
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
  invalidation.then(() => arrows.remove());
}
```

```js
// The latest measured readings, as small white labels: the number is m/s at 10 m and the
// arrow shows where the wind is blowing.
if (showMeasured && measured.stations.length) {
  const stationLayer = L.layerGroup(
    measured.stations.map((d) => {
      const to = (d.direction + 180) % 360;
      const calm = d.speed < 0.5;
      const marker = L.marker([d.lat, d.lon], {
        icon: L.divIcon({
          className: "station",
          html: `${calm ? "" : `<i style="transform: rotate(${to}deg)">↑</i>`}${d.speed.toFixed(0)}`,
          iconSize: [calm ? 22 : 34, 20]
        })
      });
      marker.bindTooltip(
        `<strong>${escapeHtml(d.name)}</strong> · measured at ${escapeHtml(d.time)}<br>` +
          `${d.speed.toFixed(1)} m/s${d.gust ? `, gusts ${d.gust.toFixed(1)} m/s` : ""}${calm ? " (calm)" : ` from the ${escapeHtml(d.compass)}`}<br>` +
          `<span class="muted">Met Éireann station, 10 m above ground</span>`,
        {direction: "top", offset: [0, -8]}
      );
      return marker;
    })
  ).addTo(map);
  invalidation.then(() => stationLayer.remove());
}
```

```js
const latestReading = measured.stations.length ? d3.max(measured.stations, (d) => d.time) : null;
```

<div class="layer-toggle">
  ${showMeasuredInput}
  <span class="muted">${measured.stations.length
    ? html`<span class="station-key">7</span> ${measured.stations.length} Met Éireann stations, latest reading ${latestReading} Irish time, in m/s at 10 m. Checked again every 10 minutes.`
    : "Met Éireann's station readings couldn't be loaded just now."}</span>
</div>

```js
Plot.legend({
  color: {type: "linear", domain: speedStops, range: speedColours, interpolate: "lab", label: "Forecast wind at 100 m (m/s). Lines every 5 m/s; arrows show where it's blowing", ticks: [0, 5, 10, 15, 20, 25]},
  width: 360,
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

**About this map.** The forecast comes from [Open-Meteo](https://open-meteo.com/), which combines national weather models, for a grid of about 220 points over the island and the seas around it, each about 30 km apart. Your browser fetches it when you open the page and keeps it for 30 minutes. The colours between points are blended smoothly, so small features such as a single hill or valley don't show. Wind speeds for turbines are typical values: each model of turbine differs. Farm positions come from OpenStreetMap, matched to SEMO's unit names.

**Measured wind.** The white labels are real readings from [Met Éireann](https://www.met.ie/)'s weather stations, the latest hour, in m/s. They're measured at 10 metres, where the wind is slower than at a turbine's hub, often by a quarter or more, so expect them to be lower than the colours around them. They show the latest reading whatever hour the slider is on. Northern Ireland's stations aren't included.

</div>
