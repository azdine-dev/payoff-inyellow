/** Nothing added by the host stays on the page. */
import { expect, test } from '@playwright/test';

test('a badge or script that the host adds is taken off the page again', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('You pay every month, but the balance never goes down.')).toBeVisible();
  await page.evaluate(() => {
    const frame = document.createElement('iframe');
    frame.id = 'nl-badge-frame';
    frame.src = 'about:blank';
    document.body.appendChild(frame);
    const script = document.createElement('script');
    script.setAttribute('src', 'https://app.netlify.com/hud.js');
    script.setAttribute('data-test', 'netlify-script');
    document.head.appendChild(script);
  });
  await expect(page.locator('#nl-badge-frame')).toHaveCount(0);
  await expect(page.locator('script[src*="netlify"]')).toHaveCount(0);
});
