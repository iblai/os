import { Page, Locator, expect } from '@playwright/test';

/**
 * Page object for the "Billing" (spend caps) top-level tab inside the Edit Mentor
 * (Agent) modal.
 *
 * The tab is rendered by the SDK's `AgentSpendCapsTab`
 * (`@iblai/iblai-js/web-containers/next`) via
 * `components/modals/edit-mentor-modal/tabs/spend-caps-tab.tsx`. It has three
 * scopes, each a Radix sub-tab:
 *
 *   - "This agent" (`agent`)  — one cap for THIS mentor, keyed by mentorId.
 *   - "Per user"   (`users`)  — a list of per-(mentor, username) caps.
 *   - "Workspace"  (`tenant`) — ONE cap for the whole tenant. Mutating this
 *     scope affects every mentor and every user on the tenant — see the
 *     isolation notes in journey 66.
 *
 * There is no `@iblai/iblai-js/playwright` helper package for spend caps yet
 * (`grep -ri spend node_modules/@iblai/iblai-js/dist/**\/playwright/*` finds
 * nothing), so every locator below is hand-rolled off the SDK's own stable
 * `data-testid`s — cross-checked directly against the compiled
 * `AGENT_SPEND_CAPS_TAB_LABELS` / `SpendCapForm` / `AgentSpendCapsTab` source
 * in `node_modules/@iblai/iblai-js/dist/web-containers/source/next/index.esm.js`.
 * Re-verify this file's testids/labels the next time `@iblai/iblai-js` bumps
 * and a Playwright helper package appears for this tab (mirror the LTI/Tasks
 * migration pattern when it does).
 *
 * VISIBILITY: admin-only (`userTypes: [UserType.ADMIN]` in
 * `hooks/use-mentor-segments.ts`), always mounted (no `CapabilityGate` —
 * unlike Sandbox/Voice/Screen Share/Privacy/Memory/LTI, this tab was never
 * gated behind a Settings → Capabilities toggle). Lives in the
 * **Configurations** sidebar category, immediately after **LLM** and before
 * **Voice** in `MENTOR_SEGMENTS`.
 *
 * PERMISSIONS: the backend RBAC-gates each scope independently
 * (`Ibl.Mentor/SpendCaps/*`) and the SDK renders a friendly
 * `data-testid="spend-caps-denied"` state per scope on a 403 rather than
 * erroring — `isDenied()` lets callers skip gracefully when this admin
 * account/tenant hasn't been granted the RBAC resource in a given test
 * environment (mirrors `HumanSupportTab.hasToggle()`'s availability guard).
 */

export type SpendCapSubTab = 'agent' | 'users' | 'tenant';
export type SpendCapInterval = 'Day' | 'Week' | 'Month' | 'Year';
export type SpendCapEnforcement = 'Block requests' | 'Alert only';

export interface SpendCapFormValues {
  limit?: string;
  interval?: SpendCapInterval;
  enforcement?: SpendCapEnforcement;
  thresholds?: string;
  enabled?: boolean;
}

const SUB_TAB_TESTID: Record<SpendCapSubTab, string> = {
  agent: 'spend-caps-sub-tab-agent',
  users: 'spend-caps-sub-tab-users',
  tenant: 'spend-caps-sub-tab-tenant',
};

const SUB_TAB_LOADING_TESTID: Record<SpendCapSubTab, string> = {
  agent: 'agent-cap-loading',
  users: 'user-caps-loading',
  tenant: 'tenant-cap-loading',
};

/**
 * One instance of the SDK's `SpendCapForm`, scoped by its `data-testid`
 * prefix: `"agent-cap"` | `"tenant-cap"` | `"user-cap-new"` (the per-user add
 * card's draft form) | `` `user-cap-${username}` `` (an existing per-user
 * cap's expanded edit form).
 */
export class SpendCapForm {
  readonly page: Page;
  readonly prefix: string;

  readonly form: Locator;
  readonly noCapHint: Locator;
  readonly usage: Locator;
  readonly spent: Locator;
  readonly remaining: Locator;
  readonly percent: Locator;
  readonly exceededBadge: Locator;
  readonly alertOnlyBadge: Locator;
  readonly disabledBadge: Locator;
  readonly limitInput: Locator;
  readonly limitError: Locator;
  readonly intervalSelect: Locator;
  readonly enforcementSelect: Locator;
  readonly thresholdsInput: Locator;
  readonly thresholdsError: Locator;
  readonly enabledSwitch: Locator;
  readonly saveButton: Locator;
  readonly deleteButton: Locator;

