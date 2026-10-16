/**
 * Which build this is. "free" is the calculator for paidinyellow.com (lead magnet), "full" is the
 * paid app. Both run the same code. Without a valid unlock code either one is in calculator mode:
 * setup, the debt-free date and the first step. See state/store.ts (licenseState).
 */
export type Edition = 'free' | 'full';

export const EDITION: Edition = import.meta.env.VITE_EDITION === 'free' ? 'free' : 'full';
export const IS_FREE = EDITION === 'free';
