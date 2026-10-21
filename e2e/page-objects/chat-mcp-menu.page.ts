import { Page, Locator, Response, expect } from '@playwright/test';
import {
  MCP_SERVER_LIST_PATH,
  type CreatedMcpServer,
} from '../utils/mcp-servers';
import { ChatPage } from './chat.page';

export const MENTOR_SETTINGS_PATH = /\/mentors\/([^/]+)\/settings\/$/;
/** The user's on/off for a server in one conversation (guide §5.13). */
export const MCP_SESSION_PREFERENCE_PATH =
  /\/mcp-servers\/(\d+)\/session-preference\/$/;

export interface McpRbacActions {
  list?: boolean;
  create?: boolean;
}

export interface McpRbacPatch {
  /** `/mentors/{dbId}/mcpservers/`: browse (list) and add (create) for this agent. */
  agent?: McpRbacActions;
  /** `/mcpservers/`: add (create) tenant-wide. */
  tenant?: McpRbacActions;
}

const isCall = (res: Response, method: string, path: RegExp) =>
  res.request().method() === method && path.test(new URL(res.url()).pathname);

const isFocused = (locator: Locator) =>
  locator.evaluate((el) => el === document.activeElement).catch(() => false);

/**
 * The composer "+" menu's MCP row and the MCP panel it opens (SDK
 * `ComposerPlusMenu` → `McpServersMenu`, `chat-input-form/composer-plus-menu.tsx`).
 * On desktop the panel is a popover beside the menu (`composer-mcp-popover`);
 * on phones it is a page of the "+" bottom sheet. Like Memory, the row only
 * exists while the "+" menu is open, so every path here goes through
 * `ChatPage.openPlusMenu()`. Every panel element is resolved from the panel
 * root, never from the page.
 */
export class ChatMcpMenuPage {
  static readonly LABELS = {
    row: 'MCP',
    heading: 'MCP',
    /** The "+" trigger keeps its historical accessible name. */
    plusMenu: 'Attach file',
    searchPlaceholder: 'Search MCP',
    add: 'Add Connector',
    close: 'Close',
    connect: 'Connect',
    disconnect: 'Disconnect',
    featuredTab: 'Featured Connectors',
    customTab: 'Connectors',
    userScope: 'User',
    noSearchMatch: 'No connectors found matching your search.',
    failedToLoad: 'Failed to load featured connectors',
    retry: 'Retry',
    addConnectorDialog: 'Add MCP Connector',
    connectorNamePlaceholder: 'Enter connector name',
    connectorServerPlaceholder: 'https://api.example.com/mcp',
    thisAgentScope: 'This Agent',
    connectorSubmit: 'Connect',
    editConnectorDialog: 'Edit MCP Connector',
    connectorUpdate: 'Update',
    removeConnectorDialog: 'Remove Connector',
    removeConfirm: 'Delete',
  } as const;

  readonly page: Page;
  readonly chat: ChatPage;
  /** The "+" trigger (`composer-plus-button`). */
  readonly plusMenuButton: Locator;
  /** The MCP row inside the OPEN "+" menu (desktop dropdown or phone sheet). */
  readonly row: Locator;
  readonly menu: Locator;
  /** The popover (desktop) or sheet (phones) around the panel: what has to fit the viewport. */
  readonly panel: Locator;
  readonly heading: Locator;
  readonly search: Locator;
  readonly addButton: Locator;
  readonly closeButton: Locator;
  readonly emptyState: Locator;
  readonly loadError: Locator;
  readonly rows: Locator;
  readonly toggles: Locator;
  readonly featuredTab: Locator;
  readonly customTab: Locator;
  readonly addConnectorDialog: Locator;
  readonly editConnectorDialog: Locator;

  readonly createdServers: CreatedMcpServer[] = [];
  rbacPatchCount = 0;

