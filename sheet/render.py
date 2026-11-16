"""Pictures of every tab, for checking the look and for the listing images.

    python sheet/render.py [out_folder]

Builds the Nadia file with every tab set to print one page wide, lets LibreOffice turn it into a PDF, and saves one
PNG per page (needs the pymupdf package). The fonts are the ones installed on this computer.
"""
from __future__ import annotations

import datetime as dt
import os
import shutil
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_sheet  # noqa: E402
import recalc  # noqa: E402
from layout import P_R1, TABS  # noqa: E402
from scenarios import NADIA  # noqa: E402


def render(out: str, ticks: int = 2, today: dt.date = dt.date(2026, 11, 21)) -> list[str]:
    import pymupdf

    src = tempfile.mkdtemp(prefix="piy-render-")
    path = os.path.join(src, "nadia.xlsx")
    build_sheet.build(path, NADIA, ticks=ticks, today=today, fit_all=True)
    os.makedirs(out, exist_ok=True)
    pdf = recalc.recalc_folder(src, out, fmt="pdf")[0]
    pages = []
    doc = pymupdf.open(pdf)
    for i, page in enumerate(doc):
        png = os.path.join(out, f"page-{i + 1:02d}.png")
        page.get_pixmap(dpi=110).save(png)
        pages.append(png)
    doc.close()
    shutil.rmtree(src, ignore_errors=True)
    return pages


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist", "pictures")
    for p in render(target):
        print(p)
