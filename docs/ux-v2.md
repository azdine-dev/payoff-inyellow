# PaidInYellow app · UX v2 (simpler, payday-first)

Put this file at `docs/ux-v2.md` and tell Claude Code: "Read docs/ux-v2.md and apply it." Where it disagrees with CLAUDE.md section 5 (screens), this file wins. **The engine (CLAUDE.md section 6), the fixtures, the data model and every rule in section 2 stay exactly as they are.** This is a UI change only.

Mockups: the "PaidInYellow app v2" design canvas (7 phone screens).

---

## 0. The idea in one line

Every screen answers one question, and the app has one daily action: **"I did it."**

| Screen | The one question it answers |
|---|---|
| Today | What do I move this payday? |
| Path | When am I done, and how far have I come? |
| Debts | What do I owe, and in what order? |
| Safety net | Am I protected from the next surprise bill? |

What we learned from competitors:
- **AY Studios** has 13 sidebar items, 6 methods and a credit score page. It looks rich in a listing and feels heavy to a stressed beginner. Its what-if card is excellent (new date, months saved, interest saved, one "apply" button): keep that pattern.
- **Undebt.it and Debt Payoff Planner** are powerful and monthly, with tables. Nobody leads with "this payday".
- **Copilot Money** wins on calm design: one big number, soft cards, smooth motion, big touch targets. Borrow the feel, not the features.
- Our edge stays: payday-first, buffer first, yellow = paid, no loans, no account.

---

## 1. Navigation: 5 tabs become 4

`Today · Path · Debts · Safety net` (Settings stays behind the icon on Today).

- **Plan + Progress merge into Path.** Today they repeat each other (both show paydays, both show the date).
- **Money is renamed Safety net.** "Money" is vague; "Safety net" says why it exists.
- Active tab: a soft `--line` pill behind the icon plus bold ink label. **Not yellow** (yellow means paid).
- Icons: inline stroke SVG, 1.9px, ink. Labels always visible.

---

## 2. Setup: 9 steps become 4

Goal: debt-free date in **under 5 minutes**, not 15. Everything else moves after the result as optional chips on Today.

| Step | Asks | Notes |
|---|---|---|
| 1 · Pay | How often you're paid, next payday | Currency auto-detected and shown as a small "USD · change" link, not a step. Twice-a-month asks for the two days here. Welcome copy sits on top of this step, not its own screen. |
| 2 · Debts | Name, balance, rate, minimum, due day | Already-added debts collapse into one-line rows above the form. Numeric keypad (`inputmode="decimal"`). Rate empty → use 24%, mark the debt "rate missing", and show a chip on Today to fix it. Button: "That's all of them". |
| 3 · Money | Money for the plan each payday, plus buffer now and goal | One screen. Chips for the plan amount: $20 · $50 · $100 · $150 · Other. Buffer goal defaults to $500. |
| 4 · Your date | The result screen | See below. |

Moved out of setup (they appear as "Do these later" chips on the result screen and as a small checklist card on Today until done):
- Yearly bills
- Payday reminder (the if-then line and the .ics file)
- Save a backup
- Payoff order: default is PaidInYellow order. The comparison only shows on Path when the comparison rule in CLAUDE.md says biggest interest first saves enough.
- Fresh start choice: default "this payday". Offer "start on the 1st" as a link on the result screen.

**Result screen:** debt-free month on a solid yellow swipe (slight -1.2° tilt), one line for minimums only, two small tiles (months sooner, less interest), the dark "Your first step" card, the "Do these later" chips, "Start my plan".

---

## 3. Today

Top to bottom:
1. Greeting by context: "Hi, it's payday." on a payday, "Next payday is Fri 7 Nov." otherwise.
2. Debt-free pill ("Debt-free by Mar 2028", the month on yellow). Taps through to Path.
3. **The payday card** (ink background, the one main thing on the screen):
   - Label "This payday, move", the total in Bricolage 56px, and "The extra $250 goes to Store Card".
   - The lines with checkboxes: one row per debt (bill and extra merged into one row per debt, e.g. "Store Card · Bill $35 + extra $250 · due Sun 2 Nov · $285"), then the yearly bills pot, then the buffer if it isn't full.
   - Big paper-colored button "I did it · $370" (56px tall).
   - Two small links: "I got a different amount" and "Skip this payday".
4. Focus debt card: name, $ left, yellow % bar, "gone by" date, one plain line ("64% gone. After today, one payday left.").
5. Two tiles: daily cost ("$3.12 a day, last month $3.48") and safety net status.
6. Coming up: due dates in the next 14 days.
7. Caveat line "one paycheck at a time".

Between paydays the payday card shrinks to a calm countdown ("Next payday Fri 7 Nov · 14 days") so the screen never shows a button there's nothing to do with.

---

## 4. The "I did it" moment

