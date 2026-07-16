/**
 * Journey 50 — Chat Privacy
 *
 * Covers the four user-facing surfaces of the chat-privacy feature end-to-end:
 *
 *  1. **Tenant gate** (cp-tenant-*) — "Allow users to control chat privacy"
 *     switch in Account Settings → Advanced. Controls whether the header
 *     toggle and the user profile "Private Mode" tab are visible at all.
 *
 *  2. **Agent settings kill switch** (cp-agent-*) — "Enable private mode"
 *     row in Edit Mentor → Settings → Capabilities. When on, every
 *     conversation with that mentor is private regardless of other tiers.
 *     Saving dispatches `chatPrivacyApiSlice.util.invalidateTags(
 *     ['ChatPrivacyEffective'])` so the header toggle reflects the new state
 *     live without a page refresh — the regression anchor for feat/mentor/1797.
 *
 *  3. **Header toggle** (cp-header-*) — the nav-bar "Private Mode" pill
 *     (`ChatPrivacyToggle` from `@iblai/iblai-js/web-containers`). Exposes
 *     `data-state="on|off"`, `data-source` (mentor/tenant/user/session/default),
 *     and `aria-disabled` for lock assertions.
 *
 *  4. **User profile "Private Mode" tab** (cp-profile-*) — three radio cards
 *     (Normal / Anonymized / Disabled) inside `UserProfileModal`. Only shown
 *     when the tenant gate is on.
 *
 *  5. **Private chat round-trip** (cp-chat-*) — the end-to-end happy path:
 *     enable private mode via the header toggle on a fresh chat, send a
 *     message, and confirm the assistant still replies. Exercised once as
 *     the admin (`page`) and once as a non-admin (`nonadminPage`). Also
 *     covers six feature-interaction checkpoints (cp-chat-04 … cp-chat-09)
 *     that exercise prompts, voice/screen, multi-turn context, file
 *     attachments, the memory button, and the AI-bubble share button while
 *     private mode is active. These assert the CORRECT/EXPECTED behavior.
 *     cp-chat-08 (memory button) and cp-chat-09 (share button) have their
 *     in-repo gates implemented and should pass; cp-chat-04/05/06 are
 *     expected to be RED until the corresponding backend fixes land. Do NOT
 *     weaken assertions to pass.
 *
 * Precedence chain (highest → lowest):
 *   mentor > tenant > session > user > default
 *
 * ── Isolation strategy ────────────────────────────────────────────────────
 *
 * All four describe blocks below mutate the SAME backend state:
 *   • Tenant chat-privacy gate (org-scoped, all blocks read this)
 *   • Default mentor's `disable_chathistory` (mentor-scoped)
 *   • Admin user's profile Private Mode selection (user-scoped)
 *
 * Sub-fixture isolation is impossible without per-test backend records,
 * which the suite does not provision. Running these blocks in parallel
 * across workers produces confirmed cross-contamination: cp-tenant-02
 * flips the gate OFF while cp-header-01 races to read its visibility,
 * cp-agent-03 locks the mentor while cp-profile-04 checks `data-source`,
 * etc. The cleanest correct answer is to force the whole journey serial.
 *
 * Two further independence guarantees on top of serial:
 *   1. `waitForAdmin` in every beforeEach throws (rather than silently
 *      skipping) when admin context is missing — so storageState bugs
 *      surface as failures, not as suspiciously-passing skips.
 *   2. Idempotent `ensure*` helpers in every beforeEach set the three
 *      shared states to a known starting configuration. Each test exercises
 *      its own transition without assuming the previous test cleaned up.
 *
 * Selectors: All SDK surface assertions go through `@iblai/iblai-js/playwright`
 * helpers so selectors are driven by stable `data-testid` / `data-state`
 * / `aria-pressed` attributes. In-repo surfaces (the agent-settings switch)
 * use `aria-label`.
 */

import { test, expect } from '../fixtures/mentor-test';
import {
  navigateToMentorApp,
  waitForAdmin,
  getPlatformContext,
} from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { dragAndDropFiles } from '../utils/drag-drop';
import { ChatPrivacyPage } from '../page-objects/chat-privacy.page';
import { clickChatPrivacyToggle } from '@iblai/iblai-js/playwright';

// ─── Shared helpers ──────────────────────────────────────────────────────────

/**
 * Ensure we are on the chat page for the default mentor and the page chrome
 * is fully hydrated. Called in beforeEach blocks so each test starts in a
 * known-good state.
 */
async function goToChatPage(
  page: import('@playwright/test').Page,
): Promise<void> {
  await navigateToMentorApp(page);
  await waitForPageReady(page);
}

// ─── Suite ───────────────────────────────────────────────────────────────────

