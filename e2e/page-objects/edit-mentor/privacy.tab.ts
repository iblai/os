import { Page, Locator, expect } from '@playwright/test';
import { isVisibleWithin } from '../../utils/resilient';

/**
 * Page object for the Privacy tab inside the Edit Mentor modal.
 *
 * The tab is rendered by the SDK's `AgentPrivacyTab` component
 * (`@iblai/iblai-js/web-containers/next`). All selectors target the labels
 * documented in `AGENT_PRIVACY_TAB_LABELS` and the aria-labels emitted by
 * the SDK. If labels are overridden via the `labels` prop, update the
 * locators in this file to match.
 *
 * The `enable_privacy_router` MASTER switch used to live in Settings →
 * Capabilities ("Filter PII from messages"); it now lives inline at the top
 * of this tab via the shared `CapabilityGate` component
 * (`data-testid="privacy-capability-toggle"`). The Privacy tab itself is now
 * ALWAYS mounted — `hooks/use-mentor-segments.ts` no longer gates the
 * sidebar segment on `isPrivacyEnabled` — so `setRouterEnabled` never needs
 * to navigate away/back or assert on the tab trigger appearing/disappearing.
 * The gated fields (action select, entity chips, output filter) stay in the
 * DOM and readable when the router is off; they render inside a grayed +
 * inert `data-testid="capability-gate-content"` wrapper
 * (`data-enabled="false"`). Interacting with them while off is not a
 * supported user flow — callers must turn the capability on first.
 *
 * Unlike the app-owned tabs (Sandbox / Memory / Voice / Screen / LTI),
 * `AgentPrivacyTab` does NOT mirror the toggle in local optimistic state —
 * `enabled` is read directly from the `mentorSettings` query result, so the
 * toggle only visually flips once the `editMentorJson` PUT + refetch round
 * trip lands. Every setter below accounts for that extra latency.
 */
export class PrivacyTab {
  readonly page: Page;
  readonly dialog: Locator;

  /** "Privacy" heading rendered at the top of the tab panel. */
  readonly heading: Locator;
  /** Description line below the heading. */
  readonly description: Locator;
  /**
   * "PII filtering" (`enable_privacy_router`) master toggle. Auto-saves on
   * click via `editMentorJson` — no footer Save button involved. Not
   * optimistic (see class doc) — waiting on it also waits out the refetch.
   */
  readonly capabilityToggle: Locator;
  /** Wrapper around the gated fields below — `data-enabled` mirrors the toggle. */
  readonly capabilityContent: Locator;
  /** Hint shown next to the description while the capability is off. */
  readonly capabilityOffHint: Locator;
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
  /** Body container — present regardless of router state (tab is always mounted). */
  readonly body: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;

    this.heading = dialog.getByRole('heading', { name: 'Privacy' });
    this.description = dialog.getByText(
      /Detect and filter personally identifiable information from chat messages\./i,
    );
    this.body = dialog.getByTestId('privacy-tab-body');
    this.capabilityToggle = dialog.getByTestId('privacy-capability-toggle');
    // `:visible` scopes to the currently-active tab's gate — top-level tab
    // panels can stay force-mounted (CSS-hidden) while inactive, and every
    // gated tab renders its own `capability-gate-content` wrapper.
    this.capabilityContent = dialog.locator(
      '[data-testid="capability-gate-content"]:visible',
    );
    this.capabilityOffHint = dialog.locator(
      '[data-testid="capability-gate-off-hint"]:visible',
    );
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

  // ── Capability gate ───────────────────────────────────────────────────────

  /** Whether the "PII filtering" (`enable_privacy_router`) toggle is currently on. */
  async isRouterEnabled(): Promise<boolean> {
    const attr = await this.capabilityToggle
      .getAttribute('aria-checked')
      .catch(() => null);
    return attr === 'true';
  }

