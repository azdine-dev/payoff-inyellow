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
S_ORDER = "D47"   # after the yearly bills
Y0 = 38          # first yearly bill row; columns: C name, D amount, E month
YN = Y0 + NY - 1
S_SHOW = "D48"   # Show where to type

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
# what the plan asks for on a payday before any Actual is typed, and whether the Actual is below the bills
C_AVAIL0, C_Y0, C_B0, C_MOVE0, C_SHORT = C_LAST + 1, C_LAST + 2, C_LAST + 3, C_LAST + 4, C_LAST + 5

# ---- Engine: one answer per cell, read by the tabs (column S, labels in R)
E_NPAY = "S1"        # the payday the plan ends on (count)
E_FITS = "S2"        # 1 when the plan ends inside the sheet
E_HASPLAN = "S3"     # 1 when there is a debt and a next payday
E_FREE = "S4"        # debt-free date
E_FIRSTMOVE = "S5"
E_MINMONTHS = "S6"   # minimums only: months, or "never"
E_MINDATE = "S7"
E_SOONER = "S8"      # months sooner than minimums only
E_INTEREST = "S9"    # interest on the plan
E_MININTEREST = "S10"
E_AVOIDED = "S11"
E_STARTOWED = "S13"
E_CUR = "S14"        # currency symbol
C_NPER, C_NPERINT = 16, 17   # per debt in payoff order (rows EO0..): months and interest on minimums only

# ---- Start: the result box and the notes
S_DATECHECK = "C11"
S_R_LINE1, S_R_DATE, S_R_STEP, S_R_MIN, S_R_SOONER = "C51", "C52", "C53", "C54", "C55"
S_MONEYNOTE = "E32"
S_NOTE_COL = 9       # column I: a calm note next to a debt row

# ---- the only places yellow may show (by conditional formatting): paid, done, or the one key word
YELLOW_OK = {("Start", S_R_DATE)}

# ---- Engine: where the plan stands (ticks on Path), and what Today shows
E_TODAY_TEST = "B12"  # tests type a date here; empty means the real today
E_CURK = "S15"        # the first payday not ticked (1 = the next payday on Start)
E_TODAY = "S16"
E_PAIDMODE = "S17"    # 1 when the payday before is ticked and the next one has not come yet
E_VIEW = "S18"        # the payday Today shows
E_ALLDONE = "S19"     # 1 when every payday of the plan is ticked
E_LATE, E_VIEWDATE, E_NEXTDATE, E_VIEWMOVE, E_NITEMS, E_FOCUSPOS = "U1", "U2", "U3", "U4", "U5", "U6"
E_OWEDNOW, E_PAIDSOFAR, E_DEBTSPAID, E_NDEBTS, E_NEXTGONEPOS = "U7", "U8", "U9", "U10", "U11"
NI = ND + 3           # what a payday can list: a bill per debt, yearly bills, the buffer, the extra
ROW_ILABEL, ROW_IAMOUNT, ROW_ICOUNT, ROW_INOTE, ROW_LEFT, ROW_GONE, ROW_XTRA = 13, 14, 15, 16, 17, 18, 19  # over the C_BAL columns

# ---- Path
P_R0 = 16             # header of the payday list
P_R1 = 17             # payday 1
P_RN = P_R1 + NR - 1
P_ACTUAL_COL = 8      # column H: what was really paid (empty means as planned)
P_DONE_COL = 9        # column I: the tick

# ---- Today
T_FLAG = "H3"         # 1 when the card is yellow (paid, or all done)
T_LABEL, T_MAIN, T_SUB = "C6", "C7", "C8"
T_L0 = 12             # first line of the payday (label C, amount D, note E)
T_FOCUS_NAME, T_FOCUS_LEFT, T_FOCUS_GONE = "G7", "G8", "G9"   # a second card, beside the main one
T_LATE = "C31"
YELLOW_OK |= {("Today", "B6:E9")}

# ---- Path: tiles, the bar, the next milestone, the list, the chart
E_NEXTGONE = "U12"    # the date the next debt is gone
E_PCT = "U13"         # share of the starting debt that is gone, 0 to 1
NC = 19               # points of the chart (Engine columns W label, X owed, rows 1..NC)
P_CURK, P_SHOW = "Q3", "Q2"   # quiet helpers on Path: the current payday, and the Show where to type tick
P_TILE_OWED, P_TILE_FREE, P_TILE_PAID, P_TILE_AVOID = "B7", "D7", "F7", "H7"
P_FREE_CELLS = "D7:E7"   # the debt-free date, merged over two columns
P_PCT, P_DEBTSPAID = "N11", "N12"   # beside the doughnut
P_NEXT, P_NOFIT, P_SHORT = "B11", "B12", "B13"
E_RING_COL = 25       # Engine column Y, rows 1 to 3: gone, left, all gone
E_TICKED = "U18"      # paydays of the plan that are ticked
YELLOW_OK |= {("Path", P_FREE_CELLS), ("Path", f"B{P_R1}:I{P_RN}")}

# ---- Debts and Safety net
E_BUFNOW, E_YSAVED = "U14", "U15"   # the buffer and the yearly bills money after the last ticked payday
E_SHORTK = "U16"      # the first payday whose Actual is below its bills (0 = none)
E_VIEWACTUAL = "U17"  # 1 when the payday Today shows has an Actual typed
DB_R0 = 8             # first debt row on Debts (in payoff order)
DB_PCT_COL = 18       # column R: the share paid, a quiet helper
DB_PAIDTOTAL = "F6"   # paid off so far, the same number as the Path tile
SN_BUF, SN_BAR, SN_READY = "B7", "B8", "B9"
SN_Y0 = 15            # first yearly bill row on Safety net
SN_EMPTY = "B24"
YELLOW_OK |= {("Debts", f"B{DB_R0}:T{DB_R0 + ND - 1}"), ("Safety net", SN_READY)}

# quiet helpers on the visible tabs, read by the colour rules only
HELPERS = {("Today", T_FLAG), ("Path", P_CURK), ("Path", P_SHOW)}

# ---- the workbook
TABS = ["Open me", "Start", "Today", "Path", "Debts", "Safety net"]   # in this order; Engine and Lists are hidden
VERSION = "1.0"
VERSION_DATE = "November 2026"
SUPPORT_EMAIL = "[SUPPORT EMAIL]"   # to fill in before the file is sold
P_PRINT_ROWS = 60     # Path prints its tiles and the first 60 paydays, one page wide
