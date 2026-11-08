// Highlight the current page's link in the top bar. Project pages import this file.
// Farm pages count as Farms; anything not matched is the project's Overview.

const here = location.pathname.replace(/\.html$/, "").replace(/\/index$/, "/");
const links = [...document.querySelectorAll(".site-nav a[data-page]")];
const page = (name) => links.find((link) => link.dataset.page.endsWith(name));
const current = /\/farms(\/|$)/.test(here)
  ? page("/farms/")
  : (links.find((link) => !link.dataset.page.endsWith("/") && here.endsWith(link.dataset.page.split("/").pop())) ??
    links[0]);
for (const link of links) link.classList.toggle("active", link === current);
