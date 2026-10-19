/**
 * Local dev server for the Worker (no Cloudflare account needed):   npm run worker:dev
 * Runs the real Worker code on a node:sqlite database.
 *
 * Settings come from the environment, or from worker/.dev.vars (KEY=VALUE per line, git-ignored).
 * Defaults are made for trying things out on this computer. Emails are printed, not sent.
 */
import { existsSync, readFileSync } from 'node:fs';
import { createPrivateKey } from 'node:crypto';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createHandler } from '../src/index';
import type { Env } from '../src/env';
import { createD1 } from './d1-sqlite';

const root = join(__dirname, '..', '..');

function readDevVars(): Record<string, string> {
  const file = join(root, 'worker', '.dev.vars');
  if (!existsSync(file)) return {};
  const vars: Record<string, string> = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#')) vars[m[1]!] = m[2]!.replace(/^["']|["']$/g, '');
  }
  return vars;
}

function appPublicKey(): string {
  const m = /APP_PUBLIC_KEY = '([0-9a-f]{64})'/.exec(readFileSync(join(root, 'src', 'lib', 'licenseKey.ts'), 'utf8'));
  return m![1]!;
}

/** The signing key from ~/.piy (the same one make-code.js uses), as the 64 hex seed the Worker takes. Local only. */
function localPrivateSeed(): string | undefined {
  const file = join(homedir(), '.piy', 'private.pem');
  if (!existsSync(file)) return undefined;
  const jwk = createPrivateKey(readFileSync(file)).export({ format: 'jwk' }) as { d?: string };
  return jwk.d ? Buffer.from(jwk.d, 'base64url').toString('hex') : undefined;
}

const vars = { ...readDevVars(), ...(process.env as Record<string, string>) };
const port = Number(vars.PORT ?? 8787);

const env: Env = {
  DB: createD1(vars.WORKER_DB ?? ':memory:'),
  PIY_PUBLIC_KEY: vars.PIY_PUBLIC_KEY ?? appPublicKey(),
  PIY_PRIVATE_KEY: vars.PIY_PRIVATE_KEY ?? localPrivateSeed(),
  SHOPIFY_WEBHOOK_SECRET: vars.SHOPIFY_WEBHOOK_SECRET ?? 'dev-secret',
  RESEND_API_KEY: vars.RESEND_API_KEY,
  SHOPIFY_SHOP_DOMAIN: vars.SHOPIFY_SHOP_DOMAIN,
  ALLOWED_ORIGINS: vars.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://localhost:5174,http://localhost:5177,http://localhost:5178',
  APP_URL: vars.APP_URL ?? 'http://localhost:5173',
  MAIL_FROM: vars.MAIL_FROM ?? 'PaidInYellow <hello@example.test>',
  MAIL_REPLY_TO: vars.MAIL_REPLY_TO,
  KIT_LINKS: vars.KIT_LINKS,
  PROCESS_TEST_ORDERS: vars.PROCESS_TEST_ORDERS ?? 'true',
  MAIL_DRY_RUN: vars.MAIL_DRY_RUN ?? 'true',
  MAX_RECORD_BYTES: vars.MAX_RECORD_BYTES,
  MAX_RECORDS_PER_PUT: vars.MAX_RECORDS_PER_PUT,
  MAX_RECORDS_PER_SPACE: vars.MAX_RECORDS_PER_SPACE,
  MAX_BYTES_PER_SPACE: vars.MAX_BYTES_PER_SPACE,
  MAX_SPACES_PER_CODE: vars.MAX_SPACES_PER_CODE,
  RATE_PER_SPACE_PER_MIN: vars.RATE_PER_SPACE_PER_MIN,
  RATE_PER_IP_PER_MIN: vars.RATE_PER_IP_PER_MIN ?? '100000', // no limit while trying things out
};

const handle = createHandler();

createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(',') : v);
  const request = new Request(`http://localhost:${port}${req.url}`, {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
  });
  const response = await handle(request, env);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, () => console.log(`PaidInYellow Worker (local) on http://localhost:${port}  [mail: ${env.MAIL_DRY_RUN === 'true' ? 'printed' : 'sent'}]`));
