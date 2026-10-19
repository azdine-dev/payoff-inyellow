#!/usr/bin/env node
// Makes the Ed25519 key pair for unlock codes. Run it ONCE.
//
//   node scripts/make-keypair.js            makes the pair if there is none, and puts the PUBLIC key in the app
//   node scripts/make-keypair.js --force    replaces the pair (every code made with the old key stops working)
//
// PRIVATE key: ~/.piy/private.pem (outside the project, never committed, never in a build).
// PUBLIC key:  src/lib/licenseKey.ts (this is the only key the app contains).
import { generateKeyPairSync } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { KEY_LINE, LICENSE_KEY_FILE, PIY_DIR, PRIVATE_PEM, loadPrivateKey, publicKeyHex } from './lib.js';

const force = process.argv.includes('--force');

let pubHex;
if (existsSync(PRIVATE_PEM) && !force) {
  pubHex = publicKeyHex(loadPrivateKey().key);
  console.log(`A key pair already exists: ${PRIVATE_PEM}`);
  console.log('Nothing was changed. (Use --force to replace it. Codes made with the old key would stop working.)');
} else {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  mkdirSync(PIY_DIR, { recursive: true });
  writeFileSync(PRIVATE_PEM, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  try {
    chmodSync(PRIVATE_PEM, 0o600);
  } catch {
    /* Windows: the file stays inside your own user folder */
  }
  pubHex = publicKeyHex(publicKey);
  console.log(`PRIVATE key saved to ${PRIVATE_PEM}`);
  console.log('Back it up somewhere safe (a password manager). Without it you can not make codes.');
}

// Put the public key in the app
const source = readFileSync(LICENSE_KEY_FILE, 'utf8');
const m = KEY_LINE.exec(source);
if (!m) {
  console.error(`Could not find "const APP_PUBLIC_KEY = '...'" in ${LICENSE_KEY_FILE}. Paste this public key there by hand:`);
  console.log(pubHex);
  process.exit(1);
}
if (m[2] === pubHex) {
  console.log(`PUBLIC key already in ${LICENSE_KEY_FILE}: ${pubHex}`);
} else {
  writeFileSync(LICENSE_KEY_FILE, source.replace(KEY_LINE, `$1${pubHex}$3`));
  console.log(`PUBLIC key written to ${LICENSE_KEY_FILE}: ${pubHex}`);
  console.log('Commit that file. Rebuild the app so it checks codes against the new key.');
}
