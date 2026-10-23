import { Page, Locator, Response, expect } from '@playwright/test';
import { type CreatedMcpServer } from '../utils/mcp-servers';
import { getPlatformContext } from '../utils/auth';
import { knownDmBase, observeDmBase, resolveDmApiBase } from '../utils/dm-api';
import { ChatPage } from './chat.page';

export const MENTOR_SETTINGS_PATH = /\/mentors\/([^/]+)\/settings\/$/;
/** The user's on/off for a server in one conversation (guide §5.13). */
export const MCP_SESSION_PREFERENCE_PATH =
  /\/mcp-servers\/(\d+)\/session-preference\/$/;

const isCall = (res: Response, method: string, path: RegExp) =>
  res.request().method() === method && path.test(new URL(res.url()).pathname);

const isFocused = (locator: Locator) =>
  locator.evaluate((el) => el === document.activeElement).catch(() => false);

interface ApiContext {
  agentId: string;
  serversUrl: string;
  settingsUrl: string;
  headers: { Authorization: string };
}

/**
 * The composer "+" menu's MCP row and the MCP panel it opens (SDK
 * `ComposerPlusMenu` → `McpServersMenu`, `chat-input-form/composer-plus-menu.tsx`).
 * On desktop the panel is a popover beside the menu (`composer-mcp-popover`);
 * on phones it is a page of the "+" bottom sheet. The panel lists only the
 * servers the agent uses, each with the person's on/off for this chat and,
 * for a per-user OAuth server they have not signed in to, Connect; servers
 * are added and attached in the agent settings MCP tab, so the fixtures here
 * create and attach them through the API. The row is offered only while the
 * agent uses at least one server (`useMcpActiveCount`), and, like Memory,
 * only exists while the "+" menu is open, so every path here goes through
 * `ChatPage.openPlusMenu()`. Every panel element is resolved from the panel
 * root, never from the page.
 */
export class ChatMcpMenuPage {
  static readonly LABELS = {
    row: 'MCP',
    /** The row's badge reads "{count} on"; the row's name is then "MCP 1 on". */
    oneOn: '1 on',
    heading: 'MCP',
    /** The "+" trigger keeps its historical accessible name. */
    plusMenu: 'Attach file',
    close: 'Close',
    connect: 'Connect',
    sessionDescription:
      'Switches here apply to this chat only, from your next message.',
    nothingOn: 'Nothing is on for this agent yet.',
    failedToLoad: 'Failed to load connectors',
    retry: 'Retry',
    /** The explainer's title: "Sign in to {name}". */
    signInTo: 'Sign in to',
    /** Part of the explainer's per-user wording. */
    ownAccount: 'with your own account',
    explainerContinue: 'Continue',
    /** "{name} isn't set up for sign-in yet. Ask your administrator." */
    notSetUp: "isn't set up for sign-in yet. Ask your administrator.",
  } as const;

  readonly page: Page;
  readonly chat: ChatPage;
  /** The "+" trigger (`composer-plus-button`). */
  readonly plusMenuButton: Locator;
  /** The MCP row inside the OPEN "+" menu (desktop dropdown or phone sheet). */
  readonly row: Locator;
  /** The row's count of servers on for this chat; absent at zero. */
  readonly rowBadge: Locator;
  /** Every row of the OPEN desktop "+" menu, in order (MCP is the last one). */
  readonly menuItems: Locator;
  readonly menu: Locator;
  /** The popover (desktop) or sheet (phones) around the panel: what has to fit the viewport. */
  readonly panel: Locator;
  readonly heading: Locator;
  readonly description: Locator;
  readonly closeButton: Locator;
  readonly emptyState: Locator;
  readonly loadError: Locator;
  readonly rows: Locator;

  readonly createdServers: CreatedMcpServer[] = [];

