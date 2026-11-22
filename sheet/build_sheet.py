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
from openpyxl.chart.data_source import AxDataSource, StrRef
from openpyxl.chart.series import DataPoint
from openpyxl.chart.shapes import GraphicalProperties
from openpyxl.chart.text import RichText
from openpyxl.drawing.text import CharacterProperties, Paragraph, ParagraphProperties, RichTextProperties
from openpyxl.drawing.line import LineProperties
from openpyxl.utils import column_index_from_string, get_column_letter as L

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


def absr(at: str) -> str:
    """An absolute reference on the same tab, like $Y$8"""
    col = at.rstrip("0123456789")
    return f"${col}${at[len(col):]}"


def dtext(x: str) -> str:
    """A date in words, like Fri 16 Jul 2027. The year shows only when it is not this year. No TEXT(): its
    patterns change with the language of the spreadsheet."""
    return (f'INDEX(Lists!$F$2:$F$8,WEEKDAY({x}))&" "&DAY({x})&" "&INDEX(Lists!$G$2:$G$13,MONTH({x}))'
            f'&IF(YEAR({x})=YEAR({EN(E_TODAY)}),""," "&YEAR({x}))')


def dtext_short(x: str) -> str:
    """A date without the weekday, like 16 Jul 2027: it fits a tile"""
    return f'DAY({x})&" "&INDEX(Lists!$G$2:$G$13,MONTH({x}))&IF(YEAR({x})=YEAR({EN(E_TODAY)}),""," "&YEAR({x}))'


def mtext(x: str) -> str:
    """A month in words, like April 2031"""
    return f'INDEX(Lists!$D$3:$D$14,MONTH({x}))&" "&YEAR({x})'


def money0(x: str) -> str:
    """A big summary amount in whole units, like $3,250"""
    return f'{EN(E_CUR)}&FIXED({x},0)'


def money(x: str) -> str:
    """An amount in words with the buyer's currency symbol: $180, or $1,234.50 when there are cents"""
    return f'{EN(E_CUR)}&IF(ROUND({x},2)=ROUND({x},0),FIXED({x},0),FIXED({x},2))'


def money2(x: str) -> str:
    """An amount in a table, always with cents, like $424.67"""
    return f'{EN(E_CUR)}&FIXED({x},2)'


def cell_amount(x: str, cents: bool = False) -> str:
    """An amount in a table cell: blank when it is zero, never a dash or a 0"""
    return f'IF(ABS({x})<0.005,"",{money2(x) if cents else money(x)})'


def grew_note() -> str:
    """The note under "Paid off so far" when a debt grew since the start: Visa grew $19, so the total moved less."""
    n, total, pos = EN(E_NGREW), EN(E_GREW), EN(E_GREWPOS)
    amount = f'IF({total}<1,{money2(total)},{money0(total)})'
    names = f"Engine!$K${EO0}:$K${EO0 + ND - 1}"
    return (f'IF(N({n})=0,"",IF({n}=1,INDEX({names},{pos})&" grew "&{amount},{n}&" debts grew "&{amount}&" in all")'
            f'&", so the total moved less.")')


