/**
 * Unlock code for the app: checked on the phone with the public key in licenseKey.ts, with no
 * server and no internet. The signing and checking code is in licenseCore.ts.
 */
import { PUBLIC_KEY_HEX } from './licenseKey';
import { signToken, verifyToken, type LicenseCheck, type LicensePayload } from './licenseCore';

export { cleanCode, TOKEN_PREFIX, PRODUCT, type LicenseCheck, type LicensePayload } from './licenseCore';

/** Checks a code against the app's public key. */
export async function verifyCode(code: string, publicKeyHex: string = PUBLIC_KEY_HEX): Promise<LicenseCheck> {
  return verifyToken(code, publicKeyHex);
}

/** Makes a code. For tests only: the real private key never goes near the app. */
export function makeCode(payload: LicensePayload, privateKeyHex: string): string {
  return signToken(payload, privateKeyHex);
}
