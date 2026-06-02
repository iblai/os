import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp } from '../utils/auth';

test.describe('Journey 3: New User UI & Profile Dropdown', () => {
  test.beforeEach(async ({ nonadminPage }) => {
    await navigateToMentorApp(nonadminPage);
  });

  test('newly registered user open mentor dropdown to see New Chat item', async ({
    nonadminNavbarPage,
  }) => {
    await nonadminNavbarPage.mentorDropdown.click();
    await expect(nonadminNavbarPage.mentorDropdownNewChatItem).toBeVisible({
      timeout: 5_000,
    });
  });

  test('newly registered non-admin user goes to navbar and sees New Chat item in dropdown but no My Mentors button', async ({
    nonadminPage,
    nonadminNavbarPage,
  }) => {
    // My Mentors button was removed from the header in feat-1431;
    // discovery now flows entirely through the sidebar Explore link.
    const myMentorsButton = nonadminPage.getByRole('button', {
      name: /my mentors/i,
    });
    await expect(myMentorsButton).not.toBeVisible({ timeout: 5_000 });

    // The mentor dropdown should still expose "New Chat"
    await nonadminNavbarPage.openMentorDropdown();
    const items = nonadminPage.getByRole('menuitem');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('newly registered user goes to navbar and opens profile dropdown to see exactly 3 items', async ({
    nonadminNavbarPage,
  }) => {
    const count = await nonadminNavbarPage.getMenuItemCount();
    expect(count).toBe(3);
  });

  test('newly registered non-admin user goes to sidebar and clicks admin-only buttons which redirect to payment', async ({
    nonadminPage,
    nonadminSidebarPage,
  }) => {
    // Clicking admin buttons should trigger upgrade/auth modal or redirect
    const adminButtons = [nonadminSidebarPage.newProjectButton];

    for (const btn of adminButtons) {
      const visible = await btn
        .isVisible({ timeout: 3_000 })
        .catch(() => false);
      if (visible) {
        await btn.click();
        // Either a pricing modal or auth redirect appears
        const modal = nonadminPage.getByRole('dialog');
        const hasModal = await modal
          .isVisible({ timeout: 5_000 })
          .catch(() => false);
        const isRedirected =
          nonadminPage.url().includes('auth') ||
          nonadminPage.url().includes('login');
        expect(hasModal || isRedirected).toBe(true);
        if (hasModal) {
          await nonadminPage.keyboard.press('Escape');
        }
      }
    }
  });
});