  constructor(page: Page, root: Locator, prefix: string) {
    this.page = page;
    this.prefix = prefix;
    this.form = root.getByTestId(`${prefix}-form`);
    this.noCapHint = root.getByTestId(`${prefix}-no-cap-hint`);
    this.usage = root.getByTestId(`${prefix}-usage`);
    this.spent = root.getByTestId(`${prefix}-spent`);
    this.remaining = root.getByTestId(`${prefix}-remaining`);
    this.percent = root.getByTestId(`${prefix}-percent`);
    this.exceededBadge = root.getByTestId(`${prefix}-exceeded-badge`);
    this.alertOnlyBadge = root.getByTestId(`${prefix}-alert-only-badge`);
    this.disabledBadge = root.getByTestId(`${prefix}-disabled-badge`);
    this.limitInput = root.getByTestId(`${prefix}-limit-input`);
    this.limitError = root.getByTestId(`${prefix}-limit-error`);
    this.intervalSelect = root.getByTestId(`${prefix}-interval-select`);
    this.enforcementSelect = root.getByTestId(`${prefix}-enforcement-select`);
    this.thresholdsInput = root.getByTestId(`${prefix}-thresholds-input`);
    this.thresholdsError = root.getByTestId(`${prefix}-thresholds-error`);
    this.enabledSwitch = root.getByTestId(`${prefix}-enabled-switch`);
    this.saveButton = root.getByTestId(`${prefix}-save-button`);
    this.deleteButton = root.getByTestId(`${prefix}-delete-button`);
  }

  /**
   * Open the interval Select and read its option labels in DOM order
   * (without picking one). Closes the popover afterward by clicking the
   * `close` option (any option click closes a Radix Select, even a re-click
   * of the already-selected one).
   */
  async readIntervalOptions(
    close: SpendCapInterval = 'Month',
  ): Promise<string[]> {
    await this.intervalSelect.click();
    const options = this.page.getByRole('option');
    await expect(options.first()).toBeVisible({ timeout: 6_000 });
    const labels = (await options.allTextContents()).map((t) => t.trim());
    await this.page.getByRole('option', { name: close, exact: true }).click();
    return labels;
  }

  /**
   * Open the enforcement Select and read its option labels in DOM order
   * (without picking one, beyond the closing click — see `readIntervalOptions`).
   */
  async readEnforcementOptions(
    close: SpendCapEnforcement = 'Alert only',
  ): Promise<string[]> {
    await this.enforcementSelect.click();
    const options = this.page.getByRole('option');
    await expect(options.first()).toBeVisible({ timeout: 6_000 });
    const labels = (await options.allTextContents()).map((t) => t.trim());
    await this.page.getByRole('option', { name: close, exact: true }).click();
    return labels;
  }

  async selectInterval(option: SpendCapInterval): Promise<void> {
    await this.intervalSelect.click();
    const item = this.page.getByRole('option', { name: option, exact: true });
    await expect(item).toBeVisible({ timeout: 6_000 });
    await item.click();
    await expect(this.intervalSelect).toContainText(option, { timeout: 5_000 });
  }

  async selectEnforcement(option: SpendCapEnforcement): Promise<void> {
    await this.enforcementSelect.click();
    const item = this.page.getByRole('option', { name: option, exact: true });
    await expect(item).toBeVisible({ timeout: 6_000 });
    await item.click();
    await expect(this.enforcementSelect).toContainText(option, {
      timeout: 5_000,
    });
  }

  async isEnabled(): Promise<boolean> {
    const attr = await this.enabledSwitch
      .getAttribute('aria-checked')
      .catch(() => null);
    return attr === 'true';
  }

  async setEnabled(target: boolean): Promise<void> {
    const isOn = await this.isEnabled();
    if (isOn === target) return;
    await this.enabledSwitch.click();
    await expect(this.enabledSwitch).toHaveAttribute(
      'aria-checked',
      String(target),
      { timeout: 5_000 },
    );
  }

  /** Fill every provided field. Fields left `undefined` are untouched. */
  async fill(values: SpendCapFormValues): Promise<void> {
    if (values.limit !== undefined) {
      await this.limitInput.fill(values.limit);
    }
    if (values.interval) await this.selectInterval(values.interval);
    if (values.enforcement) await this.selectEnforcement(values.enforcement);
    if (values.thresholds !== undefined) {
      await this.thresholdsInput.fill(values.thresholds);
    }
    if (values.enabled !== undefined) await this.setEnabled(values.enabled);
  }

