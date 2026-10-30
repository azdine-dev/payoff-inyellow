/** ux-v2.md sections 5, 6 and 7: Path, Debts and Safety net. */
import { expect, test } from '@playwright/test';
import { FIXED, quickSetup } from './helpers';
import { expectBrandRules, goTab } from './scenario';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
});

test('Path: the progress card, the payday grid, what is ahead and the two buttons', async ({ page }) => {
  await quickSetup(page);
  await goTab(page, 'Path');
  await expect(page.getByRole('heading', { name: 'Your path' })).toBeVisible();
  await expect(page.getByTestId('pct-gone')).toHaveText('0%');
  await expect(page.getByTestId('interest-avoided')).toBeVisible();

  // Ten squares a row; two are pre-filled; the next payday is an outline
  const cols = await page.locator('.payday-grid').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(cols).toBe(10);
  await expect(page.locator('.payday-grid .sq.on')).toHaveCount(2);
  await expect(page.locator('.payday-grid .sq.current')).toHaveCount(1);

  // Milestones only: a debt gone, halfway, debt-free (the last one on yellow)
  const ahead = page.getByTestId('whats-ahead');
  await expect(ahead).toContainText('Store card gone');
  await expect(ahead).toContainText('Halfway there');
  await expect(ahead).toContainText('Debt-free');
  await expect(ahead).toContainText('around'); // months, never fake precision, for what is far away
  await expect(page.getByRole('button', { name: 'What if I add more?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Payday list', exact: true })).toBeVisible();
  await expect(page.getByText('Order: smallest first')).toBeVisible();
  await expectBrandRules(page);
});

test('Path: what-if and the payday list are bottom sheets, and "Use this in my plan" moves the date', async ({ page }) => {
  await quickSetup(page);
  await goTab(page, 'Path');
  const before = await page.getByTestId('status-line').innerText();

  await page.getByRole('button', { name: 'What if I add more?' }).click();
  const sheet = page.getByRole('dialog', { name: 'What if I add more?' });
  await sheet.getByLabel('Add money each payday').fill('100');
  await expect(sheet.getByTestId('whatif-result')).toContainText('sooner');
  await sheet.getByRole('button', { name: 'Use this in my plan' }).click();
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByTestId('status-line')).not.toHaveText(before);

  // Payday list: tap a payday and it opens in place
  await page.getByRole('button', { name: 'Payday list', exact: true }).click();
  await page.getByRole('button', { name: 'Fri 23 Oct, to come' }).click();
  await expect(page.getByRole('group', { name: 'Fri 23 Oct details' })).toContainText('Total');
  await page.getByRole('button', { name: 'Fri 23 Oct, to come' }).click();
  await expect(page.getByRole('group', { name: 'Fri 23 Oct details' })).toHaveCount(0);
});

test('Path: the order opens from "change", and print or export is one sheet', async ({ page }) => {
  await quickSetup(page);
  await goTab(page, 'Path');
  await page.getByRole('button', { name: 'change', exact: true }).click();
  await page.getByRole('radio', { name: /Biggest interest first/ }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByText('Order: biggest interest first')).toBeVisible();

  await page.getByRole('button', { name: 'Print or export' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export the plan (CSV)' }).click()]);
  expect(download.suggestedFilename()).toBe('paidinyellow-plan.csv');
});

test('Debts: cards in payoff order with a position tag, and a sheet of what to do', async ({ page }) => {
  await quickSetup(page);
  await goTab(page, 'Debts');
  await expect(page.getByTestId('owed-line')).toContainText('left');
  await expect(page.getByRole('region', { name: 'Store card' })).toContainText('1 · Paying now');
  await expect(page.getByRole('region', { name: 'Visa' })).toContainText('2 · Next');
  await expect(page.getByRole('button', { name: 'Add a debt' })).toBeVisible(); // the round + button
  await expectBrandRules(page);

  await page.getByRole('button', { name: 'Store card, options' }).click();
  const sheet = page.getByRole('dialog', { name: 'Store card' });
  for (const name of ['Update from my statement', 'Add a new charge or fee', 'Edit']) await expect(sheet.getByRole('button', { name, exact: true })).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Archive', exact: true })).toBeVisible();
});

test('Safety net: buffer ready on yellow, yearly bills with ink bars, "I paid a bill" and "+ Add a bill"', async ({ page }) => {
  await quickSetup(page);
  await goTab(page, 'Safety net');
  await expect(page.getByTestId('buffer-amount')).toHaveText('$500');
  await expect(page.getByTestId('buffer-ready')).toHaveText('ready');
  await page.getByRole('button', { name: 'Help: Surprise buffer' }).click();
  await expect(page.getByText('Kept in a plain separate account or an envelope.')).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(page.getByRole('button', { name: 'I paid a bill' })).toBeDisabled(); // no bills yet

  await page.getByRole('button', { name: '+ Add a bill' }).click();
  const add = page.getByRole('dialog', { name: 'Add a yearly bill' });
  await add.getByLabel('Name').fill('Car repairs');
  await add.getByLabel('Cost per year').fill('600');
  await add.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Car repairs, edit' })).toContainText('Any time');
  await expect(page.getByRole('region', { name: 'Yearly bills' })).toContainText('each payday');

  // The bar is ink, because savings in progress are not paid
  const bg = await page.locator('.bar.ink > span').first().evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg.replace(/\s/g, '')).toBe('rgb(31,42,68)');

  // One bill: "I paid a bill" goes straight to the amount
  await page.getByRole('button', { name: 'I paid a bill' }).click();
  await expect(page.getByRole('dialog', { name: 'I paid Car repairs' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();

  // Two bills: it asks which one first
  await page.getByRole('button', { name: '+ Add a bill' }).click();
  await page.getByRole('dialog', { name: 'Add a yearly bill' }).getByLabel('Name').fill('Gifts');
  await page.getByRole('dialog', { name: 'Add a yearly bill' }).getByLabel('Cost per year').fill('260');
  await page.getByRole('dialog', { name: 'Add a yearly bill' }).getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'I paid a bill' }).click();
  await expect(page.getByRole('dialog', { name: 'Which bill did you pay?' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Gifts' }).click();
  await expect(page.getByRole('dialog', { name: 'I paid Gifts' })).toBeVisible();
});

test('Safety net: "Find your first $500" is one row that opens the checklist', async ({ page }) => {
  await quickSetup(page);
  await goTab(page, 'Safety net');
  await page.getByRole('button', { name: /Find your first \$500/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Find your first $500' });
  await expect(sheet.getByTestId('find-total')).toBeVisible();
  await expect(sheet.getByRole('checkbox').first()).toBeVisible();
  await expect(page.getByText(/Debt payments are/)).toHaveCount(0); // only when the paycheck is set
});
