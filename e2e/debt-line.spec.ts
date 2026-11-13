/** The small line on a debt card: the rate with its word, then the bill. The ring is the one place for "% gone". */
import { expect, test } from '@playwright/test';
import { nadiaSetup } from './nadia';
import { expectBrandRules, goTab } from './scenario';

test('each debt card says "rate" after the rate, and does not repeat "% gone"', async ({ page }) => {
  await nadiaSetup(page);
  await goTab(page, 'Debts');
  const lines = page.getByTestId('debt-line');
  await expect(lines).toHaveText(['26.99% rate · $30 bill on the 12th', '0% rate · $50 bill on the 3rd', '22.99% rate · $66 bill on the 20th']);
  for (const name of ['Store Card', 'Medical', 'Visa']) {
    const card = page.getByRole('region', { name });
    await expect(card).not.toContainText('% gone');
    await expect(card.getByRole('progressbar', { name: /paid off/ })).toBeVisible(); // the ring keeps the share
  }
  await expectBrandRules(page);
});
