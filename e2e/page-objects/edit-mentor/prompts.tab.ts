import { Page, Locator, expect } from '@playwright/test';

export class PromptsTab {
  readonly page: Page;
  readonly dialog: Locator;

  readonly systemPromptTextarea: Locator;
  readonly saveButton: Locator;
  readonly addNewPromptButton: Locator;
  readonly suggestedPromptsSection: Locator;
  readonly seeMoreButton: Locator;

  // ── Agent Configuration section (only visible when claw is enabled + wired) ──
  readonly agentConfigSection: Locator;
  readonly createAgentConfigButton: Locator;
  readonly noAgentConfigMessage: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.systemPromptTextarea = dialog
      .getByRole('textbox')
      .or(dialog.locator('textarea'))
      .first();
    this.saveButton = dialog.getByRole('button', { name: /save/i }).first();
    this.addNewPromptButton = dialog.getByRole('button', {
      name: 'Add New Prompt',
    });
    this.suggestedPromptsSection = dialog.getByRole('heading', {
      name: 'Suggested Prompts',
      exact: true,
    });
    this.seeMoreButton = dialog.getByRole('button', {
      name: /see more/i,
    });

    // Agent Configuration section
    this.agentConfigSection = dialog.getByRole('heading', {
      name: /agent configuration/i,
    });
    this.createAgentConfigButton = dialog.getByRole('button', {
      name: /create agent config/i,
    });
    this.noAgentConfigMessage = dialog.getByText(
      /no agent configuration exists for this mentor yet/i,
    );
  }

  async setSystemPrompt(content: string): Promise<void> {
    const textarea = this.page
      .getByRole('dialog', { name: 'Edit System Prompt', exact: true })
      .getByRole('textbox')
      .first()
      .locator('div');
    await expect(textarea).toBeVisible({ timeout: 10_000 });
    await textarea.clear();
    await textarea.fill(content);
    const saveButton = this.page
      .getByRole('dialog', { name: 'Edit System Prompt', exact: true })
      .getByRole('button', { name: 'Save', exact: true })
      .first();

    await expect(saveButton).toBeVisible({ timeout: 10_000 });
    await saveButton.click();
    await this.page.waitForTimeout(5000);

    const closeButton = this.page
      .getByRole('dialog', { name: 'Edit System Prompt', exact: true })
      .getByRole('button', { name: 'Close', exact: true })
      .first();

    await expect(closeButton).toBeVisible({ timeout: 10_000 });
    await closeButton.click();
  }

  /** Returns all Edit buttons in the Suggested Prompts area (after the 4 system prompt Edit buttons). */
  getSuggestedPromptEditButtons(): Locator {
    return this.dialog.getByRole('button', {
      name: /^Delete suggested prompt/,
    });
  }

  /** Returns all Delete buttons in the Suggested Prompts section. */
  getSuggestedPromptDeleteButtons(): Locator {
    return this.dialog.getByRole('button', {
      name: /^Delete suggested prompt/,
    });
  }

  /** Returns all Run buttons in the Suggested Prompts section. */
  getSuggestedPromptRunButtons(): Locator {
    return this.dialog.getByRole('button', {
      name: /^Run suggested prompt/,
    });
  }

  /** Clicks the Run button on the nth suggested prompt (0-indexed). */
  async runSuggestedPrompt(index = 0): Promise<void> {
    const runButton = this.getSuggestedPromptRunButtons().nth(index);
    await expect(runButton).toBeVisible({ timeout: 10_000 });
    await runButton.click();
  }

  /** Clicks the See More pagination button. */
  async loadMorePrompts(): Promise<void> {
    await expect(this.seeMoreButton).toBeVisible({ timeout: 10_000 });
    await this.seeMoreButton.click();
  }

  /** Returns the number of suggested prompts currently displayed. */
  async getSuggestedPromptCount(): Promise<number> {
    return this.getSuggestedPromptDeleteButtons().count();
  }

  /**
   * Opens the Add New Prompt dialog, fills in the form, and submits.
   * Waits for the dialog to close after submission.
   *
   * @param promptText - The text content of the prompt
   * @param options.visibility - Optional visibility label ("Anyone", "Students",
   *   or "Administrators"). Defaults to whatever the form pre-selects.
   */
  async addSuggestedPrompt(
    promptText: string,
    options: { visibility?: 'Anyone' | 'Students' | 'Administrators' } = {},
  ): Promise<void> {
    await expect(this.addNewPromptButton).toBeVisible({ timeout: 10_000 });
    await this.addNewPromptButton.click();

    const addDialog = this.page.getByRole('dialog', {
      name: 'Add New Prompt',
    });
    await expect(addDialog).toBeVisible({ timeout: 10_000 });

    // Select the first available category
    const categoryTrigger = addDialog.getByRole('combobox', {
      name: 'Select a category',
    });
    await expect(categoryTrigger).toBeVisible({ timeout: 5_000 });
    await categoryTrigger.click();
    const firstCategoryOption = this.page.getByRole('option').first();
    await expect(firstCategoryOption).toBeVisible({ timeout: 5_000 });
    await firstCategoryOption.click();

    // Optionally change the visibility
    if (options.visibility) {
      const visibilityTrigger = addDialog.getByRole('combobox', {
        name: 'Select visibility',
      });
      await expect(visibilityTrigger).toBeVisible({ timeout: 5_000 });
      await visibilityTrigger.click();
      const option = this.page
        .getByRole('option', { name: options.visibility, exact: true })
        .first();
      await expect(option).toBeVisible({ timeout: 5_000 });
      await option.click();
    }

    // Fill in the prompt text via the rich text editor
    const editor = addDialog.getByRole('textbox').first().locator('div');
    await expect(editor).toBeVisible({ timeout: 5_000 });
    await editor.fill(promptText);

    // Submit
    const submitButton = addDialog
      .getByRole('button', { name: /submit/i })
      .first();
    await expect(submitButton).toBeEnabled({ timeout: 5_000 });
    await submitButton.click();

    // Wait for the dialog to close
    await expect(addDialog).not.toBeVisible({ timeout: 10_000 });
  }

  /**
   * Opens the Edit modal for the nth suggested prompt (0-indexed),
   * clears the prompt text, types new content, and saves.
   */
  async editSuggestedPrompt(
    index: number,
    newPromptText: string,
  ): Promise<void> {
    // Suggested prompt Edit buttons come after the 4 system-prompt Edit buttons
    const editButton = this.dialog
      .getByRole('button', { name: 'Edit', exact: true })
      .nth(4 + index);
    await expect(editButton).toBeVisible({ timeout: 10_000 });
    await editButton.click();

    const editDialog = this.page.getByRole('dialog', {
      name: /edit suggested prompt/i,
    });
    await expect(editDialog).toBeVisible({ timeout: 10_000 });

    const editor = editDialog.getByRole('textbox').first().locator('div');
    await expect(editor).toBeVisible({ timeout: 5_000 });
    await editor.clear();
    await editor.fill(newPromptText);

    const saveBtn = editDialog.getByRole('button', { name: /save/i }).first();
    await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
    await saveBtn.click();

    await this.page.waitForTimeout(3_000);
  }

  /** Clicks the Delete button on the nth suggested prompt (0-indexed). */
  async deleteSuggestedPrompt(index = 0): Promise<void> {
    const deleteButton = this.getSuggestedPromptDeleteButtons().nth(index);
    await expect(deleteButton).toBeVisible({ timeout: 10_000 });
    await deleteButton.click();
  }

  async save(): Promise<void> {
    await expect(this.saveButton).toBeEnabled({ timeout: 5_000 });
    await this.saveButton.click();
  }

  // ── Agent Configuration helpers ────────────────────────────────────────────

  /**
   * Returns true when the Agent Configuration section heading is visible.
   */
  async hasAgentConfigSection(timeout = 5_000): Promise<boolean> {
    try {
      await this.agentConfigSection.waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Returns true when the "no agent config" message is shown (config not yet
   * created for this mentor).
   */
  async isAgentConfigEmpty(timeout = 5_000): Promise<boolean> {
    try {
      await this.noAgentConfigMessage.waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clicks the Create Agent Config button and waits for the workspace fields
   * to appear (i.e. the "no config" message disappears).
   */
  async createAgentConfig(): Promise<void> {
    await expect(this.createAgentConfigButton).toBeVisible({
      timeout: 10_000,
    });
    await this.createAgentConfigButton.click();
    // Wait for the "no agent configuration" message to disappear — that signals
    // the POST completed and the workspace field cards are now rendering.
    await expect(this.noAgentConfigMessage).not.toBeVisible({
      timeout: 20_000,
    });
  }

  /**
   * Returns the row/card locator for an agent config field by its label.
   *
   * AgentConfigPrompts in @iblai/web-containers exposes two stable
   * accessible markers per card:
   *   - a TooltipTrigger button with aria-label="More info about ${label}"
   *   - an "Edit" button next to it (plain text label)
   *
   * Anchor on the unique TooltipTrigger and walk up to the innermost
   * div that also contains the Edit button — that's the card. No
   * coupling to Tailwind class signatures.
   */
  agentConfigFieldRowByLabel(label: string): Locator {
    const tooltipBtn = this.dialog.getByRole('button', {
      name: `More info about ${label}`,
    });
    const editBtn = this.dialog.getByRole('button', { name: /^edit$/i });
    return this.dialog
      .locator('div')
      .filter({ has: tooltipBtn })
      .filter({ has: editBtn })
      .last();
  }

  /**
   * Returns the EditFieldModal locator for an agent config field by label.
   * The OverlayModal in @iblai/web-containers sets the dialog title to
   * `Edit ${label}` (e.g. "Edit Identity"). We match by accessible name
   * (DialogPrimitive.Title) so we don't accidentally match the parent Edit
   * Mentor dialog when its content contains the label text.
   */
  agentConfigEditDialog(label: string): Locator {
    return this.page.getByRole('dialog', {
      name: `Edit ${label}`,
      exact: true,
    });
  }

  /**
   * Opens the Edit modal for an agent config field identified by `label`,
   * replaces the editor content with `newValue`, and clicks Save.
   *
   * The editor is a RichTextEditor (TipTap/ProseMirror). The OUTER
   * `<div role="textbox">` wrapper is NOT contenteditable — Playwright's
   * `fill()` rejects it. The actual editable element is the inner
   * `[contenteditable="true"]` div, which ProseMirror's input plugins
   * listen to. Drive it via real keyboard events.
   *
   * Returns the original editor text so callers can restore it.
   */
  async editAgentConfigField(label: string, newValue: string): Promise<string> {
    const row = this.agentConfigFieldRowByLabel(label).first();
    await expect(row).toBeVisible();

    const editBtn = row.getByRole('button', { name: /^edit$/i }).first();
    await editBtn.click();

    const editDialog = this.agentConfigEditDialog(label);
    await expect(editDialog).toBeVisible();

    // Target the ProseMirror contenteditable directly — the role="textbox"
    // wrapper around it is not editable.
    const editor = editDialog.locator('[contenteditable="true"]').last();
    await expect(editor).toBeVisible();

    const original = (await editor.textContent()) ?? '';

    await editor.click();
    const selectAll = process.platform === 'darwin' ? 'Meta+A' : 'Control+A';
    await this.page.keyboard.press(selectAll);
    await this.page.keyboard.press('Delete');
    await this.page.keyboard.type(newValue);

    const saveBtn = editDialog.getByRole('button', { name: /^save$/i }).first();
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    await expect(editDialog).toBeHidden();

    return original;
  }
}
