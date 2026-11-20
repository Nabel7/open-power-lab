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


def entsoe_hours(start, end):
    times = pd.date_range(start, end, freq="h", tz="UTC", inclusive="left")
    return pd.DataFrame(
        {"timestamp_utc": times, "region": "SEM", "series": "dam_price_eur_mwh", "value": range(len(times))}
    ).astype({"value": float})


def test_prices_ahead_keeps_whole_days_after_semos_newest(monkeypatch):
    # Trading days 19, 20 and 21 Nov (23:00 to 23:00 Irish time, = UTC in winter), and
    # half of 22 Nov. SEMO has up to 19 Nov.
    hours = entsoe_hours("2026-11-18 23:00", "2026-11-22 11:00")
    monkeypatch.setattr(export_markets.storage, "load", lambda name: hours)

    ahead = export_markets.prices_ahead("2026-11-19")

    assert sorted(ahead["day"].unique()) == ["2026-11-20", "2026-11-21"]
    assert len(ahead) == 48
    assert ahead["timestamp_utc"].iloc[0] == pd.Timestamp("2026-11-19 23:00", tz="UTC")


def test_prices_ahead_counts_a_clock_change_day_as_whole(monkeypatch):
    # Trading day 25 Oct 2026 has 25 hours: 22:00 UTC on the 24th to 23:00 UTC on the 25th.
    hours = entsoe_hours("2026-10-24 22:00", "2026-10-25 23:00")
    monkeypatch.setattr(export_markets.storage, "load", lambda name: hours)

    ahead = export_markets.prices_ahead("2026-10-24")

    assert len(ahead) == 25 and set(ahead["day"]) == {"2026-10-25"}


def test_prices_ahead_is_empty_without_entsoe_prices(monkeypatch):
    def load(name):
        raise FileNotFoundError(name)

    monkeypatch.setattr(export_markets.storage, "load", load)
    ahead = export_markets.prices_ahead("2026-11-19")
    assert ahead.empty and list(ahead.columns) == export_markets.AHEAD_COLUMNS
    assert export_markets.ahead_summary(ahead) == []


def test_ahead_summary_names_the_cheapest_and_dearest_hours():
    hours = entsoe_hours("2026-11-19 23:00", "2026-11-20 23:00").rename(columns={"value": "price"})
    hours["day"] = "2026-11-20"
    (summary,) = export_markets.ahead_summary(hours)
    assert summary["low"] == 0 and summary["low_utc"] == "2026-11-19T23:00Z"
    assert summary["high"] == 23 and summary["high_utc"] == "2026-11-20T22:00Z"
    assert summary["avg"] == 11.5
