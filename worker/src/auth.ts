import { verifyToken } from '../../src/lib/licenseCore';
import type { Env } from './env';
import { HttpError } from './http';

export interface Caller {
  /** The id inside the unlock code (an order id like shopify-1042, or an email for test codes) */
  codeId: string;
}

/**
 * A sync request must carry a real unlock code (X-PIY-Code). The check is the same one the app does,
 * offline, with the public key. A refunded order is on the revoked list: that blocks SYNC only. The
 * code itself still unlocks the app on the phone, because it works with no server.
 * Deleting your own data is always allowed (`allowRevoked`), refund or not.
 */
export async function authorize(req: Request, env: Env, opts: { allowRevoked?: boolean } = {}): Promise<Caller> {
  const code = req.headers.get('X-PIY-Code') ?? '';
  const result = verifyToken(code, env.PIY_PUBLIC_KEY);
  if (!result.ok) throw new HttpError(401, 'code_invalid', 'Sync needs a valid unlock code.');
  const revoked = opts.allowRevoked ? null : await env.DB.prepare('SELECT 1 AS x FROM revoked WHERE code_id = ?').bind(result.payload.id).first();
  if (revoked) throw new HttpError(403, 'code_revoked', 'Sync is turned off for this code.');
  return { codeId: result.payload.id };
}
