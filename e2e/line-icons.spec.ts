/**
 * Line art: one small line icon per line type (bill, yearly, buffer, extra) in payday cards and lists, and line pictures
 * for nothing due, debt-free, the four Find money groups and the ten reads. Inline SVG (works offline), aria-hidden,
 * round strokes like the scene.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { FIXED, quickSetup } from './helpers';
import { READS } from '../src/copy/reads';
import { expectBrandRules, expectNoSidewaysScroll, goTab, runWizard, showPaydays, startPlan, type WizardConfig } from './scenario';

/** Every svg inside is hidden from screen readers, inline, and drawn with round line ends */
async function expectLineArt(where: Locator) {
  const svgs = await where.locator('svg').evaluateAll((els) =>
    els.map((e) => ({
      hidden: e.getAttribute('aria-hidden') === 'true' || e.closest('[aria-hidden="true"]') !== null,
      external: e.querySelector('image, use[href^="http"], use[*|href^="http"]') !== null,
      round: Array.from(e.querySelectorAll('path, circle, rect')).some((p) => (p.getAttribute('stroke-linecap') ?? p.closest('[stroke-linecap]')?.getAttribute('stroke-linecap')) === 'round'),
    })),
  );
  expect(svgs.length).toBeGreaterThan(0);
  for (const s of svgs) expect(s).toEqual({ hidden: true, external: false, round: true });
}

const kinds = (where: Locator) => where.locator('.type-tag .line-icon').evaluateAll((els) => els.map((e) => e.getAttribute('data-kind')));

test.describe('the type icons', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(FIXED);
  });

  test('payday card: Bill and Extra each have their icon; Chapters has all of them', async ({ page }) => {
    await quickSetup(page);
    const card = page.locator('.payday-card');
    expect(await kinds(card)).toEqual(['bill', 'extra']);
    await expect(card.locator('.type-tag')).toHaveText(['Bill', 'Extra']); // the word stays: never the icon alone
    await expectLineArt(card.locator('.type-tag'));
    await goTab(page, 'Path');
    await showPaydays(page, 'Upcoming'); // Chapters, every month open
    const chapters = page.getByTestId('chapters');
    const seen = new Set(await kinds(chapters));
    for (const k of ['bill', 'extra']) expect(seen.has(k)).toBe(true);
    await expectLineArt(chapters.locator('.type-tag'));
  });

  test('a yearly bill and a buffer that is filling show their icons too', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-26T10:00:00'));
    await runWizard(page, { ...AHMED, bufferGoal: '1000', extra: '100' });
    await startPlan(page);
    await goTab(page, 'Safety net');
    await page.getByRole('button', { name: '+ Add a bill' }).click();
    await page.getByRole('dialog').getByLabel('Name').fill('Gifts');
    await page.getByRole('dialog').getByLabel('Cost per year').fill('260');
    await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
    await goTab(page, 'Today');
    const card = page.locator('.payday-card');
    const seen = await kinds(card);
    expect(seen).toContain('buffer');
    expect(seen).toContain('yearly');
  });
});

const AHMED: WizardConfig = {
  frequency: 'Every 2 weeks',
  nextPayday: '2026-11-28',
  debts: [{ name: 'Visa', balance: '2000', apr: '5', min: '70', due: '12' }],
  bufferNow: '0',
  bufferGoal: '500',
  extra: '0',
};

test('nothing due: a line picture in the card, light and dark', async ({ page }) => {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.clock.setFixedTime(new Date('2026-11-26T10:00:00'));
    if (scheme === 'light') {
      await runWizard(page, AHMED);
      await startPlan(page);
    } else await page.reload();
    const card = page.getByTestId('zero-card');
    await expect(card.locator('.line-art[data-art="nothing-due"]')).toBeVisible();
    await expectLineArt(card.locator('.art-head'));
    await expectNoSidewaysScroll(page);
    await expectBrandRules(page);
  }
});

test('Find money: each group has its own line picture', async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
  await quickSetup(page);
  await goTab(page, 'Safety net');
  await page.getByTestId('find-card').click();
  const arts = await page.locator('.find-group .line-art').evaluateAll((els) => els.map((e) => e.getAttribute('data-art')));
  expect(arts).toEqual(['cut', 'sell', 'earn', 'lower']);
  await expectLineArt(page.getByTestId('find-money').locator('.find-group'));
});

async function openRead(page: Page, i: number) {
  await page.getByTestId('read-item').nth(i).click();
  await expect(page.locator('.read-art')).toBeVisible();
}

test('the ten reads: each has its own line picture, hidden from screen readers, in light and dark', async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
  await quickSetup(page);
  await goTab(page, 'Path');
  await page.getByTestId('reads-card').click();
  await expectLineArt(page.getByTestId('read-list'));
  const seen: string[] = [];
  for (let i = 0; i < READS.length; i++) {
    await openRead(page, i);
    const art = page.locator('.read-art');
    await expect(art).toHaveAttribute('aria-hidden', 'true');
    expect(await art.locator('image').count()).toBe(0); // all inline, nothing to download
    seen.push((await art.getAttribute('data-kind'))!);
    await page.goBack();
  }
  expect(new Set(seen).size).toBe(10);
  await page.emulateMedia({ colorScheme: 'dark' });
  await openRead(page, 0);
  await expectBrandRules(page);
});
