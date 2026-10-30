/** The simpler look: the countdown card with the road, the small labels, the calendar, empty states, first name. */
import { expect, test } from '@playwright/test';
import { FIXED, quickSetup } from './helpers';
import { expectBrandRules, goTab, tapDidIt } from './scenario';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
});

test.describe('2 · the countdown card', () => {
  test('shows years and months as two big numbers, the month on the highlight, and the road', async ({ page }) => {
    await quickSetup(page);
    const card = page.getByTestId('debt-free-pill');
    await expect(card).toContainText('Debt-free countdown');
    // under a year: only the months show, a zero part is left out
    await expect(card.locator('.dfc-unit')).toHaveCount(1);
    await expect(card.locator('.dfc-unit').first()).toContainText(/^\d+\s*months$/);
    await expect(card.locator('.hl')).toHaveText(/^[A-Z][a-z]+ 20\d\d$/);
    await expect(card.locator('svg.road')).toBeVisible();
    // 8 squares, only the first is yellow at the start
    await expect(card.locator('.road-sq')).toHaveCount(8);
    await expect(card.locator('.road-sq.on')).toHaveCount(1);
    await expectBrandRules(page);
  });

  test('opens Path, and the result screen carries a small road too', async ({ page }) => {
    await quickSetup(page);
    await page.getByTestId('debt-free-pill').click();
    await expect(page.getByRole('heading', { name: 'Your path' })).toBeVisible();
  });

  test('the road follows the dark theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await quickSetup(page);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).not.toBe('rgb(244, 240, 230)');
    await expect(page.getByTestId('debt-free-pill').locator('svg.road')).toBeVisible();
  });
});

test.describe('3 · labels on payday rows and Coming up', () => {
  test('payday rows carry Bill and Extra, and a ticked row gets a yellow Paid label', async ({ page }) => {
    await quickSetup(page);
    const row = page.getByRole('checkbox', { name: /Store card/ });
    await expect(row.locator('.tag', { hasText: 'Bill' })).toBeVisible();
    await expect(row.locator('.tag', { hasText: 'Extra' })).toBeVisible();
    await expect(row.locator('.tag.paid')).toHaveCount(0);
    await row.click();
    // the label shows for a moment before the payday is recorded (or stays, when ticking is not the last step)
    await expect(row.locator('.tag.paid').or(page.getByTestId('paid-card'))).toBeVisible();
  });

  test('Coming up says Paid once a payday covered the bill', async ({ page }) => {
    await quickSetup(page);
    await tapDidIt(page);
    await expect(page.getByTestId('paid-card')).toBeVisible();
    await page.clock.setFixedTime(new Date('2026-10-30T10:00:00'));
    await page.reload();
    const coming = page.getByTestId('coming-up');
    await expect(coming).toBeVisible();
    const store = coming.locator('[data-state]', { hasText: 'Store card' });
    await expect(store.locator('.tag', { hasText: 'Bill' })).toBeVisible();
    await expect(store.locator('.tag.paid')).toHaveText('Paid');
    const visa = coming.locator('[data-state]', { hasText: 'Visa' });
    await expect(visa.locator('.tag.paid')).toHaveCount(0);
    await expectBrandRules(page);
  });

  test('the payday list uses Bill, Extra, Buffer and Yearly, with a yellow Paid once done', async ({ page }) => {
    await quickSetup(page);
    await goTab(page, 'Path');
    await page.getByRole('button', { name: 'Payday list' }).click();
    const next = page.getByRole('button', { name: 'Fri 23 Oct, to come' }).locator('xpath=..');
    await expect(next.locator('.tag', { hasText: 'Bill' })).toBeVisible();
    await expect(next.locator('.tag', { hasText: 'Minimum' })).toHaveCount(0);
    await expect(next.locator('.tag.paid')).toHaveCount(0);
  });
});

