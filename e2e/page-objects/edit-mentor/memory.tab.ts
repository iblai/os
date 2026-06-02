import { Page, Locator, expect } from '@playwright/test';

export class MemoryTab {
  readonly page: Page;
  readonly dialog: Locator;

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

  async hasMemories(): Promise<boolean> {
    const empty = await this.emptyState
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
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
    // Pre-settle the list so the dialog opens against a stable state and the
    // post-create assertion isn't racing an in-flight initial fetch.
    await this.waitForMemoriesSettled();
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
    // Pre-settle so the action menu we click stays attached through the click
    // (a mid-flight list refetch can detach the row's MoreHorizontal button).
    await this.waitForMemoriesSettled();
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
    // Pre-settle so the action menu we click stays attached through the click.
    await this.waitForMemoriesSettled();
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
    const confirmVisible = await confirmDialog
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
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
    const confirmVisible = await confirmDialog
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
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
    await expect(modal.getByText(name, { exact: true })).toBeVisible({
      timeout: 10_000,
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
    return this.categoriesDialog
      .getByText(name, { exact: true })
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
  }

  /**
   * Returns the text content of the first memory entry.
   */
  async getFirstMemoryContent(): Promise<string> {
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
}
