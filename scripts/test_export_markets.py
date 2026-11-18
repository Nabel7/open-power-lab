"""Checks for the latest-figures strip in export_markets.py.

Run with isem-data's Python: ~/Developer/isem-data/.venv/bin/python -m pytest scripts/test_export_markets.py
"""

import math
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
import export_markets  # noqa: E402
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


def test_a_day_with_wind_but_no_demand_is_left_out(monkeypatch):
    # 18 Nov 2026: the archive had wind for 16 Nov but no demand, so the day's wind
    # share came out as infinity and the live home page couldn't read its data.
    times = pd.date_range("2026-11-15 00:00", "2026-11-16 23:45", freq="15min", tz="UTC")
    wind = pd.concat(
        [
            pd.DataFrame({"timestamp_utc": times, "region": "ALL", "series": series, "value": 1000.0})
            for series in ["wind_actual_mw", "wind_forecast_mw"]
        ]
    )
    first_day = times[times < pd.Timestamp("2026-11-16", tz="UTC")]
    demand = pd.DataFrame(
        {"timestamp_utc": first_day, "region": "ALL", "series": "demand_actual_mw", "value": 4000.0}
    )
    monkeypatch.setattr(export_markets.storage, "load", lambda name: {"wind": wind, "demand": demand}[name])

    hh, daily = export_markets.system()

    assert daily["day"].tolist() == ["2026-11-15"]
    assert daily["wind_share"].tolist() == [25.0]
