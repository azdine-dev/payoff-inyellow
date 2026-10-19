/**
 * Helpers for docs/app-test-scenario-darija.docx ("Sara's story"), run as a Playwright script.
 * The numbers in the document come from the reference engine, so the app must show them
 * (a difference of 0.01 is rounding and is allowed, as the document says).
 */
import { expect, type Page } from '@playwright/test';
import { unlockOnResult } from './helpers';

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Matches an amount as the app prints it ("$365.08", or "$170" when it has no cents), allowing
 * the 0.01 of rounding the scenario document allows.
 */
export function near(amount: number): RegExp {
  const alternatives = [-0.01, 0, 0.01].map((d) => {
    const x = Math.round((amount + d) * 100) / 100;
    const text = fmt(x).replace('.', '\\.');
    return Number.isInteger(x) ? `${fmt(x).replace('.00', '')}(?:\\.00)?` : text;
  });
  return new RegExp(`\\$(?:${alternatives.join('|')})(?!\\d)`);
}

/** Sets the phone's date, then reloads so the app sees it. */
export async function setDay(page: Page, iso: string) {
  await page.clock.setFixedTime(new Date(`${iso}T10:00:00`));
  await page.reload();
}

export async function goTab(page: Page, name: 'Today' | 'Plan' | 'Debts' | 'Progress' | 'Money') {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name, exact: true }).click();
}

/** Taps "I did it" and waits for the payday to turn paid. */
export async function iDidIt(page: Page, paidLabel: string) {
  await goTab(page, 'Today');
  await page.getByRole('button', { name: /^I did it/ }).click();
  await expect(page.getByText(`${paidLabel} is paid.`)).toBeVisible();
}

/** Opens a payday on the Plan tab and returns the dialog, then the caller closes it. */
export async function openPayday(page: Page, label: string) {
  await goTab(page, 'Plan');
  await page.getByRole('button', { name: label, exact: true }).click();
  return page.getByRole('dialog');
}

export async function closeSheet(page: Page) {
  await page.getByRole('button', { name: 'Close' }).click();
}

export interface PaydayExpect {
  /** e.g. "Fri 23 Oct" */
  date: string;
  total: number;
  debtLeft: number;
  buffer?: number;
  extra?: { amount: number; to: string };
  yearly?: number;
  /** The bills that were due before the next payday */
  bills?: { name: string; amount: number; due: string }[];
}

/** Checks a paid payday on the Plan tab, the way the scenario table lists it. */
export async function expectPaidPayday(page: Page, e: PaydayExpect) {
  const sheet = await openPayday(page, `${e.date}, paid`);
  await expect(sheet).toContainText(new RegExp(`Total\\s*${near(e.total).source}`));
  await expect(page.getByTestId('debt-left-after')).toContainText(near(e.debtLeft));
  if (e.buffer !== undefined) {
    if (e.buffer === 0) await expect(sheet).not.toContainText(/Buffer\s*\$/);
    else await expect(sheet).toContainText(new RegExp(`Buffer\\s*${near(e.buffer).source}`));
  }
  if (e.yearly !== undefined) await expect(sheet).toContainText(new RegExp(`Yearly bills\\s*${near(e.yearly).source}`));
  if (e.extra) await expect(sheet).toContainText(new RegExp(`Extra to ${e.extra.to}\\s*${near(e.extra.amount).source}`));
  for (const b of e.bills ?? []) await expect(sheet).toContainText(new RegExp(`${b.name}, due ${b.due}\\s*${near(b.amount).source}`));
  await closeSheet(page);
}

/** The buffer on the Money tab, e.g. "$307.69 of $500". */
export async function expectBuffer(page: Page, amount: number, goal = 500) {
  await goTab(page, 'Money');
  await expect(page.getByRole('region', { name: 'Buffer' })).toContainText(new RegExp(`${near(amount).source} of \\$${goal}`));
}

export interface WizardConfig {
  frequency: 'Every week' | 'Every 2 weeks' | 'Twice a month' | 'Every month';
  /** ISO date of the next payday */
  nextPayday: string;
  /** Twice a month only */
  twiceDays?: '1st and 15th' | '15th and last day';
  debts: { name: string; balance: string; apr: string; min: string; due?: string }[];
  bufferNow: string;
  bufferGoal?: string;
  extra: string;
  yearly?: { idea: string; amount: string; month?: string }[];
  /** "HH:MM" */
  ifThenTime?: string;
}

