// Market news: short items written for this site, each linking its source. The items are
// in src/news/items.json, proposed each morning by the news desk agent and published only
// once Nab merges them (see the desk repository's agents/news-desk.md).

import * as d3 from "npm:d3";
import {html} from "npm:htl";

// The topics an item can have, in the order the News page lists them.
export const TOPICS = ["Market", "Wind", "Solar", "Storage", "Grid", "Policy"];

const day = d3.utcFormat("%-d %b %Y");

// Newest first, whatever order the file is in.
export const newest = (items) => [...items].sort((a, b) => d3.descending(a.date, b.date));

// Only http(s) links, so nothing in the file can run script.
const safe = (url) => (/^https?:\/\//.test(url ?? "") ? url : null);

export function newsItem(d) {
  const url = safe(d.url);
  return html`<article class="news-item">
    <div class="news-meta"><span class="news-topic">${d.topic}</span><time datetime=${d.date}>${day(new Date(`${d.date}T00:00Z`))}</time></div>
    <h3>${d.headline}</h3>
    <p>${d.summary}</p>
    ${url ? html`<a class="news-source" href=${url} target="_blank" rel="noopener">${d.source} ↗</a>` : html`<span class="news-source">${d.source}</span>`}
  </article>`;
}
