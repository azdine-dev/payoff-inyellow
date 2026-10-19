/**
 * What the Worker needs from Cloudflare. D1 is described by the small part we use (D1Like), so the
 * same code runs on real D1, in the tests, and in the local dev server (node:sqlite).
 */
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<{ meta: { changes: number } }>;
  all<T = unknown>(): Promise<{ results: T[] }>;
}

export interface D1Like {
  prepare(sql: string): D1Statement;
  /** Runs the statements as one transaction. */
  batch(statements: D1Statement[]): Promise<{ meta: { changes: number } }[]>;
}

export interface Env {
  DB: D1Like;

  // ---- public settings (wrangler.toml [vars]) ----
  /** The app's public key (64 hex). Used to know a request carries a real unlock code. */
  PIY_PUBLIC_KEY: string;
  /** Comma separated, for CORS. Example: https://app.paidinyellow.com */
  ALLOWED_ORIGINS?: string;
  APP_URL?: string;
  MAIL_FROM?: string;
  MAIL_REPLY_TO?: string;
  /** JSON: [{"name":"Debt-Free Tracker Kit","url":"https://..."}] */
  KIT_LINKS?: string;
  SHOPIFY_SHOP_DOMAIN?: string;
  /** "true" = orders marked as test are processed too (for trying it out) */
  PROCESS_TEST_ORDERS?: string;
  /** "true" = emails are printed to the log, not sent (local development) */
  MAIL_DRY_RUN?: string;

  // ---- limits (strings, because wrangler vars are strings) ----
  MAX_RECORD_BYTES?: string;
  MAX_RECORDS_PER_PUT?: string;
  MAX_RECORDS_PER_SPACE?: string;
  MAX_BYTES_PER_SPACE?: string;
  MAX_SPACES_PER_CODE?: string;
  RATE_PER_SPACE_PER_MIN?: string;
  RATE_PER_IP_PER_MIN?: string;

  // ---- secrets (wrangler secret put) ----
  /** 32-byte Ed25519 seed (64 hex) that signs unlock codes. */
  PIY_PRIVATE_KEY?: string;
  SHOPIFY_WEBHOOK_SECRET?: string;
  RESEND_API_KEY?: string;
}

export interface Deps {
  fetch: typeof fetch;
  now: () => number;
}

export const realDeps: Deps = { fetch: (...args) => fetch(...args), now: () => Date.now() };

export function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return value !== undefined && value !== '' && Number.isFinite(n) ? n : fallback;
}

/** The limits, with their defaults. */
export function limits(env: Env) {
  return {
    maxRecordBytes: num(env.MAX_RECORD_BYTES, 64 * 1024),
    maxRecordsPerPut: num(env.MAX_RECORDS_PER_PUT, 200),
    maxRecordsPerSpace: num(env.MAX_RECORDS_PER_SPACE, 5000),
    maxBytesPerSpace: num(env.MAX_BYTES_PER_SPACE, 10 * 1024 * 1024),
    maxSpacesPerCode: num(env.MAX_SPACES_PER_CODE, 3),
    ratePerSpacePerMin: num(env.RATE_PER_SPACE_PER_MIN, 120),
    ratePerIpPerMin: num(env.RATE_PER_IP_PER_MIN, 300),
  };
}
