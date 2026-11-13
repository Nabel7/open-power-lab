// Wind forecasts for a grid of points over Ireland, from Open-Meteo (open-meteo.com),
// fetched by the visitor's browser. Used by the Wind map page.
//
// Open-Meteo counts every point as one request against a limit per visitor (about 600 a
// minute, 10,000 a day on the free service), so the grid is kept small (about 170
// points) and each answer is kept in the browser for 30 minutes. Its data is free to use
// with credit ("Weather data by Open-Meteo.com", CC BY 4.0) for non-commercial use.

// The area shown: Ireland and Northern Ireland with a little sea around them.
export const BOUNDS = {south: 51.3, north: 55.5, west: -10.8, east: -5.3};
export const ROWS = 14;
export const COLUMNS = 12;

// Web maps stretch latitude (the Mercator projection), so rows are spaced evenly on the
// map, not in degrees. Then a picture made from the grid lines up with the map exactly.
const toY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const toLat = (y) => ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;

/** The grid's points, row by row from north to south, west to east in each row. */
export function grid() {
  const top = toY(BOUNDS.north);
  const bottom = toY(BOUNDS.south);
  const points = [];
  for (let row = 0; row < ROWS; row++) {
    const lat = toLat(top + ((bottom - top) * (row + 0.5)) / ROWS);
    for (let col = 0; col < COLUMNS; col++) {
      const lon = BOUNDS.west + ((BOUNDS.east - BOUNDS.west) * (col + 0.5)) / COLUMNS;
      points.push({row, col, lat, lon});
    }
  }
  return points;
}

const CACHE_KEY = "wind-grid-v1";
const CACHE_MINUTES = 30;

/**
 * Hourly wind at 100 m (about turbine height) for every grid point, for the next few days.
 * Returns {times: Date[], speed: number[point][hour] in m/s, direction: number[point][hour]
 * in degrees the wind comes FROM, fetched: Date}.
 */
export async function windForecast(points, days = 3) {
  try {
    const kept = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? "null");
    if (kept && Date.now() - kept.fetched < CACHE_MINUTES * 60e3 && kept.speed.length === points.length) {
      return {...kept, times: kept.times.map((t) => new Date(t)), fetched: new Date(kept.fetched)};
    }
  } catch {
    // No saved copy, or the browser won't keep one: fetch below.
  }
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", points.map((p) => p.lat.toFixed(4)).join(","));
  url.searchParams.set("longitude", points.map((p) => p.lon.toFixed(4)).join(","));
  url.searchParams.set("hourly", "wind_speed_100m,wind_direction_100m");
  url.searchParams.set("wind_speed_unit", "ms");
  url.searchParams.set("forecast_days", String(days));
  url.searchParams.set("timezone", "GMT");
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Open-Meteo answered ${response.status}`);
  const answer = await response.json();
  const places = Array.isArray(answer) ? answer : [answer];
  const result = {
    times: places[0].hourly.time.map((t) => new Date(`${t}:00Z`)),
    speed: places.map((p) => p.hourly.wind_speed_100m),
    direction: places.map((p) => p.hourly.wind_direction_100m),
    fetched: new Date()
  };
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({...result, fetched: +result.fetched}));
  } catch {
    // Not kept: fine, it just means another fetch on the next visit.
  }
  return result;
}

/**
 * Wind speed at any position, blended from the four grid points around it (bilinear).
 * `speeds` is one hour's speed for every grid point, in grid order.
 */
export function speedAt(lat, lon, speeds) {
  const top = toY(BOUNDS.north);
  const bottom = toY(BOUNDS.south);
  const r = ((toY(lat) - top) / (bottom - top)) * ROWS - 0.5;
  const c = ((lon - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * COLUMNS - 0.5;
  const r0 = Math.max(0, Math.min(ROWS - 1, Math.floor(r)));
  const c0 = Math.max(0, Math.min(COLUMNS - 1, Math.floor(c)));
  const r1 = Math.min(ROWS - 1, r0 + 1);
  const c1 = Math.min(COLUMNS - 1, c0 + 1);
  const fr = Math.max(0, Math.min(1, r - r0));
  const fc = Math.max(0, Math.min(1, c - c0));
  const at = (row, col) => speeds[row * COLUMNS + col];
  const topEdge = at(r0, c0) * (1 - fc) + at(r0, c1) * fc;
  const bottomEdge = at(r1, c0) * (1 - fc) + at(r1, c1) * fc;
  return topEdge * (1 - fr) + bottomEdge * fr;
}

/**
 * A small picture of one hour's wind: one pixel per grid point, coloured by `colour`.
 * The browser smooths it when it's stretched over the map, which gives soft edges.
 */
export function windPicture(speeds, colour) {
  const canvas = document.createElement("canvas");
  canvas.width = COLUMNS;
  canvas.height = ROWS;
  const context = canvas.getContext("2d");
  speeds.forEach((s, i) => {
    context.fillStyle = colour(s);
    context.fillRect(i % COLUMNS, Math.floor(i / COLUMNS), 1, 1);
  });
  return canvas.toDataURL();
}
