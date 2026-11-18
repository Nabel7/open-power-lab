"""Checks for the latest-figures strip in export_markets.py.

Run with isem-data's Python: ~/Developer/isem-data/.venv/bin/python -m pytest scripts/test_export_markets.py
"""

import math
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from export_markets import latest  # noqa: E402


def test_latest_skips_readings_that_have_wind_but_no_demand_yet():
    # 17 Nov 2026: wind had arrived for the newest half-hour, demand hadn't, and the
    # build stopped on the missing number.
    times = pd.date_range("2026-11-16 22:00", periods=3, freq="30min", tz="UTC")
    system_hh = pd.DataFrame(
        {"timestamp_utc": times, "wind": [1000.0, 1100.0, 1200.0], "demand": [4000.0, 4100.0, None]}
    )
    system_daily = pd.DataFrame({"day": ["2026-11-15", "2026-11-16"], "wind_share": [30.0, None]})
    prices_daily = pd.DataFrame(
        {
            "day": ["2026-11-15", "2026-11-16"],
            "avg": [100.0, 110.0],
            "low": [50.0, 60.0],
            "high": [200.0, 210.0],
            "vwap": [101.0, 111.0],
        }
    )
    prices_hh = pd.DataFrame({"timestamp_utc": times})

    info = latest(prices_hh, system_hh, prices_daily, system_daily)

    assert info["system_last_utc"] == "2026-11-16T22:30Z"
    assert (info["wind_mw"], info["demand_mw"]) == (1100, 4100)
    assert info["system_day"] == "2026-11-15"
    assert not any(isinstance(v, float) and math.isnan(v) for v in info.values())
