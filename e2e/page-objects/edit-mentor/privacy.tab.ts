import { Page, Locator, expect } from '@playwright/test';
import type { SettingsTab } from './settings.tab';

/**
 * Page object for the Privacy tab inside the Edit Mentor modal.
 *
 * The tab is rendered by the SDK's `AgentPrivacyTab` component
 * (`@iblai/iblai-js/web-containers/next`). All selectors target the labels
 * documented in `AGENT_PRIVACY_TAB_LABELS` and the aria-labels emitted by
 * the SDK. If labels are overridden via the `labels` prop, update the
 * locators in this file to match.
 *
 * The MASTER `enable_privacy_router` switch was removed from the SDK
 * Privacy tab body and now lives only in Settings → Capabilities as the
 * "Filter PII from messages" row. `setRouterEnabled` / `isRouterEnabled`
 * therefore DELEGATE to the SettingsTab page-object below. Additionally,
 * the SDK now filters the Privacy sidebar segment entirely when the router is
 * off — the tab trigger is absent from the sidebar (not an empty body), so
 * `setRouterEnabled(false)` does NOT navigate back to Privacy afterward.
 * `setRouterEnabled(true)` navigates to Privacy and asserts the body rendered.
 */
export class PrivacyTab {
  readonly page: Page;
  readonly dialog: Locator;
  /**
   * Sibling SettingsTab page-object used to drive the moved master switch.
   * Injected after construction via `bindSettingsTab` so the EditMentorPage
   * can resolve the cross-tab dependency once, without circular imports at
   * page-object construction time.
   */
  private settingsTab: SettingsTab | null = null;
  /**
   * `navigateToTab(name)` from the parent EditMentorPage. Provided after
   * construction so this tab can return focus to "Privacy" after flipping
   * the moved switch in Settings → Capabilities.
   */
  private navigateToTab: ((name: string) => Promise<void>) | null = null;

  /** "Privacy" heading rendered at the top of the tab panel. */
  readonly heading: Locator;
  /** Description line below the heading. */
  readonly description: Locator;
  /** Dropdown trigger for `privacy_action`. */
  readonly actionSelect: Locator;
  /** Textarea for `privacy_response` (only visible when action === "block"). */
  readonly blockMessageTextarea: Locator;
  /** Container holding the entity-type chips. */
  readonly entityChips: Locator;
  /** "Using defaults." hint shown when `privacy_entities` is empty. */
  readonly emptyEntitiesHint: Locator;
  /** Toggle for `enable_privacy_output_filter`. */
  readonly outputFilterSwitch: Locator;
  /** Body container that only renders when `enable_privacy_router` is on.
   *  Use this to assert the "router on" / "router off" rendering shape
   *  without depending on the removed master switch. */
  readonly body: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;

