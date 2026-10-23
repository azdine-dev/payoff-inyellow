/** ux-v2.md section 1: four tabs (Today, Path, Debts, Safety net), the active one on a soft pill, never yellow. */
import { expect, test } from '@playwright/test';
import { FIXED, quickSetup } from './helpers';
import { goTab } from './scenario';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
});

const nav = (page: import('@playwright/test').Page) => page.getByRole('navigation', { name: 'Main' });

test('four tabs, with their labels always visible', async ({ page }) => {
  await quickSetup(page);
  const buttons = nav(page).getByRole('button');
  await expect(buttons).toHaveCount(4);
  await expect(buttons).toHaveText(['Today', 'Path', 'Debts', 'Safety net']);
  for (const name of ['Today', 'Path', 'Debts', 'Safety net']) await expect(nav(page).getByRole('button', { name, exact: true })).toBeVisible();
  // Plan, Progress and Money are no longer tabs
  for (const name of ['Plan', 'Progress', 'Money']) await expect(nav(page).getByRole('button', { name, exact: true })).toHaveCount(0);
});

test('each tab opens its screen, and Path holds what Plan and Progress showed', async ({ page }) => {
  await quickSetup(page);
  await nav(page).getByRole('button', { name: 'Path', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your path' })).toBeVisible();
  // Progress side: the countdown and the share paid
  await expect(page.getByTestId('countdown')).toContainText(/paydays to go/);
  await expect(page.getByTestId('paid-so-far')).toBeVisible();
  // Plan side: the payday list, the order and the what-if
  await page.getByRole('group', { name: 'Path view' }).getByRole('button', { name: 'Plan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What if?' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Which debt first?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fri 23 Oct, to come' })).toBeVisible();
  await expect(page.getByTestId('status-line')).toBeVisible(); // the same header line, once

  await nav(page).getByRole('button', { name: 'Debts', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Debts' })).toBeVisible();
  await nav(page).getByRole('button', { name: 'Safety net', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Safety net' })).toBeVisible();
  await expect(page.getByText('So the next surprise bill stays off your cards.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Buffer' })).toBeVisible();
  await nav(page).getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('button', { name: /^I did it/ })).toBeVisible();
});

test('the active tab sits on a soft pill, and nothing in the tab bar is yellow', async ({ page }) => {
  await quickSetup(page);
  const read = () =>
    page.evaluate(() => {
      const rgb = (c: string) => c.replace(/\s/g, '');
      const out: Record<string, { pill: string; label: string; icon: string; weight: string; current: boolean }> = {};
      document.querySelectorAll<HTMLElement>('nav[aria-label="Main"] button').forEach((b) => {
        const pill = b.querySelector<HTMLElement>('.tab-pill')!;
        out[b.textContent!.trim()] = { pill: rgb(getComputedStyle(pill).backgroundColor), label: rgb(getComputedStyle(b).color), icon: rgb(getComputedStyle(b.querySelector('svg')!).stroke), weight: getComputedStyle(b).fontWeight, current: b.getAttribute('aria-current') === 'page' };
      });
      const yellow = Array.from(document.querySelectorAll('nav[aria-label="Main"] *')).some((el) => {
        const cs = getComputedStyle(el);
        return [cs.backgroundColor, cs.fill, cs.stroke, cs.color, cs.borderTopColor].some((c) => rgb(c) === 'rgb(255,225,77)');
      });
      return { out, yellow };
    });

  for (const name of ['Today', 'Path', 'Debts', 'Safety net']) {
    await nav(page).getByRole('button', { name, exact: true }).click();
    const { out, yellow } = await read();
    expect(yellow).toBe(false); // yellow means paid, never navigation
    for (const [label, s] of Object.entries(out)) {
      if (label === name) {
        expect(s.current).toBe(true);
        expect(s.pill).toBe('rgb(226,220,205)'); // --line
        expect(Number(s.weight)).toBeGreaterThanOrEqual(600); // bold label
      } else {
        expect(s.current).toBe(false);
        expect(s.pill).toBe('rgba(0,0,0,0)'); // no pill
      }
      expect(s.icon).toBe('rgb(31,42,68)'); // every icon is drawn in ink
      expect(s.label).toBe(label === name ? 'rgb(31,42,68)' : 'rgb(92,90,85)'); // ink when active, gray otherwise
    }
  }
});

test('the old shortcuts still land on the right view', async ({ page }) => {
  await quickSetup(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Path tab' }).click(); // "Your payoff order is on the Path tab"
  await expect(page.getByRole('heading', { name: 'Which debt first?' })).toBeVisible();
  await goTab(page, 'Progress');
  await expect(page.getByTestId('countdown')).toBeVisible();
  await goTab(page, 'Money');
  await expect(page.getByRole('heading', { name: 'Safety net' })).toBeVisible();
});
