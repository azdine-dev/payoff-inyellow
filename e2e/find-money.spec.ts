/**
 * Find money (Safety net): four groups with an icon each, one line and a typical amount per idea, "I found $__" with one
 * field that goes in as extra money on the next payday (the buffer first), and the total against the buffer goal.
 */
import { expect, test, type Page } from '@playwright/test';
import { FIXED, quickSetup } from './helpers';
import { expectBrandRules, expectNoSidewaysScroll, goTab } from './scenario';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
});

const didIt = async (page: Page) => Number((await page.getByRole('button', { name: /^I did it/ }).innerText()).replace(/[^\d.]/g, ''));

async function openFind(page: Page) {
  await goTab(page, 'Safety net');
  await page.getByTestId('find-card').click();
  await expect(page.getByTestId('find-money')).toBeVisible();
}

test('four groups, one line each, a typical amount, and the top bar', async ({ page }) => {
  await quickSetup(page);
  await openFind(page);
  const bar = page.getByTestId('top-bar');
  await expect(bar.locator('.top-title')).toHaveText('Find money');
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toHaveCount(0);
  await expect(page.locator('.find-head')).toHaveText(['Cut', 'Sell', 'Earn', 'Lower']);
  for (const g of ['cut', 'sell', 'earn', 'lower']) await expect(page.getByTestId(`find-group-${g}`).locator('.line-art[aria-hidden="true"]')).toHaveCount(1);
  await expect(page.getByTestId('find-idea').first()).toHaveText(/Cancel one subscription · about \$15 a month\s*I found \$/);
  const text = (await page.getByTestId('find-money').innerText()).toLowerCase();
  for (const bad of ['loan', 'borrow', 'credit', 'buy now', 'pay later', 'transfer']) expect(text).not.toContain(bad);
  for (const b of await page.locator('.find-btn').all()) {
    const box = (await b.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await expectNoSidewaysScroll(page);
  await expectBrandRules(page);
  await page.goBack(); // Android back
  await expect(page.getByTestId('find-money')).toHaveCount(0);
  await expect(page.getByTestId('find-card')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
});

test('"I found $40" goes to this payday, the safety net first, and the total grows', async ({ page }) => {
  await quickSetup(page);
  const before = await didIt(page);
  // a goal above what is set aside, so the buffer has room
  await goTab(page, 'Safety net');
  await page.getByTestId('buffer-change').click();
  await page.getByLabel('Buffer goal').fill('1000');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('find-card')).toContainText('Found $0 of $1,000');

  await page.getByTestId('find-card').click();
  await page.getByRole('button', { name: 'I found money: Cancel one subscription' }).click();
  const sheet = page.getByRole('dialog', { name: 'I found money' });
  await expect(sheet.getByRole('textbox')).toHaveCount(1); // one typed field
  await sheet.getByLabel('Amount found').fill('40');
  await expect(sheet.getByTestId('find-where')).toHaveText('$40 goes to your safety net first.');
  await sheet.getByRole('button', { name: 'Add $40 to this payday' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByTestId('find-total')).toHaveText('Found $40 of $1,000');
  await expect(page.getByRole('status')).toContainText('$40 added to your payday on Fri 23 Oct.');
  await expect(page.getByTestId('find-got')).toHaveText('✓ $40');

  await page.getByRole('button', { name: 'Back to Safety net' }).click();
  await expect(page.getByTestId('find-card')).toContainText('Found $40 of $1,000');
  await goTab(page, 'Today');
  expect(await didIt(page)).toBe(before + 40); // extra money on this payday
});

test('a short typed amount asks kindly, and dark mode keeps the rules', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await quickSetup(page);
  await openFind(page);
  await page.getByRole('button', { name: 'I found money: Sell 3 things you don’t use' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Add it' }).click();
  await expect(page.getByRole('dialog')).toContainText('Type an amount, like 40.');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await expectBrandRules(page);
  await expectNoSidewaysScroll(page);
});
