/** After the first "I did it": one calm card asks for a home screen icon and a backup. */
import { expect, test } from '@playwright/test';
import { nadiaSetup } from './nadia';
import { expectBrandRules, tapDidIt } from './scenario';

const SENTENCE = 'Add PaidInYellow to your home screen and save a backup, so your plan stays safe.';

test('no card before the first I did it, then one calm card with the sentence and two taps', async ({ page }) => {
  await nadiaSetup(page);
  await expect(page.getByTestId('safe-card')).toHaveCount(0);
  await tapDidIt(page);
  await expect(page.getByTestId('paid-card')).toBeVisible();
  const card = page.getByTestId('safe-card');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText(SENTENCE);
  await expect(card.getByRole('button', { name: 'Add to home screen' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Save a backup' })).toBeVisible();
  // two outline buttons: the paid screen keeps one filled button at most
  for (const name of ['Add to home screen', 'Save a backup']) {
    const b = card.getByRole('button', { name });
    await expect(b).toHaveClass(/ghost/);
    expect(await b.evaluate((el) => getComputedStyle(el).backgroundColor)).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await expectBrandRules(page);
  expect(await card.innerText()).not.toContain('!');
});

test('Save a backup downloads the file, and then only the home screen ask is left', async ({ page }) => {
  await nadiaSetup(page);
  await tapDidIt(page);
  const card = page.getByTestId('safe-card');
  const [download] = await Promise.all([page.waitForEvent('download'), card.getByRole('button', { name: 'Save a backup' }).click()]);
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  await expect(card.getByRole('button', { name: 'Save a backup' })).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Add to home screen' })).toBeVisible();
});

test('Add to home screen opens the how-to, and Not now hides the card for good', async ({ page }) => {
  await nadiaSetup(page);
  await tapDidIt(page);
  await page.getByTestId('safe-card').getByRole('button', { name: 'Add to home screen' }).click();
  await expect(page.getByRole('dialog', { name: 'Put it on your phone' })).toContainText('iPhone');
  await page.getByRole('dialog').getByRole('button').first().waitFor(); // the sheet is ready for the keyboard
  await expect(async () => {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 1000 });
  }).toPass();
  await page.getByRole('button', { name: 'Back to Today' }).click();
  await page.getByTestId('safe-card').getByRole('button', { name: 'Not now' }).click();
  await expect(page.getByTestId('safe-card')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('paid-card')).toBeVisible();
  await expect(page.getByTestId('safe-card')).toHaveCount(0);
});
