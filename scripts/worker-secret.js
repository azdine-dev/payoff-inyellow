#!/usr/bin/env node
// Prints the private key as the 64-character secret the Worker needs. Pipe it straight into Cloudflare,
// so it never lands in a file or in your terminal history:
//
//   node scripts/worker-secret.js | (cd worker && npx wrangler secret put PIY_PRIVATE_KEY)
//
// Refuses to print anything if the key doesn't match the public key in the app.
import { appPublicKey, loadPrivateKey, privateSeedHex, publicKeyHex } from './lib.js';

const found = loadPrivateKey();
const key = found?.key;
if (!key) {
  console.error('No private key found. Run: node scripts/make-keypair.js');
  process.exit(1);
}
if (publicKeyHex(key) !== appPublicKey()) {
  console.error('This private key does not match the public key in the app (src/lib/licenseKey.ts). Nothing printed.');
  process.exit(1);
}
process.stdout.write(privateSeedHex(key));
