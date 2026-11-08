/** Dark mode polish: empty squares you can see, a calm night scene, a toned-down PAID card, and the chapter note. */
import { expect, test, type Page } from '@playwright/test';
import { nadiaSetup } from './nadia';
import { goTab, tapDidIt } from './scenario';

/** WCAG contrast of two css colors, read from the page (rgb or rgba, the second is the background) */
async function ratio(page: Page, fg: string, bg: string): Promise<number> {
  return page.evaluate(
    ([a, b]) => {
      const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const lum = ([r, g, bl]: number[]) => {
        const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(bl!);
      };
      const [x, y] = [lum(parse(a!)), lum(parse(b!))].sort((p, q) => q - p);
      return (x! + 0.05) / (y! + 0.05);
    },
    [fg, bg],
  );
}

async function useDark(page: Page) {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Change Theme' }).click();
  await page.getByRole('radio', { name: 'Dark' }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Back to Today' }).click();
}

test.describe('empty payday squares in dark mode', () => {
  test('Chapters: the border is at least 3:1 against the card', async ({ page }) => {
    await nadiaSetup(page);
    await useDark(page);
    await goTab(page, 'Path');
    await page.getByRole('button', { name: 'Chapters', exact: true }).click();
    const empty = page.locator('.chapter-squares i:not(.paid):not(.next)').first();
    const border = await empty.evaluate((el) => getComputedStyle(el).borderTopColor);
    const card = await page.locator('.chapter').first().evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(await ratio(page, border, card)).toBeGreaterThanOrEqual(3);
  });

  test('Road: an empty square edge is at least 3:1 against the card', async ({ page }) => {
    await nadiaSetup(page);
    await useDark(page);
    await goTab(page, 'Path');
    const sq = page.locator('.road-sq.ahead .sq-body').first();
    const stroke = await sq.evaluate((el) => getComputedStyle(el).stroke);
    const card = await page.locator('section.card[aria-labelledby="road-title"]').evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(await ratio(page, stroke, card)).toBeGreaterThanOrEqual(3);
  });
});

test.describe('the dark scene', () => {
  test('Today in dark: lighter hills and a soft sun, so the scene reads as calm night', async ({ page }) => {
    await nadiaSetup(page);
    await useDark(page);
    const fill = (sel: string) => page.locator(`[data-testid="scene"] ${sel}`).first().evaluate((el) => getComputedStyle(el).fill);
    expect(await fill('.sc-hill1')).toBe('rgb(46, 69, 55)'); // #2E4537
    expect(await fill('.sc-hill2')).toBe('rgb(58, 85, 68)'); // #3A5544
    expect(await fill('.sc-sun')).toBe('rgba(255, 246, 194, 0.35)');
    const sky = await fill('.sc-sky');
    expect(await ratio(page, await fill('.sc-hill2'), sky)).toBeGreaterThanOrEqual(1.6);
  });
});

test.describe('the PAID card in dark mode', () => {
  test('still yellow, a little muted, with text at least 4.5:1', async ({ page }) => {
    await nadiaSetup(page);
    await useDark(page);
    await tapDidIt(page);
    const card = page.getByTestId('paid-card');
    await expect(card).toBeVisible();
    const bg = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(232, 204, 69)'); // #E8CC45, softer than the day yellow
    const [r, g, b] = (bg.match(/\d+/g) ?? []).map(Number);
    expect(r! > b! + 100 && g! > b! + 100).toBe(true); // it is still plainly yellow
    for (const sel of ['.paid-stamp', '.paid-rows li', '.link']) {
      const text = await card.locator(sel).first().evaluate((el) => getComputedStyle(el).color);
      expect(await ratio(page, text, bg), sel).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('in the day theme the card keeps the full yellow', async ({ page }) => {
    await nadiaSetup(page);
    await tapDidIt(page);
    await expect(page.getByTestId('paid-card')).toHaveCSS('background-color', 'rgb(255, 225, 77)');
  });
});
