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
  /**
   * The User/Admin mode switch (admin-only, xl+ viewport). Matched by
   * aria-label rather than role: the label text flips between "User mode
   * enabled"/"User mode disabled" depending on state, and a stale
   * `aria-hidden="true"` left on the app shell can drop role-based queries
   * out of the accessibility tree. `getByLabel` (attribute-based) is more
   * robust — see journeys/42-suggested-prompts.spec.ts for the precedent.
   */
  readonly userModeSwitch: Locator;
  /**
   * The profile dropdown's open popover (Radix `role="menu"`). Scoping
   * locators inside it is required for the mobile-only learner mode row
   * below: it renders the SAME `LearnerModeSwitch` component (identical
   * aria-label) as `userModeSwitch` above, just in a second place in the
   * DOM — one copy sits directly in the navbar (visible only at `xl:` and
   * up), the other inside this dropdown (visible only below `xl:`, via
   * `xl:hidden` on its wrapper). An unscoped `getByLabel(/user mode/i)`
   * matches both regardless of which is actually visible (Playwright's
   * strict mode counts every match, not just visible ones), so callers on
   * a sub-`xl` viewport must go through `mobileLearnerModeSwitch` /
   * `mobileLearnerModeRow` once the dropdown is open, never the bare label
   * query.
   */
  readonly profileDropdownMenu: Locator;
  /**
   * The learner-mode switch rendered inside the profile dropdown (mobile
   * only, `xl:hidden`). Only present while the dropdown is open — call
   * `openProfileDropdown()` first. There is exactly one `role="switch"` in
   * this dropdown, so no further disambiguation is needed.
   */
  readonly mobileLearnerModeSwitch: Locator;
  /**
   * The dropdown menuitem row hosting `mobileLearnerModeSwitch`. Its text
   * content is the row's label — "Admin"/"User" (issue #2592; previously
   * "Instructor"/"Learner").
   */
  readonly mobileLearnerModeRow: Locator;

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
    this.userModeSwitch = page.getByLabel(/user mode/i);
    this.profileDropdownMenu = page.getByRole('menu');
    this.mobileLearnerModeSwitch = this.profileDropdownMenu.getByRole('switch');
    // `.filter({ has })` re-runs the given locator's OWN selector chain
    // relative to each candidate — so passing `mobileLearnerModeSwitch`
    // (chained off `profileDropdownMenu`, i.e. "role=menu >> role=switch")
    // would require a nested `role=menu` *inside* the menuitem, which never
    // matches. The `has` locator must be a bare, single-hop query instead;
    // `page.getByRole('switch')` becomes ":scope >> role=switch" once
    // filtered, which correctly matches the switch as a plain descendant.
    this.mobileLearnerModeRow = this.profileDropdownMenu
      .getByRole('menuitem')
      .filter({ has: page.getByRole('switch') });
  }

  /** Alias of `openMentorDropdown` — opens the "Selected agent" dropdown. */
  async openAgentDropdown(): Promise<void> {
    await this.openMentorDropdown();
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

  /**
   * True when the User/Admin switch currently reflects Admin (instructor)
   * mode — i.e. `aria-checked="true"` on the switch. Only meaningful for an
   * admin viewing a mentor visible to logged-in users (the switch is not
   * rendered otherwise).
   */
  async isAdminModeActive(): Promise<boolean> {
    await expect(this.userModeSwitch).toBeVisible({ timeout: 10_000 });
    return (await this.userModeSwitch.getAttribute('aria-checked')) === 'true';
  }

  /** Clicks the User/Admin switch, flipping it to whichever state it isn't in. */
  async toggleUserMode(): Promise<void> {
    await expect(this.userModeSwitch).toBeVisible({ timeout: 10_000 });
    await this.userModeSwitch.click();
  }

  /** Ensures the switch ends up in User (student) mode; no-ops if already there. */
  async switchToUserMode(): Promise<void> {
    if (await this.isAdminModeActive()) {
      await this.toggleUserMode();
    }
  }

  /** Ensures the switch ends up in Admin (instructor) mode; no-ops if already there. */
  async switchToAdminMode(): Promise<void> {
    if (!(await this.isAdminModeActive())) {
      await this.toggleUserMode();
    }
  }

  /**
   * Returns the trimmed label text of the mobile learner-mode row inside
   * the (already-open) profile dropdown — "Admin" or "User". Throws if the
   * dropdown isn't open or the row isn't rendered (requires an admin on a
   * non-`main` tenant, viewed below the `xl` breakpoint).
   */
  async getMobileLearnerModeLabel(): Promise<string> {
    await expect(this.mobileLearnerModeRow).toBeVisible({ timeout: 10_000 });
    return (await this.mobileLearnerModeRow.textContent())?.trim() ?? '';
  }

  /**
   * Clicks the learner-mode switch inside the (already-open) profile
   * dropdown (mobile row). The dropdown may close as a side effect of the
   * click reaching Radix's outside-interaction handling — callers should
   * re-open it via `openProfileDropdown()` before asserting the new label.
   */
  async toggleMobileLearnerMode(): Promise<void> {
    await expect(this.mobileLearnerModeSwitch).toBeVisible({
      timeout: 10_000,
    });
    await this.mobileLearnerModeSwitch.click();
  }

  /**
   * Returns the trimmed text of every currently *visible* menuitem in the
   * "Selected agent" dropdown. `CategorizedDropdownMenu` renders both a
   * desktop grid and a mobile accordion for the same items (one is hidden
   * via CSS depending on viewport), so this filters to visible elements
   * only to avoid double-counting.
   */
  async getDropdownItems(): Promise<string[]> {
    const items = this.page.getByRole('menuitem');
    const count = await items.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      let visible = false;
      try {
        await item.waitFor({ state: 'visible', timeout: 500 });
        visible = true;
      } catch {
        visible = false;
      }
      if (!visible) continue;
      const text = (await item.textContent())?.trim();
      if (text) names.push(text);
    }
    return names;
  }
}
