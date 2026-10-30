/** Setup wizard: shorter and clearer. One debt open at a time, gentle checks, money step, currency, example. */
import { expect, test } from '@playwright/test';
import { FIXED } from './helpers';
import { expectBrandRules, goTab } from './scenario';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
});

const next = (page: import('@playwright/test').Page) => page.getByRole('button', { name: /^(Continue|That’s all of them|See my plan)$/ });

async function toDebts(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Every 2 weeks', exact: true }).click();
  await page.getByLabel('Your next payday').fill('2026-10-23');
  await next(page).click();
}

test('a finished debt becomes one line, and only one debt is open at a time', async ({ page }) => {
  await toDebts(page);
  const card = page.locator('fieldset');
  await card.getByLabel('Name').fill('Visa');
  await card.getByLabel('Balance').fill('3200');
  await card.getByLabel('Interest rate').fill('22.9');
  await card.getByLabel('Monthly minimum').fill('96');
  await card.getByLabel('Due day').fill('12');
  await page.getByRole('button', { name: 'Add another' }).click();

  await expect(page.getByTestId('debt-summary')).toHaveCount(1);
  await expect(page.getByTestId('debt-summary')).toContainText('Visa');
  await expect(page.getByTestId('debt-summary')).toContainText('22.9% · $96 a month · due the 12th');
  await expect(page.getByTestId('debt-summary')).toContainText('$3,200');
  await expect(card).toHaveCount(1); // only the new debt is open
  await card.getByLabel('Name').fill('Store card');
  await card.getByLabel('Balance').fill('640');
  await card.getByLabel('Interest rate').fill('26.99');
  await card.getByLabel('Monthly minimum').fill('35');
  await card.getByLabel('Due day').fill('5');
  await page.getByRole('button', { name: 'Add another' }).click();
  await expect(page.getByTestId('debt-summary')).toHaveCount(2);
  await expect(card).toHaveCount(1);

  // Edit opens that debt and closes the other one
  await page.getByRole('button', { name: 'Edit Visa' }).click();
  await expect(card).toHaveCount(1);
  await expect(card.getByLabel('Name')).toHaveValue('Visa');
  await expect(card.getByLabel('Balance')).toHaveValue('3200');
});

test('a number that looks like a typo is asked about, and never blocks', async ({ page }) => {
  await toDebts(page);
  const card = page.locator('fieldset');
  await card.getByLabel('Name').fill('Visa');
  await card.getByLabel('Balance').fill('$3,200');
  await card.getByLabel('Interest rate').fill('2290');
  await card.getByLabel('Monthly minimum').fill('96');
  await card.getByLabel('Due day').fill('12');
  await expect(card).toContainText('Is 2290% right? Most cards are 15-30%.');
  // It is only a question: Continue still works, and the pasted "$3,200" was understood
  await next(page).click();
  await expect(page.getByRole('heading', { name: 'Money for the plan' })).toBeVisible();

  // Low minimum for the balance
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Edit Visa' }).click();
  await card.getByLabel('Interest rate').fill('24');
  await card.getByLabel('Monthly minimum').fill('20');
  await expect(card).toContainText('At this minimum the balance won’t go down. Check the statement.');
});

test('the money step shows the minimums first and has quick amounts', async ({ page }) => {
  await toDebts(page);
  const card = page.locator('fieldset');
  const add = async (name: string, balance: string, apr: string, min: string) => {
    await card.getByLabel('Name').fill(name);
    await card.getByLabel('Balance').fill(balance);
    await card.getByLabel('Interest rate').fill(apr);
    await card.getByLabel('Monthly minimum').fill(min);
    await card.getByLabel('Due day').fill('10');
  };
  await add('Visa', '3200', '22.9', '96');
  await page.getByRole('button', { name: 'Add another' }).click();
  await add('Store card', '640', '26.99', '35');
  await page.getByRole('button', { name: 'Add another' }).click();
  await add('Car loan', '9800', '7.5', '285');
  await page.getByRole('button', { name: 'Add another' }).click();
  await add('Medical bill', '1150', '0', '50');
  await next(page).click(); // debts

  await expect(page.getByRole('heading', { name: 'Money for the plan' })).toBeVisible();
  await expect(page.getByTestId('minimums-line')).toHaveText('Your minimums: $466 a month.');
  const field = page.getByLabel('Money for the plan each payday');
  await page.getByRole('button', { name: '$100' }).click();
  await expect(field).toHaveValue('100');
  await expect(page.getByRole('button', { name: '$100' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '$20' }).click();
  await expect(field).toHaveValue('20');
  await field.fill('135'); // still editable
  await expect(page.getByRole('button', { name: '$20' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Other' })).toHaveAttribute('aria-pressed', 'true'); // 135 is none of the quick amounts
  // The buffer is on the same screen, with its goal at $500
  await expect(page.getByLabel('Buffer goal')).toHaveValue('500');
  await expect(page.getByLabel('Buffer now')).toBeVisible();
});

test('the currency is a small line on the pay schedule step, with Change', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Step 1 of 4')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your pay schedule' })).toBeVisible();
  await expect(page.getByTestId('currency-line')).toHaveText('Currency: USD ($)');
  await expect(page.getByLabel('Currency')).toHaveCount(0); // closed until asked
  await page.getByRole('button', { name: 'Change' }).click();
  await page.getByLabel('Currency').selectOption('EUR');
  await expect(page.getByTestId('currency-line')).toHaveText('Currency: EUR (€)');
  await page.getByRole('radio', { name: 'Every 2 weeks', exact: true }).click();
  await page.getByLabel('Your next payday').fill('2026-10-23');
  await next(page).click();
  await page.locator('fieldset').getByLabel('Balance').fill('500');
  await expect(page.locator('fieldset')).toContainText('€'); // the euro sign follows to the next steps
});