/** The whole setup wizard, from the welcome screen to the result. */
export async function runWizard(page: Page, c: WizardConfig) {
  await page.goto('/');
  const next = page.getByRole('button', { name: /^(Continue|Skip for now|See my plan|Let’s start)$/ });
  await next.click(); // welcome
  await next.click(); // currency (auto)
  await page.getByRole('radio', { name: c.frequency, exact: true }).click();
  if (c.twiceDays) await page.getByRole('radio', { name: c.twiceDays }).click();
  await page.getByLabel('Your next payday').fill(c.nextPayday);
  await next.click();
  for (const [i, d] of c.debts.entries()) {
    if (i > 0) await page.getByRole('button', { name: 'Add another' }).click();
    const card = page.locator('fieldset').nth(i);
    await card.getByLabel('Name').fill(d.name);
    await card.getByLabel('Balance').fill(d.balance);
    await card.getByLabel('Interest rate').fill(d.apr);
    await card.getByLabel('Monthly minimum').fill(d.min);
    if (d.due) await card.getByLabel('Due day (recommended)').fill(d.due);
  }
  await next.click();
  await page.getByLabel('Buffer now').fill(c.bufferNow);
  if (c.bufferGoal !== undefined) await page.getByLabel('Buffer goal').fill(c.bufferGoal);
  await next.click();
  await page.getByLabel('Money for the plan each payday').fill(c.extra);
  await next.click();
  for (const y of c.yearly ?? []) {
    await page.getByRole('button', { name: `+ ${y.idea}` }).click();
    await page.getByLabel(`${y.idea} per year`).fill(y.amount);
    if (y.month) await page.getByLabel('Needed in').last().selectOption(y.month);
  }
  await next.click(); // yearly bills (or skip)
  await next.click(); // payoff order
  if (c.ifThenTime) await page.getByLabel('I open PaidInYellow at').fill(c.ifThenTime);
  await next.click(); // fresh start
  await expect(page.getByTestId('debt-free-date').or(page.getByRole('heading', { name: /more than 20 years/i }))).toBeVisible();
}

/** Unlocks with the test code and opens the full planner. */
export async function startPlan(page: Page) {
  await unlockOnResult(page);
  await page.getByRole('button', { name: 'Start my plan' }).click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
}

/** Brand rules (document, part 15): no red, yellow is never text, nothing offering loans or transfers. */
export async function expectBrandRules(page: Page) {
  const found = await page.evaluate(() => {
    const isRed = (c: string) => {
      const m = c.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/);
      if (!m) return false;
      const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
      const a = m[4] === undefined ? 1 : Number(m[4]);
      return a > 0.05 && r > 150 && g < r * 0.55 && b < r * 0.55;
    };
    const problems: string[] = [];
    const props = ['color', 'backgroundColor', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor', 'outlineColor', 'fill', 'stroke'] as const;
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const cs = getComputedStyle(el);
      for (const p of props) if (isRed(cs[p])) problems.push(`red ${p} on <${el.tagName.toLowerCase()} class="${(el as HTMLElement).className}">`);
      const hasText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim());
      if (hasText && cs.color === 'rgb(255, 225, 77)') problems.push(`yellow text on <${el.tagName.toLowerCase()}>`);
    }
    if (/balance transfer|0% card|consolidat|payday loan|debt settlement|refinanc/i.test(document.body.innerText)) problems.push('borrowing words on the page');
    return problems;
  });
  expect(found).toEqual([]);
}

/** Text is not cut off sideways on a phone (document, part 15). */
export async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    // The phone's real width. A page that overflows makes the browser widen innerWidth, so don't trust that.
    const w = Math.min(window.screen.width, window.innerWidth);
    const wide = document.documentElement.scrollWidth > w || window.innerWidth > window.screen.width;
    const outside = Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.right > w + 1 || r.left < -1) && getComputedStyle(el).position !== 'fixed';
      })
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`);
    return { wide, outside: outside.slice(0, 5) };
  });
  expect(overflow).toEqual({ wide: false, outside: [] });
}
