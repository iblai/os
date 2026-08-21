import { Page, Locator, expect } from '@playwright/test';
import {
  isMemoryTabVisible,
  switchToMemoryTab,
  verifyMemoryTabSettings,
  verifyMemoryTabMemoriesList,
  openAddMemoryDialog,
  toggleMemorySwitch,
  addMemory,
  deleteFirstMemory,
  deleteMemoryByContent,
  getMemoryCount,
  verifyMemoryExists,
  verifyMemoryNotExists,
} from '@iblai/iblai-js/playwright';

export class ProfilePage {
  readonly page: Page;

  readonly modal: Locator;
  readonly closeButton: Locator;
  readonly tabNav: Locator;
  readonly tabs: Locator;

  // Basic tab
  readonly fullNameField: Locator;
  readonly emailField: Locator;
  readonly titleField: Locator;
  readonly aboutField: Locator;
  readonly languageSelector: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  // Social tab
  readonly linkedInField: Locator;
  readonly twitterField: Locator;
  readonly facebookField: Locator;

  // Education tab
  readonly addEducationButton: Locator;

  // Experience tab
  readonly addExperienceButton: Locator;

  // Resume tab
  readonly uploadResumeButton: Locator;

  // Security tab
  readonly sendPasswordResetButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = page.getByRole('dialog', { name: /profile/i });
    this.closeButton = this.modal.getByRole('button', {
      name: 'Close',
      exact: true,
    });
    this.tabNav = this.modal.getByRole('navigation', { name: /profile tabs/i });
    this.tabs = this.tabNav.getByRole('tablist');

    this.fullNameField = this.modal
      .getByLabel(/full name/i)
      .or(this.modal.getByPlaceholder(/full name/i));
    this.emailField = this.modal
      .getByLabel(/email/i)
      .or(this.modal.getByPlaceholder(/email/i));
    this.titleField = this.modal
      .getByLabel(/title/i)
      .or(this.modal.getByPlaceholder(/title/i));
    this.aboutField = this.modal
      .getByLabel(/about/i)
      .or(this.modal.locator('textarea[name*="about"]'));
    this.languageSelector = this.modal.getByRole('combobox', {
      name: /language/i,
    });
    this.saveButton = this.modal.getByRole('button', { name: /save/i }).first();
    this.cancelButton = this.modal.getByRole('button', { name: /cancel/i });

    this.linkedInField = this.modal
      .getByRole('textbox', { name: 'LinkedIn' })
      .or(this.modal.getByPlaceholder(/linkedin/i));
    this.twitterField = this.modal
      .getByRole('textbox', { name: 'X' })
      .or(this.modal.getByPlaceholder('X'));
    this.facebookField = this.modal
      .getByRole('textbox', { name: 'Facebook' })
      .or(this.modal.getByPlaceholder('Facebook'));

