import { Page, Locator, expect } from '@playwright/test';

/** The four egress profiles, in the order the SDK lists them. */
export type VmEgressProfile = 'none' | 'registries' | 'public' | 'custom';

/** UI labels of the egress radio options (SDK `virtualMachineNetworkSection`). */
export const VM_EGRESS_LABELS: Record<VmEgressProfile, string> = {
  none: 'No network',
  registries: 'Package registries',
  public: 'Public internet',
  custom: 'Custom allowlist',
};

/**
 * Page object for the **Network access** section the SDK `SandboxConfig`
 * renders inside the Edit Agent → Sandbox tab while the Virtual Machine
 * Shell sandbox kind is active (`VirtualMachineNetworkSection` in
 * `@iblai/web-containers`).
 *
 * The section is a draft editor over the agent's VM network settings:
 *
 *   - an **Egress profile** radio group (`vm-egress-group`, one
 *     `vm-egress-{profile}` item per profile — `none` / `registries` /
 *     `public` / `custom`);
 *   - a **Network policy** picker (`vm-policy-picker`) that renders only
 *     under Custom and is required there, with a "Create policy" shortcut
 *     that opens the SDK `NetworkPolicyDialog` in place;
 *   - a **Secrets** multi-select (`vm-secrets-picker`, one
 *     `vm-secret-option-{env_var}` checkbox per secret) that renders only
 *     under Public or Custom, capped at 20;
 *   - the billing notice (`vm-billing-notice`).
 *
 * Nothing is sent until **Save changes** (`vm-network-save`, disabled while
 * the draft is clean or invalid) — the SDK mirrors the backend's rules
 * before saving: Custom needs a policy; narrowing to None / Registries with
 * secrets bound opens the "Unbind secrets?" confirmation
 * (`vm-narrow-confirm`) and unbinds them in the same request; under Custom
 * every host a bound secret needs must be in the policy, otherwise the
 * `vm-uncovered-hosts` alert lists the gaps and "Add these hosts to {policy}
 * and save" (`vm-add-hosts-and-save`) patches the policy first.
 *
 * The section lives inside the Edit Agent dialog, so its locators are
 * scoped to that dialog; the confirmation alert and the policy dialog
 * portal to `document.body` and are page-scoped.
 */
export class VmNetworkSection {
  readonly page: Page;
  readonly dialog: Locator;

  readonly section: Locator;
  readonly loading: Locator;
  readonly billingNotice: Locator;
  readonly egressGroup: Locator;
  readonly policyPicker: Locator;
  readonly policySelect: Locator;
  readonly createPolicyButton: Locator;
  readonly policyHosts: Locator;
  readonly policiesForbidden: Locator;
  readonly policyRequiredMessage: Locator;
  readonly secretsPicker: Locator;
  readonly noSecrets: Locator;
  readonly secretsCap: Locator;
  readonly uncoveredHosts: Locator;
  readonly addHostsAndSaveButton: Locator;
  readonly saveButton: Locator;
  readonly discardButton: Locator;
  readonly formError: Locator;
  readonly narrowConfirmDialog: Locator;
  readonly narrowConfirmButton: Locator;
  readonly narrowCancelButton: Locator;
  /** The SDK policy dialog the "Create policy" shortcut opens (portaled). */
  readonly policyDialog: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;

