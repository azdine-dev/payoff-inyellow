#!/usr/bin/env node
// Measures first-time setup in our own app on a phone-sized screen: taps, fields, characters typed, and
// the time a person would need (a simple model). Saves a screenshot of every screen.
//
//   node scripts/audit-setup.mjs <screenshot folder> [url]
//
// Needs the app running (npm run dev, default http://localhost:5173) and the test key for the unlock step,
// so start it with:  VITE_PUBLIC_KEY_HEX=<test public key> npx vite --port 5190   (see e2e/testKey.ts)
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { devices, chromium } from '@playwright/test';

const out = process.argv[2] ?? 'audit-shots';
const url = process.argv[3] ?? 'http://localhost:5190';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
// A clock that starts on this date and keeps running (so timers, like a message that goes away, still work)
if (!process.env.PIY_REAL_CLOCK) {
  await page.clock.install({ time: new Date('2026-10-15T10:00:00') });
  await page.clock.resume();
}

// Count what a person does: taps on buttons/options/links, and each field they fill.
await page.addInitScript(() => {
  const w = window;
  w.__m = { taps: 0, fields: new Set(), chars: 0 };
  document.addEventListener('click', (e) => {
    const el = e.target.closest('button, a, label, [role=radio], [role=checkbox], select, summary');
    if (el && !(el.tagName === 'LABEL' && el.querySelector('input:not([type=radio]):not([type=checkbox])'))) w.__m.taps++;
  }, true);
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
      w.__m.fields.add(el);
          }
  }, true);
});

const snap = async (name) => page.screenshot({ path: join(out, `${name}.png`), fullPage: false });
const metrics = () =>
  page.evaluate(() => ({
    taps: window.__m.taps,
    fields: window.__m.fields.size,
    chars: [...window.__m.fields].reduce((n, el) => n + String(el.value ?? '').length, 0),
  }));
const marks = {};
const mark = async (name) => (marks[name] = await metrics());

await page.goto(process.env.PIY_CODE ? `${url}/#unlock=${process.env.PIY_CODE}` : url);
await page.waitForSelector('button');
await snap('01-welcome');

const next = page.getByRole('button', { name: /^(Continue|Skip for now|See my plan|Let’s start)$/ });
await next.click();
await snap('02-currency');
await page.getByLabel('Currency').selectOption('USD');
await next.click();
await snap('03-schedule');
await page.getByRole('radio', { name: 'Every 2 weeks' }).click();
await page.getByLabel('Your next payday').fill('2026-10-23');
await next.click();

const debts = [
  { name: 'Visa', balance: '3200', apr: '22.9', min: '96', due: '12' },
  { name: 'Store card', balance: '640', apr: '26.99', min: '35', due: '5' },
  { name: 'Car loan', balance: '9800', apr: '7.5', min: '285', due: '20' },
];
for (const [i, d] of debts.entries()) {
  if (i > 0) await page.getByRole('button', { name: 'Add another' }).click();
  const card = page.locator('fieldset').nth(i);
  await card.getByLabel('Name').fill(d.name);
  await card.getByLabel('Balance').fill(d.balance);
  await card.getByLabel('Interest rate').fill(d.apr);
  await card.getByLabel('Monthly minimum').fill(d.min);
  await card.getByLabel('Due day (recommended)').fill(d.due);
}
await snap('04-debts');
await next.click();
await snap('05-buffer');
await page.getByLabel('Buffer now').fill('200');
await next.click();
await snap('06-money-for-plan');
await page.getByLabel('Money for the plan each payday').fill('150');
await next.click();
await snap('07-yearly-bills');
await next.click(); // skip
await snap('08-order');
await next.click();
await snap('09-fresh-start');
await next.click();
await page.getByTestId('debt-free-date').waitFor();
await snap('10-result');
await mark('result'); // "what do I do now" is the first step on this screen

await page.getByRole('button', { name: /Start my plan/ }).click().catch(() => undefined);
await page.getByTestId('debt-free-pill').waitFor({ timeout: 5000 }).catch(() => undefined);
await page.waitForTimeout(Number(process.env.PIY_PAUSE ?? 0)); // a person takes longer than a script
await snap('11-today');
await mark('today');

for (const tab of ['Plan', 'Debts', 'Progress', 'Money']) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: tab, exact: true }).click();
  await page.waitForTimeout(300);
  await snap(`12-${tab.toLowerCase()}`);
}
await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Today', exact: true }).click();
await page.getByTestId('notice').getByRole('button', { name: 'OK' }).click({ timeout: 1500 }).catch(() => undefined);
await page.getByRole('button', { name: 'Settings' }).click();
await page.waitForTimeout(300);
await snap('13-settings');

// Time a person would need: 1.5 s per tap, 4 s to reach and focus a field, 0.35 s per character, 3 s reading each screen.
const seconds = (m, screens) => Math.round(m.taps * 1.5 + m.fields * 4 + m.chars * 0.35 + screens * 3);
const result = {
  toResult: { ...marks.result, screens: 10, minutes: +(seconds(marks.result, 10) / 60).toFixed(1) },
  toToday: { ...marks.today, screens: 11, minutes: +(seconds(marks.today, 11) / 60).toFixed(1) },
};
console.log(JSON.stringify(result, null, 2));
await browser.close();
