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
from openpyxl.chart import AreaChart, DoughnutChart, Reference
from openpyxl.chart.series import DataPoint
from openpyxl.chart.shapes import GraphicalProperties
from openpyxl.drawing.line import LineProperties
from openpyxl.utils import get_column_letter as L

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from layout import *  # noqa: E402,F401,F403
import style as st  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(HERE, "dist")

CURRENCIES = ["$", "€", "£", "C$", "A$", "R", "₹", "DH", "₦", "AED", "SAR", "CHF", "kr", "zł"]
WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
MONTHS = ["Any time", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]


def rng(col0: int, row: int, n: int = ND, absrow: bool = False) -> str:
    """A row range over n columns, like R26:AF26"""
    d = "$" if absrow else ""
    return f"${L(col0)}{d}{row}:${L(col0 + n - 1)}{d}{row}"


def EN(ref: str) -> str:
    """An absolute reference to a cell of the Engine tab"""
    col = ref.rstrip("0123456789")
    return f"Engine!${col}${ref[len(col):]}"


def dtext(x: str) -> str:
    """A date in words, like Fri 16 Jul 2027. The year shows only when it is not this year. No TEXT(): its
    patterns change with the language of the spreadsheet."""
    return (f'INDEX(Lists!$F$2:$F$8,WEEKDAY({x}))&" "&DAY({x})&" "&INDEX(Lists!$G$2:$G$13,MONTH({x}))'
            f'&IF(YEAR({x})=YEAR({EN(E_TODAY)}),""," "&YEAR({x}))')


def mtext(x: str) -> str:
    """A month in words, like April 2031"""
    return f'INDEX(Lists!$D$3:$D$14,MONTH({x}))&" "&YEAR({x})'


def money0(x: str) -> str:
    """A big summary amount in whole units, like $3,250"""
    return f'{EN(E_CUR)}&FIXED({x},0)'


def money(x: str) -> str:
    """An amount in words with the buyer's currency symbol: $180, or $1,234.50 when there are cents"""
    return f'{EN(E_CUR)}&IF(ROUND({x},2)=ROUND({x},0),FIXED({x},0),FIXED({x},2))'


# ------------------------------------------------------------------------------------------------ Lists (hidden)
def build_lists(wb: Workbook):
    ws = wb.create_sheet("Lists")
    cols = {"A": CURRENCIES, "B": list(FREQ.values()), "C": list(METHOD.values()), "D": MONTHS, "E": [TICK],
            "F": WEEKDAYS, "G": MONTHS_SHORT}
    heads = {"A": "Currency", "B": "Pay schedule", "C": "Payoff order", "D": "Month", "E": "Done", "F": "Weekday", "G": "Month, short"}
    for col, values in cols.items():
        ws[f"{col}1"] = heads[col]
        for i, v in enumerate(values):
            ws[f"{col}{2 + i}"] = v
    return ws


