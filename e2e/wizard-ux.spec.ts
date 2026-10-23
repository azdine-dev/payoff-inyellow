/** Setup wizard: shorter and clearer. One debt open at a time, gentle checks, money step, currency, example. */
import { expect, test } from '@playwright/test';
import { FIXED } from './helpers';
import { expectBrandRules, goTab } from './scenario';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
});

const next = (page: import('@playwright/test').Page) => page.getByRole('button', { name: /^(Continue|Skip for now|See my plan|Let’s start)$/ });

async function toDebts(page: import('@playwright/test').Page) {
  await page.goto('/');
  await next(page).click(); // welcome
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
  await card.getByLabel('Due day (recommended)').fill('12');
  await page.getByRole('button', { name: 'Add another' }).click();

  await expect(page.getByTestId('debt-summary')).toHaveCount(1);
  await expect(page.getByTestId('debt-summary')).toContainText('Visa · $3,200 · 22.9% · $96/mo · due 12th');
  await expect(card).toHaveCount(1); // only the new debt is open
  await card.getByLabel('Name').fill('Store card');
  await card.getByLabel('Balance').fill('640');
  await card.getByLabel('Interest rate').fill('26.99');
  await card.getByLabel('Monthly minimum').fill('35');
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
  await expect(card).toContainText('Is 2290% right? Most cards are 15-30%.');
  // It is only a question: Continue still works, and the pasted "$3,200" was understood
  await next(page).click();
  await expect(page.getByRole('heading', { name: 'Your buffer' })).toBeVisible();

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
  };
  await add('Visa', '3200', '22.9', '96');
  await page.getByRole('button', { name: 'Add another' }).click();
  await add('Store card', '640', '26.99', '35');
  await page.getByRole('button', { name: 'Add another' }).click();
  await add('Car loan', '9800', '7.5', '285');
  await page.getByRole('button', { name: 'Add another' }).click();
  await add('Medical bill', '1150', '0', '50');
  await next(page).click(); // debts
  await next(page).click(); // buffer

  await expect(page.getByRole('heading', { name: 'Money for the plan' })).toBeVisible();
  await expect(page.getByTestId('minimums-line')).toHaveText('Your minimums: $466 a month, about $215 each payday.');
  const field = page.getByLabel('Money for the plan each payday');
  await page.getByRole('button', { name: '$100' }).click();
  await expect(field).toHaveValue('100');
  await expect(page.getByRole('button', { name: '$100' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '$20' }).click();
  await expect(field).toHaveValue('20');
  await field.fill('135'); // still editable
  await expect(page.getByRole('button', { name: '$20' })).toHaveAttribute('aria-pressed', 'false');
});

test('the currency is a small line on the pay schedule step, with Change', async ({ page }) => {
  await page.goto('/');
  await next(page).click(); // welcome
  await expect(page.getByLabel('Step 1 of 7')).toBeVisible();
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
  await expect(page.getByTestId('first-step')).toContainText('This payday');
  // No code box, no "Change my numbers" here: one clear way out
  await expect(page.getByTestId('unlock-card')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start with my numbers' })).toBeVisible();

  // A reload goes back to the welcome screen: nothing was stored
  await page.reload();
  await expect(page.getByRole('button', { name: 'Let’s start' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'See an example first' })).toBeVisible();

  // Start for real
  await page.getByRole('button', { name: 'See an example first' }).click();
  await page.getByRole('button', { name: 'Start with my numbers' }).click();
  await expect(page.getByRole('button', { name: 'Let’s start' })).toBeVisible();
  await page.getByRole('button', { name: 'Let’s start' }).click();
  await expect(page.getByRole('heading', { name: 'Your pay schedule' })).toBeVisible();
  await expect(page.getByLabel('Your next payday')).toHaveValue(''); // nothing from Sara carried over
});

test('"How we got this" shows the plain math behind the date and the first step', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'See an example first' }).click();
  // The first step names the bills, and its total adds up to the cent
  await expect(page.getByTestId('first-step-parts')).toContainText('Yearly bills $42.31 · Buffer $107.69');
  await expect(page.getByTestId('first-step-parts')).toContainText('Car loan $285 (due 20 Oct)'); // the example starts Fri 16 Oct, so the car loan is the bill before the next payday

  for (const name of ['How we got this date', 'How we got this step']) {
    await page.getByRole('button', { name }).click();
    const sheet = page.getByRole('dialog', { name: 'How we got this' });
    await expect(sheet).toContainText('Your minimums: $466 a month. Spread over 26 paydays a year, that is $215.08 each payday.');
    await expect(sheet).toContainText('Yearly bills: $1,100 a year, so $42.31 each payday.');
    await expect(sheet).toContainText('Buffer: $107.69 this payday. It comes first, until it reaches $500. You have $200 now.');
    await expect(sheet).toContainText('Extra for debts: $0.00 this payday. The buffer takes it first.');
    await expect(sheet).toContainText('Smallest first, so you see a debt disappear soon.');
    await sheet.getByRole('button', { name: 'Close' }).click();
    await expect(sheet).toHaveCount(0);
  }
});

