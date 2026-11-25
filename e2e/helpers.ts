import { expect, type Page } from '@playwright/test';
import { testCode } from './testKey';

export const SHOTS = process.env.SHOTS_DIR;
export const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
};

/** The buffer fields on the money step sit inside a collapsed "change" section: open it once. */
export async function openBufferFields(page: Page) {
  if (!(await page.getByLabel('Buffer now').isVisible())) await page.getByText('Change what you have set aside or the goal').click();
}

/** On the result screen: paste a valid unlock code (checked on the phone) so the full planner opens. */
export async function unlockOnResult(page: Page, id = 'TEST-ORDER') {
  const box = page.getByRole('textbox', { name: 'Your unlock code' });
  if (!(await box.isVisible())) await page.getByRole('button', { name: 'I have a code' }).click(); // Etsy buyers see the box straight away
  await box.fill(await testCode(id));
  await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start my plan' })).toBeVisible();
}

/**
 * Two debts, buffer already full, no yearly bills, paid every 2 weeks from Fri 23 Oct 2026 (the four setup steps).
 * By default the planner is unlocked at the end. With { unlock: false } it stops at the
 * calculator result.
 */
export async function quickSetup(page: Page, opts: { unlock?: boolean; name?: string; each?: (page: Page) => Promise<void> } = {}) {
  await page.goto('/');
  const each = async () => {
    if (opts.each) await opts.each(page); // a check on every setup screen
  };
  await each();
  const next = page.getByRole('button', { name: /^(Continue|That’s all of them|See my plan)$/ });
  // 1 Pay (the welcome words are on top of it)
  await page.getByRole('radio', { name: 'Every 2 weeks' }).click();
  await page.getByLabel('Your next payday').fill('2026-10-23');
  await next.click();
  // 2 Debts: the debt in front of you is the only one open
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
    await card.getByLabel('Due day').fill(d.due);
  }
  await each();
  await next.click();
  // 3 Money
  await page.getByLabel('Money for the plan each payday').fill('150');
  await openBufferFields(page);
  await page.getByLabel('Buffer now').fill('500');
  await each();
  await next.click();
  // 4 Your date
  await expect(page.getByTestId('debt-free-date')).toBeVisible();
  await each();
  if (opts.unlock === false) return;
  await unlockOnResult(page);
  await page.getByRole('button', { name: 'Start my plan' }).click();
  await expect(page.getByTestId('debt-free-pill')).toBeVisible();
  if (opts.name) {
    // the name is not asked in setup: it lives in Settings
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Change Your name' }).click();
    await page.getByLabel('What should we call you?').fill(opts.name);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('button', { name: 'Back to Today' }).click();
  }
}

export const FIXED = new Date('2026-10-15T10:00:00');