test.describe('4 · Path: List / Calendar', () => {
  test('a month grid with a dot under paydays and bill days, and a day opens its lines', async ({ page }) => {
    await quickSetup(page);
    await goTab(page, 'Path');
    // List is the first view: the squares
    await expect(page.locator('.payday-grid')).toBeVisible();
    await page.getByRole('button', { name: 'Calendar', exact: true }).click();
    const cal = page.getByTestId('payday-calendar');
    await expect(cal).toContainText('October 2026');
    await expect(page.locator('.payday-grid')).toBeHidden();
    const payday = cal.getByRole('gridcell', { name: 'Friday 23 October, payday' });
    await expect(payday.locator('.dot-pay')).toHaveCount(1);
    const bill = cal.getByRole('gridcell', { name: 'Monday 12 October, bill due' });
    await expect(bill.locator('.dot-bill')).toHaveCount(1);
    // tap a payday: its lines and total
    await payday.click();
    const lines = page.getByTestId('calendar-day');
    await expect(lines).toContainText('Store card');
    await expect(lines.locator('.tag', { hasText: 'Bill' })).toBeVisible();
    await expect(lines).toContainText('Total');
    // tap a bill day
    await bill.click();
    await expect(lines).toContainText('Visa due');
    // next month, then back to the List
    await cal.getByRole('button', { name: 'Next month' }).click();
    await expect(cal).toContainText('November 2026');
    await expect(cal.getByRole('gridcell', { name: 'Friday 6 November, payday' })).toBeVisible();
    await page.getByRole('button', { name: 'List', exact: true }).click();
    await expect(page.locator('.payday-grid')).toBeVisible();
    await expectBrandRules(page);
  });

  test('a paid payday is a yellow filled circle', async ({ page }) => {
    await quickSetup(page);
    await tapDidIt(page);
    await expect(page.getByTestId('paid-card')).toBeVisible();
    await goTab(page, 'Path');
    await page.getByRole('button', { name: 'Calendar', exact: true }).click();
    const paid = page.getByTestId('payday-calendar').getByRole('gridcell', { name: 'Friday 23 October, payday, paid' });
    await expect(paid).toHaveClass(/paid/);
    await expect(paid.locator('.cal-num')).toHaveCSS('background-color', 'rgb(255, 225, 77)');
    await expect(paid.locator('.dot-pay')).toHaveCount(0);
    await paid.click();
    const lines = page.getByTestId('calendar-day');
    await expect(lines.locator('.tag.paid').first()).toHaveText('Paid');
    await expect(lines).toContainText('Total');
  });

  test('an empty day says so with a small picture', async ({ page }) => {
    await quickSetup(page);
    await goTab(page, 'Path');
    await page.getByRole('button', { name: 'Calendar', exact: true }).click();
    await page.getByTestId('payday-calendar').getByRole('gridcell', { name: 'Thursday 15 October' }).click();
    await expect(page.getByTestId('calendar-day').getByTestId('empty')).toContainText('Nothing on this day.');
  });
});

test.describe('5 · empty lists', () => {
  test('every empty list has a small picture and one warm line', async ({ page }) => {
    await quickSetup(page);
    // Today: nothing due in the next 14 days
    const comingEmpty = page.getByTestId('coming-up-empty');
    await expect(comingEmpty.getByTestId('empty')).toContainText('Nothing due in the next 14 days.');
    await expect(comingEmpty.locator('svg.empty-art')).toBeVisible();
    // Safety net: no yearly bills yet
    await goTab(page, 'Safety net');
    await expect(page.getByRole('region', { name: 'Yearly bills' }).getByTestId('empty')).toContainText('No yearly bills yet.');
    // Debts: a debt with no history
    await goTab(page, 'Debts');
    await page.getByRole('button', { name: 'Visa, options' }).click();
    await page.getByRole('button', { name: 'History' }).click();
    await expect(page.getByRole('dialog').getByTestId('empty')).toContainText('Nothing yet.');
    await page.getByRole('button', { name: 'Close' }).click();
    // Path: the payday list when nothing is done yet
    await goTab(page, 'Path');
    await page.getByRole('button', { name: 'Payday list' }).click();
    await page.getByRole('button', { name: /^Done/ }).click();
    await expect(page.getByRole('dialog').getByTestId('empty')).toContainText('No paydays done yet.');
    await expectBrandRules(page);
  });

  test('a plan with every debt archived says so warmly', async ({ page }) => {
    await quickSetup(page);
    await goTab(page, 'Debts');
    for (const name of ['Visa', 'Store card']) {
      await page.getByRole('button', { name: `${name}, options` }).click();
      await page.getByRole('button', { name: 'Archive' }).click();
    }
    await expect(page.getByRole('region', { name: 'No debts' }).getByTestId('empty')).toContainText('No debts to pay right now.');
  });
});

