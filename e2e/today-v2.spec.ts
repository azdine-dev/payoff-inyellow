/** ux-v2.md sections 3 and 4: the payday card, the "I did it" moment, the countdown. */
import { expect, test } from '@playwright/test';
import { FIXED, quickSetup } from './helpers';
import { expectBrandRules, revealEarly, tapDidIt } from './scenario';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
});

test('before the payday Today counts down, and the payday card opens from "Mark it done early"', async ({ page }) => {
  await quickSetup(page);
  await expect(page.getByTestId('countdown-card')).toContainText('Nothing to do until then');
  await expect(page.getByRole('button', { name: /^I did it/ })).toHaveCount(0);
  await expect(page.getByTestId('greeting')).toHaveText('Next payday is Fri 23 Oct.');
  await revealEarly(page);
  await expect(page.getByTestId('payday-total')).toHaveText('$185');
  await expect(page.locator('.pc-move')).toHaveText('Move'); // "Move $185", the same words as the result screen
  await expect(page.getByTestId('extra-sentence')).toContainText('The extra $150 goes to Store card');
  await expectBrandRules(page);
  await page.getByTestId('debt-free-pill').click();
  await expect(page.getByRole('button', { name: 'Path', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('the safety tile opens Safety net', async ({ page }) => {
  await quickSetup(page);
  await page.getByTestId('safety-tile').click();
  await expect(page.getByRole('heading', { name: 'Safety net' })).toBeVisible();
});

test('I did it: yellow PAID card, a countdown, a backup nudge, and it stays after a reload', async ({ page }) => {
  await quickSetup(page);
  await tapDidIt(page);
  const card = page.getByTestId('paid-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('PAID');
  await expect(page.getByTestId('after-sentence')).toBeVisible();
  await expect(page.getByTestId('backup-nudge')).toContainText('Save a copy');
  await page.reload();
  await expect(page.getByTestId('paid-card')).toBeVisible();
  await expect(page.getByTestId('countdown-card')).toContainText('Nothing to do until then');
  await expect(page.getByTestId('greeting')).toHaveText('Done for this payday.');
});

test('reduced motion: the card is done at once, with no animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await quickSetup(page);
  await tapDidIt(page);
  await expect(page.getByTestId('paid-card')).toBeVisible();
  const anim = await page.getByText('PAID', { exact: true }).first().evaluate((el) => getComputedStyle(el.closest('.paid-stamp') ?? el).animationName);
  expect(anim).toBe('none');
});

test('skip this payday is calm and moves the date', async ({ page }) => {
  await quickSetup(page);
  await revealEarly(page);
  await page.getByRole('button', { name: 'Skip this payday' }).click();
  await expect(page.getByTestId('payday-total')).toBeVisible();
  await expectBrandRules(page);
});
