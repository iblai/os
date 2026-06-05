import { Page, Locator, expect } from '@playwright/test';

/**
 * Page object for the Skills tab inside the Edit Mentor dialog.
 *
 * Renders the AgentSkills component from @iblai/web-containers. Gated on
 * both `enable_claw=true` AND a wired ClawMentorConfig (`isSandboxActive`),
 * so the tab may not appear in all envs. When not wired the component
 * renders:
 *
 *   "Connect a sandbox instance in the Sandbox tab to manage skills."
 *
 * When wired but no platform skills exist:
 *
 *   "No skills available for this platform. Create one to get started."
 *
 * Toasts (the bundle's authoritative success signals):
 *   "Skill created"  — handleCreateSkill success
 *   "Skill updated"  — handleUpdateSkill success
 *   "Skill deleted"  — handleDeleteSkill success
 *
 * Web-first assertions: methods rely on Playwright's auto-retry and the
 * suite-level expect timeout — no hand-tuned `{ timeout }` values inside
 * the page object. Probes that intentionally branch on state (e.g.
 * `hasNoSkills`) carry an explicit `timeout` argument.
 */
export class SkillsTab {
  readonly page: Page;
  readonly dialog: Locator;

  readonly notConnectedMessage: Locator;
  readonly noSkillsMessage: Locator;
  readonly newSkillButton: Locator;

  // New skill dialog (OverlayModal title="New Skill")
  readonly newSkillDialog: Locator;
  readonly skillNameInput: Locator;
  readonly skillSlugInput: Locator;
  readonly skillDescriptionInput: Locator;
  readonly skillVersionInput: Locator;
  readonly skillInstructionInput: Locator;
  readonly saveSkillButton: Locator;
  readonly cancelSkillButton: Locator;

  // Edit skill dialog (OverlayModal title="Edit Skill")
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

    // New Skill OverlayModal — portals to document.body. Match by
    // accessible name (DialogPrimitive.Title="New Skill") because
    // hasText would also match the parent dialog (it contains the
    // "New Skill" trigger button text).
    this.newSkillDialog = page.getByRole('dialog', {
      name: 'New Skill',
      exact: true,
    });
    this.skillNameInput = this.newSkillDialog.locator('[name="skill-name"]');
    this.skillSlugInput = this.newSkillDialog.locator('[name="skill-slug"]');
    this.skillDescriptionInput = this.newSkillDialog.locator(
      '[name="skill-description"]',
    );
    this.skillVersionInput = this.newSkillDialog.locator(
      '[name="skill-version"]',
    );
    // Instruction is a TipTap RichTextEditor. The OUTER `<div role="textbox">`
    // is NOT contenteditable — Playwright's fill() rejects it. Target the
    // inner ProseMirror `[contenteditable="true"]` directly so keyboard
    // input is delivered to the actual editable element.
    this.skillInstructionInput = this.newSkillDialog
      .locator('[contenteditable="true"]')
      .last();
    // Button text is "Create" (or "Creating..."). Match the leading "Creat".
    this.saveSkillButton = this.newSkillDialog.getByRole('button', {
      name: /^(Save|Creat)/i,
    });
    this.cancelSkillButton = this.newSkillDialog.getByRole('button', {
      name: 'Cancel',
      exact: true,
    });

