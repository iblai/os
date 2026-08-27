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
 * 2. `MentorTracker` — a simple accumulator a spec can use to register
 *    created mentor ids and then wipe them all in `afterAll`. Example:
 *
 *    ```ts
 *    const tracker = new MentorTracker();
 *
 *    test.beforeEach(async ({ page, createMentorPage }) => {
 *      await createMentorPage.openAndCreate();
 *      const { mentorId } = await getPlatformContext(page);
 *      tracker.add(mentorId);
 *    });
 *
 *    test.afterAll(async ({ browser }, testInfo) => {
 *      await tracker.deleteAll(browser, testInfo);
 *    });
 *    ```
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
import path from 'path';

import { tryResolveDmApiBase } from './dm-api';

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
 * Accumulates mentor ids created during a describe block and batch-deletes
 * them in `afterAll`. Thread-safe within a single worker (tests inside one
 * describe run sequentially). Each spec file should create its own instance.
 */
export class MentorTracker {
  private readonly ids: Set<string> = new Set();

  /** Register a mentorId so it is cleaned up in deleteAll(). */
  add(mentorId: string): void {
    if (mentorId) this.ids.add(mentorId);
  }

  /**
   * Best-effort delete of all tracked mentors using a fresh browser context
   * authenticated via the project's storageState.
   *
   * Bounded by `budgetMs` (default 60s) because callers run this from
   * `afterAll`, whose own timeout is 120s. Cleanup previously cost nothing —
   * it bailed out immediately on a missing env var — so suites with many
   * tracked mentors never noticed it. Now that it really issues requests, an
   * unbounded loop of slow DELETEs can exhaust the hook budget and fail the
   * whole suite (observed on journeys 44/47/66). Leaving a few mentors behind
   * is strictly better than failing a green run, so this stops at the deadline
   * and says what it skipped.
   */
  async deleteAll(
    browser: Browser,
    testInfo: TestInfo,
    budgetMs = 60_000,
  ): Promise<void> {
    if (this.ids.size === 0) return;
    const deadline = Date.now() + budgetMs;

    // Derive the browser storageState from the project name, matching how
    // journeys 14 and 60 do it.
    const browserKey = testInfo.project.name
      .replace('mentor-desktop-', '')
      .toLowerCase();
    const authFile = path.join(
      __dirname,
      `../../playwright/.auth/user-${browserKey}.json`,
    );

    const ctx = await browser.newContext({ storageState: authFile });
    try {
      const page = await ctx.newPage();

      const mentorNextjsHost = process.env.MENTOR_NEXTJS_HOST || '';
      if (mentorNextjsHost) {
        // Navigate to the app to hydrate localStorage with dm_token etc.
        try {
          await page.goto(mentorNextjsHost, {
            waitUntil: 'domcontentloaded',
            timeout: 60_000,
          });

          // Warm the DM-base cache once on this throwaway page. A reload is
          // safe here (nothing depends on its state) and guarantees the traffic
          // to sniff, so the per-mentor deletes below can't no-op just because
          // the app happened to be idle during their short lookup.
          //
          // This runs BEFORE the dm_token wait on purpose: the reload it may
          // trigger tears down the execution context, and any evaluate racing
          // that teardown dies with "Execution context was destroyed". Doing it
          // first means the wait below re-settles the page afterwards.
          await tryResolveDmApiBase(page, {
            allowReload: true,
            timeout: 15_000,
          });

          // Wait until dm_token is available in localStorage (set by AuthProvider).
          await page
            .waitForFunction(() => !!window.localStorage.getItem('dm_token'), {
              timeout: 30_000,
            })
            .catch(() => {
              /* best-effort — proceed even if dm_token never shows up */
            });
        } catch {
          // Navigation failure — proceed anyway, deleteMentorById will
          // detect missing tokens and bail out gracefully.
        }
      }

      // Deletes are independent, so run them a few at a time rather than
      // strictly serially — a suite with a dozen tracked mentors would
      // otherwise spend longer queueing than deleting. Re-check the deadline
      // between batches so a stalled backend can't run past the hook budget.
      const pending = [...this.ids];
      const BATCH = 4;
      let skipped = 0;

      while (pending.length > 0) {
        if (Date.now() >= deadline) {
          skipped = pending.length;
          break;
        }
        const batch = pending.splice(0, BATCH);
        await Promise.all(batch.map((id) => deleteMentorById(page, id)));
      }

      if (skipped > 0) {
        logger.warn(
          `[MentorTracker] Cleanup budget exhausted — ${skipped} mentor(s) left undeleted. ` +
            'They will be picked up by the sweeper, if one is configured.',
        );
      }
      this.ids.clear();
    } catch (err) {
      logger.warn(`[MentorTracker] deleteAll failed: ${err}`);
    } finally {
      await ctx.close().catch(() => {});
    }
  }
}
