import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';

test.describe('Journey 3: New User UI & Profile Dropdown', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  test('newly registered user goes to navbar and opens the mentor dropdown to see New Chat item', async ({
    navbarPage,
  }) => {
    await navbarPage.openMentorDropdown();
    await expect(navbarPage.newChatItem).toBeVisible({ timeout: 5_000 });
  });

  test('newly registered non-admin user goes to navbar and sees New Chat and My Mentors buttons but not admin features', async ({
    page,
    navbarPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(isAdmin, 'Test targets non-admin users');
    await navbarPage.openMentorDropdown();
    // Non-admin sees at most 2 items (New Chat + My Mentors)
    const items = page.getByRole('menuitem');
    const count = await items.count();
    expect(count).toBeLessThanOrEqual(2);
  });

  test('newly registered user goes to navbar and opens profile dropdown to see exactly 3 items', async ({
    navbarPage,
  }) => {
    const count = await navbarPage.getMenuItemCount();
    expect(count).toBe(3);
  });

  test('newly registered non-admin user goes to sidebar and clicks admin-only buttons which redirect to auth', async ({
    page,
    sidebarPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(isAdmin, 'Test targets non-admin users');

    // Clicking admin buttons should trigger upgrade/auth modal or redirect
    const adminButtons = [
      sidebarPage.newMentorButton,
      sidebarPage.settingsButton,
      sidebarPage.analyticsButton,
    ];

    for (const btn of adminButtons) {
      const visible = await btn.isVisible({ timeout: 3_000 }).catch(() => false);
      if (visible) {
        await btn.click();
        // Either a pricing modal or auth redirect appears
        const modal = page.getByRole('dialog');
        const hasModal = await modal
          .isVisible({ timeout: 5_000 })
          .catch(() => false);
        const isRedirected = page.url().includes('auth') || page.url().includes('login');
        expect(hasModal || isRedirected).toBe(true);
        if (hasModal) {
          await page.keyboard.press('Escape');
        }
      }
    }
  });
});
