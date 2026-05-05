import { Page, Locator, expect } from '@playwright/test';

/**
 * Page object for the Skills tab inside the Edit Mentor dialog.
 *
 * The Skills tab renders the AgentSkills component from @iblai/web-containers.
 * It is gated on both `enable_claw=true` AND a wired ClawMentorConfig, so the
 * tab may not appear in all environments.
 *
 * When not wired, the component renders a message:
 *   "Connect a sandbox instance in the Sandbox tab to manage skills."
 *
 * When wired, it lists platform-level skills with a Switch toggle per row.
 * When wired but no platform skills exist:
 *   "No skills available for this platform. Create one to get started."
 *
 * All locators are scoped to the parent `dialog` Locator so they cannot
 * accidentally match elements outside the Edit Mentor modal.
 */
export class SkillsTab {
  readonly page: Page;
  readonly dialog: Locator;

  readonly notConnectedMessage: Locator;
  readonly noSkillsMessage: Locator;
  readonly newSkillButton: Locator;

  // New skill dialog
  readonly newSkillDialog: Locator;
  readonly skillNameInput: Locator;
  readonly skillSlugInput: Locator;
  readonly skillDescriptionInput: Locator;
  readonly skillVersionInput: Locator;
  readonly skillInstructionInput: Locator;
  readonly saveSkillButton: Locator;
  readonly cancelSkillButton: Locator;

  // Edit skill dialog — same field ids with "edit-" prefix
  readonly editSkillDialog: Locator;
  readonly editSkillNameInput: Locator;
  readonly editSkillSlugInput: Locator;
  readonly editSkillDescriptionInput: Locator;
  readonly editSkillVersionInput: Locator;
  readonly editSkillInstructionInput: Locator;
  readonly saveEditSkillButton: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;

    this.notConnectedMessage = dialog.getByText(
      /connect a sandbox instance in the sandbox tab/i,
    );
    this.noSkillsMessage = dialog.getByText(
      /no skills available for this platform/i,
    );
    this.newSkillButton = dialog
      .getByRole('button', { name: /new skill/i })
      .first();

    // New skill dialog — rendered outside the Edit Mentor dialog via a Radix portal
    this.newSkillDialog = page
      .getByRole('dialog')
      .filter({ hasText: /new skill/i });
    this.skillNameInput = this.newSkillDialog.locator('[name="skill-name"]');
    this.skillSlugInput = this.newSkillDialog.locator('[name="skill-slug"]');
    this.skillDescriptionInput = this.newSkillDialog.locator(
      '[name="skill-description"]',
    );
    this.skillVersionInput = this.newSkillDialog.locator(
      '[name="skill-version"]',
    );
    this.skillInstructionInput = this.newSkillDialog.locator(
      '[name="skill-instruction"]',
    );
    this.saveSkillButton = this.newSkillDialog
      .getByRole('button', { name: /^(save|create)$/i })
      .first();
    this.cancelSkillButton = this.newSkillDialog.getByRole('button', {
      name: 'Cancel',
      exact: true,
    });

