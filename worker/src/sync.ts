/**
 * Encrypted sync. The server stores opaque records and never sees a plan: every record is
 * encrypted on the phone (AES-GCM) before it is sent, and the key never reaches the server (it
 * travels in the link's # part). The server only knows: an id, a time, and some scrambled bytes.
 *
 *   PUT    /sync/:id            { records: [{ rid, ts, iv, ct } | { rid, ts, deleted: true }] }
 *   GET    /sync/:id?since=N    records changed after server number N (oldest first)
 *   DELETE /sync/:id            delete everything stored for this id
 *
 * One record per debt / payment / setting. Last change wins, per record, by `ts`.
 * Made so two partners can share one id later (Debt-Free Together): nothing here is per device.
 */
import type { Caller } from './auth';
import { limits, type D1Like, type Env } from './env';
import { HttpError, json } from './http';

const SYNC_ID = /^[A-Za-z0-9_-]{22,64}$/;
const RID = /^[a-z][a-z0-9-]{0,23}\/[A-Za-z0-9_.:-]{1,100}$/;
const B64URL = /^[A-Za-z0-9_-]+$/;
const MAX_BODY_FACTOR = 1.4; // base64 overhead

export function checkSyncId(id: string): void {
  if (!SYNC_ID.test(id)) throw new HttpError(400, 'bad_sync_id', 'The sync id is not valid.');
}

interface IncomingRecord {
  rid: string;
  ts: number;
  deleted: boolean;
  iv: string | null;
  ct: string | null;
  size: number;
}

function parseRecords(body: unknown, env: Env, now: number): IncomingRecord[] {
  const lim = limits(env);
  const list = (body as { records?: unknown })?.records;
  if (!Array.isArray(list) || list.length === 0) throw new HttpError(400, 'bad_body', 'Send { "records": [ ... ] }.');
  if (list.length > lim.maxRecordsPerPut) throw new HttpError(413, 'too_many_records', `At most ${lim.maxRecordsPerPut} records at a time.`);

  const seen = new Set<string>();
  return list.map((raw, i) => {
    const r = raw as Record<string, unknown>;
    const where = `record ${i}`;
    if (typeof r.rid !== 'string' || !RID.test(r.rid)) throw new HttpError(400, 'bad_rid', `${where}: bad rid.`);
    if (seen.has(r.rid)) throw new HttpError(400, 'duplicate_rid', `${where}: the same rid twice in one request.`);
    seen.add(r.rid);
    if (!Number.isInteger(r.ts) || (r.ts as number) < 1_000_000_000_000 || (r.ts as number) > now + 86_400_000) {
      throw new HttpError(400, 'bad_ts', `${where}: bad time.`);
    }
    if (r.deleted === true) {
      if (r.ct !== undefined || r.iv !== undefined) throw new HttpError(400, 'bad_record', `${where}: a deleted record has no data.`);
      return { rid: r.rid, ts: r.ts as number, deleted: true, iv: null, ct: null, size: 0 };
    }
    if (typeof r.iv !== 'string' || r.iv.length !== 16 || !B64URL.test(r.iv)) throw new HttpError(400, 'bad_iv', `${where}: bad iv.`);
    if (typeof r.ct !== 'string' || !B64URL.test(r.ct) || r.ct.length < 22) throw new HttpError(400, 'bad_ct', `${where}: bad data.`);
    const bytes = Math.floor((r.ct.length * 3) / 4);
    if (bytes > lim.maxRecordBytes) throw new HttpError(413, 'record_too_big', `${where}: bigger than ${lim.maxRecordBytes} bytes.`);
    return { rid: r.rid, ts: r.ts as number, deleted: false, iv: r.iv, ct: r.ct, size: bytes };
  });
}

