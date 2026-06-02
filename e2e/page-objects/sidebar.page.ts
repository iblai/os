import { Page, Locator, expect } from '@playwright/test';

/**
 * Sidebar selectors are scoped to the `<aside>` landmark so that
 * accidental matches against page-content buttons with the same name
 * (e.g. an "Overview" tab on the Analytics page) can't bleed into
 * sidebar interactions.
 */
export class SidebarPage {
  readonly page: Page;
  readonly sidebar: Locator;

  readonly toggleButton: Locator;
  readonly notificationsLink: Locator;
  readonly analyticsButton: Locator;
  readonly newMentorButton: Locator;
  readonly newChatButton: Locator;
  readonly inviteUsersButton: Locator;
  readonly workflowsButton: Locator;
  readonly settingsButton: Locator;
  readonly helpButton: Locator;
  readonly logoutButton: Locator;
  // The brand logo lives in the sidebar header — a separate landmark from
  // the `<aside>` body. Consumed by `ensureExpanded()` and the share/embed
  // journeys, so they are scoped to the header rather than the aside root.
  readonly logoImage: Locator;
  readonly logoButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // The platform sidebar is rendered as `<aside>` (implicit role
    // `complementary`). Every interactive selector below is scoped
    // through this root so we never accidentally pick up a button
    // from the page content (e.g. an "Overview" tab on /analytics).
    this.sidebar = page.locator('aside').first();

    // The brand logo image lives in the sidebar header. When clickable it is
    // wrapped in a <button> (navigates home); otherwise it renders in a plain
    // <div>. Scope to the header so other logos never match, and exclude the
    // sibling sidebar-toggle button via `has`.
    const sidebarHeader = page.locator('[data-sidebar="header"]');
    this.logoImage = sidebarHeader.getByAltText('logo');
    this.logoButton = sidebarHeader
      .getByRole('button')
      .filter({ has: page.getByAltText('logo') });

    // The toggle button's aria-label flips between "Expand sidebar"
    // and "Collapse sidebar" depending on state.
    this.toggleButton = this.sidebar.getByRole('button', {
      name: /(expand|collapse) sidebar/i,
    });
    this.notificationsLink = this.sidebar.getByRole('button', {
      name: 'Notifications',
      exact: true,
    });
    // Analytics is the SECTION TRIGGER — clicking it toggles the
    // collapsible. To navigate, callers should use `navigateToAnalytics()`
    // which expands and clicks the Overview sub-item.
    this.analyticsButton = this.sidebar.getByRole('button', {
      name: 'Analytics',
      exact: true,
    });
    this.newMentorButton = this.sidebar.getByRole('button', {
      name: 'New Agent',
      exact: true,
    });
    this.newChatButton = this.sidebar.getByRole('button', {
      name: 'New Chat',
      exact: true,
    });
    // Footer entries were renamed in the new sidebar:
    //   "Invite Users" → "Invites"
    //   "Settings"     → "Advanced" (opens the Account dialog at the
    //                    advanced tab; no longer a direct modal trigger)
    this.inviteUsersButton = this.sidebar.getByRole('button', {
      name: 'Invites',
      exact: true,
    });
    this.workflowsButton = this.sidebar.getByRole('button', {
      name: 'Workflows',
      exact: true,
    });
    this.settingsButton = this.sidebar.getByRole('button', {
      name: 'Advanced',
      exact: true,
    });
    this.helpButton = this.sidebar.getByRole('button', { name: /help/i });
    this.logoutButton = page.getByRole('menuitem', { name: /log out/i });
  }

  async toggle(): Promise<void> {
    await expect(this.toggleButton).toBeVisible({ timeout: 10_000 });
    await this.toggleButton.click();
  }

  /**
   * Expand a collapsible section in the sidebar. No-op if already
   * expanded — uses the trigger's `aria-expanded` attribute (set by
   * Radix Collapsible) rather than a blind click that would toggle.
   */
  async expandSection(
    name: 'Agents' | 'Workflows' | 'Chats' | 'Projects' | 'Analytics',
  ): Promise<void> {
    const trigger = this.sidebar.getByRole('button', { name, exact: true });
    await expect(trigger).toBeVisible({ timeout: 10_000 });
    const expanded = await trigger
      .getAttribute('aria-expanded')
      .catch(() => null);
    if (expanded !== 'true') {
      await trigger.click();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true', {
        timeout: 5_000,
      });
    }
  }

  async navigateToExplore(): Promise<void> {
    // "Explore" is now inside the collapsible "Agents" section — expand
    // it, then click the inner item (scoped to the sidebar so the same
    // name on a page heading doesn't collide).
    await this.expandSection('Agents');
    const exploreItem = this.sidebar.getByRole('button', {
      name: 'Explore',
      exact: true,
    });
    await expect(exploreItem).toBeVisible({ timeout: 10_000 });
    await exploreItem.click();
  }

  async navigateToNotifications(): Promise<void> {
    await expect(this.notificationsLink).toBeVisible({ timeout: 10_000 });
    await this.notificationsLink.click();
  }

  async navigateToAnalytics(): Promise<void> {
    // "Analytics" is a collapsible section. The "Overview" sub-item
    // is what actually navigates to `/analytics`.
    await this.expandSection('Analytics');
    const overviewItem = this.sidebar.getByRole('button', {
      name: 'Overview',
      exact: true,
    });
    await expect(overviewItem).toBeVisible({ timeout: 10_000 });
    await overviewItem.click();
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
