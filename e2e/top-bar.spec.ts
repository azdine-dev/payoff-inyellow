/**
 * Every sub-screen has one sticky top bar: "‹ Path" (or the tab it came from) on the left, at least 44 x 44, and the
 * title in the middle. "‹" and the Android back button (page.goBack) go to the same place.
 */
import { expect, test, type Page } from '@playwright/test';
import { FIXED, quickSetup } from './helpers';
import { expectBrandRules, expectNoSidewaysScroll, goTab } from './scenario';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
});

/** The bar is there, its back button is at least 44 x 44, the title sits in the middle, and it stays at the top when scrolled */
async function checkBar(page: Page, back: string, title: string) {
  const bar = page.getByTestId('top-bar');
  await expect(bar).toHaveCount(1);
  const button = bar.getByRole('button', { name: `Back to ${back}` });
  await expect(button).toBeVisible();
  const b = (await button.boundingBox())!;
  expect(b.width).toBeGreaterThanOrEqual(44);
  expect(b.height).toBeGreaterThanOrEqual(44);
  await expect(bar.locator('.top-title')).toHaveText(title);
  const t = (await bar.locator('.top-title').boundingBox())!;
  const vw = page.viewportSize()!.width;
  expect(Math.abs(t.x + t.width / 2 - vw / 2)).toBeLessThan(24); // in the middle
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect.poll(async () => Math.round((await bar.boundingBox())!.y)).toBe(0); // still at the top
  await page.evaluate(() => window.scrollTo(0, 0));
  await expectNoSidewaysScroll(page);
  await expectBrandRules(page);
}

test('Your whole plan: "‹ Path", and back does the same', async ({ page }) => {
  await quickSetup(page);
  await goTab(page, 'Path');
  await page.getByTestId('whole-plan-card').click();
  await checkBar(page, 'Path', 'Your whole plan');
  await page.getByRole('button', { name: 'Back to Path' }).click();
  await expect(page.getByTestId('whole-plan-card')).toBeVisible();
  await page.getByTestId('whole-plan-card').click();
  await page.goBack(); // Android back
  await expect(page.getByTestId('whole-plan')).toHaveCount(0);
  await expect(page.getByTestId('whole-plan-card')).toBeVisible();
});

test('Preview from Path goes back to Path; from the debt-free card on Today it goes back to Today', async ({ page }) => {
  await quickSetup(page);
  await goTab(page, 'Path');
  await page.getByTestId('look-ahead').getByRole('button', { name: 'Look ahead to March 2027' }).click();
  await checkBar(page, 'Path', 'Preview');
  await page.goBack();
  await expect(page.getByTestId('path-preview')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Your path' })).toBeVisible();

  await goTab(page, 'Today');
  await page.getByTestId('debt-free-pill').click();
  await checkBar(page, 'Today', 'Preview');
  await page.getByRole('button', { name: 'Back to Today' }).click();
  await expect(page.getByTestId('debt-free-pill')).toBeVisible();
  await page.getByTestId('debt-free-pill').click();
  await expect(page.getByTestId('path-preview')).toBeVisible();
  await page.goBack(); // Android back: the same
  await expect(page.getByTestId('debt-free-pill')).toBeVisible();
  await expect(page.getByTestId('path-preview')).toHaveCount(0);
});

test('Short reads and a read: "‹ Path", then "‹ Short reads"', async ({ page }) => {
  await quickSetup(page);
  await goTab(page, 'Path');
  await page.getByTestId('reads-card').click();
  await checkBar(page, 'Path', 'Short reads');
  await page.getByTestId('read-item').first().click();
  await checkBar(page, 'Short reads', 'Short read');
  await expect(page.locator('h1')).toHaveCount(1); // the read's own title is the heading
  await page.goBack(); // closes the read, the list is under it
  await expect(page.getByTestId('read-screen')).toBeVisible();
  await page.getByRole('button', { name: 'Back to Path' }).click();
  await expect(page.getByRole('heading', { name: 'Your path' })).toBeVisible();
});

test('a read opened from the card on Today: "‹ Today"', async ({ page }) => {
  await quickSetup(page);
  await page.getByTestId('today-read').click();
  await checkBar(page, 'Today', 'Short read');
  await page.goBack();
  await expect(page.getByTestId('debt-free-pill')).toBeVisible();
});

test('the bar in dark mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await quickSetup(page);
  await goTab(page, 'Path');
  await page.getByTestId('whole-plan-card').click();
  await checkBar(page, 'Path', 'Your whole plan');
});
