"""PaidInYellow Paycheck Payoff Planner, 3-tab version (Start, Dashboard, Plan).
Engine = engine_v2.py (real bills by due date). Hidden helper tabs: Calc, Helpers, WhatIf.
Usage: python3 build_sheet3.py out.xlsx [blank]"""
import sys, datetime as dt
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter as L
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import FormulaRule
from openpyxl.chart import LineChart, Reference
from openpyxl.chart.series import SeriesLabel
from openpyxl.workbook.defined_name import DefinedName

ND, NR = 50, 520
R0 = 8; R1, RN = R0 + 1, R0 + NR
D0 = 19; DN = D0 + ND - 1          # debt rows on Start
Y0 = DN + 4; YN = Y0 + 9           # yearly bill rows on Start
INK, PAPER, CARD, YEL, GRAY, LINE = "1F2A44", "F4F0E6", "FBF9F3", "FFE14D", "5C5A55", "E2DCCD"
F = "Inter"
MONEY = '#,##0.00;-#,##0.00;"-"'
DATEF = 'ddd d mmm yyyy'
PAID = "✓"
example = not (len(sys.argv) > 2 and sys.argv[2] == "blank")

f_body = Font(name=F, size=10, color=INK); f_bold = Font(name=F, size=10, bold=True, color=INK)
f_head = Font(name=F, size=9, bold=True, color=GRAY); f_title = Font(name=F, size=22, bold=True, color=INK)
f_sub = Font(name=F, size=11, color=GRAY); f_small = Font(name=F, size=9, color=GRAY)
f_sect = Font(name=F, size=13, bold=True, color=INK)
fill_paper = PatternFill("solid", fgColor=PAPER); fill_in = PatternFill("solid", fgColor="FFFFFF")
fill_yel = PatternFill("solid", fgColor=YEL); fill_card = PatternFill("solid", fgColor=CARD)
fill_ink = PatternFill("solid", fgColor=INK)
ink = Side(style="thin", color=INK); thin = Side(style="thin", color=LINE)
inb = Border(left=ink, right=ink, top=ink, bottom=ink); lineb = Border(bottom=thin)

wb = Workbook()

def paper(ws, cols, rows):
    ws.sheet_view.showGridLines = False
    for c in range(1, cols + 1):
        for r in range(1, rows + 1):
            ws.cell(r, c).fill = fill_paper; ws.cell(r, c).font = f_body

def inp(cell, fmt=None):
    cell.fill = fill_in; cell.border = inb; cell.font = Font(name=F, size=10, bold=True, color=INK)
    if fmt: cell.number_format = fmt

def name(n, ref):
    dn = DefinedName(n, attr_text=ref)
    try: wb.defined_names[n] = dn
    except TypeError: wb.defined_names.append(dn)

# ================================================================ Start
st = wb.active; st.title = "Start"; paper(st, 16, YN + 30)
for k, v in {"A": 3, "B": 34, "C": 20, "D": 13, "E": 10, "F": 14, "G": 9, "H": 9, "I": 10, "J": 4, "K": 8, "L": 16, "M": 9, "N": 6, "O": 6, "P": 50}.items():
    st.column_dimensions[k].width = v
st["B2"] = "paid in yellow · Paycheck Payoff Planner"; st["B2"].font = f_title
st["B3"] = "1. Fill in Setup   2. List your debts   3. Open the Dashboard. White cells are yours to type in."; st["B3"].font = f_sub
st["B5"] = "Setup"; st["B5"].font = f_sect
setup = [
 (6, "Country", "United States", None, "Picks your currency. Not listed? Choose Other and type your symbol below."),
 (7, "Currency symbol (only for Other)", None, None, "For example ₹, R or MAD"),
 (8, "How often you're paid", "Every 2 weeks", None, "Every week · Every 2 weeks · Twice a month · Every month"),
 (9, "Your next payday", dt.date(2026, 10, 30), DATEF, "The plan starts on this payday."),
 (10, "Twice a month only: your other pay day", None, "0", "For example 15, or 31 for the last day. Empty = the usual pairing."),
 (12, "Money for the plan each payday", 100, MONEY, "On top of your minimums. Even 20 matters."),
 (13, "Buffer: set aside now", 300, MONEY, "Money for surprises. Empty is fine."),
 (14, "Buffer goal", 500, MONEY, "Keep it in a plain separate account or an envelope."),
 (15, "Payoff order", "PaidInYellow order", None, "PaidInYellow order (smallest first, growing debts first) · Biggest interest first · My own order"),
]
for rr, lab, val, fmt, hint in setup:
    st.cell(rr, 2, lab).font = f_bold
    keep = example or rr in (6, 8, 14, 15)
    inp(st.cell(rr, 3, val if keep else None), fmt)
    st.cell(rr, 4, hint).font = f_small
