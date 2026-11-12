// Checks for the battery simulator's optimiser (src/components/battery.js).
// Run: node --test scripts/battery.test.mjs

import assert from "node:assert/strict";
import test from "node:test";
import {bestDay} from "../src/components/battery.js";

// Try every possible schedule (charge / rest / discharge each half-hour) and keep the best
// one the battery could physically follow. Only practical for a few half-hours.
function bruteForce(prices, {powerMw, hours, efficiency, cyclesPerDay}) {
  const blocks = Math.round(hours * 2);
  const maxOut = Math.round(cyclesPerDay * blocks);
  const mwh = powerMw * 0.5;
  let best = 0;
  const n = prices.length;
  for (let code = 0; code < 3 ** n; code++) {
    let c = code;
    let stored = 0;
    let out = 0;
    let money = 0;
    let ok = true;
    for (let t = 0; t < n && ok; t++) {
      const action = (c % 3) - 1; // -1, 0, +1
      c = Math.floor(c / 3);
      if (action === 1) {
        if (stored === 0 || out === maxOut) ok = false;
        else (stored -= 1), (out += 1), (money += prices[t] * mwh);
      } else if (action === -1) {
        if (stored === blocks) ok = false;
        else (stored += 1), (money -= (prices[t] * mwh) / efficiency);
      }
    }
    if (ok && money > best) best = money;
  }
  return best;
}

test("matches trying every schedule, on many random days", () => {
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let trial = 0; trial < 60; trial++) {
    const prices = Array.from({length: 8}, () => Math.round(random() * 300 - 30));
    const battery = {
      powerMw: 1 + Math.floor(random() * 10),
      hours: [0.5, 1, 1.5][trial % 3],
      efficiency: 0.7 + random() * 0.3,
      cyclesPerDay: [1, 2][trial % 2]
    };
    const got = bestDay(prices, battery).revenue;
    assert.ok(Math.abs(got - bruteForce(prices, battery)) < 1e-6, `trial ${trial}: ${got}`);
  }
});

test("buys low and sells high on a simple day", () => {
  // Cheap first hour, dear last hour: charge 2 half-hours, then discharge 2.
  const prices = [10, 10, 50, 50, 100, 100];
  const {revenue, actions} = bestDay(prices, {powerMw: 2, hours: 1, efficiency: 1, cyclesPerDay: 1});
  assert.deepEqual(actions, [-1, -1, 0, 0, 1, 1]);
  assert.equal(revenue, 2 * 0.5 * (100 + 100 - 10 - 10)); // 180
});

test("doesn't trade when the spread doesn't cover the losses", () => {
  const prices = [100, 110, 100, 110];
  const {revenue, actions} = bestDay(prices, {powerMw: 1, hours: 0.5, efficiency: 0.8, cyclesPerDay: 2});
  assert.equal(revenue, 0); // buying at 100 costs 125 after losses; selling earns 110
  assert.deepEqual(actions, [0, 0, 0, 0]);
});

test("earns from negative prices: paid to charge", () => {
  const {revenue} = bestDay([-20, 0], {powerMw: 1, hours: 0.5, efficiency: 1, cyclesPerDay: 1});
  assert.equal(revenue, 10); // paid €10 to take 0.5 MWh; selling it at €0 adds nothing
});

test("the cycle limit is respected", () => {
  const prices = [0, 100, 0, 100, 0, 100];
  const one = bestDay(prices, {powerMw: 1, hours: 0.5, efficiency: 1, cyclesPerDay: 1});
  const two = bestDay(prices, {powerMw: 1, hours: 0.5, efficiency: 1, cyclesPerDay: 2});
  assert.equal(one.actions.filter((a) => a === 1).length, 1);
  assert.equal(two.actions.filter((a) => a === 1).length, 2);
  assert.equal(two.revenue, 100);
});

test("a whole year of days takes well under a second", () => {
  const day = Array.from({length: 48}, (_, i) => 100 + 80 * Math.sin(i / 3));
  const start = performance.now();
  for (let d = 0; d < 365; d++) bestDay(day, {powerMw: 10, hours: 4, efficiency: 0.85, cyclesPerDay: 2});
  assert.ok(performance.now() - start < 1000);
});