test('"See an example first" shows Sara\'s result, labelled Example, and saves nothing', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'See an example first' }).click();
  await expectBrandRules(page);
  await expect(page.getByTestId('example-banner')).toContainText('Example');
  await expect(page.getByTestId('example-banner')).toContainText('Sara');
  await expect(page.getByTestId('debt-free-date')).toBeVisible();
  await expect(page.getByTestId('first-step')).toContainText('Move $');
  // No code box, no "Change my numbers" here: one clear way out
  await expect(page.getByTestId('unlock-card')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start with my numbers' })).toBeVisible();

  // A reload goes back to the welcome screen: nothing was stored
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your pay schedule' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'See an example first' })).toBeVisible();

  // Start for real
  await page.getByRole('button', { name: 'See an example first' }).click();
  await page.getByRole('button', { name: 'Start with my numbers' }).click();
  await expect(page.getByRole('heading', { name: 'Your pay schedule' })).toBeVisible();
  await expect(page.getByLabel('Your next payday')).toHaveValue(''); // nothing from Sara carried over
});

test('"How we got this" shows the plain math behind the date and the first step', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'See an example first' }).click();
  // The first step names the bills, and its total adds up to the cent
  await expect(page.getByTestId('first-step-parts')).toContainText('Yearly bills $42.31 · Buffer $107.69');
  await expect(page.getByTestId('first-step-parts')).toContainText('Car loan $285 (due 20 Oct)'); // the example starts Fri 16 Oct, so the car loan is the bill before the next payday

  for (const name of ['How we got this date']) { // one link only
    await page.getByRole('button', { name }).click();
    const sheet = page.getByRole('dialog', { name: 'How we got this' });
    await expect(sheet).toContainText('Your bills: $466 a month in all. Each one is paid on the payday before its due day, so some paydays have more bills than others. This payday: $285.00.');
    await expect(sheet).toContainText('Yearly bills: $1,100 a year, so $42.31 each payday.');
    await expect(sheet).toContainText('Buffer: $107.69 this payday. It comes first, until it reaches $500. You have $200 now.');
    await expect(sheet).toContainText('Extra for debts: $0.00 this payday. The buffer takes it first.');
    await expect(sheet).toContainText('Smallest first, so you see a debt disappear soon.');
    await sheet.getByRole('button', { name: 'Close' }).click();
    await expect(sheet).toHaveCount(0);
  }
});

test('"Pay a bit more?" shows four amounts, each with what it changes and a Use this button', async ({ page }) => {
  const { quickSetup } = await import('./helpers');
  await quickSetup(page);
  await goTab(page, 'Plan');
  await page.getByRole('button', { name: 'What if I add more?' }).click();
  const rows = page.getByTestId('more-row');
  await expect(rows).toHaveCount(4);
  for (const [i, amount] of ['$20', '$50', '$100', '$200'].entries()) {
    await expect(rows.nth(i)).toContainText(`+${amount} each payday`);
    await expect(rows.nth(i)).toContainText(/(same month|sooner)/);
    await expect(rows.nth(i).getByRole('button', { name: /^Use +/ })).toBeVisible();
  }
  await expect(page.getByLabel('Add money each payday')).toBeVisible(); // the slider stays below the table
});

