---
target: PaidInYellow app UX comparison
total_score: 32
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "url:https://app.paidinyellow.com/"
timestamp: 2026-10-28T17-45-04Z
slug: app-paidinyellow-com
---
## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 3 | Four-step setup and payoff date are clear; the payment checklist can record the payday immediately when the final row is checked. |
| 2 | Match system / real world | 4 | Paydays, statements, minimums, and take-home pay use familiar money language. |
| 3 | User control and freedom | 3 | Back, autosave, and undo help; auto-recording on the last checkbox can surprise users. |
| 4 | Consistency and standards | 3 | The guided flow is coherent; Today, Path, Debts, and Safety net ask users to learn a broader model after setup. |
| 5 | Error prevention | 3 | Implausible values are flagged, but missing APRs use a default that can affect the projection. |
| 6 | Recognition rather than recall | 4 | Currency, examples, field hints, and the “Help me work it out” calculator reduce memory demands. |
| 7 | Flexibility and efficiency | 3 | Quick amounts and payday actions are efficient; deeper planning is available in secondary areas. |
| 8 | Aesthetic and minimalist design | 3 | Warm and focused, though the money step combines extra payments, a helper, and buffer setup. |
| 9 | Error recovery | 3 | Draft autosave and payday undo support recovery; undo follows a consequential automatic action. |
| 10 | Help and documentation | 3 | Example, result explanation, and calculator help are useful; “buffer” needs a point-of-entry explanation. |
| **Total** | | **32/40** | Strong foundation; friction is concentrated in setup and payment confirmation. |

## Design Specificity Verdict

PaidInYellow feels authored for its paycheck-first promise: the setup asks about pay cadence and the result gives a first action aligned to the next payday. Its warm cream and yellow language support an approachable, personal tone. The competitor is a broader debt-planning suite with many tracking, comparison, and look-ahead sections. It offers richer exploration, but puts more choices and metrics in front of a first-time user. PaidInYellow should preserve its focused payday flow and selectively borrow clear comparison/help affordances rather than copy the competitor’s breadth.

The detector returned an empty result (`[]`) for the combined scan of the PaidInYellow wizard source and the supplied competitor HTML: 0 reported findings, rules, or file locations. No false positives were reported. The browser overlay could not be injected because the available browser interaction surface does not permit page JavaScript mutation; the browser's alternate evaluation surface is read-only. No live server or overlay was started. Fallback evidence was the visual and accessibility-tree inspection of fresh tabs for both live apps.

## Overall Impression

PaidInYellow is easier to approach and understand at the start: it tells users why it exists, asks for a small set of payday-based inputs, and leads toward one next step. The competitor communicates its wider capabilities well through labeled navigation and a data-rich dashboard, but carries a higher scanning cost. This is a UX comparison only; the competitor opened with a seeded one-debt USD example, so payoff calculations were not compared under matched inputs.

## What's Working

- Paycheck-first positioning is distinctive and reflected in the setup and next action.
- The projected debt-free date and first-step card give the user an understandable payoff outcome.
- “See an example first,” autosave, familiar field hints, and on-device privacy reassurance reduce first-run anxiety.

## Priority Issues

1. **[P1] Make payday recording explicit.** In `src/today/Today.tsx`, checking the final payment row calls `apply()` immediately. Users may be marking a checklist while reviewing, yet this records a payday. Keep the visible “I did it” button as the only commit action, or add a review/confirm step summarizing the total.
2. **[P1] Reduce the perceived burden of the money step.** `src/setup/steps/Money.tsx` puts extra-per-payday, a take-home/essentials helper, four preset amounts plus “Other,” and two buffer fields together. Keep the extra amount as the one primary decision, clearly explain whether the buffer is optional, and consider moving buffer setup until after the payoff date is shown.
3. **[P2] Show when the payoff date relies on an assumed APR.** A missing rate defaults to 24% and the debt is marked “rate missing,” but the result date does not foreground that assumption. Show the assumed rate next to the projection and provide a direct correction action.
4. **[P2] Explain “buffer” where users set it.** Define what the buffer protects and why extra money fills it before debt payoff; “Your buffer” alone may be unfamiliar to first-time users.

## Persona Red Flags

- **First-time user with low financial confidence:** the money step can feel like a budgeting test before the user sees a result, especially because buffer fields appear alongside the debt payoff amount.
- **Payday user in a hurry:** checking off the last payment line records the payday without requiring the explicit “I did it” button.
- **User with incomplete statements:** leaving APR blank is supported, but the resulting date can look precise despite a 24% assumption.

## Minor Observations

- PaidInYellow’s four main areas keep navigation compact; brief first-use explanations for “Path” and “Safety net” could help users understand the model.
- The competitor exposes 14 labeled destinations plus a dense dashboard, which helps discovery of its broader feature set but creates more scanning work than PaidInYellow’s focused home.
- The live competitor example used one $2,000 debt at 1% APR and displayed USD, so it is not a representative like-for-like payoff benchmark.

## Questions to Consider

- Should a user see their payoff date before choosing a buffer goal?
- Would “Review and record” make payday tracking safer without adding much friction?
- Is the buffer central to the product promise, or should it be introduced as an optional safeguard?