def pct_text(x: str) -> str:
    """A rate in words, like 26.99% or 0%"""
    return f'IF(ROUND({x},2)=ROUND({x},0),FIXED({x},0),FIXED({x},2))&"%"'


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
    """All typing happens here. The three steps on the left, the result and the options on the right."""
    ws = wb.create_sheet("Start")
    st.page(ws, S_FOOT + 1, "Start")
    show, order = absr(S_SHOW), absr(S_ORDER)
    IN0, IN1 = gcol(1) + 1, gend(8) - 1      # inside the cards on the left
    inputs: list[str] = []

    def typed(row: int, c0: int, c1: int, fmt: str | None = None, align=st.LEFT):
        st.input_cell(ws, row, c0, c1, fmt, align)
        inputs.append(ref(row, c0))

    def field(row: int, text: str, fmt: str | None, help_text: str | None):
        st.label(ws, row, S_LABEL, S_INPUT - 2, text).alignment = st.WRAP
        typed(row, S_INPUT, S_INPUT_END, fmt)
        if help_text is not None:
            st.hint(ws, row, S_HELP, IN1, help_text)
        ws.row_dimensions[row].height = 26

    # ---- Step 1
    st.grid_card(ws, 6, 13, 1, 8)
    st.section(ws, 7, IN0, IN1, "Step 1 · Your pay")
    field(8, "Currency", None, "Pick your symbol.")
    field(9, "How often you are paid", None, "Week, 2 weeks, twice a month or month.")
    field(10, "Your next payday", "ddd d mmm yyyy", "Your whole plan follows your paydays.")
    field(11, "Your other pay day", "0", "Twice a month only. 31 is the last day.")
    ws.row_dimensions[8].height = 32   # the debt-free date sits in this row on the right
    ws[S_CUR], ws[S_FREQ] = "$", FREQ["biweekly"]
    st.dropdown(ws, S_CUR, f"Lists!$A$2:$A${1 + len(CURRENCIES)}")
    st.dropdown(ws, S_FREQ, "Lists!$B$2:$B$5", allow_blank=False)
    st.hint(ws, 12, S_LABEL, IN1, ('=IF(ISNUMBER(IFERROR(DATEVALUE("5/30/2026"),"")),"This sheet reads dates as MM/DD/YYYY.",'
                                   '"This sheet reads dates as DD/MM/YYYY.")'), wrap=False)
    ws.row_dimensions[12].height = 20

    # ---- Step 2
    st.grid_card(ws, 15, DN + 1, 1, 8)
    st.section(ws, 16, IN0, 24, "Step 2 · Your debts")
    st.hint(ws, 16, 25, IN1, "Up to 15. All on your statement.", wrap=False).alignment = st.RIGHT
    heads = [(SC_NUM, "#", st.LEFT), (SC_NAME, "Name", st.LEFT), (SC_BAL, "Balance", st.RIGHT), (SC_APR, "Interest %", st.RIGHT),
             (SC_MIN, "Minimum", st.RIGHT), (SC_DUE, "Due day", st.RIGHT), (SC_ORDER, "Order", st.RIGHT), (SC_NOTE, "", st.LEFT)]
    for c, text, align in heads:
        # a right aligned header may start in the empty cell before it, so "Interest %" fits
        st.head(ws, D0 - 1, c - (align is st.RIGHT), SC_ENDS[c] - (c != SC_NOTE), text, align)
    for c in range(IN0, IN1 + 1):
        ws.cell(D0 - 1, c).border = st.UNDER
    col = {c: L(c) for c in SC_ENDS}
    for i in range(ND):
        r = D0 + i
        st.text(ws, r, SC_NUM, SC_ENDS[SC_NUM], i + 1, st.font(st.HELP, color=st.GRAY))
        for c, fmt, align in ((SC_NAME, None, st.LEFT), (SC_BAL, "#,##0.00", st.RIGHT), (SC_APR, "0.00", st.RIGHT),
                              (SC_MIN, "#,##0.00", st.RIGHT), (SC_DUE, "0", st.RIGHT), (SC_ORDER, "0", st.RIGHT)):
            typed(r, c, SC_ENDS[c] - 1, fmt, align)
        bal, mn, due, name = f"N(${col[SC_BAL]}{r})", f"N(${col[SC_MIN]}{r})", f"N(${col[SC_DUE]}{r})", f"${col[SC_NAME]}{r}"
        st.hint(ws, r, SC_NOTE, SC_ENDS[SC_NOTE], (
            f'=IF({bal}<=0,IF(OR({name}<>"",{mn}>0),"Add the balance to join the plan.",""),'
            f'IF(AND({mn}>0,{due}=0),"Add the due day from your statement.",'
            f'IF(OR({due}<0,{due}>31,{due}<>INT({due})),"The due day is 1 to 31.",'
            f'IF({mn}>{bal},"The minimum is above the balance.",""))))'))
        ws.row_dimensions[r].height = 26
    # "Order" only shows when the payoff order is "My own order": it fades into the card otherwise
    hide = st.Font(color=st.CARD)
    custom = f'{order}<>"{METHOD["custom"]}"'
    st.when(ws, ref(D0 - 1, SC_ORDER), custom, fnt=hide)
    st.when(ws, f"{col[SC_ORDER]}{D0}:{col[SC_ORDER]}{DN}", custom, st.CARD, fnt=hide, border=st.NO_BORDER)

    # ---- Step 3
    st.grid_card(ws, 35, YN + 1, 1, 8)
    st.section(ws, 36, IN0, IN1, "Step 3 · Your money")
    field(37, "Money for the plan each payday", "#,##0.00", None)
    ws.row_dimensions[37].height = 32   # the label takes two lines
    st.hint(ws, 38, S_LABEL, IN1, (f'=IF(AND({EN(E_STARTOWED)}>0.005,N({S_MONEY})<=0),"Add what you can put on top of your minimums. Even 20 matters.",'
                                   f'IF(AND(N({S_MONEY})>0,N({S_MONEY})<={EN(E_YPP)}),"Your yearly bills use all of this money, so the buffer and the extra wait. A little more helps.",'
                                   f'IF(AND({EN(E_HASPLAN)}=1,{EN(E_FITS)}=0),"With this amount the plan does not end in the time this sheet can show. A little more helps.",'
                                   f'"On top of your minimums. Even 20 matters.")))'))
    field(39, "Buffer: set aside now", "#,##0.00", "Money for surprises. Empty is fine.")
    field(40, "Buffer goal", "#,##0.00", "Kept in a plain separate account or an envelope.")
    ws[S_GOAL] = 500
    st.label(ws, 41, S_LABEL, 20, "Yearly bills (optional)")
    st.hint(ws, 41, 21, IN1, "Car repairs, gifts, insurance. A little goes aside each payday.", wrap=False)
    ws.row_dimensions[41].height = 26
    for c, text, align in ((SY_NAME, "Bill", st.LEFT), (SY_AMT, "A year", st.RIGHT), (SY_MONTH, "Month needed", st.LEFT)):
        st.head(ws, Y0 - 1, c, SY_ENDS[c] - 1, text, align)
    for i in range(NY):
        r = Y0 + i
        typed(r, SY_NAME, SY_ENDS[SY_NAME] - 1)
        typed(r, SY_AMT, SY_ENDS[SY_AMT] - 1, "#,##0.00", st.RIGHT)
        typed(r, SY_MONTH, SY_ENDS[SY_MONTH] - 1)
        ws.row_dimensions[r].height = 22
    st.dropdown(ws, f"{L(SY_MONTH)}{Y0}:{L(SY_MONTH)}{YN}", "Lists!$D$2:$D$14")

    # ---- what each typed cell takes. The messages are calm; the gray notes beside the cells say the rest
    amounts = "Type an amount of 0 or more, or leave it empty."
    st.limit(ws, S_NEXT, "date", "DATE(2000,1,1)", "DATE(2100,12,31)", "Type a date", "Type the date of your next payday, like 11/6/2026.")
    st.limit(ws, S_OTHER, "whole", "1", "31", "A day of the month", "Type a day from 1 to 31. 31 means the last day.")
    money_cols = f"{col[SC_BAL]}{D0}:{col[SC_BAL]}{DN} {col[SC_MIN]}{D0}:{col[SC_MIN]}{DN} {L(SY_AMT)}{Y0}:{L(SY_AMT)}{YN} {S_MONEY} {S_BUF} {S_GOAL}"
    st.limit(ws, money_cols, "decimal", "0", None, "Type an amount", amounts)
    st.limit(ws, f"{col[SC_APR]}{D0}:{col[SC_APR]}{DN}", "decimal", "0", "100", "Interest %", "Type the yearly interest from 0 to 100, like 22.99.")
    st.limit(ws, f"{col[SC_DUE]}{D0}:{col[SC_DUE]}{DN}", "whole", "1", "31", "Due day", "Type the day of the month it is due, 1 to 31. It is on your statement.")
    st.limit(ws, f"{col[SC_ORDER]}{D0}:{col[SC_ORDER]}{DN}", "whole", "1", "99", "My order", "Type 1 for the debt to pay first, 2 for the next one, and so on.")

    # ---- the result, top right
    st.grid_card(ws, 6, 13, 9, 12, st.CALM)
    ok = f"AND({EN(E_HASPLAN)}=1,{EN(E_FITS)}=1)"
    st.text(ws, 7, R_C0, R_C1, (f'=IF({EN(E_HASPLAN)}=0,"Fill in the three steps and your date shows here.",'
                                f'IF({EN(E_FITS)}=0,"This plan does not end in the time this sheet can show. A little more each payday helps.",'
                                f'"You can be debt-free by"))'), st.font(st.HELP, bold=True, color=st.GRAY), st.WRAP)
    ws.row_dimensions[7].height = 26
    st.text(ws, 8, R_C0, R_C1, f'=IFERROR(IF({ok},{dtext(EN(E_FREE))},""),"")', st.font(st.TILE, bold=True, title=True))
    st.when(ws, S_R_DATE, f'{absr(S_R_DATE)}<>""', st.YELLOW)  # the one key word
    st.text(ws, 9, R_C0, R_C1, f'=IFERROR(IF({ok},"First step: move "&{money(EN(E_FIRSTMOVE))}&" on "&{dtext(EN(E_P0))}&".",""),"")',
            st.font(st.BODY, bold=True), st.WRAP)
    st.hint(ws, 10, R_C0, R_C1, (f'=IFERROR(IF({ok},IF(ISNUMBER({EN(E_MINDATE)}),"With minimums only: about "&{mtext(EN(E_MINDATE))}&".",'
                                 f'"With minimums only it never ends. Your plan ends it."),""),"")'))
    st.hint(ws, 11, R_C0, R_C1, (f'=IFERROR(IF(AND({ok},ISNUMBER({EN(E_SOONER)})),IF({EN(E_SOONER)}>0,"That is about "&{EN(E_SOONER)}&" month"'
                                 f'&IF({EN(E_SOONER)}=1,"","s")&" sooner.",""),""),"")'))
    st.hint(ws, 12, R_C0, R_C1, f'=IF({ok},"Next: open Today.","")')

    # ---- options
    st.grid_card(ws, 15, 23, 9, 12)
    st.section(ws, 16, R_C0, R_C1, "Options")
    st.label(ws, 17, O_LABEL, R_C1, "Payoff order")
    typed(18, R_C0, R_C1)
    ws[S_ORDER] = METHOD["piy"]
    st.dropdown(ws, S_ORDER, "Lists!$C$2:$C$4", allow_blank=False)
    st.hint(ws, 19, R_C0, R_C1, "PaidInYellow order: the smallest debt first, and a debt that grows before that.")
    st.label(ws, 21, O_LABEL, O_INPUT - 2, "Show where to type")
    typed(21, O_INPUT, O_INPUT + 2, align=st.CENTER)
    st.dropdown(ws, S_SHOW, f'"{TICK}"')
    st.hint(ws, 22, R_C0, R_C1, "Pick the tick: every cell you can type in turns sage.")
    for r, h in ((6, 10), (13, 10), (14, 14), (15, 10), (DN + 1, 10), (34, 14), (35, 10), (YN + 1, 10)):
        ws.row_dimensions[r].height = h
    for at in inputs:
        if at != S_SHOW:
            st.when(ws, at, f'{show}="{TICK}"', st.CALM)
    st.footer(ws, S_FOOT)
    return ws


def fill(wb: Workbook, s: dict, ticks: int = 0, today: dt.date | None = None):
    """Types an engine scenario (the dict engine_v2.simulate takes) into the workbook."""
    st, en = wb["Start"], wb["Engine"]
    if today:
        en[E_TODAY_TEST] = today
    st[S_FREQ] = FREQ[s["freq"]]
    st[S_CUR] = s.get("currency", "$")
    st[S_NEXT] = s["first_payday"]
    st[S_NEXT].number_format = "ddd d mmm yyyy"
    st[S_OTHER] = s.get("second_day")
    st[S_MONEY], st[S_BUF], st[S_GOAL] = s["money"], s.get("buffer", 0), s["goal"]
    st[S_ORDER] = METHOD[s.get("method", "piy")]
    for i, d in enumerate(s["debts"]):
        r = D0 + i
        for c, k in ((SC_NAME, "name"), (SC_BAL, "balance"), (SC_APR, "apr"), (SC_MIN, "min"), (SC_DUE, "due"), (SC_ORDER, "my_order")):
            st.cell(r, c).value = d.get(k)
    for i, y in enumerate(s.get("yearly", [])):
        name, amount, month = y if isinstance(y, (tuple, list)) else (f"Yearly bill {i + 1}", y, "Any time")
        st.cell(Y0 + i, SY_NAME).value, st.cell(Y0 + i, SY_AMT).value, st.cell(Y0 + i, SY_MONTH).value = name, amount, month
    # what the sheet has no typing place for yet (kept for a later version): the tests type them on the Engine tab
    for key, col in (("adjust", C_ADJ), ("charges", C_CHG), ("buffer_used", C_BUFUSED)):
        for k, v in s.get(key, {}).items():
            en.cell(ER1 + int(k), col).value = v
    if s.get("whatif"):
        wb["Path"][W_INPUT] = s["whatif"]
    for k, v in s.get("actual", {}).items():
        wb["Path"].cell(P_R1 + int(k), P_ACTUAL_COL).value = v
    if ticks:
        for k in range(ticks):
            wb["Path"].cell(P_R1 + k, P_DONE_COL).value = TICK


