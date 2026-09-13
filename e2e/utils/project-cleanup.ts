/**
 * Project cleanup utilities for E2E tests (journey 26).
 *
 * Mirrors `mentor-cleanup.ts`'s API-first approach: cleanup is a direct
 * DELETE call rather than driving the UI, so it is fast, does not depend on
 * page state, and cannot itself flake.
 *
 * Provides three tools:
 *
 * 1. `findProjectIdByName(page, name)` — looks up a project's numeric id by
 *    its exact (unique, timestamped) name via the list endpoint. Used right
 *    after creation so teardown can delete by id even if the test renames
 *    the project mid-run.
 *
 * 2. `deleteProjectById(page, projectId)` — API-based best-effort delete of
 *    a single project by id. Reads axd_token, username, and tenantKey from
 *    localStorage so no extra credentials are needed. Falls back silently
 *    on any error (mirrors `deleteMentorById` in mentor-cleanup.ts).
 *
 * 3. `deleteProjectByName(page, name)` — convenience wrapper for callers
 *    that only have a name (no captured id), e.g. the dedicated "creates a
 *    project" test in 26-projects.spec.ts which intentionally does not use
 *    the `testProject` fixture.
 *
 * NOTE — no `ProjectTracker` class (unlike `MentorTracker` in
 * mentor-cleanup.ts): `MentorTracker` exists because several mentor journeys
 * (22, 42, 44, 47, 52) share ONE mentor across multiple tests in a
 * `describe` block and need a single `afterAll` batch-delete. Every journey
 * 26 project test is fully independent — each gets its own project via the
 * `testProject` fixture (see mentor-test.ts) and deletes it in that same
 * fixture's teardown — so there is no suite-shared project needing batch
 * tracking today. If a future journey-26 suite needs to share a project
 * across serial tests, add a `ProjectTracker` here following the exact same
 * shape as `MentorTracker` rather than inventing something new.
 *
 * API endpoints used (confirmed by capturing live network traffic against
 * the app — see `@iblai/data-layer`'s `PROJECTS_CUSTOM_ENDPOINTS`):
 *
 *   LIST:   GET    {dmBase}/api/ai-mentor/orgs/{tenantKey}/users/{username}/projects/
 *   DELETE: DELETE {dmBase}/api/ai-mentor/orgs/{tenantKey}/users/{username}/projects/{id}/
 *   Authorization: Token {axd_token}
 *
 * The DM base is resolved at runtime by `dm-api.ts` (env override, else read
 * off the app's own traffic) — the same contract mentor-cleanup.ts uses.
 *
 * NOTE the `/dm` base: projects are served by the "AXD" service in the
 * data-layer's service enum, but `getServiceUrl()` resolves AXD to the same
 * base as the DM service (`config.dmUrl()`), NOT `config.axdUrl()` — the
 * latter is defined but unused by the data-layer's URL resolution. This was verified
 * by capturing real requests, not just reading source, since the naming is
 * misleading. The AUTH TOKEN, however, does follow the AXD branch of
 * `getHeaders()` — it reads `axd_token` from localStorage, not `dm_token`.
 * Both tokens exist in localStorage after login, so this is easy to get
 * wrong silently (a `dm_token` would still be present and non-empty).
 *
 * The stale-project safety net lives in `utils/project-sweeper.ts` (mirrors
 * `utils/mentor-sweeper.ts`, wired into the same `globalTeardown` array in
 * playwright.config.ts) and reaps projects whose name matches
 * `E2E_PROJECT_RE` (see that file) and are older than its staleness window.
 *
 * SAFETY CONSTRAINTS (same as mentor-cleanup.ts):
 *   - Everything is best-effort: any error is caught and logged, not thrown.
 *   - DELETE is treated as successful on 2xx OR 404 — idempotent, so a
 *     project already removed by the test itself (e.g. the dedicated
 *     "delete project" test) never fails cleanup.
 */

import type { Page } from '@playwright/test';
import { logger } from '@iblai/iblai-js/playwright';

import { tryResolveDmApiBase } from './dm-api';

interface ProjectAuthContext {
  axdToken: string | null;
  username: string | null;
  tenantKey: string | null;
}

async function getProjectAuthContext(page: Page): Promise<ProjectAuthContext> {
  return page.evaluate(() => {
    const axdToken = localStorage.getItem('axd_token');

    let username: string | null = null;
    try {
      const raw = localStorage.getItem('userData');
      if (raw) username = JSON.parse(raw)?.user_nicename ?? null;
    } catch {
      // ignore
    }

    let tenantKey: string | null = null;
    try {
      const raw = localStorage.getItem('current_tenant');
      if (raw) {
        const parsed = JSON.parse(raw);
        tenantKey = typeof parsed === 'string' ? parsed : (parsed?.key ?? null);
      }
    } catch {
      // ignore
    }

    return { axdToken, username, tenantKey };
  });
}

