# Checks to do by hand before selling the sheet

The tests cover the numbers (LibreOffice recalculates every file and compares it with `engine/engine_v2.py`).
They can not open Google Sheets or your Excel, so these steps are yours. Use `sheet/dist/test-nadia.xlsx` for the
checks and `sheet/dist/1-Paycheck-Payoff-Planner.xlsx` for the file you sell.

Rebuild first: `python sheet/build_sheet.py`, then `python -m pytest sheet/tests -q`.

## Nadia: what every program must show
- Start, result box: **Fri 16 Jul 2027** on yellow, "First step: move $180 on Fri 6 Nov.", "With minimums only: about
  April 2031.", "That is about 45 months sooner."
- Path, first five moves: 180, 266, 180, 216, 230. Last payday Fri 16 Jul 2027, move 119.93.
- Debts: Store Card gone Fri 1 Jan 2027, Medical Fri 12 Feb 2027, Visa Fri 16 Jul 2027.
- Safety net: $200 of $500 before any tick. Gifts and holidays 260 a year, 10 each payday.

## Google Sheets
1. Upload `test-nadia.xlsx` to Google Drive. Right click, Open with, Google Sheets. Then File, Save as Google Sheets.
2. Time it: it should open and settle in under 3 seconds.
3. Tabs in order: Open me, Start, Today, Path, Debts, Safety net. Engine and Lists stay hidden. Tab colour is sage.
4. Fonts: titles in Bricolage Grotesque, the rest in Inter. If Google shows another font, pick them once from the font
   menu (More fonts) and tell me, so the build can be adjusted.
5. Start: the four dropdowns open (currency, pay schedule, payoff order, month). The payoff order has exactly three
   choices. Pick "My own order": the "My order" column appears. Pick another: it fades away.
6. Start: "Show where to type": pick the tick, every input cell turns sage (not yellow). Clear it, they turn white.
7. Start: the line under the next payday says how dates are read. Type a payday both ways and check Path follows.
8. Start: clear a due day. A gray note appears next to that debt. Nothing is red anywhere.
9. Path: pick the tick on the first payday. The row turns yellow and struck through, the next row gets a blue line
   above and below, Today says PAID (or the next Move once that payday has come), Debts and the four tiles change.
10. Path: the chart shows one line going down to zero, with a sage fill. If it is missing or broken, tell me and I
    drop the chart from the build.
11. Debts: each bar is ten small cells, blue for progress. Tick every payday: rows turn yellow with PAID.
12. Protection: try to type over a formula on Today. See "What can differ" below.
13. File, Share, "Anyone with the link" as Viewer. Change the end of the link from `/edit...` to `/copy`. That is
    the "Make a copy" link for buyers. Open it in a private window to try it.

## Excel (2016 or newer)
1. Open `test-nadia.xlsx`. If a bar asks, press Enable Editing.
2. Check the Nadia numbers above, the dropdowns, the tick, the yellow rows, the chart and "Show where to type".
3. Review, Unprotect Sheet works with no password. Protect it again after.
4. File, Print on Today and on Path: one page wide.

## What can differ, and why
- **Fonts.** Excel only shows Bricolage Grotesque and Inter when they are installed on that computer. Otherwise it
  falls back to its default font. The layout holds, the titles look plainer.
- **Protection in Google Sheets.** The owner of a Google Sheet can always type in a protected cell (Google shows a
  warning at most). A buyer owns their copy, so the lock is a guard rail there, not a wall. In Excel the lock holds.
- **Amounts in words** ("Move $1,234.50") follow the language of the spreadsheet: a French file shows "$1 234,50".
  The numbers are the same.
- **The date check** on Start follows the same language setting. That is its job: it tells the buyer which way
  their file reads dates.
- **The bars made of block characters** (Path and Safety net) depend on the font having those characters. If they
  look odd in Google Sheets, tell me and I switch them to cells like on Debts.
- **The chart** is the most fragile part across programs. The plan does not depend on it.
- **The current payday outline** uses a rule with ROW(). It works in Excel and LibreOffice. Check it in Google Sheets
  (step 9).
- **Today's date.** "PAID until the next payday" and the year in dates use the real date, so the same file reads a
  little differently next month. That is intended.

## What was checked on this computer
- LibreOffice 26.8 (French): every test file recalculated, numbers match the engine, no error values.
- Excel 16.0 (French): `test-nadia.xlsx` opened and recalculated in about 3 seconds, the Nadia numbers above are
  right, no error cells on the visible tabs, the chart is there, protection is on.
- Not checked here: Google Sheets, and an English Excel.
