/**
 * Journey 44: CLAW Advanced Sandbox
 *
 * Covers the full lifecycle of the "Sandbox" feature (CLAW) in
 * the Edit Mentor modal:
 *
 *   Settings tab  — "Sandbox" toggle
 *   Tab visibility — Sandbox tab (after Settings) and Skills tab (after Prompts)
 *   Prompts tab   — "Agent Configuration" section
 *
 * The Sandbox toggle is "admin intent" — it maps directly to
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

test.describe('Journey 44: CLAW Advanced Sandbox', () => {
  test.beforeEach(async ({ page, createMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'CLAW Sandbox requires admin access');
      return;
    }

    // Create a fresh agent for each test so the Sandbox/Skills flows run
    // against a clean mentor (independent of whatever claw state a prior
    // run or the default mentor was left in).
    await createMentorPage.openAndCreate();
  });

  // ── TC01: Toggle is present in Settings tab ───────────────────────────────

  test('admin opens Settings tab and Sandbox toggle is present', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    // Sandbox toggle moved to Capabilities sub-tab when Settings was split.
    await editMentorPage.settings.selectSubTab('Capabilities');
    await expect(editMentorPage.settings.advancedSandboxToggle).toBeVisible({
      timeout: 10_000,
    });
  });

  // ── TC02: Toggle is always interactable for admins (intent-only) ──────────

  test('Sandbox toggle is interactable regardless of claw config state', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    // Sandbox toggle moved to Capabilities sub-tab when Settings was split.
    await editMentorPage.settings.selectSubTab('Capabilities');
    const toggle = editMentorPage.settings.advancedSandboxToggle;
    await expect(toggle).toBeVisible({ timeout: 10_000 });
    await expect(toggle).toBeEnabled({ timeout: 5_000 });
  });

  // ── TC03: Pre-save state — toggled but not yet saved ─────────────────────
  //
  // Tab visibility is gated on the *persisted* `enable_claw` flag from
  // mentor-settings, so flipping the toggle in the form (without clicking
  // Save) must NOT change which tabs are visible — regardless of which
  // state the persisted flag was already in.
  //
  // Snapshot tab counts BEFORE flipping and assert they're unchanged AFTER.
  // This works for both directions (off→on and on→off) and for any starting
  // tab state, so it doesn't depend on the test environment having CLAW
  // disabled.

  test('admin flips Sandbox toggle but does not save — tab visibility is unchanged', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    // Sandbox toggle moved to Capabilities sub-tab when Settings was split.
    await editMentorPage.settings.selectSubTab('Capabilities');
    const toggle = editMentorPage.settings.advancedSandboxToggle;
    await expect(toggle).toBeVisible({ timeout: 10_000 });

    const wasClaw = await editMentorPage.settings.isAdvancedSandboxEnabled();

    // Snapshot tab visibility BEFORE flipping — this is the ground truth we
    // want to preserve after the in-form-only toggle change.
    const sandboxBefore = await getTab(
      editMentorPage.dialog,
      'Sandbox',
    ).count();
    const skillsBefore = await getTab(editMentorPage.dialog, 'Skills').count();

    // Flip the toggle (don't click Save). Waiting for `aria-checked` to
    // flip is a deterministic signal that React has applied the form-state
    // change — no need for a static settle delay.
    await toggle.click();
    await expect(toggle).toHaveAttribute(
      'aria-checked',
      wasClaw ? 'false' : 'true',
    );

    // Tab visibility must not have changed: the persisted enable_claw value
    // hasn't been updated yet (no Save click), so the Sandbox/Skills tabs
    // must remain in whatever state they were before the flip. toHaveCount
    // is a web-first assertion that retries.
    await expect(getTab(editMentorPage.dialog, 'Sandbox')).toHaveCount(
      sandboxBefore,
    );
    await expect(getTab(editMentorPage.dialog, 'Skills')).toHaveCount(
      skillsBefore,
    );

    // Restore by flipping back, then close without saving
    await toggle.click();
    await expect(toggle).toHaveAttribute(
      'aria-checked',
      wasClaw ? 'true' : 'false',
      { timeout: 5_000 },
    );
    await editMentorPage.close();
  });

  // ── TC04: Golden path — enable CLAW and verify Sandbox tab appears ───────
  //
  // Sandbox tab appears immediately when claw is enabled (so admins can
  // connect a sandbox). Skills tab + Agent Configuration are gated on a wired
  // ClawMentorConfig (sandbox connected to an instance) — those are covered
  // conditionally in TC04b.

  test('admin enables Sandbox and Sandbox tab appears after save (right after Settings)', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    // Sandbox toggle moved to Capabilities sub-tab when Settings was split.
    await editMentorPage.settings.selectSubTab('Capabilities');
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

  test('admin disables Sandbox and Sandbox tab, Skills tab, and Agent Configuration section disappear after save', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    // Sandbox toggle moved to Capabilities sub-tab when Settings was split.
    await editMentorPage.settings.selectSubTab('Capabilities');
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

test.describe('Journey 44: CLAW Advanced Sandbox — deeper lifecycle', () => {
  test.beforeEach(async ({ page, createMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'CLAW Sandbox requires admin access');
      return;
    }

    // Create a fresh agent for each test so the Sandbox/Skills flows run
    // against a clean mentor (independent of whatever claw state a prior
    // run or the default mentor was left in).
    await createMentorPage.openAndCreate();
  });

  test('admin toggles Sandbox ON then OFF and Sandbox tab appears then disappears in the same session', async ({
    page,
    editMentorPage,
  }) => {
    // claw-09
    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    // Sandbox toggle moved to Capabilities sub-tab when Settings was split.
    await editMentorPage.settings.selectSubTab('Capabilities');
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

    // Add Instance UI lives only in the not-connected state. If env has a
    // wired sandbox we capture the instance name, disconnect to reach the
    // picker, then reconnect at the end to restore the env.
    let priorConnectedInstance: string | null = null;

    try {
      if (!wasEnabled) {
        await editMentorPage.settings.setAdvancedSandbox(true);
        await waitForTabVisible(editMentorPage.dialog, 'Sandbox', 15_000);
      }

      await editMentorPage.navigateToTab('Sandbox');
      await waitForPageReady(page);

      const sandbox = new SandboxTab(page, editMentorPage.dialog);

      if (await sandbox.isConnected()) {
        priorConnectedInstance = await sandbox.getConnectedInstanceName();
        await sandbox.disconnect();
      }

      const ts = Date.now();
      const instanceName = `e2e-instance-${ts}`;
      const instanceUrl = `https://test-sandbox-${ts}.example.com`;

      await sandbox.openAddInstanceDialog();
      await sandbox.fillNewInstance({
        name: instanceName,
        url: instanceUrl,
        type: 'OpenClaw',
        // Gateway Token is required by the form — Create button stays
        // disabled without it. The token won't be valid for a real claw
        // backend but that's fine for this UI flow test; we delete the
        // instance afterwards.
        token: `e2e-fake-token-${ts}`,
      });
      // submitNewInstance waits for the "Instance created" toast, the
      // dialog close, and the new row appearing in the table — those are
      // the test's assertions for the happy path.
      await sandbox.submitNewInstance(instanceName);

      // Cleanup: delete the throwaway instance. clickDeleteInRow waits
      // for the "Instance deleted" toast internally.
      try {
        await sandbox.clickDeleteInRow(
          sandbox.getInstanceRowByName(instanceName),
        );
      } catch {
        // Best-effort — don't fail teardown
      }
    } finally {
      // Restore the env's original connection (best-effort).
      if (priorConnectedInstance) {
        try {
          const sandbox = new SandboxTab(page, editMentorPage.dialog);
          await editMentorPage.navigateToTab('Sandbox');
          await waitForPageReady(page);
          await sandbox.reconnectByName(priorConnectedInstance);
        } catch {
          // Best-effort — env may be left disconnected if reconnect fails
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

  // ── TC11: Sandbox tab — Edit instance dialog opens with current values ────
  //
  // The Edit Instance form initialises `gateway_token` to '' for security
  // (the real token is not echoed back from the server). The form's Save
  // button is gated on `name && server_url && gateway_token` so persisting
  // an edit always requires re-entering the token — and we don't have the
  // real token in tests. To avoid corrupting an existing instance's token,
  // we don't actually save here; we create a throwaway instance, edit its
  // name (re-providing the same fake token we used to create it), confirm
  // the rename round-trips, then delete the instance.

  test('admin edits a sandbox instance name and the renamed row appears in the table', async ({
    page,
    editMentorPage,
  }) => {
    // claw-11
    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    const wasEnabled = await editMentorPage.settings.isAdvancedSandboxEnabled();

    const ts = Date.now();
    const fakeToken = `e2e-fake-token-${ts}`;
    const instanceName = `e2e-edit-instance-${ts}`;
    const renamed = `${instanceName}-renamed`;

    let priorConnectedInstance: string | null = null;

    try {
      if (!wasEnabled) {
        await editMentorPage.settings.setAdvancedSandbox(true);
        await waitForTabVisible(editMentorPage.dialog, 'Sandbox', 15_000);
      }

      await editMentorPage.navigateToTab('Sandbox');
      await waitForPageReady(page);

      const sandbox = new SandboxTab(page, editMentorPage.dialog);

      // Edit Instance UI is only in the not-connected state. If env has a
      // wired sandbox we capture the connected instance name, disconnect,
      // and reconnect afterwards to restore the env.
      if (await sandbox.isConnected()) {
        priorConnectedInstance = await sandbox.getConnectedInstanceName();
        await sandbox.disconnect();
      }

      // Create a throwaway instance we can safely edit + delete.
      await sandbox.openAddInstanceDialog();
      await sandbox.fillNewInstance({
        name: instanceName,
        url: `https://e2e-edit-${ts}.example.com`,
        type: 'OpenClaw',
        token: fakeToken,
      });
      await sandbox.submitNewInstance(instanceName);

      await sandbox.clickEditInRow(sandbox.getInstanceRowByName(instanceName));
      await sandbox.editInstanceNameInput.fill(renamed);

      // Save requires re-entering the token — the bundle's EditInstanceDialog
      // initialises `gateway_token` to '' for security and gates Save on
      // `name && server_url && gateway_token`.
      await sandbox.editInstanceTokenInput.fill(fakeToken);

      // saveInstanceEdit waits for "Instance updated" toast + dialog close.
      await sandbox.saveInstanceEdit();
      await expect(sandbox.getInstanceRowByName(renamed)).toBeVisible();

      // Cleanup: delete the renamed instance.
      try {
        await sandbox.clickDeleteInRow(sandbox.getInstanceRowByName(renamed));
      } catch {
        // Best-effort
      }
    } finally {
      // Final fallback cleanup — try to delete by either name in case an
      // earlier step threw before completion.
      try {
        const sandbox = new SandboxTab(page, editMentorPage.dialog);
        for (const name of [renamed, instanceName]) {
          const r = sandbox.getInstanceRowByName(name);
          if (
            await r
              .first()
              .isVisible()
              .catch(() => false)
          ) {
            await sandbox.clickDeleteInRow(r).catch(() => {});
          }
        }
      } catch {
        // Best-effort
      }
      // Restore the env's original wired connection (best-effort).
      if (priorConnectedInstance) {
        try {
          const sandbox = new SandboxTab(page, editMentorPage.dialog);
          await editMentorPage.navigateToTab('Sandbox');
          await waitForPageReady(page);
          await sandbox.reconnectByName(priorConnectedInstance);
        } catch {
          // Best-effort — env may be left disconnected if reconnect fails
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

    let priorConnectedInstance: string | null = null;

    try {
      if (!wasEnabled) {
        await editMentorPage.settings.setAdvancedSandbox(true);
        await waitForTabVisible(editMentorPage.dialog, 'Sandbox', 15_000);
      }

      await editMentorPage.navigateToTab('Sandbox');
      await waitForPageReady(page);

      const sandbox = new SandboxTab(page, editMentorPage.dialog);

      // The Connect flow asserts the NOT-connected → connected transition.
      // If env is already wired, capture the connected instance name and
      // disconnect — we'll then re-use the connect flow to restore it.
      if (await sandbox.isConnected()) {
        priorConnectedInstance = await sandbox.getConnectedInstanceName();
        await sandbox.disconnect();
      }

      // Pick a connectable target. Prefer the env's prior-wired instance
      // (it was healthy enough to be wired before) so reconnecting also
      // restores the env. Otherwise find any healthy OpenClaw instance.
      // Connect is disabled in the dropdown for instances with status
      // "Error" — picking the first row blindly can land on an unhealthy
      // row and the onSelect handler will short-circuit, leaving the test
      // hung waiting for `connectedHeading`.
      let targetName = priorConnectedInstance;
      if (!targetName) {
        targetName = await sandbox.findConnectableOpenClawInstance();
      }

      if (!targetName) {
        test.skip(
          true,
          'No connectable OpenClaw instance available — Connect requires a healthy instance (status not "Error")',
        );
        return;
      }

      const targetRow = sandbox.getInstanceRowByName(targetName);
      await expect(targetRow).toBeVisible({ timeout: 10_000 });
      await sandbox.clickConnect(targetRow);

      // Assert: "Connected Instance" heading appeared
      await expect(sandbox.connectedHeading.first()).toBeVisible({
        timeout: 15_000,
      });

      // Assert: Skills tab is now visible (wired → Skills-visible transition)
      await waitForTabVisible(editMentorPage.dialog, 'Skills', 15_000);

      if (priorConnectedInstance === null) {
        // We connected to an existing healthy instance — disconnect to
        // restore the env's not-connected state. The instance row stays
        // in the table because it's not ours.
        await sandbox.disconnect();
      } else {
        // We reconnected the env's original instance — env is restored,
        // clear marker so finally doesn't try a second reconnect.
        priorConnectedInstance = null;
      }
    } finally {
      // Final fallback: if anything threw mid-test, attempt to restore
      // the env's original wired connection (best-effort).
      try {
        if (priorConnectedInstance) {
          const sandbox = new SandboxTab(page, editMentorPage.dialog);
          await editMentorPage.navigateToTab('Sandbox');
          await waitForPageReady(page);
          await sandbox.reconnectByName(priorConnectedInstance);
        }
      } catch {
        // Best-effort — env may be left in not-connected state if reconnect fails
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

    // Agent Configuration is gated on a wired sandbox. If env isn't
    // already connected, attempt to wire a healthy OpenClaw instance so
    // the test can actually exercise the edit flow. We track whether WE
    // connected so the finally can restore the env's not-connected state.
    let createdConnectionHere = false;

    try {
      if (!wasEnabled) {
        await editMentorPage.settings.setAdvancedSandbox(true);
        await waitForTabVisible(editMentorPage.dialog, 'Sandbox', 15_000);
      }

      await editMentorPage.navigateToTab('Sandbox');
      await waitForPageReady(page);

      const sandbox = new SandboxTab(page, editMentorPage.dialog);
      const connected = await sandbox.ensureConnected();
      if (!connected.instanceName) {
        test.skip(
          true,
          'No connectable OpenClaw instance available — Agent Configuration requires a wired sandbox',
        );
        return;
      }
      createdConnectionHere = connected.createdConnection;

      // Navigate to Prompts tab. The Agent Configuration section lives at
      // the bottom of the panel; AgentConfigPrompts shows a loading spinner
      // until `useGetClawMentorConfigQuery` and `useGetAgentConfigQuery`
      // resolve, then renders the 8 field cards from AGENT_WORKSPACE_FIELDS
      // in this fixed order: Identity, Soul, User Context, Tools, Agents,
      // Bootstrap, Heartbeat, Memory.
      await editMentorPage.navigateToTab('Prompts');

      // Wait for the FIRST field's card by its known label. This ride out
      // the loading spinner without a hand-tuned timeout — Playwright's
      // auto-retrying expect polls until the element is visible or the
      // suite-level expect timeout elapses. Click() also auto-scrolls so
      // we don't need scrollIntoViewIfNeeded.
      const fieldLabel = 'Identity';
      const fieldCard = editMentorPage.prompts
        .agentConfigFieldRowByLabel(fieldLabel)
        .first();
      await expect(fieldCard).toBeVisible();

      const newValue = `e2e-test-marker-${Date.now()}`;

      // editAgentConfigField opens the OverlayModal (matched by accessible
      // name "Edit Identity"), drives the TipTap contenteditable via real
      // keyboard events, clicks Save, and waits for the modal to close.
      const originalValue = await editMentorPage.prompts.editAgentConfigField(
        fieldLabel,
        newValue,
      );

      // The component shows `${label} updated successfully` via sonner —
      // this is the only externally observable signal that the PATCH
      // resolved successfully.
      await expect(
        page.getByText(`${fieldLabel} updated successfully`).first(),
      ).toBeVisible();

      // Restore original value so re-runs on the same env don't accumulate
      // marker text. Best-effort — never fails the test.
      try {
        await editMentorPage.prompts.editAgentConfigField(
          fieldLabel,
          originalValue,
        );
      } catch {
        // Best-effort restore
      }
    } finally {
      // If WE created the connection (env was not connected at start),
      // disconnect to restore the not-connected state.
      if (createdConnectionHere) {
        try {
          const sandbox = new SandboxTab(page, editMentorPage.dialog);
          await editMentorPage.navigateToTab('Sandbox');
          await waitForPageReady(page);
          if (await sandbox.isConnected(5_000)) {
            await sandbox.disconnect();
          }
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

  // ── TC14: Skills tab — Toggle skill on/off ────────────────────────────────

  test('admin toggles a skill on then off and aria-checked flips back to the original state', async ({
    page,
    editMentorPage,
  }) => {
    // claw-14
    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    const wasEnabled = await editMentorPage.settings.isAdvancedSandboxEnabled();

    // Skills tab is gated on a wired sandbox. If env isn't connected,
    // wire a healthy OpenClaw instance up-front so the tab is reachable.
    let createdConnectionHere = false;

    try {
      if (!wasEnabled) {
        await editMentorPage.settings.setAdvancedSandbox(true);
        await waitForTabVisible(editMentorPage.dialog, 'Sandbox', 15_000);
      }

      await editMentorPage.navigateToTab('Sandbox');
      await waitForPageReady(page);

      const sandbox = new SandboxTab(page, editMentorPage.dialog);
      const connected = await sandbox.ensureConnected();
      if (!connected.instanceName) {
        test.skip(
          true,
          'No connectable OpenClaw instance available — Skills tab requires a wired sandbox',
        );
        return;
      }
      createdConnectionHere = connected.createdConnection;

      // After a fresh Connect, Skills tab needs a moment to render.
      await waitForTabVisible(editMentorPage.dialog, 'Skills', 15_000);

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
      // If WE wired the sandbox, disconnect to restore not-connected state.
      if (createdConnectionHere) {
        try {
          const sandbox = new SandboxTab(page, editMentorPage.dialog);
          await editMentorPage.navigateToTab('Sandbox');
          await waitForPageReady(page);
          if (await sandbox.isConnected(5_000)) {
            await sandbox.disconnect();
          }
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

    // Skills tab is gated on a wired sandbox. If env isn't connected,
    // wire a healthy OpenClaw instance first; we'll disconnect after the
    // test if WE were the ones that connected it.
    let createdConnectionHere = false;

    try {
      if (!wasEnabled) {
        await editMentorPage.settings.setAdvancedSandbox(true);
        await waitForTabVisible(editMentorPage.dialog, 'Sandbox', 15_000);
      }

      await editMentorPage.navigateToTab('Sandbox');
      await waitForPageReady(page);

      const sandbox = new SandboxTab(page, editMentorPage.dialog);
      const connected = await sandbox.ensureConnected();
      if (!connected.instanceName) {
        test.skip(
          true,
          'No connectable OpenClaw instance available — Skills tab requires a wired sandbox',
        );
        return;
      }
      createdConnectionHere = connected.createdConnection;

      // After Connect, Skills tab needs a moment to render.
      await waitForTabVisible(editMentorPage.dialog, 'Skills', 15_000);

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
      // submitNewSkill already waits for the "Skill created" toast, the
      // dialog close, and the new row to appear in the list.
      await skills.submitNewSkill(skillName);

      // ── Edit ───────────────────────────────────────────────────────────
      await skills.openEditSkillDialog(skillName);

      // Update the description field. The bundle renders this as a regular
      // <input name="skill-description"> so .fill() works directly.
      await skills.editSkillDescriptionInput.fill(updatedDescription);

      await skills.submitSkillEdit();

      // submitSkillEdit already waits for the "Skill updated" toast and
      // dialog close. Verify the row wasn't accidentally deleted.
      await expect(skills.getSkillRowByName(skillName)).toBeVisible();

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
      // If WE wired the sandbox, disconnect to restore not-connected state.
      if (createdConnectionHere) {
        try {
          const sandbox = new SandboxTab(page, editMentorPage.dialog);
          await editMentorPage.navigateToTab('Sandbox');
          await waitForPageReady(page);
          if (await sandbox.isConnected(5_000)) {
            await sandbox.disconnect();
          }
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
});

// ── Non-admin: Sandbox and Skills tabs invisible even when claw is enabled ───

test.describe('Journey 44: CLAW Advanced Sandbox — Non-Admin', () => {
  test('non-admin does not see Sandbox or Skills tabs in the Edit Mentor modal', async ({
    nonadminPage,
    nonadminEditMentorPage,
  }) => {
    await navigateToMentorApp(nonadminPage);

    // Non-admin cannot open the edit mentor modal via the mentor dropdown
    // (the Settings menu item is hidden). We assert the tabs are absent by
    // checking the mentor dropdown does not expose a Modify / Settings
    // option. The mentor → agent rename moved this button's accessible
    // name to "Selected agent dropdown button"; accept either label so the
    // test is resilient to further renames.
    const dropdown = nonadminPage.getByRole('button', {
      name: /^Selected (agent|mentor) dropdown button$/,
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
