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

test('a number that looks like a typo is asked about, and never blocks', async ({ page }) => {
  await toDebts(page);
  const card = page.locator('fieldset');
  await card.getByLabel('Name').fill('Visa');
  await card.getByLabel('Balance').fill('$3,200');
  await card.getByLabel('Interest rate').fill('2290');
  await card.getByLabel('Monthly minimum').fill('96');
  await expect(card).toContainText('Is 2290% right? Most cards are 15-30%.');
  // It is only a question: Continue still works, and the pasted "$3,200" was understood
  await next(page).click();
  await expect(page.getByRole('heading', { name: 'Your buffer' })).toBeVisible();

  // Low minimum for the balance
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Edit Visa' }).click();
  await card.getByLabel('Interest rate').fill('24');
  await card.getByLabel('Monthly minimum').fill('20');
  await expect(card).toContainText('At this minimum the balance won’t go down. Check the statement.');
});

test('the money step shows the minimums first and has quick amounts', async ({ page }) => {
  await toDebts(page);
  const card = page.locator('fieldset');
  const add = async (name: string, balance: string, apr: string, min: string) => {
    await card.getByLabel('Name').fill(name);
    await card.getByLabel('Balance').fill(balance);
    await card.getByLabel('Interest rate').fill(apr);
    await card.getByLabel('Monthly minimum').fill(min);
  };
  await add('Visa', '3200', '22.9', '96');
  await page.getByRole('button', { name: 'Add another' }).click();
  await add('Store card', '640', '26.99', '35');
  await page.getByRole('button', { name: 'Add another' }).click();
  await add('Car loan', '9800', '7.5', '285');
  await page.getByRole('button', { name: 'Add another' }).click();
  await add('Medical bill', '1150', '0', '50');
  await next(page).click(); // debts
  await next(page).click(); // buffer

  await expect(page.getByRole('heading', { name: 'Money for the plan' })).toBeVisible();
  await expect(page.getByTestId('minimums-line')).toHaveText('Your minimums: $466 a month, about $215 each payday.');
  const field = page.getByLabel('Money for the plan each payday');
  await page.getByRole('button', { name: '$100' }).click();
  await expect(field).toHaveValue('100');
  await expect(page.getByRole('button', { name: '$100' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '$20' }).click();
  await expect(field).toHaveValue('20');
  await field.fill('135'); // still editable
  await expect(page.getByRole('button', { name: '$20' })).toHaveAttribute('aria-pressed', 'false');
});

test('the currency is a small line on the pay schedule step, with Change', async ({ page }) => {
  await page.goto('/');
  await next(page).click(); // welcome
  await expect(page.getByLabel('Step 1 of 7')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your pay schedule' })).toBeVisible();
  await expect(page.getByTestId('currency-line')).toHaveText('Currency: USD ($)');
  await expect(page.getByLabel('Currency')).toHaveCount(0); // closed until asked
  await page.getByRole('button', { name: 'Change' }).click();
  await page.getByLabel('Currency').selectOption('EUR');
  await expect(page.getByTestId('currency-line')).toHaveText('Currency: EUR (€)');
  await page.getByRole('radio', { name: 'Every 2 weeks', exact: true }).click();
  await page.getByLabel('Your next payday').fill('2026-10-23');
  await next(page).click();
  await page.locator('fieldset').getByLabel('Balance').fill('500');
  await expect(page.locator('fieldset')).toContainText('€'); // the euro sign follows to the next steps
});

test('"See an example first" shows Sara\'s result, labelled Example, and saves nothing', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'See an example first' }).click();
  await expect(page.getByTestId('example-banner')).toContainText('Example');
  await expect(page.getByTestId('example-banner')).toContainText('Sara');
  await expect(page.getByTestId('debt-free-date')).toBeVisible();
  await expect(page.getByTestId('first-step')).toContainText('This payday');
  // No code box, no "Change my numbers" here: one clear way out
  await expect(page.getByTestId('unlock-card')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start with my numbers' })).toBeVisible();

  // A reload goes back to the welcome screen: nothing was stored
  await page.reload();
  await expect(page.getByRole('button', { name: 'Let’s start' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'See an example first' })).toBeVisible();

  // Start for real
  await page.getByRole('button', { name: 'See an example first' }).click();
  await page.getByRole('button', { name: 'Start with my numbers' }).click();
  await expect(page.getByRole('button', { name: 'Let’s start' })).toBeVisible();
  await page.getByRole('button', { name: 'Let’s start' }).click();
  await expect(page.getByRole('heading', { name: 'Your pay schedule' })).toBeVisible();
  await expect(page.getByLabel('Your next payday')).toHaveValue(''); // nothing from Sara carried over
});
