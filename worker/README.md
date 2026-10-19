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
