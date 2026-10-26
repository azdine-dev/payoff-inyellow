"""Build the PaidInYellow Paycheck Payoff Planner (Google Sheets bonus) as .xlsx.
Model: engine_v2.py (real bills by due date, the trust fix)."""
import sys, json, datetime as dt
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter as L
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import FormulaRule
from openpyxl.chart import LineChart, Reference

ND, NR = 50, 520            # debts, paydays
R0 = 8                       # start row (balances before the first payday)
R1, RN = R0 + 1, R0 + NR     # payday rows
INK, PAPER, CARD, YEL, GRAY, LINE = "1F2A44", "F4F0E6", "FBF9F3", "FFE14D", "5C5A55", "E2DCCD"
F = "Inter"
f_body = Font(name=F, size=10, color=INK)
f_bold = Font(name=F, size=10, bold=True, color=INK)
f_head = Font(name=F, size=9, bold=True, color=GRAY)
f_title = Font(name=F, size=20, bold=True, color=INK)
f_sub = Font(name=F, size=11, color=GRAY)
f_big = Font(name=F, size=22, bold=True, color=INK)
fill_paper = PatternFill("solid", fgColor=PAPER)
fill_card = PatternFill("solid", fgColor=CARD)
fill_in = PatternFill("solid", fgColor="FFFFFF")
fill_ink = PatternFill("solid", fgColor=INK)
fill_yel = PatternFill("solid", fgColor=YEL)
thin = Side(style="thin", color=LINE)
inb = Border(left=Side(style="thin", color=INK), right=Side(style="thin", color=INK),
             top=Side(style="thin", color=INK), bottom=Side(style="thin", color=INK))
lineb = Border(bottom=thin)
MONEY = '#,##0.00;-#,##0.00;"–"'.replace("–", "-")
MONEY0 = '#,##0;-#,##0;"-"'
DATEF = 'ddd d mmm yyyy'

example = len(sys.argv) < 3 or sys.argv[2] != "blank"
wb = Workbook()

def paper(ws, cols=30, rows=60):
    ws.sheet_view.showGridLines = False
    for c in range(1, cols + 1):
        for r in range(1, rows + 1):
            ws.cell(r, c).fill = fill_paper
            ws.cell(r, c).font = f_body

def inp(cell, fmt=None):
    cell.fill = fill_in; cell.border = inb; cell.font = Font(name=F, size=10, color=INK, bold=True)
    if fmt: cell.number_format = fmt

# ---------------------------------------------------------------- Start here
ws = wb.active; ws.title = "Start here"
paper(ws, 12, 45)
ws.column_dimensions["A"].width = 3; ws.column_dimensions["B"].width = 100
ws["B2"] = "paid in yellow · Paycheck Payoff Planner"; ws["B2"].font = f_title
ws["B3"] = "Your debt-free date, and a clear amount to move every payday. One paycheck at a time."; ws["B3"].font = f_sub
lines = [
 ("How it works", True),
 ("1.  Setup: how often you're paid, your next payday, and how much you can put toward the plan each payday.", False),
 ("2.  Debts: one row per debt (up to 50): balance, interest rate, monthly minimum and due day. The due day is on your statement.", False),
 ("3.  This payday: the exact amounts to move this payday, debt by debt. Pay them, then type Paid on that row of the Plan tab.", False),
 ("4.  Progress: your debt-free date, what you've paid off, and the interest you avoid compared with paying only minimums.", False),
 ("", False),
 ("The cells to fill in", True),
 ("White cells with a dark border are yours to type in. Everything else does the math. The example numbers are there to show the format: replace them with yours.", False),
 ("", False),
 ("How the plan pays", True),
 ("Every debt gets its full monthly minimum on the payday before its due date. Your money for the plan fills your yearly bills, then your buffer, then goes to one debt at a time.", False),
 ("When a debt is gone, its minimum keeps going: it joins the extra for the next debt. Balances only move by what you actually pay, plus interest.", False),
 ("", False),
 ("Real life on the Plan tab", True),
 ("Amount +/-: got more or less than usual this payday? Type the difference (for example 50 or -40).", False),
 ("New charge: something new went on a card. It goes on the first debt in your order that still has a balance.", False),
 ("Buffer used: you paid a surprise from your buffer. The plan refills it first.", False),
 ("Yearly bill paid: you paid a yearly bill from what you saved.", False),
 ("Every few months: type the real balances from your statements on the Debts tab, set your next payday on Setup, and clear the old Paid marks. Your plan starts fresh from the truth.", False),
 ("", False),
 ("Good to know", True),
 ("This sheet matches the PaidInYellow app: same inputs, same numbers. It plans up to 520 paydays. Paid paydays turn yellow.", False),
 ("Your numbers stay in your own Google account. Nothing is sent to PaidInYellow.", False),
 ("A planning tool, not financial advice. Figures are estimates based on what you enter. We never suggest loans, balance transfers or new credit.", False),
 ("Help: support@paidinyellow.com", False),
]
r = 5
for t, b in lines:
    c = ws.cell(r, 2, t); c.font = Font(name=F, size=12 if b else 10.5, bold=b, color=INK)
    c.alignment = Alignment(wrap_text=True, vertical="top"); r += 1
