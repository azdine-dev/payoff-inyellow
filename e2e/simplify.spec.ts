/** The simpler look: the countdown card with the road, the small labels, the calendar, empty states, first name. */
import { expect, test } from '@playwright/test';
import { FIXED, quickSetup } from './helpers';
import { expectBrandRules, goTab, tapDidIt } from './scenario';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
});

test.describe('2 · the countdown card', () => {
  test('shows years and months as two big numbers, the month on the highlight, and the road', async ({ page }) => {
    await quickSetup(page);
    const card = page.getByTestId('debt-free-pill');
    await expect(card).toContainText('Debt-free countdown');
    // under a year: only the months show, a zero part is left out
    await expect(card.locator('.dfc-unit')).toHaveCount(1);
    await expect(card.locator('.dfc-unit').first()).toContainText(/^\d+\s*months$/);
    await expect(card.locator('.hl')).toHaveText(/^[A-Z][a-z]+ 20\d\d$/);
    await expect(card.locator('svg.road')).toBeVisible();
    // 8 squares, only the first is yellow at the start
    await expect(card.locator('.road-sq')).toHaveCount(8);
    await expect(card.locator('.road-sq.on')).toHaveCount(1);
    await expectBrandRules(page);
  });

  test('opens Path, and the result screen carries a small road too', async ({ page }) => {
    await quickSetup(page);
    await page.getByTestId('debt-free-pill').click();
    await expect(page.getByRole('heading', { name: 'Your path' })).toBeVisible();
  });

  test('the road follows the dark theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await quickSetup(page);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).not.toBe('rgb(244, 240, 230)');
    await expect(page.getByTestId('debt-free-pill').locator('svg.road')).toBeVisible();
  });
});

test.describe('3 · labels on payday rows and Coming up', () => {
  test('payday rows carry Bill and Extra, and a ticked row gets a yellow Paid label', async ({ page }) => {
    await quickSetup(page);
    const row = page.getByRole('checkbox', { name: /Store card/ });
    await expect(row.locator('.tag', { hasText: 'Bill' })).toBeVisible();
    await expect(row.locator('.tag', { hasText: 'Extra' })).toBeVisible();
    await expect(row.locator('.tag.paid')).toHaveCount(0);
    await row.click();
    await expect(row.locator('.tag.paid')).toHaveText('Paid');
  });

  test('Coming up says Paid once a payday covered the bill', async ({ page }) => {
    await quickSetup(page);
    await tapDidIt(page);
    await expect(page.getByTestId('paid-card')).toBeVisible();
    await page.clock.setFixedTime(new Date('2026-10-30T10:00:00'));
    await page.reload();
    const coming = page.getByTestId('coming-up');
    await expect(coming).toBeVisible();
    const store = coming.locator('[data-state]', { hasText: 'Store card' });
    await expect(store.locator('.tag', { hasText: 'Bill' })).toBeVisible();
    await expect(store.locator('.tag.paid')).toHaveText('Paid');
    const visa = coming.locator('[data-state]', { hasText: 'Visa' });
    await expect(visa.locator('.tag.paid')).toHaveCount(0);
    await expectBrandRules(page);
  });

  test('the payday list uses Bill, Extra, Buffer and Yearly, with a yellow Paid once done', async ({ page }) => {
    await quickSetup(page);
    await goTab(page, 'Path');
    await page.getByRole('button', { name: 'Payday list' }).click();
    const next = page.getByRole('button', { name: 'Fri 23 Oct, to come' }).locator('xpath=..');
    await expect(next.locator('.tag', { hasText: 'Bill' })).toBeVisible();
    await expect(next.locator('.tag', { hasText: 'Minimum' })).toHaveCount(0);
    await expect(next.locator('.tag.paid')).toHaveCount(0);
  });
});
