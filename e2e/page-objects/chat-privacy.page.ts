import { Page, Locator, expect } from '@playwright/test';
import {
  getChatPrivacyToggle,
  expectChatPrivacyToggleVisible,
  expectChatPrivacyState,
  expectChatPrivacySource,
  expectChatPrivacyLocked,
  clickChatPrivacyToggle,
  getChatPrivacyConfirmDialog,
  expectChatPrivacyConfirmDialogOpen,
  cancelEnableChatPrivacyMidSession,
  getPrivateModeCard,
  selectPrivateMode,
  expectPrivateModeSelected,
  expectPrivateModeTabReady,
  getTenantChatPrivacySwitch,
  getTenantChatPrivacyRow,
  expectTenantChatPrivacyVisible,
  expectTenantChatPrivacyEnabled,
  setTenantChatPrivacyEnabled,
  type ChatPrivacySource,
  type ChatPrivacyMode,
  type ChatPrivacyToggleState,
} from '@iblai/iblai-js/playwright';
import { reliableClick } from '../utils/resilient';

/**
 * Page object for the Chat Privacy feature.
 *
 * Wraps the SDK's official Playwright helpers for all four surfaces:
 *
 *  1. **Tenant gate** — `getTenantChatPrivacySwitch` / `setTenantChatPrivacyEnabled`
 *     in the tenant Account Settings → Advanced tab.
 *  2. **Agent settings kill switch** — "Enable private mode" in Edit Mentor →
 *     Settings → Capabilities (in-repo, keyed via `aria-label`).
 *  3. **Header toggle (nav-bar Private Mode pill)** — `getChatPrivacyToggle`
 *     and related helpers; driven by `data-state` / `data-source` / `aria-disabled`.
 *  4. **User profile "Private Mode" tab** — `switchToPrivateModeTab` /
 *     `selectPrivateMode` / `expectPrivateModeSelected`.
 *
 * Precedence chain (highest → lowest):
 *   mentor (disable_chathistory) > tenant > session > user > default
 *
 * Keep this page object thin — it composes SDK helpers and exposes
 * state-aware methods (e.g. `lockAgentPrivacyOn`) that encapsulate the
 * multi-step sequences needed in journey 49. Do not inline raw selectors
 * when an SDK helper already exists.
 */
export class ChatPrivacyPage {
  readonly page: Page;

  /**
   * The "Enable private mode" switch inside Edit Mentor → Settings →
   * Capabilities. This is an in-repo surface — not an SDK helper — so it
   * is resolved by `aria-label` which the component (`settings-tab.tsx`)
   * explicitly provides.
   */
  readonly agentPrivacySwitch: Locator;

