/**
 * Shopify webhooks.
 *
 *   orders/paid      ("Order payment")  one order = one unlock code, emailed to the buyer
 *   refunds/create                       a refund that covers the order puts its code on the revoked list
 *
 * Every request is checked with the HMAC signature Shopify adds (base64 SHA-256 of the raw body, using the
 * webhook secret). Shopify can send the same event more than once, so the order id is the idempotency key.
 * A refund blocks SYNC only. The code still unlocks the app on the phone, because it works with no server.
 */
import { signToken } from '../../src/lib/licenseCore';
import type { Deps, Env } from './env';
import { HttpError, json, safeEqual } from './http';
import { buildEmail, parseKitLinks, sendEmail } from './mail';

const MAX_BODY = 1024 * 1024;

export async function hmacBase64(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)));
  let bin = '';
  for (const b of sig) bin += String.fromCharCode(b);
  return btoa(bin);
}

interface ShopifyOrder {
  id?: number | string;
  order_number?: number | string;
  email?: string | null;
  test?: boolean;
  total_price?: string | number;
  customer?: { email?: string | null; first_name?: string | null } | null;
}

interface ShopifyRefund {
  id?: number | string;
  order_id?: number | string;
  transactions?: { kind?: string; status?: string; amount?: string | number }[];
}

const ID = /^\d{1,20}$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export async function handleShopify(req: Request, env: Env, deps: Deps): Promise<Response> {
  if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'Use POST.', { Allow: 'POST' });
  if (!env.SHOPIFY_WEBHOOK_SECRET) throw new HttpError(500, 'not_configured', 'The webhook secret is not set.');

  const body = await req.text();
  if (body.length > MAX_BODY) throw new HttpError(413, 'body_too_big', 'Too big.');
  const given = req.headers.get('X-Shopify-Hmac-Sha256') ?? '';
  if (!given || !safeEqual(await hmacBase64(env.SHOPIFY_WEBHOOK_SECRET, body), given)) {
    throw new HttpError(401, 'bad_signature', 'The signature does not match.');
  }
  const shop = req.headers.get('X-Shopify-Shop-Domain');
  if (env.SHOPIFY_SHOP_DOMAIN && shop !== env.SHOPIFY_SHOP_DOMAIN) throw new HttpError(401, 'wrong_shop', 'This is not our shop.');

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new HttpError(400, 'bad_json', 'The body is not JSON.');
  }
  const topic = req.headers.get('X-Shopify-Topic') ?? '';
  if (topic === 'orders/paid') return orderPaid(payload as ShopifyOrder, env, deps);
  if (topic === 'refunds/create') return refundCreated(payload as ShopifyRefund, env, deps);
  return json({ ignored: topic || 'no topic' });
}

async function orderPaid(order: ShopifyOrder, env: Env, deps: Deps): Promise<Response> {
  const orderId = String(order.id ?? '');
  if (!ID.test(orderId)) throw new HttpError(400, 'bad_order', 'The order has no id.');
  if (order.test && env.PROCESS_TEST_ORDERS !== 'true') return json({ ignored: 'test order' });
  if (!env.PIY_PRIVATE_KEY) throw new HttpError(500, 'not_configured', 'The signing key is not set.');

  const email = String(order.email || order.customer?.email || '').trim().toLowerCase();
  const db = env.DB;
  const now = deps.now();

  // Claim the order. If it was seen before, the first code is kept, so one order is always one code.
  const orderNumber = String(order.order_number ?? '');
  const codeId = `shopify-${ID.test(orderNumber) ? orderNumber : orderId}`;
  const code = signToken({ product: 'pack1', id: codeId, date: isoDay(now) }, env.PIY_PRIVATE_KEY);
  const total = Number(order.total_price) || 0;
  await db
    .prepare('INSERT OR IGNORE INTO orders (order_id, code_id, code, email, total, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(orderId, codeId, code, EMAIL.test(email) ? email : null, total, EMAIL.test(email) ? 'pending' : 'no_email', now)
    .run();
  const row = await db.prepare('SELECT code, email, status FROM orders WHERE order_id = ?').bind(orderId).first<{ code: string; email: string | null; status: string }>();
  if (!row) throw new HttpError(500, 'order_not_saved', 'The order could not be saved.');

  if (row.status === 'sent') return json({ duplicate: true, sent: true });
  if (!row.email) {
    console.error(`order ${orderId}: no valid email, code ${codeId} was made but not sent`);
    return json({ sent: false, reason: 'no_email' }); // a retry can't fix this
  }

  const msg = buildEmail({
    firstName: order.customer?.first_name?.trim().slice(0, 60) || null,
    appLink: `${(env.APP_URL ?? 'https://app.paidinyellow.com').replace(/\/+$/, '')}/#unlock=${row.code}`,
    code: row.code,
    kit: parseKitLinks(env.KIT_LINKS),
  });
  // If this fails, the order stays "pending" and Shopify's retry sends it. Resend ignores a repeated key, so it is never sent twice.
  await sendEmail(env, deps, row.email, msg, `piy-order-${orderId}`);
  await db.prepare("UPDATE orders SET status = 'sent', sent_at = ? WHERE order_id = ?").bind(now, orderId).run();
  return json({ sent: true });
}

async function refundCreated(refund: ShopifyRefund, env: Env, deps: Deps): Promise<Response> {
  const refundId = String(refund.id ?? '');
  const orderId = String(refund.order_id ?? '');
  if (!ID.test(refundId) || !ID.test(orderId)) throw new HttpError(400, 'bad_refund', 'The refund has no id.');
  const db = env.DB;
  const order = await db.prepare('SELECT code_id, total FROM orders WHERE order_id = ?').bind(orderId).first<{ code_id: string; total: number }>();
  if (!order) return json({ ignored: 'not one of our orders' });

  const amount = (refund.transactions ?? [])
    .filter((t) => t.kind === 'refund' && t.status === 'success')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const now = deps.now();
  await db.prepare('INSERT OR IGNORE INTO refunds (refund_id, order_id, amount, created_at) VALUES (?, ?, ?, ?)').bind(refundId, orderId, amount, now).run();

  const sum = await db.prepare('SELECT COALESCE(SUM(amount), 0) AS paid_back FROM refunds WHERE order_id = ?').bind(orderId).first<{ paid_back: number }>();
  // A full refund (a cent of rounding allowed). A partial refund (a discount after the fact) keeps the code working.
  const full = order.total > 0 && (sum?.paid_back ?? 0) >= order.total - 0.01;
  if (full) {
    await db.prepare("INSERT OR IGNORE INTO revoked (code_id, revoked_at, reason) VALUES (?, ?, 'refund')").bind(order.code_id, now).run();
  }
  return json({ revoked: full });
}
