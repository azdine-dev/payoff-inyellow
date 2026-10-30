/**
 * The Nadia scenario: every 2 weeks, next payday Fri 6 Nov 2026, $150 per payday, buffer 200 of 500,
 * Gifts $260 in December. Store Card 450 / 26.99% / 30 / day 12, Medical 600 / 0% / 50 / day 3, Visa 2,200 / 22.99% / 66 / day 20.
 */
import { expect, test } from '@playwright/test';
import { goTab, expectBrandRules } from './scenario';
import { nadiaSetup } from './nadia';

test.describe('Part A · Today, the Nadia scenario', () => {
  test('1 · the buffer set aside in setup is saved: Safety net and the focus card agree', async ({ page }) => {
    await nadiaSetup(page);
    await expect(page.getByRole('region', { name: 'Focus debt' })).toContainText('Store Card');
    await expect(page.getByRole('region', { name: 'Focus debt' })).toContainText('gone by Fri 1 Jan 2027');
    await goTab(page, 'Safety net');
    await expect(page.getByTestId('buffer-amount')).toHaveText('$200');
    await expect(page.getByRole('region', { name: 'Surprise buffer' })).toContainText('of $500');
  });

  test('2 · the main button is "I did it · $180": Store Card $30 + Yearly $10 + Buffer $140', async ({ page }) => {
    await nadiaSetup(page);
    await expect(page.getByRole('button', { name: 'I did it · $180' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Record this payday' })).toHaveCount(0);
    await expect(page.getByTestId('payday-total')).toHaveText('$180');
    await expect(page.getByRole('checkbox', { name: /Store Card/ })).toContainText('$30');
    await expect(page.getByRole('checkbox', { name: /Yearly bills/ })).toContainText('$10');
    await expect(page.getByRole('checkbox', { name: /Buffer/ })).toContainText('$140');
  });

  test('3 · the sentence under the rows is gone', async ({ page }) => {
    await nadiaSetup(page);
    await expect(page.getByTestId('payday-total')).toBeVisible();
    await expect(page.locator('main')).not.toContainText('Tick the payments as you make them');
  });

  test('4 · the focus card keeps one door for extra money, with the new date and interest saved', async ({ page }) => {
    await nadiaSetup(page);
    const focus = page.getByRole('region', { name: 'Focus debt' });
    await expect(focus.getByRole('button', { name: '+ Extra payment' })).toHaveCount(0);
    await expect(focus.getByRole('button', { name: 'I got extra money' })).toHaveCount(1);
    await focus.getByRole('button', { name: 'I got extra money' }).click();
    await page.getByRole('textbox', { name: 'Extra money' }).fill('100');
    await expect(page.getByTestId('windfall-preview')).toContainText('Debt-free');
    await expect(page.getByTestId('windfall-preview')).toContainText('less interest');
    await expect(page.getByRole('button', { name: 'Use it', exact: true })).toBeVisible();
  });

  test('5 · a bill due before the first payday says it comes from your current pay', async ({ page }) => {
    await nadiaSetup(page);
    const coming = page.getByTestId('coming-up');
    const medical = coming.locator('[data-state]', { hasText: 'Medical' });
    await expect(medical).toContainText('Tue 3 Nov');
    await expect(medical.locator('.tag', { hasText: 'From your current pay' })).toBeVisible();
    // Store Card, due after the first payday, is part of the payday and carries no such label
    const store = coming.locator('[data-state]', { hasText: 'Store Card' });
    await expect(store).toContainText('Thu 12 Nov');
    await expect(store.locator('.tag', { hasText: 'From your current pay' })).toHaveCount(0);
    await expectBrandRules(page);
  });
});
