// The live forecasts (github.com/Nabel7/isem-live-forecasts), as the Price forecasts page
// reads them. No imports, so scripts/live.test.mjs can run it in Node.

export const LIVE_REPOSITORY = "https://github.com/Nabel7/isem-live-forecasts";
const RAW = "https://raw.githubusercontent.com/Nabel7/isem-live-forecasts/main/forecasts";

// The page on GitHub listing the commit that saved a day's forecast, with its time.
export const savedAt = (day) => `${LIVE_REPOSITORY}/commits/main/forecasts/${day}.csv`;

// A forecast file's rows (timestamp_utc, method, low, median, high) turned into one row
// per half-hour, as in the site's halfhours.csv: chronos2_wind, chronos2_wind_low, ...
export function widen(rows, day) {
  const byTime = new Map();
  for (const {timestamp_utc, method, low, median, high} of rows) {
    const time = timestamp_utc instanceof Date ? timestamp_utc : new Date(timestamp_utc);
    const row = byTime.get(+time) ?? byTime.set(+time, {timestamp_utc: time, day}).get(+time);
    row[method] = median ?? null;
    if (low != null && low !== "") row[`${method}_low`] = low;
    if (high != null && high !== "") row[`${method}_high`] = high;
  }
  return [...byTime.values()].sort((a, b) => a.timestamp_utc - b.timestamp_utc);
}

// A day's forecast straight from the repository: {info, rows}, or null if it isn't saved
// yet (or GitHub can't be reached). `parse` turns CSV text into rows (d3.csvParse).
export async function fetchForecast(day, parse, get = fetch) {
  try {
    const [csv, json] = await Promise.all([get(`${RAW}/${day}.csv`), get(`${RAW}/${day}.json`)]);
    if (!csv.ok || !json.ok) return null;
    return {info: await json.json(), rows: widen(parse(await csv.text()), day)};
  } catch {
    return null;
  }
}
