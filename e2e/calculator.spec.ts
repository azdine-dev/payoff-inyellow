/**
 * Calculator mode: without a valid unlock code you get setup, the debt-free date and the first
 * step. The tracker, plan, what-if and export wait behind the code.
 */
import { expect, test } from '@playwright/test';
import { FIXED, quickSetup, shot, unlockOnResult } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
});

test('without a code: the date and first step, nothing more, and a way to unlock', async ({ page }) => {
  await quickSetup(page, { unlock: false });
  await expect(page.getByTestId('debt-free-date')).toHaveText('July 2027');
  await expect(page.getByTestId('first-step')).toContainText('This payday (Fri 23 Oct): pay $150 to Store card');
  await shot(page, '17-calculator');

  // What the full planner adds, and how to get it
  await expect(page.getByTestId('unlock-card')).toContainText('Tick off every payday');
  await expect(page.getByRole('link', { name: 'Get the full planner' })).toHaveAttribute('href', 'https://paidinyellow.com/collections/all');

  // No tracker, no tabs
  await expect(page.getByRole('button', { name: /^I did it/ })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start my plan' })).toHaveCount(0);

  // Still there after a reload, still calculator mode
  await page.reload();
  await expect(page.getByTestId('debt-free-date')).toHaveText('July 2027');
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
});

test('"Change my numbers" starts from the current answers and recalculates', async ({ page }) => {
  await quickSetup(page, { unlock: false });
  await page.getByRole('button', { name: 'Change my numbers' }).click();

  // Debts step shows what was entered; the welcome screen is skipped
  await expect(page.getByRole('heading', { name: 'Your currency' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click(); // currency
  await page.getByRole('button', { name: 'Continue' }).click(); // schedule
  await expect(page.locator('fieldset').nth(0).getByLabel('Name')).toHaveValue('Visa');
  await page.getByRole('button', { name: 'Continue' }).click(); // debts
  await page.getByRole('button', { name: 'Continue' }).click(); // buffer
  await page.getByLabel('Money for the plan each payday').fill('400');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Continue' }).click(); // order
  await page.getByRole('button', { name: 'See my plan' }).click();

  // Sooner than before: July 2027 with $150, earlier with $400
  const date = await page.getByTestId('debt-free-date').textContent();
  expect(date).not.toBe('July 2027');
  await expect(page.getByTestId('first-step')).toContainText('$400');
});

test('cancelling "Change my numbers" keeps the plan as it was', async ({ page }) => {
  await quickSetup(page, { unlock: false });
  await page.getByRole('button', { name: 'Change my numbers' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByTestId('debt-free-date')).toHaveText('July 2027');
});

test('a code from a different key, or a changed code, does not unlock', async ({ page }) => {
  await quickSetup(page, { unlock: false });
  await page.getByRole('button', { name: 'I have a code' }).click();
  await page.getByRole('textbox', { name: 'Your unlock code' }).fill('PIY1.eyJ2IjoxLCJpZCI6IkZSRUUiLCJpYXQiOiIyMDI2LTEwLTE1IiwicCI6InBsYW5uZXIifQ.' + 'A'.repeat(86));
  await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  await expect(page.getByText('This code doesn’t look right.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start my plan' })).toHaveCount(0);
});

test('a stored code that is not valid is treated as locked', async ({ page }) => {
  await quickSetup(page);
  // Someone edits the saved data by hand and puts in a made-up code
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('paidinyellow');
        open.onsuccess = () => {
          const tx = open.result.transaction('settings', 'readwrite');
          const store = tx.objectStore('settings');
          const get = store.get('settings');
          get.onsuccess = () => {
            store.put({ ...get.result, license: { code: 'PIY1.fake.fake', activatedAt: 1 } });
            tx.oncomplete = () => resolve();
          };
        };
        open.onerror = () => reject(open.error);
      }),
  );
  await page.reload();
  await expect(page.getByTestId('unlock-card')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
});

test('unlocking from the result screen opens the full planner', async ({ page }) => {
  await quickSetup(page, { unlock: false });
  await unlockOnResult(page);
  await page.getByRole('button', { name: 'Start my plan' }).click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^I did it/ })).toBeVisible();
});
