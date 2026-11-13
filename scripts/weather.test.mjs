// Checks for the wind map's grid sums (src/components/weather.js).
// Run: node --test scripts/weather.test.mjs

import assert from "node:assert/strict";
import test from "node:test";
import {BOUNDS, COLUMNS, ROWS, PICTURE_WIDTH, PICTURE_HEIGHT, grid, speedAt, windField} from "../src/components/weather.js";

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

test("the smooth field is flat for flat wind, and close to the blended speed elsewhere", () => {
  const points = grid();
  const flat = windField(points.map(() => 6));
  assert.equal(flat.length, PICTURE_WIDTH * PICTURE_HEIGHT);
  assert.ok(flat.every((v) => Math.abs(v - 6) < 1e-4));
  // A smooth slope west to east: the curve and straight-line blending agree on a slope.
  const slope = points.map((p) => p.col);
  const field = windField(slope);
  const x = Math.round(PICTURE_WIDTH / 2) - 1;
  const y = Math.round(PICTURE_HEIGHT / 2);
  const lon = BOUNDS.west + ((x + 0.5) / PICTURE_WIDTH) * (BOUNDS.east - BOUNDS.west);
  assert.ok(Math.abs(field[y * PICTURE_WIDTH + x] - speedAt(53.4, lon, slope)) < 1e-3);
});

test("the picture keeps the map's proportions", () => {
  // Height over width in Mercator: the latitude span is stretched by about 1/cos(53°).
  const ratio = PICTURE_HEIGHT / PICTURE_WIDTH;
  const expected = (BOUNDS.north - BOUNDS.south) / Math.cos((53.4 * Math.PI) / 180) / (BOUNDS.east - BOUNDS.west);
  assert.ok(Math.abs(ratio - expected) / expected < 0.02);
});