countries = [("United States", "$"), ("Canada", "$"), ("United Kingdom", "£"), ("Ireland", "€"), ("France", "€"),
             ("Germany", "€"), ("Spain", "€"), ("Italy", "€"), ("Netherlands", "€"), ("Belgium", "€"), ("Australia", "$"),
             ("New Zealand", "$"), ("South Africa", "R"), ("India", "₹"), ("Morocco", "MAD "), ("United Arab Emirates", "AED "),
             ("Saudi Arabia", "SAR "), ("Other", "")]
dvs = [
 (f'"{",".join(c for c, _ in countries)}"', "C6"),
 ('"Every week,Every 2 weeks,Twice a month,Every month"', "C8"),
 ('"PaidInYellow order,Biggest interest first,My own order"', "C15"),
]
for f1, ref in dvs:
    dv = DataValidation(type="list", formula1=f1, allow_blank=False); st.add_data_validation(dv); dv.add(ref)

st.cell(D0 - 2, 2, "Your debts").font = f_sect
st.cell(D0 - 2, 4, "Up to 50. Balance, rate and minimum are on your statement. Due day = the day of the month it's due.").font = f_small
hdr = ["#", "Name", "Type (optional)", "Balance", "Rate %", "Minimum / month", "Due day", "My order", "Note", "key", "Pay order", "Gone by", "Status", "min mo", "min int"]
for j, h in enumerate(hdr):
    c = st.cell(D0 - 1, 1 + j, h); c.font = f_head; c.alignment = Alignment(wrap_text=True, vertical="bottom"); c.border = lineb
st.row_dimensions[D0 - 1].height = 28
ex_debts = [("Card A", "Credit card", 500, 24, 25, 10), ("Card B", "Credit card", 1200, 18, 40, 20)] if example else []
for i in range(ND):
    rr = D0 + i
    st.cell(rr, 1, i + 1).font = f_small
    vals = ex_debts[i] if i < len(ex_debts) else (None,) * 6
    for j, v in enumerate(vals):
        inp(st.cell(rr, 2 + j, v), [None, None, MONEY, "0.00", MONEY, "0"][j])
    inp(st.cell(rr, 8), "0")
    st.cell(rr, 9, f'=IF(AND(D{rr}>0,E{rr}>0,F{rr}<=D{rr}*E{rr}/1200),"Grows","")')
    st.cell(rr, 10, (f'=IF(N(D{rr})<=0,5E+15,IF($C$15="Biggest interest first",ROUND((100-E{rr})*1000,0)*1E+10+ROUND(D{rr}*100,0),'
                     f'IF($C$15="My own order",IF(H{rr}>0,H{rr},999),IF(I{rr}="Grows",ROUND((100-E{rr})*1000,0),1E+6+ROUND(D{rr}*100,0)))))'))
    st.cell(rr, 11, f'=IF(N(D{rr})<=0,"",COUNTIF($J${D0}:$J${DN},"<"&J{rr})+COUNTIFS($J${D0}:$J${DN},J{rr},$A${D0}:$A${DN},"<"&A{rr})+1)')
    st.cell(rr, 12, f'=IF(N(D{rr})<=0,"",IFERROR(INDEX(Plan!$B${R1}:$B${RN},COUNTIF(INDEX(BalBlock,0,K{rr}),">0.005")+1),"More than 20 years"))')
    st.cell(rr, 12).number_format = 'd mmm yyyy'
    st.cell(rr, 13, f'=IF(N(D{rr})<=0,"",IF(INDEX(BalNow,1,K{rr})<0.005,"PAID",""))')
    st.cell(rr, 14, f'=IF(N(D{rr})<=0,"",IF(N(F{rr})<=0,"Never ends",IF(AND(E{rr}>0,F{rr}<=D{rr}*E{rr}/1200),"Never ends",IF(N(E{rr})=0,D{rr}/F{rr},NPER(E{rr}/1200,-F{rr},D{rr})))))')
    st.cell(rr, 15, f'=IF(ISNUMBER(N{rr}),F{rr}*N{rr}-D{rr},"")')
st.conditional_formatting.add(f"B{D0}:M{DN}", FormulaRule(formula=[f'$M{D0}="PAID"'], fill=fill_yel))
# the hidden sort key column K uses a helper index: rows without a balance sort last (key 5E15)
for col in ("J", "N", "O"): st.column_dimensions[col].hidden = True

st.cell(Y0 - 2, 2, "Yearly bills (optional)").font = f_sect
st.cell(Y0 - 2, 3, "Bills that come once a year, saved a little each payday so they never land on a card.").font = f_small
for j, h in enumerate(["Bill", "Per year", "Month needed"]):
    c = st.cell(Y0 - 1, 2 + j, h); c.font = f_head; c.border = lineb