  constructor(page: Page) {
    const { LABELS } = ChatMcpMenuPage;
    this.page = page;
    this.chat = new ChatPage(page);
    observeDmBase(page);
    this.plusMenuButton = this.chat.plusMenuButton;
    this.row = this.openPlusMenu()
      .getByTestId('chat-mcp-button')
      .filter({ hasText: new RegExp(`^${LABELS.row}`) });
    this.rowBadge = this.row.getByTestId('composer-count-badge');
    this.menuItems = this.plusMenuContent().getByRole('menuitem');
    this.menu = page.getByTestId('mcp-servers-menu');
    this.panel = page.getByRole('dialog').filter({ has: this.menu });
    this.heading = this.menu.getByRole('heading', {
      name: LABELS.heading,
      exact: true,
      level: 3,
    });
    this.description = this.menu.getByText(LABELS.sessionDescription, {
      exact: true,
    });
    this.closeButton = this.menu.getByTestId('mcp-servers-close');
    this.emptyState = this.menu.getByTestId('mcp-servers-empty');
    this.loadError = this.menu.getByRole('alert');
    this.rows = this.menu.locator('[data-testid^="mcp-server-row-"]');
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

  /** The lock beside a required server's switch. */
  requiredLock(serverId: number): Locator {
    return this.menu.getByTestId(`mcp-server-required-${serverId}`);
  }

  /** Only on a per-user OAuth server the person has not signed in to. */
  connectButton(serverId: number): Locator {
    return this.menu.getByTestId(`mcp-server-connect-${serverId}`);
  }

  /** The "Sign in to {name}" explainer the first Connect opens. */
  explainerDialog(serverName: string): Locator {
    return this.page.getByRole('alertdialog', {
      name: `${ChatMcpMenuPage.LABELS.signInTo} ${serverName}`,
      exact: true,
    });
  }

  /** Opens the "+" menu and chooses its MCP row. */
  async openFromPlusMenu(): Promise<void> {
    await this.chat.openPlusMenu();
    await expect(this.row).toBeVisible({ timeout: 10_000 });
    await this.row.click();
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
  }

  /**
   * The OPEN "+" menu offers no MCP row: the agent uses no server. Judged
   * only once the menu has its rows, so a menu still painting cannot pass.
   */
  async expectRowAbsent(): Promise<void> {
    await expect(this.menuItems.first()).toBeVisible({ timeout: 10_000 });
    await expect(
      this.menuItems.filter({
        hasText: new RegExp(`^${ChatMcpMenuPage.LABELS.row}\\b`),
      }),
    ).toHaveCount(0);
    await expect(this.row).toHaveCount(0);
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
    // panel itself takes focus, so Tab reaches its Close button.
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
    // Retried: a click can land while a previous popover is still tearing
    // down and get swallowed.
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

  /** Presses Connect and, when the explainer shows, Continue; the sign-in then starts. */
  async connect(serverId: number, serverName: string): Promise<void> {
    await this.connectButton(serverId).click();
    const explainer = this.explainerDialog(serverName);
    await expect(explainer).toBeVisible({ timeout: 10_000 });
    await explainer.getByTestId('mcp-connect-explainer-continue').click();
  }

  /** The explainer is said once per user; this makes the next Connect show it again. */
  async forgetConnectExplainer(): Promise<void> {
    await this.page.evaluate(() => {
      Object.keys(localStorage)
        .filter((key) => key.startsWith('mcp_connect_explained:'))
        .forEach((key) => localStorage.removeItem(key));
    });
  }

  /**
   * Serves the agent's REAL settings with `servers` in `mcp_servers`, so a
   * mocked server counts as one the agent uses: an id, which the composer
   * resolves through the server list, or a row, which stands on its own when
   * the list is down. A real entry with the same id is replaced, never
   * doubled. Register before navigating (or reloading).
   */
  async mockAgentUsesServers(
    servers: Array<number | { id: number; name: string }>,
  ): Promise<void> {
    const idOf = (entry: unknown) =>
      typeof entry === 'number' ? entry : (entry as { id?: number })?.id;
    const given = new Set(servers.map(idOf));
    await this.page.route(
      (url) => MENTOR_SETTINGS_PATH.test(url.pathname),
      async (route) => {
        if (route.request().method() !== 'GET') return route.fallback();
        const response = await route.fetch();
        let json: Record<string, unknown>;
        try {
          json = await response.json();
        } catch {
          await route.fulfill({ response });
          return;
        }
        const attached = (
          Array.isArray(json.mcp_servers) ? json.mcp_servers : []
        ).filter((entry) => !given.has(idOf(entry)));
        await route.fulfill({
          response,
          json: { ...json, mcp_servers: [...attached, ...servers] },
        });
      },
    );
  }

  /**
   * Creates a no-auth server scoped to the open agent, the way the agent
   * settings MCP tab's Add Connector does, and returns its id. The `mcp`
   * fixture deletes it afterwards.
   */
  async createServer(
    name: string,
    options: { userCanDisable?: boolean } = {},
  ): Promise<number> {
    const { agentId, serversUrl, headers } = await this.api();
    const response = await this.page.request.post(serversUrl, {
      headers,
      data: {
        name,
        url: `https://${name}.example.com/mcp`,
        transport: 'streamable_http',
        auth_type: 'none',
        mentor: agentId,
        ...(options.userCanDisable !== undefined && {
          user_can_disable: options.userCanDisable,
        }),
      },
      timeout: 30_000,
    });
    expect(
      response.ok(),
      `creating the MCP server returned HTTP ${response.status()}`,
    ).toBe(true);
    const server = (await response.json()) as {
      id: number;
      user_can_disable?: boolean;
    };
    this.createdServers.push({
      id: server.id,
      deleteUrl: `${serversUrl}${server.id}/`,
      authorization: headers.Authorization,
    });
    if (options.userCanDisable !== undefined) {
      expect(
        server.user_can_disable,
        'the server is created with the requested user_can_disable',
      ).toBe(options.userCanDisable);
    }
    return server.id;
  }

  /**
   * Attaches servers to the open agent the way the MCP tab's switch does:
   * their ids join `mcp_servers`, and the agent's `mcp` tool comes on with
   * them. Reload the app afterwards so the composer reads the new settings.
   */
  async attachServers(ids: number[]): Promise<void> {
    const { settingsUrl, headers } = await this.api();
    const current = await this.page.request.get(settingsUrl, {
      headers,
      timeout: 30_000,
    });
    expect(
      current.ok(),
      `reading the agent settings returned HTTP ${current.status()}`,
    ).toBe(true);
    const settings = (await current.json()) as {
      mcp_servers?: Array<number | { id?: number }>;
      mentor_tools?: Array<{ slug?: string }>;
    };
    const attached = (settings.mcp_servers ?? [])
      .map((entry) => (typeof entry === 'number' ? entry : entry?.id))
      .filter((id): id is number => typeof id === 'number');
    const slugs = (settings.mentor_tools ?? [])
      .map((tool) => tool?.slug)
      .filter((slug): slug is string => typeof slug === 'string');
    const response = await this.page.request.put(settingsUrl, {
      headers,
      data: {
        mcp_servers: [...new Set([...attached, ...ids])],
        tool_slugs: slugs.includes('mcp') ? slugs : [...slugs, 'mcp'],
        can_use_tools: true,
      },
      timeout: 30_000,
    });
    expect(
      response.ok(),
      `attaching the MCP servers to the agent returned HTTP ${response.status()}`,
    ).toBe(true);
  }

  /** The app's own tenant, user, agent and token: the API the way it calls it. */
  private async api(): Promise<ApiContext> {
    const { tenantKey, mentorId: agentId } = await getPlatformContext(
      this.page,
    );
    const { dmToken, username } = await this.page.evaluate(() => {
      let username: string | null = null;
      try {
        const raw = localStorage.getItem('userData');
        if (raw) username = JSON.parse(raw)?.user_nicename ?? null;
      } catch {
        username = null;
      }
      return { dmToken: localStorage.getItem('dm_token'), username };
    });
    expect(dmToken, 'the app holds a DM token').toBeTruthy();
    expect(username, 'the app knows the signed-in user').toBeTruthy();
    const base =
      knownDmBase() ||
      (await resolveDmApiBase(this.page, { allowReload: false }));
    const users = `${base}/api/ai-mentor/orgs/${encodeURIComponent(tenantKey)}/users/${encodeURIComponent(username!)}`;
    return {
      agentId,
      serversUrl: `${users}/mcp-servers/`,
      settingsUrl: `${users}/mentors/${encodeURIComponent(agentId)}/settings/`,
      headers: { Authorization: `Token ${dmToken}` },
    };
  }
}
