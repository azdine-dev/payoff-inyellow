/** Settings: the whole row is the button, the calendar is one row, and the long sync words sit behind a (?). */
import { expect, test } from '@playwright/test';
import { FIXED, quickSetup } from './helpers';
import { expectBrandRules, expectNoSidewaysScroll } from './scenario';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
});

test('every row is one tap target, at least 44 high and as wide as the card', async ({ page }) => {
  await quickSetup(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  const rows = page.locator('.set-row');
  const n = await rows.count();
  expect(n).toBeGreaterThanOrEqual(14);
  for (let i = 0; i < n; i++) {
    const b = (await rows.nth(i).boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.width).toBeGreaterThanOrEqual(280);
  }
  // a tap on the words at the left opens the sheet, not only the small link at the right
  const row = page.getByRole('button', { name: 'Change Pay schedule' });
  const b = (await row.boundingBox())!;
  await page.mouse.click(b.x + 20, b.y + b.height / 2);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.goBack(); // the Android back button closes it
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Your plan' })).toBeVisible();
  await expectBrandRules(page);
  await expectNoSidewaysScroll(page);
});

test('the calendar is one row: its sheet holds the file and Google Calendar', async ({ page }) => {
  await quickSetup(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByTestId('google-cal')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add Calendar' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add to my calendar' });
  await expect(sheet.getByRole('button', { name: 'Add to my calendar' })).toBeVisible();
  await expect(sheet.getByTestId('google-cal')).toBeVisible();
  await expect(sheet).toContainText('only the payday check, no amounts');
});

test('sync: one short line, the rest behind the (?)', async ({ page }) => {
  await quickSetup(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  const sync = page.getByTestId('sync-section');
  await expect(sync).toContainText('Optional. Use your plan on a second device.');
  await expect(page.getByTestId('sync-how')).toHaveCount(0);
  await sync.getByRole('button', { name: 'Help: How sync keeps your numbers private' }).click();
  await expect(page.getByTestId('sync-how')).toContainText('the server can’t read them');
  await expect(page.getByTestId('sync-how')).toContainText('Without sync, nothing leaves this device.');
});

test('the erase row says what it does in full, and still asks first', async ({ page }) => {
  await quickSetup(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  const row = page.getByRole('button', { name: 'Erase everything and start over' });
  await expect(row).toHaveText('Erase everything and start over');
  await row.click();
  await expect(page.getByRole('dialog')).toBeVisible(); // the one place that asks "are you sure"
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Your plan' })).toBeVisible(); // nothing was erased
});
