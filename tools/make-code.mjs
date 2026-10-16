// Makes one unlock code per order.
//   node tools/make-code.mjs ORDER-1234
// Reads the private key from .keys/private.hex, or from the PIY_PRIVATE_KEY environment variable.
import * as ed from '@noble/ed25519';
import { readFileSync, existsSync } from 'node:fs';

const id = process.argv[2];
if (!id) {
  console.error('Usage: node tools/make-code.mjs <order id>');
  process.exit(1);
}
const privHex = (process.env.PIY_PRIVATE_KEY ?? (existsSync('.keys/private.hex') ? readFileSync('.keys/private.hex', 'utf8') : '')).trim();
if (!privHex) {
  console.error('No private key. Run: node tools/make-keypair.mjs --write');
  process.exit(1);
}
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
const payload = { v: 1, id, iat: new Date().toISOString().slice(0, 10), p: 'planner' };
const body = `PIY1.${b64url(new TextEncoder().encode(JSON.stringify(payload)))}`;
const sig = await ed.signAsync(new TextEncoder().encode(body), ed.etc.hexToBytes(privHex));
console.log(`${body}.${b64url(sig)}`);
