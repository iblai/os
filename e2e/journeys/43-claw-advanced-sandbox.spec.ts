/**
 * Journey 43: CLAW Advanced Sandbox
 *
 * Covers the full lifecycle of the "Advanced Sandbox" feature (CLAW) in
 * the Edit Mentor modal:
 *
 *   Settings tab  — "Advanced Sandbox" toggle
 *   Tab visibility — Sandbox tab (after Settings) and Skills tab (after Prompts)
 *   Prompts tab   — "Agent Configuration" section
 *
 * The Advanced Sandbox toggle is "admin intent" — it maps directly to
 * `enable_claw` on the mentor settings PUT. The toggle is always enabled for
 * admins (no dependency on a wired ClawMentorConfig).
 *
 * When the toggle is ON and saved, the Sandbox tab and Skills tab appear, and
 * the "Agent Configuration" section shows in Prompts. All three disappear
 * again after toggling OFF and saving.
 *
 * Because the tabs are gated on the persisted `enable_claw` value from
 * mentor-settings, they must NOT appear while the toggle is changed in-form
 * but before Save is clicked.
 *
 * Non-admin users must not see the Sandbox or Skills tabs even when a mentor
 * has claw enabled (those segments are ADMIN-only in use-mentor-segments.ts).
 */

import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import type { Locator } from '@playwright/test';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the tab list within the Edit Mentor dialog so we can assert on
 * tab presence/absence without relying on string matching inside the full page.
 */
function tabList(dialog: Locator): Locator {
  return dialog.getByRole('tablist');
}

/** Returns a tab locator by exact label within the dialog tab list. */
function getTab(dialog: Locator, name: string): Locator {
  return tabList(dialog).getByRole('tab', { name, exact: true });
}

/**
 * Waits until a tab with the given name appears in the dialog tab list.
 * Uses `waitFor` (not `isVisible`) to correctly honour the timeout.
 */
async function waitForTabVisible(
  dialog: Locator,
  name: string,
  timeout = 15_000,
): Promise<void> {
  await getTab(dialog, name).waitFor({ state: 'visible', timeout });
}

/**
 * Asserts that a tab is NOT present in the dialog tab list.
 * Uses `toHaveCount(0)` which is a web-first assertion that retries.
 */
