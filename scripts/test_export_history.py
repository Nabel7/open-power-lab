"""Checks for the weather adjustment in export_history.py, on made-up months.

Run: python3 -m pytest scripts/test_export_history.py
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from export_history import adjust  # noqa: E402


def made_up(seed=0, years=range(2016, 2026)):
    """Ten years of months where windier months lose a bigger share, plus noise."""
    rng = np.random.default_rng(seed)
    rows = []
    for year in years:
        for month in range(1, 13):
            normal = 0.33 - 0.15 * np.sin(np.pi * (month - 1) / 11)  # windier in winter
            cf = normal * rng.uniform(0.7, 1.3)
            level = -3.2 + 0.12 * (year - 2016)
            logit = level + 4.5 * cf + rng.normal(0, 0.15)
            share = 1 / (1 + np.exp(-logit))
            avail = 900_000 * cf / 0.3
            rows.append(
                {
                    "year": year,
                    "month": month,
                    "avail": avail,
                    "constraint": 0.6 * share * avail,
                    "curtail": 0.4 * share * avail,
                    "cf": cf,
                    "cf_norm": normal,
                }
            )
    d = pd.DataFrame(rows)
    d["dd"] = d.constraint + d.curtail
    d["t"] = (d.year - 2016) * 12 + d.month
    d["w"] = d.cf * 10
    d["wn"] = d.cf_norm * 10
    return d


def test_a_month_with_normal_wind_is_unchanged():
    d = made_up()
    d.loc[d.index[40], "cf"] = d.loc[d.index[40], "cf_norm"]
    d["w"] = d.cf * 10
    out, _ = adjust(d)
    row = out.loc[d.index[40]]
    assert abs(row.adjusted - row.dd / row.avail) < 1e-4


def test_windier_than_normal_adjusts_down_and_calmer_adjusts_up():
    out, models = adjust(made_up())
    assert models["constraint"].params["w"] > 0  # it found the wind effect
    reported = out.dd / out.avail
    windy = out.cf > out.cf_norm * 1.05
    calm = out.cf < out.cf_norm * 0.95
    assert (out.adjusted[windy] < reported[windy]).all()
    assert (out.adjusted[calm] > reported[calm]).all()


def test_adjusted_shares_stay_between_0_and_1_and_parts_add_up():
    out, _ = adjust(made_up(seed=3))
    assert out.adjusted.between(0, 1).all()
    assert np.allclose(out.adjusted, out.constraint_adjusted + out.curtail_adjusted)
