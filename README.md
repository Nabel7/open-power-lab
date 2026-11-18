# Open Power Lab

Independent data and analysis on electricity markets, built from public data. Ireland's all-island market (I-SEM) is the first: day-ahead prices, wind and demand, batteries, dispatch-down, a wind map and a battery simulator. The name is set in `observablehq.config.js`.

The site is a light, open data tool: dropdown menus (Markets, Dispatch-down, Forecasts, Tools, Data), tabs across the dispatch-down pages, search on every page (⌘K or `/`) over pages, farms and companies, and a strip of the latest figures.

## Dispatch-down

A website showing how much power Irish wind farms were told not to produce (dispatch-down), why (constraint or curtailment), where (Ireland or Northern Ireland) and at which farms. It's built from public SEMO data, so figures are out within days of the end of each month. EirGrid's official monthly figures come about six weeks later; for September and October 2026 these were within about half a percentage point of them on the same days (see the Methods page). The "Since 2016" page uses EirGrid's own figures, adjusted for the weather.

Supported by EirGrid Group Data. Independent; not affiliated with or endorsed by EirGrid, SONI or SEMO. Farm positions and map © OpenStreetMap contributors (ODbL).

## How it fits together

```
SEMO and EirGrid ──daily──► isem-data (raw archive, backed up as GitHub releases)
                              │
              scripts/update-data.sh   (python -m isem_data.tracker)
                              ▼
         src/generation/dispatch-down/data/   (dispatch-down summaries, committed here)
         src/data/markets/                    (prices, wind and demand: scripts/export_markets.py)
                              │
                     Observable Framework
                              ▼
                     dist/  (a static website)
```

The calculation lives in [isem-data](https://github.com/Nabel7/isem-data) (`isem_data/dispatch_down.py` and `isem_data/tracker.py`, both tested). This repo only turns its summary files into pages.

## Running it

Needs Node 18 or newer, and isem-data set up at `~/Developer/isem-data` (or set `ISEM_DATA`).

```bash
npm install
npm run update-data   # refresh src/generation/dispatch-down/data and src/data/markets from isem-data
npm run dev           # preview at http://127.0.0.1:3000, reloads as you edit
npm run build         # build the static site into dist/
```

Observable Framework sends anonymous usage telemetry unless `OBSERVABLE_TELEMETRY_DISABLE=true` is set.

## Pages

| Page | File | What it shows |
|---|---|---|
| Today (home) | `src/index.md` | Latest day-ahead average and range, wind share, dispatch-down; 7-day and 90-day charts |
| Day-ahead | `src/markets/day-ahead.md` | 30 days to 1 year: daily average and range, a heatmap of every half-hour, volume by zone, price by time of day, monthly table |
| Wind & demand | `src/generation/wind.md` | Wind against demand, and EirGrid's wind forecast against what happened (error, bias, monthly table) |
| Batteries | `src/generation/batteries.md` | The grid batteries: when they charge and discharge against the price, each battery's energy and day-ahead value, their day-ahead trading over the year |
| Price forecasts | `src/forecasts/prices.md` | Chronos-2 (Amazon's pre-trained forecasting model) forecasting each day's prices from what was known before the auction, with and without EirGrid's wind forecast, scored against simple methods: one day at a time, day by day, by month. Data from isem-forecast (see below) |
| Wind map | `src/forecasts/wind-map.md` | Forecast wind speed at 100 m over the island, hourly for three days, with the wind farms on top and a play button. Fetched in the browser from Open-Meteo (`src/components/weather.js`, checked by `node --test scripts/weather.test.mjs`) |
| Battery simulator | `src/tools/battery-simulator.md` | Choose a battery; it finds the best daily schedule on real day-ahead prices (`src/components/battery.js`, checked by `node --test scripts/battery.test.mjs`) |
| Datasets | `src/data.md` | Sources, update frequency, licences, every download |
| Dispatch-down overview | `src/generation/dispatch-down/index.md` | A chosen month: % dispatched down, energy lost, market value, constraint share, Ireland vs NI; day-by-day chart; month-by-month chart; most affected farms |
| Map | `src/generation/dispatch-down/map.md` | Every placed wind farm as a dot: size = energy lost that month, colour = % dispatched down. Hover (or tap, on a phone) for details; click for the farm's page. Uses Leaflet and OpenStreetMap tiles |
| Farms | `src/generation/dispatch-down/farms/index.md` | Every farm in a searchable, sortable table, for the whole period or one month. Each name links to its page |
| One page per farm | `src/generation/dispatch-down/farms/[farm].md` | A template: one page per file in `src/generation/dispatch-down/data/farms/` (listed in `dynamicPaths` in `observablehq.config.js`). Headline figures, the last two weeks half-hour by half-hour (output vs availability, with constraint and curtailment shaded), energy lost each day, by hour of day, month by month, its units and a small map |
| Methods & data | `src/generation/dispatch-down/methods.md` | How it's calculated, the check against EirGrid's official figures, known limits, months covered, downloads, licence |

Shared formats and colours are in `src/components/format.js`; the look in `src/style.css`. Every page imports `src/components/shell.js` (menus, search, latest-data strip), which loads `motion.js` (charts draw in, numbers count up; off when the device asks for less motion). Menus, footer and site name are in `observablehq.config.js`.

## Farm positions

`src/generation/dispatch-down/data/farm_locations.csv` comes from isem-data, which matches SEMO's unit names to OpenStreetMap's wind farms (`isem_data/locations.py`; hand fixes in `isem_data/corrections.csv`). Refresh the names and positions now and then, not every day:

```bash
cd ~/Developer/isem-data && .venv/bin/python -m isem_data --datasets farm_names osm_wind_farms
```

## Price forecasts

The forecast page's data in `src/forecasts/data/chronos/` is made by [isem-forecast](https://github.com/Nabel7/isem-forecast), not by `update-data`: it runs a 120-million-weight model, too heavy for the daily build. Refresh it by hand (about a minute on an M1 Mac), with isem-forecast set up next to isem-data and its `foundation` extra installed:

```bash
cd ~/Developer/isem-forecast && .venv/bin/python -m isem_forecast.site --out ~/Developer/dispatch-down-tracker/src/forecasts/data/chronos
```

## Publishing

The daily build (`.github/workflows/build.yml`) publishes the site on GitHub Pages at https://nabel7.github.io/open-power-lab/, twice a day (07:15 and 19:15 UTC, often later: GitHub runs scheduled jobs late when it's busy). To publish now, run the "Daily build" workflow by hand in the Actions tab.

Before the launch the site asks search engines not to list it: `HIDE_FROM_SEARCH` in `observablehq.config.js`. Set it to `false` to launch.

## Updating each month

1. Check isem-data's daily download has the whole month.
2. `npm run update-data`, then `npm run dev` and look over the pages.
3. Commit the changed `src/generation/dispatch-down/data/` and `src/data/markets/` files and push.