ws.cell(r + 1, 2, "one paycheck at a time").font = Font(name="Caveat", size=16, bold=True, color=GRAY)

# ---------------------------------------------------------------- Setup
su = wb.create_sheet("Setup"); paper(su, 8, 45)
su.column_dimensions["A"].width = 3; su.column_dimensions["B"].width = 46; su.column_dimensions["C"].width = 24
su.column_dimensions["D"].width = 16; su.column_dimensions["E"].width = 60
su["B2"] = "Setup"; su["B2"].font = f_title
su["B3"] = "Fill in the white cells. You can change them any time."; su["B3"].font = f_sub
rows = [
 (5, "Currency symbol", "$", None, "Any symbol: $, £, €, MAD..."),
 (7, "How often you're paid", "Every 2 weeks", None, "Every week · Every 2 weeks · Twice a month · Every month"),
 (8, "Your next payday", dt.date(2026, 10, 30), DATEF, "The plan starts on this payday."),
 (9, "Twice a month only: your other pay day", None, "0", "For example 15, or 31 for the last day. Leave empty to use the usual pairing."),
 (11, "Money for the plan each payday (on top of minimums)", 100, MONEY, "Even 20 matters. You can change it any time."),
 (13, "Buffer: set aside now", 300, MONEY, "Money for surprises. Empty is fine."),
 (14, "Buffer goal", 500, MONEY, "A plain separate account or an envelope."),
 (16, "Payoff order", "PaidInYellow order", None, "PaidInYellow order (smallest first, growing debts first) · Biggest interest first · My own order"),
]
for rr, lab, val, fmt, hint in rows:
    su.cell(rr, 2, lab).font = f_bold
    c = su.cell(rr, 3, val if example or rr in (5, 7, 16, 14) else None); inp(c, fmt)
    su.cell(rr, 5, hint).font = Font(name=F, size=9, color=GRAY)
dv1 = DataValidation(type="list", formula1='"Every week,Every 2 weeks,Twice a month,Every month"', allow_blank=False); su.add_data_validation(dv1); dv1.add("C7")
dv2 = DataValidation(type="list", formula1='"PaidInYellow order,Biggest interest first,My own order"', allow_blank=False); su.add_data_validation(dv2); dv2.add("C16")
su["B18"] = "Yearly bills (optional)"; su["B18"].font = Font(name=F, size=12, bold=True, color=INK)
su["B19"] = "Bills that come once a year, saved a little each payday."; su["B19"].font = Font(name=F, size=9, color=GRAY)
for j, h in enumerate(["Bill", "Per year", "Month needed"]):
    c = su.cell(20, 2 + j, h); c.font = f_head
ex_bills = [("Gifts and holidays", 240, "December")] if example else []
for i in range(10):
    rr = 21 + i
    for j in range(3):
        c = su.cell(rr, 2 + j, ex_bills[i][j] if i < len(ex_bills) else None); inp(c, MONEY if j == 1 else None)
su["B32"] = "Total per year"; su["B32"].font = f_bold
su["C32"] = "=SUM(C21:C30)"; su["C32"].number_format = MONEY
# derived (used by the formulas)
su["B35"] = "Worked out for you"; su["B35"].font = Font(name=F, size=12, bold=True, color=INK)
der = [
 (36, "Paydays per year", '=IF(C7="Every week",52,IF(C7="Every 2 weeks",26,IF(C7="Twice a month",24,12)))', "0"),
 (37, "Yearly bills per payday", "=C32/C36", MONEY),
 (38, "Other pay day used", '=IF(C9>0,C9,IF(DAY(C8)<=15,DAY(C8)+15,IF(DAY(C8)=DAY(EOMONTH(C8,0)),15,DAY(C8)-15)))', "0"),
 (39, "First pay day of the month", "=MIN(DAY(C8),C38)", "0"),
 (40, "Second pay day of the month", "=MAX(DAY(C8),C38)", "0"),
 (41, "Plan starts on the second one", "=IF(DAY(C8)=C39,0,1)", "0"),
]
for rr, lab, fml, fmt in der:
    su.cell(rr, 2, lab).font = Font(name=F, size=9, color=GRAY)
    c = su.cell(rr, 3, fml); c.number_format = fmt; c.font = Font(name=F, size=9, color=GRAY)

