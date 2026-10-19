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
- A code is checked on the phone with a public key, so it works offline. No server, no WebCrypto
  needed (the check is pure JavaScript, so it also works over plain http).
- A code looks like `base64url(PIY1|pack1|<id>|<date>)` then a dot then `base64url(signature)`.
  The signature is Ed25519 over the text.

### Keys (do this once)

```
node scripts/make-keypair.js
```

- The **private** key goes to `~/.piy/private.pem` (Windows: `C:\Users\<you>\.piy\private.pem`).
  It is outside the project, so it can't be committed, and no build ever reads it.
  Back it up in a password manager. If you lose it you can't make new codes.
- The **public** key is written into `src/lib/licenseKey.ts`. It is the only key in the app.
- Running the script again changes nothing. `--force` replaces the pair (old codes stop working).

### Make and check a code

```
node scripts/make-code.js test@paidinyellow.com     # prints the code
node scripts/check-code.js "<code>"                 # checks it the way the app does (public key only)
```

### Use a code

- Paste it in the app: **I have a code** on the result screen, or Settings, Unlock code.
- Or open the link: `https://app.paidinyellow.com/#unlock=<code>`. The code is after the `#`, which
  the browser never sends to a server. It is checked, removed from the address bar and saved. If the
  buyer opens the link before making a plan, it is kept until the plan is ready.
- A code with one letter changed is refused: "This code doesn't look right. Check that you copied all of it."

### Test it

```
npm test                                  # unit tests (format, every one-letter change refused, no WebCrypto)
npx playwright test e2e/unlock-link.spec.ts e2e/real-code.spec.ts
```

`e2e/real-code.spec.ts` uses your real private key in `~/.piy` and is skipped without it. The other
tests use a test key (`e2e/testKey.ts`) that can't make codes the real app accepts.

## Sync and orders (Worker)

`worker/` is a Cloudflare Worker: optional encrypted sync between devices, and the Shopify order to code to
email flow. See `worker/README.md` for how it works, deploy commands, and how to test with a fake order.

## Data

Everything is stored in the browser (IndexedDB) on the buyer's device. Settings has backup and
restore (a JSON file), a calendar file, dark mode and text size.
