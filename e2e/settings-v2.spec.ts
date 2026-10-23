/** ux-v2.md section 8: Settings in four groups of rows that open sheets. */
import { expect, test } from '@playwright/test';
import { FIXED, quickSetup } from './helpers';
import { expectBrandRules } from './scenario';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
});

test('four groups: Your plan, Keep it safe, Look, Help', async ({ page }) => {
  await quickSetup(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  for (const name of ['Your plan', 'Keep it safe', 'Look', 'Help']) await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  const plan = page.getByRole('region', { name: 'Your plan' });
  for (const label of ['Pay schedule', 'Money for the plan each payday', 'Buffer goal', 'Usual paycheck', 'Payoff order', 'Currency', 'Payday reminder']) {
    await expect(plan.getByRole('button', { name: new RegExp(`^(Change|Open) ${label}`) })).toBeVisible();
  }
  await expectBrandRules(page);
});

test('payoff order changes from Settings, and the backup line counts days', async ({ page }) => {
  await quickSetup(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Change Payoff order' }).click();
  await page.getByRole('radio', { name: /Biggest interest first/ }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Your plan' })).toContainText('Biggest interest first');

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Back up my plan' }).click()]);
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  await expect(page.getByTestId('last-backup')).toHaveText('Last saved today.');
  await page.clock.setFixedTime(new Date('2026-10-18T10:00:00'));
  await page.reload();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByTestId('last-backup')).toHaveText('Last saved 3 days ago.');
});

test('Look, Help and Erase open sheets', async ({ page }) => {
  await quickSetup(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Change Theme' }).click();
  await expect(page.getByRole('dialog', { name: 'Theme' })).toBeVisible();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Open About and disclaimer' }).click();
  await expect(page.getByRole('dialog', { name: 'About and disclaimer' })).toContainText('A planning tool, not financial advice.');
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Erase everything and start over' }).click();
  await expect(page.getByRole('dialog', { name: 'Erase everything?' })).toBeVisible();
});
