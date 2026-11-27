---
title: Market news
---

```js
import "../components/shell.js";
import {TOPICS, newest, newsItem} from "../components/news.js";

const news = FileAttachment("items.json").json();
```

<div class="page-head">
  <h1>Market news</h1>
  <p class="lede">What's changing in the all-island electricity market: new wind, solar and battery projects, grid developments, market rules and policy, in brief.</p>
</div>

```js
const items = newest(news.items);
const topics = TOPICS.filter((t) => items.some((d) => d.topic === t));
const topic = items.length ? view(Inputs.radio(["All", ...topics], {value: "All"})) : "All";
```

```js
const shown = topic === "All" ? items : items.filter((d) => d.topic === topic);
display(
  shown.length
    ? html`${d3.groups(shown, (d) => d.date.slice(0, 7)).map(([month, rows]) => html`<div class="section">
        <div class="section-head"><h2>${d3.utcFormat("%B %Y")(new Date(`${month}-01T00:00Z`))}</h2></div>
        <div class="news-list">${rows.map(newsItem)}</div>
      </div>`)}`
    : html`<p class="muted">The first items will appear here shortly.</p>`
);
```
