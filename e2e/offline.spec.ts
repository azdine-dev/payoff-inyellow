/** The real production build, served like a website: it works with no signal after the first load. */
import { expect, test } from '@playwright/test';
import { FIXED, quickSetup } from './helpers';

test.use({ baseURL: 'http://localhost:4175' });

test('works offline after the first visit, and keeps what you saved', async ({ page, context }) => {
  await page.clock.setFixedTime(FIXED);
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // now the page is controlled by the service worker
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('You’re not bad at math.')).toBeVisible();

  // The whole setup works with no signal
  await quickSetup(page);
  await page.getByRole('button', { name: /^I did it/ }).click();
  await expect(page.getByText('Fri 23 Oct is paid.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Fri 6 Nov').first()).toBeVisible();

  const manifest = await page.evaluate(async () => (await fetch('/manifest.webmanifest')).json());
  expect(manifest).toMatchObject({ short_name: 'PaidInYellow', display: 'standalone' });
});
