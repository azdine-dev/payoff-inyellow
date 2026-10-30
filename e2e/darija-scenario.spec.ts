/**
 * docs/app-test-scenario-darija.docx as a Playwright script: "Sara's story", from setup to her
 * first paid-off debt, then three short cases (B, C, D). Every number comes from the document,
 * which took it from the reference engine, so the app and the Google Sheet must agree.
 * A difference of 0.01 is rounding and is allowed (near() in scenario.ts).
 */
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { FIXED, shot, unlockOnResult } from './helpers';
import { addYearlyBills,
  closeSheet,
  expectBrandRules,
  expectBuffer,
  expectNoSidewaysScroll,
  expectPaidPayday,
  goTab,
  iDidIt,
  near,
  openPayday,
  runWizard,
  setDay,
  startPlan,
  showPaydays,
  tapDidIt, revealEarly } from './scenario';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED); // Thu 15 Oct 2026
});

test('Sara: from setup to her first debt gone (parts 1 to 14)', async ({ page, browser }, info) => {
  test.setTimeout(420_000);
  const next = page.getByRole('button', { name: /^(Continue|That’s all of them|See my plan)$/ });
  const nav = page.getByRole('navigation', { name: 'Main' });
  const pill = page.getByTestId('debt-free-pill');

  // ---------------------------------------------------------------- part 2: setup in four steps
  await test.step('1 Pay: the welcome words are on top, the currency is a small line', async () => {
    await page.goto('/');
    await expect(page.getByText('You pay every month, but the balance never goes down.')).toBeVisible();
    await expect(page.getByText('You’re not bad at math. The math was hidden from you.')).toBeVisible();
    await expect(page.getByLabel('Step 1 of 4')).toBeVisible(); // progress bar
    await expect(page.getByTestId('currency-line')).toContainText('USD ($)');
    await page.getByRole('button', { name: 'Change' }).click();
    await expect(page.getByLabel('Currency')).toHaveValue('USD');
    await page.getByRole('radio', { name: 'Every 2 weeks' }).click();
    await page.getByLabel('Your next payday').fill('2026-10-23');
    await expect(page.getByText(/That.s Fri 23 Oct\./)).toBeVisible();
    await next.click();
    await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
  });

  await test.step('2 Debts: four debts, one line each, and the 0% medical bill gets no warning', async () => {
    const debts = [
      { name: 'Visa', balance: '3,200', apr: '22.9', min: '96', due: '12' },
      { name: 'Store card', balance: '640', apr: '26.99', min: '35', due: '5' },
      { name: 'Car loan', balance: '9,800', apr: '7.5', min: '285', due: '20' },
      { name: 'Medical bill', balance: '1,150', apr: '0', min: '50', due: '1' },
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
    await expect(page.getByTestId('debt-summary')).toHaveCount(3); // the three before it are one line each
    await expect(page.getByTestId('debt-summary').first()).toContainText('Visa');
    await expect(page.getByTestId('debt-summary').first()).toContainText('22.9% · $96 a month · due the 12th');
    await expect(page.getByText(/grows even when you pay the minimum/)).toHaveCount(0);
    await next.click();
  });

  await test.step('3 Money: 150 for the plan, 200 in the buffer, the goal is 500 from the start', async () => {
    await expect(page.getByTestId('minimums-line')).toHaveText('Your minimums: $466 a month.');
    await expect(page.getByText('Even $20 matters. You can change it any time.')).toBeVisible();
    await page.getByRole('button', { name: '$150', exact: true }).click();
    await expect(page.getByLabel('Money for the plan each payday')).toHaveValue('150');
    await expect(page.getByLabel('Buffer goal')).toHaveValue('500');
    await page.getByLabel('Buffer now').fill('200');
    await next.click();
  });

  // ---------------------------------------------------------------- part 3: result screen (step 4)
  await test.step('4 Your date, then the yearly bills and the payday reminder from "Do these later"', async () => {
    await expect(page.getByLabel('Step 4 of 4')).toBeVisible();
    await expect(page.getByTestId('debt-free-date')).toBeVisible();
    await unlockOnResult(page);
    // Yearly bills: car repairs 600 and gifts 500 (December)
    await addYearlyBills(page, [{ idea: 'Car repairs', amount: '600' }, { idea: 'Gifts and holidays', amount: '500', month: 'December' }]);
    // Payday reminder: Friday at 7 pm
    await page.getByRole('button', { name: 'Payday reminder', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Payday reminder' });
    await expect(sheet.getByLabel('When I get paid on')).toHaveValue('Friday');
    await sheet.getByLabel('I open PaidInYellow at').fill('19:00');
    await expect(sheet.getByText('When I get paid on Friday, I open PaidInYellow at 7 pm.')).toBeVisible();
    await sheet.getByRole('button', { name: 'Save my reminder' }).click();
    await expect(page.getByRole('button', { name: 'Payday reminder', exact: true })).toHaveClass(/done/);
    await expect(page.getByRole('button', { name: 'Yearly bills', exact: true })).toHaveClass(/done/);
  });

  await test.step('Result screen', async () => {
    await expect(page.getByTestId('debt-free-date')).toHaveText('October 2028'); // 6 Oct 2028
    await expect(page.getByTestId('tile-sooner')).toContainText('30 months');
    await expect(page.getByTestId('tile-interest')).toContainText('$1,763');
    await expect(page.getByTestId('minimums-only')).toContainText(/Paying only minimums, it would take until [A-Z][a-z]+ 20\d\d\./);
    // New rule: only the bills due before the next payday (Medical bill $50 on 1 Nov, Store card $35 on 5 Nov)
    await expect(page.getByTestId('first-step')).toHaveText('Move $235.');
    await expect(page.getByTestId('first-step-parts')).toContainText('Medical bill $50 (due 1 Nov) · Store card $35 (due 5 Nov) · Yearly bills $42.31 · Buffer $107.69');
    await shot(page, '20-sara-result');
    await startPlan(page);
  });

  await test.step('Path: PaidInYellow order is recommended and the gap to Biggest interest first is small', async () => {
    await goTab(page, 'Plan');
    await expect(page.getByText('Order: smallest first')).toBeVisible();
    await expect(page.getByTestId('comparison')).toHaveCount(0); // the comparison shows on Path only when the rule fires
    await page.getByRole('button', { name: 'change', exact: true }).click();
    await expect(page.getByRole('radio', { name: /PaidInYellow order/ })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('order-comparison')).toContainText('Biggest interest first would save $140, a small difference');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await goTab(page, 'Today');
  });

  // ---------------------------------------------------------------- part 4: Today before payday 1
  await test.step('Today before the first payday', async () => {
    await revealEarly(page);
    await expect(pill).toContainText('October 2028');
    // The bills due from Fri 23 Oct up to Fri 6 Nov, each with its full monthly minimum and its due date
    await expect(page.getByRole('checkbox', { name: /Medical bill.*due Sun 1 Nov/ })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Store card.*due Thu 5 Nov/ })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Visa|Car loan/ })).toHaveCount(0); // Visa 12 Nov and Car loan 20 Nov are later
    await expect(page.getByText(/Minimums due/)).toHaveCount(0); // the per-payday average is not shown
    await expect(page.getByRole('checkbox', { name: /Yearly bills/ })).toContainText(near(42.31));
    await expect(page.getByRole('checkbox', { name: /Buffer.*\$200 of \$500/ })).toContainText(near(107.69));
    await expect(page.getByRole('checkbox', { name: /extra/i })).toHaveCount(0);
    await expect(page.getByTestId('buffer-first')).toContainText('Extra goes to your buffer until it reaches');
    await expect(page.getByRole('button', { name: 'I did it · $235' })).toBeVisible(); // 85 + 42.31 + 107.69
    const focus = page.getByRole('region', { name: 'Focus debt' });
    await expect(focus).toContainText('Store card');
    await expect(focus).toContainText('0% gone');
    await expect(focus).toContainText('$640 left');
    await expect(focus).toContainText('gone by Jan 2027');
    await expect(page.getByTestId('daily-cost')).toContainText('$4.49 a day');
    await expect(page.getByTestId('coming-up')).toContainText(/Tue 20 Oct.*Car loan.*in 5 days.*\$285/s);
    await shot(page, '21-sara-today');
  });

  // ---------------------------------------------------------------- part 5: paydays 1, 2, 3
  await test.step('Payday 1 (23 Oct)', async () => {
    await setDay(page, '2026-10-23');
    await iDidIt(page, 'Fri 23 Oct');
    await expectPaidPayday(page, {
      date: 'Fri 23 Oct',
      total: 235,
      buffer: 107.69,
      yearly: 42.31,
      bills: [{ name: 'Medical bill', amount: 50, due: '1 Nov' }, { name: 'Store card', amount: 35, due: '5 Nov' }],
      debtLeft: 14768.1,
    });
    await expectBuffer(page, 307.69);
    await goTab(page, 'Today');
    await expect(pill).toContainText('October 2028');
  });

  await test.step('Payday 2 (6 Nov)', async () => {
    await setDay(page, '2026-11-06');
    await iDidIt(page, 'Fri 6 Nov');
    await expectPaidPayday(page, { date: 'Fri 6 Nov', total: 246, buffer: 107.69, yearly: 42.31, bills: [{ name: 'Visa', amount: 96, due: '12 Nov' }], debtLeft: 14735.23 }); // Car loan 20 Nov is the next payday: it belongs to that one
    await expectBuffer(page, 415.38);
  });

  await test.step('Payday 3 (20 Nov): the buffer is full and the first extra goes to Store card', async () => {
    await setDay(page, '2026-11-20');
    await goTab(page, 'Today');
    await expect(page.getByRole('checkbox', { name: /Car loan.*due Fri 20 Nov/ })).toBeVisible(); // due on the payday itself
    await expect(page.getByRole('checkbox', { name: /Medical bill.*due Tue 1 Dec/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^I did it/ })).toContainText(near(485.01)); // 335 + 42.31 + 84.62 + 23.08
    await iDidIt(page, 'Fri 20 Nov');
    await expectPaidPayday(page, { date: 'Fri 20 Nov', total: 485.01, buffer: 84.62, yearly: 42.31, extra: { amount: 23.08, to: 'Store card' }, debtLeft: 14439.84 });
    await expectBuffer(page, 500);
    await goTab(page, 'Today');
    await expect(page.getByTestId('milestone-moment').filter({ hasText: 'Your buffer is full. From now on the extra goes to Store card.' })).toBeVisible();
    await goTab(page, 'Progress');
    await expect(page.getByRole('listitem', { name: 'Buffer full, reached' })).toBeVisible();
    await expect(page.getByRole('listitem', { name: 'First extra payment, reached' })).toBeVisible();
    await goTab(page, 'Plan');
    await expect(page.getByTestId('status-line')).toHaveText('Debt-free by Oct 2028 · 50 paydays left'); // 53 paydays in all (v2: bills by due date)
  });

  // ---------------------------------------------------------------- part 6: payday 4, less money
  await test.step('Payday 4 (4 Dec): Sara only has $100 for the plan', async () => {
    await setDay(page, '2026-12-04');
    await goTab(page, 'Today');
    await page.getByRole('button', { name: 'I got a different amount' }).click();
    await page.getByRole('textbox', { name: 'Money for the plan this payday' }).fill('100');
    await page.getByRole('button', { name: 'Update this payday' }).click();
    // One calm sentence: $50 less this payday, and the date stays 6 Oct 2028
    await expect(page.getByTestId('notice')).toContainText('You have $50 less for the plan this payday. Your debt-free date didn’t move.');
    await expect(page.getByRole('checkbox', { name: /Store card.*due Sat 5 Dec/ })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Visa.*due Sat 12 Dec/ })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Yearly bills/ })).toContainText(near(42.31));
    await expect(page.getByRole('checkbox', { name: /Buffer/ })).toHaveCount(0); // already full
    await expect(page.getByRole('checkbox', { name: /Store card.*extra/i })).toContainText(near(57.69));
    await expect(page.getByRole('button', { name: /^I did it/ })).toContainText(near(231)); // 131 + 42.31 + 57.69
    await iDidIt(page, 'Fri 4 Dec');
    await expectPaidPayday(page, { date: 'Fri 4 Dec', total: 231, debtLeft: 14313.16 });
    await goTab(page, 'Plan');
    await expect(page.getByTestId('status-line')).toHaveText('Debt-free by Oct 2028 · 49 paydays left'); // the date did not move
  });

  // ---------------------------------------------------------------- part 7: a new charge
  await test.step('A new $45 charge on Visa is added calmly (v2: the date does not move)', async () => {
    await goTab(page, 'Debts');
    await page.getByRole('button', { name: 'Visa, options' }).click();
    await page.getByRole('button', { name: 'Add a new charge or fee' }).click();
    await expect(page.getByRole('dialog')).toContainText('No judgment');
    await page.getByRole('textbox', { name: 'Charge amount' }).fill('45');
    await page.getByRole('radio', { name: 'Everyday' }).click();
    await page.getByRole('button', { name: 'Add to balance' }).click();
    await expect(page.getByTestId('notice')).toContainText('That adds $45 to Visa. Your debt-free date didn’t move.');
    await goTab(page, 'Progress');
    await expect(page.getByTestId('to-go')).toContainText('$14,358'); // 14,313.16 + 45
    await goTab(page, 'Plan');
    await expect(page.getByTestId('status-line')).toHaveText('Debt-free by Oct 2028 · 49 paydays left'); // 20 Oct 2028, one payday later
  });

  // ---------------------------------------------------------------- part 8: the buffer is used
  await test.step('Sara uses $200 of the buffer for a car repair', async () => {
    await goTab(page, 'Money');
    await page.getByRole('button', { name: 'I used some of it' }).click();
    await page.getByRole('textbox', { name: 'Amount used' }).fill('200');
    await page.getByLabel('What for? (optional)').fill('Car repair');
    await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('That’s what it’s for. Nothing went on a card. Your plan refills it first.')).toBeVisible();
    await expectBuffer(page, 300);

    await setDay(page, '2026-12-18');
    await expect(page.getByRole('checkbox', { name: /Buffer/ })).toContainText(near(107.69));
    await expect(page.getByRole('checkbox', { name: /extra/i })).toHaveCount(0);
    await expect(page.getByTestId('buffer-first')).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Car loan.*due Sun 20 Dec/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^I did it/ })).toContainText(near(435)); // 285 + 42.31 + 107.69
    await expect(pill).toContainText('November 2028');
  });

  await test.step('Payday 5 (18 Dec)', async () => {
    await iDidIt(page, 'Fri 18 Dec');
    await expectPaidPayday(page, { date: 'Fri 18 Dec', total: 435, buffer: 107.69, debtLeft: 14134.16 });
    await expectBuffer(page, 407.69);
  });

  // ---------------------------------------------------------------- part 9: a payday goes by
  await test.step('Payday 6 (1 Jan) goes by: calm banner, the date moves, nothing is applied', async () => {
    await setDay(page, '2027-01-02');
    await expect(page.getByText(/went by\. Did you do it\?/)).toBeVisible();
    await page.getByRole('button', { name: 'I skipped it' }).click();
    await expect(page.getByText('Life happens. Never miss twice. Here’s your updated date.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Next payday' })).toBeVisible();
    await expect(page.getByText('Fri 15 Jan').first()).toBeVisible();
    await expect(pill).toContainText('November 2028'); // 3 Nov 2028
    await shot(page, '22-sara-missed');
    await goTab(page, 'Progress');
    await expect(page.getByTestId('to-go')).toContainText('$14,134'); // unchanged
  });

  // ---------------------------------------------------------------- part 10: update from statement
  await test.step('Update from my statement: Store card is really $531.60', async () => {
    await goTab(page, 'Debts');
    await page.getByRole('button', { name: 'Store card, options' }).click();
    await page.getByRole('button', { name: 'Update from my statement' }).click();
    await expect(page.getByRole('textbox', { name: 'Balance on statement' })).toHaveValue('520.23');
    await page.getByRole('textbox', { name: 'Balance on statement' }).fill('531.60');
    await page.getByRole('button', { name: 'Update balance' }).click();
    await goTab(page, 'Progress');
    await expect(page.getByTestId('to-go')).toContainText('$14,146'); // 14,145.53
    await goTab(page, 'Today');
    await expect(pill).toContainText('November 2028');
  });

  // ---------------------------------------------------------------- part 11: paydays 7 to 12
  const table = [
    // total = bills due before the next payday + yearly bills 42.31 + buffer + extra
    { day: '2027-01-15', label: 'Fri 15 Jan', total: 435, bills: 'Car loan $285, due 20 Jan', buffer: 92.31, extra: { amount: 15.38, to: 'Store card' }, debtLeft: 13905.83 },
    { day: '2027-01-29', label: 'Fri 29 Jan', total: 235, bills: 'Medical bill $50, due 1 Feb', buffer: 0, extra: { amount: 107.69, to: 'Store card' }, debtLeft: 13773.21 },
    { day: '2027-02-12', label: 'Fri 12 Feb', total: 531, bills: 'Visa $96, due 12 Feb', buffer: 0, extra: { amount: 107.69, to: 'Store card' }, debtLeft: 13343.5 },
    { day: '2027-02-26', label: 'Fri 26 Feb', total: 235, bills: 'Store card $35, due 5 Mar', buffer: 0, extra: { amount: 107.69, to: 'Store card' }, debtLeft: 13207.37 },
    { day: '2027-03-12', label: 'Fri 12 Mar', total: 531, bills: 'Car loan $285, due 20 Mar', buffer: 0, extra: { amount: 107.69, to: 'Store card' }, debtLeft: 12774.1 },
  ];
  for (const [i, row] of table.entries()) {
    await test.step(`Payday ${i + 7} (${row.label})`, async () => {
      await setDay(page, row.day);
      await goTab(page, 'Today');
      await expect(page.getByRole('checkbox', { name: new RegExp(row.bills.replace(/ \$[\d.]+, due /, '.*due [A-Z][a-z]{2} ')) })).toBeVisible();
      await expect(page.getByRole('button', { name: /^I did it/ })).toContainText(near(row.total));
      await iDidIt(page, row.label);
      await expectPaidPayday(page, { date: row.label, total: row.total, buffer: row.buffer, extra: row.extra, debtLeft: row.debtLeft });
      if (i === 0) await expectBuffer(page, 500);
    });
  }

  await test.step('Payday 12 (26 Mar): Store card is paid with its own minimum', async () => {
    await setDay(page, '2027-03-26');
    await goTab(page, 'Today');
    await expect(page.getByRole('checkbox', { name: /Medical bill.*due Thu 1 Apr/ })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Store card.*due [A-Z][a-z]{2} 5 Apr/ })).toContainText(near(35.11)); // its bill plus the cents that finish it
    await expect(page.getByRole('checkbox', { name: /Medical bill.*extra/i })).toContainText(near(157.58)); // bill 50 + extra 107.58
    await expect(page.getByRole('button', { name: /^I did it/ })).toContainText(near(235)); // 50 + 35.11 + 42.31 + 107.58
    await tapDidIt(page);
    await expect(page.getByText('Fri 26 Mar is paid.')).toBeVisible();
    await expect(page.getByText('PAID. One down.')).toBeVisible();
    // The rollover is said in words: its bill goes on into the extra for the next debt
    await expect(page.getByTestId('paid-moment')).toContainText('Store card is paid. Its $35 bill now rolls into the extra for Medical bill.');
    await page.getByRole('button', { name: 'Next payday' }).click();
    await expectPaidPayday(page, { date: 'Fri 26 Mar', total: 235, extra: { amount: 107.58, to: 'Medical bill' }, debtLeft: 12634.4 });
    await goTab(page, 'Debts');
    await expect(page.getByRole('region', { name: 'Store card' })).toContainText('PAID');
    await goTab(page, 'Progress');
    await expect(page.getByRole('listitem', { name: 'First debt gone, reached' })).toBeVisible();
  });

  // ---------------------------------------------------------------- the most important test: rollover
  await test.step('Rollover (23 Apr): the freed bill goes into the extra, the total stays', async () => {
    await setDay(page, '2027-04-09');
    await goTab(page, 'Today');
    await iDidIt(page, 'Fri 9 Apr'); // its window holds Visa (12 Apr) and the Car loan (20 Apr), not the paid Store card
    await setDay(page, '2027-04-23');
    await goTab(page, 'Today');
    // The next window holds Medical bill (1 May) and the paid Store card (5 May): its $35 bill rolls into the extra
    await expect(page.getByRole('checkbox', { name: /Medical bill.*extra/i })).toContainText('$142.69'); // it was $107.69
    await expect(page.getByRole('checkbox', { name: /Medical bill.*due Sat 1 May/ })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Store card/ })).toHaveCount(0); // paid off, so no row of its own
    await expect(page.getByRole('checkbox', { name: /Visa|Car loan/ })).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: /Yearly bills/ })).toContainText('$42.31');
    await expect(page.getByRole('button', { name: 'I did it · $235' })).toBeVisible(); // 50 + 42.31 + 142.69, the same size as before
    await shot(page, '23-sara-rollover');
  });

  // ---------------------------------------------------------------- part 12: what-if and payoff order
  await test.step('What-if +$50 each payday: 11 Aug 2028, 6 paydays sooner, $168 less interest', async () => {
    await goTab(page, 'Plan');
    await page.getByRole('button', { name: 'What if I add more?' }).click();
    await page.getByLabel('Add money each payday').fill('50');
    const result = page.getByTestId('whatif-result');
    await expect(result).toContainText('August 2028');
    await expect(result).toContainText('6 paydays sooner');
    await expect(result).toContainText('$168 less interest');
    await shot(page, '24-sara-whatif');
    await page.getByLabel('Add money each payday').fill('0'); // not applied
    await page.getByRole('button', { name: 'Close' }).click();
  });

  await test.step('Biggest interest first: a small saving in v2, so PaidInYellow order stays recommended', async () => {
    await page.getByRole('button', { name: 'change', exact: true }).click();
    await page.getByRole('radio', { name: /Biggest interest first/ }).click();
    await expect(page.getByTestId('order-comparison')).toContainText('Biggest interest first would save $80, a small difference.');
    await page.getByRole('radio', { name: /^PaidInYellow order/ }).click();
    await expect(page.getByRole('radio', { name: /^PaidInYellow order/ })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.getByTestId('status-line')).toContainText('Nov 2028');
    await goTab(page, 'Today');
    await expect(page.getByRole('region', { name: 'Focus debt' })).toContainText('Medical bill'); // the focus did not jump
  });

  // ---------------------------------------------------------------- part 13: Progress
  await test.step('Progress: 12 paid paydays, the skipped one is not paid, 3 milestones', async () => {
    await goTab(page, 'Progress');
    await expect(page.getByRole('listitem', { name: /: paid$/ })).toHaveCount(12);
    await expect(page.getByRole('listitem', { name: 'Fri 1 Jan: skipped' })).toBeVisible();
    await expect(page.getByRole('listitem', { name: 'Plan made' })).toBeVisible(); // the second pre-filled square
    for (const m of ['First extra payment', 'First debt gone']) {
      await expect(page.getByRole('listitem', { name: `${m}, reached` })).toBeVisible();
    }
    await expect(page.getByRole('img', { name: /Balance over time/ })).toBeVisible();
    await expect(page.getByTestId('planned-vs-actual')).toContainText('This month:'); // Fri 9 Apr is in April
    await shot(page, '25-sara-progress');

    // The picture to share is a PNG (no amounts: it is drawn from percentages only)
    await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true }));
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Share my progress' }).click()]);
    const bytes = readFileSync((await download.path())!);
    expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(bytes.length).toBeGreaterThan(5000);
  });

  // ---------------------------------------------------------------- part 14: reload and backup
  await test.step('Closing and opening the app again shows the same numbers', async () => {
    await page.reload();
    await expect(page.getByRole('navigation').first()).toBeVisible();
    await expectPaidPayday(page, { date: 'Fri 26 Mar', total: 235, debtLeft: 12634.4 });
  });

  await test.step('Backup, then restore on a clean phone: everything comes back', async () => {
    await page.getByRole('button', { name: 'Today' }).click();
    await page.getByRole('button', { name: 'Settings' }).click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Back up my plan' }).click()]);
    const file = info.outputPath('sara-backup.json');
    await download.saveAs(file);

    const ctx = await browser.newContext({ ...info.project.use });
    const other = await ctx.newPage();
    await other.clock.setFixedTime(new Date('2027-04-09T10:00:00'));
    await other.goto('/');
    await other.getByLabel('Backup file').setInputFiles(file);
    await expect(other.getByRole('dialog')).toContainText('4 debts, 13 paydays logged'); // 12 paid and 1 skipped
    await other.getByRole('button', { name: 'Restore it', exact: true }).click();
    await expect(other.getByTestId('debt-free-pill')).toContainText('November 2028');
    await expect(other.getByTestId('greeting')).toBeVisible();
    await goTab(other, 'Plan');
    await showPaydays(other, 'Done');
    await other.getByRole('button', { name: 'Fri 26 Mar, paid', exact: true }).click();
    await expect(other.getByTestId('debt-left-after')).toContainText(near(12634.4));
    await other.getByRole('button', { name: 'Close' }).click();
    await goTab(other, 'Money');
    await expect(other.getByRole('region', { name: 'Buffer' })).toContainText('$500 of $500');
    await other.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Debts', exact: true }).click();
    await expect(other.getByRole('region', { name: 'Store card' })).toContainText('PAID');
    await ctx.close();
  });

  await test.step('Calendar file: paydays and due dates with a reminder 3 days before', async () => {
    // still on Settings from the backup step
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Add to my calendar' }).click()]);
    const ics = readFileSync((await download.path())!, 'utf8');
    expect(ics).toContain('DTSTART;VALUE=DATE:20270423'); // the next payday
    expect(ics).toContain('SUMMARY:Open PaidInYellow: payday check');
    expect(ics).toContain('DTSTART:20270423T190000'); // 7 pm
    expect(ics).toContain('SUMMARY:Visa due');
    expect(ics).toContain('TRIGGER:-P3D');
    expect(ics).not.toContain('Store card due'); // paid off
  });

  // ---------------------------------------------------------------- part 15: brand rules, dark mode, big text
  await test.step('Brand rules on every screen: no red, yellow is never text, no loans or transfers', async () => {
    await page.getByRole('button', { name: 'Back to Today' }).click();
    for (const tab of ['Today', 'Plan', 'Debts', 'Progress', 'Money'] as const) {
      await goTab(page, tab);
      await expectBrandRules(page);
      await expectNoSidewaysScroll(page);
    }
    await page.getByRole('button', { name: 'Today' }).click();
    await page.getByRole('button', { name: 'Settings' }).click();
    await expectBrandRules(page);
  });

  await test.step('Dark mode and a larger text size: nothing cut off, still no red', async () => {
    await page.getByRole('button', { name: 'Change Theme' }).click();
    await page.getByRole('radio', { name: 'Dark' }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('button', { name: 'Change Text size' }).click();
    await page.getByRole('radio', { name: 'Larger' }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('20.8px');
    await expectBrandRules(page);
    await expectNoSidewaysScroll(page);
    await page.getByRole('button', { name: 'Back to Today' }).click();
    for (const tab of ['Today', 'Plan', 'Debts', 'Progress', 'Money'] as const) {
      await goTab(page, tab);
      await expectBrandRules(page);
      await expectNoSidewaysScroll(page);
    }
    await goTab(page, 'Today');
    await shot(page, '26-sara-dark-large');
  });
});

