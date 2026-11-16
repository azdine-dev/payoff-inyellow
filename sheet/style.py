"""The look of every tab: calm sage tokens, one big title in a band, cards on paper, thin spacer columns."""
from __future__ import annotations

from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Protection, Side
from openpyxl.utils import get_column_letter as L
from openpyxl.worksheet.datavalidation import DataValidation

PAPER, CARD, CALM, BAND = "F8F6F0", "FFFFFF", "E6EFE8", "D8E7DC"
INK, ACTION, YELLOW, YELLOW_SOFT, GRAY, LINE = "1F2A44", "2F4A6D", "FFE14D", "FFF6C2", "5C5A55", "E2DCCD"
TITLE_FONT, BODY_FONT = "Bricolage Grotesque", "Inter"
DISCLAIMER = "A planning tool, not financial advice."
SLOGAN = "one paycheck at a time"


def fill(rgb: str) -> PatternFill:
    return PatternFill("solid", fgColor=rgb, bgColor=rgb)


def font(size: float = 10, bold: bool = False, color: str = INK, title: bool = False, strike: bool = False, italic: bool = False) -> Font:
    return Font(name=TITLE_FONT if title else BODY_FONT, size=size, bold=bold, color=color, strike=strike, italic=italic)


THIN = Side(style="thin", color=LINE)
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
UNDER = Border(bottom=THIN)
NONE = Side(style=None)
NO_BORDER = Border(left=NONE, right=NONE, top=NONE, bottom=NONE)
LEFT = Alignment(horizontal="left", vertical="center")
CENTER = Alignment(horizontal="center", vertical="center")
RIGHT = Alignment(horizontal="right", vertical="center")
WRAP = Alignment(horizontal="left", vertical="top", wrap_text=True)
UNLOCKED = Protection(locked=False)


def page(ws, cols: int, rows: int, widths: dict[str, float], title: str, band_rows: int = 4):
    """Paper everywhere, gridlines off, the band with the one big title, columns right of the page hidden."""
    ws.sheet_view.showGridLines = False
    ws.sheet_view.zoomScale = 100
    for r in range(1, rows + 1):
        for c in range(1, cols + 1):
            cell = ws.cell(r, c)
            cell.fill = fill(BAND if r <= band_rows else PAPER)
            cell.font = font()
            cell.alignment = LEFT
    for col, w in widths.items():
        ws.column_dimensions[col].width = w
    ws.column_dimensions.group(L(cols + 1), "XFD", hidden=True)
    ws.row_dimensions[1].height = 10
    ws.row_dimensions[2].height = 78
    ws.row_dimensions[3].height = 18
    ws.row_dimensions[4].height = 10
    t = ws.cell(2, 2, title)
    t.font = font(60, bold=True, title=True)
    t.alignment = Alignment(horizontal="left", vertical="center")
    ws.sheet_properties.tabColor = BAND
    ws.protection.sheet = True  # no password: a buyer can still unlock it
    ws.protection.formatColumns = False
    ws.protection.formatRows = False


def section(ws, row: int, col: int, text: str):
    c = ws.cell(row, col, text)
    c.font = font(13, bold=True, title=True)
    ws.row_dimensions[row].height = 24
    return c


def label(ws, row: int, col: int, text: str, small: bool = False, bold: bool = False):
    c = ws.cell(row, col, text)
    c.font = font(9 if small else 10, bold=bold, color=GRAY if not bold else INK)
    return c


def head(ws, row: int, col: int, text: str, align=LEFT):
    c = ws.cell(row, col, text)
    c.font = font(9, bold=True, color=GRAY)
    c.border = UNDER
    c.alignment = align
    return c


def input_cell(cell, fmt: str | None = None, align=LEFT):
    """A white cell the buyer types in: unlocked, thin border."""
    cell.fill = fill(CARD)
    cell.border = BOX
    cell.font = font(10, bold=True)
    cell.protection = UNLOCKED
    cell.alignment = align
    if fmt:
        cell.number_format = fmt
    return cell


def block(ws, r0: int, r1: int, c0: int, c1: int, rgb: str = CALM):
    for r in range(r0, r1 + 1):
        for c in range(c0, c1 + 1):
            ws.cell(r, c).fill = fill(rgb)


def dropdown(ws, ref: str, source: str, allow_blank: bool = True):
    """A list validation. `source` is a range like Lists!$A$2:$A$15, or a quoted list like '"✓"'."""
    dv = DataValidation(type="list", formula1=source, allow_blank=allow_blank)
    dv.showErrorMessage = True
    dv.errorTitle, dv.error = "Pick from the list", "Pick one of the choices in the list."
    ws.add_data_validation(dv)
    dv.add(ref)
    return dv


def when(ws, ref: str, formula: str, rgb: str | None = None, fnt: Font | None = None, border: Border | None = None):
    ws.conditional_formatting.add(ref, FormulaRule(formula=[formula], fill=fill(rgb) if rgb else None, font=fnt, border=border, stopIfTrue=False))


def footer(ws, row: int, col: int = 2):
    a = ws.cell(row, col, DISCLAIMER)
    a.font = font(9, color=GRAY)
    b = ws.cell(row + 1, col, SLOGAN)
    b.font = font(9, color=GRAY, italic=True)