  constructor(page: Page) {
    const { LABELS } = ChatMcpMenuPage;
    this.page = page;
    this.chat = new ChatPage(page);
    this.plusMenuButton = this.chat.plusMenuButton;
    this.row = this.openPlusMenu()
      .getByTestId('chat-mcp-button')
      .filter({ hasText: new RegExp(`^${LABELS.row}$`) });
    this.menu = page.getByTestId('mcp-servers-menu');
    this.panel = page.getByRole('dialog').filter({ has: this.menu });
    this.heading = this.menu.getByRole('heading', {
      name: LABELS.heading,
      exact: true,
      level: 3,
    });
    this.search = this.menu.getByTestId('mcp-servers-search');
    this.addButton = this.menu.getByTestId('mcp-servers-add');
    this.closeButton = this.menu.getByTestId('mcp-servers-close');
    this.emptyState = this.menu.getByTestId('mcp-servers-empty');
    this.loadError = this.menu.getByRole('alert');
    this.rows = this.menu.locator('[data-testid^="mcp-server-row-"]');
    this.toggles = this.menu.locator('[data-testid^="mcp-server-toggle-"]');
    this.featuredTab = this.menu.getByRole('tab', {
      name: LABELS.featuredTab,
      exact: true,
    });
    this.customTab = this.menu.getByRole('tab', {
      name: LABELS.customTab,
      exact: true,
    });
    this.addConnectorDialog = page.getByRole('dialog', {
      name: LABELS.addConnectorDialog,
      exact: true,
    });
    this.editConnectorDialog = page.getByRole('dialog', {
      name: LABELS.editConnectorDialog,
      exact: true,
    });
  }

  /** Clock + worker + random part, so parallel workers never collide. */
  static uniqueServerName(parallelIndex: number): string {
    const rand = Math.random().toString(36).substring(2, 7);
    return `e2e-mcp-${Date.now()}-${parallelIndex}-${rand}`;
  }

  /** The desktop "+" dropdown's OPEN content. */
  plusMenuContent(): Locator {
    return this.page.locator(
      '[data-testid="composer-plus-menu"][data-state="open"]',
    );
  }

  /** The phone "+" sheet's OPEN content (any page). */
  plusMenuSheet(): Locator {
    return this.page.locator(
      '[data-testid="composer-plus-sheet"][data-state="open"]',
    );
  }

  /** Whichever "+" surface is open — the two are exclusive by viewport. */
  openPlusMenu(): Locator {
    return this.plusMenuContent().or(this.plusMenuSheet());
  }

  serverRow(serverId: number): Locator {
    return this.menu.getByTestId(`mcp-server-row-${serverId}`);
  }

  /**
   * The on/off for this chat: shown on every server the agent uses (locked when the
   * server is required by the organization).
   */
  serverToggle(serverId: number): Locator {
    return this.menu.getByTestId(`mcp-server-session-toggle-${serverId}`);
  }

  /** The manager-only switch that attaches a server the agent does not use yet. */
  attachToggle(serverId: number): Locator {
    return this.menu.getByTestId(`mcp-server-toggle-${serverId}`);
  }

  connectButton(serverId: number): Locator {
    return this.menu.getByTestId(`mcp-server-connect-${serverId}`);
  }

  /** The tappable name of a row; only rendered when the user may edit the server. */
  editButton(serverId: number): Locator {
    return this.menu.getByTestId(`mcp-server-edit-${serverId}`);
  }

  /** Only rendered when the user may delete the server. */
  deleteButton(serverId: number): Locator {
    return this.menu.getByTestId(`mcp-server-delete-${serverId}`);
  }

  disconnectButton(serverId: number): Locator {
    return this.menu.getByTestId(`mcp-server-disconnect-${serverId}`);
  }

  /** Opens the "+" menu and chooses its MCP row. */
  async openFromPlusMenu(): Promise<void> {
    await this.chat.openPlusMenu();
    await expect(this.row).toBeVisible({ timeout: 10_000 });
    await this.row.click();
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
  }

