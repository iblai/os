/**
 * Shared resolution of the DM API base URL for E2E utilities that talk to the
 * backend directly (seeding fixtures, cleaning up test data).
 *
 * The base is the `${apiBase}/dm` that the app's `config.dmUrl()` builds.
 *
 * WHY THIS ISN'T JUST AN ENV VAR:
 *   `NEXT_PUBLIC_API_BASE_URL` is the *app's* build-time config. In this repo
 *   it points at production, while the suite routinely runs against staging —
 *   trusting it would aim writes at the wrong environment. It is also simply
 *   absent from the Playwright process most of the time (playwright.config.ts
 *   loads `e2e/.env*`, not the app's root `.env`), which is why utilities that
 *   gate on it — the mentor/project sweepers — silently no-op and leak test
 *   data. Reading the base off the running app fixes both problems at once:
 *   whatever origin the app is really calling is by definition correct for the
 *   environment under test.
 */

import type { Page } from '@playwright/test';
import { logger } from '@iblai/iblai-js/playwright';

/** Matches any DM API call and captures everything before `/api/…`. */
const DM_API_URL_RE = /^(.*?)\/api\/(?:ai-index|ai-mentor|core)\//;

/** One resolved base per page — sniffing can cost a reload, so do it once. */
const dmBaseCache = new WeakMap<Page, string>();

/** Env overrides, most explicit first. `DM_URL` already exists in `.env.example`. */
function baseFromEnv(): string {
  const raw =
    process.env.DM_URL ||
    process.env.E2E_DM_API_BASE ||
    (process.env.NEXT_PUBLIC_API_BASE_URL
      ? `${process.env.NEXT_PUBLIC_API_BASE_URL}/dm`
      : '');
  return raw ? raw.replace(/\/+$/, '') : '';
}

/**
 * Resolves the DM API base for `page`, preferring an env override and otherwise
 * observing the app's own traffic.
 *
 * @param options.allowReload  When the app hasn't made a DM call yet, reload to
 *   force one. Callers that must not disturb page state can pass `false` and
 *   handle the thrown error.
 */
export async function resolveDmApiBase(
  page: Page,
  options: { allowReload?: boolean; timeout?: number } = {},
): Promise<string> {
  const { allowReload = true, timeout = 45_000 } = options;

  const cached = dmBaseCache.get(page);
  if (cached) return cached;

  const fromEnv = baseFromEnv();
  if (fromEnv) {
    dmBaseCache.set(page, fromEnv);
    return fromEnv;
  }

  const seen = (url: string): string | null => {
    const m = url.match(DM_API_URL_RE);
    return m ? m[1] : null;
  };

  // A DM call may already be in flight; if not, the reload below forces one.
  const pending = page
    .waitForRequest((req) => seen(req.url()) !== null, { timeout })
    .then((req) => seen(req.url()))
    .catch(() => null);

  if (allowReload) {
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  }

  const base = await pending;
  if (!base) {
    throw new Error(
      '[dm-api] Could not determine the DM API base — no /api/ai-index|ai-mentor|core request ' +
        'was observed. Set DM_URL to override.',
    );
  }

  logger.info(`[dm-api] Resolved DM API base from live traffic: ${base}`);
  dmBaseCache.set(page, base);
  return base;
}

/** Best-effort variant for cleanup paths that must never throw. */
export async function tryResolveDmApiBase(
  page: Page,
  options: { allowReload?: boolean; timeout?: number } = {},
): Promise<string | null> {
  try {
    return await resolveDmApiBase(page, options);
  } catch {
    return null;
  }
}
