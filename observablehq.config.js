// Site settings for Observable Framework: https://observablehq.com/framework/config

import {readdirSync} from "node:fs";

// One page per wind farm, from the template src/dispatch-down/farms/[farm].md: one for each
// data file in src/dispatch-down/data/farms/ (written by isem-data's tracker command).
const farmPages = readdirSync("src/dispatch-down/data/farms")
  .filter((file) => file.endsWith(".json"))
  .map((file) => `/dispatch-down/farms/${file.replace(/\.json$/, "")}`);

// The lab's name. It appears here and on the home page (src/index.md).
const LAB = "Irish Power Lab";

// A small wind turbine for the top bar: three blades round a hub, on a mast.
const turbine = `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
  <line x1="16" y1="14" x2="16" y2="30"/>
  <line x1="16" y1="13" x2="16" y2="3"/>
  <line x1="16" y1="13" x2="7.3" y2="18"/>
  <line x1="16" y1="13" x2="24.7" y2="18"/>
  <circle cx="16" cy="13" r="2" fill="currentColor" stroke="none"/>
</svg>`;

// The top bar. On the home page it lists the lab's sections; inside a project it shows the
// project's name and its own pages. Links start with / so they work from any page;
// Framework makes them relative.
function header({path}) {
  const brand = `<a class="brand" href="/"><span class="mark">${turbine}</span><span class="brand-text">${LAB}</span></a>`;
  if (path.startsWith("/dispatch-down")) {
    return `${brand}<span class="brand-sep" aria-hidden="true">/</span><a class="brand-project" href="/dispatch-down/">Dispatch-down</a>
<nav class="site-nav">
  <a href="/dispatch-down/" data-page="/dispatch-down/">Overview</a>
  <a href="/dispatch-down/map" data-page="/dispatch-down/map">Map</a>
  <a href="/dispatch-down/farms/" data-page="/dispatch-down/farms/">Farms</a>
  <a href="/dispatch-down/methods" data-page="/dispatch-down/methods">Methods</a>
</nav>
<a class="cta" href="/dispatch-down/methods#download-the-data">Get the data</a>`;
  }
  return `${brand}
<nav class="site-nav">
  <a href="/#projects">Projects</a>
  <a href="/dispatch-down/">Dispatch-down</a>
</nav>`;
}

export default {
  title: LAB,
  root: "src",
  style: "style.css",

  // A top bar instead of a sidebar. Project pages mark their own link active (components/nav.js).
  sidebar: false,
  pager: false,
  toc: false,
  search: false,
  pages: [
    {name: "Dispatch-down", path: "/dispatch-down/"},
    {name: "Map", path: "/dispatch-down/map"},
    {name: "Farms", path: "/dispatch-down/farms/"},
    {name: "Methods & data", path: "/dispatch-down/methods"}
  ],
  dynamicPaths: farmPages,

  header,

  head:
    '<meta name="description" content="Independent analysis of the Irish electricity market, built from public data.">' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',

  // The EirGrid Group Open Data Licence asks for this credit, and for no suggestion of endorsement.
  footer:
    "Supported by EirGrid Group Data. Farm positions © OpenStreetMap contributors. " +
    "Independent; not affiliated with or endorsed by EirGrid, SONI or SEMO. " +
    'Figures are estimates from public data: see <a href="/dispatch-down/methods">Methods &amp; data</a>.'
};
