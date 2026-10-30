/** The Nadia scenario, for the tests: every 2 weeks from Fri 6 Nov 2026, $150, buffer 200 of 500, Gifts $260 in December. */
import type { Page } from '@playwright/test';
import { runWizard, startPlan, type WizardConfig } from './scenario';

export const NADIA: WizardConfig = {
  frequency: 'Every 2 weeks',
  nextPayday: '2026-11-06',
  debts: [
    { name: 'Store Card', balance: '450', apr: '26.99', min: '30', due: '12' },
    { name: 'Medical', balance: '600', apr: '0', min: '50', due: '3' },
    { name: 'Visa', balance: '2200', apr: '22.99', min: '66', due: '20' },
  ],
  bufferNow: '200',
  extra: '150',
  yearly: [{ idea: 'Gifts and holidays', amount: '260', month: 'December' }],
};

/** Sets the phone clock to Fri 30 Oct 2026 (so Medical, due Tue 3 Nov, is inside "Coming up"), then runs the setup. */
export async function nadiaSetup(page: Page) {
  await page.clock.setFixedTime(new Date('2026-10-30T10:00:00'));
  await runWizard(page, NADIA);
  await startPlan(page);
}

