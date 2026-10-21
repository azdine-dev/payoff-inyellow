/**
 * https://app.paidinyellow.com/#unlock=<code>  unlocks the planner. The code is checked on the phone,
 * taken out of the address bar, and kept with the plan (or kept until the plan is made).
 * Uses the test key (the test servers get its public key), so it needs no private key.
 */
import { expect, test } from '@playwright/test';
import { FIXED, quickSetup } from './helpers';
import { testCode } from './testKey';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
});

test('a link opened before setup is kept, and the planner is open when the plan is ready', async ({ page }) => {
  const code = await testCode('shopify-1042');
  await page.goto(`/#unlock=${code}`);
  await expect(page.getByTestId('notice')).toContainText('Code saved. Your full planner opens when setup is done.');
  // The code is out of the address bar right away
  expect(page.url()).not.toContain('unlock');
  expect(page.url()).not.toContain(code.slice(0, 12));

  await quickSetup(page, { unlock: false });
  await expect(page.getByRole('button', { name: 'Start my plan' })).toBeVisible(); // no code to paste
  await expect(page.getByTestId('unlock-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Start my plan' }).click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
});

test('a link on a plan in calculator mode unlocks it, and stays unlocked after a reload', async ({ page, context }) => {
  await quickSetup(page, { unlock: false });
  await expect(page.getByTestId('unlock-card')).toBeVisible();

  // Like clicking the link in the email: a new tab with the code after the #
  const link = await context.newPage();
  await link.clock.setFixedTime(FIXED);
  await link.goto(`/#unlock=${await testCode('shopify-1042')}`);
  await expect(link.getByTestId('notice')).toHaveText(/Unlocked\. Thank you\./);
  expect(link.url()).not.toContain('unlock');
  // The plan already exists, so the full planner opens straight away
  await expect(link.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await expect(link.getByTestId('debt-free-pill')).toBeVisible();

  await link.reload();
  await expect(link.getByRole('navigation', { name: 'Main' })).toBeVisible(); // still the full planner
  await expect(link.getByTestId('notice')).toHaveCount(0);
});

test('a link with a code changed by one letter is refused with a simple message', async ({ page, context }) => {
  await quickSetup(page, { unlock: false });
  const code = await testCode('shopify-1042');
  const edited = code.slice(0, 20) + (code[20] === 'A' ? 'B' : 'A') + code.slice(21);

  const link = await context.newPage();
  await link.clock.setFixedTime(FIXED);
  await link.goto(`/#unlock=${edited}`);
  await expect(link.getByTestId('notice')).toHaveText(/This code looks incomplete\. Copy it again, or tap the button in your purchase email\./);
  await expect(link.getByTestId('unlock-card')).toBeVisible(); // still calculator mode
  await expect(link.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
  await link.getByRole('button', { name: 'OK' }).click();
  await expect(link.getByTestId('notice')).toHaveCount(0);

  // An empty link is refused too
  const empty = await context.newPage();
  await empty.clock.setFixedTime(FIXED);
  await empty.goto('/#unlock=');
  await expect(empty.getByTestId('notice')).toContainText('Paste your unlock code first.');
});

test('the "code saved" message goes away by itself and never blocks a tap', async ({ page }) => {
  // No fixed clock here: a frozen clock would also freeze the message's timer
  await page.goto(`/#unlock=${await testCode('shopify-1042')}`);
  const notice = page.getByTestId('notice');
  await expect(notice).toBeVisible();
  // A tap on the screen under the message goes through it
  await page.getByRole('button', { name: /Let’s start/ }).click();
  await expect(page.getByRole('heading').first()).toBeVisible();
  // And it is gone after a few seconds, with no tap on OK
  await expect(notice).toHaveCount(0, { timeout: 8000 });
});
