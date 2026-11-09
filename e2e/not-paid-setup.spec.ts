/** Path > List > Done: mark the most recent paid payday as not paid. Setup step 3: the buffer fields and the yearly bills row. */
import { expect, test, type Page } from '@playwright/test';
import { nadiaSetup } from './nadia';
import { goTab, showPaydays, tapDidIt } from './scenario';
import { unlockOnResult } from './helpers';

async function openDone(page: Page) {
  await goTab(page, 'Path');
  await showPaydays(page);
}

test.describe('mark a payday as not paid', () => {
  test('the most recent paid payday opens a sheet with the new debt-free month; Keep it leaves it paid', async ({ page }) => {
    await nadiaSetup(page);
    await tapDidIt(page);
    await expect(page.getByTestId('paid-card')).toBeVisible();
    await openDone(page);
    await page.getByRole('button', { name: 'Fri 6 Nov, paid' }).click();
    const first = page.getByRole('dialog', { name: 'Fri 6 Nov' });
    await expect(first).toContainText('You paid'); // what was paid
    await first.getByRole('button', { name: 'Mark as not paid' }).click();
    const sheet = page.getByRole('dialog', { name: 'Mark Fri 6 Nov as not paid?' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId('not-paid-line')).toHaveText(/^(Still|Moves to) [A-Z][a-z]+ 20\d\d, if you pay it this week$/);
    await expect(sheet.getByRole('button', { name: 'Yes, mark as not paid' })).toBeVisible();
    await sheet.getByRole('button', { name: 'Keep it' }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Fri 6 Nov, paid' })).toBeVisible();
  });

  test('Yes puts the payday back: it is not paid, Today asks for it again, and the list is empty', async ({ page }) => {
    await nadiaSetup(page);
    await tapDidIt(page);
    await expect(page.getByTestId('paid-card')).toBeVisible();
    await openDone(page);
    await page.getByRole('button', { name: 'Fri 6 Nov, paid' }).click();
    await page.getByRole('button', { name: 'Mark as not paid' }).click();
    await page.getByRole('button', { name: 'Yes, mark as not paid' }).click();
    await expect(page.getByText('Fri 6 Nov is not paid now.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fri 6 Nov, paid' })).toHaveCount(0);
    await goTab(page, 'Today');
    await expect(page.getByTestId('paid-card')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'I did it · $180' })).toBeVisible();
    await expect(page.getByTestId('pay-note')).toHaveText('First square. The hardest one is behind you.');
  });

  test('with two paydays done only the latest opens the sheet; the first just shows what was paid', async ({ page }) => {
    await nadiaSetup(page);
    await tapDidIt(page);
    await expect(page.getByTestId('paid-card')).toBeVisible();
    await page.clock.setFixedTime(new Date('2026-11-20T10:00:00'));
    await page.reload();
    await tapDidIt(page);
    await expect(page.getByTestId('paid-card')).toBeVisible();
    await openDone(page);
    // the first one: details, no sheet
    await page.getByRole('button', { name: 'Fri 6 Nov, paid' }).click();
    await expect(page.getByRole('group', { name: 'Fri 6 Nov details' })).toContainText('Total');
    await expect(page.getByTestId('undo-later-first')).toHaveText('Undo the later ones first.');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // the latest one: the sheet
    await page.getByRole('button', { name: 'Fri 20 Nov, paid' }).click();
    await expect(page.getByRole('dialog', { name: 'Fri 20 Nov' })).toBeVisible();
  });
});

/** The first three setup steps, up to the money step */
async function toMoneyStep(page: Page) {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Every 2 weeks' }).click();
  await page.getByLabel('Your next payday').fill('2026-11-06');
  await page.getByRole('button', { name: 'Continue' }).click();
  const card = page.locator('fieldset').last();
  await card.getByLabel('Name').fill('Visa');
  await card.getByLabel('Balance').fill('3200');
  await card.getByLabel('Interest rate').fill('22.9');
  await card.getByLabel('Monthly minimum').fill('96');
  await card.getByLabel('Due day').fill('12');
  await page.getByRole('button', { name: 'That’s all of them' }).click();
}