test('Path says the date and the paydays left, and they count down at "I did it"', async ({ page }) => {
  const { quickSetup } = await import('./helpers');
  const { goTab, tapDidIt } = await import('./scenario');
  await quickSetup(page);
  const line = page.getByTestId('status-line');
  const left = async () => Number((await line.innerText()).match(/(\d+) paydays? left/)![1]);

  await goTab(page, 'Path');
  expect(await line.innerText()).toMatch(/^Debt-free by [A-Z][a-z]{2} 20\d\d · \d+ paydays left$/);
  const before = await left();
  await goTab(page, 'Today');
  await tapDidIt(page);
  await expect(page.getByText('Fri 23 Oct is paid.')).toBeVisible();
  await goTab(page, 'Path');
  expect(await left()).toBe(before - 1);
});

test('a calm Today: at most 3 cards above the fold, and every card has room around its text', async ({ page }) => {
  const { quickSetup } = await import('./helpers');
  await quickSetup(page);
  const stats = await page.evaluate(() => {
    const h = window.innerHeight;
    const cards = Array.from(document.querySelectorAll<HTMLElement>('main .card'));
    const above = cards.filter((c) => c.getBoundingClientRect().top < h - 80); // 80px = the tab bar
    const padding = Math.min(...cards.map((c) => parseFloat(getComputedStyle(c).paddingLeft)));
    const gaps = above.slice(1).map((c, i) => c.getBoundingClientRect().top - above[i]!.getBoundingClientRect().bottom);
    return { above: above.length, padding, minGap: gaps.length ? Math.min(...gaps) : 99 };
  });
  expect(stats.above).toBeLessThanOrEqual(3);
  expect(stats.padding).toBeGreaterThanOrEqual(20);
  expect(stats.minGap).toBeGreaterThanOrEqual(16);
});

test('Path starts at 0% and shows the share paid, in a card with three numbers', async ({ page }) => {
  const { quickSetup } = await import('./helpers');
  const { goTab, tapDidIt } = await import('./scenario');
  await quickSetup(page);
  await goTab(page, 'Progress');
  const line = page.getByTestId('status-line');
  await expect(line).toContainText(/\d+ paydays left/);
  await expect(page.getByTestId('pct-gone')).toHaveText('0%');
  const ring = page.getByRole('progressbar', { name: 'Debt paid off' });
  await expect(ring).toHaveAttribute('aria-valuenow', '0');
  for (const id of ['paid-so-far', 'to-go']) await expect(page.getByTestId(id)).toBeVisible();
  await expectBrandRules(page); // no red, no yellow text, no loan or transfer words
  const before = Number((await line.innerText()).match(/(\d+) paydays left/)![1]);

  await goTab(page, 'Today');
  await tapDidIt(page);
  await expect(page.getByText('Fri 23 Oct is paid.')).toBeVisible();
  await goTab(page, 'Progress');
  expect(Number((await line.innerText()).match(/(\d+) paydays left/)![1])).toBe(before - 1);
  await expect(page.getByTestId('paid-so-far')).not.toHaveText('$0');
  expect(Number(await ring.getAttribute('aria-valuenow'))).toBeGreaterThan(0);
});

