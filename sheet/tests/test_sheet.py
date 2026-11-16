"""The sheet against engine/engine_v2.py, plus the rules every tab keeps (formula count, functions, colours)."""
from __future__ import annotations

import datetime as dt
import re

import pytest

import scenarios
from conftest import all_scenarios
from engine_v2 import simulate
from layout import *  # noqa: F401,F403

BANNED = ["SPARKLINE", "FILTER", "SORT", "UNIQUE", "LET", "LAMBDA", "XLOOKUP", "XMATCH", "SEQUENCE", "ARRAYFORMULA", "QUERY",
          "IFS", "MINIFS", "MAXIFS", "SWITCH", "TEXTJOIN", "CONCAT", "IMPORTRANGE", "GOOGLEFINANCE", "REGEXMATCH", "_XLFN", "__XLUDF"]
ALLOWED_YELLOW = {"FFE14D", "FFF6C2"}
SCEN = list(all_scenarios())


def as_date(v):
    return v.date() if isinstance(v, dt.datetime) else v


def formulas(wb):
    for ws in wb:
        for row in ws.iter_rows():
            for cell in row:
                if isinstance(cell.value, str) and cell.value.startswith("="):
                    yield ws.title, cell.coordinate, cell.value


@pytest.mark.parametrize("name", SCEN)
def test_engine_matches_the_reference(books, name):
    """Every payday row: the date exact; bills, extra, the move, the buffer and what is owed to the cent."""
    s = scenarios.for_engine(all_scenarios()[name])
    ref = simulate(s)
    en = books[name][1]["Engine"]
    assert len(ref["rows"]) <= NR, "the scenario must fit in the sheet"
    for r in ref["rows"]:
        row = ER1 + r["k"]
        assert as_date(en.cell(row, C_DATE).value) == r["date"], (name, r["k"])
        for col, key in ((C_BILLS, "bills"), (C_EXTRA, "extra"), (C_MOVE, "total_move"), (C_OWED, "owed"),
                         (C_YEARLY, "yearly"), (C_TOBUF, "buffer"), (C_BUFAFTER, "buffer_after")):
            got = en.cell(row, col).value or 0
            assert abs(got - r[key]) < 0.005, (name, r["k"], key, got, r[key])
        for p, b in enumerate(r["bal"]):
            assert abs((en.cell(row, C_BAL + p).value or 0) - b) < 0.005, (name, r["k"], "balance", p)
    # the payday the plan ends on, and the interest paid on the way
    last = ER1 + ref["paydays"] - 1
    assert en.cell(last, C_OWED).value < 0.005 and en.cell(last - 1, C_OWED).value > 0.005
    assert as_date(en.cell(last, C_DATE).value) == ref["debt_free"]
    interest = sum(en.cell(ER1 + k, C_INT).value or 0 for k in range(ref["paydays"]))
    assert abs(interest - ref["interest"]) < 0.01
    # the payoff order
    names = [en.cell(EO0 + p, 11).value for p in range(len(s["debts"]))]
    assert names == ref["order"]


def test_nadia_numbers(books):
    """The numbers of the Nadia scenario, as written in the brief."""
    en = books["nadia"][1]["Engine"]
    moves = [round(en.cell(ER1 + k, C_MOVE).value, 2) for k in range(5)]
    assert moves == [180, 266, 180, 216, 230]
    assert round(en.cell(ER1 + 7, C_OWED).value) == 2067
    free = [as_date(en.cell(ER1 + k, C_DATE).value) for k in range(NR) if (en.cell(ER1 + k, C_OWED).value or 0) < 0.005][0]
    assert free == dt.date(2027, 7, 16) and free.strftime("%a") == "Fri"


def test_formula_count(books):
    n = sum(1 for _ in formulas(books["blank"][0]))
    assert n < 40000, n


