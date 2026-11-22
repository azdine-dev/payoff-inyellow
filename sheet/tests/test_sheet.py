"""The sheet against engine/engine_v2.py, plus the rules every tab keeps (formula count, functions, colours)."""
from __future__ import annotations

import datetime as dt
import re

import pytest

import scenarios
from conftest import all_scenarios
from engine_v2 import simulate
from layout import *  # noqa: F401,F403
from openpyxl.cell.cell import MergedCell
from openpyxl.utils import get_column_letter as L
from openpyxl.utils.cell import coordinate_from_string, column_index_from_string

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
    assert n < 50000, n


def test_only_functions_that_work_in_both(books):
    for sheet, at, f in formulas(books["blank"][0]):
        names = set(re.findall(r"([A-Z_][A-Z0-9_.]*)\(", f.upper()))
        bad = names & set(BANNED)
        assert not bad, (sheet, at, bad)


@pytest.mark.parametrize("name", ["blank", "nadia", "nadia-ticked", "nadia-done", "checks", "nofit", "thin", "twice_month", "nadia-actual-200", "nadia-actual-100", "nadia-actual-ticked"])
def test_no_error_values(books, name):
    for ws in books[name][1]:
        for row in ws.iter_rows():
            for cell in row:
                assert not (isinstance(cell.value, str) and cell.value.startswith("#") and cell.value.endswith(("!", "?", "A"))), (ws.title, cell.coordinate, cell.value)


def test_visible_formulas_are_wrapped_and_short_enough(books):
    wb = books["blank"][0]
    for sheet, at, f in formulas(wb):
        assert len(f) <= 8192, (sheet, at, len(f))
        if sheet in TABS:
            assert f.startswith("=IFERROR("), (sheet, at, f[:60])


def test_rules_only_change_what_every_program_can_change(books):
    """A colour rule may set a colour, bold or a strike. A font name or size in a rule is not portable."""
    for ws in books["blank"][0]:
        for rules in ws.conditional_formatting:
            for rule in rules.rules:
                if rule.dxf and rule.dxf.font:
                    assert rule.dxf.font.name is None and rule.dxf.font.sz is None, (ws.title, str(rules.sqref))


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
    assert notes[0] == "Add the due day from your statement."
    assert notes[1] == "The minimum is above the balance."
    assert notes[2] == "Add the balance to join the plan."
    assert notes[3] == ""
    assert st[S_MONEYNOTE].value == "Add what you can put on top of your minimums. Even 20 matters."


def test_start_says_when_yearly_bills_use_all_the_money(books):
    assert books["thin"][1]["Start"][S_MONEYNOTE].value.startswith("Your yearly bills use all of this money")
    assert books["nadia"][1]["Start"][S_MONEYNOTE].value == "On top of your minimums. Even 20 matters."


def at(ref):
    col, row = coordinate_from_string(ref)
    return row, column_index_from_string(col)


def test_start_keeps_the_order_of_the_steps(books):
    """The steps in order on the left (pay, debts, money, yearly bills); the result, then the options, on the right."""
    left = [at(r) for r in (S_NEXT, f"C{D0}", S_MONEY, f"C{Y0}")]
    right = [at(r) for r in (S_R_LINE1, S_ORDER, S_LOOK, S_SHOW)]
    assert [r for r, _ in left] == sorted(r for r, _ in left) and [r for r, _ in right] == sorted(r for r, _ in right)
    assert max(c for _, c in left) <= gend(8) < min(c for _, c in right)


def test_start_dropdowns_and_the_three_orders(books):
    wb = books["blank"][0]
    st, li = wb["Start"], wb["Lists"]
    dv = {str(d.sqref): d.formula1 for d in st.data_validations.dataValidation}
    assert dv[S_CUR].startswith("Lists!$A$2") and dv[S_FREQ] == "Lists!$B$2:$B$5" and dv[S_ORDER] == "Lists!$C$2:$C$4"
    assert dv[S_SHOW] == f'"{TICK}"'
    assert dv[S_LOOK] == "Lists!$H$2:$H$3" and [li["H2"].value, li["H3"].value] == ["Light", "Night"] and st[S_LOOK].value == "Light"
    assert [li[f"C{r}"].value for r in (2, 3, 4)] == ["PaidInYellow order", "Biggest interest first", "My own order"]
    assert li["C5"].value is None  # three orders, never more
    assert st[S_ORDER].value == "PaidInYellow order"


