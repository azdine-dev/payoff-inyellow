"""Builds every test workbook once, recalculates them all in one LibreOffice run, and hands the values to the tests."""
from __future__ import annotations

import datetime as dt
import os
import shutil
import sys
import tempfile

import pytest
from openpyxl import load_workbook

SHEET = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(SHEET)
sys.path.insert(0, SHEET)
sys.path.insert(0, os.path.join(ROOT, "engine"))

import build_sheet  # noqa: E402
import recalc  # noqa: E402
import scenarios  # noqa: E402


DAY = dt.date(2026, 11, 1)  # "today" in the test files, so the words about dates never change


def all_scenarios() -> dict[str, dict]:
    out = {"nadia": scenarios.NADIA}
    out.update(scenarios.fixtures())
    return out


class Books(dict):
    """name -> (formulas, values), read from disk when a test asks and only a few kept at once, so memory stays low"""
    KEEP = 3

    def __init__(self, src: str, out: str):
        super().__init__()
        self.src, self.out = src, out
        self.names = [f[:-5] for f in os.listdir(src)]

    def __contains__(self, name) -> bool:
        return name in self.names

    def __iter__(self):
        return iter(self.names)

    def __missing__(self, name: str):
        if name not in self.names:
            raise KeyError(name)
        while len(self) >= self.KEEP:
            del self[next(iter(dict.keys(self)))]
        f = name + ".xlsx"
        self[name] = (load_workbook(os.path.join(self.src, f)), load_workbook(os.path.join(self.out, f), data_only=True))
        return dict.__getitem__(self, name)


@pytest.fixture(scope="session")
def books():
    """name -> (workbook with formulas, workbook with values). 'blank' is the file we sell, 'nadia-ticked' has 2 ticks."""
    src, out = tempfile.mkdtemp(prefix="piy-src-"), tempfile.mkdtemp(prefix="piy-out-")
    build_sheet.build(os.path.join(src, "blank.xlsx"))
    for name, s in all_scenarios().items():
        build_sheet.build(os.path.join(src, f"{name}.xlsx"), s, today=DAY)
    # two paydays ticked, and the third has not come yet
    build_sheet.build(os.path.join(src, "nadia-ticked.xlsx"), scenarios.NADIA, ticks=2, today=dt.date(2026, 11, 21))
    # one payday ticked: Visa owes more than at the start
    build_sheet.build(os.path.join(src, "nadia-one.xlsx"), scenarios.NADIA, ticks=1, today=dt.date(2026, 11, 20))
    # what if: 50 more each payday, from the start, and from the third payday on (two are ticked)
    build_sheet.build(os.path.join(src, "nadia-whatif.xlsx"), dict(scenarios.NADIA, whatif=50), today=DAY)
    build_sheet.build(os.path.join(src, "nadia-ticked-whatif.xlsx"), dict(scenarios.NADIA, whatif=50), ticks=2, today=dt.date(2026, 11, 21))
    # four paydays went by and nothing is ticked
    build_sheet.build(os.path.join(src, "nadia-late.xlsx"), scenarios.NADIA, today=dt.date(2026, 12, 20))
    # every payday of the plan is ticked
    build_sheet.build(os.path.join(src, "nadia-done.xlsx"), scenarios.NADIA, ticks=19, today=dt.date(2027, 7, 20))
    for name in scenarios.ACTUALS:
        build_sheet.build(os.path.join(src, f"nadia-{name}.xlsx"), scenarios.with_actual(name), today=DAY)
    # the first payday is ticked, the second has come, and a different amount is typed for it
    build_sheet.build(os.path.join(src, "nadia-actual-today.xlsx"), scenarios.with_actual("actual-200"), ticks=1, today=dt.date(2026, 11, 21))
    # two paydays ticked, and the second one was paid with a different amount
    build_sheet.build(os.path.join(src, "nadia-actual-ticked.xlsx"), scenarios.with_actual("actual-200"), ticks=2, today=dt.date(2026, 11, 21))
    # the same plan in euros, two paydays ticked
    build_sheet.build(os.path.join(src, "nadia-euro.xlsx"), dict(scenarios.NADIA, currency="€"), ticks=2, today=dt.date(2026, 11, 21))
    # the Night look picked on Start
    build_sheet.build(os.path.join(src, "nadia-night.xlsx"), dict(scenarios.NADIA, look="Night"), today=DAY)
    build_sheet.build(os.path.join(src, "checks.xlsx"), scenarios.CHECKS, today=DAY)
    build_sheet.build(os.path.join(src, "thin.xlsx"), scenarios.THIN, today=DAY)
    build_sheet.build(os.path.join(src, "nofit.xlsx"), scenarios.NOFIT, today=DAY)
    recalc.recalc_folder(src, out)
    yield Books(src, out)
    shutil.rmtree(src, ignore_errors=True)
    shutil.rmtree(out, ignore_errors=True)
