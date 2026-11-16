"""The scenarios the sheet is checked against: Nadia, and the 7 fixtures of engine/fixtures_v2.json."""
from __future__ import annotations

import datetime as dt
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

NADIA = dict(
    freq="biweekly", first_payday=dt.date(2026, 11, 6), money=150, buffer=200, goal=500,
    yearly=[("Gifts and holidays", 260, "December")],
    debts=[dict(name="Store Card", balance=450, apr=26.99, min=30, due=12),
           dict(name="Medical", balance=600, apr=0, min=50, due=3),
           dict(name="Visa", balance=2200, apr=22.99, min=66, due=20)],
)


SEVEN = ("karim", "sara", "growing_avalanche", "growing_piy", "twice_month", "monthly_custom", "eight_k")


def for_engine(s: dict) -> dict:
    """The same scenario in the shape engine_v2.simulate takes (yearly bills as plain amounts)."""
    out = dict(s)
    out["yearly"] = [y[1] if isinstance(y, (tuple, list)) else y for y in s.get("yearly", [])]
    return out


def fixtures() -> dict[str, dict]:
    """name -> engine scenario, read from engine/fixtures_v2.json"""
    raw = json.load(open(os.path.join(ROOT, "engine", "fixtures_v2.json"), encoding="utf8"))
    items = raw.items() if isinstance(raw, dict) else [(f.get("name", str(i)), f) for i, f in enumerate(raw)]
    out = {}
    for name, f in items:
        if name not in SEVEN:
            continue  # promo rates are an app feature: the sheet has no place to type one
        s = dict(f.get("input", f.get("scenario", f)))
        s["first_payday"] = dt.date.fromisoformat(s["first_payday"]) if isinstance(s["first_payday"], str) else s["first_payday"]
        for key in ("adjust", "charges", "buffer_used", "yearly_paid"):
            if key in s:
                s[key] = {int(k): v for k, v in s[key].items()}
        out[name] = s
    return out
