import type { Page } from '@playwright/test';
import { navigateToMentorApp } from './auth';

/**
 * Matches the org-metadata GET path the app itself fires on EVERY
 * authenticated load. `providers/index.tsx`'s top-level `Providers`
 * component calls the SDK's `useTenantMetadata({ org: tenantKeyParams })`
 * (`@iblai/web-utils`), which resolves to `@iblai/data-layer`'s
 * `useGetTenantMetadataQuery` — `CoreService.coreOrgsMetadataRetrieve`,
 * `GET /api/core/orgs/{org}/metadata/`.
 *
 * Matched on `pathname` WITHOUT a leading anchor and verified against a live
 * trace: the SDK's DM base URL already includes a service prefix (observed
 * as `.../dm/api/core/orgs/<org>/metadata/`), so the path does NOT start at
 * `/api/core/...` — it can be preceded by an arbitrary service segment. Only
 * the trailing `.../orgs/<org>/metadata/` shape (and NOT a sub-resource
 * under it) is guaranteed, so only the `$` end-anchor is kept.
 */
const TENANT_METADATA_PATH_RE = /\/api\/core\/orgs\/[^/]+\/metadata\/?$/;

export type ObservedTenantMetadata = Record<string, unknown>;

/**
 * Navigates into the mentor app via `navigateToMentorApp` while OBSERVING
 * the org-metadata GET the app itself issues during its own bootstrap —
 * the SAME traffic every authenticated load already makes. This needs no
 * DM API call, no DM_URL, no dm_token, and no per-environment setup: it is
 * strictly read-only and works on any tenant, on any environment, as-is.
 *
 * ── Why the listener must be armed BEFORE navigating ───────────────────
 * `Providers`' `useTenantMetadata({ org: tenantKeyParams })` call
 * (`providers/index.tsx`) can fire within the first render after
 * `page.goto`'s `domcontentloaded` — well before `navigateToMentorApp`
 * itself resolves (it goes on to wait for auth redirects, the mentor
 * dropdown, and a stable mentor URL).
 * `page.waitForResponse(...)` only observes responses that occur AFTER it
 * is called; it cannot replay a response that already landed. So the
 * listener is armed synchronously here, before any `await`, strictly
 * before `navigateToMentorApp`'s own `page.goto` — there is no window in
 * which the request could fire and complete before we are listening for
 * it.
 *
 * ── Never skips ─────────────────────────────────────────────────────────
 * If the response is never observed, or comes back non-OK, this THROWS. A
 * missing/failed org-metadata load is a real failure — the app itself
 * depends on this same response to resolve the tenant — never a "this
 * environment isn't configured for the test" signal.
 */
export async function navigateAndObserveTenantMetadata(
  page: Page,
  url?: string,
): Promise<ObservedTenantMetadata> {
  const metadataResponse = page.waitForResponse(
    (res) =>
      res.request().method() === 'GET' &&
      TENANT_METADATA_PATH_RE.test(new URL(res.url()).pathname),
    { timeout: 30_000 },
  );

  await navigateToMentorApp(page, url);

  let response: Awaited<typeof metadataResponse>;
  try {
    response = await metadataResponse;
  } catch (error) {
    throw new Error(
      'Could not observe the tenant org-metadata GET ' +
        '(`/api/core/orgs/<org>/metadata/`) that the app itself fires on ' +
        "load via `providers/index.tsx`'s `useTenantMetadata`. This must " +
        'FAIL, not skip — it is not gated by DM_URL or any per-environment ' +
        `setup. Underlying error: ${error}`,
    );
  }

  if (!response.ok()) {
    throw new Error(
      `Org-metadata GET failed: ${response.status()} ${response.statusText()} — ${response.url()}`,
    );
  }

  const json = (await response.json()) as {
    metadata?: ObservedTenantMetadata;
  };
  return json.metadata ?? {};
}
