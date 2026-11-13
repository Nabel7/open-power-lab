// Checks for the wind map's grid sums (src/components/weather.js).
// Run: node --test scripts/weather.test.mjs

import assert from "node:assert/strict";
import test from "node:test";
import {BOUNDS, COLUMNS, ROWS, grid, speedAt} from "../src/components/weather.js";

test("the grid covers the island, north to south and west to east", () => {
  const points = grid();
  assert.equal(points.length, ROWS * COLUMNS);
  assert.ok(points[0].lat > points.at(-1).lat); // first row is the northernmost
  assert.ok(points[0].lon < points[1].lon); // west to east along a row
  for (const p of points) {
    assert.ok(p.lat > BOUNDS.south && p.lat < BOUNDS.north);
    assert.ok(p.lon > BOUNDS.west && p.lon < BOUNDS.east);
  }
});

test("at a grid point, the blended speed is that point's speed", () => {
  const points = grid();
  const speeds = points.map((_, i) => i % 7);
  for (const i of [0, 13, 50, points.length - 1]) {
    assert.ok(Math.abs(speedAt(points[i].lat, points[i].lon, speeds) - speeds[i]) < 1e-6);
  }
});

test("between points it blends, and a flat field stays flat", () => {
  const points = grid();
  const flat = points.map(() => 9);
  assert.ok(Math.abs(speedAt(53.4, -7.9, flat) - 9) < 1e-9);
  // Halfway between two neighbours in a row: halfway between their speeds.
  const speeds = points.map((p) => p.col); // speed rises one per column, west to east
  const a = points[3 * COLUMNS + 4];
  const b = points[3 * COLUMNS + 5];
  assert.ok(Math.abs(speedAt(a.lat, (a.lon + b.lon) / 2, speeds) - 4.5) < 1e-6);
});

test("outside the grid it uses the nearest edge, not nonsense", () => {
  const speeds = grid().map(() => 5);
  assert.ok(Math.abs(speedAt(60, -20, speeds) - 5) < 1e-9);
});
