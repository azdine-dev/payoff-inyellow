"""The Night look: when Look on Start says Night, every tab takes the app's dark tokens through colour rules.

A colour rule can change a fill, a font colour and a border, never a font or a size, so the light look stays the one
that is built and Night is laid over it. Rules draw thin lines only (Excel takes no other), so a typed cell's line is thin in
Night. Google Sheets rules draw no lines at all: there the card lines and bar gaps keep their light colours. Charts
keep their light colours in every program. LibreOffice and Google Sheets use the first rule that is true for a cell,
and LibreOffice only reads the first range that has rules for a cell. So the rules of every tab are rebuilt here into
ranges that never overlap, each with, in this order:
  1. a Night copy of each light rule (the same test, and Night), with the colours turned dark,
  2. a Night rule for the cell itself: its own fill, font colour and lines turned dark,
  3. the light rules as they were.
Excel merges every true rule by priority, which gives the same result.
"""
from __future__ import annotations

from collections import defaultdict
from copy import copy

from openpyxl.formatting.formatting import ConditionalFormattingList
from openpyxl.formatting.rule import Rule
from openpyxl.formula.translate import Translator
from openpyxl.styles import Border, Color, Font, PatternFill, Side
from openpyxl.styles.differential import DifferentialStyle
from openpyxl.utils import get_column_letter as L
from openpyxl.worksheet.cell_range import MultiCellRange

from layout import BAR, HELP_COL, NCOL, helper
from style import ACTION, BAND, CALM, CARD, GRAY, HELP, INK, LINE, PAPER, YELLOW, YELLOW_SOFT, font as style_font

NIGHT_CELL = helper(1)            # on every tab: what Look on Start says, read by the rules of that tab
NIGHT = f'${NIGHT_CELL[:2]}${NIGHT_CELL[2:]}="Night"'

# the app's dark tokens (CLAUDE.md section 3)
N_PAPER, N_CARD, N_CALM, N_BAND = "1B2433", "222D3F", "24332B", "2A3B31"
N_TEXT, N_GRAY, N_ACTION, N_ON_ACTION = "E8EDE9", "A9B4AC", "9DBBE6", "14203A"
N_LINE = "3A4658"                 # an empty bar and a hairline on a dark card
NIGHT_FILL = {PAPER: N_PAPER, CARD: N_CARD, CALM: N_CALM, BAND: N_BAND, ACTION: N_ACTION, LINE: N_LINE,
              YELLOW: YELLOW, YELLOW_SOFT: YELLOW_SOFT}   # yellow keeps its meaning: paid, done, the date
NIGHT_TEXT = {INK: N_TEXT, GRAY: N_GRAY, ACTION: N_ACTION, CARD: N_TEXT}
NIGHT_SIDE = {PAPER: N_PAPER, CARD: N_CARD, CALM: N_CALM, BAND: N_BAND, LINE: N_LINE, ACTION: N_ACTION, INK: N_TEXT, GRAY: N_GRAY}
SIDES = ("left", "right", "top", "bottom")


def rgb(color) -> str | None:
    if color is None or getattr(color, "type", "rgb") != "rgb" or not isinstance(color.rgb, str):
        return None
    return color.rgb[-6:].upper()


def fill_of(fill) -> str | None:
    if fill is None or fill.fill_type != "solid":
        return None
    return rgb(fill.fgColor) or rgb(fill.bgColor)


def night_pair(fill: str, font: str) -> tuple[str, str]:
    """Light fill and font colour -> Night fill and font colour"""
    nf = NIGHT_FILL[fill]
    if font == fill:                        # text faded into its card stays faded
        return nf, nf
    if fill in (YELLOW, YELLOW_SOFT):       # ink on yellow in both looks
        return nf, INK
    if fill == ACTION:                      # a button: dark text on the light blue
        return nf, N_ON_ACTION
    return nf, NIGHT_TEXT[font]


def _sides(border) -> dict[str, str]:
    """The lines a border draws: side -> colour"""
    if border is None:
        return {}
    out = {}
    for name in SIDES:
        side = getattr(border, name, None)
        if side is not None and side.style:
            out[name] = rgb(side.color) or INK
    return out


def _night_border(*borders) -> Border | None:
    """The lines of these borders (a later one wins on a side), in dark colours. Rules draw thin lines only:
    Excel takes no other, so a typed cell's line is thin in Night."""
    sides: dict[str, str] = {}
    for b in borders:
        sides.update(_sides(b))
    if not sides:
        return None
    return Border(**{k: Side(style="thin", color=NIGHT_SIDE.get(v, v)) for k, v in sides.items()})


def _dxf(fill: str, font_rgb: str, like: Font | None, border: Border | None) -> DifferentialStyle:
    f = copy(like) if like is not None else Font()
    f.color = Color(rgb="FF" + font_rgb)
    return DifferentialStyle(font=f, fill=PatternFill("solid", fgColor=fill, bgColor=fill), border=border)


def _first(sqref: MultiCellRange) -> str:
    """The cell a rule's relative references start from: the top left of the first range as it is written"""
    first = sqref.sorted()[0]
    return f"{L(first.min_col)}{first.min_row}"


def _move(formula: str, origin: str, dest: str) -> str:
    if origin == dest:
        return formula
    out = Translator("=" + formula, origin=origin).translate_formula(dest)[1:]
    assert "#REF!" not in out, (formula, origin, dest)
    return out


def _is_bar_rest(rules: list, i: int) -> bool:
    """The third rule of a bar (st.bar): the part that is not done yet"""
    return i == 2 and len(rules) == 3 and f"*{BAR}>=COLUMN()" in rules[1].formula[0]


