/**
 * The whole unlock chain with a code made by scripts/make-code.js: the private key in ~/.piy signs,
 * the app (public key only) checks. This server uses the app's own public key (no test key), so it
 * needs your private key on this computer. Without it the test is skipped.
 */
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { FIXED, quickSetup, shot } from './helpers';

test.use({ baseURL: 'http://localhost:5177' });

const haveKey = existsSync(join(homedir(), '.piy', 'private.pem')) || Boolean(process.env.PIY_PRIVATE_KEY_FILE) || Boolean(process.env.PIY_PRIVATE_KEY_PEM);
test.skip(!haveKey, 'needs the private key in ~/.piy/private.pem to make a code');

const makeCode = (id: string) => execFileSync('node', ['scripts/make-code.js', id], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();

/** The same code with one letter changed. */
function oneLetter(code: string, at = 25) {
  return code.slice(0, at) + (code[at] === 'A' ? 'B' : 'A') + code.slice(at + 1);
}

test('a code from scripts/make-code.js unlocks, a code changed by one letter does not', async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
  const code = makeCode('test@paidinyellow.com');
  expect(code).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  expect(Buffer.from(code.split('.')[0]!, 'base64url').toString()).toBe(`PIY1|pack1|test@paidinyellow.com|${new Date().toISOString().slice(0, 10)}`);

  await quickSetup(page, { unlock: false });
  await page.getByRole('button', { name: 'I have a code' }).click();
  const box = page.getByRole('textbox', { name: 'Your unlock code' });
  const unlock = page.getByRole('button', { name: 'Unlock', exact: true });
  const refused = page.getByText('This code doesn’t look right. Check that you copied all of it.');

  // One letter changed: in the text part, and in the signature part
  await box.fill(oneLetter(code, 25));
  await unlock.click();
  await expect(refused).toBeVisible();
  await shot(page, '30-edited-code');
  await box.fill(oneLetter(code, code.length - 20));
  await unlock.click();
  await expect(refused).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start my plan' })).toHaveCount(0);

  // A cut-off code, and random text
  await box.fill(code.slice(0, -10));
  await unlock.click();
  await expect(refused).toBeVisible();
  await box.fill('hello world');
  await unlock.click();
  await expect(refused).toBeVisible();

  // The real code, even pasted with a line break and quotes
  await box.fill(`"${code.slice(0, 50)}\n${code.slice(50)}"`);
  await unlock.click();
  await expect(page.getByRole('button', { name: 'Start my plan' })).toBeVisible();
  await page.getByRole('button', { name: 'Start my plan' }).click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();

  // It is still unlocked after closing and opening the app
  await page.reload();
  await expect(page.getByTestId('debt-free-pill')).toBeVisible();
});

test('the same code works as a link: #unlock=<code>', async ({ page, context }) => {
  await page.clock.setFixedTime(FIXED);
  const code = makeCode('shopify-1042');
  await quickSetup(page, { unlock: false });
  const link = await context.newPage();
  await link.clock.setFixedTime(FIXED);
  await link.goto(`/#unlock=${oneLetter(code)}`);
  await expect(link.getByTestId('notice')).toContainText('doesn’t look right');
  const good = await context.newPage();
  await good.clock.setFixedTime(FIXED);
  await good.goto(`/#unlock=${code}`);
  await expect(good.getByTestId('notice')).toContainText('Unlocked. Thank you.');
  await expect(good.getByRole('navigation', { name: 'Main' })).toBeVisible(); // the plan exists: straight to the full planner
});