def test_inputs_are_unlocked_and_everything_else_is_locked(books):
    wb = books["blank"][0]
    st = wb["Start"]
    assert st.protection.sheet and not st.protection.password
    open_cells = {c.coordinate for row in st.iter_rows() for c in row if not c.protection.locked and not isinstance(c, MergedCell)}
    want = {S_CUR, S_FREQ, S_NEXT, S_OTHER, S_MONEY, S_BUF, S_GOAL, S_ORDER, S_LOOK, S_SHOW}
    want |= {f"{L(c)}{D0 + i}" for i in range(ND) for c in (SC_NAME, SC_BAL, SC_APR, SC_MIN, SC_DUE, SC_ORDER)}
    want |= {f"{L(c)}{Y0 + i}" for i in range(NY) for c in (SY_NAME, SY_AMT, SY_MONTH)}
    assert open_cells == want
    pa = wb["Path"]
    assert pa.protection.sheet
    assert {c.coordinate for row in pa.iter_rows() for c in row if not c.protection.locked and not isinstance(c, MergedCell)} == {f"{L(c)}{P_R1 + k}" for k in range(NR) for c in (P_ACTUAL_COL, P_DONE_COL)} | {W_INPUT}
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
YEARLY = ("Yearly bills", "$10", "Gifts and holidays")       # the yearly bills line names the bill
EXTRA = ("Extra to Store Card", "", "after bills and buffer")   # the extra line always names the focus debt


def today_lines(ws):
    out = []
    for i in range(NI):
        label, amount, note = (ws.cell(t_line(i), c).value or "" for c in T_COLS)
        if label:
            out.append((label, amount, note))
    return out


def test_today_shows_the_next_payday_and_its_lines(books):
    td = books["nadia"][1]["Today"]
    assert td[T_LABEL].value == "This payday · Fri 6 Nov"
    assert td[T_MAIN].value == "Move $180"
    assert today_lines(td) == [("Store Card bill", "$30", "due Thu 12 Nov"), YEARLY, ("Buffer", "$140", "to $500"), EXTRA]
    assert td[T_FLAG].value == 0  # not yellow yet
    assert td[T_FOCUS_NAME].value == "Store Card"
    assert td[T_FOCUS_LEFT].value == "$450 left"
    assert td[T_FOCUS_GONE].value == "Gone by Fri 1 Jan 2027"
    assert td[T_LATE].value == "When it is done, tick it on Path and this card turns yellow."


def test_today_turns_paid_when_the_payday_is_ticked(books):
    td = books["nadia-ticked"][1]["Today"]
    assert td[T_LABEL].value == "Fri 20 Nov is paid"
    assert td[T_MAIN].value == "PAID"
    assert td[T_SUB].value == "Next payday is Fri 4 Dec."
    assert td[T_FLAG].value == 1  # the card is yellow
    assert today_lines(td) == [("Medical bill", "$50", "due Thu 3 Dec"), ("Visa bill", "$66", "due Fri 20 Nov"),
                               YEARLY, ("Buffer", "$140", "to $500"), EXTRA]
    # the lines add up to the move of that payday in the engine
    assert books["nadia-ticked"][1]["Engine"][E_VIEWMOVE].value == pytest.approx(266)


def test_today_shows_the_amount_typed_in_actual(books):
    td = books["nadia-actual-today"][1]["Today"]
    assert td[T_MAIN].value == "Move $200"
    assert td[T_SUB].value == "This is the amount you typed on Path. Tick it there and it turns yellow."
    assert today_lines(td) == [("Medical bill", "$50", "due Thu 3 Dec"), ("Visa bill", "$66", "due Fri 20 Nov"),
                               YEARLY, ("Buffer", "$74", "to $500"), EXTRA]


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


