/** Paydays with nothing to move: 1 debt, a $50 minimum, $0 extra, every 2 weeks. */
import { expect, test } from '@playwright/test';
import { expectBrandRules, goTab, runWizard, startPlan, tapDidIt, type WizardConfig } from './scenario';

const ONE: WizardConfig = {
  frequency: 'Every 2 weeks',
  nextPayday: '2026-11-06',
  debts: [{ name: 'Visa', balance: '1000', apr: '20', min: '50', due: '12' }],
  bufferNow: '0',
  extra: '0',
};

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-30T10:00:00'));
});

test.describe('the result screen at $0 for the plan', () => {
  test('says minimums only, offers $20, $50 and $100, and a tap moves the date', async ({ page }) => {
    await runWizard(page, ONE);
    const card = page.getByTestId('minimums-only-card');
    await expect(card).toContainText('You’re paying minimums only. Even $20 a payday moves your date.');
    for (const n of ['$20', '$50', '$100']) await expect(card.getByRole('button', { name: n, exact: true })).toBeVisible();
    const before = await page.getByTestId('debt-free-date').innerText();
    await card.getByRole('button', { name: '$50', exact: true }).click();
    await expect(page.getByTestId('minimums-only-card')).toHaveCount(0); // there is money for the plan now
    await expect(page.getByTestId('debt-free-date')).not.toHaveText(before);
    await expectBrandRules(page);
  });

  test('with money for the plan the card is not there', async ({ page }) => {
    await runWizard(page, { ...ONE, extra: '50' });
    await expect(page.getByTestId('minimums-only-card')).toHaveCount(0);
  });
});

test.describe('Today on a payday with nothing to move', () => {
  test('before its day: no Move $0, no I did it, and what comes next', async ({ page }) => {
    await runWizard(page, ONE);
    await startPlan(page);
    await tapDidIt(page); // Fri 6 Nov: the Visa bill, $50
    await expect(page.getByTestId('paid-card')).toBeVisible();
    await page.clock.setFixedTime(new Date('2026-11-18T10:00:00')); // 2 days before Fri 20 Nov, which moves nothing
    await page.reload();
    const card = page.getByTestId('nothing-card');
    await expect(card).toContainText('Nothing to move this payday. Next: Visa $50 on Sat 12 Dec.');
    await expect(page.getByRole('button', { name: /^I did it/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Mark it done early' })).toHaveCount(0);
    await expect(page.getByText(/Move\s*\$0/)).toHaveCount(0);
    await expect(page.getByTestId('payday-total')).toHaveCount(0);
    // it is not counted before its day
    await goTab(page, 'Path');
    await page.getByRole('button', { name: 'Chapters', exact: true }).click();
    await expect(page.locator('.chapter-squares i.paid')).toHaveCount(1);
  });

  test('on its day it counts itself as done, with the same words and the next bill', async ({ page }) => {
    await runWizard(page, ONE);
    await startPlan(page);
    await tapDidIt(page);
    await expect(page.getByTestId('paid-card')).toBeVisible();
    await page.clock.setFixedTime(new Date('2026-11-20T10:00:00')); // the payday that moves nothing
    await page.reload();
    await expect(page.getByTestId('nothing-card')).toContainText('Nothing to move this payday. Next: Visa $50 on Sat 12 Dec.');
    await expect(page.getByRole('button', { name: /^I did it/ })).toHaveCount(0);
    await expect(page.getByText(/Move\s*\$0/)).toHaveCount(0);
    await expect(page.getByTestId('paid-card')).toHaveCount(0); // no yellow PAID card for $0
    await expect(page.getByTestId('countdown-card')).toContainText('Next payday is Fri 4 Dec');
    // two paydays are done now
    await goTab(page, 'Path');
    await page.getByRole('button', { name: 'Chapters', exact: true }).click();
    await expect(page.locator('.chapter-squares i.paid')).toHaveCount(2);
    await expectBrandRules(page);
    // and it stays that way after another open
    await page.reload();
    await goTab(page, 'Path');
    await page.getByRole('button', { name: 'Chapters', exact: true }).click();
    await expect(page.locator('.chapter-squares i.paid')).toHaveCount(2);
  });

  test('a payday that does move money still has its card and its I did it', async ({ page }) => {
    await runWizard(page, ONE);
    await startPlan(page);
    await expect(page.getByRole('button', { name: 'I did it · $50' })).toBeVisible(); // Fri 6 Nov holds the Visa bill
    await expect(page.getByTestId('nothing-card')).toHaveCount(0);
  });
});