ex_bills = [("Gifts and holidays", 240, "December")] if example else []
for i in range(10):
    for j in range(3):
        inp(st.cell(Y0 + i, 2 + j, ex_bills[i][j] if i < len(ex_bills) else None), MONEY if j == 1 else None)
st.cell(YN + 1, 2, "Total per year").font = f_bold
st.cell(YN + 1, 3, f"=SUM(C{Y0}:C{YN})").number_format = MONEY
h0 = YN + 4
help_lines = [
 ("How it works", True),
 ("Every debt gets its full monthly minimum on the payday before its due date. Your money for the plan fills yearly bills, then your buffer, then goes to one debt at a time.", False),
 ("When a debt is gone, its minimum keeps going: it joins the extra for the next debt. Balances move only by what you pay, plus interest.", False),
 ("Each payday: open the Dashboard, pay what it lists, then pick ✓ in the Paid column of the Plan tab. The row turns yellow.", False),
 ("Real life: on the Plan tab you can type a different amount, a new charge, buffer you used, or a yearly bill you paid.", False),
 ("Every few months, type the real balances from your statements here, set your next payday, and clear the old ✓ marks. The plan starts fresh from the truth.", False),
 ("A planning tool, not financial advice. Figures are estimates. Your numbers stay in your own account. We never suggest loans or new credit. Help: support@paidinyellow.com", False),
]
for k, (t, b) in enumerate(help_lines):
    c = st.cell(h0 + k, 2, t); c.font = f_sect if b else f_body
st.cell(h0 + len(help_lines) + 1, 2, "one paycheck at a time").font = Font(name="Caveat", size=16, bold=True, color=GRAY)
st.freeze_panes = "A4"

# ================================================================ Calc (hidden)
ca = wb.create_sheet("Calc")
ca["B2"] = "Currency"; ca["C2"] = '=IF(Start!$C$6="Other",IF(Start!$C$7="","$",Start!$C$7),IFERROR(VLOOKUP(Start!$C$6,$E$2:$F$40,2,0),"$"))'
ca["B3"] = "Paydays per year"; ca["C3"] = '=IF(Start!$C$8="Every week",52,IF(Start!$C$8="Every 2 weeks",26,IF(Start!$C$8="Twice a month",24,12)))'
ca["B4"] = "Yearly bills per payday"; ca["C4"] = f"=Start!$C${YN+1}/C3"
ca["B5"] = "Other pay day"; ca["C5"] = '=IF(Start!$C$10>0,Start!$C$10,IF(DAY(Start!$C$9)<=15,DAY(Start!$C$9)+15,IF(DAY(Start!$C$9)=DAY(EOMONTH(Start!$C$9,0)),15,DAY(Start!$C$9)-15)))'
ca["B6"] = "First pay day"; ca["C6"] = "=MIN(DAY(Start!$C$9),C5)"
ca["B7"] = "Second pay day"; ca["C7"] = "=MAX(DAY(Start!$C$9),C5)"
ca["B8"] = "Starts on second"; ca["C8"] = "=IF(DAY(Start!$C$9)=C6,0,1)"
for i, (cty, sym) in enumerate(countries):
    ca.cell(2 + i, 5, cty); ca.cell(2 + i, 6, sym)
ca["B12"] = "Open payday (row in plan)"; ca["C12"] = f'=IFERROR(MATCH(1,Plan!$W${R1}:$W${RN},0),0)'
ca["B13"] = "Open payday #"; ca["C13"] = f'=IF(C12=0,0,INDEX(Plan!$A${R1}:$A${RN},C12))'
CUR = "Calc!$C$2"; PPY = "Calc!$C$3"; OPEN = "Calc!$C$12"

# ================================================================ Helpers (hidden): debts in payoff order
he = wb.create_sheet("Helpers")
for j, h in enumerate(["Pos", "Row", "Name", "Rate", "Minimum", "Due", "Start balance"]):
    he.cell(1, 1 + j, h)
for p in range(1, ND + 1):
    rr = p + 1
    he.cell(rr, 1, p)
    he.cell(rr, 2, f"=IFERROR(MATCH(A{rr},Start!$K${D0}:$K${DN},0),{ND})")
    he.cell(rr, 3, f'=IFERROR(IF(N(INDEX(Start!$D${D0}:$D${DN},B{rr}))>0,INDEX(Start!$B${D0}:$B${DN},B{rr})&"",""),"")')
    he.cell(rr, 4, f'=IF(C{rr}="",0,N(INDEX(Start!$E${D0}:$E${DN},B{rr}))/100)')
    he.cell(rr, 5, f'=IF(C{rr}="",0,N(INDEX(Start!$F${D0}:$F${DN},B{rr})))')
    he.cell(rr, 6, f'=IF(C{rr}="","",IF(N(INDEX(Start!$G${D0}:$G${DN},B{rr}))>0,INDEX(Start!$G${D0}:$G${DN},B{rr}),""))')
    he.cell(rr, 7, f'=IF(C{rr}="",0,MAX(N(INDEX(Start!$D${D0}:$D${DN},B{rr})),0))')

