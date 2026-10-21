/**
 * "I did it" can be undone until the next tap, and a payday that hasn't come yet is asked about once.
 */
import { expect, test } from '@playwright/test';
import { FIXED, quickSetup } from './helpers';
import { goTab } from './scenario';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED); // Thu 15 Oct 2026, the payday is Fri 23 Oct
});

const didIt = (page: import('@playwright/test').Page) => page.getByRole('button', { name: /^I did it/ });

test('a payday that is still ahead is asked about once, and "Not yet" changes nothing', async ({ page }) => {
  await quickSetup(page);
  await didIt(page).click();
  const dialog = page.getByRole('dialog', { name: 'Mark it done now?' });
  await expect(dialog).toContainText('Your payday is Fri 23 Oct.');
  await dialog.getByRole('button', { name: 'Not yet' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Fri 23 Oct is paid.')).toHaveCount(0);
  await expect(didIt(page)).toBeVisible();

  // Yes marks it done, and a later payday of the same kind is not asked again for this one
  await didIt(page).click();
  await dialog.getByRole('button', { name: 'Yes, mark it done' }).click();
  await expect(page.getByText('Fri 23 Oct is paid.')).toBeVisible();
});

test('Undo puts the balances, the payday and the logs back, and goes away after the next tap', async ({ page }) => {
  await quickSetup(page);

  const owed = async () => {
    await goTab(page, 'Progress');
    const text = await page.getByText(/still owed/).locator('xpath=preceding-sibling::p[1]').innerText();
    await goTab(page, 'Today');
    return text;
  };
  const before = await owed();

  await didIt(page).click();
  await page.getByRole('button', { name: 'Yes, mark it done' }).click();
  await expect(page.getByText('Fri 23 Oct is paid.')).toBeVisible();
  expect(await owed()).not.toBe(before); // the balances moved

  // Back to Today: the banner is gone with the tab, so pay again to get an Undo
  await goTab(page, 'Plan');
  await goTab(page, 'Today');
  await expect(page.getByText('Fri 6 Nov')).toBeVisible(); // the next payday
  await didIt(page).click();
  await page.getByRole('button', { name: 'Yes, mark it done' }).click();
  await expect(page.getByText('Fri 6 Nov is paid.')).toBeVisible();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Fri 6 Nov is paid.')).toHaveCount(0);
  await expect(page.getByText('Fri 6 Nov')).toBeVisible(); // it is the next payday again
  await expect(didIt(page)).toBeVisible();

  // Undo again is not possible, and a second payday log was not left behind
  await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
  await goTab(page, 'Plan');
  await expect(page.getByRole('button', { name: 'Fri 23 Oct, paid' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fri 6 Nov, paid' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Fri 6 Nov, to come' })).toBeVisible();
});

test('Undo is gone after another tap', async ({ page }) => {
  await quickSetup(page);
  await didIt(page).click();
  await page.getByRole('button', { name: 'Yes, mark it done' }).click();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
  await page.getByRole('button', { name: '+ Extra payment' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
});
