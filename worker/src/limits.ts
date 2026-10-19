import type { D1Like } from './env';
import { HttpError } from './http';

/**
 * Fixed-window rate limit kept in D1. Throws a 429 with Retry-After when `key` has made more than
 * `max` requests in the current window.
 */
export async function rateLimit(db: D1Like, key: string, max: number, now: number, windowSeconds = 60): Promise<void> {
  const window = Math.floor(now / 1000 / windowSeconds);
  const row = await db
    .prepare('INSERT INTO rate_limits (k, window, n) VALUES (?, ?, 1) ON CONFLICT (k, window) DO UPDATE SET n = n + 1 RETURNING n')
    .bind(key, window)
    .first<{ n: number }>();
  if ((row?.n ?? 1) > max) {
    const retry = Math.max(1, (window + 1) * windowSeconds - Math.floor(now / 1000));
    throw new HttpError(429, 'rate_limited', 'Too many requests. Try again in a moment.', { 'Retry-After': String(retry) });
  }
  // Tidy old windows now and then (about 1 request in 50)
  if (Math.random() < 0.02) await db.prepare('DELETE FROM rate_limits WHERE window < ?').bind(window - 5).run();
}