  /**
   * Deterministically close the "When PII is detected" action Select's
   * options listbox if it's currently open. A Radix `<Select>` applies
   * `pointer-events: none` to everything outside its popover while open, so
   * any click elsewhere in the dialog (e.g. the capability toggle) doesn't
   * fail fast — it just retries silently against an unresponsive target for
   * the caller's full timeout, which looks like an unrelated element is
   * broken.
   *
   * Deliberately NEVER presses Escape: two live traces showed it's unsafe
   * here — first intermittently leaving the listbox open (Escape no-op'd),
   * then (once Escape became the only close path exercised) reliably
   * bubbling PAST the Select and closing the parent Edit Agent Dialog too
   * (8/8 repeat runs closed the whole modal). Either failure mode is worse
   * than doing nothing. Instead this clicks the Select trigger again — a
   * Radix `<Select>` trigger toggles its own popover on click and cannot
   * affect an ancestor Dialog — and falls back to clicking a neutral,
   * non-interactive area inside the dialog (the tab heading) if that
   * somehow didn't register. A final assertion confirms the *dialog* is
   * still open before returning, so a caller who then can't find the
   * capability toggle gets a clear "the dialog closed unexpectedly" failure
   * here rather than a confusing "toggle not found" one two calls away.
   */
  async closeActionSelect(): Promise<void> {
    const options = this.page.getByRole('option');

    const isListboxOpen = async (timeout = 500): Promise<boolean> => {
      try {
        await options.first().waitFor({ state: 'visible', timeout });
        return true;
      } catch {
        return false;
      }
    };

    if (await isListboxOpen()) {
      // Attempt 1: click the trigger again to toggle the popover shut.
      await this.actionSelect.click({ timeout: 3_000 }).catch(() => {});
      try {
        await expect(options).toHaveCount(0, { timeout: 3_000 });
      } catch {
        // Attempt 2: click a neutral area of the dialog (the tab heading)
        // to shift focus and dismiss the popover.
        await this.heading.click({ timeout: 3_000 }).catch(() => {});
        await expect(options).toHaveCount(0, { timeout: 5_000 });
      }
    }

    // Guard: whichever path closed the listbox must not have taken the
    // whole Edit Agent dialog down with it.
    await expect(this.dialog).toBeVisible({ timeout: 5_000 });
  }

  /**
   * Idempotently set the "PII filtering" master toggle to the target state.
   *
   * Unlike the optimistic app-owned tabs, `AgentPrivacyTab` derives `enabled`
   * straight from the mentor-settings query, so the switch only flips after
   * the `editMentorJson` PUT + refetch round trip lands — the timeout below
   * is generous to absorb that (mirrors `setEntitySelected`'s existing
   * server-bound wait).
   */
  async setRouterEnabled(enable: boolean): Promise<void> {
    await expect(this.capabilityToggle).toBeVisible({ timeout: 10_000 });
    const isOn = await this.isRouterEnabled();
    if (isOn === enable) return;

    // Defensively dismiss any open action-Select listbox first — an open
    // Radix Select blocks pointer events on everything outside it (including
    // this toggle), so a caller that left it open (see `closeActionSelect`
    // doc) would otherwise hang the click below for the full timeout with a
    // misleading "toggle unresponsive" signature. Hardens every caller, not
    // just the one that surfaced this.
    await this.closeActionSelect();

    await this.capabilityToggle.click();
    await expect(this.capabilityToggle).toHaveAttribute(
      'aria-checked',
      String(enable),
      { timeout: 20_000 },
    );
    await expect(this.capabilityContent).toHaveAttribute(
      'data-enabled',
      String(enable),
      { timeout: 20_000 },
    );
  }

  /** Assert whether the CapabilityGate off-state hint is currently shown. */
  async expectOffHintVisible(visible: boolean): Promise<void> {
    if (visible) {
      await expect(this.capabilityOffHint).toBeVisible({ timeout: 10_000 });
    } else {
      await expect(this.capabilityOffHint).toHaveCount(0, { timeout: 10_000 });
    }
  }

  // ── Gated fields ─────────────────────────────────────────────────────────

