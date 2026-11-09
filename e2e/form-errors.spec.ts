/** Setup form errors: under their own field, a thick action-colored border and an icon, aria attributes, the cursor on the first one. */
import { expect, test } from '@playwright/test';
import { expectBrandRules } from './scenario';

const next = (page: import('@playwright/test').Page) => page.getByRole('button', { name: /^(Continue|That’s all of them|See my plan)$/ });

test.describe('each error under its own field', () => {
  test('step 1: two things to fix, each under its field, the cursor on the first, and the count goes down as they are fixed', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-30T10:00:00'));
    await page.goto('/');
    await next(page).click();
    const errors = page.getByTestId('field-error');
    await expect(errors).toHaveCount(2);
    await expect(page.locator('[data-field="frequency"]').getByTestId('field-error')).toContainText('Choose how often you get paid.');
    await expect(page.locator('[data-field="nextPayday"]').getByTestId('field-error')).toContainText('Pick the date of your next payday.');
    await expect(page.getByTestId('fix-count')).toHaveText('2 things to fix above');
    // the date field: aria attributes and a thick action-colored border (never red)
    const date = page.getByLabel('Your next payday');
    await expect(date).toHaveAttribute('aria-invalid', 'true');
    await expect(date).toHaveAttribute('aria-describedby', 'err-nextPayday');
    await expect(page.locator('#err-nextPayday')).toContainText('Pick the date of your next payday.');
    const border = await date.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { width: cs.borderTopWidth, color: cs.borderTopColor };
    });
    expect(border.width).toBe('3px');
    expect(border.color).toBe('rgb(47, 74, 109)'); // the action color #2F4A6D
    await expect(page.locator('[data-field="nextPayday"] .field-error-icon')).toBeVisible();
    // the cursor is on the first one: the pay schedule
    await expect(page.getByRole('radio', { name: 'Every week', exact: true })).toBeFocused();
    await expectBrandRules(page);
    // fixing one updates the count at once, with no new Continue
    await page.getByRole('radio', { name: 'Every 2 weeks', exact: true }).click();
    await expect(page.getByTestId('field-error')).toHaveCount(1);
    await expect(page.getByTestId('fix-count')).toHaveText('1 thing to fix above');
    await expect(page.locator('[data-field="frequency"] [role="radiogroup"]')).not.toHaveAttribute('aria-invalid', 'true');
    await page.getByLabel('Your next payday').fill('2026-10-30');
    await expect(page.getByTestId('field-error')).toHaveCount(0);
    await expect(page.getByTestId('fix-count')).toHaveCount(0);
    await expect(date).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('step 2: the balance and the due day, each under its own field, and the cursor goes to the balance', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-30T10:00:00'));
    await page.goto('/');
    await page.getByRole('radio', { name: 'Every 2 weeks' }).click();
    await page.getByLabel('Your next payday').fill('2026-11-06');
    await next(page).click();
    const card = page.locator('fieldset');
    await card.getByLabel('Name').fill('Visa');
    await card.getByLabel('Monthly minimum').fill('96');
    await next(page).click();
    await expect(page.getByTestId('field-error')).toHaveCount(2);
    await expect(page.locator('[data-field$="-balance"]').getByTestId('field-error')).toHaveText('Add the balance you owe.');
    await expect(page.locator('[data-field$="-due"]').getByTestId('field-error')).toContainText('Add the due day.');
    await expect(page.getByTestId('fix-count')).toHaveText('2 things to fix above');
    await expect(card.getByLabel('Balance')).toBeFocused();
    await expect(card.getByLabel('Balance')).toHaveAttribute('aria-invalid', 'true');
    await expect(card.getByLabel('Due day')).toHaveAttribute('aria-invalid', 'true');
    // the name of the debt is not repeated under the field: it is the field that is named
    await expect(page.getByTestId('field-error').first()).not.toContainText('Visa');
    await card.getByLabel('Balance').fill('3200');
    await expect(page.getByTestId('field-error')).toHaveCount(1);
    await card.getByLabel('Due day').fill('12');
    await expect(page.getByTestId('fix-count')).toHaveCount(0);
    await next(page).click();
    await expect(page.getByRole('heading', { name: 'Money for the plan' })).toBeVisible();
  });

  test('step 3: the amount for the plan is under its own field and has the cursor', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-30T10:00:00'));
    await page.goto('/');
    await page.getByRole('radio', { name: 'Every 2 weeks' }).click();
    await page.getByLabel('Your next payday').fill('2026-11-06');
    await next(page).click();
    const card = page.locator('fieldset');
    await card.getByLabel('Name').fill('Visa');
    await card.getByLabel('Balance').fill('3200');
    await card.getByLabel('Monthly minimum').fill('96');
    await card.getByLabel('Due day').fill('12');
    await next(page).click();
    await next(page).click(); // the money for the plan is empty
    await expect(page.locator('[data-field="extra"]').getByTestId('field-error')).toContainText('Type an amount, even 0.');
    await expect(page.getByLabel('Money for the plan each payday')).toBeFocused();
    await expect(page.getByLabel('Money for the plan each payday')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByTestId('fix-count')).toHaveText('1 thing to fix above');
  });

  test('an own currency symbol left empty is a message under the symbol field', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Currency').selectOption({ label: 'Other: type my own symbol' });
    await page.getByRole('radio', { name: 'Every 2 weeks' }).click();
    await next(page).click();
    await expect(page.locator('[data-field="currency"]').getByTestId('field-error')).toContainText('Type the symbol you use for money');
    await expect(page.getByLabel('Your symbol')).toBeFocused();
  });
});

test.describe('the currency, from the device', () => {
  test('a visible select with no Change link, USD with no hint from the device', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel('Currency')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change' })).toHaveCount(0);
  });

  test.describe('region Morocco', () => {
    test.use({ locale: 'fr-MA' });
    test('French in Morocco gives MAD', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByLabel('Currency')).toHaveValue('MAD');
    });
  });

  test.describe('region United Kingdom', () => {
    test.use({ locale: 'en-GB' });
    test('English in the UK gives GBP', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByLabel('Currency')).toHaveValue('GBP');
    });
  });

  test.describe('a region with no listed currency', () => {
    test.use({ locale: 'en-ZZ' });
    test('falls back to USD', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByLabel('Currency')).toHaveValue('USD');
    });
  });
});