  /** "+" via Enter, End to the MCP row (always the last one), Enter. */
  async openByKeyboard(): Promise<void> {
    await this.plusMenuButton.focus();
    await this.page.keyboard.press('Enter');
    await expect(this.plusMenuContent()).toBeVisible({ timeout: 5_000 });
    // Radix moves focus into the menu after it paints; End pressed earlier
    // lands on the trigger and does nothing.
    await expect
      .poll(() =>
        this.plusMenuContent().evaluate((el) =>
          el.contains(document.activeElement),
        ),
      )
      .toBe(true);
    await this.page.keyboard.press('End');
    await expect(this.row).toBeFocused();
    await this.page.keyboard.press('Enter');

    // The dropdown closes (its focus trap would cover the panel) and the
    // panel itself takes focus, so Tab reaches the search box.
    await expect(this.plusMenuContent()).toBeHidden({ timeout: 5_000 });
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
    await expect
      .poll(() =>
        this.panel.evaluate((el) => el.contains(document.activeElement)),
      )
      .toBe(true);
  }

  async tabTo(target: Locator, maxPresses = 6): Promise<void> {
    for (let i = 0; i < maxPresses && !(await isFocused(target)); i++) {
      await this.page.keyboard.press('Tab');
    }
    await expect(target).toBeFocused();
  }

  /** Opens the panel unless it is already showing. */
  async open(): Promise<void> {
    if (await this.heading.isVisible()) return;
    await expect(this.plusMenuButton).toBeVisible({ timeout: 30_000 });
    // Retried: right after the Add MCP Connector dialog closes, a click can
    // land while the popover is still tearing down and get swallowed.
    await expect(async () => {
      if (await this.heading.isVisible()) return;
      await this.openFromPlusMenu();
    }).toPass({ timeout: 30_000 });
  }

  /** The panel's own close: back to the composer (desktop) or the sheet's main page (phones). */
  async close(): Promise<void> {
    await this.closeButton.click();
    await expect(this.menu).toBeHidden({ timeout: 10_000 });
  }

  async expectPanelInViewport(): Promise<void> {
    await this.panel.evaluate((el) =>
      Promise.all(el.getAnimations().map((animation) => animation.finished)),
    );
    const viewport = this.page.viewportSize();
    const box = await this.panel.boundingBox();
    expect(viewport, 'the page has a fixed viewport').not.toBeNull();
    expect(box, 'the MCP panel has a layout box').not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
  }

  /** Servers added through Add Connector are custom ones; the panel opens on Featured Connectors. */
  async showCustomServers(): Promise<void> {
    await this.customTab.click();
    await expect(this.customTab).toHaveAttribute('data-state', 'active');
  }

