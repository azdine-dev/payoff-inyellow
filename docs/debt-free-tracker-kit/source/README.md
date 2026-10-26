# Final render (with the real brand fonts)

The PDFs and wallpapers in the folder above are the final ones: Bricolage Grotesque for headings, Inter for body text and Caveat for the handwritten lines.

To make them again, from the repo root (needs `npm install` once, for the font files, and `pip install playwright` + `playwright install chromium`):

    python docs/debt-free-tracker-kit/source/render_final.py

It loads the fonts from `node_modules/@fontsource`, so it works offline and looks the same on every machine. You get `Debt-Free-Tracker-Kit-US-Letter.pdf` and `Debt-Free-Tracker-Kit-A4.pdf` next to the source, one PNG preview per page in `previews/`, and the 4 phone wallpapers (1170x2532) in `../wallpapers/`.

Every amount is left blank, so the kit works in any currency. Edit the text in `tracker.html` (pages) and `wallpapers.py` (wallpapers).

(`render.py` is the old draft script. It needs internet for Google Fonts.)
