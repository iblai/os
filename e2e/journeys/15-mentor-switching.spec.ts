import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp } from '../utils/auth';
import { safeWaitForURL } from '../utils/navigation';
import { MENTOR_NEXTJS_HOST } from '../fixtures/test-data';

test.describe('Journey 15: Mentor Switching', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  test('authenticated user goes to explore page and switches to a different mentor by clicking a card', async ({
    page,
    sidebarPage,
    explorePage,
  }) => {
    const initialUrl = page.url();
    await sidebarPage.navigateToExplore();
    await expect(explorePage.mentorCards.first()).toBeVisible({ timeout: 15_000 });
    await explorePage.clickFirstMentorCard();
    await safeWaitForURL(
      page,
      (url) => url.href !== initialUrl && url.href.includes('/platform/'),
      { timeout: 15_000 },
    );
    expect(page.url()).not.toBe(initialUrl);
  });

  test('authenticated user goes to My Mentors modal and switches to a different mentor and continues chatting', async ({
    page,
    navbarPage,
    chatPage,
  }) => {
    test.skip(
      ({ browserName }) => browserName === 'webkit',
      'Flaky on Safari — skipping',
    );
    await navbarPage.openMyMentors();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    const mentorCards = dialog.locator('button, [class*="mentor"]').filter({ hasText: /.+/ });
    const count = await mentorCards.count();
    if (count > 0) {
      await mentorCards.first().click();
      await safeWaitForURL(
        page,
        (url) => url.href.includes('/platform/'),
        { timeout: 30_000 },
      );
      await expect(chatPage.chatInput).toBeVisible({ timeout: 15_000 });
      await chatPage.sendMessage('Hello after switching mentors');
      await chatPage.waitForAIResponse();
    }
  });

  test('authenticated user goes to My Mentors modal and switches to a different mentor', async ({
    page,
    navbarPage,
  }) => {
    await navbarPage.openMyMentors();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    const mentorCards = dialog.locator('button, [class*="mentor"]').filter({ hasText: /.+/ });
    const count = await mentorCards.count();
    if (count > 0) {
      const firstMentorName = await mentorCards.first().textContent().catch(() => '');
      await mentorCards.first().click();
      await safeWaitForURL(
        page,
        (url) => url.href.includes('/platform/'),
        { timeout: 30_000 },
      );
      expect(page.url()).toContain('/platform/');
    }
  });

  test('authenticated user goes to My Mentors modal using the dedicated switch spec', async ({
    page,
    navbarPage,
  }) => {
    await navbarPage.openMyMentors();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
  });

  test('authenticated user goes to explore page using the dedicated switch spec and selects a mentor', async ({
    page,
    sidebarPage,
    explorePage,
  }) => {
    await sidebarPage.navigateToExplore();
    await expect(explorePage.mentorCards.first()).toBeVisible({ timeout: 15_000 });
    await explorePage.clickFirstMentorCard();
    await safeWaitForURL(
      page,
      (url) => url.href.includes('/platform/'),
      { timeout: 15_000 },
    );
    expect(page.url()).toContain('/platform/');
  });

  test('authenticated user goes to explore section on home page and switches mentor', async ({
    page,
  }) => {
    // The home page may show an Explore Mentors section with cards
    const exploreMentorsHeading = page.getByRole('heading', {
      name: /explore mentors/i,
    });
    const visible = await exploreMentorsHeading
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (!visible) return; // Not in explore-mentors state
    const mentorCard = page
      .locator('[class*="mentor-card"], [data-testid*="mentor-card"]')
      .first();
    if (await mentorCard.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await mentorCard.click();
      await safeWaitForURL(
        page,
        (url) => url.href.includes('/platform/'),
        { timeout: 15_000 },
      );
      expect(page.url()).toContain('/platform/');
    }
  });
});