# ------------------------------------------------------------------------------------------------ Engine (hidden)
def date_formula(k: str) -> str:
    """The date of payday number k (0 = the next payday typed on Start), from the schedule, never 'last + step'."""
    p0, f = f"${E_P0[0]}${E_P0[1:]}", f"Start!{absr(S_FREQ)}"
    half, a, b = "$B$6", "$B$4", "$B$5"
    m = f"INT(({k}+{half})/2)"
    twice = (f"DATE(YEAR({p0}),MONTH({p0})+{m},MIN(IF(MOD({k}+{half},2)=0,{a},{b}),"
             f"DAY(EOMONTH(DATE(YEAR({p0}),MONTH({p0})+{m},1),0))))")
    return (f'IF({f}="{FREQ["monthly"]}",EDATE({p0},{k}),IF({f}="{FREQ["twice"]}",{twice},'
            f'{p0}+{k}*IF({f}="{FREQ["weekly"]}",7,14)))')


def build_engine(wb: Workbook):
    ws = wb.create_sheet("Engine")
    S = "Start!"
    A = lambda at: f"{S}{absr(at)}"  # noqa: E731
    freq, p0 = A(S_FREQ), A(S_NEXT)

    # ---- settings
    labels = ["Paydays per year", "Yearly bills per payday", "Other pay day", "First pay day", "Second pay day",
              "Starts on the second", "Money per payday", "Buffer now", "Buffer goal", "Next payday"]
    for i, t in enumerate(labels):
        ws.cell(1 + i, 1, t)
    ws[E_PPY] = f'=IF({freq}="{FREQ["weekly"]}",52,IF({freq}="{FREQ["twice"]}",24,IF({freq}="{FREQ["monthly"]}",12,26)))'
    ws[E_YPP] = f"=SUM({S}${L(SY_AMT)}${Y0}:${L(SY_AMT)}${YN})/$B$1"
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
        bal, apr, mn, my = (f"N({S}${L(c)}{sr})" for c in (SC_BAL, SC_APR, SC_MIN, SC_ORDER))
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
        ws.cell(r, 11, f'=IF({ok},{src(L(SC_NAME))}&"","")')
        ws.cell(r, 12, f'=IF({ok},N({src(L(SC_APR))})/100,0)')
        ws.cell(r, 13, f'=IF({ok},N({src(L(SC_MIN))}),0)')
        ws.cell(r, 14, f'=IF({ok},IF(N({src(L(SC_DUE))})>0,N({src(L(SC_DUE))}),""),"")')
        ws.cell(r, 15, f'=IF({ok},N({src(L(SC_BAL))}),0)')

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
    def yname(i: int) -> str:
        if i == NY:
            return '""'
        amount, name = f"N({S}${L(SY_AMT)}${Y0 + i})", f"{S}${L(SY_NAME)}${Y0 + i}"
        return f'IF({amount}>0,IF({name}="","Yearly bill",{name}&""),{yname(i + 1)})'
    stand[E_YCOUNT] = ("Yearly bills with an amount", f"=SUMPRODUCT(--({S}${L(SY_AMT)}${Y0}:${L(SY_AMT)}${YN}>0))")
    stand[E_YNAME] = ("The first one", "=" + yname(0))
    # this month: what the plan asks for (Move as planned) and what is ticked (what was really moved)
    month = f"(YEAR({dates})=YEAR($S$16))*(MONTH({dates})=MONTH($S$16))*({ks}<=$S$1)"
    stand[E_MONTHPLAN] = ("This month: planned", f"=IF($S$3=0,0,SUMPRODUCT({month}*{col(C_MOVE0)}))")
    stand[E_MONTHDONE] = ("This month: ticked", f'=IF($S$3=0,0,SUMPRODUCT({month}*({done}="{TICK}")*{col(C_MOVE)}))')
    # what if I add more: the same plan with the typed amount from the current payday on
    wowed = col(W_OWED)
    stand[E_WADD] = ("What if: added each payday", f"=MAX(N(Path!{absr(W_INPUT)}),0)")
    stand[E_WNPAY] = ("What if: paydays to the end", f"=SUMPRODUCT(--({wowed}>0.005))+1")
    stand[E_WFITS] = ("What if: ends inside the sheet", f"=IF(INDEX({wowed},{NR})<0.005,1,0)")
    stand[E_WFREE] = ("What if: debt-free date", f'=IF(AND($S$3=1,{absr(E_WFITS)}=1),INDEX({dates},{absr(E_WNPAY)}),"")')
    stand[E_WINT] = ("What if: interest", f"=SUM({col(W_INT)})")
    stand[E_WMONTHS] = ("What if: months sooner", f'=IF(AND(ISNUMBER($S$4),ISNUMBER({absr(E_WFREE)})),MAX(ROUND(($S$4-{absr(E_WFREE)})/30.4375,0),0),"")')
    stand[E_WPAYDAYS] = ("What if: paydays sooner", f"=MAX($S$1-{absr(E_WNPAY)},0)")
    stand[E_WSAVED] = ("What if: interest saved", f"=MAX($S$9-{absr(E_WINT)},0)")
    # a debt that grew above its start (interest beat the payments so far): the note under "Paid off so far"
    grew_row = rng(C_BAL, ROW_GREW, absrow=True)
    stand[E_NGREW] = ("Debts that grew", f"=SUMPRODUCT(--({grew_row}>0.005))")
    stand[E_GREW] = ("Grew by, in all", f"=SUM({grew_row})")
    stand[E_GREWPOS] = ("First debt that grew (place)", f"=IF({absr(E_NGREW)}=0,0,{ND + 1}-SUMPRODUCT(MAX(({grew_row}>0.005)*({ND + 1}-{rng(C_BAL, 23, absrow=True)}))))")
    for ref, (text, f) in stand.items():
        col_ = ref.rstrip("0123456789")
        lab = L(column_index_from_string(col_) - 1) + ref[len(col_):]   # the label sits just left of the answer
        ws[lab] = text
        ws[ref] = f
    for ref in (E_TODAY, E_VIEWDATE, E_NEXTDATE, E_WFREE):
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
                      ("left now", ROW_LEFT), ("gone by", ROW_GONE), ("extra", ROW_XTRA), ("grew", ROW_GREW)):
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
        ws.cell(ROW_GREW, cc, f"=IF($O${EO0 + p}>0,MAX({bal}{ROW_LEFT}-$O${EO0 + p},0),0)")
    focus_name = f'IF($U$6=0,"",INDEX($K${EO0}:$K${EO0 + ND - 1},$U$6))'
    xcol = L(C_BAL + ND + 2)
    others = [("Yearly bills", C_YEARLY, f'IF({absr(E_YCOUNT)}=1,{absr(E_YNAME)},IF({absr(E_YCOUNT)}>1,{absr(E_YCOUNT)}&" bills",""))'),
              ("Buffer", C_TOBUF, f'"to "&{money0("$B$9")}'),
              (None, C_EXTRA, f'IF({xcol}{ROW_IAMOUNT}<0.005,"after bills and buffer","")')]
    for j, (text, src, note) in enumerate(others):
        cc = C_BAL + ND + j
        ws.cell(ROW_ILABEL, cc, f'="{text}"' if text else f'="Extra to "&{focus_name}')
        ws.cell(ROW_IAMOUNT, cc, f"=IF({view}=0,0,IF(INDEX({col(src)},{view})<0.005,0,INDEX({col(src)},{view})))")
        ws.cell(ROW_INOTE, cc, f"={note}")
    for j in range(NI):
        cc = C_BAL + j
        before = "0" if j == 0 else f"{L(cc - 1)}{ROW_ICOUNT}"
        has_line = f"{L(cc)}{ROW_IAMOUNT}>0.005"
        if j == NI - 1:   # the extra line shows whenever there is a focus debt, so its name is always there
            has_line = f"OR({has_line},AND({view}>0,$U$6>0))"
        ws.cell(ROW_ICOUNT, cc, f"={before}+IF({has_line},1,0)")

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
    for j, h in enumerate(["What if: money", "yearly", "buffer", "buffer after", "charge goes to", "for debts", "interest", "owed"]):
        ws.cell(ER_HEAD, W0 + j, h)
    for p in range(ND):
        ws.cell(ER_HEAD, W_AFT + p, f"What if: after bill {p + 1}"); ws.cell(ER_HEAD, W_BAL + p, f"What if: left {p + 1}")
    for cc, h in ((C_AVAIL0, "Money as planned"), (C_Y0, "Yearly as planned"), (C_B0, "Buffer as planned"),
                  (C_MOVE0, "Move as planned"), (C_SHORT, "Actual below bills"), (C_XPOS, "Most extra to (place)")):
        ws.cell(ER_HEAD, cc, h)

    # ---- the state before the first payday
    r = ER_START
    ws.cell(r, C_BUFAFTER, "=$B$8")
    for p in range(ND):
        ws.cell(r, C_BAL + p, f"=$O${EO0 + p}")
    ws.cell(r, C_OWED, f"=SUM({rng(C_BAL, r)})")
    ws.cell(r, W_BUFAFTER, "=$B$8")
    for p in range(ND):
        ws.cell(r, W_BAL + p, f"=$O${EO0 + p}")
    ws.cell(r, W_OWED, f"=SUM({rng(W_BAL, r)})")

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
        ws.cell(r, C_XPOS, (f"=IF({c(C_EXTRA, r)}<0.005,0,{ND + 1}-SUMPRODUCT(MAX((({rng(C_AFT, r)}-{rng(C_BAL, r)})>0.005)"
                            f"*({ND + 1}-{places}))))"))
        # what if: the same payday with the typed amount added from the current payday on (engine_v2.py "adjust")
        wprev = rng(W_BAL, pr)
        ws.cell(r, W_AVAIL, f"={c(C_AVAIL, r)}+IF({c(C_K, r)}>=$S$15,{absr(E_WADD)},0)")
        ws.cell(r, W_YEARLY, f"=MIN($B$2,MAX({c(W_AVAIL, r)},0))")
        ws.cell(r, W_TOBUF, f"=MIN(MAX($B$9-{c(W_BUFAFTER, pr)},0),MAX({c(W_AVAIL, r)}-{c(W_YEARLY, r)},0))")
        ws.cell(r, W_BUFAFTER, f"={c(W_BUFAFTER, pr)}+{c(W_TOBUF, r)}-N({c(C_BUFUSED, r)})")
        wfirst = f"({ND + 1}-SUMPRODUCT(MAX(({wprev}>0.005)*({ND + 1}-{places}))))"
        ws.cell(r, W_CHGPOS, f"=IF(N({c(C_CHG, r)})=0,0,IF({wfirst}>{ND},1,{wfirst}))")
        ws.cell(r, W_POOL, (f"=MAX({c(W_AVAIL, r)}-{c(W_YEARLY, r)}-{c(W_TOBUF, r)},0)+SUM({rng(C_DUE, r)})"
                            f"-(SUMPRODUCT({wprev},{growth})+N({c(C_CHG, r)})-SUM({rng(W_AFT, r)}))"))
        ws.cell(r, W_INT, f"=SUMPRODUCT({wprev},{rates})/$B$1")
        ws.cell(r, W_OWED, f"=SUM({rng(W_BAL, r)})")
        for p in range(ND):
            due, aft, bal = L(C_DUE + p), L(W_AFT + p), L(W_BAL + p)
            pre = f"({bal}{pr}*{L(C_BAL + p)}$22+IF({c(W_CHGPOS, r)}={p + 1},N({c(C_CHG, r)}),0))"
            ws.cell(r, W_AFT + p, f"={pre}-MIN({due}{r},{pre})")
            before = "0" if p == 0 else f"SUM({rng(W_AFT, r, p)})"
            x = f"MIN({aft}{r},MAX({c(W_POOL, r)}-{before},0))"
            ws.cell(r, W_BAL + p, f"=IF({aft}{r}-{x}<0.005,0,{aft}{r}-{x})")
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
    """One main number: what to move this payday, and what it is made of. It turns yellow with PAID once that payday
    is ticked on Path. On the right: the focus debt, the buffer, the debt-free date and the next two paydays."""
    ws = wb.create_sheet("Today")
    st.page(ws, T_FOOT + 1, "Today")
    view, paid, done, has, fits = EN(E_VIEW), EN(E_PAIDMODE), EN(E_ALLDONE), EN(E_HASPLAN), EN(E_FITS)
    st.quiet(ws, T_FLAG, f"=IF(OR({paid}=1,{done}=1),1,0)")
    st.quiet(ws, T_COUNT, f"={EN(E_NITEMS)}")
    c0, c1 = gcol(1), gend(8)
    i0, i1 = c0 + 1, c1 - 1
    st.grid_card(ws, 6, T_HEAD, 1, 8, st.CALM)   # the lines below follow how many there are (see the rules)
    for r, h in ((6, 10), (7, 18), (8, 36), (9, 18), (10, 9), (11, 18), (12, 10), (T_HEAD, 22)):
        ws.row_dimensions[r].height = h
    for r in range(T_L0, T_LINES_END + 1):   # a thin row, then the words
        ws.row_dimensions[r].height = 9 if (r - T_L0) % 2 == 0 else 19
    st.text(ws, 7, i0, i1, (f'=IFERROR(IF({done}=1,"Every payday is ticked",IF({view}=0,"Your next payday",'
                            f'IF({paid}=1,{dtext(EN(E_VIEWDATE))}&" is paid","This payday · "&{dtext(EN(E_VIEWDATE))}))),"")'),
            st.font(st.HELP, bold=True, color=st.GRAY))
    st.text(ws, 8, i0, i1, (f'=IFERROR(IF({done}=1,"Debt-free",IF({view}=0,"Fill in Start",'
                            f'IF({paid}=1,"PAID","Move "&{money(EN(E_VIEWMOVE))}))),"")'),
            st.font(st.BIG, bold=True, title=True), st.Alignment(horizontal="left", vertical="center"), r1=10)
    st.hint(ws, 11, i0, i1, (f'=IFERROR(IF({done}=1,"You did it, one paycheck at a time.",IF({view}=0,"Your payday and what to move show here.",'
                             f'IF({EN(E_LATE)}>=2,"A few paydays are not ticked yet. Tick them on Path.",'
                             f'IF({paid}=1,"Next payday is "&{dtext(EN(E_NEXTDATE))}&".",IF({EN(E_VIEWACTUAL)}=1,"This is the amount you typed on Path. Tick it there and it turns yellow.",'
                             f'"When it is done, tick it on Path and this card turns yellow."))))),"")'), wrap=False)

    # what it is made of: a white table inside the calm card
    st.block(ws, T_HEAD, T_HEAD, i0, i1, st.CARD)
    for c, e, text, align in zip(T_COLS, T_ENDS, ("What it is made of", "Amount", ""), (st.LEFT, st.RIGHT, st.LEFT)):
        st.head(ws, T_HEAD, c, e, text, align)
    labels, amounts, counts, notes = (rng(C_BAL, r, NI, absrow=True) for r in (ROW_ILABEL, ROW_IAMOUNT, ROW_ICOUNT, ROW_INOTE))
    for i in range(NI):
        r = t_line(i)
        m = f"MATCH({i + 1},Engine!{counts},0)"
        none = f"{i + 1}>{EN(E_NITEMS)}"
        st.text(ws, r, T_COLS[0], T_ENDS[0], f'=IFERROR(IF({none},"",INDEX(Engine!{labels},{m})),"")', st.font(st.BODY))
        st.text(ws, r, T_COLS[1], T_ENDS[1], f'=IFERROR(IF({none},"",{cell_amount(f"INDEX(Engine!{amounts},{m})")}),"")',
                st.font(st.BODY, bold=True), st.RIGHT)
        st.text(ws, r, T_COLS[2], T_ENDS[2], f'=IFERROR(IF({none},"",INDEX(Engine!{notes},{m})),"")', st.font(st.HELP, color=st.GRAY))
    idx, n, flag = f"INT((ROW()-{T_L0})/2)", absr(T_COUNT), f"{absr(T_FLAG)}=1"
    st.when(ws, T_CARD, flag, st.YELLOW)                                                         # paid: the card turns yellow
    st.when(ws, T_RANGES[1], f"AND({idx}<{n},MOD(ROW()-{T_L0},2)=1)", st.CARD, border=st.UNDER)   # a line: white, a hairline
    st.when(ws, T_RANGES[1], f"{idx}<{n}", st.CARD)
    for at in T_RANGES:                                                                          # the card ends after the last line
        st.when(ws, at, f"AND({idx}<={n},{flag})", st.YELLOW)
        st.when(ws, at, f"{idx}<={n}", st.CALM)

    # ---- on the right: the focus debt, the buffer, the debt-free date, the next two paydays
    r0, r1 = R_C0, R_C1
    tile = st.font(st.TILE, bold=True, title=True)
    bottom = st.Alignment(horizontal="left", vertical="bottom")
    st.grid_card(ws, 6, 12, 9, 12)
    st.label(ws, 7, r0, r1, "Focus debt", gray=True)
    pos = EN(E_FOCUSPOS)
    names = f"Engine!$K${EO0}:$K${EO0 + ND - 1}"
    st.text(ws, 8, r0, r1, f'=IFERROR(IF({pos}=0,"",INDEX({names},{pos})),"")', tile, bottom)
    left = f"INDEX(Engine!{rng(C_BAL, ROW_LEFT, absrow=True)},{pos})"
    start = f"INDEX(Engine!$O${EO0}:$O${EO0 + ND - 1},{pos})"
    st.text(ws, 9, r0, r1, f'=IFERROR(IF({pos}=0,"",IF({left}<0.005,"",{money0(left)}&" left")),"")', st.font(st.BODY))
    st.quiet(ws, T_FOCUS_SHARE, f'=IF({pos}=0,"",IF({left}<0.005,1,MIN(MAX(({start}-{left})/{start},0),0.99)))')
    st.bar(ws, T_FOCUS_BAR_ROW, r0, absr(T_FOCUS_SHARE))
    gone = f"INDEX(Engine!{rng(C_BAL, ROW_GONE, absrow=True)},{pos})"
    st.hint(ws, 11, r0, r1, f'=IFERROR(IF({pos}=0,"",IF({gone}>0,"Gone by "&{dtext(gone)},"")),"")', wrap=False)

    buf, goal = EN(E_BUFNOW), EN(E_GOAL)
    st.grid_card(ws, 14, 20, 9, 12)
    st.label(ws, 15, r0, r1, "Buffer", gray=True)
    st.text(ws, 16, r0, r1, f'=IF({has}=0,"",IF({goal}>0,{money0(buf)}&" of "&{money0(goal)},{money0(buf)}))', tile, bottom, r1=17)
    st.quiet(ws, T_BUF_SHARE, f'=IF(AND({has}=1,{goal}>0),MIN({buf}/{goal},1),"")')
    st.bar(ws, T_BUF_BAR_ROW, r0, absr(T_BUF_SHARE))
    after = f"INDEX(Engine!${L(C_BUFAFTER)}${ER1}:${L(C_BUFAFTER)}${ERN},{view})"
    st.hint(ws, 19, r0, r1, (f'=IF({has}=0,"",IF(AND({goal}>0,{buf}>={goal}-0.005),"Full. It waits for a surprise.",'
                             f'IF(AND({view}>0,{paid}=0,{after}>{buf}+0.005),{money0(after)}&" after this payday","Kept in a plain separate account.")))'),
            wrap=False)

    st.grid_card(ws, 22, 28, 9, 12)
    st.label(ws, 23, r0, r1, "Debt-free", gray=True)
    st.text(ws, 24, r0, T_FREE_END, f'=IF(AND({has}=1,{fits}=1),{dtext(EN(E_FREE))},"")', tile, bottom, r1=25)
    st.when(ws, T_FREE, f'{absr(T_FREE)}<>""', st.YELLOW)   # the one key word
    n_left = f"MAX({EN(E_NPAY)}-{EN(E_TICKED)},0)"
    st.hint(ws, 27, r0, r1, (f'=IF({has}=0,"",IF({fits}=0,"Longer than this sheet can show.",IF({done}=1,"Every payday is ticked.",'
                             f'{n_left}&IF({n_left}=1," payday left"," paydays left"))))'), wrap=False)

    st.grid_card(ws, 30, 38, 9, 12)
    st.text(ws, 31, r0, r1, "Coming up", st.font(st.SECTION, bold=True))
    for c, e, text, align in zip(T_SOON_COLS, T_SOON_ENDS, ("Payday", "Move", "Mostly for"), (st.LEFT, st.RIGHT, st.LEFT)):
        st.head(ws, T_SOON_HEAD, c, e, text, align)
    for c in range(r0, r1 + 1):
        ws.cell(T_SOON_HEAD, c).border = st.UNDER
        ws.cell(T_SOON_ROWS[0], c).border = st.UNDER
    npay = EN(E_NPAY)
    for j, r in enumerate(T_SOON_ROWS, start=1):
        k = f"({view}+{j})"
        on = f"AND({view}>0,{k}<={npay})"
        at = lambda cc: f"INDEX(Engine!${L(cc)}${ER1}:${L(cc)}${ERN},{k})"  # noqa: E731
        x, f, b, y = at(C_EXTRA), at(C_TOBUF), at(C_BILLS), at(C_YEARLY)
        who = f"INDEX({names},{at(C_XPOS)})"
        # mostly for: the biggest part of that payday's move
        mostly = (f'IF(AND({x}>0.005,{x}>={b},{x}>={f}),{who}&" "&{money(x)}&" extra",'
                  f'IF(AND({f}>0.005,{f}>={b}),"Buffer "&{money(f)},IF({b}>0.005,"Bills "&{money(b)},"Yearly bills "&{money(y)})))')
        end = '"The last payday of the plan."' if j == 1 else '""'
        st.text(ws, r, T_SOON_COLS[0], T_SOON_ENDS[0], f'=IFERROR(IF({on},{dtext(at(C_DATE))},""),"")')
        st.text(ws, r, T_SOON_COLS[1], T_SOON_ENDS[1], f'=IFERROR(IF({on},{money(at(C_MOVE))},""),"")', st.font(st.BODY, bold=True), st.RIGHT)
        st.text(ws, r, T_SOON_COLS[2], T_SOON_ENDS[2], f'=IFERROR(IF({on},{mostly},IF(AND({view}>0,{done}=0),{end},"")),"")',
                st.font(st.HELP, color=st.GRAY))
    st.footer(ws, T_FOOT)
    return ws


