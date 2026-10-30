import type { Page } from '@playwright/test';
import { navigateToMentorApp } from './auth';

export type ObservedTenantMetadata = Record<string, unknown>;

/**
 * Navigates into the mentor app via `navigateToMentorApp` and returns the
 * metadata of the tenant in the URL (`/platform/<tenantKey>/…`), read from
 * the SAME localStorage copy the app reads.
 *
 * The SDK's `useTenantMetadata({ org })` (`@iblai/web-utils`) no longer
 * calls `GET /api/core/orgs/<org>/metadata/`; it resolves `metadata` from
 * localStorage `tenants` (the entry whose `key === org`), falling back to
 * `current_tenant` when its `key === org`. Both are written at login, so no
 * DM API call, DM_URL or dm_token is needed — read-only, works on any
 * environment.
 *
 * Never skips: if neither entry carries `metadata`, this THROWS — the app
 * itself depends on it to resolve the tenant.
 */
export async function navigateAndObserveTenantMetadata(
  page: Page,
  url?: string,
): Promise<ObservedTenantMetadata> {
  await navigateToMentorApp(page, url);

  const result = await page.evaluate(() => {
    const parse = (raw: string | null): unknown => {
      try {
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    };
    const org = /\/platform\/([^/]+)/.exec(window.location.pathname)?.[1];
    const tenants = parse(window.localStorage.getItem('tenants'));
    const current = parse(window.localStorage.getItem('current_tenant')) as {
      key?: string;
      metadata?: Record<string, unknown>;
    } | null;
    const fromList = Array.isArray(tenants)
      ? (tenants.find((t) => t && t.key === org) as
          | { metadata?: Record<string, unknown> }
          | undefined)
      : undefined;
    const fromCurrent =
      current && (!org || current.key === org) ? current : undefined;
    return {
      org,
      metadata: fromList?.metadata ?? fromCurrent?.metadata ?? null,
    };
  });

  if (!result.metadata) {
    throw new Error(
      `No tenant metadata in localStorage 'tenants' / 'current_tenant' for ` +
        `tenant "${result.org}". This must FAIL, not skip — the app reads ` +
        'the same copy via `useTenantMetadata`.',
    );
  }
  return result.metadata;
}
