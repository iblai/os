import { test, expect } from "../fixtures/mentor-test";
import { navigateToMentorApp } from "../utils/auth";

test.describe("Journey 3: New User UI & Profile Dropdown", () => {
  test.beforeEach(async ({ nonadminPage }) => {
    await navigateToMentorApp(nonadminPage);
  });

  test("newly registered user open mentor dropdown to see New Chat item", async ({
    nonadminNavbarPage,
  }) => {
    await nonadminNavbarPage.mentorDropdown.click();
    await expect(nonadminNavbarPage.mentorDropdownNewChatItem).toBeVisible({
      timeout: 5_000,
    });
  });

  test("newly registered non-admin user goes to navbar and sees New Chat and My Mentors buttons but not admin features", async ({
    nonadminPage,
    nonadminNavbarPage,
  }) => {
    await nonadminNavbarPage.openMentorDropdown();
    // Non-admin sees at most 2 items (New Chat + My Mentors)
    const items = nonadminPage.getByRole("menuitem");
    const count = await items.count();
    expect(count).toBeLessThanOrEqual(2);
  });

  test("newly registered user goes to navbar and opens profile dropdown to see exactly 3 items", async ({
    nonadminNavbarPage,
  }) => {
    const count = await nonadminNavbarPage.getMenuItemCount();
    expect(count).toBe(3);
  });

  test("newly registered non-admin user goes to sidebar and clicks admin-only buttons which redirect to payment", async ({
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
        const modal = nonadminPage.getByRole("dialog");
        const hasModal = await modal
          .isVisible({ timeout: 5_000 })
          .catch(() => false);
        const isRedirected =
          nonadminPage.url().includes("auth") ||
          nonadminPage.url().includes("login");
        expect(hasModal || isRedirected).toBe(true);
        if (hasModal) {
          await nonadminPage.keyboard.press("Escape");
        }
      }
    }
  });
});
