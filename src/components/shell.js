// The site's frame, shared by every page: the top bar's menus, the "latest data" strip and
// search (⌘K). Each page imports this file once.

import {FileAttachment} from "observablehq:stdlib";
import "./motion.js";

const header = document.querySelector("#observablehq-header");

// The site's root URL, from the logo link (Framework makes it relative to this page).
const root = new URL(header.querySelector(".brand").getAttribute("href"), location.href);
const here = "/" + location.href.slice(root.href.length).replace(/[?#].*$/, "").replace(/(index)?(\.html)?$/, "");

// ---- Menus ----------------------------------------------------------------------------

const groups = [...header.querySelectorAll(".menu-group")];

// The menu this page belongs to: the one whose section it is in, or failing that the one
// with a link to it. Today (the home page) belongs to Markets.
const page = location.pathname.replace(/\.html$/, "");
const linksTo = (group) =>
  [...group.querySelectorAll("a.menu-link")].filter((link) => !link.hash && new URL(link.href).pathname === page);
const inSection = (group) =>
  here === group.dataset.section || here.startsWith(group.dataset.section + "/") || (group.dataset.section === "/markets" && here === "/");
const current = groups.find(inSection) ?? groups.find((group) => linksTo(group).length);
for (const group of groups) {
  group.classList.toggle("current", group === current);
  for (const link of linksTo(group)) link.setAttribute("aria-current", "page");
}

function closeMenus(except) {
  for (const group of groups) {
    if (group === except) continue;
    group.classList.remove("open");
    group.querySelector(".menu-button").setAttribute("aria-expanded", "false");
  }
}

for (const group of groups) {
  const button = group.querySelector(".menu-button");
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = !group.classList.contains("open");
    closeMenus(group);
    group.classList.toggle("open", open);
    button.setAttribute("aria-expanded", String(open));
  });
}
document.addEventListener("click", (event) => {
  if (!event.target.closest(".menu-group")) closeMenus();
});

// On a phone, one button shows and hides the whole menu.
const toggle = header.querySelector(".menu-toggle");
toggle.addEventListener("click", () => {
  const open = !header.classList.contains("menu-open");
  header.classList.toggle("menu-open", open);
  toggle.setAttribute("aria-expanded", String(open));
});

// ---- Latest data strip ------------------------------------------------------------------

const strip = header.querySelector(".strip");
const latestFile = FileAttachment("../data/markets/latest.json");
const at = (iso, options) =>
  new Date(iso).toLocaleString("en-IE", {timeZone: "Europe/Dublin", ...options});
const day = (date) => at(`${date}T12:00Z`, {day: "numeric", month: "short"});
const euro = (x) => `€${x.toFixed(2)}`;

latestFile.json().then((d) => {
  const up = d.price_avg_change >= 0;
  const link = (path, text) => `<a href="${new URL(path, root).href}">${text}</a>`;
  strip.innerHTML = [
    link(
      "markets/day-ahead",
      `<span class="strip-label">Day-ahead ${day(d.price_day)}</span> <b>${euro(d.price_avg)}</b>/MWh avg <span class="${up ? "up" : "down"}">${up ? "▲" : "▼"} ${euro(Math.abs(d.price_avg_change))}</span>`
    ),
    link("generation/wind", `<span class="strip-label">Wind ${day(d.system_day)}</span> <b>${d.wind_share.toFixed(0)}%</b> of demand`),
    link(
      "generation/wind",
      `<span class="strip-label">Latest ${at(d.system_last_utc, {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"})}</span> wind <b>${d.wind_mw.toLocaleString("en-IE")}</b> MW · demand <b>${d.demand_mw.toLocaleString("en-IE")}</b> MW`
    ),
    `<span class="strip-note">Data to ${at(d.system_last_utc, {day: "numeric", month: "short"})} · not live</span>`
  ].join("");
});

// ---- Search ---------------------------------------------------------------------------

const farmsFile = FileAttachment("../generation/dispatch-down/data/farms.csv");
let entries; // built the first time search opens

