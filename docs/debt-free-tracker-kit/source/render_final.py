"""Final render of the Debt-Free Tracker Kit with the real brand fonts, offline.

Bricolage Grotesque (headings), Inter (body) and Caveat (handwritten lines) are loaded from the
@fontsource packages in the app's node_modules, so no internet is needed and the result is the same on
every machine. tracker.html and wallpapers.py stay as they are (they still point at Google Fonts for editing).

Usage (from the repo root, after `npm install`):
    python docs/debt-free-tracker-kit/source/render_final.py

Writes:
    ../Debt-Free-Tracker-Kit-US-Letter.pdf, ../Debt-Free-Tracker-Kit-A4.pdf
    previews/preview-01.png ... (US Letter, one PNG per page)
    ../wallpapers/wallpaper-*.png (4 phone wallpapers, 1170x2532)
"""
import pathlib, re, sys
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
FONTS = ROOT / "node_modules" / "@fontsource"
OUT = HERE.parent
PREVIEWS = HERE / "previews"
WALLPAPERS = OUT / "wallpapers"

FACES = [
    ("Bricolage Grotesque", 700, "bricolage-grotesque/files/bricolage-grotesque-latin-700-normal.woff2"),
    ("Bricolage Grotesque", 800, "bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff2"),
    ("Inter", 400, "inter/files/inter-latin-400-normal.woff2"),
    ("Inter", 500, "inter/files/inter-latin-500-normal.woff2"),
    ("Inter", 600, "inter/files/inter-latin-600-normal.woff2"),
    ("Inter", 700, "inter/files/inter-latin-700-normal.woff2"),
    ("Caveat", 700, "caveat/files/caveat-latin-700-normal.woff2"),
]


def font_css() -> str:
    css = []
    for family, weight, rel in FACES:
        path = FONTS / rel
        if not path.exists():
            sys.exit(f"Missing font file: {path}\nRun `npm install` in the repo root first.")
        css.append(f"@font-face{{font-family:'{family}';font-weight:{weight};font-style:normal;font-display:block;src:url('{path.as_uri()}') format('woff2')}}")
    return "\n".join(css)


def with_local_fonts(html: str) -> str:
    html = re.sub(r"<link[^>]*fonts\.googleapis\.com[^>]*>\s*", "", html)  # no network, use the local files
    return html.replace("<style>", "<style>\n" + font_css() + "\n", 1)


def wallpaper_pages() -> dict:
    """BASE and the 4 designs from wallpapers.py, without running its render."""
    code = (HERE / "wallpapers.py").read_text(encoding="utf8")
    code = code.split("with sync_playwright() as p:")[0]
    code = re.sub(r"^out = .*$", "", code, flags=re.M)
    ns: dict = {"sys": sys, "pathlib": pathlib, "sync_playwright": None}
    exec(compile(code, "wallpapers.py", "exec"), ns)
    # The real Caveat is wider than the draft font: balance the lines so no word is left alone on the last one
    balance = "<style>.hand,.head{text-wrap:balance}</style>"
    return {name: with_local_fonts(ns["BASE"] + balance + body + "</body></html>") for name, body in ns["walls"].items()}


SIZES = {"US-Letter": ("8.5in", "11in", "0.6in"), "A4": ("210mm", "297mm", "15mm")}

tmp = HERE / "_tracker.fonts.html"
tmp.write_text(with_local_fonts((HERE / "tracker.html").read_text(encoding="utf8")), encoding="utf8")
PREVIEWS.mkdir(exist_ok=True)
WALLPAPERS.mkdir(exist_ok=True)
wall_tmp = HERE / "_wallpaper.fonts.html"
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for name, (w, h, pad) in SIZES.items():
            pg = b.new_page()
            pg.goto(tmp.as_uri(), wait_until="load")
            pg.add_style_tag(content=f":root{{--w:{w};--h:{h};--pad:{pad}}} @page{{size:{w} {h};margin:0}}")
            pg.evaluate("document.fonts.ready")
            pg.wait_for_timeout(600)
            loaded = pg.evaluate("[...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight)")
            print(name, "fonts loaded:", sorted(set(loaded)))
            pg.pdf(path=str(OUT / f"Debt-Free-Tracker-Kit-{name}.pdf"), width=w, height=h, print_background=True,
                   margin={"top": "0", "right": "0", "bottom": "0", "left": "0"})
            pg.close()
        pg = b.new_page(viewport={"width": 816, "height": 1056}, device_scale_factor=1)
        pg.goto(tmp.as_uri(), wait_until="load")
        pg.evaluate("document.fonts.ready")
        pg.wait_for_timeout(600)
        for i, el in enumerate(pg.query_selector_all("section.page"), 1):
            el.screenshot(path=str(PREVIEWS / f"preview-{i:02d}.png"))
        pg.close()

        # Phone wallpapers: loaded from a file so the local font files are allowed
        pg = b.new_page(viewport={"width": 1170, "height": 2532})
        for name, html in wallpaper_pages().items():
            wall_tmp.write_text(html, encoding="utf8")
            pg.goto(wall_tmp.as_uri(), wait_until="load")
            pg.evaluate("document.fonts.ready")
            pg.wait_for_timeout(400)
            pg.screenshot(path=str(WALLPAPERS / f"wallpaper-{name}.png"))
        b.close()
finally:
    tmp.unlink(missing_ok=True)
    wall_tmp.unlink(missing_ok=True)
print("done")
