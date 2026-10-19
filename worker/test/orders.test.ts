import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { verifyToken } from '../../src/lib/licenseCore';
import { NOW, SYNC_ID, TEST_PUBLIC, get, harness, put, record, type Harness } from './helpers';

const SECRET = 'shpss_test_secret';
const SHOP = 'your-store.myshopify.com';

const sign = (body: string, secret = SECRET) => createHmac('sha256', secret).update(body).digest('base64');

function webhook(h: Harness, topic: string, payload: unknown, opts: { signature?: string; shop?: string; secret?: string } = {}) {
  const body = JSON.stringify(payload);
  return h.json('/webhooks/shopify', {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Topic': topic,
      'X-Shopify-Hmac-Sha256': opts.signature ?? sign(body, opts.secret),
      'X-Shopify-Shop-Domain': opts.shop ?? SHOP,
    },
  });
}

const order = (id = 5551000001, extra: Record<string, unknown> = {}) => ({
  id,
  order_number: 1042,
  email: 'Sara@Example.com',
  test: false,
  financial_status: 'paid',
  total_price: '9.00',
  customer: { first_name: 'Sara' },
  ...extra,
});

const shop = () => harness({ SHOPIFY_SHOP_DOMAIN: SHOP });
const codeIn = (h: Harness, n = 0) => /#unlock=([\w.-]+)/.exec(h.mail[n]!.text)![1]!;
const count = async (h: Harness, table: string) => (await h.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())!.n;

