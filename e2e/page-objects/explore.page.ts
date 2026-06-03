import { Page, Locator, expect } from '@playwright/test';

export class ExplorePage {
  readonly page: Page;

  readonly heading: Locator;
  readonly searchInput: Locator;
  readonly mentorCards: Locator;
  readonly seeMoreButton: Locator;
  readonly featuredSection: Locator;
  readonly favoritesSection: Locator;
  readonly createCustomMentorButton: Locator;
  readonly llmFilterTrigger: Locator;
  readonly subjectFilterTrigger: Locator;
  readonly typeFilterTrigger: Locator;
  readonly createdByFilterTrigger: Locator;
  readonly clearFiltersButton: Locator;
  /**
   * `DefaultMentorsSection` short-circuits to `<EmptyState />` (rendered by
   * `app/.../explore/_components/empty-state.tsx`) when the mentors query
   * returns zero results AND is not loading. Test environments with no
   * seeded mentors hit this path and should not be treated as a code bug.
   */
  readonly emptyState: Locator;
  /**
   * Always-rendered page chrome: the scrollable
   * `<div id="main-content" aria-label="Agent exploration page">` wraps
   * the entire ExplorePageContent tree (the shared `<main>` landmark in
   * app-layout carries no accessible name), so its visibility confirms
   * the page mounted regardless of how the inner data query resolved.
   */
  readonly main: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /all agents/i });
    this.searchInput = page.getByPlaceholder(/search/i);
    this.mentorCards = page.getByRole('listitem', {
      name: /^explore agent:/i,
    });
    this.seeMoreButton = page
      .getByRole('button', { name: /load more|see more/i })
      .first();
    this.featuredSection = page.getByRole('region', { name: /featured/i }).or(
      page
        .getByText(/featured/i)
        .locator('..')
        .locator('..'),
    );
    this.favoritesSection = page
      .getByRole('list', { name: 'Favorite agents', exact: true })
      .or(
        page
          .getByText(/favorites/i)
          .locator('..')
          .locator('..'),
      );
    this.createCustomMentorButton = page
      .getByRole('button', { name: 'Create Custom Agent', exact: true })
      .or(page.getByRole('button', { name: /^create\s+custom\s+agent$/i }));
    this.llmFilterTrigger = page
      .getByRole('button', { name: /llm.*provider|provider/i })
      .first();
    this.subjectFilterTrigger = page
      .getByRole('button', { name: /subject/i })
      .first();
    this.typeFilterTrigger = page
      .getByRole('button', { name: /^type$/i })
      .first();
    this.createdByFilterTrigger = page
      .getByRole('button', { name: /created by/i })
      .first();
    this.clearFiltersButton = page.getByRole('button', { name: /clear/i });
    // Empty-state text rendered by `EmptyState` when DefaultMentorsSection
    // has nothing to show.
    this.emptyState = page.getByText(/sorry, no agents found/i);
    this.main = page.getByLabel('Agent exploration page');
  }

  async search(query: string): Promise<void> {
    await expect(this.searchInput).toBeVisible({ timeout: 10_000 });
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500);
  }

  async starFirstMentor(): Promise<void> {
    const starButton = this.page
      .getByRole('button', { name: 'Add to favorites', exact: true })
      .first();
    await expect(starButton).toBeVisible({ timeout: 10_000 });
    await starButton.click();
  }

  async selectOption(optionName: string | RegExp): Promise<void> {
    const option = this.page.getByRole('option', { name: optionName });
    const menuItem = this.page.getByRole('menuitem', { name: optionName });
    const visible = await option
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    if (visible) {
      await option.click();
    } else {
      await expect(menuItem).toBeVisible({ timeout: 3_000 });
      await menuItem.click();
    }
  }

  async clickFirstMentorCard(): Promise<void> {
    await expect(this.mentorCards.first()).toBeVisible({ timeout: 15_000 });
    await this.mentorCards.first().click();
  }
}
