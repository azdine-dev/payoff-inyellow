"""Builds the PaidInYellow Paycheck Payoff Planner workbook with openpyxl. Nothing is edited by hand.

    python sheet/build_sheet.py        writes sheet/dist/1-Paycheck-Payoff-Planner.xlsx (blank)
                                       and sheet/dist/test-nadia.xlsx (Nadia filled in)

The numbers follow engine/engine_v2.py: bills on the payday before their due date, yearly bills, then the buffer,
then the extra to one debt at a time, and a paid debt's minimum rolls on. Only functions that work in both Google
Sheets and Excel 2016 are used.
"""
from __future__ import annotations

import datetime as dt
import os
import sys

from openpyxl import Workbook
from openpyxl.utils import get_column_letter as L

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from layout import *  # noqa: E402,F401,F403
import layout as lay  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(HERE, "dist")

CURRENCIES = ["$", "€", "£", "C$", "A$", "R", "₹", "DH", "₦", "AED", "SAR", "CHF", "kr", "zł"]
MONTHS = ["Any time", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]


def rng(col0: int, row: int, n: int = ND, absrow: bool = False) -> str:
    """A row range over n columns, like R26:AF26"""
    d = "$" if absrow else ""
    return f"${L(col0)}{d}{row}:${L(col0 + n - 1)}{d}{row}"


# ------------------------------------------------------------------------------------------------ Lists (hidden)
def build_lists(wb: Workbook):
    ws = wb.create_sheet("Lists")
    cols = {"A": CURRENCIES, "B": list(FREQ.values()), "C": list(METHOD.values()), "D": MONTHS, "E": [TICK]}
    heads = {"A": "Currency", "B": "Pay schedule", "C": "Payoff order", "D": "Month", "E": "Done"}
    for col, values in cols.items():
        ws[f"{col}1"] = heads[col]
        for i, v in enumerate(values):
            ws[f"{col}{2 + i}"] = v
    return ws


# ------------------------------------------------------------------------------------------------ Start (inputs)
def build_start_inputs(wb: Workbook):
    """Part 1: only the cells the engine reads, at their final places. The layout comes in Part 2."""
    ws = wb.create_sheet("Start")
    ws["C7"], ws["C8"], ws["C9"], ws["C10"] = "Currency", "How often you are paid", "Your next payday", "Twice a month only: your other pay day"
    ws[S_CUR], ws[S_FREQ], ws[S_ORDER], ws[S_GOAL] = "$", FREQ["biweekly"], METHOD["piy"], 500
    for j, h in enumerate(["#", "Name", "Balance", "Interest %", "Minimum", "Due day", "My order"]):
        ws.cell(D0 - 1, 2 + j, h)
    for i in range(ND):
        ws.cell(D0 + i, 2, i + 1)
    ws["C32"], ws["C33"], ws["C34"], ws["C35"] = "Money per payday", "Buffer now", "Buffer goal", "Payoff order"
    for j, h in enumerate(["Yearly bill", "Amount", "Month"]):
        ws.cell(Y0 - 1, 3 + j, h)
    return ws


def fill(wb: Workbook, s: dict, ticks: int = 0):
    """Types an engine scenario (the dict engine_v2.simulate takes) into the workbook."""
    st, en = wb["Start"], wb["Engine"]
    st[S_FREQ] = FREQ[s["freq"]]
    st[S_NEXT] = s["first_payday"]
    st[S_NEXT].number_format = "ddd d mmm yyyy"
    st[S_OTHER] = s.get("second_day")
    st[S_MONEY], st[S_BUF], st[S_GOAL] = s["money"], s.get("buffer", 0), s["goal"]
    st[S_ORDER] = METHOD[s.get("method", "piy")]
    for i, d in enumerate(s["debts"]):
        r = D0 + i
        for c, k in ((3, "name"), (4, "balance"), (5, "apr"), (6, "min"), (7, "due"), (8, "my_order")):
            st.cell(r, c).value = d.get(k)
    for i, y in enumerate(s.get("yearly", [])):
        name, amount, month = y if isinstance(y, (tuple, list)) else (f"Yearly bill {i + 1}", y, "Any time")
        st.cell(Y0 + i, 3).value, st.cell(Y0 + i, 4).value, st.cell(Y0 + i, 5).value = name, amount, month
    # what the sheet has no typing place for yet (kept for a later version): the tests type them on the Engine tab
    for key, col in (("adjust", C_ADJ), ("charges", C_CHG), ("buffer_used", C_BUFUSED)):
        for k, v in s.get(key, {}).items():
            en.cell(ER1 + int(k), col).value = v
    if ticks and "Path" in wb.sheetnames:
        from layout import P_DONE_COL, P_R1  # type: ignore
        for k in range(ticks):
            wb["Path"].cell(P_R1 + k, P_DONE_COL).value = TICK


