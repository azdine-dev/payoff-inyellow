/** Links Azeddin still has to provide. Empty = the link is hidden. */
export const VIDEO_URL = '';
export const HARDSHIP_SCRIPT_URL = '';
export const SUPPORT_EMAIL = 'support@paidinyellow.com';
export const NFCC_URL = 'https://www.nfcc.org';

/** Where "Unlock the full planner" goes: the store page for the planner. */
export const STORE_URL = 'https://paidinyellow.com/collections/all';
/** Form endpoint for the free calculator's email box (Shopify, Klaviyo, Formspree...). Empty = box hidden. */
export const EMAIL_CAPTURE_URL: string = (import.meta.env.VITE_EMAIL_CAPTURE_URL as string | undefined) ?? '';

/** The sync server (Cloudflare Worker). Built in with VITE_SYNC_URL; the default is the production address. */
export const SYNC_URL: string = ((import.meta.env.VITE_SYNC_URL as string | undefined) || 'https://api.paidinyellow.com').replace(/\/+$/, '');
