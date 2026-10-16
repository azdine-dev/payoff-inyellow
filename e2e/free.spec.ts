/** The free calculator build (vite --mode free): search title, email box, and only the email is sent. */
import { expect, test } from '@playwright/test';
import { FIXED, quickSetup } from './helpers';

test.use({ baseURL: 'http://localhost:5176' });

const ENDPOINT = 'https://leads.example.test/capture';

test('free edition: calculator, email box that sends only the email', async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
  const posts: { body: string; type: string }[] = [];
  await page.route(ENDPOINT, async (route) => {
    const req = route.request();
    posts.push({ body: req.postData() ?? '', type: req.headers()['content-type'] ?? '' });
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}', headers: { 'access-control-allow-origin': '*' } });
  });

  await page.goto('/');
  await expect(page).toHaveTitle('Credit Card Payoff Calculator · PaidInYellow');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Free credit card payoff calculator/);

  await quickSetup(page, { unlock: false });
  await expect(page.getByTestId('debt-free-date')).toBeVisible();

  // A bad address gets a calm note, nothing is sent
  const form = page.getByRole('form', { name: 'Email' });
  await form.getByLabel('Your email').fill('not an email');
  await form.getByRole('button', { name: 'Send me the emails' }).click();
  await expect(page.getByText('Type your email address, like name@example.com.')).toBeVisible();
  expect(posts).toHaveLength(0);

  await form.getByLabel('Your email').fill('ana@example.com');
  await form.getByRole('button', { name: 'Send me the emails' }).click();
  await expect(page.getByTestId('email-thanks')).toBeVisible();

  // Exactly one request, with the email and nothing about money
  expect(posts).toHaveLength(1);
  expect(JSON.parse(posts[0]!.body)).toEqual({ email: 'ana@example.com', source: 'free-calculator' });
  expect(posts[0]!.body).not.toMatch(/3200|640|22\.9|Visa|Store card|balance/i);
});

test('free edition: a failed send says so calmly and can be retried', async ({ page }) => {
  await page.clock.setFixedTime(FIXED);
  await page.route(ENDPOINT, (route) => route.abort());
  await quickSetup(page, { unlock: false });
  const form = page.getByRole('form', { name: 'Email' });
  await form.getByLabel('Your email').fill('ana@example.com');
  await form.getByRole('button', { name: 'Send me the emails' }).click();
  await expect(page.getByText('That didn’t go through. Check your connection and try again.')).toBeVisible();
  await expect(page.getByTestId('email-thanks')).toHaveCount(0);
});