def test_today_right_column(books):
    """The focus debt, the buffer, the debt-free date and the next two paydays, after one payday (as in design/Today)."""
    td = books["nadia-one"][1]["Today"]
    assert td[T_MAIN].value == "Move $266"
    assert (td[T_FOCUS_NAME].value, td[T_FOCUS_LEFT].value, td[T_FOCUS_GONE].value) == ("Store Card", "$425 left", "Gone by Fri 1 Jan 2027")
    assert td[T_FOCUS_SHARE].value == pytest.approx(25.33 / 450, abs=0.001)
    assert td[T_BUF].value == "$340 of $500" and td[T_BUF_NOTE].value == "$480 after this payday"
    assert td[T_BUF_SHARE].value == pytest.approx(0.68)
    assert td[T_FREE].value == "Fri 16 Jul 2027" and td[T_FREE_NOTE].value == "18 paydays left"
    soon = [tuple(td.cell(r, c).value for c in T_SOON_COLS) for r in T_SOON_ROWS]
    assert soon == [("Fri 4 Dec", "$180", "Store Card $120 extra"), ("Fri 18 Dec", "$216", "Store Card $140 extra")]
    # the date is the one key word: yellow, and nothing else on the right is
    rules = {str(r.sqref): r.rules for r in books["blank"][0]["Today"].conditional_formatting}
    assert _rgb(rules[T_FREE][0].dxf.fill.bgColor) == "FFE14D"
    blank = books["blank"][1]["Today"]
    assert all(not blank[at].value for at in (T_FOCUS_NAME, T_BUF, T_FREE, T_FREE_NOTE)) and not blank.cell(T_SOON_ROWS[0], T_SOON_COLS[0]).value


def test_today_coming_up_at_the_end(books):
    done = books["nadia-done"][1]["Today"]
    assert all(not done.cell(r, c).value for r in T_SOON_ROWS for c in T_SOON_COLS)
    assert done[T_FREE_NOTE].value == "Every payday is ticked." and done[T_BUF].value == "$500 of $500"
    assert done[T_BUF_NOTE].value == "Full. It waits for a surprise."


def test_ticks_are_a_list_with_one_choice(books):
    pa = books["blank"][0]["Path"]
    dv = {str(d.sqref): d.formula1 for d in pa.data_validations.dataValidation}
    assert dv[f"{L(P_DONE_COL)}{P_R1}:{L(P_DONE_COL)}{P_RN}"] == f'"{TICK}"'
    assert all(pa.cell(P_R1 + k, P_DONE_COL).value is None for k in range(NR))  # never ticked for the buyer


# ------------------------------------------------------------------------------------------------ Path
def amt(s):
    """A table amount in words back to a number: $1,234.50 or 1 234,50 $ or $30. Blank is 0."""
    s = str(s or "")
    if not re.search(r"\d", s):
        return 0
    n = int(re.sub(r"\D", "", s))
    return n / 100 if re.search(r"[.,]\d{2}\D*$", s.strip()) else n


def digits(s) -> str:
    """An amount in words without the separators, which change with the language of the spreadsheet"""
    return re.sub(r"[^0-9$]", "", s or "")


def test_path_tiles_and_progress(books):
    pa = books["nadia"][1]["Path"]
    assert digits(pa[P_TILE_OWED].value) == "$3250"
    assert pa[P_TILE_FREE].value == "Fri 16 Jul 2027"   # the whole date fits the tile at 24 pt
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
    assert [books["nadia-done"][1]["Engine"].cell(r, E_RING_COL).value for r in (1, 2, 3)] == [0, 0, 1]  # the ring turns yellow


def test_path_list_matches_the_engine(books):
    ref = simulate(scenarios.for_engine(scenarios.NADIA))
    pa = books["nadia"][1]["Path"]
    for r in ref["rows"]:
        row = P_R1 + r["k"]
        assert pa.cell(row, P_COLS[0]).value == this_year(r["date"])
        got = [amt(pa.cell(row, c).value) for c in P_COLS[1:6]]
        want = [r["bills"], r["yearly"], r["buffer"], r["extra"], r["total_move"]]
        assert all(abs(g - w) < 0.005 for g, w in zip(got, want)), (r["k"], got, want)
    after = P_R1 + len(ref["rows"])
    assert all(not pa.cell(after, c).value for c in P_COLS[:6])  # nothing after the last payday


def test_path_rules_and_chart(books):
    pa = books["blank"][0]["Path"]
    rules = {str(r.sqref): [x for x in r.rules] for r in pa.conditional_formatting}
    for at in P_RANGES:
        paid, current = rules[at][0], rules[at][1]
        assert _rgb(paid.dxf.fill.bgColor) == "FFE14D" and paid.dxf.font.strike    # paid rows: yellow, struck through
        # the current payday: calm and bold, no outline (Google Sheets rules draw no border), never yellow
        assert _rgb(current.dxf.fill.bgColor) == "E6EFE8" and current.dxf.font.b
        assert current.dxf.border is None or not (current.dxf.border.top and current.dxf.border.top.style)
    assert pa.freeze_panes is None                                                  # the tiles and charts stay reachable


