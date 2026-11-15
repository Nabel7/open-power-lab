// Wind streaks: thin trails drifting with the current forecast wind over Ireland, drawn
// on a canvas behind the home page's introduction. The wind is real: the same Open-Meteo
// forecast grid as the Wind map (components/weather.js), at the current hour.
//
// It stays still for anyone whose device asks for less motion (one settled frame is
// drawn instead), pauses while it's scrolled out of view or the tab is hidden, and uses
// fewer streaks on small screens.

import {ROWS, COLUMNS} from "./weather.js";

/**
 * The wind at the grid points as east and south components, in m/s, from speeds and
 * directions the wind comes FROM (degrees, meteorological). South rather than north
 * because a canvas's y runs downwards.
 */
export function windVectors(speeds, directions) {
  return speeds.map((s, i) => {
    const from = (directions[i] * Math.PI) / 180;
    return {east: -s * Math.sin(from), south: s * Math.cos(from)};
  });
}

/**
 * Wind at a point of the canvas, blended from the four grid points around it. The grid
 * (north to south, west to east) is stretched over the whole canvas: the streaks show the
 * wind's pattern, not a map.
 */
export function windAt(x, y, width, height, vectors) {
  const r = Math.max(0, Math.min(ROWS - 1, (y / height) * ROWS - 0.5));
  const c = Math.max(0, Math.min(COLUMNS - 1, (x / width) * COLUMNS - 0.5));
  const r0 = Math.floor(r);
  const c0 = Math.floor(c);
  const r1 = Math.min(ROWS - 1, r0 + 1);
  const c1 = Math.min(COLUMNS - 1, c0 + 1);
  const fr = r - r0;
  const fc = c - c0;
  const at = (row, col) => vectors[row * COLUMNS + col];
  const blend = (key) =>
    (at(r0, c0)[key] * (1 - fc) + at(r0, c1)[key] * fc) * (1 - fr) + (at(r1, c0)[key] * (1 - fc) + at(r1, c1)[key] * fc) * fr;
  return {east: blend("east"), south: blend("south")};
}

/**
 * Start the streaks on `canvas` (which should fill its parent). Returns a function that
 * stops them. `colour` is any CSS colour; `vectors` comes from windVectors.
 */
export function startStreaks(canvas, vectors, {colour = "#0e8fb0"} = {}) {
  const context = canvas.getContext("2d");
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let width = 0;
  let height = 0;
  let particles = [];
  let frame = null;
  let visible = true;

  // Pixels moved per frame for each m/s: a 10 m/s wind crosses a wide screen in ~8 s.
  const pace = 0.22;
  const spawn = (p = {}) =>
    Object.assign(p, {x: Math.random() * width, y: Math.random() * height, age: 0, life: 80 + Math.random() * 140});

  function resize() {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    // About one streak per 1,500 square pixels, fewer on a phone.
    const count = Math.round((width * height) / (width < 640 ? 2600 : 1500));
    particles = Array.from({length: count}, () => spawn());
    particles.forEach((p) => (p.age = Math.random() * p.life)); // not all born at once
  }

  function step() {
    // Fade what's there a little, so each streak leaves a short tail.
    context.globalCompositeOperation = "destination-out";
    context.fillStyle = "rgb(0 0 0 / 0.06)";
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = "source-over";
    context.strokeStyle = colour;
    context.lineWidth = 1.3;
    context.beginPath();
    for (const p of particles) {
      const wind = windAt(p.x, p.y, width, height, vectors);
      const nx = p.x + wind.east * pace;
      const ny = p.y + wind.south * pace;
      context.moveTo(p.x, p.y);
      context.lineTo(nx, ny);
      p.x = nx;
      p.y = ny;
      p.age += 1;
      if (p.age > p.life || p.x < -5 || p.x > width + 5 || p.y < -5 || p.y > height + 5) spawn(p);
    }
    context.stroke();
  }

  function loop() {
    step();
    frame = visible && !document.hidden ? requestAnimationFrame(loop) : null;
  }
  const play = () => {
    if (!still && width > 0 && frame === null && visible && !document.hidden) frame = requestAnimationFrame(loop);
  };

  // Size the canvas whenever it gets a size (it may not be on the page yet when this
  // starts) or the window changes. Still mode draws one settled picture each time.
  const sized = new ResizeObserver(() => {
    if (canvas.clientWidth === width && canvas.clientHeight === height) return;
    resize();
    if (still) for (let i = 0; i < 60; i++) step();
    else play();
  });
  sized.observe(canvas);
  const onVisibility = () => play();
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    play();
  });
  observer.observe(canvas);
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    if (frame !== null) cancelAnimationFrame(frame);
    observer.disconnect();
    sized.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