# ---------------------------------------------------------------- Debts
de = wb.create_sheet("Debts"); paper(de, 16, 60)
widths = {"A": 4, "B": 24, "C": 14, "D": 13, "E": 10, "F": 13, "G": 9, "H": 9, "I": 9, "J": 14, "K": 8, "L": 16, "M": 9, "N": 14, "O": 14}
for k, v in widths.items(): de.column_dimensions[k].width = v
de["B2"] = "Debts"; de["B2"].font = f_title
de["B3"] = "One row per debt. Balance, rate and minimum are on your statement. Due day is the day of the month it's due."; de["B3"].font = f_sub
hdr = ["#", "Name", "Type", "Balance", "Rate %", "Monthly minimum", "Due day", "My order", "Grows?", "Sort key", "Order", "Gone by", "Status", "Minimums only: months", "Minimums only: interest"]
for j, h in enumerate(hdr):
    c = de.cell(5, 1 + j, h); c.font = f_head; c.alignment = Alignment(wrap_text=True, vertical="bottom")
de.row_dimensions[5].height = 30
ex_debts = [("Card A", "Credit card", 500, 24, 25, 10), ("Card B", "Credit card", 1200, 18, 40, 20)] if example else []
D0, DN = 6, 6 + ND - 1
for i in range(ND):
    rr = D0 + i
    de.cell(rr, 1, i + 1).font = Font(name=F, size=9, color=GRAY)
    vals = ex_debts[i] if i < len(ex_debts) else (None,) * 6
    for j, v in enumerate(vals):
        c = de.cell(rr, 2 + j, v); inp(c, [None, None, MONEY, "0.00", MONEY, "0"][j])
    inp(de.cell(rr, 8), "0")
    de.cell(rr, 9, f'=IF(AND(D{rr}>0,E{rr}>0,F{rr}<=D{rr}*E{rr}/1200),"Grows","")')
    de.cell(rr, 10, (f'=IF(N(D{rr})<=0,5E+15,IF(Setup!$C$16="Biggest interest first",ROUND((100-E{rr})*1000,0)*1E+10+ROUND(D{rr}*100,0),'
                     f'IF(Setup!$C$16="My own order",IF(H{rr}>0,H{rr},999),IF(I{rr}="Grows",ROUND((100-E{rr})*1000,0),1E+6+ROUND(D{rr}*100,0)))))'))
    de.cell(rr, 11, f'=COUNTIF($J${D0}:$J${DN},"<"&J{rr})+COUNTIFS($J${D0}:$J${DN},J{rr},$A${D0}:$A${DN},"<"&A{rr})+1')
    # gone by: first payday on which this debt's balance (its position column in the Plan) is zero
    de.cell(rr, 12, f'=IF(N(D{rr})<=0,"",IFERROR(INDEX(Plan!$B${R1}:$B${RN},COUNTIF(INDEX(BalBlock,0,K{rr}),">0.005")+1),"More than 20 years"))')
    de.cell(rr, 12).number_format = 'd mmm yyyy'
    de.cell(rr, 13, f'=IF(N(D{rr})<=0,"",IF(INDEX(BalNow,1,K{rr})<0.005,"PAID",""))')
    de.cell(rr, 14, f'=IF(N(D{rr})<=0,"",IF(N(F{rr})<=0,"Never ends",IF(AND(E{rr}>0,F{rr}<=D{rr}*E{rr}/1200),"Never ends",IF(N(E{rr})=0,D{rr}/F{rr},NPER(E{rr}/1200,-F{rr},D{rr})))))')
    de.cell(rr, 14).number_format = "0.0"
    de.cell(rr, 15, f'=IF(ISNUMBER(N{rr}),F{rr}*N{rr}-D{rr},"")'); de.cell(rr, 15).number_format = MONEY
    for cc in (9, 10, 11, 12, 13, 14, 15): de.cell(rr, cc).font = f_body
    de.cell(rr, 10).font = Font(name=F, size=8, color=GRAY)
de.cell(DN + 2, 2, "Total").font = f_bold
de.cell(DN + 2, 4, f"=SUM(D{D0}:D{DN})").number_format = MONEY
de.cell(DN + 2, 6, f"=SUM(F{D0}:F{DN})").number_format = MONEY
de.column_dimensions["J"].hidden = True
de.conditional_formatting.add(f"B{D0}:O{DN}", FormulaRule(formula=[f'$M{D0}="PAID"'], fill=fill_yel))
de.freeze_panes = "C6"

