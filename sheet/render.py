"""Pictures of every tab with Nadia, and the same tab from design/ beside it, for checking the look.

    python sheet/render.py [out_folder] [--fonts FOLDER]     (default sheet/dist/preview)

--fonts: a folder of .ttf files (Inter and Bricolage Grotesque, Regular and Bold). On Windows they are added for this
session only while LibreOffice draws (AddFontResource), then removed again: nothing is installed.

Builds one Nadia file per tab (only that tab visible), lets LibreOffice turn each into a PDF one page wide, and joins
the pages into one PNG per tab (needs pymupdf and Pillow). When Chrome or Edge is installed, design/<Tab>.html is
also drawn headless and a side by side picture is saved. The fonts are the ones installed on this computer.
"""
from __future__ import annotations

import datetime as dt
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_sheet  # noqa: E402
import recalc  # noqa: E402
from layout import DB_FOOT, NCOL, P_R1, S_FOOT, SN_FOOT, T_FOOT, TABS  # noqa: E402
from openpyxl.utils import get_column_letter as L  # noqa: E402
from scenarios import NADIA  # noqa: E402

ROOT = os.path.dirname(HERE)
LAST_ROW = {"Open me": 29, "Start": S_FOOT, "Today": T_FOOT, "Path": P_R1 + 22, "Debts": DB_FOOT, "Safety net": SN_FOOT}
DESIGN = {"Open me": "OpenMe", "Start": "Start", "Today": "Today", "Path": "Path", "Debts": "Debts", "Safety net": "SafetyNet"}
BROWSERS = [r"C:\Program Files\Google\Chrome\Application\chrome.exe", r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]


def one_tab(path: str, tab: str, ticks: int, today: dt.date):
    """A Nadia file where only `tab` is visible and prints one page wide, with small margins"""
    build_sheet.build(path, dict(NADIA, whatif=50), ticks=ticks, today=today, prepare=lambda wb: only(wb, tab))  # 50 typed in What if


def only(wb, tab: str):
    for ws in wb:
        if ws.title != tab:
            ws.sheet_state = "hidden"
            ws.print_area, ws._print_rows = None, None  # a print area would print the tab even when hidden
    ws = wb[tab]
    wb.active = wb.sheetnames.index(tab)
    ws.print_area = f"A1:{L(NCOL)}{LAST_ROW[tab]}"
    ws.print_title_rows = None
    ws.page_setup.orientation = "landscape"
    ws.page_setup.paperSize = ws.PAPERSIZE_LETTER
    ws.page_setup.fitToWidth, ws.page_setup.fitToHeight = 1, 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_margins.left = ws.page_margins.right = ws.page_margins.top = ws.page_margins.bottom = 0.2
    ws.page_margins.header = ws.page_margins.footer = 0
    ws.oddHeader.center.text = ws.oddFooter.center.text = None


def stitch(pdf: str, png: str, dpi: int = 110):
    import pymupdf
    from PIL import Image
    doc = pymupdf.open(pdf)
    parts = []
    for page in doc:
        pix = page.get_pixmap(dpi=dpi)
        parts.append(Image.frombytes("RGB", (pix.width, pix.height), pix.samples))
    doc.close()
    out = Image.new("RGB", (max(p.width for p in parts), sum(p.height for p in parts)), "white")
    y = 0
    for p in parts:
        out.paste(p, (0, y))
        y += p.height
    out.save(png)


def design_png(tab: str, png: str) -> bool:
    browser = next((b for b in BROWSERS if os.path.exists(b)), None)
    html = os.path.join(ROOT, "design", DESIGN[tab] + ".html")
    if not browser or not os.path.exists(html):
        return False
    profile = tempfile.mkdtemp(prefix="piy-browser-")
    try:
        subprocess.run([browser, "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--user-data-dir={profile}",
                        "--window-size=1280,900", "--virtual-time-budget=4000", f"--screenshot={png}",
                        "file:///" + html.replace(os.sep, "/")], check=True, timeout=120, capture_output=True)
    finally:
        shutil.rmtree(profile, ignore_errors=True)
    return os.path.exists(png)


def side_by_side(left: str, right: str, png: str, width: int = 1100):
    from PIL import Image, ImageDraw
    a, b = Image.open(left).convert("RGB"), Image.open(right).convert("RGB")
    a = a.resize((width, round(a.height * width / a.width)))
    b = b.resize((width, round(b.height * width / b.width)))
    out = Image.new("RGB", (width * 2 + 30, max(a.height, b.height) + 40), "white")
    d = ImageDraw.Draw(out)
    d.text((10, 12), "design/" + os.path.basename(left).replace("design-", "").replace(".png", ".html"), fill=(60, 60, 60))
    d.text((width + 40, 12), "the sheet, Nadia, rendered by LibreOffice", fill=(60, 60, 60))
    out.paste(a, (0, 40))
    out.paste(b, (width + 30, 40))
    out.save(png)


class session_fonts:
    """Fonts for this Windows session only, removed on exit"""
    def __init__(self, folder: str | None):
        import glob
        self.files = sorted(glob.glob(os.path.join(folder, "*.ttf"))) if folder and os.name == "nt" else []

    def __enter__(self):
        import ctypes
        for f in self.files:
            ctypes.windll.gdi32.AddFontResourceW(f)

    def __exit__(self, *exc):
        import ctypes
        for f in self.files:
            ctypes.windll.gdi32.RemoveFontResourceW(f)


def render(out: str, ticks: int = 1, today: dt.date = dt.date(2026, 11, 20), fonts: str | None = None) -> list[str]:
    src, pdfs = tempfile.mkdtemp(prefix="piy-render-"), tempfile.mkdtemp(prefix="piy-pdf-")
    names = {tab: tab.replace(" ", "-") for tab in TABS}
    for tab in TABS:
        one_tab(os.path.join(src, names[tab] + ".xlsx"), tab, ticks, today)
    os.makedirs(out, exist_ok=True)
    with session_fonts(fonts):
        recalc.recalc_folder(src, pdfs, fmt="pdf", locale="en-US")  # numbers and dates as in the US
    made = []
    for i, tab in enumerate(TABS):
        png = os.path.join(out, f"{i + 1}-{names[tab]}.png")
        stitch(os.path.join(pdfs, names[tab] + ".pdf"), png)
        made.append(png)
        design = os.path.join(out, f"design-{DESIGN[tab]}.png")
        if design_png(tab, design):
            pair = os.path.join(out, f"{i + 1}-{names[tab]}-side-by-side.png")
            side_by_side(design, png, pair)
            made.append(pair)
    shutil.rmtree(src, ignore_errors=True)
    shutil.rmtree(pdfs, ignore_errors=True)
    return made


if __name__ == "__main__":
    args = sys.argv[1:]
    fonts = None
    if "--fonts" in args:
        i = args.index("--fonts")
        fonts = args[i + 1]
        del args[i:i + 2]
    target = args[0] if args else os.path.join(HERE, "dist", "preview")
    for p in render(target, fonts=fonts):
        print(p)
