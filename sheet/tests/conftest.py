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


@pytest.fixture(scope="session")
def books():
    """name -> (workbook with formulas, workbook with values). 'blank' is the file we sell, 'nadia-ticked' has 2 ticks."""
    src, out = tempfile.mkdtemp(prefix="piy-src-"), tempfile.mkdtemp(prefix="piy-out-")
    build_sheet.build(os.path.join(src, "blank.xlsx"))
    for name, s in all_scenarios().items():
        build_sheet.build(os.path.join(src, f"{name}.xlsx"), s, today=DAY)
    # two paydays ticked, and the third has not come yet
    build_sheet.build(os.path.join(src, "nadia-ticked.xlsx"), scenarios.NADIA, ticks=2, today=dt.date(2026, 11, 21))
    # four paydays went by and nothing is ticked
    build_sheet.build(os.path.join(src, "nadia-late.xlsx"), scenarios.NADIA, today=dt.date(2026, 12, 20))
    # every payday of the plan is ticked
    build_sheet.build(os.path.join(src, "nadia-done.xlsx"), scenarios.NADIA, ticks=19, today=dt.date(2027, 7, 20))
    build_sheet.build(os.path.join(src, "checks.xlsx"), scenarios.CHECKS, today=DAY)
    build_sheet.build(os.path.join(src, "nofit.xlsx"), scenarios.NOFIT, today=DAY)
    recalc.recalc_folder(src, out)
    res = {}
    for f in os.listdir(src):
        name = f[:-5]
        res[name] = (load_workbook(os.path.join(src, f)), load_workbook(os.path.join(out, f), data_only=True))
    yield res
    shutil.rmtree(src, ignore_errors=True)
    shutil.rmtree(out, ignore_errors=True)
