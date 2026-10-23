/**
 * ux-v2.md section 2: setup in four steps (Pay, Debts, Money, Your date). What setup no longer asks comes
 * back as "Do these later": on the result screen and on Today until done.
 */
import { expect, test, type Page } from '@playwright/test';
import { FIXED, quickSetup, unlockOnResult } from './helpers';
import { addYearlyBills, expectBrandRules, goTab, revealEarly } from './scenario';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
});

const next = (page: Page) => page.getByRole('button', { name: /^(Continue|That’s all of them|See my plan)$/ });

async function toPay(page: Page) {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Every 2 weeks', exact: true }).click();
  await page.getByLabel('Your next payday').fill('2026-10-23');
}

test('four steps, each with its own label and bar, and Back keeps what was typed', async ({ page }) => {
  await toPay(page);
  await expect(page.getByLabel('Step 1 of 4')).toBeVisible();
  await expect(page.getByText('1 of 4')).toBeVisible();
  await expectBrandRules(page);
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0); // nothing before the first step
  await next(page).click();

  await expect(page.getByLabel('Step 2 of 4')).toBeVisible();
  await expect(page.getByText('2 of 4')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What do you owe?' })).toBeVisible();
  await expect(page.getByText('Everything is on your statement. Rough numbers are fine for now.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'That’s all of them' })).toBeVisible();
  await expectBrandRules(page);
  const card = page.locator('fieldset');
  await card.getByLabel('Name').fill('Visa');
  await card.getByLabel('Balance').fill('3200');
  await card.getByLabel('Monthly minimum').fill('96');
  await next(page).click();

  await expect(page.getByLabel('Step 3 of 4')).toBeVisible();
  await expect(page.getByRole('button', { name: 'See my plan' })).toBeVisible();
  await expectBrandRules(page);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByLabel('Step 2 of 4')).toBeVisible();
  await expect(page.getByTestId('debt-summary')).toContainText('Visa'); // it is complete, so it is one line again
  await page.getByRole('button', { name: 'Edit Visa' }).click();
  await expect(card.getByLabel('Name')).toHaveValue('Visa');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('radio', { name: 'Every 2 weeks', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByLabel('Your next payday')).toHaveValue('2026-10-23');
});

test('a reload comes back to the same step with the same typing', async ({ page }) => {
  await toPay(page);
  await next(page).click();
  await page.locator('fieldset').getByLabel('Name').fill('Visa');
  await page.locator('fieldset').getByLabel('Balance').fill('3200');
  await page.waitForTimeout(500); // autosave runs 300 ms after typing
  await page.reload();
  await expect(page.getByRole('heading', { name: 'What do you owe?' })).toBeVisible();
  await expect(page.locator('fieldset').getByLabel('Name')).toHaveValue('Visa');
  await expect(page.locator('fieldset').getByLabel('Balance')).toHaveValue('3200');
});

test('an empty rate uses 24%, marks the debt, and Today offers to add the real one', async ({ page }) => {
  await toPay(page);
  await next(page).click();
  const card = page.locator('fieldset');
  await card.getByLabel('Name').fill('Visa');
  await card.getByLabel('Balance').fill('3200');
  await card.getByLabel('Monthly minimum').fill('96');
  await expect(card).toContainText('Don’t know the rate? Leave it. We’ll use 24% and remind you.');
  await next(page).click(); // not blocked
  await page.getByLabel('Money for the plan each payday').fill('100');
  await page.getByLabel('Buffer now').fill('500');
  await next(page).click();
  await expect(page.getByTestId('debt-free-date')).toBeVisible();
  await unlockOnResult(page);
  await page.getByRole('button', { name: 'Start my plan' }).click();

  // Today: a chip to fix it. Debts: the card says so.
  await expect(page.getByTestId('later-card')).toContainText('Add Visa’s rate');
  await goTab(page, 'Debts');
  await expect(page.getByRole('region', { name: 'Visa' })).toContainText('rate missing, using 24%');
  await goTab(page, 'Today');
  await page.getByRole('button', { name: 'Add Visa’s rate' }).click();
  const sheet = page.getByRole('dialog', { name: 'Visa rate' });
  await sheet.getByRole('button', { name: 'Save', exact: true }).click(); // empty: asked once, nothing changes
  await expect(sheet).toContainText('Type the rate from your statement');
  await sheet.getByLabel('Interest rate').fill('22.9');
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add Visa’s rate' })).toHaveCount(0);
  await goTab(page, 'Debts');
  await expect(page.getByRole('region', { name: 'Visa' })).toContainText('22.9% ·');
  await expect(page.getByRole('region', { name: 'Visa' })).not.toContainText('rate missing');
});

test('"Do these later" on Today: each item goes away once it is done', async ({ page }) => {
  await quickSetup(page);
  const later = page.getByTestId('later-card');
  await expect(later).toContainText('Do these later');
  for (const name of ['Yearly bills', 'Payday reminder', 'Save a backup']) await expect(later.getByRole('button', { name, exact: true })).toBeVisible();

  await addYearlyBills(page, [{ idea: 'Car repairs', amount: '600' }]);
  await expect(later.getByRole('button', { name: 'Yearly bills', exact: true })).toHaveCount(0);

  await later.getByRole('button', { name: 'Payday reminder', exact: true }).click();
  await page.getByRole('dialog', { name: 'Payday reminder' }).getByRole('button', { name: 'Save my reminder' }).click();
  await expect(later.getByRole('button', { name: 'Payday reminder', exact: true })).toHaveCount(0);

  const [download] = await Promise.all([page.waitForEvent('download'), later.getByRole('button', { name: 'Save a backup', exact: true }).click()]);
  expect(download.suggestedFilename()).toMatch(/paidinyellow.*\.json$/);
  await expect(page.getByTestId('later-card')).toHaveCount(0); // everything is done: the card is gone

  // The yearly bill is a real part of the plan now
  await revealEarly(page);
  await expect(page.getByRole('checkbox', { name: /Yearly bills/ })).toBeVisible();
});

test('"I have no yearly bills" clears that item without adding anything', async ({ page }) => {
  await quickSetup(page);
  await page.getByTestId('later-card').getByRole('button', { name: 'Yearly bills', exact: true }).click();
  await page.getByRole('dialog', { name: 'Yearly bills' }).getByRole('button', { name: 'I have no yearly bills' }).click();
  await expect(page.getByTestId('later-card').getByRole('button', { name: 'Yearly bills', exact: true })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: /Yearly bills/ })).toHaveCount(0);
});

