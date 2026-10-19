/**
 * PaidInYellow Worker: encrypted sync between a buyer's devices (and, later, two partners).
 * No accounts. The server never sees a plan in clear.
 *
 * Routes:
 *   GET    /health
 *   PUT    /sync/:id          save changed records
 *   GET    /sync/:id?since=N  get records changed after N
 *   DELETE /sync/:id          stop and delete everything stored for this id
 */
import { authorize } from './auth';
import { realDeps, type Deps, type Env } from './env';
import { corsHeaders, HttpError, json } from './http';
import { rateLimit } from './limits';
import { limits } from './env';
import { checkSyncId, deleteSpace, getRecords, putRecords } from './sync';

export function createHandler(deps: Deps = realDeps) {
  return async function handle(req: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(req, env);
    try {
      const url = new URL(req.url);
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      if (url.pathname === '/health') return json({ ok: true }, 200, cors);

      const m = /^\/sync\/([^/]+)$/.exec(url.pathname);
      if (m) {
        const syncId = decodeURIComponent(m[1]!);
        const now = deps.now();
        const lim = limits(env);
        const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? 'unknown';
        await rateLimit(env.DB, `ip:${ip}`, lim.ratePerIpPerMin, now);
        checkSyncId(syncId);
        const caller = await authorize(req, env, { allowRevoked: req.method === 'DELETE' });
        await rateLimit(env.DB, `sync:${syncId}`, lim.ratePerSpacePerMin, now);

        let res: Response;
        if (req.method === 'PUT') res = await putRecords(req, env, caller, syncId, now);
        else if (req.method === 'GET') res = await getRecords(req, env, syncId);
        else if (req.method === 'DELETE') res = await deleteSpace(env, syncId);
        else throw new HttpError(405, 'method_not_allowed', 'Use GET, PUT or DELETE.', { Allow: 'GET, PUT, DELETE, OPTIONS' });
        for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
        return res;
      }

      throw new HttpError(404, 'not_found', 'Not found.');
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.code, message: e.message }, e.status, { ...cors, ...e.headers });
      // Never put request data in the log
      console.error('server error:', e instanceof Error ? e.message : 'unknown');
      return json({ error: 'server_error', message: 'Something went wrong on our side.' }, 500, cors);
    }
  };
}

export default {
  fetch: (req: Request, env: Env): Promise<Response> => createHandler()(req, env),
};
