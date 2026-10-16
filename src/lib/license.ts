/**
 * Unlock code: a signed token checked on the phone with a public key, so it works offline
 * with no server. Format:  PIY1.<payload>.<signature>  (payload and signature are base64url)
 * The signature covers the text "PIY1.<payload>".
 */
import * as ed from '@noble/ed25519';
import { PUBLIC_KEY_HEX } from './licenseKey';

export const TOKEN_PREFIX = 'PIY1';

export interface LicensePayload {
  v: 1;
  /** order or buyer reference, shown back to the buyer */
  id: string;
  /** issued, ISO date */
  iat: string;
  /** product */
  p: 'planner';
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64urlEncode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export const hexToBytes = (hex: string): Uint8Array => ed.etc.hexToBytes(hex);

/** Tidies what people paste: spaces, line breaks, quotes. */
export function cleanCode(text: string): string {
  return text.replace(/[\s"'“”‘’]/g, '');
}

export type LicenseCheck = { ok: true; payload: LicensePayload } | { ok: false; reason: 'empty' | 'format' | 'signature' };

export async function verifyCode(code: string, publicKeyHex: string = PUBLIC_KEY_HEX): Promise<LicenseCheck> {
  const clean = cleanCode(code);
  if (!clean) return { ok: false, reason: 'empty' };
  const parts = clean.split('.');
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return { ok: false, reason: 'format' };
  let sig: Uint8Array;
  let payload: LicensePayload;
  try {
    sig = b64urlDecode(parts[2]!);
    payload = JSON.parse(dec.decode(b64urlDecode(parts[1]!))) as LicensePayload;
  } catch {
    return { ok: false, reason: 'format' };
  }
  if (sig.length !== 64 || payload?.v !== 1 || typeof payload.id !== 'string' || payload.p !== 'planner') {
    return { ok: false, reason: 'format' };
  }
  let valid = false;
  try {
    valid = await ed.verifyAsync(sig, enc.encode(`${parts[0]}.${parts[1]}`), hexToBytes(publicKeyHex));
  } catch {
    valid = false;
  }
  return valid ? { ok: true, payload } : { ok: false, reason: 'signature' };
}

/** Used by tools/make-code.mjs and the tests. The private key never ships in the app. */
export async function makeCode(payload: LicensePayload, privateKeyHex: string): Promise<string> {
  const body = `${TOKEN_PREFIX}.${b64urlEncode(enc.encode(JSON.stringify(payload)))}`;
  const sig = await ed.signAsync(enc.encode(body), hexToBytes(privateKeyHex));
  return `${body}.${b64urlEncode(sig)}`;
}
