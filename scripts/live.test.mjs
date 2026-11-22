// Run with: node --test scripts/
import assert from "node:assert/strict";
import test from "node:test";
import {irishDay} from "../src/components/days.js";
import {fetchForecast, widen} from "../src/components/live.js";

test("tomorrow is by the date in Ireland", () => {
  assert.equal(irishDay(1, new Date("2026-11-22T07:30Z")), "2026-11-23");
  assert.equal(irishDay(0, new Date("2026-07-31T23:30Z")), "2026-08-01"); // 00:30 in Ireland
  assert.equal(irishDay(1, new Date("2026-03-28T12:00Z")), "2026-03-29"); // the clocks go forward
});

const ROWS = [
  {timestamp_utc: "2026-11-22T23:30Z", method: "chronos2_wind", low: 90, median: 100, high: 110},
  {timestamp_utc: "2026-11-22T23:00Z", method: "chronos2_wind", low: 80, median: 95, high: 105},
  {timestamp_utc: "2026-11-22T23:00Z", method: "week_average", low: null, median: 120, high: null}
];

test("a forecast file becomes one row per half-hour, in time order", () => {
  const rows = widen(ROWS, "2026-11-23");
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    timestamp_utc: new Date("2026-11-22T23:00Z"),
    day: "2026-11-23",
    chronos2_wind: 95,
    chronos2_wind_low: 80,
    chronos2_wind_high: 105,
    week_average: 120
  });
  assert.equal(rows[1].chronos2_wind, 100);
});

test("a day not saved yet, or GitHub out of reach, gives null", async () => {
  const missing = async () => ({ok: false});
  assert.equal(await fetchForecast("2026-11-23", () => [], missing), null);
  const down = async () => {
    throw new TypeError("network");
  };
  assert.equal(await fetchForecast("2026-11-23", () => [], down), null);
});

test("a saved day comes back with its details", async () => {
  const get = async (url) => ({
    ok: true,
    json: async () => ({day: "2026-11-23", in_time: true}),
    text: async () => (url.endsWith(".csv") ? "csv" : "")
  });
  const got = await fetchForecast("2026-11-23", () => ROWS, get);
  assert.equal(got.info.in_time, true);
  assert.equal(got.rows.length, 2);
});
