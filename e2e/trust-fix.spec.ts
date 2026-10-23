/** Model v2: "I did it" applies what was shown. Plus the card rule, whole dollars, "N paydays left" and the chart axis. */
import { expect, test } from '@playwright/test';
import { FIXED, quickSetup } from './helpers';
import { goTab, setDay, tapDidIt } from './scenario';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED); // Thu 15 Oct 2026, the first payday is Fri 23 Oct
});

const num = (t: string) => Number(t.replace(/[^0-9.]/g, ''));

test('"I did it" pays the bill that was shown, and a debt with no bill this payday does not go down', async ({ page }) => {
  await quickSetup(page); // Store card is due on the 5th (in this payday's window), Visa on the 12th (the next one)
  const owed = async (name: string) => {
    await goTab(page, 'Debts');
    const t = await page.getByRole('region', { name }).locator('.debt-left').innerText();
    return num(t);
  };
  const visaBefore = await owed('Visa');
  const storeBefore = await owed('Store card');
  await goTab(page, 'Today');
  await tapDidIt(page);
  await expect(page.getByTestId('paid-card')).toContainText('PAID');
  await page.waitForTimeout(400); // the numbers roll for 200 ms
  expect(await owed('Visa')).toBeGreaterThanOrEqual(visaBefore); // no bill on this payday: interest only, never down
  expect(await owed('Store card')).toBeLessThan(storeBefore); // its bill and the extra went to it
});

test('Today says how many paydays are left on a day that is not a payday, and "After today" on a payday', async ({ page }) => {
  await quickSetup(page);
  const sentence = page.getByTestId('focus-sentence');
  await expect(sentence).toHaveText(/^\d+% gone\. \d+ paydays left\.$/); // 15 Oct is not a payday
  await expect(sentence).not.toContainText('After today');
  await setDay(page, '2026-10-23');
  await expect(page.getByTestId('focus-sentence')).toContainText('After today'); // the payday itself
});

test('whole dollars on Today and Path balances', async ({ page }) => {
  await quickSetup(page);
  await expect(page.getByRole('region', { name: 'Focus debt' })).toContainText(/\$\d[\d,]* left/);
  await expect(page.getByRole('region', { name: 'Focus debt' })).not.toContainText(/\$\d[\d,]*\.\d\d left/);
  await tapDidIt(page);
  await expect(page.getByTestId('after-sentence')).toContainText(/has \$\d[\d,]* left\./);
  await expect(page.getByTestId('after-sentence')).not.toContainText(/has \$\d[\d,]*\.\d\d left/);
  await goTab(page, 'Path');
  for (const id of ['paid-so-far', 'to-go']) await expect(page.getByTestId(id)).toHaveText(/^\$\d[\d,]*$/);
});

test('the Path chart ends on the debt-free date, not on a later month', async ({ page }) => {
  await quickSetup(page);
  await goTab(page, 'Path');
  const status = await page.getByTestId('status-line').innerText();
  const month = /by ([A-Z][a-z]{2} \d{4})/.exec(status)![1]!;
  const chart = page.getByRole('img', { name: /Balance over time/ });
  await expect(chart).toContainText(`Debt-free ${month}`);
  await expect(chart).toContainText(new RegExp(`Now[\\s\\S]*${month}`)); // the last label on the axis is that same month
});

test('no "Mark it done early" link: the card shows until the first "I did it" and from 2 days before each payday', async ({ page }) => {
  await quickSetup(page);
  await tapDidIt(page);
  await expect(page.getByTestId('paid-card')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('countdown-card')).toBeVisible(); // 8 days to go
  await expect(page.getByText('Mark it done early')).toHaveCount(0);
  await setDay(page, '2026-11-04'); // 2 days before Fri 6 Nov
  await expect(page.getByRole('button', { name: /^I did it/ })).toBeVisible();
});
