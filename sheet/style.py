"""The look of every tab: calm sage tokens, one big title in a band, white cards on paper, a 12 column grid."""
from __future__ import annotations

from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Protection, Side
from openpyxl.utils import get_column_letter as L
from openpyxl.worksheet.datavalidation import DataValidation

from layout import BAND_ROWS, BAR, GUT_W, HELP_COL, MARGIN_W, NCOL, PURPOSE, SUB, SUB_W, gcol, gend

PAPER, CARD, CALM, BAND = "F8F6F0", "FFFFFF", "E6EFE8", "D8E7DC"
INK, ACTION, YELLOW, YELLOW_SOFT, GRAY, LINE = "1F2A44", "2F4A6D", "FFE14D", "FFF6C2", "5C5A55", "E2DCCD"
TITLE_FONT, BODY_FONT = "Bricolage Grotesque", "Inter"
DISCLAIMER = "A planning tool, not financial advice."
SLOGAN = "one paycheck at a time"
SITE = "paidinyellow.com"

# the type scale: nothing below 10 pt
BIG, TILE, SECTION, BODY, HELP = 44, 24, 14, 11, 10


def fill(rgb: str) -> PatternFill:
    return PatternFill("solid", fgColor=rgb, bgColor=rgb)


def font(size: float = BODY, bold: bool = False, color: str = INK, title: bool = False, strike: bool = False, italic: bool = False) -> Font:
    return Font(name=TITLE_FONT if title else BODY_FONT, size=size, bold=bold, color=color, strike=strike, italic=italic)


THIN = Side(style="thin", color=LINE)
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
UNDER = Border(bottom=THIN)
TYPE_LINE = Side(style="medium", color=ACTION)
NONE = Side(style=None)
NO_BORDER = Border(left=NONE, right=NONE, top=NONE, bottom=NONE)
LEFT = Alignment(horizontal="left", vertical="center")
CENTER = Alignment(horizontal="center", vertical="center")
RIGHT = Alignment(horizontal="right", vertical="center")
WRAP = Alignment(horizontal="left", vertical="center", wrap_text=True)
TOP_WRAP = Alignment(horizontal="left", vertical="top", wrap_text=True)
UNLOCKED = Protection(locked=False)

_CARDS: dict[str, list[tuple[int, int, int, int]]] = {}   # sheet -> boxes whose border is drawn last (after the merges)


def page(ws, rows: int, title: str):
    """Paper everywhere, gridlines off, the band with the big title, the purpose and the brand, columns set to the grid."""
    ws.sheet_view.showGridLines = False
    ws.sheet_view.zoomScale = 100
    ws.sheet_format.defaultRowHeight = 18
    ws.sheet_format.customHeight = True
    for r in range(1, rows + 1):
        for c in range(1, NCOL + 1):
            cell = ws.cell(r, c)
            cell.fill = fill(BAND if r <= BAND_ROWS else PAPER)
            cell.font = font()
            cell.alignment = LEFT
    ws.column_dimensions["A"].width = MARGIN_W
    for c in range(2, NCOL):
        ws.column_dimensions[L(c)].width = SUB_W if (c - 2) % (SUB + 1) < SUB else GUT_W
    ws.column_dimensions[L(NCOL)].width = MARGIN_W
    ws.column_dimensions.group(L(HELP_COL), "XFD", hidden=True)
    for r, h in ((1, 10), (2, 60), (3, 20), (4, 12), (5, 14)):
        ws.row_dimensions[r].height = h
    text(ws, 2, gcol(1), gend(8), title, font(48, bold=True, title=True), Alignment(horizontal="left", vertical="bottom"))
    text(ws, 3, gcol(1), gend(8), PURPOSE[title], font(BODY, color=GRAY))
    text(ws, 2, gcol(9), gend(12), "PaidInYellow", font(20, bold=True, title=True), Alignment(horizontal="right", vertical="bottom"))
    text(ws, 3, gcol(9), gend(12), SLOGAN, font(HELP, color=GRAY), RIGHT)
    ws.sheet_properties.tabColor = BAND
    ws.protection.sheet = True  # no password: a buyer can still unlock it
    ws.protection.formatColumns = False
    ws.protection.formatRows = False
    _CARDS[ws.title] = []


def text(ws, row: int, c0: int, c1: int, value, fnt: Font | None = None, align: Alignment | None = None, r1: int | None = None):
    """A value over cells c0 to c1 of a row (down to row r1 when given), merged so it never spills or clips
    differently in each program."""
    cell = ws.cell(row, c0, value)
    if fnt is not None:
        cell.font = fnt
    if align is not None:
        cell.alignment = align
    if c1 > c0 or (r1 or row) > row:
        ws.merge_cells(start_row=row, end_row=r1 or row, start_column=c0, end_column=c1)
    return cell


def card(ws, r0: int, r1: int, c0: int, c1: int, rgb: str = CARD, border: bool | None = None):
    """A card: a filled box over rows r0 to r1. The first and last rows are its padding. White cards get a thin line."""
    for r in range(r0, r1 + 1):
        for c in range(c0, c1 + 1):
            ws.cell(r, c).fill = fill(rgb)
    if border if border is not None else rgb == CARD:
        _CARDS[ws.title].append((r0, r1, c0, c1))


def grid_card(ws, r0: int, r1: int, g0: int, g1: int, rgb: str = CARD, border: bool | None = None):
    card(ws, r0, r1, gcol(g0), gend(g1), rgb, border)


