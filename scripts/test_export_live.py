"""Checks for the live record's scoring in export_live.py, on made-up forecasts.

Run with isem-data's Python: ~/Developer/isem-data/.venv/bin/python -m pytest scripts/test_export_live.py
"""

import json
import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).parent))
import export_live  # noqa: E402


def save_forecast(folder: Path, day: str, in_time=True, chronos=100.0, missing=()):
    """A forecast file like isem-live-forecasts': 48 half-hours from 23:00 UTC the day before."""
    times = pd.date_range(pd.Timestamp(day, tz="UTC") - pd.Timedelta(hours=1), periods=48, freq="30min")
    medians = {"chronos2_wind": chronos, "lightgbm_wind": 110.0, "yesterday": 130.0, "week_average": 120.0}
    rows = [
        {
            "timestamp_utc": t.strftime("%Y-%m-%dT%H:%MZ"),
            "method": m,
            "low": v - 10 if m in export_live.RANGED else None,
            "median": v,
            "high": v + 10 if m in export_live.RANGED else None,
        }
        for m, v in medians.items()
        if m not in missing
        for t in times
    ]
    folder.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows).to_csv(folder / f"{day}.csv", index=False)
    info = {"day": day, "made_at_utc": f"{day}T07:31:00Z", "in_time": in_time, "methods_without_forecast": list(missing)}
    (folder / f"{day}.json").write_text(json.dumps(info))
    return times


@pytest.fixture
def run(tmp_path, monkeypatch):
    """Runs export_live.main() on a made-up forecasts folder, with SEMO's prices given."""

    def go(prices: pd.Series):
        monkeypatch.setattr(export_live, "LIVE", tmp_path / "live")
        monkeypatch.setattr(export_live, "OUT", tmp_path / "out")
        monkeypatch.setattr(export_live, "semo_prices", lambda: prices)
        export_live.main()
        out = tmp_path / "out"
        return (
            pd.read_csv(out / "days.csv"),
            pd.read_csv(out / "scores.csv"),
            json.loads((out / "meta.json").read_text()),
        )

    return go


def test_a_day_is_scored_once_semo_has_every_half_hour(tmp_path, run):
    folder = tmp_path / "live" / "forecasts"
    first = save_forecast(folder, "2026-11-23", chronos=100.0)
    second = save_forecast(folder, "2026-11-24", chronos=150.0)
    prices = pd.Series(105.0, index=first.append(second))  # SEMO has both days, at €105

    days, scores, meta = run(prices)

    chronos = scores.set_index("method").loc["chronos2_wind"]
    assert chronos["MAE"] == pytest.approx((5 + 45) / 2)  # 100 and 150 against 105
    assert chronos["inside_range"] == pytest.approx(0.5)  # 90-110 holds 105; 140-160 doesn't
    assert chronos["days_beaten"] == 1  # beat the week average (miss 15) on the first day only
    assert pd.isna(scores.set_index("method").loc["week_average", "days_beaten"])
    assert meta["days_counted"] == 2 and meta["last_counted"] == "2026-11-24"
    assert [f["status"] for f in meta["forecasts"]] == ["scored", "scored"]


def test_a_day_waits_until_semo_has_published_all_of_it(tmp_path, run):
    times = save_forecast(tmp_path / "live" / "forecasts", "2026-11-23")
    days, scores, meta = run(pd.Series(105.0, index=times[:-1]))  # the last half-hour not yet
    assert meta["forecasts"][0]["status"] == "waiting"
    assert days.empty and scores.empty and meta["days_counted"] == 0


def test_late_and_incomplete_days_are_shown_but_not_counted(tmp_path, run):
    folder = tmp_path / "live" / "forecasts"
    late = save_forecast(folder, "2026-11-23", in_time=False)
    gap = save_forecast(folder, "2026-11-24", missing=("lightgbm_wind",))
    days, scores, meta = run(pd.Series(105.0, index=late.append(gap)))
    assert [f["status"] for f in meta["forecasts"]] == ["late", "incomplete"]
    assert not days["counted"].any() and scores.empty


def test_no_forecasts_yet_writes_empty_files(run):
    days, scores, meta = run(pd.Series(dtype=float))
    assert days.empty and scores.empty
    assert meta["forecasts"] == [] and meta["days_counted"] == 0
