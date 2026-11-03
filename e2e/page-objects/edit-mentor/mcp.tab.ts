import { Page, Locator, Response, expect } from '@playwright/test';
import { MCP_SERVER_LIST_PATH } from '../../utils/mcp-servers';
import type { CreatedMcpServer } from '../../utils/mcp-servers';
import { MENTOR_SETTINGS_PATH } from '../chat-mcp-menu.page';

const isCall = (res: Response, method: string, path: RegExp) =>
  res.request().method() === method && path.test(new URL(res.url()).pathname);

/**
 * The agent settings MCP tab (SDK `McpTab`, `edit-mentor-modal/tabs/mcp-tab/`),
 * after the iblai/iblai-platform#2725 review: Featured / Directory sub-tabs
 * (one "Connectors" list when nothing is featured) of compact cards, each a
 * group named after its connector with one switch (on/off for this agent)
 * and two icon buttons, Configure (gear) and Delete (bin). The "Add MCP
 * Connector" / "Configure MCP Connector" form and the "Remove Connector"
 * confirmation are portal dialogs: each is resolved by its own role + name,
 * and every field is looked up inside it, never on the page, so the Edit
 * Agent modal behind it can never be matched by mistake. Toggling, adding
 * and deleting all write the agent's settings (`mcp_servers` plus the `mcp`
 * tool), so the helpers wait on those requests, not on time.
 */
export class McpTab {
  static readonly LABELS = {
    tab: 'MCP',
    title: 'MCP',
    description:
      'Outside services your agent can use in chats. Turn each one on or off for this agent.',
    addConnector: 'Add Connector',
    /** The sub-tabs' accessible list name, and the single list's heading. */
    connectors: 'Connectors',
    featured: 'Featured',
    directory: 'Directory',
    search: 'Search by name...',
    noConnectors: 'No connectors configured',
    configure: 'Configure',
    delete: 'Delete',
    cancel: 'Cancel',
    addDialog: 'Add MCP Connector',
    configureDialog: 'Configure MCP Connector',
    removeDialog: 'Remove Connector',
    namePlaceholder: 'Enter connector name',
    serverPlaceholder: 'https://api.example.com/mcp',
    userCanDisable: 'Allow Users to Turn Off',
    userCanDisableOnHint: 'People can switch it off in their own chats.',
    userCanDisableOffHint:
      'It stays on in every chat. No one can switch it off.',
    /** The form's submit for a new connector, and for an existing one. */
    connect: 'Connect',
    update: 'Update',
    noAuthentication: 'No Authentication',
    oauth: 'OAuth',
    scopeUser: 'User',
    scopeAgent: 'Agent',
    scopeOrganization: 'Organization',
    scopeUserHint: 'Each person signs in with their own account from the chat.',
    /** The card switch's accessible name: "{name} enabled" / "{name} disabled". */
    enabled: 'enabled',
    disabled: 'disabled',
    onToast: (name: string) => `${name} is on for this agent`,
    offToast: (name: string) => `${name} is off for this agent`,
    addedToast: (name: string) => `${name} connector added successfully`,
    updatedToast: (name: string) => `${name} connector updated successfully`,
    removedToast: (name: string) => `${name} connector removed successfully`,
  } as const;

  readonly page: Page;
  /** The Edit Agent modal. */
  readonly dialog: Locator;
  readonly title: Locator;
  readonly description: Locator;
  readonly addConnectorButton: Locator;
  readonly searchInput: Locator;
  /** The Featured / Directory sub-tabs; absent when nothing is featured. */
  readonly subTabs: Locator;
  readonly featuredTab: Locator;
  readonly directoryTab: Locator;
  /** The single list's heading, shown instead of the sub-tabs. */
  readonly connectorsHeading: Locator;
  readonly emptyState: Locator;
  readonly addDialog: Locator;
  readonly configureDialog: Locator;
  readonly removeDialog: Locator;