  /**
   * Opens the Action select and chooses the option matching the visible
   * label. The SDK names the options "Allow", "Redact", "Mask", and "Block"
   * (in that order — `PRIVACY_ACTIONS = ['allow', 'redact', 'mask',
   * 'block']` from `@iblai/data-layer`; "Allow" is now the FIRST option).
   *
   * The SDK action <Select> is *controlled and server-bound*: its value is
   * `mentorSettings.privacy_action` and picking an option AUTO-SAVES
   * (editMentorJson PUT -> refetchMentorSettings), with no optimistic local
   * update — so the trigger only flips to the new label AFTER the round-trip
   * lands. Requires the router to already be ON (call `setRouterEnabled(true)`
   * first) — the select is inert while the capability is off.
   */
  async selectAction(
    option: 'Allow' | 'Redact' | 'Mask' | 'Block',
  ): Promise<void> {
    const maxAttempts = 3;
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Settle any in-flight save BEFORE reading the label: the trigger is
        // server-bound and disables itself while saving, so reading a stale OLD
        // label here would skip the short-circuit and double-apply the action.
        await expect(this.actionSelect).toBeEnabled({ timeout: 10_000 });

        // Short-circuit: already on target (initial state, or a prior attempt's
        // auto-save round-trip has since landed).
        const current =
          (await this.actionSelect.textContent().catch(() => '')) ?? '';
        if (current.includes(option)) return;

        await this.actionSelect.click();

        // Options render in a page-level portal (outside the dialog). Use
        // toBeVisible (which POLLS) rather than isVisible (which returns the
        // current state immediately) so we wait for the listbox to finish
        // opening before clicking.
        const item = this.page.getByRole('option', {
          name: option,
          exact: true,
        });
        await expect(item).toBeVisible({ timeout: 6_000 });
        // Hover first: Radix Select commits the *highlighted* option, and a
        // bare programmatic click can occasionally land without highlighting it.
        await item.hover();
        await item.click();

        // The pick fires editMentorJson + refetch — confirm the server-bound
        // trigger reflects the new value (proves the round-trip committed).
        await expect(this.actionSelect).toContainText(option, {
          timeout: 10_000,
        });
        return;
      } catch (error) {
        lastError = error;
        // Close the listbox before retrying — but press Escape ONLY when an
        // option is actually visible. A closed Radix Select doesn't consume
        // Escape, so it would bubble to the Edit Agent Dialog and close it,
        // dirtying teardown and cascading the remaining attempts.
        const listboxOpen = await this.page
          .getByRole('option', { name: option, exact: true })
          .first()
          .isVisible()
          .catch(() => false);
        if (listboxOpen) {
          await this.page.keyboard.press('Escape').catch(() => {});
        }
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
    const stillRendered = await isVisibleWithin(
      this.blockMessageTextarea.first(),
      timeout,
    );
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

  /**
   * Idempotently set an entity chip to selected/unselected. Requires the
   * router to already be ON — the chip is inert while the capability is off.
   *
   * The chip's `aria-checked` is server-bound (`privacy_entities.includes(...)`)
   * and clicking it auto-saves (editMentorJson + refetch), which disables the
   * chip mid-save. So we poll: return if already at the target, otherwise
   * wait for the chip to be enabled (not mid-save), click once, and confirm
   * the server-bound state flipped. Retried so a missed click simply tries
   * again.
   */
  async setEntitySelected(entity: string, target: boolean): Promise<void> {
    const want = target ? 'true' : 'false';
    const maxAttempts = 3;
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const chip = this.entityChip(entity);
        await expect(chip).toBeVisible({ timeout: 10_000 });
        // Settle any in-flight save FIRST — the chip is disabled while saving
        // and its `aria-checked` isn't repainted until the refetch lands.
        // Reading it before this gate could see a stale value and fire a
        // second, state-reverting click (a chip toggle is NOT idempotent).
        await expect(chip).toBeEnabled({ timeout: 10_000 });
        if (
          (await chip.getAttribute('aria-checked').catch(() => null)) === want
        ) {
          return;
        }
        await chip.click();
        await expect(this.entityChip(entity)).toHaveAttribute(
          'aria-checked',
          want,
          { timeout: 10_000 },
        );
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  /** Returns the number of entity chips rendered (should match PRIVACY_ENTITY_TYPES). */
  async getEntityChipCount(): Promise<number> {
    return this.entityChips.count().catch(() => 0);
  }
}
