# PaidInYellow · Paycheck Payoff Planner

Phone-first, offline web app. The brief is in `CLAUDE.md`.

## Start it

```
npm install          # once
npm run dev          # http://localhost:5173
npm run dev -- --host   # same, reachable from your phone on the same Wi-Fi
npm run dev:free     # the free calculator edition
```

## Check it

```
npm test             # unit tests (engine, data, backup, calendar, unlock code)
npm run e2e          # phone-sized browser tests (needs: npx playwright install chromium)
npm run typecheck
npm run test:reference   # the Python reference engine must still pass its 6 fixtures
```

## Build it

| Command | Output | What it is |
|---|---|---|
| `npm run build` | `dist/` | The full planner (app.paidinyellow.com) |
| `npm run build:free` | `dist-free/` | The free calculator (paidinyellow.com), same code with the free flag |
| `npm run build:single` | `dist-single/index.html` | One file with everything inside, no service worker |

Both web builds are static files. Host them on Cloudflare Pages or Netlify.

### Free calculator settings (set when building)

| Variable | Meaning |
|---|---|
| `VITE_EMAIL_CAPTURE_URL` | Form endpoint for the email box. Empty = the box is hidden. Only the email address is sent. |

Example: `VITE_EMAIL_CAPTURE_URL=https://example.com/capture npm run build:free`

Other links (store page, video, hardship script, support email) are in `src/lib/config.ts`.

## Editions and unlock codes

- Without a valid unlock code the app is in **calculator mode**: setup, the debt-free date and the
  first step. The tracker, plan, what-if, progress, money and export wait behind the code.
- A code is checked on the phone with a public key, so it works offline. There is no server.
- `src/lib/licenseKey.ts` holds the public key. The one in the repo is a **development key**.

Before selling:

```
npm run make-keypair                     # writes .keys/private.hex (git ignores it). Back it up somewhere safe.
# paste the printed PUBLIC key into src/lib/licenseKey.ts
node scripts/make-code.js buyer@example.com   # one code per buyer or order
node scripts/check-code.js "PIY1...."         # check a code the way the app does (public key only)
```

The private key signs codes. It is read from `PIY_PRIVATE_KEY`, a `.env` file, or `.keys/private.hex`, and all
three are git-ignored. The app and its builds only ever contain the PUBLIC key.

The automated tests use their own test key (`e2e/testKey.ts`) and never need your private key.

## Data

Everything is stored in the browser (IndexedDB) on the buyer's device. Settings has backup and
restore (a JSON file), a calendar file, dark mode and text size.
