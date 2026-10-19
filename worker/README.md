# PaidInYellow Worker

One Cloudflare Worker with a D1 database. It does the parts the app can't do alone:

1. **Encrypted sync** between a buyer's devices (and, later, two partners). No account.
2. **Order to code to email** (Shopify webhook). See the second half of this file.

Nothing secret is in the repo. Secrets are set with `wrangler secret put`.

## Encrypted sync: how it works

- Sync is off until the buyer turns it on in Settings (needs a valid unlock code).
- The first phone makes a random **sync id** (128 bit) and a random **AES-GCM 256 key**. Every record
  (one per debt, payment, charge, setting...) is encrypted on the phone before it is sent.
- The server stores: sync id, record id (like `debts/<id>`), a time, and encrypted bytes. It never has the key.
- The second phone joins from a link or QR code: `https://app.paidinyellow.com/#sync=<id>.<key>&unlock=<code>`.
  Everything is after the `#`, which a browser never sends to a server. The app removes it from the address bar.
- Offline first: changes are saved on the phone at once and sent when there is a network.
- Last change wins, per record, by its time. A delete is a record too.
- "Stop syncing and delete my server data" deletes everything stored for that id.
- Every request carries the unlock code (`X-PIY-Code`). The Worker checks the signature with the public key.
  A refunded order is on the `revoked` list: that blocks **sync only**. The code still unlocks the app on the phone.

```
GET    /health
PUT    /sync/:id            { "records": [ { "rid", "ts", "iv", "ct" } | { "rid", "ts", "deleted": true } ] }
GET    /sync/:id?since=N    records changed after server number N (oldest first, paged)
DELETE /sync/:id            delete everything for this id
```

Limits (see `wrangler.toml`): 64 KB per record, 200 records per request, 5000 records and 10 MB per sync id,
3 sync ids per code, 120 requests a minute per sync id and 300 per address.

**Two partners (Pack 2):** nothing is per device. Two people who share one sync id and key are two devices
of one space. The record ids and times are already what a shared plan needs.

## Try it on your computer (no Cloudflare account)

```bash
npm run worker:dev          # the real Worker code on a local database, http://localhost:8787
npm test                    # includes the Worker tests and a two-phone test
npm run e2e                 # includes two browsers syncing through the local Worker
```

To try the app against it: `VITE_SYNC_URL=http://localhost:8787 npm run dev`, and start the Worker with
`ALLOWED_ORIGINS=http://localhost:5173 npm run worker:dev`.

## Deploy

```bash
cd worker
npx wrangler login
npx wrangler d1 create paidinyellow          # copy the database_id it prints into wrangler.toml
npx wrangler d1 migrations apply paidinyellow --remote
npx wrangler deploy
```

Then, in `wrangler.toml`, point `routes` at your domain (for example `api.paidinyellow.com`), and build the app
with `VITE_SYNC_URL=https://api.paidinyellow.com` if you use another address (the default is that one).

`PIY_PUBLIC_KEY` in `wrangler.toml` must equal `APP_PUBLIC_KEY` in `src/lib/licenseKey.ts`. A test checks it.

## Orders: Shopify to code to email

```
POST /webhooks/shopify
```

- **orders/paid** ("Order payment"): checks Shopify's HMAC signature, makes a code for that order
  (`PIY1|pack1|shopify-<order number>|<date>`, signed with the private key), and emails the buyer through
  Resend: the button `https://app.paidinyellow.com/#unlock=<code>`, the code itself, and the kit file links.
- **One order = one code.** The order id is the key in D1. The same webhook delivered twice sends nothing
  twice and never makes a second code. If the email fails, the Worker answers 502, Shopify retries, and the retry
  sends the same code (Resend also gets an `Idempotency-Key`, so it can't send twice).
- **refunds/create**: a refund that covers the whole order puts that code on the `revoked` list. That blocks
  **sync only**. The code still unlocks the app on the phone, because it checks offline with the public key.
  A part refund keeps everything working. Each refund is counted once.
- Test orders (Shopify's "bogus gateway") are ignored unless `PROCESS_TEST_ORDERS = "true"`.
- Orders with no usable email are saved but not sent (the log says so), so you can send the code by hand.

### Set up (once)

1. Deploy as above, then set the three secrets. None of them is ever written in a file:

```bash
cd worker
node ../scripts/worker-secret.js | npx wrangler secret put PIY_PRIVATE_KEY   # the key from ~/.piy, checked against the app first
npx wrangler secret put SHOPIFY_WEBHOOK_SECRET                                # the signing secret Shopify shows
npx wrangler secret put RESEND_API_KEY                                        # from resend.com (verify your sending domain there)
```

2. Fill the public settings in `wrangler.toml`: `SHOPIFY_SHOP_DOMAIN`, `MAIL_FROM`, `MAIL_REPLY_TO`, `KIT_LINKS`
   (JSON list of `{ "name", "url" }`, https only), then `npx wrangler deploy` again.
3. In Shopify admin, Settings, Notifications, Webhooks, add two webhooks in JSON format, both to
   `https://<your worker address>/webhooks/shopify`: **Order payment** and **Refund create**.

### Test it with a fake order (no Shopify, no Resend)

```bash
npm run worker:dev                       # terminal 1. Emails are printed here instead of sent.
node scripts/fake-order.js               # terminal 2. A new paid order: the email appears in terminal 1.
node scripts/fake-order.js --order 1001 --email you@example.com
node scripts/fake-order.js --order 1001                    # the same order again: nothing is sent twice
node scripts/fake-order.js --order 1001 --refund           # refund it: that code can no longer sync
node scripts/fake-order.js --bad-signature                 # a forged request: refused with 401
node scripts/check-code.js "<the code from the email>"     # VALID
```

The dev Worker signs with your key in `~/.piy`, and uses the webhook secret `dev-secret` unless you set
`SHOPIFY_WEBHOOK_SECRET` in `worker/.dev.vars` (git-ignored). Against a deployed Worker:
`SHOPIFY_WEBHOOK_SECRET=<real secret> node scripts/fake-order.js --url https://<your worker address>` (it needs
`PROCESS_TEST_ORDERS = "true"` because fake orders are marked as tests).