# ================================================================ engine (Plan and WhatIf)
fixed = ["Payday #", "Payday", "Next payday", "Paid", "Amount +/-", "New charge", "Buffer used", "Yearly bill paid",
         "Money for the plan", "To yearly bills", "To buffer", "Buffer after", "Yearly bills saved",
         "Bills this payday", "Freed-up minimums", "Extra for debts", "Extra paid", "Move this payday",
         "Interest", "Still owed", "Focus debt", "Charge goes to #", "Open", "Minimums only: owed"]
NF = len(fixed)
B_DUE = NF + 2; B_BILL = B_DUE + ND; B_EXT = B_BILL + ND; B_BAL = B_EXT + ND; LAST = B_BAL + ND - 1

def dfor(k):
    s = "Start!$C$9"
    return (f'IF(Start!$C$8="Every month",EDATE({s},{k}),IF(Start!$C$8="Twice a month",'
            f'DATE(YEAR({s}),MONTH({s})+INT(({k}+Calc!$C$8)/2),MIN(IF(MOD({k}+Calc!$C$8,2)=0,Calc!$C$6,Calc!$C$7),'
            f'DAY(EOMONTH(DATE(YEAR({s}),MONTH({s})+INT(({k}+Calc!$C$8)/2),1),0)))),'
            f'{s}+{k}*IF(Start!$C$8="Every week",7,14)))')

