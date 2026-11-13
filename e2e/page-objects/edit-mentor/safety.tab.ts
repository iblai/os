import { Page, Locator, expect } from '@playwright/test';

export type FlaggedFilter = 'Moderation' | 'Safety';
export type SafetyPromptKind = 'Moderation' | 'Safety';

/**
 * Page object for the Safety tab of the Edit Agent modal and the "Flagged
 * Prompts" dialog its "View Flagged Prompts" button opens.
 *
 * The four cards render in this order: Moderation Prompt, Safety Prompt,
 * Moderation Response, Safety Response, each with an "Edit" button opening an
 * `Edit <label>` dialog that stays open after a save.
 *
 * Flagged rows have no test ids; they are found by their prompt text, which
 * the specs make unique per run.
 */
export class SafetyTab {
  readonly page: Page;
  readonly dialog: Locator;

  readonly viewFlaggedPromptsButton: Locator;
  readonly flaggedDialog: Locator;
  readonly flaggedTotal: Locator;
  readonly filterSelect: Locator;
  readonly emptyState: Locator;
  readonly detailDeleteButton: Locator;
  readonly deleteConfirmDialog: Locator;
  readonly deleteConfirmButton: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.viewFlaggedPromptsButton = dialog.getByRole('button', {
      name: 'View Flagged Prompts',
    });
    this.flaggedDialog = page
      .getByRole('dialog')
      .filter({ has: page.getByRole('heading', { name: 'Flagged Prompts' }) });
    this.flaggedTotal = this.flaggedDialog.getByText(/Total Flagged Prompts/);
    this.filterSelect = this.flaggedDialog.getByRole('combobox').first();
    this.emptyState = this.flaggedDialog.getByText('No flagged prompts found');
    this.detailDeleteButton = this.flaggedDialog.getByRole('button', {
      name: 'Delete',
      exact: true,
    });
    this.deleteConfirmDialog = page.getByRole('alertdialog');
    this.deleteConfirmButton = this.deleteConfirmDialog.getByRole('button', {
      name: 'Delete',
      exact: true,
    });
  }

  private promptSwitch(kind: SafetyPromptKind): Locator {
    return this.dialog.getByRole('switch', {
      name: new RegExp(`^${kind} prompt (enabled|disabled)$`, 'i'),
    });
  }

  /** Turns the Moderation / Safety switch on or off and waits for the save. */
  async setEnabled(kind: SafetyPromptKind, on: boolean): Promise<void> {
    const sw = this.promptSwitch(kind);
    await expect(sw).toBeVisible({ timeout: 15_000 });
    await expect(sw).toBeEnabled({ timeout: 15_000 });
    if (((await sw.getAttribute('aria-checked')) === 'true') === on) return;
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', String(on), {
      timeout: 30_000,
    });
    await expect(sw).toBeEnabled({ timeout: 30_000 });
  }

  /** Replaces the Moderation / Safety prompt through its Edit dialog. */
  async setPrompt(kind: SafetyPromptKind, text: string): Promise<void> {
    const card = this.dialog
      .getByRole('heading', { name: `${kind} Prompt`, exact: true })
      .locator('xpath=ancestor::div[3]');
    await card.getByRole('button', { name: 'Edit', exact: true }).click();
    const editor = this.page.getByRole('dialog', {
      name: `Edit ${kind} Prompt`,
      exact: true,
    });
    const box = editor.getByRole('textbox').first().locator('div');
    await expect(box).toBeVisible({ timeout: 10_000 });
    await box.clear();
    await box.fill(text);
    await editor.getByRole('button', { name: 'Save', exact: true }).click();
    // The editor stays open after a save; the success toast confirms it.
    await expect(
      this.page.getByText(/agent updated successfully/i).first(),
    ).toBeVisible({ timeout: 30_000 });
    await editor
      .getByRole('button', { name: 'Close', exact: true })
      .first()
      .click();
    await expect(editor).toBeHidden({ timeout: 15_000 });
    await expect(
      this.dialog.getByRole('region', {
        name: `${kind} prompt content`,
        exact: true,
      }),
    ).toContainText(text.slice(0, 30), { timeout: 30_000 });
  }

  /** Replaces the saved Moderation Response (editor index 2) and saves it. */
  async setModerationResponse(text: string): Promise<void> {
    await this.setResponse(2, 'Moderation Response', text);
  }

  /** Replaces the saved Safety Response (editor index 3) and saves it. */
  async setSafetyResponse(text: string): Promise<void> {
    await this.setResponse(3, 'Safety Response', text);
  }

  private async setResponse(
    index: number,
    label: string,
    text: string,
  ): Promise<void> {
    await this.dialog
      .getByRole('button', { name: 'Edit', exact: true })
      .nth(index)
      .click();
    const editDialog = this.page.getByRole('dialog', {
      name: `Edit ${label}`,
      exact: true,
    });
    await expect(editDialog).toBeVisible({ timeout: 15_000 });
    const editor = editDialog.locator('[contenteditable="true"]').last();
    await expect(editor).toBeVisible();
    await editor.click();
    await this.page.keyboard.press(
      process.platform === 'darwin' ? 'Meta+A' : 'Control+A',
    );
    await this.page.keyboard.press('Delete');
    await this.page.keyboard.type(text);

    const save = editDialog.getByRole('button', { name: /^save$/i }).first();
    await expect(save).toBeEnabled();
    const saved = this.page.waitForResponse(
      (res) =>
        res.request().method() === 'PUT' &&
        /\/mentors\/[^/]+\/settings\//.test(res.url()),
      { timeout: 30_000 },
    );
    await save.click();
    expect((await saved).ok()).toBe(true);
    await editDialog.getByRole('button', { name: 'Close' }).first().click();
    await expect(editDialog).toBeHidden();
  }

  async expectModerationResponse(text: string): Promise<void> {
    await expect(
      this.dialog.getByRole('region', { name: 'Moderation response content' }),
    ).toHaveText(text, { timeout: 20_000 });
  }

  async expectSafetyResponse(text: string): Promise<void> {
    await expect(
      this.dialog.getByRole('region', { name: 'Safety response content' }),
    ).toHaveText(text, { timeout: 20_000 });
  }

  async openFlaggedPrompts(): Promise<void> {
    await expect(this.viewFlaggedPromptsButton).toBeVisible({
      timeout: 15_000,
    });
    await this.viewFlaggedPromptsButton.click();
    await expect(this.flaggedDialog).toBeVisible({ timeout: 15_000 });
    await expect(this.flaggedTotal).toBeVisible({ timeout: 30_000 });
  }

  async closeFlaggedPrompts(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await expect(this.flaggedDialog).toBeHidden({ timeout: 10_000 });
  }

  /** A list row, found by (part of) its prompt text. */
  row(promptText: string | RegExp): Locator {
    return this.flaggedDialog
      .locator('div.cursor-pointer')
      .filter({ hasText: promptText });
  }

  /** The "N Total Flagged Prompts" number. */
  async total(): Promise<number> {
    const text = (await this.flaggedTotal.textContent()) ?? '';
    return Number(text.match(/(\d+)/)?.[1] ?? NaN);
  }

  async goToPage(n: number): Promise<void> {
    await this.flaggedDialog
      .locator('nav')
      .getByText(String(n), { exact: true })
      .click();
  }

  async setFilter(filter: FlaggedFilter): Promise<void> {
    await this.filterSelect.click();
    await this.page.getByRole('option', { name: filter, exact: true }).click();
    await expect(this.filterSelect).toContainText(filter);
  }

  /** Opens the type select, returns its option names, and closes it again. */
  async filterOptions(): Promise<string[]> {
    await this.filterSelect.click();
    const options = this.page.getByRole('option');
    await expect(options.first()).toBeVisible({ timeout: 10_000 });
    const names = (await options.allTextContents()).map((n) => n.trim());
    await this.page.keyboard.press('Escape');
    await expect(options.first()).toBeHidden({ timeout: 10_000 });
    return names;
  }

  /** Visible rows' prompt lines, top to bottom. */
  async visiblePromptLines(): Promise<string[]> {
    return this.flaggedDialog
      .locator('div.cursor-pointer p.line-clamp-1')
      .allTextContents();
  }

  /** Opens a row's detail panel and deletes it through the confirm dialog. */
  async deleteRow(promptText: string | RegExp): Promise<void> {
    await this.row(promptText).first().click();
    await this.detailDeleteButton.click();
    await expect(this.deleteConfirmDialog).toBeVisible({ timeout: 10_000 });
    await this.deleteConfirmButton.click();
  }
}