# ------------------------------------------------------------------------------------------------ Start
def build_start(wb: Workbook):
    """All typing happens here: pay, debts, money, the payoff order. The result sits in a calm block at the bottom."""
    ws = wb.create_sheet("Start")
    st.page(ws, 10, 62, {"A": 1.5, "B": 5, "C": 40, "D": 22, "E": 14, "F": 14, "G": 11, "H": 11, "I": 52, "J": 1.5}, "Start")
    show = f"${S_SHOW[0]}${S_SHOW[1:]}"
    inputs: list[str] = []

    def typed(ref: str, fmt: str | None = None, align=st.LEFT):
        st.input_cell(ws[ref], fmt, align)
        inputs.append(ref)

    def hint(row: int, text: str, col: int = 5):
        c = ws.cell(row, col, text)
        c.font = st.font(9, color=st.GRAY)

    # ---- Step 1
    st.section(ws, 6, 2, "Step 1 · Your pay")
    for row, text in ((7, "Currency"), (8, "How often you are paid"), (9, "Your next payday"), (10, "Twice a month only: your other pay day")):
        st.label(ws, row, 3, text, bold=True)
    typed(S_CUR); typed(S_FREQ); typed(S_NEXT, "ddd d mmm yyyy"); typed(S_OTHER, "0")
    ws[S_CUR], ws[S_FREQ] = "$", FREQ["biweekly"]
    st.dropdown(ws, S_CUR, f"Lists!$A$2:$A${1 + len(CURRENCIES)}")
    st.dropdown(ws, S_FREQ, "Lists!$B$2:$B$5", allow_blank=False)
    hint(7, "Pick your symbol.")
    hint(8, "Every week, every 2 weeks, twice a month or every month.")
    hint(9, "Your whole plan follows your paydays.")
    hint(10, "For example 15, or 31 for the last day. Leave it empty for the usual pair.")
    ws[S_DATECHECK] = ('=IF(ISNUMBER(IFERROR(DATEVALUE("5/30/2026"),"")),"This sheet reads dates as MM/DD/YYYY.",'
                       '"This sheet reads dates as DD/MM/YYYY.")')
    ws[S_DATECHECK].font = st.font(9, color=st.GRAY)

    # ---- Step 2
    st.section(ws, 13, 2, "Step 2 · Your debts")
    for j, h in enumerate(["#", "Name", "Balance", "Interest %", "Minimum", "Due day", "My order"]):
        st.head(ws, D0 - 1, 2 + j, h, st.LEFT if j < 2 else st.RIGHT)
    hint(13, "Balance, interest and minimum are on your statement. Due day is the day of the month, 1 to 31.", 4)
    order = f"${S_ORDER[0]}${S_ORDER[1:]}"
    for i in range(ND):
        r = D0 + i
        n = ws.cell(r, 2, i + 1)
        n.font = st.font(9, color=st.GRAY)
        typed(f"C{r}")
        typed(f"D{r}", "#,##0.00", st.RIGHT); typed(f"E{r}", "0.00", st.RIGHT); typed(f"F{r}", "#,##0.00", st.RIGHT)
        typed(f"G{r}", "0", st.RIGHT); typed(f"H{r}", "0", st.RIGHT)
        bal, mn, due = f"N($D{r})", f"N($F{r})", f"N($G{r})"
        note = ws.cell(r, S_NOTE_COL, (
            f'=IF({bal}<=0,IF(OR($C{r}<>"",{mn}>0),"Add the balance and this debt joins your plan.",""),'
            f'IF(AND({mn}>0,{due}=0),"Add the due day. It is on your statement.",'
            f'IF(OR({due}<0,{due}>31,{due}<>INT({due})),"The due day is a day of the month, 1 to 31.",'
            f'IF({mn}>{bal},"The minimum is more than the balance. Have a look at both.",""))))'))
        note.font = st.font(9, color=st.GRAY)
    # "My order" only shows when the order is "My own order": it fades into the paper otherwise
    hide = st.Font(color=st.PAPER)
    st.when(ws, f"H{D0 - 1}", f'{order}<>"{METHOD["custom"]}"', fnt=hide)
    st.when(ws, f"H{D0}:H{DN}", f'{order}<>"{METHOD["custom"]}"', st.PAPER, fnt=hide, border=st.NO_BORDER)

    # ---- Step 3
    st.section(ws, 31, 2, "Step 3 · Your money")
    for row, text in ((32, "Money for the plan each payday"), (33, "Buffer: set aside now"), (34, "Buffer goal"), (47, "Payoff order")):
        st.label(ws, row, 3, text, bold=True)
    typed(S_MONEY, "#,##0.00"); typed(S_BUF, "#,##0.00"); typed(S_GOAL, "#,##0.00"); typed(S_ORDER)
    ws[S_GOAL], ws[S_ORDER] = 500, METHOD["piy"]
    st.dropdown(ws, S_ORDER, "Lists!$C$2:$C$4", allow_blank=False)
    ws[S_MONEYNOTE] = (f'=IF(AND({EN(E_STARTOWED)}>0.005,N({S_MONEY})<=0),"Add what you can put on top of your minimums. Even 20 matters.",'
                       f'IF(AND(N({S_MONEY})>0,N({S_MONEY})<={EN(E_YPP)}),"Your yearly bills use all of this money, so the buffer and the extra wait. A little more helps.",'
                       f'IF(AND({EN(E_HASPLAN)}=1,{EN(E_FITS)}=0),"With this amount the plan does not end in the time this sheet can show. A little more helps.",'
                       f'"On top of your minimums. Even 20 matters.")))')
    ws[S_MONEYNOTE].font = st.font(9, color=st.GRAY)
    hint(33, "Money for surprises. Empty is fine.")
    hint(34, "Kept in a plain separate account or an envelope.")
    hint(47, "PaidInYellow order pays the smallest debt first, and a debt that grows before that.")
    st.label(ws, 37, 3, "Yearly bills (optional)", bold=True)
    st.head(ws, 37, 4, "Amount a year", st.RIGHT); st.head(ws, 37, 5, "Month needed")
    hint(37, "Car repairs, gifts, insurance. A little goes aside each payday.", 6)
    for i in range(NY):
        r = Y0 + i
        typed(f"C{r}"); typed(f"D{r}", "#,##0.00", st.RIGHT); typed(f"E{r}")
    st.dropdown(ws, f"E{Y0}:E{YN}", "Lists!$D$2:$D$14")

    # ---- Show where to type
    st.label(ws, 48, 3, "Show where to type", bold=True)
    typed(S_SHOW, align=st.CENTER)
    st.dropdown(ws, S_SHOW, f'"{TICK}"')
    hint(48, "Pick the tick and every cell you can type in turns sage.")
    for ref in inputs:
        if ref != S_SHOW:
            st.when(ws, ref, f'{show}="{TICK}"', st.CALM)

    # ---- the result
    st.block(ws, 50, 56, 3, 9)
    ok = f"AND({EN(E_HASPLAN)}=1,{EN(E_FITS)}=1)"
    ws[S_R_LINE1] = (f'=IF({EN(E_HASPLAN)}=0,"Fill in the three steps and your date shows here.",'
                     f'IF({EN(E_FITS)}=0,"This plan does not end in the time this sheet can show. A little more each payday helps.",'
                     f'"You can be debt-free by"))')
    ws[S_R_LINE1].font = st.font(11, color=st.GRAY)
    ws[S_R_DATE] = f'=IFERROR(IF({ok},{dtext(EN(E_FREE))},""),"")'
    ws[S_R_DATE].font = st.font(24, bold=True, title=True)
    ws.row_dimensions[52].height = 40
    st.when(ws, S_R_DATE, f'${S_R_DATE[0]}${S_R_DATE[1:]}<>""', st.YELLOW)  # the one key word
    ws[S_R_STEP] = f'=IFERROR(IF({ok},"First step: move "&{money(EN(E_FIRSTMOVE))}&" on "&{dtext(EN(E_P0))}&".",""),"")'
    ws[S_R_STEP].font = st.font(12, bold=True)
    ws[S_R_MIN] = (f'=IFERROR(IF({ok},IF(ISNUMBER({EN(E_MINDATE)}),"With minimums only: about "&{mtext(EN(E_MINDATE))}&".",'
                   f'"With minimums only it never ends. Your plan ends it."),""),"")')
    ws[S_R_SOONER] = (f'=IFERROR(IF(AND({ok},ISNUMBER({EN(E_SOONER)})),IF({EN(E_SOONER)}>0,"That is about "&{EN(E_SOONER)}&" month"&IF({EN(E_SOONER)}=1,"","s")&" sooner.",""),""),"")')
    for ref in (S_R_MIN, S_R_SOONER):
        ws[ref].font = st.font(10, color=st.GRAY)
    st.footer(ws, 59)
    return ws


