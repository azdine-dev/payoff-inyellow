#!/usr/bin/env node
// Sends a fake Shopify "order paid" (or refund) to the Worker, signed the way Shopify signs it.
//
//   node scripts/fake-order.js                          a new order to test@paidinyellow.com
//   node scripts/fake-order.js --email you@example.com  another address
//   node scripts/fake-order.js --order 1001             the SAME order again (it must not send twice)
//   node scripts/fake-order.js --order 1001 --refund    refund that order in full
//   node scripts/fake-order.js --bad-signature          a forged request (must be refused)
//
// Options: --url http://localhost:8787  --secret <webhook secret>  --total 9.00
// The secret and url can also come from SHOPIFY_WEBHOOK_SECRET and WORKER_URL. Default secret: dev-secret.
import { createHmac } from 'node:crypto';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const url = `${opt('url', process.env.WORKER_URL ?? 'http://localhost:8787').replace(/\/+$/, '')}/webhooks/shopify`;
const secret = opt('secret', process.env.SHOPIFY_WEBHOOK_SECRET ?? 'dev-secret');
const orderId = opt('order', String(5_000_000_000_000 + Math.floor(Math.random() * 1e9)));
const total = opt('total', '9.00');
const email = opt('email', 'test@paidinyellow.com');

const refund = flag('refund');
const topic = refund ? 'refunds/create' : 'orders/paid';
const payload = refund
  ? { id: Number(`9${orderId.slice(-8)}`), order_id: Number(orderId), transactions: [{ kind: 'refund', status: 'success', amount: total }] }
  : {
      id: Number(orderId),
      order_number: Number(orderId.slice(-4)) + 1000,
      email,
      test: true,
      financial_status: 'paid',
      total_price: total,
      customer: { first_name: 'Sara', email },
      line_items: [{ title: 'Paycheck Payoff Planner' }],
    };

const body = JSON.stringify(payload);
const signature = flag('bad-signature') ? 'AAAA' : createHmac('sha256', secret).update(body).digest('base64');
const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Shopify-Topic': topic,
    'X-Shopify-Hmac-Sha256': signature,
    'X-Shopify-Shop-Domain': process.env.SHOPIFY_SHOP_DOMAIN ?? 'paidinyellow.myshopify.com',
    'X-Shopify-Webhook-Id': `fake-${Date.now()}`,
  },
  body,
});
console.log(`${topic} order ${orderId} -> ${res.status} ${await res.text()}`);
