/** The Android back button and the swipe back close the sub-screen you are on (browser history), and back buttons are at least 44 x 44. */
import { expect, test, type Locator } from '@playwright/test';
import { nadiaSetup } from './nadia';
import { goTab, tapDidIt } from './scenario';

const size = async (l: Locator) => {
  const b = (await l.boundingBox())!;
  return { w: Math.round(b.width), h: Math.round(b.height) };
};

test.describe('the back button closes the sub-screen on top', () => {
  test('a sheet', async ({ page }) => {
    await nadiaSetup(page);
    await goTab(page, 'Path');
    await page.getByRole('button', { name: 'More options' }).click();
    await expect(page.getByRole('dialog', { name: 'More options' })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Your path' })).toBeVisible(); // still in the app
  });

  test('Whole plan', async ({ page }) => {
    await nadiaSetup(page);
    await goTab(page, 'Path');
    await page.getByTestId('whole-plan-card').click();
    await expect(page.getByTestId('whole-plan')).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId('whole-plan')).toHaveCount(0);
    await expect(page.getByTestId('whole-plan-card')).toBeVisible();
  });

  test('Preview', async ({ page }) => {
    await nadiaSetup(page);
    await goTab(page, 'Path');
    await page.getByTestId('look-ahead').getByRole('button', { name: 'Look ahead to March 2027' }).click();
    await expect(page.getByTestId('preview-banner')).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId('preview-banner')).toHaveCount(0);
    await expect(page.getByTestId('look-ahead')).toBeVisible();
  });

  test('a read, then the reads, one back press each', async ({ page }) => {
    await nadiaSetup(page);
    await goTab(page, 'Path');
    await page.getByTestId('reads-card').click();
    await expect(page.getByTestId('read-list')).toBeVisible();
    await page.getByTestId('read-item').first().click();
    await expect(page.getByTestId('read')).toBeVisible();
    await page.goBack(); // the read closes, the list is under it
    await expect(page.getByTestId('read')).toHaveCount(0);
    await expect(page.getByTestId('read-list')).toBeVisible();
    await page.goBack(); // the reads close, back on Path
    await expect(page.getByTestId('read-list')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Your path' })).toBeVisible();
  });

  test('a read opened from the card on Today: one back press comes home', async ({ page }) => {
    await nadiaSetup(page);
    await tapDidIt(page);
    await page.getByTestId('today-read').click();
    await expect(page.getByTestId('read')).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId('read')).toHaveCount(0);
    await expect(page.getByTestId('today-read')).toBeVisible();
  });

  test('Settings comes home to Today', async ({ page }) => {
    await nadiaSetup(page);
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Settings' })).toHaveCount(0);
    await expect(page.getByTestId('debt-free-pill')).toBeVisible();
  });

  test('a sheet inside a sheet closes one at a time', async ({ page }) => {
    await nadiaSetup(page);
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Open About and disclaimer' }).click();
    await expect(page.getByRole('dialog', { name: 'About and disclaimer' })).toBeVisible();
    await page.goBack(); // the sheet closes, Settings is still there
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await page.goBack(); // and then Settings
    await expect(page.getByRole('heading', { name: 'Settings' })).toHaveCount(0);
  });

  test('closed with its own button, no entry is left behind: the next back press leaves the app, not a ghost screen', async ({ page }) => {
    await nadiaSetup(page);
    await goTab(page, 'Path');
    await page.getByTestId('whole-plan-card').click();
    await page.getByRole('button', { name: 'Back to Path' }).click();
    await expect(page.getByTestId('whole-plan')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => history.state)).toBeNull();
    // one sheet opened and closed with its own button too
    await page.getByRole('button', { name: 'More options' }).click();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect.poll(() => page.evaluate(() => history.state)).toBeNull();
  });
});

test.describe('back buttons are at least 44 x 44', () => {
  test('Whole plan, Preview, the reads, a read, Settings and the calendar arrows', async ({ page }) => {
    await nadiaSetup(page);
    await goTab(page, 'Path');
    await page.getByRole('button', { name: 'Calendar', exact: true }).click();
    for (const name of ['Previous month', 'Next month']) {
      const s = await size(page.getByRole('button', { name }));
      expect(s.w, name).toBeGreaterThanOrEqual(44);
      expect(s.h, name).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('button', { name: 'Road', exact: true }).click();
    await page.getByTestId('whole-plan-card').click();
    let s = await size(page.getByRole('button', { name: 'Back to Path' }));
    expect(s.w).toBeGreaterThanOrEqual(44);
    expect(s.h).toBeGreaterThanOrEqual(44);
    await page.getByRole('button', { name: 'Back to Path' }).click();
    await page.getByTestId('look-ahead').getByRole('button', { name: 'Look ahead to March 2027' }).click();
    s = await size(page.getByRole('button', { name: 'Back to Path' }));
    expect(s.w).toBeGreaterThanOrEqual(44);
    expect(s.h).toBeGreaterThanOrEqual(44);
    await page.getByRole('button', { name: 'Back to Path' }).click();
    await page.getByTestId('reads-card').click();
    s = await size(page.locator('.top-back'));
    expect(s.w).toBeGreaterThanOrEqual(44);
    expect(s.h).toBeGreaterThanOrEqual(44);
    await page.getByTestId('read-item').first().click();
    s = await size(page.locator('.top-back'));
    expect(s.w).toBeGreaterThanOrEqual(44);
    expect(s.h).toBeGreaterThanOrEqual(44);
    await page.goBack(); // the read, then the reads
    await page.goBack();
    await goTab(page, 'Today');
    await page.getByRole('button', { name: 'Settings' }).click();
    s = await size(page.getByRole('button', { name: 'Back to Today' }));
    expect(s.w).toBeGreaterThanOrEqual(44);
    expect(s.h).toBeGreaterThanOrEqual(44);
  });

  test('the back button of the setup steps', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-30T10:00:00'));
    await page.goto('/');
    await page.getByRole('radio', { name: 'Every 2 weeks' }).click();
    await page.getByLabel('Your next payday').fill('2026-11-06');
    await page.getByRole('button', { name: 'Continue' }).click();
    const s = await size(page.getByRole('button', { name: 'Back', exact: true }));
    expect(s.w).toBeGreaterThanOrEqual(44);
    expect(s.h).toBeGreaterThanOrEqual(44);
  });
});
