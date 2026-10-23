/** ux-v2.md sections 3 and 4: the payday card, the "I did it" moment, the countdown. */
import { expect, test } from '@playwright/test';
import { FIXED, quickSetup } from './helpers';
import { expectBrandRules, tapDidIt } from './scenario';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
});

test('payday card: one total, the extra sentence, and a pill that opens Path', async ({ page }) => {
  await quickSetup(page);
  await expect(page.getByTestId('greeting')).toBeVisible();
  await expect(page.getByTestId('payday-total')).toHaveText('$185');
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

test('I did it: yellow PAID card, then a countdown with a backup nudge', async ({ page }) => {
  await quickSetup(page);
  await tapDidIt(page);
  const card = page.getByTestId('paid-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('PAID');
  await expect(page.getByTestId('after-sentence')).toBeVisible();
  await expect(page.getByTestId('backup-nudge')).toContainText('Save a copy');
  await page.reload();
  await expect(page.getByTestId('countdown-card')).toContainText('Nothing to do until then');
  await expect(page.getByTestId('greeting')).toContainText('Next payday is');
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
  await page.getByRole('button', { name: 'Skip this payday' }).click();
  await expect(page.getByTestId('payday-total')).toBeVisible();
  await expectBrandRules(page);
});
