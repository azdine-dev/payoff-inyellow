/** Part B: Path as one illustrated journey, with the Nadia scenario (see e2e/nadia.ts). */
import { expect, test, type Page } from '@playwright/test';
import { expectBrandRules, goTab } from './scenario';
import { nadiaSetup } from './nadia';

const road = (page: Page) => page.getByTestId('road');

test.describe('Part B · Path, the Nadia scenario', () => {
  test('the header, the stats line, and no second date', async ({ page }) => {
    await nadiaSetup(page);
    await goTab(page, 'Path');
    await expect(page.getByTestId('countdown-toggle')).toHaveText(/^\d+ months to go$/);
    await expect(page.getByTestId('status-line')).toHaveText('Debt-free · Jul 2027');
    await expect(page.getByTestId('status-line').locator('.hl')).toBeVisible();
    for (const label of ['Paid off', 'Still owed', 'Interest you avoid']) await expect(page.getByRole('group', { name: 'Your numbers' })).toContainText(label);
    // the date is said once: not on the chart, not written on the road
    await expect(page.getByRole('img', { name: /Balance over time/ })).not.toContainText('Debt-free');
    await expect(road(page)).not.toContainText('Jul 2027');
    await page.getByTestId('countdown-toggle').click();
    await expect(page.getByTestId('countdown-toggle')).toHaveText(/years? to go$/);
  });

  test('PaidInYellow order: the flags stand on Fri 1 Jan, Fri 12 Feb and Fri 16 Jul 2027', async ({ page }) => {
    await nadiaSetup(page);
    await goTab(page, 'Path');
    await expect(road(page).getByRole('button', { name: /^Store Card\. Gone Fri 1 Jan 2027/ })).toHaveCount(1);
    await expect(road(page).getByRole('button', { name: /^Medical\. Gone Fri 12 Feb 2027/ })).toHaveCount(1);
    await expect(road(page).getByRole('button', { name: /^Debt-free\. Your last payment is Fri 16 Jul 2027/ })).toHaveCount(1);
    // a debt flag opens a sheet with the name, the date and the amount
    await road(page).getByRole('button', { name: /^Medical\. Gone/ }).dispatchEvent('click');
    const sheet = page.getByTestId('road-flag-sheet');
    await expect(sheet).toContainText('Gone Fri 12 Feb 2027.');
    await expect(sheet).toContainText('$600 to pay off.');
    await expect(page.getByRole('dialog', { name: 'Medical' })).toBeVisible();
  });

  test('the road: two pre-filled squares, the next payday outlined, a pin there, and day one in words', async ({ page }) => {
    await nadiaSetup(page);
    await goTab(page, 'Path');
    await expect(page.locator('[data-testid="road-sq"][data-kind="start"]')).toHaveCount(2);
    await expect(page.locator('[data-testid="road-sq"][data-kind="next"]')).toHaveCount(1);
    await expect(page.getByTestId('road-pin')).toHaveAttribute('aria-label', 'You are here, Fri 6 Nov, next payday');
    await expect(page.getByTestId('day-one')).toHaveText('Day one. Your first yellow square is Fri 6 Nov.');
    await expect(page.getByTestId('next-stop')).toContainText('Store Card');
    await expect(page.getByTestId('next-stop')).toContainText('Fri 1 Jan 2027');
    await expectBrandRules(page);
  });

  test('the road opens scrolled to the pin', async ({ page }) => {
    await nadiaSetup(page);
    await goTab(page, 'Path');
    await page.waitForTimeout(800);
    const scrolled = await page.locator('.road-scroll').evaluate((el) => el.scrollTop);
    expect(scrolled).toBeGreaterThan(0); // the pin is near the bottom of a tall road
    const pin = (await page.getByTestId('road-pin').boundingBox())!;
    const box = (await page.locator('.road-scroll').boundingBox())!;
    expect(pin.y).toBeGreaterThanOrEqual(box.y - 40);
    expect(pin.y).toBeLessThanOrEqual(box.y + box.height);
  });

  test('"Pay a bit more?": a chip moves the finish flag and shows the new date, then Use this applies it', async ({ page }) => {
    await nadiaSetup(page);
    await goTab(page, 'Path');
    const finish = page.locator('[data-testid="road-flag"][data-kind="finish"]');
    const before = Number(await finish.getAttribute('data-index'));
    const header = await page.getByTestId('status-line').innerText();
    const more = page.getByTestId('pay-more');
    await more.getByRole('button', { name: '+$200', exact: true }).click();
    await expect(more.getByTestId('more-result')).toContainText('Debt-free');
    await expect(more.getByTestId('more-result')).toContainText('sooner');
    await expect(more.getByTestId('more-result')).toContainText('less interest');
    await expect.poll(async () => Number(await finish.getAttribute('data-index'))).toBeLessThan(before);
    // the same chip again clears the preview and the flag goes back
    await more.getByRole('button', { name: '+$200', exact: true }).click();
    await expect.poll(async () => Number(await finish.getAttribute('data-index'))).toBe(before);
    await more.getByRole('button', { name: '+$200', exact: true }).click();
    await more.getByRole('button', { name: 'Use this' }).click();
    await expect(more.getByTestId('more-done')).toBeVisible();
    await expect(page.getByTestId('status-line')).not.toHaveText(header);
    await expect(page.getByRole('button', { name: 'What if I add more?' })).toHaveCount(0);
  });

  test('biggest interest first: Store Card on Fri 1 Jan, Visa then Medical in July 2027, $1,203 avoided', async ({ page }) => {
    await nadiaSetup(page);
    await goTab(page, 'Path');
    await page.getByRole('button', { name: 'Order', exact: true }).click();
    await page.getByRole('radio', { name: /Biggest interest first/ }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.getByTestId('interest-avoided')).toHaveText('$1,203');
    await expect(road(page).getByRole('button', { name: /^Store Card\. Gone Fri 1 Jan 2027/ })).toHaveCount(1);
    await expect(road(page).getByRole('button', { name: /^Visa\. Gone .* Jul 2027/ })).toHaveCount(1);
    // Medical is last: its flag is the finish flag, which names it as the last debt
    await expect(road(page).getByRole('button', { name: /^Debt-free\. Your last payment is .* Jul 2027/ })).toHaveCount(1);
    await road(page).getByRole('button', { name: /^Debt-free\./ }).dispatchEvent('click');
    await expect(page.getByTestId('road-flag-sheet')).toContainText('Medical is the last debt.');
  });

  test('the chart keeps its place at the bottom with the minimums-only end labelled', async ({ page }) => {
    await nadiaSetup(page);
    await goTab(page, 'Path');
    const chart = page.getByRole('img', { name: /Balance over time/ });
    await expect(chart).toContainText(/Minimums only: [A-Z][a-z]{2} 20\d\d/);
    await expect(page.getByRole('heading', { name: 'Your plan vs minimums only' })).toBeVisible();
  });

  test('footer links Order, Print and Export; Share my progress only after a debt is paid', async ({ page }) => {
    await nadiaSetup(page);
    await goTab(page, 'Path');
    await expect(page.getByRole('button', { name: 'Share my progress' })).toHaveCount(0);
    for (const name of ['Order', 'Print', 'Export']) await expect(page.getByRole('navigation', { name: 'Order, print and export' }).getByRole('button', { name })).toBeVisible();
    // pay Store Card off with extra money: the share card appears, and its road flag is a PAID stamp
    await goTab(page, 'Today');
    await page.getByRole('button', { name: 'I got extra money' }).click();
    await page.getByRole('textbox', { name: 'Extra money' }).fill('450');
    await page.getByRole('button', { name: 'Use it', exact: true }).click();
    await page.getByRole('button', { name: /Next payday|Done/ }).click();
    await goTab(page, 'Path');
    await expect(page.getByRole('button', { name: 'Share my progress' })).toBeVisible();
    const stamped = page.locator('[data-testid="road-flag"][data-paid="1"]');
    await expect(stamped).toHaveCount(1);
    await expect(stamped).toContainText('PAID');
    await expect(stamped).toContainText('Store Card');
  });

  test('motion is off with prefers-reduced-motion: the pin and the finish flag do not slide', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await nadiaSetup(page);
    await goTab(page, 'Path');
    for (const sel of ['.road-pin', '.road-finish']) expect(await page.locator(sel).first().evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
  });
});
