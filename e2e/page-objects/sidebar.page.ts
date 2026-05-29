import { Page, Locator, expect } from '@playwright/test';

export class SidebarPage {
  readonly page: Page;

  readonly toggleButton: Locator;
  readonly exploreLink: Locator;
  readonly notificationsLink: Locator;
  readonly analyticsButton: Locator;
  readonly newProjectButton: Locator;
  readonly newMentorButton: Locator;
  readonly newChatButton: Locator;
  readonly inviteUsersButton: Locator;
  readonly workflowsButton: Locator;
  readonly settingsButton: Locator;
  readonly helpButton: Locator;
  readonly logoutButton: Locator;
  readonly projectItems: Locator;
  readonly logoImage: Locator;
  readonly logoButton: Locator;

  constructor(page: Page) {
    this.page = page;
    const sidebarHeader = page.locator('[data-sidebar="header"]');
    // The brand logo image lives in the sidebar header. When clickable it is
    // wrapped in a <button> (navigates home); otherwise it renders in a plain
    // <div>. Scope to the header so other logos never match, and exclude the
    // sibling sidebar-toggle button via `has`.
    this.logoImage = sidebarHeader.getByAltText('logo');
    this.logoButton = sidebarHeader
      .getByRole('button')
      .filter({ has: page.getByAltText('logo') });
    this.toggleButton = page
      .getByRole('button', { name: /toggle sidebar/i })
      .or(page.locator('[data-testid="sidebar-toggle"]'));
    // H26 fix: sidebar button is labeled "Agents" not "Explore"
    this.exploreLink = page
      .getByRole('button', { name: 'Agents', exact: true })
      .or(page.getByRole('button', { name: 'Explore', exact: true }));
    this.notificationsLink = page.getByRole('button', {
      name: 'Notifications',
      exact: true,
    });
    this.analyticsButton = page.getByRole('button', {
      name: 'Analytics',
      exact: true,
    });
    this.newProjectButton = page.getByRole('button', {
      name: 'New Project New Project',
      exact: true,
    });
    this.newMentorButton = page.getByRole('button', {
      name: 'New Agent',
      exact: true,
    });
    this.newChatButton = page.getByRole('button', {
      name: 'New Chat',
      exact: true,
    });
    this.inviteUsersButton = page.getByRole('button', {
      name: 'Invite Users',
      exact: true,
    });
    this.workflowsButton = page.getByRole('button', {
      name: 'Workflows',
      exact: true,
    });
    this.settingsButton = page.getByRole('button', {
      name: 'Settings',
      exact: true,
    });
    this.helpButton = page.getByRole('button', { name: /help/i });
    this.logoutButton = page.getByRole('menuitem', { name: /log out/i });
    this.projectItems = page.locator(
      '[data-testid*="project-item"], [class*="project-item"]',
    );
  }

  async toggle(): Promise<void> {
    await expect(this.toggleButton).toBeVisible({ timeout: 10_000 });
    await this.toggleButton.click();
  }

  async navigateToExplore(): Promise<void> {
    await expect(this.exploreLink).toBeVisible({ timeout: 10_000 });
    await this.page.waitForTimeout(5_000);
    await this.exploreLink.click();
  }

  async navigateToNotifications(): Promise<void> {
    await expect(this.notificationsLink).toBeVisible({ timeout: 10_000 });
    await this.notificationsLink.click();
  }

  async navigateToAnalytics(): Promise<void> {
    await expect(this.analyticsButton).toBeVisible({ timeout: 10_000 });
    await this.analyticsButton.click();
  }

  async isVisible(): Promise<boolean> {
    return this.toggleButton.isVisible({ timeout: 3_000 }).catch(() => false);
  }

  /**
   * Expands the sidebar if collapsed. While collapsed (icon mode) the header
   * logo container is `hidden`, so the logo must be revealed before asserting
   * on its clickability.
   */
  async ensureExpanded(): Promise<void> {
    const visible = await this.logoImage
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    if (visible) return;
    await this.toggle();
    await expect(this.logoImage).toBeVisible({ timeout: 10_000 });
  }
}
