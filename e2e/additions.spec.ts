/** Additions after testing the competitors: promo rates, "help me work it out", Worth knowing, extra money, notes, print, calendar. */
import { expect, test } from '@playwright/test';
import { FIXED, quickSetup } from './helpers';
import { expectBrandRules, goTab, tapDidIt } from './scenario';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
});

test.describe('1 · promo rate per debt', () => {
  test('a deferred promo that will not be cleared in time shows a calm note and goes first', async ({ page }) => {
    await quickSetup(page);
    await goTab(page, 'Debts');
    await page.getByRole('button', { name: 'Add a debt' }).click();
    const add = page.getByRole('dialog', { name: 'Add a debt' });
    await add.getByLabel('Name').fill('Furniture card');
    await add.getByRole('textbox', { name: 'Balance' }).fill('3000');
    await add.getByRole('textbox', { name: 'Interest rate' }).fill('14.99');
    await add.getByRole('button', { name: 'Add minimum and due day now' }).click();
    await add.getByLabel('Monthly minimum').fill('50');
    await add.getByLabel('Due day (recommended)').fill('12');
    await add.getByRole('textbox', { name: 'Promo rate' }).fill('0');
    await add.getByLabel('Promo ends on').fill('2026-12-31');
    await add.getByRole('checkbox', { name: /Interest is deferred/ }).check();
    await add.getByRole('button', { name: 'Save', exact: true }).click();

    const card = page.getByRole('region', { name: 'Furniture card' });
    await expect(card.getByTestId('promo-line')).toHaveText('Promo rate 0% until Thu 31 Dec · interest is deferred');
    await expect(card.getByTestId('promo-note')).toContainText('Furniture card’s promo ends Thu 31 Dec.');
    await expect(card.getByTestId('promo-note')).toContainText('will still be owing then');
    await expect(card.getByTestId('promo-note')).toContainText('back interest');
    await expect(card.getByTestId('promo-note')).toContainText('It goes first until then.');
    await expect(card).toContainText('1 · Paying now'); // the promo debt moved to the front
    await expectBrandRules(page);
  });

  test('a promo needs both its rate and its end date, and clearing it removes the note', async ({ page }) => {
    await quickSetup(page);
    await goTab(page, 'Debts');
    await page.getByRole('button', { name: 'Visa, options' }).click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Edit Visa' });
    await form.getByRole('textbox', { name: 'Promo rate' }).fill('0');
    await form.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(form).toContainText('Add the day the promo ends');
    await form.getByLabel('Promo ends on').fill('2027-02-01');
    await form.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Visa' }).getByTestId('promo-line')).toContainText('Promo rate 0% until');
  });
});

test.describe('2 · "Help me work it out" on the money step', () => {
  async function toMoneyStep(page: import('@playwright/test').Page) {
    await page.goto('/');
    await page.getByRole('radio', { name: 'Every 2 weeks', exact: true }).click();
    await page.getByLabel('Your next payday').fill('2026-10-23');
    await page.getByRole('button', { name: /^Continue$/ }).click();
    const card = page.locator('fieldset');
    await card.getByLabel('Name').fill('Visa');
    await card.getByLabel('Balance').fill('3200');
    await card.getByLabel('Monthly minimum').fill('96');
    await card.getByLabel('Due day').fill('12');
    await page.getByRole('button', { name: /^(Continue|That’s all of them)$/ }).click();
    await expect(page.getByRole('heading', { name: 'Money for the plan' })).toBeVisible();
  }

  test('take-home and essentials give what is left, and "Use all of it" fills the amount', async ({ page }) => {
    await toMoneyStep(page);
    await page.getByTestId('help-work-out').click();
    const sheet = page.getByRole('dialog', { name: 'Help me work it out' });
    await sheet.getByLabel('Take-home per paycheck').fill('900');
    await sheet.getByLabel('Essentials per paycheck').fill('400');
    // 96 a month of minimums, every 2 weeks: about 44 per paycheck, so 900 - 400 - 44 = 456
    await expect(sheet.getByTestId('help-minimums')).toContainText('about $44 per paycheck');
    await expect(sheet.getByTestId('help-result')).toContainText('About $455 is left. Put some or all of it toward the plan.');
    await sheet.getByRole('button', { name: 'Use half' }).click();
    await expect(page.getByLabel('Money for the plan each payday')).toHaveValue('227');
    await page.getByTestId('help-work-out').click();
    await page.getByRole('dialog', { name: 'Help me work it out' }).getByRole('button', { name: 'Use all of it' }).click();
    await expect(page.getByLabel('Money for the plan each payday')).toHaveValue('455');
  });

  test('when nothing is left it says so calmly and offers no button', async ({ page }) => {
    await toMoneyStep(page);
    await page.getByTestId('help-work-out').click();
    const sheet = page.getByRole('dialog', { name: 'Help me work it out' });
    await sheet.getByLabel('Take-home per paycheck').fill('500');
    await sheet.getByLabel('Essentials per paycheck').fill('480');
    await expect(sheet.getByTestId('help-result')).toContainText('Nothing is left after your essentials and minimums right now. That happens.');
    await expect(sheet.getByRole('button', { name: 'Use all of it' })).toHaveCount(0);
    await expectBrandRules(page);
  });
});

