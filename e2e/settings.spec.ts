/** Step 4 on a phone: backup and restore, calendar file, unlock code, appearance, schedule. */
import { showPaydays, tapDidIt, goTab, revealEarly } from './scenario';
import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { FIXED, quickSetup, shot } from './helpers';
import { testCode } from './testKey';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
});

test('a backup restores the same plan on a fresh phone', async ({ page, browser }, info) => {
  await quickSetup(page);
  await tapDidIt(page);
  await expect(page.getByText('Fri 23 Oct is paid.')).toBeVisible();
  const pill = await page.getByTestId('debt-free-pill').textContent();

  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByTestId('last-backup')).toHaveText('You haven’t saved a backup yet.');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Back up my plan' }).click()]);
  expect(download.suggestedFilename()).toBe('paidinyellow-backup-2026-10-15.json');
  const path = info.outputPath('backup.json');
  await download.saveAs(path);
  await expect(page.getByText('Saved. Keep the file somewhere safe')).toBeVisible();
  await expect(page.getByTestId('last-backup')).toHaveText('Last saved today.');

  // A different phone: nothing there yet
  const ctx = await browser.newContext({ ...info.project.use });
  const other = await ctx.newPage();
  await other.clock.setFixedTime(FIXED);
  await other.goto('/');
  await other.getByLabel('Backup file').setInputFiles(path);
  await expect(other.getByRole('dialog')).toContainText('2 debts, 1 payday logged, last paid Fri 23 Oct');
  await other.getByRole('button', { name: 'Restore it', exact: true }).click();
  await expect(other.getByTestId('debt-free-pill')).toHaveText(pill!);
  await expect(other.getByTestId('greeting')).toHaveText('Done for this payday.');
  await expect(other.getByTestId('countdown-card')).toContainText('Fri 6 Nov');
  await ctx.close();
});

