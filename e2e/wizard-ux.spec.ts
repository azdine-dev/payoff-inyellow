/** Setup wizard: shorter and clearer. One debt open at a time, gentle checks, money step, currency, example. */
import { expect, test } from '@playwright/test';
import { FIXED } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
});

const next = (page: import('@playwright/test').Page) => page.getByRole('button', { name: /^(Continue|Skip for now|See my plan|Let’s start)$/ });

async function toDebts(page: import('@playwright/test').Page) {
  await page.goto('/');
  await next(page).click(); // welcome
  await next(page).click(); // currency
  await page.getByRole('radio', { name: 'Every 2 weeks', exact: true }).click();
  await page.getByLabel('Your next payday').fill('2026-10-23');
  await next(page).click();
}

test('a finished debt becomes one line, and only one debt is open at a time', async ({ page }) => {
  await toDebts(page);
  const card = page.locator('fieldset');
  await card.getByLabel('Name').fill('Visa');
  await card.getByLabel('Balance').fill('3200');
  await card.getByLabel('Interest rate').fill('22.9');
  await card.getByLabel('Monthly minimum').fill('96');
  await card.getByLabel('Due day (recommended)').fill('12');
  await page.getByRole('button', { name: 'Add another' }).click();

  await expect(page.getByTestId('debt-summary')).toHaveCount(1);
  await expect(page.getByTestId('debt-summary')).toContainText('Visa · $3,200 · 22.9% · $96/mo · due 12th');
  await expect(card).toHaveCount(1); // only the new debt is open
  await card.getByLabel('Name').fill('Store card');
  await card.getByLabel('Balance').fill('640');
  await card.getByLabel('Interest rate').fill('26.99');
  await card.getByLabel('Monthly minimum').fill('35');
  await page.getByRole('button', { name: 'Add another' }).click();
  await expect(page.getByTestId('debt-summary')).toHaveCount(2);
  await expect(card).toHaveCount(1);

  // Edit opens that debt and closes the other one
  await page.getByRole('button', { name: 'Edit Visa' }).click();
  await expect(card).toHaveCount(1);
  await expect(card.getByLabel('Name')).toHaveValue('Visa');
  await expect(card.getByLabel('Balance')).toHaveValue('3200');
});
