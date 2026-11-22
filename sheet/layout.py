"""Where things live in the workbook. The builder and the tests both read these, so a moved cell moves in one place."""
from openpyxl.utils import get_column_letter as _L

ND = 15          # debts
NY = 8           # yearly bills
NR = 360         # paydays the sheet can hold (the engine allows 520; a longer plan shows a calm note)

# ---- the grid every visible tab shares
# 12 columns with gutters, about 1,200 pixels in all. Each grid column is 6 narrow cells and a gutter is one, all
# of the same width, so a bar of 20 cells fills exactly a card of 3 columns with even cells, and a card of n
# columns is 6n + (n - 1) cells wide.
SUB, SUB_W, GUT_W, MARGIN_W = 6, 2, 2, 3
NCOL = 1 + 12 * SUB + 11 + 1          # margin, the grid, margin: 85 columns
HELP_COL = NCOL + 1                   # column CH, hidden: quiet helpers that the colour rules read
BAR = 20                              # cells in a bar


def gcol(g: int) -> int:
    """The first cell of grid column g (1 to 12)"""
    return 2 + (g - 1) * (SUB + 1)


def gend(g: int) -> int:
    """The last cell of grid column g"""
    return gcol(g) + SUB - 1


def ref(row: int, col: int) -> str:
    return f"{_L(col)}{row}"


def helper(row: int) -> str:
    return ref(row, HELP_COL)


# the rows every tab shares
BAND_ROWS = 4         # the calm band: title in row 2, the purpose line in row 3
TOP = 6               # the first row of cards

FREQ = {"weekly": "Every week", "biweekly": "Every 2 weeks", "twice": "Twice a month", "monthly": "Every month"}
METHOD = {"piy": "PaidInYellow order", "avalanche": "Biggest interest first", "custom": "My own order"}
TICK = "✓"

# ---- Start (all typing happens here). Steps on the left (grid 1 to 8), the result and the options on the right.
S_LABEL, S_INPUT, S_HELP = 3, 20, 35          # a field row: label, the typed cell, a gray hint
S_INPUT_END = 33
S_CUR, S_FREQ, S_NEXT, S_OTHER = ref(8, S_INPUT), ref(9, S_INPUT), ref(10, S_INPUT), ref(11, S_INPUT)
S_DATECHECK = ref(12, S_LABEL)
D0 = 18               # first debt row
DN = D0 + ND - 1
# the debt table: # name balance interest minimum due day, my order, then a calm note. Each column ends with one
# empty cell, so the lines under the typed cells never touch.
SC_NUM, SC_NAME, SC_BAL, SC_APR, SC_MIN, SC_DUE, SC_ORDER, SC_NOTE = 3, 5, 15, 22, 28, 35, 41, 46
SC_ENDS = {SC_NUM: 4, SC_NAME: 14, SC_BAL: 21, SC_APR: 27, SC_MIN: 34, SC_DUE: 40, SC_ORDER: 44, SC_NOTE: 55}
S_NOTE_COL = SC_NOTE
S_MONEY, S_BUF, S_GOAL = ref(37, S_INPUT), ref(39, S_INPUT), ref(40, S_INPUT)
S_MONEYNOTE = ref(38, S_LABEL)
Y0 = 43               # first yearly bill row
YN = Y0 + NY - 1
SY_NAME, SY_AMT, SY_MONTH = 3, 21, 31
SY_ENDS = {SY_NAME: 20, SY_AMT: 30, SY_MONTH: 45}
# the right column: the result box, then the options
R_C0, R_C1 = gcol(9) + 1, gend(12) - 1        # inside a card of grid 9 to 12
S_R_LINE1, S_R_DATE, S_R_STEP, S_R_MIN, S_R_SOONER, S_R_NEXT = (ref(r, R_C0) for r in (7, 8, 9, 10, 11, 12))
# the options: a label and its typed cell side by side, as on the design
O_LABEL, O_INPUT = R_C0, R_C0 + 12
S_ORDER = ref(17, O_INPUT)
S_LOOK = ref(20, O_INPUT)      # Light or Night
S_SHOW = ref(21, O_INPUT)
LOOKS = ["Light", "Night"]
S_FOOT = 53

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
C_XPOS = C_LAST + 6   # the debt that gets most of the extra on a payday (place), for "Mostly for" on Today
# "What if I add more?" on Path: the same plan again, with the typed amount added from the current payday on. Only what
# changes is worked out again; the dates and the bills due come from the plan above.
W0 = C_XPOS + 1
W_AVAIL, W_YEARLY, W_TOBUF, W_BUFAFTER, W_CHGPOS, W_POOL, W_INT, W_OWED = range(W0, W0 + 8)
W_AFT = W0 + 8           # balance after interest and the bill, by debt in payoff order
W_BAL = W_AFT + ND       # balance after the extra
W_LAST = W_BAL + ND - 1

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
ROW_GREW = 20         # over the C_BAL columns: how much a debt grew above its start (0 when it did not)
E_NGREW, E_GREW = "U19", "U20"   # how many debts grew, and by how much in all
# more answers live in column AB (labels in AA), rows 1 to 20: row 21 and below of these columns belong to the debts
E_GREWPOS = "AB1"     # the first debt that grew (place)
E_YCOUNT, E_YNAME = "AB2", "AB3"   # yearly bills with an amount, and the name of the first one
E_MONTHPLAN, E_MONTHDONE = "AB4", "AB5"   # this month: what the plan asks for, and what is ticked
E_WADD, E_WNPAY, E_WFREE, E_WINT = "AB6", "AB7", "AB8", "AB9"   # what if: the amount, paydays, the new date, interest
E_WMONTHS, E_WPAYDAYS, E_WSAVED, E_WFITS = "AB10", "AB11", "AB12", "AB13"   # months and paydays sooner, interest saved