test('the result screen: the chips are there, and "start on the 1st" moves the first step', async ({ page }) => {
  await quickSetup(page, { unlock: false });
  const card = page.getByTestId('first-card');
  await expect(card).toContainText('Fri 23 Oct');
  // In calculator mode the chips wait behind the code
  await expect(page.getByRole('group', { name: 'Do these later' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Start on the 1st of next month instead' }).click();
  await expect(card).toContainText('Fri 6 Nov'); // the first payday after the 1st
  await page.getByRole('button', { name: 'Start this payday instead' }).click();
  await expect(card).toContainText('Fri 23 Oct');

  await unlockOnResult(page);
  const chips = page.getByRole('group', { name: 'Do these later' });
  await expect(chips.getByRole('button')).toHaveText(['Yearly bills', 'Payday reminder', 'Save a backup']);
  await expectBrandRules(page);
});

test('the date on the result screen has no "set aside" wording left, and it names the extra', async ({ page }) => {
  await quickSetup(page, { unlock: false });
  await expect(page.getByTestId('first-step')).toHaveText('Move $185. The extra $150 goes to Store card.');
  await expect(page.getByTestId('minimums-only')).toContainText('Paying only minimums, it would take until');
  await expect(page.getByTestId('tile-sooner')).toContainText('months');
  await expect(page.getByTestId('tile-interest')).toContainText('less interest');
  await expect(page.getByText(/set aside/i)).toHaveCount(0);
});
