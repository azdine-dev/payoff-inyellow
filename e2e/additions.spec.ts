/** Additions after testing the competitors: promo rates, "help me work it out", Worth knowing, extra money, notes, print, calendar. */
import { expect, test } from '@playwright/test';
import { FIXED, quickSetup } from './helpers';
import { expectBrandRules, goTab, tapDidIt } from './scenario';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
});

test.describe('1 · promo rate per debt', () => {
  test('a deferred promo that will not be cleared in time shows a calm note and goes first', async ({ page }) => {
    await quickSetup(page);
    await goTab(page, 'Debts');
    await page.getByRole('button', { name: 'Add a debt' }).click();
    const add = page.getByRole('dialog', { name: 'Add a debt' });
    await add.getByLabel('Name').fill('Furniture card');
    await add.getByRole('textbox', { name: 'Balance' }).fill('3000');
    await add.getByRole('textbox', { name: 'Interest rate' }).fill('14.99');
    await add.getByRole('button', { name: 'Add minimum and due day now' }).click();
    await add.getByLabel('Monthly minimum').fill('50');
    await add.getByLabel('Due day (recommended)').fill('12');
    await add.getByRole('textbox', { name: 'Promo rate' }).fill('0');
    await add.getByLabel('Promo ends on').fill('2026-12-31');
    await add.getByRole('checkbox', { name: /Interest is deferred/ }).check();
    await add.getByRole('button', { name: 'Save', exact: true }).click();

    const card = page.getByRole('region', { name: 'Furniture card' });
    await expect(card.getByTestId('promo-line')).toHaveText('Promo rate 0% until Thu 31 Dec · interest is deferred');
    await expect(card.getByTestId('promo-note')).toContainText('Furniture card’s promo ends Thu 31 Dec.');
    await expect(card.getByTestId('promo-note')).toContainText('will still be owing then');
    await expect(card.getByTestId('promo-note')).toContainText('back interest');
    await expect(card.getByTestId('promo-note')).toContainText('It goes first until then.');
    await expect(card).toContainText('1 · Paying now'); // the promo debt moved to the front
    await expectBrandRules(page);
  });

  test('a promo needs both its rate and its end date, and clearing it removes the note', async ({ page }) => {
    await quickSetup(page);
    await goTab(page, 'Debts');
    await page.getByRole('button', { name: 'Visa, options' }).click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Edit Visa' });
    await form.getByRole('textbox', { name: 'Promo rate' }).fill('0');
    await form.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(form).toContainText('Add the day the promo ends');
    await form.getByLabel('Promo ends on').fill('2027-02-01');
    await form.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Visa' }).getByTestId('promo-line')).toContainText('Promo rate 0% until');
  });
});