  /**
   * Click Save and wait out the round trip. There is no optimistic local
   * mirror here — `SpendCapForm` rehydrates its fields from the server
   * response (`cap.id` / `cap.updated_at` effect dependency) — so the button
   * label flipping back from "Saving…" to "Save" is the earliest reliable
   * signal the mutation + refetch landed. Races the SDK's success/error
   * toasts against that settle so a backend rejection fails loudly (mirrors
   * `MemoryTab.createMemory`'s toast race) instead of silently reporting
   * "saved" once the button re-enables.
   */
  async save(): Promise<void> {
    await expect(this.saveButton).toBeEnabled({ timeout: 10_000 });
    await this.saveButton.click();

    const successToast = this.page.getByText('Spend cap saved').first();
    const errorToast = this.page
      .getByText("Couldn't save the spend cap")
      .first();
    const outcome = await Promise.race([
      successToast
        .waitFor({ state: 'visible', timeout: 20_000 })
        .then(() => 'success' as const)
        .catch(() => 'timeout' as const),
      errorToast
        .waitFor({ state: 'visible', timeout: 20_000 })
        .then(() => 'error' as const)
        .catch(() => 'timeout' as const),
      expect(this.saveButton)
        .toHaveText(/^Save$/, { timeout: 20_000 })
        .then(() => 'settled' as const)
        .catch(() => 'timeout' as const),
    ]);
    if (outcome === 'error') {
      throw new Error(
        `SpendCapForm(${this.prefix}).save() failed: backend rejected the ` +
          `request ("Couldn't save the spend cap" toast)`,
      );
    }
    // Whichever race leg won, confirm the button actually settled back to
    // "Save" — a toast can auto-dismiss before this check runs.
    await expect(this.saveButton).toHaveText(/^Save$/, { timeout: 20_000 });
  }

  /**
   * Delete this cap through its confirm modal. Agent/tenant scope uses
   * `spend-cap-delete-modal` / `spend-cap-delete-confirm`; per-user scope
   * uses `user-cap-delete-modal` / `user-cap-delete-confirm` — pass the pair
   * that matches this form's scope.
   */
  async remove(modalTestId: string, confirmTestId: string): Promise<void> {
    await expect(this.deleteButton).toBeEnabled({ timeout: 10_000 });
    await this.deleteButton.click();
    const modal = this.page.getByTestId(modalTestId);
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await modal.getByTestId(confirmTestId).click();
    await expect(modal).toBeHidden({ timeout: 20_000 });
  }
}

export class SpendCapsTab {
  readonly page: Page;
  readonly dialog: Locator;

  readonly heading: Locator;
  readonly description: Locator;
  readonly body: Locator;
  readonly subTabsList: Locator;

  /** "This agent" scope — one cap for the currently open mentor. */
  readonly agentCap: SpendCapForm;
  /** "Workspace" scope — ONE cap for the whole tenant (see class doc). */
  readonly tenantCap: SpendCapForm;
  /** The per-user add card's draft form — only mounted while a non-empty
   * username has been typed into `usernameInput` (see `createUserCap`). */
  readonly newUserCap: SpendCapForm;

  readonly userCapsSection: Locator;
  readonly addUserCapButton: Locator;
  readonly addUserCapCard: Locator;
  readonly usernameInput: Locator;
  readonly usernameError: Locator;
  readonly cancelAddUserCapButton: Locator;
  readonly userCapsEmpty: Locator;
  readonly userCapsList: Locator;
  readonly userCapsLoading: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;

    this.heading = dialog.getByRole('heading', {
      name: 'Spend caps',
      exact: true,
    });
    this.description = dialog.getByText(
      'Set maximum LLM spend limits and see how much has been used.',
      { exact: false },
    );
    this.body = dialog.getByTestId('spend-caps-tab-body');
    this.subTabsList = dialog.getByTestId('spend-caps-sub-tabs');

    this.agentCap = new SpendCapForm(page, dialog, 'agent-cap');
    this.tenantCap = new SpendCapForm(page, dialog, 'tenant-cap');
    this.newUserCap = new SpendCapForm(page, dialog, 'user-cap-new');

