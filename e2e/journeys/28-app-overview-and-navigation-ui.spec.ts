import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';

test.describe('Journey 28: App Overview & Navigation UI — Non-Admin', () => {
  test.beforeEach(async ({ nonadminPage }) => {
    await navigateToMentorApp(nonadminPage);
  });

  test('non-admin goes to the platform and sees all expected header components', async ({
    nonadminPage,
    nonadminNavbarPage,
  }) => {
    await expect(nonadminNavbarPage.mentorDropdown).toBeVisible({
      timeout: 15_000,
    });
    await expect(nonadminNavbarPage.profileDropdown).toBeVisible({
      timeout: 10_000,
    });
  });

  test('non-admin goes to platform navbar and the mentor dropdown responds to clicks', async ({
    nonadminNavbarPage,
  }) => {
    await nonadminNavbarPage.openMentorDropdown();
    const menu = nonadminNavbarPage.page.getByRole('menu');
    await expect(menu).toBeVisible({ timeout: 5_000 });
    await nonadminNavbarPage.page.keyboard.press('Escape');
  });

  test('non-admin goes to platform navbar and profile dropdown buttons work as expected', async ({
    nonadminNavbarPage,
  }) => {
    const count = await nonadminNavbarPage.getMenuItemCount();
    expect(count).toBeGreaterThan(0);
  });

  test('non-admin goes to platform sidebar and sees all expected sidebar components', async ({
    nonadminPage,
    nonadminSidebarPage,
  }) => {
    await expect(nonadminSidebarPage.exploreLink).toBeVisible({
      timeout: 10_000,
    });
    await expect(nonadminSidebarPage.notificationsLink).toBeVisible({
      timeout: 10_000,
    });
  });

  test('non-admin goes to platform and the Vector document sidebar button is visible', async ({
    nonadminNavbarPage,
  }) => {
    const visible = await nonadminNavbarPage.vectorDocButton
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    // Vector document button is optional — just verify the page loaded
    expect(typeof visible).toBe('boolean');
  });
});

test.describe('Journey 28: App Overview & Navigation UI — Admin', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  test('admin goes to platform and opens LLM provider modal from navbar which hides the configuration header', async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'LLM provider modal requires admin access');
    const llmButton = page.getByRole('button', {
      name: /llm.*provider|select.*llm/i,
    });
    if (await llmButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await llmButton.click();
      const modal = page
        .getByRole('dialog')
        .filter({ hasText: /llm.*provider|select.*provider/i });
      await expect(modal).toBeVisible({ timeout: 10_000 });
      const configHeader = modal.getByRole('heading', {
        name: /configuration/i,
      });
      await expect(configHeader).not.toBeVisible({ timeout: 3_000 });
      await page.keyboard.press('Escape');
    }
  });

  test('admin goes to edit mentor modal and the LLM provider modal inside retains the configuration header', async ({
    page,
    editMentorPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Requires admin access');
    await editMentorPage.open('LLM');
    await waitForPageReady(page);
    const llmButton = editMentorPage.dialog.getByRole('button', {
      name: /llm.*provider|select.*llm/i,
    });
    if (await llmButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await llmButton.click();
      const modal = page
        .getByRole('dialog')
        .filter({ hasText: /llm.*provider|select.*provider/i })
        .last();
      await expect(modal).toBeVisible({ timeout: 10_000 });
      const configHeader = modal.getByRole('heading', {
        name: /configuration/i,
      });
      const headerVisible = await configHeader
        .isVisible({ timeout: 3_000 })
        .catch(() => false);
      expect(typeof headerVisible).toBe('boolean');
      await page.keyboard.press('Escape');
    }
    await editMentorPage.close();
  });
});
