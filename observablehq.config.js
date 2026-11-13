// Site settings for Observable Framework: https://observablehq.com/framework/config

import {readdirSync} from "node:fs";

// The site's name: a working title, set here only.
const SITE = "Irish Power Lab";

// One page per wind farm, from the template src/generation/dispatch-down/farms/[farm].md:
// one for each data file in src/generation/dispatch-down/data/farms/.
const farmPages = readdirSync("src/generation/dispatch-down/data/farms")
  .filter((file) => file.endsWith(".json"))
  .map((file) => `/generation/dispatch-down/farms/${file.replace(/\.json$/, "")}`);

// The menus. Each item is a page, or `soon` for one that is planned but not built.
// Links start with / so they work from any page; Framework makes them relative.
const MENUS = [
  {
    name: "Markets",
    section: "/markets",
    items: [
      {title: "Today", path: "/", note: "Prices, wind and demand at a glance"},
      {title: "Day-ahead", path: "/markets/day-ahead", note: "SEM day-ahead prices and volumes"},
      {title: "Intraday", soon: true, note: "IDA1, IDA2 and IDA3 auctions"},
      {title: "Imbalance", soon: true, note: "Balancing market settlement prices"}
    ]
  },
  {
    name: "Generation",
    section: "/generation",
    items: [
      {title: "Wind & demand", path: "/generation/wind", note: "Output, share of demand, EirGrid's forecast"},
      {title: "Dispatch-down", path: "/generation/dispatch-down/", note: "Wind turned down, why and where"},
      {title: "Wind farms", path: "/generation/dispatch-down/farms/", note: "Every farm, with its own page"},
      {title: "Farm map", path: "/generation/dispatch-down/map", note: "Where wind is turned down"},
      {title: "Batteries", path: "/generation/batteries", note: "When the island's batteries charge and discharge"},
      {title: "Interconnectors", soon: true, note: "Flows to and from Great Britain"}
    ]
  },
  {
    name: "Forecasts",
    section: "/forecasts",
    items: [
      {title: "Wind map", path: "/forecasts/wind-map", note: "Forecast wind speed over the island, hour by hour"},
      {title: "Wind forecast", path: "/generation/wind#forecast", note: "EirGrid's forecast against what happened"},
      {title: "Day-ahead price", soon: true, note: "Published before the auction, with ranges"},
      {title: "Scoreboard", soon: true, note: "Every forecast, scored the same way"}
    ]
  },
  {
    name: "Tools",
    section: "/tools",
    items: [
      {title: "Battery simulator", path: "/tools/battery-simulator", note: "What a battery could earn on real prices"},
      {title: "Price and wind explorer", soon: true, note: "How wind moves the price, half-hour by half-hour"}
    ]
  },
  {
    name: "Data",
    section: "/data",
    items: [
      {title: "Datasets", path: "/data", note: "What's here, where it comes from, downloads"},
      {title: "Dispatch-down methods", path: "/generation/dispatch-down/methods", note: "How the figures are made"},
      {title: "API", soon: true, note: "Programmatic access"}
    ]
  }
];

const caret = `<svg class="caret" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;

function menuItem(item) {
  if (item.soon) {
    return `<span class="menu-link soon" aria-disabled="true"><span class="menu-title">${item.title}<span class="tag">Soon</span></span><span class="menu-note">${item.note}</span></span>`;
  }
  return `<a class="menu-link" href="${item.path}"><span class="menu-title">${item.title}</span><span class="menu-note">${item.note}</span></a>`;
}

const header = `<a class="brand" href="/" aria-label="${SITE}, home">
  <svg class="logo" viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="1" width="22" height="22" rx="6" fill="currentColor"/><path d="M12 12.5V20M12 12.5l0-7.5M12 12.5l-6.4 3.7M12 12.5l6.4 3.7" stroke="var(--page)" stroke-width="1.8" stroke-linecap="round"/></svg>
  <span>${SITE}</span>
</a>
<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-menu" aria-label="Menu">
  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
</button>
<nav class="menu" id="site-menu" aria-label="Main">
${MENUS.map(
  (menu) => `  <div class="menu-group" data-section="${menu.section}">
    <button class="menu-button" type="button" aria-expanded="false">${menu.name}${caret}</button>
    <div class="menu-panel">${menu.items.map(menuItem).join("")}</div>
  </div>`
).join("\n")}
</nav>
<button class="search-button" type="button" aria-label="Search">
  <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M13 13l4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
  <span class="search-text">Search farms, pages, companies</span><kbd>⌘K</kbd>
</button>
<div class="strip" aria-label="Latest market data"></div>`;

export default {
  title: SITE,
  root: "src",
  style: "style.css",

  // Our own top bar with menus, instead of Framework's sidebar.
  sidebar: false,
  pager: false,
  toc: false,
  search: false,
  pages: MENUS.flatMap((menu) => menu.items.filter((item) => item.path && !item.path.includes("#")).map((item) => ({name: item.title, path: item.path}))),
  dynamicPaths: farmPages,

  header,

  head:
    '<meta name="description" content="Independent data and analysis on the Irish electricity market (I-SEM): day-ahead prices, wind, demand, dispatch-down and forecasts, built from public data.">' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',

  // The EirGrid Group Open Data Licence asks for this credit, and for no suggestion of endorsement.
  footer: `<div class="footer-grid">
  <div><strong>${SITE}</strong><p>Independent analysis of the Irish electricity market, built from public data. Not affiliated with or endorsed by EirGrid, SONI, SEMO or SEMOpx.</p></div>
  <div><strong>Sources</strong><p>Supported by EirGrid Group Data. Farm positions © OpenStreetMap contributors. Figures are estimates; see <a href="/data">Datasets</a>.</p></div>
  <div><strong>Explore</strong><p><a href="/markets/day-ahead">Day-ahead prices</a> · <a href="/generation/wind">Wind &amp; demand</a> · <a href="/generation/dispatch-down/">Dispatch-down</a></p></div>
</div>`
};
