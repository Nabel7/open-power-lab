#!/bin/zsh
# Refresh the site's data files from the isem-data archive on this machine.
#
# The raw SEMO data stays in isem-data; this writes only the small summary files
# the pages read (src/generation/dispatch-down/data/ and src/data/markets/). Set ISEM_DATA if the isem-data
# project isn't at ~/Developer/isem-data, and ISEM_PYTHON to use a Python other than its .venv
# (as the daily build on GitHub does).

set -euo pipefail

cd "$(dirname "$0")/.."
isem_data=${ISEM_DATA:-$HOME/Developer/isem-data}
python=${ISEM_PYTHON:-$isem_data/.venv/bin/python}   # a Python with isem-data installed

"$python" -m isem_data.tracker --out src/generation/dispatch-down/data
"$python" scripts/export_markets.py
"$python" scripts/export_batteries.py
