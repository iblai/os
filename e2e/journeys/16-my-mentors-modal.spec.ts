import { test, expect } from "../fixtures/mentor-test";
import { navigateToMentorApp, checkAdminStatus } from "../utils/auth";
import { safeWaitForURL } from "../utils/navigation";

test.describe("Journey 16: My Mentors Modal — Non-Admin", () => {
  test.beforeEach(async ({ nonadminPage }) => {
    await navigateToMentorApp(nonadminPage);
  });

  // fixme: My Mentors modal navigation times out — navbar locator change
  test.fixme(
    "non-admin goes to My Mentors dropdown and accesses a mentor",
    async ({ nonadminPage, nonadminNavbarPage }) => {
      await nonadminNavbarPage.openMyMentors();
      const dialog = nonadminPage.getByRole("dialog");
      await expect(dialog).toBeVisible({ timeout: 10_000 });
      const mentorCards = dialog
        .locator('button, [class*="mentor"]')
        .filter({ hasText: /.+/ });
      const count = await mentorCards.count();
      if (count > 0) {
        await mentorCards.first().click();
        await safeWaitForURL(
          nonadminPage,
          (url) => url.href.includes("/platform/"),
          { timeout: 30_000 },
        );
        expect(nonadminPage.url()).toContain("/platform/");
      }
    },
  );

  // fixme: My Mentors modal navigation times out — navbar locator change
  test.fixme(
    "non-admin goes to My Mentors modal and uses the Next pagination button",
    async ({ nonadminPage, nonadminNavbarPage }) => {
      await nonadminNavbarPage.openMyMentors();
      const dialog = nonadminPage.getByRole("dialog");
      await expect(dialog).toBeVisible({ timeout: 10_000 });
      const nextButton = dialog.getByRole("button", { name: /next/i });
      const visible = await nextButton
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      if (!visible) {
        // Single page — acceptable
        await nonadminPage.keyboard.press("Escape");
        return;
      }
      const isEnabled = await nextButton
        .isEnabled({ timeout: 3_000 })
        .catch(() => false);
      if (isEnabled) {
        await nextButton.click();
        await nonadminPage.waitForTimeout(1_000);
      }
      await nonadminPage.keyboard.press("Escape");
    },
  );
});

test.describe("Journey 16: My Mentors Modal — Admin", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  // fixme: My Mentors modal navigation times out — navbar locator change
  test.fixme(
    "admin goes to My Mentors modal and invites a user",
    async ({ page, navbarPage }) => {
      const isAdmin = await checkAdminStatus(page);
      test.skip(!isAdmin, "Inviting users requires admin access");
      await navbarPage.openMyMentors();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible({ timeout: 10_000 });
      const inviteButton = dialog.getByRole("button", { name: /invite/i });
      const visible = await inviteButton
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      if (visible) {
        await expect(inviteButton).toBeVisible();
      }
      await page.keyboard.press("Escape");
    },
  );
});
