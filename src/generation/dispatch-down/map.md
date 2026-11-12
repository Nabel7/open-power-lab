---
title: Map
---

<style>
.leaflet-interactive:focus {
  outline: none;
}
.farm-details:not(:empty) {
  padding: 0.75rem 1rem;
  font: 14px var(--sans-serif);
  line-height: 1.5;
}
</style>

<div class="page-head">
  <p class="eyebrow">Map · ${monthName(month)}</p>
  <h1>Where wind power is turned down</h1>
  <p class="lede">Each dot is a wind farm. Bigger dots lost more energy that month; stronger colour means a bigger share of what the wind allowed. Hover or tap a dot for details, and click through to the farm's own page.</p>
  ${monthInput}
</div>

```js
import "../../components/shell.js";
import {REGION_NAMES, monthName, shortMonth, percent, gwh, euros, plotStyle, escapeHtml} from "../../components/format.js";

const monthly = FileAttachment("data/monthly.csv").csv({typed: true});
const farms = FileAttachment("data/farms.csv").csv({typed: true});
const farmMonthly = FileAttachment("data/farm_monthly.csv").csv({typed: true});
const places = FileAttachment("data/farm_locations.csv").csv({typed: true});
const meta = FileAttachment("data/meta.json").json();
```

```js
// Same default as the Overview: the latest month with most of its days covered.
const allMonths = monthly.filter((d) => d.region === "ALL");
const mostlyCovered = allMonths.filter((d) => d.days_with_data >= 0.8 * d.days_in_month);
const monthInput = Inputs.radio(
  allMonths.map((d) => d.month),
  {value: (mostlyCovered.at(-1) ?? allMonths.at(-1)).month, format: shortMonth}
);
monthInput.classList.add("chips");
const month = Generators.input(monthInput);
```

```js
const sameMonth = (date) =>
  date.getUTCFullYear() === month.getUTCFullYear() && date.getUTCMonth() === month.getUTCMonth();

const info = new Map(farms.map((d) => [d.unit, d]));
const where = new Map(places.filter((d) => d.located_by).map((d) => [d.unit, d]));

// This month's numbers for every unit with a known position. Units on the same farm
// page (phases like Oweninney 1 and 2) are added together into one dot.
const rows = farmMonthly.filter((d) => sameMonth(d.month) && info.get(d.unit)?.technology !== "solar");
const placed = rows.filter((d) => where.has(d.unit)).map((d) => ({...d, ...where.get(d.unit)}));
const onMap = d3
  .groups(placed, (d) => info.get(d.unit)?.farm_id ?? d.unit)
  .map(([id, units]) => {
    const sum = (key) => d3.sum(units, (d) => d[key]);
    const lost = sum("lost_mwh");
    const first = info.get(units[0].unit);
    return {
      id,
      farm_name: first?.farm_name ?? units[0].farm_name,
      lat: units[0].lat,
      lon: units[0].lon,
      units: units.map((d) => d.unit),
      company: [...new Set(units.map((d) => info.get(d.unit)?.company))].join(", "),
      region: first?.region,
      produced_mwh: sum("produced_mwh"),
      constraint_mwh: sum("constraint_mwh"),
      curtailment_mwh: sum("curtailment_mwh"),
      lost_mwh: lost,
      lost_value_eur: sum("lost_value_eur"),
      dispatch_down_pct: (100 * lost) / (lost + sum("produced_mwh"))
    };
  })
  .sort((a, b) => d3.ascending(a.lost_mwh, b.lost_mwh)); // big dots drawn last, on top

const lostTotal = d3.sum(rows, (d) => d.lost_mwh);
const lostOnMap = d3.sum(onMap, (d) => d.lost_mwh);
```

