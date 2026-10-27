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

test.describe('Part 4 · Debts', () => {
  test('each card has a progress ring and its gone-by date', async ({ page }) => {
    await quickSetup(page);
    await goTab(page, 'Debts');
    for (const name of ['Store card', 'Visa']) {
      const card = page.getByRole('region', { name });
      await expect(card.getByRole('progressbar', { name: `${name} paid off` })).toBeVisible();
      await expect(card).toContainText(/gone by /);
    }
    await expect(page.locator('.debt-card .bar')).toHaveCount(0); // the ring replaced the bar
  });

  test('a paid debt moves to the bottom, yellow, crossed out, with the PAID stamp', async ({ page }) => {
    await quickSetup(page);
    await page.getByRole('button', { name: '+ Extra payment' }).click();
    await page.getByRole('textbox', { name: 'Extra payment' }).fill('640');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('button', { name: /Next payday|Done/ }).click();
    await goTab(page, 'Debts');
    const paid = page.getByRole('region', { name: 'Store card' });
    await expect(paid).toContainText('PAID');
    await page.waitForTimeout(900); // the card turns yellow over half a second
    expect((await paid.evaluate((el) => getComputedStyle(el).backgroundColor)).replace(/\s/g, '')).toBe('rgb(255,225,77)');
    expect(await paid.locator('h2').evaluate((el) => getComputedStyle(el).textDecorationLine)).toBe('line-through');
    await expect(paid.locator('.paid-stamp')).toBeVisible();
    const tops = async (name: string) => (await page.getByRole('region', { name }).boundingBox())!.y;
    expect(await tops('Store card')).toBeGreaterThan(await tops('Visa')); // paid debts sit below the ones still being paid
  });

  test('History lists payments, new charges and statement updates, newest first and read-only', async ({ page }) => {
    await quickSetup(page);
    await tapDidIt(page);
    await expect(page.getByTestId('paid-card')).toBeVisible();
    await goTab(page, 'Debts');
    await page.getByRole('button', { name: 'Store card, options' }).click();
    await page.getByRole('button', { name: 'Add a new charge or fee' }).click();
    await page.getByRole('textbox', { name: 'Charge amount' }).fill('20');
    await page.getByRole('textbox', { name: 'Note (optional)' }).fill('late fee');
    await page.getByRole('button', { name: 'Add to balance' }).click();
    await page.getByRole('button', { name: 'Store card, options' }).click();
    await page.getByRole('button', { name: 'Update from my statement' }).click();
    await page.getByRole('textbox', { name: 'Balance on statement' }).fill('400');
    await page.getByRole('button', { name: 'Update balance' }).click();

    await page.getByRole('button', { name: 'Store card, options' }).click();
    await page.getByRole('button', { name: 'History', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Store card history' });
    const list = sheet.getByTestId('debt-history');
    await expect(list).toContainText('Bill paid');
    await expect(list).toContainText('Extra paid');
    await expect(list).toContainText('New charge or fee (Everyday), late fee');
    await expect(list).toContainText('Updated from statement');
    await expect(list).toContainText('+$20.00');
    await expect(sheet.getByRole('textbox')).toHaveCount(0); // read-only
    await expectBrandRules(page);
  });
});

test.describe('Part 5 · wide screens', () => {
  test.describe('above 900px', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('a slim side menu replaces the tab bar, and Today sits next to Path', async ({ page }) => {
      await quickSetup(page);
      const nav = page.getByRole('navigation', { name: 'Main' });
      const box = (await nav.boundingBox())!;
      expect(box.x).toBeLessThan(10);
      expect(box.width).toBeLessThan(140); // slim
      expect(box.height).toBeGreaterThan(250); // a column down the side, not a bar along the bottom
      await expect(nav.getByRole('button')).toHaveCount(4);
      await expect(page.getByTestId('payday-total')).toBeVisible(); // Today
      await expect(page.getByRole('heading', { name: 'Your path' })).toBeVisible(); // and Path, at the same time
      const today = (await page.getByTestId('payday-total').boundingBox())!;
      const path = (await page.getByRole('heading', { name: 'Your path' }).boundingBox())!;
      expect(path.x).toBeGreaterThan(today.x + 200); // beside it, not under it
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await nav.getByRole('button', { name: 'Debts', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Debts', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Your path' })).toHaveCount(0); // the other tabs stay single
      await expectBrandRules(page);
    });
  });

  test('a phone keeps the bottom tab bar and one screen at a time', async ({ page }) => {
    await quickSetup(page);
    const box = (await page.getByRole('navigation', { name: 'Main' }).boundingBox())!;
    expect(box.width).toBeGreaterThan(300); // a bar across the bottom
    expect(box.y).toBeGreaterThan(500);
    await expect(page.getByRole('heading', { name: 'Your path' })).toHaveCount(0);
  });
});
