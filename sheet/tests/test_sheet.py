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


def same_as_engine(en, s, name):
    """Every payday row: the date exact; bills, extra, the move, the buffer and what is owed to the cent."""
    ref = simulate(s)
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


@pytest.mark.parametrize("name", SCEN)
def test_engine_matches_the_reference(books, name):
    same_as_engine(books[name][1]["Engine"], scenarios.for_engine(all_scenarios()[name]), name)


@pytest.mark.parametrize("name", list(scenarios.ACTUALS))
def test_actual_matches_the_engine_run_with_the_same_change(books, name):
    """Actual on payday 2 equals engine_v2.py with adjust on that payday, on that payday and every later one."""
    s = dict(scenarios.for_engine(scenarios.NADIA), adjust={1: scenarios.ACTUALS[name][1]})
    same_as_engine(books[f"nadia-{name}"][1]["Engine"], s, name)


def test_actual_of_200_on_payday_2(books):
    en = books["nadia-actual-200"][1]["Engine"]
    row = ER1 + 1
    assert round(en.cell(row, C_MOVE).value, 2) == 200 and round(en.cell(row, C_MOVE0).value, 2) == 266
    assert round(en.cell(row, C_BILLS).value, 2) == 116 and round(en.cell(row, C_TOBUF).value, 2) == 74
    assert en[E_SHORTK].value == 0


def test_actual_below_the_bills_keeps_the_bills_paid(books):
    """The engine always pays the bills, so 100 typed against 116 of bills still moves 116."""
    en = books["nadia-actual-100"][1]["Engine"]
    assert round(en.cell(ER1 + 1, C_MOVE).value, 2) == 116
    assert en[E_SHORTK].value == 2


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


@pytest.mark.parametrize("name", ["blank", "nadia", "nadia-ticked", "nadia-done", "checks", "nofit", "twice_month"])
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
    return s if d.year == 2026 else f"{s} {d.year}"  # the test files say today is in 2026


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
    pa = wb["Path"]
    assert pa.protection.sheet
    assert {c.coordinate for row in pa.iter_rows() for c in row if not c.protection.locked} == {f"{col}{P_R1 + k}" for k in range(NR) for col in "HI"}
    assert all(c.protection.locked for row in wb["Today"].iter_rows() for c in row)
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


# ------------------------------------------------------------------------------------------------ Today
def today_lines(ws):
    out = []
    for i in range(NI):
        label, amount, note = (ws.cell(T_L0 + i, c).value or "" for c in (3, 4, 5))
        if label:
            out.append((label, amount, note))
    return out


def test_today_shows_the_next_payday_and_its_lines(books):
    td = books["nadia"][1]["Today"]
    assert td[T_LABEL].value == "This payday · Fri 6 Nov"
    assert td[T_MAIN].value == "Move $180"
    assert today_lines(td) == [("Store Card bill", "$30", "due Thu 12 Nov"), ("Yearly bills", "$10", ""), ("Buffer", "$140", "")]
    assert td[T_FLAG].value == 0  # not yellow yet
    assert td[T_FOCUS_NAME].value == "Store Card"
    assert td[T_FOCUS_LEFT].value == "$450 left"
    assert td[T_FOCUS_GONE].value == "Gone by Fri 1 Jan 2027"
    assert not td[T_LATE].value


def test_today_turns_paid_when_the_payday_is_ticked(books):
    td = books["nadia-ticked"][1]["Today"]
    assert td[T_LABEL].value == "Fri 20 Nov is paid"
    assert td[T_MAIN].value == "PAID"
    assert td[T_SUB].value == "Next payday is Fri 4 Dec."
    assert td[T_FLAG].value == 1  # the card is yellow
    assert today_lines(td) == [("Medical bill", "$50", "due Thu 3 Dec"), ("Visa bill", "$66", "due Fri 20 Nov"),
                               ("Yearly bills", "$10", ""), ("Buffer", "$140", "")]
    # the lines add up to the move of that payday in the engine
    assert books["nadia-ticked"][1]["Engine"][E_VIEWMOVE].value == pytest.approx(266)


def test_today_says_calmly_when_paydays_are_not_ticked(books):
    td = books["nadia-late"][1]["Today"]
    assert td[T_MAIN].value == "Move $180"  # still the first payday that is not ticked
    assert td[T_LATE].value == "A few paydays are not ticked yet. Tick them on Path."


def test_today_when_everything_is_done_or_nothing_is_typed(books):
    done = books["nadia-done"][1]["Today"]
    assert done[T_MAIN].value == "Debt-free" and done[T_FLAG].value == 1
    blank = books["blank"][1]["Today"]
    assert blank[T_MAIN].value == "Fill in Start" and blank[T_FLAG].value == 0
    assert today_lines(blank) == []


def test_ticks_are_a_list_with_one_choice(books):
    pa = books["blank"][0]["Path"]
    dv = {str(d.sqref): d.formula1 for d in pa.data_validations.dataValidation}
    assert dv[f"I{P_R1}:I{P_RN}"] == f'"{TICK}"'
    assert all(pa.cell(P_R1 + k, P_DONE_COL).value is None for k in range(NR))  # never ticked for the buyer


