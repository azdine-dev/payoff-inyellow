/** Today: the balance chart before and after "I did it", names shown tidy, and a headline that stays inside the sage band. */
import { expect, test } from '@playwright/test';
import { nadiaSetup } from './nadia';
import { NADIA } from './nadia';
import { quickSetup, FIXED } from './helpers';
import { expectBrandRules, runWizard, startPlan, tapDidIt, goTab } from './scenario';

test.describe('the balance chart, payday by payday', () => {
  test('it sits right under the payday card on day one, starting at $3,250 and ending with the flag', async ({ page }) => {
    await nadiaSetup(page);
    const card = page.locator('.payday-card');
    const chart = page.getByTestId('mini-chart');
    await expect(chart).toBeVisible();
    // right under the payday card: nothing sits between them
    const gap = await page.evaluate(() => {
      const a = document.querySelector('.payday-card')!.getBoundingClientRect();
      const b = document.querySelector('[data-testid="mini-chart"]')!.getBoundingClientRect();
      return b.top - a.bottom;
    });
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThan(40);
    await expect(card).toBeVisible();
    await expect(page.getByTestId('mini-start')).toHaveText('You · $3,250');
    await expect(page.getByTestId('mini-end')).toHaveText('Jul 2027 · $0');
    await expect(page.getByTestId('mini-flag')).toHaveCount(1);
    await expect(page.getByTestId('mini-here')).toHaveCount(1);
    await expect(page.getByTestId('mini-paid')).toHaveCount(0);
    await expect(page.getByTestId('mini-line')).toHaveText('Day one. Your line starts here.');
  });

  test('it is still there after "I did it", under the PAID card, with a lower line and a new caption', async ({ page }) => {
    await nadiaSetup(page);
    await tapDidIt(page);
    await expect(page.getByTestId('paid-card')).toBeVisible();
    const chart = page.getByTestId('mini-chart');
    await expect(chart).toHaveCount(1);
    await expect(chart).toBeVisible();
    const gap = await page.evaluate(() => {
      const a = document.querySelector('[data-testid="paid-card"]')!.getBoundingClientRect();
      const b = document.querySelector('[data-testid="mini-chart"]')!.getBoundingClientRect();
      return b.top - a.bottom;
    });
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThan(40);
    await expect(page.getByTestId('mini-line')).toHaveText('Lower than last payday.');
    // "You are here" moved down from $3,250
    const owed = Number((await page.getByTestId('mini-start').textContent() ?? '').replace(/[^0-9]/g, ''));
    expect(owed).toBeLessThan(3250);
    expect(owed).toBeGreaterThan(0);
    await expectBrandRules(page);
    // and after a reload
    await page.reload();
    await expect(page.getByTestId('mini-chart')).toHaveCount(1);
    await expect(page.getByTestId('mini-line')).toHaveText('Lower than last payday.');
  });

  test('paid paydays are yellow dots and the one you are on is highlighted', async ({ page }) => {
    await nadiaSetup(page);
    await tapDidIt(page);
    await expect(page.getByTestId('paid-card')).toBeVisible();
    await page.clock.setFixedTime(new Date('2026-11-20T10:00:00'));
    await page.reload();
    await tapDidIt(page);
    await expect(page.getByTestId('paid-card')).toBeVisible();
    // two paydays done: one earlier yellow dot, and "here" on the second
    await expect(page.getByTestId('mini-paid')).toHaveCount(1);
    await expect(page.getByTestId('mini-paid')).toHaveAttribute('fill', 'var(--yellow)');
    await expect(page.getByTestId('mini-here')).toHaveCount(1);
    await expect(page.getByTestId('mini-line')).toHaveText('Lower than last payday.');
  });

  test('a tap opens Path', async ({ page }) => {
    await nadiaSetup(page);
    await tapDidIt(page);
    await page.getByTestId('mini-chart').click();
    await expect(page.getByRole('heading', { name: 'Your path' })).toBeVisible();
  });
});

test.describe('names on Today', () => {
  test('a first name typed in capitals is shown as Azeddin', async ({ page }) => {
    await page.clock.setFixedTime(FIXED);
    await quickSetup(page, { name: 'AZEDDIN' });
    await expect(page.getByTestId('greeting')).toContainText('Azeddin');
    await expect(page.getByTestId('greeting')).not.toContainText('AZEDDIN');
  });

  test('debt names typed in lower case are shown with a capital letter, on Today and on Debts', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-30T10:00:00'));
    await runWizard(page, { ...NADIA, debts: NADIA.debts.map((d) => ({ ...d, name: d.name.toLowerCase() })) });
    await startPlan(page);
    await expect(page.getByRole('checkbox', { name: /Store card/ })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Focus debt' })).toContainText('Store card');
    await expect(page.getByRole('region', { name: 'Focus debt' })).not.toContainText('store card');
    await goTab(page, 'Debts');
    await expect(page.getByRole('region', { name: 'Store card' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Medical' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Visa' })).toBeVisible();
  });
});

test.describe('the header band', () => {
  test('a long headline stays inside the sage band', async ({ page }) => {
    await page.clock.setFixedTime(FIXED);
    await quickSetup(page, { name: 'Bartholomew' });
    const box = await page.evaluate(() => {
      const band = document.querySelector('.today-head')!.getBoundingClientRect();
      const h1 = document.querySelector('[data-testid="greeting"]')!.getBoundingClientRect();
      return { bandBottom: band.bottom, h1Bottom: h1.bottom, bandBg: getComputedStyle(document.querySelector('.today-head')!).backgroundColor };
    });
    expect(box.h1Bottom).toBeLessThanOrEqual(box.bandBottom - 8);
    expect(box.bandBg).toBe('rgb(216, 231, 220)'); // --calm-band
  });
});
