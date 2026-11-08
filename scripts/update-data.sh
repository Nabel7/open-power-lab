#!/bin/zsh
# Refresh the site's data files from the isem-data archive on this machine.
#
# The raw SEMO data stays in isem-data; this writes only the small summary files
# the pages read (src/dispatch-down/data/). Set ISEM_DATA if the isem-data
# project isn't at ~/Developer/isem-data.

set -euo pipefail

cd "$(dirname "$0")/.."
isem_data=${ISEM_DATA:-$HOME/Developer/isem-data}

"$isem_data/.venv/bin/python" -m isem_data.tracker --out src/dispatch-down/data
