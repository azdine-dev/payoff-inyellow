#!/usr/bin/env node
// Checks a code the way the app does, using only the PUBLIC key (src/lib/licenseKey.ts).
//
//   node scripts/check-code.js "<code>"
//
// Exit code 0 = valid, 1 = not valid. No private key needed.
import { verify } from 'node:crypto';
import { appPublicKey, fromB64url, publicKeyFromHex } from './lib.js';

const raw = process.argv.slice(2).join(' ');
// Same tidy-up as the app: pasted spaces, line breaks and quotes are ignored
const code = raw.replace(/[\s"'“”‘’]/g, '');
const REFUSED = 'In the app: "This code doesn’t look right. Check that you copied all of it."';

function fail(reason) {
  console.log(`NOT VALID: ${reason}`);
  console.log(REFUSED);
  process.exit(1);
}

if (!code) fail('nothing to check (the app says: "Paste your unlock code first.")');

const parts = code.split('.');
if (parts.length !== 2 || !parts.every((p) => /^[A-Za-z0-9_-]+$/.test(p))) fail('this is not a PaidInYellow code (it should be two parts separated by a dot)');

const textBytes = Buffer.from(fromB64url(parts[0]));
const signature = Buffer.from(fromB64url(parts[1]));
// Only the exact spelling counts (the last letter has spare bits that would otherwise decode the same)
if (textBytes.toString('base64url') !== parts[0] || signature.toString('base64url') !== parts[1]) fail('the code is not spelled exactly as it was made (a letter was changed)');
const [prefix, product, id, date, ...extra] = textBytes.toString('utf8').split('|');
if (prefix !== 'PIY1' || product !== 'pack1' || !id || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || extra.length || signature.length !== 64) {
  fail('the code is damaged or is not a PaidInYellow code (the text inside is not in the right format)');
}

let ok = false;
try {
  ok = verify(null, textBytes, publicKeyFromHex(appPublicKey()), signature);
} catch {
  ok = false;
}
if (!ok) fail('the signature does not match. The code was changed, or it was signed with a different key');

console.log(`VALID: made for "${id}" on ${date}. The app unlocks.`);