# ------------------------------------------------------------------------------------------------ Path
def build_path(wb: Workbook):
    """Four big numbers with a bar, how far along, the next milestone, every payday with Actual and Done, two charts."""
    ws = wb.create_sheet("Path")
    st.page(ws, P_RN + 2, "Path")
    has, fits, pct = EN(E_HASPLAN), EN(E_FITS), EN(E_PCT)
    st.quiet(ws, P_CURK, f"=IF({EN(E_ALLDONE)}=1,0,MIN({EN(E_CURK)},{EN(E_NPAY)}))")
    st.quiet(ws, P_SHOW, f'=Start!{absr(S_SHOW)}&""')
    cur, show = absr(P_CURK), absr(P_SHOW)

    # ---- four tiles: a label, the big number, a bar, a small line
    owed, start = EN(E_OWEDNOW), EN(E_STARTOWED)
    avoided, min_int = EN(E_AVOIDED), EN(E_MININTEREST)
    can_avoid = f"AND({has}=1,ISNUMBER({avoided}))"
    ends = f"AND({has}=1,{fits}=1)"
    tiles = [
        ("Owed now", f'IF({has}=0,"",{money0(owed)})', f'IF({has}=1,{pct},"")',
         f'IF({has}=0,"","of "&{money0(start)}&" at the start")'),
        ("Debt-free date", f'IF({ends},{dtext(EN(E_FREE))},"")', f'IF({ends},MIN({EN(E_TICKED)}/{EN(E_NPAY)},1),"")',
         f'IF({ends},{EN(E_TICKED)}&" of "&{EN(E_NPAY)}&" paydays done","")'),
        ("Paid off so far", f'IF({has}=0,"",{money0(EN(E_PAIDSOFAR))})', f'IF({has}=1,{pct},"")',
         f'IF({has}=0,"",ROUND({pct}*100,0)&"% of what you owed")'),
        ("Interest you avoid", f'IF({can_avoid},{money0(avoided)},"")', f'IF(AND({can_avoid},{min_int}>0),MIN({avoided}/{min_int},0.99),"")',
         f'IF({can_avoid},"next to minimums only","")'),
    ]
    for k, (text, value, share, small) in enumerate(tiles):
        g = 1 + 3 * k
        c0, c1 = gcol(g), gend(g + 2)
        st.grid_card(ws, 6, 12, g, g + 2)
        st.label(ws, 7, c0 + 1, c1 - 1, text, gray=True)
        st.text(ws, P_TILE_ROW, c0 + 1, c1 - 1, f"={value}", st.font(st.TILE, bold=True, title=True))
        st.quiet(ws, P_SHARES[k], f"={share}")
        st.bar(ws, P_BAR_ROW, c0, absr(P_SHARES[k]))
        st.hint(ws, P_CAPTION_ROW, c0 + 1, c1 - 1, f"={small}", wrap=False)
    # under "Paid off so far": why the total moved less than the debts paid, when a debt grew
    st.text(ws, P_GREW_ROW, P_TILE_COLS[2], gend(9) - 1, f"={grew_note()}", st.font(st.HELP), st.LEFT)
    for r, h in ((6, 10), (7, 18), (P_TILE_ROW, 34), (P_BAR_ROW, 9), (P_CAPTION_ROW, 18), (P_GREW_ROW, 15), (12, 10), (13, 14)):
        ws.row_dimensions[r].height = h
    st.when(ws, P_FREE_CELLS, f'{absr(P_TILE_FREE)}<>""', st.YELLOW)  # the one key word

    # ---- how far along: the doughnut on a white card, the big number beside it; the chart beside that
    st.grid_card(ws, 14, 20, 1, 5)
    st.grid_card(ws, 14, 20, 6, 12)
    for r, h in ((14, 10), (15, 46), (16, 30), (17, 30), (18, 30), (19, 30), (20, 10), (21, 14)):
        ws.row_dimensions[r].height = h
    t1 = gend(5) - 1
    st.text(ws, 15, P_RING_TEXT, t1, f'=IFERROR(IF({has}=0,"",ROUND({pct}*100,0)&"% gone"),"")',
            st.font(28, bold=True, title=True), st.Alignment(horizontal="left", vertical="bottom"))
    st.text(ws, 16, P_RING_TEXT, t1, f'=IFERROR(IF({has}=0,"","Debts paid "&{EN(E_DEBTSPAID)}&" of "&{EN(E_NDEBTS)}),"")', st.font(st.BODY, bold=True))
    names = f"Engine!$K${EO0}:$K${EO0 + ND - 1}"
    st.hint(ws, 17, P_RING_TEXT, t1, (f'=IFERROR(IF({has}=0,"",IF({EN(E_NEXTGONEPOS)}=0,IF({EN(E_OWEDNOW)}<0.005,"Every debt is gone.",""),'
                                      f'"Next: "&INDEX({names},{EN(E_NEXTGONEPOS)})&" gone "&{dtext(EN(E_NEXTGONE))})),"")'))
    st.hint(ws, 18, P_RING_TEXT, t1, (f'=IFERROR(IF(OR({has}=0,{EN(E_MONTHPLAN)}<0.005),"",'
                                      f'"This month: "&{money(EN(E_MONTHDONE))}&" of "&{money(EN(E_MONTHPLAN))}&" done"),"")'))
    st.label(ws, 15, gcol(6) + 1, gend(12) - 1, "What you owe, payday by payday", gray=True,
             align=st.Alignment(horizontal="left", vertical="top"))

    # ---- every payday, in a white card that grows with the plan
    c0, c1 = gcol(1), gend(8)
    st.grid_card(ws, 22, P_R0, 1, 8)
    st.section(ws, 23, P_COLS[0], 14, "Your paydays")
    st.hint(ws, 23, 15, P_ENDS[-1], "Paid a different amount? Type it in Actual. Paid? Pick the tick.", wrap=False).alignment = st.RIGHT
    st.hint(ws, 24, P_COLS[0], P_ENDS[-1], f'=IF(AND({has}=1,{fits}=0),"This plan is longer than the list below can show. A little more each payday on Start brings the end into view.","")', wrap=False)
    short_day = f"INDEX(Engine!${L(C_DATE)}${ER1}:${L(C_DATE)}${ERN},{EN(E_SHORTK)})"
    st.hint(ws, 25, P_COLS[0], P_ENDS[-1], f'=IFERROR(IF({EN(E_SHORTK)}=0,"","The amount typed for "&{dtext(short_day)}&" is less than its bills. This sheet still counts the bills as paid."),"")', wrap=False)
    for r, h in ((22, 10), (24, 14), (25, 14), (P_R0, 22)):
        ws.row_dimensions[r].height = h
    for c, e, text in zip(P_COLS, P_ENDS, ["Payday", "Bills", "Yearly", "Buffer", "Extra", "Move", "Actual", "Done"]):
        st.head(ws, P_R0, c, e, text, st.LEFT if text == "Payday" else (st.CENTER if text == "Done" else st.RIGHT))
    for c in range(c0, c1 + 1):   # the card has no bottom line here: the rows below carry on
        b = ws.cell(P_R0, c).border
        ws.cell(P_R0, c).border = st.Border(bottom=st.THIN, left=b.left, right=b.right)
    src = [C_BILLS, C_YEARLY, C_TOBUF, C_EXTRA, C_MOVE0]  # Move stays what the plan asked for, Actual is what was paid
    for k in range(NR):
        r, er = P_R1 + k, ER1 + k
        on = f"AND({has}=1,{k + 1}<={EN(E_NPAY)})"
        st.text(ws, r, P_COLS[0], P_ENDS[0], f'=IFERROR(IF({on},{dtext(f"Engine!$B${er}")},""),"")')
        for j, cc in enumerate(src):
            st.text(ws, r, P_COLS[1 + j], P_ENDS[1 + j], f'=IFERROR(IF({on},{cell_amount(f"Engine!${L(cc)}${er}")},""),"")',
                    st.font(st.BODY, bold=cc == C_MOVE0), st.RIGHT)
        # the line under a typed cell is a normal border, so every program draws it (Google Sheets rules draw none)
        st.input_cell(ws, r, P_COLS[6], P_TYPE_ENDS[0], "#,##0.00", st.RIGHT, base=st.PAPER)
        st.input_cell(ws, r, P_COLS[7], P_TYPE_ENDS[1], None, st.CENTER, base=st.PAPER)
        ws.row_dimensions[r].height = 20
    done_col, act_col, first = L(P_DONE_COL), L(P_ACTUAL_COL), L(P_COLS[0])
    st.dropdown(ws, f"{done_col}{P_R1}:{done_col}{P_RN}", f'"{TICK}"')
    st.amount_only(ws, f"{act_col}{P_R1}:{act_col}{P_RN}")
    live = f'${first}{P_R1}<>""'
    last = f'AND({live},${first}{P_R1 + 1}="")'                                                     # the card's last line
    paid, current = f'${done_col}{P_R1}="{TICK}"', f"ROW()-{P_R1 - 1}={cur}"
    # in ranges that never overlap (LibreOffice and Google Sheets use the first range with a rule): the left edge,
    # the plan, Actual and Done, the right edge
    for at in P_RANGES:
        left, typing, right = at == P_RANGES[0], at == P_RANGES[2], at == P_RANGES[3]
        sides = {"left": st.THIN} if left else ({"right": st.THIN} if right else {})
        edge = st.Border(**sides) if sides else None
        st.when(ws, at, paid, st.YELLOW, fnt=st.Font(strike=True), border=edge)       # paid: yellow, struck through
        st.when(ws, at, current, st.CALM, fnt=st.Font(bold=True), border=edge)        # the current payday: calm and bold
        if typing:
            st.when(ws, at, f'AND({live},{show}="{TICK}")', st.CALM)                  # Show where to type
            st.when(ws, at, live, st.CARD)                                            # the normal border stays
            # after the plan the line under a typed cell fades into the paper (Excel and LibreOffice; Google Sheets
            # rules draw no border, so there it stays)
            st.when(ws, at, f'${first}{P_R1}=""', border=st.Border(bottom=st.Side(style="thin", color=st.PAPER)))
        else:
            st.when(ws, at, last, st.CARD, border=st.Border(bottom=st.THIN, **sides))
            st.when(ws, at, live, st.CARD, border=st.Border(bottom=None if sides else st.THIN, **sides))
    # ---- what if I add more: one typed field, the new date, how much sooner, the interest saved
    w0, w1 = R_C0, R_C1
    st.grid_card(ws, W_CARD_ROWS[0], W_CARD_ROWS[1], 9, 12, st.CALM)
    st.text(ws, 23, w0, w1, "What if I add more?", st.font(st.SECTION, bold=True))
    st.text(ws, 24, w0, w1, "Type an amount to add each payday and see your new date.", st.font(st.HELP, color=st.GRAY), st.TOP_WRAP, r1=26)
    st.label(ws, 27, w0, w0 + 2, "Add")
    st.input_cell(ws, 27, w0 + 4, w0 + 11, "#,##0.00", st.RIGHT)
    st.text(ws, 27, w0 + 13, w1, "per payday", st.font(st.BODY))
    st.amount_only(ws, W_INPUT).error = "Type an amount of 0 or more to try, or leave it empty."
    add, wmonths, wpaydays = EN(E_WADD), EN(E_WMONTHS), EN(E_WPAYDAYS)
    on = f"AND({has}=1,{add}>0)"
    st.text(ws, 29, w0, w1, f'=IFERROR(IF(AND({on},{EN(E_WFITS)}=1),{dtext(EN(E_WFREE))},""),"")', st.font(st.TILE, bold=True, title=True),
            st.Alignment(horizontal="left", vertical="center"), r1=30)
    sooner = (f'IF({wmonths}>=1,{wmonths}&IF({wmonths}=1," month sooner"," months sooner"),'
              f'IF({wpaydays}>=1,{wpaydays}&IF({wpaydays}=1," payday sooner"," paydays sooner"),"The same payday"))')
    st.hint(ws, 31, w0, w1, f'=IFERROR(IF(AND({on},{fits}=1),{sooner}&" · "&{money0(EN(E_WSAVED))}&" less interest",""),"")', wrap=False)
    st.hint(ws, 32, w0, w1, f'=IF({on},"Like it? Change your money on Start.","")', wrap=False)
    st.footer(ws, P_FOOT, 9, 12, two_rows=True)
    return ws


