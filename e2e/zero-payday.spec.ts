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
  test('before its day: no Move $0, no I did it, what comes next, and an offer to move a little anyway', async ({ page }) => {
    await runWizard(page, ONE);
    await startPlan(page);
    await tapDidIt(page); // Fri 6 Nov: the Visa bill, $50
    await expect(page.getByTestId('paid-card')).toBeVisible();
    await page.clock.setFixedTime(new Date('2026-11-18T10:00:00')); // 2 days before Fri 20 Nov, which moves nothing
    await page.reload();
    const card = page.getByTestId('zero-card');
    await expect(card).toContainText('Nothing due this payday.');
    await expect(card).toContainText('Next: Visa $50 on Sat 12 Dec.');
    await expect(page.getByRole('button', { name: /^I did it/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Mark it done early' })).toHaveCount(0);
    await expect(page.getByText(/Move\s*\$0/)).toHaveCount(0);
    await expect(page.getByTestId('payday-total')).toHaveCount(0);
    // it is not counted before its day
    await goTab(page, 'Path');
    await page.getByRole('button', { name: 'Chapters', exact: true }).click();
    await expect(page.locator('.chapter-squares i.paid')).toHaveCount(1);
  });

  test('on its day it still offers to move a little; once the day has passed it counts itself as done', async ({ page }) => {
    await runWizard(page, ONE);
    await startPlan(page);
    await tapDidIt(page);
    await expect(page.getByTestId('paid-card')).toBeVisible();
    await page.clock.setFixedTime(new Date('2026-11-20T10:00:00')); // the payday that moves nothing
    await page.reload();
    await expect(page.getByTestId('zero-card')).toContainText('Nothing due this payday.');
    await page.clock.setFixedTime(new Date('2026-11-21T10:00:00')); // the day after: it has counted itself
    await page.reload();
    await expect(page.getByTestId('nothing-card')).toContainText('Nothing to move this payday. Next: Visa $50 on Sat 12 Dec.');
    await expect(page.getByRole('button', { name: /^I did it/ })).toHaveCount(0);
    await expect(page.getByText(/Move\s*\$0/)).toHaveCount(0);
    await expect(page.getByTestId('paid-card')).toHaveCount(0); // no yellow PAID card for $0
    await expect(page.getByTestId('countdown-card')).toContainText('Next payday is Fri 4 Dec');
    // two paydays are done now, but only the $50 one has a square: the $0 one is a gray line
    await goTab(page, 'Path');
    await page.getByRole('button', { name: 'Chapters', exact: true }).click();
    await expect(page.locator('.chapter-squares i.paid')).toHaveCount(1);
    await page.getByRole('button', { name: 'Visa, chapter 1' }).click();
    await expect(page.getByTestId('pd-quiet').first()).toHaveText('Fri 20 Nov · Nothing to move');
    await expectBrandRules(page);
    // and it stays that way after another open
    await page.reload();
    await goTab(page, 'Path');
    await page.getByRole('button', { name: 'Chapters', exact: true }).click();
    await expect(page.locator('.chapter-squares i.paid')).toHaveCount(1);
  });

  test('a payday that does move money still has its card and its I did it', async ({ page }) => {
    await runWizard(page, ONE);
    await startPlan(page);
    await expect(page.getByRole('button', { name: 'I did it · $50' })).toBeVisible(); // Fri 6 Nov holds the Visa bill
    await expect(page.getByTestId('nothing-card')).toHaveCount(0);
    await expect(page.getByTestId('zero-card')).toHaveCount(0);
  });
});

test.describe('Path on paydays with nothing to move', () => {
  // Visa $70 minimum due the 12th, every 2 weeks from Sat 28 Nov 2026, $0 for the plan
  const VISA: WizardConfig = {
    frequency: 'Every 2 weeks',
    nextPayday: '2026-11-28',
    debts: [{ name: 'Visa', balance: '1000', apr: '20', min: '70', due: '12' }],
    bufferNow: '0',
    extra: '0',
  };
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-26T10:00:00'));
  });

  test('Chapters: rows alternate gray "Nothing to move" and $70, and the squares count the $70 paydays only', async ({ page }) => {
    await runWizard(page, VISA);
    await startPlan(page);
    await goTab(page, 'Path');
    await page.getByRole('button', { name: 'Chapters', exact: true }).click();
    await page.getByRole('button', { name: 'Visa, chapter 1' }).click();
    const rows = page.getByRole('list', { name: 'Visa paydays' }).locator('> li');
    const want = ['Sat 28 Nov', 'Sat 12 Dec', 'Sat 26 Dec', 'Sat 9 Jan 2027', 'Sat 23 Jan 2027', 'Sat 6 Feb 2027'];
    for (const [i, date] of want.entries()) {
      const row = rows.nth(i);
      if (i % 2 === 0) {
        await expect(row).toHaveText(`${date} · Nothing to move`);
        await expect(row).toHaveClass('pd-quiet');
        await expect(row.locator('.pd-box, .tag, .pd-amt, button')).toHaveCount(0); // no checkbox, no chip, no amount
        await expect(row).toHaveCSS('color', 'rgb(92, 90, 85)'); // gray
        expect((await row.boundingBox())!.height).toBeLessThan(34); // one text line
      } else {
        await expect(row.locator('.pd-date')).toHaveText(date);
        await expect(row.locator('.pd-amt')).toHaveText('$70');
      }
    }
    const total = await rows.count();
    const quiet = await page.getByTestId('pd-quiet').count();
    const moves = total - quiet;
    expect(quiet).toBeGreaterThan(0);
    await expect(page.locator('.chapter-squares i')).toHaveCount(moves);
    expect(moves).toBe(17);
    await expect(page.getByTestId('chapter-span')).toHaveText('17 paydays with a move · Sat 28 Nov to Sat 1 Apr 2028');
    await expectBrandRules(page);
  });

  test('Calendar: a $0 payday has a gray dot and one gray line, a $70 one opens its preview', async ({ page }) => {
    await runWizard(page, VISA);
    await startPlan(page);
    await goTab(page, 'Path');
    await page.getByRole('button', { name: 'Calendar', exact: true }).click();
    const cal = page.getByTestId('payday-calendar');
    const quiet = cal.getByRole('gridcell', { name: 'Saturday 28 November, payday, nothing to move' });
    await expect(quiet.locator('.dot-pay.quiet')).toHaveCount(1);
    await quiet.click();
    await expect(page.getByTestId('calendar-day').getByTestId('pd-quiet')).toHaveText('Sat 28 Nov · Nothing to move');
    await expect(page.getByTestId('preview-banner')).toHaveCount(0);
    await cal.getByRole('button', { name: 'Next month' }).click();
    const bill = cal.getByRole('gridcell', { name: 'Saturday 12 December, payday, bill due' });
    await expect(bill.locator('.dot-pay:not(.quiet)')).toHaveCount(1);
    await bill.click();
    await expect(page.getByTestId('preview-banner')).toContainText('Preview · Sat 12 Dec');
  });

  test('when the $0 payday has passed, Today moves on by itself and Path keeps it quiet', async ({ page }) => {
    await runWizard(page, VISA);
    await startPlan(page);
    await expect(page.getByTestId('zero-card')).toContainText('Next: Visa $70 on Sat 12 Dec.');
    await page.clock.setFixedTime(new Date('2026-11-29T10:00:00'));
    await page.reload();
    await expect(page.getByTestId('countdown-card')).toContainText('Next payday is Sat 12 Dec');
    await expect(page.getByRole('button', { name: /^I did it/ })).toHaveCount(0);
    await goTab(page, 'Path');
    await page.getByRole('button', { name: 'Chapters', exact: true }).click();
    await expect(page.locator('.chapter-squares i.paid')).toHaveCount(0); // done, but no yellow square for $0
    await page.getByRole('button', { name: 'Visa, chapter 1' }).click();
    await expect(page.getByTestId('pd-quiet').first()).toHaveText('Sat 28 Nov · Nothing to move');
    await page.getByRole('button', { name: 'Calendar', exact: true }).click();
    await page.getByRole('button', { name: 'Previous month' }).click();
    const day = page.getByTestId('payday-calendar').getByRole('gridcell', { name: 'Saturday 28 November, payday, nothing to move' });
    await expect(day).not.toHaveClass(/paid/); // no yellow circle
    await expect(day.locator('.dot-pay.quiet')).toHaveCount(1);
  });
});