# ---- Today: the Move card on the left (grid 1 to 8). On the right (grid 9 to 12): the focus debt, the buffer, the
# debt-free date, and the next two paydays under "Coming up".
T_FLAG = helper(3)    # 1 when the card is yellow (paid, or all done)
T_COUNT = helper(4)   # how many lines this payday has
T_FOCUS_SHARE, T_BUF_SHARE = helper(5), helper(6)   # what the two bars on the right measure, 0 to 1
T_COLS = (3, 28, 39)  # a line: what it is, the amount, a note (a small gap before the note)
T_ENDS = (27, 37, 55)
T_LABEL, T_MAIN, T_SUB = ref(7, 3), ref(8, 3), ref(11, 3)   # the big Move spans rows 8 to 10
T_LATE = T_SUB        # when paydays went by and are not ticked, the line under Move says so
T_HEAD = 13
T_L0 = 14             # the lines of the payday: two rows each, a thin one, then the words. The cards on the right
                      # sit on the same rows, and their bars need a thin row.
T_LINES_END = T_L0 + 2 * NI + 1    # one more pair: the card's bottom padding when every line is used


def t_line(i: int) -> int:
    """The row with the words of line i (0 based) of the payday"""
    return T_L0 + 2 * i + 1


T_CARD = f"B6:{_L(gend(8))}12 B{T_HEAD} {_L(gend(8))}{T_HEAD}"   # the top of the card, around the white table header
# the lines, in ranges that never overlap: the left edge, the inside, the right edge. The card ends one pair after the
# last line.
T_RANGES = [f"B{T_L0}:B{T_LINES_END}", f"C{T_L0}:{_L(gend(8) - 1)}{T_LINES_END}", f"{_L(gend(8))}{T_L0}:{_L(gend(8))}{T_LINES_END}"]
T_FOCUS_NAME, T_FOCUS_LEFT, T_FOCUS_GONE = ref(8, R_C0), ref(9, R_C0), ref(11, R_C0)
T_FOCUS_BAR_ROW = 10
T_BUF, T_BUF_BAR_ROW, T_BUF_NOTE = ref(16, R_C0), 18, ref(19, R_C0)
T_FREE, T_FREE_NOTE = ref(24, R_C0), ref(27, R_C0)
T_FREE_END = R_C0 + 17                     # the date's highlight: about as wide as the date
T_SOON_HEAD = 33                           # Coming up: the header, then two paydays
T_SOON_ROWS = (35, 37)
T_SOON_COLS, T_SOON_ENDS = (R_C0, R_C0 + 8, R_C0 + 15), (R_C0 + 7, R_C0 + 13, R_C1)
T_FOOT = T_LINES_END + 2
T_BARS = [f"{_L(R_C0)}{r}:{_L(R_C0 + BAR - 1)}{r}" for r in (T_FOCUS_BAR_ROW, T_BUF_BAR_ROW)]   # yellow only at 100%
YELLOW_OK |= {("Today", T_CARD), ("Today", T_FREE)} | {("Today", r) for r in T_RANGES} | {("Today", b) for b in T_BARS}

