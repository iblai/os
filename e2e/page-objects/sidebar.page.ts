import { Page, Locator, expect } from "@playwright/test";

export class SidebarPage {
  readonly page: Page;

  readonly toggleButton: Locator;
  readonly exploreLink: Locator;
  readonly notificationsLink: Locator;
  readonly analyticsButton: Locator;
  readonly newProjectButton: Locator;
  readonly newMentorButton: Locator;
  readonly inviteUsersButton: Locator;
  readonly settingsButton: Locator;
  readonly helpButton: Locator;
  readonly logoutButton: Locator;
  readonly projectItems: Locator;

  constructor(page: Page) {
    this.page = page;
    this.toggleButton = page
      .getByRole("button", { name: /toggle sidebar/i })
      .or(page.locator('[data-testid="sidebar-toggle"]'));
    // H26 fix: sidebar button is labeled "Mentors" not "Explore"
    this.exploreLink = page
      .getByRole("button", { name: "Mentors", exact: true })
      .or(page.getByRole("button", { name: "Explore", exact: true }));
    this.notificationsLink = page.getByRole("button", {
      name: "Notifications",
      exact: true,
    });
    this.analyticsButton = page.getByRole("button", {
      name: "Analytics",
      exact: true,
    });
    this.newProjectButton = page.getByRole("button", {
      name: "New Project",
      exact: true,
    });
    this.newMentorButton = page.getByRole("button", {
      name: "New Mentor",
      exact: true,
    });
    this.inviteUsersButton = page.getByRole("button", {
      name: "Invite Users",
      exact: true,
    });
    this.settingsButton = page.getByRole("button", {
      name: "Settings",
      exact: true,
    });
    this.helpButton = page.getByRole("button", { name: /help/i });
    this.logoutButton = page.getByRole("menuitem", { name: /log out/i });
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
}
