import { test, expect } from '@playwright/test';
import { AUTH_HOST, MENTOR_NEXTJS_HOST } from '../utils';
import { logger } from '@iblai/iblai-js/playwright';
import {
  loginWithEmailAndPassword,
  signUpWithEmailAndPassword,
} from '../helpers';
import { safeWaitForURL } from '@iblai/iblai-js/playwright';
import { checkAdminStatus } from '../utils';
import { navigateToMentorApp, waitForMentorAppReady } from '../profile/helpers';

const date = Date.now();
const inviteEmail = `testmentor${date}@gmail.com`;
const inviteUserPassword = 'ibledu_2024';
const password: string = process.env.PLAYWRIGHT_PASSWORD || '';
const username: string = process.env.PLAYWRIGHT_USERNAME || '';

// Shared values extracted from URL
let platformKey: string = '';
let mentorId: string = '';

test.describe.serial('user can accept invite', () => {
  test('Invite user', async ({ page }) => {
    await navigateToMentorApp(page);

    // Extract platform key and mentor ID from URL
    const currentUrl = new URL(page.url());
    const pathParts = currentUrl.pathname.split('/').filter(Boolean);
    if (pathParts.length >= 3 && pathParts[0] === 'platform') {
      platformKey = pathParts[1];
      mentorId = pathParts[2];
      logger.info(
        `Extracted platformKey: ${platformKey}, mentorId: ${mentorId}`
      );
    }

    const isAdmin = await checkAdminStatus(page);
    const inviteUsersButton = page.getByRole('button', {
      name: 'Invite Users',
    });

    if (!isAdmin) {
      await expect(inviteUsersButton).not.toBeVisible();
      return;
    }

    await inviteUsersButton.click();

    const inviteUserDialog = page.getByRole('dialog', {
      name: 'Invite Users',
    });
    await expect(inviteUserDialog).toBeVisible();

    const inviteInputField = inviteUserDialog.getByRole('textbox', {
      name: 'Enter email to invite...',
    });
    const sendInviteButton = inviteUserDialog.getByRole('button', {
      name: 'Send Invite',
    });

    await expect(inviteInputField).toBeVisible();

    // Fill invite email and send invite
    await inviteInputField.fill(inviteEmail);
    await expect(sendInviteButton).toBeVisible();
    await sendInviteButton.click();
    await expect(sendInviteButton).not.toBeEnabled();

    const closeButton = inviteUserDialog.getByRole('button', {
      name: 'Close',
    });
    await closeButton.click();
    await expect(inviteUserDialog).not.toBeVisible();
  });

  test.describe('Accept invite', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('Accept invite', async ({ page }) => {
      const redirectUrl = `${MENTOR_NEXTJS_HOST}/platform/${platformKey}/${mentorId}`;

      await page.goto(`${AUTH_HOST}/signup?redirect-to=${redirectUrl}`);
      // Wait for the signup form to be ready
      await expect(page.getByPlaceholder('Email')).toBeVisible({
        timeout: 30000,
      });

      await signUpWithEmailAndPassword(
        page,
        {
          email: inviteEmail,
          password: inviteUserPassword,
        },
        true
      );

      await safeWaitForURL(
        page,
        (url) => url.href.startsWith(`${MENTOR_NEXTJS_HOST}/platform`),
        { timeout: 120000 }
      );
    });

    test('Verify user invite has been accepted', async ({ page }) => {
      await page.goto(MENTOR_NEXTJS_HOST, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      console.log('################################ AUTH_HOST ', AUTH_HOST);
      await safeWaitForURL(page, (url) => url.href.startsWith(AUTH_HOST), {
        timeout: 60000,
      });

      await loginWithEmailAndPassword(
        page,
        username,
        password,
        MENTOR_NEXTJS_HOST
      );

      await safeWaitForURL(
        page,
        (url) => url.href.startsWith(`${MENTOR_NEXTJS_HOST}/platform`),
        { timeout: 120000 }
      );

      const isAdmin = await checkAdminStatus(page);
      // wait for page to be fully loaded
      await waitForMentorAppReady(page);
      const inviteUsersButton = page.getByRole('button', {
        name: 'Invite Users',
      });

      if (!isAdmin) {
        await expect(inviteUsersButton).not.toBeVisible();
        return;
      }

      await expect(inviteUsersButton).toBeVisible({ timeout: 15000 });

      // Open dialog
      await inviteUsersButton.click();

      const inviteUserDialog = page.getByRole('dialog', {
        name: 'Invite Users',
      });
      await expect(inviteUserDialog).toBeVisible();

      const row = inviteUserDialog.locator('tr', {
        has: page.locator(`text="${inviteEmail}"`),
      });

      await expect(row).toBeVisible();

      const closeButton = inviteUserDialog.getByRole('button', {
        name: 'Close',
      });

      // 🔥 IMPORTANT: close dialog to avoid cached/stale data
      await closeButton.click(); // <-- ADDED: force UI state reset
      await expect(inviteUserDialog).not.toBeVisible();

      // 🔥 IMPORTANT: reopen dialog to trigger fresh data fetch
      await inviteUsersButton.click(); // <-- ADDED: ensures backend refetch
      await expect(inviteUserDialog).toBeVisible();

      const refreshedRow = inviteUserDialog.locator('tr', {
        has: page.locator(`text="${inviteEmail}"`),
      });

      // 🔥 BEST PRACTICE: poll until backend state propagates
      await expect
        .poll(
          async () => {
            const statusText = await refreshedRow
              .locator('td')
              .nth(1)
              .locator('span')
              .textContent();
            return statusText?.trim();
          },
          {
            timeout: 120_000, // <-- ADDED: wait for eventual consistency
            intervals: [1000, 2000, 3000], // <-- ADDED: controlled retry intervals
          }
        )
        .toBe('Accepted');

      logger.info(`Invite status for ${inviteEmail} is Accepted`);

      await closeButton.click();
      await expect(inviteUserDialog).not.toBeVisible();
    });
  });
});
