/** Links Azeddin still has to provide. Empty = the link is hidden. */
export const VIDEO_URL = '';
export const HARDSHIP_SCRIPT_URL = '';
export const SUPPORT_EMAIL = 'support@paidinyellow.com';
export const NFCC_URL = 'https://www.nfcc.org';

/**
 * Where "Get the full planner" goes: the product page, so it lands on the buy box. Change it here if the product handle
 * changes. Never shown to buyers who came from Etsy (see lib/source.ts).
 */
export const STORE_URL = 'https://paidinyellow.com/products/paycheck-payoff-system-pack-1';
/** Form endpoint for the free calculator's email box (Shopify, Klaviyo, Formspree...). Empty = box hidden. */
export const EMAIL_CAPTURE_URL: string = (import.meta.env.VITE_EMAIL_CAPTURE_URL as string | undefined) ?? '';

/** The sync server (Cloudflare Worker). Built in with VITE_SYNC_URL; the default is the production address. */
export const SYNC_URL: string = ((import.meta.env.VITE_SYNC_URL as string | undefined) || 'https://api.paidinyellow.com').replace(/\/+$/, '');
