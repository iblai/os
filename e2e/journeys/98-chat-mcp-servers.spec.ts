import type { Page, Response } from '@playwright/test';
import { test as base, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, waitForAdmin } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import {
  E2E_OAUTH_SERVICE,
  MCP_SERVER_LIST_PATH,
  deleteMcpServer,
  mockConnectedServices,
  mockMcpServerConnections,
  mockMcpServerList,
  mockMcpSignIn,
  userConnection,
  userScopedOAuthServer,
} from '../utils/mcp-servers';
import {
  ChatMcpMenuPage,
  MCP_SESSION_PREFERENCE_PATH,
  MENTOR_SETTINGS_PATH,
} from '../page-objects/chat-mcp-menu.page';
import type { CreateMentorPage } from '../page-objects/create-mentor.page';

/**
 * Journey 98 — Chat MCP Servers (iblai/iblai-platform#2625).
 *
 * The composer's "+" menu (journey 79) gains an MCP row after Memory (SDK
 * `ComposerPlusMenu`), with a count of the servers on for this chat. The row
 * exists only while the agent uses at least one server (SDK
 * `useMcpActiveCount`: a server in the agent settings' `mcp_servers` that is
 * not switched off by the organization); an agent with none has no MCP row at
 * all. On desktop the row opens the SDK's `McpServersMenu` in a panel beside
 * the menu, on phones as a page of the "+" bottom sheet. The panel lists only
 * the servers the agent uses and gives each one switch: its on/off for this
 * chat (the user's session preference, iblai/iblai-platform#2725; a server
 * the organization requires shows a locked one). The switch is the row's only
 * control: a per-user OAuth server the person has not signed in to shows its
 * switch off, and turning it on opens the sign-in window, the first time
 * after explaining whose account the sign-in becomes. Adding, editing and
 * attaching servers live in the agent settings MCP tab, and the row needs no
 * grant beyond chatting.
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

const isGet = (res: Response, path: RegExp) =>
  res.request().method() === 'GET' && path.test(new URL(res.url()).pathname);

/**
 * Reloads and waits for the two answers the MCP row is judged on, the agent's
 * settings and the server list, so an absent row is read on loaded data.
 */
