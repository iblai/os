/**
 * Journey 44: CLAW Advanced Sandbox
 *
 * Covers the full lifecycle of the "Sandbox" feature (CLAW) in
 * the Edit Mentor modal:
 *
 *   Sandbox tab   — "Dedicated sandbox" capability toggle (in-tab)
 *   Tab visibility — Sandbox tab is ALWAYS visible to admins; Skills tab is
 *                    always visible to admins ON BASE AGENT MENTORS (the
 *                    only mentor type `CreateMentorPage`'s UI can produce —
 *                    see the feat/2215 note below)
 *   Prompts tab   — "Agent Configuration" section
 *
 * ── Capability-gate refactor ─────────────────────────────────────────────
 *
 * The "Dedicated sandbox" (`enable_claw`) toggle used to live in
 * Settings → Capabilities and gate the Sandbox top-level tab's visibility.
 * It now lives inline at the top of the Sandbox tab itself via the shared
 * `CapabilityGate` component (`components/modals/edit-mentor-modal/capability-gate.tsx`),
 * and `hooks/use-mentor-segments.ts` no longer gates the Sandbox segment on
 * `enable_claw` at all — the tab is ALWAYS mounted for admins. The toggle
 * auto-saves on click (`SandboxTab`'s `handleToggleClaw` calls
 * `useEditMentorMutation` directly with optimistic local state) — there is
 * no more "flipped but not saved" intermediate state, and no footer Save
 * button involved for the toggle itself.
 *
 * The gated `SandboxConfig` UI (instance picker / connected-instance panel)
 * renders inside a grayed + inert wrapper (`data-testid="capability-gate-content"`,
 * `data-enabled` mirrors the toggle) while the capability is off. Per the
 * `CapabilityGate` contract, interacting with that content (Add Instance,
 * Connect, Edit, Delete) is not a supported flow while `data-enabled="false"`
 * — every mutation test below turns the capability on first.
 *
 * The Skills top-level tab was previously gated on
 * `enable_claw && clawConfigExists` (BOTH the capability on AND a wired
 * ClawMentorConfig); it is now unconditionally mounted with respect to the
 * sandbox. feat/2040 went further and made the Skills CONTENT fully
 * independent of the sandbox too — the SDK's `AgentSkills` component always
 * renders the real skills UI (heading, info box, "New Skill" action), never
 * a "connect a sandbox" gate, whether or not a `ClawMentorConfig` is wired.
 *
 * Because tab visibility is no longer coupled to `enable_claw` at all, this
 * journey no longer waits for tabs to appear/disappear — it asserts the
 * capability toggle's effect on the GATED CONTENT (`data-enabled`) instead.
 *
 * feat/2215 (Agent Skills) added an ORTHOGONAL gate on top of the above: the
 * Skills segment is now also conditioned on `flags.isBaseAgent`
 * (`hooks/use-mentor-segments.ts` → `resolveIsBaseAgentMentor`) — Agent
 * Skills only apply to Base Agent mentors. Every mentor this journey creates
 * goes through `CreateMentorPage`, whose UI has no agent-type picker and
 * only ever produces Base Agent mentors, so `isBaseAgent` is always true
 * here and every "Skills tab visible" assertion below is unaffected. The
 * mentor-type gate itself (hidden for non-base-agent mentors, fails OPEN
 * when the type can't be determined) is covered separately in journey 67
 * (`e2e/journeys/67-agent-skills.spec.ts`), which mocks the mentor-settings
 * response since no UI path here can produce a non-base-agent mentor.
 *
 * Non-admin users must not see the Sandbox or Skills tabs regardless of
 * claw state (those segments remain ADMIN-only in use-mentor-segments.ts —
 * unaffected by this refactor).
 */

import { test, expect } from '../fixtures/mentor-test';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { MentorTracker } from '../utils/mentor-cleanup';
import { SandboxTab } from '../page-objects/edit-mentor/sandbox.tab';
import { SkillsTab } from '../page-objects/edit-mentor/skills.tab';
import type { Locator } from '@playwright/test';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns a SEGMENT-tab locator by exact label, scoped to the currently
 * visible (active-category) sidebar list. The Edit Agent modal groups its
 * tabs under a Configurations / Integrations / Runtime category strip and
 * only mounts the ACTIVE category's segment tabs, so the target tab's
 * category must be active first (`navigateToTab` handles that). Filtering on
 * `[aria-controls^="panel-"]:visible` also excludes the category pills (which
 * share `role="tab"` but own no `aria-controls`) and each segment's hidden
 * responsive twin.
 */
