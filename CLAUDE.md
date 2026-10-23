# PaidInYellow · Paycheck Payoff Planner (app) · build brief

UI changes: docs/ux-v2/ux-v2.md replaces section 5 (screens). Match the PNGs in docs/ux-v2/mockups/. Engine, data model and section 2 rules stay unchanged.

This file is the brief for building the **Paycheck Payoff Planner**, the core product of PaidInYellow. It's a phone-first offline web app (PWA). Put this whole folder at the root of the new repo. Claude Code reads this file automatically.

Everything here comes from the research and design work done in the PaidInYellow project (Oct 11-15, 2026). When this file and an older document in `docs/` disagree, this file wins. It is the latest version.

**Owner:** Azeddin, the founder. Azeddin is a developer, runs a faceless brand (no face, no personal story), and often works from a phone.

---

## 0. What's in this kit

| Path | What it is |
|---|---|
| `CLAUDE.md` | This brief. |
| `engine/engine_reference.py` | Reference payoff engine in Python. It's the exact model used by the Google Sheet. The app engine is a port of it. |
| `engine/fixtures.json` | 6 test scenarios with the correct outputs. 4 were checked cell by cell against the Google Sheet. 2 are the classic "$8,000 at 24%" checks (56 months / $5,315 interest and 17 months / $1,500). Run `python3 engine/engine_reference.py engine/fixtures.json` and all 6 should pass. |
| `docs/app-test-scenario-darija.docx` | Azeddin's hands-on test of the finished app (Darija): one story with the exact numbers each screen must show. Use it as the Playwright end-to-end script too. |
| `brand/` | Logo files (SVG + PNG): wordmark for light backgrounds, wordmark for dark backgrounds, transparent wordmark, pay-stub icon, "p" icon, lockup, logo board, palette image. |
| `mockups/01-core-app-screens.png` | Approved look for 3 app screens: setup result, Today, Progress. Match this style. |
| `mockups/00-pack1-board.png` | The whole Pack 1 at a glance. |
| `mockups/preview-*.png` | The finished Google Sheet bonus (same math, same words). |
| `docs/` | Source documents: app + sheet structure, product design (screen by screen), expert review (the research behind each feature), coverage audit, system architecture, Trust Kit (promise + FAQ), competitor summary, and the Google Sheet itself (`Paycheck-Payoff-Planner.xlsx`). |

---

## 1. The business in one page

**Brand:** PaidInYellow (paidinyellow.com). Slogan: **"One paycheck at a time."**
Product titles keep the search words "paycheck payoff" and "debt payoff / credit card payoff".

**Who it's for:** US households living paycheck to paycheck who carry credit card debt. They are paid weekly or every 2 weeks, they're stressed, many are bad with numbers or feel that way, and they've usually tried a spreadsheet and given up. The second audience (Pack 2, later) is couples paying off debt together.

**The pain, in their words** (from 1,875 Reddit posts plus our own validation posts):
- "I pay my credit cards every month, but the balance never goes down, and one surprise bill sends me back to zero." This is our main pain line.
- "I don't know how much I can put toward debt this paycheck."
- "Which debt do I pay first?" and "When will this ever end?" (no debt-free date)
- "Spreadsheets are too much work and full of errors, and I'm bad with numbers."
- Progress is invisible: interest hides the payments, so motivation dies mid-way.
- A surprise bill (car, medical) goes back on the card, and they relapse.

**The dream outcome:** a buyer opens the app, spends about 15 minutes, and sees their debt-free date. Every payday after that they know exactly what to do ("This payday: pay $150 to Store Card"), with a buffer that keeps surprise bills off the cards. Each payment turns yellow, debts disappear one by one, and they don't fall back.

**The promise:** "Your debt-free date in 15 minutes, and a clear amount to pay every payday. No math, no account, no bank login."