  constructor(page: Page, dialog: Locator) {
    const { LABELS } = McpTab;
    this.page = page;
    this.dialog = dialog;
    this.title = dialog.getByRole('heading', {
      name: LABELS.title,
      exact: true,
      level: 3,
    });
    this.description = dialog.getByText(LABELS.description, { exact: true });
    this.addConnectorButton = dialog.getByRole('button', {
      name: LABELS.addConnector,
      exact: true,
    });
    this.searchInput = dialog.getByPlaceholder(LABELS.search);
    this.subTabs = dialog.getByRole('tablist', {
      name: LABELS.connectors,
      exact: true,
    });
    this.featuredTab = this.subTabs.getByTestId('mcp-tab-featured');
    this.directoryTab = this.subTabs.getByTestId('mcp-tab-custom');
    this.connectorsHeading = dialog.getByRole('heading', {
      name: LABELS.connectors,
      exact: true,
      level: 3,
    });
    this.emptyState = dialog.getByText(LABELS.noConnectors, { exact: true });
    this.addDialog = page.getByRole('dialog', {
      name: LABELS.addDialog,
      exact: true,
    });
    this.configureDialog = page.getByRole('dialog', {
      name: LABELS.configureDialog,
      exact: true,
    });
    this.removeDialog = page.getByRole('dialog', {
      name: LABELS.removeDialog,
      exact: true,
    });
  }

  /** A connector's card: a group named after the connector. */
  card(serverId: number): Locator {
    return this.dialog.getByTestId(`mcp-connector-${serverId}`);
  }

  /** The card's one switch: on/off for this agent. */
  toggle(serverId: number): Locator {
    return this.card(serverId).getByTestId(`mcp-connector-toggle-${serverId}`);
  }

  /** The card's gear. */
  configureButton(serverId: number): Locator {
    return this.card(serverId).getByTestId(
      `mcp-connector-configure-${serverId}`,
    );
  }

  /** The card's bin. */
  deleteButton(serverId: number): Locator {
    return this.card(serverId).getByTestId(`mcp-connector-delete-${serverId}`);
  }

  /** A Radix select inside `dialog`, found by the value it shows. */
  select(dialog: Locator, showing: string): Locator {
    return dialog
      .getByRole('combobox')
      .filter({ hasText: new RegExp(`^${showing}$`) });
  }

  /** The form's "Allow Users to Turn Off" switch. */
  userCanDisableSwitch(dialog: Locator): Locator {
    return dialog.getByTestId('connector-user-can-disable');
  }

  /**
   * Reaches the list that holds the organization's own connectors: through
   * the Directory sub-tab when something is featured, otherwise the single
   * Connectors list. Which one shows is settled at the tab's first render
   * and never swaps, so it is safe to read once the tab has painted.
   */
  async showDirectory(): Promise<void> {
    const { LABELS } = McpTab;
    await expect(this.addConnectorButton).toBeVisible({ timeout: 30_000 });
    await expect(this.subTabs.or(this.connectorsHeading).first()).toBeVisible({
      timeout: 30_000,
    });
    if (await this.subTabs.isVisible()) {
      await expect(this.featuredTab).toHaveText(LABELS.featured);
      await expect(this.directoryTab).toHaveText(LABELS.directory);
      await this.directoryTab.click();
      await expect(this.directoryTab).toHaveAttribute('data-state', 'active');
    } else {
      await expect(this.connectorsHeading).toBeVisible();
    }
  }

