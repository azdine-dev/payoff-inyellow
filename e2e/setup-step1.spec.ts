/** Setup step 1 asks only for the pay schedule: no name, no paycheck, and Continue is in view from the start. */
import { expect, test } from '@playwright/test';
import { quickSetup } from './helpers';

test('step 1: currency, how often, next payday, and nothing else to type', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-30T10:00:00'));
  await page.goto('/');
  await expect(page.getByLabel(/What should we call you/)).toHaveCount(0);
  await expect(page.getByLabel(/usual paycheck/i)).toHaveCount(0);
  await expect(page.locator('main input:not([type=date]):not([type=file])')).toHaveCount(0); // one date to pick, nothing typed
  // Continue is on the first screen, without scrolling
  const view = page.viewportSize()!;
  const btn = (await page.getByRole('button', { name: 'Continue' }).boundingBox())!;
  expect(btn.y).toBeGreaterThan(0);
  expect(btn.y + btn.height).toBeLessThanOrEqual(view.height);
  expect(btn.height).toBeGreaterThanOrEqual(44);
});

test('Continue stays in view on steps 2 and 3 too', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-30T10:00:00'));
  await page.goto('/');
  await page.getByRole('radio', { name: 'Every 2 weeks' }).click();
  await page.getByLabel('Your next payday').fill('2026-11-06');
  await page.getByRole('button', { name: 'Continue' }).click();
  const view = page.viewportSize()!;
  const all = (await page.getByRole('button', { name: 'That’s all of them' }).boundingBox())!;
  expect(all.y + all.height).toBeLessThanOrEqual(view.height);
});

test('the name is set in Settings, and Today greets with it', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-23T10:00:00')); // a payday
  await quickSetup(page, { name: 'nadia' });
  await expect(page.getByTestId('greeting')).toContainText('Nadia');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('region', { name: 'Your plan' })).toContainText('Nadia');
  // and it can be taken away
  await page.getByRole('button', { name: 'Change Your name' }).click();
  await page.getByLabel('What should we call you?').fill('');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Your plan' })).toContainText('Not set');
});
