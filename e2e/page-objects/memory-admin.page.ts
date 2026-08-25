import { Page, Locator, expect } from '@playwright/test';
import {
  MEMORY_ADMIN_LABELS,
  isTenantMemoryTabVisible,
  switchToTenantMemoryTab,
  switchToMemoryAdminSubTab,
  memoryAdminGlobalSection,
  memoryAdminAgentSection,
  memoryAdminUserRow,
  memoryAdminAgentRow,
  memoryRowByContent,
  searchMemoryAdminUsers,
  openUserMemoriesPopup,
  closeUserMemoriesPopup,
  deleteUserGlobalMemory,
  toggleUserMemoryAdminSetting,
  filterAgentMemories,
  clearAgentMemoriesFilter,
  openAgentMemoriesPopup,
  closeAgentMemoriesPopup,
  addAgentMemoryFromPopup,
  type MemoryAdminSubTab,
  type MemoryAdminSetting,
} from '@iblai/iblai-js/playwright';

/**
 * Page object for the tenant-settings **Memory** admin tab
 * (`MemoryAdminTab` — `@iblai/iblai-js/web-containers/next`), reached from
 * the "User Profile" dialog's tenant-settings rail (More Options → platform
 * name). This is a brand-new SDK surface picked up purely via the SDK bump —
 * there is NO host wiring for it (nothing in `app/`/`components/` references
 * `MemoryAdminTab`), so every locator here flows through the SDK's official
 * Playwright helpers (`@iblai/iblai-js/playwright`) rather than any
 * component-specific host code.
 *
 * Two sub-tabs:
 *   - **Global**  — tenant users table (server-side search) + a per-user
 *     popup hosting their shared/global memories list and two memory
 *     setting switches.
 *   - **Agent**   — tenant agents table (autocomplete filter) + a per-agent
 *     popup hosting the same `ManageMemories` editor the Edit Agent modal's
 *     own Memory tab renders (journey 24 covers that surface directly;
 *     unaffected by this change).
 *
 * DIALOG STACKING (see the SDK helpers' own file header for the canonical
 * explanation): the tenant settings dialog hosts the Memory tab; opening a
 * user/agent popup stacks a SECOND dialog on top of it; add/edit/delete
 * stack a THIRD on top of the popup. All popup-scoped helpers below require
 * the popup `Locator` returned by `openUserMemoriesPopup` /
 * `openAgentMemoriesPopup` so their queries stay pinned to the correct
 * layer — never re-derive a popup locator from a bare page-wide query.
 *
 * MEMSEARCH GATING: `switchToTenantMemoryTab` gates its own completion on
 * the Global sub-tab trigger rendering, which only happens once the
 * tenant's memsearch status check resolves. If memsearch is disabled or the
 * check errors on a given tenant, that gate can time out. `tryOpen()` below
 * treats that as an unavailable-feature signal (returns `null`) rather than
 * letting the timeout fail the caller — journeys should `test.skip` on
 * `null`. This journey does not itself flip the tenant-wide Memory System
 * toggle (see journey 38, `38-tenant-memory-system-toggle.spec.ts`) — it
 * only reads/adapts to whatever state that toggle is already in.
 */
