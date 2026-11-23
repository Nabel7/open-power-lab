// The LinkedIn banner: a year of day-ahead prices as a picture, with the site's name.
// One column per day, one row per half hour (Irish time, midnight at the top), blue when
// power was cheap and amber when it was dear. Writes brand/linkedin-banner.html (the
// drawing at LinkedIn's size, 1584 x 396) and renders it to brand/linkedin-banner.png
// with Chrome.
//
//   node scripts/brand/linkedin-banner.mjs [path/to/prices_hh.csv]

import {readFileSync, writeFileSync, mkdirSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {resolve} from "node:path";

const W = 1584;
const H = 396;
const HEAT = 960; // the year fills the left of the banner; the name sits on the right
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const source = process.argv[2] ?? "src/data/markets/prices_hh.csv";

// Read the half-hourly prices and place each one on its Irish day and half hour.
const dublin = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Dublin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});
const cells = new Map(); // day -> Array(48)
for (const line of readFileSync(source, "utf8").trim().split("\n").slice(1)) {
  const [timestamp, price] = line.split(",");
  const parts = Object.fromEntries(dublin.formatToParts(new Date(timestamp.replace("Z", ":00Z"))).map((p) => [p.type, p.value]));
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  const slot = Number(parts.hour) * 2 + (Number(parts.minute) >= 30 ? 1 : 0);
  if (!cells.has(day)) cells.set(day, new Array(48).fill(null));
  cells.get(day)[slot] = Number(price);
}
const days = [...cells.keys()].sort().slice(-365);

// Colour by rank, so the whole range shows whatever the year's prices did.
const all = days.flatMap((d) => cells.get(d)).filter((v) => v != null).sort((a, b) => a - b);
const rank = (v) => {
  let lo = 0;
  let hi = all.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (all[mid] < v) lo = mid + 1;
    else hi = mid;
  }
  return lo / (all.length - 1);
};
const CHEAP = [14, 143, 176]; // the site's wind colour
const MIDDLE = [243, 244, 246];
const DEAR = [184, 130, 0]; // the site's dispatch-down amber
const mix = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * t));
const colour = (t) => {
  const rgb = t < 0.5 ? mix(CHEAP, MIDDLE, t / 0.5) : mix(MIDDLE, DEAR, (t - 0.5) / 0.5);
  return `rgb(${rgb.join(",")})`;
};

const cw = HEAT / days.length;
const ch = H / 48;
let rects = "";
days.forEach((day, x) => {
  cells.get(day).forEach((v, y) => {
    if (v == null) return;
    rects += `<rect x="${(x * cw).toFixed(2)}" y="${(y * ch).toFixed(2)}" width="${(cw + 0.4).toFixed(2)}" height="${(ch + 0.4).toFixed(2)}" fill="${colour(rank(v))}"/>`;
  });
});

const monthName = (d) => new Date(`${d}T12:00:00Z`).toLocaleString("en-GB", {month: "short", year: "numeric", timeZone: "UTC"});
const span = `${monthName(days[0])} to ${monthName(days.at(-1))}`;
const WAVE = "M4.5 14c2 0 2.3-6 4.3-6s2.2 8 4.4 8 2.3-6 4.3-6h2";

const html = `<!doctype html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;650&display=block" rel="stylesheet">
<style>
  html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: #fff; }
  body { font-family: Inter, sans-serif; -webkit-font-smoothing: antialiased; }
  svg { display: block; position: absolute; inset: 0; }
  .text { position: absolute; left: 1010px; right: 56px; top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center; color: #101418; }
  .name { display: flex; align-items: center; gap: 18px; font-size: 52px; font-weight: 650; letter-spacing: -0.02em; }
  .name svg { position: static; width: 60px; height: 60px; flex: none; }
  .line { margin-top: 16px; font-size: 22px; line-height: 1.4; color: #4f5964; }
  .note { position: absolute; right: 56px; bottom: 22px; font-size: 13px; color: #6b7580; }
  .note i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; vertical-align: -1px; margin: 0 4px 0 8px; }
</style></head>
<body>
<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="fade" x1="0" x2="1">
      <stop offset="${(HEAT - 70) / W}" stop-color="#fff" stop-opacity="0"/>
      <stop offset="${HEAT / W}" stop-color="#fff" stop-opacity="1"/>
    </linearGradient>
  </defs>
  <g shape-rendering="crispEdges">${rects}</g>
  <rect width="${W}" height="${H}" fill="url(#fade)"/>
</svg>
<div class="text">
  <div class="name"><svg viewBox="0 0 24 24"><rect x="1" y="1" width="22" height="22" rx="6" fill="#1d4ed8"/><path d="${WAVE}" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>Open Power Lab</div>
  <div class="line">Independent data and analysis on the Irish electricity market: prices, wind, dispatch down and forecasts.</div>
</div>
<div class="note">Every half-hourly day-ahead price, ${span}<i style="background:${colour(0.05)}"></i>cheap<i style="background:${colour(0.95)}"></i>dear</div>
</body></html>`;

mkdirSync("brand", {recursive: true});
writeFileSync("brand/linkedin-banner.html", html);
execFileSync(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--force-device-scale-factor=1",
  `--window-size=${W},${H}`,
  "--virtual-time-budget=5000",
  `--screenshot=${resolve("brand/linkedin-banner.png")}`,
  `file://${resolve("brand/linkedin-banner.html")}`
], {stdio: "ignore"});
console.log(`brand/linkedin-banner.png: ${days.length} days, ${span}`);