test.describe('3 · Worth knowing on Path', () => {
  test('hidden when empty; calm sentences from the buyer’s own numbers once there is something to say', async ({ page }) => {
    await quickSetup(page);
    await goTab(page, 'Path');
    await expect(page.getByTestId('worth-knowing')).toHaveCount(0);

    // A bill with no due day, and some of the buffer used
    await goTab(page, 'Debts');
    await page.getByRole('button', { name: 'Add a debt' }).click();
    const add = page.getByRole('dialog', { name: 'Add a debt' });
    await add.getByLabel('Name').fill('Phone plan');
    await add.getByRole('textbox', { name: 'Balance' }).fill('300');
    await add.getByRole('textbox', { name: 'Interest rate' }).fill('0');
    await add.getByRole('button', { name: 'Add minimum and due day now' }).click();
    await add.getByLabel('Monthly minimum').fill('40');
    await add.getByRole('button', { name: 'Save', exact: true }).click();
    await goTab(page, 'Safety net');
    await page.getByRole('button', { name: 'I used some of it' }).click();
    await page.getByRole('textbox', { name: 'Amount used' }).fill('200');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await goTab(page, 'Path');
    const card = page.getByTestId('worth-knowing');
    await expect(card).toContainText('Phone plan has no due day yet, so its bill is not in your plan.');
    await expect(card).toContainText('You used some of your buffer. Your plan refills it first: $300 of $500 so far.');
    await expect(card.locator('li')).toHaveCount(2);
    await expectBrandRules(page);
  });
});

test.describe('4 · "I got extra money" on Today', () => {
  test('shows the new date and the interest saved first, and "Use it" puts it on the focus debt', async ({ page }) => {
    await quickSetup(page);
    const focus = page.getByRole('region', { name: 'Focus debt' });
    await expect(focus).toContainText('$640 left');
    await page.getByTestId('got-extra').click();
    const sheet = page.getByRole('dialog', { name: 'I got extra money' });
    await expect(sheet.getByTestId('windfall-preview')).toHaveCount(0); // nothing until an amount is typed
    await sheet.getByLabel('Extra money').fill('300');
    const preview = sheet.getByTestId('windfall-preview');
    await expect(preview).toContainText('Debt-free');
    await expect(preview).toContainText(/less interest|sooner|same date/);
    await expect(focus).toContainText('$640 left'); // not applied yet
    await sheet.getByRole('button', { name: 'Use it' }).click();
    await expect(focus).toContainText('$340 left');
    await goTab(page, 'Debts');
    await page.getByRole('button', { name: 'Store card, options' }).click();
    await page.getByRole('button', { name: 'History', exact: true }).click();
    await expect(page.getByTestId('debt-history')).toContainText('Extra payment'); // it is in the History list
  });
});

test.describe('5 · lender, notes and type "Family or friend"', () => {
  test('they are saved on the debt card, and can be cleared', async ({ page }) => {
    await quickSetup(page);
    await goTab(page, 'Debts');
    await page.getByRole('button', { name: 'Visa, options' }).click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Edit Visa' });
    await form.getByLabel('Type (optional)').selectOption('Family or friend');
    await form.getByLabel('Lender (optional)').fill('Aunt Sara');
    await form.getByLabel('Notes (optional)').fill('Pays back on the 1st');
    await form.getByRole('button', { name: 'Save', exact: true }).click();
    const card = page.getByRole('region', { name: 'Visa' });
    await expect(card.getByTestId('debt-meta')).toHaveText('Family or friend · Aunt Sara');
    await expect(card.getByTestId('debt-notes')).toHaveText('Pays back on the 1st');

    await page.getByRole('button', { name: 'Visa, options' }).click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const again = page.getByRole('dialog', { name: 'Edit Visa' });
    await expect(again.getByLabel('Lender (optional)')).toHaveValue('Aunt Sara'); // it comes back when editing
    await again.getByLabel('Lender (optional)').fill('');
    await again.getByLabel('Notes (optional)').fill('');
    await again.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(card.getByTestId('debt-notes')).toHaveCount(0);
    await expect(card.getByTestId('debt-meta')).toHaveText('Family or friend');
    await expectBrandRules(page);
  });
});