# ---- Path: four tiles, the doughnut and the chart, then the payday list (grid 1 to 8)
P_TILE_ROW = 8
P_GREW_ROW = 11       # a small ink note under "Paid off so far" when a debt grew
P_TILE_COLS = [gcol(1 + 3 * k) + 1 for k in range(4)]       # inside each tile of 3 grid columns
P_TILE_OWED, P_TILE_FREE, P_TILE_PAID, P_TILE_AVOID = (ref(P_TILE_ROW, c) for c in P_TILE_COLS)
P_FREE_CELLS = f"{P_TILE_FREE}:{_L(gend(6) - 1)}{P_TILE_ROW}"   # the debt-free date, merged over its tile
P_BAR_ROW, P_CAPTION_ROW = 9, 10
P_SHARES = [helper(4 + k) for k in range(4)]                  # what each tile's bar measures, 0 to 1
P_RING_TEXT = gcol(3)                                         # beside the doughnut
P_GREW = ref(P_GREW_ROW, P_TILE_COLS[2])
P_PCT, P_DEBTSPAID, P_NEXT, P_MONTH = ref(15, P_RING_TEXT), ref(16, P_RING_TEXT), ref(17, P_RING_TEXT), ref(18, P_RING_TEXT)
P_NOFIT, P_SHORT = ref(24, 3), ref(25, 3)
P_R0 = 26             # header of the payday list
P_R1 = 27             # payday 1
P_RN = P_R1 + NR - 1
P_COLS = [3, 13, 19, 24, 30, 37, 44, 51]   # Payday, Bills, Yearly, Buffer, Extra, Move, Actual, Done
P_ENDS = [12, 18, 23, 29, 36, 43, 50, 55]
P_ACTUAL_COL = P_COLS[6]                    # what was really paid (empty means as planned)
P_DONE_COL = P_COLS[7]                      # the tick
P_LIST = f"B{P_R1}:{_L(gend(8))}{P_RN}"     # the rows of the list card
# its colour rules, in ranges that never overlap: the left edge, the plan, Actual and Done, the right edge
P_RANGES = [f"B{P_R1}:B{P_RN}", f"C{P_R1}:{_L(P_ACTUAL_COL - 1)}{P_RN}", f"{_L(P_ACTUAL_COL)}{P_R1}:{_L(gend(8) - 1)}{P_RN}",
            f"{_L(gend(8))}{P_R1}:{_L(gend(8))}{P_RN}"]
P_TYPE_ENDS = (P_ENDS[6] - 1, P_ENDS[7] - 1)  # the typed cells end one cell early, so their lines never touch
P_CURK, P_SHOW = helper(3), helper(2)       # the current payday, and the Show where to type tick
# "What if I add more?": a calm card beside the payday list (grid 9 to 12), one typed field
W_CARD_ROWS = (22, 33)
W_INPUT = ref(27, R_C0 + 4)   # not in row 26: the list header repeats on every printed page
W_DATE, W_LINE, W_LIKE = ref(29, R_C0), ref(31, R_C0), ref(32, R_C0)
P_FOOT = 35                                  # the footer sits in the right column: the list runs long
E_NEXTGONE = "U12"    # the date the next debt is gone
E_PCT = "U13"         # share of the starting debt that is gone, 0 to 1
NC = 19               # points of the chart (Engine columns W label, X owed, rows 1..NC)
E_RING_COL = 25       # Engine column Y, rows 1 to 3: gone, left, all gone
E_TICKED = "U18"      # paydays of the plan that are ticked
P_TILE_BARS = [f"{_L(gcol(1 + 3 * k))}{P_BAR_ROW}:{_L(gend(3 + 3 * k))}{P_BAR_ROW}" for k in range(4)]
YELLOW_OK |= {("Path", P_FREE_CELLS)} | {("Path", r) for r in P_RANGES} | {("Path", b) for b in P_TILE_BARS}