def px(width: float) -> int:
    """The width of a column in pixels, the way Excel counts it"""
    return int(((256 * width + int(128 / 7)) / 256) * 7)


def add_charts(wb: Workbook):
    ws, en = wb["Path"], wb["Engine"]
    cm = lambda n: n / 37.8  # noqa: E731  pixels to centimetres

    # how far along: action blue for gone, calm for left, yellow only when everything is gone
    ring = DoughnutChart()
    ring.holeSize = 62
    ring.height, ring.width = cm(150), cm(150)
    ring.legend, ring.title = None, None
    ring.add_data(Reference(en, min_col=E_RING_COL, min_row=1, max_row=3), titles_from_data=False)
    for i, rgb in enumerate((st.ACTION, st.CALM, st.YELLOW)):
        point = DataPoint(idx=i)
        point.graphicalProperties = GraphicalProperties(solidFill=rgb)
        point.graphicalProperties.line = LineProperties(solidFill=st.CARD, w=6350)
        ring.series[0].dPt.append(point)
    ws.add_chart(ring, ref(15, gcol(1) + 1))

    # what is owed, from the first payday to the last
    c0, c1 = gcol(6) + 1, gend(12) - 1
    width = sum(px(ws.column_dimensions[L(c)].width) for c in range(c0, c1 + 1))
    height = sum(ws.row_dimensions[r].height for r in range(16, 20)) * 4 / 3
    area = AreaChart()
    area.width, area.height = cm(width), cm(height + 10)
    area.legend, area.title = None, None
    area.add_data(Reference(en, min_col=24, min_row=1, max_row=NC), titles_from_data=False)
    s = area.series[0]
    s.cat = AxDataSource(strRef=StrRef(f=f"'Engine'!$W$1:$W${NC}"))  # the months are words
    s.graphicalProperties = GraphicalProperties(solidFill=st.BAND)
    s.graphicalProperties.line = LineProperties(solidFill=st.INK, w=19050)
    area.y_axis.number_format = "#,##0"
    area.y_axis.majorGridlines = None
    area.y_axis.delete = False
    area.x_axis.delete = False
    area.x_axis.tickLblSkip = 1
    area.x_axis.axPos = "b"
    # the month labels stay on one line
    area.x_axis.txPr = RichText(bodyPr=RichTextProperties(wrap="none", rot=0, vert="horz"),
                                p=[Paragraph(pPr=ParagraphProperties(defRPr=CharacterProperties(sz=900)), endParaRPr=CharacterProperties())])
    ws.add_chart(area, ref(16, c0))

    for ch in (ring, area):
        ch.visible_cells_only = False  # the numbers live on a hidden tab
        ch.roundedCorners = False
        ch.graphical_properties = GraphicalProperties(noFill=True)
        ch.graphical_properties.line = LineProperties(noFill=True)
        ch.plot_area.graphicalProperties = GraphicalProperties(noFill=True)
        ch.plot_area.graphicalProperties.line = LineProperties(noFill=True)


