/** The last change list before beta: Path tiles and details, Debts rings and History, wide screens, every number a door. */
import { expect, test } from '@playwright/test';
import { FIXED, quickSetup } from './helpers';
import { expectBrandRules, goTab, tapDidIt } from './scenario';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
});

test.describe('Part 3 · Path', () => {
  test('four tiles, each a door, and "Debts paid 2 of 4" next to the % gone', async ({ page }) => {
    await quickSetup(page);
    await goTab(page, 'Path');
    const tiles = page.getByRole('group', { name: 'Your numbers' }).getByRole('button');
    await expect(tiles).toHaveCount(4);
    for (const label of ['Owed now', 'Debt-free date', 'Paid off so far', 'Interest you avoid']) await expect(tiles.filter({ hasText: label })).toHaveCount(1);
    await expect(page.getByTestId('debts-paid')).toHaveText('Debts paid 0 of 2');

    await tiles.filter({ hasText: 'Paid off so far' }).click();
    await expect(page.getByRole('dialog', { name: 'Paid off so far' })).toContainText('Store card');
    await page.getByRole('button', { name: 'Close' }).click();
    await tiles.filter({ hasText: 'Interest you avoid' }).click();
    await expect(page.getByRole('dialog', { name: 'Interest you avoid' })).toContainText('Paying only minimums');
    await page.getByRole('button', { name: 'Close' }).click();
    await tiles.filter({ hasText: 'Debt-free date' }).click();
    await expect(page.getByRole('dialog', { name: 'Payday list' })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await tiles.filter({ hasText: 'Owed now' }).click();
    await expect(page.getByRole('heading', { name: 'Debts', exact: true })).toBeVisible(); // the Debts tab
    await expectBrandRules(page);
  });

  test('tapping the countdown switches between months and years, and the choice is remembered', async ({ page }) => {
    await quickSetup(page);
    await goTab(page, 'Path');
    const toggle = page.getByTestId('countdown-toggle');
    await expect(toggle).toHaveText(/^\d+ months? left$/);
    await toggle.click();
    await expect(toggle).toHaveText(/^\d(\.\d)? years? left$/);
    await page.reload();
    await goTab(page, 'Path');
    await expect(page.getByTestId('countdown-toggle')).toHaveText(/years? left$/); // remembered on this device
    await page.getByTestId('countdown-toggle').click();
    await expect(page.getByTestId('countdown-toggle')).toHaveText(/months? left$/);
  });

  test('"Pay a bit more?" has four rows, and "Use this" moves the date', async ({ page }) => {
    await quickSetup(page);
    await goTab(page, 'Path');
    const before = await page.getByTestId('status-line').innerText();
    await page.getByRole('button', { name: 'What if I add more?' }).click();
    const rows = page.getByTestId('more-row');
    await expect(rows).toHaveCount(4);
    await expect(page.getByLabel('Add money each payday')).toBeVisible(); // slider below the table
    await rows.nth(2).getByRole('button', { name: 'Use +$100 each payday' }).click();
    await expect(page.getByText('Done. Your plan and Today use it now.')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByTestId('status-line')).not.toHaveText(before);
  });

  test('a Next milestone card sits above the list, and "This month: X of Y planned" shows after a payday', async ({ page }) => {
    await quickSetup(page);
    await goTab(page, 'Path');
    await expect(page.getByTestId('next-milestone')).toContainText(/^Next milestone\s*Next: Store card gone · /);
    await expect(page.getByTestId('planned-vs-actual')).toHaveCount(0);
    await goTab(page, 'Today');
    await tapDidIt(page);
    await expect(page.getByTestId('paid-card')).toBeVisible();
    await goTab(page, 'Path');
    await expect(page.getByTestId('planned-vs-actual')).toHaveText('This month: $185 of $185 planned');
  });

  test('payday list: a paid row is yellow and crossed out, the next one is outlined', async ({ page }) => {
    await quickSetup(page);
    await tapDidIt(page);
    await expect(page.getByTestId('paid-card')).toBeVisible();
    await goTab(page, 'Path');
    await page.getByRole('button', { name: 'Payday list', exact: true }).click();
    const next = page.getByRole('button', { name: /to come$/ }).first();
    await expect(next).toHaveAttribute('aria-current', 'step');
    expect(await next.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid');
    await page.getByRole('button', { name: 'Done (1)' }).click();
    const paid = page.getByRole('button', { name: 'Fri 23 Oct, paid' });
    expect((await paid.evaluate((el) => getComputedStyle(el).backgroundColor)).replace(/\s/g, '')).toBe('rgb(255,225,77)');
    expect(await paid.locator('.pd-date').evaluate((el) => getComputedStyle(el).textDecorationLine)).toBe('line-through');
    await expect(paid).toContainText('Paid'); // never color alone
  });
});
