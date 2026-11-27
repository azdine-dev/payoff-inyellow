/** Today: the "Do these later" card sits under Coming up (when there is one), never between the payday card and the read. */
import { expect, test } from '@playwright/test';
import { FIXED, quickSetup } from './helpers';
import { expectBrandRules, expectNoSidewaysScroll, tapDidIt } from './scenario';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
});

test('"Do these later" comes after the read and after Coming up', async ({ page }) => {
  await quickSetup(page);
  const y = async (id: string) => (await page.getByTestId(id).first().boundingBox())!.y;
  const later = await y('later-card');
  // nothing is due in the next 14 days here, so there is no Coming up card above it (see today-extra for one that shows)
  await expect(page.getByRole('region', { name: 'Coming up' })).toHaveCount(0);
  expect(later).toBeGreaterThan(await y('today-read'));
  expect(later).toBeLessThan(await y('safety-tile'));
  await expect(page.getByTestId('later-card')).toHaveCount(1);
  await expectBrandRules(page);
  await expectNoSidewaysScroll(page);
});

test('it stays out of the way right after "I did it"', async ({ page }) => {
  await quickSetup(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await tapDidIt(page);
  await expect(page.getByTestId('paid-card')).toBeVisible();
  await expect(page.getByTestId('later-card')).toHaveCount(0);
});
