# Final render (with the real brand fonts)

The PDFs in the folder above are the final ones: Bricolage Grotesque for headings, Inter for body text and Caveat for the handwritten lines.

To make them again, from the repo root (needs `npm install` once, for the font files, and `pip install playwright` + `playwright install chromium`):

    python docs/7-day-debt-reset/source/render_final.py

It loads the fonts from `node_modules/@fontsource`, so it works offline and looks the same on every machine. You get `7-Day-Debt-Reset-US-Letter.pdf` and `7-Day-Debt-Reset-A4.pdf` next to the source, and one PNG preview per page in `previews/`.

Edit the text in `workbook.html`. Keep: no red, yellow only for done or the key word, no em dashes.

(`render.py` is the old draft script. It needs internet for Google Fonts.)
