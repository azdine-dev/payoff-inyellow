/**
 * Main flow on a phone: setup → result → Today → "I did it" → paid.
 * Uses the numbers of engine/fixtures.json "sample_every_2_weeks", so the screens must show
 * the same figures as the Google Sheet.
 */
import { addYearlyBills, showPaydays, tapDidIt, goTab, revealEarly } from './scenario';
import { expect, test, type Page } from '@playwright/test';

import { unlockOnResult } from './helpers';

const SHOTS = process.env.SHOTS_DIR;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
};

const debts = [
  { name: 'Visa', balance: '3200', apr: '22.9', min: '96', due: '12' },
  { name: 'Store card', balance: '640', apr: '26.99', min: '35', due: '5' },
  { name: 'Car loan', balance: '9800', apr: '7.5', min: '285', due: '20' },
  { name: 'Medical bill', balance: '1150', apr: '0', min: '50', due: '1' },
];

test('a new user gets a debt-free date and marks the first payday paid', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-15T10:00:00'));
  await page.goto('/');
  const next = page.getByRole('button', { name: /^(Continue|That’s all of them|See my plan)$/ });

  // 1 Pay: the welcome words are on top, the currency is a small line
  await expect(page.getByText('You’re not bad at math.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your pay schedule' })).toBeVisible();
  await expect(page.getByTestId('currency-line')).toContainText('USD ($)');
  await shot(page, '01-pay');

  // Calm note when nothing is picked yet
  await next.click();
  await expect(page.getByText('Choose how often you get paid.')).toBeVisible();
  await page.getByRole('radio', { name: 'Every 2 weeks' }).click();
  await page.getByLabel('Your next payday').fill('2026-10-23');
  await next.click();

  // 2 Debts
  for (const [i, d] of debts.entries()) {
    if (i > 0) await page.getByRole('button', { name: 'Add another' }).click();
    const card = page.locator('fieldset').last();
    await card.getByLabel('Name').fill(d.name);
    await card.getByLabel('Balance').fill(d.balance);
    await card.getByLabel('Interest rate').fill(d.apr);
    await card.getByLabel('Monthly minimum').fill(d.min);
    await card.getByLabel('Due day').fill(d.due);
  }
  await shot(page, '02-debts');
  await next.click();

  // 3 Money: the plan amount and the buffer on one screen
  await page.getByLabel('Money for the plan each payday').fill('150');
  await page.getByLabel('Buffer now').fill('200');
  await expect(page.getByLabel('Buffer goal')).toHaveValue('500');
  await shot(page, '03-money');
  await next.click();

  // 4 Your date. Yearly bills come after, from "Do these later" (the planner is unlocked first).
  await unlockOnResult(page);
  await addYearlyBills(page, [
    { idea: 'Car repairs', amount: '600' },
    { idea: 'Gifts and holidays', amount: '500' },
  ]);
  await expect(page.getByTestId('debt-free-date')).toHaveText('October 2028'); // same date as the Sheet (2028-10-06)
  await expect(page.getByTestId('first-step')).toHaveText('Move $235.');
  await expect(page.getByTestId('first-step-parts')).toHaveText('Medical bill $50 (due 1 Nov) · Store card $35 (due 5 Nov) · Yearly bills $42.31 · Buffer $107.69');
  await shot(page, '04-result');
  await page.getByRole('button', { name: 'Start my plan' }).click();
  await revealEarly(page);

  // Today: payday 1 of the fixture
  await expect(page.getByTestId('debt-free-pill')).toHaveText('Debt-free by Oct 2028');
  // The bills due before the next payday, each with its full monthly minimum and its due date
  await expect(page.getByRole('checkbox', { name: /Medical bill.*due Sun 1 Nov/ })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /Store card.*due Thu 5 Nov/ })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /Visa|Car loan/ })).toHaveCount(0); // due after the next payday, or before this one
  await expect(page.getByText(/Minimums due/)).toHaveCount(0); // the per-payday average stays inside the engine
  await expect(page.getByRole('checkbox', { name: /Yearly bills.*\$42\.31/ })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /Buffer.*\$200 of \$500.*\$107\.69/ })).toBeVisible();
  const didIt = page.getByRole('button', { name: 'I did it · $235' }); // 85 + 42.31 + 107.69
  await expect(didIt).toBeVisible();
  await shot(page, '07-today');

  await didIt.click(); // the payday is still a week away: no question, Undo covers a mistake
  await expect(page.getByRole('status').filter({ hasText: 'Fri 23 Oct is paid.' })).toContainText('Next payday: Fri 6 Nov.');
  await expect(page.getByTestId('debt-free-pill')).toHaveText('Debt-free by Oct 2028');
  await shot(page, '08-paid');

  // Everything stays after a reload (IndexedDB)
  await page.reload();
  await expect(page.getByTestId('greeting')).toHaveText('Done for this payday.'); // it stays paid until the next payday
  await expect(page.getByTestId('countdown-card')).toContainText('Fri 6 Nov');
});