# ------------------------------------------------------------------------------------------------ Path
def digits(s) -> str:
    """An amount in words without the separators, which change with the language of the spreadsheet"""
    return re.sub(r"[^0-9$]", "", s or "")


def test_path_tiles_and_progress(books):
    pa = books["nadia"][1]["Path"]
    assert digits(pa[P_TILE_OWED].value) == "$3250"
    assert pa[P_TILE_FREE].value == "Fri 16 Jul 2027"
    assert digits(pa[P_TILE_PAID].value) == "$0"
    assert digits(pa[P_TILE_AVOID].value) == "$1167"  # 1,444.86 on minimums only, 277.93 on the plan
    assert pa[P_DEBTSPAID].value == "Debts paid 0 of 3"
    assert pa[P_PCT].value == "0% gone"
    assert pa[P_NEXT].value == "Next: Store Card gone Fri 1 Jan 2027"
    assert not pa[P_NOFIT].value
    assert pa[P_CURK].value == 1


def test_ticking_paydays_moves_everything(books):
    pa = books["nadia-ticked"][1]["Path"]
    assert digits(pa[P_TILE_OWED].value) == "$3152"   # owed after the second payday
    assert digits(pa[P_TILE_PAID].value) == "$98"
    assert pa[P_PCT].value == "3% gone"
    assert pa[P_CURK].value == 3                       # the third payday is the current one
    assert pa.cell(P_R1, P_DONE_COL).value == TICK and pa.cell(P_R1 + 2, P_DONE_COL).value is None
    done = books["nadia-done"][1]["Path"]
    assert done[P_DEBTSPAID].value == "Debts paid 3 of 3"
    assert done[P_PCT].value == "100% gone"
    assert done[P_NEXT].value == "Every debt is gone."
    assert digits(done[P_TILE_OWED].value) == "$0"
    assert done["P4"].value == 1                       # the bar is yellow


def test_path_list_matches_the_engine(books):
    ref = simulate(scenarios.for_engine(scenarios.NADIA))
    pa = books["nadia"][1]["Path"]
    for r in ref["rows"]:
        row = P_R1 + r["k"]
        assert pa.cell(row, 2).value == this_year(r["date"])
        got = [pa.cell(row, c).value or 0 for c in (3, 4, 5, 6, 7)]
        want = [r["bills"], r["yearly"], r["buffer"], r["extra"], r["total_move"]]
        assert all(abs(g - w) < 0.005 for g, w in zip(got, want)), (r["k"], got, want)
    after = P_R1 + len(ref["rows"])
    assert all(not pa.cell(after, c).value for c in range(2, 8))  # nothing after the last payday


def test_path_rules_and_chart(books):
    pa = books["blank"][0]["Path"]
    rules = {str(r.sqref): [x for x in r.rules] for r in pa.conditional_formatting}
    paid = rules[f"B{P_R1}:I{P_RN}"]
    assert _rgb(paid[0].dxf.fill.bgColor) == "FFE14D" and paid[0].dxf.font.strike  # paid rows: yellow, struck through
    assert _rgb(paid[1].dxf.border.top.color) == "2F4A6D"                           # the current row: action blue
    assert len(pa._charts) == 1
    assert pa.freeze_panes == f"A{P_R1}"


def test_a_plan_that_does_not_fit_says_so_calmly(books):
    wb = books["nofit"][1]
    assert wb["Engine"][E_FITS].value == 0
    assert wb["Start"][S_R_LINE1].value.startswith("This plan does not end in the time this sheet can show")
    assert wb["Path"][P_NOFIT].value.startswith("This plan is longer than the list below can show")
    assert not wb["Start"][S_R_DATE].value and not wb["Path"][P_TILE_FREE].value
    assert wb["Start"][S_MONEYNOTE].value.startswith("With this amount the plan does not end")
    assert not wb["Start"][S_R_MIN].value and wb["Today"][T_MAIN].value == "Fill in Start"


# ------------------------------------------------------------------------------------------------ Debts and Safety net
def debt_rows(ws):
    out = []
    for p in range(ND):
        r = DB_R0 + p
        if ws.cell(r, 3).value:
            out.append([ws.cell(r, c).value for c in (2, 3, 4, 5, 6, DB_PCT_COL, 19, 20)])
    return out


def test_debts_in_payoff_order(books):
    rows = debt_rows(books["nadia"][1]["Debts"])
    assert [(r[0], r[1], r[2], r[3], r[4], r[6]) for r in rows] == [
        (1, "Store Card", 26.99, 450, 0, "Fri 1 Jan 2027"), (2, "Medical", 0, 600, 0, "Fri 12 Feb 2027"), (3, "Visa", 22.99, 2200, 0, "Fri 16 Jul 2027")]
    assert all(r[5] == 0 and not r[7] for r in rows)


