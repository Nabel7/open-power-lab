# Irish Wind Dispatch-Down Tracker

A website showing how much power Irish wind farms were told not to produce (dispatch-down), why (constraint or curtailment), where (Ireland or Northern Ireland) and at which farms. It's built from public SEMO data, so figures are out within days of the end of each month. EirGrid's official monthly figures come about a month later, and these come within about 2 percentage points of them.

Supported by EirGrid Group Data. Independent; not affiliated with or endorsed by EirGrid, SONI or SEMO. Farm positions and map © OpenStreetMap contributors (ODbL).

## How it fits together

```
SEMO reports ──daily──► isem-data (raw archive, on this Mac)
                              │
              scripts/update-data.sh   (python -m isem_data.tracker)
                              ▼
                    src/data/*.csv, meta.json   (small summaries, committed here)
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
npm run update-data   # refresh src/data from isem-data
npm run dev           # preview at http://127.0.0.1:3000, reloads as you edit
npm run build         # build the static site into dist/
```

Observable Framework sends anonymous usage telemetry unless `OBSERVABLE_TELEMETRY_DISABLE=true` is set.

## Pages

| Page | File | What it shows |
|---|---|---|
| Overview | `src/index.md` | A chosen month: % dispatched down, energy lost, market value, constraint share, Ireland vs NI; day-by-day chart; month-by-month chart; most affected farms |
| Map | `src/map.md` | Every placed wind farm as a dot: size = energy lost that month, colour = % dispatched down. Hover (or tap, on a phone) for details; click for the farm's page. Uses Leaflet and OpenStreetMap tiles |
| Farms | `src/farms/index.md` | Every farm in a searchable, sortable table, for the whole period or one month. Each name links to its page |
| One page per farm | `src/farms/[farm].md` | A template: one page per file in `src/data/farms/` (listed in `dynamicPaths` in `observablehq.config.js`). Headline figures, the last two weeks half-hour by half-hour (output vs availability, with constraint and curtailment shaded), energy lost each day, by hour of day, month by month, its units and a small map |
| Methods & data | `src/methods.md` | How it's calculated, the check against EirGrid's official figures, known limits, months covered, downloads, licence |

Shared formats and colours are in `src/components/format.js`. Site settings (title, footer credit, light/dark theme) are in `observablehq.config.js`.

## Farm positions

`src/data/farm_locations.csv` comes from isem-data, which matches SEMO's unit names to OpenStreetMap's wind farms (`isem_data/locations.py`; hand fixes in `isem_data/corrections.csv`). Refresh the names and positions now and then, not every day:

```bash
cd ~/Developer/isem-data && .venv/bin/python -m isem_data --datasets farm_names osm_wind_farms
```

## Updating each month

1. Check isem-data's daily download has the whole month.
2. `npm run update-data`, then `npm run dev` and look over the pages.
3. Commit the changed `src/data/` files and push.