test('the wizard keeps what was typed after a reload', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-15T10:00:00'));
  await page.goto('/');
  await page.getByRole('radio', { name: 'Every week' }).click();
  await page.waitForTimeout(500); // autosave runs 300 ms after typing
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Every week' })).toHaveAttribute('aria-checked', 'true');
});

/** Fast setup: two debts, buffer already full. */
async function quickSetup(page: Page) {
  await page.goto('/');
  const next = page.getByRole('button', { name: /^(Continue|That’s all of them|See my plan)$/ });
  await page.getByRole('radio', { name: 'Every 2 weeks' }).click();
  await page.getByLabel('Your next payday').fill('2026-10-23');
  await next.click();
  for (const [i, d] of debts.slice(0, 2).entries()) {
    if (i > 0) await page.getByRole('button', { name: 'Add another' }).click();
    const card = page.locator('fieldset').last();
    await card.getByLabel('Name').fill(d.name);
    await card.getByLabel('Balance').fill(d.balance);
    await card.getByLabel('Interest rate').fill(d.apr);
    await card.getByLabel('Monthly minimum').fill(d.min);
    await card.getByLabel('Due day').fill(d.due);
  }
  await next.click();
  await page.getByLabel('Money for the plan each payday').fill('150');
  await page.getByLabel('Buffer now').fill('500');
  await next.click();
  await unlockOnResult(page);
  await page.getByRole('button', { name: 'Start my plan' }).click();
}

test('missed payday, extra payment and a different amount stay calm', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-15T10:00:00'));
  await quickSetup(page);
  await revealEarly(page);
  // Store card is due on the 5th (before the next payday): its bill and the extra are one row. Visa is due on the 12th: next payday.
  await expect(page.getByRole('checkbox', { name: /Store card.*Bill \$35 \+ extra \$150.*due Thu 5 Nov/ })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /Visa/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^I did it · \$/ })).toContainText('$185');

  // A different amount for this payday only
  await page.getByRole('button', { name: 'I got a different amount' }).click();
  await page.getByLabel('Money for the plan this payday').fill('250');
  await page.getByRole('button', { name: 'Update this payday' }).click();
  await expect(page.getByRole('button', { name: /^I did it · \$/ })).toContainText('$285'); // 35 + 250
  await page.getByRole('button', { name: 'Use the usual amount' }).click();
  await expect(page.getByRole('button', { name: /^I did it · \$/ })).toContainText('$185'); // 35 + 150

  // The payday goes by without a check
  await page.clock.setFixedTime(new Date('2026-10-26T10:00:00'));
  await page.reload();
  await expect(page.getByText('went by. Did you do it?')).toBeVisible();
  await shot(page, '09-missed');
  await page.getByRole('button', { name: 'I skipped it' }).click();
  await expect(page.getByText('Life happens. Never miss twice. Here’s your updated date.')).toBeVisible();
  await expect(page.getByTestId('payday-total')).toBeVisible(); // nothing is done yet, so the card
  await expect(page.getByTestId('greeting')).toHaveText('Next payday is Fri 6 Nov.');  // Extra money pays off the focus debt
  await page.getByRole('button', { name: '+ Extra payment' }).click();
  await page.getByRole('textbox', { name: 'Extra payment' }).fill('640');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('PAID. One down.')).toBeVisible();
  await expect(page.getByTestId('paid-moment')).toContainText('Store card is paid.');
  await page.getByRole('button', { name: 'Next payday' }).click();
  await expect(page.getByTestId('paid-moment')).toHaveCount(0);
  await shot(page, '10-paid-off');
  await expect(page.getByRole('region', { name: 'Focus debt' })).toContainText('Visa');
});