export class MemoryAdminPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // ---------------------------------------------------------------------------
  // Opening / closing the tenant settings dialog
  // ---------------------------------------------------------------------------

  /**
   * Open the tenant "User Profile" dialog via More Options → platform name.
   * Does not select any particular rail tab — mirrors (and is the third
   * in-repo copy of) the pattern in journey 38's `openAdvancedTab` and
   * `ChatPrivacyPage.openTenantAdvancedTab`; not extracted into a shared
   * util here since those two call sites are already-passing code this
   * task doesn't otherwise touch. The platform name is read from
   * `localStorage.current_tenant.platform_name` so this works on any tenant.
   */
  async openTenantSettingsDialog(): Promise<Locator> {
    const profileBtn = this.page.getByRole('button', { name: 'More options' });
    await expect(profileBtn).toBeVisible({ timeout: 15_000 });
    await profileBtn.click();

    const menu = this.page.getByRole('menu', { name: 'More options' });
    await expect(menu).toBeVisible({ timeout: 5_000 });

    const platformName = await this.page.evaluate(() => {
      const raw = window.localStorage.getItem('current_tenant');
      if (!raw) return null;
      try {
        return JSON.parse(raw)?.platform_name ?? null;
      } catch {
        return null;
      }
    });
    if (!platformName) {
      throw new Error(
        'Could not retrieve platform_name from localStorage — cannot open tenant settings',
      );
    }

    const tenantMenuItem = menu.getByText(platformName, { exact: true });
    await expect(tenantMenuItem).toBeVisible({ timeout: 5_000 });
    await tenantMenuItem.click();

    const dialog = this.page.getByRole('dialog', { name: 'User Profile' });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    return dialog;
  }

  /**
   * Open the tenant settings dialog and switch to the Memory admin tab.
   * Returns `null` — instead of throwing — when the "Memory" rail item
   * isn't rendered (non-admin viewer, via `isTenantMemoryTabVisible`) OR
   * `switchToTenantMemoryTab` never resolves (memsearch gate — see the
   * class doc comment). Callers should `test.skip(!result, ...)` on a
   * `null` return rather than fail. The dialog is closed before returning
   * `null` so the caller starts clean.
   */
  async tryOpen(): Promise<Locator | null> {
    const dialog = await this.openTenantSettingsDialog();

    const railVisible = await isTenantMemoryTabVisible(this.page);
    if (!railVisible) {
      await this.close(dialog).catch(() => {});
      return null;
    }

    try {
      await switchToTenantMemoryTab(this.page);
    } catch {
      await this.close(dialog).catch(() => {});
      return null;
    }

    return dialog;
  }

  /** Close the tenant settings dialog via its Close button, or Escape as a fallback. */
  async close(dialog: Locator): Promise<void> {
    const closeBtn = dialog.getByRole('button', { name: /close/i }).last();
    let visible = false;
    try {
      await closeBtn.waitFor({ state: 'visible', timeout: 5_000 });
      visible = true;
    } catch {
      visible = false;
    }
    if (visible) {
      await closeBtn.click();
    } else {
      await this.page.keyboard.press('Escape');
    }
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });
  }

  // ---------------------------------------------------------------------------
  // Sub-tabs
  // ---------------------------------------------------------------------------

  switchToSubTab(subTab: MemoryAdminSubTab): Promise<void> {
    return switchToMemoryAdminSubTab(this.page, subTab);
  }

  globalSection(): Locator {
    return memoryAdminGlobalSection(this.page);
  }

  agentSection(): Locator {
    return memoryAdminAgentSection(this.page);
  }

  // ---------------------------------------------------------------------------
  // Global sub-tab
  // ---------------------------------------------------------------------------

  userRow(username: string): Locator {
    return memoryAdminUserRow(this.page, username);
  }

  /** Search the users table; gates on `expectedUsername`'s row appearing. Pass ≥3 chars. */
  searchUsers(term: string, expectedUsername: string): Promise<void> {
    return searchMemoryAdminUsers(this.page, term, expectedUsername);
  }

  /** Open a user's memories popup. Pass the returned Locator to every helper below. */
  openUserPopup(username: string): Promise<Locator> {
    return openUserMemoriesPopup(this.page, username);
  }

  closeUserPopup(): Promise<void> {
    return closeUserMemoriesPopup(this.page);
  }

  /** A memory row inside an open popup, found by (part of) its content. */
  memoryRow(popup: Locator, content: string): Locator {
    return memoryRowByContent(popup, content);
  }

  /**
   * Add a global memory for the popup's user (content must be ≥10
   * characters).
   *
   * Implemented app-side instead of delegating to the SDK's
   * `addUserGlobalMemory`: global-memory writes re-embed content
   * server-side, and were observed live (staging) both running well past
   * the SDK helper's single 15s dialog-close wait and failing transiently
   * — either way the dialog stays open with only an error toast, and the
   * SDK helper (as of 2.5.9) has no retry. Until an SDK build ships one,
   * the save-with-retry lives here. Locators mirror the SDK helper's own
   * hooks (`data-testid` + dialog accessible names) so the two stay
   * interchangeable.
   */
  async addGlobalMemory(popup: Locator, content: string): Promise<void> {
    const addButton = popup.getByTestId('user-memories-add');
    await expect(addButton).toBeVisible({ timeout: 10_000 });
    await addButton.click();

    const dialog = this.page
      .getByRole('dialog', { name: 'Add Memory', exact: true })
      .last();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.locator('#memory-content').fill(content);
    await this.submitMemoryDialog(dialog);

    await expect(this.memoryRow(popup, content)).toBeVisible({
      timeout: 15_000,
    });
  }

  /**
   * Edit a global memory found by its current content. App-side for the
   * same reason as `addGlobalMemory` — see its doc comment.
   */
  async editGlobalMemory(
    popup: Locator,
    currentContent: string,
    newContent: string,
  ): Promise<void> {
    const row = this.memoryRow(popup, currentContent);
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole('button', { name: /^Memory actions:/ }).click();
    // The menu portals to <body>; only one dropdown is ever open at once.
    const editItem = this.page.getByRole('menuitem', {
      name: 'Edit',
      exact: true,
    });
    await expect(editItem).toBeVisible({ timeout: 10_000 });
    await editItem.click();

    const dialog = this.page
      .getByRole('dialog', { name: 'Edit Memory', exact: true })
      .last();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.locator('#edit-memory-content').fill(newContent);
    await this.submitMemoryDialog(dialog);

    await expect(this.memoryRow(popup, newContent)).toBeVisible({
      timeout: 15_000,
    });
  }

  /**
   * Click a memory dialog's "Save Memory" button and wait for the dialog
   * to close, retrying the click on failure. A failed save leaves the
   * dialog OPEN (error toast only) with the form still filled, so
   * re-clicking Save is a clean retry; a save that lands late (after a
   * wait gave up but before the next attempt) is detected by the dialog
   * having closed on its own. The 30s per-attempt wait absorbs slow
   * embedding round-trips and the dialog's close animation.
   */
  private async submitMemoryDialog(dialog: Locator): Promise<void> {
    const saveButton = dialog.getByRole('button', {
      name: 'Save Memory',
      exact: true,
    });
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (!(await dialog.isVisible().catch(() => false))) return;
      // Disabled while a save is in flight; settles on success (close) or
      // failure (re-enabled for another try).
      await expect(saveButton).toBeEnabled({ timeout: 10_000 });
      await saveButton.click();
      try {
        await expect(dialog).toBeHidden({ timeout: 30_000 });
        return;
      } catch (error) {
        if (attempt === maxAttempts) throw error;
      }
    }
  }

  /** Delete a global memory found by its content. */
  deleteGlobalMemory(popup: Locator, content: string): Promise<void> {
    return deleteUserGlobalMemory(this.page, popup, content);
  }

  /**
   * Toggle one of the popup user's memory setting switches
   * (`'autoCapture' | 'useMemory'`) and return the new checked state.
   */
  toggleSetting(popup: Locator, setting: MemoryAdminSetting): Promise<boolean> {
    return toggleUserMemoryAdminSetting(this.page, popup, setting);
  }

  // ---------------------------------------------------------------------------
  // Agent sub-tab
  // ---------------------------------------------------------------------------

  agentRow(mentorUniqueId: string): Locator {
    return memoryAdminAgentRow(this.page, mentorUniqueId);
  }

  /**
   * The first row of the (unfiltered) agents table. Row testids embed the
   * mentor unique_id (`memory-admin-agent-row-<unique_id>`) and the first
   * cell holds the display name, so a caller can resolve an EXISTING,
   * already-search-indexed mentor to drive the autocomplete with — see
   * MA-06's comment for why filtering for a freshly created mentor is
   * inherently flaky.
   */
  firstAgentRow(): Locator {
    return this.agentSection()
      .locator('[data-testid^="memory-admin-agent-row-"]')
      .first();
  }

  /** Filter the agents table via the autocomplete (types the name, picks the matching option). */
  filterAgents(agentName: string): Promise<void> {
    return filterAgentMemories(this.page, agentName);
  }

  clearAgentsFilter(): Promise<void> {
    return clearAgentMemoriesFilter(this.page);
  }

  /** Open an agent's memories popup. Pass the returned Locator to `addAgentMemory`. */
  openAgentPopup(mentorUniqueId: string): Promise<Locator> {
    return openAgentMemoriesPopup(this.page, mentorUniqueId);
  }

  closeAgentPopup(): Promise<void> {
    return closeAgentMemoriesPopup(this.page);
  }

  /** Add an agent memory through the popup's `ManageMemories` editor. */
  addAgentMemory(
    popup: Locator,
    content: string,
    categoryName?: string,
  ): Promise<void> {
    return addAgentMemoryFromPopup(this.page, popup, content, categoryName);
  }
}

// Re-export SDK constants/types so journey specs can import them from this
// one location, mirroring `LtiTab`'s and `VoiceTab`'s re-export convention.
export { MEMORY_ADMIN_LABELS };
export type { MemoryAdminSubTab, MemoryAdminSetting };