def test_actual_and_done_lines_are_normal_borders(books):
    """Google Sheets rules can not draw a border, so the line under Actual and Done is a normal border on every row."""
    pa = books["blank"][0]["Path"]
    for k in (0, 1, NR - 1):
        for c in (P_ACTUAL_COL, P_DONE_COL):
            b = pa.cell(P_R1 + k, c).border.bottom
            assert b.style == "medium" and _rgb(b.color) == "2F4A6D", (k, c)
    assert not pa.cell(P_R1, P_TYPE_ENDS[0] + 1).border.bottom.style   # a gap between the two lines


@pytest.mark.parametrize("name, want", [("nadia", ""), ("nadia-one", "Visa grew $19, so the total moved less."), ("nadia-ticked", "")])
def test_a_note_when_a_debt_grew(books, name, want):
    """After one payday Visa owes $19 more than at the start, so paid off so far is $6 while Store Card alone paid $25."""
    wb = books[name][1]
    assert (wb["Path"][P_GREW].value or "") == want
    assert (wb["Debts"][DB_GREW].value or "") == want
    if want:
        assert digits(wb["Path"][P_TILE_PAID].value) == "$6"
        cell = books[name][0]["Path"][P_GREW]
        assert _rgb(cell.font.color) == "1F2A44" and cell.font.sz == 10   # small and ink, never red


def test_path_has_the_doughnut_and_the_area_chart(books):
    charts = {type(c).__name__: c for c in books["blank"][0]["Path"]._charts}
    assert set(charts) == {"DoughnutChart", "AreaChart"}
    ring = charts["DoughnutChart"].series[0]
    assert [p.graphicalProperties.solidFill.srgbClr for p in ring.dPt] == ["2F4A6D", "E6EFE8", "FFE14D"]
    assert charts["AreaChart"].series[0].cat.strRef.f.endswith(f"$W$1:$W${NC}")
    fill = charts["AreaChart"].series[0].graphicalProperties
    assert fill.solidFill.srgbClr == "D8E7DC" and fill.line.solidFill.srgbClr == "1F2A44"
    en = books["nadia-ticked"][1]["Engine"]
    gone = en.cell(1, E_RING_COL).value
    assert gone == pytest.approx(en[E_PCT].value) and en.cell(2, E_RING_COL).value == pytest.approx(1 - gone) and en.cell(3, E_RING_COL).value == 0


@pytest.mark.parametrize("name, want", [("nadia", "This month: $0 of $446 done"), ("nadia-one", "This month: $180 of $446 done"),
                                        ("nadia-ticked", "This month: $446 of $446 done"), ("blank", "")])
def test_this_month_beside_the_doughnut(books, name, want):
    """The paydays of this calendar month: what the plan asks for, and what is ticked (Nov 6: $180, Nov 20: $266)"""
    assert (books[name][1]["Path"][P_MONTH].value or "") == want


def what_if_reference(add: float, from_k: int = 0):
    return simulate(dict(scenarios.for_engine(scenarios.NADIA), adjust={k: add for k in range(from_k, 520)}))


@pytest.mark.parametrize("name, from_k", [("nadia-whatif", 0), ("nadia-ticked-whatif", 2)])
def test_what_if_matches_the_engine(books, name, from_k):
    """$50 more each payday from the current payday on: engine_v2.py with that "adjust", payday by payday"""
    wb = books[name][1]
    en = wb["Engine"]
    ref, plan = what_if_reference(50, from_k), simulate(scenarios.for_engine(scenarios.NADIA))
    for r in ref["rows"]:
        assert abs((en.cell(ER1 + r["k"], W_OWED).value or 0) - r["owed"]) < 0.005, (r["k"], en.cell(ER1 + r["k"], W_OWED).value, r["owed"])
        assert abs((en.cell(ER1 + r["k"], W_TOBUF).value or 0) - r["buffer"]) < 0.005, r["k"]
    assert as_date(en[E_WFREE].value) == ref["debt_free"] and en[E_WNPAY].value == ref["paydays"]
    assert en[E_WINT].value == pytest.approx(ref["interest"], abs=0.01)
    pa = wb["Path"]
    months = max(round((plan["debt_free"] - ref["debt_free"]).days / 30.4375), 0)
    saved = round(plan["interest"] - ref["interest"])
    assert pa[W_DATE].value == this_year(ref["debt_free"])
    assert pa[W_LINE].value == f"{months} month{'' if months == 1 else 's'} sooner · ${saved} less interest"
    assert pa[W_LIKE].value == "Like it? Change your money on Start."


