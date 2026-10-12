import { Page, Locator, expect } from '@playwright/test';
import { isVisibleWithin } from '../../utils/resilient';

const SHARED_MEMORY_PLACEHOLDER =
  'Write what this agent should always keep in mind...';

export type MemorySubTab = 'personal' | 'shared';

/**
 * The Memory tab is the SDK's `AgentMemoryTab`: a capability gate on top and
 * two sub-tabs below it — Personal Memories (per-person memories, categories)
 * and Shared Memories (memories shared with everyone who chats with the agent).
 * Radix unmounts the inactive sub-tab, so every helper below that touches
 * one sub-tab's content switches to it first.
 */
export class MemoryTab {
  readonly page: Page;
  readonly dialog: Locator;

  /**
   * "Long-term Memory" (`enable_memory_component`) master toggle. Used to
   * live in Settings → Capabilities and gate the whole tab's visibility; it
   * now lives inline at the top of this tab via the shared `CapabilityGate`
   * component, and the Memory tab is always mounted
   * (`hooks/use-mentor-segments.ts` no longer gates it). Toggling auto-saves
   * (the SDK's `useMemoryCapability` PATCHes `enable_memory_component` with
   * optimistic local state) — no footer Save button involved.
   */
  readonly capabilityToggle: Locator;
  /** Wrapper around the gated memory-management content — `data-enabled` mirrors the toggle. */
  readonly capabilityContent: Locator;
  /** Hint shown next to the description while the capability is off. */
  readonly capabilityOffHint: Locator;
  /** Sub-tab strip under the gate: "Personal Memories" (default) and "Shared Memories". */
  readonly subTabs: Locator;
  readonly personalSubTab: Locator;
  readonly sharedSubTab: Locator;
  readonly sharedMemorySection: Locator;
  readonly sharedMemoryAddButton: Locator;
  readonly sharedMemoryList: Locator;
  readonly sharedMemoryEmptyState: Locator;
  readonly sharedMemoryEmptyTitle: Locator;
  readonly addMemoryButton: Locator;
  readonly manageCategoriesButton: Locator;
  readonly emptyState: Locator;
  readonly memoryList: Locator;
  // Per-entry action menu trigger (the MoreHorizontal icon button). Resolves
  // to one Locator per memory card and is also used as a proxy for entry count.
  readonly memoryActionButtons: Locator;

