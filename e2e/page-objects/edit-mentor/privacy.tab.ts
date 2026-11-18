import { Page, Locator, expect } from '@playwright/test';

export type PrivacyKind = 'pii' | 'phi';
export type PrivacyActionLabel = 'Allow' | 'Redact' | 'Mask' | 'Block';

/**
 * Page object for the Privacy tab inside the Edit Agent modal.
 *
 * Rendered by the SDK's `AgentPrivacyTab`. Filtering is two accordion cards
 * (PII Filtering / PHI Filtering), each with its own on/off switch, one card
 * open at a time. Switches are NOT optimistic: `aria-checked` and the switch's
 * enabled state only settle after the PUT to `/mentors/<id>/settings/` plus
 * the refetch land, so every setter waits for both before returning.
 */
export class PrivacyTab {
  readonly page: Page;
  readonly dialog: Locator;

  readonly heading: Locator;
  readonly description: Locator;
  readonly body: Locator;
  readonly filteringSection: Locator;
  readonly subTabFilteringStrip: Locator;
  readonly outputFilterSwitch: Locator;
  readonly privacyLogRow: Locator;
  readonly viewPrivacyLogButton: Locator;
  /** The audit-log modal is portalled outside the Edit Agent dialog. */
  readonly auditLogModal: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;

    this.heading = dialog.getByRole('heading', {
      name: 'Privacy',
      exact: true,
    });
    this.description = dialog.getByText(
      /Control what personal information the agent sees and how Incognito works for its conversations\./i,
    );
    this.body = dialog.getByTestId('privacy-tab-body');
    this.filteringSection = dialog.getByTestId('privacy-filtering-section');
    this.subTabFilteringStrip = dialog.getByTestId('privacy-sub-tab-filtering');
    this.outputFilterSwitch = dialog.getByTestId(
      'privacy-output-filter-toggle',
    );
    this.privacyLogRow = dialog.getByTestId('privacy-log-row');
    this.viewPrivacyLogButton = dialog.getByTestId('view-privacy-log-button');
    this.auditLogModal = page.getByTestId('privacy-audit-log-modal');
  }

  card(kind: PrivacyKind): Locator {
    return this.dialog.getByTestId(`privacy-${kind}-card`);
  }
  toggle(kind: PrivacyKind): Locator {
    return this.dialog.getByTestId(`privacy-filter-${kind}-toggle`);
  }
  expand(kind: PrivacyKind): Locator {
    return this.dialog.getByTestId(`privacy-${kind}-expand`);
  }
  summary(kind: PrivacyKind): Locator {
    return this.dialog.getByTestId(`privacy-${kind}-summary`);
  }
  cardBody(kind: PrivacyKind): Locator {
    return this.dialog.getByTestId(`privacy-${kind}-card-body`);
  }
  offHint(kind: PrivacyKind): Locator {
    return this.dialog.getByTestId(`privacy-${kind}-off-hint`);
  }
  actionSelect(kind: PrivacyKind): Locator {
    return this.dialog.getByTestId(`privacy-${kind}-action-select`);
  }
  blockMessage(kind: PrivacyKind): Locator {
    return this.dialog.getByTestId(`privacy-${kind}-block-message`);
  }
  entities(kind: PrivacyKind): Locator {
    return this.dialog.getByTestId(`privacy-${kind}-entities`);
  }
  entitiesHint(kind: PrivacyKind): Locator {
    return this.dialog.getByTestId(`privacy-${kind}-entities-hint`);
  }
  entityChip(kind: PrivacyKind, entity: string): Locator {
    return this.entities(kind).locator(`[data-entity="${entity}"]`);
  }
  entityChips(kind: PrivacyKind): Locator {
    return this.entities(kind).locator('[data-entity]');
  }

  /** Wait until the tab has loaded settings and is interactive. */
  async waitUntilReady(): Promise<void> {
    await expect(this.filteringSection).toBeVisible({ timeout: 30_000 });
    await expect(this.toggle('pii')).toBeEnabled({ timeout: 30_000 });
    await expect(this.toggle('phi')).toBeEnabled({ timeout: 30_000 });
  }

  /**
   * Idempotently set a switch. The click is not idempotent, so first wait out
   * any in-flight save (switch disabled) before reading the state, click once,
   * then wait for the server-bound state to repaint and the switch to settle.
   */
  private async setSwitch(sw: Locator, on: boolean): Promise<void> {
    const want = String(on);
    await expect(sw).toBeEnabled({ timeout: 30_000 });
    if ((await sw.getAttribute('aria-checked')) === want) return;
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', want, { timeout: 30_000 });
    await expect(sw).toBeEnabled({ timeout: 30_000 });
  }

  async setFilterEnabled(kind: PrivacyKind, on: boolean): Promise<void> {
    await this.setSwitch(this.toggle(kind), on);
  }

  async setOutputFilterEnabled(on: boolean): Promise<void> {
    await this.setSwitch(this.outputFilterSwitch, on);
  }

  async selectAction(
    kind: PrivacyKind,
    option: PrivacyActionLabel,
  ): Promise<void> {
    const sel = this.actionSelect(kind);
    await expect(sel).toBeEnabled({ timeout: 30_000 });
    await sel.click();
    await this.page.getByRole('option', { name: option, exact: true }).click();
    await expect(sel).toContainText(option, { timeout: 30_000 });
    await expect(sel).toBeEnabled({ timeout: 30_000 });
  }

  async setEntitySelected(
    kind: PrivacyKind,
    entity: string,
    selected: boolean,
  ): Promise<void> {
    const chip = this.entityChip(kind, entity);
    const want = String(selected);
    await expect(chip).toBeEnabled({ timeout: 30_000 });
    if ((await chip.getAttribute('aria-checked')) === want) return;
    await chip.click();
    await expect(chip).toHaveAttribute('aria-checked', want, {
      timeout: 30_000,
    });
    await expect(chip).toBeEnabled({ timeout: 30_000 });
  }

  /** Visible option labels of an open action select, in order. */
  async openActionOptions(kind: PrivacyKind): Promise<string[]> {
    await expect(this.actionSelect(kind)).toBeEnabled({ timeout: 30_000 });
    await this.actionSelect(kind).click();
    const options = this.page.getByRole('option');
    await expect(options.first()).toBeVisible({ timeout: 6_000 });
    return (await options.allTextContents()).map((t) => t.trim());
  }

  /** Close an open action select by re-picking the current value (never Escape: it can close the whole dialog). */
  async closeActionSelect(
    kind: PrivacyKind,
    current: PrivacyActionLabel,
  ): Promise<void> {
    await this.page.getByRole('option', { name: current, exact: true }).click();
    await expect(this.page.getByRole('option')).toHaveCount(0, {
      timeout: 5_000,
    });
    await expect(this.actionSelect(kind)).toBeEnabled({ timeout: 30_000 });
  }
}
