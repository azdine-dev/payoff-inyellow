/**
 * The Settings button: the same button, in the same top-right spot, on all four tabs, and still there after scrolling.
 * (It used to live in Today's header only, so Path, Debts and Safety net had none, and it scrolled away with Today.)
 */
import { expect, test, type Page } from '@playwright/test';
import { FIXED, quickSetup } from './helpers';
import { expectBrandRules, goTab } from './scenario';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
});

const TABS = ['Today', 'Path', 'Debts', 'Safety net'] as const;
const gear = (page: Page) => page.getByRole('button', { name: 'Settings', exact: true });

async function spot(page: Page) {
  await expect(gear(page)).toHaveCount(1);
  await expect(gear(page)).toBeVisible();
  const b = (await gear(page).boundingBox())!;
  return { x: Math.round(b.x), y: Math.round(b.y), w: b.width, h: b.height };
}

for (const t of TABS) {
  test(`${t}: the Settings button is top right, at least 44 x 44, stays there when scrolled, and opens Settings`, async ({ page }) => {
    await quickSetup(page);
    const home = await spot(page); // Today: where it always is
    await goTab(page, t);
    const here = await spot(page);
    expect(here).toEqual(home); // the same spot on every tab
    expect(here.w).toBeGreaterThanOrEqual(44);
    expect(here.h).toBeGreaterThanOrEqual(44);
    expect(here.x + here.w).toBeGreaterThan(page.viewportSize()!.width - 40); // top right
    expect(here.y).toBeLessThan(40);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(async () => (await spot(page)).y).toBe(here.y); // still there
    // nothing important sits under it: the words of the topmost heading end before it
    await page.evaluate(() => window.scrollTo(0, 0));
    const right = await page.locator('main h1').first().evaluate((el) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      return Math.max(...Array.from(r.getClientRects()).map((x) => x.right));
    });
    expect(right).toBeLessThanOrEqual(here.x + 1);
    await expectBrandRules(page);
    await gear(page).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(gear(page)).toHaveCount(0); // not on Settings itself
  });

  test(`${t}: Settings goes back to ${t}, with "‹ ${t}" and with the Android back button`, async ({ page }) => {
    await quickSetup(page);
    await goTab(page, t);
    await gear(page).click();
    const back = page.getByTestId('top-bar').getByRole('button', { name: `Back to ${t}` });
    await expect(back).toBeVisible();
    await expect(page.getByTestId('top-bar').locator('.top-title')).toHaveText('Settings');
    await back.click();
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: t, exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(gear(page)).toBeVisible();
    await gear(page).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await page.goBack(); // Android back
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: t, exact: true })).toHaveAttribute('aria-current', 'page');
  });
}

test('in dark mode and on a laptop it is in the same place on every tab', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await quickSetup(page);
  const home = await spot(page);
  for (const t of TABS) {
    await goTab(page, t);
    expect(await spot(page)).toEqual(home);
  }
});

test('a sub-screen has its top bar instead: "‹ Path" on the left, no Settings button over it', async ({ page }) => {
  await quickSetup(page);
  await goTab(page, 'Path');
  await page.getByTestId('whole-plan-card').click();
  await expect(page.getByTestId('top-bar')).toBeVisible();
  await expect(gear(page)).toHaveCount(0);
  await page.goBack();
  await expect(gear(page)).toBeVisible();
});