```js
// Colour: share dispatched down, one hue from dim to bright. Size: energy lost (area).
const colourRange = ["#efd98c", "#946800"];
const colour = d3.scaleLinear([0, 50], colourRange).clamp(true);
const biggest = window.innerWidth < 640 ? 14 : 22; // smaller dots on a phone
const radius = d3.scaleSqrt([0, d3.max(onMap, (d) => d.lost_mwh) || 1], [2, biggest]);


function farmLabel(d) {
  const name = d.farm_name;
  const split =
    d.lost_mwh > 0
      ? `${percent((100 * d.constraint_mwh) / d.lost_mwh)} constraint, ${percent((100 * d.curtailment_mwh) / d.lost_mwh)} curtailment`
      : "nothing lost";
  // Names come from SEMO and OpenStreetMap, so they're escaped before going into HTML.
  return `<strong>${escapeHtml(name)}</strong><br>
    ${escapeHtml(d.company)} · ${REGION_NAMES[d.region] ?? ""}<br>
    <strong>${percent(d.dispatch_down_pct)}</strong> dispatched down · ${gwh(d.lost_mwh)} lost<br>
    ${split}<br>
    Market value ${euros(d.lost_value_eur)} · <span class="muted">${escapeHtml(d.units.join(", "))}</span>`;
}
const farmLink = (d) => `./farms/${encodeURIComponent(d.id)}`;
```

<div class="card" style="padding: 0; overflow: hidden; margin-bottom: 1rem;">

```js
const container = display(document.createElement("div"));
container.style = "height: min(75vh, 720px);";

const ireland = [
  [51.35, -10.6],
  [55.4, -5.4]
];
const map = L.map(container, {scrollWheelZoom: false, zoomSnap: 0.25}).fitBounds(ireland);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution:
    'Farm positions &amp; map &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 12
}).addTo(map);
// The box only gets its real size once it's on the page: measure again, then fit Ireland.
requestAnimationFrame(() => map.invalidateSize().fitBounds(ireland));

const canHover = window.matchMedia("(hover: hover)").matches;
const details = display(document.createElement("div"));
details.className = "farm-details";
details.textContent = canHover ? "" : "Tap a dot to see the farm's details here.";
details.style.cursor = "default";
for (const d of onMap) {
  const dot = L.circleMarker([d.lat, d.lon], {
    radius: d.lost_mwh > 0 ? radius(d.lost_mwh) : 2,
    color: "#ffffff",
    weight: 1,
    fillColor: d.lost_mwh > 0 ? colour(d.dispatch_down_pct) : "#7c8d9b",
    fillOpacity: 0.9
  });
  // Hover where there's a mouse; on a touch screen, a tap shows the details under the
  // map, where there's room for them.
  // Click goes to the farm's page.
  if (canHover) {
    dot.bindTooltip(`${farmLabel(d)}<br><span class="muted">Click for the farm's page</span>`, {direction: "top", offset: [0, -4]});
    dot.on("click", () => (location.href = farmLink(d)));
  } else {
    dot.on("click", () => (details.innerHTML = `${farmLabel(d)}<br><a href="${farmLink(d)}">Open the farm's page →</a>`));
  }
  dot.addTo(map);
}

invalidation.then(() => map.remove());
```

</div>

```js
Plot.legend({
  color: {type: "linear", domain: [0, 50], range: colourRange, label: "Dispatched down (%), 50 or more is strongest"},
  width: 320,
  style: plotStyle
})
```

<p class="muted">
${onMap.length} farms on the map, covering ${percent((100 * lostOnMap) / lostTotal)} of the energy lost in ${monthName(month)}. The rest can't be placed yet: mostly suppliers' grouped units with no farm name, plus a few farms not on OpenStreetMap under their SEMO name. Solar farms aren't shown. Units at the same farm (e.g. phases) are combined into one dot. Grey dots lost nothing.
</p>

<p class="muted">Positions come from OpenStreetMap, matched to SEMO's unit names automatically, so a match may occasionally be wrong. See <a href="./methods">Methods &amp; data</a>.</p>
