/** The Debts tab shows the new balances right after "I did it" or "Mark it done early", with no reload. */
import { expect, test, type Page } from '@playwright/test';
import { nadiaSetup } from './nadia';
import { goTab, revealEarly, tapDidIt } from './scenario';

const balance = async (page: Page, name: string) => {
  const text = (await page.getByRole('region', { name }).locator('.debt-left').first().textContent()) ?? '';
  return Number(text.replace(/[^0-9.]/g, ''));
};

test.describe('Debts balances without a reload', () => {
  test('after "I did it": Debts shows the lower balances at once, also when it was open before', async ({ page }) => {
    await nadiaSetup(page);
    await goTab(page, 'Debts'); // open once, so its numbers were shown before
    const before = await balance(page, 'Store Card');
    expect(before).toBe(450);
    await goTab(page, 'Today');
    await tapDidIt(page);
    await expect(page.getByTestId('paid-card')).toBeVisible();
    await goTab(page, 'Debts');
    // the number is lower right away, and once the short roll is over it is the same one a reload shows
    await expect.poll(() => balance(page, 'Store Card')).toBeLessThan(before);
    await page.waitForTimeout(700);
    const shown = await balance(page, 'Store Card');
    await page.reload();
    await goTab(page, 'Debts');
    await page.waitForTimeout(700);
    expect(await balance(page, 'Store Card')).toBe(shown);
    expect(shown).toBe(425);
  });

  test('after "Mark it done early": the same', async ({ page }) => {
    await nadiaSetup(page);
    await goTab(page, 'Debts');
    const before = await balance(page, 'Store Card');
    await goTab(page, 'Today');
    await revealEarly(page);
    await tapDidIt(page);
    await expect(page.getByTestId('paid-card')).toBeVisible();
    await goTab(page, 'Debts');
    await expect.poll(() => balance(page, 'Store Card')).toBeLessThan(before);
  });
});

test('the new balance lands even when the browser holds back animation frames', async ({ page }) => {
  await nadiaSetup(page);
  await goTab(page, 'Debts');
  await goTab(page, 'Today');
  await tapDidIt(page);
  await expect(page.getByTestId('paid-card')).toBeVisible();
  await page.evaluate(() => {
    window.requestAnimationFrame = () => 0; // frames no longer run
  });
  await goTab(page, 'Debts');
  await expect.poll(() => balance(page, 'Store Card'), { timeout: 3000 }).toBe(425);
});
