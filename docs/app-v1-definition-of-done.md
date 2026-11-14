# PaidInYellow app · Definition of done for v1 launch

Version 1 ships when every box below is checked on a real phone (iPhone Safari and Android Chrome) and on desktop.

## 1. Setup (4 steps, under 3 minutes)
- [ ] Step 1 Pay: currency, schedule, next payday (shows "That's Fri 6 Nov").
- [ ] Step 2 Debts: name, balance, rate, minimum, due day. Collapsed summary after each debt.
- [ ] Step 3 Money: money per payday, **buffer now + goal (visible, not hidden)**, **yearly bills as optional chips** (Car, Gifts, Insurance, School, I have none). Max 1 typed field per bill (amount), month picked by tap.
- [ ] Step 4 Result: debt-free date, first step "Move $X", minimums-only date "counting from today".
- [ ] Nadia test gives: July 2027, May 2031, Move $180 (Store $30 + Yearly $10 + Buffer $140).

## 2. Core loop works
- [ ] Today shows one payday card and one button "I did it".
- [ ] Undo right after "I did it", and Undo of the latest paid payday from Path with confirmation.
- [ ] "Mark it done early" only for the next payday.
- [ ] I got a different amount · Skip this payday · I got extra money (now or later).
- [ ] Add, edit, archive, bring back a debt. Order recomputes after every change.
- [ ] Editing a balance or "Update from my statement" never counts as progress.
- [ ] Safety net: "I used some of it" refills before extra goes to debt.
- [ ] Debt-free end state: "Debt-free.", no next payday, Home scene.

## 3. Numbers are right
- [ ] App matches engine v2 on all 7 fixtures and the Nadia scenario (moves 180, 266, 180, 216, 230; owed after payday 8 = $2,067).
- [ ] No negative "% gone". No "10% gone" from edits.
- [ ] Payoff orders: PaidInYellow, Biggest interest first, My own order.

## 4. Simple and calm
- [ ] Exactly 4 tabs: Today, Path, Debts, Safety net.
- [ ] Path views: Road · Chapters · Calendar. Whole plan is a card, not a tab.
- [ ] New features add at most 1 typed field each.
- [ ] No red, yellow only for paid/done/one key word, no exclamation marks, no em dashes.
- [ ] Notes rotate; milestone notes show once. Short reads work offline.
- [ ] Light, Dark, Match my device. Text readable in both (contrast 4.5:1).

## 5. Trust and privacy
- [ ] Works offline after first load (airplane mode test).
- [ ] No outside requests with user data. Firebase only for opt-in encrypted sync. Netlify badge removed.
- [ ] Backup export and restore tested on a second device.
- [ ] "A planning tool, not financial advice" visible. No loans, transfers or consolidation advice anywhere.

## 6. Ready to sell
- [ ] Unlock code flow works; erase keeps the code unless the user ticks "remove".
- [ ] "Open me first" PDF links filled (app, code, video, sheet copy).
- [ ] 3-minute video recorded.
- [ ] Etsy listing: screenshots of Today, Chapters, Preview, Debt-free; selling points: per paycheck, buffer and yearly bills, warns when a debt grows, private, no subscription.
- [ ] Support email answers within 24 hours.

## Not in v1 (later)
- Minimum as % of balance.
- Debt-Free Together (Pack 2).
- Extras-and-charges log in the Google Sheet.