def test_what_if_is_quiet_until_an_amount_is_typed(books):
    pa = books["nadia"][1]["Path"]
    assert not pa[W_DATE].value and not pa[W_LINE].value and not pa[W_LIKE].value
    en = books["nadia"][1]["Engine"]
    assert as_date(en[E_WFREE].value) == dt.date(2027, 7, 16) and en[E_WINT].value == pytest.approx(en[E_INTEREST].value)
    dv = {str(d.sqref): d for d in books["blank"][0]["Path"].data_validations.dataValidation}
    assert dv[W_INPUT].type == "decimal" and dv[W_INPUT].formula1 == "0"


def test_path_list_shows_the_plan_and_what_was_really_paid(books):
    pa = books["nadia-actual-200"][1]["Path"]
    row = [pa.cell(P_R1 + 1, c).value or "" for c in P_COLS[1:7]]
    assert row == ["$116", "$10", "$74", "", "$266", 200]  # bills, yearly, buffer, extra (none: blank), Move as planned, Actual
    assert not pa[P_SHORT].value
    short = books["nadia-actual-100"][1]["Path"]
    assert short[P_SHORT].value == "The amount typed for Fri 20 Nov is less than its bills. This sheet still counts the bills as paid."


def test_path_tiles_say_what_their_bars_measure(books):
    pa = books["nadia-ticked"][1]["Path"]
    caps = [pa.cell(P_CAPTION_ROW, c).value for c in P_TILE_COLS]
    assert caps[1:] == ["2 of 19 paydays done", "3% of what you owed", "next to minimums only"]
    assert digits(caps[0]) == "$3250"
    shares = [pa[s].value for s in P_SHARES]
    assert shares[1] == pytest.approx(2 / 19) and shares[0] == shares[2] == pytest.approx(books["nadia-ticked"][1]["Engine"][E_PCT].value)
    assert 0 < shares[3] < 1
    assert all(not books["blank"][1]["Path"][s].value for s in P_SHARES)   # no plan, no bar


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
        r = db_row(p)
        if ws.cell(r, DB_COLS["name"]).value:
            out.append([ws.cell(r, DB_COLS[k]).value for k in ("num", "name", "rate", "left", "paid")]
                       + [ws.cell(r, DB_PCT_COL).value, ws.cell(r, DB_COLS["gone"]).value, ws.cell(r + 3, DB_COLS["name"]).value])
    return out


def test_debts_in_payoff_order(books):
    rows = debt_rows(books["nadia"][1]["Debts"])
    assert [(r[0], r[1], amt(r[2]), digits(r[3])[:-2], r[4] or "", r[6]) for r in rows] == [
        (1, "Store Card", 26.99, "$450", "", "Fri 1 Jan 2027"), (2, "Medical", 0, "$600", "", "Fri 12 Feb 2027"),
        (3, "Visa", 22.99, "$2200", "", "Fri 16 Jul 2027")]
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
    bars = rules[DB_BARS]
    assert [_rgb(x.dxf.fill.bgColor) for x in bars][:3] == ["FFE14D", "2F4A6D", "E6EFE8"]  # paid, progress, the rest
    assert all(_rgb(rules[r][0].dxf.fill.bgColor) == "FFE14D" and "=1" in rules[r][0].formula[0] for r in DB_RANGES)  # yellow only when paid
    assert column_index_from_string(DB_BARS.split(":")[1].rstrip("0123456789")) - DB_COLS["bar"] + 1 == BAR


def test_the_debts_card_has_both_edges(books):
    """The left edge rule only on the first column, the right edge only on the last: columns BA and BB are not B."""
    rules = {str(r.sqref): r.rules for r in books["blank"][0]["Debts"].conditional_formatting}
    for i, at in enumerate(DB_RANGES):
        b = rules[at][-1].dxf.border
        sides = {s for s in ("left", "right") if b is not None and getattr(b, s) is not None and getattr(b, s).style}
        assert sides == ({"left"} if i == 0 else {"right"} if i == len(DB_RANGES) - 1 else set()), (at, sides)


def test_a_paid_bar_is_only_yellow(books):
    """Blue and the empty colour stop at 100%, so the row rule alone colours a paid bar."""
    rules = {str(r.sqref): r.rules for r in books["blank"][0]["Debts"].conditional_formatting}
    assert all("<1" in x.formula[0] for x in rules[DB_BARS][1:3])


