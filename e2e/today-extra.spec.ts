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
  await page.getByRole('button', { name: 'Back to Path' }).click();
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
    await expect(card).toContainText('Next: Visa $70 on Sat 12 Dec.'); // one short sentence
    await expect(card).not.toContainText('Or leave it');
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

test.describe('3 · after "Move $X": the yellow PAID card, Undo, and the flag', () => {
  const move50 = async (page: Page) => {
    const card = page.getByTestId('zero-card');
    await card.getByRole('button', { name: '$50', exact: true }).click();
    await card.getByRole('button', { name: 'Move $50', exact: true }).click();
    await expect(page.getByTestId('paid-card')).toBeVisible();
  };

  test('the PAID card with Undo, one yellow square, "First square", and the flag stays when the date does not move', async ({ page }) => {
    await ahmed(page);
    await move50(page);
    const paid = page.getByTestId('paid-card');
    await expect(paid).toHaveCSS('background-color', 'rgb(255, 225, 77)');
    await expect(page.getByTestId('paid-total')).toHaveText('$50');
    await expect(paid).toContainText('Buffer');
    await expect(page.getByTestId('greeting')).toHaveText('Done for this payday.');
    await expect(page.getByTestId('pay-note')).toHaveText('First square. The hardest one is behind you.');
    await expect(scene(page).locator('rect.sc-paid')).toHaveCount(1); // the first real square
    await expect(page.getByTestId('scene-flag')).not.toHaveClass(/move-/); // Sat 9 Jun 2029 either way
    await expect(page.getByTestId('safety-tile')).toContainText('$50 of $500');
    await expectBrandRules(page);

    // Undo, as on any payday: the card with nothing due is back, and nothing is yellow
    await paid.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByTestId('zero-card')).toBeVisible();
    await expect(page.getByTestId('safety-tile')).toContainText('$0 of $500');
    await expect(scene(page).locator('rect.sc-paid')).toHaveCount(0);

    // moved again, it stays after a reload, like any payday
    await move50(page);
    await page.reload();
    await expect(page.getByTestId('paid-card')).toBeVisible();
    await expect(page.getByTestId('paid-total')).toHaveText('$50');
    await expect(page.getByTestId('countdown-card')).toContainText('Next payday is Sat 12 Dec');
  });

  test('when the date moves the flag slides once; with reduced motion it does not move', async ({ page }) => {
    await ahmed(page, { ...AHMED, bufferGoal: '0' });
    await move50(page);
    const flag = page.getByTestId('scene-flag');
    await expect(flag).toHaveClass(/move-sooner/);
    expect(await flag.evaluate((el) => getComputedStyle(el).animationName)).toBe('flag-sooner');
    expect(await flag.evaluate((el) => getComputedStyle(el).animationIterationCount)).toBe('1');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await flag.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
    // Undo: the flag stands still again
    await page.getByTestId('paid-card').getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByTestId('zero-card')).toBeVisible();
    await expect(page.getByTestId('scene-flag')).not.toHaveClass(/move-/);
  });
});

