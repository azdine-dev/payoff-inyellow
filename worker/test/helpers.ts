import * as ed from '@noble/ed25519';
import { createHandler } from '../src/index';
import type { Deps, Env } from '../src/env';
import { createD1, type SqliteD1 } from '../dev/d1-sqlite';
import { b64urlEncode, publicKeyOf, signToken } from '../../src/lib/licenseCore';

/** A key pair for the tests only. */
export const TEST_PRIVATE = ed.etc.bytesToHex(ed.utils.randomPrivateKey());
export const TEST_PUBLIC = publicKeyOf(TEST_PRIVATE);
export const OTHER_PRIVATE = ed.etc.bytesToHex(ed.utils.randomPrivateKey());

export const ORIGIN = 'https://app.paidinyellow.com';
export const NOW = Date.parse('2026-10-19T12:00:00Z');

export function codeFor(id: string, key = TEST_PRIVATE): string {
  return signToken({ product: 'pack1', id, date: '2026-10-19' }, key);
}

export interface Harness {
  env: Env;
  db: SqliteD1;
  clock: { now: number };
  mail: { to: string; subject: string; html: string; text: string; headers: Record<string, string> }[];
  fetchCalls: { url: string; init: RequestInit }[];
  call(path: string, init?: RequestInit & { code?: string | null; origin?: string; ip?: string }): Promise<Response>;
  json(path: string, init?: RequestInit & { code?: string | null; origin?: string; ip?: string }): Promise<{ status: number; body: any; res: Response }>;
}

/** The real Worker on an in-memory database, with a fake clock and a fake Resend. */
export function harness(extra: Partial<Env> = {}): Harness {
  const db = createD1();
  const clock = { now: NOW };
  const mail: Harness['mail'] = [];
  const fetchCalls: Harness['fetchCalls'] = [];
  const deps: Deps = {
    now: () => clock.now,
    fetch: (async (url: string | URL | Request, init?: RequestInit) => {
      fetchCalls.push({ url: String(url), init: init ?? {} });
      if (String(url) === 'https://api.resend.com/emails') {
        const body = JSON.parse(String(init?.body));
        mail.push({ to: body.to[0], subject: body.subject, html: body.html, text: body.text, headers: init?.headers as Record<string, string> });
        return new Response(JSON.stringify({ id: 'email_1' }), { status: 200 });
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch,
  };
  const env: Env = {
    DB: db,
    PIY_PUBLIC_KEY: TEST_PUBLIC,
    PIY_PRIVATE_KEY: TEST_PRIVATE,
    SHOPIFY_WEBHOOK_SECRET: 'shpss_test_secret',
    RESEND_API_KEY: 're_test_key',
    ALLOWED_ORIGINS: ORIGIN,
    APP_URL: ORIGIN,
    MAIL_FROM: 'PaidInYellow <hello@paidinyellow.com>',
    MAIL_REPLY_TO: 'support@paidinyellow.com',
    KIT_LINKS: JSON.stringify([
      { name: '7-Day Debt Reset (workbook PDF)', url: 'https://files.paidinyellow.com/7-day-debt-reset.pdf' },
      { name: 'Debt-Free Tracker Kit (printables)', url: 'https://files.paidinyellow.com/tracker-kit.pdf' },
    ]),
    ...extra,
  };
  const handle = createHandler(deps);
  const call: Harness['call'] = (path, init = {}) => {
    const { code, origin, ip, ...rest } = init;
    const headers = new Headers(rest.headers);
    if (code !== null && code !== undefined) headers.set('X-PIY-Code', code);
    if (origin) headers.set('Origin', origin);
    headers.set('cf-connecting-ip', ip ?? '203.0.113.7');
    return handle(new Request(`https://api.test${path}`, { ...rest, headers }), env);
  };
  return {
    env,
    db,
    clock,
    mail,
    fetchCalls,
    call,
    async json(path, init) {
      const res = await call(path, init);
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : null, res };
    },
  };
}

export const SYNC_ID = 'Kx7Qm2Zr9TpVnB4LcYd8Wa'; // 22 characters, like a real 128-bit id

let counter = 0;
/** A record the way the phone sends it. The ct is random bytes: the server can't tell the difference. */
export function record(rid: string, ts: number, bytes = 48) {
  const iv = b64urlEncode(Uint8Array.from({ length: 12 }, (_, i) => (i * 7 + counter++) % 256));
  const ct = b64urlEncode(Uint8Array.from({ length: bytes }, (_, i) => (i * 13 + counter) % 256));
  return { rid, ts, iv, ct };
}

export const put = (h: Harness, records: unknown[], code: string, syncId = SYNC_ID, extra: Record<string, unknown> = {}) =>
  h.json(`/sync/${syncId}`, { method: 'PUT', code, body: JSON.stringify({ records }), headers: { 'Content-Type': 'application/json' }, ...extra });

export const get = (h: Harness, code: string, query = '', syncId = SYNC_ID) => h.json(`/sync/${syncId}${query}`, { code });