def fill(wb: Workbook, s: dict, ticks: int = 0, today: dt.date | None = None):
    """Types an engine scenario (the dict engine_v2.simulate takes) into the workbook."""
    st, en = wb["Start"], wb["Engine"]
    if today:
        en[E_TODAY_TEST] = today
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
    for k, v in s.get("actual", {}).items():
        wb["Path"].cell(P_R1 + int(k), P_ACTUAL_COL).value = v
    if ticks:
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

    # ---- minimums only, per debt (NPER), the baseline the plan is compared with
    ws.cell(EO0 - 1, C_NPER, "Minimums only: months"); ws.cell(EO0 - 1, C_NPERINT, "Minimums only: interest")
    for i in range(ND):
        r = EO0 + i
        ws.cell(r, C_NPER, f"=IF(O{r}<=0,0,IF(M{r}<=0,1E+9,IF(AND(L{r}>0,M{r}<=O{r}*L{r}/12),1E+9,IF(L{r}=0,O{r}/M{r},NPER(L{r}/12,-M{r},O{r})))))")
        ws.cell(r, C_NPERINT, f"=IF(OR(P{r}>=1E+9,P{r}=0),0,M{r}*P{r}-O{r})")

    # ---- one answer per cell
    owed = f"${L(C_OWED)}${ER1}:${L(C_OWED)}${ERN}"
    dates = f"${L(C_DATE)}${ER1}:${L(C_DATE)}${ERN}"
    np_, nint = f"${L(C_NPER)}${EO0}:${L(C_NPER)}${EO0 + ND - 1}", f"${L(C_NPERINT)}${EO0}:${L(C_NPERINT)}${EO0 + ND - 1}"
    answers = {
        E_NPAY: ("Paydays to the end", f'=SUMPRODUCT(--({owed}>0.005))+1'),
        E_FITS: ("Ends inside the sheet", f"=IF(INDEX({owed},{NR})<0.005,1,0)"),
        E_HASPLAN: ("Has a plan", "=IF(AND($S$13>0.005,$B$10>0),1,0)"),
        E_FREE: ("Debt-free date", f'=IF(AND($S$3=1,$S$2=1),INDEX({dates},$S$1),"")'),
        E_FIRSTMOVE: ("First move", f"=IF($S$3=1,{L(C_MOVE)}{ER1},0)"),
        E_MINMONTHS: ("Minimums only: months", f'=IF(MAX({np_})>=1E+9,"never",MAX({np_}))'),
        E_MINDATE: ("Minimums only: date", '=IF(AND($S$3=1,ISNUMBER($S$6)),$B$10+ROUND($S$6*30.4375,0),"")'),
        E_SOONER: ("Months sooner", '=IF(AND(ISNUMBER($S$4),ISNUMBER($S$7)),MAX(ROUND(($S$7-$S$4)/30.4375,0),0),"")'),
        E_INTEREST: ("Interest on the plan", f"=SUM(${L(C_INT)}${ER1}:${L(C_INT)}${ERN})"),
        E_MININTEREST: ("Interest on minimums only", f"=SUM({nint})"),
        E_AVOIDED: ("Interest avoided", '=IF(AND($S$2=1,ISNUMBER($S$6)),MAX($S$10-$S$9,0),"")'),
        E_STARTOWED: ("Owed at the start", f"=${L(C_OWED)}${ER_START}"),
        E_CUR: ("Currency", f'=IF({A(S_CUR)}="","$",{A(S_CUR)}&"")'),
    }
    for ref, (text, f) in answers.items():
        ws[f"R{ref[1:]}"] = text
        ws[ref] = f
    for ref in (E_FREE, E_MINDATE):
        ws[ref].number_format = "yyyy-mm-dd"

    # ---- where the plan stands: the ticks on Path, and the payday Today shows
    done = f"Path!${L(P_DONE_COL)}${P_R1}:${L(P_DONE_COL)}${P_RN}"
    ks = f"${L(C_K)}${ER1}:${L(C_K)}${ERN}"
    col = lambda cc, first=ER1: f"${L(cc)}${first}:${L(cc)}${first + NR - 1}"  # noqa: E731
    ws["A12"] = "Today (tests)"
    ws[E_TODAY_TEST].number_format = "yyyy-mm-dd"
    view = "$S$18"
    stand = {
        E_CURK: ("First payday not ticked", f'=SUMPRODUCT(MIN(({done}="{TICK}")*100000+{ks}))'),
        E_TODAY: ("Today", "=IF(N($B$12)>0,$B$12,TODAY())"),
        E_PAIDMODE: ("Paid, waiting for the next payday", f"=IF(AND($S$3=1,$S$2=1,$S$15>1,$S$15<=$S$1,$S$16<INDEX({dates},MIN($S$15,{NR}))),1,0)"),
        E_VIEW: ("Payday Today shows", "=IF(OR($S$3=0,$S$2=0),0,IF($S$17=1,$S$15-1,MIN($S$15,$S$1)))"),
        E_ALLDONE: ("Every payday ticked", "=IF(AND($S$3=1,$S$2=1,$S$15>$S$1),1,0)"),
        E_LATE: ("Paydays gone by and not ticked", f'=IF($S$3=0,0,SUMPRODUCT(({dates}<$S$16)*({done}<>"{TICK}")*({ks}<=$S$1)))'),
        E_VIEWDATE: ("Its date", f'=IF({view}=0,"",INDEX({dates},{view}))'),
        E_NEXTDATE: ("The payday after", f'=IF({view}=0,"",INDEX({col(C_DATE, ER1 + 1)},{view}))'),
        E_VIEWMOVE: ("Its move", f"=IF({view}=0,0,INDEX({col(C_MOVE)},{view}))"),
        E_NITEMS: ("Lines it has", f"=MAX({rng(C_BAL, ROW_ICOUNT, NI, absrow=True)})"),
        E_FOCUSPOS: ("Focus debt (place)", (f"=IF({ND + 1}-SUMPRODUCT(MAX(({rng(C_BAL, ROW_XTRA, absrow=True)}>0.005)*({ND + 1}-{rng(C_BAL, 23, absrow=True)})))<={ND},"
                                            f"{ND + 1}-SUMPRODUCT(MAX(({rng(C_BAL, ROW_XTRA, absrow=True)}>0.005)*({ND + 1}-{rng(C_BAL, 23, absrow=True)}))),"
                                            f"IF({ND + 1}-SUMPRODUCT(MAX(({rng(C_BAL, ROW_LEFT, absrow=True)}>0.005)*({ND + 1}-{rng(C_BAL, 23, absrow=True)})))<={ND},"
                                            f"{ND + 1}-SUMPRODUCT(MAX(({rng(C_BAL, ROW_LEFT, absrow=True)}>0.005)*({ND + 1}-{rng(C_BAL, 23, absrow=True)}))),0))")),
        E_OWEDNOW: ("Owed now", f"=SUM({rng(C_BAL, ROW_LEFT, absrow=True)})"),
        E_PAIDSOFAR: ("Paid off so far", "=MAX($S$13-$U$7,0)"),
        E_DEBTSPAID: ("Debts paid", f"=SUMPRODUCT(--($O${EO0}:$O${EO0 + ND - 1}>0))-SUMPRODUCT(--({rng(C_BAL, ROW_LEFT, absrow=True)}>0.005))"),
        E_NDEBTS: ("Debts", f"=SUMPRODUCT(--($O${EO0}:$O${EO0 + ND - 1}>0))"),
    }
    left_row, gone_row = rng(C_BAL, ROW_LEFT, absrow=True), rng(C_BAL, ROW_GONE, absrow=True)
    stand[E_NEXTGONE] = ("Next debt gone on", f"=SUMPRODUCT(MIN(({left_row}>0.005)*({gone_row}>0)*{gone_row}+(1-({left_row}>0.005)*({gone_row}>0))*1E+9))")
    stand[E_NEXTGONEPOS] = ("Next debt gone (place)", f"=IF($U$12>=1E+9,0,IFERROR(MATCH($U$12,{gone_row},0),0))")
    stand[E_PCT] = ("Share gone", "=IF($S$13>0.005,MIN($U$8/$S$13,1),0)")
    stand[E_SHORTK] = ("First Actual below its bills", f"=IFERROR(MATCH(1,{col(C_SHORT)},0),0)")
    typed = f"Path!${L(P_ACTUAL_COL)}${P_R1}:${L(P_ACTUAL_COL)}${P_RN}"
    stand[E_TICKED] = ("Paydays ticked", f'=IF($S$3=0,0,SUMPRODUCT(({done}="{TICK}")*({ks}<=$S$1)))')
    stand[E_VIEWACTUAL] = ("Today shows a typed Actual", f"=IF({view}=0,0,IF(ISNUMBER(INDEX({typed},{view})),1,0))")
    upto = f"MIN($S$15,$S$1+1,{NR + 1})"
    stand[E_BUFNOW] = ("Buffer now", f"=INDEX(${L(C_BUFAFTER)}${ER_START}:${L(C_BUFAFTER)}${ERN},{upto})")
    stand[E_YSAVED] = ("Yearly bills money so far", f"=SUMPRODUCT(({ks}<{upto})*{col(C_YEARLY)})")
    for ref, (text, f) in stand.items():
        lab = ("R" if ref[0] == "S" else "T") + ref[1:]
        ws[lab] = text
        ws[ref] = f
    for ref in (E_TODAY, E_VIEWDATE, E_NEXTDATE):
        ws[ref].number_format = "yyyy-mm-dd"

    # ---- the chart: what is owed at NC moments from now to the end, so the line always fills the picture
    ws["V1"] = "Chart"
    for j in range(NC):
        kj = f"MIN(ROUND({j}*MIN($S$1,{NR})/{NC - 1},0),{NR})"
        dj = f"INDEX(${L(C_DATE)}${ER1}:${L(C_DATE)}${ERN + 1},MAX({kj},1))"
        # every third point has a label, so a month never shows twice in a row
        ws.cell(1 + j, 23, f'=IF($S$3=0,"",INDEX(Lists!$G$2:$G$13,MONTH({dj}))&" "&YEAR({dj}))' if j % 3 == 0 else '=""')
        ws.cell(1 + j, 24, f"=IF($S$3=0,0,INDEX(${L(C_OWED)}${ER_START}:${L(C_OWED)}${ERN},{kj}+1))")

    # ---- the doughnut: gone, left, and yellow only when everything is gone
    full = "$U$13>=0.9995"
    for row, f in ((1, f"=IF({full},0,$U$13)"), (2, f"=IF({full},0,1-$U$13)"), (3, f"=IF({full},1,0)")):
        ws.cell(row, E_RING_COL, f)

    # ---- per debt (in payoff order), and the lines of the payday Today shows
    for text, row in (("line", ROW_ILABEL), ("amount", ROW_IAMOUNT), ("lines so far", ROW_ICOUNT), ("note", ROW_INOTE),
                      ("left now", ROW_LEFT), ("gone by", ROW_GONE), ("extra", ROW_XTRA)):
        ws.cell(row, C_BAL - 1, text)
    d0, d1 = "$U$2", "$U$3"
    for p in range(ND):
        cc = C_BAL + p
        bal, aft = L(cc), L(C_AFT + p)
        name, dd = f"$K${EO0 + p}", f"$N${EO0 + p}"
        prev = f"INDEX(${bal}${ER_START}:${bal}${ERN - 1},{view})"
        ws.cell(ROW_IAMOUNT, cc, f"=IF({view}=0,0,IF({prev}*{bal}$22-INDEX({col(C_AFT + p)},{view})<0.005,0,{prev}*{bal}$22-INDEX({col(C_AFT + p)},{view})))")
        ws.cell(ROW_ILABEL, cc, f'={name}&" bill"')
        m0 = f"DATE(YEAR({d0}),MONTH({d0}),MIN({dd},DAY(EOMONTH({d0},0))))"
        m1 = f"DATE(YEAR({d0}),MONTH({d0})+1,MIN({dd},DAY(EOMONTH({d0},1))))"
        due = f'IF(AND({m0}>={d0},{m0}<{d1}),{m0},{m1})'
        ws.cell(ROW_INOTE, cc, f'=IFERROR(IF(OR({view}=0,{dd}=""),"","due "&{dtext(due)}),"")')
        ws.cell(ROW_LEFT, cc, f"=INDEX(${bal}${ER_START}:${bal}${ERN},MIN($S$15,$S$1+1,{NR + 1}))")
        ws.cell(ROW_GONE, cc, f'=IF(AND($O${EO0 + p}>0,$S$2=1),INDEX({dates},SUMPRODUCT(--({col(cc)}>0.005))+1),0)')
        ws.cell(ROW_GONE, cc).number_format = "yyyy-mm-dd"
        ws.cell(ROW_XTRA, cc, f"=IF({view}=0,0,INDEX({col(C_AFT + p)},{view})-INDEX({col(cc)},{view}))")
    focus_name = f'IF($U$6=0,"",INDEX($K${EO0}:$K${EO0 + ND - 1},$U$6))'
    others = [("Yearly bills", C_YEARLY, '""'), ("Buffer", C_TOBUF, '""'), (None, C_EXTRA, '""')]
    for j, (text, src, note) in enumerate(others):
        cc = C_BAL + ND + j
        ws.cell(ROW_ILABEL, cc, f'="{text}"' if text else f'="Extra to "&{focus_name}')
        ws.cell(ROW_IAMOUNT, cc, f"=IF({view}=0,0,IF(INDEX({col(src)},{view})<0.005,0,INDEX({col(src)},{view})))")
        ws.cell(ROW_INOTE, cc, f"={note}")
    for j in range(NI):
        cc = C_BAL + j
        before = "0" if j == 0 else f"{L(cc - 1)}{ROW_ICOUNT}"
        ws.cell(ROW_ICOUNT, cc, f"={before}+IF({L(cc)}{ROW_IAMOUNT}>0.005,1,0)")

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
    for cc, h in ((C_AVAIL0, "Money as planned"), (C_Y0, "Yearly as planned"), (C_B0, "Buffer as planned"),
                  (C_MOVE0, "Move as planned"), (C_SHORT, "Actual below bills")):
        ws.cell(ER_HEAD, cc, h)

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
        # Actual follows the engine's "+/- this payday": the difference from the planned move joins this payday's money
        actual = f"Path!${L(P_ACTUAL_COL)}${P_R1 + t}"
        ws.cell(r, C_AVAIL0, f"=$B$7+N({c(C_ADJ, r)})")
        ws.cell(r, C_Y0, f"=MIN($B$2,MAX({c(C_AVAIL0, r)},0))")
        ws.cell(r, C_B0, f"=MIN(MAX($B$9-{c(C_BUFAFTER, pr)},0),MAX({c(C_AVAIL0, r)}-{c(C_Y0, r)},0))")
        ws.cell(r, C_MOVE0, (f"={c(C_BILLS, r)}+{c(C_Y0, r)}+{c(C_B0, r)}+MIN(MAX({c(C_AVAIL0, r)}-{c(C_Y0, r)}-{c(C_B0, r)},0)"
                             f"+{c(C_ROLL, r)},SUM({rng(C_AFT, r)}))"))
        ws.cell(r, C_AVAIL, f"={c(C_AVAIL0, r)}+IF(ISNUMBER({actual}),{actual}-{c(C_MOVE0, r)},0)")
        ws.cell(r, C_SHORT, f"=IF(ISNUMBER({actual}),IF({actual}<{c(C_BILLS, r)}-0.005,1,0),0)")
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


