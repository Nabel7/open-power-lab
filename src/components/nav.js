// Highlight the current page's link in the top bar. Each page imports this file.
// Farm pages (/farms/...) count as Farms; anything not matched is the Overview.

const here = location.pathname.replace(/\.html$/, "").replace(/\/index$/, "/");
const links = [...document.querySelectorAll(".site-nav a")];
const current =
  links.find((link) => link.dataset.page === "/farms/" && /\/farms(\/|$)/.test(here)) ??
  links.find((link) => link.dataset.page !== "/" && link.dataset.page !== "/farms/" && here.endsWith(link.dataset.page)) ??
  links.find((link) => link.dataset.page === "/");
for (const link of links) link.classList.toggle("active", link === current);
