/**
 * Dataset seeding utilities for E2E tests.
 *
 * Some Datasets-tab behaviour only exists once a mentor holds more than one
 * page of datasets (the tab renders 5 per page and `IblPagination` renders
 * nothing when `totalPages <= 1`). Uploading that many files through the Add
 * Resource UI takes ~20s each, which is too slow and too flaky to do per test.
 *
 * WHY RUNTIME SEEDING RATHER THAN A PRE-SEEDED FIXTURE:
 *   The obvious shortcut — point the tests at a mentor someone seeded by hand
 *   and hard-code its tenant/id — does not survive contact with more than one
 *   environment. A mentor seeded on a developer's tenant 403s for the CI admin
 *   (who belongs to a different tenant entirely), so the tests fail on
 *   navigation instead of running. Everything needed to seed is already
 *   available at runtime: the tenant key, username and dm_token all live in
 *   localStorage after auth setup, and the mentor is whichever one the test
 *   just created. So a test seeds its own mentor and stays environment-neutral.
 *
 * API endpoints used (both under the DM base — see `dm-api.ts` for how that is
 * resolved without trusting the app's build-time env):
 *   POST {dmBase}/api/ai-index/orgs/{org}/users/{user}/documents/train/
 *     multipart/form-data — `type=file`, `pathway={mentorId}`, `file=<blob>`
 *   GET  {dmBase}/api/ai-index/orgs/{org}/users/{user}/documents/pathways/{mentorId}/
 *     the same list (limit/offset/search) the Datasets tab paginates over
 *
 * Seeding is two steps on purpose: `seedDatasetsForMentor` queues the uploads,
 * and `waitForDatasetsReady` waits for them to finish training. The second step
 * is not optional — see its doc comment for why a still-training fixture makes
 * the pagination control swallow clicks.
 */

import { expect, type Page } from '@playwright/test';
import { logger } from '@iblai/iblai-js/playwright';
import { resolveDmApiBase } from './dm-api';

type ApiContext = {
  dmToken: string;
  username: string;
  tenantKey: string;
};

/**
 * Reads the auth context the DM API needs out of localStorage. Mirrors
 * `mentor-cleanup.ts` — same keys, same `user_nicename`/`current_tenant`
 * handling — so the two utilities stay in step if the app ever renames them.
 */
async function readApiContext(page: Page): Promise<ApiContext> {
  const ctx = await page.evaluate(() => {
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
        tenantKey = typeof parsed === 'string' ? parsed : (parsed?.key ?? null);
      }
    } catch {
      // ignore
    }

    return { dmToken, username, tenantKey };
  });

  if (!ctx.dmToken || !ctx.username || !ctx.tenantKey) {
    throw new Error(
      `[dataset-seeding] Missing auth context in localStorage (dmToken=${!!ctx.dmToken}, ` +
        `username=${!!ctx.username}, tenantKey=${!!ctx.tenantKey}) — is the page navigated to the mentor app?`,
    );
  }

  return ctx as ApiContext;
}

function documentsBaseUrl(
  dmBase: string,
  { tenantKey, username }: ApiContext,
): string {
  return (
    `${dmBase}/api/ai-index/orgs/${encodeURIComponent(tenantKey)}` +
    `/users/${encodeURIComponent(username)}/documents`
  );
}

/**
 * Uploads `count` tiny text documents to `mentorId` via the training API.
 *
 * Unlike the UI upload path this is a single request per document, so a full
 * multi-page fixture costs a few seconds rather than a couple of minutes. The
 * requests are issued together — the backend queues them independently.
 *
 * @returns the number of documents that were accepted.
 */
