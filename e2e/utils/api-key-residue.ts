import type { Page } from '@playwright/test';

/**
 * Reap stale platform-wide API-key residue left behind by earlier e2e runs
 * (crashed workers, a failed `afterAll`). Called once per worker from
 * journey 78's worker fixture, mirroring `lti-residue.ts` — see that file's
 * module doc for the general shape of this pattern.
 *
 * WHY: platform API keys (`/api/core/platform/api-tokens/`) are
 * TENANT-scoped, not mentor-scoped — deleting the worker's ephemeral mentor
 * never removes them. Unlike the LTI proxy, this endpoint's pagination is
 * NOT broken: a GET with no `page_size` returns every row as a bare array in
 * one request (see `unwrapApiTokenList` in the SDK's `api-keys` slice), so
 * this reaper is a straight list + filter + delete — no page-draining trick
 * needed.
 *
 * SAFETY:
 *   • Only names matching `E2E_API_KEY_RE` (produced by `ApiTab.uniqueName`,
 *     shape `e2e-apikey-<13-digit-ms-timestamp>-<5 char rand>`) are
 *     considered, and only when the embedded timestamp is older than
 *     `STALE_AFTER_MS`. The tenant's pre-existing manually-created keys
 *     (e.g. `pagination-test-7`, `test-api-key-sdk`) never match this
 *     pattern and are never touched.
 *   • Everything is best-effort: a missing env/token, a failed request, or
 *     any other error is swallowed — this never fails the caller.
 */
const STALE_AFTER_MS = 2 * 60 * 60 * 1000; // 2 hours
export const E2E_API_KEY_RE = /^e2e-apikey-(\d{13})-[a-z0-9]{5}$/;

interface ApiTokenListItem {
  name?: string;
}

function isStale(name: string | undefined): boolean {
  const match = name?.match(E2E_API_KEY_RE);
  return !!match && Date.now() - Number(match[1]) > STALE_AFTER_MS;
}

export async function reapStaleApiKeyResidue(page: Page): Promise<void> {
  try {
    // CI sets DM_URL; NEXT_PUBLIC_API_BASE_URL is only present in local .env
    // files (see the same fallback in lti-residue.ts).
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    const dmBase =
      process.env.DM_URL || (apiBase ? `${apiBase}/dm` : undefined);
    if (!dmBase) return;

    const { dmToken, rawTenant } = await page.evaluate(() => ({
      dmToken: localStorage.getItem('dm_token'),
      rawTenant: localStorage.getItem('current_tenant'),
    }));
    if (!dmToken || !rawTenant) return;

    // current_tenant is JSON — either an object with a `key` or a bare string.
    let platformKey: string;
    try {
      const parsed = JSON.parse(rawTenant);
      platformKey = typeof parsed === 'string' ? parsed : parsed?.key;
    } catch {
      platformKey = rawTenant;
    }
    if (!platformKey) return;

    const base = `${dmBase}/api/core/platform/api-tokens/`;
    const q = `?platform_key=${encodeURIComponent(platformKey)}`;
    const headers = { Authorization: `Token ${dmToken}` };

    const res = await page.request.get(`${base}${q}`, {
      headers,
      timeout: 20_000,
    });
    if (!res.ok()) return;
    const data = await res.json().catch(() => null);
    const results: ApiTokenListItem[] = Array.isArray(data)
      ? data
      : (data?.results ?? []);
    const stale = results.filter((item) => isStale(item.name));

    for (const item of stale) {
      if (!item.name) continue;
      await page.request
        .delete(`${base}${encodeURIComponent(item.name)}${q}`, {
          headers,
          timeout: 15_000,
        })
        .catch(() => null);
    }
  } catch {
    // Best-effort janitor — never fail the caller.
  }
}
