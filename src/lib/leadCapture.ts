/**
 * Email capture for the free calculator. Only the email address leaves the device. Never any
 * debt, balance or plan numbers.
 */
import { EMAIL_CAPTURE_URL } from './config';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isEmail(text: string): boolean {
  return EMAIL.test(text.trim());
}

export type CaptureResult = 'ok' | 'invalid' | 'failed';

export async function submitEmail(email: string, url: string = EMAIL_CAPTURE_URL, fetcher: typeof fetch = fetch): Promise<CaptureResult> {
  const clean = email.trim();
  if (!isEmail(clean)) return 'invalid';
  if (!url) return 'failed';
  try {
    const res = await fetcher(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email: clean, source: 'free-calculator' }),
    });
    return res.ok ? 'ok' : 'failed';
  } catch {
    return 'failed';
  }
}