def test_only_functions_that_work_in_both(books):
    for sheet, at, f in formulas(books["blank"][0]):
        names = set(re.findall(r"([A-Z_][A-Z0-9_.]*)\(", f.upper()))
        bad = names & set(BANNED)
        assert not bad, (sheet, at, bad)


@pytest.mark.parametrize("name", ["blank", "nadia"])
def test_no_error_values(books, name):
    for ws in books[name][1]:
        for row in ws.iter_rows():
            for cell in row:
                assert not (isinstance(cell.value, str) and cell.value.startswith("#") and cell.value.endswith(("!", "?", "A"))), (ws.title, cell.coordinate, cell.value)


def _rgb(color):
    v = getattr(color, "rgb", None)
    return v[-6:].upper() if isinstance(v, str) else None


def is_red(rgb: str) -> bool:
    r, g, b = int(rgb[0:2], 16), int(rgb[2:4], 16), int(rgb[4:6], 16)
    return r > 150 and r > g * 1.6 and r > b * 1.6


def test_no_red_anywhere(books):
    wb = books["blank"][0]
    for ws in wb:
        for row in ws.iter_rows():
            for cell in row:
                for rgb in (_rgb(cell.font.color) if cell.font and cell.font.color else None,
                            _rgb(cell.fill.fgColor) if cell.fill and cell.fill.fill_type == "solid" else None):
                    assert not (rgb and is_red(rgb)), (ws.title, cell.coordinate, rgb)
        for rules in ws.conditional_formatting:
            for rule in rules.rules:
                if rule.dxf and rule.dxf.fill:
                    rgb = _rgb(rule.dxf.fill.bgColor) or _rgb(rule.dxf.fill.fgColor)
                    assert not (rgb and is_red(rgb)), (ws.title, rgb)


# ------------------------------------------------------------------------------------------------ Start
def this_year(d: dt.date) -> str:
    """The way the sheet writes a date: the year only when it is not this year"""
    s = f"{d.strftime('%a')} {d.day} {d.strftime('%b')}"
    return s if d.year == dt.date.today().year else f"{s} {d.year}"


def test_start_result_for_nadia(books):
    st = books["nadia"][1]["Start"]
    assert st[S_R_LINE1].value == "You can be debt-free by"
    assert st[S_R_DATE].value == this_year(dt.date(2027, 7, 16))
    assert st[S_R_STEP].value == f"First step: move $180 on {this_year(dt.date(2026, 11, 6))}."
    assert st[S_R_MIN].value == "With minimums only: about April 2031."
    assert st[S_R_SOONER].value == "That is about 45 months sooner."
    assert st[S_DATECHECK].value in ("This sheet reads dates as MM/DD/YYYY.", "This sheet reads dates as DD/MM/YYYY.")
    for i in range(ND):
        assert not st.cell(D0 + i, S_NOTE_COL).value  # nothing to say about good inputs


def test_start_blank_is_calm(books):
    st = books["blank"][1]["Start"]
    assert st[S_R_LINE1].value == "Fill in the three steps and your date shows here."
    for ref in (S_R_DATE, S_R_STEP, S_R_MIN, S_R_SOONER):
        assert not st[ref].value


def test_start_notes_next_to_inputs_that_need_a_look(books):
    st = books["checks"][1]["Start"]
    notes = [st.cell(D0 + i, S_NOTE_COL).value or "" for i in range(4)]
    assert notes[0] == "Add the due day. It is on your statement."
    assert notes[1] == "The minimum is more than the balance. Have a look at both."
    assert notes[2] == "Add the balance and this debt joins your plan."
    assert notes[3] == ""
    assert st[S_MONEYNOTE].value == "Add what you can put on top of your minimums. Even 20 matters."