test.describe('Journey 50: Chat Privacy', () => {
  // The whole journey runs on a single worker, and every test gets 3
  // minutes (vs the repo default 120 s). See the isolation rationale in
  // the file-level doc-comment for why serial is non-negotiable. The
  // 3-minute budget covers worst-case beforeEach chains:
  //   • each `ensure*` precondition opens a modal (Account Settings,
  //     Edit Mentor, or User Profile) — ~5-10 s per open;
  //   • each backend flip is gated on tag-invalidated query refetches
  //     that the SDK component re-disables itself across — ~30-40 s
  //     worst case per flip;
  //   • beforeEach can chain three preconditions in series.
  // `describe.configure` applies to both tests AND their per-test hooks
  // (beforeEach / afterEach), which is what we need — a journey-level
  // `test.setTimeout()` only affects tests, not hooks, and that was the
  // bug that left cp-header-02's beforeEach hitting the 120 s ceiling.
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  // Original state captured before the journey runs anything destructive.
  // Restored in the journey-level afterAll so subsequent journeys (38, 45,
  // 47) inherit the same world we found.
  let originalTenantGateState: boolean | null = null;
  let originalProfileMode: 'normal' | 'anonymized' | 'disabled' | null = null;

  test.beforeAll(async ({ browser }) => {
    // Use a dedicated context so this snapshot doesn't interact with any
    // per-test page object lifecycle. The project storageState makes the
    // new context authenticated automatically.
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await navigateToMentorApp(page);
      await waitForAdmin(page);
      const chatPrivacy = new ChatPrivacyPage(page);
      originalTenantGateState = await chatPrivacy
        .readTenantGateState()
        .catch(() => null);
      // To read profile mode we need the gate ON; tolerate failure since
      // a tenant whose default is OFF should still pass this capture.
      if (originalTenantGateState) {
        originalProfileMode = await chatPrivacy
          .readProfilePrivateMode()
          .catch(() => null);
      }
    } finally {
      await context.close().catch(() => undefined);
    }
  });

  test.afterAll(async ({ browser }) => {
    // Defensive restoration. Each describe block also restores its own
    // mutations, but if a hook crashed midway this is the safety net.
    //
    // The restore can chain up to THREE backend flips (gate restore +
    // profile-mode restore + optional gate-flip-back). Each flip
    // includes a click → mutation → tag-invalidated refetch round-trip
    // that the SDK component re-disables itself across; on slow
    // environments each one can occupy ~30-40 s of real time. The 120 s
    // default is too tight — bump to 5 minutes so a slow afterAll has
    // headroom on the worst-case path. Happy path stays milliseconds.
    test.setTimeout(300_000);

    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await navigateToMentorApp(page);
      await waitForAdmin(page).catch(() => undefined);
      const chatPrivacy = new ChatPrivacyPage(page);
      // Restore tenant gate.
      if (originalTenantGateState !== null) {
        await chatPrivacy
          .ensureTenantGateEnabled(originalTenantGateState)
          .catch(() => undefined);
      }
      // Restore profile mode. Requires gate ON; temporarily flip it ON if
      // needed, then put it back.
      if (originalProfileMode !== null) {
        const gateNow = await chatPrivacy
          .readTenantGateState()
          .catch(() => null);
        if (gateNow === false) {
          await chatPrivacy
            .ensureTenantGateEnabled(true)
            .catch(() => undefined);
        }
        await chatPrivacy
          .ensureProfilePrivateMode(originalProfileMode)
          .catch(() => undefined);
        if (gateNow === false) {
          await chatPrivacy
            .ensureTenantGateEnabled(false)
            .catch(() => undefined);
        }
      }
    } finally {
      await context.close().catch(() => undefined);
    }
  });

  // ── 1. Tenant gate (admin-only) ──────────────────────────────────────────
  //
  // The journey-level `mode: 'serial'` is already in effect, so we drop the
  // block-local `.serial` and the block-local snapshot/afterAll — they were
  // redundant.

  test.describe('Tenant gate (cp-tenant-*)', () => {
    test.beforeEach(async ({ page }) => {
      await goToChatPage(page);
      // Hard precondition: throws (does NOT skip) when admin context is
      // missing so storageState bugs are visible instead of silently
      // green-by-default. Budget 60s + forced re-nav covers slow CI auth.
      await waitForAdmin(page);
    });

    // cp-tenant-01: Switch is visible to admins and reflects backend state
    test('cp-tenant-01: admin sees the chat-privacy switch in tenant Advanced tab', async ({
      page,
    }) => {
      const chatPrivacy = new ChatPrivacyPage(page);

      const dialog = await chatPrivacy.openTenantAdvancedTab();
      await chatPrivacy.assertTenantGateRowVisible(dialog, true);
      // Snapshot is owned by the journey-level beforeAll — no need to
      // re-capture here. The journey afterAll handles restoration.
      await chatPrivacy.closeTenantAdvancedTab(dialog);
    });

    // cp-tenant-02: Flipping the gate OFF hides the header toggle app-wide
    test('cp-tenant-02: disabling the tenant gate hides the header toggle', async ({
      page,
    }) => {
      const chatPrivacy = new ChatPrivacyPage(page);

      // Idempotent precondition: start with gate ON so this test actually
      // exercises the ON→OFF transition rather than reading a coincidence.
      await chatPrivacy.ensureTenantGateEnabled(true);

      // Drive to OFF and assert the toggle disappears.
      await chatPrivacy.ensureTenantGateEnabled(false);
      await waitForPageReady(page);
      await chatPrivacy.assertHeaderToggleVisible(false);

      // Restore to ON for the next test in the serial block. The journey
      // afterAll has the ultimate restore, but in-test restore keeps the
      // next test independent from this one's success.
      await chatPrivacy.ensureTenantGateEnabled(true).catch(() => undefined);
    });

    // cp-tenant-03: Flipping the gate ON shows the header toggle
    test('cp-tenant-03: enabling the tenant gate shows the header toggle', async ({
      page,
    }) => {
      const chatPrivacy = new ChatPrivacyPage(page);

      // Idempotent precondition: start with gate OFF so OFF→ON is real.
      await chatPrivacy.ensureTenantGateEnabled(false);

      await chatPrivacy.ensureTenantGateEnabled(true);
      await waitForPageReady(page);
      await chatPrivacy.assertHeaderToggleVisible(true);
    });

    // cp-tenant-04: Profile "Private Mode" tab is hidden when gate is OFF,
    //               visible when gate is ON.
    test('cp-tenant-04: Private Mode profile tab visibility tracks the tenant gate', async ({
      page,
    }) => {
      const chatPrivacy = new ChatPrivacyPage(page);

      // Start from a known state so the OFF→ON dance is deterministic.
      await chatPrivacy.ensureTenantGateEnabled(true);

      // --- gate OFF ---
      await chatPrivacy.ensureTenantGateEnabled(false);
      await waitForPageReady(page);
      const modal = await chatPrivacy.openProfileModal();
      expect(await chatPrivacy.isProfilePrivateModeTabVisible()).toBe(false);
      await chatPrivacy.closeProfileModal(modal);

      // --- gate ON ---
      await chatPrivacy.ensureTenantGateEnabled(true);
      await waitForPageReady(page);
      const modal2 = await chatPrivacy.openProfileModal();
      expect(await chatPrivacy.isProfilePrivateModeTabVisible()).toBe(true);
      await chatPrivacy.closeProfileModal(modal2);
    });

    // No block-local afterAll: the journey-level afterAll restores the
    // tenant gate from `originalTenantGateState` and that's already wired
    // up. Adding a per-block one was a double-restore that risked racing
    // the journey-level one.
  });

  // ── 2. Agent settings kill switch (admin-only) ────────────────────────────

  test.describe('Agent settings kill switch (cp-agent-*)', () => {
    test.beforeEach(async ({ page, editMentorPage }) => {
      await goToChatPage(page);
      // Throw (don't skip) when admin context is missing.
      await waitForAdmin(page);

      const chatPrivacy = new ChatPrivacyPage(page);
      // Idempotent preconditions:
      //   • Tenant gate ON so the capabilities row is rendered and the
      //     header toggle is visible (cp-agent-03 asserts on `data-source`).
      //   • Default mentor's kill-switch OFF so each test exercises its
      //     declared transition rather than coincidentally inheriting
      //     state from a previous test.
      await chatPrivacy.ensureTenantGateEnabled(true);
      await chatPrivacy.ensureAgentPrivacy(editMentorPage, false);
    });

    // No block-local afterAll: each cp-agent-* test either does not
    // mutate (cp-agent-01), captures-then-restores via `wasEnabled`
    // (cp-agent-02/03), or ends with the switch in the OFF state by
    // design (cp-agent-04 drives ON → OFF). Combined with the journey
    // beforeAll's `originalTenantGateState` capture and the per-test
    // `ensureAgentPrivacy(false)` precondition, no extra restoration
    // is needed at the block level.

    // cp-agent-01: "Enable private mode" row is present in Settings → Capabilities
    test('cp-agent-01: Enable private mode row is visible in Settings Capabilities sub-tab', async ({
      page,
      editMentorPage,
    }) => {
      await editMentorPage.open('Settings');
      await waitForPageReady(page);

      await editMentorPage.settings.selectSubTab('Capabilities');

      const chatPrivacy = new ChatPrivacyPage(page);
      await expect(chatPrivacy.agentPrivacySwitch).toBeVisible({
        timeout: 10_000,
      });

      await editMentorPage.close();
    });

    // cp-agent-02: Saving with the toggle ON persists (re-open and verify)
    test('cp-agent-02: saving Enable private mode ON persists across modal re-open', async ({
      page,
      editMentorPage,
    }) => {
      const chatPrivacy = new ChatPrivacyPage(page);

      await editMentorPage.open('Settings');
      await waitForPageReady(page);
      await editMentorPage.settings.selectSubTab('Capabilities');

      // Read original state so we can restore it.
      const wasEnabled = await chatPrivacy.getAgentPrivacyState();

      // Set to ON and save.
      await chatPrivacy.lockAgentPrivacyOn();
      await editMentorPage.close();

      // Re-open and confirm the state stuck.
      //
      // The save invalidates the mentor-settings query, which refetches in
      // the background. The Settings form captures `disable_chathistory`
      // from the cache exactly once at mount (TanStack `useForm`
      // defaultValues) and has no reset/sync effect, so it does NOT pick up
      // a refetch that lands after mount. And the modal unmounts its whole
      // subtree on close (`{isOpen && <DialogContent>}`), so each re-open is
      // a fresh mount that re-reads the cache as-is. If the post-save
      // refetch hasn't landed by the time we re-open, the form mounts the
      // stale pre-save OFF and never updates — a single re-open + longer
      // timeout cannot fix this, which is exactly what made the test flaky.
      //
      // Persistence on the backend is the real assertion here; poll the
      // open→read→close cycle so we observe the value once the refetch has
      // settled. The modal is left OPEN on the successful read so the
      // restore block below can act on it directly.
      await expect
        .poll(
          async () => {
            await editMentorPage.open('Settings');
            await editMentorPage.settings.selectSubTab('Capabilities');
            await chatPrivacy.agentPrivacySwitch
              .waitFor({ state: 'visible', timeout: 10_000 })
              .catch(() => undefined);
            const persisted = await chatPrivacy.getAgentPrivacyState();
            if (!persisted) {
              await editMentorPage.close();
            }
            return persisted;
          },
          {
            message:
              'Re-opened Settings should show Enable private mode ON once the post-save mentor refetch settles',
            timeout: 30_000,
            intervals: [1_000, 2_000, 3_000, 5_000],
          },
        )
        .toBe(true);

      // Restore. The modal is already open on the successful poll read, so
      // we don't re-open here.
      if (!wasEnabled) {
        await chatPrivacy.unlockAgentPrivacy();
      }
      await editMentorPage.close();
    });

    // cp-agent-03: After saving toggle ON, the header toggle is locked-on
    //              with data-source="mentor" WITHOUT a page refresh.
    //              This is the regression test for the
    //              `dispatch(chatPrivacyApiSlice.util.invalidateTags(
    //              ['ChatPrivacyEffective']))` wiring in settings-tab.tsx.
    test('cp-agent-03: saving Enable private mode ON locks the header toggle to mentor source without page refresh', async ({
      page,
      editMentorPage,
    }) => {
      const chatPrivacy = new ChatPrivacyPage(page);

      await editMentorPage.open('Settings');
      await waitForPageReady(page);
      await editMentorPage.settings.selectSubTab('Capabilities');

      const wasEnabled = await chatPrivacy.getAgentPrivacyState();

      await chatPrivacy.lockAgentPrivacyOn();

      // The toast confirms the save. Now close the dialog and immediately
      // assert on the header toggle — no page.reload() allowed here.
      await editMentorPage.close();

      // Header toggle must be on, locked, and source=mentor — live, with no
      // page refresh. This is the regression anchor: saving the kill switch
      // must dispatch `invalidateTags(['ChatPrivacyEffective'])` so the
      // nav-bar toggle refetches. A `disable_chathistory`-changed guard in
      // settings-tab.tsx once suppressed that dispatch (false negative), and
      // the header silently stopped updating until a refresh — exactly what
      // these assertions catch.
      //
      // We assert the attributes directly (rather than via the SDK helpers
      // `assertHeaderStateAndSource` / `assertHeaderLocked`, which are
      // hard-capped at 10 s) with a 30 s budget so a cold-cache
      // `chat-privacy-effective` refetch has room to land — matching the
      // pattern used by `clickToggleAndWaitFor` and cp-header-05/06.
      const toggle = chatPrivacy.headerToggle();
      await expect(toggle).toHaveAttribute('data-state', 'on', {
        timeout: 30_000,
      });
      await expect(toggle).toHaveAttribute('data-source', 'mentor', {
        timeout: 30_000,
      });
      await expect(toggle).toHaveAttribute('aria-disabled', 'true', {
        timeout: 30_000,
      });

      // Restore.
      await editMentorPage.open('Settings');
      await editMentorPage.settings.selectSubTab('Capabilities');
      if (!wasEnabled) {
        await chatPrivacy.unlockAgentPrivacy();
      }
      await editMentorPage.close();
    });

    // cp-agent-04: After saving toggle OFF, the header is no longer locked.
    //              Precedence falls through to the next tier (the exact
    //              data-source depends on tenant/user settings, so we only
    //              assert it is NOT "mentor" and NOT locked).
    test('cp-agent-04: saving Enable private mode OFF removes the mentor lock from the header toggle', async ({
      page,
      editMentorPage,
    }) => {
      const chatPrivacy = new ChatPrivacyPage(page);

      // Idempotent precondition: beforeEach forced OFF, so flip ON first so
      // this test actually exercises the ON→OFF transition rather than a
      // coincidental OFF→OFF no-op.
      await chatPrivacy.ensureAgentPrivacy(editMentorPage, true);

      // Drive to OFF.
      await editMentorPage.open('Settings');
      await waitForPageReady(page);
      await editMentorPage.settings.selectSubTab('Capabilities');
      await chatPrivacy.unlockAgentPrivacy();
      await editMentorPage.close();

      // The header toggle must no longer be locked. assertHeaderLocked(false)
      // polls until `aria-disabled` settles to absent or "false" — required
      // because the unlock flow has a brief window between the Save toast
      // appearing (mutation done) and the `chat-privacy-effective` refetch
      // landing (header re-renders).
      await chatPrivacy.assertHeaderLocked(false);

      // data-source must not be "mentor" once the kill switch is off. Use
      // the auto-retrying matcher so this also waits for the refetch — a
      // bare `getAttribute` would race the same window as the locked check.
      await expect(chatPrivacy.headerToggle()).not.toHaveAttribute(
        'data-source',
        'mentor',
        { timeout: 10_000 },
      );
    });
  });

  // ── 3. Header toggle (unlocked mentor) ────────────────────────────────────

  test.describe('Header toggle — unlocked mentor (cp-header-*)', () => {
    test.beforeEach(async ({ page, editMentorPage }) => {
      await goToChatPage(page);
      await waitForAdmin(page);

      const chatPrivacy = new ChatPrivacyPage(page);

      // Fast-path: in a serial block the previous cp-header test (or the
      // last cp-tenant/cp-agent flip) almost always leaves the THREE
      // shared states already in the configuration this block wants:
      //   • Gate ON           → header toggle is visible
      //   • Mentor lock OFF   → aria-disabled is absent/"false"
      //   • User mode normal  → data-source is anything but "user"
      // All three are readable from the header toggle DOM in ~150ms with
      // no modal opens. If they hold, skip the three ensures (each of
      // which opens a modal and can cost 5-15s on slow envs). On the
      // happy path this turns a ~40s beforeEach into a ~200ms one,
      // which is the only way cp-header-* can fit in even a 3-minute
      // per-test budget once cumulative flakes start stacking.
      const toggle = chatPrivacy.headerToggle();
      const fastPathOk = await (async () => {
        const visible = await toggle
          .isVisible({ timeout: 5_000 })
          .catch(() => false);
        if (!visible) return false;
        const ariaDisabled = await toggle
          .getAttribute('aria-disabled')
          .catch(() => null);
        if (ariaDisabled === 'true') return false;
        const dataSource = await toggle
          .getAttribute('data-source')
          .catch(() => null);
        if (dataSource === 'mentor' || dataSource === 'user') return false;
        return true;
      })();

      if (!fastPathOk) {
        // Slow path: at least one precondition is wrong. Tier-targeted
        // recovery — only open the modal that owns the wrong tier, not
        // all three. The user profile's Private Mode tab in particular
        // is the slowest (its body waits on
        // `useGetUserChatPrivacySettingsQuery` and on a slow env can
        // exceed the SDK helper's 10 s tab-body budget), so we only
        // touch it when the toggle's `data-source` actually says the
        // user tier is overriding.
        await chatPrivacy.ensureTenantGateEnabled(true);
        await chatPrivacy.ensureAgentPrivacy(editMentorPage, false);

        const dataSourceAfterAgentReset = await toggle
          .getAttribute('data-source')
          .catch(() => null);
        if (dataSourceAfterAgentReset === 'user') {
          await chatPrivacy.ensureProfilePrivateMode('normal');
        }

        await expect(toggle).toBeVisible({ timeout: 15_000 });
      }
    });

    // cp-header-01: Default state on a fresh chat is "off"
    test('cp-header-01: fresh chat starts with the header toggle in the off state', async ({
      page,
      chatPage,
    }) => {
      // Start a fresh session to clear any prior session state.
      await chatPage.startNewChat();
      await waitForPageReady(page);

      const chatPrivacy = new ChatPrivacyPage(page);
      await chatPrivacy.assertHeaderState('off');
    });

    // cp-header-02: Clicking the toggle (no messages yet) flips to "on",
    //               data-source becomes "session".
    test('cp-header-02: clicking the toggle with no messages starts a private session', async ({
      page,
      chatPage,
    }) => {
      await chatPage.startNewChat();
      await waitForPageReady(page);

      const chatPrivacy = new ChatPrivacyPage(page);
      // Robust click: waits for visible/enabled BEFORE the click and for
      // the post-mutation state + source to settle AFTER it, all with
      // generous-enough budgets to outlast a cold-cache refetch.
      await chatPrivacy.clickToggleAndWaitFor('on', 'session');
    });

    // cp-header-03: Clicking the toggle again (still no messages, session is on)
    //               starts a fresh normal session — state flips back to "off".
    test('cp-header-03: clicking an on toggle with no messages returns to normal mode', async ({
      page,
      chatPage,
    }) => {
      await chatPage.startNewChat();
      await waitForPageReady(page);

      const chatPrivacy = new ChatPrivacyPage(page);

      // Enable, then disable. Each call waits for the toggle to be
      // interactive again before returning, so the second click can't
      // race the first click's in-flight mutation.
      await chatPrivacy.clickToggleAndWaitFor('on');
      await chatPrivacy.clickToggleAndWaitFor('off');
    });

    // cp-header-04: Send a message FIRST, then click toggle → confirm dialog appears.
    //               Cancel → dialog closes, state stays "off".
    test('cp-header-04: clicking toggle mid-session opens the confirm dialog; cancelling leaves state off', async ({
      page,
      chatPage,
    }) => {
      await chatPage.startNewChat();
      await waitForPageReady(page);

      const chatPrivacy = new ChatPrivacyPage(page);

      // Ensure we start from "off".
      await chatPrivacy.assertHeaderState('off');

      // Send a message to put the session in mid-flight state.
      await chatPage.sendMessage('Hello');
      // Wait for at least the user message bubble so the session is non-empty.
      await expect(chatPage.userMessages.first()).toBeVisible({
        timeout: 30_000,
      });

      // Click the toggle — the SDK opens the confirm dialog.
      await clickChatPrivacyToggle(page);
      await chatPrivacy.assertConfirmDialogOpen(true);

      // Cancel.
      await chatPrivacy.cancelPrivacyMidSession();
      await chatPrivacy.assertConfirmDialogOpen(false);

      // State must still be "off".
      await chatPrivacy.assertHeaderState('off');
    });

    // cp-header-05: Send a message, click toggle, CONFIRM → state is "on"
    //               and the session is now one-way locked (expectChatPrivacyLocked).
    test('cp-header-05: confirming enable-private-mode mid-session locks the session as on', async ({
      page,
      chatPage,
    }) => {
      await chatPage.startNewChat();
      await waitForPageReady(page);

      const chatPrivacy = new ChatPrivacyPage(page);
      await chatPrivacy.assertHeaderState('off');

      await chatPage.sendMessage('Hello');
      await expect(chatPage.userMessages.first()).toBeVisible({
        timeout: 30_000,
      });

      // Wait for the chat surface to settle before clicking the toggle.
      // After sendMessage the SDK can briefly disable the toggle while
      // the assistant response streams in; clicking during that window
      // can either silently no-op or open the dialog late, racing the
      // SDK helper's 10 s budget for the dialog to appear. Waiting for
      // `toBeEnabled` here proves any in-flight chat-side mutation has
      // settled and the toggle is interactive.
      const toggle = chatPrivacy.headerToggle();
      await expect(toggle).toBeEnabled({ timeout: 30_000 });

      // Mid-session enable. Our `enablePrivacyMidSession` already has
      // generous internal budgets (toggle interactive → click → dialog
      // visible → action enabled → click → dialog hidden), but the
      // outer-level wait above ensures we don't enter that flow on a
      // briefly-disabled toggle.
      await chatPrivacy.enablePrivacyMidSession();

      // Toggle is on AND locked — session is one-way per spec.
      // Use direct attribute assertions with generous timeouts rather
      // than the SDK helpers; the post-mutation refetch can take a few
      // seconds beyond the SDK's hard-coded 10 s.
      await expect(toggle).toHaveAttribute('data-state', 'on', {
        timeout: 30_000,
      });
      await chatPrivacy.assertHeaderLocked(true);
    });

    // cp-header-06: Refresh mid-private-chat → state persists as "on".
    //               Verifies the localStorage cache + SDK hydration effect.
    test('cp-header-06: private session state persists across a page refresh', async ({
      page,
      chatPage,
    }) => {
      await chatPage.startNewChat();
      await waitForPageReady(page);

      const chatPrivacy = new ChatPrivacyPage(page);

      // Enable + wait for the click to fully settle BEFORE reloading.
      // If we reload while the mutation is still in flight, the
      // localStorage cache that the SDK hydrates from on the next page
      // load may not have the new private session id yet — which is
      // exactly the persistence guarantee this test exists to verify.
      await chatPrivacy.clickToggleAndWaitFor('on');

      // Reload the page.
      const browserName = page.context().browser()?.browserType().name();
      const waitUntil =
        browserName === 'webkit'
          ? ('load' as const)
          : ('domcontentloaded' as const);
      await page.reload({ waitUntil, timeout: 60_000 });
      await waitForPageReady(page);

      // After reload the SDK component remounts. Wait for it to be
      // both visible AND interactive — those two together prove the
      // hydration effect (cache → redux → chat-privacy-effective
      // refetch) has finished. Then assert state with a budget that
      // covers a cold-cache effective-mode fetch.
      const toggle = chatPrivacy.headerToggle();
      await expect(toggle).toBeVisible({ timeout: 30_000 });
      await expect(toggle).toBeEnabled({ timeout: 30_000 });
      await expect(toggle).toHaveAttribute('data-state', 'on', {
        timeout: 30_000,
      });
    });
  });

  // ── 4. User profile "Private Mode" tab ────────────────────────────────────

  test.describe('User profile Private Mode tab (cp-profile-*)', () => {
    test.beforeEach(async ({ page, editMentorPage }) => {
      await goToChatPage(page);
      await waitForAdmin(page);

      const chatPrivacy = new ChatPrivacyPage(page);

      // Same fast-path as the cp-header beforeEach. The three states
      // this block depends on (gate ON, mentor lock OFF, user mode
      // normal) are all readable from the header toggle DOM in ~150ms
      // with no modal opens; in a serial block the previous test's
      // restore almost always leaves them in the expected configuration.
      // Skip the three slow `ensure*` modal-opening helpers when the
      // header confirms the state is correct.
      const toggle = chatPrivacy.headerToggle();
      const fastPathOk = await (async () => {
        const visible = await toggle
          .isVisible({ timeout: 5_000 })
          .catch(() => false);
        if (!visible) return false;
        const ariaDisabled = await toggle
          .getAttribute('aria-disabled')
          .catch(() => null);
        if (ariaDisabled === 'true') return false;
        const dataSource = await toggle
          .getAttribute('data-source')
          .catch(() => null);
        if (dataSource === 'mentor' || dataSource === 'user') return false;
        return true;
      })();

      if (!fastPathOk) {
        // Tier-targeted recovery (same approach as the cp-header
        // beforeEach above). The profile-modal open is the slowest of
        // the three ensures and the most failure-prone — only run it
        // when the toggle confirms the user tier is actually overriding.
        await chatPrivacy.ensureTenantGateEnabled(true);
        await chatPrivacy.ensureAgentPrivacy(editMentorPage, false);

        const dataSourceAfterAgentReset = await toggle
          .getAttribute('data-source')
          .catch(() => null);
        if (dataSourceAfterAgentReset === 'user') {
          await chatPrivacy.ensureProfilePrivateMode('normal');
        }
      }
    });

    // cp-profile-01: Private Mode tab is visible when the tenant gate is on.
    test('cp-profile-01: Private Mode tab is visible in UserProfileModal when tenant gate is on', async ({
      page,
    }) => {
      const chatPrivacy = new ChatPrivacyPage(page);
      // beforeEach guarantees gate ON — no conditional dance needed here.

      const modal = await chatPrivacy.openProfileModal();
      await chatPrivacy.switchToProfilePrivateModeTab();
      await chatPrivacy.assertProfilePrivateModeTabReady();
      await chatPrivacy.closeProfileModal(modal);
    });

    // cp-profile-02: Private Mode tab is hidden when the tenant gate is off.
    test('cp-profile-02: Private Mode tab is hidden when tenant gate is off', async ({
      page,
    }) => {
      const chatPrivacy = new ChatPrivacyPage(page);

      try {
        // Drive gate OFF. beforeEach started from ON, so this is a real
        // ON→OFF transition under test.
        await chatPrivacy.ensureTenantGateEnabled(false);
        await waitForPageReady(page);

        const modal = await chatPrivacy.openProfileModal();
        expect(await chatPrivacy.isProfilePrivateModeTabVisible()).toBe(false);
        await chatPrivacy.closeProfileModal(modal);
      } finally {
        // Restore the journey-wide invariant of gate ON so the next test
        // doesn't inherit an OFF gate. The journey-level afterAll also
        // restores, but in-test restoration is faster and more local.
        await chatPrivacy.ensureTenantGateEnabled(true).catch(() => undefined);
      }
    });

    // cp-profile-03: All three cards render after switchToPrivateModeTab.
    test('cp-profile-03: all three Private Mode radio cards render on the tab', async ({
      page,
    }) => {
      const chatPrivacy = new ChatPrivacyPage(page);
      // Gate ON guaranteed by beforeEach.

      const modal = await chatPrivacy.openProfileModal();
      await chatPrivacy.switchToProfilePrivateModeTab();
      await chatPrivacy.assertProfilePrivateModeTabReady();

      // Assert each card individually for better failure messages.
      await expect(chatPrivacy.profilePrivateModeCard('normal')).toBeVisible({
        timeout: 5_000,
      });
      await expect(
        chatPrivacy.profilePrivateModeCard('anonymized'),
      ).toBeVisible({
        timeout: 5_000,
      });
      await expect(chatPrivacy.profilePrivateModeCard('disabled')).toBeVisible({
        timeout: 5_000,
      });

      await chatPrivacy.closeProfileModal(modal);
    });

    // cp-profile-04: Selecting "Disabled" persists and the header toggle
    //               then reflects data-source="user" on a fresh unlocked chat.
    //               This verifies the user-tier precedence in the chain.
    test('cp-profile-04: selecting Disabled card propagates to header toggle as user-source', async ({
      page,
      chatPage,
    }) => {
      const chatPrivacy = new ChatPrivacyPage(page);
      // beforeEach forced mode to "normal", so the pre-test value is always
      // "normal". Capture defensively in case a future change moves the
      // starting state and to keep the restore symmetric.
      const originalMode =
        (await chatPrivacy.readProfilePrivateMode()) ?? 'normal';

      try {
        await chatPrivacy.ensureProfilePrivateMode('disabled');

        // Fresh chat on an unlocked mentor — header source must be "user".
        await chatPage.startNewChat();
        await waitForPageReady(page);

        await expect(chatPrivacy.headerToggle()).toHaveAttribute(
          'data-state',
          'on',
          { timeout: 10_000 },
        );
        await chatPrivacy.assertHeaderSource('user');
      } finally {
        await chatPrivacy
          .ensureProfilePrivateMode(originalMode)
          .catch(() => undefined);
      }
    });

    // cp-profile-05: Selecting "Normal" reverts the resolved mode to
    //               non-private, so the header toggle reads as off — even
    //               though the user tier is still the contributing source.
    //
    //               "Normal" is an explicit user choice: the profile tab
    //               always persists a concrete `chat_privacy_mode` and has
    //               no "clear my preference" affordance, so the backend's
    //               chat-privacy-effective endpoint keeps data-source="user"
    //               for Normal exactly as it does for Disabled. The toggle's
    //               data-state is driven solely by `mode === 'disabled'`, so
    //               "normal"/"anonymized" read as off while "disabled" reads
    //               as on. This is the symmetric counterpart to cp-profile-04
    //               (Disabled → data-state="on"; Normal → data-state="off"),
    //               both with data-source="user".
    test('cp-profile-05: selecting Normal reverts the header toggle to off while the user tier stays the source', async ({
      page,
      chatPage,
    }) => {
      const chatPrivacy = new ChatPrivacyPage(page);
      const originalMode =
        (await chatPrivacy.readProfilePrivateMode()) ?? 'normal';

      try {
        // Force a non-Normal starting state so the Normal-selection is a
        // genuine transition (beforeEach left it at Normal).
        await chatPrivacy.ensureProfilePrivateMode('disabled');
        await chatPrivacy.ensureProfilePrivateMode('normal');

        await chatPage.startNewChat();
        await waitForPageReady(page);

        // Auto-retry so we wait for the chat-privacy-effective refetch to
        // land — a bare getAttribute races the post-mutation re-render.
        // Normal resolves to a non-private mode, so the toggle reverts to
        // off (data-state). The user tier is still what set the effective
        // value, so data-source stays "user".
        await expect(chatPrivacy.headerToggle()).toHaveAttribute(
          'data-state',
          'off',
          { timeout: 10_000 },
        );
        await expect(chatPrivacy.headerToggle()).toHaveAttribute(
          'data-source',
          'user',
          { timeout: 10_000 },
        );
      } finally {
        await chatPrivacy
          .ensureProfilePrivateMode(originalMode)
          .catch(() => undefined);
      }
    });
  });

  // ── 5. Private chat round-trip (admin + non-admin) ────────────────────────
  //
  // The four blocks above exercise the privacy *surfaces* (gate, kill
  // switch, header toggle, profile tab) but never actually hold a
  // conversation while private mode is on. These two checkpoints close that
  // gap end-to-end: enable private mode via the header toggle on a fresh
  // chat, send a message, and confirm the assistant still replies — once as
  // the admin, once as a non-admin (separate browser context). Both rely on
  // the tenant gate being ON (org-scoped) so the header toggle is present,
  // and the mentor kill switch being OFF so the toggle is interactive
  // rather than locked-on.

  test.describe('Private chat round-trip (cp-chat-*)', () => {
    test.beforeEach(async ({ page, editMentorPage }) => {
      await goToChatPage(page);
      await waitForAdmin(page);

      const chatPrivacy = new ChatPrivacyPage(page);

      // Same fast-path as the cp-header / cp-profile beforeEach blocks:
      // gate ON + mentor lock OFF are readable from the header toggle DOM
      // in ~150ms, and in a serial block the previous test almost always
      // leaves them in that configuration. Only fall back to the slow
      // modal-opening `ensure*` helpers when the toggle says otherwise.
      const toggle = chatPrivacy.headerToggle();
      const fastPathOk = await (async () => {
        const visible = await toggle
          .isVisible({ timeout: 5_000 })
          .catch(() => false);
        if (!visible) return false;
        const ariaDisabled = await toggle
          .getAttribute('aria-disabled')
          .catch(() => null);
        if (ariaDisabled === 'true') return false;
        const dataSource = await toggle
          .getAttribute('data-source')
          .catch(() => null);
        if (dataSource === 'mentor' || dataSource === 'user') return false;
        return true;
      })();

      if (!fastPathOk) {
        // Tier-targeted recovery: gate ON + mentor lock OFF so the toggle is
        // visible and interactive; only touch the user-profile tier when the
        // toggle's data-source says it is actually overriding.
        await chatPrivacy.ensureTenantGateEnabled(true);
        await chatPrivacy.ensureAgentPrivacy(editMentorPage, false);

        const dataSourceAfterAgentReset = await toggle
          .getAttribute('data-source')
          .catch(() => null);
        if (dataSourceAfterAgentReset === 'user') {
          await chatPrivacy.ensureProfilePrivateMode('normal');
        }

        await expect(toggle).toBeVisible({ timeout: 15_000 });
      }
    });

    // cp-chat-01: Admin enables private mode on a fresh chat, sends a
    //             message, and still receives an assistant reply.
    test('cp-chat-01: admin can chat in private mode and receive a reply', async ({
      page,
      chatPage,
    }) => {
      const chatPrivacy = new ChatPrivacyPage(page);

      // Fresh chat so the session starts from a clean, non-private state.
      await chatPage.startNewChat();
      await waitForPageReady(page);
      await chatPrivacy.assertHeaderState('off');

      // Enable private mode via the header toggle. No messages have been
      // sent yet, so this starts a private session (data-state=on,
      // data-source=session) without a confirm dialog.
      await chatPrivacy.clickToggleAndWaitFor('on', 'session');

      // Hold a conversation while private mode is on.
      await chatPage.sendMessage('Hello, can you help me?');
      await expect(chatPage.userMessages.first()).toBeVisible({
        timeout: 30_000,
      });
      await chatPage.waitForAIResponse();
      await expect(chatPage.aiMessages.first()).toBeVisible();

      // Private mode must remain on across the round-trip.
      await chatPrivacy.assertHeaderState('on');
    });

    // cp-chat-02: Non-admin (separate browser context) enables private mode
    //             on a fresh chat, sends a message, and receives a reply.
    test('cp-chat-02: non-admin can chat in private mode and receive a reply', async ({
      nonadminPage,
      nonadminChatPage,
    }) => {
      // The admin beforeEach left the tenant gate ON (org-scoped), so the
      // non-admin sees the header toggle once it navigates in.
      await navigateToMentorApp(nonadminPage);
      await waitForPageReady(nonadminPage);

      const chatPrivacy = new ChatPrivacyPage(nonadminPage);

      await nonadminChatPage.startNewChat();
      await waitForPageReady(nonadminPage);

      const toggle = chatPrivacy.headerToggle();
      await expect(toggle).toBeVisible({ timeout: 30_000 });

      // Enable private mode. Skip the click if a user-tier profile setting
      // already made this fresh session private (the non-admin user's
      // profile mode is not managed by this journey, so don't assume it).
      const currentState = await toggle
        .getAttribute('data-state')
        .catch(() => null);
      if (currentState !== 'on') {
        await chatPrivacy.clickToggleAndWaitFor('on');
      }
      await expect(toggle).toHaveAttribute('data-state', 'on', {
        timeout: 30_000,
      });

      // Hold a conversation while private mode is on.
      await nonadminChatPage.sendMessage('Hello, can you help me?');
      await expect(nonadminChatPage.userMessages.first()).toBeVisible({
        timeout: 30_000,
      });
      await nonadminChatPage.waitForAIResponse();
      await expect(nonadminChatPage.aiMessages.first()).toBeVisible();

      // Private mode must remain on across the round-trip.
      await expect(toggle).toHaveAttribute('data-state', 'on', {
        timeout: 30_000,
      });
    });

    // ── Feature-interaction checkpoints (cp-chat-04 … cp-chat-08) ───────────
    //
    // These five checkpoints are LIVE regression gates. They assert the
    // CORRECT/EXPECTED behavior while private mode is active, even though
    // that behavior does not yet exist for several features (backend fixes
    // and one frontend gate are in progress). They are expected to be RED
    // until the corresponding fix ships. Do NOT mark them test.fixme and
    // do NOT weaken assertions to make them pass today.
    //
    // All run as admin (default `page` + `chatPage` fixtures). The
    // non-admin round-trip is already covered by cp-chat-02; these
    // feature gates run as admin to avoid the non-admin paywall on
    // file attachments and to access features gated on admin roles.

    // cp-chat-04: Admin-curated Prompt Gallery works in private mode; AI
    //             guided/suggested prompts are shown once the backend fix lands.
    //
    // TWO ASSERTIONS:
    //   (a) Prompt Gallery (admin-curated, mentor-keyed) — PASSES TODAY.
    //       The gallery is fetched from a mentor-scoped endpoint that is
    //       not session-keyed, so private mode has no effect.
    //   (b) AI guided/suggested prompts row — LIVE GATE, currently RED.
    //       The guided-prompts endpoint is session-keyed
    //       (GET .../sessions/{session_id}/guided-prompts/) and the backend
    //       builds prompts from the session's persisted conversation history.
    //       A disable_chathistory:true session has no persisted history, so
    //       the backend returns ai_prompts=[] and components/guided-suggested-
    //       prompts.tsx:54 renders null. The fix: backend must generate guided
    //       prompts for private sessions (ephemeral in-session context).
    //       The expected behavior once fixed: the guided-prompts row IS
    //       visible on a fresh private chat (after the AI replies).
    //
    // The guided-prompts row container exposes a single stable hook
    //   (`data-testid="guided-suggested-prompts"` +
    //   CSS_CLASS_NAMES.APP_LAYOUT.GUIDED_SUGGESTED_PROMPTS_CONTAINER), with
    //   individual prompt buttons under CSS_CLASS_NAMES.APP_LAYOUT
    //   .GUIDED_SUGGESTED_PROMPTS = 'chat-guided-suggested-prompts'.
    test('cp-chat-04: prompt gallery works in private mode and guided prompts are shown', async ({
      page,
      chatPage,
    }) => {
      const chatPrivacy = new ChatPrivacyPage(page);

      await chatPage.startNewChat();
      await waitForPageReady(page);
      await chatPrivacy.assertHeaderState('off');

      // Enable private mode on an empty chat.
      await chatPrivacy.clickToggleAndWaitFor('on', 'session');

      // ── (a) Admin-curated Prompt Gallery ─────────────────────────────
      // The Prompt Gallery button (chatPage.promptsButton) must still be
      // visible and openable in private mode because its data is mentor-keyed,
      // not session-keyed. This assertion is expected to PASS today.
      let galleryButtonVisible = false;
      try {
        await chatPage.promptsButton.waitFor({
          state: 'visible',
          timeout: 10_000,
        });
        galleryButtonVisible = true;
      } catch {
        galleryButtonVisible = false;
      }
      if (galleryButtonVisible) {
        await chatPage.openPromptGallery();
        // At least one Run button should be visible inside the gallery,
        // meaning prompt cards are rendering in private mode.
        const runButtons = chatPage.getPromptGalleryRunButtons();
        const runCount = await runButtons.count();
        // If the gallery has no prompts configured in this env, skip the
        // card assertion gracefully — but the dialog must still open.
        await expect(chatPage.promptGalleryDialog).toBeVisible({
          timeout: 10_000,
        });
        if (runCount > 0) {
          await expect(runButtons.first()).toBeVisible({ timeout: 5_000 });
        }
        await chatPage.closePromptGallery();
      }

      // ── (b) AI guided/suggested prompts row ──────────────────────────
      // Send a message so the AI replies; the guided-prompts query fires
      // after streaming completes (GuidedSuggestedPrompts re-fetches on
      // !isStreaming). In private mode the backend returns ai_prompts=[]
      // so the component renders null. The EXPECTED (once fixed) behavior
      // is that the row IS visible. We assert it IS visible.
      //
      // LIVE GATE: this assertion is RED until the backend generates
      // guided prompts for disable_chathistory sessions.
      await chatPage.sendMessage('Hello');
      await expect(chatPage.userMessages.first()).toBeVisible({
        timeout: 30_000,
      });
      await chatPage.waitForStreamingComplete(120_000);

      // Wait a moment for the guided-prompts refetch to settle post-stream.
      await page.waitForTimeout(3_000);

      // Assert the row container is present (single, stable testid hook) and
      // that at least one guided-prompt button rendered inside it — the row
      // shows up to three, so we confirm ≥1 rather than asserting on the
      // multi-match button class directly.
      await expect(chatPage.guidedSuggestedPrompts).toBeVisible({
        timeout: 30_000,
      });
      await expect(chatPage.guidedSuggestedPromptButtons.first()).toBeVisible({
        timeout: 5_000,
      });
    });

    // cp-chat-05: Voice call works in private mode (empty-chat path).
    //
    // LIVE GATE — currently RED pending backend credential-minting fix.
    //
    // Root cause (hypothesis, medium confidence): on click the LiveKit modal
    // calls useCreateCallCredentialsMutation → POST /create-call-credentials/
    // with session_id = cachedSessionId?.[mentorId] (which is the private
    // session id). The backend credential lookup is documented to return
    // 404 "No mentor or session found" when the session has no linked
    // student (which disable-chathistory's mid-conversation path causes by
    // nulling Session.student). For the EMPTY-CHAT private path a real new
    // session IS persisted (startPrivateChat POSTs /sessions/ with
    // disable_chathistory:true), so this path MAY already pass.
    //
    // This test covers the EMPTY-CHAT private path only (no prior messages,
    // so Session.student is not yet nulled). The expected outcome: the
    // Voice Chat dialog opens AND does NOT show "Failed to initiate call".
    //
    // Chromium-only: uses --use-fake-device-for-media-stream so the
    // microphone permission grant and LiveKit media negotiation succeed
    // without real hardware. Mirrors the pattern from journey 09
    // (09-voice-chat.spec.ts) and journey 37
    // (37-voice-call-and-screen-share-in-canvas.spec.ts).
    test('cp-chat-05: voice call dialog opens without error in private mode', async ({
      page,
      chatPage,
    }) => {
      // Guard: this test requires Chromium fake-media flags. The suite-level
      // test.use({ launchOptions }) approach cannot be used here because this
      // file has no top-level test.use and adding one would affect ALL tests.
      // Instead we guard at the test body level and skip non-Chromium runners
      // — matching the approach used by journey 09's body-level skip.
      const browserName = page.context().browser()?.browserType().name();
      if (browserName !== 'chromium') {
        test.skip(
          true,
          'cp-chat-05 uses fake media device flags — Chromium only',
        );
        return;
      }

      // Grant microphone permission for the fake device.
      await page.context().grantPermissions(['microphone']);

      const chatPrivacy = new ChatPrivacyPage(page);

      await chatPage.startNewChat();
      await waitForPageReady(page);
      await chatPrivacy.assertHeaderState('off');

      // Enable private mode on an EMPTY chat. startPrivateChat creates a
      // real new session with disable_chathistory:true — Session.student is
      // NOT yet nulled (no mid-conversation flip occurred here), so the
      // credential endpoint should find the session.
      await chatPrivacy.clickToggleAndWaitFor('on', 'session');

      // Guard: voice call button may be hidden if the mentor has voice calls
      // disabled in Settings → Capabilities. Skip gracefully if absent.
      let voiceButtonVisible = false;
      try {
        await chatPage.voiceCallButton.waitFor({
          state: 'visible',
          timeout: 10_000,
        });
        voiceButtonVisible = true;
      } catch {
        voiceButtonVisible = false;
      }
      if (!voiceButtonVisible) {
        test.skip(
          true,
          'Voice call button not visible — mentor may have voice calls disabled',
        );
        return;
      }

      // Click the voice call button.
      await chatPage.voiceCallButton.click();

      // EXPECTED (once backend fix lands): the Voice Chat dialog opens and
      // reaches a connected/ready state. At minimum it must NOT show the
      // "Failed to initiate call" error toast within a generous timeout.
      //
      // Assert the dialog opens.
      const voiceDialog = page.getByRole('dialog', { name: /voice chat/i });
      await expect(voiceDialog).toBeVisible({ timeout: 30_000 });

      // Assert NO "Failed to initiate call" error toast appears.
      const failedToast = page.getByText(/failed to initiate call/i);
      let failedVisible = false;
      try {
        await failedToast.waitFor({ state: 'visible', timeout: 15_000 });
        failedVisible = true;
      } catch {
        failedVisible = false;
      }
      expect(
        failedVisible,
        'No "Failed to initiate call" toast should appear when starting a voice call in private mode',
      ).toBe(false);

      // Close the dialog.
      const closeVoice = voiceDialog
        .getByRole('button', { name: /close/i })
        .first();
      let closeVisible = false;
      try {
        await closeVoice.waitFor({ state: 'visible', timeout: 5_000 });
        closeVisible = true;
      } catch {
        closeVisible = false;
      }
      if (closeVisible) {
        await closeVoice.click();
      } else {
        await page.keyboard.press('Escape');
      }
      await expect(voiceDialog).not.toBeVisible({ timeout: 10_000 });

      // Private mode must remain on.
      await chatPrivacy.assertHeaderState('on');
    });

    // cp-chat-06: Multi-turn context retained in private mode.
    //
    // TWO ASSERTIONS:
    //   (a) Front-end contract (PASSES TODAY): the cached session id is
    //       STABLE across two sends in the same private session — the SDK
    //       does not create a second new session between turns.
    //   (b) AI context recall (LIVE GATE, currently RED): the assistant
    //       echoes back the code word established in turn 1, proving the
    //       backend retains in-session context for disable_chathistory:true
    //       sessions (ephemeral in-session memory).
    //
    // Root cause for (b): useChat.sendMessage sends only
    // {flow, session_id, token, prompt} — NO history array. The server
    // must reconstruct prior turns from the session. For a
    // disable_chathistory:true session the backend does not persist turns,
    // so cross-turn context the server would normally rebuild is unavailable.
    // The fix: backend must retain in-memory session context for the
    // lifetime of a live private session (analogous to incognito mode:
    // context works during the session but is not stored afterward).
    test('cp-chat-06: multi-turn context is retained within a private session', async ({
      page,
      chatPage,
    }) => {
      const chatPrivacy = new ChatPrivacyPage(page);

      await chatPage.startNewChat();
      await waitForPageReady(page);
      await chatPrivacy.assertHeaderState('off');

      // Enable private mode on an empty chat.
      await chatPrivacy.clickToggleAndWaitFor('on', 'session');

      // Get the platform context so we can read the cached session id.
      const { mentorId } = await getPlatformContext(page);

      // Capture session id BEFORE sending any messages.
      const sessionIdBefore = await chatPage.getCachedSessionId(mentorId);
      expect(
        sessionIdBefore,
        'Private session id must be set before first send',
      ).toBeTruthy();

      // ── Turn 1: plant a distinctive code word ────────────────────────
      // Use a distinctive token to reduce LLM recall ambiguity.
      await chatPage.sendMessage(
        'Remember this code word: ZEPHYR7. Reply with just OK.',
      );
      await expect(chatPage.userMessages.first()).toBeVisible({
        timeout: 30_000,
      });
      await chatPage.waitForStreamingComplete(120_000);
      await expect(chatPage.aiMessages.first()).toBeVisible({
        timeout: 30_000,
      });

      // ── (a) Front-end contract: session id must be STABLE after turn 1 ─
      const sessionIdAfterTurn1 = await chatPage.getCachedSessionId(mentorId);
      expect(
        sessionIdAfterTurn1,
        'Session id must not change between turns (no new session created)',
      ).toBe(sessionIdBefore);

      // ── Turn 2: ask for recall ────────────────────────────────────────
      // Give the backend a moment to persist turn 1 into session memory before
      // asking for recall — without this gap the follow-up can race the write
      // and the code word isn't yet retained, causing intermittent failures.
      await page.waitForTimeout(10_000);
      await chatPage.sendMessage('What was the code word I gave you?');
      await expect(chatPage.userMessages.nth(1)).toBeVisible({
        timeout: 30_000,
      });
      await chatPage.waitForStreamingComplete(120_000);
      await expect(chatPage.aiMessages.nth(1)).toBeVisible({ timeout: 30_000 });

      // ── (a) continued: session id must still be STABLE after turn 2 ──
      const sessionIdAfterTurn2 = await chatPage.getCachedSessionId(mentorId);
      expect(
        sessionIdAfterTurn2,
        'Session id must not change after the follow-up (no second session creation)',
      ).toBe(sessionIdBefore);

      // ── (b) LIVE GATE: AI must recall the code word ──────────────────
      // The latest AI message text must contain "ZEPHYR7" (case-insensitive).
      // This asserts the backend retains in-session context for private
      // sessions. RED until the backend implements ephemeral session memory
      // for disable_chathistory:true sessions.
      const lastAiMessage = chatPage.aiMessages.nth(1);
      const lastAiText = await lastAiMessage.textContent();
      expect(
        (lastAiText ?? '').toLowerCase(),
        'AI must recall the code word "ZEPHYR7" from the prior turn — backend must retain in-session context for private sessions',
      ).toContain('zephyr7');
    });

    // cp-chat-07: File attachment works in private mode.
    //
    // Analysis: LIKELY PASSES TODAY — the upload path reads session_id via
    // selectSessionId (Redux slice), and startPrivateChat updates that same
    // slice via chatActions.updateSessionIds. So the upload POST for
    // /chat/files/upload-url/ already uses the private session id correctly.
    // The test is included as a regression gate to pin this contract.
    //
    // Uses drag-drop (not the file-chooser button) to avoid triggering
    // any subscription/paywall check that the Attach File button click path
    // may hit in some environments. Admin context avoids the non-admin
    // pricing paywall (journey 08 documents that non-admin hits ibl.ai
    // Pricing Plans which blocks Attach File entirely).
    test('cp-chat-07: file attachment works in private mode', async ({
      page,
      chatPage,
    }) => {
      const chatPrivacy = new ChatPrivacyPage(page);

      await chatPage.startNewChat();
      await waitForPageReady(page);
      await chatPrivacy.assertHeaderState('off');

      // Enable private mode on an empty chat.
      await chatPrivacy.clickToggleAndWaitFor('on', 'session');

      // Drag-drop a small text file onto the chat area. The dragAndDropFiles
      // utility dispatches a synthetic dragover (to activate the drop zone)
      // followed by a drop event — matching the pattern used in journeys
      // 08/46/54 for file upload testing.
      await dragAndDropFiles(page, [
        {
          name: 'test-private.txt',
          type: 'text/plain',
          content: 'E2E private mode attachment test',
        },
      ]);

      // EXPECTED: the attachment chip appears and shows a success state.
      // data-testid="attachment-chip" is set in
      // components/chat-input-form/file-attachments-list.tsx:51.
      const attachmentChip = page.getByTestId('attachment-chip').first();
      await expect(attachmentChip).toBeVisible({ timeout: 30_000 });

      // Send the message with the attachment.
      await chatPage.sendMessage('What does this file say?');

      // Assert the user message bubble renders (with the attachment visible
      // in the message area).
      await expect(chatPage.userMessages.first()).toBeVisible({
        timeout: 30_000,
      });

      // Assert the assistant replies — proving the full upload+send
      // round-trip worked against the private session id.
      await chatPage.waitForAIResponse();
      await expect(chatPage.aiMessages.first()).toBeVisible({
        timeout: 30_000,
      });

      // Private mode must remain on.
      await chatPrivacy.assertHeaderState('on');
    });

    // cp-chat-08: Memory button is hidden in private mode.
    //
    // Frontend gate IMPLEMENTED (this is the confirmatory e2e for it):
    // components/chat-input-form.tsx calls
    // `useChatPrivacy({org: tenantKey, userId: username, mentor: mentorId})`
    // (from @iblai/iblai-js/web-containers), derives
    // `chatPrivacyActive = isEffectiveReady && effective?.mode === 'disabled'`,
    // and passes `isPrivate={chatPrivacyActive}` into InsideButtons. The
    // memory item's gate in inside-buttons.tsx is
    // `memoryEnabled && !embedMode && !!username && !isPrivate`, so the
    // existing `.filter((item) => item.isEnabled)` drops Memory from BOTH the
    // inline row and the overflow ••• dropdown when private mode is active.
    // Deterministic coverage lives in
    // components/chat-input-form/__tests__/inside-buttons.test.tsx
    // ("Memory button private-mode gating"); this e2e confirms the wiring
    // end-to-end inside a real private session.
    //
    // Guard: this test requires the mentor to have memory enabled. If the
    // Memory button is absent even in NORMAL mode (memory off in mentor
    // settings), skip gracefully — an absent button in both modes gives us
    // no signal. We first confirm visibility in normal mode, then check it
    // disappears after private mode is enabled.
    test('cp-chat-08: memory button is hidden while private mode is on and reappears when it is off', async ({
      page,
      chatPage,
    }) => {
      const chatPrivacy = new ChatPrivacyPage(page);

      // Start on a NORMAL-mode fresh chat to establish the baseline.
      await chatPage.startNewChat();
      await waitForPageReady(page);
      await chatPrivacy.assertHeaderState('off');

      // Guard: check whether the Memory button is present in NORMAL mode.
      // If the mentor has memory disabled in its settings, the button is
      // absent regardless of privacy — no signal to test. Skip gracefully.
      let memoryVisibleInNormalMode = false;
      try {
        await chatPage.memoryButton.waitFor({
          state: 'visible',
          timeout: 10_000,
        });
        memoryVisibleInNormalMode = true;
      } catch {
        memoryVisibleInNormalMode = false;
      }
      if (!memoryVisibleInNormalMode) {
        test.skip(
          true,
          'Memory button not visible in normal mode — mentor memory may be disabled in settings; no private-mode signal to assert',
        );
        return;
      }

      // Memory button IS visible in normal mode — establish baseline.
      await expect(chatPage.memoryButton).toBeVisible({ timeout: 5_000 });

      // Enable private mode on the empty chat (no confirm dialog).
      await chatPrivacy.clickToggleAndWaitFor('on', 'session');

      // The Memory button must NOT be visible while private mode is on
      // (data-state='on'). The implemented gate in chat-input-form.tsx
      // computes chatPrivacyActive from useChatPrivacy and passes
      // isPrivate=true into InsideButtons, which drops the Memory item.
      await expect(
        chatPage.memoryButton,
        'Memory button must be hidden while private mode is on (chatPrivacyActive → isPrivate gate in InsideButtons)',
      ).not.toBeVisible({ timeout: 15_000 });

      // Exit private mode: start a new (normal) chat. The SDK's
      // startNormalChat creates a fresh session with disable_chathistory:false,
      // so the effective mode falls back to the non-private default.
      await chatPage.startNewChat();
      await waitForPageReady(page);
      await chatPrivacy.assertHeaderState('off');

      // After exiting private mode the Memory button must reappear.
      await expect(
        chatPage.memoryButton,
        'Memory button must reappear once private mode is off',
      ).toBeVisible({ timeout: 15_000 });
    });

    // cp-chat-09: "Share this chat" button in the AI message bubble is hidden
    //             in private mode.
    //
    // Frontend gate IMPLEMENTED (this is the confirmatory e2e for it): a
    // private session is a temporary, non-persisted chat, so there is no
    // durable session to share. components/chat/ai-message-bubble.tsx derives
    // `chatPrivacyActive` from useChatPrivacy and only renders <AIMessageShare>
    // when `!showingSharedChat && !chatPrivacyActive`. Deterministic coverage
    // lives in components/chat/__tests__/ai-message-bubble.test.tsx; this e2e
    // confirms the wiring end-to-end inside a real private session.
    //
    // The share control's accessible name is "Share this chat" (the sr-only
    // span in ai-message-share.tsx), matching journey 12's locator.
    test('cp-chat-09: share-chat button in the AI bubble is hidden in private mode', async ({
      page,
      chatPage,
    }) => {
      const chatPrivacy = new ChatPrivacyPage(page);
      const shareButton = page
        .getByRole('button', { name: 'Share this chat' })
        .first();

      // ── Baseline: NORMAL mode shows the share button after a reply ──────
      await chatPage.startNewChat();
      await waitForPageReady(page);
      await chatPrivacy.assertHeaderState('off');

      await chatPage.sendMessage('Hello there');
      await expect(chatPage.userMessages.first()).toBeVisible({
        timeout: 30_000,
      });
      await chatPage.waitForAIResponse();
      await chatPage.waitForStreamingComplete(120_000);

      // The share button appears in the AI bubble's action toolbar once the
      // response is complete. This proves the button exists for this
      // mentor/user before we assert private mode hides it.
      await expect(shareButton).toBeVisible({ timeout: 30_000 });

      // ── Private mode hides the share button ─────────────────────────────
      await chatPage.startNewChat();
      await waitForPageReady(page);
      await chatPrivacy.assertHeaderState('off');

      // Enable private mode on the empty chat (no confirm dialog).
      await chatPrivacy.clickToggleAndWaitFor('on', 'session');

      await chatPage.sendMessage('Hello in private mode');
      await expect(chatPage.userMessages.first()).toBeVisible({
        timeout: 30_000,
      });
      await chatPage.waitForAIResponse();
      await chatPage.waitForStreamingComplete(120_000);

      // The AI bubble rendered in a private session must NOT expose the share
      // control (chatPrivacyActive → the AIMessageShare render is gated out).
      await expect(
        shareButton,
        'Share-chat button must be hidden in the AI bubble while private mode is on',
      ).not.toBeVisible({ timeout: 15_000 });

      // Private mode must remain on throughout.
      await chatPrivacy.assertHeaderState('on');
    });
  });
});
