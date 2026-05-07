import { Page, Locator, expect } from '@playwright/test';

export class MemoryTab {
  readonly page: Page;
  readonly dialog: Locator;

  readonly addMemoryButton: Locator;
  readonly manageCategoriesButton: Locator;
  readonly emptyState: Locator;
  // Each memory entry has an unnamed icon button (MoreHorizontal) as its action trigger.
  // We use these as a proxy for the memory entry count.
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
    this.addMemoryButton = dialog
      .locator('button')
      .filter({ hasText: /add memory/i });
    this.manageCategoriesButton = dialog.getByRole('button', {
      name: 'Manage categories',
    });
    this.emptyState = dialog.getByText('No saved memories yet.');
    // The per-memory action button is an unnamed icon-only button (MoreHorizontal).
    // It lives inside each memory entry card alongside the memory content text.
    // We identify it as buttons inside the memory list that have no accessible name.
    this.memoryActionButtons = dialog
      .locator('.space-y-3 button:not([aria-label]):not([name])')
      .or(dialog.locator('button[class*="ghost"][class*="h-6"]'));
  }

  async hasMemories(): Promise<boolean> {
    const empty = await this.emptyState
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    return !empty;
  }

  /**
   * Creates a new memory via the Add Memory button + dialog.
   * @param content - The memory content text.
   * @param category - Optional category to select from the dropdown.
   */
  async createMemory(content: string, category?: string): Promise<void> {
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
  }

  /**
   * Locator for a memory entry card containing the given content. Use this
   * (not "first") when tests run in parallel — multiple specs may be
   * adding/removing entries concurrently, so positional selectors race.
   */
  entryByContent(content: string): Locator {
    return this.dialog.locator('.space-y-3 > div').filter({ hasText: content });
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
      .locator('button:not([aria-label]):not([name])')
      .or(entry.locator('button[class*="ghost"][class*="h-6"]'))
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

    await expect(this.page.getByText(/Memory updated/i).first()).toBeVisible({
      timeout: 10_000,
    });
  }

  /**
   * Deletes a memory entry identified by its content. Prefer this over
   * deleteFirst for parallel-safe tests.
   */
  async deleteByContent(content: string): Promise<void> {
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

    await expect(this.page.getByText(/Memory updated/i).first()).toBeVisible({
      timeout: 10_000,
    });
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
    // Memory content is rendered inside a div with text-sm class within the entry card
    const firstEntry = this.dialog
      .locator('.space-y-3 > div')
      .first()
      .locator('.text-sm.leading-relaxed');
    return (await firstEntry.textContent().catch(() => '')) ?? '';
  }
}