export async function seedDatasetsForMentor(
  page: Page,
  mentorId: string,
  count: number,
): Promise<number> {
  const dmBase = await resolveDmApiBase(page);
  const ctx = await readApiContext(page);
  const trainUrl = `${documentsBaseUrl(dmBase, ctx)}/train/`;
  // Unique per run so repeat runs (and parallel workers) never collide on
  // a filename, and so a search for the stamp matches only this test's data.
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const responses = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      page.request.post(trainUrl, {
        headers: { Authorization: `Token ${ctx.dmToken}` },
        multipart: {
          type: 'file',
          pathway: mentorId,
          file: {
            name: `e2e-dataset-${stamp}-${i + 1}.txt`,
            mimeType: 'text/plain',
            buffer: Buffer.from(
              `E2E pagination fixture document ${i + 1} (${stamp}).\n`,
            ),
          },
        },
        timeout: 30_000,
      }),
    ),
  );

  const accepted = responses.filter((res) => res.ok()).length;
  const rejected = responses.filter((res) => !res.ok());
  if (rejected.length > 0) {
    logger.warn(
      `[dataset-seeding] ${rejected.length}/${count} document uploads failed ` +
        `(first status ${rejected[0].status()}) for mentor ${mentorId}`,
    );
  }

  logger.info(
    `[dataset-seeding] Seeded ${accepted}/${count} datasets on mentor ${mentorId}`,
  );
  return accepted;
}

/**
 * Polls the same list endpoint the Datasets tab reads until `mentorId` holds at
 * least `minCount` documents AND none of them is still `pending`.
 *
 * Both halves matter. The count half is obvious — seeding is queued
 * server-side, so documents lag the upload response by a beat.
 *
 * The "nothing pending" half is what makes the pagination tests deterministic.
 * `AgentDatasetsTab` renders the injected pagination with
 * `disabled={isDatasetsFetching || isDatasetsLoading}`, and
 * `useDatasetsWithPagination` sets `pollingInterval: 2000` for as long as any
 * document is `pending`. So while training runs, the pagination control flips
 * disabled every two seconds — `IblPagination` returns early from `onClick`
 * when disabled, which silently swallows page clicks that Playwright considers
 * actionable. Waiting for training to settle removes the flapping at its
 * source rather than retrying clicks against it. Tiny text documents settle in
 * roughly 10-15s.
 */
export async function waitForDatasetsReady(
  page: Page,
  mentorId: string,
  minCount: number,
  { countTimeout = 90_000, trainingTimeout = 120_000 } = {},
): Promise<void> {
  const dmBase = await resolveDmApiBase(page);
  const ctx = await readApiContext(page);
  const listUrl =
    `${documentsBaseUrl(dmBase, ctx)}/pathways/${encodeURIComponent(mentorId)}/` +
    `?limit=${minCount + 10}&offset=0`;

  const fetchState = async (): Promise<{
    total: number;
    pending: number;
  } | null> => {
    try {
      const res = await page.request.get(listUrl, {
        headers: { Authorization: `Token ${ctx.dmToken}` },
        timeout: 20_000,
      });
      if (!res.ok()) return null;
      const body = (await res.json()) as {
        count?: number;
        results?: { training_status?: string }[];
      };
      const results = body.results ?? [];
      return {
        total: body.count ?? results.length,
        pending: results.filter((r) => r.training_status === 'pending').length,
      };
    } catch {
      return null;
    }
  };

  // The documents existing at all is non-negotiable — without them there is
  // nothing to paginate and the test would assert against an empty tab.
  await expect
    .poll(async () => (await fetchState())?.total ?? -1, {
      timeout: countTimeout,
      message: `Expected mentor ${mentorId} to hold at least ${minCount} seeded datasets`,
    })
    .toBeGreaterThanOrEqual(minCount);

  // Training settling is only an optimisation, so it is best-effort. While a
  // document is pending the tab polls every 2s and re-renders the pagination
  // with disabled={isDatasetsFetching}, and IblPagination drops onClick while
  // disabled — so waiting makes clicks land first time. But a loaded backend
  // can take minutes, and failing the test over it is wrong: the fixture is
  // present and DatasetsTab.goToPage retries through the disabled window.
  const deadline = Date.now() + trainingTimeout;
  let state = await fetchState();
  while (state && state.pending > 0 && Date.now() < deadline) {
    await page.waitForTimeout(2_000);
    state = await fetchState();
  }

  if (state && state.pending > 0) {
    logger.warn(
      `[dataset-seeding] ${state.pending}/${state.total} documents on mentor ${mentorId} are ` +
        'still training after the wait budget — continuing; pagination clicks will retry ' +
        'through the disabled window.',
    );
  }
}