This is the moment people come back for. Make it feel good.
- The ink card flips to yellow with a stamped "✓ PAID" (rotated -4°), the total stays visible, each line gets a check.
- Short motion: 300ms highlighter swipe across the card. A light vibration (`navigator.vibrate(15)`) where supported. Respect `prefers-reduced-motion`.
- An **Undo** link for 10 seconds. No confirm dialogs anywhere in the app; use undo instead.
- One progress sentence: "Store Card has $35 left. It's gone next payday. Then its $35 rolls to Visa."
- Countdown card to the next payday: "Nothing to do until then."
- Backup nudge right after the first and then every 4th "I did it": "Your plan lives only on this phone. Save a copy." This replaces hunting for backup in Settings.
- When a debt hits zero: full-width yellow card "PAID. One down.", then the next debt slides into focus.

---

## 5. Path (Plan + Progress)

1. Header: "Your path", debt-free month on yellow, paydays left.
2. Progress card: big % gone, yellow bar, three numbers (paid, to go, interest avoided).
3. Payday grid: one square per payday, 10 per row, paid = yellow with ink border, current = ink outline, future = `--line`. Two squares pre-filled (endowed progress).
4. What's ahead: a short timeline of milestones only ("Store Card gone · Fri 7 Nov 2026", "Halfway there · around Jun 2027", "Debt-free · Mar 2028"). Months for anything further than 3 months away; never fake precision.
5. Two buttons: "What if I add more?" (opens a bottom sheet with the slider, one-off money and "Use this in my plan") and "Payday list" (the full payday-by-payday list, tap a payday to expand).
6. Small line: "Order: smallest first · change" and "Print or export".

The method comparison appears here only when the comparison rule fires, as one sentence with a "Switch" button.

---

## 6. Debts

- Header: "$9,310 left · in the order you pay them", round "+" button to add.
- Cards in payoff order with a position tag: "1 · Paying now" (ink tag, ink border), "2 · Next", "3 · Later".
- Each card: name, $ left, yellow % bar, "gone by", one small line (rate, bill amount and day).
- Tap a card → bottom sheet: Update from my statement, Add a new charge or fee (with the Everyday / Emergency / One-off tag), Edit, Archive.
- Paid debts move to the bottom, yellow, struck through, with the PAID stamp.
- Debt that grows: a calm ink note on the card, "Grows even with the minimum, so it goes first." No red, no warning icon.

---

## 7. Safety net

1. Surprise buffer: big amount, "of $500 · ready" (ready on yellow when full), bar, the plain-account line, big button "I used some of it".
2. Yearly bills: one row per bill with saved / target and month needed; ink bars (they're savings in progress, not paid); "I paid a bill" and "+ Add a bill".
3. "Find your first $500" as one row that opens the checklist.
4. One plain line: "Debt payments are 18% of your take-home pay." (only when the paycheck amount is set).

---

## 8. Settings: shorter

Group into 4 sections, each a list of rows that open sheets:
- **Your plan:** pay schedule, money for the plan, buffer goal, usual paycheck, payoff order, currency, payday reminder.
- **Keep it safe:** save a backup (shows "Last saved 3 days ago"), restore, sync between devices, put it on your phone.
- **Look:** theme, text size.
- **Help:** FAQ, email support, unlock code, about and disclaimer, erase everything.

The "update is ready" banner shows on Today as a small dismissible bar, not only inside Settings.

---

## 9. Bugs found on app.paidinyellow.com (21 Oct 2026)

1. **Archived debts break the totals.** With the only debt archived: Today says "You're debt-free", Plan says "more than 20 years", Progress says "$0 of $0" with every milestone ticked. Rule: archived debts leave every total, simulation and milestone. If no active debts remain, every screen shows the debt-free state.
2. **Milestones all dated the same day** (Tue 20 Oct) and "Last payment" ticked with $0 paid. Milestones need real dates from the payment log and must not tick on an empty plan.
3. **Dates without a year.** "next Fri 8 Oct" looked like a missed payday; it was 2027. Show the year whenever the date isn't in the current year.
4. **Progress shows the paydays as "list / plan"** toggles with no clear meaning. Removed by the Path redesign.

---

## 10. Modern touches (small, cheap, high impact)

- Bottom sheets for every edit, never full page forms (thumb-friendly, easy to dismiss).
- Numbers count up when they change (200ms), tabular figures always.
- Skeleton-free: the engine is instant, so render immediately.
- Pull nothing from the network after install. Fonts self-hosted in the service worker cache.
- Undo instead of "Are you sure?" dialogs (except Erase everything).
- `env(safe-area-inset-bottom)` padding under the tab bar.
- Dark mode: ink background, the payday card becomes a slightly lighter ink (#2A3654), yellow keeps its meaning.

---

## 11. What we keep saying no to

Six methods, credit score tracking, balance transfer and consolidation simulators, a sidebar, a monthly calendar grid, red numbers, accounts and logins.

---

## 12. Done means

- A new user reaches the debt-free date in 4 steps and under 5 minutes.
- Today shows one total and one big button.
- "I did it" flips the card to yellow with Undo available.
- 4 tabs. No yellow used for navigation or decoration.
- Archived or paid debts never produce contradictory totals across screens.
- All Playwright flows still pass and the engine fixtures still pass unchanged.