def engine(ws, whatif=False):
    ws.sheet_view.showGridLines = False
    for j, h in enumerate(fixed):
        c = ws.cell(7, 1 + j, h); c.font = f_head; c.alignment = Alignment(wrap_text=True, vertical="bottom")
    ws.row_dimensions[7].height = 42
    for start, lab in [(B_DUE, "Minimum due"), (B_BILL, "Bill paid"), (B_EXT, "Extra paid"), (B_BAL, "Balance after")]:
        ws.cell(3, start, lab + " · by debt, in payoff order").font = f_bold
        for p in range(1, ND + 1):
            c = start + p - 1
            ws.cell(7, c, f'=IF(Helpers!$C${p+1}="","#{p}",Helpers!$C${p+1})').font = f_head
            if start == B_DUE: ws.cell(5, c, f"=Helpers!$E${p+1}"); ws.cell(6, c, f"=Helpers!$F${p+1}")
            if start == B_BAL: ws.cell(5, c, f"=Helpers!$D${p+1}")
            if start in (B_BAL, B_EXT): ws.cell(6, c, p)
    rr = R0
    ws.cell(rr, 1, "Start"); ws.cell(rr, 2, "=Start!$C$9"); ws.cell(rr, 2).number_format = 'ddd d mmm yy'
    ws.cell(rr, 12, "=N(Start!$C$13)"); ws.cell(rr, 13, 0)
    for p in range(ND): ws.cell(rr, B_BAL + p, f"=Helpers!$G${p+2}")
    ws.cell(rr, 20, f"=SUM({L(B_BAL)}{rr}:{L(LAST)}{rr})"); ws.cell(rr, 24, f"=T{rr}")
    for t in range(NR):
        rr = R1 + t; pr = rr - 1
        ws.cell(rr, 1, t + 1)
        ws.cell(rr, 2, "=" + dfor(f"($A{rr}-1)")); ws.cell(rr, 3, "=" + dfor(f"$A{rr}"))
        if whatif:
            for cc in (4, 5, 6, 7, 8): ws.cell(rr, cc, f"=Plan!{L(cc)}{rr}")
            ws.cell(rr, 9, f'=N(Start!$C$12)+N(E{rr})+IF(D{rr}="{PAID}",0,N(Dashboard!$C$37))')
        else:
            for cc in (4, 5, 6, 7, 8): inp(ws.cell(rr, cc), MONEY if cc > 4 else None)
            ws.cell(rr, 4).alignment = Alignment(horizontal="center")
            ws.cell(rr, 9, f"=N(Start!$C$12)+N(E{rr})")
        ws.cell(rr, 10, f"=MIN(Calc!$C$4,MAX(I{rr},0))")
        ws.cell(rr, 11, f"=MIN(MAX(N(Start!$C$14)-L{pr},0),MAX(I{rr}-J{rr},0))")
        ws.cell(rr, 12, f"=L{pr}+K{rr}-N(G{rr})")
        ws.cell(rr, 13, f"=M{pr}+J{rr}-N(H{rr})")
        ws.cell(rr, 14, f"=SUM({L(B_BILL)}{rr}:{L(B_BILL+ND-1)}{rr})")
        ws.cell(rr, 15, f"=SUM({L(B_DUE)}{rr}:{L(B_DUE+ND-1)}{rr})-N{rr}")
        ws.cell(rr, 16, f"=MAX(I{rr}-J{rr}-K{rr},0)+O{rr}")
        ws.cell(rr, 17, f"=SUM({L(B_EXT)}{rr}:{L(B_EXT+ND-1)}{rr})")
        ws.cell(rr, 18, f"=N{rr}+J{rr}+K{rr}+Q{rr}")
        ws.cell(rr, 19, f"=T{rr}-T{pr}-N(F{rr})+N{rr}+Q{rr}")
        ws.cell(rr, 20, f"=SUM({L(B_BAL)}{rr}:{L(LAST)}{rr})")
        fb = f'_xlfn.MINIFS(${L(B_BAL)}$6:${L(LAST)}$6,{L(B_BAL)}{pr}:{L(LAST)}{pr},">0.005")'
        ws.cell(rr, 22, f"=IF({fb}=0,1,{fb})")
        if not whatif:
            fe = f'_xlfn.MINIFS(${L(B_EXT)}$6:${L(B_EXT+ND-1)}$6,{L(B_EXT)}{rr}:{L(B_EXT+ND-1)}{rr},">0.005")'
            ws.cell(rr, 21, f'=IF(T{pr}<0.005,"",INDEX(Helpers!$C$2:$C${ND+1},IF({fe}=0,V{rr},{fe})))')
            ws.cell(rr, 23, f'=IF(AND(D{rr}<>"{PAID}",T{pr}>0.005),1,0)')
            n = f"(($B{rr}-Start!$C$9)/(365.25/12))"
            x = (f"(Helpers!$G$2:$G${ND+1}*(1+(Helpers!$D$2:$D${ND+1}+1E-9)/12)^{n}-Helpers!$E$2:$E${ND+1}"
                 f"*((1+(Helpers!$D$2:$D${ND+1}+1E-9)/12)^{n}-1)/((Helpers!$D$2:$D${ND+1}+1E-9)/12))")
            ws.cell(rr, 24, f"=SUMPRODUCT(({x}>0)*{x})")
        for p in range(ND):
            cdue, cbill, cext, cbal = L(B_DUE + p), L(B_BILL + p), L(B_EXT + p), L(B_BAL + p)
            dd, mn = f"{cdue}$6", f"{cdue}$5"
            d1 = f"DATE(YEAR($B{rr}),MONTH($B{rr}),MIN({dd},DAY(EOMONTH($B{rr},0))))"
            d2 = f"DATE(YEAR($B{rr}),MONTH($B{rr})+1,MIN({dd},DAY(EOMONTH($B{rr},1))))"
            ws.cell(rr, B_DUE + p, f'=IF(OR(N({mn})=0,{dd}=""),0,{mn}*(({d1}>=$B{rr})*({d1}<$C{rr})+({d2}>=$B{rr})*({d2}<$C{rr})))')
            pre = f"({cbal}{pr}*(1+{cbal}$5/{PPY})+IF($V{rr}={p+1},N($F{rr}),0))"
            ws.cell(rr, B_BILL + p, f"=MIN({cdue}{rr},{pre})")
            used = "0" if p == 0 else f"SUM({L(B_EXT)}{rr}:{L(B_EXT+p-1)}{rr})"
            ws.cell(rr, B_EXT + p, f"=MIN(MAX({pre}-{cbill}{rr},0),MAX($P{rr}-{used},0))")
            ws.cell(rr, B_BAL + p, f"=IF({pre}-{cbill}{rr}-{cext}{rr}<0.005,0,{pre}-{cbill}{rr}-{cext}{rr})")
        if not whatif:
            for cc in list(range(1, 4)) + list(range(9, NF + 1)):
                c = ws.cell(rr, cc); c.font = f_bold if cc in (18, 20) else f_body
                if cc in (2, 3): c.number_format = 'ddd d mmm yy'
                elif cc >= 9 and cc not in (21, 22, 23): c.number_format = MONEY