def draw_cards(ws):
    """The thin line around each white card, drawn after every merge so a merge can not wipe it."""
    for r0, r1, c0, c1 in _CARDS.get(ws.title, []):
        for r in range(r0, r1 + 1):
            for c in range(c0, c1 + 1):
                if r in (r0, r1) or c in (c0, c1):
                    cell = ws.cell(r, c)
                    b = cell.border
                    cell.border = Border(left=THIN if c == c0 else b.left, right=THIN if c == c1 else b.right,
                                         top=THIN if r == r0 else b.top, bottom=THIN if r == r1 else b.bottom)


def section(ws, row: int, c0: int, c1: int, value: str):
    ws.row_dimensions[row].height = 24
    return text(ws, row, c0, c1, value, font(SECTION, bold=True))


def label(ws, row: int, c0: int, c1: int, value, bold: bool = True, gray: bool = False, align: Alignment = LEFT):
    """A label next to something you type is bold ink. A card label is bold gray."""
    return text(ws, row, c0, c1, value, font(HELP if gray else BODY, bold=bold, color=GRAY if gray else INK), align)


def hint(ws, row: int, c0: int, c1: int, value, wrap: bool = True):
    """Gray help text"""
    return text(ws, row, c0, c1, value, font(HELP, color=GRAY), WRAP if wrap else LEFT)


def head(ws, row: int, c0: int, c1: int, value: str, align: Alignment = LEFT):
    """A table header: gray, bold, with a hairline under the whole span"""
    cell = text(ws, row, c0, c1, value, font(HELP, bold=True, color=GRAY), align)
    for c in range(c0, c1 + 1):
        ws.cell(row, c).border = UNDER
    return cell


def input_cell(ws, row: int, c0: int, c1: int, fmt: str | None = None, align: Alignment = LEFT, base: str = CARD):
    """A cell the buyer types in: white, an action blue line under it, regular weight, unlocked."""
    cell = text(ws, row, c0, c1, None, font(BODY), align)
    cell.protection = UNLOCKED
    if fmt:
        cell.number_format = fmt
    for c in range(c0, c1 + 1):
        ws.cell(row, c).fill = fill(base)
        ws.cell(row, c).border = Border(bottom=TYPE_LINE)
    return cell


def bar(ws, row: int, c0: int, share: str, rest: str = CALM, gap: str = CARD):
    """One bar style everywhere: 20 narrow cells, action blue for what is done, calm for the rest, yellow only at 100%.
    `share` is a cell (0 to 1, or empty for no bar) on the same tab. Returns the range."""
    c1 = c0 + BAR - 1
    side = Side(style="thin", color=gap)
    edge = Side(style="medium", color=gap)
    for c in range(c0, c1 + 1):
        ws.cell(row, c).border = Border(left=side, right=side, top=edge, bottom=edge)
    rng = f"{L(c0)}{row}:{L(c1)}{row}"
    s = share
    when(ws, rng, f"AND(ISNUMBER({s}),{s}>=0.9995)", YELLOW)                                       # done
    when(ws, rng, f"AND(ISNUMBER({s}),{s}<0.9995,{s}*{BAR}>=COLUMN()-{c0}+0.5)", ACTION)           # what is done so far
    when(ws, rng, f"AND(ISNUMBER({s}),{s}<0.9995)", rest)                                          # the rest
    return rng


def block(ws, r0: int, r1: int, c0: int, c1: int, rgb: str = CALM):
    for r in range(r0, r1 + 1):
        for c in range(c0, c1 + 1):
            ws.cell(r, c).fill = fill(rgb)


def quiet(ws, ref: str, formula: str):
    """A helper in the hidden column, read by the colour rules"""
    ws[ref] = formula
    ws[ref].font = font(HELP, color=GRAY)


def dropdown(ws, ref: str, source: str, allow_blank: bool = True):
    """A list validation. `source` is a range like Lists!$A$2:$A$15, or a quoted list like '"✓"'."""
    dv = DataValidation(type="list", formula1=source, allow_blank=allow_blank)
    dv.showErrorMessage = True
    dv.errorTitle, dv.error = "Pick from the list", "Pick one of the choices in the list."
    ws.add_data_validation(dv)
    dv.add(ref)
    return dv


def amount_only(ws, ref: str):
    """A typed amount of 0 or more. Anything else gets a calm message."""
    dv = DataValidation(type="decimal", operator="greaterThanOrEqual", formula1="0", allow_blank=True)
    dv.showErrorMessage = True
    dv.errorTitle, dv.error = "Type an amount", "Type the amount you really paid, or leave it empty."
    ws.add_data_validation(dv)
    dv.add(ref)
    return dv


def limit(ws, ref: str, kind: str, lo: str, hi: str | None, title: str, message: str):
    """A typed number or date inside calm bounds. kind is decimal, whole or date. Empty is always fine."""
    dv = DataValidation(type=kind, operator="between" if hi is not None else "greaterThanOrEqual", formula1=lo, formula2=hi,
                        allow_blank=True)
    dv.showErrorMessage = True
    dv.errorTitle, dv.error = title, message
    ws.add_data_validation(dv)
    for part in ref.split():
        dv.add(part)
    return dv


def when(ws, ref: str, formula: str, rgb: str | None = None, fnt: Font | None = None, border: Border | None = None):
    ws.conditional_formatting.add(ref, FormulaRule(formula=[formula], fill=fill(rgb) if rgb else None, font=fnt, border=border, stopIfTrue=False))


def footer(ws, row: int, g0: int = 1, g1: int = 12, two_rows: bool = False):
    """The disclaimer on the left, the site on the right"""
    text(ws, row, gcol(g0), gend(g1 if two_rows else g0 + 5), DISCLAIMER, font(HELP, color=GRAY))
    r = row + 1 if two_rows else row
    text(ws, r, gcol(g0) if two_rows else gcol(g1 - 2), gend(g1), SITE, font(HELP, color=GRAY), RIGHT)
