// Site settings for Observable Framework: https://observablehq.com/framework/config

import {readdirSync} from "node:fs";

// The site's name, set here only. General on purpose: Ireland is the first market, others may follow.
const SITE = "Open Power Lab";

// True asks search engines not to list the site (as while it was shown to a few people
// before launch, until 23 Nov 2026). The pages are listed in dist/sitemap.xml
// (scripts/sitemap.mjs), which is submitted in Google Search Console.
const HIDE_FROM_SEARCH = false;

const DESCRIPTION =
  "Independent data and analysis on the Irish electricity market (I-SEM): day-ahead prices, wind, demand, dispatch down and forecasts, built from public data.";

// One page per wind farm, from the template src/generation/dispatch-down/farms/[farm].md:
// one for each data file in src/generation/dispatch-down/data/farms/.
const farmPages = readdirSync("src/generation/dispatch-down/data/farms")
  .filter((file) => file.endsWith(".json"))
  .map((file) => `/generation/dispatch-down/farms/${file.replace(/\.json$/, "")}`);

// The menus. Each item is a page, or `soon` for one that is planned but not built (none
// are listed at the moment: placeholders make the site look unfinished).
// Links start with / so they work from any page; Framework makes them relative.
// A menu's `section` is the start of its pages' addresses, so a page knows its menu.
const MENUS = [
  {
    name: "Markets",
    section: "/markets",
    items: [
      {title: "Day-ahead prices", path: "/markets/day-ahead", note: "SEM day-ahead prices and volumes"},
      {title: "Wind & demand", path: "/generation/wind", note: "Output, share of demand, EirGrid's forecast"},
      {title: "Batteries", path: "/generation/batteries", note: "When the island's batteries charge and discharge"}
    ]
  },
  {
    name: "Dispatch down",
    section: "/generation/dispatch-down",
    items: [
      {title: "Monthly", path: "/generation/dispatch-down/", note: "Wind turned down, why and where, month by month"},
      {title: "Since 2016", path: "/generation/dispatch-down/history", note: "Ten years from EirGrid, adjusted for the weather"},
      {title: "Wind farms", path: "/generation/dispatch-down/farms/", note: "Every farm, with its own page"},
      {title: "Farm map", path: "/generation/dispatch-down/map", note: "Where wind is turned down"},
      {title: "Methods", path: "/generation/dispatch-down/methods", note: "How the figures are made, and how close they are"}
    ]
  },
  {
    name: "Forecasts",
    section: "/forecasts",
    items: [
      {title: "Price forecasts", path: "/forecasts/prices", note: "A pre-trained AI model forecasting tomorrow's prices, scored day by day"},
      {title: "Wind map", path: "/forecasts/wind-map", note: "Forecast wind over the island, hour by hour, and measured wind now"},
      {title: "EirGrid's wind forecast", path: "/forecasts/wind-forecast", note: "How accurate it is, from hours to days ahead"}
    ]
  },
  {
    name: "Tools",
    section: "/tools",
    items: [{title: "Battery simulator", path: "/tools/battery-simulator", note: "What a battery could earn on real prices"}]
  },
  {
    name: "Data",
    section: "/data",
    items: [{title: "Datasets", path: "/data", note: "What's here, where it comes from, downloads"}]
  }
];

// The logo: a day's price curve (a morning rise, a midday dip, the evening peak) in the
// site's blue. The same drawing is the browser-tab icon.
const WAVE = "M4.5 14c2 0 2.3-6 4.3-6s2.2 8 4.4 8 2.3-6 4.3-6h2";
const LOGO = `<svg class="logo" viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="1" width="22" height="22" rx="6" fill="var(--brand)"/><path d="${WAVE}" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
// Written without % escapes or # (Framework escapes the % again, and # would end the address).
const FAVICON = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect x='1' y='1' width='22' height='22' rx='6' fill='rgb(29,78,216)'/><path d='${WAVE}' fill='none' stroke='white' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/></svg>`;

const caret = `<svg class="caret" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;

function menuItem(item) {
  if (item.soon) {
    return `<span class="menu-link soon" aria-disabled="true"><span class="menu-title">${item.title}<span class="tag">Soon</span></span><span class="menu-note">${item.note}</span></span>`;
  }
  return `<a class="menu-link" href="${item.path}"><span class="menu-title">${item.title}</span><span class="menu-note">${item.note}</span></a>`;
}

const header = `<a class="brand" href="/" aria-label="${SITE}, home">
  ${LOGO}
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
    `<meta name="description" content="${DESCRIPTION}">` +
    // How the link looks when shared in a message or on LinkedIn.
    `<meta property="og:site_name" content="${SITE}"><meta property="og:title" content="${SITE}"><meta property="og:description" content="${DESCRIPTION}"><meta property="og:type" content="website">` +
    (HIDE_FROM_SEARCH ? '<meta name="robots" content="noindex, nofollow">' : "") +
    `<link rel="icon" type="image/svg+xml" href="${FAVICON}">` +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',

  // The EirGrid Group Open Data Licence asks for this credit, and for no suggestion of endorsement.
  footer: `<div class="footer-grid">
  <div><strong>${SITE}</strong><p>Independent analysis of the Irish electricity market, built from public data. Not affiliated with or endorsed by EirGrid, SONI, SEMO or SEMOpx.</p></div>
  <div><strong>Sources</strong><p>Supported by EirGrid Group Data. Farm positions © OpenStreetMap contributors. Figures are estimates; see <a href="/data">Datasets</a>.</p></div>
  <div><strong>Explore</strong><p><a href="/markets/day-ahead">Day-ahead prices</a> · <a href="/generation/wind">Wind &amp; demand</a> · <a href="/generation/dispatch-down/">Dispatch down</a> · <a href="/generation/dispatch-down/history">Since 2016</a> · <a href="/forecasts/prices">Price forecasts</a> · <a href="/forecasts/wind-map">Wind map</a> · <a href="/generation/batteries">Batteries</a></p></div>
</div>`
};