function getTab(dialog: Locator, name: string): Locator {
  return dialog
    .getByRole('tab', { name, exact: true })
    .and(dialog.locator('[aria-controls^="panel-"]:visible'));
}

/** Text labels of the currently-visible segment tabs (active category only). */
async function visibleSegmentTabLabels(dialog: Locator): Promise<string[]> {
  return dialog
    .locator('[role="tab"][aria-controls^="panel-"]:visible')
    .allTextContents();
}

// ─── Tests ───────────────────────────────────────────────────────────────────

// Run the WHOLE file serially in a single worker. Sandbox instances are
// PLATFORM-WIDE (`useGetClawInstancesQuery({ org: platformKey })` — not
// mentor-scoped), so even though every test below creates its own dedicated
// mentor, the instance-table mutation tests (Add/Edit/Connect/Delete) still
// share the same underlying instance catalog across the whole tenant. Two
// tests deleting/reconnecting instances concurrently in different workers
// would flake intermittently. This is declared at the file's top level (not
// per-describe) ON PURPOSE — see journey 47's mirrored note.
test.describe.configure({ mode: 'serial' });

test.describe('Journey 44: CLAW Advanced Sandbox', () => {
  const tracker44A = new MentorTracker();

  test.beforeEach(async ({ page, createMentorPage, editMentorPage }) => {
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
    const { mentorId } = await getPlatformContext(page);
    tracker44A.add(mentorId);

    // Open the Edit Agent modal once here so each test starts with it mounted
    // (mirrors journey 47's beforeEach). Landing on Settings — always present
    // and in the default Configurations category — is a neutral anchor; each
    // test then navigateToTab()s to whatever it needs. open() blocks until the
    // modal finishes hydrating (it can spin ~30s+ on a just-created mentor).
    await editMentorPage.open('Settings');
  });

  // ── TC01: Capability toggle is present on the Sandbox tab ────────────────

  test('admin opens Sandbox tab and the Dedicated sandbox capability toggle is present', async ({
    page,
    editMentorPage,
  }) => {
    // Sandbox is always visible now — no Settings dependency.
    await editMentorPage.navigateToTab('Sandbox');
    await waitForPageReady(page);

    const sandbox = new SandboxTab(page, editMentorPage.dialog);
    await expect(sandbox.capabilityToggle).toBeVisible({ timeout: 10_000 });
    await editMentorPage.close();
  });

  // ── TC02: Toggle is always interactable for admins (intent-only) ──────────

  test('capability toggle is interactable regardless of sandbox connection state', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.navigateToTab('Sandbox');
    await waitForPageReady(page);

    const sandbox = new SandboxTab(page, editMentorPage.dialog);
    await expect(sandbox.capabilityToggle).toBeVisible({ timeout: 10_000 });
    await expect(sandbox.capabilityToggle).toBeEnabled({ timeout: 5_000 });
    await editMentorPage.close();
  });

  // ── TC03: Toggle auto-saves — Sandbox/Skills tab visibility is unaffected ─
  //
  // The toggle used to be a form field that only persisted on the modal's
  // footer Save click, and tab visibility used to depend on that persisted
  // value. Both are gone: the toggle now auto-saves immediately (optimistic
  // local state + `useEditMentorMutation`), and the Sandbox/Skills tabs are
  // unconditionally mounted regardless of the capability's value. This
  // checkpoint asserts both: the toggle flips right away, and tab presence
  // never changes.

  test('flipping the capability toggle auto-saves instantly and does not affect Sandbox or Skills tab visibility', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.navigateToTab('Sandbox');
    await waitForPageReady(page);

    const sandbox = new SandboxTab(page, editMentorPage.dialog);
    await expect(sandbox.capabilityToggle).toBeVisible({ timeout: 10_000 });

    // The Sandbox tab (Integrations category) is present before we touch the
    // toggle.
    await expect(getTab(editMentorPage.dialog, 'Sandbox')).toBeVisible();

    const wasEnabled = await sandbox.isCapabilityEnabled();

    // Flip and confirm the instant (optimistic) round trip. The Sandbox tab
    // stays mounted regardless of the capability value — it is no longer gated
    // on `enable_claw`.
    await sandbox.setCapabilityEnabled(!wasEnabled);
    await expect(getTab(editMentorPage.dialog, 'Sandbox')).toBeVisible();

    // Restore.
    await sandbox.setCapabilityEnabled(wasEnabled);
    await expect(getTab(editMentorPage.dialog, 'Sandbox')).toBeVisible();

    // Skills lives in the Configurations category, so it is never rendered at
    // the same time as Sandbox. Switch categories to confirm it too is
    // unconditionally mounted (its visibility never depended on the sandbox
    // capability either).
    await editMentorPage.navigateToTab('Skills');
    await expect(getTab(editMentorPage.dialog, 'Skills')).toBeVisible();

    await editMentorPage.close();
  });

  // ── TC04: Enabling the capability ungates the SandboxConfig content ──────

  test('enabling the capability flips capability-gate-content to data-enabled="true"', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.navigateToTab('Sandbox');
    await waitForPageReady(page);

    const sandbox = new SandboxTab(page, editMentorPage.dialog);
    const wasEnabled = await sandbox.isCapabilityEnabled();

    try {
      await sandbox.setCapabilityEnabled(true);
      await expect(sandbox.capabilityContent).toHaveAttribute(
        'data-enabled',
        'true',
        { timeout: 10_000 },
      );

      // Verify ordering while we're here: Sandbox leads the Integrations
      // category (feat/2040 moved it off Configurations, so it is no longer
      // adjacent to Settings — Settings lives in Configurations).
      const integrationTabs = await visibleSegmentTabLabels(
        editMentorPage.dialog,
      );
      expect(integrationTabs.findIndex((t) => /sandbox/i.test(t))).toBe(0);
    } finally {
      await sandbox.setCapabilityEnabled(wasEnabled);
      await editMentorPage.close();
    }
  });

  // ── TC05: Skills tab is always visible and shows the skills UI ───────────
  //
  // Skills tab visibility no longer depends on `enable_claw` /
  // `clawConfigExists` at all, AND feat/2040 made the Skills content itself
  // fully independent of the sandbox: the tab always renders the real skills
  // UI (heading + info box + "New Skill" action), never a "connect a sandbox"
  // gate — regardless of whether a `ClawMentorConfig` is wired.

  test('Skills tab is always visible and shows the skills UI independent of the sandbox', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.navigateToTab('Settings');
    await waitForPageReady(page);
    // Skills tab is always mounted for admins — no toggle/save needed.
    await expect(getTab(editMentorPage.dialog, 'Skills')).toBeVisible({
      timeout: 10_000,
    });

    // Verify ordering: Skills sits right after Prompts (both in the
    // Configurations category, which is active here).
    const configTabs = await visibleSegmentTabLabels(editMentorPage.dialog);
    const promptsIdx = configTabs.findIndex((t) => /prompts/i.test(t));
    const skillsIdx = configTabs.findIndex((t) => /skills/i.test(t));
    expect(skillsIdx).toBe(promptsIdx + 1);

    await editMentorPage.navigateToTab('Skills');
    await waitForPageReady(page);

    // The skills UI renders unconditionally now — the "New Skill" action is the
    // authoritative signal that it mounted (no sandbox connection required).
    const skills = new SkillsTab(page, editMentorPage.dialog);
    await expect(skills.newSkillButton).toBeVisible({ timeout: 10_000 });

    await editMentorPage.close();
  });

  // ── TC06: Tabs sit in their fixed category positions unconditionally ─────
  //
  // feat/2040 groups the sidebar into Configurations / Integrations / Runtime
  // categories. Sandbox now LEADS the Integrations category (no longer
  // adjacent to Settings), while Skills still follows Prompts within
  // Configurations. Only the active category's segment tabs are mounted, so
  // this checks each category in turn.

  test('Sandbox leads the Integrations category and Skills follows Prompts in Configurations, unconditionally', async ({
    page,
    editMentorPage,
  }) => {
    // Configurations: Skills sits right after Prompts.
    await editMentorPage.navigateToTab('Settings');
    await waitForPageReady(page);
    const configTabs = await visibleSegmentTabLabels(editMentorPage.dialog);
    const promptsIdx = configTabs.findIndex((t) => /prompts/i.test(t));
    const skillsIdx = configTabs.findIndex((t) => /skills/i.test(t));
    expect(skillsIdx).toBe(promptsIdx + 1);

    // Integrations: Sandbox is the first tab.
    await editMentorPage.navigateToTab('Sandbox');
    await waitForPageReady(page);
    const integrationTabs = await visibleSegmentTabLabels(
      editMentorPage.dialog,
    );
    expect(integrationTabs.findIndex((t) => /sandbox/i.test(t))).toBe(0);

    await editMentorPage.close();
  });

  // ── TC07: Disabling the capability regates the SandboxConfig content ─────

  test('disabling the capability flips capability-gate-content back to data-enabled="false" while both tabs remain visible', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.navigateToTab('Sandbox');
    await waitForPageReady(page);

    const sandbox = new SandboxTab(page, editMentorPage.dialog);
    const wasEnabled = await sandbox.isCapabilityEnabled();

    try {
      await sandbox.setCapabilityEnabled(true);
      await expect(sandbox.capabilityContent).toHaveAttribute(
        'data-enabled',
        'true',
        { timeout: 10_000 },
      );

      await sandbox.setCapabilityEnabled(false);
      await expect(sandbox.capabilityContent).toHaveAttribute(
        'data-enabled',
        'false',
        { timeout: 10_000 },
      );

      // The Sandbox tab stays mounted regardless of the capability value.
      await expect(getTab(editMentorPage.dialog, 'Sandbox')).toBeVisible();

      // Skills (Configurations category) likewise stays mounted — switch
      // categories to confirm, since it is never co-visible with Sandbox.
      await editMentorPage.navigateToTab('Skills');
      await expect(getTab(editMentorPage.dialog, 'Skills')).toBeVisible();
    } finally {
      // Restore the capability — navigate back to the Sandbox tab first, as
      // the Skills assertion above left the Configurations category active.
      await editMentorPage.navigateToTab('Sandbox');
      await sandbox.setCapabilityEnabled(wasEnabled);
      await editMentorPage.close();
    }
  });

  // ── TC08: Sandbox tab can be navigated to and renders its container ───────

  test('admin navigates to Sandbox tab and sandbox config container is visible', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.navigateToTab('Sandbox');
    await waitForPageReady(page);

    // The SandboxConfig component from @iblai/iblai-js/web-containers renders
    // inside the tabpanel regardless of the capability's on/off state (it's
    // grayed + inert when off, not unmounted). Verify the panel is visible.
    const sandboxPanel = editMentorPage.dialog.getByRole('tabpanel').first();
    await expect(sandboxPanel).toBeVisible({ timeout: 10_000 });

    await editMentorPage.close();
  });

  test.afterAll(async ({ browser }, testInfo) => {
    await tracker44A.deleteAll(browser, testInfo);
  });
});

