#!/usr/bin/env node
// Checks a code the way the app does, using only the PUBLIC key (src/lib/licenseKey.ts).
//
//   node scripts/check-code.js "PIY1.eyJ2Ijox....xxxx"
//
// Exit code 0 = valid, 1 = not valid. No private key needed.
import { appPublicKey, ed, fromB64url } from './lib.js';

const raw = process.argv.slice(2).join(' ');
// Same tidy-up as the app: pasted spaces, line breaks and quotes are ignored
const code = raw.replace(/[\s"'“”‘’]/g, '');

function fail(reason) {
  console.log(`NOT VALID: ${reason}`);
  console.log('In the app: "This code doesn’t look right. Check that you copied all of it."');
  process.exit(1);
}

if (!code) fail('nothing to check (the app says: "Paste your unlock code first.")');

const parts = code.split('.');
if (parts.length !== 3 || parts[0] !== 'PIY1') fail('this is not a PaidInYellow code (it should look like PIY1.xxxx.xxxx)');

let payload;
let signature;
try {
  payload = JSON.parse(new TextDecoder().decode(fromB64url(parts[1])));
  signature = fromB64url(parts[2]);
} catch {
  fail('the code is damaged (it could not be read)');
}
if (signature.length !== 64 || payload?.v !== 1 || typeof payload.id !== 'string' || payload.p !== 'planner') {
  fail('the code is damaged (it is missing parts)');
}

let ok = false;
try {
  ok = await ed.verifyAsync(signature, new TextEncoder().encode(`${parts[0]}.${parts[1]}`), ed.etc.hexToBytes(appPublicKey()));
} catch {
  ok = false;
}
if (!ok) fail('the signature does not match. The code was changed, or it was signed with a different key');

console.log(`VALID: made for "${payload.id}" on ${payload.iat}. The app unlocks.`);
