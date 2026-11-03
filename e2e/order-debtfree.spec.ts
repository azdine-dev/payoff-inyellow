/** The payoff order after a new debt, the last debt paid (the header changes at once), and the first payday caption. */
import { expect, test, type Page } from '@playwright/test';
import { runWizard, startPlan, goTab, tapDidIt, expectBrandRules, type WizardConfig } from './scenario';
import { NADIA, nadiaSetup } from './nadia';

/** Nadia, but with Visa still to add */
const TWO: WizardConfig = { ...NADIA, debts: NADIA.debts.slice(0, 2) };

async function payExtra(page: Page, amount: number) {
  await page.getByRole('button', { name: 'I got extra money' }).click();
  await page.getByRole('textbox', { name: 'Extra money' }).fill(String(amount));
  await page.getByRole('button', { name: 'Use it', exact: true }).click();
}

test.describe('the payoff order after adding a debt', () => {
  test('Store Card and Medical, then Visa: the order is Store Card, Medical, Visa', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-30T10:00:00'));
    await runWizard(page, TWO);
    await startPlan(page);
    await goTab(page, 'Debts');
    await page.getByRole('button', { name: 'Add a debt' }).click();
    const sheet = page.getByRole('dialog', { name: 'Add a debt' });
    await sheet.getByLabel('Name').fill('Visa');
    await sheet.getByLabel('Balance').fill('2200');
    await sheet.getByLabel('Interest rate').fill('22.99');
    await sheet.getByRole('button', { name: 'Add minimum and due day now' }).click();
    await sheet.getByLabel('Monthly minimum').fill('66');
    await sheet.getByLabel('Due day').fill('20');
    await sheet.getByRole('button', { name: /^(Save|Add debt|Add)$/ }).click();
    const order = await page.locator('.debt-card h2').allInnerTexts();
    expect(order).toEqual(['Store Card', 'Medical', 'Visa']);
    // Today and the focus agree: the extra goes to Store Card first
    await goTab(page, 'Today');
    await expect(page.getByRole('region', { name: 'Focus debt' })).toContainText('Store Card');
  });
});

test.describe('after the last debt', () => {
  test('the header says Debt-free. at once, with no next payday, and "Debt-free." is the moment too', async ({ page }) => {
    await nadiaSetup(page);
    await expect(page.getByTestId('greeting')).toContainText('Next payday');
    await payExtra(page, 3250);
    // the moment for the last debt says Debt-free, not "One down"
    const moment = page.getByTestId('paid-moment');
    await expect(moment).toBeVisible();
    await expect(moment.locator('.paid-moment-title')).toHaveText('Debt-free.');
    await expect(moment).not.toContainText('One down');
    await page.getByRole('button', { name: /Next payday|Done/ }).click();
    // no reload: the header is already the debt-free one
    await expect(page.getByTestId('greeting')).toHaveText('Debt-free.');
    await expect(page.locator('.today-head')).not.toContainText('payday');
    await expect(page.locator('.today-head')).not.toContainText('Next');
    await expectBrandRules(page);
    await page.reload();
    await expect(page.getByTestId('greeting')).toHaveText('Debt-free.');
  });

  test('paying the last debt with "I did it" also clears the stale header without a reload', async ({ page }) => {
    await nadiaSetup(page);
    await payExtra(page, 3000); // $250 left
    await page.getByRole('button', { name: /Next payday|Done/ }).click().catch(() => undefined);
    await payExtra(page, 250);
    await page.getByRole('button', { name: /Next payday|Done/ }).click().catch(() => undefined);
    await expect(page.getByTestId('greeting')).toHaveText('Debt-free.');
    await expect(page.getByTestId('pay-note-card')).toHaveCount(0);
  });
});

test.describe('the first payday', () => {
  test('the header does not repeat the next payday, and the chart says how far below day one you are', async ({ page }) => {
    await nadiaSetup(page);
    await tapDidIt(page);
    await expect(page.getByTestId('paid-card')).toBeVisible();
    // the next payday is said once, on the countdown card, not again in the header
    await expect(page.locator('.today-head')).toContainText('is paid.');
    await expect(page.locator('.today-head')).not.toContainText('Next payday');
    await expect(page.getByTestId('countdown-card')).toContainText('Next payday is');
    await expect(page.getByTestId('mini-line')).toHaveText(/^\$\d+(\.\d\d)? lower than day one\.$/);
  });
});

test.describe('the minimums-only date', () => {
  test('the result screen says it is counted from today', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-30T10:00:00'));
    await runWizard(page, NADIA);
    await expect(page.getByTestId('minimums-only')).toContainText(/Paying only minimums, counting from today, it would take until [A-Z][a-z]+ 20\d\d\./);
  });
});