**Positioning:** "We help paycheck-to-paycheck families become debt-free one paycheck at a time, without math stress, shame or a monthly subscription."
Listing line: "They show you a spreadsheet of your debt. PaidInYellow tells you what to pay this payday, protects you from the next surprise bill, and turns every paid payment yellow."

**Why we win** (from the competitor analysis of the top Etsy sellers: HayeCreatives, My Productive Life Co, AYxSTUDIOS, This Girl Budgets; plus EveryDollar, YNAB and Simplifi):
1. **Per paycheck, not per month.** Nobody else plans by payday.
2. **Buffer first, plus predictable yearly bills.** Nobody else protects against the surprise bill, and the surprise bill is the #1 reason people fall back.
3. **One clear next step.** Competitors are either dense sheets or 15-screen apps. We have 3 payoff methods, not 6.
4. **Yellow = paid.** A visual idea we own.
5. **No borrowing advice, ever.** AYxSTUDIOS pushes balance transfers and consolidation loans. We don't, which is a trust and halal difference.
6. **One-time price, no subscription, no bank login, data stays on the phone.** That's our angle against YNAB and EveryDollar.

A "real app" is no longer an edge by itself: AYxSTUDIOS already sells an offline HTML app. Our edge is the payday-first flow, the buffer, simplicity and the brand.

**What the buyer gets (Pack 1, "The Paycheck Payoff System", 4 layers):**
1. Core: this app, plus the Google Sheet as a bonus.
2. Execution: the 7-Day Debt Reset (workbook PDF, emails, payday ritual card).
3. Acceleration: the Debt-Free Speed Kit (printables).
4. Safety: the Never Back in Debt guide, a quick-start video and the PaidInYellow Promise.

The app links to these products but doesn't contain them.

**Sales:** Shopify on paidinyellow.com is the main store. Etsy (and maybe Gumroad) is a cheap front door. Real prices in this market are about $3-10 after discounts. Final price: Azeddin decides.

---

## 2. Rules that never change

**Money and ethics (halal).** These are the founder's conviction and a brand promise.
- Never suggest, link or advertise loans, balance transfers, 0% cards, consolidation loans, debt settlement, payday loans or credit card offers. No affiliate links.
- Never recommend interest-earning accounts. The buffer goes in "a plain separate account or an envelope".
- Paying off debt is fine: it helps people get out of interest.
- When the plan can't work (minimums are higher than the money available), the app shows "Your plan needs help" and points to hardship programs and nonprofit credit counseling (NFCC.org in the US). It never points to a loan.
- No religious rulings in the app.

**Claims.**
- No "guaranteed", no "100%", no "debt-free in X months" promises. Figures are estimates based on what the user enters.
- Footer or about line: "A planning tool, not financial advice."
- Stats we may use (verified): $1.26T US credit card debt (NY Fed, Q2 2026); 37% of adults can't cover a $400 surprise with cash (Fed SHED 2025); paying the smallest debt first makes people more likely to finish (Gal & McShane 2012, about 6,000 people in a debt program).

**Tone.** Calm, warm and plain, like a friend who is good with money.
- No shame and no alarm. No red anywhere: no red text, no red badges, no red numbers. Overdue or missed items use ink and calm words.
- Short sentences, no jargon. When a money word is needed, explain it in a few words.
- Never "you failed". A missed payday gets "Life happens. Never miss twice. Here's your updated date."
- Writing style for every string: no em dashes or en dashes, no "not X but Y" constructions, no hype words, no exclamation spam.

