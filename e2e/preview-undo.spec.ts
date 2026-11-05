/** Path: a read-only preview of a future payday, undo of the latest paid payday, and "Mark it done early" for the next payday only. */
import { expect, test, type Page } from '@playwright/test';
import { nadiaSetup } from './nadia';
import { expectBrandRules, goTab, showPaydays, tapDidIt } from './scenario';

async function openList(page: Page, _which?: 'Upcoming' | 'Done') {
  await goTab(page, 'Path');
  await showPaydays(page);
}

test.describe('preview of a future payday', () => {
  test('tapping a payday in the list opens a read-only preview with a banner and a way back', async ({ page }) => {
    await nadiaSetup(page);
    await openList(page, 'Upcoming');
    await page.getByRole('button', { name: 'Fri 20 Nov, to come' }).click();
    const preview = page.getByTestId('path-preview');
    await expect(preview).toBeVisible();
    await expect(page.getByTestId('preview-banner')).toContainText('Preview · Fri 20 Nov 2026');
    await expect(page.getByTestId('preview-banner')).toContainText('Nothing changes. Just looking ahead.');
    await expect(page.getByTestId('preview-owed')).toHaveText(/^\$[\d,]+$/);
    await expect(page.getByTestId('preview-months')).toHaveText(/% gone · debt-free \d+ months? later, in [A-Z][a-z]+ 20\d\d/);
    await expect(page.getByTestId('preview-debt')).toHaveCount(3);
    await expect(page.getByTestId('preview-paid-off')).toHaveText(/^\$[\d,]+$/);
    await expect(page.getByTestId('preview-buffer')).toContainText('$500');
    await expect(page.getByTestId('preview-scene')).toBeVisible();
    await expect(page.getByTestId('path-preview')).toContainText('No buttons here, nothing to mark.');
    // a month chip opens the last payday of that month
    await page.getByRole('button', { name: 'December 2026' }).click();
    await expect(page.getByTestId('preview-banner')).toContainText('Preview · Fri 18 Dec 2026');
    // the debt-free month opens the debt-free day, with the Home scene
    await page.getByRole('button', { name: 'July 2027' }).click();
    await expect(page.getByTestId('preview-banner')).toContainText('Preview · Fri 16 Jul 2027');
    await expect(page.getByTestId('preview-owed')).toHaveText('$0');
    await expect(page.getByTestId('preview-months')).toContainText('this is your debt-free day');
    await expect(page.getByTestId('scene')).toHaveAttribute('data-stage', '5');
    await expect(page.getByTestId('preview-scene')).toHaveCount(0);
    await expect(page.getByTestId('preview-debt').locator('.tag.paid')).toHaveCount(3);
    // read-only: nothing to tick, no "I did it"
    await expect(preview.getByRole('checkbox')).toHaveCount(0);
    await expect(preview.getByRole('button', { name: /I did it/ })).toHaveCount(0);
    await expectBrandRules(page);
    await page.getByRole('button', { name: 'Back to today' }).click();
    await expect(page.getByTestId('path-preview')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Your path' })).toBeVisible();
  });

  test('a later payday owes less than an earlier one, and nothing is saved', async ({ page }) => {
    await nadiaSetup(page);
    const owedOn = async (label: string) => {
      await openList(page, 'Upcoming');
      await page.getByRole('button', { name: `${label}, to come` }).click();
      const n = Number(((await page.getByTestId('preview-owed').textContent()) ?? '').replace(/[^0-9]/g, ''));
      await page.getByRole('button', { name: 'Back to today' }).click();
      return n;
    };
    const early = await owedOn('Fri 20 Nov');
    const late = await owedOn('Fri 18 Dec');
    expect(late).toBeLessThan(early);
    await goTab(page, 'Today');
    await expect(page.getByRole('button', { name: 'I did it · $180' })).toBeVisible(); // untouched
    await page.reload();
    await expect(page.getByRole('button', { name: 'I did it · $180' })).toBeVisible();
  });

  test('tapping a future payday in the calendar opens the same preview', async ({ page }) => {
    await nadiaSetup(page);
    await goTab(page, 'Path');
    await page.getByRole('button', { name: 'Calendar', exact: true }).click();
    await page.getByRole('button', { name: 'Next month' }).click();
    await page.getByRole('gridcell', { name: /Friday 20 November, payday/ }).click();
    await expect(page.getByTestId('preview-banner')).toContainText('Preview · Fri 20 Nov 2026');
  });

  test('leaving Path takes the preview away', async ({ page }) => {
    await nadiaSetup(page);
    await openList(page, 'Upcoming');
    await page.getByRole('button', { name: 'Fri 20 Nov, to come' }).click();
    await goTab(page, 'Today');
    await goTab(page, 'Path');
    await expect(page.getByTestId('path-preview')).toHaveCount(0);
  });
});

test.describe('undo a past payday', () => {
  test('the latest paid payday: what was paid, Mark as not paid, the effect on the date, then Yes or Keep it', async ({ page }) => {
    await nadiaSetup(page);
    await tapDidIt(page);
    await expect(page.getByTestId('paid-card')).toBeVisible();
    await openList(page, 'Done');
    await page.getByRole('button', { name: 'Fri 6 Nov, paid' }).click();
    const sheet = page.getByRole('dialog', { name: 'Fri 6 Nov' });
    await expect(sheet).toContainText('You paid');
    await expect(sheet.getByRole('group', { name: 'Fri 6 Nov details' })).toContainText('Buffer');
    await expect(sheet.getByRole('button', { name: 'Change what I paid' })).toBeVisible();
    await sheet.getByRole('button', { name: 'Mark as not paid' }).click();
    const confirm = page.getByRole('dialog', { name: 'Mark Fri 6 Nov as not paid?' });
    await expect(confirm.getByTestId('not-paid-line')).toHaveText(/^(Still|Moves to) [A-Z][a-z]+ 20\d\d, if you pay it this week$/);
    await expect(confirm.getByTestId('undo-box')).toContainText('goes back to');
    await confirm.getByRole('button', { name: 'Keep it' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Fri 6 Nov, paid' })).toBeVisible();
  });

  test('an older paid payday says to undo the later ones first, and has no undo button', async ({ page }) => {
    await nadiaSetup(page);
    await tapDidIt(page);
    await expect(page.getByTestId('paid-card')).toBeVisible();
    await page.clock.setFixedTime(new Date('2026-11-20T10:00:00'));
    await page.reload();
    await tapDidIt(page);
    await expect(page.getByTestId('paid-card')).toBeVisible();
    await openList(page, 'Done');
    await page.getByRole('button', { name: 'Fri 6 Nov, paid' }).click();
    await expect(page.getByTestId('undo-later-first')).toHaveText('Undo the later ones first.');
    await expect(page.getByRole('button', { name: 'Mark as not paid' })).toHaveCount(0);
  });
});

test.describe('Mark it done early', () => {
  test('is offered for the next payday only: the card it opens is the next payday', async ({ page }) => {
    await nadiaSetup(page);
    await tapDidIt(page);
    await expect(page.getByTestId('paid-card')).toBeVisible();
    await page.clock.setFixedTime(new Date('2026-11-09T10:00:00'));
    await page.reload();
    await expect(page.getByTestId('countdown-card')).toContainText('Fri 20 Nov');
    await page.getByRole('button', { name: 'Mark it done early' }).click();
    await expect(page.getByRole('button', { name: /^I did it/ })).toBeVisible();
    // a payday further ahead has no such button anywhere
    await openList(page, 'Upcoming');
    await page.getByRole('button', { name: 'Fri 4 Dec, to come' }).click();
    await expect(page.getByTestId('path-preview').getByRole('button', { name: /done early|I did it/i })).toHaveCount(0);
  });
});