// ------------------------------------------------------------------ part 16: three short cases

test('Case B: a debt that grows, paid twice a month (15th and last day)', async ({ page }) => {
  await runWizard(page, {
    frequency: 'Twice a month',
    twiceDays: '15th and last day',
    nextPayday: '2026-10-31',
    debts: [
      { name: 'Old card', balance: '5,200', apr: '29.99', min: '90', due: '3' },
      { name: 'Phone plan', balance: '400', apr: '0', min: '40', due: '10' },
      { name: 'Student loan', balance: '18,000', apr: '5.5', min: '210', due: '15' },
      { name: 'Mom', balance: '1,000', apr: '0', min: '0', due: '1' },
    ],
    bufferNow: '0',
    bufferGoal: '800',
    extra: '120',
    yearly: [
      { idea: 'Car repairs', amount: '600' },
      { idea: 'Gifts and holidays', amount: '500', month: 'December' },
    ],
  });

  // Minimums only never ends, and the plan ends it
  await expect(page.getByText('Never ends').first()).toBeVisible();
  await expect(page.getByText('Your plan ends it')).toBeVisible();
  await expect(page.getByTestId('debt-free-date')).toHaveText('March 2032'); // 31 Mar 2032
  await startPlan(page);

  await test.step('Warning on Old card only, and the payoff order', async () => {
    await goTab(page, 'Debts');
    await expect(page.getByRole('region', { name: 'Old card' })).toContainText('Grows even with the minimum, so it goes first.');
    await expect(page.getByRole('region', { name: 'Mom' })).not.toContainText('grows');
    await expect(page.getByRole('region', { name: 'Phone plan' })).not.toContainText('grows');
    const order = await page.locator('main section[aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    expect(order.filter((n) => ['Old card', 'Phone plan', 'Mom', 'Student loan'].includes(n!))).toEqual(['Old card', 'Phone plan', 'Mom', 'Student loan']);
  });

  await test.step('Payday dates: 31 Oct, 15 Nov, 30 Nov, 15 Dec, 31 Dec, 15 Jan', async () => {
    await goTab(page, 'Plan');
    await showPaydays(page, 'Upcoming');
    for (const label of ['Sat 31 Oct', 'Sun 15 Nov', 'Mon 30 Nov', 'Tue 15 Dec', 'Thu 31 Dec', 'Fri 15 Jan 2027']) { // the year shows once a date is not in the current year
      await expect(page.getByRole('button', { name: `${label}, to come`, exact: true })).toBeVisible();
    }
    await expect(page.getByTestId('status-line')).toHaveText('Debt-free by Mar 2032 · 131 paydays left');
    await page.getByRole('button', { name: 'Close' }).click();
  });

  await test.step('First payday: the buffer comes first', async () => {
    await goTab(page, 'Today');
    await revealEarly(page);
    // 31 Oct up to 15 Nov: Old card (3 Nov) and Phone plan (10 Nov). Student loan is due on the next payday itself.
    await expect(page.getByRole('checkbox', { name: /Old card.*due Tue 3 Nov/ })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Phone plan.*due Tue 10 Nov/ })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Student loan|Mom/ })).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: /Yearly bills/ })).toContainText(near(45.83));
    await expect(page.getByRole('checkbox', { name: /Buffer/ })).toContainText(near(74.17));
    await expect(page.getByRole('button', { name: /^I did it/ })).toContainText(near(250)); // 130 + 45.83 + 74.17
    await expect(page.getByTestId('buffer-first')).toBeVisible();
    await expect(page.getByTestId('debt-free-pill')).toContainText('March 2032');
  });
});

