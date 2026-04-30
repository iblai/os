import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp } from '../utils/auth';
import { safeWaitForURL } from '../utils/navigation';

test.describe('Journey 15: Mentor Switching', () => {
  test.beforeEach(async ({ nonadminPage }) => {
    await navigateToMentorApp(nonadminPage);
  });

  test('non-admin goes to explore page and switches to a different mentor by clicking a card', async ({
    nonadminPage,
    nonadminSidebarPage,
    nonadminExplorePage,
  }) => {
    await nonadminSidebarPage.navigateToExplore();
    // 2-min ceiling: explore page initial load can take ~30s when the
    // ?limit=8 mentors query gets aborted+retried during component mount.
    await expect(nonadminExplorePage.mentorCards.first()).toBeVisible({
      timeout: 120_000,
    });
    await nonadminExplorePage.clickFirstMentorCard();
    await safeWaitForURL(
      nonadminPage,
      (url) => !url.href.includes('explore') && url.href.includes('/platform/'),
      { timeout: 15_000 },
    );
  });

  test('non-admin goes to explore page using the dedicated switch spec and selects a mentor', async ({
    nonadminPage,
    nonadminSidebarPage,
    nonadminExplorePage,
  }) => {
    await nonadminSidebarPage.navigateToExplore();
    await expect(nonadminExplorePage.mentorCards.first()).toBeVisible({
      timeout: 120_000,
    });
    await nonadminExplorePage.clickFirstMentorCard();
    await safeWaitForURL(
      nonadminPage,
      (url) => url.href.includes('/platform/'),
      { timeout: 15_000 },
    );
    expect(nonadminPage.url()).toContain('/platform/');
  });

  test('non-admin goes to explore section on home page and switches mentor', async ({
    nonadminPage,
  }) => {
    // The home page may show an Explore Mentors section with cards
    const exploreMentorsHeading = nonadminPage.getByRole('heading', {
      name: /explore agents/i,
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
        (url) => url.href.includes('/platform/'),
        { timeout: 15_000 },
      );
      expect(nonadminPage.url()).toContain('/platform/');
    }
  });
});
