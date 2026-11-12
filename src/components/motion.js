// Small animations: charts draw themselves when they come into view, headline numbers count
// up, and blocks further down the page rise in as you scroll. Imported by shell.js, so every
// page gets it. Does nothing for people whose device asks for less motion.

const quiet = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const main = document.querySelector("#observablehq-main");

// Play an animation once the element is on screen.
const whenSeen = new Map();
const watcher = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      watcher.unobserve(entry.target);
      whenSeen.get(entry.target)?.();
      whenSeen.delete(entry.target);
    }
  },
  {rootMargin: "0px 0px -8% 0px"}
);
function onSeen(element, play) {
  whenSeen.set(element, play);
  watcher.observe(element);
}

// ---- Charts ------------------------------------------------------------------------------

const drawn = new WeakSet(); // chart containers already animated (a resize redraw doesn't replay)

function animateChart(svg) {
  const holder = svg.parentElement;
  if (!holder || drawn.has(holder)) return;
  drawn.add(holder);
  const bars = svg.querySelectorAll('g[aria-label="bar"] rect, g[aria-label="rect"] rect');
  if (bars.length && bars.length <= 500 && !svg.querySelector('g[aria-label="line"], g[aria-label="area"]')) {
    // Bars grow from the axis, a few at a time from left to right.
    svg.style.visibility = "hidden";
    onSeen(svg, () => {
      bars.forEach((bar, i) => (bar.style.animationDelay = `${Math.min(i * 6, 360)}ms`));
      svg.querySelectorAll('g[aria-label="bar"], g[aria-label="rect"]').forEach((g) => g.classList.add("grow"));
      svg.style.visibility = "";
    });
  } else {
    // Everything else is revealed from left to right, as if drawn.
    svg.style.clipPath = "inset(0 100% 0 0)";
    onSeen(svg, () => {
      svg.animate([{clipPath: "inset(0 100% 0 0)"}, {clipPath: "inset(0 0 0 0)"}], {
        duration: 900,
        easing: "cubic-bezier(0.3, 0.6, 0.2, 1)"
      }).finished.finally(() => (svg.style.clipPath = ""));
    });
  }
}

// ---- Numbers ------------------------------------------------------------------------------

const counted = new WeakMap(); // value element -> the text it last counted up to

function countUp(element) {
  const node = [...element.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && /\d/.test(n.textContent));
  if (!node) return;
  const text = node.textContent;
  if (counted.get(element) === text) return;
  counted.set(element, text);
  const match = text.match(/^(.*?)(\d[\d,]*(?:\.\d+)?)(.*)$/s);
  if (!match) return;
  const [, before, number, after] = match;
  const target = parseFloat(number.replace(/,/g, ""));
  const decimals = (number.split(".")[1] ?? "").length;
  const commas = number.includes(",");
  const format = (x) =>
    x.toLocaleString("en-IE", {minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: commas});
  const start = performance.now();
  const duration = 800;
  const step = (now) => {
    if (counted.get(element) !== text) return; // the value changed while counting
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    node.textContent = t < 1 ? `${before}${format(target * eased)}${after}` : text;
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---- Blocks further down -------------------------------------------------------------------

function reveal(element) {
  if (element.dataset.revealed) return;
  element.dataset.revealed = "1";
  const box = element.getBoundingClientRect();
  if (box.top < window.innerHeight * 0.9) return; // already in view: no need
  element.classList.add("reveal");
  onSeen(element, () => element.classList.add("in"));
}

// ---- Watch the page as Framework fills it in ------------------------------------------------

function scan(root) {
  if (!(root instanceof Element)) return;
  const svgs = root.matches?.("svg[class^='plot']") ? [root] : root.querySelectorAll("svg[class^='plot']");
  for (const svg of svgs) animateChart(svg);
  const value = root.closest?.(".stat .value");
  if (value) requestAnimationFrame(() => countUp(value));
  for (const v of root.querySelectorAll?.(".stat .value") ?? []) requestAnimationFrame(() => countUp(v));
}

if (!quiet && main) {
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) scan(node.nodeType === Node.TEXT_NODE ? node.parentElement : node);
    }
  }).observe(main, {childList: true, subtree: true});
  scan(main);
  for (const block of main.querySelectorAll(".section, .card, .links, .steps")) reveal(block);
}