# ---------------------------------------------------------------- Helpers (payoff positions)
he = wb.create_sheet("Helpers")
for j, h in enumerate(["Position", "Debt row", "Name", "Rate (fraction)", "Monthly minimum", "Due day", "Start balance"]):
    he.cell(1, 1 + j, h).font = f_head
for p in range(1, ND + 1):
    rr = p + 1
    he.cell(rr, 1, p)
    he.cell(rr, 2, f"=MATCH(A{rr},Debts!$K${D0}:$K${DN},0)")
    he.cell(rr, 3, f'=IF(N(INDEX(Debts!$D${D0}:$D${DN},B{rr}))>0,INDEX(Debts!$B${D0}:$B${DN},B{rr})&"","")')
    he.cell(rr, 4, f"=N(INDEX(Debts!$E${D0}:$E${DN},B{rr}))/100")
    he.cell(rr, 5, f"=IF(N(INDEX(Debts!$D${D0}:$D${DN},B{rr}))>0,N(INDEX(Debts!$F${D0}:$F${DN},B{rr})),0)")
    he.cell(rr, 6, f'=IF(N(INDEX(Debts!$G${D0}:$G${DN},B{rr}))>0,INDEX(Debts!$G${D0}:$G${DN},B{rr}),"")')
    he.cell(rr, 7, f"=MAX(N(INDEX(Debts!$D${D0}:$D${DN},B{rr})),0)")
he.sheet_state = "hidden"

# ---------------------------------------------------------------- Plan
pl = wb.create_sheet("Plan")
pl.sheet_view.showGridLines = False
fixed = ["Payday #", "Payday", "Next payday", "Paid?", "Amount +/-", "New charge", "Buffer used", "Yearly bill paid",
         "Money for the plan", "To yearly bills", "To buffer", "Buffer after", "Yearly bills saved",
         "Bills this payday", "Freed-up minimums", "Extra for debts", "Extra paid", "Move this payday",
         "Interest", "Still owed", "Focus debt", "Charge goes to #", "Open", "Minimums only: owed"]
NF = len(fixed)                       # 24 fixed columns, A..X
B_DUE = NF + 2                        # block start columns (one spacer)
B_BILL = B_DUE + ND
B_EXT = B_BILL + ND
B_BAL = B_EXT + ND
LAST = B_BAL + ND - 1
col = {n: L(i + 1) for i, n in enumerate(fixed)}
pl["A1"] = "Plan · payday by payday"; pl["A1"].font = f_title
pl["A2"] = "Type Paid on a row when you've done that payday. The row turns yellow. White columns E to H are for real life."; pl["A2"].font = f_sub
for j, h in enumerate(fixed):
    c = pl.cell(7, 1 + j, h); c.font = f_head; c.alignment = Alignment(wrap_text=True, vertical="bottom")
pl.row_dimensions[7].height = 42
blocks = [(B_DUE, "Minimum due"), (B_BILL, "Bill paid"), (B_EXT, "Extra paid"), (B_BAL, "Balance after")]
for start, lab in blocks:
    pl.cell(3, start, lab + " · by debt, in payoff order").font = f_bold
    for p in range(1, ND + 1):
        c = start + p - 1; cl = L(c)
        pl.cell(4, c, f"=Helpers!$C${p+1}").font = f_head
        pl.cell(7, c, f"=IF(Helpers!$C${p+1}=\"\",\"#{p}\",Helpers!$C${p+1})").font = f_head
        if start == B_DUE:
            pl.cell(5, c, f"=Helpers!$E${p+1}"); pl.cell(6, c, f"=Helpers!$F${p+1}")
        if start == B_BAL:
            pl.cell(5, c, f"=Helpers!$D${p+1}")
        if start in (B_BAL, B_EXT):
            pl.cell(6, c, p)
        for rr in (4, 5, 6): pl.cell(rr, c).font = Font(name=F, size=8, color=GRAY)
pl.cell(5, B_DUE - 1, "min / due").font = Font(name=F, size=8, color=GRAY)

