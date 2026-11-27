/** The ten read pictures: each one stands on the hill, in the one style, with no red and no sideways scroll. */
import { expect, test } from '@playwright/test';
import { nadiaSetup } from './nadia';
import { expectBrandRules, expectNoSidewaysScroll, goTab } from './scenario';

test('every read picture is there, grounded, and inside the screen', async ({ page }) => {
  await nadiaSetup(page);
  await goTab(page, 'Path');
  await page.getByTestId('reads-card').click();
  const n = await page.getByTestId('read-item').count();
  expect(n).toBe(10);
  const kinds = new Set<string>();
  for (let i = 0; i < n; i++) {
    await page.getByTestId('read-item').nth(i).click();
    const art = page.locator('svg.read-art');
    await expect(art).toBeVisible();
    await expect(art.locator('.rd-shadow')).toHaveCount(1);
    await expect(art.locator('.rd-grass')).toHaveCount(1);
    kinds.add((await art.getAttribute('data-kind'))!);
    const box = (await art.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390.5);
    await page.getByRole('button', { name: 'Back to Short reads' }).click();
    await expect(page.getByTestId('read-list')).toBeVisible();
  }
  expect(kinds.size).toBe(10); // ten reads, ten different pictures
  await expectBrandRules(page);
  await expectNoSidewaysScroll(page);
});
