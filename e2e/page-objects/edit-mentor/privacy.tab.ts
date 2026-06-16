import { Page, Locator, expect } from '@playwright/test';
import { reliableClick } from '../../utils/resilient';
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
 * therefore DELEGATE to the SettingsTab page-object below — they navigate
 * to Settings, flip the switch, save, and navigate back. Callers in
 * journey 45 don't need to change.
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
   * Returns true when `enable_privacy_router` is on, inferred from the
   * SDK's body-rendering invariant: when `enable_privacy_router` is true
   * the action select is mounted; otherwise the body is empty. Falls back
   * to reading the moved Settings → Capabilities switch when navigation
   * has been bound, since the body is only mounted while we are actually
   * on the Privacy tab.
   */
  async isRouterEnabled(): Promise<boolean> {
    if (this.settingsTab && this.navigateToTab) {
      // Authoritative read — go to Capabilities where the switch lives.
      await this.navigateToTab('Settings');
      const value = await this.settingsTab.isEnablePrivacyRouterEnabled();
      await this.navigateToTab('Privacy');
      return value;
    }
    // Fallback: best-effort visual probe on the Privacy tab body.
    const visible = await this.actionSelect
      .isVisible({ timeout: 1_500 })
      .catch(() => false);
    return visible;
  }

  /**
   * Idempotently set the master `enable_privacy_router` toggle.
   *
   * Delegates to the Settings → Capabilities "Filter PII from messages"
   * switch (the SDK removed the in-tab master switch). After the save
   * toast, navigates back to the Privacy tab so subsequent assertions
   * read the new render shape.
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
    await this.navigateToTab('Privacy');

    // Sanity-check the new render shape. When `enable` is true the SDK
    // mounts the action select; when false the body is empty.
    if (enable) {
      await expect(this.actionSelect).toBeVisible({ timeout: 10_000 });
    } else {
      await expect(this.actionSelect).not.toBeVisible({ timeout: 5_000 });
    }
  }

  /**
   * Opens the Action select and chooses the option matching the visible
   * label. The SDK names the options "Redact", "Mask", and "Block".
   */
  async selectAction(option: 'Redact' | 'Mask' | 'Block'): Promise<void> {
    await reliableClick(this.page, this.actionSelect);
    const item = this.page.getByRole('option', { name: option, exact: true });
    await expect(item).toBeVisible({ timeout: 5_000 });
    await item.click();
    // Radix Select renders options inside a portal. When the portal panel
    // is layered above neighbouring fields (e.g. the Block Message
    // textarea), an `pointerup` on the option can occasionally land on
    // the underlying field instead and silently no-op the selection.
    // Block until the trigger's visible text reflects the new option so
    // the next assertion can trust the action state has actually
    // changed. Re-click once if it didn't — that recovers the race
    // without making every call pay the cost.
    try {
      await expect(this.actionSelect).toContainText(option, { timeout: 2_000 });
    } catch {
      await item.click({ trial: false }).catch(() => {});
      await expect(this.actionSelect).toContainText(option, { timeout: 5_000 });
    }
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