**Privacy.**
- No account, no bank login, no analytics that send personal numbers anywhere. Pack 1 works with no server at all.
- "Your numbers never leave this device." This stays true until the buyer turns on the optional sync. With sync on, the app says "Your numbers are locked on this device before they sync. The server can't read them." Sync is encrypted on the phone (AES-GCM); the key travels only in the link or QR code (after the #), never to the server. "Stop syncing and delete my server data" is always in Settings.

---

## 3. Design system

Approved look: `mockups/01-core-app-screens.png`. The palette is called "Pay Stub & Highlighter".

```css
:root {
  --paper:  #F4F0E6;  /* app background (light) */
  --card:   #FBF9F3;  /* cards on paper (from mockup), white also fine */
  --ink:    #1F2A44;  /* text, lines, primary buttons */
  --yellow: #FFE14D;  /* ONLY for paid / done / the one key word. Never as text color. */
  --yellow-soft: #FFF6C2; /* soft yellow box, rare */
  --gray:   #5C5A55;  /* secondary text */
  --line:   #E2DCCD;  /* empty bars, dividers */
  --pink:   #FF8FB1;  /* reserved for Pack 2 "Together" (partner 2 dot). Not used in Pack 1. */
}
```

- **Yellow rule:** yellow means paid, done, or the single most important word on a screen (for example the debt-free date, highlighted like a highlighter swipe). Ticked boxes, paid paydays, paid-off debts, filled progress and milestones reached are yellow. Yellow is never used as a text color.
- **Highlight style:** use a solid `background-color` for the highlighter swipe. Do not use CSS gradients for highlights in anything that gets exported to PDF: one PDF viewer showed our gradient highlight as pink.
- **Fonts (Google Fonts):** Bricolage Grotesque (700-800) for headings and big numbers on hero spots; Inter for body text and all numbers (use `font-variant-numeric: tabular-nums`); Caveat (700) only for one small handwritten line, like "one paycheck at a time" under a button.
- **Shapes:** rounded cards (about 16px radius), thin ink or line borders, square checkboxes with rounded corners that fill yellow when ticked, dark ink primary buttons with paper-colored text.
- **Logo:** the wordmark is "paid in yellow", with "yellow" on a yellow swipe. Use `brand/paidinyellow-wordmark-transparent.svg` on light screens and `paidinyellow-wordmark-dark.svg` on ink. The app icon is `icon-paystub.svg` (a pay stub with one highlighted, checked line).
- **Dark mode:** ink-based background, paper-colored text, and yellow keeps its "paid" meaning.
- **One main number per screen.** Everything else is secondary.
- **Accessibility:** big tap targets (44px), text size setting, never color alone (paid rows also show a check or the word "Paid").

---

## 4. The research behind the features

Each feature exists for a reason, so keep the reason when you build it. Details are in `docs/pack1-expert-review-layers-1-4.docx`. "Research" means a published study backs the feature. "Reasoned" means it's our judgment.

| Principle | Feature in the app |
|---|---|
| Small wins keep people going (Gal & McShane 2012) | Default "PaidInYellow order" pays the smallest balance first. A per-debt "PAID" moment when a debt hits zero. |
| Concentrate on one debt; people judge progress by % of one account (Kettle et al. 2016) | All extra goes to ONE focus debt. Today shows the focus debt's % bar above the total. |
| Show the cost in dollars (Amar et al. 2011) | "Your debt costs you $5.26 a day. Last month: $6.10." Interest saved vs minimums is shown in dollars. |
| A cash buffer reduces stress and relapse (Vanguard: $2,000 saved linked to 21% higher well-being) | Buffer first (starter goal $500). "I used the buffer" refills before extra payments. |
| If-then plans (Gollwitzer & Sheeran 2006) | Setup asks: "When I get paid on [Friday], I open PaidInYellow at [8 pm]." It goes into the calendar file. |
| Fresh start effect (Dai et al. 2014) | Setup offers: start this payday, or on the 1st of next month. |
| Endowed progress (Nunes & Dreze 2006) | The payday grid starts with 2 squares already yellow: "Debts listed" and "Plan made". |
| Habits take about 66 days (Lally 2010) | A short payday check every payday; no daily nagging. |
| Self-compassion after slips (Breines & Chen 2012) | Calm missed-payday flow: "Never miss twice". |
| Labeling new debt helps people see patterns (reasoned, CFPB-style) | Log a new charge with a tag: Everyday / Emergency / One-off. |
| Ostrich effect / math anxiety (reasoned + Reddit) | No math asked from the user. One clear next step. "You're not bad at math. The math was hidden from you." |

---

## 5. App scope

### v1 (build this first)

**Setup wizard** (about 15 minutes, 8 short steps, progress dots, back button):
1. **Welcome.** "You pay every month, but the balance never goes down. Let's fix that, one paycheck at a time." Second line: "You're not bad at math. The math was hidden from you." Link: "Watch the 3-minute video".
2. **Currency.** Auto-detected from the phone's region; editable. Any symbol works.
3. **Pay schedule.** How often you get paid (Every week / Every 2 weeks / Twice a month / Every month) and your next payday. Twice a month also asks for the two pay days: "1st and 15th", "15th and last day", or two custom days (one date can't tell the schedule apart). Optional: usual paycheck amount.
4. **Debts.** Quick add: name, balance, interest rate %, monthly minimum, due day; the type is optional. The due day is recommended, not optional: label "Due day (recommended)", hint "It's on your statement". It can still be left empty (see Today). Show an "Add another" button. Allow unlimited debts.
5. **Buffer.** "How much do you have set aside for surprises?" plus the goal (default $500).
6. **Money for the plan.** "How much can you put toward the plan each payday, on top of your minimums?" Hint: "Even $20 matters. You can change it any time."
7. **Yearly bills** (optional, skippable). Car repairs, gifts and holidays, insurance renewals, school. Each takes an amount per year and the month it's needed.
8. **Payoff order.** PaidInYellow order (recommended), Biggest interest first, or My own order. Show the dollar difference between the first two (see the comparison rule below).
9. **Fresh start and payday plan.** Start this payday or on the 1st of next month. Then "When I get paid on ___, I open PaidInYellow at ___."

**Setup result screen** (see mockup):
- The debt-free date, big, on a yellow highlight.
- Months sooner and interest avoided compared with paying only minimums.
- "Your first step: This payday (Fri 24 Oct): pay $150 to Store Card."
- The if-then line.
- A "Start my plan" button.

**Bottom tabs:** Today · Plan · Debts · Progress · Money. Settings sits behind an icon on Today.

**Today** (home):
- Debt-free pill at the top ("Debt-free · Mar 2028").
- Next payday card listing what to pay or move, in this order: the **bills due before the next payday**, yearly bills, buffer, and extra → focus debt (the focus debt name is highlighted).
  - A bill is a debt whose due day falls from this payday (included) up to the next payday (not included). It shows its **full monthly minimum** and its due date, like "Car loan $285, due 28 Oct". The engine's per-payday average of the minimums is never shown.
  - Total this payday (the "I did it" amount, the first step on the result screen, the Plan list, the CSV and the print page) = those bills + yearly bills + buffer + extra.
  - A debt with a minimum but no due day shows as "Visa $96, add a due day" with a link that sets the day. It is not counted in the total until it has a due day (we can't tell which payday it belongs to).
  - Pressing "I did it" still applies the engine's step to the balances, so the payoff date does not change.
- Each line has a checkbox, plus one big button "I did it · $370" that ticks everything and turns it yellow.
- Small links: "I got a different amount" (enter the real amount and the payday recalculates in the same order) and "+ Extra payment" (any extra money goes to the focus debt).
- Focus debt card: "Store Card · 64% gone · $320 left · gone by Dec 2026".
- Daily interest cost line.
- "Coming up": due dates in the next 14 days (with "autopay" if marked).
- Missed payday: a calm banner, "Life happens. Never miss twice. Here's your updated date."
- Plan needs help: if the minimums are more than the money available, show "Your plan needs help", explain kindly, and link to hardship and nonprofit counseling help. No loans.

**Plan:**
- A payday-by-payday list. Paid paydays are yellow; tap one to see every payment in it.
- Method switch with a comparison in dollars: "Biggest interest first saves $140 and finishes the same month."
- What-if: a slider "add $X per payday" (0 to 1,000), and "one-off money" (amount + date, e.g. a tax refund). It shows the new date, months saved and interest saved. A "Use this in my plan" button applies it.
- Export to CSV and a printable one-page summary.

**Debts:**
- One card per debt: name, balance, rate, minimum, due day, % bar, "gone by" date, paydays left.
- Add, edit and archive debts.
- "Log a new charge or fee": amount + tag (Everyday / Emergency / One-off). The balance goes up, the plan updates, and the tone is neutral.
- "Update from statement": type the real balance to fix drift.
- A warning on any debt whose minimum doesn't cover its interest: "Card B grows even with the minimum. It's first in your plan."
- When a debt reaches zero: a small celebration, and the card turns yellow with "PAID".

**Progress:**
- Paid so far, % paid, still owed, interest avoided compared with minimums only, paydays left.
- Chart: your plan vs minimums only (balance over time).
- Payday grid: one square per payday, with 2 squares pre-filled and paid squares yellow.
- Milestones: plan made, first extra payment, first debt gone, 10%, 25%, halfway, 75%, "one month ahead", last payment.
- Planned vs actual: "This month you paid $612 of $650 planned."
- A shareable milestone image that shows percentages, never amounts.

**Money:**
- Buffer: goal, current amount and history. "I used $200 for a car repair" lowers the buffer, and the plan refills it first.
- Yearly bills (sinking funds): add, edit, saved so far.
- "Find your first $500": a checklist of ideas (sell 3 things, pause 2 subscriptions, eat from the pantry for a week, pick up extra hours…), each with an amount box and a live total.
- One plain line: "Debt payments are X% of your take-home pay." No grade.

**Settings:**
- Currency, pay schedule, buffer goal, money for the plan, payoff order.
- **Backup:** export and import a JSON file, plus a monthly reminder to "Save a backup". This is critical because data lives only on the device.
- Calendar file (.ics): paydays, the if-then payday check, and due dates 3 days before.
- Dark mode and text size.
- How to install on iPhone or Android ("Add to Home Screen"), the video, and the help email.
- Unlock code.
- Privacy note and disclaimer.
- Help: the FAQ answers from `docs/paidinyellow-trust-kit.docx`.

### Free calculator (same codebase, build flag)
Setup → debt-free date → first step only. The schedule, tracker, what-if and export are locked behind "Unlock the full planner". It will live on paidinyellow.com as the lead magnet (search target: "credit card payoff calculator", 22.2k searches a month) with email capture.

### Later (not v1)
- Round each payment up to $5 / $10.
- An optional cushion % on yearly bills.
- Debt-by-type bars.
- A principal vs interest bar.
- The "long haul" monthly card.
- **Pack 2 "Together" mode:** the same app with partner pairing and end-to-end encrypted sync through a small server (Cloudflare Workers + KV/D1). Local data stays primary, and partners pair with a QR secret. Design that later; keep the data model ready for it (ids, timestamps on every record).

---

## 6. The engine (most important part)

**Port `engine/engine_reference.py` exactly, then make `engine/fixtures.json` pass in your test runner before building any screen.** The app and the Google Sheet bonus must show the same numbers. If you think the model should change, ask Azeddin first and update the reference, the fixtures and the sheet together.

The model, in one step per payday:
- `ppy` = paydays per year: weekly 52, every 2 weeks 26, twice a month 24, monthly 12.
- **Payday dates:**
  - weekly: +7 days
  - every 2 weeks: +14 days
  - monthly: the same day each month, clamped to the month's end
  - twice a month: two fixed days of the month (`other_payday`; 31 means the last day), capped at the month's end, alternating. Without `other_payday`: a day up to the 15th pairs with day + 15, the last day of a month pairs with the 15th, any other day after the 15th pairs with day - 15. See `twice_a_month_days()` in the reference.
- **Interest each payday:** `balance × APR / ppy`.
- **Minimum set aside each payday:** `monthly minimum × 12 / ppy`, capped at what the debt owes. This average lives only inside the engine (for the payoff date). The screens show real bills by due date instead.
- **The order money goes each payday.** Available money is `money for the plan` plus any "+/- this payday".
  1. Yearly bills: `sum(yearly costs) / ppy`, capped at what's available.
  2. Buffer: until it reaches the goal.
  3. Extra to debts: what's left, plus the minimums freed by paid-off debts (the rollover). It goes to debts in payoff order. The focus debt gets all of it, and any overflow goes to the next debt.
- **New charges:** added to the focus debt of that payday. The focus debt is the debt with the most extra that payday; if no debt got extra, it's the first debt in order.
- **Payoff orders.** Ties always keep the order the debts were entered.
  - PaidInYellow order: debts that charge interest and whose monthly minimum is at or below their monthly interest go first (highest APR first among them), then the smallest balance first. A 0% debt never counts as growing, even with a $0 minimum.
  - Biggest interest first: highest APR first (ties: smaller balance).
  - My own order: the user's numbers; debts without a number go last.
- **Minimums-only baseline (per debt):** `NPER(APR/12, -minimum, balance)` months, and interest = `minimum × NPER − balance`. If the minimum ≤ the monthly interest, it never ends: show "Never ends" and "Your plan ends it" instead of a number.
- **Comparison rule (Setup and Plan):** run both PaidInYellow order and Biggest interest first. If biggest interest first saves more than 10% or more than $500, say so in dollars and let the user choose. Otherwise recommend the PaidInYellow order.
- **Daily interest cost:** `sum(balance × APR) / 365`, using current balances.
- **Limit:** 520 paydays. Beyond that, show "More than 20 years" kindly, together with the "plan needs help" route.

**How the real state works in the app.** This was reasoned for the app; the sheet does the same thing with its "Paid" column.
- The stored state is: current balances, buffer, yearly-bill savings, settings, and the logs (payments, charges, buffer uses).
- The plan is always simulated **from the current state and the next payday**, so it never drifts.
- "I did it" applies one engine step with the real numbers (including "+/- this payday" and new charges), saves the resulting balances and buffer, logs the payments, and advances the next payday.
- Three rules keep the step-by-step app equal to one full simulation (checked with the reference; breaking any of them changes the debt-free date):
  1. **Paid debts stay in the simulation with balance 0**, so their minimum keeps rolling into the extra. Never drop them. After the first debt is gone, the payday total must stay the same and the extra must grow by that debt's minimum.
  2. **Store the payoff order** when the plan is made and keep it. Recompute it only when the user picks a payoff order again or adds or removes a debt. Re-sorting by current balances every payday makes the focus debt jump (it moved the debt-free date by 2 paydays in the twice-a-month fixture).
  3. **Payday dates come from the schedule** (the first payday of the plan plus a payday counter, and the two pay days for twice a month), never from "last payday + step". Twice a month breaks otherwise.
- "Update from statement" overwrites a balance. "I used the buffer" lowers the buffer. Then the plan re-simulates.
- A skipped payday: the next payday moves forward, nothing is applied, and the date updates calmly.

**Tests.** A test that applies "I did it" step by step to the end must give the same debt-free date and interest as one full simulation, for every fixture without +/- or charges. Unit tests on the engine with all 6 fixtures (dates must match exactly; amounts to the cent). Add edge cases: zero debts, a 0% debt, a debt with a 0 minimum, a minimum that doesn't cover interest, a negative "+/-", a buffer already above the goal, Feb 28/29 and the 31st for monthly and twice-a-month dates.

---

## 7. Data, offline, unlock

- **Storage:** IndexedDB. Every record has an `id` and an `updatedAt` timestamp (this keeps the Pack 2 sync possible later).
  - Settings: currency, frequency, nextPayday, scheduleStart, paydayCounter, otherPayday (twice a month), payoffOrder (stored list of debt ids), paycheckAmount?, extraPerPayday, bufferGoal, method, theme, textSize, ifThen {day, time}, startMode
  - Debts: id, name, type, balance, apr, minMonthly, dueDay, myOrder, startBalance, status (active / paid / archived)
  - Payments: id, date, debtId, amount, kind (minimum / extra / buffer / fund), planned (bool)
  - Charges: id, date, debtId, amount, tag (everyday / emergency / one-off), note
  - Buffer: amount, history [{date, amount, note}]
  - Funds (yearly bills): id, name, perYear, month, saved
  - License: code, activatedAt
- **Offline:** a PWA with a service worker; it works with no signal and installs to the home screen. Also produce a single-file HTML build that buyers can download, for people who don't trust websites.
- **Unlock:** Shopify or Etsy delivers a PDF with the app link and a unique code. The code is a signed token (e.g. Ed25519) verified in the app with a public key, so it works offline with no server. The free calculator is the same build without a valid code.
- **Hosting:** static (Cloudflare Pages or Netlify) at app.paidinyellow.com. No database, no backend for Pack 1.

---

## 8. Tech suggestions

- Vite + Preact + TypeScript (small and fast), or vanilla TS if it stays simpler.
- Charts: uPlot or Chart.js (keep the bundle small).
- Dates: plain `Date` helpers ported from the reference (no time zones in stored dates; store ISO `YYYY-MM-DD`).
- Money: keep full precision in the engine and round only for display (2 decimals; whole units on big summary numbers).
- Tests: Vitest for the engine, plus Playwright for the main flows (setup → result → I did it → yellow).

---

## 9. Build order and definition of done

1. Engine port + the 6 fixtures passing, plus the edge cases.
2. Setup wizard, result screen and Today: the smallest usable app.
3. Debts, Plan, Progress, Money.
4. Backup / import, .ics, unlock code, PWA install, dark mode, text size.
5. Free calculator build (flag).
6. Beta: 5-10 people (from Reddit) use it for 2 paydays. Fix whatever confuses them.

**Done means:**
- A new user on a phone gets their debt-free date in under 15 minutes without help.
- The first step reads like "This payday: pay $X to Y".
- The numbers match the Google Sheet for the same inputs.
- Tapping "I did it" turns the payday yellow.
- The app works offline after the first load.
- Backup and restore round-trips.
- No red anywhere.
- No loan or transfer advice anywhere.

---

## 10. Copy bank (use as written)

- Welcome: "You pay every month, but the balance never goes down. Let's fix that, one paycheck at a time."
- Welcome 2: "You're not bad at math. The math was hidden from you."
- Result: "You can be debt-free by **March 2028**." · "Your first step" · "Start my plan"
- Today button: "I did it · $370"
- Different paycheck: "I got a different amount"
- Missed payday: "Life happens. Never miss twice. Here's your updated date."
- Buffer: "Your buffer comes first. Until it reaches your goal, the extra goes there, so one surprise bill doesn't land back on a card."
- Buffer used: "That's what it's for. Nothing went on a card. Your plan refills it first."
- Debt that grows: "This one grows even when you pay the minimum, so it goes first."
- Plan needs help: "Your minimums are more than the money you have for the plan right now. That happens, and there are people whose job is to help with it." Then the links: call your lenders about hardship programs, and nonprofit credit counseling (NFCC.org). No loans.
- Debt paid: "PAID. One down."
- Privacy: "Your numbers never leave this device."
- Disclaimer: "A planning tool, not financial advice. Figures are estimates based on what you enter."
- Slogan (Caveat, small): "one paycheck at a time"

---

## 11. Open decisions for Azeddin

- Final price and whether the app is sold alone, in the pack, or both.
- The support email (help@paidinyellow.com?) and the reply time in the Promise ("usually within 1 business day").
- The exact Shopify → unlock-code delivery flow.
- Whether the single-file HTML download ships in v1 or later.