    this.userCapsSection = dialog.getByTestId('user-caps-section');
    this.addUserCapButton = dialog.getByTestId('user-caps-add-button');
    this.addUserCapCard = dialog.getByTestId('user-caps-add-card');
    this.usernameInput = dialog.getByTestId('user-caps-username-input');
    this.usernameError = dialog.getByTestId('user-caps-username-error');
    this.cancelAddUserCapButton = dialog.getByTestId('user-caps-add-cancel');
    this.userCapsEmpty = dialog.getByTestId('user-caps-empty');
    this.userCapsList = dialog.getByTestId('user-caps-list');
    this.userCapsLoading = dialog.getByTestId('user-caps-loading');
  }

  // ---------------------------------------------------------------------------
  // Sub-tab navigation
  // ---------------------------------------------------------------------------

  subTabTrigger(tab: SpendCapSubTab): Locator {
    return this.dialog.getByTestId(SUB_TAB_TESTID[tab]);
  }

  async isSubTabActive(tab: SpendCapSubTab): Promise<boolean> {
    return (
      (await this.subTabTrigger(tab)
        .getAttribute('data-state')
        .catch(() => null)) === 'active'
    );
  }

  async switchToSubTab(tab: SpendCapSubTab): Promise<void> {
    const trigger = this.subTabTrigger(tab);
    await expect(trigger).toBeVisible({ timeout: 10_000 });
    if (await this.isSubTabActive(tab)) return;
    await trigger.click();
    await expect(trigger).toHaveAttribute('data-state', 'active', {
      timeout: 5_000,
    });
  }

  /** Wait for the given scope's loading spinner to disappear (or confirm it
   * never appeared — cached data can render instantly). Never throws. */
  async waitSettled(tab: SpendCapSubTab, timeout = 20_000): Promise<void> {
    await this.dialog
      .getByTestId(SUB_TAB_LOADING_TESTID[tab])
      .waitFor({ state: 'hidden', timeout })
      .catch(() => {});
  }

  // ---------------------------------------------------------------------------
  // RBAC denied state
  // ---------------------------------------------------------------------------

  /** The "No access to spend caps" panel the SDK renders in place of a
   * scope's form on a 403 from the backend. */
  deniedState(): Locator {
    return this.dialog.getByTestId('spend-caps-denied');
  }

  async isDenied(): Promise<boolean> {
    return this.deniedState()
      .first()
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
  }

  // ---------------------------------------------------------------------------
  // Per-user caps
  // ---------------------------------------------------------------------------

  async startAddUserCap(): Promise<void> {
    await expect(this.addUserCapButton).toBeVisible({ timeout: 10_000 });
    await this.addUserCapButton.click();
    await expect(this.addUserCapCard).toBeVisible({ timeout: 5_000 });
  }

  async cancelAddUserCap(): Promise<void> {
    await this.cancelAddUserCapButton.click();
    await expect(this.addUserCapCard).toBeHidden({ timeout: 5_000 });
  }

  /** Row for a given username in the per-user caps list. */
  userCapRow(username: string): Locator {
    return this.userCapsList.locator('li').filter({ hasText: username });
  }

  editUserCapButton(username: string): Locator {
    return this.dialog.getByTestId(`user-cap-edit-${username}`);
  }

  deleteUserCapButton(username: string): Locator {
    return this.dialog.getByTestId(`user-cap-delete-${username}`);
  }

  /**
   * Full create flow for a per-user cap: opens the add card, types the
   * username (which mounts the embedded `user-cap-new` form), fills the cap
   * fields, and saves. Waits for the card to collapse and the new row to
   * appear in the list.
   */
  async createUserCap(
    username: string,
    values: SpendCapFormValues,
  ): Promise<void> {
    await this.startAddUserCap();
    await this.usernameInput.fill(username);
    // The embedded SpendCapForm only mounts once the username is non-empty
    // (`newUsernameValid` in the SDK's `UserCapsSection`).
    await expect(this.newUserCap.form).toBeVisible({ timeout: 5_000 });
    await this.newUserCap.fill(values);
    await this.newUserCap.save();
    await expect(this.addUserCapCard).toBeHidden({ timeout: 20_000 });
    await expect(this.userCapRow(username)).toBeVisible({ timeout: 20_000 });
  }

  /** Delete a per-user cap directly from its list row (no need to expand it
   * first — the row's own delete button opens the same confirm modal). */
  async deleteUserCap(username: string): Promise<void> {
    const button = this.deleteUserCapButton(username);
    await expect(button).toBeVisible({ timeout: 10_000 });
    await button.click();
    const modal = this.page.getByTestId('user-cap-delete-modal');
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await modal.getByTestId('user-cap-delete-confirm').click();
    await expect(modal).toBeHidden({ timeout: 20_000 });
    await expect(this.userCapRow(username)).toBeHidden({ timeout: 10_000 });
  }
}
