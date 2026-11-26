/**
 * Today, nothing due and extra money (design/today-extra). Ahmed: Visa $2,000 at 5%, a $70 minimum due the 12th, paid
 * every 2 weeks from Sat 28 Nov 2026, $0 extra, buffer $0 with a $500 goal. Sat 28 Nov has nothing due: the Visa bill
 * falls on Sat 12 Dec. The expected numbers come from engine_v2.py with adjust {0: 50}.
 */
import { expect, test, type Page } from '@playwright/test';
import { expectBrandRules, runWizard, startPlan, type WizardConfig } from './scenario';

const AHMED: WizardConfig = {
  frequency: 'Every 2 weeks',
  nextPayday: '2026-11-28',
  debts: [{ name: 'Visa', balance: '2000', apr: '5', min: '70', due: '12' }],
  bufferNow: '0',
  bufferGoal: '500',
  extra: '0',
};

async function ahmed(page: Page, config: WizardConfig = AHMED) {
  await page.clock.setFixedTime(new Date('2026-11-26T10:00:00')); // Thu 26 Nov
  await runWizard(page, config);
  await startPlan(page);
}

const scene = (page: Page) => page.getByTestId('scene');

test.describe('1 · the scene before a real "I did it"', () => {
  test('no yellow square and no "First square" on a $0 payday, before and after it counts itself', async ({ page }) => {
    await ahmed(page);
    await expect(scene(page).locator('rect.sc-paid')).toHaveCount(0);
    await expect(page.getByTestId('scene-pin')).toHaveAttribute('data-index', '0'); // you stand on the first square
    await expect(page.getByText('First square')).toHaveCount(0);
    await expect(page.getByTestId('pay-note')).toHaveCount(0);
    await expect(page.getByTestId('milestone-moment')).toHaveCount(0);
    // the day after, the $0 payday has counted itself: still nothing yellow and no note
    await page.clock.setFixedTime(new Date('2026-11-29T10:00:00'));
    await page.reload();
    await expect(page.getByTestId('countdown-card')).toContainText('Next payday is Sat 12 Dec');
    await expect(scene(page).locator('rect.sc-paid')).toHaveCount(0);
    await expect(page.getByText('First square')).toHaveCount(0);
    await expect(page.getByTestId('milestone-moment')).toHaveCount(0);
    await expectBrandRules(page);
  });
});
