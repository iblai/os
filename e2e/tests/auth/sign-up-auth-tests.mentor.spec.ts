import { logger } from '@iblai/iblai-js/playwright';
import { test, expect, retry, safeWaitForURL } from '@iblai/iblai-js/playwright';
import { AUTH_HOST, MENTOR_HOST } from '../utils';
import { authRequiresMagicLink } from './helper';

test.describe.serial('Mentor platform Sign up flow', () => {
  const timeStamp = new Date().getTime();

  const email = `test+${timeStamp}@mailnesia.com`;
  const username = `test${timeStamp}`;
  const password = 'test-password';
  const mailnesiaEmailUrl = `https://mailnesia.com/mailbox/${
    email.split('@')[0]
  }`;

  test('user can sign up to mentor platform', async ({ page, context }) => {
    test.setTimeout(60000); // 60 seconds

    logger.info('Navigate to the mentor', MENTOR_HOST);
    await page.goto(MENTOR_HOST);

    logger.info('Wait to be redirected to the auth page');
    await safeWaitForURL(page, (url) =>
      url.href.includes(`/login?app=mentor&redirect-to=${MENTOR_HOST}`)
    );

    if (!(await authRequiresMagicLink(page))) {
      logger.info('Click the sign up link');
      await page.getByRole('link', { name: 'Sign Up' }).click();

      logger.info('Wait for the sign up page to load');
      await page.waitForLoadState('networkidle');
      await page.getByRole('link', { name: 'Log in' }).waitFor();
      await safeWaitForURL(page, (url) =>
        url.href.includes(`/signup?redirect-to=${MENTOR_HOST}`)
      );

      logger.info('Fill the email address field');
      await page.getByPlaceholder('Email address').click();
      await page.getByPlaceholder('Email address').fill(email);

      await page.getByPlaceholder('Email address').press('Tab');

      logger.info('Fill the username field');
      await page.getByPlaceholder('Username').fill(username);

      logger.info('Click the Continue button');
      await page
        .locator('div')
        .filter({ hasText: /^Continue$/ })
        .first()
        .click();

      logger.info('Fill in the password');
      await page.getByPlaceholder('Password', { exact: true }).click();
      await page.getByPlaceholder('Password', { exact: true }).fill(password);

      logger.info('Fill in the confirm password');
      await page.getByPlaceholder('Confirm password').click();
      await page.getByPlaceholder('Confirm password').fill(password);

      logger.info('Click the Continue button');
      await page
        .locator('div')
        .filter({ hasText: /^Continue$/ })
        .first()
        .click();
    } else {
      logger.info('Signing in with Magic Link');

      logger.info('Wait for the sign up page to load');
      await page.waitForLoadState('networkidle');
      await safeWaitForURL(page, (url) =>
        url.href.includes(`&redirect-to=${MENTOR_HOST}`)
      );

      logger.info('Fill the email address field');
      await page.getByPlaceholder('Email').click();
      await page.getByPlaceholder('Email').fill(email);

      logger.info('Click the Continue button');
      await page.getByLabel('Continue').click();

      await page.getByText(/Enter it below/i).waitFor({ timeout: 5000 });

      logger.info('Check for the magic link email');

      // Retry logic for first reset password email
      let maxRetries = 12; // 60 seconds total (12 * 5 seconds)
      let retryCount = 0;
      let resetEmailFound = false;

      const emailPage = await context.newPage();

      while (retryCount < maxRetries && !resetEmailFound) {
        await emailPage.goto(mailnesiaEmailUrl);
        try {
          await expect(
            emailPage.getByRole('link', {
              name: 'Verify your email to sign up',
            })
          ).toBeVisible({ timeout: 2000 });
          resetEmailFound = true;
        } catch (error) {
          retryCount++;
          if (retryCount === maxRetries) {
            throw new Error('Magic link email not found after 60 seconds');
          }
          await emailPage.waitForTimeout(5000); // Wait 5 seconds before checking again
        }
      }

      await emailPage
        .getByRole('link', { name: 'Verify your email to sign up' })
        .click();

      await emailPage
        .getByText('To complete the sign up')
        .waitFor({ timeout: 5000 });

      const signUpCode = await emailPage.getByText(/^\d{6}$/).textContent();
      if (!signUpCode) {
        throw new Error('Sign up code not found in email');
      }

      await page.bringToFront();

      await page.getByText(/Enter it below/i).waitFor({ timeout: 5000 });

      await page.keyboard.press(signUpCode[0]);
      await page.keyboard.press(signUpCode[1]);
      await page.keyboard.press(signUpCode[2]);
      await page.keyboard.press(signUpCode[3]);
      await page.keyboard.press(signUpCode[4]);
      await page.keyboard.press(signUpCode[5]);
    }

    logger.info('Wait for the account created page to load');
    await safeWaitForURL(page, (url) => url.href.startsWith(MENTOR_HOST), {
      timeout: 60000,
    });

    await page.waitForLoadState('domcontentloaded');

    logger.info('Check if the Upgrade button is visible');
    await expect(page.getByRole('link', { name: 'Upgrade' })).toBeVisible();

    retry(
      async () => {
        await page
          .locator('main')
          .filter({ hasText: 'mentorAItrialAccountLog Out' })
          .getByRole('img')
          .nth(2)
          .click();
        await page.getByRole('link', { name: 'Log Out' }).click();
      },
      'Failed to log out',
      5
    );

    await safeWaitForURL(
      page,
      (url) =>
        url.href.includes(`/login?app=mentor&redirect-to=${MENTOR_HOST}`),
      {
        timeout: 60000,
      }
    );

    await page.waitForLoadState('networkidle', { timeout: 60000 });

    await expect(
      page.getByRole('heading', { name: 'Welcome Back' })
    ).toBeVisible();

    await expect(page.getByRole('heading')).toContainText('Welcome Back');
  });

  test('user can reset password', async ({ page }) => {
    test.setTimeout(120000); // 120 seconds

    const newPassword = 'new_test_password';

    await page.goto(`${AUTH_HOST}/login?app=mentor&redirect-to=${MENTOR_HOST}`);
    await page.waitForLoadState('networkidle');

    if (await authRequiresMagicLink(page)) {
      logger.info('Magic link required, skipping password reset test');
      return;
    }

    await page.getByPlaceholder('Email or Username').click();
    await page.getByPlaceholder('Email or Username').fill(email);
    await page.getByLabel('Continue').click();

    await expect(
      page.getByRole('link', { name: 'Forgot password?' })
    ).toBeVisible();
    await page.getByRole('link', { name: 'Forgot password?' }).click();

    await safeWaitForURL(page, (url) =>
      url.href.includes(`/forgot-password?redirect-to=${MENTOR_HOST}`)
    );
    await page.waitForLoadState('networkidle');

    await page.getByPlaceholder('Email address').click();
    await page.getByPlaceholder('Email address').fill(email);
    await expect(
      page.getByRole('heading', { name: 'Forgot your password' })
    ).toBeVisible();

    // Retry logic for Continue button
    let maxRetries = 3;
    let retryCount = 0;
    let resetMessageVisible = false;

    while (retryCount < maxRetries && !resetMessageVisible) {
      try {
        await page.getByText('Continue').click();
        await expect(page.getByRole('paragraph')).toContainText(
          'Reset Password Initiated. Kindly check your email address and follow instructions.',
          { timeout: 5000 }
        );
        resetMessageVisible = true;
      } catch (error) {
        retryCount++;
        if (retryCount === maxRetries) {
          throw new Error(
            `Failed to see reset password message after ${maxRetries} attempts`
          );
        }
        await page.waitForTimeout(1000);
      }
    }

    // Retry logic for first reset password email
    maxRetries = 12; // 60 seconds total (12 * 5 seconds)
    retryCount = 0;
    let resetEmailFound = false;

    while (retryCount < maxRetries && !resetEmailFound) {
      await page.goto(mailnesiaEmailUrl);
      try {
        await expect(
          page.getByRole('link', { name: 'Password reset on ibl' })
        ).toBeVisible({ timeout: 2000 });
        resetEmailFound = true;
      } catch (error) {
        retryCount++;
        if (retryCount === maxRetries) {
          throw new Error('Reset password email not found after 60 seconds');
        }
        await page.waitForTimeout(5000); // Wait 5 seconds before checking again
      }
    }

    await page.getByRole('link', { name: 'Password reset on ibl' }).click();

    await expect(
      page.getByRole('heading', { name: 'Password reset' })
    ).toBeVisible();
    await page.getByRole('link', { name: 'Reset my password' }).click();

    await safeWaitForURL(page, (url) =>
      url.href.includes('/password_reset_confirm/')
    );
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Reset Your Password')).toBeVisible();

    await page.getByLabel('New Password').fill(newPassword);
    await page.getByLabel('New Password').press('Tab');
    await page.getByLabel('Confirm Password').fill(newPassword);

    await page.getByRole('button', { name: 'Reset My Password' }).click();

    await expect(
      page.getByRole('heading', { name: 'Password Reset Complete' })
    ).toBeVisible();

    // Retry logic for confirmation email
    retryCount = 0;
    let confirmationEmailFound = false;

    while (retryCount < maxRetries && !confirmationEmailFound) {
      await page.goto(mailnesiaEmailUrl);
      try {
        await expect(
          page.getByRole('link', { name: 'Password reset completed on' })
        ).toBeVisible({ timeout: 2000 });
        confirmationEmailFound = true;
      } catch (error) {
        retryCount++;
        if (retryCount === maxRetries) {
          throw new Error('Confirmation email not found after 60 seconds');
        }
        await page.waitForTimeout(5000); // Wait 5 seconds before checking again
      }
    }

    await page
      .getByRole('link', { name: 'Password reset completed on' })
      .click();

    await expect(
      page.getByRole('heading', { name: 'Password reset success' })
    ).toBeVisible();

    // Verify login with new password - Added retry logic
    await page.goto(MENTOR_HOST);
    await safeWaitForURL(page, (url) =>
      url.href.includes(`/login?app=mentor&redirect-to=${MENTOR_HOST}`)
    );

    page.on('request', (request) => {
      logger.info(`>> Request: ${request.method()}, ${request.url()}`);
    });
    page.on('response', (response) => {
      logger.info(`<< Response: ${response.status()}, ${response.url()}`);
    });

    await page.goto(MENTOR_HOST);

    await safeWaitForURL(page, (url) =>
      url.href.includes(`/login?app=mentor&redirect-to=${MENTOR_HOST}`)
    );

    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 60000 });
      await page.waitForLoadState('networkidle', { timeout: 60000 });
    } catch (error) {
      logger.error(`############# Networkidle timeout for auth page`);
    }

    logger.info('Checking for email input field');
    const emailInput = page.locator('input[placeholder="Email or Username"]');
    await emailInput.waitFor({ state: 'visible' });

    logger.info('Input username or email');
    await emailInput.fill(username);
    logger.info('Email input field ', await emailInput.innerHTML());

    const continueButton = page.locator('.auth-submit-btn');
    await continueButton.waitFor({ state: 'visible' });
    await continueButton.click();

    logger.info('Checking for password input field');
    const passwordInput = page.locator('input[placeholder="Password"]');
    page.waitForTimeout(5000);
    await passwordInput.waitFor({ state: 'visible' });

    logger.info('Password input visible');
    logger.info('Input password');
    await passwordInput.fill(newPassword);

    logger.info('Password input field ', await passwordInput.innerHTML());

    await page.waitForTimeout(5000);

    logger.info('Clicking continue button to login');

    await continueButton.click();

    // Wait for successful redirect
    await safeWaitForURL(page, (url) => url.href.startsWith(MENTOR_HOST), {
      timeout: 20000,
    });

    // Verify successful login
    await expect(page.getByRole('link', { name: 'Upgrade' })).toBeVisible({
      timeout: 10000,
    });
  });
});
