/**
 * Mentor cleanup utilities for E2E tests.
 *
 * Provides two tools:
 *
 * 1. `deleteMentorById(page, mentorId)` — API-based best-effort delete of a
 *    single mentor by its unique_id (the slug in the platform URL). Reads
 *    dm_token, username, and tenantKey from localStorage so no extra
 *    credentials are needed. Falls back silently on any error.
 *
 * 2. `MentorTracker` — legacy `afterAll` flush of this worker's
 *    `resource-tracker`. Mentors are registered by construction when
 *    `CreateMentorPage.createWithName` returns, so new specs need neither.
 *
 * API endpoint used:
 *   DELETE {dmBase}/api/ai-mentor/orgs/{tenantKey}/users/{username}/{mentorId}/
 *   Authorization: Token {dm_token}
 *
 * The DM base is resolved at runtime by `dm-api.ts` (env override, else read
 * off the app's own traffic) — playwright.config.ts loads `e2e/.env*`, not the
 * app's root `.env`, so NEXT_PUBLIC_API_BASE_URL is usually absent here.
 *
 * WHY API rather than UI:
 *   The UI path (`editMentorPage.settings.deleteMentor()`) requires the page
 *   to be navigated to the mentor's URL, the Edit Agent modal to be opened,
 *   and the confirmation dialog to be accepted. This is 3-5 network round
 *   trips + DOM interactions. A single DELETE request is faster, more robust
 *   (no UI flakiness), and does not depend on the page being in any
 *   particular state. The UI path is still used in journey 60's worker
 *   fixture where the page is already on the mentor URL — we keep parity
 *   with that approach where the API is not available.
 *
 * SAFETY CONSTRAINTS (enforced here):
 *   - Never deletes unless the mentorId is a known test-created id
 *     (callers are responsible; the API simply performs what is asked).
 *   - Everything is best-effort: any error is caught and logged, not thrown.
 *   - Use in `afterAll` (not `afterEach`) for suites that share one mentor
 *     across tests; use per-test `finally` blocks for self-contained tests.
 */

import type { Browser, TestInfo } from '@playwright/test';
import { logger } from '@iblai/iblai-js/playwright';

import { tryResolveDmApiBase } from './dm-api';
import { workerTracker } from './resource-tracker';

/**
 * Reads auth context from localStorage of an already-navigated page and
 * issues a DELETE request for the given mentorId (unique_id / slug).
 *
 * @param page  A Playwright Page that has already loaded the mentor app and
 *              has dm_token + userData + current_tenant in localStorage.
 * @param mentorId  The unique_id segment from the mentor's platform URL
 *                  (e.g. "my-mentor-1234").
 */
export async function deleteMentorById(
  page: import('@playwright/test').Page,
  mentorId: string,
): Promise<void> {
  try {
    // Resolved from live app traffic when no env override is present. This used
    // to gate on NEXT_PUBLIC_API_BASE_URL alone, which playwright.config.ts does
    // not load — so cleanup silently no-opped on every local run and leaked
    // every mentor the suite created. Reloading is disallowed here: cleanup must
    // not disturb whatever page state the caller still depends on.
    const dmBase = await tryResolveDmApiBase(page, {
      allowReload: false,
      timeout: 10_000,
    });
    if (!dmBase) {
      logger.warn(
        '[mentor-cleanup] Could not resolve the DM API base (set DM_URL to override) — skipping API delete',
      );
      return;
    }

    const { dmToken, username, tenantKey } = await page.evaluate(() => {
      const dmToken = localStorage.getItem('dm_token');

      // userData.user_nicename is what the app uses as userId in API calls
      let username: string | null = null;
      try {
        const raw = localStorage.getItem('userData');
        if (raw) username = JSON.parse(raw)?.user_nicename ?? null;
      } catch {
        // ignore
      }

      // current_tenant — either an object with .key or a bare string
      let tenantKey: string | null = null;
      try {
        const raw = localStorage.getItem('current_tenant');
        if (raw) {
          const parsed = JSON.parse(raw);
          tenantKey =
            typeof parsed === 'string' ? parsed : (parsed?.key ?? null);
        }
      } catch {
        // ignore
      }

      return { dmToken, username, tenantKey };
    });

    if (!dmToken || !username || !tenantKey) {
      logger.warn(
        `[mentor-cleanup] Missing auth context (dmToken=${!!dmToken}, username=${!!username}, tenantKey=${!!tenantKey}) — skipping API delete for mentor ${mentorId}`,
      );
      return;
    }

    // DM API lives under the `/dm` path on the API base (see config.dmUrl()).
    const url = `${dmBase}/api/ai-mentor/orgs/${encodeURIComponent(tenantKey)}/users/${encodeURIComponent(username)}/${encodeURIComponent(mentorId)}/`;

    // Deliberately short: cleanup runs inside afterAll's 120s budget, and a
    // DELETE that hangs is far more expensive than one left for the sweeper.
    const res = await page.request.delete(url, {
      headers: { Authorization: `Token ${dmToken}` },
      timeout: 10_000,
    });

    if (res.ok() || res.status() === 404) {
      logger.info(
        `[mentor-cleanup] Deleted mentor ${mentorId} (status ${res.status()})`,
      );
    } else {
      logger.warn(
        `[mentor-cleanup] DELETE ${url} → ${res.status()} — mentor ${mentorId} may not have been deleted`,
      );
    }
  } catch (err) {
    // Best-effort — a cleanup failure must never fail the test run.
    logger.warn(`[mentor-cleanup] Failed to delete mentor ${mentorId}: ${err}`);
  }
}

/**
 * Kept for the specs that predate by-construction registration (see
 * `resource-tracker.ts`). `add` is a no-op for ids the page object already
 * registered; `deleteAll` flushes this worker's tracker early, in `afterAll`,
 * instead of waiting for worker shutdown.
 */
export class MentorTracker {
  add(mentorId: string): void {
    if (mentorId && !workerTracker().hasMentor(mentorId)) {
      logger.warn(
        `[MentorTracker] ${mentorId} was not registered at creation — only the sweeper can reap it`,
      );
    }
  }

  async deleteAll(_browser: Browser, _testInfo: TestInfo): Promise<void> {
    await workerTracker().deleteAll();
  }
}