    this.heading = dialog.getByRole('heading', { name: 'Privacy' });
    this.description = dialog.getByText(
      /Detect and filter personally identifiable information from chat messages\./i,
    );
    this.body = dialog.getByTestId('privacy-tab-body');
    this.actionSelect = dialog.getByRole('combobox', {
      name: /When PII is detected/i,
    });
    this.blockMessageTextarea = dialog.getByRole('textbox', {
      name: /Block Message/i,
    });
    this.entityChips = dialog.locator('button[role="checkbox"][data-entity]');
    this.emptyEntitiesHint = dialog.getByText(/Using defaults\./i);
    this.outputFilterSwitch = dialog.getByRole('switch', {
      name: /Output filter (enabled|disabled)/i,
    });
  }

  /**
   * Wire up the cross-tab delegation. EditMentorPage calls this once after
   * both PrivacyTab and SettingsTab have been constructed so the Privacy
   * helpers below can drive the moved master switch.
   */
  bindSettingsTab(
    settingsTab: SettingsTab,
    navigateToTab: (name: string) => Promise<void>,
  ): void {
    this.settingsTab = settingsTab;
    this.navigateToTab = navigateToTab;
  }

  /**
   * Returns true when `enable_privacy_router` is on. Reads the authoritative
   * value from Settings → Capabilities where the switch now lives.
   *
   * NOTE: After this call the focus is on the Settings tab (not Privacy).
   * The caller is responsible for navigating to the right tab afterward if
   * needed. We deliberately do NOT navigate back to Privacy here because when
   * the value is false the Privacy sidebar segment is unmounted entirely, so
   * a `navigateToTab('Privacy')` would time out.
   */
  async isRouterEnabled(): Promise<boolean> {
    if (this.settingsTab && this.navigateToTab) {
      // Authoritative read — go to Capabilities where the switch lives.
      await this.navigateToTab('Settings');
      const value = await this.settingsTab.isEnablePrivacyRouterEnabled();
      // Only navigate back to Privacy when the tab will actually be present.
      if (value) {
        await this.navigateToTab('Privacy');
      }
      return value;
    }
    // Fallback: best-effort visual probe on the Privacy tab body.
    let isVisible = false;
    try {
      await this.actionSelect.waitFor({ state: 'visible', timeout: 1_500 });
      isVisible = true;
    } catch {
      isVisible = false;
    }
    return isVisible;
  }

  /**
   * Idempotently set the master `enable_privacy_router` toggle.
   *
   * Delegates to the Settings → Capabilities "Filter PII from messages"
   * switch (the SDK removed the in-tab master switch).
   *
   * When `enable` is true: saves, navigates to the Privacy tab, and
   * asserts the action select is visible (tab is now present and populated).
   *
   * When `enable` is false: saves, then asserts the Privacy sidebar segment
   * is ABSENT from the dialog (the SDK filters it out entirely when the
   * router is off — there is no empty-body state anymore). Does NOT attempt
   * to navigate back to Privacy because the tab no longer exists in the DOM.
   */
  async setRouterEnabled(enable: boolean): Promise<void> {
    if (!this.settingsTab || !this.navigateToTab) {
      throw new Error(
        'PrivacyTab.setRouterEnabled requires bindSettingsTab() to be called ' +
          'first — invoked from EditMentorPage so the helper can drive the ' +
          'moved master switch in Settings → Capabilities.',
      );
    }
    await this.navigateToTab('Settings');
    await this.settingsTab.setEnablePrivacyRouterAndSave(enable);

    if (enable) {
      // The Privacy sidebar segment is gated on `enable_privacy_router`, which
      // `useMentorSegments` only re-derives after the post-save mentor-settings
      // refetch lands. `setEnablePrivacyRouterAndSave` resolves on the "Agent
      // updated successfully" toast — which fires on MUTATION success, BEFORE
      // that refetch necessarily completes — so the gated tab can take several
      // seconds to mount. Wait for the tab trigger to appear with a generous
      // timeout BEFORE navigating: navigateToTab's own 15s waitFor occasionally
      // lost this race on slow staging, surfacing as a flaky timeout at
      // edit-mentor.page.ts navigateToTab('Privacy').
      const privacyTabTrigger = this.dialog
        .getByRole('tab', { name: 'Privacy', exact: true })
        .and(this.dialog.locator('[aria-controls^="panel-"]:visible'));
      await expect(privacyTabTrigger).toBeVisible({ timeout: 30_000 });
      // Privacy tab is now present — navigate to it and confirm the body rendered.
      await this.navigateToTab('Privacy');
      await expect(this.actionSelect).toBeVisible({ timeout: 10_000 });
    } else {
      // Privacy sidebar segment is entirely removed when the router is off.
      // Assert the tab trigger is gone from the sidebar — do NOT navigate to
      // Privacy (the tab no longer exists and navigateToTab would time out).
      // Same post-save refetch race as the enable branch above: the segment
      // only unmounts once `useMentorSegments` re-derives `isPrivacyEnabled`
      // after the refetch lands (which the toast does not guarantee), so use a
      // generous timeout here too rather than the tighter 10s that could flake.
      const privacyTabTrigger = this.dialog
        .getByRole('tab', { name: 'Privacy', exact: true })
        .and(this.dialog.locator('[aria-controls^="panel-"]:visible'));
      await expect(privacyTabTrigger).toHaveCount(0, { timeout: 20_000 });
    }
  }

  /**
   * Opens the Action select and chooses the option matching the visible
   * label. The SDK names the options "Redact", "Mask", and "Block".
   *
   * The SDK action <Select> is *controlled and server-bound*: its value is
   * `mentorSettings.privacy_action` and picking an option AUTO-SAVES via
   * `onValueChange` -> editMentorJson PUT -> refetchMentorSettings (the Select
   * even disables itself while that save is in flight). There is no optimistic
   * local update, so the trigger only flips to the new label AFTER the server
   * round-trip lands. The correct shape is therefore: open -> pick the option
   * ONCE -> then PATIENTLY wait for the round-trip to re-render the trigger.
   * Re-poking the Select mid-save just thrashes (it's disabled and won't
   * reopen) and an earlier poll-and-re-click version hung at the old value as a
   * result. We retry the whole open+pick only if the value hasn't committed
   * within a generous window, resetting to a known-closed state in between.
   */
  async selectAction(option: 'Redact' | 'Mask' | 'Block'): Promise<void> {
    const maxAttempts = 3;
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Short-circuit: already on target — either the initial state, or a prior
      // attempt's auto-save round-trip has since landed.
      const current =
        (await this.actionSelect.textContent().catch(() => '')) ?? '';
      if (current.includes(option)) return;

      try {
        await expect(this.actionSelect).toBeVisible({ timeout: 10_000 });
        await this.actionSelect.click();

        // Options render in a page-level portal (outside the dialog). Use
        // toBeVisible (which POLLS) rather than isVisible (which returns the
        // current state immediately) so we actually wait for the listbox to
        // finish opening before clicking.
        const item = this.page.getByRole('option', {
          name: option,
          exact: true,
        });
        await expect(item).toBeVisible({ timeout: 6_000 });
        // Hover first: Radix Select commits the *highlighted* option, and a
        // bare programmatic click can occasionally land without highlighting it
        // — the original cause of the flake.
        await item.hover();
        await item.click();

        // Patiently wait for the auto-save round-trip to land and re-render the
        // server-bound trigger. toContainText auto-retries and re-resolves the
        // locator, so a transient panel re-render mid-wait is tolerated.
        await expect(this.actionSelect).toContainText(option, {
          timeout: 12_000,
        });
        return;
      } catch (error) {
        lastError = error;
        // Reset to a known-closed state before the next attempt so the next
        // open starts cleanly (e.g. if the option click missed and left the
        // listbox open).
        await this.page.keyboard.press('Escape').catch(() => {});
      }
    }
    throw lastError;
  }

  /** Reads the currently selected action label. */
  async getSelectedAction(): Promise<string> {
    return (
      (await this.actionSelect.textContent().catch(() => ''))?.trim() ?? ''
    );
  }

  /**
   * Asserts that the Block Message field is currently un-editable — i.e.
   * the user cannot type a custom block message. Tolerates either SDK
   * shape: (a) the textarea isn't mounted at all (current behaviour:
   * `action === 'block' && <Textarea>`), or (b) it's mounted with
   * `disabled` set. Both satisfy the user-visible contract this
   * checkpoint exists to protect.
   */
  async expectBlockMessageUneditable(timeout = 5_000): Promise<void> {
    const stillRendered = await this.blockMessageTextarea
      .first()
      .isVisible({ timeout })
      .catch(() => false);
    if (!stillRendered) {
      // Conditionally-rendered shape — textarea unmounted on non-block actions.
      return;
    }
    // Render-and-disable shape — assert the field is locked.
    await expect(this.blockMessageTextarea).toBeDisabled({ timeout });
  }

  /** Returns the chip locator for the given entity (e.g. "EMAIL_ADDRESS"). */
  entityChip(entity: string): Locator {
    return this.dialog.locator(
      `button[role="checkbox"][data-entity="${entity}"]`,
    );
  }

  /** Returns true when the given entity is in the active (selected) state. */
  async isEntitySelected(entity: string): Promise<boolean> {
    const state = await this.entityChip(entity)
      .getAttribute('aria-checked')
      .catch(() => null);
    return state === 'true';
  }

  /** Returns the number of entity chips rendered (should match PRIVACY_ENTITY_TYPES). */
  async getEntityChipCount(): Promise<number> {
    return this.entityChips.count().catch(() => 0);
  }
}
