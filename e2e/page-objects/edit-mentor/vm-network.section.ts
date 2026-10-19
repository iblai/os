import { Page, Locator, expect } from '@playwright/test';

/** The four egress profiles, in the order the SDK lists them. */
export type VmEgressProfile = 'none' | 'registries' | 'public' | 'custom';

/** UI labels of the egress radio options (SDK `virtualMachineNetworkSection`). */
export const VM_EGRESS_LABELS: Record<VmEgressProfile, string> = {
  none: 'No Network',
  registries: 'Package Registries',
  public: 'Public Internet',
  custom: 'Custom Allowlist',
};

/**
 * Page object for the **Network Access** section the SDK `SandboxConfig`
 * renders inside the Edit Agent → Sandbox tab while the Virtual Machine
 * Shell sandbox kind is active (`VirtualMachineNetworkSection` in
 * `@iblai/web-containers`).
 *
 * The section is a draft editor over the agent's VM network settings:
 *
 *   - an **Egress Profile** radio group (`vm-egress-group`, one
 *     `vm-egress-{profile}` item per profile — `none` / `registries` /
 *     `public` / `custom`);
 *   - a **Network Policy** picker (`vm-policy-picker`) that renders only
 *     under Custom and is required there, with a "Create Policy" shortcut
 *     that opens the SDK `NetworkPolicyDialog` in place (plus "Edit Policy"
 *     once one is chosen, and "Manage Policies");
 *   - a **Secrets** multi-select (`vm-secrets-picker`, one
 *     `vm-secret-option-{env_var}` checkbox per secret, plus "Manage
 *     Secrets") that renders only under Public or Custom, capped at 20;
 *   - the billing notice (`vm-billing-notice`).
 *
 * Nothing is sent until **Save Changes** (`vm-network-save`, disabled while
 * the draft is clean or invalid) — the SDK mirrors the backend's rules
 * before saving: Custom needs a policy; narrowing to None / Registries with
 * secrets bound opens the "Unbind Secrets?" confirmation and unbinds them in
 * the same request; under Custom every host a bound secret needs must be in
 * the policy, otherwise the `vm-uncovered-hosts` alert lists the gaps and
 * "Add Hosts to {policy} and Save" (`vm-add-hosts-and-save`) patches the
 * policy first.
 *
 * ── Dialog-first locators ────────────────────────────────────────────────
 *
 * The section lives inside the Edit Agent dialog, so its controls are
 * queried from that dialog locator. The layers it opens on top — the policy
 * form and the "Unbind Secrets?" confirmation — portal to `document.body`
 * and repeat button names the Edit Agent dialog also has ("Cancel", "Save
 * Changes"). Each is therefore resolved first by ARIA role AND accessible
 * name (the SDK `DialogTitle`), and its buttons are queried from that
 * locator. Both are plain Radix dialogs (role `dialog`, not `alertdialog`).
 *
 * While one of them (or the policy select's listbox) is open, Radix hides
 * the Edit Agent dialog from the accessibility tree, so the section's own
 * locators resolve to nothing until it closes — wait for the nested layer
 * to be hidden before asserting on the section again.
 */
export class VmNetworkSection {
  readonly page: Page;
  readonly dialog: Locator;

  readonly section: Locator;
  readonly loading: Locator;
  readonly billingNotice: Locator;
  readonly egressGroup: Locator;
  /** The same group, resolved by its role and its "Egress Profile" label. */
  readonly egressRadioGroup: Locator;
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
  /** The SDK policy dialog in either mode (portaled on top of Edit Agent). */
  readonly policyDialog: Locator;
  /** The policy dialog as the "Create Policy" shortcut opens it. */
  readonly newPolicyDialog: Locator;
  readonly policyDialogCancelButton: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;

    this.section = dialog.getByTestId('vm-network-section');
    this.loading = dialog.getByTestId('vm-network-section-loading');
    this.billingNotice = dialog.getByTestId('vm-billing-notice');
    this.egressGroup = dialog.getByTestId('vm-egress-group');
    this.egressRadioGroup = dialog.getByRole('radiogroup', {
      name: 'Egress Profile',
      exact: true,
    });
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
    this.narrowConfirmDialog = page.getByRole('dialog', {
      name: 'Unbind Secrets?',
      exact: true,
    });
    this.narrowConfirmButton = this.narrowConfirmDialog.getByTestId(
      'vm-narrow-confirm-action',
    );
    this.narrowCancelButton = this.narrowConfirmDialog.getByRole('button', {
      name: 'Cancel',
      exact: true,
    });
    this.policyDialog = page.getByRole('dialog', {
      name: /^(New|Edit) Network Policy$/,
    });
    this.newPolicyDialog = page.getByRole('dialog', {
      name: 'New Network Policy',
      exact: true,
    });
    this.policyDialogCancelButton = this.policyDialog.getByRole('button', {
      name: 'Cancel',
      exact: true,
    });
  }

  /** The radio for a profile, by role and its Title Case label. */
  egressRadio(profile: VmEgressProfile): Locator {
    // The accessible name is the <label>'s two spans joined — the profile
    // label followed by its description — so anchor on the label prefix.
    // The four labels share no prefix, so each resolves to one radio.
    return this.egressRadioGroup.getByRole('radio', {
      name: new RegExp(`^${escapeRegExp(VM_EGRESS_LABELS[profile])}`),
    });
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
    // The Radix listbox portals to document.body: resolve the listbox first,
    // then the option inside it.
    const option = this.page
      .getByRole('listbox')
      .getByRole('option', { name, exact: true });
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

  /** Clicks Save Changes; the caller asserts the outcome (toast / confirm / error). */
  async save(): Promise<void> {
    await expect(this.saveButton).toBeEnabled({ timeout: 10_000 });
    // A "Network settings saved" toast left over from an earlier save in the
    // same test would satisfy the caller's next toast assertion before this
    // save has even been sent. Toasts dismiss themselves after a few seconds;
    // wait that out so the next one seen belongs to this save.
    await expect(this.savedToast).toHaveCount(0, { timeout: 15_000 });
    await this.saveButton.click();
  }

  /** The "Network settings saved" toast is the authoritative save signal. */
  async expectSavedToast(timeout = 30_000): Promise<void> {
    await expect(this.savedToast.first()).toBeVisible({ timeout });
  }

  /** Every "Network settings saved" toast currently on the page. */
  private get savedToast(): Locator {
    return this.page.getByText('Network settings saved', { exact: true });
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
