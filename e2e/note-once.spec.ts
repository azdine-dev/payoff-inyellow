/** Paydays marked early on one day: a milestone note shows on the payday where it was first reached, and never again. */
import { expect, test } from '@playwright/test';
import { NADIA } from './nadia';
import { runWizard, startPlan, tapDidIt } from './scenario';

test('four paydays marked early on one day: Halfway shows on one of them only', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-30T10:00:00'));
  await runWizard(page, { ...NADIA, extra: '700' }); // a short plan, so a few paydays reach halfway and more
  await startPlan(page);
  const notes: string[] = [];
  for (let i = 0; i < 5; i++) {
    const done = page.getByRole('button', { name: /^I did it/ }).or(page.getByRole('button', { name: 'Mark it done early' }));
    if (!(await done.first().isVisible().catch(() => false))) break;
    await tapDidIt(page);
    await expect(page.getByTestId('paid-card')).toBeVisible();
    // a debt that reaches zero opens the paid moment: close it
    const moment = page.getByTestId('paid-moment');
    if (await moment.waitFor({ state: 'visible', timeout: 1500 }).then(() => true, () => false)) await page.getByRole('button', { name: /Next payday|Done/ }).click();
    const note = page.getByTestId('pay-note');
    if (await note.count()) notes.push((await note.innerText()).trim());
    if (await page.getByTestId('debt-free-pill').getByText('Debt-free', { exact: true }).count()) break;
  }
  expect(notes.length).toBeGreaterThanOrEqual(3);
  expect(notes.filter((n) => n.startsWith('Halfway.')).length).toBeLessThanOrEqual(1);
  expect(notes.filter((n) => n === 'Almost home.').length).toBeLessThanOrEqual(1);
  for (let i = 1; i < notes.length; i++) expect(notes[i], `payday ${i} and ${i + 1}`).not.toBe(notes[i - 1]);
});
