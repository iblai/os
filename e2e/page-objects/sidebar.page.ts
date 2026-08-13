import { Page, Locator, expect } from '@playwright/test';
import { isVisibleWithin } from '../utils/resilient';

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
    name: 'Agents' | 'Workflows' | 'Recents' | 'Projects' | 'Analytics',
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
    return isVisibleWithin(this.toggleButton, 3_000);
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
    // Fast path: logo already visible (sidebar expanded and mounted).
    if (await this.logoImage.isVisible().catch(() => false)) return;

    // The embedded layout blocks rendering until mentor settings load, which
    // can be slow against the embed backend. Wait for the sidebar chrome
    // (the toggle control) to mount first — otherwise we'd misread a slow-
    // mounting sidebar as collapsed and toggle it *shut*, hiding the logo for
    // good. Callers (e.g. the embed Show Catalogue tests) pass a generous
    // timeout so the sidebar has time to appear.
    await expect(this.toggleButton).toBeVisible({ timeout: timeoutMs });

    // Only expand when actually collapsed: the toggle reads "Expand sidebar"
    // while collapsed and "Collapse sidebar" while expanded.
    const expandButton = this.sidebar.getByRole('button', {
      name: /expand sidebar/i,
    });
    if (await expandButton.isVisible().catch(() => false)) {
      await expandButton.click();
    }

    await expect(this.logoImage).toBeVisible({ timeout: timeoutMs });
  }

  /**
   * Expand the "Recents" collapsible section in the sidebar (no-op if already
   * expanded). Prerequisite for any recent/pinned chat assertions.
   */
  async expandChatsSection(): Promise<void> {
    await this.expandSection('Recents');
  }

  /**
   * Returns the `<ul role="list">` that holds recent chat row buttons inside
   * the expanded Recents collapsible. Scoped to the sidebar `<aside>` so it
   * cannot collide with any page-content lists.
   *
   * Located by testid: this used to hang off the "Recent" heading that sat
   * above the list, and that heading is gone - the panel is called Recents,
   * so a caps label repeating it was noise.
   */
  getRecentChatsList(): import('@playwright/test').Locator {
    return this.sidebar.locator('[data-testid="recent-chats-list"]');
  }

  /**
   * Returns ALL button elements inside the Recent chats list. Each row is a
   * `<button type="button">` whose text content is the first message in that
   * chat session (rendered by `chatRowLabel()`).
   */
  getRecentChatRows(): import('@playwright/test').Locator {
    return this.getRecentChatsList().getByRole('button');
  }

  /**
   * Returns a locator for a specific Recent chat row whose text contains
   * `text`. Uses `hasText` rather than exact matching because `chatRowLabel`
   * renders the first message content which may be truncated or markdown-
   * wrapped by the time it reaches the DOM.
   */
  getRecentChatRow(text: string): import('@playwright/test').Locator {
    return this.getRecentChatsList().getByRole('button', { name: text });
  }

  /**
   * Returns a locator for a specific Recent chat row by its SESSION ID
   * (`data-session-id` on the row-select button — see `ChatRowItem`).
   *
   * Prefer this over `getRecentChatRow(text)` whenever the test knows the
   * session id (via `chatPage.getCachedSessionId(mentorId)`): the visible
   * label prefers the backend's asynchronously generated session title, so
   * a row found by sent-message text can stop matching at any moment once
   * the title lands.
   */
  getRecentChatRowBySession(
    sessionId: string,
  ): import('@playwright/test').Locator {
    return this.getRecentChatsList().locator(
      `button[data-session-id="${sessionId}"]`,
    );
  }

  /**
   * Returns true if a Recent chat row matching `text` is visible within
   * `timeoutMs`. Uses `waitFor` (NOT `isVisible().catch()`) so the timeout
   * is honoured for cases where the row appears after an async refetch.
   */
  async isRecentChatVisible(
    text: string,
    timeoutMs = 15_000,
  ): Promise<boolean> {
    const row = this.getRecentChatsList().locator('button', { hasText: text });
    try {
      await row.waitFor({ state: 'visible', timeout: timeoutMs });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Returns true if the Recent chat row for `sessionId` is visible within
   * `timeoutMs`. Title-generation-proof variant of `isRecentChatVisible` —
   * see `getRecentChatRowBySession`.
   */
  async isRecentChatVisibleBySession(
    sessionId: string,
    timeoutMs = 15_000,
  ): Promise<boolean> {
    try {
      await this.getRecentChatRowBySession(sessionId).waitFor({
        state: 'visible',
        timeout: timeoutMs,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Returns true if the "No recent chats" empty-state span is currently
   * visible inside the Chats section. Uses `waitFor` with a short timeout
   * so the check fast-fails when the list has items.
   */
  async isRecentChatsEmpty(timeoutMs = 5_000): Promise<boolean> {
    const emptyState = this.sidebar.locator('span', {
      hasText: /no recent chats/i,
    });
    try {
      await emptyState.waitFor({ state: 'visible', timeout: timeoutMs });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Click the first visible Recent chat row and return its text content so
   * the caller can assert on it. Prerequisite: `expandChatsSection()` must
   * have been called first so the Chats collapsible is open.
   */
  async clickFirstRecentChat(): Promise<string> {
    const firstRow = this.getRecentChatRows().first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    const text = (await firstRow.textContent()) ?? '';
    await firstRow.click();
    return text.trim();
  }

  /**
   * Returns the `<li>` container for a specific Recent (or Pinned) chat row
   * whose select-button text contains `text`. The row-select `<button>` and
   * the "Chat actions" three-dot trigger are DOM SIBLINGS inside this `<li>`
   * (see `ChatRowItem` in `app-sidebar/index.tsx` — `<div class="group
   * relative">` wraps a `<button>` for selection and a separate absolutely
   * positioned `<div>` holding the three-dot menu), so callers needing the
   * three-dot trigger must scope through this container rather than the
   * select button itself.
   */
  getChatRowContainer(text: string): import('@playwright/test').Locator {
    return this.getRecentChatsList()
      .locator('li')
      .filter({ has: this.page.getByRole('button', { name: text }) });
  }

  /**
   * `getChatRowContainer` keyed by session id instead of label text —
   * see `getRecentChatRowBySession` for why session id is preferred.
   */
  getChatRowContainerBySession(
    sessionId: string,
  ): import('@playwright/test').Locator {
    return this.getRecentChatsList()
      .locator('li')
      .filter({
        has: this.page.locator(`button[data-session-id="${sessionId}"]`),
      });
  }

  /**
   * Returns the "Chat actions" three-dot trigger button for a specific
   * Recent/Pinned chat row. The button is `opacity-0` until the row is
   * hovered/focused (Tailwind `group-hover`) — Playwright's visibility
   * check does not consider opacity, but `openChatActionsMenu` hovers the
   * row first anyway to mirror real user interaction.
   */
  getChatActionsButton(text: string): import('@playwright/test').Locator {
    return this.getChatRowContainer(text).getByRole('button', {
      name: 'Chat actions',
    });
  }

  /**
   * Dismiss any currently-open Radix dropdown/menu by pressing Escape and
   * wait until no `role="menu"` is left open. The chat-actions three-dot menu
   * does NOT auto-close on outside state changes, and its content reflects
   * `canExport` as evaluated when it was opened — so callers that change the
   * gating state (tenant setting, learner mode) must close and re-open the
   * menu to read the fresh state. Tolerant of there being no open menu.
   */
  async closeAnyOpenMenu(): Promise<void> {
    const menu = this.page.getByRole('menu');
    try {
      await menu.first().waitFor({ state: 'visible', timeout: 500 });
    } catch {
      return; // nothing open
    }
    await this.page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0, { timeout: 5_000 });
  }

  /**
   * Hovers the given Recent/Pinned chat row (revealing its three-dot
   * trigger) and opens the row's dropdown menu (Pin/Unpin, Export, Delete).
   * Returns the open `role="menu"` locator so callers can assert on
   * `role="menuitem"` entries. Prerequisite: `expandChatsSection()`.
   *
   * Always opens from a CLOSED state: clicking the trigger toggles the Radix
   * menu, so a lingering open menu would otherwise be toggled shut (or leave a
   * stale menu reflecting an outdated `canExport`). We dismiss any open menu
   * first so the returned menu always reflects current state.
   */
  async openChatActionsMenu(
    text: string,
  ): Promise<import('@playwright/test').Locator> {
    return this.openMenuForRow(
      this.getChatRowContainer(text),
      this.getRecentChatRow(text),
    );
  }

  /**
   * `openChatActionsMenu` keyed by session id instead of label text —
   * see `getRecentChatRowBySession` for why session id is preferred.
   */
  async openChatActionsMenuBySession(
    sessionId: string,
  ): Promise<import('@playwright/test').Locator> {
    return this.openMenuForRow(
      this.getChatRowContainerBySession(sessionId),
      this.getRecentChatRowBySession(sessionId),
    );
  }

  private async openMenuForRow(
    container: import('@playwright/test').Locator,
    selectButton: import('@playwright/test').Locator,
  ): Promise<import('@playwright/test').Locator> {
    await this.closeAnyOpenMenu();
    await expect(container).toBeVisible({ timeout: 15_000 });
    // Hover the select button (inside the `.group` wrapper) so the
    // Tailwind `group-hover:opacity-100` rule on the three-dot trigger
    // actually engages, same as a real user hovering the row.
    await selectButton.hover();
    const actionsBtn = container.getByRole('button', {
      name: 'Chat actions',
    });
    await expect(actionsBtn).toBeVisible({ timeout: 5_000 });
    await actionsBtn.click();
    const menu = this.page.getByRole('menu');
    await expect(menu).toBeVisible({ timeout: 5_000 });
    return menu;
  }
}
