import type { APIRequestContext, Page } from '@playwright/test';
import { logger } from '@iblai/iblai-js/playwright';

export const MCP_SERVER_LIST_PATH = /\/mcp-servers\/$/;
const MCP_CONNECTIONS_PATH = /\/users\/([^/]+)\/mcp-server-connections\/$/;
/** The user's own sign-ins to outside services (not the start or callback paths below it). */
const CONNECTED_SERVICES_PATH =
  /\/connected-services\/orgs\/[^/]+\/users\/[^/]+\/$/;

export const E2E_OAUTH_SERVICE = {
  provider: 'e2e-oauth-provider',
  service: 'e2e-oauth-service',
} as const;

/**
 * A server a test created, with the DELETE url and the Authorization header
 * the app itself sent, so cleanup needs neither the page nor its storage.
 */
export interface CreatedMcpServer {
  id: number;
  deleteUrl: string;
  authorization: string;
}

/** Best-effort: a failed cleanup is logged and never fails the test. */
export async function deleteMcpServer(
  request: APIRequestContext,
  server: CreatedMcpServer,
): Promise<void> {
  try {
    const res = await request.delete(server.deleteUrl, {
      headers: { Authorization: server.authorization },
      timeout: 15_000,
    });
    if (!res.ok() && res.status() !== 404) {
      logger.warn(
        `[mcp-servers] DELETE ${server.deleteUrl} → ${res.status()} — MCP server ${server.id} may not have been deleted`,
      );
    }
  } catch (err) {
    logger.warn(
      `[mcp-servers] Failed to delete MCP server ${server.id}: ${err}`,
    );
  }
}

export function userScopedOAuthServer(id: number, name: string) {
  return {
    id,
    name,
    url: `https://${id}.e2e-mcp.example.com/mcp`,
    transport: 'streamable_http',
    description: '',
    auth_type: 'oauth2',
    auth_scope: 'user',
    mentor: null,
    created_at: '2026-01-01T00:00:00Z',
    oauth_service_data: {
      id,
      oauth_provider: E2E_OAUTH_SERVICE.provider,
      oauth_provider_id: id,
      name: E2E_OAUTH_SERVICE.service,
      display_name: name,
    },
  };
}

export function userConnection(args: {
  id: number;
  serverId: number;
  username: string;
  connectedServiceId: number;
}) {
  return {
    id: args.id,
    server: args.serverId,
    server_name: '',
    scope: 'user',
    auth_type: 'oauth2',
    platform: 0,
    platform_key: '',
    user: args.username,
    mentor: null,
    connected_service: args.connectedServiceId,
    connected_service_summary: null,
    credentials: '',
    authorization_scheme: '',
    extra_headers: '',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

const page1 = (results: unknown[]) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
});

/** Serves `servers` as the whole MCP-server list; writes still go through. */
export async function mockMcpServerList(
  page: Page,
  servers: unknown[],
): Promise<void> {
  await page.route(
    (url) => MCP_SERVER_LIST_PATH.test(url.pathname),
    (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ json: page1(servers) })
        : route.fallback(),
  );
}

/** `connectionsFor` gets the user id from the request path. */
export async function mockMcpServerConnections(
  page: Page,
  connectionsFor: (username: string) => unknown[],
): Promise<void> {
  await page.route(
    (url) => MCP_CONNECTIONS_PATH.test(url.pathname),
    (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const [, user] = MCP_CONNECTIONS_PATH.exec(
        new URL(route.request().url()).pathname,
      )!;
      return route.fulfill({
        json: page1(connectionsFor(decodeURIComponent(user))),
      });
    },
  );
}

/**
 * Serves `servicesFor()` as the user's connected services (an array), so the
 * composer knows the sign-in lists and can count a server as waiting for one.
 */
export async function mockConnectedServices(
  page: Page,
  servicesFor: () => unknown[],
): Promise<void> {
  await page.route(
    (url) => CONNECTED_SERVICES_PATH.test(url.pathname),
    (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ json: servicesFor() })
        : route.fallback(),
  );
}

/**
 * A per-user sign-in store for one mocked OAuth server: no connection until
 * the app creates one (POST mcp-server-connections/, answered 201), after
 * which the connections list and the user's connected services both carry
 * it. `created()` says whether the app got that far.
 */
export async function mockMcpSignIn(
  page: Page,
  args: {
    server: ReturnType<typeof userScopedOAuthServer>;
    connectionId: number;
    connectedServiceId: number;
  },
): Promise<{ created: () => boolean }> {
  let created = false;
  await page.route(
    (url) => MCP_CONNECTIONS_PATH.test(url.pathname),
    (route) => {
      const method = route.request().method();
      if (method !== 'GET' && method !== 'POST') return route.fallback();
      const [, user] = MCP_CONNECTIONS_PATH.exec(
        new URL(route.request().url()).pathname,
      )!;
      const connection = userConnection({
        id: args.connectionId,
        serverId: args.server.id,
        username: decodeURIComponent(user),
        connectedServiceId: args.connectedServiceId,
      });
      if (method === 'POST') {
        created = true;
        return route.fulfill({ status: 201, json: connection });
      }
      return route.fulfill({ json: page1(created ? [connection] : []) });
    },
  );
  await mockConnectedServices(page, () =>
    created
      ? [
          {
            id: args.connectedServiceId,
            provider: args.server.oauth_service_data.oauth_provider,
            service: args.server.oauth_service_data.name,
          },
        ]
      : [],
  );
  return { created: () => created };
}
