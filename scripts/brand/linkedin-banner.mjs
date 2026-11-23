// The LinkedIn banner: white, with one thin line (the past year's day-ahead price, as a
// 7-day average) on the left and the site's name on the right, clear of the profile photo.
// Writes brand/linkedin-banner.html (the drawing at LinkedIn's size, 1584 x 396) and
// renders it to brand/linkedin-banner.png with Chrome.
//
//   node scripts/brand/linkedin-banner.mjs [path/to/prices_hh.csv]

import {readFileSync, writeFileSync, mkdirSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {resolve} from "node:path";

const W = 1584;
const H = 396;
const LINE = {left: 0, right: 900, top: 90, bottom: 300}; // where the price line sits
const TAGLINE = "Market intelligence for the I-SEM";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const source = process.argv[2] ?? "src/data/markets/prices_hh.csv";

// Average price for each Irish day.
const dublinDay = new Intl.DateTimeFormat("en-CA", {timeZone: "Europe/Dublin", year: "numeric", month: "2-digit", day: "2-digit"});
const sums = new Map(); // day -> [total, count]
for (const line of readFileSync(source, "utf8").trim().split("\n").slice(1)) {
  const [timestamp, price] = line.split(",");
  const day = dublinDay.format(new Date(timestamp.replace("Z", ":00Z")));
  const [total, count] = sums.get(day) ?? [0, 0];
  sums.set(day, [total + Number(price), count + 1]);
}
const days = [...sums.keys()].sort().slice(-365);
const daily = days.map((d) => sums.get(d)[0] / sums.get(d)[1]);

// A 7-day average, so the line reads calmly.
const smooth = daily.map((_, i) => {
  const week = daily.slice(Math.max(0, i - 6), i + 1);
  return week.reduce((a, b) => a + b, 0) / week.length;
});

const lo = Math.min(...smooth);
const hi = Math.max(...smooth);
const x = (i) => LINE.left + ((LINE.right - LINE.left) * i) / (smooth.length - 1);
const y = (v) => LINE.bottom - ((LINE.bottom - LINE.top) * (v - lo)) / (hi - lo);
const path = smooth.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
const last = smooth.length - 1;

const monthName = (d) => new Date(`${d}T12:00:00Z`).toLocaleString("en-GB", {month: "short", year: "numeric", timeZone: "UTC"});
const span = `${monthName(days[0])} to ${monthName(days.at(-1))}`;
const WAVE = "M4.5 14c2 0 2.3-6 4.3-6s2.2 8 4.4 8 2.3-6 4.3-6h2";

const html = `<!doctype html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;650&display=block" rel="stylesheet">
<style>
  html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: #fff; }
  body { font-family: Inter, sans-serif; -webkit-font-smoothing: antialiased; }
  svg.line { position: absolute; inset: 0; }
  .text { position: absolute; left: 1030px; top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center; color: #101418; }
  .name { display: flex; align-items: center; gap: 16px; font-size: 46px; font-weight: 650; letter-spacing: -0.02em; }
  .name svg { width: 52px; height: 52px; flex: none; }
  .tagline { margin: 14px 0 0 68px; font-size: 22px; color: #4f5964; }
  .note { position: absolute; left: ${LINE.right - 330}px; width: 330px; text-align: right; top: ${LINE.bottom + 28}px; font-size: 12px; color: #9aa2ab; }
</style></head>
<body>
<svg class="line" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <path d="${path}" fill="none" stroke="#1d4ed8" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity="0.85"/>
  <circle cx="${x(last).toFixed(1)}" cy="${y(smooth[last]).toFixed(1)}" r="4" fill="#1d4ed8"/>
</svg>
<div class="text">
  <div class="name"><svg viewBox="0 0 24 24"><rect x="1" y="1" width="22" height="22" rx="6" fill="#1d4ed8"/><path d="${WAVE}" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>Open Power Lab</div>
  <div class="tagline">${TAGLINE}</div>
</div>
<div class="note">Day-ahead price, 7-day average, ${span}</div>
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