    // Edit skill dialog
    this.editSkillDialog = page
      .getByRole('dialog')
      .filter({ hasText: /edit skill/i });
    this.editSkillNameInput = this.editSkillDialog.locator(
      '[name="skill-name"]',
    );
    this.editSkillSlugInput = this.editSkillDialog.locator(
      '[name="skill-slug"]',
    );
    this.editSkillDescriptionInput = this.editSkillDialog.locator(
      '[name="skill-description"]',
    );
    this.editSkillVersionInput = this.editSkillDialog.locator(
      '[name="skill-version"]',
    );
    this.editSkillInstructionInput = this.editSkillDialog.locator(
      '[name="skill-instruction"]',
    );
    this.saveEditSkillButton = this.editSkillDialog
      .getByRole('button', { name: /^save$/i })
      .first();
  }

  // ── State detection ──────────────────────────────────────────────────────

  /**
   * Returns true when the "not connected" message is visible.
   * (Sandbox not yet wired to a Claw instance.)
   */
  async isNotConnected(timeout = 5_000): Promise<boolean> {
    try {
      await this.notConnectedMessage.waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Returns true when no platform-level skills exist.
   */
  async hasNoSkills(timeout = 5_000): Promise<boolean> {
    try {
      await this.noSkillsMessage.waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
  }

  // ── Skill row operations ─────────────────────────────────────────────────

  /**
   * Returns the row locator for a skill identified by `name`.
   * Uses `getByRole('row')` filtered by text rather than xpath.
   */
  getSkillRowByName(name: string): Locator {
    return this.dialog.getByRole('row').filter({ hasText: name }).first();
  }

  /**
   * Returns the Switch toggle for a skill row.
   * The aria-label is dynamic — it includes the skill name.
   */
  getSkillToggle(skillName: string): Locator {
    return this.dialog.getByRole('switch', {
      name: new RegExp(skillName, 'i'),
    });
  }

  /**
   * Flips the skill toggle to `on` (true) or off (false).
   * Waits for `aria-checked` to reflect the desired state before returning.
   */
  async toggleSkill(skillName: string, on: boolean): Promise<void> {
    const toggle = this.getSkillToggle(skillName);
    await expect(toggle).toBeVisible({ timeout: 10_000 });

    const current = (await toggle.getAttribute('aria-checked')) === 'true';
    if (current !== on) {
      await toggle.click();
      await expect(toggle).toHaveAttribute(
        'aria-checked',
        on ? 'true' : 'false',
        { timeout: 10_000 },
      );
    }
  }

  // ── New skill dialog ─────────────────────────────────────────────────────

  /** Clicks the New Skill trigger and waits for the dialog to appear. */
  async openNewSkillDialog(): Promise<void> {
    await expect(this.newSkillButton).toBeVisible({ timeout: 10_000 });
    await this.newSkillButton.click();
    await expect(this.newSkillDialog).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Fills the New Skill form. All fields are optional except `name`.
   */
  async fillSkillForm(opts: {
    name: string;
    slug?: string;
    description?: string;
    version?: string;
    instruction?: string;
  }): Promise<void> {
    const { name, slug, description, version, instruction } = opts;

    await expect(this.skillNameInput).toBeVisible({ timeout: 10_000 });
    await this.skillNameInput.fill(name);

    if (slug !== undefined) {
      await expect(this.skillSlugInput).toBeVisible({ timeout: 5_000 });
      await this.skillSlugInput.fill(slug);
    }
    if (description !== undefined) {
      await expect(this.skillDescriptionInput).toBeVisible({ timeout: 5_000 });
      await this.skillDescriptionInput.fill(description);
    }
    if (version !== undefined) {
      await expect(this.skillVersionInput).toBeVisible({ timeout: 5_000 });
      await this.skillVersionInput.fill(version);
    }
    if (instruction !== undefined) {
      await expect(this.skillInstructionInput).toBeVisible({ timeout: 5_000 });
      await this.skillInstructionInput.fill(instruction);
    }
  }

  /**
   * Clicks Save/Create in the New Skill dialog and waits for the dialog to
   * close and the new row to appear in the skill list.
   */
  async submitNewSkill(name: string): Promise<void> {
    await expect(this.saveSkillButton).toBeEnabled({ timeout: 5_000 });
    await this.saveSkillButton.click();
    await expect(this.newSkillDialog).not.toBeVisible({ timeout: 15_000 });
    await expect(this.getSkillRowByName(name)).toBeVisible({ timeout: 15_000 });
  }

  // ── Edit skill dialog ────────────────────────────────────────────────────

  /**
   * Opens the Edit Skill dialog for the skill with `skillName`.
   * Prefers a per-row Edit button; falls back to a row dropdown.
   */
  async openEditSkillDialog(skillName: string): Promise<void> {
    const row = this.getSkillRowByName(skillName);
    await expect(row).toBeVisible({ timeout: 10_000 });

    // Try a direct Edit button in the row first
    const editBtn = row.getByRole('button', { name: /^edit$/i });
    let hasDirectEdit = false;
    try {
      await editBtn.waitFor({ state: 'visible', timeout: 3_000 });
      hasDirectEdit = true;
    } catch {
      hasDirectEdit = false;
    }

    if (hasDirectEdit) {
      await editBtn.click();
    } else {
      // Fall back to dropdown menu
      const menuBtn = row.getByRole('button', {
        name: /actions|options|more/i,
      });
      await expect(menuBtn).toBeVisible({ timeout: 5_000 });
      await menuBtn.click();
      const editItem = this.page.getByRole('menuitem', { name: /^edit$/i });
      await expect(editItem).toBeVisible({ timeout: 5_000 });
      await editItem.click();
    }

    await expect(this.editSkillDialog).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Clicks Save in the Edit Skill dialog and waits for it to close.
   */
  async submitSkillEdit(): Promise<void> {
    await expect(this.saveEditSkillButton).toBeEnabled({ timeout: 5_000 });
    await this.saveEditSkillButton.click();
    await expect(this.editSkillDialog).not.toBeVisible({ timeout: 15_000 });
  }

  /**
   * Deletes a skill via its row dropdown (best-effort — does not fail if
   * the Delete affordance is absent).
   */
  async deleteSkill(skillName: string): Promise<void> {
    const row = this.getSkillRowByName(skillName);
    let rowVisible = false;
    try {
      await row.waitFor({ state: 'visible', timeout: 5_000 });
      rowVisible = true;
    } catch {
      rowVisible = false;
    }
    if (!rowVisible) return;

    // Try direct Delete button first
    const directDelete = row.getByRole('button', { name: /^delete$/i });
    let hasDirectDelete = false;
    try {
      await directDelete.waitFor({ state: 'visible', timeout: 2_000 });
      hasDirectDelete = true;
    } catch {
      hasDirectDelete = false;
    }

    if (hasDirectDelete) {
      await directDelete.click();
    } else {
      const menuBtn = row.getByRole('button', {
        name: /actions|options|more/i,
      });
      let menuVisible = false;
      try {
        await menuBtn.waitFor({ state: 'visible', timeout: 3_000 });
        menuVisible = true;
      } catch {
        menuVisible = false;
      }
      if (!menuVisible) return;
      await menuBtn.click();
      const deleteItem = this.page.getByRole('menuitem', { name: /^delete$/i });
      let deleteItemVisible = false;
      try {
        await deleteItem.waitFor({ state: 'visible', timeout: 3_000 });
        deleteItemVisible = true;
      } catch {
        deleteItemVisible = false;
      }
      if (!deleteItemVisible) return;
      await deleteItem.click();
    }

    // Confirm if prompted
    const confirmDialog = this.page
      .getByRole('alertdialog')
      .or(this.page.getByRole('dialog').filter({ hasText: /confirm|delete/i }));
    let hasConfirm = false;
    try {
      await confirmDialog.waitFor({ state: 'visible', timeout: 3_000 });
      hasConfirm = true;
    } catch {
      hasConfirm = false;
    }
    if (hasConfirm) {
      const confirmBtn = confirmDialog.getByRole('button', {
        name: /confirm|delete|yes/i,
      });
      await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
      await confirmBtn.click();
      await expect(confirmDialog).not.toBeVisible({ timeout: 10_000 });
    }
  }
}
