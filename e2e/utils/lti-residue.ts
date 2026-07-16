import type { Page } from '@playwright/test';

/**
 * Reap stale platform-wide LTI residue (tools first, then keys) left behind
 * by earlier e2e runs. Called once per worker from the journey 56 fixture.
 *
 * WHY: LTI keys and tools are TENANT-scoped, not mentor-scoped — deleting the
 * worker's ephemeral mentor does not remove them. The SDK's keys/tools
 * sections are server-paginated at 10 rows/page and ordered by name, so once
 * residue pushes the tenant past one page a newly created key/tool lands on
 * page 2+ — which is how `expectKeyInList` in lti-14 started failing. The
 * `LtiTab` page object now walks pages to find a row (see `revealRow`), so
 * this reaper is a hygiene measure: it keeps the tenant lists small so the
 * page-walk (and the signing-key select in the tool modal, which reads the
 * same list) stay fast and reliable rather than trawling many pages.
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
const MAX_PAGES = 20;

type LtiListItem = { id: number; title?: string; name?: string };

async function listAllPages(
  page: Page,
  url: string,
  headers: Record<string, string>,
): Promise<LtiListItem[]> {
  const items: LtiListItem[] = [];
  for (let p = 1; p <= MAX_PAGES; p++) {
    const res = await page.request.get(`${url}&page=${p}`, {
      headers,
      timeout: 15_000,
    });
    if (!res.ok()) break;
    const data = await res.json().catch(() => null);
    const results: LtiListItem[] = Array.isArray(data)
      ? data
      : (data?.results ?? []);
    items.push(...results);
    const numPages: number = Array.isArray(data) ? 1 : (data?.num_pages ?? 1);
    if (p >= numPages || results.length === 0) break;
  }
  return items;
}

function isStale(label: string | undefined): boolean {
  const match = label?.match(E2E_NAME_RE);
  return !!match && Date.now() - Number(match[1]) > STALE_AFTER_MS;
}

export async function reapStaleLtiResidue(page: Page): Promise<void> {
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!apiBase) return;

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

    const dm = `${apiBase}/dm/api/core/lti/1p3/provider`;
    const q = `?platform_key=${encodeURIComponent(platformKey)}`;
    const headers = { Authorization: `Token ${dmToken}` };

    // Tools first: a key referenced by a tool cannot be deleted.
    for (const resource of ['lti-tools', 'lti-keys'] as const) {
      const items = await listAllPages(page, `${dm}/${resource}/${q}`, headers);
      for (const item of items) {
        if (!isStale(item.title ?? item.name)) continue;
        await page.request
          .delete(`${dm}/${resource}/${item.id}/${q}`, {
            headers,
            timeout: 15_000,
          })
          .catch(() => {});
      }
    }
  } catch {
    // Best-effort janitor — never fail the caller.
  }
}