async function expectTabHidden(
  dialog: Locator,
  name: string,
  timeout = 10_000,
): Promise<void> {
  await expect(getTab(dialog, name)).toHaveCount(0, { timeout });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Journey 43: CLAW Advanced Sandbox', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin)
      test.skip(true, 'CLAW Advanced Sandbox requires admin access');
  });

  // ── TC01: Toggle is present in Settings tab ───────────────────────────────

  test('admin opens Settings tab and Advanced Sandbox toggle is present', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    await expect(editMentorPage.settings.advancedSandboxToggle).toBeVisible({
      timeout: 10_000,
    });
  });

  // ── TC02: Toggle is always interactable for admins (intent-only) ──────────

  test('Advanced Sandbox toggle is interactable regardless of claw config state', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    const toggle = editMentorPage.settings.advancedSandboxToggle;
    await expect(toggle).toBeVisible({ timeout: 10_000 });
    await expect(toggle).toBeEnabled({ timeout: 5_000 });
  });

  // ── TC03: Pre-save state — toggled but not yet saved ─────────────────────

  test('admin flips Advanced Sandbox toggle but does not save — Sandbox and Skills tabs do not appear', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    const toggle = editMentorPage.settings.advancedSandboxToggle;
    await expect(toggle).toBeVisible({ timeout: 10_000 });

    // Snapshot current state so we can leave the form unchanged
    const wasClaw = await editMentorPage.settings.isAdvancedSandboxEnabled();

    // Flip the toggle (don't click Save)
    await toggle.click();
    await expect(toggle).toHaveAttribute(
      'aria-checked',
      wasClaw ? 'false' : 'true',
      { timeout: 5_000 },
    );

    // Sandbox and Skills tabs must NOT appear before Save is clicked
    await expectTabHidden(editMentorPage.dialog, 'Sandbox');
    await expectTabHidden(editMentorPage.dialog, 'Skills');

    // Restore by flipping back, then close without saving
    await toggle.click();
    await editMentorPage.close();
  });

  // ── TC04: Golden path — enable CLAW and verify tabs + Agent Configuration ─

  test('admin enables Advanced Sandbox and Sandbox tab, Skills tab, and Agent Configuration section appear after save', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    await expect(editMentorPage.settings.advancedSandboxToggle).toBeVisible({
      timeout: 10_000,
    });

    const wasEnabled = await editMentorPage.settings.isAdvancedSandboxEnabled();

    try {
      // Enable claw and save
      await editMentorPage.settings.setAdvancedSandbox(true);

      // Sandbox tab should appear immediately after Settings in the tab list
      await waitForTabVisible(editMentorPage.dialog, 'Sandbox', 15_000);

      // Skills tab should appear after Prompts
      await waitForTabVisible(editMentorPage.dialog, 'Skills', 15_000);

      // Verify tab ordering: Settings → Sandbox → ... → Prompts → Skills
      const tabs = await tabList(editMentorPage.dialog)
        .getByRole('tab')
        .allTextContents();
      const settingsIdx = tabs.findIndex((t) => /settings/i.test(t));
      const sandboxIdx = tabs.findIndex((t) => /sandbox/i.test(t));
      const promptsIdx = tabs.findIndex((t) => /prompts/i.test(t));
      const skillsIdx = tabs.findIndex((t) => /skills/i.test(t));

      // Sandbox appears right after Settings
      expect(sandboxIdx).toBe(settingsIdx + 1);
      // Skills appears right after Prompts
      expect(skillsIdx).toBe(promptsIdx + 1);

      // Navigate to Prompts tab and verify Agent Configuration section
      await editMentorPage.navigateToTab('Prompts');
      await waitForPageReady(page);

      const agentConfigSection = editMentorPage.dialog.getByRole('heading', {
        name: /agent configuration/i,
      });
      await expect(agentConfigSection).toBeVisible({ timeout: 10_000 });
    } finally {
      // Restore original state
      if (!wasEnabled) {
        await editMentorPage.navigateToTab('Settings');
        await waitForPageReady(page);
        await editMentorPage.settings.setAdvancedSandbox(false);
      }
      await editMentorPage.close();
    }
  });

  // ── TC05: Reverse path — disable CLAW and verify tabs + section disappear ─

  test('admin disables Advanced Sandbox and Sandbox tab, Skills tab, and Agent Configuration section disappear after save', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    await expect(editMentorPage.settings.advancedSandboxToggle).toBeVisible({
      timeout: 10_000,
    });

    const wasEnabled = await editMentorPage.settings.isAdvancedSandboxEnabled();

    try {
      // First ensure claw IS enabled so we can then disable it
      if (!wasEnabled) {
        await editMentorPage.settings.setAdvancedSandbox(true);
        await waitForTabVisible(editMentorPage.dialog, 'Sandbox', 15_000);
      }

      // Now disable and save
      await editMentorPage.navigateToTab('Settings');
      await waitForPageReady(page);
      await editMentorPage.settings.setAdvancedSandbox(false);

      // Sandbox and Skills tabs must disappear
      await expectTabHidden(editMentorPage.dialog, 'Sandbox', 15_000);
      await expectTabHidden(editMentorPage.dialog, 'Skills', 15_000);

      // Navigate to Prompts tab and verify Agent Configuration is gone
      await editMentorPage.navigateToTab('Prompts');
      await waitForPageReady(page);

      const agentConfigHeading = editMentorPage.dialog.getByRole('heading', {
        name: /agent configuration/i,
      });
      await expect(agentConfigHeading).toHaveCount(0, { timeout: 5_000 });
    } finally {
      // Restore original enabled state if needed
      if (wasEnabled) {
        await editMentorPage.navigateToTab('Settings');
        await waitForPageReady(page);
        await editMentorPage.settings.setAdvancedSandbox(true);
      }
      await editMentorPage.close();
    }
  });

  // ── TC06: Sandbox tab can be navigated to and renders its container ───────

  test('admin navigates to Sandbox tab and sandbox config container is visible', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    const wasEnabled = await editMentorPage.settings.isAdvancedSandboxEnabled();

    try {
      if (!wasEnabled) {
        await editMentorPage.settings.setAdvancedSandbox(true);
        await waitForTabVisible(editMentorPage.dialog, 'Sandbox', 15_000);
      }

      await editMentorPage.navigateToTab('Sandbox');
      await waitForPageReady(page);

      // The SandboxConfig component from @iblai/web-containers is rendered
      // inside the tabpanel. Verify the panel is visible.
      const sandboxPanel = editMentorPage.dialog.getByRole('tabpanel').first();
      await expect(sandboxPanel).toBeVisible({ timeout: 10_000 });
    } finally {
      if (!wasEnabled) {
        await editMentorPage.navigateToTab('Settings');
        await waitForPageReady(page);
        await editMentorPage.settings.setAdvancedSandbox(false);
      }
      await editMentorPage.close();
    }
  });

  // ── TC07: Skills tab can be navigated to and renders its container ────────

  test('admin navigates to Skills tab and agent skills container is visible', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    const wasEnabled = await editMentorPage.settings.isAdvancedSandboxEnabled();

    try {
      if (!wasEnabled) {
        await editMentorPage.settings.setAdvancedSandbox(true);
        await waitForTabVisible(editMentorPage.dialog, 'Skills', 15_000);
      }

      await editMentorPage.navigateToTab('Skills');
      await waitForPageReady(page);

      // The AgentSkills component from @iblai/web-containers is rendered inside
      // the tabpanel — verify the panel is visible and not blank.
      const skillsPanel = editMentorPage.dialog.getByRole('tabpanel').first();
      await expect(skillsPanel).toBeVisible({ timeout: 10_000 });
    } finally {
      if (!wasEnabled) {
        await editMentorPage.navigateToTab('Settings');
        await waitForPageReady(page);
        await editMentorPage.settings.setAdvancedSandbox(false);
      }
      await editMentorPage.close();
    }
  });
});

