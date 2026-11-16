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
    hide = st.font(9, color=st.PAPER)
    st.when(ws, f"H{D0 - 1}", f'{order}<>"{METHOD["custom"]}"', fnt=hide)
    st.when(ws, f"H{D0}:H{DN}", f'{order}<>"{METHOD["custom"]}"', st.PAPER, fnt=hide, border=st.NO_BORDER)

    # ---- Step 3
    st.section(ws, 31, 2, "Step 3 · Your money")
    for row, text in ((32, "Money for the plan each payday"), (33, "Buffer: set aside now"), (34, "Buffer goal"), (35, "Payoff order")):
        st.label(ws, row, 3, text, bold=True)
    typed(S_MONEY, "#,##0.00"); typed(S_BUF, "#,##0.00"); typed(S_GOAL, "#,##0.00"); typed(S_ORDER)
    ws[S_GOAL], ws[S_ORDER] = 500, METHOD["piy"]
    st.dropdown(ws, S_ORDER, "Lists!$C$2:$C$4", allow_blank=False)
    ws[S_MONEYNOTE] = (f'=IF(AND({EN(E_STARTOWED)}>0.005,N({S_MONEY})<=0),"Add what you can put on top of your minimums. Even 20 matters.",'
                       f'IF(AND({EN(E_HASPLAN)}=1,{EN(E_FITS)}=0),"With this amount the plan does not end in the time this sheet can show. A little more helps.",'
                       f'"On top of your minimums. Even 20 matters."))')
    ws[S_MONEYNOTE].font = st.font(9, color=st.GRAY)
    hint(33, "Money for surprises. Empty is fine.")
    hint(34, "Kept in a plain separate account or an envelope.")
    hint(35, "PaidInYellow order pays the smallest debt first, and a debt that grows before that.")
    st.label(ws, 37, 3, "Yearly bills (optional)", bold=True)
    st.head(ws, 37, 4, "Amount a year", st.RIGHT); st.head(ws, 37, 5, "Month needed")
    hint(37, "Car repairs, gifts, insurance. A little goes aside each payday.", 6)
    for i in range(NY):
        r = Y0 + i
        typed(f"C{r}"); typed(f"D{r}", "#,##0.00", st.RIGHT); typed(f"E{r}")
    st.dropdown(ws, f"E{Y0}:E{YN}", "Lists!$D$2:$D$14")

    # ---- Show where to type
    st.label(ws, 47, 3, "Show where to type", bold=True)
    typed(S_SHOW, align=st.CENTER)
    st.dropdown(ws, S_SHOW, f'"{TICK}"')
    hint(47, "Pick the tick and every cell you can type in turns sage.")
    for ref in inputs:
        if ref != S_SHOW:
            st.when(ws, ref, f'{show}="{TICK}"', st.CALM)

    # ---- the result
    st.block(ws, 49, 55, 3, 9)
    ok = f"AND({EN(E_HASPLAN)}=1,{EN(E_FITS)}=1)"
    ws[S_R_LINE1] = (f'=IF({EN(E_HASPLAN)}=0,"Fill in the three steps and your date shows here.",'
                     f'IF({EN(E_FITS)}=0,"This plan does not end in the time this sheet can show. A little more each payday helps.",'
                     f'"You can be debt-free by"))')
    ws[S_R_LINE1].font = st.font(11, color=st.GRAY)
    ws[S_R_DATE] = f'=IFERROR(IF({ok},{dtext(EN(E_FREE))},""),"")'
    ws[S_R_DATE].font = st.font(24, bold=True, title=True)
    ws.row_dimensions[51].height = 40
    st.when(ws, S_R_DATE, f'${S_R_DATE[0]}${S_R_DATE[1:]}<>""', st.YELLOW)  # the one key word
    ws[S_R_STEP] = f'=IFERROR(IF({ok},"First step: move "&{money(EN(E_FIRSTMOVE))}&" on "&{dtext(EN(E_P0))}&".",""),"")'
    ws[S_R_STEP].font = st.font(12, bold=True)
    ws[S_R_MIN] = (f'=IFERROR(IF({ok},IF(ISNUMBER({EN(E_MINDATE)}),"With minimums only: about "&{mtext(EN(E_MINDATE))}&".",'
                   f'"With minimums only it never ends. Your plan ends it."),""),"")')
    ws[S_R_SOONER] = (f'=IFERROR(IF(AND({ok},ISNUMBER({EN(E_SOONER)})),IF({EN(E_SOONER)}>0,"That is about "&{EN(E_SOONER)}&" month"&IF({EN(E_SOONER)}=1,"","s")&" sooner.",""),""),"")')
    for ref in (S_R_MIN, S_R_SOONER):
        ws[ref].font = st.font(10, color=st.GRAY)
    st.footer(ws, 58)
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
    for ref, (text, f) in stand.items():
        lab = ("R" if ref[0] == "S" else "T") + ref[1:]
        ws[lab] = text
        ws[ref] = f
    for ref in (E_TODAY, E_VIEWDATE, E_NEXTDATE):
        ws[ref].number_format = "yyyy-mm-dd"

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
        ws.cell(ROW_GONE, cc, f'=IF(AND($O${EO0 + p}>0,$S$2=1),INDEX({dates},SUMPRODUCT(--({col(cc)}>0.005))+1),"")')
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


