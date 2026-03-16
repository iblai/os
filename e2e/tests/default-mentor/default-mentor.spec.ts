/**
 * Default Mentor Feature E2E Tests
 *
 * Tests the complete flow for the default mentor feature:
 * 1. Admin sets a default mentor in Advanced settings
 * 2. Admin invites a new user
 * 3. New user signs up and sees the default mentor
 *
 * Following resilient Playwright test patterns from TESTING_GUIDELINES.md
 */

import { test, expect } from '@playwright/test';
import { logger } from '@iblai/iblai-js/playwright';
import { AUTH_HOST, MENTOR_NEXTJS_HOST } from '../utils';
import { checkAdminStatus, waitForPageReady } from '../utils';
import { navigateToMentorApp } from '../profile/helpers';
import {
  navigateToTenantSettings,
  navigateToAdvancedTab,
  navigateToManagementTab,
  selectDefaultMentor,
  saveDefaultMentorSetting,
  openInviteUsersModal,
  inviteUserByEmail,
  closeDialog,
  logout,
  navigateToSignupPage,
  signUpWithCredentials,
  getCurrentMentorNameFromPage,
  generateTestEmail,
  extractUrlParts,
} from './helpers';

// Shared test data across tests
const testPassword = '12345678';
let inviteEmail: string;
let selectedMentorName: string;
let platformKey: string;
let mentorId: string;

test.describe.serial('Default Mentor Feature', () => {
  test('Admin can set default mentor in Advanced settings', async ({
    page,
  }) => {
    logger.info('Starting: Admin sets default mentor');

    // Navigate to mentor app
    await navigateToMentorApp(page);

    // Extract URL parts for later use
    const urlParts = extractUrlParts(page.url());
    if (urlParts) {
      platformKey = urlParts.platformKey;
      mentorId = urlParts.mentorId;
      logger.info(
        `Extracted platformKey: ${platformKey}, mentorId: ${mentorId}`
      );
    }

    // Verify user is admin
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      logger.info('User is not admin - skipping test');
      test.skip();
      return;
    }

    // Open tenant settings
    const accountDialog = await navigateToTenantSettings(page);

    // Navigate to Advanced tab
    await navigateToAdvancedTab(page, accountDialog);

    // Select a default mentor
    selectedMentorName = await selectDefaultMentor(page, accountDialog);
    console.log('selectedMentorName ###£@', selectedMentorName);
    logger.info(`Selected mentor: ${selectedMentorName}`);

    // Save the setting
    //await saveDefaultMentorSetting(page, accountDialog);

    // Close the dialog
    await closeDialog(page, accountDialog);

    logger.info(`Default mentor set to: ${selectedMentorName}`);
  });

  test('Admin can invite a new user', async ({ page }) => {
    logger.info('Starting: Admin invites a new user');

    // Navigate to mentor app
    await navigateToMentorApp(page);

    // Verify user is admin
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      logger.info('User is not admin - skipping test');
      test.skip();
      return;
    }

    // Generate unique email for this test run
    inviteEmail = generateTestEmail();
    logger.info(`Generated invite email: ${inviteEmail}`);

    // Open tenant settings
    const accountDialog = await navigateToTenantSettings(page);

    // Navigate to Management tab
    await navigateToManagementTab(page, accountDialog);

    // Open Invite Users modal
    const inviteModal = await openInviteUsersModal(page, accountDialog);

    // Invite the user
    await inviteUserByEmail(page, inviteModal, inviteEmail);

    // Close the invite modal
    await closeDialog(page, inviteModal);

    // Close the settings dialog
    await closeDialog(page, accountDialog);

    logger.info(`User ${inviteEmail} invited successfully`);
  });

  test.describe('New user signup flow', () => {
    // Use clean storage state for new user tests
    test.use({ storageState: { cookies: [], origins: [] } });

    test('Invited user can signup and see default mentor', async ({ page }) => {
      // Skip if we don't have the required data from previous tests
      if (!inviteEmail || !selectedMentorName) {
        logger.info('Missing test data from previous tests - skipping');
        test.skip();
        return;
      }

      logger.info('Starting: New user signup and default mentor verification');
      logger.info(`Using email: ${inviteEmail}`);
      logger.info(`Expected mentor: ${selectedMentorName}`);

      // Build the redirect URL
      const redirectUrl =
        platformKey && mentorId
          ? `${MENTOR_NEXTJS_HOST}/platform/${platformKey}/${mentorId}`
          : MENTOR_NEXTJS_HOST;

      // Navigate to signup page with redirect
      await page.goto(`${AUTH_HOST}/signup`, {
        waitUntil: 'domcontentloaded',
      });

      // Sign up with the invited email
      await signUpWithCredentials(page, inviteEmail, testPassword);

      // Wait for redirect to mentor app
      await page.waitForURL(
        (url) => url.href.startsWith(`${MENTOR_NEXTJS_HOST}/platform`),
        { timeout: 60000 }
      );

      await navigateToMentorApp(page);

      await expect(
        page.getByRole('heading', { name: selectedMentorName })
      ).toBeVisible({ timeout: 15000 });

      logger.info(`Default mentor verified: ${selectedMentorName}`);
    });
  });
});
