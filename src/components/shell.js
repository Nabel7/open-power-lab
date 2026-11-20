// The site's frame, shared by every page: the top bar's menus, the "latest data" strip and
// search (⌘K). Each page imports this file once.

import {FileAttachment} from "observablehq:stdlib";
import "./motion.js";
import {escapeHtml} from "./format.js";

const header = document.querySelector("#observablehq-header");

// The site's root URL, from the logo link (Framework makes it relative to this page).
const root = new URL(header.querySelector(".brand").getAttribute("href"), location.href);
const here = "/" + location.href.slice(root.href.length).replace(/[?#].*$/, "").replace(/(index)?(\.html)?$/, "");

// ---- Menus ----------------------------------------------------------------------------

const groups = [...header.querySelectorAll(".menu-group")];

// The menu this page belongs to: the one whose section its address is in (the longest
// match, so a dispatch-down page belongs to Dispatch-down even though its address starts
// /generation), or failing that the one with a link to it. The home page has none.
const page = location.pathname.replace(/\.html$/, "");
const linksTo = (group) =>
  [...group.querySelectorAll("a.menu-link")].filter((link) => !link.hash && new URL(link.href).pathname === page);
const inSection = (group) => here === group.dataset.section || here.startsWith(group.dataset.section + "/");
const current =
  groups.filter(inSection).sort((a, b) => b.dataset.section.length - a.dataset.section.length)[0] ??
  groups.find((group) => linksTo(group).length);
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

// ---- Section tabs -------------------------------------------------------------------------

// Dispatch-down has several pages, so they get tabs along the top, made from the same
// links as its menu. A farm's own page counts as part of "Wind farms".
const TABBED = "/generation/dispatch-down";
const tabbed = groups.find((group) => group.dataset.section === TABBED);
if (tabbed && (here === TABBED || here.startsWith(TABBED + "/"))) {
  const tabs = document.createElement("nav");
  tabs.className = "section-tabs";
  tabs.setAttribute("aria-label", "Dispatch-down pages");
  for (const link of tabbed.querySelectorAll("a.menu-link")) {
    const path = new URL(link.href).pathname.replace(/\.html$/, "");
    const tab = document.createElement("a");
    tab.href = link.href;
    tab.textContent = link.querySelector(".menu-title").textContent;
    const isFarms = path.endsWith("/farms/") && location.pathname.includes("/farms/");
    if (path === page || isFarms) tab.setAttribute("aria-current", "page");
    tabs.append(tab);
  }
  document.querySelector("#observablehq-main")?.prepend(tabs);
}

// ---- Latest data strip ------------------------------------------------------------------

// A ticker of the latest figures, moving slowly from right to left. It pauses while the
// pointer is over it, and stays still for people whose device asks for less motion.

const strip = header.querySelector(".strip");
const latestFile = FileAttachment("../data/markets/latest.json");
const ddFile = FileAttachment("../generation/dispatch-down/data/monthly.csv");
const at = (iso, options) =>
  new Date(iso).toLocaleString("en-IE", {timeZone: "Europe/Dublin", ...options});
const day = (date) => at(`${date}T12:00Z`, {day: "numeric", month: "short"});
const euro = (x) => `€${x.toLocaleString("en-IE", {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
const number = (x) => x.toLocaleString("en-IE");

Promise.all([latestFile.json(), ddFile.csv({typed: true})]).then(([d, dd]) => {
  const up = d.price_avg_change >= 0;
  const link = (path, label, value) =>
    `<a class="tick" href="${new URL(path, root).href}"><span class="strip-label">${label}</span> ${value}</a>`;
  const island = dd.filter((r) => r.region === "ALL");
  const month = island.filter((r) => r.days_with_data >= 0.8 * r.days_in_month).at(-1) ?? island.at(-1);
  const monthName = month.month.toLocaleDateString("en-IE", {month: "long", timeZone: "UTC"});
  // ENTSO-E's newest day ahead of SEMO's results (usually tomorrow), named by the
  // reader's date, so a page built yesterday still says "Tomorrow" correctly.
  const ahead = (d.ahead ?? []).at(-1);
  const today = new Intl.DateTimeFormat("en-CA", {timeZone: "Europe/Dublin"}).format(new Date());
  const offset = ahead ? Math.round((Date.parse(`${ahead.day}T00:00Z`) - Date.parse(`${today}T00:00Z`)) / 864e5) : null;
  const aheadName = {0: "Today", 1: "Tomorrow"}[offset] ?? "Day-ahead";
  const items = [
    ...(ahead ? [link("markets/day-ahead", `${aheadName} ${day(ahead.day)}`, `<b>${euro(ahead.avg)}</b>/MWh`)] : []),
    link("markets/day-ahead", `Day-ahead ${day(d.price_day)}`, `<b>${euro(d.price_avg)}</b>/MWh <span class="${up ? "up" : "down"}">${up ? "▲" : "▼"} ${euro(Math.abs(d.price_avg_change))}</span>`),
    link("markets/day-ahead", "Range", `<b>${euro(d.price_low)}</b> – <b>${euro(d.price_high)}</b>`),
    link("markets/day-ahead", "Volume-weighted", `<b>${euro(d.price_vwap)}</b>/MWh`),
    link("generation/wind", `Wind ${day(d.system_day)}`, `<b>${d.wind_share.toFixed(0)}%</b> of demand`),
    link("generation/wind", `Wind ${at(d.system_last_utc, {hour: "2-digit", minute: "2-digit"})}`, `<b>${number(d.wind_mw)}</b> MW`),
    link("generation/wind", "Demand", `<b>${number(d.demand_mw)}</b> MW`),
    link("generation/dispatch-down/", `Wind turned down, ${monthName}`, `<b>${month.dispatch_down_pct.toFixed(1)}%</b>`)
  ].join('<span class="tick-dot" aria-hidden="true">·</span>');
  // The items twice in a row, so the loop has no visible join.
  strip.innerHTML = `<div class="ticker"><div class="ticker-track">
      <div class="ticker-group">${items}</div>
      <div class="ticker-group" aria-hidden="true">${items.replaceAll('<a class="tick"', '<a class="tick" tabindex="-1"')}</div>
    </div></div>
    <span class="strip-note">Data to ${at(d.system_last_utc, {day: "numeric", month: "short"})} · not live</span>`;
  // A steady reading speed whatever the screen width: about 40 pixels a second.
  const track = strip.querySelector(".ticker-track");
  requestAnimationFrame(() => {
    const width = strip.querySelector(".ticker-group").getBoundingClientRect().width;
    track.style.animationDuration = `${Math.max(20, width / 40)}s`;
    track.classList.add("moving");
  });
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
          (d, i) => `<li role="option" aria-selected="${i === selected}"><${d.href ? `a href="${escapeHtml(d.href)}"` : 'span class="result-soon"'}>
          <span class="result-kind">${escapeHtml(d.kind)}</span><span class="result-title">${escapeHtml(d.title)}</span><span class="result-detail">${escapeHtml(d.detail)}</span></${d.href ? "a" : "span"}></li>`
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