    this.addEducationButton = this.modal
      .getByRole('button', {
        name: /add education/i,
      })
      .first();
    this.addExperienceButton = this.modal
      .getByRole('button', {
        name: /add experience/i,
      })
      .first();
    this.uploadResumeButton = this.modal
      .getByRole('button', {
        name: 'Upload resume',
        exact: true,
      })
      .filter({ hasText: 'Upload resume' });
    this.sendPasswordResetButton = this.modal.getByRole('button', {
      name: /send password reset/i,
    });
  }

  async open(): Promise<void> {
    const profileDropdown = this.page.getByRole('button', {
      name: 'More options',
    });
    await expect(profileDropdown).toBeVisible({ timeout: 10_000 });
    await profileDropdown.click();
    const profileItem = this.page.getByRole('menuitem', { name: /profile/i });
    await expect(profileItem).toBeVisible({ timeout: 5_000 });
    await profileItem.click();
    await expect(this.modal).toBeVisible({ timeout: 15_000 });
  }

  async close(): Promise<void> {
    await expect(this.closeButton).toBeVisible({ timeout: 5_000 });
    await this.closeButton.click();
    await expect(this.modal).not.toBeVisible({ timeout: 10_000 });
  }

  async switchToTab(tabName: string): Promise<void> {
    const tab = this.tabNav
      .getByRole('tab', { name: new RegExp(tabName, 'i') })
      .first();
    await expect(tab).toBeVisible({ timeout: 5_000 });
    await tab.click();
    await this.page.waitForTimeout(300);
  }

  activeTab(tabName: string): Locator {
    return this.tabNav.getByRole('tab', {
      name: new RegExp(tabName, 'i'),
      selected: true,
    });
  }

  async switchToSubTab(subTabName: string): Promise<void> {
    const subTab = this.modal
      .getByRole('tabpanel')
      .getByRole('tab', { name: new RegExp(`^${subTabName}$`, 'i') })
      .first();
    await expect(subTab).toBeVisible({ timeout: 5_000 });
    await subTab.click();
    await this.page.waitForTimeout(300);
  }

  async save(): Promise<void> {
    await expect(this.saveButton).toBeEnabled({ timeout: 5_000 });
    await this.saveButton.click();
    await expect(this.page.getByText(/saved|success/i)).toBeVisible({
      timeout: 10_000,
    });
  }

  async openAddEducationDialog(): Promise<Locator> {
    await expect(this.addEducationButton).toBeVisible({ timeout: 10_000 });
    await this.addEducationButton.click();
    const dialog = this.page
      .getByRole('dialog')
      .filter({ hasText: /education/i })
      .last();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    return dialog;
  }

  async openAddExperienceDialog(): Promise<Locator> {
    await expect(this.addExperienceButton).toBeVisible({ timeout: 10_000 });
    await this.addExperienceButton.click();
    const dialog = this.page
      .getByRole('dialog')
      .filter({ hasText: /experience/i })
      .last();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    return dialog;
  }

  // ---------------------------------------------------------------------------
  // Memory tab ("My Memories" — personal profile side)
  // ---------------------------------------------------------------------------
  //
  // Rendered by the SDK's `MemoryTab` (`@iblai/iblai-js/web-containers/next`)
  // — the host wires it in unconditionally (`enableMemoryTab={true}` in
  // `app/platform/[tenantKey]/[mentorId]/_components/nav-bar/user-profile.tsx`).
  // All DOM access below flows through the SDK's official Playwright helpers
  // (`@iblai/iblai-js/playwright`, `memory-test-helpers.d.ts`) EXCEPT
  // `editMemoryByContent`, which the SDK has no helper for (only add/delete
  // are covered) — see its own doc comment for the gap and the hand-rolled
  // selectors used to fill it, all stable aria/testid hooks.

  /** Whether the "Memory" tab exists and is visible in the profile modal. */
  isMemoryTabVisible(): Promise<boolean> {
    return isMemoryTabVisible(this.page);
  }

  /** Switch to the "Memory" tab. Assumes the profile modal is open and the tab is visible. */
  switchToMemoryTab(): Promise<void> {
    return switchToMemoryTab(this.page);
  }

  /** Assert the "Memory & Personalization" settings section (both switches) is visible. */
  verifyMemoryTabSettings(): Promise<void> {
    return verifyMemoryTabSettings(this.page);
  }

  /** Assert the "My Memories" section (list + Add Memory button) is visible. */
  verifyMemoryTabMemoriesList(): Promise<void> {
    return verifyMemoryTabMemoriesList(this.page);
  }

  /** Open the Add Memory dialog. Assumes the Memory tab is active. */
  openAddMemoryDialog(): Promise<Locator> {
    return openAddMemoryDialog(this.page);
  }

  /**
   * Toggle a memory setting switch (match by its accessible-name prefix,
   * e.g. `/^Auto memory capture/i` or `/^Use memory in responses/i` — the
   * full name carries the current state suffix). Returns the new checked
   * state; gated on `aria-checked` flipping.
   */
  toggleMemorySwitch(switchName: RegExp | string): Promise<boolean> {
    return toggleMemorySwitch(this.page, switchName);
  }

  /** Add a memory via the Add Memory dialog (content must be ≥10 characters). */
  addMemory(content: string): Promise<void> {
    return addMemory(this.page, content);
  }

  /** Delete the first visible memory via its three-dots menu + confirm dialog. */
  deleteFirstMemory(): Promise<void> {
    return deleteFirstMemory(this.page);
  }

  /** Delete a memory matched by content via its three-dots menu + confirm dialog. */
  deleteMemoryByContent(content: string): Promise<void> {
    return deleteMemoryByContent(this.page, content);
  }

  /** Count of visible memory rows (0 when the empty state is shown). */
  getMemoryCount(): Promise<number> {
    return getMemoryCount(this.page);
  }

  verifyMemoryExists(content: string): Promise<void> {
    return verifyMemoryExists(this.page, content);
  }

  verifyMemoryNotExists(content: string): Promise<void> {
    return verifyMemoryNotExists(this.page, content);
  }

  /**
   * Edit a memory found by its current content via the three-dots menu →
   * Edit → Edit Memory dialog → Save.
   *
   * GAP: the SDK's `memory-test-helpers.d.ts` covers add/delete for the
   * profile Memory tab but has no edit helper (only the tenant-admin
   * popup's `editUserGlobalMemory` exists, in `memory-admin-helpers.d.ts`).
   * Both surfaces render the exact same `MemoriesList` component though
   * (confirmed in the SDK bundle: "Shared by the profile Memory tab and the
   * tenant-settings memory popup so the two stay identical"), so this
   * reimplements the same three-dots → Edit → dialog flow using the same
   * stable hooks `deleteMemoryByContent` uses for its own menu step:
   *   - row: `data-testid="memory-row"` filtered by `currentContent`
   *   - three-dots trigger: `aria-label` prefix "Memory actions:" (the SDK's
   *     `MEMORY_ADMIN_LABELS.menu.actionsAriaPrefix` — shared translation key)
   *   - menu portals to `<body>`; only one dropdown is ever open at once, so
   *     an unscoped `getByRole('menuitem', { name: 'Edit', exact: true })`
   *     is safe (mirrors the SDK's own `deleteMemoryRow` internal helper)
   *   - the Edit Memory dialog has accessible name "Edit Memory" (Radix
   *     wires `DialogTitle` → `aria-labelledby`) and a real `<Textarea>`
   *     labelled "Memory Content" (`id="edit-memory-content"`, not a
   *     ProseMirror contenteditable) — `getByLabel` resolves it directly.
   */
  async editMemoryByContent(
    currentContent: string,
    newContent: string,
  ): Promise<void> {
    const row = this.modal
      .getByTestId('memory-row')
      .filter({ hasText: currentContent });
    await expect(row).toBeVisible({ timeout: 10_000 });

    const trigger = row.getByRole('button', { name: /^Memory actions:/ });
    await trigger.click();

    const editItem = this.page.getByRole('menuitem', {
      name: 'Edit',
      exact: true,
    });
    await expect(editItem).toBeVisible({ timeout: 5_000 });
    await editItem.click();

    const editDialog = this.page.getByRole('dialog', {
      name: 'Edit Memory',
      exact: true,
    });
    await expect(editDialog).toBeVisible({ timeout: 10_000 });

    const textarea = editDialog.getByLabel('Memory Content');
    await expect(textarea).toBeVisible({ timeout: 5_000 });
    await textarea.fill(newContent);

    const saveButton = editDialog.getByRole('button', {
      name: 'Save Memory',
      exact: true,
    });
    await expect(saveButton).toBeEnabled({ timeout: 5_000 });
    await saveButton.click();

    await expect(editDialog).toBeHidden({ timeout: 10_000 });
  }
}