# ------------------------------------------------------------------------------------------------ Debts
def build_debts(wb: Workbook):
    """One block per debt, in payoff order, with a bar of 20 cells. A paid debt turns yellow with PAID."""
    ws = wb.create_sheet("Debts")
    st.page(ws, DB_FOOT + 1, "Debts")
    c0, c1 = gcol(1), gend(9)
    st.grid_card(ws, 6, DB_R0 - 1, 1, 9)   # the rows below are white only where a debt is (see the rules)
    ws.row_dimensions[6].height = 10
    st.section(ws, 7, c0 + 1, 24, "In payoff order")
    # the same number as the Path tile: what you owed at the start minus what you owe now (the app's definition)
    st.label(ws, 7, DB_COLS["bar"], DB_ENDS["bar"], "Paid off so far", gray=True, align=st.RIGHT)
    st.text(ws, 7, DB_COLS["gone"], DB_ENDS["gone"], f'=IF({EN(E_HASPLAN)}=0,"",{money0(EN(E_PAIDSOFAR))})', st.font(st.BODY, bold=True))
    # under it, when a debt grew: why the total moved less than the debts paid
    st.text(ws, 8, DB_COLS["bar"], DB_ENDS["gone"], f"={grew_note()}", st.font(st.HELP), st.RIGHT)
    ws.row_dimensions[8].height = 16
    heads = [("num", "#", st.CENTER), ("name", "Debt", st.LEFT), ("rate", "Interest", st.RIGHT), ("left", "Left now", st.RIGHT),
             ("paid", "Paid so far", st.RIGHT), ("bar", "Progress", st.LEFT), ("gone", "Gone by", st.LEFT)]
    for key, text, align in heads:
        st.head(ws, DB_R0 - 1, DB_COLS[key], DB_ENDS[key], text, align)
    for c in range(c0, c1 + 1):
        ws.cell(DB_R0 - 1, c).border = st.UNDER
    ws.row_dimensions[DB_R0 - 1].height = 22
    left_row, gone_row = f"Engine!{rng(C_BAL, ROW_LEFT, absrow=True)}", f"Engine!{rng(C_BAL, ROW_GONE, absrow=True)}"
    gap = st.Side(style="thin", color=st.PAPER)

    def value(r: int, key: str, formula: str, fnt, align):
        cell = ws.cell(r, DB_COLS[key], formula)
        cell.font, cell.alignment = fnt, align
        ws.merge_cells(start_row=r, end_row=r + 2, start_column=DB_COLS[key], end_column=DB_ENDS[key])

    for p in range(ND):
        r, er = db_row(p), EO0 + p
        name, rate, mn, start = f"Engine!$K${er}", f"Engine!$L${er}", f"Engine!$M${er}", f"Engine!$O${er}"
        left, gone = f"INDEX({left_row},{p + 1})", f"INDEX({gone_row},{p + 1})"
        on = f'{name}<>""'
        value(r, "num", f'=IF({on},{p + 1},"")', st.font(st.HELP, color=st.GRAY), st.CENTER)
        value(r, "name", f'=IF({on},{name},"")', st.font(st.BODY, bold=True), st.LEFT)
        value(r, "rate", f'=IF({on},{pct_text(f"{rate}*100")},"")', st.font(st.BODY), st.RIGHT)
        value(r, "left", f'=IF({on},{cell_amount(left, cents=True)},"")', st.font(st.BODY), st.RIGHT)
        value(r, "paid", f'=IF({on},{cell_amount(f"MAX({start}-{left},0)", cents=True)},"")', st.font(st.BODY), st.RIGHT)
        value(r, "gone", f'=IFERROR(IF({on},IF({left}<0.005,"PAID",IF({gone}>0,{dtext(gone)},"")),""),"")', st.font(st.BODY, bold=True), st.LEFT)
        # the share paid, 0 to 1, on the three rows of the block (the bar and the yellow row read it)
        for dr in range(4):
            st.quiet(ws, ref(r + dr, DB_ON_COL), f"=IF({on},1,0)")
        for dr in range(3):
            st.quiet(ws, ref(r + dr, DB_PCT_COL), f'=IF({on},IF({left}<0.005,1,MIN(MAX(({start}-{left})/{start},0),0.99)),"")')
        st.text(ws, r + 3, DB_COLS["name"], DB_ENDS["gone"], (f'=IF(AND({on},{left}>0.005,{rate}>0,{mn}<={left}*{rate}/12),'
                                                             f'"This one grows even when you pay the minimum, so it goes first.","")'),
                st.font(st.HELP), st.Alignment(horizontal="left", vertical="top"))
        for dr, h in enumerate((9, 11, 9, 16)):
            ws.row_dimensions[r + dr].height = h
        for c in range(DB_COLS["bar"], DB_ENDS["bar"] + 1):
            ws.cell(r + 1, c).border = st.Border(left=gap, right=gap)
    pct, here = f"${L(DB_PCT_COL)}{DB_R0}", f"${L(DB_ON_COL)}{DB_R0}"
    last = f"AND({here}=1,${L(DB_ON_COL)}{DB_R0 + 1}<>1)"   # the bottom of the last debt: the card ends there
    bar0, bar_row = DB_COLS["bar"], f"MOD(ROW()-{DB_R0},{DB_STEP})=1"
    for at in DB_RANGES:
        sides = {"left": st.THIN} if at == DB_RANGES[0] else ({"right": st.THIN} if at == DB_RANGES[-1] else {})
        st.when(ws, at, f"{pct}=1", st.YELLOW, border=st.Border(**sides) if sides else None)             # paid: the whole block
        if at == DB_BARS:
            st.when(ws, at, f"AND(ISNUMBER({pct}),{pct}<1,{bar_row},{pct}*{BAR}>=COLUMN()-{bar0}+0.5)", st.ACTION)
            st.when(ws, at, f"AND(ISNUMBER({pct}),{pct}<1,{bar_row})", st.CALM)
        st.when(ws, at, last, st.CARD, border=st.Border(bottom=st.THIN, **sides))
        st.when(ws, at, f"{here}=1", st.CARD, border=st.Border(**sides) if sides else None)
    st.footer(ws, DB_FOOT)
    return ws


