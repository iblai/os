/**
 * Journey 79: Virtual Machine Network Policies & Secrets
 *
 * An agent with Virtual Machine Shell turned on runs code in an isolated
 * Linux VM that has NO network access by default. This journey covers the
 * UI that lets an org admin decide what that VM can reach and which
 * credentials it can use:
 *
 *   Tenant settings — the SDK `Account` rail of the User Profile dialog
 *     (More options → the platform name, as journey 38 reaches the Advanced
 *     tab) lists a "Virtual Machine" entry for admins that hosts the SDK
 *     `VirtualMachineAdminTab`: the **Network Policies** table (named,
 *     reusable `host:port` allowlists) and the **VM secrets** table (keys
 *     the VM can use but never read). Both are managed through SDK dialogs
 *     whose hosts are entered with a keyboard-driven chip input. Nothing in
 *     the app is involved: the SDK owns the rail, the tab and its gating.
 *   Agent settings — inside Edit Agent → Sandbox, while the Virtual Machine
 *     Shell kind is active, the SDK `SandboxConfig` renders the
 *     `VirtualMachineNetworkSection`: the egress-profile radio group, the
 *     policy picker (Custom only, required), the secrets multi-select
 *     (Public / Custom only) and the billing notice, with every backend
 *     rule mirrored before the save.
 *
 * ── Fixtures and residue ──────────────────────────────────────────────────
 *
 * Policies and secrets are ORG-level records. They are not reaped by the
 * run-level residue teardown (which knows only mentors and projects), a
 * policy still bound to an agent cannot be deleted at all, and a duplicate
 * name / env var is a 400 — so every record this file creates carries a
 * unique stamp and is deleted again through the API in `afterEach`
 * (`e2e/utils/virtual-machine-api.ts`), after the agent that used it has
 * been moved off it. The agent-settings flow needs a policy and a secret
 * that already exist: those are seeded through the same API rather than
 * re-driving the dialogs the earlier tests already prove.
 *
 * ── Parallel safety ───────────────────────────────────────────────────────
 *
 * The suite runs `fullyParallel`, and the same journey can run at once in
 * several workers and browser projects against one tenant. Every test here
 * is self-contained, so the file is NOT serial:
 *
 *   - No shared records. Each test creates its own policy / secret under a
 *     stamp built from the clock, the worker index AND a random part
 *     (`stamp()`), so two tests starting in the same millisecond cannot
 *     collide on the org-unique name or env var. Rows are always looked up
 *     by that unique name, never by position or count, so rows other runs
 *     add or remove in the same org-wide table do not matter.
 *   - No shared agent. Binding a policy / selecting a sandbox kind mutates
 *     mentor settings, so the agent-settings test creates its own mentor
 *     (this project's shared-mentor-isolation convention, journeys 44 / 71).
 *     The tenant-dialog tests only open the User Profile dialog and mutate
 *     no agent.
 *   - No mentor deletion mid-run. Other workers land on the account's
 *     most-recently-accessed mentor, which can be the one this file just
 *     created; deleting it under them would redirect their page. The mentor
 *     is registered by `createMentorPage` and reaped once, at the run-level
 *     residue teardown. This file only moves it off the policy / secret so
 *     those can be deleted.
 *   - Serial mode is deliberately absent: it skips every later test in the
 *     file once one fails, which hides their results, and nothing here needs
 *     an order.
 */

import { test, expect } from '../fixtures/mentor-test';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import {
  createVmNetworkPolicy,
  createVmSecret,
  deleteVmNetworkPoliciesByName,
  deleteVmSecretsByEnvVar,
  releaseMentorVmNetwork,
} from '../utils/virtual-machine-api';
import {
  VirtualMachineAdminPage,
  readPlatformName,
} from '../page-objects/virtual-machine-admin.page';
import { SandboxTab } from '../page-objects/edit-mentor/sandbox.tab';
import { VmNetworkSection } from '../page-objects/edit-mentor/vm-network.section';