def test_debts_gone_dates_match_the_engine(books):
    ref = simulate(scenarios.for_engine(scenarios.NADIA))
    rows = debt_rows(books["nadia"][1]["Debts"])
    for p, row in enumerate(rows):
        gone = next(r["date"] for r in ref["rows"] if r["bal"][p] <= 0.005)
        assert row[6] == this_year(gone), (p, row[6], gone)


def test_a_paid_debt_says_paid_and_the_bar_is_full(books):
    rows = debt_rows(books["nadia-done"][1]["Debts"])
    assert [r[6] for r in rows] == ["PAID", "PAID", "PAID"] and [r[5] for r in rows] == [1, 1, 1]
    wb = books["blank"][0]["Debts"]
    rules = {str(r.sqref): r.rules for r in wb.conditional_formatting}
    bars = rules[f"H{DB_R0}:Q{DB_R0 + ND - 1}"]
    assert [_rgb(x.dxf.fill.bgColor) for x in bars] == ["2F4A6D", "E2DCCD"]  # action blue for progress, line for the rest
    assert _rgb(rules[f"B{DB_R0}:T{DB_R0 + ND - 1}"][0].dxf.fill.bgColor) == "FFE14D"  # yellow only when paid
    assert len([c for c in "HIJKLMNOPQ"]) == 10


def test_a_debt_that_grows_gets_a_calm_note(books):
    rows = debt_rows(books["growing_piy"][1]["Debts"])
    assert rows[0][1] == "Dept card" and rows[0][7] == "This one grows even when you pay the minimum, so it goes first."
    assert not rows[1][7] and not rows[2][7]
    cell = books["blank"][0]["Debts"].cell(DB_R0, 20)
    assert _rgb(cell.font.color) == "1F2A44"  # ink, never red


def test_safety_net(books):
    sn = books["nadia"][1]["Safety net"]
    assert digits(sn[SN_BUF].value) == "$200$500" and not sn[SN_READY].value
    row = [sn.cell(SN_Y0, c).value for c in range(2, 7)]
    assert row == ["Gifts and holidays", 260, "December", 0, 10]
    ticked = books["nadia-ticked"][1]["Safety net"]
    assert digits(ticked[SN_BUF].value) == "$480$500"
    assert ticked.cell(SN_Y0, 5).value == 20                 # two paydays of 10
    done = books["nadia-done"][1]["Safety net"]
    assert digits(done[SN_BUF].value) == "$500$500" and done[SN_READY].value == "ready"
    assert done.cell(SN_Y0, 5).value == 190                  # 19 paydays of 10
    blank = books["blank"][1]["Safety net"]
    assert blank[SN_EMPTY].value.startswith("No yearly bills yet.")


# ------------------------------------------------------------------------------------------------ Open me and the style every tab shares
def all_text(ws) -> str:
    return " | ".join(c.value for row in ws.iter_rows() for c in row if isinstance(c.value, str) and not c.value.startswith("="))


def test_tabs_in_order_with_calm_colours(books):
    wb = books["blank"][0]
    assert wb.sheetnames == TABS + ["Engine", "Lists"]
    assert wb.active.title == "Open me"
    for name in TABS:
        ws = wb[name]
        assert ws.sheet_state == "visible" and ws.sheet_properties.tabColor.rgb[-6:] == "D8E7DC"  # calm band, never yellow
        assert ws.sheet_view.showGridLines is False
        title = ws["B2"]
        assert title.value == name and title.font.name == "Bricolage Grotesque" and title.font.sz == 60 and title.font.b
        assert all(_rgb(ws.cell(r, 2).fill.fgColor) == "D8E7DC" for r in (1, 2, 3, 4))  # the same band on every tab
        assert _rgb(ws.cell(5, 2).fill.fgColor) == "F8F6F0"
        assert "one paycheck at a time" in all_text(ws)  # the same footer


def test_two_font_families_only(books):
    wb = books["blank"][0]
    names = {c.font.name for n in TABS for row in wb[n].iter_rows() for c in row if c.value is not None}
    assert names == {"Bricolage Grotesque", "Inter"}


def test_open_me_says_how_to_copy_and_what_to_try(books):
    text = all_text(books["blank"][0]["Open me"])
    for piece in ("Make a copy", "Enable Editing", "Drive space", "personal Google account", "VPN", "own computer or phone",
                  SUPPORT_EMAIL, f"Version {VERSION}", "A planning tool, not financial advice."):
        assert piece in text, piece
    assert "A planning tool, not financial advice." in all_text(books["blank"][0]["Start"])


def test_freeze_and_print(books):
    wb = books["blank"][0]
    assert {n: wb[n].freeze_panes for n in TABS} == {"Open me": None, "Start": None, "Today": None, "Path": f"A{P_R1}", "Debts": None, "Safety net": None}
    for name in ("Today", "Path"):
        ws = wb[name]
        assert ws.print_area and ws.page_setup.fitToWidth == 1 and ws.sheet_properties.pageSetUpPr.fitToPage
