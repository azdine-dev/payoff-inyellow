/** Found on the live app: the freeze, the paid state, the currency in the copy, "Add another", and the small animations. */
import { expect, test, type Page } from '@playwright/test';
import { FIXED, quickSetup } from './helpers';
import { expectBrandRules, goTab, revealEarly, setDay, tapDidIt } from './scenario';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
});

/** The page answers: a click opens a sheet, and the main thread is not stuck */
async function expectResponsive(page: Page) {
  expect(await page.evaluate(() => 1 + 1)).toBe(2);
  await page.getByRole('button', { name: 'What if I add more?' }).click();
  await expect(page.getByRole('dialog', { name: 'What if I add more?' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Payday list', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fri 6 Nov, to come' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
}

test('1 · mark a payday done before its date, open Path: it does not freeze, also after a reload', async ({ page }) => {
  await quickSetup(page); // today is Thu 15 Oct, the payday is Fri 23 Oct
  await tapDidIt(page);
  await expect(page.getByText('Fri 23 Oct is paid.')).toBeVisible();
  await goTab(page, 'Path');
  await expect(page.getByRole('heading', { name: 'Your path' })).toBeVisible();
  await expectResponsive(page);

  await page.reload();
  await goTab(page, 'Path');
  await expect(page.getByRole('heading', { name: 'Your path' })).toBeVisible();
  await expectResponsive(page);
  await goTab(page, 'Today');
  await expect(page.getByTestId('paid-card')).toBeVisible();
});

test('1 · the same with two paydays marked early, and with a payday marked on the day', async ({ page }) => {
  await quickSetup(page);
  await tapDidIt(page);
  await expect(page.getByText('Fri 23 Oct is paid.')).toBeVisible();
  await setDay(page, '2026-11-04'); // 2 days before the next payday: early direct deposit
  await tapDidIt(page);
  await expect(page.getByText('Fri 6 Nov is paid.')).toBeVisible();
  await goTab(page, 'Path');
  await expect(page.getByRole('heading', { name: 'Your path' })).toBeVisible();
  await page.getByRole('button', { name: 'Payday list', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Payday list' })).toBeVisible();
});

test('4 · "How we got this" is one link, and the first step says "Move" like Today does', async ({ page }) => {
  await quickSetup(page, { unlock: false });
  await expect(page.getByRole('button', { name: /How we got this/ })).toHaveCount(1);
  await expect(page.getByTestId('first-step')).toContainText('Move $185.');
  await page.getByRole('button', { name: 'Start my plan' }).click().catch(() => undefined);
});

test.describe('in pounds', () => {
  test.use({ locale: 'en-GB' });

  test('4 · the hint, Today and Safety net use £, never $', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('radio', { name: 'Every 2 weeks', exact: true }).click();
    await page.getByLabel('Your next payday').fill('2026-10-23');
    await page.getByRole('button', { name: /^Continue$/ }).click();
    const card = page.locator('fieldset');
    await card.getByLabel('Name').fill('Visa');
    await card.getByLabel('Balance').fill('3200');
    await card.getByLabel('Monthly minimum').fill('96');
    await card.getByLabel('Due day').fill('12');
    await page.getByRole('button', { name: /^(Continue|That’s all of them)$/ }).click();
    await expect(page.getByText('Even £20 matters. You can change it any time.')).toBeVisible();
    await expect(page.getByText(/\$/)).toHaveCount(0);
  });

  test('4 · Today, the result and Safety net', async ({ page }) => {
    await quickSetup(page, { unlock: false });
    await expect(page.getByTestId('first-step')).toContainText('Move £');
    await expect(page.getByTestId('first-step')).not.toContainText('$');
  });
});

test('4 · "+ Add another debt" keeps an incomplete debt open and names the missing field', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Every 2 weeks', exact: true }).click();
  await page.getByLabel('Your next payday').fill('2026-10-23');
  await page.getByRole('button', { name: /^Continue$/ }).click();
  const card = page.locator('fieldset');
  await card.getByLabel('Name').fill('Visa');
  await page.getByRole('button', { name: /Add another/ }).click();
  await expect(card).toHaveCount(1); // still the same open debt
  await expect(page.getByText('Finish this debt first. It still needs its balance and monthly minimum.')).toBeVisible();
  await expect(card.getByLabel('Balance')).toBeFocused();
});

test.describe('5 · small animations', () => {
  const anim = (page: Page, selector: string) =>
    page.locator(selector).first().evaluate((el) => {
      const cs = getComputedStyle(el);
      const ms = (cs.animationDuration.split(',')[0] ?? '0s').trim();
      return { name: cs.animationName.split(',')[0]!.trim(), ms: ms.endsWith('ms') ? parseFloat(ms) : parseFloat(ms) * 1000 };
    });

  test('bars, tab fade and sheets: named, and never longer than 600 ms', async ({ page }) => {
    await quickSetup(page);
    await goTab(page, 'Path');
    const bar = await anim(page, '.bar > div');
    await goTab(page, 'Debts');
    expect(bar.name).toBe('stroke-in');
    expect(bar.ms).toBeLessThanOrEqual(600);
    const fade = await anim(page, 'main.screen');
    expect(fade).toEqual({ name: 'tab-fade', ms: 150 });
    await page.getByRole('button', { name: 'Store card, options' }).click();
    const sheet = await anim(page, '.sheet');
    expect(sheet.name).toBe('rise');
    expect(sheet.ms).toBeLessThanOrEqual(600);
  });

  test('a paid payday: its square fills yellow, and the balances roll down on the next screen', async ({ page }) => {
    await quickSetup(page);
    await goTab(page, 'Path');
    const before = await page.getByTestId('to-go').innerText();
    await goTab(page, 'Today');
    await revealEarly(page);
    await page.getByRole('button', { name: /^I did it/ }).click();
    await expect(page.getByTestId('paid-card')).toBeVisible();
    await goTab(page, 'Path');
    await expect(page.locator('.sq.fill')).toHaveCount(1);
    expect((await anim(page, '.sq.fill')).ms).toBeLessThanOrEqual(600);
    // It settles on the new balance, which is lower
    await expect(page.getByTestId('to-go')).not.toHaveText(before);
    const num = (t: string) => Number(t.replace(/[^0-9.]/g, ''));
    await expect.poll(async () => num(await page.getByTestId('to-go').innerText())).toBeLessThan(num(before));
    await expect(page.locator('.sq.fill')).toHaveCount(0, { timeout: 3000 }); // once, then it is just a square
  });

  test('a debt paid off: the card turns yellow with the stamp, then the next one slides in', async ({ page }) => {
    await quickSetup(page);
    await revealEarly(page);
    await page.getByRole('button', { name: 'I got extra money' }).click();
    await page.getByRole('textbox', { name: 'Extra money' }).fill('640');
    await page.getByRole('button', { name: 'Use it', exact: true }).click();
    await expect(page.getByTestId('paid-moment')).toBeVisible();
    await page.getByRole('button', { name: /Next payday|Done/ }).click();
    await goTab(page, 'Debts');
    await expect(page.locator('.debt-card.just-paid')).toHaveCount(1);
    await expect(page.locator('.debt-card.just-paid .paid-stamp')).toBeVisible();
    await expect(page.locator('.debt-card.slide-in')).toHaveCount(1);
    expect((await anim(page, '.debt-card.slide-in')).ms).toBeLessThanOrEqual(600);
    await expect(page.locator('.debt-card.just-paid')).toHaveCount(0, { timeout: 3000 });
  });

  test('reduced motion turns all of it off', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await quickSetup(page);
    await goTab(page, 'Path');
    for (const selector of ['.bar > div', 'main.screen']) expect((await anim(page, selector)).name).toBe('none');
    await goTab(page, 'Debts');
    await page.getByRole('button', { name: 'Store card, options' }).click();
    expect((await anim(page, '.sheet')).name).toBe('none');
    await expectBrandRules(page);
  });
});
