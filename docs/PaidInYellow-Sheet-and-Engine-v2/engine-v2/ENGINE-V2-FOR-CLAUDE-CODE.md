# Engine v2: the trust fix (approved by Azeddin)

Put `engine_v2.py` and `fixtures_v2.json` in `engine/`. They replace the v1 reference and fixtures.
The Google Sheet bonus (`PaidInYellow-Paycheck-Payoff-Planner.xlsx`) implements exactly this model, and
matches `engine_v2.py` to the cent on all 7 fixtures.

## What changes from v1

v1 set aside an *average* minimum every payday (`monthly minimum × 12 / ppy`), so after "I did it" a balance
moved by an amount the user never paid. v2 moves balances by exactly what the user pays:

1. **Bills by due date.** Each payday, a debt's full monthly minimum is paid when its due day (clamped to the
   month's end) falls in `[this payday, next payday)`. A debt with no due date in the window gets no bill
   that payday. Its balance only gains interest.
2. **Capped at what's owed.** The bill is `min(minimum due, balance after interest and charges)`.
3. **Rollover.** `rollover = sum(minimum due) - sum(bills paid)`. It joins the extra. So a paid-off debt's
   minimum keeps rolling on the paydays its bill would have fallen (v1 rule 1 still holds).
4. **Money order unchanged.** `available = money for the plan + (+/-)` → yearly bills (`sum / ppy`, capped)
   → buffer (to the goal) → `extra = rest + rollover`, which goes to debts in payoff order, focus first,
   overflow to the next.
5. **Charges** go to the first debt in payoff order that still has a balance (before this payday's step).
6. **Debts without a due day** get no bill in v2. In the app, keep "Visa $96, add a due day" and make the due
   day required before the plan starts. The sheet treats an empty due day the same way.

Still the same as v1: paydays per year, payday dates from the schedule (never "last payday + step"),
interest per payday `balance × APR / ppy`, the three payoff orders and tie rules, the stored payoff order,
the 520-payday limit, and the NPER minimums-only baseline.

## What this means on screen

- Today's lines and total come straight from the engine step. There is no more "averaged minimum vs real bill"
  difference.
- "I did it" applies the step. Balances drop by the exact amounts shown.
- Remove the averaging code and any "estimate" notes added to explain drift.

## Tests

- All 7 fixtures in `fixtures_v2.json` must match: debt-free date exactly, total interest and the first four
  paydays to the cent.
- `eight_k` is the classic check: $8,000 at 24% with a $240 minimum, minimums only, gives 56 months and $5,315.34.
- The step-by-step test still holds: applying "I did it" payday by payday gives the same date and interest
  as one full simulation.
- Update the Darija test scenario's expected numbers from `engine_v2.py`, since bills now land by due date.
- Update CLAUDE.md section 6 with the rules above.