async function searchEntries() {
  if (entries) return entries;
  const pages = [...header.querySelectorAll(".menu-link")].map((link) => ({
    kind: link.classList.contains("soon") ? "Coming soon" : "Page",
    title: link.querySelector(".menu-title").firstChild.textContent,
    detail: link.querySelector(".menu-note").textContent,
    href: link.href ?? null
  }));
  const farms = await farmsFile.csv({typed: true});
  const byFarm = new Map();
  for (const d of farms) {
    const farm = byFarm.get(d.farm_id) ?? {units: [], companies: new Set(), region: d.region, technology: d.technology};
    farm.name = d.farm_name;
    farm.units.push(d.unit);
    if (d.company) farm.companies.add(d.company);
    byFarm.set(d.farm_id, farm);
  }
  const farmEntries = [...byFarm].map(([id, farm]) => ({
    kind: farm.technology === "solar" ? "Solar farm" : "Wind farm",
    title: farm.name,
    detail: [...farm.companies].join(", ") + " · " + farm.units.join(", "),
    href: new URL(`generation/dispatch-down/farms/${id}`, root).href
  }));
  const companies = [...new Set(farms.map((d) => d.company).filter(Boolean))].map((company) => ({
    kind: "Company",
    title: company,
    detail: `${farms.filter((d) => d.company === company).length} unit(s) · see its farms`,
    href: new URL(`generation/dispatch-down/farms/?q=${encodeURIComponent(company)}`, root).href
  }));
  entries = [...pages, ...farmEntries, ...companies];
  return entries;
}

function find(query, all) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return all.filter((d) => d.kind === "Page").slice(0, 10);
  return all
    .map((d) => {
      const title = d.title.toLowerCase();
      const text = `${title} ${d.detail.toLowerCase()} ${d.kind.toLowerCase()}`;
      if (!words.every((w) => text.includes(w))) return null;
      const score = (title.startsWith(words[0]) ? 0 : 1) + (words.every((w) => title.includes(w)) ? 0 : 1) + (d.kind === "Page" ? 0 : 0.5);
      return {...d, score};
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score || a.title.localeCompare(b.title))
    .slice(0, 12);
}

const dialog = document.createElement("div");
dialog.className = "search-dialog";
dialog.hidden = true;
dialog.innerHTML = `<div class="search-box" role="dialog" aria-modal="true" aria-label="Search">
  <input type="search" placeholder="Search farms, companies, pages…" autocomplete="off" spellcheck="false">
  <ul class="search-results" role="listbox"></ul>
  <div class="search-foot"><span><kbd>↑</kbd><kbd>↓</kbd> to move</span><span><kbd>↵</kbd> to open</span><span><kbd>esc</kbd> to close</span></div>
</div>`;
document.body.append(dialog);
const input = dialog.querySelector("input");
const list = dialog.querySelector(".search-results");
let results = [];
let selected = 0;

function render() {
  list.innerHTML = results.length
    ? results
        .map(
          (d, i) => `<li role="option" aria-selected="${i === selected}"><${d.href ? `a href="${d.href}"` : 'span class="result-soon"'}>
          <span class="result-kind">${d.kind}</span><span class="result-title">${d.title}</span><span class="result-detail">${d.detail}</span></${d.href ? "a" : "span"}></li>`
        )
        .join("")
    : `<li class="search-empty">Nothing found. Try a farm, a company, or a page such as "day-ahead".</li>`;
}

async function update() {
  results = find(input.value, await searchEntries());
  selected = 0;
  render();
}

async function openSearch() {
  dialog.hidden = false;
  document.documentElement.classList.add("search-open");
  input.value = "";
  input.focus();
  await update();
}

function closeSearch() {
  dialog.hidden = true;
  document.documentElement.classList.remove("search-open");
}

header.querySelector(".search-button").addEventListener("click", openSearch);
input.addEventListener("input", update);
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) closeSearch();
});
input.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    if (!results.length) return;
    selected = (selected + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length;
    render();
    list.querySelector('[aria-selected="true"]')?.scrollIntoView({block: "nearest"});
  } else if (event.key === "Enter" && results[selected]?.href) {
    location.href = results[selected].href;
  }
});
document.addEventListener("keydown", (event) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
  if ((event.key === "k" && (event.metaKey || event.ctrlKey)) || (event.key === "/" && !typing)) {
    event.preventDefault();
    dialog.hidden ? openSearch() : closeSearch();
  } else if (event.key === "Escape") {
    if (!dialog.hidden) closeSearch();
    closeMenus();
  }
});
