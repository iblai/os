/**
 * Journey 49 — Chat Privacy
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
import { navigateToMentorApp, waitForAdmin } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
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

test.describe('Journey 49: Chat Privacy', () => {
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

    // cp-tenant-05: Non-admin cannot access the tenant Advanced settings.
    //
    // Non-admins reach the platform via a separate browser context
    // (`nonadminPage`). The "More options" dropdown for non-admins only
    // surfaces "Profile", "Help", "Log out" — no platform-name item —
    // so `openTenantAdvancedTab` throws before reaching the Advanced
    // tab. This is the CORRECT UX and is implicitly covered by the
    // non-admin profile dropdown test in journey 03. We declare the
    // checkpoint here for coverage symmetry but skip the body since
    // the non-admin context setup is owned by journey 03.
    test('cp-tenant-05: non-admin cannot reach tenant Advanced settings (covered by journey 03 profile dropdown)', async () => {
      test.skip(
        true,
        'Non-admin tenant-settings access is covered by journey 03; no duplication needed here',
      );
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
      await editMentorPage.open('Settings');
      await editMentorPage.settings.selectSubTab('Capabilities');
      await expect(chatPrivacy.agentPrivacySwitch).toHaveAttribute(
        'aria-checked',
        'true',
        { timeout: 10_000 },
      );

      // Restore.
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

      // Header toggle must be on, locked, and source=mentor.
      await expect(chatPrivacy.headerToggle()).toHaveAttribute(
        'data-state',
        'on',
        {
          timeout: 10_000,
        },
      );
      await chatPrivacy.assertHeaderStateAndSource('on', 'mentor');
      await chatPrivacy.assertHeaderLocked(true);

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

      await chatPrivacy.clickHeaderToggle();

      await expect(chatPrivacy.headerToggle()).toHaveAttribute(
        'data-state',
        'on',
        {
          timeout: 10_000,
        },
      );
      await chatPrivacy.assertHeaderStateAndSource('on', 'session');
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

      // Enable.
      await chatPrivacy.clickHeaderToggle();
      await expect(chatPrivacy.headerToggle()).toHaveAttribute(
        'data-state',
        'on',
        {
          timeout: 10_000,
        },
      );

      // Disable — this is a fresh session so no confirm dialog.
      await chatPrivacy.clickHeaderToggle();
      await expect(chatPrivacy.headerToggle()).toHaveAttribute(
        'data-state',
        'off',
        {
          timeout: 10_000,
        },
      );
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

      // Enable mid-session.
      await chatPrivacy.enablePrivacyMidSession();

      // Confirm dialog must close before proceeding.
      await chatPrivacy.assertConfirmDialogOpen(false);

      // Toggle is on and locked — session is one-way.
      await expect(chatPrivacy.headerToggle()).toHaveAttribute(
        'data-state',
        'on',
        {
          timeout: 10_000,
        },
      );
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

      // Enable without a mid-session message so no confirm dialog is needed.
      await chatPrivacy.clickHeaderToggle();
      await expect(chatPrivacy.headerToggle()).toHaveAttribute(
        'data-state',
        'on',
        {
          timeout: 10_000,
        },
      );

      // Reload the page.
      const browserName = page.context().browser()?.browserType().name();
      const waitUntil =
        browserName === 'webkit'
          ? ('load' as const)
          : ('domcontentloaded' as const);
      await page.reload({ waitUntil, timeout: 60_000 });
      await waitForPageReady(page);

      // The toggle must still be on after hydration.
      await expect(chatPrivacy.headerToggle()).toHaveAttribute(
        'data-state',
        'on',
        {
          timeout: 15_000,
        },
      );
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

    // cp-profile-05: Selecting "Normal" reverts the user-tier contribution
    //               so the header data-source is no longer "user".
    test('cp-profile-05: selecting Normal reverts the user-tier contribution so header source is not user', async ({
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
        await expect(chatPrivacy.headerToggle()).not.toHaveAttribute(
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
});