# ------------------------------------------------------------------------------------------------ Today
def build_today(wb: Workbook):
    """One main number: what to move this payday. It turns yellow with PAID once that payday is ticked on Path."""
    ws = wb.create_sheet("Today")
    st.page(ws, 8, 44, {"A": 1.5, "B": 3, "C": 44, "D": 18, "E": 30, "F": 1.5, "G": 36, "H": 1.5}, "Today")
    view, paid, done = EN(E_VIEW), EN(E_PAIDMODE), EN(E_ALLDONE)
    ws[T_FLAG] = f"=IF(OR({paid}=1,{done}=1),1,0)"
    ws[T_FLAG].font = st.font(8, color=st.BAND)  # a quiet helper for the colour of the card

    st.block(ws, 6, 9, 2, 5)
    st.when(ws, "B6:E9", "$H$3=1", st.YELLOW)
    ws[T_LABEL] = (f'=IFERROR(IF({done}=1,"Every payday is ticked",IF({view}=0,"Your next payday",'
                   f'IF({paid}=1,{dtext(EN(E_VIEWDATE))}&" is paid","This payday · "&{dtext(EN(E_VIEWDATE))}))),"")')
    ws[T_LABEL].font = st.font(11, color=st.GRAY)
    ws[T_MAIN] = (f'=IFERROR(IF({done}=1,"Debt-free",IF({view}=0,"Fill in Start",'
                  f'IF({paid}=1,"PAID","Move "&{money(EN(E_VIEWMOVE))}))),"")')
    ws[T_MAIN].font = st.font(48, bold=True, title=True)
    ws.row_dimensions[7].height = 66
    ws[T_SUB] = (f'=IFERROR(IF({done}=1,"You did it, one paycheck at a time.",IF({view}=0,"Your payday and what to move show here.",'
                 f'IF({paid}=1,"Next payday is "&{dtext(EN(E_NEXTDATE))}&".",IF({EN(E_VIEWACTUAL)}=1,"This is the amount you typed on Path. Tick it there and it turns yellow.",'
                 f'"Then tick it on Path and it turns yellow.")))),"")')
    ws[T_SUB].font = st.font(10, color=st.GRAY)

    st.head(ws, T_L0 - 1, 3, "What it is made of"); st.head(ws, T_L0 - 1, 4, "Amount", st.RIGHT); st.head(ws, T_L0 - 1, 5, "")
    labels, amounts, counts, notes = (rng(C_BAL, r, NI, absrow=True) for r in (ROW_ILABEL, ROW_IAMOUNT, ROW_ICOUNT, ROW_INOTE))
    for i in range(NI):
        r = T_L0 + i
        m = f"MATCH({i + 1},Engine!{counts},0)"
        ws.cell(r, 3, f'=IFERROR(IF({i + 1}>{EN(E_NITEMS)},"",INDEX(Engine!{labels},{m})),"")').font = st.font(11)
        a = ws.cell(r, 4, f'=IFERROR(IF({i + 1}>{EN(E_NITEMS)},"",{money(f"INDEX(Engine!{amounts},{m})")}),"")')
        a.font, a.alignment = st.font(11, bold=True), st.RIGHT
        ws.cell(r, 5, f'=IFERROR(IF({i + 1}>{EN(E_NITEMS)},"",INDEX(Engine!{notes},{m})),"")').font = st.font(9, color=st.GRAY)

    st.block(ws, 6, 9, 7, 7)
    st.label(ws, 6, 7, "Focus debt", small=True)
    pos = EN(E_FOCUSPOS)
    names = f"Engine!$K${EO0}:$K${EO0 + ND - 1}"
    ws[T_FOCUS_NAME] = f'=IFERROR(IF({pos}=0,"",INDEX({names},{pos})),"")'
    ws[T_FOCUS_NAME].font = st.font(20, bold=True, title=True)
    ws[T_FOCUS_NAME].alignment = st.Alignment(horizontal="left", vertical="top")
    ws[T_FOCUS_LEFT] = f'=IFERROR(IF({pos}=0,"",{money(f"INDEX(Engine!{rng(C_BAL, ROW_LEFT, absrow=True)},{pos})")}&" left"),"")'
    gone = f"INDEX(Engine!{rng(C_BAL, ROW_GONE, absrow=True)},{pos})"
    ws[T_FOCUS_GONE] = f'=IFERROR(IF({pos}=0,"",IF({gone}>0,"Gone by "&{dtext(gone)},"")),"")'
    ws[T_FOCUS_GONE].font = st.font(10, color=st.GRAY)
    ws[T_LATE] = f'=IF({EN(E_LATE)}>=2,"A few paydays are not ticked yet. Tick them on Path.","")'
    ws[T_LATE].font = st.font(10, color=st.GRAY)
    st.footer(ws, 39)
    return ws


