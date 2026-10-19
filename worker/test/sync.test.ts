import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { verifyToken } from '../../src/lib/licenseCore';
import { NOW, ORIGIN, OTHER_PRIVATE, SYNC_ID, TEST_PUBLIC, codeFor, get, harness, put, record } from './helpers';

const T = NOW; // a time the server accepts

describe('who can sync', () => {
  it('answers /health with no code', async () => {
    const h = harness();
    expect((await h.json('/health')).body).toEqual({ ok: true });
  });

  it('needs a real unlock code', async () => {
    const h = harness();
    const good = codeFor('shopify-1');
    const oneLetter = good.slice(0, 30) + (good[30] === 'A' ? 'B' : 'A') + good.slice(31);
    for (const code of [null, '', 'hello', oneLetter, codeFor('shopify-1', OTHER_PRIVATE)]) {
      const r = await h.json(`/sync/${SYNC_ID}`, { code });
      expect(r.status, String(code)).toBe(401);
      expect(r.body.error).toBe('code_invalid');
    }
    // A good code gets through to the next check (there is no sync space yet)
    expect((await get(h, good)).status).toBe(404);
  });

  it('refuses a sync id that is not a proper one', async () => {
    const h = harness();
    for (const id of ['short', 'has space in it xxxxxxxx', 'x'.repeat(65), '..%2F..%2Fetc']) {
      expect((await h.json(`/sync/${id}`, { code: codeFor('a') })).status, id).toBe(400);
    }
  });

  it('a refunded code is blocked from sync, but still checks out as a valid code on the phone', async () => {
    const h = harness();
    const code = codeFor('shopify-77');
    expect((await put(h, [record('debts/a', T)], code)).status).toBe(200);
    await h.db.prepare('INSERT INTO revoked (code_id, revoked_at, reason) VALUES (?, ?, ?)').bind('shopify-77', T, 'refund').run();
    const blocked = await get(h, code);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toBe('code_revoked');
    expect((await put(h, [record('debts/b', T + 1)], code)).status).toBe(403);
    expect(verifyToken(code, TEST_PUBLIC).ok).toBe(true); // offline, on the phone: still valid
    // Other buyers are not affected
    expect((await put(h, [record('debts/a', T)], codeFor('shopify-78'), 'Mn4Pq8Rs2TuVw6XyZa0Bc1')).status).toBe(200);
  });
});