test.describe('setup step 3', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-30T10:00:00'));
  });

  test('the buffer is two fields you can see, with the question and the goal', async ({ page }) => {
    await toMoneyStep(page);
    await expect(page.getByText('Set aside now', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Buffer now')).toBeVisible(); // no section to open first
    await expect(page.getByLabel('Safety net goal')).toBeVisible();
    await expect(page.getByLabel('Safety net goal')).toHaveValue('500');
    await page.getByLabel('Buffer now').fill('200');
    await page.getByLabel('Money for the plan each payday').fill('150');
    await page.getByRole('button', { name: 'See my plan' }).click();
    await expect(page.getByTestId('debt-free-date')).toBeVisible();
  });

  test('the yearly bills row has Car, Gifts, Insurance, School and I have none', async ({ page }) => {
    await toMoneyStep(page);
    const row = page.getByTestId('yearly-row');
    await expect(row).toContainText('Yearly bills');
    await expect(row).toContainText('(optional)');
    for (const name of ['Car repairs', 'Gifts and holidays', 'Insurance', 'School', 'I have none']) await expect(row.getByRole('button', { name, exact: true })).toBeVisible();
  });

  test('chips add bills with a cost and a month, and they end up in the plan', async ({ page }) => {
    await toMoneyStep(page);
    const row = page.getByTestId('yearly-row');
    await row.getByRole('button', { name: 'Gifts and holidays', exact: true }).click();
    await row.getByRole('button', { name: 'Car repairs', exact: true }).click();
    await expect(row.getByTestId('yearly-fund')).toHaveCount(2);
    await row.getByLabel('Gifts and holidays, cost per year').fill('260');
    await row.getByLabel('Gifts and holidays, needed in').selectOption('December');
    await row.getByLabel('Car repairs, cost per year').fill('600');
    // tapping a chip again takes the bill away
    await row.getByRole('button', { name: 'Car repairs', exact: true }).click();
    await expect(row.getByTestId('yearly-fund')).toHaveCount(1);
    await page.getByLabel('Money for the plan each payday').fill('150');
    await page.getByRole('button', { name: 'See my plan' }).click();
    await expect(page.getByTestId('debt-free-date')).toBeVisible();
    await unlockOnResult(page);
    await page.getByRole('button', { name: 'Start my plan' }).click();
    await goTab(page, 'Safety net');
    await expect(page.getByRole('region', { name: 'Yearly bills' })).toContainText('Gifts and holidays');
    await expect(page.getByRole('region', { name: 'Yearly bills' })).toContainText('$10 each payday');
  });

  test('Other: a yearly bill with a name, a cost and a month, and it ends up in the plan', async ({ page }) => {
    await toMoneyStep(page);
    const row = page.getByTestId('yearly-row');
    await expect(row.getByRole('button', { name: 'Other yearly bill', exact: true })).toBeVisible();
    await row.getByRole('button', { name: 'Other yearly bill', exact: true }).click();
    await expect(row.getByTestId('yearly-fund')).toHaveCount(1);
    await expect(row.getByTestId('yearly-fund')).toContainText('Other yearly bill');
    await row.getByLabel('Other 1, name').fill('Vet');
    await row.getByLabel('Other 1, cost per year').fill('300');
    await row.getByLabel('Other 1, needed in').selectOption('March');
    await expect(row.getByTestId('yearly-fund')).toContainText('Vet');
    // a second one, and it can be removed again
    await row.getByRole('button', { name: 'Other yearly bill', exact: true }).click();
    await expect(row.getByTestId('yearly-fund')).toHaveCount(2);
    await row.getByLabel('Other 2, name').fill('Dentist');
    await row.getByLabel('Other 2, cost per year').fill('240');
    await row.getByRole('button', { name: 'Remove Other 2' }).click();
    await expect(row.getByTestId('yearly-fund')).toHaveCount(1);
    await page.getByLabel('Money for the plan each payday').fill('150');
    await page.getByRole('button', { name: 'See my plan' }).click();
    await expect(page.getByTestId('debt-free-date')).toBeVisible();
    await unlockOnResult(page);
    await page.getByRole('button', { name: 'Start my plan' }).click();
    await goTab(page, 'Safety net');
    const bills = page.getByRole('region', { name: 'Yearly bills' });
    await expect(bills).toContainText('Vet');
    await expect(bills).toContainText('March');
    await expect(bills).not.toContainText('Dentist');
  });

  test('a category with its amount and an empty plan money: the message names the money for the plan field and is brought into view', async ({ page }) => {
    await toMoneyStep(page);
    const row = page.getByTestId('yearly-row');
    await row.getByRole('button', { name: 'Gifts and holidays', exact: true }).click();
    await row.getByLabel('Gifts and holidays, cost per year').fill('260');
    await page.getByRole('button', { name: 'See my plan' }).click();
    const note = page.getByTestId('step-notes');
    await expect(note).toContainText('Money for the plan each payday: type an amount, even 0.');
    await expect(note).toBeInViewport();
    // the yearly bill is fine: nothing says it needs an amount
    await expect(note).not.toContainText('Gifts');
    await page.getByLabel('Money for the plan each payday').fill('0');
    await page.getByRole('button', { name: 'See my plan' }).click();
    await expect(page.getByTestId('debt-free-date')).toBeVisible();
  });

  test('I have none: no yearly bills, and Today does not offer them later', async ({ page }) => {
    await toMoneyStep(page);
    await page.getByTestId('yearly-row').getByRole('button', { name: 'I have none' }).click();
    await expect(page.getByTestId('yearly-row').getByRole('button', { name: 'I have none' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByLabel('Money for the plan each payday').fill('150');
    await page.getByRole('button', { name: 'See my plan' }).click();
    await expect(page.getByTestId('debt-free-date')).toBeVisible();
    await unlockOnResult(page);
    // the result does not offer it, and Today does not either
    await expect(page.getByRole('button', { name: 'Yearly bills' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Start my plan' }).click();
    await expect(page.getByRole('button', { name: 'Yearly bills' })).toHaveCount(0);
  });
});
