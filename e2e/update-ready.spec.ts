/** "An update is ready" on the next app open, when a new version was found earlier and is still waiting. */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { nadiaSetup } from './nadia';
import { goTab, tapDidIt } from './scenario';

test('a waiting update is shown on the next open, and Not now hides it for that open only', async ({ page }) => {
  await nadiaSetup(page);
  await expect(page.getByTestId('update-bar')).toHaveCount(0);
  // what the app writes down when it finds a new version while it runs (dev builds are labelled "dev")
  await page.evaluate(() => localStorage.setItem('piy.updatePending', 'dev'));
  await page.reload();
  const bar = page.getByTestId('update-bar');
  await expect(bar).toContainText('An update is ready.');
  await expect(bar.getByRole('button', { name: 'Restart now' })).toBeVisible();
  await bar.getByRole('button', { name: 'Dismiss the update bar' }).click();
  await expect(bar).toHaveCount(0);
  await page.reload(); // next open: still waiting, so it says so again
  await expect(page.getByTestId('update-bar')).toContainText('An update is ready.');
});

test('when the new version already runs, the old note is cleared and nothing is shown', async ({ page }) => {
  await nadiaSetup(page);
  await page.evaluate(() => localStorage.setItem('piy.updatePending', 'an-older-build'));
  await page.reload();
  await expect(page.getByTestId('debt-free-pill')).toBeVisible();
  await expect(page.getByTestId('update-bar')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('piy.updatePending'))).toBeNull();
});

test('an update never erases saved data: with the old files and caches thrown away, the plan is still there', async ({ page }) => {
  await nadiaSetup(page);
  await tapDidIt(page);
  await expect(page.getByTestId('paid-card')).toBeVisible();
  await goTab(page, 'Debts');
  await page.waitForTimeout(500); // the short number roll is over
  const balance = (await page.getByRole('region', { name: 'Store Card' }).locator('.debt-left').first().textContent())!;
  // what an update replaces: the service worker and the cached app files (never the database)
  await page.evaluate(async () => {
    for (const reg of await navigator.serviceWorker.getRegistrations()) await reg.unregister();
    for (const key of await caches.keys()) await caches.delete(key);
  });
  await page.reload();
  await goTab(page, 'Today');
  await expect(page.getByTestId('paid-card')).toBeVisible(); // the payday is still done
  await goTab(page, 'Debts');
  await page.waitForTimeout(500);
  await expect(page.getByRole('region', { name: 'Store Card' }).locator('.debt-left').first()).toHaveText(balance);
  await goTab(page, 'Path');
  await expect(page.getByTestId('whole-plan-card')).toBeVisible();
});

test('Settings says which version this phone runs: Version 0.1.0 and the day it was built', async ({ page }) => {
  await nadiaSetup(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  const text = (await page.getByTestId('app-version').innerText()).trim();
  expect(text).toMatch(/^Version [0-9]+\.[0-9]+\.[0-9]+ · [0-9]{1,2} [A-Z][a-z]{2}( [0-9]{4})?$/);
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
  expect(text.startsWith(`Version ${pkg.version} · `)).toBe(true);
});
