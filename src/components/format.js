// Shared number formats and colours, so every page says things the same way.

import * as d3 from "npm:d3";
import {html} from "npm:htl";

// One colour per thing, always the same thing. These follow light and dark mode (style.css).
export const COLOURS = {
  constraint: "var(--constraint)",
  curtailment: "var(--curtailment)",
  ROI: "var(--roi)",
  NI: "var(--ni)"
};

// The same axes and type on every chart.
export const plotStyle = {
  fontFamily: "var(--monospace)",
  fontSize: "11px",
  color: "var(--ink-muted)",
  background: "transparent"
};

// A small square of colour for keys and legends.
export const key = (colour) => html`<span class="key" style="background: ${colour}"></span>`;

// The constraint / curtailment key, used next to most charts.
export const reasonKey = () =>
  html`<span class="label"><span>${key(COLOURS.constraint)}Constraint</span> <span>${key(COLOURS.curtailment)}Curtailment</span></span>`;

export const REGION_NAMES = {ALL: "All-island", ROI: "Ireland", NI: "Northern Ireland"};

export const monthName = d3.utcFormat("%B %Y");
export const shortMonth = d3.utcFormat("%b %Y");
export const dayName = d3.utcFormat("%-d %b");

export const percent = (x) => `${d3.format(".1f")(x)}%`;
export const gwh = (mwh) => `${d3.format(",.0f")(mwh / 1000)} GWh`;
export const euros = (eur) =>
  Math.abs(eur) >= 1e6
    ? `€${d3.format(".1f")(eur / 1e6)}m`
    : Math.abs(eur) >= 1e3
      ? `€${d3.format(".0f")(eur / 1e3)}k`
      : `€${d3.format(",.0f")(eur)}`;

// Energy for one farm: MWh when small, GWh from 1,000 MWh.
export const energy = (mwh) =>
  Math.abs(mwh) >= 1000
    ? `${d3.format(Math.abs(mwh) >= 100000 ? ",.0f" : ".1f")(mwh / 1000)} GWh`
    : `${d3.format(",.0f")(mwh)} MWh`;

// Share of available energy turned down, for any rows with produced and lost MWh.
export const shareDown = (rows) => {
  const lost = d3.sum(rows, (d) => d.lost_mwh);
  const available = lost + d3.sum(rows, (d) => d.produced_mwh);
  return available > 0 ? (100 * lost) / available : NaN;
};
