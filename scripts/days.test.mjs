// Run with: node --test scripts/
import assert from "node:assert/strict";
import test from "node:test";
import {irishClock, relativeDay} from "../src/components/days.js";

test("a day is named by the reader's date in Ireland", () => {
  const evening = new Date("2026-11-20T21:00Z"); // 21:00 on Friday 20 Nov in Ireland
  assert.equal(relativeDay("2026-11-21", evening), "Tomorrow");
  assert.equal(relativeDay("2026-11-20", evening), "Today");
  assert.equal(relativeDay("2026-11-19", evening), "Yesterday");
  assert.equal(relativeDay("2026-11-23", evening), "");
  assert.equal(relativeDay(new Date("2026-11-21T00:00Z"), evening), "Tomorrow");
});

test("in summer, 23:30 UTC is already the next day in Ireland", () => {
  const lateSummer = new Date("2026-07-31T23:30Z"); // 00:30 on 1 Aug in Ireland
  assert.equal(relativeDay("2026-08-01", lateSummer), "Today");
  assert.equal(relativeDay("2026-08-02", lateSummer), "Tomorrow");
});

test("clock times are Irish time, 24-hour", () => {
  assert.equal(irishClock(new Date("2026-11-20T17:00Z")), "17:00");
  assert.equal(irishClock(new Date("2026-08-01T22:00Z")), "23:00");
  assert.equal(irishClock(new Date("2026-11-20T00:00Z")), "00:00");
});
