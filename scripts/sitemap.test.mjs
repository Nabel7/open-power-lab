// Run with: node --test scripts/
import assert from "node:assert/strict";
import {mkdirSync, mkdtempSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {pageUrl, pages, sitemap} from "./sitemap.mjs";

test("a page's address has no .html, and a folder's index is the folder", () => {
  const base = "https://example.org/site/";
  assert.equal(pageUrl("index.html", base), "https://example.org/site/");
  assert.equal(pageUrl("markets/day-ahead.html", base), "https://example.org/site/markets/day-ahead");
  assert.equal(pageUrl("generation/dispatch-down/index.html", base), "https://example.org/site/generation/dispatch-down/");
});

test("only pages are listed: not 404.html or Framework's _files", () => {
  const dist = mkdtempSync(join(tmpdir(), "dist-"));
  for (const file of ["index.html", "404.html", "data.html", "_file/x.html", "_npm/y.js", "markets/day-ahead.html"]) {
    mkdirSync(join(dist, file, ".."), {recursive: true});
    writeFileSync(join(dist, file), "");
  }
  assert.deepEqual(pages(dist), ["data.html", "index.html", "markets/day-ahead.html"]);
});

test("the sitemap lists each address once", () => {
  const xml = sitemap(["index.html", "data.html"], "https://example.org/");
  assert.match(xml, /<loc>https:\/\/example\.org\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/example\.org\/data<\/loc>/);
  assert.equal(xml.match(/<url>/g).length, 2);
});
