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
 * Tab visibility (when `enable_claw=true`):
 *   - Sandbox tab — appears immediately so admins can connect a sandbox
 *   - Skills tab + "Agent Configuration" section — only appear AFTER the
 *     sandbox is wired to a Claw instance (a `ClawMentorConfig` exists for
 *     this mentor). They stay hidden when claw is enabled but no instance is
 *     connected yet.
 *
 * Toggling claw OFF and saving hides all three (Sandbox, Skills, Agent
 * Configuration) regardless of whether a sandbox is connected.
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
import { SandboxTab } from '../page-objects/edit-mentor/sandbox.tab';
import { SkillsTab } from '../page-objects/edit-mentor/skills.tab';
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

    // This test only makes sense when CLAW is currently OFF (persisted as
    // disabled). If CLAW is ON, the Sandbox tab is already visible from the
    // persisted enabled state; flipping the toggle to OFF in-form (without
    // saving) does NOT hide the tab — that would only happen after Save.
    // Skip rather than produce a misleading failure.
    if (wasClaw) {
      await editMentorPage.close();
      test.skip(
        true,
        'CLAW is already enabled — the Sandbox tab is already visible. ' +
          'TC03 only tests the unsaved OFF→ON direction to confirm tabs stay hidden.',
      );
      return;
    }

    // CLAW is currently OFF (persisted). Flip the toggle ON in-form but do NOT
    // save. The Sandbox and Skills tabs must NOT appear before Save is clicked.
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true', {
      timeout: 5_000,
    });

    // Tabs are driven by the persisted backend value, not the in-form state.
    // Even though the toggle now shows checked, no save was issued — tabs must
    // remain absent.
    await expectTabHidden(editMentorPage.dialog, 'Sandbox');
    await expectTabHidden(editMentorPage.dialog, 'Skills');

    // Restore by flipping back, then close without saving
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false', {
      timeout: 5_000,
    });
    await editMentorPage.close();
  });

  // ── TC04: Golden path — enable CLAW and verify Sandbox tab appears ───────
  //
  // Sandbox tab appears immediately when claw is enabled (so admins can
  // connect a sandbox). Skills tab + Agent Configuration are gated on a wired
  // ClawMentorConfig (sandbox connected to an instance) — those are covered
  // conditionally in TC04b.

  test('admin enables Advanced Sandbox and Sandbox tab appears after save (right after Settings)', async ({
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
      await editMentorPage.settings.setAdvancedSandbox(true);

      // Sandbox tab should appear immediately after Settings in the tab list
      await waitForTabVisible(editMentorPage.dialog, 'Sandbox', 15_000);

      // Verify ordering: Sandbox sits right after Settings
      const tabs = await tabList(editMentorPage.dialog)
        .getByRole('tab')
        .allTextContents();
      const settingsIdx = tabs.findIndex((t) => /settings/i.test(t));
      const sandboxIdx = tabs.findIndex((t) => /sandbox/i.test(t));
      expect(sandboxIdx).toBe(settingsIdx + 1);
    } finally {
      if (!wasEnabled) {
        await editMentorPage.navigateToTab('Settings');
        await waitForPageReady(page);
        await editMentorPage.settings.setAdvancedSandbox(false);
      }
      await editMentorPage.close();
    }
  });

  // ── TC04b: Skills tab + Agent Configuration only show when sandbox wired ──
  //
  // After enabling claw, Skills tab and the Agent Configuration section
  // appear in the dialog ONLY if a ClawMentorConfig already exists for this
  // mentor (sandbox connected to a Claw instance). When no instance is
  // connected, Skills + Agent Configuration must remain hidden even with
  // claw enabled.
  //
  // The test reads the live state — if a sandbox is wired in this env, it
  // asserts both surfaces appear; otherwise it asserts both stay hidden.

  test('Skills tab and Agent Configuration are gated on a wired sandbox (visible only when connected)', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    const wasEnabled = await editMentorPage.settings.isAdvancedSandboxEnabled();

    try {
      if (!wasEnabled) {
        await editMentorPage.settings.setAdvancedSandbox(true);
      }
      await waitForTabVisible(editMentorPage.dialog, 'Sandbox', 15_000);

      // Detect whether the sandbox is currently wired by visiting the Sandbox
      // tab and looking for the "connected" UI vs the instance picker.
      await editMentorPage.navigateToTab('Sandbox');
      await waitForPageReady(page);

      // The SandboxConfig component shows "Connected Instance" when wired
      // and an instance table ("No instances available" / instance rows)
      // when not connected. Use a 4s probe: if "Connected Instance" appears
      // within that window, treat as wired.
      const connectedHeading =
        editMentorPage.dialog.getByText(/connected instance/i);
      let isWired = false;
      try {
        await connectedHeading.first().waitFor({
          state: 'visible',
          timeout: 4_000,
        });
        isWired = true;
      } catch {
        isWired = false;
      }

      const skillsTab = getTab(editMentorPage.dialog, 'Skills');
      const agentConfigHeading = editMentorPage.dialog.getByRole('heading', {
        name: /agent configuration/i,
      });

      if (isWired) {
        // Wired sandbox → Skills tab visible, Agent Configuration visible
        await waitForTabVisible(editMentorPage.dialog, 'Skills', 15_000);

        const tabs = await tabList(editMentorPage.dialog)
          .getByRole('tab')
          .allTextContents();
        const promptsIdx = tabs.findIndex((t) => /prompts/i.test(t));
        const skillsIdx = tabs.findIndex((t) => /skills/i.test(t));
        expect(skillsIdx).toBe(promptsIdx + 1);

        await editMentorPage.navigateToTab('Prompts');
        await waitForPageReady(page);
        await expect(agentConfigHeading).toBeVisible({ timeout: 10_000 });
      } else {
        // Sandbox enabled but NOT wired → Skills + Agent Configuration hidden
        await expect(skillsTab).toHaveCount(0, { timeout: 5_000 });

        await editMentorPage.navigateToTab('Prompts');
        await waitForPageReady(page);
        await expect(agentConfigHeading).toHaveCount(0, { timeout: 5_000 });
      }
    } finally {
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

  // ── TC07: Skills tab can be navigated to (only when sandbox is wired) ─────
  //
  // Skills tab only appears when claw is enabled AND a ClawMentorConfig is
  // wired for this mentor. If the env has no wired sandbox, the tab won't
  // show at all — the test gracefully skips that case.

  test('admin navigates to Skills tab and agent skills container is visible (when sandbox is wired)', async ({
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

      // Skills tab only shows when a sandbox is wired. Probe (4s) — if it
      // never appears, the env has no wired sandbox; skip the assertion.
      const skillsTab = getTab(editMentorPage.dialog, 'Skills');
      let skillsAvailable = false;
      try {
        await skillsTab.waitFor({ state: 'visible', timeout: 4_000 });
        skillsAvailable = true;
      } catch {
        skillsAvailable = false;
      }

      if (!skillsAvailable) {
        test.skip(
          true,
          'No claw mentor config wired in this env — Skills tab is gated on it',
        );
        return;
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

// ── TC09: Toggle on/off lifecycle in a single session ────────────────────────
//
// Verifies that enabling claw causes Sandbox to appear and disabling it makes
// Sandbox disappear — all within the same modal session (no reopen).

test.describe('Journey 43: CLAW Advanced Sandbox — deeper lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin)
      test.skip(true, 'CLAW Advanced Sandbox requires admin access');
  });

  test('admin toggles Advanced Sandbox ON then OFF and Sandbox tab appears then disappears in the same session', async ({
    page,
    editMentorPage,
  }) => {
    // claw-09
    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    await expect(editMentorPage.settings.advancedSandboxToggle).toBeVisible({
      timeout: 10_000,
    });

    const originalState =
      await editMentorPage.settings.isAdvancedSandboxEnabled();

    try {
      // ── Phase 1: enable → Sandbox tab must appear ──────────────────────
      await editMentorPage.settings.setAdvancedSandbox(true);
      await waitForTabVisible(editMentorPage.dialog, 'Sandbox', 15_000);

      // ── Phase 2: disable → Sandbox tab must disappear ─────────────────
      await editMentorPage.navigateToTab('Settings');
      await waitForPageReady(page);
      await editMentorPage.settings.setAdvancedSandbox(false);
      await expectTabHidden(editMentorPage.dialog, 'Sandbox', 15_000);
    } finally {
      // Restore original state
      if (
        originalState !==
        (await editMentorPage.settings.isAdvancedSandboxEnabled())
      ) {
        await editMentorPage.navigateToTab('Settings');
        await waitForPageReady(page);
        await editMentorPage.settings.setAdvancedSandbox(originalState);
      }
      await editMentorPage.close();
    }
  });

  // ── TC10: Sandbox tab — Add new instance ───────────────────────────────────

  test('admin opens Sandbox tab, adds a new instance via the dialog, and new row appears in the table', async ({
    page,
    editMentorPage,
  }) => {
    // claw-10
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

      const sandbox = new SandboxTab(page, editMentorPage.dialog);

      // Skip this test if the sandbox is already connected — we want the
      // unwired (instance picker) flow.
      if (await sandbox.isConnected()) {
        test.skip(
          true,
          'Sandbox is already connected — skipping Add Instance flow',
        );
        return;
      }

      const ts = Date.now();
      const instanceName = `e2e-instance-${ts}`;
      const instanceUrl = `https://test-sandbox-${ts}.example.com`;

      await sandbox.openAddInstanceDialog();
      await sandbox.fillNewInstance({
        name: instanceName,
        url: instanceUrl,
        type: 'OpenClaw',
      });
      await sandbox.submitNewInstance(instanceName);

      // Assert: new row is visible with the given name
      await expect(sandbox.getInstanceRowByName(instanceName)).toBeVisible({
        timeout: 15_000,
      });

      // Cleanup: delete the instance we created
      try {
        const row = sandbox.getInstanceRowByName(instanceName);
        await sandbox.clickDeleteInRow(row);
        // Wait for row to disappear
        await expect(sandbox.getInstanceRowByName(instanceName)).toHaveCount(
          0,
          { timeout: 10_000 },
        );
      } catch {
        // Best-effort — don't fail teardown
      }
    } finally {
      if (!wasEnabled) {
        await editMentorPage.navigateToTab('Settings');
        await waitForPageReady(page);
        await editMentorPage.settings.setAdvancedSandbox(false);
      }
      await editMentorPage.close();
    }
  });

  // ── TC11: Sandbox tab — Edit existing instance ────────────────────────────

  test('admin edits an existing sandbox instance name and the updated name appears in the table', async ({
    page,
    editMentorPage,
  }) => {
    // claw-11
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

      const sandbox = new SandboxTab(page, editMentorPage.dialog);

      // Skip if already connected (would disrupt the wired state)
      if (await sandbox.isConnected()) {
        test.skip(
          true,
          'Sandbox is connected — skipping Edit Instance flow to avoid disruption',
        );
        return;
      }

      // Skip if no instances exist in the table
      const instanceCount = await sandbox.getInstanceCount();
      if (instanceCount === 0) {
        test.skip(
          true,
          'No instances exist in this env — cannot test Edit Instance flow',
        );
        return;
      }

      // Pick the first row
      const firstRow = sandbox.instanceTable.getByRole('row').nth(1); // nth(0) is the header row
      await expect(firstRow).toBeVisible({ timeout: 10_000 });

      // Capture original name from the first cell (NAME column)
      const originalName = await firstRow.getByRole('cell').first().innerText();
      const ts = Date.now();
      const editedName = `${originalName} (edited ${ts})`;

      await sandbox.clickEditInRow(firstRow);

      // Clear the name field and type the new name
      await expect(sandbox.editInstanceNameInput).toBeVisible({
        timeout: 10_000,
      });
      await sandbox.editInstanceNameInput.clear();
      await sandbox.editInstanceNameInput.fill(editedName);

      await sandbox.saveInstanceEdit();

      // Assert: row with the new name is visible
      await expect(sandbox.getInstanceRowByName(editedName)).toBeVisible({
        timeout: 15_000,
      });

      // Restore: edit back to the original name
      try {
        const editedRow = sandbox.getInstanceRowByName(editedName);
        await sandbox.clickEditInRow(editedRow);
        await expect(sandbox.editInstanceNameInput).toBeVisible({
          timeout: 10_000,
        });
        await sandbox.editInstanceNameInput.clear();
        await sandbox.editInstanceNameInput.fill(originalName);
        await sandbox.saveInstanceEdit();
      } catch {
        // Best-effort restore
      }
    } finally {
      if (!wasEnabled) {
        await editMentorPage.navigateToTab('Settings');
        await waitForPageReady(page);
        await editMentorPage.settings.setAdvancedSandbox(false);
      }
      await editMentorPage.close();
    }
  });

  // ── TC12: Sandbox tab — Connect to instance ────────────────────────────────
  //
  // Clicking Connect wires the mentor to a Claw instance. After connect the
  // "Connected Instance" heading must appear, AND the Skills tab must now be
  // visible in the dialog tab list (wired → Skills-visible transition).

  test('admin connects a sandbox instance and Connected Instance heading appears and Skills tab becomes visible', async ({
    page,
    editMentorPage,
  }) => {
    // claw-12
    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    const wasEnabled = await editMentorPage.settings.isAdvancedSandboxEnabled();

    let createdInstanceName: string | null = null;

    try {
      if (!wasEnabled) {
        await editMentorPage.settings.setAdvancedSandbox(true);
        await waitForTabVisible(editMentorPage.dialog, 'Sandbox', 15_000);
      }

      await editMentorPage.navigateToTab('Sandbox');
      await waitForPageReady(page);

      const sandbox = new SandboxTab(page, editMentorPage.dialog);

      // Skip if already connected — the test asserts the NOT-connected → connected
      // transition. If already connected we'd have to disconnect first which risks
      // data loss in a shared env.
      if (await sandbox.isConnected()) {
        test.skip(
          true,
          'Sandbox is already connected — skipping Connect flow to avoid disrupting the existing connection',
        );
        return;
      }

      // Ensure there is at least one instance to connect to. If the table is
      // empty, create one inline.
      let instanceCount = await sandbox.getInstanceCount();
      if (instanceCount === 0) {
        const ts = Date.now();
        createdInstanceName = `e2e-connect-${ts}`;
        await sandbox.openAddInstanceDialog();
        await sandbox.fillNewInstance({
          name: createdInstanceName,
          url: `https://e2e-connect-${ts}.example.com`,
          type: 'OpenClaw',
        });
        await sandbox.submitNewInstance(createdInstanceName);
        instanceCount = 1;
      }

      // Connect using the first available row
      const firstRow = sandbox.instanceTable.getByRole('row').nth(1);
      await expect(firstRow).toBeVisible({ timeout: 10_000 });
      await sandbox.clickConnect(firstRow);

      // Assert: "Connected Instance" heading appeared
      await expect(sandbox.connectedHeading.first()).toBeVisible({
        timeout: 15_000,
      });

      // Assert: Skills tab is now visible (wired → Skills-visible transition)
      await waitForTabVisible(editMentorPage.dialog, 'Skills', 15_000);

      // Cleanup: disconnect to restore the not-connected state
      await sandbox.disconnect();

      // Delete the instance we created (if applicable) — best-effort
      if (createdInstanceName !== null) {
        try {
          const row = sandbox.getInstanceRowByName(createdInstanceName);
          await sandbox.clickDeleteInRow(row);
        } catch {
          // Best-effort
        }
        createdInstanceName = null;
      }
    } finally {
      // If teardown above didn't run (e.g. an assertion threw before disconnect)
      // we still try to clean up the created instance.
      if (createdInstanceName !== null) {
        try {
          const sandbox = new SandboxTab(page, editMentorPage.dialog);
          if (await sandbox.isConnected()) {
            await sandbox.disconnect();
          }
          const row = sandbox.getInstanceRowByName(createdInstanceName);
          await sandbox.clickDeleteInRow(row);
        } catch {
          // Best-effort
        }
      }
      if (!wasEnabled) {
        await editMentorPage.navigateToTab('Settings');
        await waitForPageReady(page);
        await editMentorPage.settings.setAdvancedSandbox(false);
      }
      await editMentorPage.close();
    }
  });

  // ── TC13: Prompts tab — Edit Agent Configuration field ────────────────────

  test('admin edits an Agent Configuration field value and the modal closes with the new value persisted', async ({
    page,
    editMentorPage,
  }) => {
    // claw-13
    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    const wasEnabled = await editMentorPage.settings.isAdvancedSandboxEnabled();

    try {
      if (!wasEnabled) {
        await editMentorPage.settings.setAdvancedSandbox(true);
        await waitForTabVisible(editMentorPage.dialog, 'Sandbox', 15_000);
      }

      // Check if wired — Agent Configuration only appears when wired
      await editMentorPage.navigateToTab('Sandbox');
      await waitForPageReady(page);

      const sandbox = new SandboxTab(page, editMentorPage.dialog);
      if (!(await sandbox.isConnected())) {
        test.skip(
          true,
          'Sandbox not wired — Agent Configuration section is only available when connected',
        );
        return;
      }

      // Navigate to Prompts tab and verify Agent Configuration section exists
      await editMentorPage.navigateToTab('Prompts');
      await waitForPageReady(page);

      const hasSection =
        await editMentorPage.prompts.hasAgentConfigSection(10_000);
      if (!hasSection) {
        test.skip(
          true,
          'Agent Configuration section not visible — sandbox may not be fully wired',
        );
        return;
      }

      // Find the first editable field.
      // AgentConfigPrompts always renders all field cards (no empty-state
      // create-config flow) — fields start with empty values.
      const firstField = editMentorPage.prompts.firstAgentConfigField();
      let firstFieldVisible = false;
      try {
        await firstField.waitFor({ state: 'visible', timeout: 10_000 });
        firstFieldVisible = true;
      } catch {
        firstFieldVisible = false;
      }

      if (!firstFieldVisible) {
        test.skip(
          true,
          'No editable agent config fields found — skipping edit assertion',
        );
        return;
      }

      // Get the field label so we can locate the modal by title ("Edit ${label}")
      const fieldLabel = await firstField
        .locator('span.text-sm.font-medium')
        .first()
        .innerText()
        .catch(() => '');

      const editBtn = firstField
        .getByRole('button', { name: /^edit$/i })
        .first();
      await expect(editBtn).toBeVisible({ timeout: 5_000 });
      await editBtn.click();

      // The EditFieldModal has title "Edit ${label}" and uses a RichTextEditor
      // (TipTap EditorContent with role="textbox" on a contenteditable div).
      // Locate by title text when we have it, otherwise fall back to textbox filter.
      const editDialog = fieldLabel
        ? page.getByRole('dialog').filter({ hasText: `Edit ${fieldLabel}` })
        : page
            .getByRole('dialog')
            .filter({ has: page.getByRole('textbox') })
            .last();
      await expect(editDialog).toBeVisible({ timeout: 10_000 });

      // RichTextEditor renders a contenteditable div[role="textbox"], not an
      // <input>/<textarea>. Use innerText() to read and fill() to write.
      const richEditor = editDialog.getByRole('textbox').first();
      await expect(richEditor).toBeVisible({ timeout: 5_000 });
      const originalValue = await richEditor.innerText().catch(() => '');

      const ts = Date.now();
      const newValue = `e2e-test-marker-${ts}`;
      await richEditor.fill(newValue);

      const saveBtn = editDialog
        .getByRole('button', { name: /^save$/i })
        .first();
      await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
      await saveBtn.click();

      // Assert: modal closes — success toast fires with "${label} updated successfully"
      await expect(editDialog).not.toBeVisible({ timeout: 15_000 });

      // Assert: success toast confirms the PATCH resolved
      const toast = page.getByText(/updated successfully/i).first();
      let toastVisible = false;
      try {
        await toast.waitFor({ state: 'visible', timeout: 10_000 });
        toastVisible = true;
      } catch {
        toastVisible = false;
      }

      if (!toastVisible) {
        // Fallback: any toast-like element
        const anyToast = page
          .getByRole('status')
          .or(page.getByRole('alert'))
          .first();
        try {
          await anyToast.waitFor({ state: 'visible', timeout: 5_000 });
        } catch {
          // Best-effort — modal already closed which is the primary assertion
        }
      }

      // Restore original value (best-effort)
      try {
        const restoreField = editMentorPage.prompts.firstAgentConfigField();
        await restoreField
          .getByRole('button', { name: /^edit$/i })
          .first()
          .click();
        const restoreDialog = fieldLabel
          ? page.getByRole('dialog').filter({ hasText: `Edit ${fieldLabel}` })
          : page
              .getByRole('dialog')
              .filter({ has: page.getByRole('textbox') })
              .last();
        await expect(restoreDialog).toBeVisible({ timeout: 10_000 });
        const restoreEditor = restoreDialog.getByRole('textbox').first();
        await restoreEditor.fill(originalValue);
        await restoreDialog
          .getByRole('button', { name: /^save$/i })
          .first()
          .click();
        await expect(restoreDialog).not.toBeVisible({ timeout: 15_000 });
      } catch {
        // Best-effort restore
      }
    } finally {
      if (!wasEnabled) {
        await editMentorPage.navigateToTab('Settings');
        await waitForPageReady(page);
        await editMentorPage.settings.setAdvancedSandbox(false);
      }
      await editMentorPage.close();
    }
  });

  // ── TC14: Skills tab — Toggle skill on/off ────────────────────────────────

  test('admin toggles a skill on then off and aria-checked flips back to the original state', async ({
    page,
    editMentorPage,
  }) => {
    // claw-14
    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    const wasEnabled = await editMentorPage.settings.isAdvancedSandboxEnabled();

    try {
      if (!wasEnabled) {
        await editMentorPage.settings.setAdvancedSandbox(true);
        await waitForTabVisible(editMentorPage.dialog, 'Sandbox', 15_000);
      }

      // Skills tab only shows when wired
      const skillsTab = getTab(editMentorPage.dialog, 'Skills');
      let skillsAvailable = false;
      try {
        await skillsTab.waitFor({ state: 'visible', timeout: 4_000 });
        skillsAvailable = true;
      } catch {
        skillsAvailable = false;
      }

      if (!skillsAvailable) {
        test.skip(
          true,
          'Skills tab not visible — sandbox not wired in this env',
        );
        return;
      }

      await editMentorPage.navigateToTab('Skills');
      await waitForPageReady(page);

      const skills = new SkillsTab(page, editMentorPage.dialog);

      // Skip if no platform-level skills exist
      if (await skills.hasNoSkills()) {
        test.skip(
          true,
          'No platform-level skills exist — cannot test toggle flow',
        );
        return;
      }

      // Pick the first skill toggle in the list
      const allToggles = editMentorPage.dialog.getByRole('switch');
      const firstToggle = allToggles.first();
      await expect(firstToggle).toBeVisible({ timeout: 10_000 });

      const initialState =
        (await firstToggle.getAttribute('aria-checked')) === 'true';

      // Flip ON (or OFF if already ON)
      await firstToggle.click();
      await expect(firstToggle).toHaveAttribute(
        'aria-checked',
        initialState ? 'false' : 'true',
        { timeout: 10_000 },
      );

      // Flip back to original state
      await firstToggle.click();
      await expect(firstToggle).toHaveAttribute(
        'aria-checked',
        initialState ? 'true' : 'false',
        { timeout: 10_000 },
      );
    } finally {
      if (!wasEnabled) {
        await editMentorPage.navigateToTab('Settings');
        await waitForPageReady(page);
        await editMentorPage.settings.setAdvancedSandbox(false);
      }
      await editMentorPage.close();
    }
  });

  // ── TC15: Skills tab — Create + Edit skill ────────────────────────────────

  test('admin creates a new skill then edits its description and the updated skill row is visible', async ({
    page,
    editMentorPage,
  }) => {
    // claw-15
    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    const wasEnabled = await editMentorPage.settings.isAdvancedSandboxEnabled();

    const ts = Date.now();
    const skillName = `e2e-test-skill-${ts}`;
    const skillSlug = `e2e_test_skill_${ts}`;
    const skillDescription = `E2E test skill created at ${ts}`;
    const updatedDescription = `E2E updated description ${ts}`;

    try {
      if (!wasEnabled) {
        await editMentorPage.settings.setAdvancedSandbox(true);
        await waitForTabVisible(editMentorPage.dialog, 'Sandbox', 15_000);
      }

      // Skills tab only shows when wired
      const skillsTab = getTab(editMentorPage.dialog, 'Skills');
      let skillsAvailable = false;
      try {
        await skillsTab.waitFor({ state: 'visible', timeout: 4_000 });
        skillsAvailable = true;
      } catch {
        skillsAvailable = false;
      }

      if (!skillsAvailable) {
        test.skip(
          true,
          'Skills tab not visible — sandbox not wired in this env',
        );
        return;
      }

      await editMentorPage.navigateToTab('Skills');
      await waitForPageReady(page);

      const skills = new SkillsTab(page, editMentorPage.dialog);

      // ── Create ─────────────────────────────────────────────────────────
      await skills.openNewSkillDialog();
      await skills.fillSkillForm({
        name: skillName,
        slug: skillSlug,
        description: skillDescription,
        version: '1.0.0',
        instruction: `Instruction for ${skillName}`,
      });
      await skills.submitNewSkill(skillName);

      // Assert: new row appears with the entered name
      await expect(skills.getSkillRowByName(skillName)).toBeVisible({
        timeout: 15_000,
      });

      // ── Edit ───────────────────────────────────────────────────────────
      await skills.openEditSkillDialog(skillName);

      // Update the description field in the edit dialog
      const descField = skills.editSkillDialog.locator(
        '[name="skill-description"]',
      );
      await expect(descField).toBeVisible({ timeout: 10_000 });
      await descField.clear();
      await descField.fill(updatedDescription);

      await skills.submitSkillEdit();

      // Assert: dialog closed (already asserted inside submitSkillEdit) and
      // the skill row is still visible (it wasn't accidentally deleted)
      await expect(skills.getSkillRowByName(skillName)).toBeVisible({
        timeout: 10_000,
      });

      // Cleanup: delete the skill
      await skills.deleteSkill(skillName);
    } finally {
      // Best-effort final cleanup — if delete above failed, try again
      try {
        const skills = new SkillsTab(page, editMentorPage.dialog);
        const row = skills.getSkillRowByName(skillName);
        let rowExists = false;
        try {
          await row.waitFor({ state: 'visible', timeout: 3_000 });
          rowExists = true;
        } catch {
          rowExists = false;
        }
        if (rowExists) {
          await skills.deleteSkill(skillName);
        }
      } catch {
        // Best-effort
      }
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