# ------------------------------------------------------------------------------------------------ Today
def build_today(wb: Workbook):
    """One main number: what to move this payday. It turns yellow with PAID once that payday is ticked on Path."""
    ws = wb.create_sheet("Today")
    st.page(ws, 6, 44, {"A": 1.5, "B": 3, "C": 44, "D": 18, "E": 30, "F": 1.5}, "Today")
    view, paid, done = EN(E_VIEW), EN(E_PAIDMODE), EN(E_ALLDONE)
    ws[T_FLAG] = f"=IF(OR({paid}=1,{done}=1),1,0)"
    ws[T_FLAG].font = st.font(8, color=st.BAND)  # a quiet helper for the colour of the card

    st.block(ws, 6, 9, 2, 5)
    st.when(ws, "B6:E9", "$F$3=1", st.YELLOW)
    ws[T_LABEL] = (f'=IFERROR(IF({done}=1,"Every payday is ticked",IF({view}=0,"Your next payday",'
                   f'IF({paid}=1,{dtext(EN(E_VIEWDATE))}&" is paid","This payday · "&{dtext(EN(E_VIEWDATE))}))),"")')
    ws[T_LABEL].font = st.font(11, color=st.GRAY)
    ws[T_MAIN] = (f'=IFERROR(IF({done}=1,"Debt-free",IF({view}=0,"Fill in Start",'
                  f'IF({paid}=1,"PAID","Move "&{money(EN(E_VIEWMOVE))}))),"")')
    ws[T_MAIN].font = st.font(48, bold=True, title=True)
    ws.row_dimensions[7].height = 66
    ws[T_SUB] = (f'=IFERROR(IF({done}=1,"You did it, one paycheck at a time.",IF({view}=0,"Your payday and what to move show here.",'
                 f'IF({paid}=1,"Next payday is "&{dtext(EN(E_NEXTDATE))}&".","Then tick it on Path and it turns yellow."))),"")')
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

    fr = int(T_FOCUS_NAME[1:])
    st.head(ws, fr - 1, 3, "Focus debt")
    pos = EN(E_FOCUSPOS)
    names = f"Engine!$K${EO0}:$K${EO0 + ND - 1}"
    ws[T_FOCUS_NAME] = f'=IFERROR(IF({pos}=0,"",INDEX({names},{pos})),"")'
    ws[T_FOCUS_NAME].font = st.font(14, bold=True, title=True)
    ws[T_FOCUS_LEFT] = f'=IFERROR(IF({pos}=0,"",{money(f"INDEX(Engine!{rng(C_BAL, ROW_LEFT, absrow=True)},{pos})")}&" left"),"")'
    gone = f"INDEX(Engine!{rng(C_BAL, ROW_GONE, absrow=True)},{pos})"
    ws[T_FOCUS_GONE] = f'=IFERROR(IF({pos}=0,"",IF(ISNUMBER({gone}),"Gone by "&{dtext(gone)},"")),"")'
    ws[T_FOCUS_GONE].font = st.font(10, color=st.GRAY)
    ws[T_LATE] = f'=IF({EN(E_LATE)}>=2,"A few paydays are not ticked yet. Tick them on Path.","")'
    ws[T_LATE].font = st.font(10, color=st.GRAY)
    st.footer(ws, 39)
    return ws


# ------------------------------------------------------------------------------------------------ Path
def build_path(wb: Workbook):
    """Part 3 lays down the tick column the plan reads. Part 4 adds the tiles, the list and the chart."""
    ws = wb.create_sheet("Path")
    st.page(ws, 16, P_RN + 6, {"A": 1.5, "B": 20, "C": 13, "D": 13, "E": 13, "F": 13, "G": 14, "H": 9, "I": 1.5,
                                "J": 13, "K": 13, "L": 13, "M": 13, "N": 13, "O": 13, "P": 1.5}, "Path")
    st.head(ws, P_R0, P_DONE_COL, "Done", st.CENTER)
    for k in range(NR):
        st.input_cell(ws.cell(P_R1 + k, P_DONE_COL), align=st.CENTER)
    done = f"{L(P_DONE_COL)}{P_R1}:{L(P_DONE_COL)}{P_RN}"
    st.dropdown(ws, done, f'"{TICK}"')
    return ws


# ------------------------------------------------------------------------------------------------ the workbook
def build(path: str, scenario: dict | None = None, ticks: int = 0, today: dt.date | None = None) -> str:
    wb = Workbook()
    wb.remove(wb.active)
    build_start(wb)
    build_today(wb)
    build_path(wb)
    build_engine(wb)
    build_lists(wb).sheet_state = "hidden"
    for name in ("Engine", "Lists"):
        wb[name].protection.sheet = True
    if scenario:
        fill(wb, scenario, ticks, today)
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