describe('saving and getting records', () => {
  const code = codeFor('shopify-1');

  it('saves records and gives them back, oldest first, with server numbers', async () => {
    const h = harness();
    const a = record('debts/a', T);
    const b = record('payments/b', T + 5);
    const saved = await put(h, [a, b], code);
    expect(saved.body).toEqual({ accepted: 2, skipped: 0, seq: 2 });

    const all = await get(h, code);
    expect(all.status).toBe(200);
    expect(all.body.more).toBe(false);
    expect(all.body.seq).toBe(2);
    expect(all.body.records).toEqual([
      { rid: 'debts/a', ts: T, seq: 1, deleted: false, iv: a.iv, ct: a.ct },
      { rid: 'payments/b', ts: T + 5, seq: 2, deleted: false, iv: b.iv, ct: b.ct },
    ]);
  });

  it('"since" gives only what changed after it', async () => {
    const h = harness();
    await put(h, [record('debts/a', T), record('debts/b', T)], code);
    await put(h, [record('debts/a', T + 10)], code); // a changes again: seq 3
    const after = await get(h, code, '?since=2');
    expect(after.body.records.map((r: any) => [r.rid, r.seq])).toEqual([['debts/a', 3]]);
    expect((await get(h, code, '?since=3')).body.records).toEqual([]);
  });

  it('the last change wins, per record', async () => {
    const h = harness();
    const first = record('debts/a', T);
    const newer = record('debts/a', T + 100);
    const older = record('debts/a', T - 100);
    await put(h, [first], code);
    expect((await put(h, [newer], code)).body).toMatchObject({ accepted: 1, skipped: 0 });
    expect((await put(h, [older], code)).body).toMatchObject({ accepted: 0, skipped: 1 });
    expect((await put(h, [record('debts/a', T + 100)], code)).body).toMatchObject({ accepted: 0, skipped: 1 }); // a tie keeps what is there
    const stored = (await get(h, code)).body.records;
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ ts: T + 100, ct: newer.ct });
  });

  it('a record is a whole unit: two records in one request win or lose on their own', async () => {
    const h = harness();
    await put(h, [record('debts/a', T + 50)], code);
    const r = await put(h, [record('debts/a', T), record('debts/b', T)], code);
    expect(r.body).toMatchObject({ accepted: 1, skipped: 1 });
    expect((await get(h, code)).body.records.map((x: any) => x.rid).sort()).toEqual(['debts/a', 'debts/b']);
  });

  it('a delete is a record too: newer wins, older is ignored, and the data is dropped', async () => {
    const h = harness();
    await put(h, [record('funds/x', T)], code);
    expect((await put(h, [{ rid: 'funds/x', ts: T - 1, deleted: true }], code)).body.accepted).toBe(0);
    expect((await put(h, [{ rid: 'funds/x', ts: T + 1, deleted: true }], code)).body.accepted).toBe(1);
    const [rec] = (await get(h, code)).body.records;
    expect(rec).toMatchObject({ rid: 'funds/x', deleted: true, iv: null, ct: null });
    // Coming back later (a newer change) works too
    expect((await put(h, [record('funds/x', T + 9)], code)).body.accepted).toBe(1);
    expect((await get(h, code)).body.records[0].deleted).toBe(false);
  });

  it('pages through a lot of records and ends on the newest number', async () => {
    const h = harness();
    await put(h, Array.from({ length: 5 }, (_, i) => record(`debts/d${i}`, T + i)), code);
    const first = await get(h, code, '?limit=2');
    expect(first.body).toMatchObject({ more: true, seq: 2 });
    const second = await get(h, code, `?limit=2&since=${first.body.seq}`);
    expect(second.body).toMatchObject({ more: true, seq: 4 });
    const third = await get(h, code, `?limit=2&since=${second.body.seq}`);
    expect(third.body).toMatchObject({ more: false, seq: 5 });
    expect(third.body.records).toHaveLength(1);
  });

  it('two phones saving at the same moment never share a server number', async () => {
    const h = harness();
    await put(h, [record('debts/seed', T)], code);
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => put(h, [record(`payments/p${i}`, T + i), record(`charges/c${i}`, T + i)], code)),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);
    const rows = (await get(h, code, '?limit=1000')).body.records as { seq: number }[];
    expect(rows).toHaveLength(17);
    expect(new Set(rows.map((r) => r.seq)).size).toBe(17);
  });

  it('keeps each sync id separate', async () => {
    const h = harness();
    await put(h, [record('debts/a', T)], code, SYNC_ID);
    await put(h, [record('debts/z', T)], code, 'Mn4Pq8Rs2TuVw6XyZa0Bc1');
    expect((await get(h, code, '', SYNC_ID)).body.records.map((r: any) => r.rid)).toEqual(['debts/a']);
    expect((await get(h, code, '', 'Mn4Pq8Rs2TuVw6XyZa0Bc1')).body.records.map((r: any) => r.rid)).toEqual(['debts/z']);
  });
});

