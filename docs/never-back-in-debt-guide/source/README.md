# Final render (with the real brand fonts)

The PDFs in the folder above are the final ones: Bricolage Grotesque for headings, Inter for body text and Caveat for the handwritten lines.

To make them again, from the repo root (needs `npm install` once, for the font files, and `pip install playwright` + `playwright install chromium`):

    python docs/never-back-in-debt-guide/source/render_final.py

It loads the fonts from `node_modules/@fontsource`, so it works offline and looks the same on every machine. You get `Never-Back-in-Debt-Guide-US-Letter.pdf` and `Never-Back-in-Debt-Guide-A4.pdf` next to the source, and one PNG preview per page in `previews/`.

Edit the text in `guide.html`. Before selling, check page 13 (the Promise) matches your shop's refund policy and support reply time.

(`render.py` is the old draft script. It needs internet for Google Fonts.)
