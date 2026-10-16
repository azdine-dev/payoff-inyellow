/**
 * Public key that unlock codes are checked against.
 * This one is a DEVELOPMENT key. Before selling, make your own:
 *   node tools/make-keypair.mjs --write --force
 * and paste the public key here. Codes made with the old key stop working.
 */
const DEVELOPMENT_KEY = '71313c6e0a551e95c984bd66d64b906c6ce20afe2bcd83b67cc2af846cbb1125';

/** The automated tests set VITE_PUBLIC_KEY_HEX to their own test key, so they never need your private key. */
export const PUBLIC_KEY_HEX: string = (import.meta.env?.VITE_PUBLIC_KEY_HEX as string | undefined) || DEVELOPMENT_KEY;
