// Wind forecasts for a grid of points over Ireland, from Open-Meteo (open-meteo.com),
// fetched by the visitor's browser. Used by the Wind map page.
//
// Open-Meteo counts every point as one request against a limit per visitor (about 600 a
// minute, 10,000 a day on the free service), so the grid is kept small (about 220
// points) and each answer is kept in the browser for 30 minutes. Its data is free to use
// with credit ("Weather data by Open-Meteo.com", CC BY 4.0) for non-commercial use.

// The area shown: Ireland and Northern Ireland with the seas around them, wide enough that
// the colours can fade out over the sea rather than over land.
export const BOUNDS = {south: 50.9, north: 55.9, west: -11.9, east: -4.6};
export const ROWS = 16;
export const COLUMNS = 14;

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

const CACHE_KEY = "wind-grid-v2";
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

// ---- The picture --------------------------------------------------------------------------

// The picture's size in pixels. Its height keeps the map's proportions (in Mercator), so
// the browser doesn't have to stretch it unevenly.
export const PICTURE_WIDTH = 330;
export const PICTURE_HEIGHT = Math.round(
  (PICTURE_WIDTH * (toY(BOUNDS.north) - toY(BOUNDS.south))) / (((BOUNDS.east - BOUNDS.west) * Math.PI) / 180)
);

// A smooth curve through four neighbouring values (Catmull-Rom). Unlike straight-line
// blending, it has no visible creases at the grid points.
const cubic = (a, b, c, d, t) =>
  b + 0.5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)));

/**
 * One hour's wind as a smooth field the size of the picture: a value for every pixel,
 * row by row from the top. Used for the colours and for the contour lines.
 */
export function windField(speeds, width = PICTURE_WIDTH, height = PICTURE_HEIGHT) {
  const at = (row, col) =>
    speeds[Math.max(0, Math.min(ROWS - 1, row)) * COLUMNS + Math.max(0, Math.min(COLUMNS - 1, col))];
  const values = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    // Pixel rows are evenly spaced in Mercator, like the grid's rows.
    const r = ((y + 0.5) / height) * ROWS - 0.5;
    const r0 = Math.floor(r);
    const fr = r - r0;
    for (let x = 0; x < width; x++) {
      const c = ((x + 0.5) / width) * COLUMNS - 0.5;
      const c0 = Math.floor(c);
      const fc = c - c0;
      const rows = [-1, 0, 1, 2].map((k) =>
        cubic(at(r0 + k, c0 - 1), at(r0 + k, c0), at(r0 + k, c0 + 1), at(r0 + k, c0 + 2), fc)
      );
      values[y * width + x] = Math.max(0, cubic(rows[0], rows[1], rows[2], rows[3], fr));
    }
  }
  return values;
}

/**
 * The coloured picture of a wind field, on a canvas. `rgb(speed)` gives [r, g, b]. The
 * colours fade out towards the picture's edges, so it melts into the map instead of
 * ending in a hard square.
 */
