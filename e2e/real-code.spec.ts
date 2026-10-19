/**
 * The whole unlock chain with a code made by scripts/make-code.js: private key signs, the app
 * (public key only) checks. This server uses the app's own public key (no test key), so it needs
 * your private key on this computer (.keys/private.hex, a .env file, or PIY_PRIVATE_KEY).
 * Without it the test is skipped.
 */
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { FIXED, quickSetup, shot } from './helpers';

test.use({ baseURL: 'http://localhost:5177' });

const haveKey = existsSync('.keys/private.hex') || Boolean(process.env.PIY_PRIVATE_KEY) || (existsSync('.env') && /PIY_PRIVATE_KEY\s*=/.test(readFileSync('.env', 'utf8')));
test.skip(!haveKey, 'needs the private key to make a code (see scripts/lib.js)');

const makeCode = (email: string) => execFileSync('node', ['scripts/make-code.js', email], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();

/** Same code with the email inside it changed and the old signature kept. */
function edited(code: string, email: string) {
  const [prefix, payload, signature] = code.split('.');
  const next = { ...JSON.parse(Buffer.from(payload!, 'base64url').toString()), id: email };
  return [prefix, Buffer.from(JSON.stringify(next)).toString('base64url'), signature].join('.');
}

test('a code from scripts/make-code.js unlocks, an edited or wrong one does not', async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
  const code = makeCode('test@paidinyellow.com');
  await quickSetup(page, { unlock: false });
  await page.getByRole('button', { name: 'I have a code' }).click();
  const box = page.getByRole('textbox', { name: 'Your unlock code' });
  const unlock = page.getByRole('button', { name: 'Unlock', exact: true });
  const refused = page.getByText('This code doesn’t look right. Check that you copied all of it.');

  // An edited code (the email inside was changed)
  await box.fill(edited(code, 'someone.else@example.com'));
  await unlock.click();
  await expect(refused).toBeVisible();
  await shot(page, '30-edited-code');
  await expect(page.getByRole('button', { name: 'Start my plan' })).toHaveCount(0);

  // A cut-off code, and random text
  await box.fill(code.slice(0, -10));
  await unlock.click();
  await expect(refused).toBeVisible();
  await box.fill('hello world');
  await unlock.click();
  await expect(refused).toBeVisible();

  // Nothing pasted
  await box.fill('');
  await unlock.click();
  await expect(page.getByText('Paste your unlock code first.')).toBeVisible();

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
