/** Safety net: one "Change" row for the goal, the amount set aside and the history. */
import { expect, test } from '@playwright/test';
import { nadiaSetup } from './nadia';
import { expectBrandRules, expectNoSidewaysScroll, goTab } from './scenario';

test('the buffer card has one main button and one Change row', async ({ page }) => {
  await nadiaSetup(page);
  await goTab(page, 'Safety net');
  const card = page.getByRole('region', { name: 'Surprise buffer' });
  await expect(card.getByRole('button', { name: 'I used some of it' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Change my goal' })).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Update amount set aside' })).toHaveCount(0);
  await expect(card.locator('details')).toHaveCount(0);
  const row = page.getByTestId('buffer-change');
  const box = (await row.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThanOrEqual(280); // the whole row is the button
  await expectBrandRules(page);
  await expectNoSidewaysScroll(page);
});

test('the sheet changes the goal and the amount set aside, and holds the history', async ({ page }) => {
  await nadiaSetup(page);
  await goTab(page, 'Safety net');
  await page.getByTestId('buffer-change').click();
  const sheet = page.getByRole('dialog', { name: 'Surprise buffer' });
  await sheet.getByLabel('Buffer goal').fill('800');
  await sheet.getByLabel('Amount set aside').fill('250');
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('buffer-amount')).toHaveText('$250');
  await expect(page.getByRole('region', { name: 'Surprise buffer' })).toContainText('of $800');

  await page.getByTestId('buffer-change').click();
  await expect(page.getByTestId('buffer-history')).toContainText('+$50 · Updated');
  await page.goBack(); // the Android back button closes it
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Safety net' })).toBeVisible();
});

test('an empty amount is asked for once and nothing is saved', async ({ page }) => {
  await nadiaSetup(page);
  await goTab(page, 'Safety net');
  const before = await page.getByTestId('buffer-amount').innerText();
  await page.getByTestId('buffer-change').click();
  const sheet = page.getByRole('dialog', { name: 'Surprise buffer' });
  await sheet.getByLabel('Amount set aside').fill('');
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(sheet).toContainText('Type an amount, like 50.');
  await sheet.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByTestId('buffer-amount')).toHaveText(before);
});
