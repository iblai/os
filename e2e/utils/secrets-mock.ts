/**
 * `page.route` stand-ins for the Secrets page's lists.
 *
 * An organization holds one Stripe key and one key per AI provider, so a real
 * add would collide with the tenant's own keys and with parallel workers, and
 * deleting it afterwards could destroy a real one. Each helper answers from a
 * small in-memory list instead, which keeps the frontend path real and touches
 * no data. Call it before the lists are first read.
 */

import type { Page, Route } from '@playwright/test';

const ORG = String.raw`\/api\/ai-account\/orgs\/[^/]+`;
const QUERY = String.raw`(\?.*)?$`;

function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

/**
 * Stripe's schema, the organization's service keys and its VM secrets, starting
 * empty. Returns the bodies of the credential POSTs for the caller to check.
 */
export async function mockStripeSecretLists(
  page: Page,
): Promise<{ savedCredentials: Record<string, unknown>[] }> {
  const savedCredentials: Record<string, unknown>[] = [];
  const credentials: Record<string, unknown>[] = [];
  const secrets: Record<string, unknown>[] = [];

  await page.route(
    new RegExp(`${ORG}/integration-credential/schema/v2/${QUERY}`),
    (route) =>
      fulfillJson(route, [
        {
          name: 'stripe',
          schema: {
            key: { type: 'string', is_sensitive: true },
            publishable_key: { type: 'string', is_sensitive: false },
          },
          service_info: { display_name: 'Stripe' },
        },
      ]),
  );

  await page.route(
    new RegExp(`${ORG}/integration-credential/${QUERY}`),
    async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const body = request.postDataJSON() as Record<string, unknown>;
        savedCredentials.push(body);
        credentials.push({
          id: 7,
          name: body.name,
          platform: body.platform,
          value: { key: 'sk_live_****', publishable_key: '' },
          service_info: { display_name: 'Stripe' },
        });
        await fulfillJson(route, {}, 201);
        return;
      }
      await fulfillJson(route, credentials);
    },
  );

  await page.route(
    new RegExp(`${ORG}/virtual-machine-secret/${QUERY}`),
    async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const secret = {
          id: 900 + secrets.length,
          ...(request.postDataJSON() as Record<string, unknown>),
          created_at: '2026-11-06T00:00:00Z',
          updated_at: '2026-11-06T00:00:00Z',
        };
        secrets.push(secret);
        await fulfillJson(route, secret, 201);
        return;
      }
      await fulfillJson(route, secrets);
    },
  );

  return { savedCredentials };
}

/**
 * The AI providers a key can be added for (Azure OpenAI and OpenAI) and the keys
 * held, starting with Azure OpenAI and two models. A POST holds the provider, a
 * DELETE lets it go.
 */
export async function mockAiSecretLists(page: Page): Promise<void> {
  let held: Record<string, unknown>[] = [
    {
      name: 'azure_openai',
      platform: 'e2e',
      value: {
        'gpt-4o': { key: 'az-***1' },
        'gpt-4o-mini': { key: 'az-***2' },
      },
      service_info: {},
    },
  ];

  await page.route(new RegExp(`${ORG}/credential/schema/${QUERY}`), (route) =>
    fulfillJson(route, [
      { name: 'azure_openai', schema: { '<model_name>': 'object' } },
      {
        name: 'openai',
        schema: { key: 'string' },
        service_info: { display_name: 'OpenAI' },
      },
    ]),
  );

  await page.route(
    new RegExp(`${ORG}/masked-llm-credential/${QUERY}`),
    (route) => fulfillJson(route, held),
  );

  await page.route(new RegExp(`${ORG}/credential/${QUERY}`), async (route) => {
    const request = route.request();
    const body = request.postDataJSON() as { name: string; platform: string };
    if (request.method() === 'POST') {
      held = [
        ...held,
        {
          name: body.name,
          platform: body.platform,
          value: { key: 'sk-***ab' },
          service_info: { display_name: 'OpenAI' },
        },
      ];
      await fulfillJson(route, {}, 201);
      return;
    }
    if (request.method() === 'DELETE') {
      held = held.filter((row) => row.name !== body.name);
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    await route.continue();
  });
}
