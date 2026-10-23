# How to hand this to Claude Code

1. Unzip this folder into your repo as `docs/ux-v2/` (so you get `docs/ux-v2/ux-v2.md` and `docs/ux-v2/mockups/`).
2. Add one line near the top of `CLAUDE.md`, under the title:

   > UI changes: `docs/ux-v2/ux-v2.md` replaces section 5 (screens). Match the PNGs in `docs/ux-v2/mockups/`. Engine, data model and section 2 rules stay unchanged.

3. Commit, then start Claude Code in the repo and paste the prompts below **one at a time**. Check the app on your phone after each one before moving on.

The PNGs use example numbers. The real app shows the user's numbers from the engine. Never hard-code the mockup numbers.

---

## Prompt 1 · Plan only

```
Read docs/ux-v2/ux-v2.md and look at every PNG in docs/ux-v2/mockups/.
Don't change code yet. Compare with the current app and give me a short plan:
which files change, which components are new, and the order you'll do it in.
Confirm the engine and fixtures stay untouched.
```

## Prompt 2 · Fix the bugs first

```
Do section 9 of docs/ux-v2/ux-v2.md (the bugs). Add a test for each:
archived debts leave every total, milestones only tick with real payments,
dates show the year when not in the current year. Run all tests.
```

## Prompt 3 · Navigation

```
Do section 1: 4 tabs (Today, Path, Debts, Safety net). Merge Plan and Progress
into Path, rename Money to Safety net. Active tab uses the --line pill, never yellow.
```

## Prompt 4 · Setup in 4 steps

```
Do section 2. Match 01-setup-debts.png and 02-result.png. Move yearly bills,
payday reminder, backup and payoff order to "Do these later" chips.
Update the Playwright setup flow test.
```

## Prompt 5 · Today and the "I did it" moment

```
Do sections 3 and 4. Match 03-today.png and 04-today-paid.png.
Include Undo, reduced-motion support and the backup nudge.
```

## Prompt 6 · Path, Debts, Safety net

```
Do sections 5, 6 and 7. Match 05-path.png, 06-debts.png and 07-safety-net.png.
What-if and the payday list open as bottom sheets.
```

## Prompt 7 · Settings and polish

```
Do sections 8 and 10. Then check section 12 point by point and tell me
what passes and what doesn't. Run the engine fixtures and all Playwright tests.
```

---

Tips
- If Claude Code drifts from the look, say: "Compare your screen with docs/ux-v2/mockups/03-today.png and list the differences, then fix them."
- If a change touches `engine/`, stop it: "This is UI only. Revert engine changes."
- The `mockups/html/` files are the source of the mockups (exact colors, sizes, spacing). Claude Code can read them for exact values.