/**
 * Unique suffix for a record name / env var: upper-case letters and digits
 * only, so it is a valid env-var fragment. The clock alone is not unique —
 * parallel workers and browser projects can start the same test in the same
 * millisecond — so the worker index and a random part are folded in.
 */
function stamp(): string {
  const clock = Date.now().toString(36);
  const worker = (test.info().parallelIndex ?? 0).toString(36);
  const random = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
  return `${clock}${worker}${random}`.toUpperCase();
}

const HOST_API = 'api.e2e-vm.example.com:443';
const HOST_AUTH = 'auth.e2e-vm.example.com:443';
const HOST_FILES = 'files.e2e-vm.example.com:443';

// ─── Tenant admin dialog ─────────────────────────────────────────────────────

test.describe('Journey 79: Virtual Machine Network Policies & Secrets — admin dialog', () => {
  const policiesToDelete = new Set<string>();
  const secretsToDelete = new Set<string>();

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(
        true,
        'Virtual Machine policies and secrets require admin access',
      );
    }
  });

  test.afterEach(async ({ page }) => {
    // Secrets first (deleting one also unbinds it everywhere), then policies.
    await deleteVmSecretsByEnvVar(page, secretsToDelete);
    secretsToDelete.clear();
    await deleteVmNetworkPoliciesByName(page, policiesToDelete);
    policiesToDelete.clear();
  });

  // ── vmn-01 ──────────────────────────────────────────────────────────────

  test('admin reaches the tenant Virtual Machine settings through the User Profile dialog, which hosts the SDK tab with the Network Policies and Secrets sections', async ({
    page,
  }) => {
    const admin = new VirtualMachineAdminPage(page);
    await admin.openTenantSettings();

    // The SDK Account rail lists Virtual Machine for admins, next to the
    // Memory and Advanced entries journeys 38 / 28 already use.
    await expect(
      admin.dialog.getByRole('button', { name: 'Advanced', exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(admin.virtualMachineTab).toBeVisible({ timeout: 10_000 });
    await admin.virtualMachineTab.click();

    await expect(admin.infoBox).toBeVisible({ timeout: 30_000 });
    await expect(admin.infoBox).toContainText('no network access by default');

    // Both sections are reachable for an admin (each would be hidden on a
    // 403 from its list call — an admin holds both list permissions).
    await expect(admin.policiesSubTab).toBeVisible({ timeout: 10_000 });
    await expect(admin.secretsSubTab).toBeVisible({ timeout: 10_000 });
    await admin.showPolicies();
    await expect(admin.newPolicyButton).toBeVisible({ timeout: 10_000 });
    await admin.showSecrets();
    await expect(admin.newSecretButton).toBeVisible({ timeout: 10_000 });

    await admin.close();
  });

  // ── vmn-02 / vmn-03 ─────────────────────────────────────────────────────

  test('admin creates a network policy through the chip input (inline host:port validation, keyboard chips) and edits it, seeing the removed-host warning', async ({
    page,
  }) => {
    const name = `E2E VM Policy ${stamp()}`;
    policiesToDelete.add(name);

    const admin = new VirtualMachineAdminPage(page);
    await admin.open();
    await admin.showPolicies();
    await admin.openNewPolicy();
    await expect(admin.newPolicyDialog).toBeVisible({ timeout: 5_000 });
    await admin.policyNameInput.fill(name);

    // A scheme is not a host:port — the entry stays in the box and the
    // aria-live line explains why; no chip is added.
    await admin.addHost(
      admin.policyHostsInput,
      'https://api.e2e-vm.example.com',
    );
    await expect(admin.policyHostsError).toBeVisible({ timeout: 5_000 });
    await expect(admin.policyHostsError).toContainText('must be host:port');
    await expect(admin.policyHostsList).toHaveCount(0);
    await expect(admin.policyHostsInput).toHaveValue(
      'https://api.e2e-vm.example.com',
    );

    // Reserved hosts are refused client-side too.
    await admin.addHost(admin.policyHostsInput, 'localhost:443');
    await expect(admin.policyHostsError).toContainText('reserved');
    await expect(admin.policyHostsList).toHaveCount(0);

    // A valid entry becomes a chip and clears the error line.
    await admin.addHost(admin.policyHostsInput, HOST_API);
    await expect(admin.hostChip(admin.policyHostsList, HOST_API)).toBeVisible({
      timeout: 5_000,
    });
    await expect(admin.policyHostsInput).toHaveValue('');
    await expect(admin.policyHostsError).toBeEmpty();

    // Chips are keyboard-driven: Backspace on an empty box removes the last
    // chip, and each chip exposes a labelled remove button.
    await admin.policyHostsInput.press('Backspace');
    await expect(admin.policyHostsList).toHaveCount(0);
    await admin.addHost(admin.policyHostsInput, HOST_API);
    await expect(
      admin.removeHostButton(admin.policyHostsList, HOST_API),
    ).toBeVisible({ timeout: 5_000 });

    await admin.policyDescriptionInput.fill('Created by journey 79');
    await admin.policySaveButton.click();
    await admin.expectToast('Network policy created');
    await expect(admin.policyDialog).not.toBeVisible({ timeout: 10_000 });

    const row = await admin.findPolicyRow(name);
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(admin.policyRowHosts(name)).toContainText(HOST_API);

    // Edit: add a host, drop the original — the dialog warns that a secret
    // sent to a removed host would stop working (the backend does not block
    // the edit), and the saved row reflects the replaced list.
    await admin.openEditPolicy(name);
    await expect(admin.editPolicyDialog).toBeVisible({ timeout: 5_000 });
    await expect(admin.policyNameInput).toHaveValue(name);
    await expect(admin.hostChip(admin.policyHostsList, HOST_API)).toBeVisible();
    await admin.addHost(admin.policyHostsInput, HOST_AUTH);
    await expect(admin.hostChip(admin.policyHostsList, HOST_AUTH)).toBeVisible({
      timeout: 5_000,
    });
    await admin.removeHostButton(admin.policyHostsList, HOST_API).click();
    await expect(admin.policyRemovedHostsWarning).toBeVisible({
      timeout: 5_000,
    });
    await expect(admin.policyRemovedHostsWarning).toContainText(HOST_API);
    await admin.policySaveButton.click();
    await admin.expectToast('Network policy updated');
    await expect(admin.policyDialog).not.toBeVisible({ timeout: 10_000 });
    await expect(admin.policyRowHosts(name)).toContainText(HOST_AUTH, {
      timeout: 15_000,
    });
    await expect(admin.policyRowHosts(name)).not.toContainText(HOST_API);

    await admin.close();
  });

  // ── vmn-04 / vmn-05 ─────────────────────────────────────────────────────

  test('admin creates a VM secret from a pasted value, never sees the value again (blank on edit, env var read-only, credential source offered) and deletes it', async ({
    page,
  }) => {
    const suffix = stamp();
    const envVar = `E2E_VM_KEY_${suffix}`;
    const name = `E2E VM Secret ${suffix}`;
    secretsToDelete.add(envVar);

    const admin = new VirtualMachineAdminPage(page);
    await admin.open();
    await admin.showSecrets();
    await admin.openNewSecret();
    await expect(admin.newSecretDialog).toBeVisible({ timeout: 5_000 });

    await admin.secretNameInput.fill(name);
    await admin.secretEnvVarInput.fill(envVar);

    // Secrets take hostnames only — an IP literal is refused client-side.
    await admin.addHost(admin.secretHostsInput, '203.0.113.10:443');
    await expect(admin.secretHostsError).toContainText('not an IP address');
    await expect(admin.secretHostsList).toHaveCount(0);
    await admin.addHost(admin.secretHostsInput, HOST_FILES);
    await expect(admin.hostChip(admin.secretHostsList, HOST_FILES)).toBeVisible(
      { timeout: 5_000 },
    );

    // The value source is a choice: "Enter a Value" (default) or an existing
    // integration credential. The value box is a password field.
    await expect(admin.secretSourceValueRadio).toHaveAttribute(
      'data-state',
      'checked',
    );
    await expect(admin.secretValueInput).toHaveAttribute('type', 'password');
    await expect(admin.secretValueInput).toHaveAttribute(
      'placeholder',
      'Paste the key',
    );

    // Too short and masked-looking values are rejected before any request.
    await admin.secretValueInput.fill('short');
    await admin.secretSaveButton.click();
    await expect(
      admin.secretDialog.getByText('The value must be at least 8 characters.'),
    ).toBeVisible({ timeout: 5_000 });
    await admin.secretValueInput.fill('sk-************');
    await admin.secretSaveButton.click();
    await expect(
      admin.secretDialog.getByText(
        'This looks like a masked value. Paste the real key.',
      ),
    ).toBeVisible({ timeout: 5_000 });

    await admin.secretValueInput.fill(`e2e-secret-value-${suffix}`);
    await admin.secretSaveButton.click();
    await admin.expectToast('VM secret created');
    await expect(admin.secretDialog).not.toBeVisible({ timeout: 10_000 });

    const row = await admin.findSecretRow(envVar);
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row).toContainText(name);
    await expect(row).toContainText(HOST_FILES);
    // The table only says where the value comes from — never the value.
    await expect(row).toContainText('Stored Value');
    await expect(row).not.toContainText(`e2e-secret-value-${suffix}`);

    // Edit: env var is read-only, the value box is blank and says so, and
    // switching to a credential source offers the org's credentials (or
    // says there are none) without ever showing a masked value.
    await admin.openEditSecret(envVar);
    await expect(admin.editSecretDialog).toBeVisible({ timeout: 5_000 });
    await expect(admin.secretEnvVarInput).toHaveValue(envVar);
    await expect(admin.secretEnvVarInput).toBeDisabled();
    await expect(admin.secretValueInput).toHaveValue('');
    await expect(admin.secretValueInput).toHaveAttribute(
      'placeholder',
      'Leave blank to keep the current value',
    );
    await admin.secretSourceCredentialRadio.click();
    await expect(
      admin.secretCredentialSelect.or(admin.secretNoCredentialsNotice).first(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(admin.secretValueInput).not.toBeVisible();
    await expect(admin.secretDialog).not.toContainText('****');
    await admin.secretCancelButton.click();
    await expect(admin.secretDialog).not.toBeVisible({ timeout: 10_000 });

    // Delete: the confirmation spells out that every agent using it loses it.
    await admin.openDeleteSecret(envVar);
    await expect(admin.secretDeleteDialog).toContainText(envVar);
    await expect(admin.secretDeleteDialog).toContainText(
      'removed from every agent that uses it',
    );
    await admin.secretDeleteConfirmButton.click();
    await admin.expectToast('VM secret deleted');
    await expect(admin.secretDeleteDialog).not.toBeVisible({ timeout: 10_000 });
    // No page of the table lists it any more. The helper anchors on the
    // section first: the table is rooted on the User Profile dialog, which
    // Radix hides from the accessibility tree while a nested dialog is open.
    await admin.expectSecretRowGone(envVar);
    secretsToDelete.delete(envVar);

    await admin.close();
  });

  // ── vmn-06 ──────────────────────────────────────────────────────────────

  test('admin deletes a network policy they just created: the confirmation names it, Cancel keeps it, and confirming removes its row', async ({
    page,
  }) => {
    // A policy created here and now is bound to no agent, so the delete is
    // a plain one. The unique name keeps it apart from anything else in the
    // org-wide list.
    const name = `E2E VM Delete Policy ${stamp()}`;
    policiesToDelete.add(name);

    const admin = new VirtualMachineAdminPage(page);
    await admin.open();
    await admin.showPolicies();
    await admin.createPolicy({ name, hosts: [HOST_API] });

    // The list is org-wide and ordered by name: find the row on whichever
    // page it landed (a single page today; the walk covers a paged table).
    const row = await admin.findPolicyRow(name);
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(admin.policyRowHosts(name)).toContainText(HOST_API);

    // The confirmation names the policy; Cancel leaves it in place.
    await admin.openDeletePolicy(name);
    await expect(admin.policyDeleteDialog).toContainText(name);
    await expect(admin.policyDeleteConfirmButton).toBeVisible();
    await admin.policyDeleteCancelButton.click();
    await expect(admin.policyDeleteDialog).not.toBeVisible({
      timeout: 10_000,
    });
    await expect(await admin.findPolicyRow(name)).toBeVisible();

    // Confirming deletes it: the success toast, the dialog closes and no
    // page of the table lists the policy any more.
    await admin.openDeletePolicy(name);
    await admin.policyDeleteConfirmButton.click();
    await admin.expectToast('Network policy deleted');
    await expect(admin.policyDeleteDialog).not.toBeVisible({
      timeout: 10_000,
    });
    await admin.expectPolicyRowGone(name);
    policiesToDelete.delete(name);

    await admin.close();
  });
});

// ─── Agent settings ──────────────────────────────────────────────────────────

test.describe('Journey 79: Virtual Machine Network Policies & Secrets — agent settings', () => {
  const policiesToDelete = new Set<string>();
  const secretsToDelete = new Set<string>();

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Virtual Machine network settings require admin access');
    }
  });

  test.afterEach(async ({ page }) => {
    await deleteVmSecretsByEnvVar(page, secretsToDelete);
    secretsToDelete.clear();
    await deleteVmNetworkPoliciesByName(page, policiesToDelete);
    policiesToDelete.clear();
  });

  // ── vmn-07 … vmn-12 ─────────────────────────────────────────────────────

  test('admin configures an agent VM network: labelled egress radio group + billing notice, policy picker only under Custom (required, with Create Policy), secrets only under Public/Custom, uncovered hosts added to the policy on save, persistence, and narrowing that unbinds secrets after confirmation', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    // VM boot is not involved, but the flow reopens the Edit Agent dialog
    // several times on a just-created mentor (each open can hydrate ~30s).
    test.slow();

    const suffix = stamp();
    const policyName = `E2E VM Agent Policy ${suffix}`;
    const envVar = `E2E_VM_AGENT_KEY_${suffix}`;
    policiesToDelete.add(policyName);
    secretsToDelete.add(envVar);

    // Org fixtures: a policy that allows the API host only, and a secret
    // sent to the FILES host — which the policy does not allow yet.
    await createVmNetworkPolicy(page, {
      name: policyName,
      allowed_hosts: [HOST_API],
    });
    await createVmSecret(page, {
      name: `E2E VM Agent Secret ${suffix}`,
      env_var: envVar,
      allow_hosts: [HOST_FILES],
      value: `e2e-agent-secret-${suffix}`,
    });

    // Dedicated agent with the Virtual Machine Shell kind selected.
    await createMentorPage.openAndCreate();
    const { mentorId } = await getPlatformContext(page);

    const openNetworkSection = async (): Promise<VmNetworkSection> => {
      await editMentorPage.open('Settings');
      await editMentorPage.navigateToTab('Sandbox');
      await waitForPageReady(page);
      const section = new VmNetworkSection(page, editMentorPage.dialog);
      await section.waitForLoaded();
      return section;
    };

    try {
      await editMentorPage.open('Settings');
      await editMentorPage.navigateToTab('Sandbox');
      await waitForPageReady(page);
      const sandbox = new SandboxTab(page, editMentorPage.dialog);
      await sandbox.selectKind('virtual-machine');
      expect(await sandbox.isKindEnabled('virtual-machine')).toBe(true);

      // vmn-07: the section renders under the kind selector with the billing
      // notice and a labelled radio group of the four profiles; a fresh
      // agent defaults to No Network, so neither picker is shown.
      let net = new VmNetworkSection(page, editMentorPage.dialog);
      await net.waitForLoaded();
      await expect(net.billingNotice).toBeVisible();
      await expect(net.billingNotice).toContainText('$1 per 10 minutes');
      await expect(net.egressGroup).toHaveAttribute('role', 'radiogroup');
      await expect(net.egressRadioGroup).toBeVisible();
      for (const profile of [
        'none',
        'registries',
        'public',
        'custom',
      ] as const) {
        // Resolved by role + its Title Case label inside the group.
        await expect(net.egressRadio(profile)).toBeVisible();
      }
      await expect(net.egressOption('none')).toHaveAttribute(
        'data-state',
        'checked',
      );
      expect(await net.getSelectedEgress()).toBe('none');
      await expect(net.policyPicker).not.toBeVisible();
      await expect(net.secretsPicker).not.toBeVisible();
      await expect(net.saveButton).toBeDisabled();

      // vmn-08: secrets need network access — the multi-select appears under
      // Public (and Custom) only; the policy picker under Custom only.
      await net.selectEgress('public');
      await expect(net.secretsPicker).toBeVisible({ timeout: 10_000 });
      await expect(net.secretOption(envVar)).toBeVisible();
      await expect(net.policyPicker).not.toBeVisible();
      await net.selectEgress('registries');
      await expect(net.secretsPicker).not.toBeVisible();
      await expect(net.policyPicker).not.toBeVisible();

      // vmn-09: Custom requires a policy — the picker is shown and required,
      // Save stays disabled, and the Create Policy shortcut opens the SDK
      // policy dialog in place.
      await net.selectEgress('custom');
      await expect(net.policyPicker).toBeVisible({ timeout: 10_000 });
      await expect(net.policyRequiredMessage).toBeVisible();
      await expect(net.saveButton).toBeDisabled();
      await net.createPolicyButton.click();
      await expect(net.newPolicyDialog).toBeVisible({ timeout: 10_000 });
      await net.policyDialogCancelButton.click();
      await expect(net.policyDialog).not.toBeVisible({ timeout: 10_000 });
      await net.selectPolicy(policyName);
      await expect(net.policyRequiredMessage).not.toBeVisible();
      await expect(net.policyHosts).toContainText(HOST_API);
      await expect(net.secretsPicker).toBeVisible();

      // vmn-10: binding a secret whose host the policy lacks lists the gap
      // and blocks Save; "Add Hosts to … and Save" patches the policy and
      // then saves the settings in one go.
      await net.setSecret(envVar, true);
      await expect(net.uncoveredHosts).toBeVisible({ timeout: 10_000 });
      await expect(net.uncoveredHosts).toContainText(
        `${envVar} needs ${HOST_FILES}, which ${policyName} doesn't allow.`,
      );
      await expect(net.saveButton).toBeDisabled();
      await expect(net.addHostsAndSaveButton).toBeVisible();
      await expect(net.addHostsAndSaveButton).toContainText(policyName);
      await net.addHostsAndSaveButton.click();
      await expect(
        page.getByText(`Hosts added to ${policyName}`, { exact: true }).first(),
      ).toBeVisible({ timeout: 30_000 });
      await net.expectSavedToast();
      await expect(net.uncoveredHosts).not.toBeVisible({ timeout: 15_000 });
      await editMentorPage.close();

      // vmn-11: the saved configuration survives a reopen — Custom, the
      // policy (now allowing the secret's host too) and the bound secret.
      net = await openNetworkSection();
      await expect(net.egressOption('custom')).toHaveAttribute(
        'data-state',
        'checked',
      );
      expect(await net.getSelectedEgress()).toBe('custom');
      await expect(net.policySelect).toContainText(policyName);
      await expect(net.policyHosts).toContainText(HOST_FILES);
      await expect(net.policyHosts).toContainText(HOST_API);
      expect(await net.isSecretChecked(envVar)).toBe(true);
      await expect(net.saveButton).toBeDisabled();

      // vmn-12: narrowing to No Network with a secret bound asks first and
      // unbinds it in the same request; the reopened agent is on No Network
      // with nothing bound.
      await net.selectEgress('none');
      await expect(net.secretsPicker).not.toBeVisible();
      await net.save();
      // Resolved by role + its "Unbind Secrets?" title, so being visible is
      // the title assertion; the body names how many secrets get unbound.
      await expect(net.narrowConfirmDialog).toBeVisible({ timeout: 10_000 });
      await expect(net.narrowConfirmDialog).toContainText('1 secret');
      await net.narrowConfirmButton.click();
      await net.expectSavedToast();
      await expect(net.narrowConfirmDialog).not.toBeVisible({
        timeout: 10_000,
      });
      await editMentorPage.close();

      net = await openNetworkSection();
      await expect(net.egressOption('none')).toHaveAttribute(
        'data-state',
        'checked',
      );
      await net.selectEgress('public');
      await expect(net.secretsPicker).toBeVisible({ timeout: 10_000 });
      expect(await net.isSecretChecked(envVar)).toBe(false);
      await net.discardButton.click();
      await expect(net.egressOption('none')).toHaveAttribute(
        'data-state',
        'checked',
      );
      await expect(net.saveButton).toBeDisabled();
      await editMentorPage.close();
    } finally {
      // Move the agent off the policy / secret so the org-level cleanup in
      // afterEach can delete them. The agent itself is NOT deleted here: it
      // is reaped at the run-level teardown (see "Parallel safety" above).
      await releaseMentorVmNetwork(page, mentorId);
    }
  });
});

