import { Page, Locator, expect } from "@playwright/test";

export class MemoryTab {
  readonly page: Page;
  readonly dialog: Locator;

  readonly enableMemoryToggle: Locator;
  readonly addMemoryButton: Locator;
  readonly emptyState: Locator;
  readonly loadingState: Locator;
  readonly userFilter: Locator;
  readonly dateRangeButton: Locator;
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
    this.enableMemoryToggle = dialog
      .getByText("Enable Memory")
      .locator("..")
      .locator("..")
      .getByRole("switch");
    this.addMemoryButton = dialog
      .locator("button")
      .filter({ hasText: /add memory/i });
    this.emptyState = dialog.getByText("No saved memories yet.");
    this.loadingState = dialog.getByText("Loading memories...");
    this.userFilter = dialog
      .locator("button")
      .filter({ hasText: /search for user/i });
    this.dateRangeButton = dialog
      .locator("button")
      .filter({ hasText: /pick a date range/i });
    // The per-memory action button is an unnamed icon-only button (MoreHorizontal).
    // It lives inside each memory entry card alongside the memory content text.
    // We identify it as buttons inside the memory list that have no accessible name.
    this.memoryActionButtons = dialog
      .locator(".space-y-3 button:not([aria-label]):not([name])")
      .or(dialog.locator('button[class*="ghost"][class*="h-6"]'));
  }

  /**
   * Wait for the memory list to finish loading (no loading spinner visible).
   */
  private async waitForLoaded(): Promise<void> {
    await expect(this.loadingState).not.toBeVisible({ timeout: 15_000 });
  }

  async isMemoryEnabled(): Promise<boolean> {
    return (
      (await this.enableMemoryToggle
        .getAttribute("aria-checked")
        .catch(() => "false")) === "true"
    );
  }

  async toggleMemory(): Promise<void> {
    await expect(this.enableMemoryToggle).toBeVisible({ timeout: 10_000 });
    const wasEnabled = await this.isMemoryEnabled();
    await this.enableMemoryToggle.click();
    const expectedToast = wasEnabled ? "Memory disabled" : "Memory enabled";
    await expect(this.page.getByText(expectedToast)).toBeVisible({
      timeout: 10_000,
    });
  }

  /**
   * @deprecated Use isMemoryEnabled() instead.
   */
  async isReferenceEnabled(): Promise<boolean> {
    return this.isMemoryEnabled();
  }

  /**
   * @deprecated Use toggleMemory() instead.
   */
  async toggleReference(): Promise<void> {
    return this.toggleMemory();
  }

  async hasMemories(): Promise<boolean> {
    await this.waitForLoaded();
    const empty = await this.emptyState
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    return !empty;
  }

  /**
   * Get the count of visible memory entries.
   * Waits for loading to complete before counting.
   */
  async getMemoryCount(): Promise<number> {
    await this.waitForLoaded();
    return this.memoryActionButtons.count().catch(() => 0);
  }

  /**
   * Verify the "Enable Memory" toggle and label are visible.
   */
  async verifyEnableMemorySection(): Promise<void> {
    await expect(this.dialog.getByText("Enable Memory")).toBeVisible({
      timeout: 10_000,
    });
    await expect(this.enableMemoryToggle).toBeVisible({ timeout: 5_000 });
  }

  /**
   * Verify the manage memories section with filters and add button.
   */
  async verifyManageMemoriesSection(): Promise<void> {
    await expect(this.addMemoryButton).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Add a new memory entry via the Add Memory dialog.
   */
  async addMemory(content: string): Promise<void> {
    await expect(this.addMemoryButton).toBeVisible({ timeout: 10_000 });
    await this.addMemoryButton.click();

    const addDialog = this.page
      .getByRole("dialog")
      .filter({ hasText: "Add Memory" });
    await expect(addDialog).toBeVisible({ timeout: 5_000 });

    const textarea = addDialog.locator("textarea");
    await textarea.fill(content);

    const saveButton = addDialog.getByRole("button", { name: /save/i });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    await expect(
      this.page.getByText("Memory created successfully"),
    ).toBeVisible({ timeout: 10_000 });

    // Wait for the dialog to close and the list to refresh
    await expect(addDialog).not.toBeVisible({ timeout: 5_000 });
    await this.waitForLoaded();
  }

  /**
   * Edit the first memory entry via its action menu.
   */
  async editFirst(newContent: string): Promise<void> {
    await this.waitForLoaded();
    const firstActionBtn = this.memoryActionButtons.first();
    await expect(firstActionBtn).toBeVisible({ timeout: 10_000 });
    await firstActionBtn.click();

    const editMenuItem = this.page
      .getByRole("menuitem", { name: /edit/i })
      .last();
    await expect(editMenuItem).toBeVisible({ timeout: 5_000 });
    await editMenuItem.click();

    const editDialog = this.page
      .getByRole("dialog")
      .filter({ hasText: /edit memory/i });
    await expect(editDialog).toBeVisible({ timeout: 5_000 });

    const textarea = editDialog.locator("textarea");
    await textarea.clear();
    await textarea.fill(newContent);

    const saveButton = editDialog.getByRole("button", { name: /save/i });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    await expect(
      this.page.getByText("Memory updated successfully"),
    ).toBeVisible({ timeout: 10_000 });

    // Wait for the dialog to close and the list to refresh
    await expect(editDialog).not.toBeVisible({ timeout: 5_000 });
    await this.waitForLoaded();
  }

  /**
   * Deletes the first memory entry by clicking its action menu (MoreHorizontal)
   * and selecting "Delete" from the dropdown, then confirming.
   */
  async deleteFirst(): Promise<void> {
    await this.waitForLoaded();
    const firstActionBtn = this.memoryActionButtons.first();
    await expect(firstActionBtn).toBeVisible({ timeout: 10_000 });
    await firstActionBtn.click();

    const deleteMenuItem = this.page
      .getByRole("menuitem", { name: /delete/i })
      .last();
    await expect(deleteMenuItem).toBeVisible({ timeout: 5_000 });
    await deleteMenuItem.click();

    // Handle confirmation dialog
    const confirmDialog = this.page
      .getByRole("dialog")
      .filter({ hasText: /delete/i })
      .last();
    const confirmVisible = await confirmDialog
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    if (confirmVisible) {
      await confirmDialog
        .getByRole("button", { name: /delete/i })
        .last()
        .click();
    }

    await expect(
      this.page.getByText("Memory deleted successfully"),
    ).toBeVisible({ timeout: 10_000 });

    // Wait for the list to refresh after deletion
    await this.waitForLoaded();
  }

  /**
   * Select a category tab in the manage memories section.
   */
  async selectCategory(categoryName: string): Promise<void> {
    const categoryButton = this.dialog
      .locator("button")
      .filter({ hasText: new RegExp(`^${categoryName}$`) });
    await categoryButton.click();
    await this.waitForLoaded();
  }
}
