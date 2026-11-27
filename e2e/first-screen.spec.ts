/** On a payday, "Move" and "I did it" are on the first screen: the debt-free card is one slim line and the button stays above the tab bar. */
import { expect, test } from '@playwright/test';
import { nadiaSetup } from './nadia';
import { expectBrandRules, tapDidIt } from './scenario';

test('the payday card: the total and "I did it" are in view without scrolling', async ({ page }) => {
  await nadiaSetup(page);
  const view = page.viewportSize()!;
  const tabs = (await page.getByRole('navigation', { name: 'Main' }).boundingBox())!;
  const total = (await page.getByTestId('payday-total').boundingBox())!;
  const btn = (await page.getByRole('button', { name: /^I did it/ }).boundingBox())!;
  expect(total.y).toBeGreaterThan(0);
  expect(total.y + total.height).toBeLessThan(tabs.y);
  expect(btn.y).toBeGreaterThan(total.y + total.height); // under the total
  expect(btn.y + btn.height).toBeLessThanOrEqual(tabs.y); // above the tab bar
  expect(btn.y + btn.height).toBeLessThanOrEqual(view.height);
  expect(btn.height).toBeGreaterThanOrEqual(44);
  // the debt-free card is one slim line, with no scene, and still a door
  const pill = page.getByTestId('debt-free-pill');
  await expect(pill.getByTestId('scene')).toHaveCount(0);
  await expect(pill).toContainText('Debt-free in');
  await expect(pill.locator('.hl')).toHaveText('July 2027');
  const p = (await pill.boundingBox())!;
  expect(p.height).toBeGreaterThanOrEqual(44);
  expect(p.height).toBeLessThan(90);
  await expectBrandRules(page);
});

test('scrolled to the end of the card, the button sits in its place under the rows', async ({ page }) => {
  await nadiaSetup(page);
  await page.getByRole('button', { name: 'Skip this payday' }).scrollIntoViewIfNeeded();
  const btn = (await page.getByRole('button', { name: /^I did it/ }).boundingBox())!;
  const lastRow = (await page.locator('.pc-rows > *').last().boundingBox())!;
  const links = (await page.getByRole('button', { name: 'Skip this payday' }).boundingBox())!;
  expect(btn.y).toBeGreaterThanOrEqual(lastRow.y + lastRow.height - 1);
  await expect(page.getByTestId('pay-note')).toHaveCount(0); // the note is for the PAID card only
  expect(links.y).toBeGreaterThanOrEqual(btn.y + btn.height - 1);
});

test('after "I did it" the scene is back, above the PAID card', async ({ page }) => {
  await nadiaSetup(page);
  await tapDidIt(page);
  await expect(page.getByTestId('paid-card')).toBeVisible();
  await expect(page.getByTestId('debt-free-pill').getByTestId('scene')).toBeVisible();
});