  /**
   * Searches for `name` and returns its row. Scrolls the list while the row
   * is still missing, in case the panel loads servers page by page.
   */
  async revealServer(name: string): Promise<Locator> {
    await this.showCustomServers();
    await this.search.fill(name);
    const row = this.rows.filter({ hasText: name });
    await expect(async () => {
      if (await row.isVisible()) return;
      if ((await this.rows.count()) > 0) {
        await this.rows.last().scrollIntoViewIfNeeded();
      }
      await expect(row).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    return row;
  }

  /**
   * Deletes the server through its trash icon and the shared "Remove Connector"
   * confirmation (the agent settings MCP tab's dialog), waiting for the DELETE.
   */
  async deleteServer(serverId: number): Promise<void> {
    const { LABELS } = ChatMcpMenuPage;
    await this.deleteButton(serverId).click();
    const dialog = this.page.getByRole('dialog', {
      name: LABELS.removeConnectorDialog,
      exact: true,
    });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    const deleted = this.page.waitForResponse(
      (res) =>
        res.request().method() === 'DELETE' &&
        new URL(res.url()).pathname.endsWith(`/mcp-servers/${serverId}/`),
      { timeout: 30_000 },
    );
    await dialog
      .getByRole('button', { name: LABELS.removeConfirm, exact: true })
      .click();
    const response = await deleted;
    expect(
      response.ok(),
      `deleting the MCP server returned HTTP ${response.status()}`,
    ).toBe(true);
    await expect(dialog).toBeHidden({ timeout: 30_000 });
  }

  /**
   * Taps the server's name, which opens the shared "Edit MCP Connector" dialog
   * prefilled with it, renames it and saves (PUT on the server).
   */
  async renameServer(
    serverId: number,
    currentName: string,
    newName: string,
  ): Promise<void> {
    const { LABELS } = ChatMcpMenuPage;
    await this.editButton(serverId).click();
    const dialog = this.editConnectorDialog;
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    const nameField = dialog.getByPlaceholder(LABELS.connectorNamePlaceholder, {
      exact: true,
    });
    await expect(nameField).toHaveValue(currentName);
    await nameField.fill(newName);

    const updated = this.page.waitForResponse(
      (res) =>
        ['PUT', 'PATCH'].includes(res.request().method()) &&
        new URL(res.url()).pathname.endsWith(`/mcp-servers/${serverId}/`),
      { timeout: 30_000 },
    );
    await dialog
      .getByRole('button', { name: LABELS.connectorUpdate, exact: true })
      .click();
    const response = await updated;
    expect(
      response.ok(),
      `updating the MCP server returned HTTP ${response.status()}`,
    ).toBe(true);
    await expect(dialog).toBeHidden({ timeout: 30_000 });
  }

  /**
   * Creates a no-auth server scoped to this agent through Add Connector (the
   * shared `ConnectorDialogs` "Add MCP Connector" dialog), checks it was
   * auto-attached to the same agent, and returns its id.
   */
  async addServer(name: string, serverUrl: string): Promise<number> {
    const { LABELS } = ChatMcpMenuPage;
    await this.addButton.click();
    const dialog = this.addConnectorDialog;
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    await dialog
      .getByPlaceholder(LABELS.connectorNamePlaceholder, { exact: true })
      .fill(name);
    await dialog
      .getByPlaceholder(LABELS.connectorServerPlaceholder, { exact: true })
      .fill(serverUrl);
    await dialog
      .getByRole('radio', { name: LABELS.thisAgentScope, exact: true })
      .click();

    const created = this.page.waitForResponse(
      (res) => isCall(res, 'POST', MCP_SERVER_LIST_PATH),
      { timeout: 30_000 },
    );
    let attachSettled = false;
    const attached = this.page
      .waitForResponse((res) => isCall(res, 'PUT', MENTOR_SETTINGS_PATH), {
        timeout: 60_000,
      })
      .then((res) => {
        attachSettled = true;
        return res;
      });
    // Awaited later; without this an early failure leaves it to reject
    // unhandled once the page closes.
    attached.catch(() => undefined);
    await dialog
      .getByRole('button', { name: LABELS.connectorSubmit, exact: true })
      .click();
    // data-state flips to "closed" as soon as closing starts; waiting for the
    // exit animation to finish could let a fast attach land first.
    const dialogClosed = dialog
      .and(this.page.locator('[data-state="open"]'))
      .waitFor({ state: 'hidden', timeout: 60_000 })
      .then(
        () => (attachSettled ? 'after attach' : 'before attach'),
        () => 'never',
      );

    const createResponse = await created;
    expect(
      createResponse.ok(),
      `creating the MCP server returned HTTP ${createResponse.status()}`,
    ).toBe(true);
    const { id } = (await createResponse.json()) as { id: number };
    const headers = await createResponse.request().allHeaders();
    this.createdServers.push({
      id,
      deleteUrl: new URL(`${id}/`, createResponse.url()).toString(),
      authorization: headers.authorization ?? '',
    });

    const attachResponse = await attached;
    expect(
      attachResponse.ok(),
      `attaching the MCP server to the agent returned HTTP ${attachResponse.status()}`,
    ).toBe(true);
    const agentId = MENTOR_SETTINGS_PATH.exec(
      new URL(attachResponse.url()).pathname,
    )?.[1];
    const { mentor } = createResponse.request().postDataJSON() as {
      mentor?: string | null;
    };
    expect(mentor, 'the server is scoped to the agent it is added on').toBe(
      agentId,
    );
    const { mcp_servers: attachedIds } = attachResponse
      .request()
      .postDataJSON() as { mcp_servers?: number[] };
    expect(attachedIds).toContain(id);

    // The MCP tab keeps the dialog on "Saving..." until the save resolves;
    // closing earlier reads as done before the server is even attached.
    expect(
      await dialogClosed,
      'when the Add MCP Connector dialog closed, relative to the agent attach',
    ).toBe('after attach');
    return id;
  }

  /** Switches the server on or off for this chat and waits for the session preference save. */
  async setServerEnabled(serverId: number, enabled: boolean): Promise<void> {
    const toggle = this.serverToggle(serverId);
    await expect(toggle).toHaveAttribute('aria-checked', String(!enabled));
    const saved = this.page.waitForResponse(
      (res) =>
        isCall(res, 'PUT', MCP_SESSION_PREFERENCE_PATH) &&
        MCP_SESSION_PREFERENCE_PATH.exec(new URL(res.url()).pathname)?.[1] ===
          String(serverId),
      { timeout: 30_000 },
    );
    await toggle.click();
    const response = await saved;
    expect(
      response.ok(),
      `saving the server's on/off for this chat returned HTTP ${response.status()}`,
    ).toBe(true);
    const { is_enabled: sent, session_id: sessionId } = response
      .request()
      .postDataJSON() as { is_enabled?: boolean; session_id?: string };
    expect(sent).toBe(enabled);
    expect(sessionId, 'the save names the open conversation').toBeTruthy();
    await expect(toggle).toHaveAttribute('aria-checked', String(enabled));
  }

  /**
   * Serves the REAL RBAC permissions-check response with the MCP-servers
   * actions in `patch` forced, adding an entry the response left out. Must
   * be registered before the navigation that runs the check.
   */
  async patchRbac(patch: McpRbacPatch): Promise<void> {
    await this.page.route(
      (url) => url.pathname.includes('/api/core/rbac/permissions/check'),
      async (route) => {
        const response = await route.fetch();
        let json: Record<string, unknown>;
        try {
          json = await response.json();
        } catch {
          await route.fulfill({ response });
          return;
        }
        let requested: string[] = [];
        try {
          requested = route.request().postDataJSON()?.resources ?? [];
        } catch {
          requested = [];
        }
        for (const resource of requested) {
          const actions = /^\/mentors\/[^/]+\/mcpservers\/$/.test(resource)
            ? patch.agent
            : resource === '/mcpservers/'
              ? patch.tenant
              : undefined;
          if (!actions) continue;
          const entry = json[resource];
          json[resource] = {
            ...(entry && typeof entry === 'object' ? entry : {}),
            ...actions,
          };
          this.rbacPatchCount++;
        }
        await route.fulfill({ response, json });
      },
    );
  }

  async denyBrowse(): Promise<void> {
    await this.patchRbac({ agent: { list: false } });
  }

  async denyAdd(): Promise<void> {
    await this.patchRbac({
      agent: { create: false },
      tenant: { create: false },
    });
  }

  async waitForRbacPatch(): Promise<void> {
    await expect
      .poll(() => this.rbacPatchCount, { timeout: 60_000 })
      .toBeGreaterThan(0);
  }

  /** Register before navigating: resolves once the agent's settings load. */
  waitForMentorSettings(): Promise<Response> {
    return this.page.waitForResponse(
      (res) =>
        res.request().method() === 'GET' &&
        res.ok() &&
        /\/mentors\/[^/]+\/(public-)?settings\/$/.test(
          new URL(res.url()).pathname,
        ),
      { timeout: 60_000 },
    );
  }

  /**
   * With the "+" menu open: a non-waiting count, sampled over `windowMs`.
   * `toHaveCount(0)` alone passes at once, before a late re-render could add
   * the row.
   */
  async expectRowStaysAbsent(windowMs = 3_000): Promise<void> {
    await expect(this.openPlusMenu()).toBeVisible();
    const until = Date.now() + windowMs;
    do {
      expect(await this.row.count(), 'the MCP row rendered').toBe(0);
      await this.page.waitForTimeout(250);
    } while (Date.now() < until);
  }
}