export function windPicture(values, rgb, {width = PICTURE_WIDTH, height = PICTURE_HEIGHT, opacity = 0.85, fade = 0.3} = {}) {
  // Colours looked up once, for every tenth of a m/s up to 40.
  const steps = 400;
  const table = Array.from({length: steps + 1}, (_, i) => rgb(i / 10));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  const image = context.createImageData(width, height);
  // How far each pixel is from the middle, as a rounded rectangle (a "superellipse"):
  // 0 in the middle, 1 at the edge. The last `fade` of the way, the colours fade out.
  const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t)); // eases in and out
  for (let y = 0; y < height; y++) {
    const v = Math.abs((2 * (y + 0.5)) / height - 1) ** 4;
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const u = Math.abs((2 * (x + 0.5)) / width - 1) ** 4;
      const distance = (u + v) ** 0.25;
      const [r, g, b] = table[Math.min(steps, Math.round(values[i] * 10))];
      image.data.set([r, g, b, 255 * opacity * smooth((1 - distance) / fade)], i * 4);
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

// ---- Measured wind, now -------------------------------------------------------------------

// Met Éireann's weather stations with hourly readings, and where they are (from Met
// Éireann's station list). Wind is measured at 10 m, so it's lower than at turbine height.
export const STATIONS = [
  {slug: "athenry", name: "Athenry", lat: 53.28917, lon: -8.78556},
  {slug: "ballyhaise", name: "Ballyhaise", lat: 54.05139, lon: -7.30972},
  {slug: "belmullet", name: "Belmullet", lat: 54.2275, lon: -10.00694},
  {slug: "casement", name: "Casement", lat: 53.30556, lon: -6.43889},
  {slug: "claremorris", name: "Claremorris", lat: 53.71083, lon: -8.9925},
  {slug: "cork", name: "Cork", lat: 51.84722, lon: -8.48611},
  {slug: "dublin", name: "Dublin Airport", lat: 53.42778, lon: -6.24083},
  {slug: "dunsany", name: "Dunsany", lat: 53.51583, lon: -6.66},
  {slug: "finner", name: "Finner", lat: 54.49389, lon: -8.24306},
  {slug: "gurteen", name: "Gurteen", lat: 53.035, lon: -8.00861},
  {slug: "johnstown-castle", name: "Johnstown Castle", lat: 52.29167, lon: -6.5},
  {slug: "knock", name: "Knock", lat: 53.90611, lon: -8.81722},
  {slug: "mace-head", name: "Mace Head", lat: 53.32583, lon: -9.90083},
  {slug: "malin-head", name: "Malin Head", lat: 55.37194, lon: -7.33917},
  {slug: "moore-park", name: "Moore Park", lat: 52.16389, lon: -8.26389},
  {slug: "mullingar", name: "Mullingar", lat: 53.53722, lon: -7.36222},
  {slug: "oak-park", name: "Oak Park", lat: 52.86111, lon: -6.91528},
  {slug: "phoenix-park", name: "Phoenix Park", lat: 53.36361, lon: -6.34972},
  {slug: "roches-point", name: "Roche's Point", lat: 51.79306, lon: -8.24444},
  {slug: "shannon", name: "Shannon", lat: 52.69028, lon: -8.91806},
  {slug: "sherkin-island", name: "Sherkin Island", lat: 51.47639, lon: -9.42833},
  {slug: "valentia", name: "Valentia", lat: 51.93833, lon: -10.24083}
];

const number = (text) => {
  const value = parseFloat(text);
  return Number.isFinite(value) ? value : null;
};

/**
 * The latest reading at each station, fetched by the visitor's browser from Met Éireann.
 * Returns one row per station that answered: {...station, speed and gust in m/s (or null),
 * direction the wind comes FROM in degrees, time as "HH:MM" Irish time, date "DD-MM-YYYY"}.
 */
export async function measuredWind(stations = STATIONS) {
  const answers = await Promise.allSettled(
    stations.map(async (station) => {
      const response = await fetch(`https://prodapi.metweb.ie/observations/${station.slug}/today`);
      if (!response.ok) throw new Error(`Met Éireann answered ${response.status}`);
      const readings = await response.json();
      // An unknown station name quietly gets Dublin Airport's readings, so check the name.
      const latest = readings.find((d) => d.name === station.name && number(d.windSpeed) != null);
      if (!latest) throw new Error(`No reading for ${station.name}`);
      return {
        ...station,
        speed: number(latest.windSpeed) / 3.6, // Met Éireann gives km/h
        gust: number(latest.windGust) == null ? null : number(latest.windGust) / 3.6,
        direction: latest.windDirection,
        compass: latest.cardinalWindDirection,
        time: latest.reportTime,
        date: latest.date
      };
    })
  );
  return answers.filter((d) => d.status === "fulfilled").map((d) => d.value);
}