  /**
   * @deprecated Use memoryActionButtons for counting entries.
   * Kept for backward compat; resolves to same locator.
   */
  get deleteButtons(): Locator {
    return this.memoryActionButtons;
  }

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.capabilityToggle = dialog.getByTestId('memory-capability-toggle');
    this.capabilityContent = dialog.locator(
      '[data-testid="capability-gate-content"]:visible',
    );
    this.capabilityOffHint = dialog.locator(
      '[data-testid="capability-gate-off-hint"]:visible',
    );
    this.subTabs = dialog.getByTestId('memory-sub-tabs');
    this.personalSubTab = dialog.getByTestId('memory-sub-tab-personal');
    this.sharedSubTab = dialog.getByTestId('memory-sub-tab-shared');
    this.sharedMemorySection = dialog.getByTestId('shared-memory-section');
    // Same "Add Memory" copy as the Personal Memories sub-tab; scoped to the
    // section so it never matches the personal button.
    this.sharedMemoryAddButton = this.sharedMemorySection.getByRole('button', {
      name: 'Add Memory',
      exact: true,
    });
    this.sharedMemoryList = this.sharedMemorySection.getByRole('list', {
      name: 'Shared memories',
      exact: true,
    });
    this.sharedMemoryEmptyState = this.sharedMemorySection.getByTestId(
      'shared-memory-empty',
    );
    this.sharedMemoryEmptyTitle = this.sharedMemorySection.getByRole(
      'heading',
      {
        name: 'No Shared Memories Yet',
      },
    );
    this.addMemoryButton = dialog.getByRole('button', { name: /add memory/i });
    this.manageCategoriesButton = dialog.getByRole('button', {
      name: 'Manage categories',
    });
    this.emptyState = dialog.getByText('No saved memories yet.');
    // The memory list container has role="list" + aria-label="Saved memories"
    // on the underlying div in ManageMemories. Scoping listitem lookups to
    // this list prevents collisions with any other list semantics inside the
    // Edit Mentor dialog.
    this.memoryList = dialog.getByRole('list', { name: 'Saved memories' });
    // Per-memory MoreHorizontal action trigger. The DropdownMenuTrigger's
    // <Button> in ManageMemories has aria-label="Memory actions" — locate by
    // role + accessible name (no class-based or test-id selectors).
    this.memoryActionButtons = this.memoryList.getByRole('button', {
      name: 'Memory actions',
    });
  }

  // ── Capability gate ───────────────────────────────────────────────────────

  /** Whether the "Long-term Memory" capability toggle is currently on. */
  async isCapabilityEnabled(): Promise<boolean> {
    const attr = await this.capabilityToggle
      .getAttribute('aria-checked')
      .catch(() => null);
    return attr === 'true';
  }

  /**
   * Idempotently set the "Long-term Memory" capability toggle to
   * the target state. Auto-saves on click (optimistic local state) — no
   * footer Save button involved. Waits for both the toggle's `aria-checked`
   * and the gated content's `data-enabled` attribute to reflect the target
   * state.
   */
  async setCapabilityEnabled(target: boolean): Promise<void> {
    await expect(this.capabilityToggle).toBeVisible({ timeout: 10_000 });
    const isOn = await this.isCapabilityEnabled();
    if (isOn === target) return;

    await this.capabilityToggle.click();
    await expect(this.capabilityToggle).toHaveAttribute(
      'aria-checked',
      String(target),
      { timeout: 15_000 },
    );
    await expect(this.capabilityContent).toHaveAttribute(
      'data-enabled',
      String(target),
      { timeout: 15_000 },
    );
  }

  /**
   * Activates a sub-tab and waits for its content to settle. A no-op click
   * when it is already active. Both triggers live inside the capability gate,
   * which is inert while the toggle is off, so callers must have
   * `setCapabilityEnabled(true)` first.
   */
  async switchToSubTab(name: MemorySubTab): Promise<void> {
    const trigger = name === 'shared' ? this.sharedSubTab : this.personalSubTab;
    await expect(trigger).toBeVisible({ timeout: 15_000 });
    if ((await trigger.getAttribute('aria-selected')) !== 'true') {
      await trigger.click();
    }
    await expect(trigger).toHaveAttribute('aria-selected', 'true', {
      timeout: 10_000,
    });

    if (name === 'shared') {
      await expect(this.sharedMemorySection).toBeVisible({ timeout: 10_000 });
      await this.waitForSharedMemoriesSettled();
    } else {
      // The list wrapper stays in the DOM while empty (zero height, so not
      // "visible") — attached is the right readiness signal.
      await expect(this.memoryList).toBeAttached({ timeout: 10_000 });
      await this.waitForMemoriesSettled();
    }
  }

  async hasMemories(): Promise<boolean> {
    await this.switchToSubTab('personal');
    const empty = await isVisibleWithin(this.emptyState, 5_000);
    return !empty;
  }

  /**
   * Waits for the "Loading memories..." placeholder to disappear, signalling
   * that any in-flight memory list fetch (initial load, category switch, or
   * post-mutation refetch) has settled. No-op when the placeholder is absent.
   */
  async waitForMemoriesSettled(timeout = 15_000): Promise<void> {
    await this.dialog
      .getByText('Loading memories...')
      .waitFor({ state: 'hidden', timeout })
      .catch(() => undefined);
  }

  /**
   * Creates a new memory via the Add Memory button + dialog.
   * @param content - The memory content text.
   * @param category - Optional category to select from the dropdown.
   */
  async createMemory(content: string, category?: string): Promise<void> {
    // Switching also pre-settles the list so the dialog opens against a stable
    // state and the post-create assertion isn't racing an in-flight fetch.
    await this.switchToSubTab('personal');
    await expect(this.addMemoryButton).toBeVisible({ timeout: 10_000 });
    await this.addMemoryButton.click();

    const addDialog = this.page
      .getByRole('dialog')
      .filter({ hasText: /add memory/i })
      .last();
    await expect(addDialog).toBeVisible({ timeout: 10_000 });

    // Always pick a concrete category — the modal pre-fills the current
    // filter (often "All"), which gets filtered out of the dropdown and
    // falls back to a non-existent slug server-side. Picking a stable
    // server-seeded option keeps the create request valid even when the
    // categories list still contains stale entries from a sibling test
    // (e.g. an "E2E Cat …" leftover whose slug 404s).
    const selectTrigger = addDialog.getByRole('combobox').first();
    await selectTrigger.click();
    let option = category
      ? this.page.getByRole('option', { name: category, exact: true })
      : this.page
          .getByRole('option')
          .filter({ hasNotText: /^E2E /i })
          .filter({ hasNotText: /^All$/i })
          .first();
    try {
      await option.waitFor({ state: 'visible', timeout: 3_000 });
    } catch {
      // Fall back to whatever option is available — the test can still proceed
      // even if no "stable" category exists in this tenant's seed data.
      option = this.page.getByRole('option').first();
    }
    await expect(option).toBeVisible({ timeout: 5_000 });
    await option.click();

    const textarea = addDialog.locator('textarea');
    await textarea.fill(content);

    const saveButton = addDialog.getByRole('button', { name: /save/i });
    await expect(saveButton).toBeEnabled({ timeout: 5_000 });
    await saveButton.click();

    // Treat either the success toast or the dialog closing as success — Sonner
    // toasts can disappear before the assertion polls, so dialog-hidden is the
    // most reliable signal that the create mutation completed. Surface the
    // error toast explicitly so a 4xx from a stale category slug is obvious.
    const successToast = this.page.getByText(/Memory created/i).first();
    const errorToast = this.page.getByText(/Failed to create memory/i).first();
    const completed = await Promise.race([
      successToast
        .waitFor({ state: 'visible', timeout: 30_000 })
        .then(() => 'success' as const)
        .catch(() => 'timeout' as const),
      addDialog
        .waitFor({ state: 'hidden', timeout: 30_000 })
        .then(() => 'success' as const)
        .catch(() => 'timeout' as const),
      errorToast
        .waitFor({ state: 'visible', timeout: 30_000 })
        .then(() => 'error' as const)
        .catch(() => 'timeout' as const),
    ]);
    if (completed === 'error') {
      throw new Error(
        'createMemory failed: backend rejected the request (saw "Failed to create memory" toast)',
      );
    }
    if (completed === 'timeout') {
      throw new Error(
        'createMemory timed out: no success toast, no error toast, dialog still open',
      );
    }

    // After a successful create the UI switches the active category tab to the
    // one the new memory was placed in. Reset it back to "All" so that
    // entryByContent() can find the new card in the unfiltered list regardless
    // of which category slug was selected during the create flow.
    await this.resetCategoryFilter();

    // Wait for the new entry to actually appear in the list. The create
    // mutation invalidates the Memories tag → triggers a refetch → re-renders
    // the list. In slower CI runs this round-trip can outlast the caller's
    // 10s assertion window. Polling here (auto-retry until visible) means
    // callers can rely on the entry being present once createMemory resolves,
    // instead of racing the cache invalidation themselves.
    await expect(this.entryByContent(content).first()).toBeVisible({
      timeout: 30_000,
    });
  }

  /**
   * Locator for a memory entry card containing the given content. Use this
   * (not "first") when tests run in parallel — multiple specs may be
   * adding/removing entries concurrently, so positional selectors race.
   *
   * Each entry has role="listitem" inside the list with
   * aria-label="Saved memories", so we resolve via ARIA semantics — no
   * class-based or test-id selectors. Works regardless of the active
   * category-filter tab (the "All" view must be active for a freshly-created
   * entry to appear; callers should reset to "All" before asserting).
   */
  entryByContent(content: string): Locator {
    return this.memoryList.getByRole('listitem').filter({ hasText: content });
  }

  /**
   * Clicks the "All" category tab so that all memory entries are visible
   * regardless of which category was last active. Should be called after
   * createMemory / editByContent to ensure the assertion list is unfiltered.
   *
   * After clicking "All", waits for the loading spinner text to disappear so
   * the caller can immediately assert on the list contents.
   */
  async resetCategoryFilter(): Promise<void> {
    await this.switchToSubTab('personal');
    // The category bar uses role="tablist" / role="tab" with the category
    // names as accessible text. Scope to the tablist labelled
    // "Memory categories" so we never match a tab from a different region.
    const allTab = this.dialog
      .getByRole('tablist', { name: 'Memory categories' })
      .getByRole('tab', { name: 'All', exact: true });
    // Categories are fetched alongside the memory list and may not be in the
    // DOM the instant the dialog mounts. 15s gives the admin-categories query
    // time to populate without blocking forever on tenants where the tab
    // genuinely isn't rendered.
    const tabExists = await allTab
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    if (tabExists) {
      await allTab.click();
      await this.waitForMemoriesSettled();
    }
  }

  /**
   * Returns true if a memory entry with the given content becomes visible
   * within `timeout` ms. Uses waitFor (auto-retry) — `Locator.isVisible()`
   * does not actually wait, so it would race with RTK Query refetches that
   * fire after create/update mutations.
   */
  async hasMemoryWithContent(
    content: string,
    timeout = 10_000,
  ): Promise<boolean> {
    await this.switchToSubTab('personal');
    return this.entryByContent(content)
      .first()
      .waitFor({ state: 'visible', timeout })
      .then(() => true)
      .catch(() => false);
  }

  /**
   * Opens the action menu (MoreHorizontal) for the entry whose content
   * matches `content`. Throws if no such entry is visible.
   */
  private async openActionMenuForContent(content: string): Promise<void> {
    const entry = this.entryByContent(content).first();
    await expect(entry).toBeVisible({ timeout: 10_000 });
    const actionBtn = entry
      .getByRole('button', { name: 'Memory actions' })
      .first();
    await expect(actionBtn).toBeVisible({ timeout: 10_000 });
    await actionBtn.click();
  }

  /**
   * Edits a memory entry identified by its current content. Prefer this over
   * editFirst for parallel-safe tests.
   */
  async editByContent(
    currentContent: string,
    newContent: string,
  ): Promise<void> {
    // Switching also pre-settles so the action menu we click stays attached
    // through the click (a mid-flight list refetch can detach the row's
    // MoreHorizontal button).
    await this.switchToSubTab('personal');
    await this.openActionMenuForContent(currentContent);

    const editMenuItem = this.page
      .getByRole('menuitem', { name: /edit/i })
      .last();
    await expect(editMenuItem).toBeVisible({ timeout: 5_000 });
    await editMenuItem.click();

    const editDialog = this.page
      .getByRole('dialog')
      .filter({ hasText: /edit memory/i })
      .last();
    await expect(editDialog).toBeVisible({ timeout: 10_000 });

    const textarea = editDialog.locator('textarea');
    await textarea.clear();
    await textarea.fill(newContent);

    const saveButton = editDialog.getByRole('button', { name: /save/i });
    await expect(saveButton).toBeEnabled({ timeout: 5_000 });
    await saveButton.click();

    // Sonner toasts auto-dismiss after ~4s and are racy in slower CI runs —
    // mirror createMemory's race pattern: any of (success toast, dialog
    // hidden, error toast) settles the assertion. Dialog-hidden is the
    // durable post-state and the most reliable signal once `editMemory`
    // resolves.
    const successToast = this.page.getByText(/Memory updated/i).first();
    const errorToast = this.page.getByText(/Failed to update memory/i).first();
    const completed = await Promise.race([
      successToast
        .waitFor({ state: 'visible', timeout: 30_000 })
        .then(() => 'success' as const)
        .catch(() => 'timeout' as const),
      editDialog
        .waitFor({ state: 'hidden', timeout: 30_000 })
        .then(() => 'success' as const)
        .catch(() => 'timeout' as const),
      errorToast
        .waitFor({ state: 'visible', timeout: 30_000 })
        .then(() => 'error' as const)
        .catch(() => 'timeout' as const),
    ]);
    if (completed === 'error') {
      throw new Error(
        'editByContent failed: backend rejected the request (saw "Failed to update memory" toast)',
      );
    }
    if (completed === 'timeout') {
      throw new Error(
        'editByContent timed out: no success toast, no error toast, dialog still open',
      );
    }

    // Symmetric with createMemory: if the edit changed the entry's category,
    // the component auto-switches the active tab. Reset to "All" so the
    // caller's post-edit entryByContent assertions don't race a filtered view.
    await this.resetCategoryFilter();

    // Wait for the updated entry to appear in the list. The update mutation
    // invalidates the Memories tag → triggers a refetch — in slower CI
    // runners this round-trip can outlast a caller's 10s assertion window.
    // Polling here keeps the page-object contract self-contained.
    await expect(this.entryByContent(newContent).first()).toBeVisible({
      timeout: 30_000,
    });
  }

  /**
   * Deletes a memory entry identified by its content. Prefer this over
   * deleteFirst for parallel-safe tests.
   */
  async deleteByContent(content: string): Promise<void> {
    // Switching also pre-settles so the action menu we click stays attached
    // through the click.
    await this.switchToSubTab('personal');
    await this.openActionMenuForContent(content);

    const deleteMenuItem = this.page
      .getByRole('menuitem', { name: /delete/i })
      .last();
    await expect(deleteMenuItem).toBeVisible({ timeout: 5_000 });
    await deleteMenuItem.click();

    const confirmDialog = this.page
      .getByRole('dialog')
      .filter({ hasText: /delete|confirm/i })
      .last();
    const confirmVisible = await isVisibleWithin(confirmDialog, 3_000);
    if (confirmVisible) {
      await confirmDialog
        .getByRole('button', { name: /delete|confirm/i })
        .last()
        .click();
    }

    await expect(this.entryByContent(content).first()).toHaveCount(0, {
      timeout: 10_000,
    });
  }

  /**
   * Edits the first memory entry by clicking its action menu and selecting "Edit".
   * @param newContent - The updated memory content.
   * @deprecated Positional — races with parallel tests. Use editByContent.
   */
  async editFirst(newContent: string): Promise<void> {
    await this.switchToSubTab('personal');
    const firstActionBtn = this.memoryActionButtons.first();
    await expect(firstActionBtn).toBeVisible({ timeout: 10_000 });
    await firstActionBtn.click();

    const editMenuItem = this.page
      .getByRole('menuitem', { name: /edit/i })
      .last();
    await expect(editMenuItem).toBeVisible({ timeout: 5_000 });
    await editMenuItem.click();

    const editDialog = this.page
      .getByRole('dialog')
      .filter({ hasText: /edit memory/i })
      .last();
    await expect(editDialog).toBeVisible({ timeout: 10_000 });

    const textarea = editDialog.locator('textarea');
    await textarea.clear();
    await textarea.fill(newContent);

    const saveButton = editDialog.getByRole('button', { name: /save/i });
    await expect(saveButton).toBeEnabled({ timeout: 5_000 });
    await saveButton.click();

    // Race the (transient) "Memory updated" toast against the durable
    // dialog-hidden post-state, like createMemory / editByContent above.
    const successToast = this.page.getByText(/Memory updated/i).first();
    await Promise.race([
      successToast
        .waitFor({ state: 'visible', timeout: 30_000 })
        .catch(() => undefined),
      editDialog
        .waitFor({ state: 'hidden', timeout: 30_000 })
        .catch(() => undefined),
    ]);
  }

  /**
   * Deletes the first memory entry by clicking its action menu (MoreHorizontal)
   * and selecting "Delete" from the dropdown, then confirming if a dialog appears.
   * @deprecated Positional — races with parallel tests. Use deleteByContent.
   */
  async deleteFirst(): Promise<void> {
    await this.switchToSubTab('personal');
    // Click the MoreHorizontal icon button for the first memory entry.
    const firstActionBtn = this.memoryActionButtons.first();
    await expect(firstActionBtn).toBeVisible({ timeout: 10_000 });
    await firstActionBtn.click();

    // Wait for the dropdown menu to appear and click "Delete".
    const deleteMenuItem = this.page
      .getByRole('menuitem', { name: /delete/i })
      .last();
    await expect(deleteMenuItem).toBeVisible({ timeout: 5_000 });
    await deleteMenuItem.click();

    // Handle optional confirmation dialog.
    const confirmDialog = this.page
      .getByRole('dialog')
      .filter({ hasText: /delete|confirm/i })
      .last();
    const confirmVisible = await isVisibleWithin(confirmDialog, 3_000);
    if (confirmVisible) {
      await confirmDialog
        .getByRole('button', { name: /delete|confirm/i })
        .last()
        .click();
    }
  }

  /**
   * Returns the number of visible memory entries.
   */
  async getMemoryCount(): Promise<number> {
    await this.switchToSubTab('personal');
    return this.memoryActionButtons.count().catch(() => 0);
  }

  /**
   * Locator for the Manage Categories dialog, scoped by its heading.
   */
  get categoriesDialog(): Locator {
    return this.page
      .getByRole('dialog')
      .filter({ hasText: 'Manage Categories' });
  }

  /**
   * Opens the Manage Categories modal from the memory tab.
   */
  async openManageCategories(): Promise<void> {
    await this.switchToSubTab('personal');
    await expect(this.manageCategoriesButton).toBeVisible({ timeout: 10_000 });
    await this.manageCategoriesButton.click();
    await expect(this.categoriesDialog).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Closes the Manage Categories modal via the Done button.
   */
  async closeManageCategories(): Promise<void> {
    await this.categoriesDialog.getByRole('button', { name: 'Done' }).click();
    await expect(this.categoriesDialog).not.toBeVisible({ timeout: 10_000 });
  }

  /**
   * Creates a new category inside the Manage Categories modal.
   * Assumes the modal is already open.
   */
  async createCategory(name: string): Promise<void> {
    const modal = this.categoriesDialog;
    const input = modal.getByPlaceholder('New category name');
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill(name);
    await modal.getByRole('button', { name: /^add$/i }).click();
    await expect(this.page.getByText('Category created')).toBeVisible({
      timeout: 10_000,
    });
    // The "Category created" toast confirms the POST succeeded, but the
    // category list only repaints once RTK Query invalidates and refetches —
    // which can take well over 10s under CI load. Wait generously for the
    // new name to render so callers don't flake on the refetch.
    await expect(modal.getByText(name, { exact: true })).toBeVisible({
      timeout: 30_000,
    });
  }

  /**
   * Renames an existing category in the Manage Categories modal.
   * Assumes the modal is already open and the category is in the list.
   */
  async renameCategory(oldName: string, newName: string): Promise<void> {
    const modal = this.categoriesDialog;
    await modal.getByRole('button', { name: `Edit ${oldName}` }).click();
    // Edit row injects a second <input> (first is the "new category" input).
    const editInput = modal.locator('input').nth(1);
    await expect(editInput).toBeVisible({ timeout: 5_000 });
    await editInput.fill(newName);
    await modal.getByRole('button', { name: 'Save category' }).click();
    await expect(this.page.getByText('Category updated')).toBeVisible({
      timeout: 10_000,
    });
    await expect(modal.getByText(newName, { exact: true })).toBeVisible({
      timeout: 10_000,
    });
  }

  /**
   * Deletes a category from the Manage Categories modal.
   * Handles the inline confirmation step. Assumes the modal is already open.
   */
  async deleteCategory(name: string): Promise<void> {
    const modal = this.categoriesDialog;
    await modal.getByRole('button', { name: `Delete ${name}` }).click();
    // Inline confirm shows a destructive Delete button in the same row.
    const confirmButton = modal
      .getByRole('button', { name: /^delete$/i })
      .last();
    await expect(confirmButton).toBeVisible({ timeout: 5_000 });
    await confirmButton.click();
    await expect(this.page.getByText('Category deleted')).toBeVisible({
      timeout: 10_000,
    });
    await expect(modal.getByText(name, { exact: true })).not.toBeVisible({
      timeout: 10_000,
    });
  }

  /**
   * Checks whether a category with the given name is visible in the
   * Manage Categories modal. Assumes the modal is already open.
   */
  async hasCategory(name: string): Promise<boolean> {
    return isVisibleWithin(
      this.categoriesDialog.getByText(name, { exact: true }),
      3_000,
    );
  }

  /**
   * Returns the text content of the first memory entry.
   */
  async getFirstMemoryContent(): Promise<string> {
    await this.switchToSubTab('personal');
    // The memory content is the only <p> inside each role="listitem" entry
    // (metadata renders as <span>s). Targeting via the paragraph element
    // keeps this stable when Tailwind classes change.
    const firstEntry = this.memoryList
      .getByRole('listitem')
      .first()
      .locator('p')
      .first();
    return (await firstEntry.textContent().catch(() => '')) ?? '';
  }

  // ── Shared Memories sub-tab ───────────────────────────────────────────────

  get sharedMemoryAddDialog(): Locator {
    return this.page.getByRole('dialog', {
      name: 'Add Memory',
      exact: true,
    });
  }

  get sharedMemoryEditDialog(): Locator {
    return this.page.getByRole('dialog', {
      name: 'Edit Memory',
      exact: true,
    });
  }

  get sharedMemoryDeleteDialog(): Locator {
    return this.page.getByRole('dialog', {
      name: 'Delete Memory',
      exact: true,
    });
  }

  /**
   * Waits for the "Loading shared memories..." placeholder to disappear, signalling
   * that the initial fetch (or a page change) has settled. No-op when absent.
   */
  async waitForSharedMemoriesSettled(timeout = 15_000): Promise<void> {
    await this.sharedMemorySection
      .getByText('Loading shared memories...')
      .waitFor({ state: 'hidden', timeout })
      .catch(() => undefined);
  }

  /**
   * Locator for the shared memory entry whose text contains `content`. Entries are
   * `role="listitem"` rows inside the list labelled "Shared memories".
   */
  sharedMemoryEntryByContent(content: string): Locator {
    return this.sharedMemoryList
      .getByRole('listitem')
      .filter({ hasText: content });
  }

  sharedMemoryContentInput(dialog: Locator): Locator {
    return dialog.getByPlaceholder(SHARED_MEMORY_PLACEHOLDER);
  }

  sharedMemorySaveButton(dialog: Locator): Locator {
    return dialog.getByRole('button', { name: 'Save', exact: true });
  }

  /** Opens the Add Memory dialog (Shared Memories sub-tab) and returns it. */
  async openSharedMemoryAddDialog(): Promise<Locator> {
    await this.switchToSubTab('shared');
    await expect(this.sharedMemoryAddButton).toBeVisible({ timeout: 15_000 });
    await this.sharedMemoryAddButton.click();
    const dialog = this.sharedMemoryAddDialog;
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    return dialog;
  }

  async cancelSharedMemoryDialog(dialog: Locator): Promise<void> {
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });
  }

  /**
   * Waits for a shared memory dialog to close after Save / Delete. The dialog only
   * closes on success; a rejection leaves it open with an inline alert (add /
   * edit) or raises an error toast, so those are raced to fail fast with a
   * readable message instead of burning the full hidden timeout.
   */
  private async waitForSharedMemoryDialogToClose(
    dialog: Locator,
    action: string,
  ): Promise<void> {
    const outcome = await Promise.race([
      dialog
        .waitFor({ state: 'hidden', timeout: 30_000 })
        .then(() => 'closed' as const)
        .catch(() => 'timeout' as const),
      dialog
        .getByRole('alert')
        .waitFor({ state: 'visible', timeout: 30_000 })
        .then(() => 'rejected' as const)
        .catch(() => 'timeout' as const),
      this.page
        .getByText(/Couldn.t (save|delete) shared memory/i)
        .first()
        .waitFor({ state: 'visible', timeout: 30_000 })
        .then(() => 'error' as const)
        .catch(() => 'timeout' as const),
    ]);
    if (outcome === 'rejected') {
      throw new Error(`${action} failed: the dialog showed an inline error`);
    }
    if (outcome === 'error') {
      throw new Error(
        `${action} failed: saw a "Couldn't ... shared memory" toast`,
      );
    }
    if (outcome === 'timeout') {
      throw new Error(`${action} timed out: the dialog never closed`);
    }
  }

  /**
   * Adds a shared memory through the Add Memory dialog (Shared Memories sub-tab) and waits for it
   * to show up in the list. `content` must be at least 10 characters (Save stays
   * disabled below that).
   */
  async addSharedMemory(content: string): Promise<void> {
    const dialog = await this.openSharedMemoryAddDialog();
    await this.sharedMemoryContentInput(dialog).fill(content);

    const saveButton = this.sharedMemorySaveButton(dialog);
    await expect(saveButton).toBeEnabled({ timeout: 5_000 });
    await saveButton.click();

    await this.waitForSharedMemoryDialogToClose(dialog, 'addSharedMemory');
    // The create mutation invalidates the list → refetch; poll until the new
    // entry renders so callers can rely on it once this resolves.
    await expect(this.sharedMemoryEntryByContent(content)).toBeVisible({
      timeout: 30_000,
    });
  }

  private async openSharedMemoryActionMenu(content: string): Promise<void> {
    await this.switchToSubTab('shared');
    const entry = this.sharedMemoryEntryByContent(content).first();
    await expect(entry).toBeVisible({ timeout: 10_000 });
    const actionButton = entry.getByRole('button', {
      name: 'Shared memory actions',
    });
    await expect(actionButton).toBeVisible({ timeout: 10_000 });
    await actionButton.click();
  }

  /** Edits the entry identified by its current text and waits for the new text. */
  async editSharedMemoryByContent(
    currentContent: string,
    newContent: string,
  ): Promise<void> {
    await this.openSharedMemoryActionMenu(currentContent);
    const editMenuItem = this.page.getByRole('menuitem', {
      name: 'Edit',
      exact: true,
    });
    await expect(editMenuItem).toBeVisible({ timeout: 5_000 });
    await editMenuItem.click();

    const dialog = this.sharedMemoryEditDialog;
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    const input = this.sharedMemoryContentInput(dialog);
    await expect(input).toHaveValue(currentContent, { timeout: 5_000 });
    await input.fill(newContent);

    const saveButton = this.sharedMemorySaveButton(dialog);
    await expect(saveButton).toBeEnabled({ timeout: 5_000 });
    await saveButton.click();

    await this.waitForSharedMemoryDialogToClose(
      dialog,
      'editSharedMemoryByContent',
    );
    await expect(this.sharedMemoryEntryByContent(newContent)).toBeVisible({
      timeout: 30_000,
    });
    await expect(this.sharedMemoryEntryByContent(currentContent)).toHaveCount(
      0,
      {
        timeout: 30_000,
      },
    );
  }

  /** Opens the "Delete Memory" confirmation for an entry and returns it. */
  async openSharedMemoryDeleteDialog(content: string): Promise<Locator> {
    await this.openSharedMemoryActionMenu(content);
    const deleteMenuItem = this.page.getByRole('menuitem', {
      name: 'Delete',
      exact: true,
    });
    await expect(deleteMenuItem).toBeVisible({ timeout: 5_000 });
    await deleteMenuItem.click();

    const dialog = this.sharedMemoryDeleteDialog;
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    return dialog;
  }

  /** Deletes an entry through its confirmation dialog and waits for it to leave the list. */
  async deleteSharedMemoryByContent(content: string): Promise<void> {
    const dialog = await this.openSharedMemoryDeleteDialog(content);
    const confirmButton = dialog.getByRole('button', {
      name: 'Delete',
      exact: true,
    });
    await expect(confirmButton).toBeEnabled({ timeout: 5_000 });
    await confirmButton.click();

    await this.waitForSharedMemoryDialogToClose(
      dialog,
      'deleteSharedMemoryByContent',
    );
    await expect(this.sharedMemoryEntryByContent(content)).toHaveCount(0, {
      timeout: 30_000,
    });
  }

  /**
   * Submits already-saved text through the Add Memory dialog (Shared Memories sub-tab) and asserts the
   * inline "already exists" message, then cancels. The server answers a repeat
   * with a conflict, so the dialog must stay open instead of closing.
   */
  async expectDuplicateError(content: string): Promise<void> {
    const dialog = await this.openSharedMemoryAddDialog();
    await this.sharedMemoryContentInput(dialog).fill(content);

    const saveButton = this.sharedMemorySaveButton(dialog);
    await expect(saveButton).toBeEnabled({ timeout: 5_000 });
    await saveButton.click();

    await expect(dialog.getByRole('alert')).toHaveText(
      'This shared memory already exists.',
      { timeout: 30_000 },
    );
    await expect(dialog).toBeVisible();
    await this.cancelSharedMemoryDialog(dialog);
  }
}
