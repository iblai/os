/**
 * Journey 44: CLAW Advanced Sandbox
 *
 * Covers the full lifecycle of the "Sandbox" feature in the Edit Mentor
 * modal:
 *
 *   Sandbox tab    — sandbox-kind selector (Computational Runtime / Virtual
 *                    Machine / Claw) + the Claw connection flow
 *   Tab visibility — Sandbox tab is ALWAYS visible to admins
 *   Prompts tab    — "Agent Configuration" section
 *
 * ── Sandbox-kind selector (SDK rewrite) ───────────────────────────────────
 *
 * The Sandbox tab (`components/modals/edit-mentor-modal/tabs/sandbox-tab.tsx`)
 * used to wrap the SDK's `SandboxConfig` component in an app-level
 * `CapabilityGate` around a single "Dedicated sandbox" (`enable_claw`)
 * master toggle. That gate is GONE — the tab now renders only a header and
 * `SandboxConfig` directly; the SDK component owns kind selection itself.
 *
 * `SandboxConfig` always renders a "Sandbox Type" card with three switches
 * (`sandbox-kind-computational-runtime`, `sandbox-kind-virtual-machine`,
 * `sandbox-kind-claw`). Computational Runtime and Virtual Machine can both be
 * on at once. Enabling Claw turns both of the others off in the same PATCH
 * and disables their switches for as long as Claw stays on (with an
 * info-tooltip note explaining why). The claw connected/not-connected
 * sections (instance table, connect, auto-push, push config) render ONLY
 * while Claw is enabled — not merely grayed out, absent from the DOM
 * entirely.
 *
 * `hooks/use-mentor-segments.ts` does not gate the Sandbox segment's
 * visibility on any of these flags — the tab is ALWAYS mounted for admins,
 * unaffected by this SDK rewrite (that decoupling predates it, from
 * feat/2040). Because kind selection has no visibility side effect on the
 * tab itself, this journey asserts the kind switches' effect on the
 * connected/not-connected sections directly (present/absent) rather than a
 * `data-enabled` attribute.
 *
 * NOTE: Agent Skills is fully INDEPENDENT of the sandbox (feat/2040 +
 * feat/2215) and is covered exclusively by journey 67
 * (`e2e/journeys/67-agent-skills.spec.ts`) — the Skills tab, its content,
 * and its management flows are deliberately not referenced anywhere in this
 * journey.
 *
 * Non-admin users must not see the Sandbox tab regardless of claw state
 * (the segment remains ADMIN-only in use-mentor-segments.ts — unaffected by
 * this refactor).
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

    // Create a fresh agent for each test so the Sandbox flows run against
    // a clean mentor (independent of whatever claw state a prior run or the
    // default mentor was left in).
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

  // ── TC01: The three sandbox-kind switches are present on the Sandbox tab ──

  test('admin opens Sandbox tab and the three sandbox-kind switches are visible', async ({
    page,
    editMentorPage,
  }) => {
    // Sandbox is always visible now — no Settings dependency.
    await editMentorPage.navigateToTab('Sandbox');
    await waitForPageReady(page);

    const sandbox = new SandboxTab(page, editMentorPage.dialog);
    await sandbox.verifyKindsVisible();
    await editMentorPage.close();
  });

  // ── TC02: Computational Runtime / Virtual Machine are interactable ───────

  test('computational-runtime and virtual-machine switches are interactable when claw is off', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.navigateToTab('Sandbox');
    await waitForPageReady(page);

    const sandbox = new SandboxTab(page, editMentorPage.dialog);
    // A freshly-created mentor starts with claw off, but be explicit — the
    // other two switches are only enabled while claw is off.
    await sandbox.setKindEnabled('claw', false);
    await expect(sandbox.computationalRuntimeSwitch).toBeEnabled({
      timeout: 10_000,
    });
    await expect(sandbox.virtualMachineSwitch).toBeEnabled({
      timeout: 5_000,
    });
    await editMentorPage.close();
  });

  // ── TC03: Toggling auto-saves and both non-claw kinds can be on together ─
  //
  // Each switch PATCHes immediately (optimistic local state) — there is no
  // footer Save button involved. The Sandbox tab is unconditionally mounted
  // regardless of any kind's value, so toggling never affects its presence.

  test('toggling computational-runtime and virtual-machine kinds auto-saves instantly, both can be on together, and Sandbox tab visibility is unaffected', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.navigateToTab('Sandbox');
    await waitForPageReady(page);

    const sandbox = new SandboxTab(page, editMentorPage.dialog);
    await expect(getTab(editMentorPage.dialog, 'Sandbox')).toBeVisible();

    // Clean starting point.
    await sandbox.setKindEnabled('claw', false);
    await sandbox.setKindEnabled('computational-runtime', false);
    await sandbox.setKindEnabled('virtual-machine', false);

    await sandbox.setKindEnabled('computational-runtime', true);
    expect(await sandbox.isKindEnabled('computational-runtime')).toBe(true);
    expect(await sandbox.isKindEnabled('virtual-machine')).toBe(false);

    // Virtual Machine can be enabled on top — the two are independent.
    await sandbox.setKindEnabled('virtual-machine', true);
    expect(await sandbox.isKindEnabled('computational-runtime')).toBe(true);
    expect(await sandbox.isKindEnabled('virtual-machine')).toBe(true);

    await expect(getTab(editMentorPage.dialog, 'Sandbox')).toBeVisible();

    await editMentorPage.close();
  });

  // ── TC04: Enabling Claw turns off + disables the other two kinds ─────────

  test('enabling claw turns off and disables computational-runtime and virtual-machine, and surfaces the "kinds disabled by claw" hint', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.navigateToTab('Sandbox');
    await waitForPageReady(page);

    const sandbox = new SandboxTab(page, editMentorPage.dialog);

    try {
      // Start with both non-claw kinds on so enabling claw's effect is
      // observable (off → on transition, not just "already off").
      await sandbox.setKindEnabled('claw', false);
      await sandbox.setKindEnabled('computational-runtime', true);
      await sandbox.setKindEnabled('virtual-machine', true);

      await sandbox.setKindEnabled('claw', true);

      expect(await sandbox.isKindEnabled('computational-runtime')).toBe(false);
      expect(await sandbox.isKindEnabled('virtual-machine')).toBe(false);
      await sandbox.verifyKindDisabled('computational-runtime');
      await sandbox.verifyKindDisabled('virtual-machine');
      await sandbox.verifyKindDisabledHint('computational-runtime');

      // Verify ordering while we're here: Sandbox leads the Integrations
      // category (feat/2040 moved it off Configurations, so it is no longer
      // adjacent to Settings — Settings lives in Configurations).
      const integrationTabs = await visibleSegmentTabLabels(
        editMentorPage.dialog,
      );
      expect(integrationTabs.findIndex((t) => /sandbox/i.test(t))).toBe(0);
    } finally {
      await sandbox.setKindEnabled('claw', false);
      await editMentorPage.close();
    }
  });

  // ── TC06: Sandbox sits in its fixed category position unconditionally ────
  //
  // feat/2040 groups the sidebar into Configurations / Integrations / Runtime
  // categories. Sandbox now LEADS the Integrations category (no longer
  // adjacent to Settings — Settings lives in Configurations). Only the
  // active category's segment tabs are mounted, so the Sandbox tab must be
  // navigated to first.

  test('Sandbox leads the Integrations category unconditionally', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.navigateToTab('Sandbox');
    await waitForPageReady(page);
    // The active tab itself proves the Integrations segment list rendered
    // before its labels are read (allTextContents does not auto-retry).
    await expect(getTab(editMentorPage.dialog, 'Sandbox')).toBeVisible({
      timeout: 10_000,
    });
    const integrationTabs = await visibleSegmentTabLabels(
      editMentorPage.dialog,
    );
    expect(integrationTabs.findIndex((t) => /sandbox/i.test(t))).toBe(0);

    await editMentorPage.close();
  });

  // ── TC07: Disabling Claw re-enables the other two kind switches ──────────

  test('disabling claw re-enables computational-runtime and virtual-machine switches while the Sandbox tab remains visible', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.navigateToTab('Sandbox');
    await waitForPageReady(page);

    const sandbox = new SandboxTab(page, editMentorPage.dialog);

    try {
      await sandbox.setKindEnabled('claw', true);
      await sandbox.verifyKindDisabled('computational-runtime');
      await sandbox.verifyKindDisabled('virtual-machine');

      await sandbox.setKindEnabled('claw', false);
      await expect(sandbox.computationalRuntimeSwitch).toBeEnabled({
        timeout: 10_000,
      });
      await expect(sandbox.virtualMachineSwitch).toBeEnabled();

      // The Sandbox tab stays mounted regardless of any kind's value.
      await expect(getTab(editMentorPage.dialog, 'Sandbox')).toBeVisible();
    } finally {
      await sandbox.setKindEnabled('claw', false);
      await editMentorPage.close();
    }
  });

  // ── TC08: Claw instance sections render only while claw is enabled ───────
  //
  // The "Sandbox Type" card always renders. The claw connected/not-connected
  // sections (instance picker or "Connected Instance" panel) render ONLY
  // while the claw kind switch is on — the SDK unmounts them entirely when
  // claw is off, it does not merely gray them out.

  test('admin navigates to Sandbox tab; the sandbox-kind card always renders and the claw instance sections render only while claw is enabled', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.navigateToTab('Sandbox');
    await waitForPageReady(page);

    const sandbox = new SandboxTab(page, editMentorPage.dialog);

    try {
      await sandbox.setKindEnabled('claw', false);
      await sandbox.verifyKindsVisible();
      // No claw instance section (instance picker or connected panel) while
      // claw is off.
      await expect(sandbox.addInstanceButton).toBeHidden();
      await expect(sandbox.connectedHeading).toBeHidden();

      await sandbox.setKindEnabled('claw', true);
      // With claw on, either the not-connected instance picker or the
      // connected panel must render — which one depends on the env's claw
      // wiring for this brand-new mentor (always not-connected in practice,
      // but tolerate either since instances are platform-wide state).
      let notConnectedVisible = false;
      try {
        await sandbox.addInstanceButton.waitFor({
          state: 'visible',
          timeout: 10_000,
        });
        notConnectedVisible = true;
      } catch {
        notConnectedVisible = false;
      }
      const connectedVisible = notConnectedVisible
        ? false
        : await sandbox.isConnected(5_000);
      expect(notConnectedVisible || connectedVisible).toBe(true);
    } finally {
      await sandbox.setKindEnabled('claw', false);
      await editMentorPage.close();
    }
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

    // Create a fresh agent for each test so the Sandbox flows run against
    // a clean mentor (independent of whatever claw state a prior run or the
    // default mentor was left in).
    await createMentorPage.openAndCreate();
    const { mentorId } = await getPlatformContext(page);
    tracker44B.add(mentorId);

    // Open the Edit Agent modal once here (see describe-A's beforeEach) so
    // each test starts with it mounted on a neutral Settings anchor.
    await editMentorPage.open('Settings');
  });

  test('admin toggles claw ON then OFF and the claw instance sections mount/unmount both times', async ({
    page,
    editMentorPage,
  }) => {
    // claw-09
    await editMentorPage.navigateToTab('Sandbox');
    await waitForPageReady(page);

    const sandbox = new SandboxTab(page, editMentorPage.dialog);
    const originalState = await sandbox.isKindEnabled('claw');

    try {
      // ── Phase 1: enable → claw instance section mounts ───────────────────
      await sandbox.setKindEnabled('claw', true);
      let notConnectedVisible = false;
      try {
        await sandbox.addInstanceButton.waitFor({
          state: 'visible',
          timeout: 10_000,
        });
        notConnectedVisible = true;
      } catch {
        notConnectedVisible = false;
      }
      const connectedVisible = notConnectedVisible
        ? false
        : await sandbox.isConnected(5_000);
      expect(notConnectedVisible || connectedVisible).toBe(true);

      // ── Phase 2: disable → claw instance section unmounts ────────────────
      await sandbox.setKindEnabled('claw', false);
      await expect(sandbox.addInstanceButton).toBeHidden();
      await expect(sandbox.connectedHeading).toBeHidden();
    } finally {
      // Restore original state
      if (originalState !== (await sandbox.isKindEnabled('claw'))) {
        await sandbox.setKindEnabled('claw', originalState);
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
    const wasEnabled = await sandbox.isKindEnabled('claw');

    // Add Instance UI only renders while the claw kind is on — the SDK
    // unmounts the instance sections entirely otherwise. If env has a wired
    // sandbox we capture the instance name, disconnect to reach the picker,
    // then reconnect at the end to restore the env.
    let priorConnectedInstance: string | null = null;

    try {
      if (!wasEnabled) {
        await sandbox.setKindEnabled('claw', true);
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
        await sandbox.setKindEnabled('claw', false);
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
    const wasEnabled = await sandbox.isKindEnabled('claw');

    const ts = Date.now();
    const fakeToken = `e2e-fake-token-${ts}`;
    const instanceName = `e2e-edit-instance-${ts}`;
    const renamed = `${instanceName}-renamed`;

    let priorConnectedInstance: string | null = null;

    try {
      if (!wasEnabled) {
        await sandbox.setKindEnabled('claw', true);
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
        await sandbox.setKindEnabled('claw', false);
      }
      await editMentorPage.close();
    }
  });

  // ── TC12: Sandbox tab — Connect to instance ────────────────────────────────
  //
  // Clicking the row's dedicated Connect button (`connect-instance-<id>`,
  // next to the "Actions" three-dot menu — Connect is no longer a dropdown
  // item) wires the mentor to a Claw instance. After connect the "Connected
  // Instance" heading must appear.

  test('admin connects a sandbox instance via the dedicated Connect button and Connected Instance heading appears', async ({
    page,
    editMentorPage,
  }) => {
    // claw-12
    await editMentorPage.navigateToTab('Sandbox');
    await waitForPageReady(page);

    const sandbox = new SandboxTab(page, editMentorPage.dialog);
    const wasEnabled = await sandbox.isKindEnabled('claw');

    let priorConnectedInstance: string | null = null;

    try {
      if (!wasEnabled) {
        await sandbox.setKindEnabled('claw', true);
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
        await sandbox.setKindEnabled('claw', false);
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
    const wasEnabled = await sandbox.isKindEnabled('claw');

    // Agent Configuration is gated on a wired sandbox. If env isn't
    // already connected, attempt to wire a healthy OpenClaw instance so
    // the test can actually exercise the edit flow. We track whether WE
    // connected so the finally can restore the env's not-connected state.
    let createdConnectionHere = false;

    try {
      if (!wasEnabled) {
        await sandbox.setKindEnabled('claw', true);
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
        await sandbox.setKindEnabled('claw', false);
      }
      await editMentorPage.close();
    }
  });

  test.afterAll(async ({ browser }, testInfo) => {
    await tracker44B.deleteAll(browser, testInfo);
  });
});

// ── Non-admin: Sandbox tab invisible regardless of claw state ────────────────
//
// Unaffected by the capability-gate refactor — Sandbox remains ADMIN-only
// via `userTypes: [UserType.ADMIN]` in `MENTOR_SEGMENTS`.

test.describe('Journey 44: CLAW Advanced Sandbox — Non-Admin', () => {
  test('non-admin does not see the Sandbox tab in the Edit Mentor modal', async ({
    nonadminPage,
    nonadminEditMentorPage,
  }) => {
    await navigateToMentorApp(nonadminPage);

    // Non-admin cannot open the edit mentor modal via the mentor dropdown
    // (the Settings menu item is hidden). We assert the tab is absent by
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
      // Non-admin cannot open the edit dialog — the Sandbox tab is
      // definitively not visible. Test passes.
      await nonadminPage.keyboard.press('Escape');
      return;
    }

    // If (in some env) non-admin can open the dialog, verify the tab is
    // absent — dialog captured first, nested lookups scoped to it.
    await modifyItem.click();
    const dialog = nonadminEditMentorPage.dialog;
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    await expect(
      dialog.getByRole('tablist').getByRole('tab', {
        name: 'Sandbox',
        exact: true,
      }),
    ).toHaveCount(0, { timeout: 10_000 });

    await nonadminEditMentorPage.close();
  });
});