ppy = "Setup!$C$36"
for i in range(NR + 1):
    rr = R0 + i
    if i == 0:
        pl.cell(rr, 1, "Start"); pl.cell(rr, 2, "=Setup!$C$8")
        pl.cell(rr, 12, "=N(Setup!$C$13)"); pl.cell(rr, 13, 0)
        for p in range(ND):
            pl.cell(rr, B_BAL + p, f"=Helpers!$G${p+2}")
        pl.cell(rr, 20, f"=SUM({L(B_BAL)}{rr}:{L(LAST)}{rr})")
        pl.cell(rr, 24, f"=T{rr}")
        for cc in range(1, LAST + 1): pl.cell(rr, cc).font = Font(name=F, size=9, color=GRAY)
        continue
    t = i - 1
    pr = rr - 1
    pl.cell(rr, 1, t + 1)
    def dfor(k):
        return (f'IF(Setup!$C$7="Every month",EDATE(Setup!$C$8,{k}),IF(Setup!$C$7="Twice a month",'
                f'DATE(YEAR(Setup!$C$8),MONTH(Setup!$C$8)+INT(({k}+Setup!$C$41)/2),MIN(IF(MOD({k}+Setup!$C$41,2)=0,Setup!$C$39,Setup!$C$40),'
                f'DAY(EOMONTH(DATE(YEAR(Setup!$C$8),MONTH(Setup!$C$8)+INT(({k}+Setup!$C$41)/2),1),0)))),'
                f'Setup!$C$8+{k}*IF(Setup!$C$7="Every week",7,14)))')
    pl.cell(rr, 2, "=" + dfor(f"($A{rr}-1)"))
    pl.cell(rr, 3, "=" + dfor(f"$A{rr}"))
    for cc in (4, 5, 6, 7, 8): inp(pl.cell(rr, cc), MONEY if cc > 4 else None); pl.cell(rr, cc).font = f_body
    pl.cell(rr, 9, f"=N(Setup!$C$11)+N(E{rr})")
    pl.cell(rr, 10, f"=MIN(Setup!$C$37,MAX(I{rr},0))")
    pl.cell(rr, 11, f"=MIN(MAX(N(Setup!$C$14)-L{pr},0),MAX(I{rr}-J{rr},0))")
    pl.cell(rr, 12, f"=L{pr}+K{rr}-N(G{rr})")
    pl.cell(rr, 13, f"=M{pr}+J{rr}-N(H{rr})")
    pl.cell(rr, 14, f"=SUM({L(B_BILL)}{rr}:{L(B_BILL+ND-1)}{rr})")
    pl.cell(rr, 15, f"=SUM({L(B_DUE)}{rr}:{L(B_DUE+ND-1)}{rr})-N{rr}")
    pl.cell(rr, 16, f"=MAX(I{rr}-J{rr}-K{rr},0)+O{rr}")
    pl.cell(rr, 17, f"=SUM({L(B_EXT)}{rr}:{L(B_EXT+ND-1)}{rr})")
    pl.cell(rr, 18, f"=N{rr}+J{rr}+K{rr}+Q{rr}")
    pl.cell(rr, 19, f"=T{rr}-T{pr}-N(F{rr})+N{rr}+Q{rr}")
    pl.cell(rr, 20, f"=SUM({L(B_BAL)}{rr}:{L(LAST)}{rr})")
    fe = f'_xlfn.MINIFS(${L(B_EXT)}$6:${L(B_EXT+ND-1)}$6,{L(B_EXT)}{rr}:{L(B_EXT+ND-1)}{rr},">0.005")'
    fb = f'_xlfn.MINIFS(${L(B_BAL)}$6:${L(LAST)}$6,{L(B_BAL)}{pr}:{L(LAST)}{pr},">0.005")'
    pl.cell(rr, 21, f'=IF(T{pr}<0.005,"",INDEX(Helpers!$C$2:$C${ND+1},IF({fe}=0,V{rr},{fe})))')
    pl.cell(rr, 22, f"=IF({fb}=0,1,{fb})")
    pl.cell(rr, 23, f'=IF(AND(D{rr}<>"Paid",T{pr}>0.005),1,0)')
    n = f"(($B{rr}-Setup!$C$8)/(365.25/12))"
    x = f"(Helpers!$G$2:$G${ND+1}*(1+(Helpers!$D$2:$D${ND+1}+1E-9)/12)^{n}-Helpers!$E$2:$E${ND+1}*((1+(Helpers!$D$2:$D${ND+1}+1E-9)/12)^{n}-1)/((Helpers!$D$2:$D${ND+1}+1E-9)/12))"
    pl.cell(rr, 24, f"=SUMPRODUCT(({x}>0)*{x})")
    for p in range(ND):
        cdue, cbill, cext, cbal = L(B_DUE + p), L(B_BILL + p), L(B_EXT + p), L(B_BAL + p)
        dd, mn = f"{cdue}$6", f"{cdue}$5"
        d1 = f"DATE(YEAR($B{rr}),MONTH($B{rr}),MIN({dd},DAY(EOMONTH($B{rr},0))))"
        d2 = f"DATE(YEAR($B{rr}),MONTH($B{rr})+1,MIN({dd},DAY(EOMONTH($B{rr},1))))"
        pl.cell(rr, B_DUE + p, f'=IF(OR(N({mn})=0,{dd}=""),0,{mn}*(({d1}>=$B{rr})*({d1}<$C{rr})+({d2}>=$B{rr})*({d2}<$C{rr})))')
        pre = f"({cbal}{pr}*(1+{cbal}$5/{ppy})+IF($V{rr}={p+1},N($F{rr}),0))"
        pl.cell(rr, B_BILL + p, f"=MIN({cdue}{rr},{pre})")
        used = "0" if p == 0 else f"SUM({L(B_EXT)}{rr}:{L(B_EXT+p-1)}{rr})"
        pl.cell(rr, B_EXT + p, f"=MIN(MAX({pre}-{cbill}{rr},0),MAX($P{rr}-{used},0))")
        pl.cell(rr, B_BAL + p, f"=IF({pre}-{cbill}{rr}-{cext}{rr}<0.005,0,{pre}-{cbill}{rr}-{cext}{rr})")
    for cc in range(1, LAST + 1):
        c = pl.cell(rr, cc)
        if cc not in (4, 5, 6, 7, 8): c.font = f_body
        if cc in (2, 3): c.number_format = 'ddd d mmm yy'
        elif cc >= 9 and cc != 21 and cc != 22 and cc != 23: c.number_format = MONEY
