// Writes dist/sitemap.xml after `observable build`: every page of the built site, so
// search engines can find pages no menu links to (each wind farm's page, for instance).
// Submit it once in Google Search Console: https://nabel7.github.io/open-power-lab/sitemap.xml
//
// Run with: node scripts/sitemap.mjs   (the site build does this after building)

import {readdirSync, writeFileSync} from "node:fs";
import {join, relative, sep} from "node:path";
import {fileURLToPath} from "node:url";

// Where the site lives. Change this if it moves to its own domain.
export const SITE_URL = "https://nabel7.github.io/open-power-lab/";

// Built files that aren't pages.
const SKIP = new Set(["404.html"]);

// A built page's file (relative to dist, with /) and the address it is served at: the
// site uses clean addresses, so "markets/day-ahead.html" is ".../markets/day-ahead" and
// "generation/dispatch-down/index.html" is ".../generation/dispatch-down/".
export function pageUrl(file, base = SITE_URL) {
  const path = file.replace(/(^|\/)index\.html$/, "$1").replace(/\.html$/, "");
  return base + path;
}

// Every page in a built site folder, as files relative to it, in order.
export function pages(dist) {
  return readdirSync(dist, {recursive: true})
    .map((file) => relative(dist, join(dist, file)).split(sep).join("/"))
    .filter((file) => file.endsWith(".html") && !file.startsWith("_") && !SKIP.has(file))
    .sort();
}

export function sitemap(files, base = SITE_URL) {
  const urls = files.map((file) => `  <url><loc>${pageUrl(file, base)}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = fileURLToPath(new URL("../dist", import.meta.url));
  const files = pages(dist);
  writeFileSync(join(dist, "sitemap.xml"), sitemap(files));
  console.log(`sitemap.xml: ${files.length} pages`);
}