# ------------------------------------------------------------------------------------------------ Path
def build_path(wb: Workbook):
    """Four big numbers with a bar, how far along, the next milestone, every payday with Actual and Done, two charts."""
    ws = wb.create_sheet("Path")
    st.page(ws, 17, P_RN + 6, {"A": 1.5, "B": 20, "C": 14, "D": 14, "E": 14, "F": 14, "G": 14, "H": 14, "I": 8, "J": 1.5,
                                "K": 13, "L": 13, "M": 13, "N": 13, "O": 13, "P": 13, "Q": 1.5}, "Path")
    has, fits, pct = EN(E_HASPLAN), EN(E_FITS), EN(E_PCT)
    for ref, f in ((P_CURK, f"=IF({EN(E_ALLDONE)}=1,0,MIN({EN(E_CURK)},{EN(E_NPAY)}))"), (P_SHOW, f'=Start!${S_SHOW[0]}${S_SHOW[1:]}&""')):
        ws[ref] = f
        ws[ref].font = st.font(6, color=st.BAND)  # quiet helpers for the colours below
    cur, show = f"${P_CURK[0]}${P_CURK[1:]}", f"${P_SHOW[0]}${P_SHOW[1:]}"

    # ---- four tiles: a label, the big number, a bar, a small line
    def bar(share: str) -> str:
        n = f"ROUND(MIN(MAX({share},0),1)*16,0)"
        return f'REPT("█",{n})&REPT("░",16-{n})'

    owed, start = EN(E_OWEDNOW), EN(E_STARTOWED)
    avoided, min_int = EN(E_AVOIDED), EN(E_MININTEREST)
    can_avoid = f"AND({has}=1,ISNUMBER({avoided}))"
    ends = f"AND({has}=1,{fits}=1)"
    tiles = [
        (P_TILE_OWED, 2, "Owed now", f'IF({has}=0,"",{money0(owed)})', has + "=1", f"{owed}/{start}",
         f'IF({has}=0,"","of "&{money0(start)}&" at the start")'),
        (P_TILE_FREE, 4, "Debt-free date", f'IF({ends},{dtext(EN(E_FREE))},"")', ends, f"{EN(E_TICKED)}/{EN(E_NPAY)}",
         f'IF({ends},{EN(E_TICKED)}&" of "&{EN(E_NPAY)}&" paydays done","")'),
        (P_TILE_PAID, 6, "Paid off so far", f'IF({has}=0,"",{money0(EN(E_PAIDSOFAR))})', has + "=1", pct,
         f'IF({has}=0,"",ROUND({pct}*100,0)&"% of what you owed")'),
        (P_TILE_AVOID, 8, "Interest you avoid", f'IF({can_avoid},{money0(avoided)},"")', can_avoid, f"{avoided}/{min_int}",
         f'IF({can_avoid},"compared with minimums only","")'),
    ]
    gap = st.Border(right=st.Side(style="thick", color=st.PAPER))
    for ref, c0, text, value, on, share, small in tiles:
        c1 = c0 + 1
        st.block(ws, 6, 9, c0, c1)
        for r in range(6, 10):
            ws.cell(r, c1).border = gap
        st.label(ws, 6, c0, text, small=True)
        ws[ref] = f'=IFERROR({value},"")'
        ws[ref].font = st.font(17, bold=True, title=True)
        b = ws.cell(8, c0, f'=IFERROR(IF({on},{bar(share)},""),"")')
        b.font = st.font(8, color=st.ACTION)
        ws.cell(9, c0, f'=IFERROR({small},"")').font = st.font(8, color=st.GRAY)
        ws.merge_cells(start_row=7, end_row=7, start_column=c0, end_column=c1)
        ws.merge_cells(start_row=8, end_row=8, start_column=c0, end_column=c1)
    ws.row_dimensions[7].height = 34
    st.when(ws, P_FREE_CELLS, f'${P_TILE_FREE[0]}${P_TILE_FREE[1:]}<>""', st.YELLOW)  # the one key word

    # ---- how far along: the doughnut sits on a white card, the big number beside it
    st.block(ws, 6, 19, 11, 16, st.CARD)
    st.label(ws, 6, 11, "How far along", small=True)
    ws[P_PCT] = f'=IFERROR(IF({has}=0,"",ROUND({pct}*100,0)&"% gone"),"")'
    ws[P_PCT].font = st.font(28, bold=True, title=True)
    ws.row_dimensions[11].height = 40
    ws[P_DEBTSPAID] = f'=IFERROR(IF({has}=0,"","Debts paid "&{EN(E_DEBTSPAID)}&" of "&{EN(E_NDEBTS)}),"")'
    ws[P_DEBTSPAID].font = st.font(11, bold=True)

    # ---- the next milestone, and what needs a calm word
    names = f"Engine!$K${EO0}:$K${EO0 + ND - 1}"
    ws[P_NEXT] = (f'=IFERROR(IF({has}=0,"",IF({EN(E_NEXTGONEPOS)}=0,IF({EN(E_OWEDNOW)}<0.005,"Every debt is gone.",""),'
                  f'"Next: "&INDEX({names},{EN(E_NEXTGONEPOS)})&" gone "&{dtext(EN(E_NEXTGONE))})),"")')
    ws[P_NEXT].font = st.font(12, bold=True)
    ws[P_NOFIT] = f'=IF(AND({has}=1,{fits}=0),"This plan is longer than the list below can show. A little more each payday on Start brings the end into view.","")'
    ws[P_NOFIT].font = st.font(9, color=st.GRAY)
    short_day = f"INDEX(Engine!${L(C_DATE)}${ER1}:${L(C_DATE)}${ERN},{EN(E_SHORTK)})"
    ws[P_SHORT] = f'=IFERROR(IF({EN(E_SHORTK)}=0,"","The amount typed for "&{dtext(short_day)}&" is less than its bills. This sheet still counts the bills as paid."),"")'
    ws[P_SHORT].font = st.font(9, color=st.GRAY)

    # ---- every payday
    st.section(ws, P_R0 - 1, 2, "Your paydays")
    c = ws.cell(P_R0 - 1, 4, "Paid a different amount? Type it in Actual. Paid? Pick the tick in Done.")
    c.font = st.font(9, color=st.GRAY)
    for j, h in enumerate(["Payday", "Bills", "Yearly bills", "Buffer", "Extra to debt", "Move", "Actual", "Done"]):
        st.head(ws, P_R0, 2 + j, h, st.LEFT if j == 0 else (st.CENTER if j == 7 else st.RIGHT))
    src = [C_BILLS, C_YEARLY, C_TOBUF, C_EXTRA, C_MOVE0]  # Move stays what the plan asked for, Actual is what was paid
    for k in range(NR):
        r, er = P_R1 + k, ER1 + k
        on = f"AND({has}=1,{k + 1}<={EN(E_NPAY)})"
        ws.cell(r, 2, f'=IFERROR(IF({on},{dtext(f"Engine!$B${er}")},""),"")')
        for j, cc in enumerate(src):
            x = ws.cell(r, 3 + j, f'=IFERROR(IF({on},ROUND(Engine!${L(cc)}${er},2),""),"")')
            x.number_format, x.alignment = '#,##0.00;-#,##0.00;"·"', st.RIGHT
            if cc == C_MOVE0:
                x.font = st.font(10, bold=True)
        for cc, fmt, align in ((P_ACTUAL_COL, "#,##0.00", st.RIGHT), (P_DONE_COL, None, st.CENTER)):
            cell = st.input_cell(ws.cell(r, cc), fmt, align)
            cell.fill, cell.border = st.fill(st.PAPER), st.NO_BORDER  # a row turns white only while it is part of the plan
    st.dropdown(ws, f"I{P_R1}:I{P_RN}", f'"{TICK}"')
    st.amount_only(ws, f"H{P_R1}:H{P_RN}")
    rows, typing = f"B{P_R1}:I{P_RN}", f"H{P_R1}:I{P_RN}"
    live = f'$B{P_R1}<>""'
    st.when(ws, rows, f'$I{P_R1}="{TICK}"', st.YELLOW, fnt=st.Font(strike=True))  # paid: yellow, struck through
    # the current payday: the outline shows in Excel; Google Sheets rules have no borders, so the words turn action blue too
    edge = st.Side(style="thin", color=st.ACTION)
    st.when(ws, rows, f"ROW()-{P_R1 - 1}={cur}", None, fnt=st.Font(bold=True, color=st.ACTION), border=st.Border(top=edge, bottom=edge))
    st.when(ws, typing, f'AND({live},{show}="{TICK}")', st.CALM)  # Show where to type
    st.when(ws, rows, live, st.CARD, border=st.UNDER)

    # ---- the charts are added once the Engine tab exists (see add_charts)
    st.label(ws, 21, 11, "What you owe, payday by payday", small=True)
    st.footer(ws, 38, 11)
    return ws