test('the what-if shows each quick amount as a change, not a second plan', async ({ page }) => {
  const { quickSetup } = await import('./helpers');
  await quickSetup(page);
  await goTab(page, 'Plan');
  const group = page.getByRole('group', { name: 'Quick what-ifs' });
  for (const amount of ['$25', '$50', '$100']) {
    await expect(group.getByRole('button', { name: `+${amount} each payday`, exact: false })).toContainText(/sooner|same date/);
  }
  await group.getByRole('button', { name: /^\+\$50 each payday/ }).click();
  await expect(group.getByRole('button', { name: /^\+\$50 each payday/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Add money each payday')).toHaveValue('50'); // the slider follows
  await expect(page.getByTestId('whatif-result')).toContainText('instead of');
  // Tapping it again puts it back
  await group.getByRole('button', { name: /^\+\$50 each payday/ }).click();
  await expect(page.getByLabel('Add money each payday')).toHaveValue('0');
});

test('every main tab has the same header line, and the paydays left count down at "I did it"', async ({ page }) => {
  const { quickSetup } = await import('./helpers');
  const { goTab, tapDidIt } = await import('./scenario');
  await quickSetup(page);
  const line = page.getByTestId('status-line');
  const left = async () => Number((await line.innerText()).match(/(\d+) paydays? left/)![1]);

  const first = await line.innerText();
  expect(first).toMatch(/^Debt-free [A-Z][a-z]{2} 20\d\d · \d+ paydays left$/);
  for (const tab of ['Plan', 'Debts', 'Progress', 'Money', 'Today'] as const) {
    await goTab(page, tab);
    await expect(line).toHaveText(first);
  }
  const before = await left();
  await tapDidIt(page);
  await expect(page.getByText('Fri 23 Oct is paid.')).toBeVisible();
  expect(await left()).toBe(before - 1);
  await goTab(page, 'Progress');
  expect(await left()).toBe(before - 1);
});

test('each bill on Today says how soon it is due, and the checkbox name stays short', async ({ page }) => {
  const { quickSetup } = await import('./helpers');
  await quickSetup(page); // today is Thu 15 Oct; the first payday is Fri 23 Oct
  // Medical-style due days are not in the quick setup: Store card is due the 5th, Visa the 12th (after Nov payday?)
  const bills = page.getByRole('checkbox', { name: /due \d+ \w+$/ });
  await expect(bills.first()).toBeVisible();
  await expect(page.getByTestId('due-in').first()).toHaveText(/^(today|tomorrow|in \d+ days)$/);
  // The spoken name is the plain label, without the extra words
  const name = (await bills.first().getAttribute('aria-label')) ?? '';
  expect(name).not.toMatch(/in \d+ days|tomorrow/);
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

test('Progress starts with a countdown and shows the share paid as a ring', async ({ page }) => {
  const { quickSetup } = await import('./helpers');
  const { goTab, tapDidIt } = await import('./scenario');
  await quickSetup(page);
  await goTab(page, 'Progress');
  const countdown = page.getByTestId('countdown');
  await expect(countdown).toContainText(/\d+ paydays to go/);
  await expect(countdown).toContainText(/about \d+(\.5)? (years|months)/);
  await expect(countdown).toContainText(/Debt-free [A-Z][a-z]+ 20\d\d/);
  const ring = page.getByRole('progressbar', { name: 'Debt paid off' });
  await expect(ring).toHaveAttribute('aria-valuenow', '0');
  await expectBrandRules(page); // no red, no yellow text, no loan or transfer words
  const before = Number((await countdown.innerText()).match(/(\d+) paydays to go/)![1]);

  await goTab(page, 'Today');
  await tapDidIt(page);
  await expect(page.getByText('Fri 23 Oct is paid.')).toBeVisible();
  await goTab(page, 'Progress');
  expect(Number((await countdown.innerText()).match(/(\d+) paydays to go/)![1])).toBe(before - 1);
  await expect(page.getByTestId('paid-so-far')).not.toHaveText('$0');
  expect(Number(await ring.getAttribute('aria-valuenow'))).toBeGreaterThan(0);
});

test('Plan is a timeline by month with tags, and an Upcoming / Done switch', async ({ page }) => {
  const { quickSetup } = await import('./helpers');
  const { goTab, showPaydays, tapDidIt } = await import('./scenario');
  await quickSetup(page);
  await goTab(page, 'Plan');
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

  await goTab(page, 'Today');
  await tapDidIt(page);
  await expect(page.getByText('Fri 23 Oct is paid.')).toBeVisible();
  await goTab(page, 'Plan');
  await showPaydays(page, 'Done');
  const done = page.getByRole('button', { name: 'Fri 23 Oct, paid' }).locator('xpath=..');
  await expect(done.locator('.tag.paid').first()).toBeVisible(); // yellow once paid
  await expect(done.locator('.tag.paid', { hasText: 'Extra' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Fri 23 Oct, to come' })).toHaveCount(0);
  // Tapping a row still opens its details
  await done.getByRole('button').click();
  await expect(page.getByRole('dialog')).toContainText('Total');
});

test('the what-if shows three small cards and says nothing changes until you apply', async ({ page }) => {
  const { quickSetup } = await import('./helpers');
  const { goTab } = await import('./scenario');
  await quickSetup(page);
  await goTab(page, 'Plan');
  await expect(page.getByText('Try it here first. Nothing changes until you tap Apply to my plan.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply to my plan' })).toBeDisabled();
  await page.getByRole('button', { name: /^\+\$100 each payday/ }).click();
  const cards = page.getByTestId('whatif-result').locator('.card.mini');
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toContainText(/Debt-free\s+[A-Z][a-z]+ 20\d\d\s+instead of [A-Z][a-z]+ 20\d\d/);
  await expect(cards.nth(1)).toContainText(/\d+ paydays? sooner/);
  await expect(cards.nth(2)).toContainText(/\$\d[\d,]* less interest/);
  // The three sit side by side
  const tops = await cards.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
  await expect(page.getByRole('button', { name: 'Apply to my plan' })).toBeEnabled();
});

test('the focus debt card says what to pay this payday, when it is gone, and why it is first', async ({ page }) => {
  const { quickSetup } = await import('./helpers');
  await quickSetup(page); // Store card (due the 5th) is the smallest balance
  const focus = page.getByRole('region', { name: 'Focus debt' });
  await expect(focus).toContainText('Store card');
  await expect(page.getByTestId('focus-action')).toContainText(/Pay this payday: \$\d[\d,.]*( · gone by [A-Z][a-z]{2} 20\d\d)?/);
  await expect(page.getByTestId('focus-action')).toContainText('· gone by');
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
  await expect(dialog.getByLabel('Due day (recommended)')).toHaveCount(0);
  await dialog.getByLabel('Name').fill('Phone bill');
  await dialog.getByRole('textbox', { name: 'Balance' }).fill('400');
  await dialog.getByRole('textbox', { name: 'Interest rate' }).fill('0');
  await expect(dialog).toContainText('Until you add the minimum, the plan counts it as $0.');
  await dialog.getByRole('button', { name: 'Save' }).click();

  const card = page.getByRole('region', { name: 'Phone bill' });
  await expect(card).toContainText('$400');
  await expect(page.getByTestId('min-pending')).toHaveText('Add your minimum');
  await expect(card).not.toContainText('minimum $'); // no made-up minimum is shown

  // Fill it in later: the tag goes away and the minimum shows
  await page.getByRole('button', { name: 'Phone bill, options' }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('Monthly minimum')).toHaveValue('');
  await page.getByRole('dialog').getByLabel('Monthly minimum').fill('40');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('min-pending')).toHaveCount(0);
  await expect(card).toContainText('minimum $40');
});

test('ticking items on payday shows what is left, with a small ring that fills', async ({ page }) => {
  const { quickSetup } = await import('./helpers');
  await quickSetup(page);
  const money = (s: string) => Number(s.replace(/[^0-9.]/g, ''));
  const total = money((await page.getByRole('button', { name: /^I did it/ }).innerText()).split('·')[1]!);
  await expect(page.getByTestId('left-this-payday')).toHaveCount(0); // nothing ticked yet

  const extra = page.getByRole('checkbox', { name: /Extra →/ });
  const extraAmount = money((await extra.innerText()).match(/\$[\d,.]+/)![0]);
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