# ------------------------------------------------------------------------------------------------ Safety net
def build_safety(wb: Workbook):
    """The buffer with its bar, beside the yearly bills with what is set aside so far."""
    ws = wb.create_sheet("Safety net")
    st.page(ws, SN_FOOT + 1, "Safety net")
    buf, goal = EN(E_BUFNOW), EN(E_GOAL)
    i0, i1 = gcol(1) + 1, gend(5) - 1
    st.grid_card(ws, 6, 13, 1, 5, st.CALM)
    st.label(ws, 7, i0, i1, "Surprise buffer", gray=True).alignment = st.Alignment(horizontal="left", vertical="bottom")
    st.text(ws, 8, i0, i1, f'=IFERROR({money0(buf)}&" of "&{money0(goal)},"")', st.font(36, bold=True, title=True),
            st.Alignment(horizontal="left", vertical="bottom"))
    st.quiet(ws, SN_SHARE, f'=IF({goal}>0,MIN({buf}/{goal},1),"")')
    st.bar(ws, 9, i0, absr(SN_SHARE), rest=st.CARD, gap=st.CALM)
    note = ws.cell(10, i0, "Kept in a plain separate account or an envelope. It comes first, so a surprise stays off your cards.")
    note.font, note.alignment = st.font(st.HELP, color=st.GRAY), st.TOP_WRAP
    ws.merge_cells(start_row=10, end_row=11, start_column=i0, end_column=i1)   # two rows: it wraps
    st.text(ws, 12, i0, i0 + 9, f'=IF(AND({goal}>0,{buf}>={goal}-0.005),"ready","")', st.font(st.BODY, bold=True))
    st.when(ws, SN_READY, f'{absr(SN_READY)}="ready"', st.YELLOW)  # done

    y0, y1 = gcol(6), gend(12)
    st.grid_card(ws, 6, SN_Y0 + NY + 1, 6, 12)
    st.section(ws, 7, y0 + 1, y1 - 1, "Yearly bills").alignment = st.Alignment(horizontal="left", vertical="bottom")
    st.hint(ws, 8, y0 + 1, y1 - 1, "Bills that come once a year. A little goes aside each payday, so they never land on a card.")
    for c, e, text, align in zip(SN_COLS, SN_ENDS, ("Bill", "A year", "Month needed", "Set aside so far", "Each payday"),
                                 (st.LEFT, st.RIGHT, st.LEFT, st.RIGHT, st.RIGHT)):
        st.head(ws, SN_HEAD, c, e, text, align)
    total = f"SUM(Start!${L(SY_AMT)}${Y0}:${L(SY_AMT)}${YN})"
    for i in range(NY):
        r, sr = SN_Y0 + i, Y0 + i
        amount = f"N(Start!${L(SY_AMT)}${sr})"
        nm, mo = f"Start!${L(SY_NAME)}${sr}", f"Start!${L(SY_MONTH)}${sr}"
        on = f"{amount}>0"
        st.text(ws, r, SN_COLS[0], SN_ENDS[0], f'=IF({on},IF({nm}="","Yearly bill",{nm}&""),"")', st.font(st.BODY, bold=True))
        st.text(ws, r, SN_COLS[1], SN_ENDS[1], f'=IF({on},{cell_amount(amount, cents=True)},"")', None, st.RIGHT)
        st.text(ws, r, SN_COLS[2], SN_ENDS[2], f'=IF({on},IF({mo}="","Any time",{mo}&""),"")')
        st.text(ws, r, SN_COLS[3], SN_ENDS[3], f'=IFERROR(IF({on},{cell_amount(f"MIN({EN(E_YSAVED)}*{amount}/{total},{amount})", cents=True)},""),"")', None, st.RIGHT)
        st.text(ws, r, SN_COLS[4], SN_ENDS[4], f'=IFERROR(IF({on},{cell_amount(f"{amount}/{EN(E_PPY)}", cents=True)},""),"")', None, st.RIGHT)
        ws.row_dimensions[r].height = 20
    st.hint(ws, SN_Y0 + NY, SN_COLS[0], SN_ENDS[-1], f'=IF({total}>0,"Car repairs, insurance, school. Add them on Start and a little goes aside each payday.",'
                                                       f'"No yearly bills yet. Add one on Start and a little goes aside each payday.")')
    for r, h in ((6, 10), (7, 24), (8, 50), (9, 9), (SN_HEAD, 22), (SN_Y0 + NY, 30), (SN_Y0 + NY + 1, 10)):
        ws.row_dimensions[r].height = h
    st.footer(ws, SN_FOOT)
    return ws