def test_actual_reaches_debts_and_safety_net(books):
    """After two ticks, with 200 paid instead of 266, both tabs show what engine_v2.py shows."""
    ref = simulate(dict(scenarios.for_engine(scenarios.NADIA), adjust={1: -66}))
    wb = books["nadia-actual-ticked"][1]
    rows = debt_rows(wb["Debts"])
    for p, row in enumerate(rows):
        assert amt(row[3]) == pytest.approx(ref["rows"][1]["bal"][p], abs=0.005)
        gone = next(r["date"] for r in ref["rows"] if r["bal"][p] <= 0.005)
        assert row[6] == this_year(gone)
    assert digits(wb["Safety net"][SN_BUF].value) == "$414$500"  # 200 + 140 + 74


def test_a_debt_that_grows_gets_a_calm_note(books):
    rows = debt_rows(books["growing_piy"][1]["Debts"])
    assert rows[0][1] == "Dept card" and rows[0][7] == "This one grows even when you pay the minimum, so it goes first."
    assert not rows[1][7] and not rows[2][7]
    cell = books["blank"][0]["Debts"].cell(DB_R0 + 3, DB_COLS["name"])
    assert _rgb(cell.font.color) == "1F2A44"  # ink, never red


def test_yearly_bills_title_has_its_own_row(books):
    sn = books["blank"][0]["Safety net"]
    title = sn[SN_YEARLY_TITLE]
    r, _ = at(SN_YEARLY_TITLE)
    assert title.value == "Yearly bills" and title.font.sz == 14 and title.font.b
    assert r < at(SN_BUF)[0] and r < SN_HEAD   # above the big buffer number and the table


def test_safety_net(books):
    sn = books["nadia"][1]["Safety net"]
    assert digits(sn[SN_BUF].value) == "$200$500" and sn[SN_READY].value == "Full after Fri 4 Dec"   # 200, 340, 480, then 500
    row = [sn.cell(SN_Y0, c).value for c in SN_COLS]
    assert [row[0], amt(row[1]), row[2], row[3] or "", amt(row[4])] == ["Gifts and holidays", 260, "December", "", 10]  # nothing set aside yet: blank
    assert all(re.search(r"[.,]00$", row[i]) for i in (1, 4))  # cents in tables
    ticked = books["nadia-ticked"][1]["Safety net"]
    assert digits(ticked[SN_BUF].value) == "$480$500" and ticked[SN_READY].value == "Full after Fri 4 Dec"
    assert amt(ticked.cell(SN_Y0, SN_COLS[3]).value) == 20   # two paydays of 10
    done = books["nadia-done"][1]["Safety net"]
    assert digits(done[SN_BUF].value) == "$500$500" and done[SN_READY].value == "ready"
    assert amt(done.cell(SN_Y0, SN_COLS[3]).value) == 190    # 19 paydays of 10
    blank = books["blank"][1]["Safety net"]
    assert blank[SN_EMPTY].value.startswith("No yearly bills yet.")
    assert not blank[SN_READY].value


def test_yearly_bills_have_a_progress_bar(books):
    """Each bill's bar reads what is set aside over what it costs: nothing yet, then 20 of 260, then full."""
    def share(book):
        return books[book][1]["Safety net"][helper(SN_Y0)].value
    assert share("nadia") == pytest.approx(0)
    assert share("nadia-ticked") == pytest.approx(20 / 260)
    assert books["nadia"][1]["Safety net"][helper(SN_Y0 + 1)].value in (None, "")   # no second bill, no bar
    rules = {str(r.sqref) for r in books["blank"][0]["Safety net"].conditional_formatting}
    assert set(SN_PROG_BARS) <= rules


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
        assert title.value == name and title.font.name == "Bricolage Grotesque" and title.font.sz == 48 and title.font.b
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
    assert {n: wb[n].freeze_panes for n in TABS} == {"Open me": None, "Start": None, "Today": None, "Path": None, "Debts": None, "Safety net": None}
    for name in ("Today", "Path"):
        ws = wb[name]
        assert ws.print_area and ws.page_setup.fitToWidth == 1 and ws.sheet_properties.pageSetUpPr.fitToPage


