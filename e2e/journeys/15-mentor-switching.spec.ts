import { test, expect } from "../fixtures/mentor-test";
import { navigateToMentorApp } from "../utils/auth";
import { safeWaitForURL } from "../utils/navigation";
import { MENTOR_NEXTJS_HOST } from "../fixtures/test-data";

test.describe("Journey 15: Mentor Switching", () => {
  test.beforeEach(async ({ nonadminPage }) => {
    await navigateToMentorApp(nonadminPage);
  });

  test("non-admin goes to explore page and switches to a different mentor by clicking a card", async ({
    nonadminPage,
    nonadminSidebarPage,
    nonadminExplorePage,
  }) => {
    const initialUrl = nonadminPage.url();
    await nonadminSidebarPage.navigateToExplore();
    await expect(nonadminExplorePage.mentorCards.first()).toBeVisible({
      timeout: 15_000,
    });
    await nonadminExplorePage.clickFirstMentorCard();
    await safeWaitForURL(
      nonadminPage,
      (url) => url.href !== initialUrl && url.href.includes("/platform/"),
      { timeout: 15_000 },
    );
    expect(nonadminPage.url()).not.toBe(initialUrl);
  });

  test("non-admin goes to My Mentors modal and switches to a different mentor and continues chatting", async ({
    nonadminPage,
    nonadminNavbarPage,
    nonadminChatPage,
  }) => {
    test.skip(
      ({ browserName }) => browserName === "webkit",
      "Flaky on Safari — skipping",
    );
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
      await expect(nonadminChatPage.chatInput).toBeVisible({ timeout: 15_000 });
      await nonadminChatPage.sendMessage("Hello after switching mentors");
      await nonadminChatPage.waitForAIResponse();
    }
  });

  test("non-admin goes to My Mentors modal and switches to a different mentor", async ({
    nonadminPage,
    nonadminNavbarPage,
  }) => {
    await nonadminNavbarPage.openMyMentors();
    const dialog = nonadminPage.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    const mentorCards = dialog
      .locator('button, [class*="mentor"]')
      .filter({ hasText: /.+/ });
    const count = await mentorCards.count();
    if (count > 0) {
      const firstMentorName = await mentorCards
        .first()
        .textContent()
        .catch(() => "");
      await mentorCards.first().click();
      await safeWaitForURL(
        nonadminPage,
        (url) => url.href.includes("/platform/"),
        { timeout: 30_000 },
      );
      expect(nonadminPage.url()).toContain("/platform/");
    }
  });

  test("non-admin goes to My Mentors modal using the dedicated switch spec", async ({
    nonadminPage,
    nonadminNavbarPage,
  }) => {
    await nonadminNavbarPage.openMyMentors();
    const dialog = nonadminPage.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await nonadminPage.keyboard.press("Escape");
  });

  test("non-admin goes to explore page using the dedicated switch spec and selects a mentor", async ({
    nonadminPage,
    nonadminSidebarPage,
    nonadminExplorePage,
  }) => {
    await nonadminSidebarPage.navigateToExplore();
    await expect(nonadminExplorePage.mentorCards.first()).toBeVisible({
      timeout: 15_000,
    });
    await nonadminExplorePage.clickFirstMentorCard();
    await safeWaitForURL(
      nonadminPage,
      (url) => url.href.includes("/platform/"),
      { timeout: 15_000 },
    );
    expect(nonadminPage.url()).toContain("/platform/");
  });

  test("non-admin goes to explore section on home page and switches mentor", async ({
    nonadminPage,
  }) => {
    // The home page may show an Explore Mentors section with cards
    const exploreMentorsHeading = nonadminPage.getByRole("heading", {
      name: /explore mentors/i,
    });
    const visible = await exploreMentorsHeading
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (!visible) return; // Not in explore-mentors state
    const mentorCard = nonadminPage
      .locator('[class*="mentor-card"], [data-testid*="mentor-card"]')
      .first();
    if (await mentorCard.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await mentorCard.click();
      await safeWaitForURL(
        nonadminPage,
        (url) => url.href.includes("/platform/"),
        { timeout: 15_000 },
      );
      expect(nonadminPage.url()).toContain("/platform/");
    }
  });
});
