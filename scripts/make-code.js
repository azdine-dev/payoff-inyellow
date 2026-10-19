#!/usr/bin/env node
// Makes one unlock code, signed with your PRIVATE key.
//
//   node scripts/make-code.js test@paidinyellow.com
//   npm run make-code -- test@paidinyellow.com
//
// The code goes to stdout (so you can copy or pipe it). Notes go to stderr.
// Needs the private key: PIY_PRIVATE_KEY, a .env file, or .keys/private.hex (see scripts/lib.js).
import { appPublicKey, b64url, ed, loadPrivateKey } from './lib.js';

const id = process.argv[2]?.trim();
if (!id) {
  console.error('Usage: node scripts/make-code.js <buyer email or order id>');
  console.error('Example: node scripts/make-code.js test@paidinyellow.com');
  process.exit(1);
}

const found = loadPrivateKey();
if (!found) {
  console.error('No private key found. Make a pair first:  npm run make-keypair');
  console.error('Or set PIY_PRIVATE_KEY in your environment or in a .env file (never commit it).');
  process.exit(1);
}

// The same token the app checks (src/lib/license.ts):  PIY1.<payload>.<signature>
const payload = { v: 1, id, iat: new Date().toISOString().slice(0, 10), p: 'planner' };
const body = `PIY1.${b64url(new TextEncoder().encode(JSON.stringify(payload)))}`;
const signature = await ed.signAsync(new TextEncoder().encode(body), ed.etc.hexToBytes(found.key));
const code = `${body}.${b64url(signature)}`;

// Warn if this code would not unlock the app as it is built now
const publicKey = ed.etc.bytesToHex(await ed.getPublicKeyAsync(ed.etc.hexToBytes(found.key)));
const matches = publicKey === appPublicKey();

console.log(code);
console.error(`\nFor:         ${id}`);
console.error(`Signed with: the private key from ${found.from}`);
console.error(
  matches
    ? 'Check:       OK, this matches the public key in src/lib/licenseKey.ts, so the app will accept it.'
    : 'Check:       WARNING, this private key does NOT match the public key in src/lib/licenseKey.ts. The app will reject this code.',
);
