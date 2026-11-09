/** Path: Chapters, Your whole plan, and money coming later. Nadia's numbers are in design/path-features/README.md. */
import { expect, test } from '@playwright/test';
import { nadiaSetup } from './nadia';
import { expectBrandRules, goTab, tapDidIt } from './scenario';

test.describe('Chapters', () => {
  test('one card per debt with its paydays as squares, flags between them, and the house at the end', async ({ page }) => {
    await nadiaSetup(page);
    await goTab(page, 'Path');
    await expect(page.getByRole('button', { name: 'Road', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Calendar', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'List', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Chapters', exact: true }).click();
    await expect(page.getByTestId('chapters-summary')).toHaveText('3 chapters · debt-free Fri 16 Jul 2027');
    const chapters = page.getByTestId('chapter');
    await expect(chapters).toHaveCount(3);
    await expect(chapters.nth(0).getByTestId('chapter-span')).toHaveText('5 paydays · Fri 6 Nov to Fri 1 Jan 2027');
    await expect(chapters.nth(1).getByTestId('chapter-span')).toHaveText('3 paydays · Fri 15 Jan to Fri 12 Feb 2027');
    await expect(chapters.nth(2).getByTestId('chapter-span')).toHaveText('11 paydays · Fri 26 Feb to Fri 16 Jul 2027');
    await expect(chapters.nth(0)).toContainText('Store Card');
    await expect(chapters.nth(0)).toContainText('You are here');
    await expect(chapters.nth(1)).not.toContainText('You are here');
    await expect(chapters.nth(2)).toContainText('Chapter 3 · the last one');
    await expect(chapters.nth(0)).toContainText('Your buffer fills first. From Fri 4 Dec the extra goes here.');
    for (const [i, n] of [5, 3, 11].entries()) await expect(chapters.nth(i).locator('.chapter-squares i')).toHaveCount(n);
    await expect(page.locator('.chapter-squares i.paid')).toHaveCount(0);
    await expect(page.getByTestId('chapter-flag').nth(0)).toHaveText('Store Card gone · Fri 1 Jan 2027. Its $30 rolls on.');
    await expect(page.getByTestId('chapter-flag').nth(1)).toContainText('Medical gone · Fri 12 Feb 2027');
    await expect(page.getByTestId('chapter-flag')).toHaveCount(2); // the last debt ends in the house, not a flag
    await expect(page.getByTestId('chapter-end')).toHaveText('Debt-free · Fri 16 Jul 2027');
    await expect(page.getByText('Tap a chapter to see its paydays. Tap a payday to preview it.')).toBeVisible();
    await expectBrandRules(page);
  });

  test('tapping a chapter shows its paydays, and a payday opens the read-only preview', async ({ page }) => {
    await nadiaSetup(page);
    await goTab(page, 'Path');
    await page.getByRole('button', { name: 'Chapters', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Fri 20 Nov, to come' })).toHaveCount(0); // closed
    await page.getByRole('button', { name: 'Store Card, chapter 1' }).click();
    await expect(page.locator('ul[aria-label="Store Card paydays"] .pd')).toHaveCount(5);
    await page.getByRole('button', { name: 'Fri 20 Nov, to come' }).click();
    await expect(page.getByTestId('preview-banner')).toContainText('Preview · Fri 20 Nov 2026');
    await page.getByRole('button', { name: 'Back to today' }).click();
    await expect(page.getByTestId('chapters')).toBeVisible();
  });

  test('a paid payday is a yellow square, and the latest one opens Undo', async ({ page }) => {
    await nadiaSetup(page);
    await tapDidIt(page);
    await expect(page.getByTestId('paid-card')).toBeVisible();
    await goTab(page, 'Path');
    await page.getByRole('button', { name: 'Chapters', exact: true }).click();
    await expect(page.locator('.chapter-squares i.paid')).toHaveCount(1);
    await expect(page.getByTestId('chapter').nth(0).locator('.chapter-squares')).toHaveAttribute('aria-label', '1 of 5 paydays done');
    await page.getByRole('button', { name: 'Store Card, chapter 1' }).click();
    await page.getByRole('button', { name: 'Fri 6 Nov, paid' }).click();
    await expect(page.getByRole('dialog', { name: 'Fri 6 Nov' })).toContainText('You paid');
  });

  test('the calendar: a future day opens the preview, the latest paid day opens Undo', async ({ page }) => {
    await nadiaSetup(page);
    await tapDidIt(page);
    await expect(page.getByTestId('paid-card')).toBeVisible();
    await goTab(page, 'Path');
    await page.getByRole('button', { name: 'Calendar', exact: true }).click();
    await page.getByRole('button', { name: 'Next month' }).click();
    await page.getByRole('gridcell', { name: /Friday 6 November, payday, paid/ }).click();
    await page.getByRole('dialog', { name: 'Fri 6 Nov' }).getByRole('button', { name: 'Mark as not paid' }).click();
    await expect(page.getByRole('dialog', { name: 'Mark Fri 6 Nov as not paid?' })).toBeVisible();
    await page.getByRole('button', { name: 'Keep it' }).click();
    await page.getByRole('gridcell', { name: /Friday 20 November, payday/ }).click();
    await expect(page.getByTestId('preview-banner')).toContainText('Preview · Fri 20 Nov 2026');
  });
});

test.describe('Your whole plan', () => {
  test('one card at the top of Path opens the detail screen with the numbers from the board', async ({ page }) => {
    await nadiaSetup(page);
    await goTab(page, 'Path');
    const card = page.getByTestId('whole-plan-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('$3,528 to your debts · 19 paydays');
    const box = await card.boundingBox();
    const stats = await page.getByRole('group', { name: 'Your numbers' }).boundingBox();
    expect(box!.y).toBeLessThan(stats!.y); // at the top, above the numbers
    await card.click();
    const plan = page.getByTestId('whole-plan');
    await expect(plan.getByRole('heading', { name: 'Your whole plan' })).toBeVisible();
    await expect(page.getByTestId('wp-sub')).toHaveText('19 paydays, from Fri 6 Nov to Fri 16 Jul 2027');
    await expect(page.getByTestId('wp-total')).toHaveText('$3,528');
    await expect(page.getByTestId('wp-owe')).toHaveText('That’s what you owe, $3,250, plus $278 interest.');
    await expect(page.getByTestId('wp-plan-interest')).toHaveText('$278 interest');
    await expect(page.getByTestId('wp-min-interest')).toHaveText('$1,445 interest');
    await expect(page.getByTestId('wp-kept')).toHaveText('You keep $1,167 that would have gone to interest.');
    const next = page.getByTestId('wp-next30');
    await expect(next).toContainText('You’ll move $446 over 2 paydays.');
    await expect(next.getByText('To debts')).toBeVisible();
    await expect(next).toContainText('$146');
    await expect(next).toContainText('$280');
    await expect(next).toContainText('$20');
    const years = page.getByTestId('wp-years');
    await expect(years).toContainText('Rest of 2026 · 4 paydays$842');
    await expect(years).toContainText('2027 · 15 paydays$3,176');
    await expect(years).toContainText('Includes buffer and yearly bills, so you can plan your budget.');
    await expectBrandRules(page);
    await page.getByRole('button', { name: '‹ Path' }).click();
    await expect(page.getByTestId('whole-plan')).toHaveCount(0);
    await expect(page.getByTestId('whole-plan-card')).toBeVisible();
    // still four tabs
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('button')).toHaveCount(4);
  });
});

test.describe('Money coming later', () => {
  test('the switch, one typed field, the new date before saving: $800 on Fri 9 Apr 2027', async ({ page }) => {
    await nadiaSetup(page);
    await page.getByRole('button', { name: 'I got extra money' }).click();
    const sheet = page.getByRole('dialog', { name: 'Extra money' });
    await expect(sheet.getByRole('button', { name: 'I have it now' })).toHaveAttribute('aria-pressed', 'true');
    await sheet.getByRole('button', { name: /coming later/ }).click();
    await expect(sheet.getByRole('button', { name: /coming later/ })).toHaveAttribute('aria-pressed', 'true');
    // one typed field: the amount (the payday is a tap, the type is a chip)
    await expect(sheet.getByRole('textbox')).toHaveCount(1);
    await expect(sheet.getByLabel('Which payday?')).toHaveValue('2026-11-06'); // the next payday
    await expect(sheet.getByRole('button', { name: 'Add to my plan' })).toBeDisabled();
    for (const k of ['Tax refund', 'Bonus', 'Gift', 'Other']) await expect(sheet.getByRole('button', { name: k, exact: true })).toBeVisible();
    await sheet.getByRole('button', { name: 'Tax refund', exact: true }).click();
    await sheet.getByRole('textbox', { name: 'Money coming later' }).fill('800');
    await sheet.getByLabel('Which payday?').selectOption({ label: 'Fri 9 Apr 2027' });
    const effect = sheet.getByTestId('later-effect');
    await expect(effect).toContainText('If it goes to Visa');
    await expect(page.getByTestId('later-debtfree')).toHaveText('Debt-free Fri 21 May 2027 instead of Fri 16 Jul');
    await expect(effect).toContainText('4 paydays sooner · $36 less interest');
    await expect(sheet).toContainText('On that payday, Today asks if it arrived. Nothing moves until you say yes.');
    await expectBrandRules(page);
    await sheet.getByRole('button', { name: 'Add to my plan' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // the plan has it now
    await goTab(page, 'Path');
    await expect(page.getByTestId('status-line')).toContainText('Jul 2027'); // the plan date does not move
    await expect(page.getByTestId('coming-later-line')).toHaveText('With your $800 tax refund: May 2027');
    await goTab(page, 'Today');
    await expect(page.getByTestId('debt-free-with')).toHaveText('With your $800 tax refund: May 2027');
  });

  test('on its payday Today asks "Did it arrive?", and counts it only after Yes', async ({ page }) => {
    await nadiaSetup(page);
    await page.getByRole('button', { name: 'I got extra money' }).click();
    const sheet = page.getByRole('dialog', { name: 'Extra money' });
    await sheet.getByRole('button', { name: /coming later/ }).click();
    await sheet.getByRole('textbox', { name: 'Money coming later' }).fill('800');
    await sheet.getByRole('button', { name: 'Add to my plan' }).click(); // the next payday, the default
    const ask = page.getByTestId('arrival-card');
    await expect(ask).toContainText('Did it arrive?');
    await expect(ask).toContainText('$800');
    await expect(page.getByRole('button', { name: 'I did it · $180' })).toBeVisible(); // nothing moved yet
    await ask.getByRole('button', { name: 'Yes, it arrived' }).click();
    await expect(page.getByTestId('arrival-card')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'I did it · $980' })).toBeVisible(); // counted now
    await expectBrandRules(page);
  });

  test('"Not yet" leaves the money out of this payday', async ({ page }) => {
    await nadiaSetup(page);
    await page.getByRole('button', { name: 'I got extra money' }).click();
    const sheet = page.getByRole('dialog', { name: 'Extra money' });
    await sheet.getByRole('button', { name: /coming later/ }).click();
    await sheet.getByRole('textbox', { name: 'Money coming later' }).fill('800');
    await sheet.getByRole('button', { name: 'Add to my plan' }).click();
    await page.getByTestId('arrival-card').getByRole('button', { name: 'Not yet' }).click();
    await expect(page.getByTestId('arrival-card')).toHaveCount(0);
    await tapDidIt(page);
    await expect(page.getByTestId('paid-card')).toBeVisible();
    // it was not used, so it is still planned for the next payday
    await page.clock.setFixedTime(new Date('2026-11-20T10:00:00'));
    await page.reload();
    await expect(page.getByTestId('arrival-card')).toBeVisible();
  });
});

test.describe('Coming later list in Path', () => {
  async function planLater(page: import('@playwright/test').Page) {
    await page.getByRole('button', { name: 'I got extra money' }).click();
    const sheet = page.getByRole('dialog', { name: 'Extra money' });
    await sheet.getByRole('button', { name: /coming later/ }).click();
    await sheet.getByRole('button', { name: 'Tax refund', exact: true }).click();
    await sheet.getByRole('textbox', { name: 'Money coming later' }).fill('800');
    await sheet.getByLabel('Which payday?').selectOption({ label: 'Fri 9 Apr 2027' });
    await sheet.getByRole('button', { name: 'Add to my plan' }).click();
  }

  test('a small list under Your whole plan: Tax refund · $800 · Fri 9 Apr 2027', async ({ page }) => {
    await nadiaSetup(page);
    await goTab(page, 'Path');
    await expect(page.getByTestId('coming-later-list')).toHaveCount(0); // nothing planned yet
    await goTab(page, 'Today');
    await planLater(page);
    await goTab(page, 'Path');
    const list = page.getByTestId('coming-later-list');
    await expect(list).toContainText('Coming later');
    await expect(list.getByRole('button', { name: /Tax refund/ })).toHaveText('Tax refund · $800 · Fri 9 Apr 2027›');
    const a = await page.getByTestId('whole-plan-card').boundingBox();
    const b = await list.boundingBox();
    expect(b!.y).toBeGreaterThan(a!.y); // under Whole plan
    await expectBrandRules(page);
  });

  test('tap an item: move it to another payday with Undo, or remove it with Undo', async ({ page }) => {
    await nadiaSetup(page);
    await planLater(page);
    await goTab(page, 'Path');
    const list = page.getByTestId('coming-later-list');
    await list.getByRole('button', { name: /Tax refund/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Tax refund · $800' });
    await sheet.getByLabel('Move to payday').selectOption({ label: 'Fri 7 May 2027' });
    await expect(list.getByRole('button', { name: /Tax refund/ })).toContainText('Fri 7 May 2027');
    await expect(page.getByTestId('coming-later-line')).toBeVisible();
    await expect(page.getByTestId('coming-later-undo')).toContainText('Moved to Fri 7 May 2027.');
    await page.getByTestId('coming-later-undo').getByRole('button', { name: 'Undo' }).click();
    await expect(list.getByRole('button', { name: /Tax refund/ })).toContainText('Fri 9 Apr 2027');
    // remove
    await list.getByRole('button', { name: /Tax refund/ }).click();
    await page.getByRole('dialog', { name: 'Tax refund · $800' }).getByRole('button', { name: 'Remove' }).click();
    await expect(list.getByRole('button', { name: /Tax refund/ })).toHaveCount(0);
    await expect(page.getByTestId('coming-later-line')).toHaveCount(0); // no line without money coming
    await expect(page.getByTestId('coming-later-undo')).toContainText('Removed tax refund.');
    await page.getByTestId('coming-later-undo').getByRole('button', { name: 'Undo' }).click();
    await expect(list.getByRole('button', { name: /Tax refund/ })).toContainText('Fri 9 Apr 2027');
    await expect(page.getByTestId('coming-later-line')).toHaveText('With your $800 tax refund: May 2027');
  });
});

test.describe('the Chapter 1 note', () => {
  test('before the date it says when the extra starts, after it says the extra goes here now', async ({ page }) => {
    await nadiaSetup(page); // Fri 30 Oct: the buffer fills first
    await goTab(page, 'Path');
    await page.getByRole('button', { name: 'Chapters', exact: true }).click();
    const first = page.getByTestId('chapter').nth(0);
    await expect(first).toContainText('Your buffer fills first. From Fri 4 Dec the extra goes here.');
    // once Fri 4 Dec has come
    await page.clock.setFixedTime(new Date('2026-12-05T10:00:00'));
    await page.reload();
    await goTab(page, 'Path');
    await page.getByRole('button', { name: 'Chapters', exact: true }).click();
    const later = page.getByTestId('chapter').nth(0);
    await expect(later).toContainText('The extra goes here now.');
    await expect(later).not.toContainText('Your buffer fills first');
  });
});

test('Chapter 1 note: once the payday where the extra starts is marked done (early), it says the extra goes here now', async ({ page }) => {
  await nadiaSetup(page); // Fri 30 Oct: Fri 4 Dec has not come yet
  for (let i = 0; i < 3; i++) {
    await tapDidIt(page);
    await expect(page.getByTestId('paid-card')).toBeVisible();
  }
  await goTab(page, 'Path');
  await page.getByRole('button', { name: 'Chapters', exact: true }).click();
  const first = page.getByTestId('chapter').nth(0);
  await expect(first).toContainText('The extra goes here now.');
  await expect(first).not.toContainText('From Fri');
});