# ------------------------------------------------------------------------------------------------ Engine (hidden)
def date_formula(k: str) -> str:
    """The date of payday number k (0 = the next payday typed on Start), from the schedule, never 'last + step'."""
    p0, f = f"${E_P0[0]}${E_P0[1:]}", f"Start!${S_FREQ[0]}${S_FREQ[1:]}"
    half, a, b = "$B$6", "$B$4", "$B$5"
    m = f"INT(({k}+{half})/2)"
    twice = (f"DATE(YEAR({p0}),MONTH({p0})+{m},MIN(IF(MOD({k}+{half},2)=0,{a},{b}),"
             f"DAY(EOMONTH(DATE(YEAR({p0}),MONTH({p0})+{m},1),0))))")
    return (f'IF({f}="{FREQ["monthly"]}",EDATE({p0},{k}),IF({f}="{FREQ["twice"]}",{twice},'
            f'{p0}+{k}*IF({f}="{FREQ["weekly"]}",7,14)))')


def build_engine(wb: Workbook):
    ws = wb.create_sheet("Engine")
    S = "Start!"
    A = lambda ref: f"{S}${ref[0]}${ref[1:]}"  # noqa: E731
    freq, p0 = A(S_FREQ), A(S_NEXT)

    # ---- settings
    labels = ["Paydays per year", "Yearly bills per payday", "Other pay day", "First pay day", "Second pay day",
              "Starts on the second", "Money per payday", "Buffer now", "Buffer goal", "Next payday"]
    for i, t in enumerate(labels):
        ws.cell(1 + i, 1, t)
    ws[E_PPY] = f'=IF({freq}="{FREQ["weekly"]}",52,IF({freq}="{FREQ["twice"]}",24,IF({freq}="{FREQ["monthly"]}",12,26)))'
    ws[E_YPP] = f"=SUM({S}$D${Y0}:$D${YN})/$B$1"
    ws[E_OTHER] = (f"=IF(N({A(S_OTHER)})>0,{A(S_OTHER)},IF(DAY({p0})<=15,DAY({p0})+15,"
                   f"IF(DAY({p0})=DAY(EOMONTH({p0},0)),15,DAY({p0})-15)))")
    ws[E_DAY_A] = f"=MIN(DAY({p0}),$B$3)"
    ws[E_DAY_B] = f"=MAX(DAY({p0}),$B$3)"
    ws[E_HALF] = f"=IF(DAY({p0})=$B$4,0,1)"
    ws[E_MONEY] = f"=N({A(S_MONEY)})"
    ws[E_BUF] = f"=N({A(S_BUF)})"
    ws[E_GOAL] = f"=N({A(S_GOAL)})"
    ws[E_P0] = f"=N({p0})"
    ws[E_P0].number_format = "yyyy-mm-dd"

    # ---- debts as typed, with their place in the payoff order
    for j, h in enumerate(["Typed #", "Has a balance", "Grows", "Sort key", "Place"]):
        ws.cell(EB0 - 1, 4 + j, h)
    for j, h in enumerate(["Typed row", "Name", "Rate", "Minimum", "Due day", "Start balance"]):
        ws.cell(EO0 - 1, 10 + j, h)
    order = A(S_ORDER)
    k0, kn = EB0, EB0 + ND - 1
    for i in range(ND):
        r, sr = EB0 + i, D0 + i
        bal, apr, mn, my = f"N({S}$D{sr})", f"N({S}$E{sr})", f"N({S}$F{sr})", f"N({S}$H{sr})"
        ws.cell(r, 4, i + 1)
        ws.cell(r, 5, f"=IF({bal}>0,1,0)")
        ws.cell(r, 6, f"=IF(AND({apr}>0,{mn}<={bal}*{apr}/1200),1,0)")
        ws.cell(r, 7, (f'=IF(E{r}=0,5E+15,IF({order}="{METHOD["avalanche"]}",ROUND((100-{apr})*1000,0)*1E+10+ROUND({bal}*100,0),'
                       f'IF({order}="{METHOD["custom"]}",IF({my}>0,{my},999),'
                       f'IF(F{r}=1,ROUND((100-{apr})*1000,0),1E+6+ROUND({bal}*100,0)))))'))
        # ties keep the order the debts were typed in
        ws.cell(r, 8, f"=SUMPRODUCT(--($G${k0}:$G${kn}<G{r}))+SUMPRODUCT(($G${k0}:$G${kn}=G{r})*($D${k0}:$D${kn}<D{r}))+1")
        # the debt in place i+1
        p = i + 1
        ws.cell(r, 10, f"=IFERROR(MATCH({p},$H${k0}:$H${kn},0),0)")
        ok = f"IF(J{r}=0,0,INDEX($E${k0}:$E${kn},J{r}))=1"
        src = lambda col: f"INDEX({S}${col}${D0}:${col}${DN},J{r})"  # noqa: E731
        ws.cell(r, 11, f'=IF({ok},{src("C")}&"","")')
        ws.cell(r, 12, f'=IF({ok},N({src("E")})/100,0)')
        ws.cell(r, 13, f'=IF({ok},N({src("F")}),0)')
        ws.cell(r, 14, f'=IF({ok},IF(N({src("G")})>0,N({src("G")}),""),"")')
        ws.cell(r, 15, f'=IF({ok},N({src("D")}),0)')

    # ---- rows above the simulation: what each debt column needs
    for p in range(ND):
        r = EO0 + p
        ws.cell(21, C_DUE + p, f"=$M${r}")          # minimum
        ws.cell(22, C_DUE + p, f"=$N${r}")          # due day
        ws.cell(21, C_BAL + p, f"=$L${r}")          # rate
        ws.cell(22, C_BAL + p, f"=1+$L${r}/$B$1")   # growth per payday
        ws.cell(23, C_BAL + p, p + 1)               # place
    ws.cell(21, 1, "minimum / rate"); ws.cell(22, 1, "due day / growth"); ws.cell(23, 1, "place")
    heads = ["Payday", "Date", "+/- (tests)", "Charge (tests)", "Buffer used (tests)", "Money", "To yearly bills",
             "To buffer", "Buffer after", "Bills", "Freed minimums", "For debts", "Extra paid", "Move", "Interest",
             "Owed", "Charge goes to"]
    for j, h in enumerate(heads):
        ws.cell(ER_HEAD, 1 + j, h)
    for p in range(ND):
        ws.cell(ER_HEAD, C_DUE + p, f"Due {p + 1}"); ws.cell(ER_HEAD, C_AFT + p, f"After bill {p + 1}"); ws.cell(ER_HEAD, C_BAL + p, f"Left {p + 1}")

    # ---- the state before the first payday
    r = ER_START
    ws.cell(r, C_BUFAFTER, "=$B$8")
    for p in range(ND):
        ws.cell(r, C_BAL + p, f"=$O${EO0 + p}")
    ws.cell(r, C_OWED, f"=SUM({rng(C_BAL, r)})")

    c = lambda col, row: f"${L(col)}{row}"  # noqa: E731
    growth, rates, places = rng(C_BAL, 22, absrow=True), rng(C_BAL, 21, absrow=True), rng(C_BAL, 23, absrow=True)
    for t in range(NR + 1):
        r, pr = ER1 + t, ER1 + t - 1
        ws.cell(r, C_K, t + 1)
        ws.cell(r, C_DATE, "=" + date_formula(str(t))).number_format = "yyyy-mm-dd"
        if t == NR:
            break  # one more date only: the end of the last payday's window
        d0, d1 = c(C_DATE, r), c(C_DATE, r + 1)
        prev = rng(C_BAL, pr)
        ws.cell(r, C_AVAIL, f"=$B$7+N({c(C_ADJ, r)})")
        ws.cell(r, C_YEARLY, f"=MIN($B$2,MAX({c(C_AVAIL, r)},0))")
        ws.cell(r, C_TOBUF, f"=MIN(MAX($B$9-{c(C_BUFAFTER, pr)},0),MAX({c(C_AVAIL, r)}-{c(C_YEARLY, r)},0))")
        ws.cell(r, C_BUFAFTER, f"={c(C_BUFAFTER, pr)}+{c(C_TOBUF, r)}-N({c(C_BUFUSED, r)})")
        # a new charge goes to the first debt in payoff order that still has a balance
        first = f"({ND + 1}-SUMPRODUCT(MAX(({prev}>0.005)*({ND + 1}-{places}))))"
        ws.cell(r, C_CHGPOS, f"=IF(N({c(C_CHG, r)})=0,0,IF({first}>{ND},1,{first}))")
        ws.cell(r, C_BILLS, f"=SUMPRODUCT({prev},{growth})+N({c(C_CHG, r)})-SUM({rng(C_AFT, r)})")
        ws.cell(r, C_ROLL, f"=SUM({rng(C_DUE, r)})-{c(C_BILLS, r)}")
        ws.cell(r, C_POOL, f"=MAX({c(C_AVAIL, r)}-{c(C_YEARLY, r)}-{c(C_TOBUF, r)},0)+{c(C_ROLL, r)}")
        ws.cell(r, C_EXTRA, f"=MIN({c(C_POOL, r)},SUM({rng(C_AFT, r)}))")
        ws.cell(r, C_MOVE, f"={c(C_BILLS, r)}+{c(C_EXTRA, r)}+{c(C_YEARLY, r)}+{c(C_TOBUF, r)}")
        ws.cell(r, C_INT, f"=SUMPRODUCT({prev},{rates})/$B$1")
        ws.cell(r, C_OWED, f"=SUM({rng(C_BAL, r)})")
        for p in range(ND):
            due, aft, bal = L(C_DUE + p), L(C_AFT + p), L(C_BAL + p)
            dd, mn = f"{due}$22", f"{due}$21"
            m0 = f"DATE(YEAR({d0}),MONTH({d0}),MIN({dd},DAY(EOMONTH({d0},0))))"
            m1 = f"DATE(YEAR({d0}),MONTH({d0})+1,MIN({dd},DAY(EOMONTH({d0},1))))"
            ws.cell(r, C_DUE + p, f'=IF(OR({mn}=0,{dd}=""),0,{mn}*(({m0}>={d0})*({m0}<{d1})+({m1}>={d0})*({m1}<{d1})))')
            pre = f"({bal}{pr}*{bal}$22+IF({c(C_CHGPOS, r)}={p + 1},N({c(C_CHG, r)}),0))"
            ws.cell(r, C_AFT + p, f"={pre}-MIN({due}{r},{pre})")
            before = "0" if p == 0 else f"SUM({rng(C_AFT, r, p)})"
            x = f"MIN({aft}{r},MAX({c(C_POOL, r)}-{before},0))"
            ws.cell(r, C_BAL + p, f"=IF({aft}{r}-{x}<0.005,0,{aft}{r}-{x})")
    ws.sheet_state = "hidden"
    return ws


# ------------------------------------------------------------------------------------------------ the workbook
def build(path: str, scenario: dict | None = None, ticks: int = 0) -> str:
    wb = Workbook()
    wb.remove(wb.active)
    build_start_inputs(wb)
    build_engine(wb)
    build_lists(wb).sheet_state = "hidden"
    if scenario:
        fill(wb, scenario, ticks)
    wb.calculation.fullCalcOnLoad = True
    os.makedirs(os.path.dirname(path), exist_ok=True)
    wb.save(path)
    return path


def count_formulas(path: str) -> int:
    from openpyxl import load_workbook
    wb = load_workbook(path)
    return sum(1 for ws in wb for row in ws.iter_rows() for cell in row if isinstance(cell.value, str) and cell.value.startswith("="))


if __name__ == "__main__":
    from scenarios import NADIA
    blank = build(os.path.join(DIST, "1-Paycheck-Payoff-Planner.xlsx"))
    build(os.path.join(DIST, "test-nadia.xlsx"), NADIA)
    print("built", blank, "formulas:", count_formulas(blank))