test.describe('4 · a payday with a bill: "Extra money came in?" under "I did it"', () => {
  test('the row is in the payday card under I did it, opens the chips, and adds the money to this payday', async ({ page }) => {
    await ahmed(page);
    await page.clock.setFixedTime(new Date('2026-12-12T10:00:00')); // Sat 12 Dec: the Visa bill; 28 Nov has counted itself
    await page.reload();
    await expect(page.getByRole('button', { name: 'I got extra money' })).toHaveCount(0); // the old floating link is gone
    const card = page.locator('.payday-card');
    const didIt = card.getByRole('button', { name: 'I did it · $70' });
    const row = card.getByTestId('extra-row');
    await expect(row).toContainText('Extra money came in?');
    await expect(row).toHaveText(/^\+?\s*Extra money came in\?\s*›?$/); // one line
    expect((await row.boundingBox())!.y).toBeGreaterThan((await didIt.boundingBox())!.y); // under I did it
    await expect(page.getByTestId('extra-row')).toHaveCount(1);

    await row.click();
    const sheet = page.getByRole('dialog', { name: 'Extra money' });
    await sheet.getByRole('button', { name: '$50', exact: true }).click();
    await expect(sheet.getByTestId('move-where')).toContainText('$50 goes to your safety net first.');
    await expect(sheet.getByTestId('move-where')).toContainText('$50 of $500. A surprise bill stays off Visa.');
    await expect(sheet.getByRole('button', { name: 'Pay it to one debt now' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'It’s coming later' })).toBeVisible();
    await sheet.getByRole('button', { name: 'Add $50 to this payday' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'I did it · $120' })).toBeVisible();
    await expect(card).toContainText('Buffer');
    await page.getByRole('button', { name: 'I did it · $120' }).click();
    await expect(page.getByTestId('paid-total')).toHaveText('$120');
    await expect(page.getByTestId('safety-tile')).toContainText('$50 of $500');
    await expectBrandRules(page);
  });

  test('the two small links keep the old ways: pay one debt now, or money coming later', async ({ page }) => {
    await ahmed(page);
    await page.clock.setFixedTime(new Date('2026-12-12T10:00:00'));
    await page.reload();
    await page.getByTestId('extra-row').click();
    await page.getByRole('dialog', { name: 'Extra money' }).getByRole('button', { name: 'It’s coming later' }).click();
    const when = page.getByRole('group', { name: 'When' });
    await expect(when.getByRole('button', { name: 'It’s coming later' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await page.getByTestId('extra-row').click();
    await page.getByRole('dialog', { name: 'Extra money' }).getByRole('button', { name: 'Pay it to one debt now' }).click();
    await expect(page.getByRole('group', { name: 'When' }).getByRole('button', { name: 'I have it now' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('textbox', { name: 'Extra money' })).toBeVisible();
  });
});

test.describe('5 · Coming up', () => {
  test('hidden when nothing is due in the next 14 days, there when a bill comes close', async ({ page }) => {
    await ahmed(page); // Thu 26 Nov: the Visa bill is on Sat 12 Dec, 16 days away
    await expect(page.getByRole('region', { name: 'Coming up' })).toHaveCount(0);
    await expect(page.getByText('Nothing due in the next 14 days')).toHaveCount(0);
    await page.clock.setFixedTime(new Date('2026-12-01T10:00:00')); // 11 days before it
    await page.reload();
    await expect(page.getByTestId('coming-up')).toContainText('Visa');
    // and "Do these later" still comes after it
    const coming = (await page.getByTestId('coming-up').boundingBox())!;
    expect((await page.getByTestId('later-card').boundingBox())!.y).toBeGreaterThan(coming.y + coming.height - 1);
  });
});

test.describe('6 · the safety net tile with $0 a payday', () => {
  test('says how it fills, and "Add some" opens the money for the plan in Settings', async ({ page }) => {
    await ahmed(page);
    const fill = page.getByTestId('safety-fill');
    await expect(fill).toHaveText('Fills when you add money per payday. Add some');
    const add = fill.getByRole('button', { name: 'Add some' });
    expect((await add.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await add.click();
    const sheet = page.getByRole('dialog', { name: 'Money for the plan' });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('textbox').fill('25');
    await sheet.getByRole('button', { name: 'Save' }).click();
    await page.getByRole('button', { name: 'Close settings' }).or(page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Today', exact: true })).first().click();
    await expect(page.getByTestId('safety-tile')).toBeVisible();
    await expect(page.getByTestId('safety-fill')).toHaveCount(0); // money comes in each payday now
  });

  test('not there once the buffer is full, or when there is money each payday', async ({ page }) => {
    await ahmed(page, { ...AHMED, bufferNow: '500' });
    await expect(page.getByTestId('safety-tile')).toContainText('$500 ready');
    await expect(page.getByTestId('safety-fill')).toHaveCount(0);
  });
});