describe('what the server refuses', () => {
  const code = codeFor('shopify-1');

  it('bad requests', async () => {
    const h = harness();
    const ok = record('debts/a', T);
    const cases: [string, unknown[], number, string][] = [
      ['bad rid', [{ ...ok, rid: 'Debts/A' }], 400, 'bad_rid'],
      ['no slash in rid', [{ ...ok, rid: 'debtsa' }], 400, 'bad_rid'],
      ['same rid twice', [ok, ok], 400, 'duplicate_rid'],
      ['time too old', [{ ...ok, ts: 5 }], 400, 'bad_ts'],
      ['time in the far future', [{ ...ok, ts: T + 10 * 86_400_000 }], 400, 'bad_ts'],
      ['time not a whole number', [{ ...ok, ts: T + 0.5 }], 400, 'bad_ts'],
      ['bad iv length', [{ ...ok, iv: 'short' }], 400, 'bad_iv'],
      ['ct with bad characters', [{ ...ok, ct: 'not base64 !!!!!!!!!!!!!!!!!!' }], 400, 'bad_ct'],
      ['ct too short to hold the tag', [{ ...ok, ct: 'AAAA' }], 400, 'bad_ct'],
      ['a deleted record with data', [{ rid: 'debts/a', ts: T, deleted: true, ct: ok.ct }], 400, 'bad_record'],
      ['no records', [], 400, 'bad_body'],
    ];
    for (const [name, records, status, error] of cases) {
      const r = await put(h, records, code);
      expect([name, r.status, r.body.error]).toEqual([name, status, error]);
    }
    expect((await h.json(`/sync/${SYNC_ID}`, { method: 'PUT', code, body: 'not json' })).body.error).toBe('bad_json');
    expect((await h.json(`/sync/${SYNC_ID}`, { method: 'POST', code, body: '{}' })).status).toBe(405);
  });

  it('a record that is too big, and too many records at once', async () => {
    const h = harness({ MAX_RECORD_BYTES: '200', MAX_RECORDS_PER_PUT: '3' });
    expect((await put(h, [record('debts/a', T, 150)], code)).status).toBe(200);
    const big = await put(h, [record('debts/b', T, 400)], code);
    expect([big.status, big.body.error]).toEqual([413, 'record_too_big']);
    const many = await put(h, [1, 2, 3, 4].map((i) => record(`debts/m${i}`, T)), code);
    expect([many.status, many.body.error]).toEqual([413, 'too_many_records']);
  });

  it('a sync id that is full: no new records, but existing ones can still change', async () => {
    const h = harness({ MAX_RECORDS_PER_SPACE: '3' });
    await put(h, [record('debts/a', T), record('debts/b', T), record('debts/c', T)], code);
    const full = await put(h, [record('debts/d', T)], code);
    expect([full.status, full.body.error]).toEqual([413, 'space_full']);
    expect((await put(h, [record('debts/a', T + 1)], code)).status).toBe(200);
    expect((await put(h, [{ rid: 'debts/b', ts: T + 1, deleted: true }], code)).status).toBe(200);
  });

  it('too many bytes stored for one sync id', async () => {
    const h = harness({ MAX_BYTES_PER_SPACE: '300' });
    expect((await put(h, [record('debts/a', T, 200)], code)).status).toBe(200);
    expect((await put(h, [record('debts/b', T, 200)], code)).body.error).toBe('space_full');
    expect((await put(h, [record('debts/a', T + 1, 100)], code)).status).toBe(200); // smaller: fits
  });

  it('a code can only start a few sync ids', async () => {
    const h = harness({ MAX_SPACES_PER_CODE: '2' });
    const ids = ['Aa1Bb2Cc3Dd4Ee5Ff6Gg7H', 'Hh8Ii9Jj0Kk1Ll2Mm3Nn4O', 'Oo5Pp6Qq7Rr8Ss9Tt0Uu1V'];
    expect((await put(h, [record('debts/a', T)], code, ids[0])).status).toBe(200);
    expect((await put(h, [record('debts/a', T)], code, ids[1])).status).toBe(200);
    const third = await put(h, [record('debts/a', T)], code, ids[2]);
    expect([third.status, third.body.error]).toEqual([403, 'too_many_spaces']);
    expect((await put(h, [record('debts/b', T)], code, ids[0])).status).toBe(200); // the ones it has still work
  });

  it('rate limits per sync id and per address, with Retry-After', async () => {
    const h = harness({ RATE_PER_SPACE_PER_MIN: '3', RATE_PER_IP_PER_MIN: '100' });
    const code2 = codeFor('shopify-2');
    for (let i = 0; i < 3; i++) expect((await put(h, [record('debts/a', T + i)], code2)).status).toBe(200);
    const blocked = await put(h, [record('debts/a', T + 9)], code2);
    expect(blocked.status).toBe(429);
    expect(blocked.res.headers.get('Retry-After')).toMatch(/^\d+$/);
    // The next minute it works again
    h.clock.now += 61_000;
    expect((await put(h, [record('debts/a', T + 10)], code2)).status).toBe(200);

    const byIp = harness({ RATE_PER_IP_PER_MIN: '2' });
    expect((await get(byIp, code2, '', 'Aa1Bb2Cc3Dd4Ee5Ff6Gg7H', )).status).toBe(404);
    expect((await get(byIp, code2, '', 'Hh8Ii9Jj0Kk1Ll2Mm3Nn4O')).status).toBe(404);
    expect((await get(byIp, code2, '', 'Oo5Pp6Qq7Rr8Ss9Tt0Uu1V')).status).toBe(429);
    expect((await byIp.json('/sync/Oo5Pp6Qq7Rr8Ss9Tt0Uu1V', { code: code2, ip: '198.51.100.9' })).status).toBe(404); // another address
  });
});