    this.section = dialog.getByTestId('vm-network-section');
    this.loading = dialog.getByTestId('vm-network-section-loading');
    this.billingNotice = dialog.getByTestId('vm-billing-notice');
    this.egressGroup = dialog.getByTestId('vm-egress-group');
    this.policyPicker = dialog.getByTestId('vm-policy-picker');
    this.policySelect = dialog.getByTestId('vm-policy-select');
    this.createPolicyButton = dialog.getByTestId('vm-policy-create');
    this.policyHosts = dialog.getByTestId('vm-policy-hosts');
    this.policiesForbidden = dialog.getByTestId('vm-policies-forbidden');
    this.policyRequiredMessage = dialog.getByText(
      'The Custom profile needs a network policy.',
      { exact: true },
    );
    this.secretsPicker = dialog.getByTestId('vm-secrets-picker');
    this.noSecrets = dialog.getByTestId('vm-no-secrets');
    this.secretsCap = dialog.getByTestId('vm-secrets-cap');
    this.uncoveredHosts = dialog.getByTestId('vm-uncovered-hosts');
    this.addHostsAndSaveButton = dialog.getByTestId('vm-add-hosts-and-save');
    this.saveButton = dialog.getByTestId('vm-network-save');
    this.discardButton = dialog.getByTestId('vm-network-discard');
    this.formError = dialog.getByTestId('vm-network-form-error');
    this.narrowConfirmDialog = page.getByTestId('vm-narrow-confirm');
    this.narrowConfirmButton = page.getByTestId('vm-narrow-confirm-action');
    this.narrowCancelButton = this.narrowConfirmDialog.getByRole('button', {
      name: 'Cancel',
      exact: true,
    });
    this.policyDialog = page.getByTestId('network-policy-dialog');
  }

  /** The radio item for an egress profile. */
  egressOption(profile: VmEgressProfile): Locator {
    return this.dialog.getByTestId(`vm-egress-${profile}`);
  }

  /** The checkbox for a secret, keyed by its environment variable. */
  secretOption(envVar: string): Locator {
    return this.dialog.getByTestId(`vm-secret-option-${envVar}`);
  }

  /**
   * Waits for the section to finish loading the agent's settings and the
   * org's policy / secret lists (the skeleton renders until all three
   * resolve).
   */
  async waitForLoaded(timeout = 30_000): Promise<void> {
    await expect(this.section).toBeVisible({ timeout });
  }

  /** Which profile is currently selected in the draft, from the radios' state. */
  async getSelectedEgress(): Promise<VmEgressProfile | null> {
    const profiles: VmEgressProfile[] = [
      'none',
      'registries',
      'public',
      'custom',
    ];
    for (const profile of profiles) {
      const state = await this.egressOption(profile).getAttribute('data-state');
      if (state === 'checked') return profile;
    }
    return null;
  }

  async selectEgress(profile: VmEgressProfile): Promise<void> {
    const option = this.egressOption(profile);
    await expect(option).toBeVisible({ timeout: 10_000 });
    await option.click();
    await expect(option).toHaveAttribute('data-state', 'checked', {
      timeout: 5_000,
    });
  }

  /** Picks a policy by name from the Radix select. */
  async selectPolicy(name: string): Promise<void> {
    await expect(this.policySelect).toBeVisible({ timeout: 10_000 });
    await this.policySelect.click();
    const option = this.page.getByRole('option', { name, exact: true });
    await expect(option).toBeVisible({ timeout: 10_000 });
    await option.click();
    await expect(this.policySelect).toContainText(name, { timeout: 5_000 });
  }

  async isSecretChecked(envVar: string): Promise<boolean> {
    const state = await this.secretOption(envVar).getAttribute('data-state');
    return state === 'checked';
  }

  async setSecret(envVar: string, checked: boolean): Promise<void> {
    const option = this.secretOption(envVar);
    await expect(option).toBeVisible({ timeout: 10_000 });
    if ((await this.isSecretChecked(envVar)) === checked) return;
    await option.click();
    await expect(option).toHaveAttribute(
      'data-state',
      checked ? 'checked' : 'unchecked',
      { timeout: 5_000 },
    );
  }

  /** Clicks Save changes; the caller asserts the outcome (toast / confirm / error). */
  async save(): Promise<void> {
    await expect(this.saveButton).toBeEnabled({ timeout: 10_000 });
    await this.saveButton.click();
  }

  /** The "Network settings saved" toast is the authoritative save signal. */
  async expectSavedToast(timeout = 30_000): Promise<void> {
    await expect(
      this.page.getByText('Network settings saved', { exact: true }).first(),
    ).toBeVisible({ timeout });
  }
}
