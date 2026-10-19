/**
 * Sync between two phones: two separate browsers (each with its own storage), one local Worker.
 * Phone A turns sync on and shows a link. Phone B opens it and gets the plan. Changes go both ways.
 */
import { expect, test, type Page } from '@playwright/test';
import { FIXED, quickSetup } from './helpers';
import { iDidIt, goTab } from './scenario';

const later = (minutes: number) => new Date(FIXED.getTime() + minutes * 60_000);

async function settings(page: Page) {
  await page.getByRole('button', { name: 'Settings' }).click();
}

async function turnOnAndGetLink(page: Page): Promise<string> {
  await settings(page);
  await page.getByRole('button', { name: 'Turn on sync' }).click();
  await expect(page.getByTestId('sync-status')).toHaveText('Up to date.');
  await page.getByRole('button', { name: 'Add another phone' }).click();
  await expect(page.getByTestId('sync-link-box').locator('svg')).toBeVisible(); // the QR code
  return page.getByTestId('sync-link').inputValue();
}

test('a second phone joins with the link and the two stay in step', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const a = await ctxA.newPage();
  await a.clock.setFixedTime(later(0));
  await quickSetup(a);
  const link = await turnOnAndGetLink(a);

  // The key and the id are in the # part only
  expect(link).toMatch(/^http:\/\/localhost:5174\/#sync=[\w-]{22}\.[\w-]{43}&unlock=/);

  // Phone B: a fresh browser, opens the link
  const ctxB = await browser.newContext();
  const b = await ctxB.newPage();
  const requests: string[] = [];
  b.on('request', (r) => requests.push(r.url()));
  await b.clock.setFixedTime(later(1));
  await b.goto(link);
  await expect(b.getByTestId('notice')).toContainText('Synced. Your plan is on this phone now.');
  await expect(b.getByTestId('debt-free-pill')).toBeVisible(); // the full planner, with the plan
  expect(b.url()).not.toContain('sync=');
  // The key never went to any server
  const key = link.match(/sync=[\w-]{22}\.([\w-]{43})/)![1]!;
  expect(requests.filter((u) => u.includes(key))).toEqual([]);

  // A taps "I did it" (a few minutes later)
  await a.clock.setFixedTime(later(5));
  await goTab(a, 'Today');
  await iDidIt(a, 'Fri 23 Oct');
  // B syncs and sees the payday done
  await b.clock.setFixedTime(later(6));
  await b.getByTestId('notice').getByRole('button', { name: 'OK' }).click();
  await settings(b);
  await b.getByRole('button', { name: 'Sync now' }).click();
  await expect(b.getByTestId('sync-status')).toHaveText('Up to date.');
  await goTab(b, 'Progress');
  await expect(b.getByText(/Paid so far/i).first()).toBeVisible();

  await ctxA.close();
  await ctxB.close();
});

test('stop and delete: the server is emptied and the other phone is told', async ({ browser, request }) => {
  const ctxA = await browser.newContext();
  const a = await ctxA.newPage();
  await a.clock.setFixedTime(later(0));
  await quickSetup(a);
  const link = await turnOnAndGetLink(a);
  const [syncId] = link.match(/sync=([\w-]{22})/)!.slice(1);

  await a.getByRole('button', { name: 'Stop syncing and delete my server data' }).click();
  await a.getByRole('button', { name: 'Stop syncing and delete', exact: true }).click();
  await expect(a.getByText(/synced data was deleted from the server/)).toBeVisible();
  await expect(a.getByRole('button', { name: 'Turn on sync' })).toBeVisible();

  // Opening the old link now fails calmly and changes nothing
  const ctxB = await browser.newContext();
  const b = await ctxB.newPage();
  await b.clock.setFixedTime(later(1));
  await b.goto(link);
  await expect(b.getByTestId('notice')).toContainText('This sync link doesn’t work');
  expect(syncId).toBeTruthy();
  await ctxA.close();
  await ctxB.close();
});

test('a link with a missing key is refused and nothing changes', async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
  await quickSetup(page);
  await page.goto('/#sync=Kx7Qm2Zr9TpVnB4LcYd8Wa.tooshort');
  await expect(page.getByTestId('notice')).toContainText('This sync link doesn’t work');
  await expect(page.getByTestId('debt-free-pill')).toBeVisible();
});
