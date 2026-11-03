/** "Send it to" in I got extra money, "$X now, $Y after this payday" on the payday card, and the two new themes. */
import { expect, test } from '@playwright/test';
import { nadiaSetup } from './nadia';
import { goTab } from './scenario';

test.describe('I got extra money: Send it to', () => {
  test('the focus debt is selected, the others are options, and the choice takes the money', async ({ page }) => {
    await nadiaSetup(page);
    await page.getByRole('button', { name: 'I got extra money' }).click();
    const sheet = page.getByRole('dialog', { name: 'I got extra money' });
    const select = sheet.getByLabel('Send it to');
    await expect(select).toHaveValue(/.+/);
    await expect(select.locator('option:checked')).toHaveText(/Store Card.*focus debt/);
    await expect(select.locator('option')).toHaveCount(3);
    await sheet.getByRole('textbox', { name: 'Extra money' }).fill('100');
    await select.selectOption({ label: 'Visa' });
    await expect(sheet.getByTestId('windfall-preview')).toBeVisible();
    await sheet.getByRole('button', { name: 'Use it', exact: true }).click();
    await goTab(page, 'Debts');
    await expect(page.getByRole('region', { name: 'Visa' })).toContainText('$2,100');
    await expect(page.getByRole('region', { name: 'Store Card' })).toContainText('$450');
  });
});

test.describe('the payday card', () => {
  test('each debt row says "$X now, $Y after this payday"', async ({ page }) => {
    await nadiaSetup(page);
    const owed = page.getByTestId('pc-owed');
    await expect(owed.first()).toBeVisible();
    await expect(owed.first()).toHaveText(/^\$[\d,]+(\.\d\d)? now, \$[\d,]+(\.\d\d)? after this payday$/);
  });
});

test.describe('themes', () => {
  for (const [label, attr, paper, calm] of [
    ['Warm cream', 'cream', 'rgb(251, 245, 230)', 'rgb(242, 233, 208)'],
    ['Soft blue', 'blue', 'rgb(243, 246, 251)', 'rgb(225, 234, 245)'],
  ] as const) {
    test(`${label} sets the paper and tiles, and survives a reload`, async ({ page }) => {
      await nadiaSetup(page);
      await page.getByRole('button', { name: 'Settings' }).click();
      await page.getByRole('button', { name: 'Change Theme' }).click();
      for (const name of ['Match my device', 'Light', 'Warm cream', 'Soft blue', 'Dark']) await expect(page.getByRole('radio', { name })).toBeVisible();
      await page.getByRole('radio', { name: label }).click();
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', attr);
      await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(paper);
      await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--calm').trim())).toBe(
        '#' + calm.match(/\d+/g)!.map((n) => Number(n).toString(16).padStart(2, '0')).join(''),
      );
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', attr);
    });
  }
});
