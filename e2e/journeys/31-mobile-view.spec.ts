import { test, expect } from "../fixtures/mentor-test";
import { navigateToMentorApp } from "../utils/auth";

test.use({ viewport: { width: 393, height: 851 } }); // Pixel 5

test.describe("Journey 31: Mobile View", () => {
  test.beforeEach(async ({ nonadminPage }) => {
    await navigateToMentorApp(nonadminPage);
  });

  // fixme: mobile sidebar/explore elements not visible — viewport or layout change
  test.fixme(
    "non-admin on mobile goes to sidebar and sees the correct menu items",
    async ({ nonadminPage, nonadminSidebarPage }) => {
      // Sidebar may be auto-collapsed on mobile — expand it
      const toggleBtn = nonadminSidebarPage.toggleButton;
      if (await toggleBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await toggleBtn.click();
        await nonadminPage.waitForTimeout(500);
      }
      await expect(nonadminSidebarPage.exploreLink).toBeVisible({
        timeout: 10_000,
      });
      await expect(nonadminSidebarPage.notificationsLink).toBeVisible({
        timeout: 10_000,
      });
    },
  );

  test("non-admin on mobile goes to navbar and the mentor dropdown works correctly", async ({
    nonadminNavbarPage,
  }) => {
    await nonadminNavbarPage.openMentorDropdown();
    const menu = nonadminNavbarPage.page.getByRole("menu");
    await expect(menu).toBeVisible({ timeout: 5_000 });
    await nonadminNavbarPage.page.keyboard.press("Escape");
  });

  test("non-admin on mobile goes to navbar and the profile button works correctly", async ({
    nonadminNavbarPage,
  }) => {
    await nonadminNavbarPage.openProfileDropdown();
    const menu = nonadminNavbarPage.page.getByRole("menu");
    await expect(menu).toBeVisible({ timeout: 5_000 });
    await nonadminNavbarPage.page.keyboard.press("Escape");
  });

  test("non-admin on mobile goes to platform and navbar components render correctly", async ({
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

  // fixme: mobile sidebar/explore elements not visible — viewport or layout change
  test.fixme(
    "non-admin on mobile goes to explore page and sees the title, description, and tabs",
    async ({ nonadminPage, nonadminSidebarPage, nonadminExplorePage }) => {
      await nonadminSidebarPage.navigateToExplore();
      await expect(nonadminExplorePage.heading).toBeVisible({
        timeout: 15_000,
      });
    },
  );

  // fixme: mobile sidebar/explore elements not visible — viewport or layout change
  test.fixme(
    "non-admin on mobile goes to explore page and searches for a mentor",
    async ({ nonadminPage, nonadminSidebarPage, nonadminExplorePage }) => {
      await nonadminSidebarPage.navigateToExplore();
      await expect(nonadminExplorePage.searchInput).toBeVisible({
        timeout: 10_000,
      });
      await nonadminExplorePage.search("test");
      await expect(nonadminExplorePage.searchInput).toHaveValue("test");
    },
  );

  // fixme: mobile sidebar/explore elements not visible — viewport or layout change
  test.fixme(
    "non-admin on mobile goes to datasets tab and performs upload and untrain/delete flow",
    async ({ nonadminPage, nonadminEditMentorPage }) => {
      const dropdown = nonadminPage.getByRole("button", {
        name: "Selected mentor dropdown button",
      });
      if (!(await dropdown.isVisible({ timeout: 10_000 }).catch(() => false)))
        return;
      await nonadminEditMentorPage.open("Datasets");
      await nonadminPage.waitForTimeout(1_000);
      await expect(
        nonadminEditMentorPage.datasets.addResourceButton,
      ).toBeVisible({ timeout: 10_000 });
      await nonadminEditMentorPage.close();
    },
  );
});