const reloadWithMcpData = async (page: Page) => {
  const settings = page.waitForResponse(
    (res) => isGet(res, MENTOR_SETTINGS_PATH),
    { timeout: 30_000 },
  );
  const servers = page.waitForResponse(
    (res) => isGet(res, MCP_SERVER_LIST_PATH),
    { timeout: 30_000 },
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await Promise.all([settings, servers]);
  await waitForPageReady(page);
};

interface AdminFixtures {
  page: Page;
  mcp: ChatMcpMenuPage;
  createMentorPage: CreateMentorPage;
}

/**
 * A fresh agent that uses one server, created by API and attached through the
 * agent settings API, reloaded so the "+" menu offers MCP.
 */
const freshAgentWithServer = async (
  { page, mcp, createMentorPage }: AdminFixtures,
  options: { userCanDisable?: boolean } = {},
): Promise<{ serverId: number; name: string }> => {
  await createMentorPage.openAndCreate();
  const name = ChatMcpMenuPage.uniqueServerName(test.info().parallelIndex);
  const serverId = await mcp.createServer(name, options);
  await mcp.attachServers([serverId]);
  await reloadApp(page);
  return { serverId, name };
};

test.describe('Journey 98: Chat MCP Servers', () => {
  test.describe('admin', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToMentorApp(page);
      await waitForAdmin(page);
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
      // Closing the panel hands focus back to "+", never to the page body.
      await expect(mcp.plusMenuButton).toBeFocused();
    });

    test('chat-mcp-02: on an agent that uses no server the "+" menu has no MCP row, and the row appears once a server is attached', async ({
      page,
      mcp,
      createMentorPage,
    }) => {
      test.setTimeout(240_000);
      await createMentorPage.openAndCreate();
      await reloadWithMcpData(page);

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
      const { serverId } = await freshAgentWithServer({
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
      await expect(mcp.rowBadge).toHaveCount(0, { timeout: 15_000 });

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
      const { serverId } = await freshAgentWithServer({
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

      // "This chat only": a new chat counts the server as on again.
      await mcp.setServerEnabled(serverId, false);
      await mcp.close();
      await mcp.chat.startNewChat();
      await mcp.chat.openPlusMenu();
      await expect(mcp.rowBadge).toHaveText('1', { timeout: 30_000 });
      await mcp.row.click();
      await expect(mcp.serverRow(serverId)).toBeVisible({ timeout: 15_000 });
    });

    test('chat-mcp-06: a server the organization requires shows a locked switch that stays on', async ({
      page,
      mcp,
      createMentorPage,
    }) => {
      test.setTimeout(240_000);
      const { serverId, name } = await freshAgentWithServer(
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
      await expect(mcp.serverToggle(serverId)).toHaveAccessibleName(
        `${name} ${ChatMcpMenuPage.LABELS.required}`,
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
      // 28rem: wide enough for the one-line "this chat only" sentence.
      await mcp.expectPanelWidth(448);
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
      await expect(mcp.plusMenuButton).toBeFocused();
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

  test('chat-mcp-14: a sign-in that comes back refused keeps the callback tab open and says, in plain words, to try again', async ({
    nonadminPage,
  }) => {
    // The backend answers a used or unknown state with 404 "Invalid state";
    // the tab used to show only a spinner and the raw text, then close.
    await nonadminPage.route(
      '**/api/ai-account/connected-services/callback/**',
      (route) =>
        route.fulfill({ status: 404, json: { detail: 'Invalid state' } }),
    );

    await nonadminPage.goto(
      '/google-oauth-callback/?code=e2e-code&state=e2e-state',
    );

    const reason = nonadminPage.getByRole('alert').filter({
      hasText:
        'This sign-in link has expired or was already used. Close this tab and try again.',
    });
    await expect(reason).toBeVisible({ timeout: 15_000 });
    await expect(
      nonadminPage.getByText('You can close this tab.', { exact: true }),
    ).toBeVisible();
    await expect(
      nonadminPage.getByText('Invalid state', { exact: true }),
    ).toHaveCount(0);
  });

  test.describe('non-admin per-user OAuth servers (mocked list)', () => {
    const { LABELS } = ChatMcpMenuPage;
    const startPath = (url: URL) =>
      url.pathname.endsWith(
        `/${E2E_OAUTH_SERVICE.provider}/${E2E_OAUTH_SERVICE.service}/`,
      );
    const PROVIDER_PAGE = 'https://e2e-oauth.example.com/**';

    test('chat-mcp-10: a per-user OAuth server the user has not signed in to is not counted and shows its switch off; turning it on explains whose account signs in once, keeps the panel open while the sign-in window is up, and gives the switch back, off, when that window closes', async ({
      nonadminPage,
    }) => {
      const server = userScopedOAuthServer(990_001, 'E2E Mock OAuth Server');
      const authUrl = 'https://e2e-oauth.example.com/authorize?state=e2e';
      const mcp = new ChatMcpMenuPage(nonadminPage);
      await mockMcpServerList(nonadminPage, [server]);
      await mockMcpServerConnections(nonadminPage, () => []);
      await mockConnectedServices(nonadminPage, () => []);
      await mcp.mockAgentUsesServers([server.id]);
      await nonadminPage.route(startPath, (route) =>
        route.fulfill({ json: { auth_url: authUrl } }),
      );
      await nonadminPage.context().route(PROVIDER_PAGE, (route) =>
        route.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><title>Sign In</title>',
        }),
      );

      await navigateToMentorApp(nonadminPage);
      await mcp.forgetConnectExplainer();

      // Waiting for a sign-in, the server is not counted: the row has no badge.
      await mcp.chat.openPlusMenu();
      await expect(mcp.row).toBeVisible({ timeout: 10_000 });
      await expect(mcp.row).toHaveAccessibleName(LABELS.row, {
        timeout: 15_000,
      });
      await expect(mcp.rowBadge).toHaveCount(0);
      await mcp.row.click();
      await expect(mcp.heading).toBeVisible({ timeout: 10_000 });

      const toggle = mcp.serverToggle(server.id);
      await expect(mcp.serverRow(server.id)).toContainText(server.name, {
        timeout: 10_000,
      });
      await expect(toggle).toHaveAccessibleName(
        `${server.name} ${LABELS.turnOnToSignIn}`,
      );
      await expect(toggle).toHaveAttribute('aria-checked', 'false');
      await expect(toggle).toBeEnabled();

      await toggle.click();
      const explainer = mcp.explainerDialog(server.name);
      await expect(explainer).toBeVisible({ timeout: 10_000 });
      await expect(explainer).toContainText(LABELS.ownAccount);
      await expect(explainer).toContainText(LABELS.popupHint);
      const popupOpened = nonadminPage.waitForEvent('popup');
      await explainer
        .getByRole('button', { name: LABELS.explainerContinue, exact: true })
        .click();
      const popup = await popupOpened;
      await expect(popup).toHaveURL(authUrl);
      await expect(toggle).toHaveAttribute('aria-checked', 'true');
      await expect(toggle).toBeDisabled();

      // The panel finishes the sign-in, so it will not close while one is open.
      await nonadminPage.keyboard.press('Escape');
      await mcp.closeButton.click();
      await expect(mcp.heading).toBeVisible();
      await expect(toggle).toHaveAttribute('aria-checked', 'true');

      // Closing the window without signing in gives the switch back, off.
      await popup.close();
      await expect(toggle).toHaveAttribute('aria-checked', 'false', {
        timeout: 30_000,
      });
      await expect(toggle).toBeEnabled();
      await expect(toggle).toHaveAccessibleName(
        `${server.name} ${LABELS.turnOnToSignIn}`,
      );

      // The explainer is said once: the next turn-on opens the sign-in at once.
      const reopened = nonadminPage.waitForEvent('popup');
      await toggle.click();
      const second = await reopened;
      await expect(second).toHaveURL(authUrl);
      await expect(mcp.explainerDialog(server.name)).toHaveCount(0);
      await second.close();
    });

    test('chat-mcp-11: a per-user OAuth server the user already signed in to is counted and shows its switch on for this chat, with no sign-in prompt', async ({
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
      await mockConnectedServices(nonadminPage, () => []);
      await mcp.mockAgentUsesServers([server.id]);

      await navigateToMentorApp(nonadminPage);
      await mcp.chat.openPlusMenu();
      await expect(mcp.rowBadge).toHaveText('1', { timeout: 15_000 });
      await mcp.row.click();
      await expect(mcp.heading).toBeVisible({ timeout: 10_000 });

      const toggle = mcp.serverToggle(server.id);
      await expect(mcp.serverRow(server.id)).toContainText(server.name, {
        timeout: 10_000,
      });
      await expect(toggle).toHaveAccessibleName(
        `${server.name} ${LABELS.onForThisChat}`,
      );
      await expect(toggle).toHaveAttribute('aria-checked', 'true');
      await expect(toggle).toBeEnabled();
      await expect(mcp.explainerDialog(server.name)).toHaveCount(0);
    });

    test('chat-mcp-12: when the organization has no sign-in app for the server, turning its switch on says it is not set up yet and the switch goes back off', async ({
      nonadminPage,
    }) => {
      const server = userScopedOAuthServer(990_003, 'E2E Mock Unready Server');
      const mcp = new ChatMcpMenuPage(nonadminPage);
      await mockMcpServerList(nonadminPage, [server]);
      await mockMcpServerConnections(nonadminPage, () => []);
      await mockConnectedServices(nonadminPage, () => []);
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

      const toggle = mcp.serverToggle(server.id);
      await expect(toggle).toHaveAccessibleName(
        `${server.name} ${LABELS.turnOnToSignIn}`,
        { timeout: 10_000 },
      );
      await mcp.turnOnToSignIn(server.id, server.name);
      await expect(
        nonadminPage.getByText(`${server.name} ${LABELS.notSetUp}`, {
          exact: true,
        }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(toggle).toHaveAttribute('aria-checked', 'false');
      await expect(toggle).toBeEnabled();
    });

    test('chat-mcp-15: a sign-in that completes in its window connects the server: the window closes itself, the panel says so, and the switch is on for this chat and counted', async ({
      nonadminPage,
    }) => {
      const server = userScopedOAuthServer(
        990_004,
        'E2E Mock Signed In Server',
      );
      const authUrl =
        'https://e2e-oauth.example.com/authorize?state=e2e-complete';
      const mcp = new ChatMcpMenuPage(nonadminPage);
      await mockMcpServerList(nonadminPage, [server]);
      const signIn = await mockMcpSignIn(nonadminPage, {
        server,
        connectionId: 990_104,
        connectedServiceId: 990_204,
      });
      await mcp.mockAgentUsesServers([server.id]);
      await nonadminPage.route(startPath, (route) =>
        route.fulfill({ json: { auth_url: authUrl } }),
      );

      await navigateToMentorApp(nonadminPage);
      // The provider sends the window straight back to the app's callback page,
      // whose callback request is answered as a finished sign-in.
      const callbackPage = `${new URL(nonadminPage.url()).origin}/google-oauth-callback/?code=e2e-code&state=e2e-state`;
      await nonadminPage
        .context()
        .route(PROVIDER_PAGE, (route) =>
          route.fulfill({ status: 302, headers: { location: callbackPage } }),
        );
      await nonadminPage
        .context()
        .route('**/api/ai-account/connected-services/callback/**', (route) =>
          route.fulfill({
            json: {
              id: 990_204,
              provider: E2E_OAUTH_SERVICE.provider,
              service: E2E_OAUTH_SERVICE.service,
              service_info: { display_name: server.name },
            },
          }),
        );
      await mcp.forgetConnectExplainer();
      await mcp.open();

      const toggle = mcp.serverToggle(server.id);
      await expect(toggle).toHaveAccessibleName(
        `${server.name} ${LABELS.turnOnToSignIn}`,
        { timeout: 10_000 },
      );
      const popupOpened = nonadminPage.waitForEvent('popup');
      await mcp.turnOnToSignIn(server.id, server.name);
      const popup = await popupOpened;

      await expect(
        nonadminPage
          .getByText(`${server.name} ${LABELS.connected}`, { exact: true })
          .first(),
      ).toBeVisible({ timeout: 30_000 });
      expect(signIn.created(), 'the app stored the connection').toBe(true);
      await expect.poll(() => popup.isClosed(), { timeout: 15_000 }).toBe(true);
      await expect(toggle).toHaveAttribute('aria-checked', 'true', {
        timeout: 15_000,
      });
      await expect(toggle).toBeEnabled();
      await expect(toggle).toHaveAccessibleName(
        `${server.name} ${LABELS.onForThisChat}`,
      );

      await mcp.close();
      await mcp.chat.openPlusMenu();
      await expect(mcp.rowBadge).toHaveText('1', { timeout: 15_000 });
    });

    test("chat-mcp-16: a server that signs in through a shared agent account shows the plain switch for this chat, on, and asks for no sign-in of the user's own", async ({
      nonadminPage,
    }) => {
      const server = {
        ...userScopedOAuthServer(990_005, 'E2E Mock Shared Server'),
        auth_scope: 'mentor',
      };
      const mcp = new ChatMcpMenuPage(nonadminPage);
      await mockMcpServerList(nonadminPage, [server]);
      await mockMcpServerConnections(nonadminPage, () => []);
      await mockConnectedServices(nonadminPage, () => []);
      await mcp.mockAgentUsesServers([server.id]);

      await navigateToMentorApp(nonadminPage);
      await mcp.open();

      const toggle = mcp.serverToggle(server.id);
      await expect(mcp.serverRow(server.id)).toContainText(server.name, {
        timeout: 10_000,
      });
      await expect(toggle).toHaveAccessibleName(
        `${server.name} ${LABELS.onForThisChat}`,
      );
      await expect(toggle).toHaveAttribute('aria-checked', 'true');
      await expect(toggle).toBeEnabled();
      await expect(mcp.explainerDialog(server.name)).toHaveCount(0);
    });

    test('chat-mcp-17: a student switches a signed-in server off for this chat and sends a message in that same chat, which goes out and is answered; the row then counts nothing until the student switches it back on', async ({
      nonadminPage,
    }) => {
      test.setTimeout(180_000);
      const server = userScopedOAuthServer(990_006, 'E2E Mock Student Server');
      const mcp = new ChatMcpMenuPage(nonadminPage);
      await mockMcpServerList(nonadminPage, [server]);
      await mockMcpServerConnections(nonadminPage, (username) => [
        userConnection({
          id: 990_106,
          serverId: server.id,
          username,
          connectedServiceId: 990_206,
        }),
      ]);
      await mockConnectedServices(nonadminPage, () => []);
      await mcp.mockAgentUsesServers([server.id]);
      // The server is mocked, so its per-chat setting is answered here the way
      // the backend answers a real one, and the conversation it names is kept.
      const saved: string[] = [];
      await nonadminPage.route(
        (url) =>
          MCP_SESSION_PREFERENCE_PATH.exec(url.pathname)?.[1] ===
          String(server.id),
        (route) => {
          if (route.request().method() !== 'PUT') return route.fallback();
          const body = route.request().postDataJSON() as {
            is_enabled: boolean;
            session_id?: string;
          };
          if (body.session_id) saved.push(body.session_id);
          return route.fulfill({ json: { server: server.id, ...body } });
        },
      );

      await navigateToMentorApp(nonadminPage);
      await mcp.open();
      await mcp.setServerEnabled(server.id, false);
      await mcp.close();
      const [sessionId] = saved;
      expect(sessionId, 'the switch named the open conversation').toBeTruthy();

      // The message goes out in the conversation the switch named.
      const text = `MCP off for this chat ${Date.now()}`;
      const sent = nonadminPage.waitForRequest(
        (req) =>
          req.method() === 'POST' &&
          (req.url().includes(sessionId) ||
            (req.postData() ?? '').includes(sessionId)),
        { timeout: 60_000 },
      );
      await mcp.chat.sendMessage(text);
      await sent;
      await mcp.chat.waitForUserMessage(text);
      await mcp.chat.waitForAIResponseOrUserAgreement();

      await mcp.chat.openPlusMenu();
      await expect(mcp.row).toBeVisible({ timeout: 15_000 });
      await expect(mcp.rowBadge).toHaveCount(0, { timeout: 15_000 });
      await mcp.row.click();
      await expect(mcp.heading).toBeVisible({ timeout: 10_000 });
      await mcp.setServerEnabled(server.id, true);
      await mcp.close();
      await mcp.chat.openPlusMenu();
      await expect(mcp.rowBadge).toHaveText('1', { timeout: 15_000 });
    });
  });
});