dvp = DataValidation(type="list", formula1='"Paid"', allow_blank=True); pl.add_data_validation(dvp); dvp.add(f"D{R1}:D{RN}")
pl.conditional_formatting.add(f"A{R1}:X{RN}", FormulaRule(formula=[f'$D{R1}="Paid"'], fill=fill_yel))
widths = [8, 15, 15, 8, 11, 11, 11, 11, 11, 11, 11, 11, 11, 12, 12, 12, 12, 13, 11, 12, 16, 8, 6, 13]
for j, w in enumerate(widths): pl.column_dimensions[L(j + 1)].width = w
for c in range(B_DUE, LAST + 1): pl.column_dimensions[L(c)].width = 11
for c in (22, 23, 24): pl.column_dimensions[L(c)].hidden = True
for c in range(B_DUE, B_DUE + ND): pl.column_dimensions[L(c)].hidden = True
pl.column_dimensions.group(L(B_DUE), L(B_DUE + ND - 1), hidden=True, outline_level=1)
pl.freeze_panes = f"D{R1}"
for c in (18, 20):
    for rr in range(R1, RN + 1): pl.cell(rr, c).font = f_bold

# named ranges for the Debts tab
from openpyxl.workbook.defined_name import DefinedName
def name(n, ref):
    dn = DefinedName(n, attr_text=ref)
    try: wb.defined_names[n] = dn
    except TypeError: wb.defined_names.append(dn)
name("BalBlock", f"Plan!${L(B_BAL)}${R1}:${L(LAST)}${RN}")
name("BalNow", f"'This payday'!$C$60:$AZ$60")

# ---------------------------------------------------------------- This payday
tp = wb.create_sheet("This payday", 1); paper(tp, 60, 70)
tp.column_dimensions["A"].width = 3; tp.column_dimensions["B"].width = 30
for c in "CDEF": tp.column_dimensions[c].width = 16
tp["B2"] = "This payday"; tp["B2"].font = f_title
tp["H1"] = "row"; tp["H1"].font = Font(name=F, size=8, color=GRAY)
tp["I1"] = f'=IFERROR(MATCH(1,Plan!$W${R1}:$W${RN},0),0)'          # position of the open payday (1-based in R1:RN)
tp["I2"] = f'=IF(I1=0,0,INDEX(Plan!$A${R1}:$A${RN},I1))'
cur = 'Setup!$C$5'
def at(colletter):  # value of a Plan column on the open payday row
    return f'INDEX(Plan!${colletter}${R1}:${colletter}${RN},$I$1)'
tp["B3"] = (f'=IF($I$1=0,IF(Plan!$T${RN}<0.005,"You\'re debt-free. Keep your buffer and yearly bills going.","All planned paydays are marked Paid."),'
            f'"Payday "&TEXT({at("B")},"ddd d mmm yyyy"))')
