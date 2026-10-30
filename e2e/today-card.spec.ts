/** When Today shows the full card, and "Change what I paid" on the yellow card. */
import { expect, test } from '@playwright/test';
import { FIXED, quickSetup } from './helpers';
import { expectBrandRules, goTab } from './scenario';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED); // Thu 15 Oct 2026, the first payday is Fri 23 Oct
});

const didIt = (page: import('@playwright/test').Page) => page.getByRole('button', { name: /^I did it/ });

test('a new user, no link to press: setup, the card, I did it, PAID', async ({ page }) => {
  await quickSetup(page);
  await expect(page.getByTestId('payday-total')).toHaveText('$185'); // the card, although the payday is 8 days away
  await expect(page.getByTestId('countdown-card')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mark it done early' })).toHaveCount(0);
  await didIt(page).click();
  await expect(page.getByTestId('paid-card')).toContainText('PAID');
  await expect(page.getByText('Fri 23 Oct is paid.')).toBeVisible();
  await expectBrandRules(page);
});

test('after the first one: a countdown, but the card again when the payday is 2 days away or less', async ({ page }) => {
  await quickSetup(page);
  await didIt(page).click();
  await expect(page.getByTestId('paid-card')).toBeVisible();

  // Fri 6 Nov is the next payday: 3 days away is still a countdown
  await page.clock.setFixedTime(new Date('2026-11-03T10:00:00'));
  await page.reload();
  await expect(page.getByTestId('countdown-card')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark it done early' })).toBeVisible(); // a small link, no question
  await expect(didIt(page)).toHaveCount(0);

  // 2 days away: early direct deposit, so the card is there
  await page.clock.setFixedTime(new Date('2026-11-04T10:00:00'));
  await page.reload();
  await expect(page.getByTestId('countdown-card')).toHaveCount(0);
  await expect(didIt(page)).toBeVisible();
});

test('"Change what I paid" redoes the payday with another amount, and stays until the next payday', async ({ page }) => {
  await quickSetup(page);
  await expect(page.getByTestId('change-paid')).toHaveCount(0); // nothing paid yet
  await didIt(page).click();
  const total = async () => (await page.getByTestId('paid-total').innerText()).replace(/[^0-9.]/g, '');
  const was = await total();
  await expect(page.getByTestId('change-paid')).toBeVisible();

  await page.getByTestId('change-paid').click();
  const sheet = page.getByRole('dialog', { name: 'I got a different amount' });
  await expect(sheet.getByRole('textbox', { name: 'Money for the plan this payday' })).toHaveValue('150');
  await sheet.getByRole('textbox', { name: 'Money for the plan this payday' }).fill('60');
  await sheet.getByRole('button', { name: 'Update this payday' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByTestId('paid-card')).toContainText('PAID');
  await expect.poll(total).not.toBe(was); // 90 less went to the plan
  expect(Number(await total())).toBe(Number(was) - 90);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible(); // the 10 second Undo is still there

  // Still one payday done, and it survives a reload with the link
  await page.reload();
  await expect(page.getByTestId('change-paid')).toBeVisible();
  await goTab(page, 'Path');
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await page.getByRole('button', { name: 'Done (1)' }).click();
  await expect(page.getByRole('button', { name: 'Fri 23 Oct, paid' })).toHaveCount(1);
});

test('"Change what I paid" goes away once something else moved the balances', async ({ page }) => {
  await quickSetup(page);
  await didIt(page).click();
  await expect(page.getByTestId('paid-card')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('change-paid')).toBeVisible();
  await page.getByRole('button', { name: 'I got extra money' }).click();
  await page.getByRole('textbox', { name: 'Extra money' }).fill('10');
  await page.getByRole('button', { name: 'Use it', exact: true }).click();
  await expect(page.getByTestId('change-paid')).toHaveCount(0);
});