pl = wb.create_sheet("Plan"); engine(pl)
pl["A1"] = "Plan · payday by payday"; pl["A1"].font = f_title
pl["A2"] = "When you've paid a payday, pick ✓ in the Paid column. It turns yellow. Columns E to H are for real life."; pl["A2"].font = f_sub
dvp = DataValidation(type="list", formula1=f'"{PAID}"', allow_blank=True); pl.add_data_validation(dvp); dvp.add(f"D{R1}:D{RN}")
pl.conditional_formatting.add(f"A{R1}:T{RN}", FormulaRule(formula=[f'$D{R1}="{PAID}"'], fill=fill_yel, font=Font(strike=True, color=INK)))
for j, w in enumerate([8, 14, 14, 6, 11, 11, 11, 11, 11, 11, 11, 11, 11, 12, 12, 12, 12, 13, 11, 12, 16, 6, 6, 13]):
    pl.column_dimensions[L(j + 1)].width = w
for c in (22, 23, 24): pl.column_dimensions[L(c)].hidden = True
for c in range(B_DUE, LAST + 1): pl.column_dimensions[L(c)].width = 11
pl.column_dimensions.group(L(B_DUE), L(B_EXT + ND - 1), hidden=True, outline_level=1)
pl.freeze_panes = f"D{R1}"
name("BalBlock", f"Plan!${L(B_BAL)}${R1}:${L(LAST)}${RN}")

wi = wb.create_sheet("WhatIf"); engine(wi, whatif=True)

# Calc: per-position values on the open payday
for p in range(ND):
    c = 3 + p; cl = L(c)
    def blk(start):
        return f'IF($C$12=0,0,INDEX(Plan!${L(start+p)}${R1}:${L(start+p)}${RN},$C$12))'
    ca.cell(20, c, f'=IF($C$12=0,INDEX(Plan!${L(B_BAL+p)}${R1}:${L(B_BAL+p)}${RN},{NR}),IF($C$12=1,Plan!{L(B_BAL+p)}${R0},INDEX(Plan!${L(B_BAL+p)}${R1}:${L(B_BAL+p)}${RN},$C$12-1)))')
    ca.cell(21, c, "=" + blk(B_BILL)); ca.cell(22, c, "=" + blk(B_EXT))
    ca.cell(23, c, f"=IF({cl}21+{cl}22>0.005,1,0)")
    ca.cell(24, c, f"={cl}23" if p == 0 else f"={L(c-1)}24+{cl}23")
    dd = f"Helpers!$F${p+2}"
    B_ = f"INDEX(Plan!$B${R1}:$B${RN},$C$12)"; C_ = f"INDEX(Plan!$C${R1}:$C${RN},$C$12)"
    d1 = f"DATE(YEAR({B_}),MONTH({B_}),MIN({dd},DAY(EOMONTH({B_},0))))"
    d2 = f"DATE(YEAR({B_}),MONTH({B_})+1,MIN({dd},DAY(EOMONTH({B_},1))))"
    ca.cell(25, c, f'=IF(OR($C$12=0,{dd}=""),"",IF(AND({d1}>={B_},{d1}<{C_}),{d1},IF(AND({d2}>={B_},{d2}<{C_}),{d2},"")))')
    ca.cell(26, c, f"=Helpers!$D${p+2}")
HN = L(3 + ND - 1)
name("BalNow", f"Calc!$C$20:${HN}$20")

# ================================================================ Dashboard
db = wb.create_sheet("Dashboard", 1); paper(db, 16, 100)
for k, v in {"A": 3, "B": 30, "C": 16, "D": 17, "E": 20, "F": 20, "G": 10, "H": 3}.items():
    db.column_dimensions[k].width = v
def at(col): return f'INDEX(Plan!${col}${R1}:${col}${RN},{OPEN})'
def money(expr): return f'{CUR}&TEXT({expr},"#,##0")'
cnt = f'COUNTIF(Plan!$T${R1}:$T${RN},">0.005")'
db["B2"] = "Your plan"; db["B2"].font = f_title
db["B3"] = (f'=IF({OPEN}=0,IF(Plan!$T${RN}<0.005,"You\'re debt-free. Keep your buffer and yearly bills going.","Every planned payday is marked paid."),'
            f'"Next payday: "&TEXT({at("B")},"ddd d mmm yyyy"))'); db["B3"].font = f_sub
