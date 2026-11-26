/**
 * Today, nothing due and extra money (design/today-extra). Ahmed: Visa $2,000 at 5%, a $70 minimum due the 12th, paid
 * every 2 weeks from Sat 28 Nov 2026, $0 extra, buffer $0 with a $500 goal. Sat 28 Nov has nothing due: the Visa bill
 * falls on Sat 12 Dec. The expected numbers come from engine_v2.py with adjust {0: 50}.
 */
import { expect, test, type Page } from '@playwright/test';
import { expectBrandRules, goTab, runWizard, startPlan, type WizardConfig } from './scenario';

const AHMED: WizardConfig = {
  frequency: 'Every 2 weeks',
  nextPayday: '2026-11-28',
  debts: [{ name: 'Visa', balance: '2000', apr: '5', min: '70', due: '12' }],
  bufferNow: '0',
  bufferGoal: '500',
  extra: '0',
};

async function ahmed(page: Page, config: WizardConfig = AHMED, day = '2026-11-26') {
  await page.clock.setFixedTime(new Date(`${day}T10:00:00`)); // Thu 26 Nov, or the payday itself
  await runWizard(page, config);
  await startPlan(page);
}

/** What Visa owes, to the cent, as saved on the phone */
const visaOwes = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('paidinyellow');
        open.onsuccess = () => {
          const get = open.result.transaction('debts').objectStore('debts').getAll();
          get.onsuccess = () => resolve(Math.round((get.result as { name: string; balance: number }[]).find((x) => x.name === 'Visa')!.balance * 100) / 100);
        };
        open.onerror = () => reject(open.error);
      }),
  );

/** The debt-free day, with its year, from "Your whole plan" on Path */
async function debtFreeDay(page: Page): Promise<string> {
  await goTab(page, 'Path');
  await page.getByTestId('whole-plan-card').click();
  const sub = (await page.getByTestId('wp-sub').innerText()).replace(/.* to /, '');
  await page.getByRole('button', { name: '‹ Path' }).click();
  await goTab(page, 'Today');
  return sub;
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

test.describe('2 · a payday with nothing due: chips, where it goes, Move $X', () => {
  test('the card, the chips, and where $50 goes with a $500 goal: the safety net first', async ({ page }) => {
    await ahmed(page);
    const card = page.getByTestId('zero-card');
    await expect(card.getByText('This payday · Sat 28 Nov')).toBeVisible();
    await expect(card.getByRole('heading', { name: 'Nothing due this payday.' })).toBeVisible();
    await expect(card).toContainText('Next: Visa $70 on Sat 12 Dec. Want to move a little anyway?');
    await expect(card).toContainText('Or leave it. Nothing is needed this payday.');
    const chips = card.getByRole('group', { name: 'How much to move' });
    for (const n of ['$20', '$50', '$100', 'Other']) await expect(chips.getByRole('button', { name: n, exact: true })).toHaveAttribute('aria-pressed', 'false');
    await expect(card.getByRole('button', { name: /^Move/ })).toHaveCount(0); // nothing picked, nothing to move
    await expect(page.getByRole('button', { name: /^I did it/ })).toHaveCount(0);

    await chips.getByRole('button', { name: '$50', exact: true }).click();
    await expect(chips.getByRole('button', { name: '$50', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const where = page.getByTestId('move-where');
    await expect(where).toContainText('$50 goes to your safety net first.');
    await expect(where).toContainText('$50 of $500. A surprise bill stays off Visa.');
    await expect(where).not.toContainText('Debt-free'); // the date does not move
    await expect(card.getByRole('button', { name: 'Move $50', exact: true })).toBeVisible();

    // Other opens the amount field
    await chips.getByRole('button', { name: 'Other', exact: true }).click();
    await card.getByRole('textbox', { name: 'Other amount' }).fill('30');
    await expect(where).toContainText('$30 goes to your safety net first.');
    await expect(card.getByRole('button', { name: 'Move $30', exact: true })).toBeVisible();
    await expectBrandRules(page);
  });

  test('Move $50 on Sat 28 Nov, goal $500: safety net $50 of $500, Visa unchanged, debt-free still Sat 9 Jun 2029', async ({ page }) => {
    await ahmed(page, AHMED, '2026-11-28');
    await expect(page.getByTestId('greeting')).toHaveText('Hi, it’s payday.');
    expect(await debtFreeDay(page)).toBe('Sat 9 Jun 2029');
    const card = page.getByTestId('zero-card'); // on the day itself it is still offered
    await card.getByRole('button', { name: '$50', exact: true }).click();
    await card.getByRole('button', { name: 'Move $50', exact: true }).click();
    await expect(page.getByTestId('paid-card')).toBeVisible();
    await expect(page.getByTestId('safety-tile')).toContainText('$50 of $500');
    expect(await visaOwes(page)).toBe(2003.85); // the same as without the $50: only the interest, no bill this payday
    expect(await debtFreeDay(page)).toBe('Sat 9 Jun 2029');
  });

  test('Move $50 on Sat 28 Nov, goal $0: Visa owes $1,953.85 and debt-free is Sat 12 May 2029', async ({ page }) => {
    await ahmed(page, { ...AHMED, bufferGoal: '0' }, '2026-11-28');
    expect(await debtFreeDay(page)).toBe('Sat 9 Jun 2029');
    const card = page.getByTestId('zero-card');
    await card.getByRole('button', { name: '$50', exact: true }).click();
    await expect(page.getByTestId('move-where')).toContainText('$50 goes to Visa.');
    await expect(page.getByTestId('move-where')).toContainText('Debt-free Sat 12 May 2029 instead of Sat 9 Jun 2029.');
    await card.getByRole('button', { name: 'Move $50', exact: true }).click();
    await expect(page.getByTestId('paid-card')).toBeVisible();
    expect(await visaOwes(page)).toBe(1953.85);
    expect(await debtFreeDay(page)).toBe('Sat 12 May 2029');
  });
});
