"""Where things live in the workbook. The builder and the tests both read these, so a moved cell moves in one place."""

ND = 15          # debts
NY = 8           # yearly bills
NR = 360         # paydays the sheet can hold (the engine allows 520; a longer plan shows a calm note)

# ---- Start (all typing happens here)
S_CUR = "D7"     # currency symbol
S_FREQ = "D8"    # pay schedule
S_NEXT = "D9"    # next payday
S_OTHER = "D10"  # twice a month only: the other pay day
D0 = 15          # first debt row; columns: B #, C name, D balance, E interest %, F minimum, G due day, H my order, I note
DN = D0 + ND - 1
S_MONEY = "D32"
S_BUF = "D33"
S_GOAL = "D34"
S_ORDER = "D35"
Y0 = 38          # first yearly bill row; columns: C name, D amount, E month
YN = Y0 + NY - 1
S_SHOW = "D47"   # Show where to type

FREQ = {"weekly": "Every week", "biweekly": "Every 2 weeks", "twice": "Twice a month", "monthly": "Every month"}
METHOD = {"piy": "PaidInYellow order", "avalanche": "Biggest interest first", "custom": "My own order"}
TICK = "✓"

# ---- Engine (hidden)
E_PPY, E_YPP, E_OTHER, E_DAY_A, E_DAY_B, E_HALF = "B1", "B2", "B3", "B4", "B5", "B6"
E_MONEY, E_BUF, E_GOAL, E_P0 = "B7", "B8", "B9", "B10"
EB0 = 4          # debts as typed: rows EB0 .. EB0+ND-1, columns D idx, E valid, F grows, G key, H rank
EO0 = 4          # debts in payoff order: same rows, columns J src, K name, L rate, M minimum, N due, O start balance
ER_HEAD = 24     # sim header row
ER_START = 25    # the state before the first payday
ER1 = 26         # payday 1
ERN = ER1 + NR - 1
# sim columns
C_K, C_DATE, C_ADJ, C_CHG, C_BUFUSED, C_AVAIL, C_YEARLY, C_TOBUF, C_BUFAFTER = 1, 2, 3, 4, 5, 6, 7, 8, 9
C_BILLS, C_ROLL, C_POOL, C_EXTRA, C_MOVE, C_INT, C_OWED, C_CHGPOS = 10, 11, 12, 13, 14, 15, 16, 17
C_DUE = 18               # 15 columns: minimum due this payday, by debt in payoff order
C_AFT = C_DUE + ND       # balance after interest and the bill
C_BAL = C_AFT + ND       # balance after the extra
C_LAST = C_BAL + ND - 1
