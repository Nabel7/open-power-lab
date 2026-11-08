---
title: Irish Power Lab
---

```js
import {COLOURS, monthName, percent, gwh, key} from "./components/format.js";
import {dotField} from "./components/dotfield.js";

const monthly = FileAttachment("dispatch-down/data/monthly.csv").csv({typed: true});
const farms = FileAttachment("dispatch-down/data/farms.csv").csv({typed: true});
const farmDaily = FileAttachment("dispatch-down/data/farm_daily.csv").csv({typed: true});
const places = FileAttachment("dispatch-down/data/farm_locations.csv").csv({typed: true});
```

```js
// The latest month with most of its days covered, as on the Dispatch-down page.
const allMonths = monthly.filter((d) => d.region === "ALL");
const solar = new Set(farms.filter((d) => d.technology === "solar").map((d) => d.unit));
const windDaily = farmDaily.filter((d) => !solar.has(d.unit));
const latest = allMonths.filter((d) => d.days_with_data >= 0.8 * d.days_in_month).at(-1) ?? allMonths.at(-1);
```

<div class="hero">
  <div>
    <p class="eyebrow">Irish Power Lab</p>
    <h1>Open analysis of the Irish power market</h1>
    <p class="lede">Independent projects built from public data on Ireland's single electricity market: what happened, why, and how well it can be predicted. Every method and data file is published.</p>
  </div>
  <figure class="hero-art">
    ${resize((width) => (dark, dotField(windDaily, places, {width, month: latest.month})))}
    <figcaption class="label"><span>Dispatch-down: each square is one farm, one day</span><span>${key(COLOURS.constraint)}Constraint</span><span>${key(COLOURS.curtailment)}Curtailment</span></figcaption>
  </figure>
</div>

<div class="section" id="projects">
  <div class="section-head">
    <div>
      <p class="label" style="margin-bottom: 0.8rem;">Projects</p>
      <h2 class="section-title">One market, four questions</h2>
    </div>
  </div>
  <div class="projects">
    <a class="project" href="./dispatch-down/">
      <div class="label"><span>01</span><span class="status live">Available</span></div>
      <h3>Dispatch-down</h3>
      <p>How much wind power was turned down, why, and at which farms?</p>
      <div class="figure">${monthName(latest.month)}: <strong>${percent(latest.dispatch_down_pct)}</strong> turned down · ${gwh(latest.lost_mwh)} lost →</div>
    </a>
    <div class="project planned">
      <div class="label"><span>02</span><span class="status">Planned</span></div>
      <h3>Prices</h3>
      <p>What drove day-ahead prices this month?</p>
    </div>
    <div class="project planned">
      <div class="label"><span>03</span><span class="status">Planned</span></div>
      <h3>Forecast scoreboard</h3>
      <p>Whose forecasts of wind and price are actually good, tested the same way?</p>
    </div>
    <div class="project planned">
      <div class="label"><span>04</span><span class="status">Planned</span></div>
      <h3>Grid model</h3>
      <p>What happens to prices and curtailment if the system changes?</p>
    </div>
  </div>
</div>