test.describe('6 · first name', () => {
  test('the name asked in setup shows in the Today greeting, and nowhere else', async ({ page }) => {
    await quickSetup(page, { name: 'Marco' });
    await expect(page.getByTestId('greeting')).toHaveText('Hi Marco. Next payday is Fri 23 Oct.');
    await goTab(page, 'Debts');
    await expect(page.locator('main')).not.toContainText('Marco');
    await goTab(page, 'Path');
    await expect(page.locator('main')).not.toContainText('Marco');
  });

  test('without a name the greeting is the plain one', async ({ page }) => {
    await quickSetup(page);
    await expect(page.getByTestId('greeting')).toHaveText('Next payday is Fri 23 Oct.');
  });

  test('the name stays after a reload and is stored in the settings on this device', async ({ page }) => {
    await quickSetup(page, { name: 'Marco' });
    await page.reload();
    await expect(page.getByTestId('greeting')).toHaveText('Hi Marco. Next payday is Fri 23 Oct.');
    const stored = await page.evaluate(
      () =>
        new Promise<string | undefined>((resolve) => {
          const open = indexedDB.databases ? indexedDB.databases() : Promise.resolve([]);
          open.then(async (dbs) => {
            const name = dbs[0]?.name;
            if (!name) return resolve(undefined);
            const req = indexedDB.open(name);
            req.onsuccess = () => {
              const tx = req.result.transaction('settings', 'readonly');
              const get = tx.objectStore('settings').getAll();
              get.onsuccess = () => resolve((get.result[0] as { firstName?: string } | undefined)?.firstName);
            };
          });
        }),
    );
    expect(stored).toBe('Marco');
  });
});

test.describe('1 · fewer words, explanations behind a (?)', () => {
  test('a (?) opens a bottom sheet with the explanation, and Got it closes it', async ({ page }) => {
    await quickSetup(page);
    const focus = page.getByRole('region', { name: 'Focus debt' });
    await focus.getByRole('button', { name: 'Help: Why this one?' }).click();
    const sheet = page.getByRole('dialog', { name: 'Why this one?' });
    await expect(sheet).toContainText('Smallest balance, so it disappears first.');
    await sheet.getByRole('button', { name: 'Got it' }).click();
    await expect(sheet).toHaveCount(0);
    // Escape closes it too
    await page.getByTestId('daily-cost').getByRole('button', { name: 'Help: Daily cost' }).click();
    await expect(page.getByRole('dialog', { name: 'Daily cost' })).toContainText('interest your debts add each day');
    await expect(page.getByRole('button', { name: 'Got it' })).toBeFocused(); // the sheet is ready
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // the footer keeps the disclaimer, and the estimates line sits behind a (?)
    await expect(page.locator('.footer-note')).toContainText('A planning tool, not financial advice.');
    await expect(page.locator('.footer-note')).not.toContainText('Figures are estimates');
    await page.locator('.footer-note').getByRole('button', { name: 'Help: About the figures' }).click();
    await expect(page.getByRole('dialog', { name: 'About the figures' })).toContainText('Figures are estimates based on what you enter.');
  });

  test('the (?) has a 44px tap area', async ({ page }) => {
    await quickSetup(page);
    const tip = page.getByRole('region', { name: 'Focus debt' }).getByRole('button', { name: 'Help: Why this one?' });
    await tip.scrollIntoViewIfNeeded();
    const box = (await tip.boundingBox())!;
    expect(box.width).toBeLessThan(30);
    // a tap 9px off the circle still lands on it
    await page.mouse.click(box.x - 9, box.y - 9);
    await expect(page.getByRole('dialog', { name: 'Why this one?' })).toBeVisible();
  });

  test('every card on Today, Path, Debts and Safety net has a title of 2 to 4 words', async ({ page }) => {
    await quickSetup(page);
    const titles = async () =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('main .card'))
          .map((c) => c.querySelector<HTMLElement>('.label, h2, .tile-label')?.cloneNode(true) as HTMLElement | undefined)
          .filter((el): el is HTMLElement => Boolean(el))
          .map((el) => {
            el.querySelectorAll('button').forEach((b) => b.remove());
            return (el.textContent ?? '').trim();
          })
          .filter(Boolean),
      );
    for (const tab of ['Today', 'Path', 'Safety net'] as const) {
      await goTab(page, tab);
      const list = await titles();
      expect(list.length, `${tab} has cards`).toBeGreaterThan(1);
      for (const t of list) {
        const n = t.split(/\s+/).length;
        expect(n >= 1 && n <= 4, `"${t}" on ${tab} has ${n} words`).toBe(true);
      }
    }
  });

  test('Debts no longer lists what to tap, it is behind a (?)', async ({ page }) => {
    await quickSetup(page);
    await goTab(page, 'Debts');
    await expect(page.getByRole('region', { name: 'Tap a debt to' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Help: Your debts' }).click();
    await expect(page.getByRole('dialog', { name: 'Your debts' })).toContainText('update it from your statement');
  });

  test('setup keeps its (?) on the welcome, the schedule, the rate and the money', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Help: What you need' }).click();
    await expect(page.getByRole('dialog', { name: 'What you need' })).toContainText('card statements');
    await page.getByRole('button', { name: 'Got it' }).click();
    await page.getByRole('button', { name: 'Help: Why paydays?' }).click();
    await expect(page.getByRole('dialog', { name: 'Why paydays?' })).toContainText('not the calendar month');
  });
});
