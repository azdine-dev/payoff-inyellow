/**
 * Everything is locked on the phone before it is sent. AES-GCM, 256 bit. The key is made on the
 * first phone and travels to the next one only inside the link or QR code (in the # part, which
 * a browser never sends to a server). The server never has it.
 *
 * Each record is locked with its own random iv, and its record id is bound to the lock (as
 * "additional data"), so a locked record can't be copied onto another record id.
 */
import { b64urlDecode as decodeBytes, b64urlEncode } from '../lib/licenseCore';

/** Fresh ArrayBuffer-backed bytes, which is what WebCrypto's types ask for. */
const b64urlDecode = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(decodeBytes(s));

const enc = new TextEncoder();
const dec = new TextDecoder();

function subtle(): SubtleCrypto {
  if (!globalThis.crypto?.subtle) throw new Error('Sync needs a secure page (https).');
  return globalThis.crypto.subtle;
}

/** `bytes` random bytes as base64url. 16 bytes make a sync id, 32 bytes make a key. */
export function randomToken(bytes: number): string {
  return b64urlEncode(globalThis.crypto.getRandomValues(new Uint8Array(bytes)));
}

export const newSyncId = () => randomToken(16); // 22 characters
export const newKey = () => randomToken(32); // 43 characters

export function importKey(raw: string): Promise<CryptoKey> {
  const bytes = b64urlDecode(raw);
  if (bytes.length !== 32) throw new Error('The sync key is not valid.');
  return subtle().importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptJson(key: CryptoKey, rid: string, value: unknown): Promise<{ iv: string; ct: string }> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(rid) }, key, enc.encode(JSON.stringify(value)));
  return { iv: b64urlEncode(iv), ct: b64urlEncode(new Uint8Array(ct)) };
}

/** Throws if the key is wrong, the data was changed, or it belongs to another record id. */
export async function decryptJson(key: CryptoKey, rid: string, iv: string, ct: string): Promise<unknown> {
  const plain = await subtle().decrypt({ name: 'AES-GCM', iv: b64urlDecode(iv), additionalData: enc.encode(rid) }, key, b64urlDecode(ct));
  return JSON.parse(dec.decode(plain));
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await subtle().digest('SHA-256', enc.encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
