/**
 * Buyers from Etsy open the app from their "Open me first" PDF with  ?from=etsy . The app remembers it on this device,
 * takes it out of the address bar, and keeps it after a reload, a home screen launch and "Erase everything".
 */
import { expect, test, type Page } from '@playwright/test';
import { FIXED, quickSetup, unlockOnResult } from './helpers';
import { goTab, revealEarly } from './scenario';
import { testCode } from './testKey';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
});

const saved = (page: Page) => page.evaluate(() => localStorage.getItem('piy.source'));

test('?from=etsy is saved and leaves the address bar, and a reload without it keeps it', async ({ page }) => {
  await page.goto('/?from=etsy');
  await expect(page.getByText('You’re not bad at math.')).toBeVisible();
  expect(await saved(page)).toBe('etsy');
  expect(new URL(page.url()).search).toBe('');

  // A reload, or a home screen launch, has no query string: the saved value counts
  await page.goto('/');
  expect(await saved(page)).toBe('etsy');
});

test('"Erase everything" keeps it, like the unlock code', async ({ page }) => {
  await page.goto('/?from=etsy');
  await quickSetup(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Erase everything and start over' }).click();
  await page.getByLabel('Also remove my unlock code from this device').check();
  await page.getByRole('button', { name: 'Yes, erase everything' }).click();
  await expect(page.getByText('You’re not bad at math.')).toBeVisible();
  expect(await saved(page)).toBe('etsy');
});

test('no query, or another value, keeps the app as it was', async ({ page }) => {
  await page.goto('/?from=newsletter');
  await expect(page.getByText('You’re not bad at math.')).toBeVisible();
  expect(await saved(page)).toBeNull();
  expect(new URL(page.url()).search).toBe('?from=newsletter'); // left alone
  await page.goto('/');
  expect(await saved(page)).toBeNull();
});

// ------------------------------------------------------------------------------------------------ Part 2: no buy links for Etsy buyers
/** No element on the screen links to paidinyellow.com or to the support email, and the email is not written anywhere */
async function noShopLinks(page: Page, where: string) {
  const found = await page.evaluate(() => {
    const links = [...document.querySelectorAll('[href], [action], [src]')].map(
      (el) => el.getAttribute('href') ?? el.getAttribute('action') ?? el.getAttribute('src') ?? '',
    );
    return { links, text: document.body.innerText };
  });
  const bad = found.links.filter((h) => /paidinyellow\.com|^mailto:/i.test(h));
  expect(bad, where).toEqual([]);
  expect(found.text, where).not.toMatch(/@paidinyellow\.com|Get the full planner/);
}

test('from Etsy: every screen, before and after unlock, has no shop link and no support email', async ({ page }) => {
  await page.goto('/?from=etsy');
  await quickSetup(page, { unlock: false, each: (p) => noShopLinks(p, 'setup') });

  // The result screen: the code box leads, with no tap and no price
  const card = page.getByTestId('unlock-card');
  await expect(card.getByRole('heading', { name: 'Unlock the full planner' })).toBeVisible();
  await expect(card.getByTestId('code-from-pdf')).toHaveText('Enter the code from your Open me first PDF.');
  await expect(card.getByRole('textbox', { name: 'Your unlock code' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'I have a code' })).toHaveCount(0);
  await expect(card.getByRole('link')).toHaveCount(0);
  await expect(card).not.toContainText('One price');
  await card.getByRole('button', { name: 'Help: What the full planner adds' }).click();
  await noShopLinks(page, 'what the full planner adds');
  await page.getByRole('button', { name: 'Got it' }).click();

  // A wrong code points back to the PDF
  await card.getByRole('textbox', { name: 'Your unlock code' }).fill('PIY1.nope');
  await card.getByRole('button', { name: 'Unlock', exact: true }).click();
  await expect(card).toContainText('Copy it again from your Open me first PDF.');

  // The right code opens the planner
  await card.getByRole('textbox', { name: 'Your unlock code' }).fill(await testCode('etsy-3141'));
  await card.getByRole('button', { name: 'Unlock', exact: true }).click();
  await page.getByRole('button', { name: 'Start my plan' }).click();
  await revealEarly(page);
  await noShopLinks(page, 'Today');
  for (const tab of ['Path', 'Debts', 'Safety net'] as const) {
    await goTab(page, tab);
    await noShopLinks(page, tab);
  }
  await goTab(page, 'Today');
  await page.getByRole('button', { name: 'Settings' }).click();
  await noShopLinks(page, 'Settings');
  await expect(page.getByTestId('help-etsy')).toHaveText('Questions? Message us through Etsy.');
  for (const row of ['Open Questions and answers', 'Open About and disclaimer', 'Open Unlock code']) {
    await page.getByRole('button', { name: row }).click();
    await noShopLinks(page, row);
    if (row === 'Open Questions and answers') await expect(page.getByTestId('faq-help-etsy')).toContainText('Message us through Etsy');
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).last().click();
  }

  // Still so after a reload (no query string). Closing a sheet steps history back: wait for it, or the reload races it
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByTestId('help-etsy')).toBeVisible();
});

test('not from Etsy: the buy link, the price line and the support email are as before', async ({ page }) => {
  await quickSetup(page, { unlock: false });
  const card = page.getByTestId('unlock-card');
  // Part 3: the button opens the product page with the buy box
  await expect(card.getByRole('link', { name: 'Get the full planner' })).toHaveAttribute('href', 'https://paidinyellow.com/products/paycheck-payoff-system-pack-1');
  await expect(card).toContainText('One price. No subscription. No bank login.');
  await expect(card.getByRole('textbox', { name: 'Your unlock code' })).toHaveCount(0); // behind "I have a code"
  await unlockOnResult(page);
  await page.getByRole('button', { name: 'Start my plan' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('link', { name: 'Write to support@paidinyellow.com' })).toHaveAttribute('href', 'mailto:support@paidinyellow.com');
  await expect(page.getByTestId('help-etsy')).toHaveCount(0);
});
