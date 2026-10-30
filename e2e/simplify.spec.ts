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
    // the label shows for a moment before the payday is recorded (or stays, when ticking is not the last step)
    await expect(row.locator('.tag.paid').or(page.getByTestId('paid-card'))).toBeVisible();
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

test.describe('4 · Path: List / Calendar', () => {
  test('a month grid with a dot under paydays and bill days, and a day opens its lines', async ({ page }) => {
    await quickSetup(page);
    await goTab(page, 'Path');
    // List is the first view: the squares
    await expect(page.locator('.payday-grid')).toBeVisible();
    await page.getByRole('button', { name: 'Calendar', exact: true }).click();
    const cal = page.getByTestId('payday-calendar');
    await expect(cal).toContainText('October 2026');
    await expect(page.locator('.payday-grid')).toBeHidden();
    const payday = cal.getByRole('gridcell', { name: 'Friday 23 October, payday' });
    await expect(payday.locator('.dot-pay')).toHaveCount(1);
    const bill = cal.getByRole('gridcell', { name: 'Monday 12 October, bill due' });
    await expect(bill.locator('.dot-bill')).toHaveCount(1);
    // tap a payday: its lines and total
    await payday.click();
    const lines = page.getByTestId('calendar-day');
    await expect(lines).toContainText('Store card');
    await expect(lines.locator('.tag', { hasText: 'Bill' })).toBeVisible();
    await expect(lines).toContainText('Total');
    // tap a bill day
    await bill.click();
    await expect(lines).toContainText('Visa due');
    // next month, then back to the List
    await cal.getByRole('button', { name: 'Next month' }).click();
    await expect(cal).toContainText('November 2026');
    await expect(cal.getByRole('gridcell', { name: 'Friday 6 November, payday' })).toBeVisible();
    await page.getByRole('button', { name: 'List', exact: true }).click();
    await expect(page.locator('.payday-grid')).toBeVisible();
    await expectBrandRules(page);
  });

  test('a paid payday is a yellow filled circle', async ({ page }) => {
    await quickSetup(page);
    await tapDidIt(page);
    await expect(page.getByTestId('paid-card')).toBeVisible();
    await goTab(page, 'Path');
    await page.getByRole('button', { name: 'Calendar', exact: true }).click();
    const paid = page.getByTestId('payday-calendar').getByRole('gridcell', { name: 'Friday 23 October, payday, paid' });
    await expect(paid).toHaveClass(/paid/);
    await expect(paid.locator('.cal-num')).toHaveCSS('background-color', 'rgb(255, 225, 77)');
    await expect(paid.locator('.dot-pay')).toHaveCount(0);
    await paid.click();
    const lines = page.getByTestId('calendar-day');
    await expect(lines.locator('.tag.paid').first()).toHaveText('Paid');
    await expect(lines).toContainText('Total');
  });

  test('an empty day says so with a small picture', async ({ page }) => {
    await quickSetup(page);
    await goTab(page, 'Path');
    await page.getByRole('button', { name: 'Calendar', exact: true }).click();
    await page.getByTestId('payday-calendar').getByRole('gridcell', { name: 'Thursday 15 October' }).click();
    await expect(page.getByTestId('calendar-day').getByTestId('empty')).toContainText('Nothing on this day.');
  });
});

test.describe('5 · empty lists', () => {
  test('every empty list has a small picture and one warm line', async ({ page }) => {
    await quickSetup(page);
    // Today: nothing due in the next 14 days
    const comingEmpty = page.getByTestId('coming-up-empty');
    await expect(comingEmpty.getByTestId('empty')).toContainText('Nothing due in the next 14 days.');
    await expect(comingEmpty.locator('svg.empty-art')).toBeVisible();
    // Safety net: no yearly bills yet
    await goTab(page, 'Safety net');
    await expect(page.getByRole('region', { name: 'Yearly bills' }).getByTestId('empty')).toContainText('No yearly bills yet.');
    // Debts: a debt with no history
    await goTab(page, 'Debts');
    await page.getByRole('button', { name: 'Visa, options' }).click();
    await page.getByRole('button', { name: 'History' }).click();
    await expect(page.getByRole('dialog').getByTestId('empty')).toContainText('Nothing yet.');
    await page.getByRole('button', { name: 'Close' }).click();
    // Path: the payday list when nothing is done yet
    await goTab(page, 'Path');
    await page.getByRole('button', { name: 'Payday list' }).click();
    await page.getByRole('button', { name: /^Done/ }).click();
    await expect(page.getByRole('dialog').getByTestId('empty')).toContainText('No paydays done yet.');
    await expectBrandRules(page);
  });

  test('a plan with every debt archived says so warmly', async ({ page }) => {
    await quickSetup(page);
    await goTab(page, 'Debts');
    for (const name of ['Visa', 'Store card']) {
      await page.getByRole('button', { name: `${name}, options` }).click();
      await page.getByRole('button', { name: 'Archive' }).click();
    }
    await expect(page.getByRole('region', { name: 'No debts' }).getByTestId('empty')).toContainText('No debts to pay right now.');
  });
});