# ------------------------------------------------------------------------------------------------ Open me
def build_open_me(wb: Workbook):
    """How to make your copy, the three steps, and what to try when the file opens as view only."""
    ws = wb.create_sheet("Open me")
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
    rows = 6 + sum(len(b[1]) + 4 for b in blocks) + 4
    st.page(ws, rows, "Open me")
    i0, i1 = gcol(1) + 1, gend(8) - 1
    r = 6
    for title, lines in blocks:
        top = r
        st.section(ws, r + 1, i0, i1, title)
        r += 2
        for i, text in enumerate(lines):
            st.text(ws, r, i0, i0 + 1, i + 1, st.font(st.HELP, color=st.GRAY))
            st.text(ws, r, i0 + 3, i1, text, st.font(st.BODY), st.WRAP)
            ws.row_dimensions[r].height = 20 if len(text) <= 70 else 32
            r += 1
        st.grid_card(ws, top, r, 1, 8)
        ws.row_dimensions[top].height, ws.row_dimensions[r].height = 10, 10
        r += 2
    # questions, on the right
    st.grid_card(ws, 6, 12, 9, 12)
    st.section(ws, 7, R_C0, R_C1, "Questions?")
    st.text(ws, 8, R_C0, R_C1, f"Write to {SUPPORT_EMAIL}.", st.font(st.BODY))
    st.hint(ws, 9, R_C0, R_C1, "We read every message and answer as soon as we can.")
    st.hint(ws, 10, R_C0, R_C1, f"Version {VERSION} · {VERSION_DATE}", wrap=False)
    ws.row_dimensions[9].height = 28
    st.footer(ws, r)
    return ws


def finish(wb: Workbook):
    """The style pass every tab shares: the order of the tabs, the card lines, what prints."""
    wb._sheets = [wb[n] for n in TABS + ["Engine", "Lists"]]
    for name in TABS:  # a formula on a tab the buyer sees never shows an error: it shows nothing
        for row in wb[name].iter_rows():
            for cell in row:
                v = cell.value
                if isinstance(v, str) and v.startswith("=") and not v.startswith("=IFERROR("):
                    cell.value = f'=IFERROR({v[1:]},"")'
        st.draw_cards(wb[name])
    wb.active = 0
    for ws in wb:
        ws.sheet_view.tabSelected = ws.title == TABS[0]
    path = wb["Path"]
    for ws, area, landscape in ((wb["Today"], f"A1:{L(NCOL)}{T_FOOT}", True), (path, f"A1:{L(NCOL)}{P_R1 + P_PRINT_ROWS - 1}", True)):
        ws.print_area = area
        ws.page_setup.orientation = "landscape" if landscape else "portrait"
        ws.page_setup.fitToWidth, ws.page_setup.fitToHeight = 1, 0
        ws.sheet_properties.pageSetUpPr.fitToPage = True
        ws.print_options.horizontalCentered = True
    path.print_title_rows = f"{P_R0}:{P_R0}"
    wb.properties.title = "PaidInYellow Paycheck Payoff Planner"
    wb.properties.creator = "PaidInYellow"


# ------------------------------------------------------------------------------------------------ the workbook
def build(path: str, scenario: dict | None = None, ticks: int = 0, today: dt.date | None = None, fit_all: bool = False,
          prepare=None) -> str:
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
    if prepare:  # a last change before saving (the pictures use it)
        prepare(wb)
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
