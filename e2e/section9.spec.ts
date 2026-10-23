/** ux-v2.md section 9: with the only debt archived, every screen says debt-free; and dates show their year. */
import { expect, test } from '@playwright/test';
import { FIXED, quickSetup } from './helpers';
import { goTab } from './scenario';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
});

test('archiving every debt gives the same debt-free state on every screen, with nothing ticked', async ({ page }) => {
  await quickSetup(page); // two debts
  await goTab(page, 'Debts');
  for (const name of ['Visa', 'Store card']) {
    await page.getByRole('button', { name: `${name}, options` }).click();
    await page.getByRole('button', { name: 'Archive', exact: true }).click();
  }
  await expect(page.getByText('No debts to pay right now.')).toBeVisible();

  const line = page.getByTestId('status-line');
  await goTab(page, 'Today');
  await expect(page.getByRole('heading', { name: /debt-free/ })).toBeVisible();
  await expect(page.getByTestId('debt-free-pill')).toHaveText('Debt-free');
  await expect(line).toHaveText('Debt-free');

  await goTab(page, 'Plan');
  await expect(page.getByText('You’re debt-free. Every debt is paid or archived')).toBeVisible();
  await expect(page.getByText('more than 20 years')).toHaveCount(0);
  await expect(line).toHaveText('Debt-free');

  await goTab(page, 'Progress');
  await expect(page.getByTestId('countdown')).toContainText('Debt-free');
  await expect(page.getByText('more than 20 years')).toHaveCount(0);
  await expect(page.getByText('A long way to go')).toHaveCount(0);
  await expect(line).toHaveText('Debt-free');
  // Nothing is ticked on an empty plan: the only reached milestone is "Plan made"
  await expect(page.getByRole('listitem', { name: /, reached$/ })).toHaveCount(1);
  await expect(page.getByRole('listitem', { name: 'Plan made, reached' })).toBeVisible();
});

test('a date in another year shows its year', async ({ page }) => {
  // Today is Sun 20 Dec 2026. The next payday, Fri 1 Jan 2027, is a different year: it must say so.
  await page.clock.setFixedTime(new Date('2026-12-20T10:00:00'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Let’s start' }).click();
  await page.getByRole('radio', { name: 'Every 2 weeks', exact: true }).click();
  await page.getByLabel('Your next payday').fill('2027-01-01');
  await expect(page.getByText(/That.s Fri 1 Jan 2027\./)).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  const card = page.locator('fieldset');
  await card.getByLabel('Name').fill('Visa');
  await card.getByLabel('Balance').fill('3000');
  await card.getByLabel('Interest rate').fill('20');
  await card.getByLabel('Monthly minimum').fill('90');
  await card.getByLabel('Due day (recommended)').fill('9');
  await page.getByRole('button', { name: 'Continue' }).click(); // debts
  await page.getByRole('button', { name: 'Continue' }).click(); // buffer
  await page.getByLabel('Money for the plan each payday').fill('100');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Continue' }).click(); // order
  await page.getByRole('button', { name: 'See my plan' }).click();
  await expect(page.getByTestId('first-step')).toContainText('(Fri 1 Jan 2027)');
});
