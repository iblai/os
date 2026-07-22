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
 *   DELETE {NEXT_PUBLIC_API_BASE_URL}/dm/api/ai-mentor/orgs/{tenantKey}/users/{username}/{mentorId}/
 *   Authorization: Token {dm_token}
 *
 * The NEXT_PUBLIC_API_BASE_URL env var is already set in the app's .env.local
 * and is available to Playwright via the dotenv load in playwright.config.ts.
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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

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
    if (!API_BASE) {
      logger.warn(
        '[mentor-cleanup] NEXT_PUBLIC_API_BASE_URL is not set — skipping API delete',
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
    const url = `${API_BASE}/dm/api/ai-mentor/orgs/${encodeURIComponent(tenantKey)}/users/${encodeURIComponent(username)}/${encodeURIComponent(mentorId)}/`;

    const res = await page.request.delete(url, {
      headers: { Authorization: `Token ${dmToken}` },
      timeout: 20_000,
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

  /** Best-effort delete of all tracked mentors using a fresh browser context
   *  authenticated via the project's storageState. */
  async deleteAll(browser: Browser, testInfo: TestInfo): Promise<void> {
    if (this.ids.size === 0) return;

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

      for (const mentorId of this.ids) {
        await deleteMentorById(page, mentorId);
      }
      this.ids.clear();
    } catch (err) {
      logger.warn(`[MentorTracker] deleteAll failed: ${err}`);
    } finally {
      await ctx.close().catch(() => {});
    }
  }
}
