/** public/_headers keeps scripts and frames from the host out of production. The test sends the same header from the dev server. */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const headers = readFileSync('public/_headers', 'utf8');
const csp = headers.match(/Content-Security-Policy:\s*(.+)/)![1]!.trim();

test('the header allows only this app, and the app still works with it', async ({ page }) => {
  expect(csp).toContain("script-src 'self'");
  expect(csp).not.toContain('unsafe-eval');
  expect(csp).toContain("frame-src 'none'");
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const res = await route.fetch();
    await route.fulfill({ response: res, headers: { ...res.headers(), 'content-security-policy': csp } });
  });
  await page.addInitScript(() => {
    (window as unknown as { __blocked: string[] }).__blocked = [];
    document.addEventListener('securitypolicyviolation', (e) => (window as unknown as { __blocked: string[] }).__blocked.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await page.goto('/');
  await expect(page.getByText('You pay every month, but the balance never goes down.')).toBeVisible();
  await page.getByRole('radio', { name: 'Every 2 weeks' }).click(); // the app runs normally
  // a script or a frame from another site is refused
  await page.evaluate(() => {
    const s = document.createElement('script');
    s.src = 'https://app.netlify.com/hud.js';
    document.head.appendChild(s);
    const f = document.createElement('iframe');
    f.src = 'https://app.netlify.com/badge';
    document.body.appendChild(f);
  });
  await expect.poll(() => page.evaluate(() => (window as unknown as { __blocked: string[] }).__blocked.join('|'))).toMatch(/script-src.*netlify[\s\S]*frame-src.*netlify|frame-src.*netlify[\s\S]*script-src.*netlify/);
});