def add_charts(wb: Workbook):
    ws, en = wb["Path"], wb["Engine"]

    # how far along: action blue for gone, calm for left, yellow only when everything is gone
    ring = DoughnutChart()
    ring.holeSize = 68
    ring.height, ring.width = 6.4, 6.4
    ring.legend, ring.title = None, None
    ring.add_data(Reference(en, min_col=E_RING_COL, min_row=1, max_row=3), titles_from_data=False)
    for i, rgb in enumerate((st.ACTION, st.CALM, st.YELLOW)):
        point = DataPoint(idx=i)
        point.graphicalProperties = GraphicalProperties(solidFill=rgb)
        point.graphicalProperties.line = LineProperties(solidFill=st.LINE, w=6350)
        ring.series[0].dPt.append(point)
    ws.add_chart(ring, "K7")

    # what is owed, from the first payday to the last
    area = AreaChart()
    area.height, area.width = 7.5, 14.6
    area.legend, area.title = None, None
    area.add_data(Reference(en, min_col=24, min_row=1, max_row=NC), titles_from_data=False)
    area.set_categories(Reference(en, min_col=23, min_row=1, max_row=NC))
    s = area.series[0]
    s.graphicalProperties = GraphicalProperties(solidFill=st.BAND)
    s.graphicalProperties.line = LineProperties(solidFill=st.INK, w=19050)
    area.y_axis.number_format = "#,##0"
    area.y_axis.majorGridlines = None
    area.y_axis.delete = False
    area.x_axis.delete = False
    area.x_axis.tickLblSkip = 1
    ws.add_chart(area, "K22")

    for ch in (ring, area):
        ch.visible_cells_only = False  # the numbers live on a hidden tab
        ch.roundedCorners = False
        ch.graphical_properties = GraphicalProperties(noFill=True)
        ch.graphical_properties.line = LineProperties(noFill=True)
        ch.plot_area.graphicalProperties = GraphicalProperties(noFill=True)
        ch.plot_area.graphicalProperties.line = LineProperties(noFill=True)


