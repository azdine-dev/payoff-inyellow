/**
 * Public key that unlock codes are checked against. This is the ONLY key in the app.
 * The private key lives in ~/.piy/private.pem on the owner's computer.
 * Made and written here by:  node scripts/make-keypair.js
 */
const APP_PUBLIC_KEY = '09c17cdad4e1e063fe45ef09986ed42fb43d97496ec7dd4158e31944dc33ba0a';

/** The automated tests set VITE_PUBLIC_KEY_HEX to their own test key, so they never need your private key. */
export const PUBLIC_KEY_HEX: string = (import.meta.env?.VITE_PUBLIC_KEY_HEX as string | undefined) || APP_PUBLIC_KEY;
