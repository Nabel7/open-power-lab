// Checks for the wind streaks' sums (src/components/streaks.js).
// Run: node --test scripts/streaks.test.mjs

import assert from "node:assert/strict";
import test from "node:test";
import {COLUMNS, ROWS} from "../src/components/weather.js";
import {windAt, windVectors} from "../src/components/streaks.js";

const near = (a, b) => Math.abs(a - b) < 1e-9;

test("wind FROM the west blows east, FROM the north blows south (down the canvas)", () => {
  const [west, north] = windVectors([10, 10], [270, 0]);
  assert.ok(near(west.east, 10) && near(west.south, 0));
  assert.ok(near(north.east, 0) && near(north.south, 10));
});

test("a uniform wind is the same everywhere on the canvas, edges included", () => {
  const vectors = windVectors(Array(ROWS * COLUMNS).fill(8), Array(ROWS * COLUMNS).fill(225));
  for (const [x, y] of [[0, 0], [400, 120], [799, 299], [-50, 500]]) {
    const w = windAt(x, y, 800, 300, vectors);
    assert.ok(near(w.east, vectors[0].east) && near(w.south, vectors[0].south));
  }
});

test("halfway between two grid columns it blends the two", () => {
  const speeds = Array.from({length: ROWS * COLUMNS}, (_, i) => (i % COLUMNS === 0 ? 0 : 10));
  const vectors = windVectors(speeds, Array(ROWS * COLUMNS).fill(270));
  const width = COLUMNS * 100;
  const w = windAt(100, 50, width, ROWS * 100, vectors); // between column 0 (0 m/s) and 1 (10)
  assert.ok(near(w.east, 5));
});