# ---- Debts: one card with the table (grid 1 to 9), two rows a debt: the numbers, then a small note
E_BUFNOW, E_YSAVED = "U14", "U15"   # the buffer and the yearly bills money after the last ticked payday
E_SHORTK = "U16"      # the first payday whose Actual is below its bills (0 = none)
E_VIEWACTUAL = "U17"  # 1 when the payday Today shows has an Actual typed
DB_R0 = 10            # the first debt (in payoff order). Four rows a debt: three thin rows hold the numbers (the bar
DB_STEP = 4           # sits in the middle one, so it stays thin), the fourth holds a small note
DB_COLS = dict(num=2, name=4, rate=13, left=18, paid=25, bar=33, gone=54)
DB_ENDS = dict(num=3, name=12, rate=17, left=24, paid=31, bar=52, gone=63)
DB_PCT_COL = HELP_COL # the share paid, a quiet helper
DB_ON_COL = HELP_COL + 1   # 1 on the four rows of a debt that is there: the card is white only there
DB_PAIDTOTAL = ref(7, DB_COLS["gone"])  # paid off so far, the same number as the Path tile
DB_GREW = ref(8, DB_COLS["bar"])        # under it: a small ink note when a debt grew
DB_LAST = DB_R0 + DB_STEP * ND - 1
DB_FOOT = DB_LAST + 3


def db_row(p: int) -> int:
    return DB_R0 + DB_STEP * p


DB_BARS = f"{_L(DB_COLS['bar'])}{DB_R0}:{_L(DB_ENDS['bar'])}{DB_LAST}"   # the rule reads the share of each row
DB_ROWS = f"B{DB_R0}:{_L(DB_ENDS['gone'])}{DB_LAST}"
# the colour rules over the debt rows, in ranges that never overlap: LibreOffice and Google Sheets use the first
# range that has a rule for a cell, so overlapping ranges would hide the bar or the card line
DB_RANGES = [f"B{DB_R0}:B{DB_LAST}", f"C{DB_R0}:{_L(DB_COLS['bar'] - 1)}{DB_LAST}", DB_BARS,
             f"{_L(DB_ENDS['bar'] + 1)}{DB_R0}:{_L(DB_COLS['gone'] - 1)}{DB_LAST}", f"{_L(DB_COLS['gone'])}{DB_R0}:{_L(DB_ENDS['gone'])}{DB_LAST}"]
# (each range starts where a merged cell starts: a merged cell takes the rules of its first cell)

# ---- Safety net: the buffer (grid 1 to 4) beside the yearly bills (grid 5 to 12), which have room for a bar per bill
SN_BUF = ref(8, 3)
SN_BAR = f"C9:{_L(2 + BAR)}9"   # the bar's thin row is a small gap in the yearly bills card
SN_SHARE = helper(2)
SN_READY = ref(12, 3)           # "ready" on yellow when the buffer is full, else "Full after" a date
SN_YEARLY_TITLE = ref(7, gcol(5) + 1)    # "Yearly bills", in its own row at the top of its card
SN_Y0 = 11            # first yearly bill row
SN_COLS = [31, 41, 47, 53, 58]   # Bill, A year, Month needed, Set aside so far, Each payday
SN_ENDS = [40, 45, 52, 57, 62]
SN_PROG = 64                     # the progress bar of each bill: 20 cells, to the card's inside edge
SN_PROG_BARS = [f"{_L(SN_PROG)}{SN_Y0 + i}:{_L(SN_PROG + BAR - 1)}{SN_Y0 + i}" for i in range(NY)]   # one bar per bill
SN_EMPTY = ref(SN_Y0 + NY, 31)
SN_HEAD = SN_Y0 - 1
SN_FOOT = SN_Y0 + NY + 4
YELLOW_OK |= {("Debts", r) for r in DB_RANGES} | {("Safety net", SN_READY), ("Safety net", SN_BAR)} | {("Safety net", b) for b in SN_PROG_BARS}

# quiet helpers on the visible tabs, in the hidden column: the colour rules read them
HELPERS = {("Today", T_FLAG), ("Today", T_COUNT), ("Path", P_CURK), ("Path", P_SHOW), ("Safety net", SN_SHARE)} | {("Safety net", helper(SN_Y0 + i)) for i in range(NY)} | {("Path", s) for s in P_SHARES}

# ---- the workbook
TABS = ["Open me", "Start", "Today", "Path", "Debts", "Safety net"]   # in this order; Engine and Lists are hidden
PURPOSE = {
    "Open me": "Start here. Two minutes.",
    "Start": "Type here. Everything else follows.",
    "Today": "What to move this payday.",
    "Path": "Every payday until you are debt-free.",
    "Debts": "Each debt, in the order you pay it.",
    "Safety net": "Money for surprises and yearly bills.",
}
VERSION = "1.0"
VERSION_DATE = "November 2026"
SUPPORT_EMAIL = "[SUPPORT EMAIL]"   # to fill in before the file is sold
P_PRINT_ROWS = 60     # Path prints its tiles and the first 60 paydays, one page wide
