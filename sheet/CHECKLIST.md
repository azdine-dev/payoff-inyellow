# Checks to do by hand before selling the sheet

The tests cover the numbers: LibreOffice recalculates every test file and compares it with `engine/engine_v2.py`.
They can not open Google Sheets, so the Google steps below are yours. Use `sheet/dist/test-nadia.xlsx` for the checks
and `sheet/dist/1-Paycheck-Payoff-Planner.xlsx` for the file you sell.

Rebuild first: `python sheet/build_sheet.py`, then `python -m pytest sheet/tests -q`.

## Before you sell
- Replace `[SUPPORT EMAIL]` in `sheet/layout.py` (`SUPPORT_EMAIL`) with the real address, then rebuild.

## Nadia: what every program must show
- Start, result box: **Fri 16 Jul 2027** on yellow, "First step: move $180 on Fri 6 Nov.", "With minimums only: about
  April 2031.", "That is about 45 months sooner."
- Path, first five moves: 180, 266, 180, 216, 230. Owed after payday 8: 2,067.41. Last payday Fri 16 Jul 2027.
- Debts: Store Card gone Fri 1 Jan 2027, Medical Fri 12 Feb 2027, Visa Fri 16 Jul 2027.
- Type **200** in Actual on the second payday (Fri 20 Nov). Buffer on that row becomes 74, Move stays 266, the debt-free
  date stays Fri 16 Jul 2027, and owed after payday 8 becomes 2,135.26. Clear the cell and the numbers come back.

## Google Sheets (not tested yet)
1. Upload `test-nadia.xlsx` to Google Drive. Right click, Open with, Google Sheets. Then File, Save as Google Sheets.
2. Time it with a watch: open, then type in Actual. The goal is under 3 seconds.
3. Tabs in order: Open me, Start, Today, Path, Debts, Safety net. Engine and Lists stay hidden. Tab colour is sage.
4. Fonts: titles in Bricolage Grotesque, the rest in Inter. If another font shows, tell me which tab.
5. Start: the dropdowns open (currency, pay schedule, payoff order, month). The payoff order has exactly three choices.
   Pick "My own order": the "My order" column appears. Pick another: it fades away.
6. Start: pick the tick in "Show where to type". Every input cell turns sage, never yellow. Clear it.
7. Start: clear a due day. A gray note appears next to that debt. Nothing is red anywhere.
8. Path: pick the tick on a payday. The row turns yellow and struck through, Today, Debts and the tiles change.
9. Path, doughnut: blue for gone, pale sage for left, a clear hole. Tick every payday: the ring turns yellow.
10. Path, area chart: one ink line going down to zero with a sage fill, months along the bottom.
11. If either chart breaks, write down what you see (missing, wrong colour, no hole, wrong labels) and send it to me.
12. Protection: try to type over a formula on Today. See "What can differ" below.
13. File, Share, "Anyone with the link" as Viewer. Change the end of the link from `/edit...` to `/copy`. That is the
    "Make a copy" link for buyers. Open it in a private window to try it.

## Excel (2016 or newer)
1. Open `test-nadia.xlsx`. If a bar asks, press Enable Editing.
2. Look at the dropdowns, the ✓, the yellow rows, the blue outline on the current payday and "Show where to type".
3. Review, Unprotect Sheet works with no password. Protect it again after.
4. File, Print on Today and on Path: one page wide.
5. If you can, repeat on an English Excel and on Excel 2016 itself.

## What can differ, and why
- **Fonts.** Excel only shows Bricolage Grotesque and Inter when they are installed on that computer. Otherwise it uses
  its default font. The layout holds, the titles look plainer.
- **The current payday in Google Sheets.** Google colour rules can not draw borders, so the blue outline shows in Excel
  only. In Google the current row has bold action blue words instead. The thin lines between rows go the same way.
- **Protection in Google Sheets.** The owner of a Google Sheet can always type in a protected cell. A buyer owns their
  copy, so the lock is a guard rail there. In Excel the lock holds.
- **Amounts in words** ("Move $1,234.50") follow the language of the spreadsheet: a French file shows "$1 234,50".
- **The date check** on Start follows the same language setting. That is its job.
- **The small bars** on the Path tiles and on Safety net are block characters, so they depend on the font.
- **The doughnut** can import with a different hole size in Google Sheets.
- **Today's date.** "PAID until the next payday" and the year in dates use the real date, so the same file reads a
  little differently next month. That is intended.

## What was checked on this computer (18 November 2026)
- **LibreOffice 26.8, French:** every test file recalculated, numbers match the engine, no error values.
- **Excel 16.0, French, with an expired license, on the final build:** `test-nadia.xlsx` opened with no error cells on
  the visible tabs and the Nadia numbers above. Typing 200 in Actual gave the same move, buffer, owed, interest and
  debt-free date as `engine_v2.py`. Both charts drew correctly.
- **Excel, on the build one step earlier only:** ticking a payday updated the tiles, and a locked cell on Today refused
  typing. On the final build this part of the run did not finish, and after that this Excel stopped opening saved files
  (older copies too). Do Excel steps 2 and 3 by hand, and try typing over a formula on Today.
- **Not checked:** Google Sheets (nothing at all yet), its speed, Excel printing and PDF (this Excel refused the
  export), the look of dropdowns and colour rules on screen in Excel, an English Excel, and Excel 2016 itself.
