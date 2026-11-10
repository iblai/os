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
 *     tab) lists a "Network" entry for admins, in its Integrations group,
 *     that hosts the SDK `VirtualMachineAdminTab`: a table of named, reusable
 *     allowlists, managed through an SDK dialog whose hosts are entered with a
 *     keyboard-driven chip input.
 *   Secrets — the sidebar's "Secrets" footer row opens the SDK `SecretsTab`:
 *     one sub-tab per kind of key (LLMs, Services, Environment Variables), each with
 *     its own sentence, Add button and table. Add LLM and Add Service start on a
 *     type-to-search box; Add Environment Variable opens straight on its form.
 *     Nothing in the app is involved beyond the footer row: the SDK owns the
 *     rail, the tabs and their gating.
 *   Agent settings — inside Edit Agent → Sandbox, while the Virtual Machine
 *     Shell kind is active, the SDK `SandboxConfig` renders the
 *     `VirtualMachineNetworkSection`: the egress-profile radio group, the
 *     policy picker (Custom only, required), the Environment Variables group
 *     (every profile, its boxes disabled without network access) and the
 *     billing notice, with every backend rule mirrored before the save.
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
 *     The tenant-dialog tests only open the User Profile and Secrets dialogs
 *     and mutate no agent.
 *   - No mentor deletion mid-run. Other workers land on the account's
 *     most-recently-accessed mentor, which can be the one this file just
 *     created; deleting it under them would redirect their page. The mentor
 *     is registered by `createMentorPage` and reaped once, at the run-level
 *     residue teardown. This file only moves it off the policy / secret so
 *     those can be deleted.
 *   - No shared singletons. An organization holds one Stripe key and one key
 *     per AI provider, so the checkpoints that add them answer those lists from
 *     `page.route` (`e2e/utils/secrets-mock.ts`) instead of touching real keys.
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
  putMentorVmNetworkSettings,
  releaseMentorVmNetwork,
} from '../utils/virtual-machine-api';
import {
  VirtualMachineAdminPage,
  readPlatformName,
} from '../page-objects/virtual-machine-admin.page';
import {
  ENV_VAR_COLUMNS,
  KEY_COLUMNS,
  SecretsPage,
} from '../page-objects/secrets.page';
import {
  mockAiSecretLists,
  mockStripeSecretLists,
} from '../utils/secrets-mock';
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

// As the chips and rows show them; the API stores them with the standard port.
const HOST_API = 'api.e2e-vm.example.com';
const HOST_AUTH = 'auth.e2e-vm.example.com';
const HOST_FILES = 'files.e2e-vm.example.com';
const stored = (host: string) => `${host}:443`;

/** One of an organization's lists, whatever its query string. */
const orgList = (path: string) =>
  new RegExp(String.raw`\/api\/ai-account\/orgs\/[^/]+\/${path}\/(\?.*)?$`);

// ─── Tenant admin dialog ─────────────────────────────────────────────────────

