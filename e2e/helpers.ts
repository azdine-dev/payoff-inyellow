import { expect, type Page } from '@playwright/test';
import { testCode } from './testKey';

export const SHOTS = process.env.SHOTS_DIR;
export const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
};

/** On the result screen: paste a valid unlock code (checked on the phone) so the full planner opens. */
export async function unlockOnResult(page: Page, id = 'TEST-ORDER') {
  await page.getByRole('button', { name: 'I have a code' }).click();
  await page.getByRole('textbox', { name: 'Your unlock code' }).fill(await testCode(id));
  await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start my plan' })).toBeVisible();
}

/**
 * Two debts, buffer already full, no yearly bills, paid every 2 weeks from Fri 23 Oct 2026.
 * By default the planner is unlocked at the end. With { unlock: false } it stops at the
 * calculator result.
 */
export async function quickSetup(page: Page, opts: { unlock?: boolean } = {}) {
  await page.goto('/');
  const next = page.getByRole('button', { name: /^(Continue|Skip for now|See my plan|Let’s start)$/ });
  await next.click();
  await page.getByLabel('Currency').selectOption('USD');
  await next.click();
  await page.getByRole('radio', { name: 'Every 2 weeks' }).click();
  await page.getByLabel('Your next payday').fill('2026-10-23');
  await next.click();
  const debts = [
    { name: 'Visa', balance: '3200', apr: '22.9', min: '96', due: '12' },
    { name: 'Store card', balance: '640', apr: '26.99', min: '35', due: '5' },
  ];
  for (const [i, d] of debts.entries()) {
    if (i > 0) await page.getByRole('button', { name: 'Add another' }).click();
    const card = page.locator('fieldset').last();
    await card.getByLabel('Name').fill(d.name);
    await card.getByLabel('Balance').fill(d.balance);
    await card.getByLabel('Interest rate').fill(d.apr);
    await card.getByLabel('Monthly minimum').fill(d.min);
    await card.getByLabel('Due day (recommended)').fill(d.due);
  }
  await next.click();
  await page.getByLabel('Buffer now').fill('500');
  await next.click();
  await page.getByLabel('Money for the plan each payday').fill('150');
  await next.click();
  await next.click(); // skip yearly bills
  await next.click(); // order
  await next.click(); // fresh start
  await expect(page.getByTestId('debt-free-date')).toBeVisible();
  if (opts.unlock === false) return;
  await unlockOnResult(page);
  await page.getByRole('button', { name: 'Start my plan' }).click();
  await expect(page.getByTestId('debt-free-pill')).toBeVisible();
}

export const FIXED = new Date('2026-10-15T10:00:00');
