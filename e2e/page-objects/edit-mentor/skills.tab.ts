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

    // New skill dialog — rendered outside the Edit Mentor dialog via a Radix portal.
    // OverlayModal portals to document.body so scope to page, not dialog.
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
    // The instruction field is a RichTextEditor (TipTap EditorContent).
    // It has no `name` attribute — target the div[role="textbox"] contenteditable
    // scoped within the instruction label area.
    this.skillInstructionInput = this.newSkillDialog
      .locator('#skill-instruction')
      .or(this.newSkillDialog.getByRole('textbox').last());
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
    // The instruction field uses RichTextEditor — no name attribute.
    this.editSkillInstructionInput = this.editSkillDialog
      .locator('#skill-instruction')
      .or(this.editSkillDialog.getByRole('textbox').last());
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
   * Returns the card locator for a skill identified by `name`.
   *
   * The AgentSkills component from @iblai/web-containers renders each skill as
   * a `div.flex.items-center.justify-between.rounded-lg.border.p-6` — NOT a
   * table row. Filter by text so we don't pick up the "New Skill" dialog or
   * unrelated elements.
   */
  getSkillRowByName(name: string): Locator {
    return this.dialog
      .locator('div.flex.items-center.justify-between.rounded-lg.border')
      .filter({ hasText: name })
      .first();
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
      // The instruction field is a RichTextEditor (TipTap contenteditable).
      // fill() works on contenteditable elements in Playwright.
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
   *
   * The AgentSkills component renders each skill with a DropdownMenu whose
   * trigger has `aria-label="${skillName} actions"`. The Edit menu item has
   * text "Edit". There is no separate direct Edit button in the row.
   */
  async openEditSkillDialog(skillName: string): Promise<void> {
    const row = this.getSkillRowByName(skillName);
    await expect(row).toBeVisible({ timeout: 10_000 });

    // The dropdown trigger aria-label is "<skill name> actions"
    const menuBtn = row.getByRole('button', {
      name: new RegExp(`${skillName}\\s+actions`, 'i'),
    });
    let menuBtnVisible = false;
    try {
      await menuBtn.waitFor({ state: 'visible', timeout: 3_000 });
      menuBtnVisible = true;
    } catch {
      menuBtnVisible = false;
    }

    if (!menuBtnVisible) {
      // Fallback: any button in the row that looks like an actions trigger
      const anyMenuBtn = row.getByRole('button', {
        name: /actions|options|more/i,
      });
      await expect(anyMenuBtn).toBeVisible({ timeout: 5_000 });
      await anyMenuBtn.click();
    } else {
      await menuBtn.click();
    }

    const editItem = this.page.getByRole('menuitem', { name: /^edit$/i });
    await expect(editItem).toBeVisible({ timeout: 5_000 });
    await editItem.click();

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
   *
   * The AgentSkills component shows a "Delete Skill" confirmation modal before
   * deleting. The DropdownMenu trigger has `aria-label="${skillName} actions"`.
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

    // Open dropdown: aria-label is "<skill name> actions"
    const menuBtn = row.getByRole('button', {
      name: new RegExp(`${skillName}\\s+actions`, 'i'),
    });
    let menuVisible = false;
    try {
      await menuBtn.waitFor({ state: 'visible', timeout: 3_000 });
      menuVisible = true;
    } catch {
      // Fallback to any button in the row
      const anyMenuBtn = row.getByRole('button', {
        name: /actions|options|more/i,
      });
      try {
        await anyMenuBtn.waitFor({ state: 'visible', timeout: 3_000 });
        menuVisible = true;
        await anyMenuBtn.click();
      } catch {
        menuVisible = false;
      }
    }
    if (!menuVisible) return;

    if (menuVisible) {
      try {
        await menuBtn.click();
      } catch {
        // Already clicked in fallback branch above
      }
    }

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

    // "Delete Skill" confirmation modal from AgentSkills
    const confirmDialog = this.page
      .getByRole('dialog')
      .filter({ hasText: /delete skill/i });
    let hasConfirm = false;
    try {
      await confirmDialog.waitFor({ state: 'visible', timeout: 5_000 });
      hasConfirm = true;
    } catch {
      hasConfirm = false;
    }
    if (hasConfirm) {
      const confirmBtn = confirmDialog.getByRole('button', {
        name: /^delete$/i,
      });
      await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
      await confirmBtn.click();
      await expect(confirmDialog).not.toBeVisible({ timeout: 10_000 });
    }
  }
}