test('Case C: the well-known $8,000 at 24%', async ({ page }) => {
  await runWizard(page, {
    frequency: 'Every month',
    nextPayday: '2026-11-01',
    debts: [{ name: 'Card', balance: '8,000', apr: '24', min: '240', due: '1' }],
    bufferNow: '0',
    bufferGoal: '0',
    extra: '0',
  });
  await expect(page.getByTestId('debt-free-date')).toHaveText('June 2031'); // 1 Jun 2031
  await startPlan(page);
  await revealEarly(page);
  await expect(page.getByRole('checkbox', { name: /Card.*due Sun 1 Nov/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^I did it/ })).toContainText('$240');
  await goTab(page, 'Plan');
  await expect(page.getByTestId('status-line')).toHaveText('Debt-free by Jun 2031 · 56 paydays left');
  await showPaydays(page, 'Upcoming');
  await page.getByRole('button', { name: 'Sun 1 Nov, to come', exact: true }).click();
  await expect(page.getByTestId('debt-left-after')).toContainText('$7,920.00');
});

test('Case D: the plan needs help, calmly, and never points to a loan', async ({ page }) => {
  await runWizard(page, {
    frequency: 'Every month',
    nextPayday: '2026-11-01',
    debts: [{ name: 'Card', balance: '5,000', apr: '29.99', min: '100', due: '1' }],
    bufferNow: '0',
    bufferGoal: '0',
    extra: '0',
  });
  await expect(page.getByRole('heading', { name: /more than 20 years/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your plan needs help' })).toBeVisible();
  await expect(page.getByText(/hardship programs/i)).toBeVisible();
  await expect(page.getByRole('link', { name: 'NFCC.org' })).toHaveAttribute('href', 'https://www.nfcc.org');
  await expectBrandRules(page);
  await shot(page, '27-needs-help');

  await startPlan(page);
  await expect(page.getByRole('heading', { name: 'Your plan needs help' })).toBeVisible();
  await expect(page.getByTestId('debt-free-pill')).toHaveText('More than 20 years');
  await expectBrandRules(page);
});
