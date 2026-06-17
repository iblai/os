import { Page, Locator, expect } from '@playwright/test';
import { reliableClick } from '../../utils/resilient';

/**
 * Page object for the Privacy tab inside the Edit Mentor modal.
 *
 * The tab is rendered by the SDK's `AgentPrivacyTab` component
 * (`@iblai/iblai-js/web-containers/next`). All selectors target the labels
 * documented in `AGENT_PRIVACY_TAB_LABELS` and the aria-labels emitted by
 * the SDK. If labels are overridden via the `labels` prop, update the
 * locators in this file to match.
 */
export class PrivacyTab {
  readonly page: Page;
  readonly dialog: Locator;

  /** "Privacy" heading rendered at the top of the tab panel. */
  readonly heading: Locator;
  /** Description line below the heading. */
  readonly description: Locator;
  /** Master toggle — `enable_privacy_router`. */
  readonly routerSwitch: Locator;
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

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;

    this.heading = dialog.getByRole('heading', { name: 'Privacy' });
    this.description = dialog.getByText(
      /Detect and filter personally identifiable information from chat messages\./i,
    );
    this.routerSwitch = dialog.getByRole('switch', {
      name: /Privacy router (enabled|disabled)/i,
    });
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

  /** Returns true when the master router toggle is on. */
  async isRouterEnabled(): Promise<boolean> {
    const state = await this.routerSwitch
      .getAttribute('aria-checked')
      .catch(() => null);
    return state === 'true';
  }

  /**
   * Flips the master router toggle. When `enable` is provided, only flips it
   * when the current state differs (idempotent). Waits for the visible state
   * to change before resolving so dependent locators are stable.
   */
  async setRouterEnabled(enable: boolean): Promise<void> {
    const currently = await this.isRouterEnabled();
    if (currently === enable) return;
    await reliableClick(this.page, this.routerSwitch);
    await expect(this.routerSwitch).toHaveAttribute(
      'aria-checked',
      enable ? 'true' : 'false',
      { timeout: 10_000 },
    );
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
