# PaidInYellow app · final changes from the competitor review

Paste everything below the line into Claude Code, in the repo root.
Before you start, put `engine_v2.py`, `fixtures_v2.json` and `ENGINE-V2-FOR-CLAUDE-CODE.md` in `engine/`.

---

Read CLAUDE.md, docs/ux-v2/ux-v2.md and engine/ENGINE-V2-FOR-CLAUDE-CODE.md first.
This is the last change list before beta. Do it in the order below, one commit per part,
and run all tests after each part. Show me a short table at the end:
part · done or not · what changed · anything you had to decide.

Rules for every part: keep the 4 tabs (Today, Path, Debts, Safety net). Add no new screens
except where a part says so. No red anywhere. Yellow only for paid, done or the one key word.
No loans, transfers, credit score or utilization features. All copy follows CLAUDE.md
section 10 (short, calm, no dashes, no exclamation marks). Respect prefers-reduced-motion.

## Part 1 · Engine v2, the trust fix (approved)
Port engine/engine_v2.py exactly. Bills are paid on the payday before their due date,
balances move only by what is paid plus interest, and the freed-up minimum rolls into the extra.
Make all 7 fixtures in fixtures_v2.json pass (dates exact, amounts to the cent). Remove the
averaged-minimum code. The due day becomes required before the plan starts. Update CLAUDE.md
section 6. The step-by-step test must still equal one full simulation.

## Part 2 · Today
1. Show the full payday card until the user's first "I did it" ever, and from 2 days before
   each payday. Otherwise show the countdown and a small "Mark it done early" link.
2. After "I did it", Today stays in the yellow PAID state until the next payday. Keep a small
   "Change what I paid" link on that card until the next payday (opens the "I got a different
   amount" sheet). Keep the 10 second Undo.
3. The "update ready" bar uses ink text on --card, never yellow, and never shows on a first open.
4. Whole numbers on big totals. "6 paydays left" on days that are not paydays.

## Part 3 · Path (from AY Studios, HayeCreatives, the pink and green sheets, Ultimate 2.0)
1. A row of 4 small tiles at the top: Owed now · Debt-free date · Paid off so far · Interest you
   avoid. Each opens its detail.
2. Next to the % gone: "Debts paid 2 of 4".
3. Tapping the countdown switches between "14 months left" and "1.2 years left". Remember the choice.
4. "Pay a bit more?" table with 4 rows: +20, +50, +100, +200 per payday. Each row shows the new
   date, months sooner and interest saved, plus "Use this". Keep the slider and one-off money below it.
5. A "Next milestone" card above the milestones list ("Next: Store Card gone · Fri 7 Nov").
6. "This month: $250 of $250 planned".
7. Payday list: paid rows yellow and crossed out, the current one outlined.

## Part 4 · Debts
1. A small progress ring on each debt card, plus its "gone by" date.
2. Paid debts move to the bottom, yellow, crossed out, with the PAID stamp.
3. A History list inside each debt (bottom sheet): payments, new charges and statement updates,
   with dates. Read-only.

## Part 5 · Wide screens
Above 900px wide, show a slim side menu instead of the bottom tabs, with Today and Path side by
side. Phones stay exactly as they are. This is for laptop and iPad use and for listing images.

## Part 6 · Every number is a door
Make the debt-free pill, the focus debt card, the safety net tile and every Path tile tappable,
each opening the place where that number lives.

## Done means
- All engine fixtures v2 and all Playwright tests pass. Add tests for parts 2, 3.2 to 3.4 and 4.2.
- A new user sees "This payday: move $X" with one button within 5 minutes of opening the app.
- After "I did it", reloading the app shows the yellow PAID state, never a new active button.
- No red, no new tab, and no feature from the "never" list in CLAUDE.md.
