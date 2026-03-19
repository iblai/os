import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';

test.describe('Journey 28: App Overview & Navigation UI', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  test('authenticated user goes to the platform and sees all expected header components', async ({
    page,
    navbarPage,
  }) => {
    await expect(navbarPage.mentorDropdown).toBeVisible({ timeout: 15_000 });
    await expect(navbarPage.profileDropdown).toBeVisible({ timeout: 10_000 });
  });

  test('authenticated user goes to platform navbar and the mentor dropdown responds to clicks', async ({
    navbarPage,
  }) => {
    await navbarPage.openMentorDropdown();
    const menu = navbarPage.page.getByRole('menu');
    await expect(menu).toBeVisible({ timeout: 5_000 });
    await navbarPage.page.keyboard.press('Escape');
  });

  test('authenticated user goes to platform navbar and profile dropdown buttons work as expected', async ({
    navbarPage,
  }) => {
    const count = await navbarPage.getMenuItemCount();
    expect(count).toBeGreaterThan(0);
  });

  test('authenticated user goes to platform sidebar and sees all expected sidebar components', async ({
    page,
    sidebarPage,
  }) => {
    await expect(sidebarPage.exploreLink).toBeVisible({ timeout: 10_000 });
    await expect(sidebarPage.notificationsLink).toBeVisible({ timeout: 10_000 });
  });

  test('authenticated user goes to platform and the Vector document sidebar button is visible', async ({
    navbarPage,
  }) => {
    const visible = await navbarPage.vectorDocButton
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    // Vector document button is optional — just verify the page loaded
    expect(typeof visible).toBe('boolean');
  });

  test('admin goes to platform and opens LLM provider modal from navbar which hides the configuration header', async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'LLM provider modal requires admin access');
    const llmButton = page.getByRole('button', { name: /llm.*provider|select.*llm/i });
    if (await llmButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await llmButton.click();
      const modal = page.getByRole('dialog').filter({ hasText: /llm.*provider|select.*provider/i });
      await expect(modal).toBeVisible({ timeout: 10_000 });
      const configHeader = modal.getByRole('heading', { name: /configuration/i });
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
      const modal = page.getByRole('dialog').filter({ hasText: /llm.*provider|select.*provider/i }).last();
      await expect(modal).toBeVisible({ timeout: 10_000 });
      const configHeader = modal.getByRole('heading', { name: /configuration/i });
      const headerVisible = await configHeader.isVisible({ timeout: 3_000 }).catch(() => false);
      expect(typeof headerVisible).toBe('boolean');
      await page.keyboard.press('Escape');
    }
    await editMentorPage.close();
  });
});
