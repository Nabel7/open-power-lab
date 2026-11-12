// The battery simulator's optimiser: the most a battery could have earned trading on
// day-ahead prices, if it had known them in advance ("perfect foresight").
//
// Each trading day is solved on its own, starting and ending empty. In each half-hour
// the battery charges at full power, discharges at full power, or rests. Working back
// from the end of the day, it keeps the best value for every possible state (how much
// is stored, how much it has discharged so far), so the answer is exact for this model.
//
// Simplifications, stated on the page:
// - Losses are taken when charging: storing what will later deliver 1 MWh costs
//   1 / efficiency MWh from the grid.
// - Full power or nothing in each half-hour; no partial power.
// - Day-ahead prices only; no fees, no wear, no system services.

/**
 * Best schedule for one day.
 * @param {number[]} prices  €/MWh for each half-hour of the day, in order
 * @param {{powerMw: number, hours: number, efficiency: number, cyclesPerDay: number}} battery
 *   hours: how long a full discharge lasts at full power (so capacity = powerMw * hours)
 *   efficiency: round-trip, e.g. 0.85
 *   cyclesPerDay: at most this many full discharges a day
 * @returns {{revenue: number, actions: number[]}} revenue in €; actions per half-hour:
 *   +1 discharging, -1 charging, 0 resting
 */
export function bestDay(prices, {powerMw, hours, efficiency, cyclesPerDay}) {
  const n = prices.length;
  const blocks = Math.round(hours * 2); // half-hours of full power the battery holds
  const maxOut = Math.round(cyclesPerDay * blocks); // half-hours of discharge allowed today
  const mwh = powerMw * 0.5; // energy delivered in one half-hour at full power
  const width = maxOut + 1;
  const states = (blocks + 1) * width;
  const index = (stored, out) => stored * width + out;

  // value[t][state] = best revenue from half-hour t to the end of the day.
  let next = new Float64Array(states); // after the last half-hour: nothing more to earn
  const choice = Array.from({length: n}, () => new Int8Array(states));
  for (let t = n - 1; t >= 0; t--) {
    const now = new Float64Array(states).fill(-Infinity);
    const sell = prices[t] * mwh;
    const buy = (prices[t] * mwh) / efficiency;
    for (let stored = 0; stored <= blocks; stored++) {
      for (let out = 0; out <= maxOut; out++) {
        const s = index(stored, out);
        let best = next[s];
        let pick = 0;
        if (stored > 0 && out < maxOut) {
          const v = sell + next[index(stored - 1, out + 1)];
          if (v > best) (best = v), (pick = 1);
        }
        if (stored < blocks) {
          const v = -buy + next[index(stored + 1, out)];
          if (v > best) (best = v), (pick = -1);
        }
        now[s] = best;
        choice[t][s] = pick;
      }
    }
    next = now;
  }

  // Follow the best choices forward from an empty battery.
  const actions = [];
  let stored = 0;
  let out = 0;
  for (let t = 0; t < n; t++) {
    const pick = choice[t][index(stored, out)];
    actions.push(pick);
    if (pick === 1) (stored -= 1), (out += 1);
    if (pick === -1) stored += 1;
  }
  return {revenue: next[index(0, 0)], actions};
}

/**
 * Run bestDay over many days.
 * @param {{day: Date, price: number, time: string}[]} halfHours  must be in time order
 * @returns one row per day: {day, revenue, discharged_mwh, charged_mwh, actions, times}
 */
export function simulate(halfHours, battery) {
  const byDay = new Map();
  for (const d of halfHours) {
    const key = +d.day;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(d);
  }
  const mwh = battery.powerMw * 0.5;
  return [...byDay.values()].map((rows) => {
    const {revenue, actions} = bestDay(rows.map((d) => d.price), battery);
    const out = actions.filter((a) => a === 1).length;
    const into = actions.filter((a) => a === -1).length;
    return {
      day: rows[0].day,
      revenue,
      discharged_mwh: out * mwh,
      charged_mwh: (into * mwh) / battery.efficiency,
      actions,
      times: rows.map((d) => d.time)
    };
  });
}