# headline row
db["B5"] = "DEBT-FREE BY"; db["D5"] = '=UPPER(D7)'; db["F5"] = "DEBTS PAID"
for c in ("B5", "D5", "F5"): db[c].font = f_head
db["B6"] = f'=IF({cnt}>={NR},"More than 20 years",INDEX(Plan!$B${R1}:$B${RN},{cnt}+1))'
db["B6"].number_format = "mmmm yyyy"; db["B6"].font = Font(name=F, size=22, bold=True, color=INK); db["B6"].fill = fill_yel
db["Z1"] = f'=IF({cnt}>={NR},"",MAX({cnt}+1-MAX({OPEN}-1,0),0))'   # paydays left
db["D6"] = f'=IF(Z1="","",IF(D7="Years left",ROUND(Z1/{PPY},1),ROUND(Z1*12/{PPY},0)))'
db["D6"].font = Font(name=F, size=22, bold=True, color=INK)
inp(db["D7"]); db["D7"] = "Months left"
dvt = DataValidation(type="list", formula1='"Months left,Years left"', allow_blank=False); db.add_data_validation(dvt); dvt.add("D7")
db["F6"] = '=COUNTIF($H$47:$H$96,"PAID")&" of "&COUNTIF($C$47:$C$96,"?*")'
db["F6"].font = Font(name=F, size=22, bold=True, color=INK)
# key numbers
tiles = [("B", "OWED NOW", "=SUM(BalNow)", MONEY), ("C", "PAID OFF", f"=MAX(Plan!$T${R0}-B10,0)", MONEY),
         ("D", "GONE", f"=IF(Plan!$T${R0}>0,C10/Plan!$T${R0},0)", "0%"),
         ("E", "INTEREST YOU AVOID", f'=IF(COUNTIF(Start!$N${D0}:$N${DN},"Never ends")>0,"All of it",MAX(SUM(Start!$O${D0}:$O${DN})-SUM(Plan!$S${R1}:$S${RN}),0))', MONEY),
         ("F", "COSTS YOU PER DAY", "=SUMPRODUCT(Calc!$C$20:$" + HN + "$20,Calc!$C$26:$" + HN + "$26)/365", MONEY)]
for col, lab, fml, fmt in tiles:
    db[f"{col}9"] = lab; db[f"{col}9"].font = f_head
    c = db[f"{col}10"]; c.value = fml; c.number_format = fmt; c.font = Font(name=F, size=14, bold=True, color=INK); c.fill = fill_card
# this payday
db["B12"] = "THIS PAYDAY"; db["B12"].font = f_head
db["B13"] = f'=IF({OPEN}=0,"","Move "&{money(at("R"))})'; db["B13"].font = Font(name=F, size=26, bold=True, color=INK)
db["B14"] = (f'=IF({OPEN}=0,"",IF({at("Q")}>0.005,"The extra "&{money(at("Q"))}&" goes to "&{at("U")}&".",'
             f'IF({at("K")}>0.005,"Your buffer fills first. Extra for your debts starts once it reaches "&{money("Start!$C$14")}&".","")))')
db["B14"].font = Font(name=F, size=12, color=INK)
for j, h in enumerate(["What", "Bill", "Extra", "Due", "Total"]):
    c = db.cell(16, 2 + j, h); c.font = f_head; c.border = lineb
for j in range(12):
    rr = 17 + j; m = f"MATCH({j+1},Calc!$C$24:${HN}$24,0)"
    db.cell(rr, 2, f'=IFERROR(INDEX(Helpers!$C$2:$C${ND+1},{m}),"")')
    db.cell(rr, 3, f'=IFERROR(INDEX(Calc!$C$21:${HN}$21,{m}),"")')
    db.cell(rr, 4, f'=IFERROR(INDEX(Calc!$C$22:${HN}$22,{m}),"")')
    db.cell(rr, 5, f'=IFERROR(INDEX(Calc!$C$25:${HN}$25,{m}),"")')
    db.cell(rr, 6, f'=IF(B{rr}="","",N(C{rr})+N(D{rr}))')
    for cc in (3, 4, 6): db.cell(rr, cc).number_format = MONEY
    db.cell(rr, 5).number_format = "ddd d mmm"
    for cc in range(2, 7): db.cell(rr, cc).border = lineb
db["B29"] = "Yearly bills pot"; db["F29"] = f'=IF({OPEN}=0,"",{at("J")})'
db["B30"] = "Buffer"; db["F30"] = f'=IF({OPEN}=0,"",{at("K")})'
db["B31"] = "Total to move"; db["F31"] = f'=IF({OPEN}=0,"",{at("R")})'
for rr in (29, 30, 31):
    db.cell(rr, 6).number_format = MONEY; db.cell(rr, 2).border = lineb; db.cell(rr, 6).border = lineb