test.describe('Journey 79: Virtual Machine Network Policies & Secrets — admin dialog', () => {
  const policiesToDelete = new Set<string>();
  const secretsToDelete = new Set<string>();

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Network policies and secrets require admin access');
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

  test("admin reaches Network through the User Profile dialog's Integrations group, and the Secrets page through its own footer row and rail entry", async ({
    page,
  }) => {
    const admin = new VirtualMachineAdminPage(page);
    await admin.openTenantSettings();

    // The SDK Account rail lists Network Policies for admins, in its Integrations group.
    await expect(
      admin.dialog.getByRole('button', { name: 'Advanced', exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(admin.networkPoliciesTab).toBeVisible({ timeout: 10_000 });
    await admin.networkPoliciesTab.click();

    await expect(admin.infoBox).toBeVisible({ timeout: 30_000 });
    await expect(admin.infoBox).toContainText(
      'with no internet access unless you allow it',
    );

    // Network policies are all the page holds: no sub-tabs to choose from.
    await expect(admin.policiesSection).toBeVisible({ timeout: 15_000 });
    await expect(admin.addPolicyButton).toHaveText('Add Network', {
      timeout: 10_000,
    });
    await expect(admin.dialog.getByTestId('vm-secrets-section')).toHaveCount(0);

    const integrations = admin.dialog.getByRole('group', {
      name: 'Integrations',
      exact: true,
    });
    await expect(integrations.getByRole('button')).toHaveText(
      ['API', 'Secrets', 'Network'],
      { timeout: 10_000 },
    );
    await expect(
      admin.dialog.getByRole('group', { name: 'Security', exact: true }),
    ).toHaveCount(0);

    await admin.close();

    const secrets = new SecretsPage(page);
    await secrets.open();
    await expect(secrets.tabs).toHaveText([
      'LLMs',
      'Services',
      'Environment Variables',
    ]);
    await secrets.openTab('env');
    await expect(secrets.addButton('env')).toHaveText(
      'Add Environment Variable',
    );
    await secrets.close();
  });

  // ── vmn-02 / vmn-03 ─────────────────────────────────────────────────────

  test('admin adds a network policy through the chip input (inline host:port validation, keyboard chips) and edits it, seeing the removed-host warning', async ({
    page,
  }) => {
    const name = `E2E VM Policy ${stamp()}`;
    policiesToDelete.add(name);

    const admin = new VirtualMachineAdminPage(page);
    await admin.open();
    await admin.openAddPolicy();
    await expect(admin.addPolicyDialog).toBeVisible({ timeout: 5_000 });
    await expect(admin.policySaveButton).toHaveText('Add Network');
    await admin.policyNameInput.fill(name);

    // An underscore is not an address — the entry stays in the box and the
    // aria-live line explains why; no chip is added.
    await admin.addHost(admin.policyHostsInput, 'bad_host.example.com');
    await expect(admin.policyHostsError).toBeVisible({ timeout: 5_000 });
    await expect(admin.policyHostsError).toContainText(
      'Enter just the address',
    );
    await expect(admin.policyHostsList).toHaveCount(0);
    await expect(admin.policyHostsInput).toHaveValue(
      'bad_host.example.com:443',
    );

    // Reserved hosts are refused client-side too.
    await admin.addHost(admin.policyHostsInput, 'localhost');
    await expect(admin.policyHostsError).toContainText(
      "localhost can't be used here.",
    );
    await expect(admin.policyHostsList).toHaveCount(0);

    // A pasted URL becomes its host: a chip, and the error line clears.
    await admin.addHost(admin.policyHostsInput, `https://${HOST_API}/v1`);
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
    await admin.expectToast('Network added');
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
    await admin.expectToast('Network updated');
    await expect(admin.policyDialog).not.toBeVisible({ timeout: 10_000 });
    await expect(admin.policyRowHosts(name)).toContainText(HOST_AUTH, {
      timeout: 15_000,
    });
    await expect(admin.policyRowHosts(name)).not.toContainText(HOST_API);

    await admin.close();
  });

  // ── vmn-04 / vmn-05 ─────────────────────────────────────────────────────

  test('admin adds an environment variable on its tab, never sees its key again (blank on edit, Variable Name locked, Allowed Hosts listed) and deletes it', async ({
    page,
  }) => {
    const suffix = stamp();
    const envVar = `E2E_VM_KEY_${suffix}`;
    const name = `E2E VM Key ${suffix}`;
    const value = `e2e-secret-value-${suffix}`;
    secretsToDelete.add(envVar);

    const secrets = new SecretsPage(page);
    await secrets.open();
    await secrets.openTab('env');
    await secrets.openAdd('env');
    await expect(secrets.secretDialog).toHaveAccessibleName(
      'Add Environment Variable',
    );
    await expect(secrets.serviceSearch).toHaveCount(0);

    // The Variable Name is worked out from the name.
    await secrets.nameInput.fill(name);
    await expect(secrets.envVarInput).toHaveValue(envVar);

    // Secrets take hostnames only — an IP literal is refused client-side.
    await secrets.addHost('203.0.113.10');
    await expect(secrets.hostsError).toContainText('not a number address');
    await expect(secrets.hostsList).toHaveCount(0);
    await secrets.addHost(HOST_FILES);
    await expect(secrets.hostChip(HOST_FILES)).toBeVisible({ timeout: 5_000 });

    await expect(secrets.keyInput).toHaveAttribute('type', 'password');
    await expect(secrets.keyInput).toHaveAttribute(
      'placeholder',
      'Paste the key',
    );

    // The hidden copy a list shows is refused before any request.
    await secrets.keyInput.fill('sk-************');
    await secrets.saveButton.click();
    await expect(
      secrets.secretDialog.getByText(
        'This looks like a hidden copy of the key (it contains ***). Paste the full key.',
      ),
    ).toBeVisible({ timeout: 5_000 });

    await secrets.keyInput.fill(value);
    await secrets.saveButton.click();
    await secrets.expectToast(
      `${name} added. Choose it on an agent's Sandbox tab to let that agent use it.`,
    );
    await expect(secrets.secretDialog).not.toBeVisible({ timeout: 10_000 });

    const row = secrets.row(envVar);
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row).toContainText(name);
    await expect(secrets.envVarCell(envVar)).toHaveText(envVar);
    await expect(secrets.hostsCell(envVar)).toHaveText(HOST_FILES);
    await expect(row).not.toContainText(value);

    // Edit: the variable is locked, the address is listed, and the key box is
    // blank and says so.
    await secrets.openEdit(envVar);
    await expect(secrets.secretDialog).toHaveAccessibleName(
      'Edit Environment Variable',
    );
    await expect(secrets.envVarInput).toHaveValue(envVar);
    await expect(secrets.envVarInput).toBeDisabled();
    await expect(secrets.hostChip(HOST_FILES)).toBeVisible();
    await expect(secrets.keyInput).toHaveValue('');
    await expect(secrets.keyInput).toHaveAttribute(
      'placeholder',
      'Leave blank to keep the current key',
    );
    await expect(secrets.secretDialog).not.toContainText('****');
    await secrets.cancelButton.click();
    await expect(secrets.secretDialog).not.toBeVisible({ timeout: 10_000 });

    // Delete: the confirmation spells out that every agent using it loses it.
    await secrets.openDelete(envVar);
    await expect(secrets.deleteDialog).toHaveAccessibleName(
      'Delete Environment Variable',
    );
    await expect(secrets.deleteDialog).toContainText(name);
    await expect(secrets.deleteDialog).toContainText(
      'removed from every agent that uses it',
    );
    await secrets.deleteConfirmButton.click();
    await secrets.expectToast('Environment variable deleted');
    await expect(secrets.deleteDialog).not.toBeVisible({ timeout: 10_000 });
    await expect(secrets.section).toBeVisible();
    await expect(secrets.row(envVar)).toHaveCount(0, { timeout: 20_000 });
    secretsToDelete.delete(envVar);

    await secrets.close();
  });

  // ── vmn-06 ──────────────────────────────────────────────────────────────

  test('admin deletes a network policy they just created: the confirmation names it, Cancel keeps it, and confirming removes its row', async ({
    page,
  }) => {
    // A policy created here and now is bound to no agent, so the delete is
    // a plain one. The unique name keeps it apart from anything else in the
    // org-wide list.
    const name = `E2E VM Delete Network ${stamp()}`;
    policiesToDelete.add(name);

    const admin = new VirtualMachineAdminPage(page);
    await admin.open();
    await admin.addPolicy({ name, hosts: [HOST_API] });

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
    await admin.expectToast('Network deleted');
    await expect(admin.policyDeleteDialog).not.toBeVisible({
      timeout: 10_000,
    });
    await admin.expectPolicyRowGone(name);
    policiesToDelete.delete(name);

    await admin.close();
  });

  // ── vmn-15 ──────────────────────────────────────────────────────────────

  test('admin sees AI keys on the LLMs tab and adds and deletes one, with the hidden copy of a key refused (mocked dataset)', async ({
    page,
  }) => {
    await mockAiSecretLists(page);
    const secrets = new SecretsPage(page);
    await secrets.open();

    const azure = secrets.row('ai-azure_openai');
    await expect(azure).toContainText('Azure OpenAI');
    await expect(azure).toContainText('2 models');
    await azure
      .getByRole('button', {
        name: 'Show models for Azure OpenAI',
        exact: true,
      })
      .click();
    await expect(secrets.keyCell('ai-azure_openai-gpt-4o')).toHaveText(
      'az-***1',
    );
    await expect(secrets.keyCell('ai-azure_openai-gpt-4o-mini')).toHaveText(
      'az-***2',
    );

    await secrets.openAdd('llms');
    await expect(secrets.secretDialog).toHaveAccessibleName('Add LLM');
    await secrets.pickService('OpenAI', 'ai-openai');
    await expect(secrets.aiHint).toHaveText(
      'Your agents answer with this key. They never see it.',
    );
    const key = secrets.field('key');
    await expect(key).toHaveAttribute('type', 'password');
    await expect(secrets.hostsInput).toHaveCount(0);
    await expect(secrets.envVarInput).toHaveCount(0);

    await key.fill('sk-***ab');
    await secrets.saveButton.click();
    await expect(
      secrets.secretDialog.getByText(
        'This looks like a hidden copy of the key (it contains ***). Paste the full key.',
      ),
    ).toBeVisible({ timeout: 5_000 });

    await key.fill('sk-e2e-not-a-real-key');
    await secrets.saveButton.click();
    await secrets.expectToast('OpenAI added.');
    await expect(secrets.secretDialog).not.toBeVisible({ timeout: 10_000 });

    const openAi = secrets.row('ai-openai');
    await expect(openAi).toBeVisible({ timeout: 15_000 });
    await expect(openAi).toContainText('sk-***ab');
    await expect(openAi).not.toContainText('sk-e2e-not-a-real-key');

    await secrets.openDelete('ai-openai');
    await expect(secrets.deleteDialog).toHaveAccessibleName('Delete LLM');
    await expect(secrets.deleteDialog).toContainText(
      'Delete OpenAI? Your agents will no longer be able to use it.',
    );
    await secrets.deleteConfirmButton.click();
    await secrets.expectToast('OpenAI deleted');
    await expect(secrets.deleteDialog).not.toBeVisible({ timeout: 10_000 });
    await expect(secrets.row('ai-openai')).toHaveCount(0, { timeout: 15_000 });

    await secrets.close();
  });

  // ── vmn-16 ──────────────────────────────────────────────────────────────

  test('admin sees one tab per kind of key, each with its own sentence, Add button and columns, and finds a service by typing its name (mocked dataset)', async ({
    page,
  }) => {
    await mockAiSecretLists(page);
    await mockStripeSecretLists(page);
    await page.route(orgList('integration-credential'), (route) =>
      route.fulfill({
        json: [
          {
            id: 8,
            name: 'acme_mail',
            value: { key: 'am-****' },
            service_info: { display_name: 'Acme Mail' },
          },
        ],
      }),
    );
    await page.route(orgList('virtual-machine-secret'), (route) =>
      route.fulfill({
        json: [
          {
            id: 31,
            name: 'E2E Acme Key',
            env_var: 'E2E_ACME_KEY',
            allow_hosts: [stored(HOST_API)],
            source_credential_id: null,
            source_field: '',
            created_at: '2026-11-06T00:00:00Z',
            updated_at: '2026-11-06T00:00:00Z',
          },
        ],
      }),
    );

    const secrets = new SecretsPage(page);
    await secrets.open();

    await expect(secrets.tabs).toHaveText([
      'LLMs',
      'Services',
      'Environment Variables',
    ]);
    await expect(secrets.section).toContainText(
      'your agents can answer using its models',
    );
    await expect(secrets.addButton('llms')).toHaveText('Add LLM');
    await expect(secrets.columnHeaders).toHaveText(KEY_COLUMNS);
    await expect(secrets.rows).toHaveText([/^Azure OpenAI/]);

    await secrets.openTab('env');
    await expect(secrets.section).toContainText(
      'The real key is only sent to the addresses you allow.',
    );
    await expect(secrets.addButton('env')).toHaveText(
      'Add Environment Variable',
    );
    await expect(secrets.columnHeaders).toHaveText(ENV_VAR_COLUMNS);
    await expect(secrets.rows).toHaveText([/^E2E Acme Key/]);
    await expect(secrets.envVarCell('E2E_ACME_KEY')).toHaveText('E2E_ACME_KEY');
    await expect(secrets.hostsCell('E2E_ACME_KEY')).toHaveText(HOST_API);

    await secrets.openTab('services');
    await expect(secrets.section).toContainText(
      "A key like Stripe's can be given to an agent on its Sandbox tab.",
    );
    await expect(secrets.addButton('services')).toHaveText('Add Service');
    await expect(secrets.columnHeaders).toHaveText(KEY_COLUMNS);
    await expect(secrets.rows).toHaveText([/^Acme Mail/]);
    await expect(secrets.keyCell('service-acme_mail')).toHaveText('am-****');

    await secrets.openAdd('services');
    await expect(secrets.secretDialog).toHaveAccessibleName('Add Service');
    await expect(secrets.serviceSearch).toHaveAccessibleName('Service');
    await expect(secrets.serviceSearch).toHaveAttribute(
      'placeholder',
      'Type a name, like Stripe',
    );

    await secrets.serviceSearch.fill('Zebra');
    await expect(secrets.serviceNoMatch).toHaveText(
      'Not listed? Add its key on the Environment Variables tab.',
    );

    await secrets.pickService('Stripe', 'stripe');
    await expect(secrets.servicePicked).toContainText('Stripe');
    await expect(secrets.serviceSearch).toHaveCount(0);

    await secrets.serviceChangeButton.click();
    await expect(secrets.servicePicked).toHaveCount(0);
    await expect(secrets.serviceSearch).toBeVisible();

    await secrets.cancelButton.click();
    await expect(secrets.secretDialog).not.toBeVisible({ timeout: 10_000 });
    await secrets.close();
  });

  // ── vmn-17 ──────────────────────────────────────────────────────────────

  test('admin whose list of LLM keys could not be read is told so in Add LLM and cannot pick an LLM yet, and Try Again brings them back (mocked dataset)', async ({
    page,
  }) => {
    await mockAiSecretLists(page);
    let heldKeysDown = true;
    await page.route(orgList('masked-llm-credential'), (route) =>
      heldKeysDown
        ? route.fulfill({ status: 500, json: { detail: 'e2e' } })
        : route.fallback(),
    );

    const secrets = new SecretsPage(page);
    await secrets.open();
    await secrets.openAdd('llms');

    await expect(secrets.choicesFailed).toContainText(
      'Some choices could not be loaded, so yours may be missing.',
    );
    await expect(secrets.choicesRetry).toHaveText('Try Again');
    await expect(secrets.serviceSearch).toBeEnabled();
    await expect(secrets.nameInput).toHaveCount(0);
    await expect(secrets.field('key')).toHaveCount(0);

    await secrets.serviceSearch.fill('OpenAI');
    await expect(secrets.serviceOption('ai-openai')).toContainText(
      'Not loaded',
    );
    await expect(secrets.serviceOption('ai-openai')).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    heldKeysDown = false;
    await secrets.choicesRetry.click();
    await expect(secrets.choicesFailed).toHaveCount(0, { timeout: 15_000 });
    await secrets.pickService('OpenAI', 'ai-openai');
    await expect(secrets.field('key')).toBeVisible();

    await secrets.cancelButton.click();
    await expect(secrets.secretDialog).not.toBeVisible({ timeout: 10_000 });
    await secrets.close();
  });

  // ── vmn-18 ──────────────────────────────────────────────────────────────

  test("admin of an organization with no keys sees each tab's own sentence as one row inside its table, under its column headings (mocked dataset)", async ({
    page,
  }) => {
    await mockAiSecretLists(page);
    await mockStripeSecretLists(page);
    await page.route(orgList('masked-llm-credential'), (route) =>
      route.fulfill({ json: [] }),
    );

    const secrets = new SecretsPage(page);
    await secrets.open();

    for (const { section, columns, sentence } of [
      {
        section: 'llms',
        columns: KEY_COLUMNS,
        sentence: 'No LLM keys found',
      },
      {
        section: 'services',
        columns: KEY_COLUMNS,
        sentence: 'No services found',
      },
      {
        section: 'env',
        columns: ENV_VAR_COLUMNS,
        sentence: 'No environment variables found',
      },
    ] as const) {
      await secrets.openTab(section);
      await expect(secrets.columnHeaders).toHaveText(columns);
      await expect(secrets.emptyMessage).toHaveText(sentence);
      await expect(secrets.emptyMessage).toHaveAttribute(
        'colspan',
        String(columns.length),
      );
      await expect(secrets.rows).toHaveCount(1);
    }

    await secrets.close();
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

  test('admin configures an agent VM network: labelled egress radio group + billing notice, policy picker only under Custom (required, with Add Network), Environment Variables under every profile but disabled without network access, uncovered hosts added to the policy on save, persistence, and narrowing that removes them after confirmation', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    // VM boot is not involved, but the flow reopens the Edit Agent dialog
    // several times on a just-created mentor (each open can hydrate ~30s).
    test.slow();

    const suffix = stamp();
    const policyName = `E2E VM Agent Policy ${suffix}`;
    const secretName = `E2E VM Agent Secret ${suffix}`;
    const envVar = `E2E_VM_AGENT_KEY_${suffix}`;
    const addedName = `E2E VM Added Key ${suffix}`;
    const addedEnvVar = `E2E_VM_ADDED_KEY_${suffix}`;
    policiesToDelete.add(policyName);
    secretsToDelete.add(envVar);
    secretsToDelete.add(addedEnvVar);

    // Org fixtures: a policy that allows the API host only, and a secret
    // sent to the FILES host — which the policy does not allow yet.
    await createVmNetworkPolicy(page, {
      name: policyName,
      allowed_hosts: [stored(HOST_API)],
    });
    await createVmSecret(page, {
      name: secretName,
      env_var: envVar,
      allow_hosts: [stored(HOST_FILES)],
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
      // agent defaults to No Network, so the policy picker is not shown.
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
      await expect(net.saveButton).toBeDisabled();

      // vmn-08: the Environment Variables group is there under every profile,
      // its boxes disabled until the profile has network access.
      await expect(net.secretsGroup).toBeVisible();
      await expect(net.secretsLocked).toHaveText(
        'These need network access to work. Choose Public Internet or Custom Allowlist above to turn one on for this agent.',
      );
      await expect(net.secretOption(envVar)).toBeDisabled();
      await expect(net.addSecretButton).toHaveText('Add Environment Variable');

      // Adding one without network access opens straight on its form and
      // leaves it unticked.
      await net.addSecretButton.click();
      const form = new SecretsPage(page);
      await expect(form.addDialog).toHaveAccessibleName(
        'Add Environment Variable',
      );
      await expect(form.serviceSearch).toHaveCount(0);
      await form.nameInput.fill(addedName);
      await expect(form.envVarInput).toHaveValue(addedEnvVar);
      await form.keyInput.fill(`e2e-added-secret-${suffix}`);
      await form.addHost(HOST_FILES);
      await form.saveButton.click();
      await form.expectToast('Environment variable added');
      await expect(form.secretDialog).not.toBeVisible({ timeout: 10_000 });
      await expect(net.secretOption(addedEnvVar)).toBeDisabled();
      await expect(net.secretOption(addedEnvVar)).toHaveAttribute(
        'data-state',
        'unchecked',
      );

      await net.selectEgress('public');
      await expect(net.secretsLocked).not.toBeVisible();
      await expect(net.secretOption(envVar)).toBeEnabled();
      await expect(net.policyPicker).not.toBeVisible();
      await net.selectEgress('registries');
      await expect(net.secretsLocked).toBeVisible();
      await expect(net.secretOption(envVar)).toBeDisabled();
      await expect(net.addSecretButton).toBeEnabled();
      await expect(net.policyPicker).not.toBeVisible();

      // vmn-09: Custom requires a policy — the picker is shown and required,
      // Save stays disabled, and the Add Network shortcut opens the SDK policy
      // dialog in place.
      await net.selectEgress('custom');
      await expect(net.policyPicker).toBeVisible({ timeout: 10_000 });
      await expect(net.policyRequiredMessage).toBeVisible();
      await expect(net.saveButton).toBeDisabled();
      await expect(net.addPolicyButton).toHaveText('Add Network');
      await net.addPolicyButton.click();
      await expect(net.addPolicyDialog).toBeVisible({ timeout: 10_000 });
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
        `${secretName} is sent to ${HOST_FILES}, which ${policyName} doesn't allow.`,
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
      await expect(net.secretsLocked).toBeVisible();
      await net.save();
      // Resolved by role + its "Remove Environment Variables?" title, so being
      // visible is the title assertion; the body names how many get removed.
      await expect(net.narrowConfirmDialog).toBeVisible({ timeout: 10_000 });
      await expect(net.narrowConfirmDialog).toContainText(
        'removes 1 environment variable',
      );
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

  // ── vmn-14 ──────────────────────────────────────────────────────────────

  test('admin adds a Stripe key on the Services tab, which needs both Key and Publishable Key, sees its masked prefix, and lets an agent use it from the Sandbox tab (mocked dataset)', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    test.slow();
    const { savedCredentials } = await mockStripeSecretLists(page);
    const value = 'sk_live_e2e_not_a_real_key';
    const publishableKey = 'pk_live_e2e_not_a_real_key';

    const secrets = new SecretsPage(page);
    await secrets.open();
    await secrets.openTab('services');
    await secrets.openAdd('services');
    await expect(secrets.secretDialog).toHaveAccessibleName('Add Service');
    await secrets.pickService('Stripe', 'stripe');
    await expect(secrets.agentHint).toHaveText(
      'Agents can use this key once you choose it on their Sandbox tab.',
    );
    await secrets.field('key').fill(value);
    await secrets.saveButton.click();
    await expect(
      secrets.secretDialog.getByText('Enter the Publishable Key.'),
    ).toBeVisible({ timeout: 5_000 });

    await secrets.field('publishable_key').fill(publishableKey);
    await secrets.saveButton.click();
    await secrets.expectToast(
      "Stripe added. To let an agent use it, choose it on the agent's Sandbox tab.",
    );
    await expect(secrets.secretDialog).not.toBeVisible({ timeout: 10_000 });
    expect(savedCredentials[0].value).toEqual({
      key: value,
      publishable_key: publishableKey,
    });

    const added = secrets.row('service-stripe');
    await expect(added).toBeVisible({ timeout: 15_000 });
    await expect(secrets.columnHeaders).toHaveText(KEY_COLUMNS);
    await expect(secrets.keyCell('service-stripe')).toHaveText('sk_live_****');
    await expect(added).not.toContainText(value);
    await secrets.close();

    await createMentorPage.openAndCreate();
    const { mentorId } = await getPlatformContext(page);
    // A new agent's starting egress is a per-organization backend setting.
    await putMentorVmNetworkSettings(page, mentorId, {
      virtual_machine_egress: 'none',
    });
    await editMentorPage.open('Settings');
    await editMentorPage.navigateToTab('Sandbox');
    await waitForPageReady(page);
    const sandbox = new SandboxTab(page, editMentorPage.dialog);
    await sandbox.selectKind('virtual-machine');
    const net = new VmNetworkSection(page, editMentorPage.dialog);
    await net.waitForLoaded();
    await expect(net.serviceOption('stripe')).toBeDisabled();
    await net.selectEgress('public');

    // Ticking the key asks only where it is sent, already filled in for Stripe.
    await net.serviceOption('stripe').click();
    const linkDialog = page.getByRole('dialog', {
      name: 'Let Agents Use Stripe',
      exact: true,
    });
    await expect(linkDialog).toBeVisible({ timeout: 10_000 });
    await expect(
      linkDialog.getByTestId('vm-secret-hosts').getByRole('listitem'),
    ).toContainText('api.stripe.com');
    await linkDialog.getByTestId('vm-secret-save').click();
    await expect(linkDialog).not.toBeVisible({ timeout: 10_000 });
    await expect(net.secretOption('STRIPE_KEY')).toBeVisible({
      timeout: 10_000,
    });

    // The binding is mocked, so the agent's own settings are never saved with it.
    await net.discardButton.click();
    await editMentorPage.close();

    await secrets.open();
    await secrets.openTab('services');
    await expect(secrets.row('STRIPE_KEY')).toBeVisible({ timeout: 15_000 });
    await secrets.openEdit('STRIPE_KEY');
    await expect(secrets.secretDialog).toHaveAccessibleName('Edit Service');
    await expect(secrets.envVarInput).toHaveValue('STRIPE_KEY');
    await expect(secrets.hostChip('api.stripe.com')).toBeVisible();
    await secrets.cancelButton.click();
    await expect(secrets.secretDialog).not.toBeVisible({ timeout: 10_000 });

    await secrets.openTab('env');
    await expect(secrets.envVarCell('STRIPE_KEY')).toHaveText('STRIPE_KEY');
    await secrets.openEdit('STRIPE_KEY');
    await expect(secrets.secretDialog).toHaveAccessibleName(
      'Edit Environment Variable',
    );
    await secrets.cancelButton.click();
    await expect(secrets.secretDialog).not.toBeVisible({ timeout: 10_000 });
    await secrets.close();
  });
});

// ─── Non-admin ───────────────────────────────────────────────────────────────

test.describe('Journey 79: Virtual Machine Network Policies & Secrets — non-admin', () => {
  // ── vmn-13 ──────────────────────────────────────────────────────────────

  test('non-admin never reaches Network Policies: the tenant entry is missing from More options, does nothing, or its dialog lists no Network Policies entry', async ({
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
    // filters Network Policies on `isAdmin`, so the entry is absent either
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
    // check Network Policies is not in it.
    const rail = dialog.getByRole('navigation', {
      name: 'Organization settings',
      exact: true,
    });
    await expect(
      rail.getByRole('button', { name: 'Management', exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      dialog.getByRole('button', { name: 'Network', exact: true }),
    ).toHaveCount(0);
    await nonadminPage.keyboard.press('Escape');
  });
});
