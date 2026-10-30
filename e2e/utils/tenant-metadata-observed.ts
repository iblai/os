import type { JSHandle, Page } from '@playwright/test';
import { navigateToMentorApp } from './auth';

/**
 * Storage keys the app persists the resolved tenant under (mirrors
 * `LOCAL_STORAGE_KEYS`, `lib/constants.ts`). Tenant metadata no longer arrives
 * from a dedicated `GET /api/core/orgs/<org>/metadata/` call — it rides the
 * platforms list (`/api/ibl/users/manage/platform/`), which the tenant
 * provider persists whole to `tenants`, while `current_tenant` holds only the
 * active tenant's identity (`{ key, is_admin, org }`, no metadata). The app
 * joins them by key (`useTenantObjectMetadata`); this helper does the same.
 */
const CURRENT_TENANT_KEY = 'current_tenant';
const USER_TENANTS_KEY = 'tenants';

export type ObservedTenantMetadata = Record<string, unknown>;

/**
 * Navigates into the mentor app via `navigateToMentorApp`, then reads the
 * active tenant's `metadata` from the SAME place the app itself reads it: the
 * persisted `tenants` list, matched to `current_tenant` by key
 * (`useTenantObjectMetadata`). This needs no DM API call, no DM_URL, no
 * dm_token, and no per-environment setup — it is strictly read-only and works
 * on any tenant, on any environment, as-is.
 *
 * ── Why storage, not a network response ──────────────────────────────────
 * The app used to fetch org-metadata on every authenticated load; it no
 * longer does. Metadata now travels inside each tenant object in the
 * platforms list, and the tenant provider persists that list to `tenants`
 * and the active identity to `current_tenant`. Reading them is the current
 * analogue of "observe the app's own tenant-metadata traffic".
 *
 * ── Session-first, seed fallback ─────────────────────────────────────────
 * `current_tenant` and `tenants` are per-tab auth keys
 * (`lib/auth-storage.ts`): under per-tab auth the tab's `sessionStorage` is
 * the source of truth and `localStorage` holds the most-recent-login seed;
 * with the flag off it is plain `localStorage`. The in-page read below checks
 * `sessionStorage` first, then `localStorage`, matching `getAuthItem`.
 *
 * ── Never skips ──────────────────────────────────────────────────────────
 * If the tenant never resolves (no `current_tenant` whose key is present in
 * the `tenants` list within the timeout), this THROWS. A tenant that fails to
 * resolve is a real failure — the app depends on the same resolution — never a
 * "this environment isn't configured for the test" signal. A tenant that
 * resolves without metadata is valid and yields `{}` (the app treats absent
 * flags as their defaults).
 */
export async function navigateAndObserveTenantMetadata(
  page: Page,
  url?: string,
): Promise<ObservedTenantMetadata> {
  await navigateToMentorApp(page, url);

  let handle: JSHandle<ObservedTenantMetadata> | undefined;
  try {
    handle = await page.waitForFunction(
      ({ currentKey, listKey }) => {
        const read = (key: string) =>
          window.sessionStorage.getItem(key) ??
          window.localStorage.getItem(key);
        const parse = (raw: string | null): unknown => {
          if (!raw) return null;
          try {
            return JSON.parse(raw);
          } catch {
            return null;
          }
        };

        const current = parse(read(currentKey)) as { key?: string } | null;
        const tenants = parse(read(listKey));
        if (!current?.key || !Array.isArray(tenants)) {
          return null;
        }

        const tenant = tenants.find(
          (candidate: unknown) =>
            !!candidate &&
            typeof candidate === 'object' &&
            (candidate as { key?: string }).key === current.key,
        ) as { metadata?: Record<string, unknown> } | undefined;
        if (!tenant) {
          return null;
        }

        return tenant.metadata && typeof tenant.metadata === 'object'
          ? tenant.metadata
          : {};
      },
      { currentKey: CURRENT_TENANT_KEY, listKey: USER_TENANTS_KEY },
      { timeout: 30_000 },
    );
    // Read inside the try: a navigation between the predicate resolving and
    // this read destroys the execution context, and that raw error should be
    // wrapped in the explanatory failure below, not surfaced bare.
    return (await handle.jsonValue()) as ObservedTenantMetadata;
  } catch (error) {
    throw new Error(
      'Could not read the resolved tenant from storage ' +
        `(\`${CURRENT_TENANT_KEY}\` joined to \`${USER_TENANTS_KEY}\`) after ` +
        'navigating into the app. Tenant metadata now rides the platforms ' +
        'list and is persisted by the tenant provider on load; this must ' +
        'FAIL, not skip — it is not gated by DM_URL or any per-environment ' +
        `setup. Underlying error: ${error}`,
    );
  } finally {
    await handle?.dispose();
  }
}
