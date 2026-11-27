/**
 * Missed paydays, one at a time: "I skipped it" (and "Skip this payday") marks only the payday on screen. The others
 * are still asked, oldest first. Quick setup: every 2 weeks from Fri 23 Oct; on Sat 21 Nov, 23 Oct, 6 Nov and 20 Nov
 * have gone by.
 */
import { expect, test, type Page } from '@playwright/test';
import { FIXED, quickSetup } from './helpers';
import { expectBrandRules, setDay } from './scenario';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
});

const asked = (page: Page) => page.getByText(/Did you do your .* payday\?/);

/** The payday logs saved on the phone, oldest first */
const logs = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<{ date: string; status: string }[]>((resolve) => {
        const open = indexedDB.open('paidinyellow');
        open.onsuccess = () => {
          const get = open.result.transaction('paydays').objectStore('paydays').getAll();
          get.onsuccess = () => resolve((get.result as { date: string; status: string; number: number }[]).sort((a, b) => a.number - b.number).map(({ date, status }) => ({ date, status })));
        };
      }),
  );

test('miss 3 paydays, skip one: the other 2 are still asked, one at a time', async ({ page }) => {
  await quickSetup(page);
  await setDay(page, '2026-11-21');
  await expect(asked(page)).toHaveText('Did you do your Fri 23 Oct payday?');
  await expect(page.getByTestId('missed-more')).toHaveText('2 more after this one.');
  await expectBrandRules(page);

  await page.getByRole('button', { name: 'I skipped it' }).click();
  await expect(asked(page)).toHaveText('Did you do your Fri 6 Nov payday?');
  await expect(page.getByTestId('missed-more')).toHaveText('1 more after this one.');
  expect(await logs(page)).toEqual([{ date: '2026-10-23', status: 'skipped' }]); // only the one on screen

  await page.reload(); // still asked after a reload
  await expect(asked(page)).toHaveText('Did you do your Fri 6 Nov payday?');

  await page.getByRole('button', { name: 'Skip this payday' }).click(); // the link in the card: also just this one
  await expect(asked(page)).toHaveText('Did you do your Fri 20 Nov payday?');
  await expect(page.getByTestId('missed-more')).toHaveCount(0);
  expect((await logs(page)).map((l) => l.status)).toEqual(['skipped', 'skipped']);

  await page.getByRole('button', { name: 'I skipped it' }).click();
  await expect(asked(page)).toHaveCount(0);
  await expect(page.getByText('Life happens. Never miss twice.', { exact: false })).toHaveCount(1); // said once, when they are all answered
  expect((await logs(page)).map((l) => l.date)).toEqual(['2026-10-23', '2026-11-06', '2026-11-20']);
});

test('miss 3 paydays, did the first one: the next is asked after it', async ({ page }) => {
  await quickSetup(page);
  await setDay(page, '2026-11-21');
  await page.getByRole('button', { name: /^I did it/ }).click();
  await expect(page.getByText('Fri 23 Oct is paid.')).toBeVisible();
  await expect(asked(page)).toHaveText('Did you do your Fri 6 Nov payday?'); // at once, no reload needed
  await expect(page.getByTestId('missed-more')).toHaveText('1 more after this one.');
});
