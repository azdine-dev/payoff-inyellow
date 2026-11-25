/**
 * Buyers from Etsy open the app from their "Open me first" PDF with  ?from=etsy . The app remembers it on this device,
 * takes it out of the address bar, and keeps it after a reload, a home screen launch and "Erase everything".
 */
import { expect, test, type Page } from '@playwright/test';
import { FIXED, quickSetup } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
});

const saved = (page: Page) => page.evaluate(() => localStorage.getItem('piy.source'));

test('?from=etsy is saved and leaves the address bar, and a reload without it keeps it', async ({ page }) => {
  await page.goto('/?from=etsy');
  await expect(page.getByText('You’re not bad at math.')).toBeVisible();
  expect(await saved(page)).toBe('etsy');
  expect(new URL(page.url()).search).toBe('');

  // A reload, or a home screen launch, has no query string: the saved value counts
  await page.goto('/');
  expect(await saved(page)).toBe('etsy');
});

test('"Erase everything" keeps it, like the unlock code', async ({ page }) => {
  await page.goto('/?from=etsy');
  await quickSetup(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Erase everything and start over' }).click();
  await page.getByLabel('Also remove my unlock code from this device').check();
  await page.getByRole('button', { name: 'Yes, erase everything' }).click();
  await expect(page.getByText('You’re not bad at math.')).toBeVisible();
  expect(await saved(page)).toBe('etsy');
});

test('no query, or another value, keeps the app as it was', async ({ page }) => {
  await page.goto('/?from=newsletter');
  await expect(page.getByText('You’re not bad at math.')).toBeVisible();
  expect(await saved(page)).toBeNull();
  expect(new URL(page.url()).search).toBe('?from=newsletter'); // left alone
  await page.goto('/');
  expect(await saved(page)).toBeNull();
});
