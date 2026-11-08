// The texture on the Overview: real data drawn as a field of small squares.
// One column per farm (biggest losers only, north on the left), one row per day (earliest
// at the top). A square's size is the share of that farm's energy turned down that day;
// its colour says whether the loss was mostly constraint or curtailment. The chosen
// month is at full strength, the rest fades back.

import * as d3 from "npm:d3";

const MOST_FARMS = 110;

export function dotField(farmDaily, places, {width, month}) {
  const height = Math.round(width * 0.68);
  const style = getComputedStyle(document.documentElement);
  const constraint = style.getPropertyValue("--constraint").trim();
  const curtailment = style.getPropertyValue("--curtailment").trim();

  const north = new Map(places.filter((d) => d.located_by).map((d) => [d.unit, d.lat]));
  const lost = d3.rollup(farmDaily, (v) => d3.sum(v, (d) => d.lost_mwh), (d) => d.unit);
  const units = [...lost.keys()]
    .sort((a, b) => d3.descending(lost.get(a), lost.get(b)))
    .slice(0, MOST_FARMS)
    .sort((a, b) => d3.descending(north.get(a) ?? 0, north.get(b) ?? 0));
  const column = new Map(units.map((unit, i) => [unit, i]));
  const days = [...new Set(farmDaily.map((d) => +d.day))].sort(d3.ascending);
  const row = new Map(days.map((day, i) => [day, i]));

  const pitchX = width / units.length;
  const pitchY = height / days.length;
  const biggest = Math.min(pitchX, pitchY) * 0.95;

  const canvas = document.createElement("canvas");
  const scale = window.devicePixelRatio || 1;
  canvas.width = width * scale;
  canvas.height = height * scale;
  canvas.style.height = `${height}px`;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "A field of dots, one per farm per day, sized by the share of energy turned down.");
  const context = canvas.getContext("2d");
  context.scale(scale, scale);

  for (const d of farmDaily) {
    const x = column.get(d.unit);
    if (x === undefined || !(d.dispatch_down_pct >= 3)) continue;
    const size = Math.max(1, biggest * Math.sqrt(Math.min(d.dispatch_down_pct, 80) / 80));
    const inMonth = d.day.getUTCFullYear() === month.getUTCFullYear() && d.day.getUTCMonth() === month.getUTCMonth();
    context.globalAlpha = inMonth ? 1 : 0.24;
    context.fillStyle = d.constraint_mwh >= d.curtailment_mwh ? constraint : curtailment;
    context.fillRect(
      x * pitchX + (pitchX - size) / 2,
      row.get(+d.day) * pitchY + (pitchY - size) / 2,
      size,
      size
    );
  }
  return canvas;
}
