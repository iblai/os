import { test, expect } from '../fixtures/mentor-test';
import { authenticate } from '../utils/auth';
import { MENTOR_NEXTJS_HOST, AUTH_HOST } from '../fixtures/test-data';

test.describe('Journey 1: Authentication', () => {
  test('unauthenticated user goes to mentor platform and signs up with email and password', async ({
    page,
  }) => {
    test.skip(!MENTOR_NEXTJS_HOST || !AUTH_HOST, 'Requires MENTOR_NEXTJS_HOST and AUTH_HOST');
    await authenticate(page, MENTOR_NEXTJS_HOST);
    await expect(page).toHaveURL(new RegExp(`${MENTOR_NEXTJS_HOST}/platform/`));
  });

  test('newly signed-up user goes to mentor platform and is redirected to the platform', async ({
    page,
  }) => {
    test.skip(!MENTOR_NEXTJS_HOST, 'Requires MENTOR_NEXTJS_HOST');
    await page.goto(MENTOR_NEXTJS_HOST, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`${MENTOR_NEXTJS_HOST}/platform/`), {
      timeout: 60_000,
    });
  });

  test('unauthenticated user goes to login page and sees an error with invalid credentials', async ({
    page,
  }) => {
    test.skip(!AUTH_HOST, 'Requires AUTH_HOST');
    await page.goto(`${AUTH_HOST}/login`, { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('button', { name: 'Continue with Password' }),
    ).toBeVisible({ timeout: 30_000 });
    await page.click('button:has-text("Continue with Password")');
    await page.fill('input[type="email"]', 'invalid@doesnotexist.example.com');
    await page.fill('input[type="password"]', 'WrongPassword123!');
    await page.click('button:has-text("Continue")');
    const error = page.getByText(/invalid.*email.*password|incorrect.*credentials/i);
    await expect(error).toBeVisible({ timeout: 15_000 });
  });

  test('unauthenticated user goes to login page and resets password via magic link', async ({
    page,
  }) => {
    test.skip(
      !AUTH_HOST || !process.env.MAILSAC_API_KEY,
      'Requires AUTH_HOST and MAILSAC_API_KEY',
    );
    await page.goto(`${AUTH_HOST}/password/reset`, {
      waitUntil: 'domcontentloaded',
    });
    const emailInput = page.getByPlaceholder('Email');
    await expect(emailInput).toBeVisible({ timeout: 15_000 });
    await emailInput.fill(process.env.PLAYWRIGHT_USERNAME || '');
    await page.click('button:has-text("Continue")');
    await expect(page.getByText(/check your email/i)).toBeVisible({
      timeout: 15_000,
    });
  });
});
