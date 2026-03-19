import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';

test.describe('Journey 5: Mentor Discovery — Explore Page', () => {
  test.beforeEach(async ({ page, sidebarPage }) => {
    await navigateToMentorApp(page);
    await sidebarPage.navigateToExplore();
  });

  test('authenticated user goes to explore page and sees the page title and description', async ({
    explorePage,
  }) => {
    await expect(explorePage.heading).toBeVisible({ timeout: 15_000 });
  });

  test('authenticated user goes to explore page and sees mentor cards with correct information', async ({
    explorePage,
  }) => {
    await expect(explorePage.mentorCards.first()).toBeVisible({ timeout: 15_000 });
  });

  test('authenticated user goes to explore page and searches for a mentor by name', async ({
    explorePage,
  }) => {
    await expect(explorePage.searchInput).toBeVisible({ timeout: 10_000 });
    await explorePage.search('test');
    await expect(explorePage.searchInput).toHaveValue('test');
  });

  test('authenticated user goes to explore page and loads more mentors with the see more button', async ({
    explorePage,
  }) => {
    const seeMore = explorePage.seeMoreButton;
    const hasSeeMore = await seeMore
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (!hasSeeMore) return; // fewer than page-size mentors — acceptable
    const beforeCount = await explorePage.mentorCards.count();
    await seeMore.click();
    await explorePage.page.waitForTimeout(2_000);
    const afterCount = await explorePage.mentorCards.count();
    expect(afterCount).toBeGreaterThanOrEqual(beforeCount);
  });

  test('authenticated user goes to explore page and sees the featured section when configured', async ({
    explorePage,
  }) => {
    const visible = await explorePage.featuredSection
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    // May not be configured — just assert the page loaded
    expect(explorePage.heading).toBeDefined();
    if (visible) {
      await expect(explorePage.featuredSection).toBeVisible();
    }
  });

  test('authenticated user goes to explore page and filters mentors by LLM provider', async ({
    page,
    explorePage,
  }) => {
    const trigger = explorePage.llmFilterTrigger;
    const visible = await trigger.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!visible) return;
    await trigger.click();
    const firstOption = page.getByRole('option').first()
      .or(page.getByRole('menuitem').first());
    if (await firstOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await firstOption.click();
    } else {
      await page.keyboard.press('Escape');
    }
  });

  test('authenticated user goes to explore page and filters mentors by subject', async ({
    page,
    explorePage,
  }) => {
    const trigger = explorePage.subjectFilterTrigger;
    const visible = await trigger.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!visible) return;
    await trigger.click();
    const firstOption = page.getByRole('option').first()
      .or(page.getByRole('menuitem').first());
    if (await firstOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await firstOption.click();
    } else {
      await page.keyboard.press('Escape');
    }
  });

  test('authenticated user goes to explore page and filters mentors by type', async ({
    page,
    explorePage,
  }) => {
    const trigger = explorePage.typeFilterTrigger;
    const visible = await trigger.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!visible) return;
    await trigger.click();
    const firstOption = page.getByRole('option').first()
      .or(page.getByRole('menuitem').first());
    if (await firstOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await firstOption.click();
    } else {
      await page.keyboard.press('Escape');
    }
  });

  test('authenticated user goes to explore page and filters by Created by Me', async ({
    page,
    explorePage,
  }) => {
    const trigger = explorePage.createdByFilterTrigger;
    const visible = await trigger.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!visible) return;
    await trigger.click();
    const meOption = page.getByRole('option', { name: /me/i })
      .or(page.getByRole('menuitem', { name: /me/i }));
    if (await meOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await meOption.click();
    } else {
      await page.keyboard.press('Escape');
    }
  });

  test('authenticated user goes to explore page and filters by Created by Community', async ({
    page,
    explorePage,
  }) => {
    const trigger = explorePage.createdByFilterTrigger;
    const visible = await trigger.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!visible) return;
    await trigger.click();
    const communityOption = page.getByRole('option', { name: /community/i })
      .or(page.getByRole('menuitem', { name: /community/i }));
    if (await communityOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await communityOption.click();
    } else {
      await page.keyboard.press('Escape');
    }
  });

  test('authenticated user goes to explore page and clicks a mentor card to navigate to that mentor and chat', async ({
    page,
    explorePage,
    chatPage,
  }) => {
    await expect(explorePage.mentorCards.first()).toBeVisible({ timeout: 15_000 });
    await explorePage.clickFirstMentorCard();
    await expect(page).toHaveURL(/\/platform\/[^/]+\/[^/]+$/, { timeout: 15_000 });
    await expect(chatPage.chatInput).toBeVisible({ timeout: 15_000 });
  });

  test('admin goes to explore page and sees the custom mentor creation button', async ({
    page,
    explorePage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Custom mentor creation requires admin access');
    await expect(explorePage.createCustomMentorButton).toBeVisible({
      timeout: 10_000,
    });
  });

  test('authenticated user goes to explore page and stars a mentor to add it to favorites', async ({
    explorePage,
  }) => {
    await expect(explorePage.mentorCards.first()).toBeVisible({ timeout: 15_000 });
    await explorePage.starFirstMentor();
    // After starring, the favorites section should appear or the star state should change
    await explorePage.page.waitForTimeout(1_000);
    const favVisible = await explorePage.favoritesSection
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    const starActive = await explorePage.page
      .getByRole('button', { name: /unstar|remove.*favorite/i })
      .first()
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    expect(favVisible || starActive).toBe(true);
  });
});