# ------------------------------------------------------------------------------------------------ Debts
def build_debts(wb: Workbook):
    """One row per debt, in payoff order, with a bar of ten small cells. A paid debt turns yellow with PAID."""
    ws = wb.create_sheet("Debts")
    widths = {"A": 1.5, "B": 5, "C": 28, "D": 12, "E": 15, "F": 15, "G": 1.5}
    for j in range(10):
        widths[L(8 + j)] = 2.6
    widths.update({"R": 1.5, "S": 22, "T": 56, "U": 1.5})
    st.page(ws, 21, 30, widths, "Debts")
    st.section(ws, 6, 2, "In payoff order")
    for col, text, align in ((2, "#", st.LEFT), (3, "Debt", st.LEFT), (4, "Interest %", st.RIGHT), (5, "Left now", st.RIGHT),
                             (6, "Paid so far", st.RIGHT), (8, "Progress", st.LEFT), (19, "Gone by", st.LEFT), (20, "", st.LEFT)):
        st.head(ws, DB_R0 - 1, col, text, align)
    for j in range(1, 10):
        ws.cell(DB_R0 - 1, 8 + j).border = st.UNDER
    left_row, gone_row = f"Engine!{rng(C_BAL, ROW_LEFT, absrow=True)}", f"Engine!{rng(C_BAL, ROW_GONE, absrow=True)}"
    for p in range(ND):
        r, er = DB_R0 + p, EO0 + p
        name, rate, mn, start = f"Engine!$K${er}", f"Engine!$L${er}", f"Engine!$M${er}", f"Engine!$O${er}"
        left, gone = f"INDEX({left_row},{p + 1})", f"INDEX({gone_row},{p + 1})"
        on = f'{name}<>""'
        ws.cell(r, 2, f'=IF({on},{p + 1},"")').font = st.font(9, color=st.GRAY)
        ws.cell(r, 3, f'=IF({on},{name},"")').font = st.font(11, bold=True)
        a = ws.cell(r, 4, f'=IF({on},ROUND({rate}*100,2),"")'); a.number_format, a.alignment = "0.00", st.RIGHT
        b = ws.cell(r, 5, f'=IF({on},ROUND({left},2),"")'); b.number_format, b.alignment = "#,##0.00", st.RIGHT
        c = ws.cell(r, 6, f'=IF({on},ROUND(MAX({start}-{left},0),2),"")'); c.number_format, c.alignment = "#,##0.00", st.RIGHT
        # the share paid, 0 to 1 (a quiet helper for the bar and the yellow row)
        h = ws.cell(r, DB_PCT_COL, f'=IF({on},IF({left}<0.005,1,MIN(MAX(({start}-{left})/{start},0),0.99)),"")')
        h.font = st.font(6, color=st.PAPER)
        ws.cell(r, 19, f'=IFERROR(IF({on},IF({left}<0.005,"PAID",IF({gone}>0,{dtext(gone)},"")),""),"")').font = st.font(10, bold=True)
        ws.cell(r, 20, (f'=IF(AND({on},{left}>0.005,{rate}>0,{mn}<={left}*{rate}/12),'
                        f'"This one grows even when you pay the minimum, so it goes first.","")')).font = st.font(9)
        ws.row_dimensions[r].height = 22
        gap = st.Side(style="thin", color=st.PAPER)
        for j in range(10):
            ws.cell(r, 8 + j).border = st.Border(left=gap, right=gap, top=st.Side(style="medium", color=st.PAPER), bottom=st.Side(style="medium", color=st.PAPER))
    rows = f"B{DB_R0}:T{DB_R0 + ND - 1}"
    bars = f"H{DB_R0}:Q{DB_R0 + ND - 1}"
    pct = f"${L(DB_PCT_COL)}{DB_R0}"
    st.when(ws, rows, f"{pct}=1", st.YELLOW)                                                      # paid: the whole row
    st.when(ws, bars, f'AND(ISNUMBER({pct}),{pct}<1,{pct}*10>=COLUMN()-COLUMN($H{DB_R0})+0.5)', st.ACTION)  # progress
    st.when(ws, bars, f'AND(ISNUMBER({pct}),{pct}<1)', st.LINE)                                   # the empty part
    st.footer(ws, DB_R0 + ND + 2)
    return ws


# ------------------------------------------------------------------------------------------------ Safety net
def build_safety(wb: Workbook):
    """The buffer with its bar, and the yearly bills with what is set aside so far."""
    ws = wb.create_sheet("Safety net")
    st.page(ws, 8, 34, {"A": 1.5, "B": 34, "C": 16, "D": 16, "E": 18, "F": 16, "G": 30, "H": 1.5}, "Safety net")
    has = EN(E_HASPLAN)
    buf, goal = EN(E_BUFNOW), EN(E_GOAL)
    st.block(ws, 6, 10, 2, 5)
    st.label(ws, 6, 2, "Surprise buffer", small=True)
    ws[SN_BUF] = f'=IFERROR({money0(buf)}&" of "&{money0(goal)},"")'
    ws[SN_BUF].font = st.font(28, bold=True, title=True)
    ws.row_dimensions[7].height = 44
    share = f"IF({goal}>0,MIN({buf}/{goal},1),1)"
    ws[SN_BAR] = f'=IFERROR(REPT("█",ROUND({share}*20,0))&REPT("░",20-ROUND({share}*20,0)),"")'
    ws[SN_BAR].font = st.font(11, color=st.ACTION)
    ws[SN_READY] = f'=IF(AND({goal}>0,{buf}>={goal}-0.005),"ready","")'
    ws[SN_READY].font = st.font(11, bold=True)
    st.when(ws, SN_READY, f'${SN_READY[0]}${SN_READY[1:]}="ready"', st.YELLOW)  # done
    ws["B10"] = "Kept in a plain separate account or an envelope. It comes first, so a surprise stays off your cards."
    ws["B10"].font = st.font(9, color=st.GRAY)

    st.section(ws, 13, 2, "Yearly bills")
    for j, (text, align) in enumerate((("Bill", st.LEFT), ("A year", st.RIGHT), ("  Month needed", st.LEFT), ("Set aside so far", st.RIGHT), ("Each payday", st.RIGHT))):
        st.head(ws, SN_Y0 - 1, 2 + j, text, align)
    total = f"SUM(Start!$D${Y0}:$D${YN})"
    for i in range(NY):
        r, sr = SN_Y0 + i, Y0 + i
        amount = f"N(Start!$D${sr})"
        on = f"{amount}>0"
        ws.cell(r, 2, f'=IF({on},IF(Start!$C${sr}="","Yearly bill",Start!$C${sr}&""),"")').font = st.font(11, bold=True)
        a = ws.cell(r, 3, f'=IF({on},{amount},"")'); a.number_format, a.alignment = "#,##0.00", st.RIGHT
        ws.cell(r, 4, f'=IF({on},IF(Start!$E${sr}="","Any time",Start!$E${sr}&""),"")').alignment = st.Alignment(horizontal="left", vertical="center", indent=1)
        s = ws.cell(r, 5, f'=IFERROR(IF({on},ROUND(MIN({EN(E_YSAVED)}*{amount}/{total},{amount}),2),""),"")'); s.number_format, s.alignment = "#,##0.00", st.RIGHT
        e = ws.cell(r, 6, f'=IFERROR(IF({on},ROUND({amount}/{EN(E_PPY)},2),""),"")'); e.number_format, e.alignment = "#,##0.00", st.RIGHT
    ws[SN_EMPTY] = f'=IF({total}>0,"","No yearly bills yet. Add one on Start and a little goes aside each payday.")'
    ws[SN_EMPTY].font = st.font(9, color=st.GRAY)
    st.footer(ws, SN_Y0 + NY + 4)
    return ws


