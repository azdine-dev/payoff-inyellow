"""Render workbook.html to US Letter and A4 PDFs, plus PNG previews.
Usage: python3 render.py workbook.html out_dir
Needs: pip install playwright && playwright install chromium (on a machine with internet,
so the Google Fonts load). In this workspace it falls back to local fonts."""
import sys, pathlib
from playwright.sync_api import sync_playwright

src = pathlib.Path(sys.argv[1]).resolve()
out = pathlib.Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
stem = src.stem
sizes = {"US-Letter": ("8.5in", "11in", "0.6in"), "A4": ("210mm", "297mm", "15mm")}

with sync_playwright() as p:
    b = p.chromium.launch()
    for name, (w, h, pad) in sizes.items():
        pg = b.new_page()
        pg.goto(src.as_uri(), wait_until="load")
        pg.add_style_tag(content=f":root{{--w:{w};--h:{h};--pad:{pad}}} @page{{size:{w} {h};margin:0}}")
        pg.evaluate("document.fonts.ready")
        pg.wait_for_timeout(500)
        pg.pdf(path=str(out / f"{stem}-{name}.pdf"), width=w, height=h, print_background=True,
               margin={"top": "0", "right": "0", "bottom": "0", "left": "0"})
        pg.close()
    # previews of each page (Letter)
    pg = b.new_page(viewport={"width": 816, "height": 1056}, device_scale_factor=1)
    pg.goto(src.as_uri(), wait_until="load")
    pg.wait_for_timeout(500)
    for i, el in enumerate(pg.query_selector_all("section.page"), 1):
        el.screenshot(path=str(out / f"preview-{i:02d}.png"))
    b.close()
print("done")
