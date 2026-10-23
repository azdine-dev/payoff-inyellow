/**
 * Before the payday Today counts down, with a small "Mark it done early" link and no question asked.
 * "I did it" can be undone for 10 seconds, and Today stays in the paid state until the next payday.
 */
import { expect, test } from '@playwright/test';
import { FIXED, quickSetup } from './helpers';
import { goTab, revealEarly, showPaydays } from './scenario';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED); // Thu 15 Oct 2026, the payday is Fri 23 Oct
});

const didIt = (page: import('@playwright/test').Page) => page.getByRole('button', { name: /^I did it/ });

test('no question is asked, and Undo covers a mistake', async ({ page }) => {
  await quickSetup(page);
  await didIt(page).click(); // a new user has the card in front of them: no link to press first
  await expect(page.getByRole('dialog')).toHaveCount(0); // no confirm dialog
  await expect(page.getByText('Fri 23 Oct is paid.')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Fri 23 Oct is paid.')).toHaveCount(0);
  await expect(page.getByTestId('payday-total')).toBeVisible(); // nothing is done yet, so the card is back
});

test('after "I did it" Today stays paid until the next payday, after a tab change and a reload', async ({ page }) => {
  await quickSetup(page);
  await revealEarly(page);
  await didIt(page).click();
  await expect(page.getByTestId('paid-card')).toBeVisible();

  for (const how of ['tab', 'reload'] as const) {
    if (how === 'tab') {
      await goTab(page, 'Debts');
      await goTab(page, 'Today');
    } else await page.reload();
    await expect(page.getByTestId('paid-card')).toBeVisible();
    await expect(page.getByTestId('paid-card')).toContainText('PAID');
    await expect(page.getByTestId('greeting')).toHaveText('Done for this payday.');
    await expect(page.getByTestId('countdown-card')).toBeVisible();
    await expect(didIt(page)).toHaveCount(0); // never a new active button straight away
  }
});

test('Undo puts the balances, the payday and the logs back', async ({ page }) => {
  await quickSetup(page);

  const owed = async () => {
    await goTab(page, 'Progress');
    await page.waitForTimeout(400); // the number rolls for 200 ms
    const text = await page.getByTestId('to-go').innerText();
    await goTab(page, 'Today');
    return text;
  };
  const before = await owed();

  await revealEarly(page);
  await didIt(page).click();
  await expect(page.getByText('Fri 23 Oct is paid.')).toBeVisible();
  expect(await owed()).not.toBe(before); // the balances moved

  // Pay the next payday early too, to get an Undo again
  await page.getByRole('button', { name: 'Mark it done early' }).click();
  await didIt(page).click();
  await expect(page.getByText('Fri 6 Nov is paid.')).toBeVisible();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Fri 6 Nov is paid.')).toHaveCount(0);
  await expect(page.getByText('Fri 23 Oct is paid.')).toBeVisible(); // the first one stays paid
  await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
  await goTab(page, 'Plan');
  await showPaydays(page, 'Done');
  await expect(page.getByRole('button', { name: 'Fri 23 Oct, paid' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fri 6 Nov, paid' })).toHaveCount(0);
  await showPaydays(page, 'Upcoming');
  await expect(page.getByRole('button', { name: 'Fri 6 Nov, to come' })).toBeVisible();
});

test('Undo stays for 10 seconds, then it is gone', async ({ page }) => {
  await quickSetup(page);
  await revealEarly(page);
  await didIt(page).click();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0, { timeout: 13_000 });
});
