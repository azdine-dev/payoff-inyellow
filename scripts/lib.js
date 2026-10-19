// Shared by the unlock-code scripts. Run these from the project folder.
//
// The PRIVATE key signs codes. It lives on your computer only: in the PIY_PRIVATE_KEY environment
// variable, in a .env file, or in .keys/private.hex. All three are ignored by git, and none of them
// is ever read by the app or its build (the app only gets the PUBLIC key, in src/lib/licenseKey.ts).
import { existsSync, readFileSync } from 'node:fs';
import * as ed from '@noble/ed25519';

export const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
export const fromB64url = (text) => new Uint8Array(Buffer.from(text, 'base64url'));
const HEX64 = /^[0-9a-fA-F]{64}$/;

/** Finds the private key. Returns { key, from } or null. */
export function loadPrivateKey() {
  const fromEnv = process.env.PIY_PRIVATE_KEY?.trim();
  if (fromEnv) return validate(fromEnv, 'the PIY_PRIVATE_KEY environment variable');

  if (existsSync('.env')) {
    const m = /^\s*PIY_PRIVATE_KEY\s*=\s*["']?([^"'\s#]+)["']?/m.exec(readFileSync('.env', 'utf8'));
    if (m) return validate(m[1], '.env');
  }
  if (existsSync('.keys/private.hex')) return validate(readFileSync('.keys/private.hex', 'utf8').trim(), '.keys/private.hex');
  return null;
}

function validate(key, from) {
  if (!HEX64.test(key)) {
    console.error(`The private key in ${from} is not 64 hex characters. Make a new pair: npm run make-keypair`);
    process.exit(1);
  }
  return { key: key.toLowerCase(), from };
}

/** The public key the app checks codes against, read from src/lib/licenseKey.ts. */
export function appPublicKey() {
  const text = readFileSync('src/lib/licenseKey.ts', 'utf8');
  const m = /'([0-9a-f]{64})'/.exec(text);
  if (!m) {
    console.error('Could not find the public key in src/lib/licenseKey.ts');
    process.exit(1);
  }
  return m[1];
}

export { ed };
