/** The four warm features, with the Nadia scenario: your scene, the balance chart, a note for this payday, short reads. */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { expectBrandRules, goTab, tapDidIt } from './scenario';
import { nadiaSetup } from './nadia';

const scene = (page: Page) => page.getByTestId('scene');

/** Pays down with "I got extra money" and closes the "debt paid" moment if one opens */
async function payExtra(page: Page, amount: number) {
  await page.getByRole('button', { name: 'I got extra money' }).click();
  await page.getByRole('textbox', { name: 'Extra money' }).fill(String(amount));
  await page.getByRole('button', { name: 'Use it', exact: true }).click();
  // a debt that reaches zero opens the "paid" moment: close it
  const moment = page.getByTestId('paid-moment');
  const opened = await moment.waitFor({ state: 'visible', timeout: 1500 }).then(() => true, () => false);
  if (opened) await page.getByRole('button', { name: /Next payday|Done/ }).click();
}

test.describe('1 · your scene', () => {
  test('day one is stage 1, with the countdown and the month beside it', async ({ page }) => {
    await nadiaSetup(page);
    await expect(scene(page)).toHaveAttribute('data-stage', '1');
    const card = page.getByTestId('debt-free-pill');
    await expect(card).toContainText('Debt-free in');
    await expect(card.locator('.hl')).toHaveText('July 2027');
    await expect(scene(page)).not.toHaveClass(/scene-in/); // the very first open just shows it
    await expectBrandRules(page);
  });

  test('five stages as the debt goes: 25%, 50%, 75% and all of it', async ({ page }, info) => {
    await nadiaSetup(page);
    const dir = process.env.SHOTS;
    if (dir) mkdirSync(dir, { recursive: true });
    const shot = async (n: number) => {
      if (dir) await page.getByTestId('debt-free-pill').screenshot({ path: `${dir}/scene-${n}-${info.project.name}.png` });
    };
    await page.waitForTimeout(500);
    await shot(1);
    // $3,250 owed: 850 is 26%, 1,700 is 52%, 2,450 is 75%, 3,250 is 100%
    const steps: [number, string][] = [[850, '2'], [850, '3'], [750, '4'], [800, '5']];
    for (const [amount, stage] of steps) {
      await payExtra(page, amount);
      await expect(scene(page)).toHaveAttribute('data-stage', stage);
      await expect(scene(page)).toHaveClass(/scene-in/); // a stage reached for the first time fades in
      await page.waitForTimeout(600);
      await shot(Number(stage));
    }
    await expectBrandRules(page);
    // Once it was shown, it does not fade in again
    await page.reload();
    await expect(scene(page)).toHaveAttribute('data-stage', '5');
    await expect(scene(page)).not.toHaveClass(/scene-in/);
  });

  test('stage 5 has the house with a lit window, and nothing red', async ({ page }) => {
    await nadiaSetup(page);
    await payExtra(page, 3250);
    await expect(scene(page)).toHaveAttribute('data-stage', '5');
    await expect(scene(page).locator('rect.sc-paid')).toHaveCount(13); // twelve squares and the lit window
    await expectBrandRules(page);
  });

  test('with reduced motion the fade is off', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await nadiaSetup(page);
    await payExtra(page, 850);
    await expect(scene(page)).toHaveAttribute('data-stage', '2');
    expect(await scene(page).evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  });
});

test.describe('2 · balance, payday by payday', () => {
  test('day one starts at $3,250 and says down $0; a tap opens Path', async ({ page }) => {
    await nadiaSetup(page);
    const chart = page.getByTestId('mini-chart');
    await expect(chart).toContainText('Balance, payday by payday');
    await expect(page.getByTestId('mini-start')).toHaveText('You · $3,250');
    await expect(page.getByTestId('mini-end')).toHaveText('Jul 2027 · $0');
    await expect(page.getByTestId('mini-line')).toHaveText('Day one. Your line starts here.');
    await expect(page.getByTestId('mini-here')).toBeVisible();
    await expect(page.getByTestId('mini-paid')).toHaveCount(0); // nothing is paid yet
    await chart.click();
    await expect(page.getByRole('heading', { name: 'Your path' })).toBeVisible();
  });

  test('after money is paid the line says how much is down, and the paid part is yellow', async ({ page }) => {
    await nadiaSetup(page);
    await payExtra(page, 450);
    await expect(page.getByTestId('mini-line')).toHaveText('Down $450 since you started.');
    await expect(page.getByTestId('mini-paid')).toHaveCount(1);
    await expect(page.getByTestId('mini-paid')).toHaveAttribute('fill', 'var(--yellow)');
    await expectBrandRules(page);
  });
});

test.describe('3 · a note for this payday', () => {
  test('day one: the first payday note, and it is the same after a reload', async ({ page }) => {
    await nadiaSetup(page);
    await expect(page.getByTestId('pay-note')).toHaveText('First square. The hardest one is behind you.');
    await page.reload();
    await expect(page.getByTestId('pay-note')).toHaveText('First square. The hardest one is behind you.');
  });

  test('after "I did it" the note sits under the PAID card', async ({ page }) => {
    await nadiaSetup(page);
    await tapDidIt(page);
    await expect(page.getByTestId('paid-card')).toBeVisible();
    await expect(page.getByTestId('pay-note-card')).toBeVisible();
    await expect(page.getByTestId('pay-note')).toHaveText('First square. The hardest one is behind you.');
  });

  test('a debt just paid says PAID', async ({ page }) => {
    await nadiaSetup(page);
    await payExtra(page, 450); // Store Card is paid
    await expect(page.getByTestId('pay-note')).toHaveText('PAID. One down.');
  });

  test('the note follows the copy rules on screen', async ({ page }) => {
    await nadiaSetup(page);
    const text = await page.getByTestId('pay-note').innerText();
    expect(text.split(/\s+/).length).toBeLessThanOrEqual(12);
    expect(text).not.toMatch(/[!—–-]/);
  });
});