  /**
   * Narrows the list to one connector by its unique name, so the card is on
   * the first page however many connectors the organization has, and waits
   * for it.
   */
  async findCard(serverId: number, name: string): Promise<Locator> {
    await this.showDirectory();
    await this.searchInput.fill(name);
    const card = this.card(serverId);
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card).toHaveAccessibleName(name);
    return card;
  }

  /** Switches the connector on or off for this agent and waits for the save. */
  async setEnabled(
    serverId: number,
    name: string,
    enabled: boolean,
  ): Promise<void> {
    const { LABELS } = McpTab;
    const toggle = this.toggle(serverId);
    await expect(toggle).toHaveAttribute('aria-checked', String(!enabled));
    const saved = this.page.waitForResponse(
      (res) => isCall(res, 'PUT', MENTOR_SETTINGS_PATH),
      { timeout: 30_000 },
    );
    await toggle.click();
    const response = await saved;
    expect(
      response.ok(),
      `saving the agent's connectors returned HTTP ${response.status()}`,
    ).toBe(true);
    const body = response.request().postDataJSON() as {
      mcp_servers?: number[];
      tool_slugs?: string[];
    };
    if (enabled) {
      expect(body.mcp_servers).toContain(serverId);
      expect(body.tool_slugs).toContain('mcp');
    } else {
      expect(body.mcp_servers ?? []).not.toContain(serverId);
    }
    await this.expectToast(
      enabled ? LABELS.onToast(name) : LABELS.offToast(name),
    );
    await expect(toggle).toHaveAttribute('aria-checked', String(enabled));
    await expect(toggle).toHaveAccessibleName(
      `${name} ${enabled ? LABELS.enabled : LABELS.disabled}`,
    );
  }

  async openAdd(): Promise<Locator> {
    await expect(this.addConnectorButton).toBeVisible({ timeout: 30_000 });
    await this.addConnectorButton.click();
    await expect(this.addDialog).toBeVisible({ timeout: 10_000 });
    return this.addDialog;
  }

  async openConfigure(serverId: number): Promise<Locator> {
    const gear = this.configureButton(serverId);
    await expect(gear).toHaveAccessibleName(McpTab.LABELS.configure);
    await gear.click();
    await expect(this.configureDialog).toBeVisible({ timeout: 10_000 });
    return this.configureDialog;
  }

  /**
   * Adds a no-authentication connector through the form. The SDK creates the
   * server, then attaches it to the agent with the `mcp` tool, then closes
   * the form. Returns the server with what its cleanup needs, read from the
   * app's own create request.
   */
  async addConnector(name: string, url: string): Promise<CreatedMcpServer> {
    const { LABELS } = McpTab;
    const dialog = await this.openAdd();
    await dialog.getByPlaceholder(LABELS.namePlaceholder).fill(name);
    await dialog.getByPlaceholder(LABELS.serverPlaceholder).fill(url);
    const submit = dialog.getByRole('button', {
      name: LABELS.connect,
      exact: true,
    });
    await expect(submit).toBeEnabled({ timeout: 5_000 });
    const created = this.page.waitForResponse(
      (res) => isCall(res, 'POST', MCP_SERVER_LIST_PATH),
      { timeout: 30_000 },
    );
    const attached = this.page.waitForResponse(
      (res) => isCall(res, 'PUT', MENTOR_SETTINGS_PATH),
      { timeout: 30_000 },
    );
    await submit.click();
    const response = await created;
    expect(
      response.ok(),
      `creating the connector returned HTTP ${response.status()}`,
    ).toBe(true);
    const server = (await response.json()) as { id: number };
    const authorization = response.request().headers()['authorization'];
    expect(authorization, 'the app sent its token').toBeTruthy();
    await this.expectToast(LABELS.addedToast(name));
    const attach = await attached;
    expect(
      attach.ok(),
      `attaching the new connector returned HTTP ${attach.status()}`,
    ).toBe(true);
    await expect(dialog).toBeHidden({ timeout: 30_000 });
    return {
      id: server.id,
      deleteUrl: `${response.url()}${server.id}/`,
      authorization,
    };
  }

  /** Deletes the connector through its bin and the confirmation, and waits for the delete. */
  async remove(serverId: number, name: string): Promise<void> {
    const { LABELS } = McpTab;
    const bin = this.deleteButton(serverId);
    await expect(bin).toHaveAccessibleName(LABELS.delete);
    await bin.click();
    await expect(this.removeDialog).toBeVisible({ timeout: 10_000 });
    await expect(this.removeDialog).toContainText(name);
    const deleted = this.page.waitForResponse(
      (res) => isCall(res, 'DELETE', new RegExp(`/mcp-servers/${serverId}/$`)),
      { timeout: 30_000 },
    );
    await this.removeDialog
      .getByRole('button', { name: LABELS.delete, exact: true })
      .click();
    const response = await deleted;
    expect(
      response.ok(),
      `deleting the connector returned HTTP ${response.status()}`,
    ).toBe(true);
    await this.expectToast(LABELS.removedToast(name));
    await expect(this.removeDialog).toBeHidden({ timeout: 15_000 });
    await expect(this.card(serverId)).toHaveCount(0, { timeout: 30_000 });
  }

  /** Success toasts are the authoritative signal that a mutation landed. */
  async expectToast(text: string, timeout = 30_000): Promise<void> {
    await expect(
      this.page.getByText(text, { exact: true }).first(),
    ).toBeVisible({ timeout });
  }
}
