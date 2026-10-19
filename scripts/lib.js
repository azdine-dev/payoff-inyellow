// Shared by the unlock-code scripts. Plain Node, no packages: Ed25519 comes from node:crypto.
//
// The PRIVATE key signs codes. It lives in your home folder, OUTSIDE the project:
//     ~/.piy/private.pem        (on Windows: C:\Users\<you>\.piy\private.pem)
// The app only ever gets the PUBLIC key (src/lib/licenseKey.ts).
import { createPrivateKey, createPublicKey } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const PIY_DIR = join(homedir(), '.piy');
export const PRIVATE_PEM = join(PIY_DIR, 'private.pem');
export const LICENSE_KEY_FILE = 'src/lib/licenseKey.ts';

export const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
export const fromB64url = (text) => new Uint8Array(Buffer.from(text, 'base64url'));

/**
 * Finds the private key. In order: the file named by PIY_PRIVATE_KEY_FILE, a PEM in PIY_PRIVATE_KEY_PEM
 * (for CI), then ~/.piy/private.pem. Returns { key, from } or null.
 */
export function loadPrivateKey() {
  const file = process.env.PIY_PRIVATE_KEY_FILE?.trim();
  if (file) return fromFile(file, `the file named in PIY_PRIVATE_KEY_FILE (${file})`);
  const pem = process.env.PIY_PRIVATE_KEY_PEM;
  if (pem?.includes('BEGIN PRIVATE KEY')) return parse(pem.replace(/\\n/g, '\n'), 'the PIY_PRIVATE_KEY_PEM environment variable');
  if (existsSync(PRIVATE_PEM)) return fromFile(PRIVATE_PEM, PRIVATE_PEM);
  return null;
}

function fromFile(path, label) {
  if (!existsSync(path)) {
    console.error(`No private key at ${path}`);
    process.exit(1);
  }
  return parse(readFileSync(path, 'utf8'), label);
}

function parse(pem, from) {
  try {
    const key = createPrivateKey(pem);
    if (key.asymmetricKeyType !== 'ed25519') throw new Error('not an Ed25519 key');
    return { key, from };
  } catch (e) {
    console.error(`The private key in ${from} can not be read (${e.message}). Make a new pair: node scripts/make-keypair.js`);
    process.exit(1);
  }
}

/** The 32 raw bytes of a public key, as 64 hex characters. */
export function publicKeyHex(privateOrPublicKey) {
  const publicKey = privateOrPublicKey.type === 'private' ? createPublicKey(privateOrPublicKey) : privateOrPublicKey;
  const der = publicKey.export({ type: 'spki', format: 'der' });
  return Buffer.from(der.subarray(der.length - 32)).toString('hex');
}

/** A public key object from 64 hex characters. */
export function publicKeyFromHex(hex) {
  const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(hex, 'hex')]);
  return createPublicKey({ key: spki, format: 'der', type: 'spki' });
}

/** The 32-byte seed of a private key, as 64 hex characters (what the Worker keeps as a secret). */
export function privateSeedHex(privateKey) {
  const der = privateKey.export({ type: 'pkcs8', format: 'der' });
  return Buffer.from(der.subarray(der.length - 32)).toString('hex');
}

const KEY_LINE = /(const APP_PUBLIC_KEY = ')([0-9a-f]{64})(')/;

/** The public key the app checks codes against, read from src/lib/licenseKey.ts. */
export function appPublicKey() {
  const m = KEY_LINE.exec(readFileSync(LICENSE_KEY_FILE, 'utf8'));
  if (!m) {
    console.error(`Could not find the public key in ${LICENSE_KEY_FILE}`);
    process.exit(1);
  }
  return m[2];
}

export { KEY_LINE };