tp["B3"].font = f_sub
tp["B5"] = "MOVE"; tp["B5"].font = f_head
tp["B6"] = f'=IF($I$1=0,"",{cur}&TEXT({at("R")},"#,##0"))'; tp["B6"].font = Font(name=F, size=36, bold=True, color=INK)
tp["B8"] = (f'=IF($I$1=0,"",IF({at("Q")}>0.005,"The extra "&{cur}&TEXT({at("Q")},"#,##0")&" goes to "&{at("U")}&".",'
            f'IF({at("K")}>0.005,"Your buffer fills first. Extra for your debts starts once it reaches "&{cur}&TEXT(Setup!$C$14,"#,##0")&".","")))')
tp["B8"].font = Font(name=F, size=12, color=INK)
for j, h in enumerate(["What", "Bill", "Extra", "Due", "Total"]):
    c = tp.cell(10, 2 + j, h); c.font = f_head; c.border = lineb
# helper rows 60..65: per position values on the open payday (hidden area)
tp["B59"] = "helpers"; tp["B59"].font = Font(name=F, size=8, color=GRAY)
for p in range(ND):
    c = 3 + p; cl = L(c)
    def blk(start):
        return f'IF($I$1=0,0,INDEX(Plan!${L(start+p)}${R1}:${L(start+p)}${RN},$I$1))'
    tp.cell(60, c, f'=IF($I$1=0,INDEX(Plan!${L(B_BAL+p)}${R1}:${L(B_BAL+p)}${RN},{NR}),IF($I$1=1,Plan!{L(B_BAL+p)}${R0},INDEX(Plan!${L(B_BAL+p)}${R1}:${L(B_BAL+p)}${RN},$I$1-1)))')  # balance now
    tp.cell(61, c, "=" + blk(B_BILL))
    tp.cell(62, c, "=" + blk(B_EXT))
    tp.cell(63, c, f"=IF({cl}61+{cl}62>0.005,1,0)")
    tp.cell(64, c, f"={cl}63" if p == 0 else f"={L(c-1)}64+{cl}63")
    dd = f"Helpers!$F${p+2}"
    B_ = at("B"); C_ = at("C")
    d1 = f"DATE(YEAR({B_}),MONTH({B_}),MIN({dd},DAY(EOMONTH({B_},0))))"
    d2 = f"DATE(YEAR({B_}),MONTH({B_})+1,MIN({dd},DAY(EOMONTH({B_},1))))"
    tp.cell(66, c, f"=Helpers!$D${p+2}")
    tp.cell(65, c, f'=IF(OR($I$1=0,{dd}=""),"",IF(AND({d1}>={B_},{d1}<{C_}),{d1},IF(AND({d2}>={B_},{d2}<{C_}),{d2},"")))')
    for rr in range(60, 66): tp.cell(rr, c).font = Font(name=F, size=8, color=GRAY)
H1, HN = L(3), L(3 + ND - 1)
for j in range(16):
    rr = 11 + j; k = j + 1
    m = f'MATCH({k},$C$64:${HN}$64,0)'
    tp.cell(rr, 2, f'=IFERROR(INDEX(Helpers!$C$2:$C${ND+1},{m}),"")')
    tp.cell(rr, 3, f'=IFERROR(INDEX($C$61:${HN}$61,{m}),"")')
    tp.cell(rr, 4, f'=IFERROR(INDEX($C$62:${HN}$62,{m}),"")')
    tp.cell(rr, 5, f'=IFERROR(INDEX($C$65:${HN}$65,{m}),"")')
    tp.cell(rr, 6, f'=IF(B{rr}="","",N(C{rr})+N(D{rr}))')
    for cc in (3, 4, 6): tp.cell(rr, cc).number_format = MONEY
    tp.cell(rr, 5).number_format = "ddd d mmm"
    for cc in range(2, 7): tp.cell(rr, cc).border = lineb
tp["B27"] = "Yearly bills pot"; tp["F27"] = f'=IF($I$1=0,"",{at("J")})'
tp["B28"] = "Buffer"; tp["F28"] = f'=IF($I$1=0,"",{at("K")})'
tp["B29"] = "Total to move"; tp["F29"] = f'=IF($I$1=0,"",{at("R")})'
for rr in (27, 28, 29):
    tp.cell(rr, 6).number_format = MONEY; tp.cell(rr, 2).border = lineb; tp.cell(rr, 6).border = lineb
tp["B29"].font = f_bold; tp["F29"].font = f_bold
tp["B31"] = f'=IF($I$1=0,"","When it\'s done, type Paid in column D of the Plan tab, on payday #"&$I$2&". The next payday then shows here.")'
tp["B31"].font = Font(name=F, size=10, color=GRAY)
tp["B33"] = "one paycheck at a time"; tp["B33"].font = Font(name="Caveat", size=16, bold=True, color=GRAY)
for rr in range(59, 67): tp.row_dimensions[rr].hidden = True