def test_start_dropdowns_and_the_three_orders(books):
    wb = books["blank"][0]
    st, li = wb["Start"], wb["Lists"]
    dv = {str(d.sqref): d.formula1 for d in st.data_validations.dataValidation}
    assert dv[S_CUR].startswith("Lists!$A$2") and dv[S_FREQ] == "Lists!$B$2:$B$5" and dv[S_ORDER] == "Lists!$C$2:$C$4"
    assert dv[S_SHOW] == f'"{TICK}"'
    assert [li[f"C{r}"].value for r in (2, 3, 4)] == ["PaidInYellow order", "Biggest interest first", "My own order"]
    assert li["C5"].value is None  # three orders, never more
    assert st[S_ORDER].value == "PaidInYellow order"


def test_inputs_are_unlocked_and_everything_else_is_locked(books):
    wb = books["blank"][0]
    st = wb["Start"]
    assert st.protection.sheet and not st.protection.password
    open_cells = {c.coordinate for row in st.iter_rows() for c in row if not c.protection.locked}
    want = {S_CUR, S_FREQ, S_NEXT, S_OTHER, S_MONEY, S_BUF, S_GOAL, S_ORDER, S_SHOW}
    want |= {f"{col}{D0 + i}" for i in range(ND) for col in "CDEFGH"}
    want |= {f"{col}{Y0 + i}" for i in range(NY) for col in "CDE"}
    assert open_cells == want
    for name in ("Engine", "Lists"):
        assert wb[name].sheet_state == "hidden" and wb[name].protection.sheet


def test_copy_rules(books):
    """Short and calm: no dashes, no exclamation marks, none of the words we never use."""
    never = ["loan", "balance transfer", "consolidat", "credit score", "utilization", "streak", "hurry", "act now", "guarantee"]
    for ws in books["blank"][0]:
        if ws.sheet_state == "hidden":
            continue
        for row in ws.iter_rows():
            for cell in row:
                v = cell.value
                if not isinstance(v, str):
                    continue
                words = " ".join(re.findall(r'"([^"]*)"', v)) if v.startswith("=") else v
                assert "!" not in words and "\u2014" not in words and "\u2013" not in words, (ws.title, cell.coordinate, words)
                assert not re.search(r"\w - \w", words), (ws.title, cell.coordinate, words)
                low = words.lower()
                assert not any(n in low for n in never), (ws.title, cell.coordinate, words)


def yellow_rules(wb):
    for ws in wb:
        for rules in ws.conditional_formatting:
            for rule in rules.rules:
                if rule.dxf and rule.dxf.fill and (_rgb(rule.dxf.fill.bgColor) or _rgb(rule.dxf.fill.fgColor)) in ALLOWED_YELLOW:
                    yield ws.title, str(rules.sqref)


def test_yellow_only_where_it_means_paid_done_or_the_key_word(books):
    wb = books["blank"][0]
    for ws in wb:
        for row in ws.iter_rows():
            for cell in row:
                if cell.fill and cell.fill.fill_type == "solid":
                    assert _rgb(cell.fill.fgColor) not in ALLOWED_YELLOW, (ws.title, cell.coordinate)  # never a plain yellow cell
                if cell.font and cell.font.color:
                    assert _rgb(cell.font.color) not in ALLOWED_YELLOW, (ws.title, cell.coordinate)  # never yellow text
    got = set(yellow_rules(wb))
    assert got <= YELLOW_OK, got - YELLOW_OK
    # "Show where to type" tints with sage, never yellow
    st = wb["Start"]
    tints = [r for rules in st.conditional_formatting for r in rules.rules if TICK in "".join(r.formula)]
    assert tints and all(_rgb(r.dxf.fill.bgColor) == "E6EFE8" for r in tints)


def test_no_text_criteria_with_a_decimal_point(books):
    """COUNTIF(range,">0.005") reads the point as text where the decimal mark is a comma, so the count is wrong."""
    for sheet, at, f in formulas(books["blank"][0]):
        assert not re.search(r'"[<>=]+\d*\.\d', f), (sheet, at, f[:80])
        assert "TEXT(" not in f.upper().replace("FIXED(", ""), (sheet, at)  # TEXT patterns change with the language
