import { Page, Locator, expect } from '@playwright/test';

/**
 * Page object for the Safety tab (Policies) inside the Edit Agent modal.
 *
 * The four cards render in this order: Moderation Prompt, Safety Prompt,
 * Moderation Response, Safety Response, each with its own "Edit" button that
 * opens an `Edit <label>` dialog holding a rich text box. Saving PUTs the
 * settings but leaves that dialog open, so `setResponse` closes it.
 */
export class SafetyTab {
  readonly page: Page;
  readonly dialog: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
  }

  private editButton(index: number): Locator {
    return this.dialog
      .getByRole('button', { name: 'Edit', exact: true })
      .nth(index);
  }

  private responseRegion(label: string): Locator {
    return this.dialog.getByRole('region', { name: label });
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
    await this.editButton(index).click();
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
    await expect(this.responseRegion('Moderation response content')).toHaveText(
      text,
      { timeout: 20_000 },
    );
  }

  async expectSafetyResponse(text: string): Promise<void> {
    await expect(this.responseRegion('Safety response content')).toHaveText(
      text,
      { timeout: 20_000 },
    );
  }
}
