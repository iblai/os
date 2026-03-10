import test, { expect } from '@playwright/test';
import { AUTH_HOST, MENTOR_NEXTJS_HOST } from '../utils';
import { checkAdminStatus } from '../utils';
import {
  fillAuthCustomizationForm,
  navigateToTenantSettings,
  verifyDOMCustomization,
} from './helpers';
import { navigateToMentorApp } from '../profile/helpers';
import { fillCreateMentorForm } from '../utils/create-mentor';
import { navigateToMentor } from '../enterprise_tenant/helpers';
import { safeWaitForURL } from '@iblai/iblai-js/playwright';

// Test input values
const authCustomizationData = {
  displayTitle: 'Account creation',
  title: 'Account creation meta title',
  description: 'Create a new account to get started.',
  logoUrl: 'https://login.stg.iblai.app/iblai-logo.png',
  faviconUrl: 'https://login.stg.iblai.app/iblai-logo.png',
  displayImageUrl: 'https://login.stg.iblai.app/iblai-logo.png',
  displayImageAlt: 'image url to display',
  privacyPolicyUrl: 'https://www.google.com',
  termsOfUseUrl: 'https://www.google.com',
  slidePanelLogoUrl: 'https://login.stg.iblai.app/iblai-logo.png',
  ssoLogin: false,
};

test.describe('Customize Authentication SPA', () => {
  let mentorUrl: string;

  test.describe.serial('Admin customization', () => {
    test('customize authentication auth SPA', async ({ page }) => {
      // Navigate to Mentor SPA
      await navigateToMentorApp(page, MENTOR_NEXTJS_HOST);

      const isAdmin = await checkAdminStatus(page);

      if (isAdmin) {
        // create mentor before updating tenant settings
        await fillCreateMentorForm({
          page,
          formValues: {
            mentorName: `Anonymous Test Mentor ${Date.now()}`,
            mentorDescription: 'Test mentor for an advertising mentor user',
            mentorCategory: 'Advising',
            mentorVisibility: 'Anyone',
          },
        });

        // Navigate to tenant settings and open advanced options
        const tenantDialog = await navigateToTenantSettings(page);

        // Expand Auth SPA customization section
        const expandButton = tenantDialog.getByRole('button', {
          name: 'Expand Auth SPA  customization',
        });
        await expect(expandButton).toBeVisible();
        await expandButton.click();

        // Fill customization form
        await fillAuthCustomizationForm(tenantDialog, authCustomizationData);

        // Close tenant dialog
        await tenantDialog.getByRole('button', { name: 'close' }).click();
        await expect(tenantDialog).not.toBeVisible();

        // Save current Mentor SPA URL for unauthenticated tests
        mentorUrl = page.url();
      }
    });

    test.describe('unauthenticated user should see customization settings in the auth spa', () => {
      test.use({ storageState: { cookies: [], origins: [] } });

      test('unauthenticated user should see customization settings in the auth spa', async ({
        page,
      }) => {
        // Navigate to saved mentor URL
        await navigateToMentorApp(page, mentorUrl);

        // Click login button
        const loginButton = page.getByRole('button', { name: 'Log in' });
        if (await loginButton.isVisible()) {
          await loginButton.click();
        }

        // Wait for redirect to Auth SPA
        await safeWaitForURL(page, (url) =>
          url.href.startsWith(AUTH_HOST + '/login')
        );
        // Wait for the auth page to load by checking for email input
        await page.waitForLoadState('domcontentloaded');

        await verifyDOMCustomization(page, authCustomizationData);

        // Verify that when authorize_only_password_login is false, we can see the email field
        // and optionally the password login button (if not already showing password form)
        if (!authCustomizationData.ssoLogin) {
          // Verify both email and password fields are visible when authorize_only_password_login is true
          const emailInput = page.getByPlaceholder('Email');
          await expect(emailInput).toBeVisible({ timeout: 10000 });

          const passwordInput = page.getByPlaceholder('Password');
          await expect(passwordInput).toBeVisible({ timeout: 10000 });

          // Verify that password form is showing directly (no need to click "Continue with Password")
          // Both fields should be visible immediately
          expect(await emailInput.isVisible()).toBe(true);
          expect(await passwordInput.isVisible()).toBe(true);
          //Click on Forgot password link
          const forgotPasswordLink = page.getByText('Forgot password?');
          await expect(forgotPasswordLink).toBeVisible();
          await forgotPasswordLink.click();

          // Verify that the password reset page is loaded
          await safeWaitForURL(page, '**/password/reset*', { timeout: 10000 });
          await page.waitForLoadState('domcontentloaded');

          await verifyDOMCustomization(page, authCustomizationData, true);
        }
      });
    });
  });
});
