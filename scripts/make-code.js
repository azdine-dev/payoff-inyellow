#!/usr/bin/env node
// Makes one unlock code, signed with your PRIVATE key (~/.piy/private.pem).
//
//   node scripts/make-code.js test@paidinyellow.com
//   node scripts/make-code.js shopify-1042
//
// The code is   base64url(text) "." base64url(signature)   with text = PIY1|pack1|<id>|<date>.
// It goes to stdout (copy it or pipe it). Notes go to stderr.
import { sign } from 'node:crypto';
import { appPublicKey, b64url, loadPrivateKey, publicKeyHex } from './lib.js';

const id = process.argv[2]?.trim();
if (!id) {
  console.error('Usage: node scripts/make-code.js <buyer email or order id>');
  console.error('Example: node scripts/make-code.js test@paidinyellow.com');
  process.exit(1);
}
if (id.length > 200 || /[|\u0000-\u001f]/.test(id)) {
  console.error('The id can not contain "|" or control characters, and must be at most 200 characters.');
  process.exit(1);
}

const found = loadPrivateKey();
if (!found) {
  console.error('No private key found. Make the pair first:  node scripts/make-keypair.js');
  process.exit(1);
}

const date = new Date().toISOString().slice(0, 10);
const text = Buffer.from(`PIY1|pack1|${id}|${date}`, 'utf8');
const signature = sign(null, text, found.key);
const code = `${b64url(text)}.${b64url(signature)}`;

console.log(code);
console.error(`\nFor:         ${id}`);
console.error(`Text:        ${text.toString('utf8')}`);
console.error(`Signed with: the private key in ${found.from}`);
console.error(
  publicKeyHex(found.key) === appPublicKey()
    ? 'Check:       OK, this matches the public key in src/lib/licenseKey.ts, so the app will accept it.'
    : 'Check:       WARNING, this key does NOT match the public key in src/lib/licenseKey.ts. The app will reject this code.',
);
