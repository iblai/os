import { Page, Request } from '@playwright/test';
import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, waitForAdmin } from '../utils/auth';
import { parsePlatformUrl, safeWaitForURL } from '../utils/navigation';
import { waitForPageReady } from '../utils/resilient';
import { MENTOR_NEXTJS_HOST } from '../fixtures/test-data';
import { ChatPage } from '../page-objects/chat.page';
import { MentorTracker } from '../utils/mentor-cleanup';
import { logger } from '@iblai/iblai-js/playwright';

/**
 * Journey 103 — Flagged Prompts show every user's blocks (iblai/iblai-platform#2885).
 *
 * Safety › View Flagged Prompts used to send `username=<admin>` as an exact
 * filter, used `users/undefined/` in its path and never read `safety-logs`, so
 * an admin only saw their own Moderation blocks. It now lists the agent's
 * blocks for every user, guests included, one type at a time: the Type select
 * offers exactly Moderation (default) and Safety, each backed by its own list
 * with plain server paging.
 *
 * REAL blocks: the admin creates an agent with a codeword Moderation prompt,
 * then a second user and a guest send prompts that trip it, and the admin
 * finds them in the dialog (fp-01..fp-03, fp-05, fp-08; fp-04's Moderation half too).
 *
 * STUBBED: iblai.org never wrote a Safety log in any attempt (Safety judges
 * the agent's reply; even a prompt that rejects every reply, on a clearly
 * unsafe answer, left `safety-logs/` empty), so Safety rows are `page.route`
 * stubs of `GET safety-logs/` (fp-04, fp-06), as is the paging case that
 * needs more than 5 rows in a list (fp-07). The real Moderation rows
 * and the real requests still pass through wherever a test does not stub them.
 *
 * Serial: every test reuses the one agent fp-01 provisions.
 */

const MODERATION_WORD = 'zebracrossing';
const OTHER_USER_MODERATION = `E2E user ${MODERATION_WORD} moderation`;
// The stored guest prompt can come back partly redacted ("[sensitive data]"),
// so rows from it are matched by their fixed ends.
const GUEST_MODERATION = `E2E guest ${MODERATION_WORD} moderation`;
const LATE_MODERATION = `E2E late user ${MODERATION_WORD} moderation`;
const MODERATION_PROMPT = `You are a strict content moderator. Flag ANY user message that contains the word "${MODERATION_WORD}" and explain that the codeword is not allowed. Never flag any other message.`;

type Fixture = { platformKey: string; mentorId: string };
let agent: Fixture;

type StubLog = { id: number; prompt: string; dateCreated: string };

function agentUrl({ platformKey, mentorId }: Fixture): string {
  return `${MENTOR_NEXTJS_HOST}/platform/${platformKey}/${mentorId}`;
}

async function openAgentAs(page: Page, url: string, id: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await safeWaitForURL(page, (u) => u.href.includes(id), { timeout: 60_000 });
  await waitForPageReady(page);
}

/**
 * Sends one chat message and waits for the verdict: a blocked prompt shows
 * the agent's refusal as a toast and no reply bubble.
 */
async function chatOnce(page: Page, text: string) {
  const chat = new ChatPage(page);
  await chat.sendMessage(text);
  await chat.aiMessages
    .first()
    .or(page.locator('[data-sonner-toast]').first())
    .waitFor({ state: 'visible', timeout: 120_000 });
  // The refusal toast stays until closed and covers the next send button.
  const toasts = page.locator('[data-sonner-toast]');
  while ((await toasts.count()) > 0) {
    await toasts.first().getByRole('button').first().click();
    await page.waitForTimeout(500);
  }
}