test('a file that is not a backup is refused and nothing changes', async ({ page }, info) => {
  await quickSetup(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  const bad = info.outputPath('not-a-backup.json');
  writeFileSync(bad, '{"hello":1}');
  await page.getByLabel('Backup file').setInputFiles(bad);
  await expect(page.getByText('This file isn’t a PaidInYellow backup.')).toBeVisible();
  await page.getByRole('button', { name: 'Back to Today' }).click();
  await expect(page.getByRole('heading', { name: 'Next payday' })).toBeVisible();
});

test('the calendar file has paydays and due dates', async ({ page }) => {
  await quickSetup(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Add to my calendar' }).click()]);
  expect(download.suggestedFilename()).toBe('paidinyellow-calendar.ics');
  const ics = readFileSync((await download.path())!, 'utf8');
  expect(ics).toContain('BEGIN:VCALENDAR');
  expect(ics).toContain('DTSTART;VALUE=DATE:20261023');
  expect(ics).toContain('SUMMARY:Visa due');
  expect(ics).toContain('TRIGGER:-P3D');
});

test('an unlock code is checked on the phone', async ({ page }) => {
  await quickSetup(page, { unlock: false });
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByText('The calendar file with your paydays and due dates comes with the full planner.')).toBeVisible();
  await page.getByRole('button', { name: 'Open Unlock code' }).click();
  await page.getByRole('textbox', { name: 'Code' }).fill('hello');
  await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  await expect(page.getByText('This code looks incomplete.')).toBeVisible();
  await expect(page.getByTestId('unlocked')).toHaveCount(0);

  await page.getByRole('textbox', { name: 'Code' }).fill(await testCode());
  await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  await expect(page.getByTestId('unlocked')).toHaveText('Unlocked. Thank you.');
  await expect(page.getByRole('button', { name: 'Add to my calendar' })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('debt-free-pill')).toBeVisible(); // straight into the full planner
});

test('dark mode and a larger text size apply at once and stay after a reload', async ({ page }) => {
  await quickSetup(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Change Theme' }).click();
  await page.getByRole('radio', { name: 'Dark' }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Change Text size' }).click();
  await page.getByRole('radio', { name: 'Larger' }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(27, 36, 51)');
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('20.8px');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Today' }).click();
  await revealEarly(page);
  await expect(page.getByRole('button', { name: /^I did it/ })).toBeVisible();
  await shot(page, '15-dark-today');
  // No sideways scrolling at the largest text size
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= Math.min(window.screen.width, window.innerWidth))).toBe(true);
  expect(await page.evaluate(() => window.innerWidth <= window.screen.width)).toBe(true); // the page did not grow wider than the phone
});

test('changing the pay schedule keeps history and moves the next payday', async ({ page }) => {
  await quickSetup(page);
  await tapDidIt(page);
  await expect(page.getByText('Fri 23 Oct is paid.')).toBeVisible();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Change Pay schedule' }).click();
  await page.getByRole('radio', { name: 'Every week' }).click();
  await page.getByLabel('Your next payday').fill('2026-11-13');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Every week, next Fri 13 Nov')).toBeVisible();
  await page.getByRole('button', { name: 'Back to Today' }).click();
  await expect(page.getByText('Fri 13 Nov').first()).toBeVisible();
  await goTab(page, 'Plan');
  await showPaydays(page, 'Done');
  await expect(page.getByRole('button', { name: 'Fri 23 Oct, paid' })).toBeVisible();
});

test('a calm backup reminder shows after 30 days and goes away once saved', async ({ page }) => {
  await quickSetup(page);
  await expect(page.getByLabel('Backup reminder')).toHaveCount(0);
  await page.clock.setFixedTime(new Date('2026-11-20T10:00:00'));
  await page.reload();
  await expect(page.getByLabel('Backup reminder')).toContainText('Save a backup file. Takes 5 seconds.');
  // One tap on the reminder saves the file, and the reminder goes away
  await Promise.all([page.waitForEvent('download'), page.getByLabel('Backup reminder').getByRole('button', { name: 'Back up my plan' }).click()]);
  await expect(page.getByLabel('Backup reminder')).toHaveCount(0);
});

test('help answers and the support email are there', async ({ page }) => {
  await quickSetup(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Open Questions and answers' }).click();
  await page.getByText('What if I lose my device or clear my browser?').click();
  await expect(page.getByText('Save a backup from Settings once a month')).toBeVisible();
  await expect(page.getByRole('link', { name: 'support@paidinyellow.com' })).toHaveAttribute('href', 'mailto:support@paidinyellow.com');
  await shot(page, '16-settings');
});

test('start over erases the plan and keeps the unlock code by default', async ({ page }) => {
  await quickSetup(page);
  await tapDidIt(page);
  await expect(page.getByText('Fri 23 Oct is paid.')).toBeVisible();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Erase everything and start over' }).click();
  await expect(page.getByRole('dialog')).toContainText('It can’t be undone');
  await shot(page, '18-erase');

  // Cancel changes nothing
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to Today' }).click();
  await expect(page.getByText('Fri 6 Nov').first()).toBeVisible();

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Erase everything and start over' }).click();
  await page.getByRole('button', { name: 'Yes, erase everything' }).click();
  await expect(page.getByText('You’re not bad at math.')).toBeVisible();

  // Still clean after a reload, and nothing of the old plan is left
  await page.reload();
  await expect(page.getByText('You’re not bad at math.')).toBeVisible();

  // A new setup works, and the planner is still unlocked (the code was kept)
  await quickSetup(page, { unlock: false });
  await expect(page.getByRole('button', { name: 'Start my plan' })).toBeVisible();
  await expect(page.getByTestId('unlock-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Start my plan' }).click();
  await expect(page.getByRole('heading', { name: 'Next payday' })).toBeVisible();
  await expect(page.getByText('Fri 23 Oct').first()).toBeVisible(); // payday 1 again, nothing paid yet
  await goTab(page, 'Plan');
  await expect(page.getByRole('button', { name: 'Fri 23 Oct, paid' })).toHaveCount(0);
});

test('start over can also remove the unlock code', async ({ page }) => {
  await quickSetup(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Erase everything and start over' }).click();
  await page.getByLabel('Also remove my unlock code from this device').check();
  await page.getByRole('button', { name: 'Yes, erase everything' }).click();
  await expect(page.getByText('You’re not bad at math.')).toBeVisible();

  await quickSetup(page, { unlock: false });
  await expect(page.getByTestId('unlock-card')).toBeVisible(); // back to calculator mode
  await expect(page.getByRole('button', { name: 'Start my plan' })).toHaveCount(0);
});