test('Plan is a timeline by month with tags, and an Upcoming / Done switch', async ({ page }) => {
  const { quickSetup } = await import('./helpers');
  const { goTab, showPaydays, tapDidIt } = await import('./scenario');
  await quickSetup(page);
  await goTab(page, 'Plan');
  await showPaydays(page, 'Upcoming');
  // Upcoming: months as headings, then one row per payday with small tags
  await expect(page.getByRole('heading', { name: 'October 2026' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'November 2026' })).toBeVisible();
  const oct23 = page.getByRole('button', { name: 'Fri 23 Oct, to come' }).locator('xpath=..');
  await expect(oct23.locator('.tag').first()).toBeVisible(); // Extra (and the bills)
  await expect(oct23.locator('.tag.paid')).toHaveCount(0); // outline until it is paid
  // Done is empty at first
  await expectBrandRules(page);
  await showPaydays(page, 'Done');
  await expect(page.getByText('No paydays done yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  await goTab(page, 'Today');
  await tapDidIt(page);
  await expect(page.getByText('Fri 23 Oct is paid.')).toBeVisible();
  await goTab(page, 'Plan');
  await showPaydays(page, 'Done');
  const done = page.getByRole('button', { name: 'Fri 23 Oct, paid' }).locator('xpath=..');
  await expect(done.locator('.tag.paid').first()).toBeVisible(); // yellow once paid
  await expect(done.locator('.tag.paid', { hasText: 'Paid' })).toHaveCount(1);
  await expect(done.locator('.tag', { hasText: 'Extra' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Fri 23 Oct, to come' })).toHaveCount(0);
  // Tapping a row still opens its details
  await done.getByRole('button').click();
  await expect(page.getByRole('group', { name: 'Fri 23 Oct details' })).toContainText('Total');
});

test('the what-if shows three small cards and says nothing changes until you apply', async ({ page }) => {
  const { quickSetup } = await import('./helpers');
  const { goTab } = await import('./scenario');
  await quickSetup(page);
  await goTab(page, 'Plan');
  await page.getByRole('button', { name: 'What if I add more?' }).click();
  await expect(page.getByText('Try it here first. Nothing changes until you tap Use this in my plan.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Use this in my plan' })).toBeDisabled();
  await page.getByLabel('Add money each payday').fill('100');
  const cards = page.getByTestId('whatif-result').locator('.card.mini');
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toContainText(/Debt-free\s+[A-Z][a-z]+ 20\d\d\s+instead of [A-Z][a-z]+ 20\d\d/);
  await expect(cards.nth(1)).toContainText(/\d+ paydays? sooner/);
  await expect(cards.nth(2)).toContainText(/\$\d[\d,]* less interest/);
  // The three sit side by side
  const tops = await cards.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
  await expect(page.getByRole('button', { name: 'Use this in my plan' })).toBeEnabled();
});

test('the focus debt card says what to pay this payday, when it is gone, and why it is first', async ({ page }) => {
  const { quickSetup } = await import('./helpers');
  await quickSetup(page); // Store card (due the 5th) is the smallest balance
  const focus = page.getByRole('region', { name: 'Focus debt' });
  await expect(focus).toContainText('Store card');
  await expect(page.getByTestId('focus-sentence')).toContainText(/\d+% gone\./);
  await expect(focus).toContainText('gone by');
  await focus.getByRole('button', { name: 'Help: Why this one?' }).click(); // the reason sits behind the (?)
  await expect(page.getByTestId('focus-why')).toHaveText('Smallest balance, so it disappears first.');
});

test('Quick add: a debt needs only a name, a balance and a rate, and carries a soft tag until the minimum is added', async ({ page }) => {
  const { quickSetup } = await import('./helpers');
  const { goTab } = await import('./scenario');
  await quickSetup(page);
  await goTab(page, 'Debts');
  await page.getByRole('button', { name: 'Add a debt' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a debt' });
  // Only three fields to begin with
  await expect(dialog.getByLabel('Monthly minimum')).toHaveCount(0);
  await expect(dialog.getByLabel('Due day')).toHaveCount(0);
  await dialog.getByLabel('Name').fill('Phone bill');
  await dialog.getByRole('textbox', { name: 'Balance' }).fill('400');
  await dialog.getByRole('textbox', { name: 'Interest rate' }).fill('0');
  await expect(dialog).toContainText('Until you add the minimum, the plan counts it as $0.');
  await dialog.getByRole('button', { name: 'Save' }).click();

  const card = page.getByRole('region', { name: 'Phone bill' });
  await expect(card).toContainText('$400');
  await expect(page.getByTestId('min-pending')).toHaveText('Add your minimum');
  await expect(card).not.toContainText(/\$\d+ bill/); // no made-up minimum is shown

  // Fill it in later: the tag goes away and the minimum shows
  await page.getByRole('button', { name: 'Phone bill, options' }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('Monthly minimum')).toHaveValue('');
  await page.getByRole('dialog').getByLabel('Monthly minimum').fill('40');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('min-pending')).toHaveCount(0);
  await expect(card).toContainText('$40 bill');
});

test('ticking items on payday shows what is left, with a small ring that fills', async ({ page }) => {
  const { quickSetup } = await import('./helpers');
  const { addYearlyBills, goTab } = await import('./scenario');
  await quickSetup(page);
  await addYearlyBills(page, [{ idea: 'Car repairs', amount: '600' }]); // a second row, so one tick does not finish the payday
  await goTab(page, 'Today');
  await (await import('./scenario')).revealEarly(page);
  const money = (s: string) => Number(s.replace(/[^0-9.]/g, ''));
  const total = money((await page.getByRole('button', { name: /^I did it/ }).innerText()).split('·')[1]!);
  await expect(page.getByTestId('left-this-payday')).toHaveCount(0); // nothing ticked yet

  const extra = page.locator('.pc-rows').getByRole('checkbox').filter({ hasText: 'Store card' });
  const extraAmount = money((await extra.innerText()).match(/\$[\d,.]+/g)!.at(-1)!);
  await extra.click();
  const left = page.getByTestId('left-this-payday');
  await expect(left).toContainText(`Left this payday: $${(total - extraAmount).toFixed(2)}`);
  const ring = left.getByRole('progressbar', { name: 'Done this payday' });
  await expect(ring).toHaveAttribute('aria-valuenow', String(Math.round((extraAmount / total) * 100)));

  // Untick: back to nothing. "I did it" is still there to tick everything at once.
  await extra.click();
  await expect(left).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^I did it/ })).toBeVisible();
});