/** Collects every flagged-log request the dialog fires. */
function recordLogRequests(page: Page) {
  const urls: string[] = [];
  const onRequest = (req: Request) => {
    if (/\/(moderation|safety)-logs\//.test(req.url())) urls.push(req.url());
  };
  page.on('request', onRequest);
  return { urls, stop: () => page.off('request', onRequest) };
}

function logPage(kind: 'moderation' | 'safety', rows: StubLog[]) {
  const results = rows.map((r) => ({
    id: r.id,
    username: null,
    prompt: r.prompt,
    reason: `stub ${kind} reason`,
    mentor: agent.mentorId,
    date_created: r.dateCreated,
  }));
  return { count: results.length, next: null, previous: null, results };
}

/** Answers `GET <kind>-logs/` with `rows()`, honouring `page_size`. */
async function stubLogList(
  page: Page,
  kind: 'moderation' | 'safety',
  rows: () => StubLog[],
) {
  await page.route(new RegExp(`/${kind}-logs/(\\?|$)`), (route) => {
    const size = Number(
      new URL(route.request().url()).searchParams.get('page_size') ?? 5,
    );
    const all = rows();
    return route.fulfill({
      json: {
        ...logPage(kind, all),
        results: logPage(kind, all).results.slice(0, size),
      },
    });
  });
}

test.describe.configure({ mode: 'serial' });

test.describe('Journey 103: Flagged Prompts for all users', () => {
  const tracker = new MentorTracker();

  test.beforeEach(async ({ page }) => {
    test.setTimeout(300_000);
    await navigateToMentorApp(page);
    await waitForAdmin(page);
  });

  test.afterAll(async ({ browser }, testInfo) => {
    await tracker.deleteAll(browser, testInfo);
  });

  test('fp-01: admin creates an agent that blocks a codeword through Moderation, with Safety on', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate(`E2E Flagged Prompts ${Date.now()}`);
    const { platformKey, mentorId } = parsePlatformUrl(page.url());
    expect(mentorId, 'agent creation must put the id in the URL').toBeTruthy();
    tracker.add(mentorId);
    agent = { platformKey, mentorId };

    await editMentorPage.open('Settings');
    await editMentorPage.settings.setVisibility('Users');
    await editMentorPage.settings.setGuestChat(true);
    await editMentorPage.settings.saveConfirmingAdminVisibility();

    await editMentorPage.navigateToTab('Safety');
    const { safety } = editMentorPage;
    await safety.setPrompt('Moderation', MODERATION_PROMPT);
    await safety.setEnabled('Moderation', true);
    await safety.setEnabled('Safety', true);
    await editMentorPage.close();
  });

  test('fp-02: another user and a guest trip Moderation on the admin agent', async ({
    browser,
    nonadminPage,
  }) => {
    await openAgentAs(nonadminPage, agentUrl(agent), agent.mentorId);
    await chatOnce(nonadminPage, OTHER_USER_MODERATION);

    const guestContext = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    try {
      const guest = await guestContext.newPage();
      await openAgentAs(guest, agentUrl(agent), agent.mentorId);
      await chatOnce(guest, GUEST_MODERATION);
    } finally {
      await guestContext.close();
    }
  });

  test("fp-03: admin opens View Flagged Prompts on Moderation and sees another user's and a guest's blocks, from moderation-logs only", async ({
    page,
    editMentorPage,
  }) => {
    await openAgentAs(page, agentUrl(agent), agent.mentorId);
    await editMentorPage.open('Safety');
    const { safety } = editMentorPage;
    const requests = recordLogRequests(page);

    await safety.openFlaggedPrompts();
    await expect(safety.filterSelect).toContainText('Moderation');
    const userRow = safety.row(OTHER_USER_MODERATION);
    await expect(userRow).toBeVisible({ timeout: 30_000 });
    await expect(userRow).toContainText('Moderation');
    const guestRow = safety.row(/E2E guest .* moderation/);
    await expect(guestRow).toBeVisible();
    await expect(guestRow).toContainText('Unknown User');
    expect(await safety.total()).toBeGreaterThanOrEqual(2);
    expect(await safety.filterOptions()).toEqual(['Moderation', 'Safety']);

    requests.stop();
    logger.info(`fp-03: log requests: ${requests.urls.join(' | ')}`);
    expect(requests.urls.length).toBeGreaterThan(0);
    for (const url of requests.urls) {
      expect(url, 'only moderation-logs is read by default').toMatch(
        /\/moderation-logs\//,
      );
      expect(url, 'plain server paging').toContain('page=1&page_size=5');
      expect(url, 'no exact-match username filter').not.toMatch(
        /[?&]username=/,
      );
      expect(url, 'path carries a real user id').not.toContain(
        'users/undefined',
      );
    }
  });

  test('fp-04: admin switches the type and each list shows only its own rows, and the open detail clears (Safety stubbed)', async ({
    page,
    editMentorPage,
  }) => {
    const safetyRow: StubLog = {
      id: 9001,
      prompt: 'stub safety prompt newest',
      dateCreated: new Date(Date.now() + 60_000).toISOString(),
    };
    await stubLogList(page, 'safety', () => [safetyRow]);

    await openAgentAs(page, agentUrl(agent), agent.mentorId);
    await editMentorPage.open('Safety');
    const { safety } = editMentorPage;
    await safety.openFlaggedPrompts();
    await expect(safety.row(OTHER_USER_MODERATION)).toBeVisible({
      timeout: 30_000,
    });
    await expect(safety.row(safetyRow.prompt)).toHaveCount(0);

    await safety.row(OTHER_USER_MODERATION).click();
    await expect(safety.detailDeleteButton).toBeVisible();

    const requests = recordLogRequests(page);
    await safety.setFilter('Safety');
    await expect(safety.row(safetyRow.prompt)).toBeVisible();
    await expect(safety.row(safetyRow.prompt)).toContainText('Safety');
    await expect(safety.row(OTHER_USER_MODERATION)).toHaveCount(0);
    await expect(safety.row(/E2E guest /)).toHaveCount(0);
    expect(await safety.total()).toBe(1);
    await expect(
      safety.detailDeleteButton,
      'changing the type clears the open detail',
    ).toHaveCount(0);
    requests.stop();
    expect(requests.urls.length).toBeGreaterThan(0);
    for (const url of requests.urls) {
      expect(url, 'Safety reads safety-logs only').toMatch(/\/safety-logs\//);
    }

    await safety.setFilter('Moderation');
    await expect(safety.row(OTHER_USER_MODERATION)).toBeVisible();
    await expect(safety.row(safetyRow.prompt)).toHaveCount(0);
  });

  test('fp-05: admin reopens the dialog after a new block and sees it straight away', async ({
    page,
    editMentorPage,
    nonadminPage,
  }) => {
    await openAgentAs(page, agentUrl(agent), agent.mentorId);
    await editMentorPage.open('Safety');
    const { safety } = editMentorPage;
    await safety.openFlaggedPrompts();
    await expect(safety.row(OTHER_USER_MODERATION)).toBeVisible({
      timeout: 30_000,
    });
    await expect(safety.row(LATE_MODERATION)).toHaveCount(0);
    await safety.closeFlaggedPrompts();

    await openAgentAs(nonadminPage, agentUrl(agent), agent.mentorId);
    await chatOnce(nonadminPage, LATE_MODERATION);

    await safety.openFlaggedPrompts();
    await expect(safety.row(LATE_MODERATION)).toBeVisible({ timeout: 10_000 });
  });

  test('fp-06: admin deletes a Safety row and the request goes to safety-logs (Safety stubbed)', async ({
    page,
    editMentorPage,
  }) => {
    let rows: StubLog[] = [
      {
        id: 9002,
        prompt: 'stub safety prompt to delete',
        dateCreated: new Date(Date.now() + 60_000).toISOString(),
      },
    ];
    await stubLogList(page, 'safety', () => rows);
    await page.route(/\/safety-logs\/9002\/$/, (route) => {
      rows = [];
      return route.fulfill({ status: 204, body: '' });
    });

    await openAgentAs(page, agentUrl(agent), agent.mentorId);
    await editMentorPage.open('Safety');
    const { safety } = editMentorPage;
    await safety.openFlaggedPrompts();
    await safety.setFilter('Safety');
    await expect(safety.row('stub safety prompt to delete')).toBeVisible({
      timeout: 30_000,
    });

    const deletion = page.waitForRequest(
      (r) => r.method() === 'DELETE' && /logs\/\d+\/?$/.test(r.url()),
    );
    await safety.deleteRow('stub safety prompt to delete');
    expect((await deletion).url()).toMatch(/\/safety-logs\/9002\/$/);
    await expect(safety.row('stub safety prompt to delete')).toHaveCount(0, {
      timeout: 30_000,
    });
  });

  test('fp-07: admin pages within one type and only that list is asked for page 2 (Safety stubbed)', async ({
    page,
    editMentorPage,
  }) => {
    const rows: StubLog[] = Array.from({ length: 7 }, (_, i) => ({
      id: 9200 + i,
      prompt: `stub safety prompt ${i}`,
      dateCreated: new Date(Date.now() - i * 120_000).toISOString(),
    }));
    await page.route(/\/safety-logs\/(\?|$)/, (route) => {
      const params = new URL(route.request().url()).searchParams;
      const size = Number(params.get('page_size') ?? 5);
      const n = Number(params.get('page') ?? 1);
      return route.fulfill({
        json: {
          ...logPage('safety', rows),
          results: logPage('safety', rows).results.slice(
            (n - 1) * size,
            n * size,
          ),
        },
      });
    });

    await openAgentAs(page, agentUrl(agent), agent.mentorId);
    await editMentorPage.open('Safety');
    const { safety } = editMentorPage;
    await safety.openFlaggedPrompts();
    await safety.setFilter('Safety');

    await expect(safety.flaggedTotal).toContainText('7 Total');
    await expect
      .poll(() => safety.visiblePromptLines())
      .toEqual(rows.slice(0, 5).map((r) => r.prompt));

    const requests = recordLogRequests(page);
    await safety.goToPage(2);
    await expect
      .poll(() => safety.visiblePromptLines())
      .toEqual(rows.slice(5).map((r) => r.prompt));
    requests.stop();
    expect(requests.urls.length).toBeGreaterThan(0);
    for (const url of requests.urls) {
      expect(url).toMatch(/\/safety-logs\/.*page=2&page_size=5/);
    }
  });

  test('fp-08: admin deletes a real Moderation row and the request goes to moderation-logs', async ({
    page,
    editMentorPage,
  }) => {
    await openAgentAs(page, agentUrl(agent), agent.mentorId);
    await editMentorPage.open('Safety');
    const { safety } = editMentorPage;
    await safety.openFlaggedPrompts();
    await expect(safety.row(LATE_MODERATION)).toBeVisible({ timeout: 30_000 });

    const deletion = page.waitForRequest(
      (r) => r.method() === 'DELETE' && /logs\/\d+\/?$/.test(r.url()),
    );
    await safety.deleteRow(LATE_MODERATION);
    expect((await deletion).url()).toMatch(/\/moderation-logs\/\d+\/$/);
    await expect(safety.row(LATE_MODERATION)).toHaveCount(0, {
      timeout: 30_000,
    });
  });
});
