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

test.describe('2 · "Help me work it out" on the money step', () => {
  async function toMoneyStep(page: import('@playwright/test').Page) {
    await page.goto('/');
    await page.getByRole('radio', { name: 'Every 2 weeks', exact: true }).click();
    await page.getByLabel('Your next payday').fill('2026-10-23');
    await page.getByRole('button', { name: /^Continue$/ }).click();
    const card = page.locator('fieldset');
    await card.getByLabel('Name').fill('Visa');
    await card.getByLabel('Balance').fill('3200');
    await card.getByLabel('Monthly minimum').fill('96');
    await card.getByLabel('Due day').fill('12');
    await page.getByRole('button', { name: /^(Continue|That’s all of them)$/ }).click();
    await expect(page.getByRole('heading', { name: 'Money for the plan' })).toBeVisible();
  }

  test('take-home and essentials give what is left, and "Use all of it" fills the amount', async ({ page }) => {
    await toMoneyStep(page);
    await page.getByTestId('help-work-out').click();
    const sheet = page.getByRole('dialog', { name: 'Help me work it out' });
    await sheet.getByLabel('Take-home per paycheck').fill('900');
    await sheet.getByLabel('Essentials per paycheck').fill('400');
    // 96 a month of minimums, every 2 weeks: about 44 per paycheck, so 900 - 400 - 44 = 456
    await expect(sheet.getByTestId('help-minimums')).toContainText('about $44 per paycheck');
    await expect(sheet.getByTestId('help-result')).toContainText('About $455 is left. Put some or all of it toward the plan.');
    await sheet.getByRole('button', { name: 'Use half' }).click();
    await expect(page.getByLabel('Money for the plan each payday')).toHaveValue('227');
    await page.getByTestId('help-work-out').click();
    await page.getByRole('dialog', { name: 'Help me work it out' }).getByRole('button', { name: 'Use all of it' }).click();
    await expect(page.getByLabel('Money for the plan each payday')).toHaveValue('455');
  });

  test('when nothing is left it says so calmly and offers no button', async ({ page }) => {
    await toMoneyStep(page);
    await page.getByTestId('help-work-out').click();
    const sheet = page.getByRole('dialog', { name: 'Help me work it out' });
    await sheet.getByLabel('Take-home per paycheck').fill('500');
    await sheet.getByLabel('Essentials per paycheck').fill('480');
    await expect(sheet.getByTestId('help-result')).toContainText('Nothing is left after your essentials and minimums right now. That happens.');
    await expect(sheet.getByRole('button', { name: 'Use all of it' })).toHaveCount(0);
    await expectBrandRules(page);
  });
});

test.describe('3 · Worth knowing on Path', () => {
  test('hidden when empty; calm sentences from the buyer’s own numbers once there is something to say', async ({ page }) => {
    await quickSetup(page);
    await goTab(page, 'Path');
    await expect(page.getByTestId('worth-knowing')).toHaveCount(0);

    // A bill with no due day, and some of the buffer used
    await goTab(page, 'Debts');
    await page.getByRole('button', { name: 'Add a debt' }).click();
    const add = page.getByRole('dialog', { name: 'Add a debt' });
    await add.getByLabel('Name').fill('Phone plan');
    await add.getByRole('textbox', { name: 'Balance' }).fill('300');
    await add.getByRole('textbox', { name: 'Interest rate' }).fill('0');
    await add.getByRole('button', { name: 'Add minimum and due day now' }).click();
    await add.getByLabel('Monthly minimum').fill('40');
    await add.getByRole('button', { name: 'Save', exact: true }).click();
    await goTab(page, 'Safety net');
    await page.getByRole('button', { name: 'I used some of it' }).click();
    await page.getByRole('textbox', { name: 'Amount used' }).fill('200');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await goTab(page, 'Path');
    const card = page.getByTestId('worth-knowing');
    await expect(card).toContainText('Phone plan has no due day yet, so its bill is not in your plan.');
    await expect(card).toContainText('You used some of your buffer. Your plan refills it first: $300 of $500 so far.');
    await expect(card.locator('li')).toHaveCount(2);
    await expectBrandRules(page);
  });
});