test.describe('4 · short reads', () => {
  const open = async (page: Page) => {
    await nadiaSetup(page);
    await goTab(page, 'Path');
    await page.getByTestId('reads-card').click();
  };

  test('Path has a card; it opens a full screen with ten reads and a back link', async ({ page }) => {
    await open(page);
    await expect(page.getByRole('heading', { name: 'Short reads' })).toBeVisible();
    await expect(page.getByText('One minute each. No internet needed.')).toBeVisible();
    await expect(page.getByTestId('read-item')).toHaveCount(10);
    await expect(page.getByTestId('read-count')).toHaveText('0 of 10 read');
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0); // a screen of its own
    await page.getByRole('button', { name: '‹ Path' }).click();
    await expect(page.getByRole('heading', { name: 'Your path' })).toBeVisible();
  });

  test('the read that fits your state is suggested: the buffer is low on day one', async ({ page }) => {
    await open(page);
    const suggested = page.locator('[data-testid="read-item"][data-suggested="1"]');
    await expect(suggested).toHaveCount(1);
    await expect(suggested).toContainText('What your buffer is for');
    await expect(suggested).toContainText('suggested for you');
  });

  test('a read has a picture, the text, a box, one action and the next read', async ({ page }) => {
    await open(page);
    await page.getByTestId('read-item').nth(1).click();
    const read = page.getByTestId('read');
    await expect(read.getByRole('heading', { name: 'What your buffer is for' })).toBeVisible();
    await expect(read.locator('svg.read-art')).toBeVisible();
    await expect(read).toContainText('Short read · 1 min');
    await expect(page.getByTestId('read-callout')).toContainText('Used some?');
    await expect(page.getByTestId('read-action')).toHaveText('Open Safety net');
    await expect(page.getByTestId('next-read')).toContainText('The surprise bill plan in 6 steps');
    await expect(read.locator('.hand')).toHaveText('a surprise is just an errand now');
    await expectBrandRules(page);
    await page.getByTestId('read-action').click();
    await expect(page.getByRole('heading', { name: 'Safety net' })).toBeVisible();
  });

  test('"Next read" opens the next one, and back returns to the list', async ({ page }) => {
    await open(page);
    await page.getByTestId('read-item').first().click();
    await page.getByTestId('next-read').click();
    await expect(page.getByRole('heading', { name: 'What your buffer is for' })).toBeVisible();
    await page.getByRole('button', { name: '‹ Short reads' }).click();
    await expect(page.getByTestId('read-list')).toBeVisible();
    await expect(page.getByTestId('read-count')).toHaveText('2 of 10 read');
  });

  test('a read gets a yellow check, and it stays after a reload', async ({ page }) => {
    await open(page);
    await expect(page.getByTestId('read-check')).toHaveCount(0);
    await page.getByTestId('read-item').nth(3).click();
    await page.getByRole('button', { name: '‹ Short reads' }).click();
    const check = page.getByTestId('read-item').nth(3).getByTestId('read-check');
    await expect(check).toBeVisible();
    await expect(check).toHaveCSS('background-color', 'rgb(255, 225, 77)');
    await page.reload();
    await goTab(page, 'Path');
    await page.getByTestId('reads-card').click();
    await expect(page.getByTestId('read-item').nth(3).getByTestId('read-check')).toBeVisible();
    await expect(page.getByTestId('read-count')).toHaveText('1 of 10 read');
  });

  test('two reads open a sheet on the Safety net tab', async ({ page }) => {
    await open(page);
    await page.getByTestId('read-item').nth(2).click(); // the surprise bill plan
    await page.getByTestId('read-action').click();
    await expect(page.getByRole('dialog', { name: 'Add a yearly bill' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await goTab(page, 'Path');
    await page.getByTestId('reads-card').click();
    await page.getByTestId('read-item').nth(7).click(); // find your first $500
    await page.getByTestId('read-action').click();
    await expect(page.getByRole('dialog', { name: /Find your first/ })).toBeVisible();
  });

  test('the lender read has a script box, and the list says so', async ({ page }) => {
    await open(page);
    await expect(page.getByTestId('read-item').nth(3)).toContainText('1 min · with a script');
    await page.getByTestId('read-item').nth(3).click();
    await expect(page.getByTestId('read-callout')).toContainText('Hello, my name is');
  });

  test('the last read points to hardship programs and NFCC.org, never a loan', async ({ page }) => {
    await open(page);
    await page.getByTestId('read-item').nth(9).click();
    const read = page.getByTestId('read');
    await expect(read).toContainText('hardship programs');
    await expect(read).toContainText('NFCC.org');
    await expect(read).toContainText('A new loan is never the answer');
  });

  test('the reads are also in Settings, under Help, and back returns there', async ({ page }) => {
    await nadiaSetup(page);
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Open Short reads' }).click();
    await expect(page.getByTestId('read-item')).toHaveCount(10);
    await page.getByRole('button', { name: '‹ Settings' }).click();
    await expect(page.getByRole('heading', { name: 'Help' })).toBeVisible();
  });
});