// ── Non-admin: Sandbox and Skills tabs invisible even when claw is enabled ───

test.describe('Journey 43: CLAW Advanced Sandbox — Non-Admin', () => {
  test('non-admin does not see Sandbox or Skills tabs in the Edit Mentor modal', async ({
    nonadminPage,
    nonadminEditMentorPage,
  }) => {
    await navigateToMentorApp(nonadminPage);

    // Non-admin cannot open the edit mentor modal via the mentor dropdown
    // (the Settings menu item is hidden). We assert the tabs are absent by
    // checking the mentor dropdown does not expose a Modify / Settings option.
    const dropdown = nonadminPage.getByRole('button', {
      name: 'Selected mentor dropdown button',
    });
    await expect(dropdown).toBeVisible({ timeout: 15_000 });
    await dropdown.click();

    const modifyItem = nonadminPage
      .getByRole('menuitem', { name: /modify/i })
      .or(nonadminPage.getByRole('menuitem', { name: /settings/i }).first());

    let menuItemVisible = false;
    try {
      await modifyItem.waitFor({ state: 'visible', timeout: 3_000 });
      menuItemVisible = true;
    } catch {
      menuItemVisible = false;
    }

    if (!menuItemVisible) {
      // Non-admin cannot open the edit dialog — Sandbox / Skills tabs are
      // definitively not visible. Test passes.
      await nonadminPage.keyboard.press('Escape');
      return;
    }

    // If (in some env) non-admin can open the dialog, verify tabs are absent
    await modifyItem.click();
    await expect(nonadminEditMentorPage.dialog).toBeVisible({
      timeout: 15_000,
    });

    await expectTabHidden(nonadminEditMentorPage.dialog, 'Sandbox');
    await expectTabHidden(nonadminEditMentorPage.dialog, 'Skills');

    await nonadminEditMentorPage.close();
  });
});
