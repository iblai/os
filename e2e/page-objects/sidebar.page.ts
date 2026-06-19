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
  readonly newProjectButton: Locator;
  readonly inviteUsersButton: Locator;
  readonly managementButton: Locator;
  readonly integrationsButton: Locator;
  readonly monetizationButton: Locator;
  readonly workflowsButton: Locator;
  readonly settingsButton: Locator;
  readonly helpButton: Locator;
  readonly logoutButton: Locator;
  // "Explore" used to be a top-level link; in the new sidebar it lives
  // inside the collapsible "Agents" section. Older journeys still
  // reference `exploreLink` so we keep it as an alias for the same
  // button — `navigateToExplore()` is the preferred entry point because
  // it expands the parent section first.
  readonly exploreLink: Locator;
  // The brand logo lives directly inside the sidebar `<aside>` in the
  // new layout — the old layout wrapped it in `SidebarHeader`
  // (`[data-sidebar="header"]`) but the rewrite mounts the `<Logo />`
  // component as a direct child of the aside instead. Scope to the
  // aside so embed-mode and share-page tests that read the logo still
  // resolve it.
  readonly logoImage: Locator;
  readonly logoButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // The platform sidebar is rendered as `<aside>` (implicit role
    // `complementary`). Every interactive selector below is scoped
    // through this root so we never accidentally pick up a button
    // from the page content (e.g. an "Overview" tab on /analytics).
    this.sidebar = page.locator('aside').first();

    // Logo: scoped to the aside (NOT to `[data-sidebar="header"]`, which
    // the new sidebar layout doesn't use). When the logo is clickable it
    // is wrapped in a <button>; the image itself always carries
    // `alt="logo"` per `components/logo.tsx`.
    this.logoImage = this.sidebar.getByAltText('logo');
    this.logoButton = this.sidebar
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
      name: /^new chat$/i,
    });
    // "New Project" lives inside the collapsible "Projects" section in
    // the new sidebar — consumers that just need the locator (e.g.
    // visibility assertions) can use this directly; consumers that need
    // to CLICK it should call `expandSection('Projects')` first or use
    // `ProjectPage.createFromSidebar()`.
    this.newProjectButton = this.sidebar.getByRole('button', {
      name: 'New Project',
      exact: true,
    });
    // "Explore" is the third item inside the collapsible Agents section
    // in the new sidebar — kept as a thin alias for older journeys that
    // still reference `exploreLink`.
    this.exploreLink = this.sidebar.getByRole('button', {
      name: 'Explore',
      exact: true,
    });
    // Footer entries were renamed in the new sidebar:
    //   "Invite Users" → "Invites"
    //   "Settings"     → "Advanced" (opens the Account dialog at the
    //                    advanced tab; no longer a direct modal trigger)
    // Trial-gated footer items shown to main-tenant non-admins when
    // `showTrialGatedAdminMenu` is true (stripe + pre-free/advertising mode).
    this.inviteUsersButton = this.sidebar.getByRole('button', {
      name: 'Invites',
      exact: true,
    });
    this.managementButton = this.sidebar.getByRole('button', {
      name: 'Management',
      exact: true,
    });
    this.integrationsButton = this.sidebar.getByRole('button', {
      name: 'Integrations',
      exact: true,
    });
    this.monetizationButton = this.sidebar.getByRole('button', {
      name: 'Monetization',
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

  async toggle(timeoutMs = 10_000): Promise<void> {
    await expect(this.toggleButton).toBeVisible({ timeout: timeoutMs });
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
   * Returns true if the given section trigger is present in the sidebar DOM
   * within the given timeout. Uses `waitFor` (not the snapshot `isVisible()`)
   * so the timeout is actually honoured.
   *
   * Primarily used by embed-mode assertions where Agents / Workflows /
   * Analytics / Projects sections must be ABSENT. Pass a short timeout so
   * the check fails fast when the element is correctly hidden.
   */
  async isSectionTriggerVisible(
    name: string,
    timeoutMs = 3_000,
  ): Promise<boolean> {
    const trigger = this.sidebar.getByRole('button', { name, exact: true });
    try {
      await trigger.waitFor({ state: 'visible', timeout: timeoutMs });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Returns true if the Support / docs link (ibl.ai/docs) is present in the
   * sidebar footer. Uses `waitFor` with a short timeout so the check fast-
   * fails when the footer is correctly hidden in embed mode.
   */
  async isSupportLinkVisible(timeoutMs = 3_000): Promise<boolean> {
    // The link renders as an <a> with visible text "Support" (expanded) or
    // aria-label="Support" (rail-collapsed). Both are caught by getByRole.
    const link = this.sidebar.getByRole('link', { name: /support/i });
    try {
      await link.waitFor({ state: 'visible', timeout: timeoutMs });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Expands the sidebar if collapsed. While collapsed (icon mode) the header
   * logo container is `hidden`, so the logo must be revealed before asserting
   * on its clickability.
   */
  async ensureExpanded(timeoutMs = 10_000): Promise<void> {
    const visible = await this.logoImage
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    if (visible) return;
    // The embedded layout blocks rendering until mentor settings load, which
    // can be slow against the embed backend — callers (e.g. the embed Show
    // Catalogue tests) pass a generous timeout so the sidebar has time to mount.
    await this.toggle(timeoutMs);
    await expect(this.logoImage).toBeVisible({ timeout: timeoutMs });
  }
}
