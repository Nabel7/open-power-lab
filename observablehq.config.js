// Site settings for Observable Framework: https://observablehq.com/framework/config

import {readdirSync} from "node:fs";

// One page per wind farm, from the template src/farms/[farm].md: one for each data file
// in src/data/farms/ (written by isem-data's tracker command).
const farmPages = readdirSync("src/data/farms")
  .filter((file) => file.endsWith(".json"))
  .map((file) => `/farms/${file.replace(/\.json$/, "")}`);

// A small wind turbine for the top bar: three blades round a hub, on a mast.
const turbine = `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
  <line x1="16" y1="14" x2="16" y2="30"/>
  <line x1="16" y1="13" x2="16" y2="3"/>
  <line x1="16" y1="13" x2="7.3" y2="18"/>
  <line x1="16" y1="13" x2="24.7" y2="18"/>
  <circle cx="16" cy="13" r="2" fill="currentColor" stroke="none"/>
</svg>`;

export default {
  title: "Irish Wind Dispatch-Down Tracker",
  root: "src",
  style: "style.css",

  // A top bar instead of a sidebar. Pages mark their own link active (components/nav.js).
  sidebar: false,
  pager: false,
  toc: false,
  search: false,
  pages: [
    {name: "Map", path: "/map"},
    {name: "Farms", path: "/farms/"},
    {name: "Methods & data", path: "/methods"}
  ],
  dynamicPaths: farmPages,

  // Links start with / so they work from farm pages too; Framework makes them relative.
  header: `<a class="brand" href="/">${turbine}<span>Irish Wind <span class="brand-long">Dispatch-Down </span>Tracker</span></a>
<nav class="site-nav">
  <a href="/" data-page="/">Overview</a>
  <a href="/map" data-page="/map">Map</a>
  <a href="/farms/" data-page="/farms/">Farms</a>
  <a href="/methods" data-page="/methods">Methods</a>
</nav>`,

  head:
    '<meta name="description" content="How much Irish wind power was turned down, why, and where. Built from public SEMO data.">' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',

  // The EirGrid Group Open Data Licence asks for this credit, and for no suggestion of endorsement.
  footer:
    "Supported by EirGrid Group Data. Farm positions © OpenStreetMap contributors. " +
    "Independent; not affiliated with or endorsed by EirGrid, SONI or SEMO. " +
    'Figures are estimates from public data: see <a href="/methods">Methods &amp; data</a>.'
};
