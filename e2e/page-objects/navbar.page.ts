import { Page, Locator, expect } from '@playwright/test';

export class NavbarPage {
  readonly page: Page;

  readonly mentorDropdown: Locator;
  readonly mentorDropdownNewChatItem: Locator;
  readonly profileDropdown: Locator;
  readonly notificationBell: Locator;
  readonly newChatItem: Locator;
  readonly profileItem: Locator;
  readonly helpItem: Locator;
  readonly logoutItem: Locator;
  readonly vectorDocButton: Locator;
  /** The button that opens the LLM provider selection modal (admin-only). */
  readonly llmModelSelectorButton: Locator;
  /** The span inside the LLM selector button that displays the chosen provider/model name. */
  readonly llmNameSpan: Locator;
  /** The nav element — used for overflow geometry assertions. */
  readonly navElement: Locator;

  constructor(page: Page) {
    this.page = page;
    this.mentorDropdown = page.getByRole('button', {
      name: 'Selected agent dropdown button',
    });
    this.mentorDropdownNewChatItem = page.getByRole('menuitem', {
      name: 'New Chat',
      exact: true,
    });

    this.profileDropdown = page.getByRole('button', {
      name: 'More options',
      exact: true,
    });
    this.notificationBell = page.getByRole('button', { name: /notification/i });
    this.newChatItem = page
      .getByRole('menuitem', { name: /new chat/i })
      .or(page.getByRole('button', { name: /new chat/i }));
    this.profileItem = page.getByRole('menuitem', { name: /profile/i });
    this.helpItem = page.getByRole('menuitem', { name: /help/i });
    this.logoutItem = page.getByRole('menuitem', { name: /log out/i });
    this.vectorDocButton = page.getByRole('button', {
      name: /vector document/i,
    });
    this.llmModelSelectorButton = page.getByRole('button', {
      name: 'LLM Model Selector',
    });
    this.llmNameSpan = this.llmModelSelectorButton.locator('span').first();
    this.navElement = page.locator('nav').first();
  }

  async openMentorDropdown(): Promise<void> {
    await expect(this.mentorDropdown).toBeVisible({ timeout: 15_000 });
    await this.mentorDropdown.click();
  }

  async openProfileDropdown(): Promise<void> {
    await expect(this.profileDropdown).toBeVisible({ timeout: 10_000 });
    await this.profileDropdown.click();
  }

  async logout(): Promise<void> {
    await this.openProfileDropdown();
    await expect(this.logoutItem).toBeVisible({ timeout: 5_000 });
    await this.logoutItem.click();
  }

  async getMenuItemCount(): Promise<number> {
    await this.openProfileDropdown();
    const items = this.page.getByRole('menuitem');
    return items.count();
  }

  /**
   * Returns true if the LLM Model Selector button is present and visible.
   * The button is only rendered for admins on the chat page.
   */
  async llmSelectorIsVisible(timeout = 5_000): Promise<boolean> {
    try {
      await this.llmModelSelectorButton.waitFor({
        state: 'visible',
        timeout,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Returns the text content of the LLM name span inside the selector button.
   * Returns null when the button is not rendered.
   */
  async getLlmNameText(): Promise<string | null> {
    if (!(await this.llmSelectorIsVisible())) return null;
    return this.llmNameSpan.textContent();
  }

  /**
   * Checks whether the nav element overflows the viewport horizontally.
   * Returns an object with `overflows: boolean` and the measured widths.
   * A correct layout has `scrollWidth <= clientWidth`.
   */
  async getNavOverflowMetrics(): Promise<{
    overflows: boolean;
    scrollWidth: number;
    clientWidth: number;
    viewportWidth: number;
  }> {
    const viewportWidth = this.page.viewportSize()?.width ?? 0;
    const metrics = await this.navElement.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    return {
      overflows: metrics.scrollWidth > metrics.clientWidth,
      scrollWidth: metrics.scrollWidth,
      clientWidth: metrics.clientWidth,
      viewportWidth,
    };
  }

  /**
   * Returns the bounding box of the nav element.
   * Used to verify it fits within the viewport.
   */
  async getNavBoundingBox() {
    return this.navElement.boundingBox();
  }

  /**
   * Opens the LLM provider selection modal (admin-only).
   * No-ops gracefully if the button is not visible (non-admin or non-chat page).
   */
  async openLlmProviderModal(): Promise<boolean> {
    if (!(await this.llmSelectorIsVisible())) return false;
    await this.llmModelSelectorButton.click();
    return true;
  }
}
