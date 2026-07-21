import type { Page } from '@playwright/test';

/**
 * Reap stale platform-wide LTI residue (tools first, then keys) left behind
 * by earlier e2e runs. Called once per worker from the journey 60 fixture.
 *
 * WHY: LTI keys and tools are TENANT-scoped, not mentor-scoped — deleting the
 * worker's ephemeral mentor does not remove them. The SDK's keys/tools
 * sections are server-paginated at 10 rows/page and ordered by name, so once
 * residue pushes the tenant past one page a newly created key/tool lands on
 * page 2+ — which is how `expectKeyInList` in lti-14 started failing. The
 * `LtiTab` page object walks pages to find a row (see `revealRow`), but the
 * DM LTI proxy currently IGNORES the `page`/`page_size` query params (every
 * request returns page-1 rows with `previous: null`), so any row past the
 * first 10 is unreachable from the UI. Keeping the tenant lists under one
 * page via this reaper is therefore load-bearing, not just hygiene, until
 * the backend forwards pagination params.
 *
 * HOW: because `page=N` always returns page 1, walking pages is useless.
 * Instead we DRAIN page 1: fetch it, delete every stale e2e-named row on it,
 * and refetch — deletions pull later rows forward onto page 1. We stop when
 * a fetch yields no stale row, no delete succeeds (e.g. every remaining
 * stale key is still referenced by a tool), or the sweep cap is hit.
 *
 * SAFETY:
 *   • Only resources whose name matches the `LtiTab.uniqueName` pattern
 *     (`e2e-<type>-<Date.now()>-<rand5>`) are considered, and only when the
 *     embedded timestamp is older than STALE_AFTER_MS. Concurrent workers and
 *     parallel CI runs always use fresh timestamps, so live resources are
 *     never touched; manually created resources never match the pattern.
 *   • Tools are deleted before keys — the backend rejects deleting a key
 *     that a tool still references (400/409).
 *   • Everything is best-effort: races with sibling workers (404s), missing
 *     env, or missing tokens simply skip the sweep. Tests never fail here.
 */
const STALE_AFTER_MS = 2 * 60 * 60 * 1000; // 2 hours
const E2E_NAME_RE = /^e2e-[a-z-]+-(\d{13})-[a-z0-9]{5}$/;
const MAX_SWEEPS = 20;

type LtiListItem = { id: number | string; title?: string; name?: string };

function isStale(label: string | undefined): boolean {
  const match = label?.match(E2E_NAME_RE);
  return !!match && Date.now() - Number(match[1]) > STALE_AFTER_MS;
}

/**
 * Drain stale rows from a list endpoint whose pagination is broken (see
 * module doc): fetch page 1, delete stale rows, refetch until clean.
 */
async function drainStale(
  page: Page,
  listUrl: string,
  deleteUrl: (id: number | string) => string,
  headers: Record<string, string>,
): Promise<void> {
  for (let sweep = 0; sweep < MAX_SWEEPS; sweep++) {
    const res = await page.request.get(listUrl, { headers, timeout: 15_000 });
    if (!res.ok()) return;
    const data = await res.json().catch(() => null);
    const results: LtiListItem[] = Array.isArray(data)
      ? data
      : (data?.results ?? []);
    const stale = results.filter((item) => isStale(item.title ?? item.name));
    if (stale.length === 0) return;

    let deleted = 0;
    for (const item of stale) {
      const ok = await page.request
        .delete(deleteUrl(item.id), { headers, timeout: 15_000 })
        .then((r) => r.ok())
        .catch(() => false);
      if (ok) deleted++;
    }
    // Nothing deletable this sweep (e.g. keys still referenced by live
    // tools) — a refetch would yield the same rows forever, so stop.
    if (deleted === 0) return;
  }
}

export async function reapStaleLtiResidue(page: Page): Promise<void> {
  try {
    // CI sets DM_URL (see reusable-oci-test-runner.yml — the same var
    // tenant-metadata.ts uses); NEXT_PUBLIC_API_BASE_URL is only present in
    // local .env files, so it is the fallback, not the primary.
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

    const dm = `${dmBase}/api/core/lti/1p3/provider`;
    const q = `?platform_key=${encodeURIComponent(platformKey)}`;
    const headers = { Authorization: `Token ${dmToken}` };

    // Tools first: a key referenced by a tool cannot be deleted.
    for (const resource of ['lti-tools', 'lti-keys'] as const) {
      await drainStale(
        page,
        `${dm}/${resource}/${q}`,
        (id) => `${dm}/${resource}/${id}/${q}`,
        headers,
      );
    }
  } catch {
    // Best-effort janitor — never fail the caller.
  }
}