# ------------------------------------------------------------------------------------------------ numbers you can trust
@pytest.mark.parametrize("name", ["nadia", "nadia-ticked", "nadia-actual-ticked", "nadia-done"])
def test_paid_off_so_far_is_the_same_on_path_and_debts(books, name):
    """The app's definition (progressStats): what you owed at the start minus what you owe now, never below 0."""
    wb = books[name][1]
    en = wb["Engine"]
    want = max(en[E_STARTOWED].value - en[E_OWEDNOW].value, 0)
    assert wb["Debts"][DB_PAIDTOTAL].value == wb["Path"][P_TILE_PAID].value
    assert amt(wb["Path"][P_TILE_PAID].value) == round(want)


def test_the_currency_symbol_shows_everywhere(books):
    wb = books["nadia-euro"][1]
    seen = []
    for name in ("Today", "Path", "Debts", "Safety net", "Start"):
        for row in wb[name].iter_rows():
            for cell in row:
                v = cell.value
                if isinstance(v, str) and re.search(r"\d", v) and ("$" in v or "€" in v):
                    assert "$" not in v, (name, cell.coordinate, v)
                    seen.append(name)
    assert set(seen) == {"Today", "Path", "Debts", "Safety net", "Start"}


@pytest.mark.parametrize("name", ["nadia", "nadia-ticked", "nadia-done"])
def test_tables_are_blank_never_a_dash_or_zero(books, name):
    for tab in ("Today", "Path", "Debts", "Safety net"):
        for row in books[name][1][tab].iter_rows():
            for cell in row:
                v = cell.value
                if cell.column >= HELP_COL:
                    continue
                if (tab == "Path" and cell.row < P_R1) or (tab, cell.coordinate) == ("Debts", DB_PAIDTOTAL):
                    continue  # the tiles: "$0 owed" and "$0 paid off" are real numbers, the tables leave a zero blank
                if cell.data_type == "n" and v == 0 and books[name][0][tab][cell.coordinate].value is not None:
                    raise AssertionError((name, tab, cell.coordinate, v))
                if cell.column >= HELP_COL:
                    continue  # quiet helpers for the colour rules, not shown
                if isinstance(v, str) and not v.endswith("%"):  # a 0% rate is a rate, not an empty amount
                    assert v.strip() not in ("-", "·", "0") and not re.fullmatch(r"\D*0([.,]00)?\D*", v.strip() or "x"), (name, tab, cell.coordinate, v)


def test_tiles_and_big_numbers_are_whole(books):
    for name in ("nadia", "nadia-ticked", "nadia-actual-ticked"):
        wb = books[name][1]
        for ref in (P_TILE_OWED, P_TILE_PAID, P_TILE_AVOID):
            assert not re.search(r"[.,]\d{2}$", wb["Path"][ref].value), (name, ref)
        assert not re.search(r"[.,]\d{2}\b", wb["Safety net"][SN_BUF].value)
        assert not re.search(r"[.,]\d{2}\b", wb["Today"][T_FOCUS_LEFT].value)
        assert not re.search(r"[.,]\d{2}\b", wb["Today"][T_BUF].value)


def test_typed_cells_take_only_what_makes_sense(books):
    st = books["blank"][0]["Start"]
    dv = {}
    for d in st.data_validations.dataValidation:
        for ref in str(d.sqref).split():
            dv[ref] = d
    def rule(ref):
        return dv[ref].type, dv[ref].formula1, dv[ref].formula2
    assert rule(S_NEXT)[0] == "date"
    col = lambda c, r0, r1: f"{L(c)}{r0}:{L(c)}{r1}"  # noqa: E731
    assert rule(col(SC_APR, D0, DN)) == ("decimal", "0", "100")
    assert rule(col(SC_DUE, D0, DN)) == ("whole", "1", "31")
    assert rule(S_OTHER) == ("whole", "1", "31")
    for ref in (col(SC_BAL, D0, DN), col(SC_MIN, D0, DN), col(SY_AMT, Y0, YN), S_MONEY, S_BUF, S_GOAL):
        assert rule(ref)[:2] == ("decimal", "0") and dv[ref].operator == "greaterThanOrEqual"
    pa = {str(d.sqref): d for d in books["blank"][0]["Path"].data_validations.dataValidation}
    act = col(P_ACTUAL_COL, P_R1, P_RN)
    assert pa[act].type == "decimal" and pa[act].formula1 == "0"
    for d in list(dv.values()) + list(pa.values()):
        assert d.showErrorMessage and d.error and "!" not in d.error


