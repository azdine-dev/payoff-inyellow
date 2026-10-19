#!/usr/bin/env node
// Makes the key pair for unlock codes.
//   node scripts/make-keypair.js            prints a new pair, writes nothing
//   node scripts/make-keypair.js --write    saves the PRIVATE key to .keys/private.hex (git ignores it)
//   node scripts/make-keypair.js --write --force   replaces an existing pair (old codes stop working)
//
// Paste the PUBLIC key into src/lib/licenseKey.ts. Keep the PRIVATE key off the repo and out of the app.
// You can also keep it in a .env file as PIY_PRIVATE_KEY=... (also ignored by git).
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { ed } from './lib.js';

const priv = ed.utils.randomPrivateKey();
const privHex = ed.etc.bytesToHex(priv);
const pubHex = ed.etc.bytesToHex(await ed.getPublicKeyAsync(priv));

if (process.argv.includes('--write')) {
  if (existsSync('.keys/private.hex') && !process.argv.includes('--force')) {
    console.error('.keys/private.hex already exists. Use --force to replace it (codes made with the old key stop working).');
    process.exit(1);
  }
  mkdirSync('.keys', { recursive: true });
  writeFileSync('.keys/private.hex', privHex + '\n');
  console.log('PRIVATE key saved to .keys/private.hex (git ignores this folder). Back it up somewhere safe.');
} else {
  console.log('PRIVATE (keep secret):', privHex);
}
console.log('PUBLIC  (goes in src/lib/licenseKey.ts):', pubHex);