test.describe('6 · print and CSV', () => {
  test.beforeEach(async ({ page }) => {
    // The print dialog is not part of the test: count the call, and look at what would be on the paper
    await page.addInitScript(() => {
      (window as unknown as { __printed: number }).__printed = 0;
      window.print = () => {
        (window as unknown as { __printed: number }).__printed += 1;
      };
    });
  });

  test('"Print this payday" is a sheet of lines with due dates and tick boxes', async ({ page }) => {
    await quickSetup(page);
    await goTab(page, 'Path');
    await page.getByRole('button', { name: 'Print or export' }).click();
    await page.getByRole('button', { name: 'Print this payday' }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1);
    await page.emulateMedia({ media: 'print' });
    const sheet = page.getByTestId('print-payday');
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('This payday · Fri 23 Oct');
    await expect(sheet).toContainText('Store card');
    await expect(sheet).toContainText('Thu 5 Nov'); // its due date
    await expect(sheet).toContainText('$185.00');
    await expect(sheet.locator('.tick')).toHaveCount(1); // one line to tick (the bill and the extra are one line)
    await expect(sheet).toContainText('A planning tool, not financial advice.');
  });

  test('"Print my debts" lists each debt in order with balance, rate, minimum and due day', async ({ page }) => {
    await quickSetup(page);
    await goTab(page, 'Path');
    await page.getByRole('button', { name: 'Print or export' }).click();
    await page.getByRole('button', { name: 'Print my debts' }).click();
    await page.emulateMedia({ media: 'print' });
    const sheet = page.getByTestId('print-debts');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('tbody tr')).toHaveCount(2);
    await expect(sheet.locator('tbody tr').first()).toContainText('Store card');
    await expect(sheet.locator('tbody tr').first()).toContainText('$640.00');
    await expect(sheet.locator('tbody tr').first()).toContainText('26.99%');
    await expect(sheet.locator('tbody tr').nth(1)).toContainText('Visa');
  });

  test('"Export my payments (CSV)" has one line per payment', async ({ page }) => {
    await quickSetup(page);
    await tapDidIt(page);
    await expect(page.getByTestId('paid-card')).toBeVisible();
    await goTab(page, 'Path');
    await page.getByRole('button', { name: 'Print or export' }).click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export my payments (CSV)' }).click()]);
    expect(download.suggestedFilename()).toBe('paidinyellow-payments.csv');
    const text = (await import('node:fs')).readFileSync((await download.path())!, 'utf8');
    expect(text.split('\r\n')[0]).toBe('Date,Paid to,What,Amount,Payday number,From the plan');
    expect(text).toContain('Store card,Bill,35.00');
    expect(text).toContain('Store card,Extra,150.00');
  });
});

test.describe('7 · calendar', () => {
  test('the calendar file has one monthly reminder per debt and Settings links the payday check to Google Calendar', async ({ page }) => {
    await quickSetup(page);
    await page.getByRole('button', { name: 'Settings' }).click();
    const link = page.getByTestId('google-cal');
    await expect(link).toHaveText('Add to Google Calendar');
    const href = (await link.getAttribute('href'))!;
    const q = new URL(href).searchParams;
    expect(q.get('text')).toBe('Open PaidInYellow: payday check');
    expect(href).not.toMatch(/Visa|Store|\$/);
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Add to my calendar' }).click()]);
    const ics = (await import('node:fs')).readFileSync((await download.path())!, 'utf8');
    expect(ics.match(/RRULE:FREQ=MONTHLY;BYMONTHDAY=12/g)).toHaveLength(1);
    expect(ics.match(/RRULE:FREQ=MONTHLY;BYMONTHDAY=5/g)).toHaveLength(1);
    expect(ics.match(/SUMMARY:Visa due/g)).toHaveLength(1);
  });
});