# ------------------------------------------------------------------------------------------------ the design system
def test_the_same_grid_on_every_tab(books):
    """12 columns of 6 narrow cells (1.5 wide, so about 9) with gutters of 2, the same left edge everywhere"""
    wb = books["blank"][0]
    for name in TABS:
        ws = wb[name]
        assert ws.column_dimensions["A"].width == MARGIN_W
        for g in range(1, 13):
            assert all(ws.column_dimensions[L(c)].width == SUB_W for c in range(gcol(g), gend(g) + 1)), (name, g)
            if g < 12:
                assert ws.column_dimensions[L(gend(g) + 1)].width == GUT_W, (name, g)
        assert ws.column_dimensions[L(HELP_COL)].hidden   # the quiet helpers
        px = sum(int(((256 * ws.column_dimensions[L(c)].width + 18) / 256) * 7) for c in range(1, NCOL + 1))
        assert 1150 <= px <= 1250, (name, px)              # about 1,200 pixels wide, like the designs


def test_the_band_the_brand_and_the_footer(books):
    wb = books["blank"][0]
    for name in TABS:
        ws = wb[name]
        purpose, brand, slogan = ws.cell(3, gcol(1)), ws.cell(2, gcol(9)), ws.cell(3, gcol(9))
        assert purpose.value == PURPOSE[name] and _rgb(purpose.font.color) == "5C5A55"
        assert brand.value == "PaidInYellow" and brand.font.name == "Bricolage Grotesque" and brand.font.sz == 20
        assert _rgb(brand.font.color) == "1F2A44" and brand.alignment.horizontal == "right"
        assert slogan.value == "one paycheck at a time"
        cells = {c.value: c for row in ws.iter_rows() for c in row if c.value in ("A planning tool, not financial advice.", "paidinyellow.com")}
        assert len(cells) == 2, name
        assert cells["paidinyellow.com"].alignment.horizontal == "right"


def test_nothing_below_10_points(books):
    wb = books["blank"][0]
    for name in TABS:
        for row in wb[name].iter_rows():
            for cell in row:
                if cell.value is not None and cell.column < HELP_COL:
                    assert cell.font.sz >= 10, (name, cell.coordinate, cell.font.sz)


def test_no_character_bars(books):
    for name in TABS:
        for row in books["blank"][0][name].iter_rows():
            for cell in row:
                assert not (isinstance(cell.value, str) and ("\u2588" in cell.value or "\u2591" in cell.value)), (name, cell.coordinate)


def test_typed_cells_are_white_with_an_action_line_and_labels_bold(books):
    st = books["blank"][0]["Start"]
    for row in st.iter_rows():
        for cell in row:
            if not cell.protection.locked and not isinstance(cell, MergedCell):  # a merged cell follows its first cell
                assert _rgb(cell.fill.fgColor) == "FFFFFF" and not cell.font.b, cell.coordinate
                assert cell.border.bottom.style == "medium" and _rgb(cell.border.bottom.color) == "2F4A6D", cell.coordinate
    for ref in (S_CUR, S_MONEY):
        r, _ = at(ref)
        assert st.cell(r, S_LABEL).font.b and st.cell(r, S_LABEL).font.sz == 11


def test_one_bar_style_everywhere(books):
    """20 narrow cells: yellow only at 100%, action blue for what is done, calm (or white on a calm card) for the rest"""
    wb = books["blank"][0]
    bars = [("Path", b) for b in P_TILE_BARS] + [("Safety net", SN_BAR), ("Debts", DB_BARS)] + [("Today", b) for b in T_BARS]
    for name, rng_ in bars:
        rules = {str(r.sqref): r.rules for r in wb[name].conditional_formatting}[rng_]
        c0, c1 = (column_index_from_string(x.rstrip("0123456789")) for x in rng_.split(":"))
        assert c1 - c0 + 1 == BAR, (name, rng_)
        colours = [_rgb(x.dxf.fill.bgColor) for x in rules][:3]
        assert colours[:2] == ["FFE14D", "2F4A6D"] and colours[2] in ("E6EFE8", "FFFFFF"), (name, colours)
        assert ">=0.9995" in rules[0].formula[0] or "=1" in rules[0].formula[0]


def test_cards_are_white_on_paper_with_a_thin_line(books):
    ws = books["blank"][0]["Path"]
    tile = ws.cell(7, gcol(1))
    assert _rgb(tile.fill.fgColor) == "FFFFFF" and tile.border.left.style == "thin" and _rgb(tile.border.left.color) == "E2DCCD"
    assert _rgb(ws.cell(7, gcol(1) - 1).fill.fgColor) == "F8F6F0"
