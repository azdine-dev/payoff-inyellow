/**
 * The Today card lists the bills due between this payday and the next, each with its full monthly
 * minimum and its due date. Total = those bills + yearly bills + buffer/extra. A debt with no due
 * day shows "Visa $96, add a due day" and is not counted until it has one.
 */
import { expect, test } from '@playwright/test';
import { FIXED, shot } from './helpers';
import { goTab, near, runWizard, setDay, showPaydays, startPlan, tapDidIt, revealEarly } from './scenario';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED); // Thu 15 Oct 2026
});

test('setup asks for the due day, recommended, with where to find it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: 'Every 2 weeks' }).click();
  await page.getByLabel('Your next payday').fill('2026-10-23');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByLabel('Due day (recommended)')).toBeVisible();
  await expect(page.getByText('It’s on your statement. Without it we can’t plan this bill.')).toBeVisible();
  await expect(page.getByLabel('Due day (optional)')).toHaveCount(0);
  await shot(page, '31-due-day-setup');
});

test('the Today card: bills due before the next payday, and the window moves with each payday', async ({ page }) => {
  await runWizard(page, {
    frequency: 'Every 2 weeks',
    nextPayday: '2026-10-23',
    debts: [{ name: 'Car loan', balance: '9,800', apr: '7.5', min: '285', due: '28' }],
    bufferNow: '500',
    extra: '150',
  });
  await startPlan(page);
  await revealEarly(page);

  // Fri 23 Oct up to Fri 6 Nov: the car loan is due on 28 Oct, with its full monthly minimum
  await expect(page.getByRole('checkbox', { name: /Car loan.*Bill.*due Wed 28 Oct/ })).toBeVisible();
  await expect(page.getByText(/Minimums due/)).toHaveCount(0); // not the per-payday average (131.54)
  await expect(page.getByRole('button', { name: 'I did it · $435' })).toBeVisible(); // 285 + 150 extra
  await shot(page, '32-today-bills');

  // Tick the bill and the extra: the payday is applied
  await setDay(page, '2026-10-23');
  await tapDidIt(page);
  await expect(page.getByText('Fri 23 Oct is paid.')).toBeVisible();

  // Fri 6 Nov up to Fri 20 Nov: nothing is due, so only the extra
  await setDay(page, '2026-11-06');
  await expect(page.getByRole('button', { name: 'I did it · $150' })).toBeVisible(); // wait for the page first
  await expect(page.getByRole('checkbox', { name: /Car loan \$285/ })).toHaveCount(0); // no bill row (the extra row says "Extra → Car loan")
  await tapDidIt(page);
  await expect(page.getByText('Fri 6 Nov is paid.')).toBeVisible();

  // Fri 20 Nov up to Fri 4 Dec: the next car loan bill, due 28 Nov
  await setDay(page, '2026-11-20');
  await expect(page.getByRole('checkbox', { name: /Car loan.*Bill.*due Sat 28 Nov/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'I did it · $435' })).toBeVisible();

  // The Plan tab shows the same figures for the paydays ahead
  await goTab(page, 'Plan');
  await showPaydays(page, 'Upcoming');
  await page.getByRole('button', { name: 'Fri 20 Nov, to come', exact: true }).click();
  const ahead = page.getByRole('group', { name: 'Fri 20 Nov details' });
  await expect(ahead).toContainText(new RegExp(`Car loan, due 28 Nov\\s*${near(285).source}`));
  await expect(ahead).toContainText(new RegExp(`Total\\s*${near(435).source}`));
  await expect(ahead).not.toContainText('minimum');
  await showPaydays(page, 'Done');
  await page.getByRole('button', { name: 'Fri 6 Nov, paid', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Fri 6 Nov details' })).toContainText(new RegExp(`Total\\s*${near(150).source}`)); // what was set aside that payday
});

test('a debt with no due day: "Visa $96, add a due day", not counted, and the link sets it', async ({ page }) => {
  await runWizard(page, {
    frequency: 'Every 2 weeks',
    nextPayday: '2026-10-23',
    debts: [
      { name: 'Visa', balance: '3,200', apr: '22.9', min: '96' }, // no due day
      { name: 'Car loan', balance: '9,800', apr: '7.5', min: '285', due: '28' },
    ],
    bufferNow: '500',
    extra: '150',
  });
  await startPlan(page);
  await revealEarly(page);

  const noDay = page.getByTestId('no-due-day');
  await expect(noDay).toHaveCount(1);
  await expect(noDay).toContainText('Visa $96,');
  await expect(noDay.getByRole('button', { name: 'add a due day' })).toBeVisible();
  await expect(page.getByText('Not counted until you add a due day.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'I did it · $435' })).toBeVisible(); // car loan 285 + extra 150, not Visa
  await shot(page, '33-no-due-day');

  // A day that is not a day of the month gets a calm note
  await noDay.getByRole('button', { name: 'add a due day' }).click();
  await expect(page.getByRole('dialog')).toContainText('It’s on your statement.');
  await page.getByRole('textbox', { name: 'Day of the month' }).fill('32');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Type a day of the month, from 1 to 31.')).toBeVisible();

  // Visa is due on the 30th: before the next payday (6 Nov), so it counts now
  await page.getByRole('textbox', { name: 'Day of the month' }).fill('30');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /Visa.*due Fri 30 Oct/ })).toBeVisible();
  await expect(noDay).toHaveCount(0);
  await expect(page.getByText('Not counted until you add a due day.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'I did it · $531' })).toBeVisible(); // 96 + 285 + 150

  // The same day is now on the debt, and the Debts tab asks for it as "recommended"
  await goTab(page, 'Debts');
  await expect(page.getByRole('region', { name: 'Visa' })).toContainText('$96 bill on the 30th');
  await page.getByRole('button', { name: 'Visa, options' }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Due day (recommended)')).toHaveValue('30');
  await expect(page.getByRole('dialog')).toContainText('It’s on your statement.');
});
