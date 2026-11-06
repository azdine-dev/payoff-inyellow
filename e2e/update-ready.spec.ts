/** "An update is ready" on the next app open, when a new version was found earlier and is still waiting. */
import { expect, test } from '@playwright/test';
import { nadiaSetup } from './nadia';

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