def _ranges(cells: set[tuple[int, int]]) -> list[str]:
    """Cells -> rectangles: runs along each row, joined down while the runs stay the same"""
    runs: dict[int, list[tuple[int, int]]] = defaultdict(list)
    for r in sorted({r for r, _ in cells}):
        cols = sorted(c for rr, c in cells if rr == r)
        start = prev = cols[0]
        for c in cols[1:]:
            if c != prev + 1:
                runs[r].append((start, prev))
                start = c
            prev = c
        runs[r].append((start, prev))
    out: list[str] = []
    open_: dict[tuple[int, int], list[int]] = {}   # a run -> [top row, bottom row]
    for r in sorted(runs):
        now = set(runs[r])
        for run in list(open_):
            if run not in now or open_[run][1] != r - 1:
                top, bottom = open_.pop(run)
                out.append(f"{L(run[0])}{top}:{L(run[1])}{bottom}")
        for run in now:
            if run in open_:
                open_[run][1] = r
            else:
                open_[run] = [r, r]
    for run, (top, bottom) in open_.items():
        out.append(f"{L(run[0])}{top}:{L(run[1])}{bottom}")
    return out


def apply(ws, look_cell: str, extra_rows: int = 40):
    """Lays the Night look over one tab. `look_cell` is the Look cell on Start, as Start!$X$20."""
    ws[NIGHT_CELL] = f'=IFERROR({look_cell}&"","")'
    ws[NIGHT_CELL].font = style_font(HELP, color=GRAY)   # a quiet helper, in the sheet's own font
    entries = [(cf, list(cf.rules)) for cf in ws.conditional_formatting]
    last_row = ws.max_row + extra_rows
    where: dict[tuple[int, int], list[int]] = defaultdict(list)
    for r in range(1, last_row + 1):
        for c in range(1, NCOL + 1):
            where[(r, c)]
    for i, (cf, _) in enumerate(entries):
        for cr in cf.sqref.ranges:
            for r in range(cr.min_row, cr.max_row + 1):
                for c in range(cr.min_col, cr.max_col + 1):
                    if c < HELP_COL:
                        where[(r, c)].append(i)
    origin = {i: _first(cf.sqref) for i, (cf, _) in enumerate(entries)}

    groups: dict[tuple, set] = defaultdict(set)
    for (r, c), ids in where.items():
        cell = ws.cell(r, c)
        fill = fill_of(cell.fill) or PAPER
        font = rgb(cell.font.color) if cell.font is not None and cell.font.color is not None else None
        font = font if font in NIGHT_TEXT or font == fill else INK
        lines = tuple(sorted(_sides(cell.border).items()))
        groups[(tuple(ids), fill, font, lines)].add((r, c))

    new = ConditionalFormattingList()
    for (ids, fill, font, lines), cells in groups.items():
        static = Border(**{k: Side(style="thin", color=v) for k, v in lines}) if lines else None
        for sq in _sqrefs(cells):
            top = _first(MultiCellRange(sq))
            nights, lights = [], []
            for i in ids:
                rules = entries[i][1]
                for k, rule in enumerate(rules):
                    f = _move(rule.formula[0], origin[i], top)
                    d = rule.dxf
                    lf = fill_of(d.fill) if d is not None and d.fill is not None else None
                    lfont = rgb(d.font.color) if d is not None and d.font is not None and d.font.color is not None else None
                    eff_fill = lf or fill
                    eff_font = lfont if lfont is not None else font
                    nf, nt = night_pair(eff_fill, eff_font if eff_font in NIGHT_TEXT or eff_font == eff_fill else INK)
                    if _is_bar_rest(rules, k):
                        nf = N_LINE
                    # a rule that draws its own lines (or takes them away) does the same in Night; else the cell's lines
                    if d is not None and d.border is not None:
                        border = _night_border(d.border) or Border(left=Side(), right=Side(), top=Side(), bottom=Side())
                    else:
                        border = _night_border(static)
                    nights.append(Rule(type="expression", formula=[f"AND({NIGHT},{f})"],
                                       dxf=_dxf(nf, nt, d.font if d is not None else None, border)))
                    lights.append(Rule(type="expression", formula=[f], dxf=d, stopIfTrue=False))
            nf, nt = night_pair(fill, font)
            base = Rule(type="expression", formula=[NIGHT], dxf=_dxf(nf, nt, None, _night_border(static)))
            for rule in nights + [base] + lights:
                rule.priority = 0
                new.add(sq, rule)
    ws.conditional_formatting = new


def _sqrefs(cells: set) -> list[str]:
    """One range list per rule set. Long lists are cut in parts, so no program meets a range list too long to read."""
    rects = _ranges(cells)
    return [" ".join(rects[i:i + 200]) for i in range(0, len(rects), 200)]


def is_night(rule) -> bool:
    return NIGHT in rule.formula[0]


def light_rules_at(ws, at: str) -> list:
    """The light rules on the top left cell of `at`, in order: what the tab shows when Look is Light"""
    first = MultiCellRange(at).sorted()[0]
    r, c = first.min_row, first.min_col
    for cf in ws.conditional_formatting:
        if any(cr.min_row <= r <= cr.max_row and cr.min_col <= c <= cr.max_col for cr in cf.sqref.ranges):
            return [x for x in cf.rules if not is_night(x)]
    return []


def rule_count(wb, tabs) -> int:
    return sum(len(cf.rules) for name in tabs for cf in wb[name].conditional_formatting)