// ─── Non-admin ───────────────────────────────────────────────────────────────

test.describe('Journey 79: Virtual Machine Network Policies & Secrets — non-admin', () => {
  // ── vmn-13 ──────────────────────────────────────────────────────────────

  test('non-admin never reaches the tenant Virtual Machine settings: the tenant entry is missing from More options, does nothing, or its dialog lists no Virtual Machine section', async ({
    nonadminPage,
  }) => {
    await navigateToMentorApp(nonadminPage);

    const moreOptions = nonadminPage.getByRole('button', {
      name: 'More options',
    });
    await expect(moreOptions).toBeVisible({ timeout: 15_000 });
    await moreOptions.click();
    const menu = nonadminPage.getByRole('menu', { name: 'More options' });
    await expect(menu).toBeVisible({ timeout: 5_000 });

    // The tenant entry is labelled with the platform name. A non-admin may
    // not get it at all; if they do and it opens, the SDK Account rail
    // filters Virtual Machine on `isAdmin`, so the section is absent either
    // way.
    const tenantItem = menu.getByText(await readPlatformName(nonadminPage), {
      exact: true,
    });
    const tenantEntryShown = await tenantItem
      .waitFor({ state: 'visible', timeout: 3_000 })
      .then(() => true)
      .catch(() => false);
    if (!tenantEntryShown) {
      await nonadminPage.keyboard.press('Escape');
      return;
    }

    await tenantItem.click();
    const dialog = nonadminPage.getByRole('dialog', {
      name: 'User Profile',
      exact: true,
    });
    // The SDK tenant switcher opens the dialog only for a tenant admin or a
    // user holding a management permission; for anyone else the click does
    // nothing, which is itself "never reaches the settings".
    const dialogOpened = await dialog
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (!dialogOpened) {
      await expect(dialog).toHaveCount(0);
      await nonadminPage.keyboard.press('Escape');
      return;
    }

    // The dialog opened, so this non-admin holds a management permission:
    // the rail lists Management for them (the SDK filters every other tenant
    // entry on `isAdmin`). Wait for the rail itself — not just any button,
    // the dialog's own Close button exists before the rail renders — then
    // check Virtual Machine is not in it.
    const rail = dialog.getByRole('navigation', {
      name: 'Organization settings',
      exact: true,
    });
    await expect(
      rail.getByRole('button', { name: 'Management', exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      dialog.getByRole('button', { name: 'Virtual Machine', exact: true }),
    ).toHaveCount(0);
    await nonadminPage.keyboard.press('Escape');
  });
});