    this.editSkillDialog = page.getByRole('dialog', {
      name: 'Edit Skill',
      exact: true,
    });
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
    this.editSkillInstructionInput = this.editSkillDialog
      .locator('[contenteditable="true"]')
      .last();
    // Button text is "Save" (or "Saving..."). Match leading "Sav".
    this.saveEditSkillButton = this.editSkillDialog.getByRole('button', {
      name: /^Sav/i,
    });
  }

  // ── State detection ──────────────────────────────────────────────────────

  async isNotConnected(timeout = 5_000): Promise<boolean> {
    return this.notConnectedMessage
      .waitFor({ state: 'visible', timeout })
      .then(() => true)
      .catch(() => false);
  }

  async hasNoSkills(timeout = 5_000): Promise<boolean> {
    return this.noSkillsMessage
      .waitFor({ state: 'visible', timeout })
      .then(() => true)
      .catch(() => false);
  }

  // ── Skill row operations ─────────────────────────────────────────────────

  /**
   * Returns the card locator for a skill identified by `name`.
   *
   * AgentSkills renders each skill row with two unique accessible
   * elements: a Switch with `aria-label="${name} enabled|disabled"` and
   * a DropdownMenu trigger with `aria-label="${name} actions"`. We
   * anchor on the Switch (always present) and walk up to the innermost
   * enclosing div that also contains the actions trigger — that's the
   * card. No coupling to Tailwind class signatures.
   */
  getSkillRowByName(name: string): Locator {
    const toggle = this.getSkillToggle(name);
    const actionsBtn = this.dialog.getByRole('button', {
      name: new RegExp(`^${escapeRegex(name)}\\s+actions$`, 'i'),
    });
    // `.last()` resolves to the innermost ancestor div that contains
    // both — i.e. the row card itself, not the panel/wrapper above it.
    return this.dialog
      .locator('div')
      .filter({ hasText: RegExp(`^${name}v1\.0\.0$`, 'i') })
      .first();
  }

  /**
   * Returns the Switch toggle for a skill row. The bundle sets
   * `aria-label="${skill.name} ${enabled ? 'enabled' : 'disabled'}"`.
   */
  getSkillToggle(skillName: string): Locator {
    return this.dialog.getByRole('switch', {
      name: new RegExp(
        `^${escapeRegex(skillName)}\\s+(enabled|disabled)$`,
        'i',
      ),
    });
  }

  /**
   * Flips the skill toggle to `on`/`off`. Waits for `aria-checked` to
   * reflect the desired state — the bundle awaits the assignment mutation
   * before flipping.
   */
  async toggleSkill(skillName: string, on: boolean): Promise<void> {
    const toggle = this.getSkillToggle(skillName);
    await expect(toggle).toBeVisible();
    const current = (await toggle.getAttribute('aria-checked')) === 'true';
    if (current === on) return;
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', String(on));
  }

  /**
   * The dropdown trigger inside a skill row uses
   * `aria-label="${skill.name} actions"`. Returns that locator.
   */
  private skillActionsButton(row: Locator, skillName: string): Locator {
    return row.getByRole('button', {
      name: new RegExp(`^${escapeRegex(skillName)}\\s+actions$`, 'i'),
    });
  }

  // ── New skill dialog ─────────────────────────────────────────────────────

  async openNewSkillDialog(): Promise<void> {
    await this.newSkillButton.click();
    await expect(this.newSkillDialog).toBeVisible();
  }

  /**
   * Fills the New Skill form. All fields are optional except `name`. The
   * Create button is gated on `name && slug` per the bundle, so callers
   * must provide both before submit.
   */
  async fillSkillForm(opts: {
    name: string;
    slug?: string;
    description?: string;
    version?: string;
    instruction?: string;
  }): Promise<void> {
    const { name, slug, description, version, instruction } = opts;

    await this.skillNameInput.fill(name);
    if (slug !== undefined) await this.skillSlugInput.fill(slug);
    if (description !== undefined) {
      await this.skillDescriptionInput.fill(description);
    }
    if (version !== undefined) await this.skillVersionInput.fill(version);

    if (instruction !== undefined) {
      // TipTap/ProseMirror contenteditable. Drive via real keyboard
      // events so ProseMirror's input plugins observe the edits.
      await expect(this.skillInstructionInput).toBeVisible();
      await this.skillInstructionInput.click();
      await this.page.keyboard.press(
        process.platform === 'darwin' ? 'Meta+A' : 'Control+A',
      );
      await this.page.keyboard.press('Delete');
      await this.page.keyboard.type(instruction);
    }
  }

  /**
   * Clicks Create and asserts the durable post-state: dialog closed and the
   * new row in the list. We don't wait for the "Skill created" sonner toast
   * — it auto-dismisses after ~4s and is racy in slower CI runs.
   */
  async submitNewSkill(name: string): Promise<void> {
    await expect(this.saveSkillButton).toBeEnabled();
    await this.saveSkillButton.click();
    await expect(this.newSkillDialog).toBeHidden({ timeout: 10_000 });
    await expect(this.getSkillRowByName(name)).toBeVisible({ timeout: 10_000 });
  }

  // ── Edit skill dialog ────────────────────────────────────────────────────

  /**
   * Opens the Edit Skill dialog via the row's actions dropdown.
   *
   * AgentSkills renders the trigger with `aria-label="${name} actions"`
   * and the "Edit" menu item is plain text — no aria-label.
   */
  async openEditSkillDialog(skillName: string): Promise<void> {
    const row = this.getSkillRowByName(skillName);
    await expect(row).toBeVisible();
    await this.skillActionsButton(row, skillName).click();
    await this.page.getByRole('menuitem', { name: /^edit$/i }).click();
    await expect(this.editSkillDialog).toBeVisible();
  }

  /**
   * Clicks Save in the Edit Skill dialog and waits for the dialog to close —
   * the durable post-state once `updateSkill` resolves. We don't wait for
   * the "Skill updated" sonner toast (auto-dismisses after ~4s, racy in CI).
   */
  async submitSkillEdit(): Promise<void> {
    await expect(this.saveEditSkillButton).toBeEnabled();
    await this.saveEditSkillButton.click();
    await expect(this.editSkillDialog).toBeHidden({ timeout: 10_000 });
  }

  /**
   * Deletes a skill via its row dropdown. AgentSkills shows a "Delete
   * Skill" OverlayModal as a confirmation; the bundle's success toast is
   * "Skill deleted". If the API rejects (modal stays open), this method
   * dismisses it via Cancel/Escape so cleanup callers can still close
   * the parent dialog.
   */
  async deleteSkill(skillName: string): Promise<void> {
    const row = this.getSkillRowByName(skillName);
    if (
      !(await row
        .first()
        .isVisible()
        .catch(() => false))
    ) {
      return; // already gone
    }

    await this.skillActionsButton(row, skillName).click();
    await this.page.getByRole('menuitem', { name: /^delete$/i }).click();

    const confirmDialog = this.page.getByRole('dialog', {
      name: 'Delete Skill',
      exact: true,
    });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog
      .getByRole('button', { name: /^delete$/i })
      .first()
      .click();

    // Success path: the confirm modal closes after `deleteSkill` resolves.
    // We don't wait for the "Skill deleted" sonner toast (auto-dismisses
    // after ~4s, racy in CI). If the delete mutation rejects, the modal
    // stays open — dismiss it explicitly so a leftover overlay doesn't
    // intercept clicks on the parent dialog.
    try {
      await expect(confirmDialog).toBeHidden({ timeout: 10_000 });
    } catch {
      const cancel = confirmDialog.getByRole('button', {
        name: 'Cancel',
        exact: true,
      });
      await cancel.click().catch(async () => {
        await this.page.keyboard.press('Escape').catch(() => {});
      });
      await expect(confirmDialog)
        .toBeHidden()
        .catch(() => {});
    }
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