describe('stopping and deleting', () => {
  const code = codeFor('shopify-1');

  it('DELETE removes everything stored for that id, and only that id', async () => {
    const h = harness();
    await put(h, [record('debts/a', T), record('payments/b', T)], code);
    await put(h, [record('debts/keep', T)], code, 'Mn4Pq8Rs2TuVw6XyZa0Bc1');
    const del = await h.json(`/sync/${SYNC_ID}`, { method: 'DELETE', code });
    expect([del.status, del.body]).toEqual([200, { deleted: true }]);
    const gone = await get(h, code);
    expect([gone.status, gone.body.error]).toEqual([404, 'not_found']);
    // Really gone from the database, not just hidden
    expect((await h.db.prepare('SELECT COUNT(*) AS n FROM sync_records WHERE sync_id = ?').bind(SYNC_ID).first<{ n: number }>())!.n).toBe(0);
    expect((await h.db.prepare('SELECT COUNT(*) AS n FROM sync_spaces WHERE sync_id = ?').bind(SYNC_ID).first<{ n: number }>())!.n).toBe(0);
    expect((await get(h, code, '', 'Mn4Pq8Rs2TuVw6XyZa0Bc1')).body.records).toHaveLength(1);
    // Deleting twice is fine
    expect((await h.json(`/sync/${SYNC_ID}`, { method: 'DELETE', code })).status).toBe(200);
  });

  it('a refunded buyer has lost sync, but can still delete their own data', async () => {
    const h = harness();
    await put(h, [record('debts/a', T)], code);
    await h.db.prepare('INSERT INTO revoked (code_id, revoked_at) VALUES (?, ?)').bind('shopify-1', T).run();
    expect((await get(h, code)).status).toBe(403); // no more sync
    expect((await h.json(`/sync/${SYNC_ID}`, { method: 'DELETE', code })).status).toBe(200); // but the data can go
    expect((await h.db.prepare('SELECT COUNT(*) AS n FROM sync_records').first<{ n: number }>())!.n).toBe(0);
  });
});

describe('browsers', () => {
  it('lets the app talk to it, and nobody else', async () => {
    const h = harness();
    const code = codeFor('shopify-1');
    const pre = await h.call(`/sync/${SYNC_ID}`, { method: 'OPTIONS', origin: ORIGIN });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(pre.headers.get('Access-Control-Allow-Headers')).toContain('X-PIY-Code');
    const ok = await put(h, [record('debts/a', T)], code, SYNC_ID, { origin: ORIGIN });
    expect(ok.res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    const stranger = await get(h, code);
    expect(stranger.res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    const evil = await h.call(`/sync/${SYNC_ID}`, { code, origin: 'https://evil.example' });
    expect(evil.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(ok.res.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('setup', () => {
  it('the public key in wrangler.toml is the one in the app', () => {
    const toml = readFileSync(join(__dirname, '..', 'wrangler.toml'), 'utf8');
    const app = readFileSync(join(__dirname, '..', '..', 'src', 'lib', 'licenseKey.ts'), 'utf8');
    const inToml = /PIY_PUBLIC_KEY\s*=\s*"([0-9a-f]{64})"/.exec(toml)?.[1];
    const inApp = /APP_PUBLIC_KEY = '([0-9a-f]{64})'/.exec(app)?.[1];
    expect(inToml).toBeTruthy();
    expect(inToml).toBe(inApp);
  });

  it('no secret is written in wrangler.toml', () => {
    const toml = readFileSync(join(__dirname, '..', 'wrangler.toml'), 'utf8');
    expect(toml).not.toMatch(/(PIY_PRIVATE_KEY|SHOPIFY_WEBHOOK_SECRET|RESEND_API_KEY)\s*=/);
  });
});