test('debts and money: a new charge moves the date, the buffer refills first', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-15T10:00:00'));
  await quickSetup(page);
  const pill = page.getByTestId('debt-free-pill');
  const before = await pill.textContent();

  // Log a charge on Visa
  await page.getByRole('button', { name: 'Debts', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Visa' })).toContainText('$3,200');
  await page.getByRole('button', { name: 'Visa, options' }).click();
  await page.getByRole('button', { name: 'Add a new charge or fee' }).click();
  await page.getByRole('textbox', { name: 'Charge amount' }).fill('900');
  await page.getByRole('radio', { name: 'Emergency' }).click();
  await page.getByRole('button', { name: 'Add to balance' }).click();
  await expect(page.getByRole('region', { name: 'Visa' })).toContainText('$4,100');
  await shot(page, '11-debts');

  // Add and archive a debt
  await page.getByRole('button', { name: 'Add a debt' }).click();
  await page.getByLabel('Name').fill('Phone');
  await page.getByRole('textbox', { name: 'Balance' }).fill('300');
  await page.getByRole('textbox', { name: 'Interest rate' }).fill('0');
  await page.getByRole('button', { name: 'Add minimum and due day now' }).click();
  await page.getByRole('textbox', { name: 'Monthly minimum' }).fill('25');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Phone' })).toBeVisible();
  await page.getByRole('button', { name: 'Phone, options' }).click();
  await page.getByRole('button', { name: 'Archive' }).click();
  await expect(page.getByText('Archived')).toBeVisible();

  // The date moved
  await page.getByRole('button', { name: 'Today' }).click();
  expect(await pill.textContent()).not.toBe(before);

  // Use the buffer
  await goTab(page, 'Money');
  await expect(page.getByRole('heading', { name: 'Safety net' })).toBeVisible();
  await page.getByRole('button', { name: 'I used some of it' }).click();
  await page.getByRole('textbox', { name: 'Amount used' }).fill('200');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('That’s what it’s for. Nothing went on a card.')).toBeVisible();
  await expect(page.getByText('$300 of $500')).toBeVisible();
  await shot(page, '12-money');

  // Today refills the buffer first
  await page.getByRole('button', { name: 'Today' }).click();
  await revealEarly(page);
  await expect(page.getByRole('checkbox', { name: /Buffer.*\$300 of \$500/ })).toBeVisible();
});

test('plan and progress: what-if applies, paid paydays turn yellow, milestones are kept', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-15T10:00:00'));
  await quickSetup(page);
  const pill = page.getByTestId('debt-free-pill');
  const before = await pill.textContent();

  // Plan: the what-if shows a sooner date and "Apply to my plan" changes Today
  await goTab(page, 'Plan');
  await page.getByRole('button', { name: 'What if I add more?' }).click();
  await page.getByLabel('Add money each payday').fill('100');
  await expect(page.getByTestId('whatif-result')).toContainText('sooner');
  await shot(page, '13-plan');
  await page.getByRole('button', { name: 'Use this in my plan' }).click();
  await expect(page.getByText('Done. Your plan and Today use it now.')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Today' }).click();
  expect(await pill.textContent()).not.toBe(before);

  // Do two paydays
  await tapDidIt(page);
  await expect(page.getByText('Fri 23 Oct is paid.')).toBeVisible();
  await page.clock.setFixedTime(new Date('2026-11-06T10:00:00'));
  await page.reload();
  await tapDidIt(page);
  await expect(page.getByText('Fri 6 Nov is paid.')).toBeVisible();

  // Plan: both paydays are paid and open to show their payments
  await goTab(page, 'Plan');
  await showPaydays(page, 'Done');
  await expect(page.getByRole('button', { name: 'Fri 23 Oct, paid' })).toBeVisible();
  await page.getByRole('button', { name: 'Fri 23 Oct, paid' }).click();
  await expect(page.getByRole('group', { name: 'Fri 23 Oct details' })).toContainText('Total');
  await page.getByRole('button', { name: 'Close' }).click();

  // Progress: grid, milestones, planned vs actual
  await goTab(page, 'Progress');
  await expect(page.getByTestId('paid-so-far')).not.toHaveText('$0');
  await expect(page.getByRole('listitem', { name: 'Fri 23 Oct: paid' })).toBeVisible();
  await expect(page.getByRole('listitem', { name: 'Fri 6 Nov: paid' })).toBeVisible();
  await expect(page.getByRole('listitem', { name: 'Plan made' })).toBeVisible();
  await expect(page.getByTestId('planned-vs-actual')).toContainText('This month:');
  await shot(page, '14-progress');
});