# ---------------------------------------------------------------- Progress
pg = wb.create_sheet("Progress", 2); paper(pg, 14, 70)
pg.column_dimensions["A"].width = 3; pg.column_dimensions["B"].width = 40; pg.column_dimensions["C"].width = 22; pg.column_dimensions["D"].width = 50
pg["B2"] = "Progress"; pg["B2"].font = f_title
cnt = f'COUNTIF(Plan!$T${R1}:$T${RN},">0.005")'
items = [
 (4, "Debt-free by", f'=IF({cnt}>={NR},"More than 20 years",INDEX(Plan!$B${R1}:$B${RN},{cnt}+1))', 'mmmm yyyy', "Your plan, from your next payday."),
 (5, "Paydays left", f'=IF({cnt}>={NR},"",MAX({cnt}+1-MAX(\'This payday\'!$I$1-1,0),0))', "0", ""),
 (7, "Owed at the start", f"=Plan!$T${R0}", MONEY, ""),
 (8, "Still owed now", f"=SUMPRODUCT('This payday'!$C$60:${HN}$60*1)", MONEY, "After the paydays you marked Paid."),
 (9, "Paid off so far", "=MAX(C7-C8,0)", MONEY, ""),
 (10, "Gone", "=IF(C7>0,C9/C7,0)", "0%", ""),
 (12, "Interest on your plan", f"=SUM(Plan!$S${R1}:$S${RN})", MONEY, "From your next payday to debt-free."),
 (13, "Interest paying only minimums", f'=IF(COUNTIF(Debts!$N${D0}:$N${DN},"Never ends")>0,"Never ends",SUM(Debts!$O${D0}:$O${DN}))', MONEY, "Each debt on its own minimum."),
 (14, "Interest you avoid", '=IF(ISNUMBER(C13),MAX(C13-C12,0),"All of it: on minimums one debt never ends")', MONEY, ""),
 (15, "Months sooner than minimums", f'=IF(ISNUMBER(C13),MAX(ROUND(MAX(Debts!$N${D0}:$N${DN})-IF(ISNUMBER(C4),(C4-Setup!$C$8)/(365.25/12),0),0),0),"")', "0", ""),
 (17, "Your debt costs you, per day", f"=SUMPRODUCT('This payday'!$C$60:${HN}$60,'This payday'!$C$66:${HN}$66)/365", MONEY, "Interest at today's balances. It drops as balances go down."),
]
for rr, lab, fml, fmt, hint in items:
    pg.cell(rr, 2, lab).font = f_bold
    c = pg.cell(rr, 3, fml); c.number_format = fmt; c.font = Font(name=F, size=12, bold=True, color=INK)
    pg.cell(rr, 4, hint).font = Font(name=F, size=9, color=GRAY)
pg["C4"].fill = fill_yel; pg["C4"].font = Font(name=F, size=16, bold=True, color=INK)
pg["B19"] = "Balance over time: your plan and paying only minimums"; pg["B19"].font = f_bold
ch = LineChart(); ch.height = 9; ch.width = 22; ch.y_axis.title = None; ch.x_axis.title = None
ch.y_axis.number_format = "#,##0"; ch.x_axis.number_format = "mmm yy"
NCH = 260
d1r = Reference(pl, min_col=20, min_row=R1, max_row=R0 + NCH)
d2r = Reference(pl, min_col=24, min_row=R1, max_row=R0 + NCH)
ch.add_data(d1r, titles_from_data=False); ch.add_data(d2r, titles_from_data=False)
ch.set_categories(Reference(pl, min_col=2, min_row=R1, max_row=R0 + NCH))
from openpyxl.chart.series import SeriesLabel
ch.series[0].tx = SeriesLabel(v="Your plan"); ch.series[1].tx = SeriesLabel(v="Minimums only")
ch.series[0].graphicalProperties.line.solidFill = INK; ch.series[0].graphicalProperties.line.width = 28000
ch.series[1].graphicalProperties.line.solidFill = "8A8780"; ch.series[1].graphicalProperties.line.dashStyle = "dash"
pg.add_chart(ch, "B20")
pg["B40"] = "A planning tool, not financial advice. Figures are estimates based on what you enter."; pg["B40"].font = Font(name=F, size=9, color=GRAY)

wb._sheets = [wb[n] for n in ["Start here", "Setup", "Debts", "This payday", "Plan", "Progress", "Helpers"]]
wb.active = 0
wb.save(sys.argv[1])
print("saved", sys.argv[1], wb.sheetnames)