// ── TC09: Toggle on/off lifecycle in a single session ────────────────────────

test.describe('Journey 44: CLAW Advanced Sandbox — deeper lifecycle', () => {
  const tracker44B = new MentorTracker();

  test.beforeEach(async ({ page, createMentorPage, editMentorPage }) => {
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
    const { mentorId } = await getPlatformContext(page);
    tracker44B.add(mentorId);

    // Open the Edit Agent modal once here (see describe-A's beforeEach) so
    // each test starts with it mounted on a neutral Settings anchor.
    await editMentorPage.open('Settings');
  });

  test('admin toggles the capability ON then OFF and capability-gate-content flips data-enabled both times', async ({
    page,
    editMentorPage,
  }) => {
    // claw-09
    await editMentorPage.navigateToTab('Sandbox');
    await waitForPageReady(page);

    const sandbox = new SandboxTab(page, editMentorPage.dialog);
    const originalState = await sandbox.isCapabilityEnabled();

    try {
      // ── Phase 1: enable → content ungates ──────────────────────────────
      await sandbox.setCapabilityEnabled(true);
      await expect(sandbox.capabilityContent).toHaveAttribute(
        'data-enabled',
        'true',
        { timeout: 10_000 },
      );

      // ── Phase 2: disable → content regates ─────────────────────────────
      await sandbox.setCapabilityEnabled(false);
      await expect(sandbox.capabilityContent).toHaveAttribute(
        'data-enabled',
        'false',
        { timeout: 10_000 },
      );
    } finally {
      // Restore original state
      if (originalState !== (await sandbox.isCapabilityEnabled())) {
        await sandbox.setCapabilityEnabled(originalState);
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
    await editMentorPage.navigateToTab('Sandbox');
    await waitForPageReady(page);

    const sandbox = new SandboxTab(page, editMentorPage.dialog);
    const wasEnabled = await sandbox.isCapabilityEnabled();

    // Add Instance UI lives inside the gated content — interacting with it
    // requires the capability to be on first (CapabilityGate contract). If
    // env has a wired sandbox we capture the instance name, disconnect to
    // reach the picker, then reconnect at the end to restore the env.
    let priorConnectedInstance: string | null = null;

    try {
      if (!wasEnabled) {
        await sandbox.setCapabilityEnabled(true);
      }

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
      // submitNewInstance waits for the dialog close and the new row
      // appearing in the table — those are the test's assertions for the
      // happy path.
      await sandbox.submitNewInstance(instanceName);

      // Cleanup: delete the throwaway instance.
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
          await sandbox.reconnectByName(priorConnectedInstance);
        } catch {
          // Best-effort — env may be left disconnected if reconnect fails
        }
      }
      if (!wasEnabled) {
        await sandbox.setCapabilityEnabled(false);
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
    await editMentorPage.navigateToTab('Sandbox');
    await waitForPageReady(page);

    const sandbox = new SandboxTab(page, editMentorPage.dialog);
    const wasEnabled = await sandbox.isCapabilityEnabled();

    const ts = Date.now();
    const fakeToken = `e2e-fake-token-${ts}`;
    const instanceName = `e2e-edit-instance-${ts}`;
    const renamed = `${instanceName}-renamed`;

    let priorConnectedInstance: string | null = null;

    try {
      if (!wasEnabled) {
        await sandbox.setCapabilityEnabled(true);
      }

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

      // saveInstanceEdit waits for the dialog to close.
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
          await sandbox.reconnectByName(priorConnectedInstance);
        } catch {
          // Best-effort — env may be left disconnected if reconnect fails
        }
      }
      if (!wasEnabled) {
        await sandbox.setCapabilityEnabled(false);
      }
      await editMentorPage.close();
    }
  });

  // ── TC12: Sandbox tab — Connect to instance ────────────────────────────────
  //
  // Clicking the row's dedicated Connect button (`connect-instance-<id>`,
  // next to the "Actions" three-dot menu — Connect is no longer a dropdown
  // item) wires the mentor to a Claw instance. After connect the "Connected
  // Instance" heading must appear, AND the Skills tab content must reflect
  // the wired state (no longer "not connected").

  test('admin connects a sandbox instance via the dedicated Connect button and Connected Instance heading appears and Skills tab reflects the wired state', async ({
    page,
    editMentorPage,
  }) => {
    // claw-12
    await editMentorPage.navigateToTab('Sandbox');
    await waitForPageReady(page);

    const sandbox = new SandboxTab(page, editMentorPage.dialog);
    const wasEnabled = await sandbox.isCapabilityEnabled();

    let priorConnectedInstance: string | null = null;

    try {
      if (!wasEnabled) {
        await sandbox.setCapabilityEnabled(true);
      }

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
      // The dedicated Connect button is disabled for instances with status
      // "Error" — picking the first row blindly can land on an unhealthy
      // row and the click would no-op, leaving the test hung waiting for
      // `connectedHeading`.
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

      // Assert: Skills tab content reflects the wired state (no longer
      // "not connected"). The tab itself was already always visible.
      await editMentorPage.navigateToTab('Skills');
      await waitForPageReady(page);
      const skills = new SkillsTab(page, editMentorPage.dialog);
      expect(await skills.isNotConnected(10_000)).toBe(false);
      await editMentorPage.navigateToTab('Sandbox');
      await waitForPageReady(page);

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
          await sandbox.reconnectByName(priorConnectedInstance);
        }
      } catch {
        // Best-effort — env may be left in not-connected state if reconnect fails
      }
      if (!wasEnabled) {
        await sandbox.setCapabilityEnabled(false);
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
    await editMentorPage.navigateToTab('Sandbox');
    await waitForPageReady(page);

    const sandbox = new SandboxTab(page, editMentorPage.dialog);
    const wasEnabled = await sandbox.isCapabilityEnabled();

    // Agent Configuration is gated on a wired sandbox. If env isn't
    // already connected, attempt to wire a healthy OpenClaw instance so
    // the test can actually exercise the edit flow. We track whether WE
    // connected so the finally can restore the env's not-connected state.
    let createdConnectionHere = false;

    try {
      if (!wasEnabled) {
        await sandbox.setCapabilityEnabled(true);
      }

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

      // Wait for the FIRST field's card by its known label. This rides out
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
        await editMentorPage.navigateToTab('Sandbox');
        await waitForPageReady(page);
        await sandbox.setCapabilityEnabled(false);
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
    await editMentorPage.navigateToTab('Sandbox');
    await waitForPageReady(page);

    const sandbox = new SandboxTab(page, editMentorPage.dialog);
    const wasEnabled = await sandbox.isCapabilityEnabled();

    // Skills content is gated on a wired sandbox. If env isn't connected,
    // wire a healthy OpenClaw instance up-front so the content is reachable.
    let createdConnectionHere = false;

    try {
      if (!wasEnabled) {
        await sandbox.setCapabilityEnabled(true);
      }

      const connected = await sandbox.ensureConnected();
      if (!connected.instanceName) {
        test.skip(
          true,
          'No connectable OpenClaw instance available — Skills tab requires a wired sandbox',
        );
        return;
      }
      createdConnectionHere = connected.createdConnection;

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
        await editMentorPage.navigateToTab('Sandbox');
        await waitForPageReady(page);
        await sandbox.setCapabilityEnabled(false);
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
    await editMentorPage.navigateToTab('Sandbox');
    await waitForPageReady(page);

    const sandbox = new SandboxTab(page, editMentorPage.dialog);
    const wasEnabled = await sandbox.isCapabilityEnabled();

    const ts = Date.now();
    const skillName = `e2e-test-skill-${ts}`;
    const skillSlug = `e2e_test_skill_${ts}`;
    const skillDescription = `E2E test skill created at ${ts}`;
    const updatedDescription = `E2E updated description ${ts}`;

    // Skills content is gated on a wired sandbox. If env isn't connected,
    // wire a healthy OpenClaw instance first; we'll disconnect after the
    // test if WE were the ones that connected it.
    let createdConnectionHere = false;

    try {
      if (!wasEnabled) {
        await sandbox.setCapabilityEnabled(true);
      }

      const connected = await sandbox.ensureConnected();
      if (!connected.instanceName) {
        test.skip(
          true,
          'No connectable OpenClaw instance available — Skills tab requires a wired sandbox',
        );
        return;
      }
      createdConnectionHere = connected.createdConnection;

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
      // submitNewSkill already waits for the dialog close and the new row to
      // appear in the list.
      await skills.submitNewSkill(skillName);

      // ── Edit ───────────────────────────────────────────────────────────
      await skills.openEditSkillDialog(skillName);

      // Update the description field. The bundle renders this as a regular
      // <input name="skill-description"> so .fill() works directly.
      await skills.editSkillDescriptionInput.fill(updatedDescription);

      await skills.submitSkillEdit();

      // submitSkillEdit already waits for the dialog close. Verify the row
      // wasn't accidentally deleted.
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
        await editMentorPage.navigateToTab('Sandbox');
        await waitForPageReady(page);
        await sandbox.setCapabilityEnabled(false);
      }
      await editMentorPage.close();
    }
  });

  test.afterAll(async ({ browser }, testInfo) => {
    await tracker44B.deleteAll(browser, testInfo);
  });
});

// ── Non-admin: Sandbox and Skills tabs invisible regardless of claw state ────
//
// Unaffected by the capability-gate refactor — Sandbox and Skills remain
// ADMIN-only via `userTypes: [UserType.ADMIN]` in `MENTOR_SEGMENTS`.

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

    await expect(
      nonadminEditMentorPage.dialog
        .getByRole('tablist')
        .getByRole('tab', { name: 'Sandbox', exact: true }),
    ).toHaveCount(0, { timeout: 10_000 });
    await expect(
      nonadminEditMentorPage.dialog
        .getByRole('tablist')
        .getByRole('tab', { name: 'Skills', exact: true }),
    ).toHaveCount(0, { timeout: 10_000 });

    await nonadminEditMentorPage.close();
  });
});
