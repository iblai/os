import { test, expect } from '@playwright/test';
import { MENTOR_NEXTJS_HOST } from './utils';
import { checkAdminStatus } from './utils';
import { fillCreateMentorForm } from './utils/create-mentor';

test.describe('Delete Mentor Cleanup', () => {
  test.setTimeout(200000);
  test.beforeEach(async ({ page }) => {
    await page.goto(MENTOR_NEXTJS_HOST);
    await page.waitForTimeout(10000);
  });

  test('Admin can delete a mentor from the settings button', async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);

    if (isAdmin) {
      await fillCreateMentorForm({ page });

      const selectedMentorDropdownButton = page.getByRole('button', {
        name: 'Selected mentor dropdown',
      });
      await expect(selectedMentorDropdownButton).toBeVisible({
        timeout: 10000,
      });

      await selectedMentorDropdownButton.click();

      const settingsMenuItem = page.getByRole('menuitem', { name: 'Settings' });
      await expect(settingsMenuItem).toBeVisible();

      await settingsMenuItem.click();

      const deleteMentorButton = page.getByRole('button', { name: 'Delete' });
      await expect(deleteMentorButton).toBeVisible();

      await deleteMentorButton.click();

      const deleteDialog = page.getByRole('alertdialog', {
        name: 'Delete Mentor',
      });

      await expect(deleteDialog).toBeVisible();

      await deleteDialog.getByRole('button', { name: 'Delete' }).click();

      await page.waitForURL(
        new RegExp(`^${MENTOR_NEXTJS_HOST}/platform/[^/]+/explore$`)
      );
      await page.waitForLoadState('networkidle');

      const mentorCardList = page.getByTestId('all-mentors-card-list');
      await expect(mentorCardList).toBeVisible();
      const mentorCards = mentorCardList.locator(':scope > li > button');
      const numberOfAllMentors = await mentorCards.count();

      expect(numberOfAllMentors).toBeGreaterThan(0);

      const firstMentorCard = mentorCards.first();
      await firstMentorCard.click();
      await page.waitForURL(
        new RegExp(`^${MENTOR_NEXTJS_HOST}/platform/[^/]+/[^/]+$`)
      );
      await page.waitForLoadState('networkidle');
    } else {
      await page
        .locator('button[aria-label="Selected mentor dropdown button"]')
        .click();

      await expect(
        page.locator('div[role="menuitem"]:has-text("New chat")')
      ).toBeVisible();
      await expect(
        page.getByRole('menuitem', { name: 'Settings' })
      ).not.toBeVisible();
    }
  });
});