describe('order paid: one order, one code, one email', () => {
  it('makes a valid code and emails the link, the code and the kit files', async () => {
    const h = shop();
    const r = await webhook(h, 'orders/paid', order());
    expect([r.status, r.body]).toEqual([200, { sent: true }]);
    expect(h.mail).toHaveLength(1);
    const mail = h.mail[0]!;
    expect(mail.to).toBe('sara@example.com');
    expect(mail.subject).toBe('Your PaidInYellow planner is ready');

    const code = codeIn(h);
    expect(mail.text).toContain(`https://app.paidinyellow.com/#unlock=${code}`);
    // The code is the real thing: it checks out with the PUBLIC key, and it is tied to the order number
    const check = verifyToken(code, TEST_PUBLIC);
    expect(check.ok && check.payload).toEqual({ product: 'pack1', id: 'shopify-1042', date: '2026-10-19' });
    expect(mail.html).toContain(`#unlock=${code}`);
    expect(mail.html).toContain('https://files.paidinyellow.com/7-day-debt-reset.pdf');
    expect(mail.text).toContain('Debt-Free Tracker Kit (printables): https://files.paidinyellow.com/tracker-kit.pdf');
    expect(mail.text).toContain('Hi Sara,');
    expect(mail.headers['Idempotency-Key']).toBe('piy-order-5551000001');
    expect(mail.headers.Authorization).toBe('Bearer re_test_key');
  });

  it('the same order delivered again sends nothing and makes no second code', async () => {
    const h = shop();
    await webhook(h, 'orders/paid', order());
    const again = await webhook(h, 'orders/paid', order());
    expect(again.body).toEqual({ duplicate: true, sent: true });
    expect(h.mail).toHaveLength(1);
    expect(await count(h, 'orders')).toBe(1);
  });

  it('two deliveries at the same moment still make one code, with the same Resend idempotency key', async () => {
    const h = shop();
    await Promise.all([webhook(h, 'orders/paid', order()), webhook(h, 'orders/paid', order())]);
    expect(await count(h, 'orders')).toBe(1);
    expect(new Set(h.mail.map((m, i) => codeIn(h, i))).size).toBe(1);
    expect(new Set(h.mail.map((m) => m.headers['Idempotency-Key'])).size).toBe(1);
  });

  it('different orders get different codes', async () => {
    const h = shop();
    await webhook(h, 'orders/paid', order(5551000001, { order_number: 1042 }));
    await webhook(h, 'orders/paid', order(5551000002, { order_number: 1043 }));
    const ids = (await h.db.prepare('SELECT code_id FROM orders ORDER BY order_id').all<{ code_id: string }>()).results.map((r) => r.code_id);
    expect(ids).toEqual(['shopify-1042', 'shopify-1043']);
    expect(codeIn(h, 0)).not.toBe(codeIn(h, 1));
  });

  it('if the email fails, Shopify is told to retry, and the retry sends the SAME code', async () => {
    const h = shop();
    h.flags.mailFails = true;
    const first = await webhook(h, 'orders/paid', order());
    expect(first.status).toBe(502);
    expect(h.mail).toHaveLength(0);
    const stored = (await h.db.prepare('SELECT code, status FROM orders').first<{ code: string; status: string }>())!;
    expect(stored.status).toBe('pending');

    h.flags.mailFails = false;
    h.clock.now += 3_600_000; // the retry comes later, so a new code would carry a different time
    const retry = await webhook(h, 'orders/paid', order());
    expect(retry.body).toEqual({ sent: true });
    expect(h.mail).toHaveLength(1);
    expect(codeIn(h)).toBe(stored.code);
    expect((await h.db.prepare('SELECT status FROM orders').first<{ status: string }>())!.status).toBe('sent');
  });

  it('ignores test orders unless told to, and keeps orders with no usable email without sending', async () => {
    const h = shop();
    expect((await webhook(h, 'orders/paid', order(5551000009, { test: true }))).body).toEqual({ ignored: 'test order' });
    expect(h.mail).toHaveLength(0);
    const on = harness({ SHOPIFY_SHOP_DOMAIN: SHOP, PROCESS_TEST_ORDERS: 'true' });
    expect((await webhook(on, 'orders/paid', order(5551000009, { test: true }))).body).toEqual({ sent: true });

    const noMail = shop();
    const r = await webhook(noMail, 'orders/paid', order(5551000010, { email: '', customer: { first_name: 'Sara' } }));
    expect(r.body).toEqual({ sent: false, reason: 'no_email' });
    expect(noMail.mail).toHaveLength(0);
    expect((await noMail.db.prepare('SELECT status FROM orders').first<{ status: string }>())!.status).toBe('no_email');
  });

  it('needs the signing key and the Resend key to be set, and says so', async () => {
    const noKey = harness({ PIY_PRIVATE_KEY: undefined });
    expect((await webhook(noKey, 'orders/paid', order())).status).toBe(500);
    const noMail = harness({ RESEND_API_KEY: undefined });
    expect((await webhook(noMail, 'orders/paid', order())).status).toBe(500);
    expect((await noMail.db.prepare('SELECT status FROM orders').first<{ status: string }>())!.status).toBe('pending'); // can be retried once fixed
  });

  it('escapes what a customer typed, and follows the brand: ink on paper, yellow highlight, no red, no dashes', async () => {
    const h = shop();
    await webhook(h, 'orders/paid', order(5551000011, { customer: { first_name: '<b>Sara</b>&"' } }));
    const { html, text } = h.mail[0]!;
    expect(html).not.toContain('<b>Sara</b>');
    expect(html).toContain('&lt;b&gt;Sara&lt;/b&gt;&amp;&quot;');
    expect(html).toContain('#1F2A44');
    expect(html).toContain('#FFE14D');
    expect(html.toLowerCase()).not.toMatch(/#f00\b|#ff0000|\bred\b/);
    for (const s of [html.replace('<!doctype html>', ''), text]) {
      expect(s).not.toMatch(/[—–]/);
      expect(s).not.toMatch(/loan|transfer|affiliate|guarantee|!/i);
    }
    expect(text).toContain('A planning tool, not financial advice.');
  });
});

describe('who may call the webhook', () => {
  it('refuses a forged request, a changed one, and one from another shop', async () => {
    const h = shop();
    expect((await webhook(h, 'orders/paid', order(), { signature: 'AAAA' })).status).toBe(401);
    expect((await webhook(h, 'orders/paid', order(), { secret: 'a different secret' })).status).toBe(401);
    const body = JSON.stringify(order());
    const tampered = await h.json('/webhooks/shopify', {
      method: 'POST',
      body: body.replace('9.00', '0.01'),
      headers: { 'X-Shopify-Topic': 'orders/paid', 'X-Shopify-Hmac-Sha256': sign(body), 'X-Shopify-Shop-Domain': SHOP },
    });
    expect(tampered.status).toBe(401);
    expect((await webhook(h, 'orders/paid', order(), { shop: 'someone-else.myshopify.com' })).status).toBe(401);
    const noHeader = await h.json('/webhooks/shopify', { method: 'POST', body, headers: { 'X-Shopify-Topic': 'orders/paid' } });
    expect(noHeader.status).toBe(401);
    expect(h.mail).toHaveLength(0);
    expect(await count(h, 'orders')).toBe(0);
  });

  it('answers 200 to topics it does not use, and refuses other methods', async () => {
    const h = shop();
    expect((await webhook(h, 'customers/create', { id: 1 })).body).toEqual({ ignored: 'customers/create' });
    expect((await h.json('/webhooks/shopify', { method: 'GET' })).status).toBe(405);
  });
});

describe('refunds', () => {
  const refund = (id: number, amount: string, orderId = 5551000001) => ({ id, order_id: orderId, transactions: [{ kind: 'refund', status: 'success', amount }] });

  it('a full refund blocks sync for that code only, and the code still checks out offline', async () => {
    const h = shop();
    await webhook(h, 'orders/paid', order(5551000001, { order_number: 1042 }));
    await webhook(h, 'orders/paid', order(5551000002, { order_number: 1043 }));
    const [c1, c2] = [codeIn(h, 0), codeIn(h, 1)];
    expect((await put(h, [record('debts/a', NOW)], c1)).status).toBe(200);

    expect((await webhook(h, 'refunds/create', refund(7001, '9.00'))).body).toEqual({ revoked: true });
    expect((await get(h, c1)).status).toBe(403);
    expect((await put(h, [record('debts/b', NOW + 1)], c1)).body.error).toBe('code_revoked');
    expect(verifyToken(c1, TEST_PUBLIC).ok).toBe(true); // still valid on the phone, offline
    expect((await put(h, [record('debts/a', NOW)], c2, 'Mn4Pq8Rs2TuVw6XyZa0Bc1')).status).toBe(200); // another buyer is fine
    // The refunded buyer can still delete their own data
    expect((await h.json(`/sync/${SYNC_ID}`, { method: 'DELETE', code: c1 })).status).toBe(200);
  });

  it('a part refund keeps the code working; part refunds that add up to the total block it; a repeated refund counts once', async () => {
    const h = shop();
    await webhook(h, 'orders/paid', order());
    const code = codeIn(h);
    expect((await webhook(h, 'refunds/create', refund(7001, '3.00'))).body).toEqual({ revoked: false });
    expect((await put(h, [record('debts/a', NOW)], code)).status).toBe(200);
    expect((await webhook(h, 'refunds/create', refund(7001, '3.00'))).body).toEqual({ revoked: false });
    expect((await webhook(h, 'refunds/create', refund(7002, '6.00'))).body).toEqual({ revoked: true });
    expect((await get(h, code)).status).toBe(403);
  });

  it('a refund for an order we never saw is ignored', async () => {
    const h = shop();
    expect((await webhook(h, 'refunds/create', refund(7001, '9.00', 123))).body).toEqual({ ignored: 'not one of our orders' });
  });
});

describe('no secrets in the repo', () => {
  it('wrangler.toml names the secrets in comments only, and holds no key', () => {
    const toml = readFileSync(join(__dirname, '..', 'wrangler.toml'), 'utf8');
    expect(toml).not.toMatch(/^(PIY_PRIVATE_KEY|SHOPIFY_WEBHOOK_SECRET|RESEND_API_KEY)\s*=/m);
    expect(toml).not.toMatch(/re_[A-Za-z0-9]{10,}/);
  });
});
