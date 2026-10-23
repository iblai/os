import type { Page } from '@playwright/test';
import { test as base, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import {
  E2E_OAUTH_SERVICE,
  MCP_SERVER_LIST_PATH,
  deleteMcpServer,
  mockMcpServerConnections,
  mockMcpServerList,
  userConnection,
  userScopedOAuthServer,
} from '../utils/mcp-servers';
import { ChatMcpMenuPage } from '../page-objects/chat-mcp-menu.page';
import type { CreateMentorPage } from '../page-objects/create-mentor.page';

/**
 * Journey 94 — Chat MCP Servers (iblai/iblai-platform#2625).
 *
 * The composer's "+" menu (journey 79) gains an MCP row after Memory (SDK
 * `ComposerPlusMenu`), with a count of the servers on for this chat. The row
 * exists only while the agent uses at least one server (SDK
 * `useMcpActiveCount`: a server in the agent settings' `mcp_servers` that is
 * not switched off by the organization); an agent with none has no MCP row at
 * all. On desktop the row opens the SDK's `McpServersMenu` in a panel beside
 * the menu, on phones as a page of the "+" bottom sheet. The panel lists only
 * the servers the agent uses, gives each an on/off switch for this chat (the
 * user's session preference, iblai/iblai-platform#2725; a server the
 * organization requires shows a locked one) and, for a per-user OAuth server
 * the person has not signed in to, a Connect button whose first press explains
 * whose account the sign-in becomes. Adding, editing and attaching servers
 * live in the agent settings MCP tab, and the row needs no grant beyond
 * chatting.
 *
 * Every admin test runs on its own fresh agent, creates a server and attaches
 * it through the API (`ChatMcpMenuPage.createServer` / `attachServers`), and
 * the `mcp` fixture deletes every server it created. The non-admin tests
 * mock the server list and the agent's attachments: a non-admin can neither
 * create nor attach a server, and a real sign-in cannot be completed here.
 * No dedicated "mobile" project exists: the SDK's phone layout is a
 * `max-width: 767px` media query, so `page.setViewportSize` exercises it.
 */

const test = base.extend<{ mcp: ChatMcpMenuPage }>({
  // Fixture teardown, unlike a `finally` in the test body, still runs after
  // a test timeout.
  mcp: [
    async ({ page, request }, use) => {
      const mcp = new ChatMcpMenuPage(page);
      await use(mcp);
      for (const server of mcp.createdServers) {
        await deleteMcpServer(request, server);
      }
    },
    { scope: 'test' },
  ],
});

const PHONE_VIEWPORTS = [
  { width: 375, height: 667 },
  { width: 320, height: 568 },
];

/** The composer reads the agent's settings on load, so an API attach shows after a reload. */
const reloadApp = async (page: Page) => {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForPageReady(page);
};

interface AdminFixtures {
  page: Page;
  mcp: ChatMcpMenuPage;
  createMentorPage: CreateMentorPage;
}

/**
 * A fresh agent that uses one server, created by API and attached through the
 * agent settings API, reloaded so the "+" menu offers MCP. Returns the server id.
 */
const freshAgentWithServer = async (
  { page, mcp, createMentorPage }: AdminFixtures,
  options: { userCanDisable?: boolean } = {},
): Promise<number> => {
  await createMentorPage.openAndCreate();
  const serverId = await mcp.createServer(
    ChatMcpMenuPage.uniqueServerName(test.info().parallelIndex),
    options,
  );
  await mcp.attachServers([serverId]);
  await reloadApp(page);
  return serverId;
};

test.describe('Journey 94: Chat MCP Servers', () => {
  test.describe('admin', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToMentorApp(page);
      const isAdmin = await checkAdminStatus(page);
      test.skip(!isAdmin, 'Requires admin access');
    });

    test('chat-mcp-01: admin finds the MCP row last in the "+" menu of an agent that uses a server, opens the MCP panel from it, and closes it', async ({
      page,
      mcp,
      createMentorPage,
    }) => {
      test.setTimeout(240_000);
      await freshAgentWithServer({ page, mcp, createMentorPage });
      const { LABELS } = ChatMcpMenuPage;
      // "MCP" plus its badge, which reads "1 on" for the one attached server.
      const rowName = `${LABELS.row} ${LABELS.oneOn}`;

      await mcp.chat.openPlusMenu();
      await expect(mcp.row).toBeVisible({ timeout: 10_000 });
      await expect(mcp.row).toHaveAccessibleName(rowName);
      // Like Memory: just its one leading icon, no trailing chevron (Tools
      // and Skills, which open submenus, keep theirs).
      expect(await mcp.row.locator('svg').count()).toBe(1);
      await expect(mcp.menuItems.last()).toHaveAccessibleName(rowName);

      await mcp.row.click();
      await expect(mcp.heading).toBeVisible({ timeout: 10_000 });
      await expect(mcp.openPlusMenu()).toBeHidden();
      await expect(mcp.description).toBeVisible();
      await expect(mcp.closeButton).toHaveAccessibleName(LABELS.close);

      await mcp.close();
      await expect(mcp.plusMenuButton).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    });

    test('chat-mcp-02: on an agent that uses no server the "+" menu has no MCP row, and the row appears once a server is attached', async ({
      page,
      mcp,
      createMentorPage,
    }) => {
      test.setTimeout(240_000);
      await createMentorPage.openAndCreate();

      await mcp.chat.openPlusMenu();
      await mcp.expectRowAbsent();
      await mcp.chat.closePlusMenu();

      const serverId = await mcp.createServer(
        ChatMcpMenuPage.uniqueServerName(test.info().parallelIndex),
      );
      await mcp.attachServers([serverId]);
      await reloadApp(page);

      await mcp.chat.openPlusMenu();
      await expect(mcp.row).toBeVisible({ timeout: 10_000 });
      await expect(mcp.menuItems.last()).toHaveAccessibleName(
        `${ChatMcpMenuPage.LABELS.row} ${ChatMcpMenuPage.LABELS.oneOn}`,
      );
    });

    test('chat-mcp-03: the panel lists only the servers the agent uses, each switched on for this chat', async ({
      page,
      mcp,
      createMentorPage,
    }) => {
      test.setTimeout(240_000);
      await createMentorPage.openAndCreate();
      const index = test.info().parallelIndex;
      const usedName = ChatMcpMenuPage.uniqueServerName(index);
      const usedId = await mcp.createServer(usedName);
      const unusedId = await mcp.createServer(
        ChatMcpMenuPage.uniqueServerName(index),
      );
      await mcp.attachServers([usedId]);
      await reloadApp(page);

      await mcp.open();
      await expect(mcp.serverRow(usedId)).toContainText(usedName, {
        timeout: 15_000,
      });
      await expect(mcp.serverToggle(usedId)).toHaveAttribute(
        'aria-checked',
        'true',
      );
      await expect(mcp.serverRow(unusedId)).toHaveCount(0);
      await expect(mcp.rows).toHaveCount(1);
    });

    test('chat-mcp-04: the MCP row counts the servers on for this chat and drops the count when one is switched off', async ({
      page,
      mcp,
      createMentorPage,
    }) => {
      test.setTimeout(240_000);
      const serverId = await freshAgentWithServer({
        page,
        mcp,
        createMentorPage,
      });

      await mcp.chat.openPlusMenu();
      await expect(mcp.rowBadge).toHaveText('1', { timeout: 15_000 });

      await mcp.open();
      await mcp.setServerEnabled(serverId, false);
      await mcp.close();
      await mcp.chat.openPlusMenu();
      // The server is still attached, so the row stays; only its count goes.
      await expect(mcp.row).toBeVisible({ timeout: 15_000 });
      await expect(mcp.rowBadge).toHaveCount(0);

      await mcp.open();
      await mcp.setServerEnabled(serverId, true);
      await mcp.close();
      await mcp.chat.openPlusMenu();
      await expect(mcp.rowBadge).toHaveText('1', { timeout: 15_000 });
    });

    test('chat-mcp-05: admin switches a server off and back on for this chat and each state survives a reload', async ({
      page,
      mcp,
      createMentorPage,
    }) => {
      test.setTimeout(300_000);
      const serverId = await freshAgentWithServer({
        page,
        mcp,
        createMentorPage,
      });

      const reloadAndOpen = async () => {
        await mcp.close();
        await reloadApp(page);
        await mcp.open();
        await expect(mcp.serverRow(serverId)).toBeVisible({ timeout: 15_000 });
      };

      await mcp.open();
      await mcp.setServerEnabled(serverId, false);
      await reloadAndOpen();
      await expect(mcp.serverToggle(serverId)).toHaveAttribute(
        'aria-checked',
        'false',
      );

      await mcp.setServerEnabled(serverId, true);
      await reloadAndOpen();
      await expect(mcp.serverToggle(serverId)).toHaveAttribute(
        'aria-checked',
        'true',
      );
    });

    test('chat-mcp-06: a server the organization requires shows a locked switch that stays on', async ({
      page,
      mcp,
      createMentorPage,
    }) => {
      test.setTimeout(240_000);
      const serverId = await freshAgentWithServer(
        { page, mcp, createMentorPage },
        { userCanDisable: false },
      );

      await mcp.open();
      await expect(mcp.serverRow(serverId)).toBeVisible({ timeout: 15_000 });
      await expect(mcp.requiredLock(serverId)).toBeVisible();
      await expect(mcp.serverToggle(serverId)).toBeDisabled();
      await expect(mcp.serverToggle(serverId)).toHaveAttribute(
        'aria-checked',
        'true',
      );
    });

    test('chat-mcp-08: the MCP panel fits the screen beside the desktop "+" menu and as a page of the phone sheet', async ({
      page,
      mcp,
      createMentorPage,
    }) => {
      test.setTimeout(300_000);
      await freshAgentWithServer({ page, mcp, createMentorPage });

      await mcp.open();
      await mcp.expectPanelInViewport();
      await mcp.close();

      for (const viewport of PHONE_VIEWPORTS) {
        await page.setViewportSize(viewport);
        await reloadApp(page);
        await mcp.chat.openPlusMenu();
        await expect(mcp.plusMenuSheet()).toBeVisible({ timeout: 5_000 });
        await mcp.row.click();
        await expect(mcp.heading).toBeVisible({ timeout: 10_000 });
        await expect(mcp.plusMenuSheet()).toContainText(
          ChatMcpMenuPage.LABELS.heading,
        );
        await expect(mcp.description).toBeVisible();
        await mcp.expectPanelInViewport();
        // The panel's close returns to the sheet's main page; Escape closes the sheet.
        await mcp.close();
        await expect(mcp.plusMenuSheet()).toBeVisible();
        await mcp.chat.closePlusMenu();
      }

      await page.setViewportSize({ width: 1280, height: 800 });
    });

    test('chat-mcp-09: keyboard users open MCP from the "+" menu, land on the MCP panel, and Escape closes it', async ({
      page,
      mcp,
      createMentorPage,
    }) => {
      test.setTimeout(240_000);
      await freshAgentWithServer({ page, mcp, createMentorPage });
      await expect(mcp.plusMenuButton).toBeVisible({ timeout: 30_000 });

      await mcp.openByKeyboard();
      await mcp.tabTo(mcp.closeButton);

      await page.keyboard.press('Escape');
      await expect(mcp.menu).toBeHidden({ timeout: 10_000 });
    });

    test('chat-mcp-13: when the server list fails to load the panel says so and Retry loads it', async ({
      page,
      mcp,
      createMentorPage,
    }) => {
      test.setTimeout(300_000);
      const { LABELS } = ChatMcpMenuPage;
      await createMentorPage.openAndCreate();
      const serverName = ChatMcpMenuPage.uniqueServerName(
        test.info().parallelIndex,
      );
      const serverId = await mcp.createServer(serverName);
      await mcp.attachServers([serverId]);
      // The MCP row needs the agent's attachments to resolve to rows, and with
      // the list down only the settings can provide one: `attachedMcpServers`
      // merges the settings' `mcp_servers` rows with the list and drops an id
      // that has neither. Serving the attached server as a settings row keeps
      // the row offered whether the API sends ids or rows.
      await mcp.mockAgentUsesServers([{ id: serverId, name: serverName }]);
      let failing = true;
      await page.route(
        (url) => MCP_SERVER_LIST_PATH.test(url.pathname),
        (route) =>
          failing && route.request().method() === 'GET'
            ? route.fulfill({ status: 500, json: { detail: 'e2e failure' } })
            : route.fallback(),
      );
      await reloadApp(page);

      await mcp.open();
      await expect(mcp.loadError).toContainText(LABELS.failedToLoad, {
        timeout: 30_000,
      });

      failing = false;
      await mcp.loadError
        .getByRole('button', { name: LABELS.retry, exact: true })
        .click();
      await expect(mcp.loadError).toBeHidden({ timeout: 15_000 });
      await expect(mcp.serverRow(serverId)).toContainText(serverName, {
        timeout: 15_000,
      });
    });
  });

  test('chat-mcp-07: non-admin finds the MCP row in the "+" menu of an agent that uses a server and opens the panel', async ({
    nonadminPage,
  }) => {
    // A non-admin can neither create nor attach a server, so the agent's use
    // of one is mocked the way the OAuth tests do; opening the panel then
    // needs no grant beyond chatting.
    const server = userScopedOAuthServer(990_007, 'E2E Mock Chat Server');
    const mcp = new ChatMcpMenuPage(nonadminPage);
    await mockMcpServerList(nonadminPage, [server]);
    await mcp.mockAgentUsesServers([server.id]);
    await navigateToMentorApp(nonadminPage);

    await mcp.openFromPlusMenu();
    await expect(mcp.description).toBeVisible();
    await expect(mcp.closeButton).toBeVisible();
    await expect(mcp.serverRow(server.id)).toContainText(server.name, {
      timeout: 15_000,
    });

    await mcp.close();
  });

  test.describe('non-admin per-user OAuth servers (mocked list)', () => {
    const { LABELS } = ChatMcpMenuPage;
    const startPath = (url: URL) =>
      url.pathname.endsWith(
        `/${E2E_OAUTH_SERVICE.provider}/${E2E_OAUTH_SERVICE.service}/`,
      );

    test('chat-mcp-10: a per-user OAuth server shows Connect, and the first Connect explains whose account signs in before opening the sign-in window', async ({
      nonadminPage,
    }) => {
      const server = userScopedOAuthServer(990_001, 'E2E Mock OAuth Server');
      const authUrl = 'https://e2e-oauth.example.com/authorize?state=e2e';
      const mcp = new ChatMcpMenuPage(nonadminPage);
      await mockMcpServerList(nonadminPage, [server]);
      await mockMcpServerConnections(nonadminPage, () => []);
      await mcp.mockAgentUsesServers([server.id]);
      await nonadminPage.route(startPath, (route) =>
        route.fulfill({ json: { auth_url: authUrl } }),
      );
      await nonadminPage
        .context()
        .route('https://e2e-oauth.example.com/**', (route) =>
          route.fulfill({
            contentType: 'text/html',
            body: '<!doctype html><title>Sign In</title>',
          }),
        );

      await navigateToMentorApp(nonadminPage);
      await mcp.forgetConnectExplainer();
      await mcp.open();

      const row = mcp.serverRow(server.id);
      await expect(row).toContainText(server.name, { timeout: 10_000 });
      await expect(mcp.connectButton(server.id)).toHaveText(LABELS.connect);
      // The user's own on/off for this chat sits beside Connect.
      await expect(mcp.serverToggle(server.id)).toHaveAttribute(
        'aria-checked',
        'true',
      );

      await mcp.connectButton(server.id).click();
      const explainer = mcp.explainerDialog(server.name);
      await expect(explainer).toBeVisible({ timeout: 10_000 });
      await expect(explainer).toContainText(LABELS.ownAccount);
      const popupOpened = nonadminPage.waitForEvent('popup');
      await explainer
        .getByRole('button', { name: LABELS.explainerContinue, exact: true })
        .click();
      const popup = await popupOpened;
      await expect(popup).toHaveURL(authUrl);
      await popup.close();
    });

    test('chat-mcp-11: a per-user OAuth server the user already signed in to offers no Connect, only the switch for this chat', async ({
      nonadminPage,
    }) => {
      const server = userScopedOAuthServer(
        990_002,
        'E2E Mock Connected Server',
      );
      const mcp = new ChatMcpMenuPage(nonadminPage);
      await mockMcpServerList(nonadminPage, [server]);
      await mockMcpServerConnections(nonadminPage, (username) => [
        userConnection({
          id: 990_102,
          serverId: server.id,
          username,
          connectedServiceId: 990_202,
        }),
      ]);
      await mcp.mockAgentUsesServers([server.id]);

      await navigateToMentorApp(nonadminPage);
      await mcp.open();

      const row = mcp.serverRow(server.id);
      await expect(row).toContainText(server.name, { timeout: 10_000 });
      await expect(mcp.serverToggle(server.id)).toHaveAttribute(
        'aria-checked',
        'true',
      );
      await expect(mcp.connectButton(server.id)).toHaveCount(0);
    });

    test('chat-mcp-12: when the organization has no sign-in app for the server, Connect says it is not set up yet', async ({
      nonadminPage,
    }) => {
      const server = userScopedOAuthServer(990_003, 'E2E Mock Unready Server');
      const mcp = new ChatMcpMenuPage(nonadminPage);
      await mockMcpServerList(nonadminPage, [server]);
      await mockMcpServerConnections(nonadminPage, () => []);
      await mcp.mockAgentUsesServers([server.id]);
      await nonadminPage.route(startPath, (route) =>
        route.fulfill({
          status: 400,
          json: { detail: 'No OAuth application configured' },
        }),
      );

      await navigateToMentorApp(nonadminPage);
      await mcp.forgetConnectExplainer();
      await mcp.open();

      await expect(mcp.connectButton(server.id)).toHaveText(LABELS.connect, {
        timeout: 10_000,
      });
      await mcp.connect(server.id, server.name);
      await expect(
        nonadminPage.getByText(`${server.name} ${LABELS.notSetUp}`, {
          exact: true,
        }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(mcp.connectButton(server.id)).toBeEnabled();
    });
  });
});
