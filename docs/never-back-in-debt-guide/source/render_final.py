"""Final render of the Never Back in Debt guide with the real brand fonts, offline.

Bricolage Grotesque (headings), Inter (body) and Caveat (handwritten lines) are loaded from the
@fontsource packages in the app's node_modules, so no internet is needed and the result is the same on
every machine. The guide.html source stays as it is (it still points at Google Fonts for editing).

Usage (from the repo root, after `npm install`):
    python docs/never-back-in-debt-guide/source/render_final.py

Writes next to the source:
    ../Never-Back-in-Debt-Guide-US-Letter.pdf, ../Never-Back-in-Debt-Guide-A4.pdf
    previews/preview-01.png ... (US Letter, one PNG per page)
"""
import pathlib, re, sys
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
FONTS = ROOT / "node_modules" / "@fontsource"
OUT = HERE.parent
PREVIEWS = HERE / "previews"

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


def build_html() -> pathlib.Path:
    html = (HERE / "guide.html").read_text(encoding="utf8")
    html = re.sub(r"<link[^>]*fonts\.googleapis\.com[^>]*>\s*", "", html)  # no network, use the local files
    html = html.replace("<style>", "<style>\n" + font_css() + "\n", 1)
    tmp = HERE / "_guide.fonts.html"
    tmp.write_text(html, encoding="utf8")
    return tmp


SIZES = {"US-Letter": ("8.5in", "11in", "0.6in"), "A4": ("210mm", "297mm", "15mm")}

src = build_html()
PREVIEWS.mkdir(exist_ok=True)
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for name, (w, h, pad) in SIZES.items():
            pg = b.new_page()
            pg.goto(src.as_uri(), wait_until="load")
            pg.add_style_tag(content=f":root{{--w:{w};--h:{h};--pad:{pad}}} @page{{size:{w} {h};margin:0}}")
            pg.evaluate("document.fonts.ready")
            pg.wait_for_timeout(600)
            loaded = pg.evaluate("[...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight)")
            print(name, "fonts loaded:", sorted(set(loaded)))
            pg.pdf(path=str(OUT / f"Never-Back-in-Debt-Guide-{name}.pdf"), width=w, height=h, print_background=True,
                   margin={"top": "0", "right": "0", "bottom": "0", "left": "0"})
            pg.close()
        pg = b.new_page(viewport={"width": 816, "height": 1056}, device_scale_factor=1)
        pg.goto(src.as_uri(), wait_until="load")
        pg.evaluate("document.fonts.ready")
        pg.wait_for_timeout(600)
        for i, el in enumerate(pg.query_selector_all("section.page"), 1):
            el.screenshot(path=str(PREVIEWS / f"preview-{i:02d}.png"))
        b.close()
finally:
    src.unlink(missing_ok=True)
print("done")