db["B31"].font = f_bold; db["F31"].font = f_bold
db["B32"] = f'=IF({OPEN}=0,"","When it\'s done, pick ✓ on payday #"&Calc!$C$13&" in the Plan tab.")'; db["B32"].font = f_small
# pay a bit more
cntw = f'COUNTIF(WhatIf!$T${R1}:$T${RN},">0.005")'
db["B35"] = "PAY A BIT MORE?"; db["B35"].font = f_head
db["B36"] = "Try adding this much each payday"; db["B36"].font = f_body
db["B37"] = "Add each payday"; db["B37"].font = f_bold
inp(db["C37"], MONEY); db["C37"] = 50
dvw = DataValidation(type="list", formula1='"20,50,100,200"', allow_blank=True, showErrorMessage=False); db.add_data_validation(dvw); dvw.add("C37")
db["B38"] = "New debt-free date"; db["C38"] = f'=IF({cntw}>={NR},"More than 20 years",INDEX(WhatIf!$B${R1}:$B${RN},{cntw}+1))'; db["C38"].number_format = "mmmm yyyy"
db["B39"] = "Months sooner"; db["C39"] = '=IF(AND(ISNUMBER(B6),ISNUMBER(C38)),MAX(ROUND((B6-C38)/(365.25/12),0),0),"")'
db["B40"] = "Interest you save"; db["C40"] = f"=MAX(SUM(Plan!$S${R1}:$S${RN})-SUM(WhatIf!$S${R1}:$S${RN}),0)"; db["C40"].number_format = MONEY
db["B41"] = "Like it? Raise “Money for the plan” on the Start tab."; db["B41"].font = f_small
for rr in (38, 39, 40): db.cell(rr, 3).font = f_bold
# debts in order
db["B44"] = "YOUR DEBTS, IN THE ORDER YOU PAY THEM"; db["B44"].font = f_head
for j, h in enumerate(["#", "Debt", "Left", "Progress", "Gone", "Gone by", "Status"]):
    c = db.cell(46, 1 + j if j == 0 else 1 + j, h); c.font = f_head; c.border = lineb
for p in range(1, ND + 1):
    rr = 46 + p
    db.cell(rr, 1, f'=IF(C{rr}="","",{p})').font = f_small
    db.cell(rr, 2, f"=Helpers!$C${p+1}")
    db.cell(rr, 3, f'=IF(B{rr}="","",INDEX(BalNow,1,{p}))')
    db.cell(rr, 5, f'=IF(B{rr}="","",IF(Helpers!$G${p+1}>0,1-C{rr}/Helpers!$G${p+1},1))')
    db.cell(rr, 4, f'=IF(B{rr}="","",REPT("█",ROUND(E{rr}*12,0))&REPT("░",12-ROUND(E{rr}*12,0)))')
    db.cell(rr, 6, f'=IF(B{rr}="","",INDEX(Start!$L${D0}:$L${DN},Helpers!$B${p+1}))')
    db.cell(rr, 7, f'=IF(B{rr}="","",IF(C{rr}<0.005,"PAID",""))')
    db.cell(rr, 3).number_format = MONEY; db.cell(rr, 5).number_format = "0%"; db.cell(rr, 6).number_format = "mmm yyyy"
    db.cell(rr, 4).font = Font(name="Arial", size=9, color=INK)
db.conditional_formatting.add("A47:G96", FormulaRule(formula=['$G47="PAID"'], fill=fill_yel))
# the paid count reads column G; keep the formula refs right
db["F6"] = '=COUNTIF($G$47:$G$96,"PAID")&" of "&COUNTIF($B$47:$B$96,"?*")'
db["B99"] = "one paycheck at a time"; db["B99"].font = Font(name="Caveat", size=16, bold=True, color=GRAY)
db["B98"] = "A planning tool, not financial advice. Figures are estimates based on what you enter."; db["B98"].font = f_small
# chart
ch = LineChart(); ch.height = 9; ch.width = 18; ch.y_axis.number_format = "#,##0"; ch.x_axis.number_format = "mmm yy"
ch.title = "Balance over time"; NCH = 156
ch.add_data(Reference(pl, min_col=20, min_row=R1, max_row=R0 + NCH), titles_from_data=False)
ch.add_data(Reference(pl, min_col=24, min_row=R1, max_row=R0 + NCH), titles_from_data=False)
ch.set_categories(Reference(pl, min_col=2, min_row=R1, max_row=R0 + NCH))
ch.series[0].tx = SeriesLabel(v="Your plan"); ch.series[1].tx = SeriesLabel(v="Minimums only")
ch.series[0].graphicalProperties.line.solidFill = INK; ch.series[0].graphicalProperties.line.width = 28000
ch.series[1].graphicalProperties.line.solidFill = "8A8780"; ch.series[1].graphicalProperties.line.dashStyle = "dash"
db.add_chart(ch, "I5")
db.column_dimensions["Z"].hidden = True

for s in ("Calc", "Helpers", "WhatIf"): wb[s].sheet_state = "hidden"
wb._sheets = [wb[n] for n in ["Start", "Dashboard", "Plan", "Calc", "Helpers", "WhatIf"]]
wb.active = 0
wb.save(sys.argv[1]); print("saved", sys.argv[1])