async function projectsBaseUrl(
  page: Page,
  tenantKey: string,
  username: string,
): Promise<string | null> {
  const dmBase = await tryResolveDmApiBase(page, {
    allowReload: false,
    timeout: 10_000,
  });
  if (!dmBase) {
    logger.warn(
      '[project-cleanup] Could not resolve the DM API base (set DM_URL to override)',
    );
    return null;
  }
  return `${dmBase}/api/ai-mentor/orgs/${encodeURIComponent(tenantKey)}/users/${encodeURIComponent(username)}/projects/`;
}

/**
 * Looks up a project's id by its exact name via the list endpoint. Used
 * right after creation (name is guaranteed unique via `generateProjectName()`)
 * so the fixture can capture an id for reliable delete-by-id teardown even
 * after the test renames the project.
 *
 * Retries a couple of times with a short delay to absorb any read-after-write
 * lag, though in practice `ProjectPage.createFromSidebar` already re-queries
 * the index and asserts the card is visible before returning, so the list is
 * normally already consistent by the time this runs.
 */
export async function findProjectIdByName(
  page: Page,
  name: string,
): Promise<string | null> {
  const { axdToken, username, tenantKey } = await getProjectAuthContext(page);
  if (!axdToken || !username || !tenantKey) {
    logger.warn(
      `[project-cleanup] Missing auth context (axdToken=${!!axdToken}, username=${!!username}, tenantKey=${!!tenantKey}) — cannot look up project "${name}"`,
    );
    return null;
  }

  const base = await projectsBaseUrl(page, tenantKey, username);
  if (!base) return null;
  const url = `${base}?search=${encodeURIComponent(name)}&limit=50`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await page.request.get(url, {
        headers: { Authorization: `Token ${axdToken}` },
        timeout: 20_000,
      });
      if (res.ok()) {
        const data = await res.json().catch(() => null);
        const results: Array<{ id: number | string; name: string }> =
          Array.isArray(data) ? data : (data?.results ?? []);
        const match = results.find((p) => p.name === name);
        if (match) return String(match.id);
      }
    } catch (err) {
      logger.warn(`[project-cleanup] Lookup attempt ${attempt} failed: ${err}`);
    }
    if (attempt < 3) await page.waitForTimeout(1_000);
  }

  logger.warn(`[project-cleanup] Could not find project id for name "${name}"`);
  return null;
}

/**
 * Best-effort DELETE of a single project by id. Treats 2xx and 404 as
 * success (idempotent) so double-deletion (e.g. the test's own UI delete
 * plus fixture teardown) never fails.
 */
export async function deleteProjectById(
  page: Page,
  projectId: string,
): Promise<void> {
  try {
    if (!projectId) return;

    const { axdToken, username, tenantKey } = await getProjectAuthContext(page);
    if (!axdToken || !username || !tenantKey) {
      logger.warn(
        `[project-cleanup] Missing auth context (axdToken=${!!axdToken}, username=${!!username}, tenantKey=${!!tenantKey}) — skipping API delete for project ${projectId}`,
      );
      return;
    }

    const base = await projectsBaseUrl(page, tenantKey, username);
    if (!base) return;
    const url = `${base}${encodeURIComponent(projectId)}/`;
    const res = await page.request.delete(url, {
      headers: { Authorization: `Token ${axdToken}` },
      timeout: 20_000,
    });

    if (res.ok() || res.status() === 404) {
      logger.info(
        `[project-cleanup] Deleted project ${projectId} (status ${res.status()})`,
      );
    } else {
      logger.warn(
        `[project-cleanup] DELETE ${url} → ${res.status()} — project ${projectId} may not have been deleted`,
      );
    }
  } catch (err) {
    // Best-effort — a cleanup failure must never fail the test run.
    logger.warn(
      `[project-cleanup] Failed to delete project ${projectId}: ${err}`,
    );
  }
}

/**
 * Convenience wrapper for callers that only have a name (no captured id),
 * e.g. the dedicated "creates a project" test which intentionally does not
 * use the `testProject` fixture. Looks up the id, then deletes it.
 */
export async function deleteProjectByName(
  page: Page,
  name: string,
): Promise<void> {
  const id = await findProjectIdByName(page, name);
  if (id) await deleteProjectById(page, id);
}
