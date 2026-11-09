/** One suggested short read on Today: after "I did it" or when nothing is due, never above the payday card, ticked once read. */
import { expect, test } from '@playwright/test';
import { READS } from '../src/copy/reads';
import { nadiaSetup } from './nadia';
import { expectBrandRules, goTab, tapDidIt } from './scenario';

const title = (id: string) => READS.find((r) => r.id === id)!.title;

test('not while the payday card is there: day one has no read card', async ({ page }) => {
  await nadiaSetup(page);
  await expect(page.locator('.payday-card')).toBeVisible();
  await expect(page.getByTestId('today-read')).toHaveCount(0);
});

test('after I did it: one small card under the PAID card, with the title and 1 min, and no new tab', async ({ page }) => {
  await nadiaSetup(page);
  await tapDidIt(page);
  await expect(page.getByTestId('paid-card')).toBeVisible();
  const card = page.getByTestId('today-read');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText(title('smallest-first')); // the first payday
  await expect(card).toContainText('1 min');
  await expect(card).toHaveAttribute('data-read-id', 'smallest-first');
  const a = await page.getByTestId('paid-card').boundingBox();
  const b = await card.boundingBox();
  expect(b!.y).toBeGreaterThan(a!.y + a!.height - 1); // under the card, never above it
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('button')).toHaveCount(4);
  await expect(card.getByRole('textbox')).toHaveCount(0); // no typed field
  await expectBrandRules(page);
});

test('tap it to read, Back comes home, and the card has a tick', async ({ page }) => {
  await nadiaSetup(page);
  await tapDidIt(page);
  await page.getByTestId('today-read').click();
  await expect(page.getByTestId('read')).toBeVisible();
  await expect(page.getByRole('heading', { name: title('smallest-first') })).toBeVisible();
  await page.getByRole('button', { name: '‹ Today' }).click();
  await expect(page.getByRole('heading', { name: /Done for this payday|Next payday/ })).toBeVisible();
  const card = page.getByTestId('today-read');
  await expect(card).toHaveAttribute('data-read', '1');
  await expect(page.getByTestId('today-read-check')).toBeVisible();
  // it stays ticked after a reload, until the next payday
  await page.reload();
  await expect(page.getByTestId('today-read')).toHaveAttribute('data-read-id', 'smallest-first');
  await expect(page.getByTestId('today-read')).toHaveAttribute('data-read', '1');
});

test('the next payday suggests the next read, and it shows when nothing is due too', async ({ page }) => {
  await nadiaSetup(page);
  await tapDidIt(page);
  await page.getByTestId('today-read').click();
  await page.getByRole('button', { name: '‹ Today' }).click();
  await expect(page.getByTestId('today-read')).toHaveAttribute('data-read', '1');
  // the next payday, done
  await page.clock.setFixedTime(new Date('2026-11-20T10:00:00'));
  await page.reload();
  await expect(page.locator('.payday-card')).toBeVisible();
  await expect(page.getByTestId('today-read')).toHaveCount(0); // never above (or beside) the payday card
  await tapDidIt(page);
  await expect(page.getByTestId('paid-card')).toBeVisible();
  const next = page.getByTestId('today-read');
  await expect(next).toHaveCount(1);
  await expect(next).not.toHaveAttribute('data-read-id', 'smallest-first'); // the next one
  await expect(next).not.toHaveAttribute('data-read', '1'); // not read yet
});

test('Path keeps the whole list: See all reads', async ({ page }) => {
  await nadiaSetup(page);
  await goTab(page, 'Path');
  const card = page.getByTestId('reads-card');
  await expect(card).toContainText('See all reads');
  await card.click();
  await expect(page.getByTestId('read-list')).toBeVisible();
  await expect(page.getByTestId('read-item')).toHaveCount(READS.length);
  await page.getByRole('button', { name: '‹ Path' }).click();
  await expect(page.getByRole('heading', { name: 'Your path' })).toBeVisible();
});