# ------------------------------------------------------------------------------------------------ Open me
def build_open_me(wb: Workbook):
    """How to make your copy, the three steps, and what to try when the file opens as view only."""
    ws = wb.create_sheet("Open me")
    st.page(ws, 4, 46, {"A": 1.5, "B": 4, "C": 118, "D": 1.5}, "Open me")
    blocks = [
        ("Make it yours", [
            "In Google Sheets: open the File menu, then Make a copy. Your copy is yours to type in.",
            "From the copy link: press Make a copy when Google asks.",
            "In Excel: open the file. If a bar at the top asks, press Enable Editing.",
        ]),
        ("Then three steps", [
            "Go to Start and fill in the three steps. Show where to type tints every cell that is yours.",
            "Open Today. It tells you what to move this payday.",
            "When it is paid, pick the tick on Path. The payday turns yellow and Today moves on.",
        ]),
        ("If it opens as view only", [
            "Make your own copy first: File, then Make a copy. The shared file itself can not be typed in.",
            "Look at your Google Drive space. A full Drive can not save a copy.",
            "Use a personal Google account. A work or school account can block copies.",
            "Try your own computer or phone. A shared or work device can block files.",
            "Turn your VPN off for a moment, then try again.",
        ]),
        ("Good to know", [
            "Paid a different amount? Type it in Actual on Path. Every later payday follows.",
            "Start tells you how this sheet reads dates, so a payday is never read the wrong way round.",
            "The tabs are locked so a formula is not typed over by accident.",
            "There is no password. You can unlock a tab from the menu when you want to change something.",
            "Your numbers stay in your own file. Nothing is sent anywhere.",
            "The amounts are estimates from what you type. Type your real balances again every few months.",
        ]),
    ]
    r = 6
    for title, lines in blocks:
        st.section(ws, r, 2, title)
        r += 1
        for i, text in enumerate(lines):
            n = ws.cell(r, 2, i + 1)
            n.font, n.alignment = st.font(9, color=st.GRAY), st.RIGHT
            ws.cell(r, 3, text).font = st.font(11)
            ws.row_dimensions[r].height = 20
            r += 1
        r += 1
    st.block(ws, r, r + 2, 2, 3)
    ws.cell(r, 3, f"Questions? Write to {SUPPORT_EMAIL}").font = st.font(11, bold=True)
    ws.cell(r + 1, 3, "We read every message and answer as soon as we can.").font = st.font(9, color=st.GRAY)
    ws.cell(r + 2, 3, f"Version {VERSION} · {VERSION_DATE}").font = st.font(9, color=st.GRAY)
    st.footer(ws, r + 4)
    return ws


def finish(wb: Workbook):
    """The style pass every tab shares: the order of the tabs, what prints, where a list is frozen."""
    wb._sheets = [wb[n] for n in TABS + ["Engine", "Lists"]]
    for name in TABS:  # a formula on a tab the buyer sees never shows an error: it shows nothing
        for row in wb[name].iter_rows():
            for cell in row:
                v = cell.value
                if isinstance(v, str) and v.startswith("=") and not v.startswith("=IFERROR("):
                    cell.value = f'=IFERROR({v[1:]},"")'
    wb.active = 0
    for ws in wb:
        ws.sheet_view.tabSelected = ws.title == TABS[0]
    path = wb["Path"]
    for ws, area, landscape in ((wb["Today"], f"A1:H{T_L0 + NI + 12}", False), (path, f"A1:Q{P_R1 + P_PRINT_ROWS - 1}", True)):
        ws.print_area = area
        ws.page_setup.orientation = "landscape" if landscape else "portrait"
        ws.page_setup.fitToWidth, ws.page_setup.fitToHeight = 1, 0
        ws.sheet_properties.pageSetUpPr.fitToPage = True
        ws.print_options.horizontalCentered = True
    path.print_title_rows = f"{P_R0}:{P_R0}"
    wb.properties.title = "PaidInYellow Paycheck Payoff Planner"
    wb.properties.creator = "PaidInYellow"


# ------------------------------------------------------------------------------------------------ the workbook
def build(path: str, scenario: dict | None = None, ticks: int = 0, today: dt.date | None = None, fit_all: bool = False) -> str:
    wb = Workbook()
    wb.remove(wb.active)
    build_open_me(wb)
    build_start(wb)
    build_today(wb)
    build_path(wb)
    build_debts(wb)
    build_safety(wb)
    build_engine(wb)
    build_lists(wb).sheet_state = "hidden"
    add_charts(wb)
    finish(wb)
    for name in ("Engine", "Lists"):
        wb[name].protection.sheet = True
    if scenario:
        fill(wb, scenario, ticks, today)
    if fit_all:  # for pictures only: every tab prints one page wide
        for name in TABS:
            ws = wb[name]
            if not ws.print_area:
                ws.print_area = f"A1:{L(ws.max_column)}{min(ws.max_row, 70)}"
            ws.page_setup.orientation = "landscape" if ws.max_column > 8 else "portrait"
            ws.page_setup.fitToWidth, ws.page_setup.fitToHeight = 1, 0
            ws.sheet_properties.pageSetUpPr.fitToPage = True
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
    build(os.path.join(DIST, "test-nadia.xlsx"), NADIA, ticks=1)
    print("built", blank, "formulas:", count_formulas(blank))
