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


# What was really paid on the second payday (the plan asks for 266), and the same change as the engine writes it
ACTUALS = {"actual-200": (200, -66), "actual-300": (300, 34), "actual-100": (100, -166)}


def with_actual(name: str) -> dict:
    return dict(NADIA, actual={1: ACTUALS[name][0]})


# Inputs that need a calm note: no due day, a minimum above the balance, a name with no balance, no money for the plan
CHECKS = dict(
    freq="monthly", first_payday=dt.date(2026, 12, 1), money=0, buffer=0, goal=500, yearly=[],
    debts=[dict(name="No due day", balance=900, apr=20, min=30, due=None),
           dict(name="Big minimum", balance=40, apr=10, min=60, due=5),
           dict(name="No balance yet", balance=None, apr=None, min=None, due=None),
           dict(name="Fine", balance=500, apr=12, min=25, due=15)],
)

# A debt that grows faster than it is paid: the plan does not end in the 360 paydays the sheet holds
NOFIT = dict(
    freq="monthly", first_payday=dt.date(2026, 12, 1), money=1, buffer=500, goal=500, yearly=[],
    debts=[dict(name="Big card", balance=50000, apr=30, min=100, due=5)],
)

# A new charge of 100 on Visa on the third payday, typed on Debts
CHARGE = dict(NADIA, new_charges=[(3, "Visa", 100)])

# The money for the plan is smaller than what the yearly bills need each payday (10)
THIN = dict(NADIA, money=5)

SEVEN = ("karim", "sara", "growing_avalanche", "growing_piy", "twice_month", "monthly_custom", "eight_k")


def for_engine(s: dict) -> dict:
    """The same scenario in the shape engine_v2.simulate takes (yearly bills as plain amounts)."""
    out = dict(s)
    out["yearly"] = [y[1] if isinstance(y, (tuple, list)) else y for y in s.get("yearly", [])]
    # new charges typed on Debts: (payday from 1, debt name, amount) -> {payday from 0: {debt as typed, from 0: amount}}
    if s.get("new_charges"):
        names = [d["name"] for d in s["debts"]]
        charges: dict[int, dict[int, float]] = {}
        for k, name, amount in out.pop("new_charges"):
            at = charges.setdefault(k - 1, {})
            at[names.index(name)] = at.get(names.index(name), 0) + amount
        out["charges"] = charges
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