export async function putRecords(req: Request, env: Env, caller: Caller, syncId: string, now: number): Promise<Response> {
  const lim = limits(env);
  const text = await req.text();
  if (text.length > lim.maxRecordsPerPut * lim.maxRecordBytes * MAX_BODY_FACTOR) throw new HttpError(413, 'body_too_big', 'That request is too big.');
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new HttpError(400, 'bad_json', 'The body is not JSON.');
  }
  const records = parseRecords(body, env, now);
  const db: D1Like = env.DB;

  // The space (created by the first PUT)
  let space = await db.prepare('SELECT last_seq, record_count, bytes FROM sync_spaces WHERE sync_id = ?').bind(syncId).first<{ last_seq: number; record_count: number; bytes: number }>();
  if (!space) {
    const owned = await db.prepare('SELECT COUNT(*) AS n FROM sync_spaces WHERE owner = ?').bind(caller.codeId).first<{ n: number }>();
    if ((owned?.n ?? 0) >= lim.maxSpacesPerCode) throw new HttpError(403, 'too_many_spaces', 'This code already has the most sync spaces it can have.');
    await db.prepare('INSERT OR IGNORE INTO sync_spaces (sync_id, created_at, owner) VALUES (?, ?, ?)').bind(syncId, now, caller.codeId).run();
    space = { last_seq: 0, record_count: 0, bytes: 0 };
  }

  // Size caps, counting only what is new or bigger
  const marks = records.map(() => '?').join(',');
  const existing = await db
    .prepare(`SELECT rid, size FROM sync_records WHERE sync_id = ? AND rid IN (${marks})`)
    .bind(syncId, ...records.map((r) => r.rid))
    .all<{ rid: string; size: number }>();
  const had = new Map(existing.results.map((r) => [r.rid, r.size]));
  const addCount = records.filter((r) => !had.has(r.rid)).length;
  const addBytes = records.reduce((s, r) => s + r.size - (had.get(r.rid) ?? 0), 0);
  if (space.record_count + addCount > lim.maxRecordsPerSpace) throw new HttpError(413, 'space_full', 'Too many records stored for this sync id.');
  if (space.bytes + addBytes > lim.maxBytesPerSpace) throw new HttpError(413, 'space_full', 'Too much data stored for this sync id.');

  // Server numbers: taken in one atomic step, so two phones syncing at once never share a number
  const bumped = await db
    .prepare('UPDATE sync_spaces SET last_seq = last_seq + ? WHERE sync_id = ? RETURNING last_seq')
    .bind(records.length, syncId)
    .first<{ last_seq: number }>();
  const lastSeq = bumped?.last_seq ?? space.last_seq + records.length;
  const base = lastSeq - records.length;

  // Last change wins, per record: a record is only replaced by a newer one
  const upsert =
    'INSERT INTO sync_records (sync_id, rid, ts, seq, deleted, iv, ct, size) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT (sync_id, rid) DO UPDATE SET ts = excluded.ts, seq = excluded.seq, deleted = excluded.deleted, ' +
    'iv = excluded.iv, ct = excluded.ct, size = excluded.size WHERE excluded.ts > sync_records.ts';
  const statements = records.map((r, i) => db.prepare(upsert).bind(syncId, r.rid, r.ts, base + i + 1, r.deleted ? 1 : 0, r.iv, r.ct, r.size));
  statements.push(
    db
      .prepare(
        'UPDATE sync_spaces SET record_count = (SELECT COUNT(*) FROM sync_records WHERE sync_id = ?), ' +
          'bytes = (SELECT COALESCE(SUM(size), 0) FROM sync_records WHERE sync_id = ?) WHERE sync_id = ?',
      )
      .bind(syncId, syncId, syncId),
  );
  const results = await db.batch(statements);
  const accepted = results.slice(0, records.length).reduce((s, r) => s + (r.meta.changes > 0 ? 1 : 0), 0);
  return json({ accepted, skipped: records.length - accepted, seq: lastSeq });
}

export async function getRecords(req: Request, env: Env, syncId: string): Promise<Response> {
  const url = new URL(req.url);
  const since = Math.max(0, Math.floor(Number(url.searchParams.get('since') ?? 0)) || 0);
  const limit = Math.min(1000, Math.max(1, Math.floor(Number(url.searchParams.get('limit') ?? 500)) || 500));

  const space = await env.DB.prepare('SELECT last_seq FROM sync_spaces WHERE sync_id = ?').bind(syncId).first<{ last_seq: number }>();
  if (!space) throw new HttpError(404, 'not_found', 'No sync here. It was stopped, or the link is wrong.');

  const rows = await env.DB
    .prepare('SELECT rid, ts, seq, deleted, iv, ct FROM sync_records WHERE sync_id = ? AND seq > ? ORDER BY seq ASC LIMIT ?')
    .bind(syncId, since, limit + 1)
    .all<{ rid: string; ts: number; seq: number; deleted: number; iv: string | null; ct: string | null }>();
  const more = rows.results.length > limit;
  const page = rows.results.slice(0, limit);
  return json({
    records: page.map((r) => ({ rid: r.rid, ts: r.ts, seq: r.seq, deleted: r.deleted === 1, iv: r.iv, ct: r.ct })),
    // When this is the last page, jump to the newest number, so gaps (records skipped by "last change wins") are not asked for again
    seq: more ? page[page.length - 1]!.seq : Math.max(space.last_seq, since),
    more,
  });
}

export async function deleteSpace(env: Env, syncId: string): Promise<Response> {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sync_records WHERE sync_id = ?').bind(syncId),
    env.DB.prepare('DELETE FROM sync_spaces WHERE sync_id = ?').bind(syncId),
  ]);
  return json({ deleted: true });
}