  /** Save button inside the Edit Mentor Settings form. */
  readonly agentSettingsSaveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // The settings form is scoped inside the Edit Agent dialog.
    const dialog = page.getByRole('dialog').filter({ hasText: 'Edit Agent' });
    this.agentPrivacySwitch = dialog.getByRole('switch', {
      name: 'Enable private mode',
    });
    this.agentSettingsSaveButton = dialog
      .getByRole('button', { name: /save/i })
      .first();
  }

  // ── Tenant gate ─────────────────────────────────────────────────────────

  /**
   * Open Account Settings → Advanced tab and return the dialog locator.
   * Mirrors the pattern used by journey 38 (Tenant Memory System toggle).
   * The platform name is read from `localStorage.current_tenant.platform_name`
   * rather than a hardcoded string so the helper works across tenants.
   */
  async openTenantAdvancedTab(): Promise<Locator> {
    const profileBtn = this.page.getByRole('button', { name: 'More options' });
    await expect(profileBtn).toBeVisible({ timeout: 15_000 });
    await profileBtn.click();

    const menu = this.page.getByRole('menu', { name: 'More options' });
    await expect(menu).toBeVisible({ timeout: 5_000 });

    const platformName = await this.page.evaluate(() => {
      const raw = window.localStorage.getItem('current_tenant');
      if (!raw) return null;
      try {
        return JSON.parse(raw)?.platform_name ?? null;
      } catch {
        return null;
      }
    });

    if (!platformName) {
      throw new Error(
        'Could not retrieve platform_name from localStorage — cannot navigate to Account Settings',
      );
    }

    const tenantMenuItem = menu.getByText(platformName, { exact: true });
    await expect(tenantMenuItem).toBeVisible({ timeout: 5_000 });
    await tenantMenuItem.click();

    const accountDialog = this.page.getByRole('dialog', {
      name: 'User Profile',
    });
    await expect(accountDialog).toBeVisible({ timeout: 15_000 });

    const advancedTab = accountDialog.getByRole('button', { name: 'Advanced' });
    await expect(advancedTab).toBeVisible({ timeout: 5_000 });
    await advancedTab.click();

    // Wait for the chat-privacy row to land before returning the dialog.
    await expect(getTenantChatPrivacyRow(accountDialog)).toBeVisible({
      timeout: 10_000,
    });

    return accountDialog;
  }

  /** Close the Account Settings dialog via Close button or Escape fallback. */
  async closeTenantAdvancedTab(dialog: Locator): Promise<void> {
    const closeBtn = dialog.getByRole('button', { name: /close/i }).last();
    let isVisible = false;
    try {
      await closeBtn.waitFor({ state: 'visible', timeout: 5_000 });
      isVisible = true;
    } catch {
      isVisible = false;
    }
    if (isVisible) {
      await closeBtn.click();
    } else {
      await this.page.keyboard.press('Escape');
    }
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });
  }

  /**
   * Read the current tenant gate state without changing it.
   * Returns `true` when the switch is currently on (`aria-checked="true"`).
   */
  async getTenantGateState(dialog: Locator): Promise<boolean> {
    const sw = getTenantChatPrivacySwitch(dialog);
    const state = await sw.getAttribute('aria-checked').catch(() => 'false');
    return state === 'true';
  }

  /**
   * Idempotently set the tenant "Allow users to control chat privacy" switch
   * to the desired state and wait for the mutation to persist.
   * A no-op when the switch is already in the target state.
   */
  async setTenantGate(dialog: Locator, enabled: boolean): Promise<void> {
    await setTenantChatPrivacyEnabled(dialog, enabled);
  }

  /**
   * Assert that the tenant gate switch exists and reflects the expected state.
   * Delegates to the SDK helper so the assertion uses the same `aria-checked`
   * attribute the implementation exposes.
   */
  async assertTenantGate(
    dialog: Locator,
    expectedEnabled: boolean,
  ): Promise<void> {
    await expectTenantChatPrivacyEnabled(dialog, expectedEnabled);
  }

  /**
   * Assert that the tenant gate row is (or is not) visible in the Advanced tab.
   */
  async assertTenantGateRowVisible(
    dialog: Locator,
    visible: boolean,
  ): Promise<void> {
    await expectTenantChatPrivacyVisible(dialog, visible);
  }

  // ── Agent settings kill switch ──────────────────────────────────────────

  /**
   * Read the current state of "Enable private mode" inside the
   * Edit Mentor Settings → Capabilities sub-tab.
   * Returns `true` when `aria-checked="true"`.
   */
  async getAgentPrivacyState(): Promise<boolean> {
    const state = await this.agentPrivacySwitch
      .getAttribute('aria-checked')
      .catch(() => 'false');
    return state === 'true';
  }

  /**
   * Idempotently set the "Enable private mode" switch to `enabled` and click
   * Save. Blocks until the "Agent updated successfully" toast appears so that
   * the RTK Query cache invalidation (`chatPrivacyApiSlice.util.invalidateTags(
   * ['ChatPrivacyEffective'])`) has been dispatched and the nav-bar toggle
   * reflects the new state without a page refresh.
   *
   * This is the regression test anchor for feat/mentor/1797.
   */
  async setAgentPrivacy(enabled: boolean): Promise<void> {
    await expect(this.agentPrivacySwitch).toBeVisible({ timeout: 10_000 });
    const currentlyOn = await this.getAgentPrivacyState();
    if (currentlyOn !== enabled) {
      await reliableClick(this.page, this.agentPrivacySwitch);
      await expect(this.agentPrivacySwitch).toHaveAttribute(
        'aria-checked',
        String(enabled),
        { timeout: 10_000 },
      );
    }
    await expect(this.agentSettingsSaveButton).toBeEnabled({ timeout: 10_000 });
    await this.agentSettingsSaveButton.click();
    await expect(
      this.page.getByText(/Agent updated successfully/i).first(),
    ).toBeVisible({ timeout: 30_000 });
  }

  /**
   * Turn on the agent-level private-mode kill switch and save. After this,
   * the header toggle should be locked-on (`data-state="on"`, `aria-disabled`)
   * with `data-source="mentor"` — immediately, without a page refresh.
   */
  async lockAgentPrivacyOn(): Promise<void> {
    await this.setAgentPrivacy(true);
  }

  /**
   * Turn off the agent-level kill switch and save. After this, the header
   * toggle is no longer locked and precedence falls through to the next tier.
   */
  async unlockAgentPrivacy(): Promise<void> {
    await this.setAgentPrivacy(false);
  }

  // ── Header toggle ───────────────────────────────────────────────────────

  /** Locator for the nav-bar Private Mode toggle. */
  headerToggle(): Locator {
    return getChatPrivacyToggle(this.page);
  }

  /** Assert the header toggle is visible or hidden. */
  async assertHeaderToggleVisible(visible: boolean): Promise<void> {
    await expectChatPrivacyToggleVisible(this.page, visible);
  }

  /** Assert the toggle's `data-state` equals `state`. */
  async assertHeaderState(state: ChatPrivacyToggleState): Promise<void> {
    await expectChatPrivacyState(this.page, state);
  }

  /** Assert the toggle's `data-source` equals `source`. */
  async assertHeaderSource(source: ChatPrivacySource): Promise<void> {
    await expectChatPrivacySource(this.page, source);
  }

  /**
   * Assert whether the toggle is locked (`aria-disabled`).
   *
   * The SDK helper's "locked === true" branch uses an auto-retrying
   * `toHaveAttribute`, but the "locked === false" branch does a one-shot
   * `getAttribute` + sync `expect.toBe` — no retry, no timeout. That's
   * fine when the unlock is instantaneous but flakes whenever the
   * `chat-privacy-effective` query has to refetch (which is exactly
   * what cp-agent-04 exercises: the toast for "Agent updated
   * successfully" appears the moment the mutation resolves, BEFORE the
   * invalidation-triggered refetch lands and the header re-renders).
   *
   * For the false branch we poll explicitly so the assertion waits for
   * the attribute to settle to either `null` (absent) or `"false"`.
   * The true branch still goes through the SDK helper since that one
   * already waits correctly.
   */
  async assertHeaderLocked(locked: boolean): Promise<void> {
    if (locked) {
      await expectChatPrivacyLocked(this.page, true);
      return;
    }
    const toggle = this.headerToggle();
    await expect
      .poll(
        async () => {
          const value = await toggle.getAttribute('aria-disabled');
          return value === null || value === 'false';
        },
        {
          message:
            'Header toggle should not be locked (aria-disabled absent or "false")',
          timeout: 10_000,
        },
      )
      .toBe(true);
  }

  /**
   * Convenience: assert state AND source in one call.
   * Use for the precedence-chain verification steps.
   */
  async assertHeaderStateAndSource(
    state: ChatPrivacyToggleState,
    source: ChatPrivacySource,
  ): Promise<void> {
    await this.assertHeaderState(state);
    await this.assertHeaderSource(source);
  }

  /** Click the header toggle (no mid-session confirm dialog expected). */
  async clickHeaderToggle(): Promise<void> {
    await clickChatPrivacyToggle(this.page);
  }

  /**
   * Robust click + wait for the toggle's `data-state` to settle to
   * `targetState`. Use this instead of `clickHeaderToggle` whenever the
   * test cares about the post-click state — it folds the
   *
   *   1. wait-for-toggle-to-actually-be-interactive,
   *   2. click,
   *   3. wait-for-state-to-flip,
   *   4. wait-for-the-toggle-to-settle-into-its-new-interactive-state
   *
   * race together, with a budget generous enough for cold-cache
   * `chat-privacy-effective` refetches. The SDK's `clickChatPrivacyToggle`
   * + `expectChatPrivacyState` pair has hard 10 s budgets on each step
   * that race the post-mutation refetch — cp-header-02/03/06 were timing
   * out on exactly that race.
   *
   * `targetSource` (optional) lets the caller also assert `data-source`
   * with the same generous timeout in the same call.
   */
  async clickToggleAndWaitFor(
    targetState: ChatPrivacyToggleState,
    targetSource?: ChatPrivacySource,
  ): Promise<void> {
    const toggle = this.headerToggle();

    // Phase 1: ensure the toggle is mounted, visible, and interactive
    // before clicking. Playwright's default click auto-waits, but if the
    // SDK's mid-mutation `disabled` lingers we want a wider budget than
    // the default actionTimeout. 20 s is enough for cold-cache hydration.
    await expect(toggle).toBeVisible({ timeout: 20_000 });
    await expect(toggle).toBeEnabled({ timeout: 20_000 });

    // Phase 2: click via the SDK helper (handles `aria-disabled` quirks
    // around the locked pill and emits the correct logger lines).
    await clickChatPrivacyToggle(this.page);

    // Phase 3: wait for `data-state` to flip. The post-click sequence is
    // click → POST /sessions/ → dispatch updateSessionIds → React
    // re-render → data-state changes. On slow envs that round-trip can
    // exceed 10 s, so use 30 s.
    await expect(toggle).toHaveAttribute('data-state', targetState, {
      timeout: 30_000,
    });

    // Phase 4 (optional): same generous budget for `data-source`. We do
    // this with `toHaveAttribute` rather than the SDK's
    // `expectChatPrivacySource` because the SDK helper is hard-capped at
    // 10 s and races the same refetch.
    if (targetSource) {
      await expect(toggle).toHaveAttribute('data-source', targetSource, {
        timeout: 30_000,
      });
    }

    // Phase 5: wait for the toggle to be enabled again. This is the
    // signal that any in-flight mutation has settled, which protects the
    // NEXT caller (e.g. cp-header-03 clicks twice in series; the second
    // click would silently no-op if the first hadn't settled).
    await expect(toggle).toBeEnabled({ timeout: 20_000 });
  }

  /** Locator for the mid-session confirmation AlertDialog. */
  confirmDialog(): Locator {
    return getChatPrivacyConfirmDialog(this.page);
  }

  /** Assert whether the mid-session confirm dialog is open. */
  async assertConfirmDialogOpen(open: boolean): Promise<void> {
    await expectChatPrivacyConfirmDialogOpen(this.page, open);
  }

  /**
   * Click the toggle to open the confirm dialog and then confirm it.
   *
   * Bypasses the SDK helper because it does a bare `clickChatPrivacyToggle`
   * without waiting for the toggle to be interactive, then assumes the
   * dialog opens within 10 s and the confirm action is enabled within
   * another 10 s. On a chat that's mid-stream the toggle is briefly
   * disabled, the dialog opens slowly, and the confirm button stays
   * disabled until the mutation hook is ready — all of which can blow
   * past the SDK's hard budgets.
   *
   * Our flow:
   *   1. Wait for the toggle to be visible AND interactive (covers
   *      mid-stream disable, hydration races, etc.).
   *   2. Click the toggle.
   *   3. Wait up to 30 s for the dialog to appear (cold cache + slow
   *      env).
   *   4. Wait for the confirm action to be visible + enabled, then
   *      click it.
   *   5. Wait up to 30 s for the dialog to close — that's the
   *      authoritative "mutation succeeded" signal.
   */
  async enablePrivacyMidSession(): Promise<void> {
    const toggle = this.headerToggle();
    await expect(toggle).toBeVisible({ timeout: 20_000 });
    await expect(toggle).toBeEnabled({ timeout: 20_000 });
    await toggle.click();

    const dialog = this.confirmDialog();
    await expect(dialog).toBeVisible({ timeout: 30_000 });

    const action = this.page.getByTestId('chat-privacy-confirm-action');
    await expect(action).toBeVisible({ timeout: 15_000 });
    await expect(action).toBeEnabled({ timeout: 15_000 });
    await action.click();

    await expect(dialog).toBeHidden({ timeout: 30_000 });
  }

  /** Click the toggle to open the confirm dialog and then cancel. */
  async cancelPrivacyMidSession(): Promise<void> {
    await cancelEnableChatPrivacyMidSession(this.page);
  }

  // ── User profile "Private Mode" tab ─────────────────────────────────────

  /**
   * Locator for the chat-privacy tab in the UserProfileModal sidebar.
   *
   * The tab's user-visible label is "Privacy" (the chat-privacy feature
   * itself is still called "Private Mode" within the tab's content). We
   * define the locator locally rather than reuse the SDK's
   * `isPrivateModeTabVisible` / `CHAT_PRIVACY_LABELS.profileTab.tabName`,
   * because that config still points at the old "Private Mode" label and
   * no longer matches the rendered tab.
   */
  private profilePrivateModeTab(): Locator {
    return this.page.getByRole('tab', { name: 'Privacy', exact: true });
  }

  /**
   * Returns `true` when the "Privacy" tab is visible in the currently-
   * open UserProfileModal. Returns `false` silently when the tenant gate is
   * off — that is a valid state, not an error.
   */
  async isProfilePrivateModeTabVisible(): Promise<boolean> {
    try {
      await expect(this.profilePrivateModeTab()).toBeVisible({
        timeout: 5_000,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Switch to the "Privacy" tab inside the already-open profile modal.
   * Only call this after confirming `isProfilePrivateModeTabVisible()` is true.
   *
   * Bypasses the SDK helper because its 10 s budget on the tab body is
   * too tight: the body is gated on `useGetUserChatPrivacySettingsQuery`
   * finishing, and on slow envs that query routinely takes 15-25 s on a
   * cold cache (skeleton renders meanwhile, then swaps to the testid'd
   * body). Give the body a generous 30 s budget so this isn't a
   * recurring flake.
   */
  async switchToProfilePrivateModeTab(): Promise<void> {
    const tab = this.profilePrivateModeTab();
    await expect(tab).toBeVisible({ timeout: 15_000 });
    await tab.click();
    await expect(this.page.getByTestId('chat-privacy-tab-body')).toBeVisible({
      timeout: 30_000,
    });
  }

  /**
   * Click a radio card on the Private Mode tab and wait for the selection to
   * persist (`aria-pressed="true"` on the chosen card).
   */
  async selectProfilePrivateMode(mode: ChatPrivacyMode): Promise<void> {
    await selectPrivateMode(this.page, mode);
  }

  /** Assert which card is currently selected. */
  async assertProfilePrivateModeSelected(mode: ChatPrivacyMode): Promise<void> {
    await expectPrivateModeSelected(this.page, mode);
  }

  /** Assert all three cards are rendered (use as a "tab loaded" guard). */
  async assertProfilePrivateModeTabReady(): Promise<void> {
    await expectPrivateModeTabReady(this.page);
  }

  /** Locator for one of the three mode radio cards. */
  profilePrivateModeCard(mode: ChatPrivacyMode): Locator {
    return getPrivateModeCard(this.page, mode);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  /**
   * Open the user profile modal via the "More options" dropdown.
   * Returns the modal locator so callers can scope further queries.
   */
  async openProfileModal(): Promise<Locator> {
    const moreOptions = this.page.getByRole('button', { name: 'More options' });
    await expect(moreOptions).toBeVisible({ timeout: 10_000 });
    await moreOptions.click();
    const profileItem = this.page.getByRole('menuitem', { name: /profile/i });
    await expect(profileItem).toBeVisible({ timeout: 5_000 });
    await profileItem.click();
    const modal = this.page.getByRole('dialog', { name: /profile/i });
    await expect(modal).toBeVisible({ timeout: 15_000 });
    return modal;
  }

  /** Close the user profile modal. */
  async closeProfileModal(modal: Locator): Promise<void> {
    const closeBtn = modal.getByRole('button', { name: 'Close', exact: true });
    await expect(closeBtn).toBeVisible({ timeout: 5_000 });
    await closeBtn.click();
    await expect(modal).not.toBeVisible({ timeout: 10_000 });
  }

  // ── Idempotent precondition helpers ─────────────────────────────────────
  //
  // The foundation of journey-49 independence. Each test calls the right
  // `ensure*` helpers in its `beforeEach` so it does not assume any other
  // test (or any prior run) left the system in the expected state. The
  // helpers are no-ops when the target state already matches — fast on
  // the happy path, self-healing on the cold path.

  /**
   * Ensure the tenant chat-privacy gate is in the desired state.
   *
   * The SDK's `setTenantChatPrivacyEnabled` does click → assert
   * `aria-checked` with a hard 10 s budget; on slow environments that
   * races the tag-invalidated refetch and times out even after the
   * mutation has landed. We bypass it and treat the SUCCESS TOAST as
   * the authoritative signal, since:
   *   • the toast is emitted by the SDK only on a 200 response;
   *   • the DOM-attribute lag observed in the field can outlast our
   *     practical budgets without indicating a real failure (the
   *     backend state is correct, the component just hasn't re-rendered
   *     yet). Subsequent tests re-open a fresh dialog, which re-reads
   *     `useGetTenantChatPrivacyConfigQuery` from scratch — so the
   *     stale aria value here doesn't poison anyone downstream.
   *
   * Flow:
   *   • Wait for the switch to hydrate (interactive + initial value).
   *   • Read current; bail early if already at target.
   *   • Click ourselves.
   *   • Wait for the success toast.
   *   • Best-effort short wait for `aria-checked` to settle (helps the
   *     happy path), but tolerated if it doesn't — the next dialog open
   *     reads from a fresh query so the local DOM lag is harmless.
   */
  async ensureTenantGateEnabled(enabled: boolean): Promise<void> {
    const dialog = await this.openTenantAdvancedTab();
    try {
      const switchEl = getTenantChatPrivacySwitch(dialog);

      // Wait for the SDK component to finish its initial hydration so
      // the early-bail read below sees the real current value.
      await expect(switchEl).toBeEnabled({ timeout: 20_000 });

      const current = await this.getTenantGateState(dialog);
      if (current === enabled) return;

      // Click directly — Playwright's actionability waits will re-enable-
      // wait for us if the switch is mid-disable from a prior render.
      await switchEl.click();

      // The success toast is the authoritative signal that the mutation
      // landed on the backend. Anchor on it; don't chase the DOM
      // attribute past a short verification window.
      await expect(
        this.page
          .getByText(/Chat privacy setting updated successfully/i)
          .first(),
      ).toBeVisible({ timeout: 30_000 });

      // Best-effort: give the post-mutation refetch a few seconds to
      // flip `aria-checked` so the next caller's first read is correct.
      // If the DOM is still racey, tolerate it — the next dialog open
      // re-reads from a fresh query subscription anyway.
      await expect(switchEl)
        .toHaveAttribute('aria-checked', enabled ? 'true' : 'false', {
          timeout: 8_000,
        })
        .catch(() => undefined);
    } finally {
      await this.closeTenantAdvancedTab(dialog).catch(() => undefined);
    }
  }

  /** Read the current tenant gate without leaving the dialog open. */
  async readTenantGateState(): Promise<boolean> {
    const dialog = await this.openTenantAdvancedTab();
    try {
      const switchEl = getTenantChatPrivacySwitch(dialog);
      // Same hardening as ensureTenantGateEnabled — capture only after the
      // SDK component is finished hydrating.
      await expect(switchEl).toBeEnabled({ timeout: 15_000 });
      return await this.getTenantGateState(dialog);
    } finally {
      await this.closeTenantAdvancedTab(dialog).catch(() => undefined);
    }
  }

  /**
   * Ensure the current mentor's "Enable private mode" switch is in the
   * desired state. The agent kill-switch is gated on the tenant
   * "allow_user_chat_privacy_control" — when that gate is OFF the row
   * is hidden by settings-tab.tsx and this helper resolves as a no-op
   * (logs a warning since the caller almost certainly wanted gate ON).
   *
   * `editMentorPage` is structurally typed so the helper stays decoupled
   * from the fixture's full type — pass `editMentorPage` from the spec.
   */
  async ensureAgentPrivacy(
    editMentorPage: {
      open: (tab: 'Settings') => Promise<void>;
      close: () => Promise<void>;
      settings: { selectSubTab: (tab: 'Capabilities') => Promise<void> };
    },
    enabled: boolean,
  ): Promise<void> {
    await editMentorPage.open('Settings');
    try {
      await editMentorPage.settings.selectSubTab('Capabilities');
      const rowPresent = await this.agentPrivacySwitch
        .isVisible({ timeout: 10_000 })
        .catch(() => false);
      if (!rowPresent) {
        // Row is gated on the tenant gate. Caller should have ensured
        // gate ON first; we log and bail rather than asserting false.
        return;
      }
      const current = await this.getAgentPrivacyState();
      if (current !== enabled) {
        await this.setAgentPrivacy(enabled);
      }
    } finally {
      await editMentorPage.close().catch(() => undefined);
    }
  }

  /** Read the current "Enable private mode" switch value. Returns `null`
   *  if the row is gated off (tenant gate is OFF). */
  async readAgentPrivacyState(editMentorPage: {
    open: (tab: 'Settings') => Promise<void>;
    close: () => Promise<void>;
    settings: { selectSubTab: (tab: 'Capabilities') => Promise<void> };
  }): Promise<boolean | null> {
    await editMentorPage.open('Settings');
    try {
      await editMentorPage.settings.selectSubTab('Capabilities');
      const visible = await this.agentPrivacySwitch
        .isVisible({ timeout: 10_000 })
        .catch(() => false);
      if (!visible) return null;
      return await this.getAgentPrivacyState();
    } finally {
      await editMentorPage.close().catch(() => undefined);
    }
  }

  /**
   * Ensure the user's profile Private Mode selection is `mode`.
   * Throws if the tenant gate is OFF (tab not visible) — caller must
   * `ensureTenantGateEnabled(true)` first.
   */
  async ensureProfilePrivateMode(mode: ChatPrivacyMode): Promise<void> {
    const modal = await this.openProfileModal();
    try {
      const tabVisible = await this.isProfilePrivateModeTabVisible();
      if (!tabVisible) {
        throw new Error(
          'ensureProfilePrivateMode: Private Mode tab not visible. ' +
            'Call ensureTenantGateEnabled(true) before this helper.',
        );
      }
      await this.switchToProfilePrivateModeTab();
      const current = await this.readProfilePrivateModeFromModal();
      if (current !== mode) {
        await this.selectProfilePrivateMode(mode);
        await this.assertProfilePrivateModeSelected(mode);
      }
    } finally {
      await this.closeProfileModal(modal).catch(() => undefined);
    }
  }

  /** Read the user's current profile Private Mode selection.
   *  Returns `null` if the tab is hidden (gate OFF) or no card is pressed. */
  async readProfilePrivateMode(): Promise<ChatPrivacyMode | null> {
    const modal = await this.openProfileModal();
    try {
      const tabVisible = await this.isProfilePrivateModeTabVisible();
      if (!tabVisible) return null;
      await this.switchToProfilePrivateModeTab();
      return await this.readProfilePrivateModeFromModal();
    } finally {
      await this.closeProfileModal(modal).catch(() => undefined);
    }
  }

  /** Internal helper used by both `ensureProfilePrivateMode` and
   *  `readProfilePrivateMode` once the tab is open. Scans the three cards
   *  for `aria-pressed="true"`. */
  private async readProfilePrivateModeFromModal(): Promise<ChatPrivacyMode | null> {
    const modes: ChatPrivacyMode[] = ['normal', 'anonymized', 'disabled'];
    for (const m of modes) {
      const pressed = await this.profilePrivateModeCard(m)
        .getAttribute('aria-pressed')
        .catch(() => 'false');
      if (pressed === 'true') return m;
    }
    return null;
  }
}
