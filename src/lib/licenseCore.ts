/**
 * Unlock codes: signing and checking, with no environment and no WebCrypto. The same file is used
 * by the app (offline, on the phone) and by the Worker (to know a sync request has a real code).
 *
 * A code is   base64url(text) "." base64url(signature)
 * where text is   PIY1|pack1|<id>|<date>     e.g.  PIY1|pack1|shopify-1042|2026-10-19
 * and signature is an Ed25519 signature of the text bytes.
 *
 * Pure JavaScript (noble), so it works over plain http, on old phones and inside a Worker.
 */
import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';

ed.etc.sha512Sync = (...messages) => sha512(ed.etc.concatBytes(...messages));

export const TOKEN_PREFIX = 'PIY1';
export const PRODUCT = 'pack1';

export interface LicensePayload {
  product: string;
  /** buyer email or order id, shown back to the buyer */
  id: string;
  /** ISO date the code was made */
  date: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64urlEncode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error('not base64url');
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Tidies what people paste: spaces, line breaks, quotes. */
export function cleanCode(text: string): string {
  return text.replace(/[\s"'“”‘’]/g, '');
}

export type LicenseCheck = { ok: true; payload: LicensePayload } | { ok: false; reason: 'empty' | 'format' | 'signature' };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The text that is signed, or null if the id can't be used (it must not contain the separator). */
export function codeText(payload: LicensePayload): string | null {
  const { product, id, date } = payload;
  if (!id || id.length > 200 || /[|\u0000-\u001f]/.test(id) || !DATE.test(date) || !/^[a-z0-9]+$/.test(product)) return null;
  return `${TOKEN_PREFIX}|${product}|${id}|${date}`;
}

/** Checks a code against a public key (64 hex characters). Never throws. */
export function verifyToken(code: string, publicKeyHex: string): LicenseCheck {
  const clean = cleanCode(code);
  if (!clean) return { ok: false, reason: 'empty' };
  const parts = clean.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'format' };

  let textBytes: Uint8Array;
  let signature: Uint8Array;
  let fields: string[];
  try {
    textBytes = b64urlDecode(parts[0]!);
    signature = b64urlDecode(parts[1]!);
    fields = dec.decode(textBytes).split('|');
  } catch {
    return { ok: false, reason: 'format' };
  }
  // Only the exact, canonical spelling counts. (The last letter of a base64 text has spare bits:
  // changing it can decode to the same bytes, and a code changed by one letter must be refused.)
  if (b64urlEncode(textBytes) !== parts[0] || b64urlEncode(signature) !== parts[1]) return { ok: false, reason: 'format' };
  const [prefix, product, id, date] = fields;
  if (fields.length !== 4 || prefix !== TOKEN_PREFIX || product !== PRODUCT || !id || !date || !DATE.test(date) || signature.length !== 64) {
    return { ok: false, reason: 'format' };
  }

  let valid = false;
  try {
    valid = ed.verify(signature, textBytes, ed.etc.hexToBytes(publicKeyHex));
  } catch {
    valid = false;
  }
  return valid ? { ok: true, payload: { product, id, date } } : { ok: false, reason: 'signature' };
}

/** Makes a code with a private key (64 hex characters). Used by the tests and the Worker. */
export function signToken(payload: LicensePayload, privateKeyHex: string): string {
  const text = codeText(payload);
  if (!text) throw new Error('This id can not be used in a code.');
  const bytes = enc.encode(text);
  const signature = ed.sign(bytes, ed.etc.hexToBytes(privateKeyHex));
  return `${b64urlEncode(bytes)}.${b64urlEncode(signature)}`;
}

export function publicKeyOf(privateKeyHex: string): string {
  return ed.etc.bytesToHex(ed.getPublicKey(ed.etc.hexToBytes(privateKeyHex)));
}
