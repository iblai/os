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
import {
  ChatMcpMenuPage,
  MENTOR_SETTINGS_PATH,
} from '../page-objects/chat-mcp-menu.page';

/**
 * Journey 80 — Chat MCP Servers (iblai/iblai-platform#2625).
 *
 * The composer's MCP pill (SDK `McpServersButton`, rendered by
 * `components/chat-input-form/inside-buttons.tsx`) opens the SDK's
 * `McpServersMenu`: browse/search the agent's MCP servers, connect per-user
 * OAuth servers, switch one on/off for the agent, and add one through the
 * shared "Add MCP Connector" dialog. Like Memory it collapses into the
 * composer's ••• overflow on narrow rows.
 *
 * Gates:
 *   - the pill renders only with `/mentors/{dbId}/mcpservers/#list`
 *     (students who can chat with the agent have it);
 *   - Add Server needs `/mentors/{dbId}/mcpservers/#create` or
 *     `/mcpservers/#create` (agent owner / tenant admin only).
 * The denied paths rewrite the REAL permissions-check response
 * (`ChatMcpMenuPage.patchRbac`), registered before navigation. The pill gate
 * ignores NEXT_PUBLIC_ENABLE_RBAC, like the composer's other agent gates, so
 * chat-mcp-04 holds either way. The menu honours it: with RBAC off Add Server
 * always renders (chat-mcp-05 fails) and a non-admin can get the agent switch
 * (chat-mcp-10 fails). Run against a build with NEXT_PUBLIC_ENABLE_RBAC=true.
 *
 * Tests that add a server do it on their own fresh agent, and the `mcp`
 * fixture deletes every server they created. The per-user OAuth tests mock
 * the server list and connections: a real sign-in cannot be completed here.
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

const serverUrlFor = (name: string) => `https://${name}.example.com/mcp`;

test.describe('Journey 80: Chat MCP Servers', () => {
  test.describe('admin', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToMentorApp(page);
      const isAdmin = await checkAdminStatus(page);
      test.skip(!isAdmin, 'Requires admin access');
    });

    test('chat-mcp-01: admin sees the MCP pill in the composer, opens the MCP Servers menu from it, and closes it', async ({
      mcp,
      createMentorPage,
    }) => {
      test.setTimeout(180_000);
      // A fresh agent has the default set of tool pills, so whether MCP fits
      // inline does not depend on which agent the admin used last.
      await createMentorPage.openAndCreate();
      const { LABELS } = ChatMcpMenuPage;

      await expect(mcp.pill).toBeVisible({ timeout: 30_000 });
      await mcp.openFromPill();

      await expect(mcp.search).toBeVisible();
      await expect(mcp.search).toHaveAttribute(
        'placeholder',
        LABELS.searchPlaceholder,
      );
      await expect(mcp.addButton).toHaveAccessibleName(LABELS.add);
      await expect(mcp.closeButton).toHaveAccessibleName(LABELS.close);

      await mcp.search.fill(`no-such-server-${Date.now()}`);
      await expect(mcp.emptyState).toHaveText(LABELS.noSearchMatch, {
        timeout: 10_000,
      });
      await expect(mcp.rows).toHaveCount(0);

      await mcp.close();
      await expect(mcp.pill).toBeVisible();
    });

    test('chat-mcp-02: admin adds a server from the menu and it is listed switched on for the agent', async ({
      mcp,
      createMentorPage,
    }) => {
      test.setTimeout(240_000);
      await createMentorPage.openAndCreate();
      const name = ChatMcpMenuPage.uniqueServerName(test.info().parallelIndex);

      await mcp.open();
      const serverId = await mcp.addServer(name, serverUrlFor(name));

      await mcp.open();
      const row = await mcp.revealServer(name);
      await expect(row).toHaveAttribute(
        'data-testid',
        `mcp-server-row-${serverId}`,
      );
      await expect(mcp.serverToggle(serverId)).toHaveAttribute(
        'aria-checked',
        'true',
      );
    });

    test('chat-mcp-03: admin switches a server off and back on for the agent and each state survives a reload', async ({
      page,
      mcp,
      createMentorPage,
    }) => {
      test.setTimeout(300_000);
      await createMentorPage.openAndCreate();
      const name = ChatMcpMenuPage.uniqueServerName(test.info().parallelIndex);

      const reloadAndReveal = async () => {
        await mcp.close();
        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitForPageReady(page);
        await mcp.open();
        await mcp.revealServer(name);
      };

      await mcp.open();
      const serverId = await mcp.addServer(name, serverUrlFor(name));
      await mcp.open();
      await mcp.revealServer(name);

      await mcp.setServerEnabled(serverId, false);
      await reloadAndReveal();
      await expect(mcp.serverToggle(serverId)).toHaveAttribute(
        'aria-checked',
        'false',
      );

      await mcp.setServerEnabled(serverId, true);
      await reloadAndReveal();
      await expect(mcp.serverToggle(serverId)).toHaveAttribute(
        'aria-checked',
        'true',
      );
    });
    test('chat-mcp-12: admin taps a custom server in the menu to edit it, and the new name shows in the list', async ({
      mcp,
      createMentorPage,
    }) => {
      test.setTimeout(300_000);
      await createMentorPage.openAndCreate();
      const name = ChatMcpMenuPage.uniqueServerName(test.info().parallelIndex);
      const renamed = `${name}-renamed`;

      await mcp.open();
      const serverId = await mcp.addServer(name, serverUrlFor(name));
      await mcp.open();
      await mcp.revealServer(name);
      await expect(mcp.editButton(serverId)).toBeVisible();

      await mcp.renameServer(serverId, name, renamed);
      await mcp.open();
      const row = await mcp.revealServer(renamed);
      await expect(row).toContainText(renamed);
    });

    test('chat-mcp-13: admin deletes a custom server from the menu after confirming in the Remove Connector dialog', async ({
      mcp,
      createMentorPage,
    }) => {
      test.setTimeout(300_000);
      await createMentorPage.openAndCreate();
      const name = ChatMcpMenuPage.uniqueServerName(test.info().parallelIndex);

      await mcp.open();
      const serverId = await mcp.addServer(name, serverUrlFor(name));
      await mcp.open();
      await mcp.revealServer(name);

      await mcp.deleteServer(serverId);
      await expect(mcp.serverRow(serverId)).toHaveCount(0);
      await mcp.search.fill(name);
      await expect(mcp.emptyState).toBeVisible({ timeout: 15_000 });
    });
  });

  test('chat-mcp-04: without the MCP-servers list grant the composer has no MCP pill and no MCP overflow item', async ({
    page,
    mcp,
    chatPage,
  }) => {
    await mcp.denyBrowse();
    const settingsLoaded = mcp.waitForMentorSettings();
    await navigateToMentorApp(page);
    await mcp.waitForRbacPatch();
    await settingsLoaded;

    await expect(chatPage.getComposerTextarea()).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      mcp.insideButtonsRow
        .getByRole('button', { name: /canvas/i })
        .or(mcp.overflowTrigger)
        .first(),
    ).toBeVisible({ timeout: 30_000 });
    await mcp.expectPillStaysAbsent();

    await mcp.collapseIntoOverflow();
    await mcp.overflowTrigger.click();
    await expect(mcp.overflowMenu.getByRole('menuitem').first()).toBeVisible({
      timeout: 5_000,
    });
    await expect(mcp.overflowMenuItem).toHaveCount(0);
    await page.keyboard.press('Escape');
  });

  test('chat-mcp-05: without an MCP-servers create grant the menu still opens but offers no Add Server', async ({
    page,
    mcp,
  }) => {
    await mcp.denyAdd();
    await navigateToMentorApp(page);
    await mcp.waitForRbacPatch();

    await mcp.open();
    await expect(mcp.search).toBeVisible();
    await expect(mcp.closeButton).toBeVisible();
    await expect(mcp.addButton).toHaveCount(0);

    await mcp.close();
  });

  test('chat-mcp-06: non-admin sees the MCP pill and can browse the menu but gets no Add Server', async ({
    nonadminPage,
  }) => {
    await navigateToMentorApp(nonadminPage);
    const mcp = new ChatMcpMenuPage(nonadminPage);

    await expect(mcp.pill).toBeVisible({ timeout: 30_000 });
    await mcp.openFromPill();
    await expect(mcp.search).toBeVisible();
    await expect(mcp.closeButton).toBeVisible();
    await expect(mcp.addButton).toHaveCount(0);

    await mcp.close();
  });

  test('chat-mcp-07: on narrow and phone viewports MCP sits in the composer ••• menu and its item opens the same MCP Servers menu inside the screen', async ({
    page,
    mcp,
  }) => {
    await navigateToMentorApp(page);
    await expect(mcp.pill.or(mcp.overflowTrigger).first()).toBeVisible({
      timeout: 30_000,
    });

    await mcp.collapseIntoOverflow();
    await expect(mcp.pill).toHaveCount(0);

    await mcp.openFromOverflow();
    await mcp.expectPanelInViewport();
    await mcp.search.click();
    await page.keyboard.type('zz');
    await expect(mcp.search).toHaveValue('zz');
    await expect(mcp.search).toBeFocused();
    await mcp.close();

    for (const viewport of PHONE_VIEWPORTS) {
      await page.setViewportSize(viewport);
      await mcp.openFromOverflow();
      await mcp.expectPanelInViewport();
      await mcp.close();
    }
  });

  test('chat-mcp-08: keyboard users open MCP from the composer ••• menu and land in the MCP Servers menu', async ({
    page,
    mcp,
  }) => {
    await navigateToMentorApp(page);
    await expect(mcp.pill.or(mcp.overflowTrigger).first()).toBeVisible({
      timeout: 30_000,
    });
    await mcp.collapseIntoOverflow();

    await mcp.openFromOverflowByKeyboard();
    await mcp.tabTo(mcp.search);
    await page.keyboard.type('zz');
    await expect(mcp.search).toHaveValue('zz');

    await page.keyboard.press('Escape');
    await expect(mcp.menu).toBeHidden({ timeout: 10_000 });
  });

  test.describe('non-admin per-user OAuth servers (mocked list)', () => {
    const { LABELS } = ChatMcpMenuPage;

    test('chat-mcp-09: a per-user OAuth server shows a Connect button and no agent switch, and Connect opens its sign-in', async ({
      nonadminPage,
    }) => {
      const server = userScopedOAuthServer(990_001, 'E2E Mock OAuth Server');
      const authUrl = 'https://e2e-oauth.example.com/authorize?state=e2e';
      await mockMcpServerList(nonadminPage, [server]);
      await mockMcpServerConnections(nonadminPage, () => []);
      await nonadminPage.route(
        (url) =>
          url.pathname.endsWith(
            `/${E2E_OAUTH_SERVICE.provider}/${E2E_OAUTH_SERVICE.service}/`,
          ),
        (route) => route.fulfill({ json: { auth_url: authUrl } }),
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
      const mcp = new ChatMcpMenuPage(nonadminPage);
      await mcp.open();

      const row = mcp.serverRow(server.id);
      await expect(row).toContainText(server.name, { timeout: 10_000 });
      await expect(
        row.getByText(LABELS.userScope, { exact: true }),
      ).toBeVisible();
      await expect(mcp.connectButton(server.id)).toHaveText(LABELS.connect);
      await expect(mcp.disconnectButton(server.id)).toHaveCount(0);
      await expect(mcp.toggles).toHaveCount(0);

      const popupOpened = nonadminPage.waitForEvent('popup');
      await mcp.connectButton(server.id).click();
      const popup = await popupOpened;
      await expect(popup).toHaveURL(authUrl);
      await popup.close();
    });

    test('chat-mcp-10: a per-user OAuth server the user connected shows Disconnect, and Disconnect removes only their sign-in without touching the agent', async ({
      nonadminPage,
    }) => {
      const server = userScopedOAuthServer(
        990_002,
        'E2E Mock Connected Server',
      );
      const connectedServiceId = 990_202;
      let connected = true;
      const disconnectedIds: string[] = [];
      const agentSettingsWrites: string[] = [];

      await mockMcpServerList(nonadminPage, [server]);
      await mockMcpServerConnections(nonadminPage, (username) =>
        connected
          ? [
              userConnection({
                id: 990_102,
                serverId: server.id,
                username,
                connectedServiceId,
              }),
            ]
          : [],
      );
      const disconnectPath =
        /\/connected-services\/orgs\/[^/]+\/users\/[^/]+\/(\d+)\/$/;
      await nonadminPage.route(
        (url) => disconnectPath.test(url.pathname),
        (route) => {
          if (route.request().method() !== 'DELETE') return route.fallback();
          disconnectedIds.push(
            disconnectPath.exec(new URL(route.request().url()).pathname)![1],
          );
          connected = false;
          return route.fulfill({ status: 204, body: '' });
        },
      );
      nonadminPage.on('request', (req) => {
        if (
          req.method() !== 'GET' &&
          MENTOR_SETTINGS_PATH.test(new URL(req.url()).pathname)
        ) {
          agentSettingsWrites.push(`${req.method()} ${req.url()}`);
        }
      });

      await navigateToMentorApp(nonadminPage);
      const mcp = new ChatMcpMenuPage(nonadminPage);
      await mcp.open();

      await expect(mcp.disconnectButton(server.id)).toHaveText(
        LABELS.disconnect,
        { timeout: 10_000 },
      );
      await expect(mcp.connectButton(server.id)).toHaveCount(0);
      await expect(mcp.toggles).toHaveCount(0);

      await mcp.disconnectButton(server.id).click();
      await expect(mcp.connectButton(server.id)).toHaveText(LABELS.connect, {
        timeout: 15_000,
      });
      await expect(mcp.disconnectButton(server.id)).toHaveCount(0);
      expect(disconnectedIds).toEqual([String(connectedServiceId)]);
      expect(
        agentSettingsWrites,
        'a per-user disconnect must not detach the server from the agent',
      ).toEqual([]);
    });
  });

  test('chat-mcp-11: when the server list fails to load the menu says so and Retry loads it', async ({
    page,
    mcp,
  }) => {
    const { LABELS } = ChatMcpMenuPage;
    let failing = true;
    await page.route(
      (url) => MCP_SERVER_LIST_PATH.test(url.pathname),
      (route) =>
        failing && route.request().method() === 'GET'
          ? route.fulfill({ status: 500, json: { detail: 'e2e failure' } })
          : route.fallback(),
    );
    await navigateToMentorApp(page);

    await mcp.open();
    await expect(mcp.loadError).toContainText(LABELS.failedToLoad, {
      timeout: 30_000,
    });

    failing = false;
    await mcp.loadError
      .getByRole('button', { name: LABELS.retry, exact: true })
      .click();
    await expect(mcp.loadError).toBeHidden({ timeout: 15_000 });
    await expect(mcp.rows.first().or(mcp.emptyState)).toBeVisible({
      timeout: 15_000,
    });
  });
});
