import test, { expect } from '@playwright/test';
import { waitForPageReady, checkAdminStatus } from '../utils';
import { openMyMentorsDialog, navigateToMentor } from './helpers';
import { logger } from '@iblai/iblai-js/playwright';
import { fillCreateMentorForm } from '../utils/create-mentor';

test.describe('Enterprise tenant ', () => {
  test.beforeEach(async ({ page }) => {
    logger.info('Logging in as admin before test');
    await navigateToMentor(page);
  });

  test('Suite 1: New mentor creation from sidebar (dialog)', async ({
    page,
  }) => {
    await waitForPageReady(page);
    const isAdmin = await checkAdminStatus(page);
    expect(isAdmin).toBeTruthy();

    // Open 'New Mentor' from sidebar
    //fill mentor form
    await fillCreateMentorForm({ page });
  });

  test('Suite 2: New mentor creation from Settings dialog', async ({
    page,
  }) => {
    await waitForPageReady(page);
    const isAdmin = await checkAdminStatus(page);
    expect(isAdmin).toBeTruthy();

    const settingsBtn = page.getByRole('button', { name: /settings/i });
    await expect(settingsBtn).toBeVisible({ timeout: 10000 });
    await settingsBtn.click();

    const settingsDialog = page
      .getByRole('dialog')
      .filter({ hasText: /settings/i });
    await expect(settingsDialog).toBeVisible({ timeout: 15000 });

    await fillCreateMentorForm({ page, buttonName: 'Create Mentor' });
  });

  test('Suite 3: New mentor creation from My Mentors dialog', async ({
    page,
  }) => {
    await waitForPageReady(page);
    const isAdmin = await checkAdminStatus(page);
    expect(isAdmin).toBeTruthy();
    await openMyMentorsDialog(page);
    // Create button inside My Mentors
    await fillCreateMentorForm({ page, buttonName: 'Create' });
  });
});
