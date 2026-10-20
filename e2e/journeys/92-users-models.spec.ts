/**
 * Journey 92 — User Models (iblai-platform#2675)
 *
 * A tenant admin picks which models the organization's users may use, from
 * the "User Models" button on the agent's LLM tab. The dialog reads
 * GET /rbac/llm-access/status/ and every tick auto-saves the whole list with
 * POST /rbac/llm-access/set/ (the list is replaced, saves are serialized and
 * the last state wins; a failed save reverts the tick).
 *
 * The tenant is real, so BOTH llm-access routes are mocked in every test and
 * the captured POST bodies are asserted; no real POST is ever sent and the
 * agent's own model is never changed. Nothing is created.
 */

import type { Page, Route } from '@playwright/test';
import { test, expect } from '../fixtures/mentor-test';
import { MENTOR_NEXTJS_HOST, generateMentorName } from '../fixtures/test-data';
import { resolveDmApiBase } from '../utils/dm-api';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';

interface Mock {
  /** Bodies of mocked agent-settings PUTs (never forwarded to the real agent). */
  settingsPuts: string[];
  posts: { platform_key: string; llm_resources: string[] }[];
  statusCalls: () => number;
}

interface MockOptions {
  /** What the agent's "Allow In-Chat Model Change" switch reads as (default on). */
  inChat?: boolean;
  resources?: string[];
  statusCode?: number;
  /** Per-POST override: return a status (and body) or undefined to succeed. */
  setResponse?: (
    index: number,
    body: { llm_resources: string[] },
  ) => { status: number; body?: unknown; delayMs?: number } | undefined;
}

async function mockLlmAccess(
  page: Page,
  options: MockOptions = {},
): Promise<Mock> {
  const mock: Mock = {
    settingsPuts: [],
    posts: [],
    statusCalls: () => statusCalls,
  };
  let inChat = options.inChat ?? true;
  let statusCalls = 0;
  let resources = options.resources ?? [];

  // The real agent's switch must stay as it is: reads report `inChat`, and a
  // PUT is captured, applied to `inChat` and answered here, never sent on.
  await page.route(
    /\/mentors\/[^/]+\/settings\/?(\?|$)/,
    async (route: Route) => {
      const method = route.request().method();
      if (method === 'GET') {
        const response = await route.fetch();
        const json = await response.json();
        await route.fulfill({
          response,
          json: { ...json, enable_in_chat_llm_change: inChat },
        });
        return;
      }
      if (method === 'PUT' || method === 'PATCH') {
        const body = route.request().postDataBuffer()?.toString('utf8') ?? '';
        mock.settingsPuts.push(body);
        const match = body.match(
          /name="enable_in_chat_llm_change"\r?\n\r?\n(true|false)|"enable_in_chat_llm_change"\s*:\s*(true|false)/,
        );
        if (match) inChat = (match[1] ?? match[2]) === 'true';
        const real = await route.fetch({ method: 'GET' });
        const json = await real.json();
        await route.fulfill({
          status: 200,
          json: { ...json, enable_in_chat_llm_change: inChat },
        });
        return;
      }
      await route.continue();
    },
  );

  await page.route(/\/rbac\/llm-access\/status\//, async (route: Route) => {
    statusCalls += 1;
    if (options.statusCode && options.statusCode !== 200) {
      await route.fulfill({
        status: options.statusCode,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'mocked' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ llm_resources: resources }),
    });
  });

  await page.route(/\/rbac\/llm-access\/set\//, async (route: Route) => {
    const body = route.request().postDataJSON();
    const index = mock.posts.length;
    mock.posts.push(body);
    const override = options.setResponse?.(index, body);
    if (override?.delayMs)
      await new Promise((r) => setTimeout(r, override.delayMs));
    if (override && override.status >= 400) {
      await route.fulfill({
        status: override.status,
        contentType: 'application/json',
        body: JSON.stringify(override.body ?? { detail: 'mocked' }),
      });
      return;
    }
    resources = body.llm_resources;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ llm_resources: resources }),
    });
  });

  // The settings query is already cached from the page load; reload so the
  // mocked switch state is what the edit window reads.
  if (options.inChat === false) {
    await page.reload();
    await waitForPageReady(page);
  }

  return mock;
}

test.describe('Journey 92: User Models', () => {
  test.setTimeout(180_000);

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    if (!(await checkAdminStatus(page))) {
      test.skip(true, 'Requires admin access');
    }
  });

  test('um-01: admin sees User Models on the LLM tab; it opens the dialog with provider cards and "All allowed" under llms/', async ({
    page,
    editMentorPage,
  }) => {
    const mock = await mockLlmAccess(page, { resources: ['llms/'] });
    await editMentorPage.open('LLM');
    const um = editMentorPage.llm.usersModels;

    await um.open();
    await expect(um.providerCards.first()).toBeVisible({ timeout: 15_000 });
    const provider = await um.providerCards
      .first()
      .getAttribute('data-provider');
    await expect(um.count(provider!)).toHaveText(/all allowed/i);
    expect(mock.statusCalls()).toBeGreaterThan(0);
    expect(mock.posts).toHaveLength(0);
  });

  test('um-02: ticking models auto-saves the full list each time; unticking the last asks to confirm and saves []', async ({
    page,
    editMentorPage,
  }) => {
    const mock = await mockLlmAccess(page);
    await editMentorPage.open('LLM');
    const um = editMentorPage.llm.usersModels;
    await um.open();
    await expect(um.providerCards.first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('users-models-loading')).toHaveCount(0);
    const { tenantKey } = await getPlatformContext(page);

    const provider = await um.firstProviderWithModels(3);
    await um.openProvider(provider);
    const [a, b] = await um.modelNames(provider);
    const path = (m: string) => `llms/${provider}/models/${m}`;

    await um.model(provider, a).click();
    await expect(um.model(provider, a)).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => mock.posts.length).toBe(1);
    expect(mock.posts[0]).toEqual({
      platform_key: tenantKey,
      llm_resources: [path(a)],
    });

    await um.model(provider, b).click();
    await expect.poll(() => mock.posts.length).toBe(2);
    expect(mock.posts[1].llm_resources).toEqual([path(a), path(b)].sort());

    await um.model(provider, a).click();
    await expect(um.model(provider, a)).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await expect.poll(() => mock.posts.length).toBe(3);
    expect(mock.posts[2].llm_resources).toEqual([path(b)]);

    // Last model: confirm dialog first; Cancel keeps it and sends nothing.
    await um.model(provider, b).click();
    await expect(um.confirmEmptySave).toBeVisible();
    await um.confirmEmptyCancel.click();
    await expect(um.model(provider, b)).toHaveAttribute('aria-checked', 'true');
    expect(mock.posts).toHaveLength(3);

    await um.model(provider, b).click();
    await um.confirmEmptySave.click();
    await expect.poll(() => mock.posts.length).toBe(4);
    expect(mock.posts[3].llm_resources).toEqual([]);
    await expect(um.model(provider, b)).toHaveAttribute(
      'aria-checked',
      'false',
    );

    await um.done.click();
    await expect(um.dialog).toBeVisible();
  });

  test('um-03: "Allow all" saves the provider path and the card shows "All allowed"', async ({
    page,
    editMentorPage,
  }) => {
    const mock = await mockLlmAccess(page);
    await editMentorPage.open('LLM');
    const um = editMentorPage.llm.usersModels;
    await um.open();
    await expect(um.providerCards.first()).toBeVisible({ timeout: 15_000 });
    const provider = (await um.providerCards
      .first()
      .getAttribute('data-provider'))!;

    await um.openProvider(provider);
    await um.allowAll(provider).click();
    await expect.poll(() => mock.posts.length).toBe(1);
    expect(mock.posts[0].llm_resources).toEqual([`llms/${provider}/`]);

    await um.done.click();
    await expect(um.count(provider)).toHaveText(/all allowed/i);
  });

  test('um-04: a partial selection shows "N of M allowed" on the card, and the saved list is shown on reopen', async ({
    page,
    editMentorPage,
  }) => {
    const mock = await mockLlmAccess(page);
    await editMentorPage.open('LLM');
    const um = editMentorPage.llm.usersModels;
    await um.open();
    await expect(um.providerCards.first()).toBeVisible({ timeout: 15_000 });
    const provider = await um.firstProviderWithModels(3);
    await um.openProvider(provider);
    const names = await um.modelNames(provider);

    await um.model(provider, names[0]).click();
    await expect.poll(() => mock.posts.length).toBe(1);
    await um.done.click();
    await expect(um.count(provider)).toHaveText(
      new RegExp(`^1 of ${names.length} allowed$`),
    );

    await page.keyboard.press('Escape');
    await expect(um.dialog).not.toBeVisible();
    await um.open();
    await expect(um.count(provider)).toHaveText(/1 of \d+ allowed/);
  });

  test('um-05: rapid ticks are saved one at a time and the last state wins', async ({
    page,
    editMentorPage,
  }) => {
    const mock = await mockLlmAccess(page, {
      setResponse: (index) =>
        index === 0 ? { status: 200, delayMs: 1500 } : undefined,
    });
    await editMentorPage.open('LLM');
    const um = editMentorPage.llm.usersModels;
    await um.open();
    await expect(um.providerCards.first()).toBeVisible({ timeout: 15_000 });
    const provider = await um.firstProviderWithModels(3);
    await um.openProvider(provider);
    const [a, b, c] = await um.modelNames(provider);

    await um.model(provider, a).click();
    await um.model(provider, b).click();
    await um.model(provider, c).click();

    await expect.poll(() => mock.posts.length, { timeout: 15_000 }).toBe(2);
    expect(mock.posts[0].llm_resources).toEqual([
      `llms/${provider}/models/${a}`,
    ]);
    expect(mock.posts[1].llm_resources).toEqual(
      [a, b, c].map((m) => `llms/${provider}/models/${m}`).sort(),
    );
    await page.waitForTimeout(1_000);
    expect(mock.posts).toHaveLength(2);
  });

  test('um-06: a 400 reverts the tick and shows the rejected entry; "Remove it" saves the list without it', async ({
    page,
    editMentorPage,
  }) => {
    let rejectedPath = '';
    const mock = await mockLlmAccess(page, {
      resources: [],
      setResponse: (index, body) => {
        if (index !== 0) return undefined;
        rejectedPath = body.llm_resources[0];
        return {
          status: 400,
          body: { llm_resources: [`Unknown resource '${rejectedPath}'`] },
        };
      },
    });
    await editMentorPage.open('LLM');
    const um = editMentorPage.llm.usersModels;
    await um.open();
    await expect(um.providerCards.first()).toBeVisible({ timeout: 15_000 });
    const provider = await um.firstProviderWithModels(2);
    await um.openProvider(provider);
    const [a] = await um.modelNames(provider);

    await um.model(provider, a).click();
    await expect(um.saveError).toBeVisible({ timeout: 15_000 });
    await expect(um.model(provider, a)).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(rejectedPath).toBe(`llms/${provider}/models/${a}`);
    await expect(um.removeRejected).toBeVisible();
    expect(mock.posts).toHaveLength(1);
  });

  for (const status of [403, 500]) {
    test(`um-0${status === 403 ? 7 : 8}: a ${status} on save reverts the tick and shows a message`, async ({
      page,
      editMentorPage,
    }) => {
      const mock = await mockLlmAccess(page, {
        setResponse: () => ({ status }),
      });
      await editMentorPage.open('LLM');
      const um = editMentorPage.llm.usersModels;
      await um.open();
      await expect(um.providerCards.first()).toBeVisible({ timeout: 15_000 });
      const provider = (await um.providerCards
        .first()
        .getAttribute('data-provider'))!;
      await um.openProvider(provider);
      const [a] = await um.modelNames(provider);

      await um.model(provider, a).click();
      await expect.poll(() => mock.posts.length, { timeout: 15_000 }).toBe(1);
      await expect(
        page.getByText(
          status === 403
            ? /only admins can change/i
            : /couldn.t save your changes/i,
        ),
      ).toBeVisible({ timeout: 90_000 });
      await expect(um.model(provider, a)).toHaveAttribute(
        'aria-checked',
        'false',
      );
    });
  }

  for (const [status, testId, id] of [
    [403, 'users-models-forbidden', 'um-09'],
    [404, 'users-models-unavailable', 'um-10'],
    [500, 'users-models-load-error', 'um-11'],
  ] as const) {
    test(`${id}: a ${status} loading the saved list shows the matching notice instead of the cards`, async ({
      page,
      editMentorPage,
    }) => {
      const mock = await mockLlmAccess(page, { statusCode: status });
      await editMentorPage.open('LLM');
      const um = editMentorPage.llm.usersModels;
      await um.open();
      // 5xx is retried with backoff by the data layer before the error shows.
      await expect(page.getByTestId(testId)).toBeVisible({ timeout: 90_000 });
      await expect(um.providerCards).toHaveCount(0);
      expect(mock.posts).toHaveLength(0);
    });
  }

  test('um-12: Escape closes the dialog, and the LLM tab behind it has no counts or checkboxes', async ({
    page,
    editMentorPage,
  }) => {
    await mockLlmAccess(page, { resources: ['llms/'] });
    await editMentorPage.open('LLM');
    const um = editMentorPage.llm.usersModels;

    await expect(editMentorPage.llm.providerCards.first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.locator('[data-testid^="users-models-count-"]'),
    ).toHaveCount(0);
    await expect(
      editMentorPage.llm.providerCards.first().getByRole('checkbox'),
    ).toHaveCount(0);

    await um.open();
    await page.keyboard.press('Escape');
    await expect(um.dialog).not.toBeVisible();
    await expect(um.openButton).toBeVisible();
  });

  test('um-14: "Allow In-Chat Model Change" is on the LLM tab and no longer under Settings > Capabilities', async ({
    page,
    editMentorPage,
  }) => {
    await mockLlmAccess(page);
    await editMentorPage.open('LLM');
    await expect(editMentorPage.llm.inChatModelChangeToggle).toBeVisible({
      timeout: 30_000,
    });
    await expect(editMentorPage.llm.inChatModelChangeToggle).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await editMentorPage.open('Settings');
    await editMentorPage.settings.selectSubTab('Capabilities');
    await expect(
      editMentorPage.dialog.getByRole('switch', { name: /in-chat model/i }),
    ).toHaveCount(0);
    await expect(
      editMentorPage.dialog.getByTestId('llm-in-chat-model-change-toggle'),
    ).toHaveCount(0);
  });

  test('um-15: with the switch off there is no Models Users Can Pick box or button; flipping it on shows the box with the allowed count, and flipping it off hides it again', async ({
    page,
    editMentorPage,
  }) => {
    const mock = await mockLlmAccess(page, {
      inChat: false,
      resources: ['llms/'],
    });
    await editMentorPage.open('LLM');
    const llm = editMentorPage.llm;
    await expect(llm.inChatModelChangeToggle).toHaveAttribute(
      'aria-checked',
      'false',
      { timeout: 30_000 },
    );
    await expect(llm.usersModelsSummary).toHaveCount(0);
    await expect(llm.usersModels.openButton).toHaveCount(0);

    const on = await llm.setInChatModelChange(true);
    expect(on).toMatch(
      /name="enable_in_chat_llm_change"\r?\n\r?\ntrue|"enable_in_chat_llm_change"\s*:\s*true/,
    );
    await expect(llm.usersModelsSummary).toContainText('Models Users Can Pick');
    await expect(llm.usersModelsSummaryCount).toHaveText(
      'All models allowed for users',
    );
    await expect(llm.usersModels.openButton).toBeVisible();

    const off = await llm.setInChatModelChange(false);
    expect(off).toMatch(
      /name="enable_in_chat_llm_change"\r?\n\r?\nfalse|"enable_in_chat_llm_change"\s*:\s*false/,
    );
    await expect(llm.usersModelsSummary).toHaveCount(0);
    await expect(llm.usersModels.openButton).toHaveCount(0);
    expect(mock.settingsPuts).toHaveLength(2);
    expect(mock.posts).toHaveLength(0);
  });

  test('um-16: the box counts the models allowed for users', async ({
    page,
    editMentorPage,
  }) => {
    await mockLlmAccess(page, { resources: [] });
    await editMentorPage.open('LLM');
    await expect(editMentorPage.llm.usersModelsSummaryCount).toHaveText(
      /^0 models allowed for users$/,
      { timeout: 30_000 },
    );
  });

  test('um-13: a non-admin opening the agent LLM tab sees no User Models button', async ({
    page,
    nonadminPage,
  }) => {
    const { tenantKey, mentorId } = await getPlatformContext(page);
    const modal = encodeURIComponent(
      JSON.stringify([{ name: 'edit_mentor', tab: 'llm' }]),
    );
    await nonadminPage.goto(
      `${MENTOR_NEXTJS_HOST}/platform/${tenantKey}/${mentorId}?modal=${modal}`,
    );
    await waitForPageReady(nonadminPage);
    await expect(
      nonadminPage.locator(
        'button[aria-label="Selected agent dropdown button"]',
      ),
    ).toBeVisible({ timeout: 30_000 });
    const editDialog = nonadminPage.getByRole('dialog', { name: 'Edit Agent' });
    let editorOpened = false;
    try {
      await editDialog.waitFor({ state: 'visible', timeout: 15_000 });
      editorOpened = true;
    } catch {
      editorOpened = false;
    }
    if (editorOpened) {
      await expect(
        editDialog.getByPlaceholder(/search providers/i),
      ).toBeVisible({ timeout: 30_000 });
    }
    await expect(
      nonadminPage.getByTestId('llm-users-models-button'),
    ).toHaveCount(0);
    await expect(nonadminPage.getByTestId('users-models-dialog')).toHaveCount(
      0,
    );
  });
});

/**
 * Real, unmocked: what an admin allows is what users can pick in chat.
 *
 * Touches the REAL tenant list, so it is serial, snapshots the list before the
 * first change and puts it back in afterAll (also when a test fails). The
 * agent is a throw-away one (cheap ibl.ai model), so its own switch needs no
 * restore. The allowed models are two openai models; the picker must list
 * them and none of the others.
 */
test.describe.serial('Journey 92: User Models, real end to end', () => {
  test.setTimeout(300_000);

  const PROVIDER = 'openai';
  const KEPT = 'gpt-4.1-mini';
  const REMOVED = 'gpt-5-nano';
  const NEVER_ALLOWED = 'gpt-5';

  let mentorUrl = '';
  let tenantKey = '';
  let dmBase = '';
  let dmToken = '';
  let original: string[] | null = null;

  const accessUrl = (path: string) =>
    `${dmBase}/api/core/rbac/llm-access/${path}/`;
  const normalize = (list: string[]) =>
    list.map((r) => r.replace(/\/+$/, '')).sort();

  test.afterAll(async ({ playwright }) => {
    if (original === null) return;
    const api = await playwright.request.newContext();
    try {
      const headers = { Authorization: `Token ${dmToken}` };
      await api.post(accessUrl('set'), {
        headers,
        data: {
          platform_key: tenantKey,
          llm_resources: original.map((r) =>
            r.replace(/^(llms\/[^/]+\/models\/[^/]+)\/$/, '$1'),
          ),
        },
      });
      const after = await api.get(
        `${accessUrl('status')}?platform_key=${tenantKey}`,
        { headers },
      );
      const restored = ((await after.json()) as { llm_resources: string[] })
        .llm_resources;
      expect(normalize(restored), 'tenant list restored').toEqual(
        normalize(original),
      );
    } finally {
      await api.dispose();
    }
  });

  async function savedList(page: Page): Promise<string[]> {
    const response = await page.request.get(
      `${accessUrl('status')}?platform_key=${tenantKey}`,
      { headers: { Authorization: `Token ${dmToken}` } },
    );
    expect(response.ok()).toBe(true);
    return ((await response.json()) as { llm_resources: string[] })
      .llm_resources;
  }

  test('um-17: models the admin allows through User Models are exactly the ones a user can pick in chat', async ({
    page,
    nonadminPage,
    editMentorPage,
    createMentorPage,
    nonadminChatPage,
  }) => {
    await navigateToMentorApp(page);
    if (!(await checkAdminStatus(page))) {
      test.skip(true, 'Requires admin access');
      return;
    }
    await createMentorPage.openAndCreate(generateMentorName());
    await waitForPageReady(page);
    const ctx = await getPlatformContext(page);
    tenantKey = ctx.tenantKey;
    mentorUrl = `${MENTOR_NEXTJS_HOST}/platform/${tenantKey}/${ctx.mentorId}`;
    dmBase = await resolveDmApiBase(page);
    dmToken = (await page.evaluate(() => localStorage.getItem('dm_token')))!;
    original = await savedList(page);

    await editMentorPage.open('LLM');
    await waitForPageReady(page);
    await editMentorPage.llm.selectProviderAndModel('ibl.ai', 'iblai-fast');
    await editMentorPage.llm.setInChatModelChange(true);

    const um = editMentorPage.llm.usersModels;
    await um.open();
    await expect(um.providerCards.first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('users-models-loading')).toHaveCount(0);
    await um.openProvider(PROVIDER);
    // Start from a known list: drop whatever the tenant had in this provider.
    for (const name of await um.modelNames(PROVIDER)) {
      if (
        name !== KEPT &&
        name !== REMOVED &&
        (await um.model(PROVIDER, name).getAttribute('aria-checked')) === 'true'
      ) {
        await um.model(PROVIDER, name).click();
        const confirm = um.confirmEmptySave;
        if (await confirm.isVisible()) await confirm.click();
      }
    }
    for (const name of [KEPT, REMOVED]) {
      if (
        (await um.model(PROVIDER, name).getAttribute('aria-checked')) !== 'true'
      ) {
        const saved = page.waitForResponse(
          (r) => /\/rbac\/llm-access\/set\//.test(r.url()) && r.ok(),
        );
        await um.model(PROVIDER, name).click();
        await saved;
      }
      await expect(um.model(PROVIDER, name)).toHaveAttribute(
        'aria-checked',
        'true',
      );
    }
    await expect
      .poll(async () =>
        (await savedList(page)).filter((r) => r.startsWith(`llms/${PROVIDER}`)),
      )
      .toEqual(
        expect.arrayContaining([
          expect.stringContaining(`${PROVIDER}/models/${KEPT}`),
          expect.stringContaining(`${PROVIDER}/models/${REMOVED}`),
        ]),
      );
    await editMentorPage.close();

    await navigateToMentorApp(nonadminPage, mentorUrl);
    await waitForPageReady(nonadminPage);
    await nonadminChatPage.openPlusMenu();
    await expect(nonadminChatPage.modelMenuTrigger).toBeVisible({
      timeout: 15_000,
    });
    await nonadminChatPage.modelMenuTrigger.click();
    const provider = nonadminPage
      .locator(`[data-testid="composer-model-provider-${PROVIDER}"]`)
      .last();
    const item = (name: string) =>
      nonadminPage
        .locator(`[data-testid="composer-model-item"][data-model="${name}"]`)
        .last();
    await expect(provider.or(item(KEPT)).first()).toBeVisible({
      timeout: 15_000,
    });
    if (await provider.isVisible()) await provider.click();
    await expect(item(KEPT)).toBeVisible({ timeout: 15_000 });
    await expect(item(REMOVED)).toBeVisible();
    await expect(item(NEVER_ALLOWED)).toHaveCount(0);
    await expect(item('gpt-4o-mini')).toHaveCount(0);
    await nonadminPage.keyboard.press('Escape');
  });

  test('um-18: after the admin removes a model in User Models, the user no longer sees it in chat', async ({
    page,
    nonadminPage,
    editMentorPage,
    nonadminChatPage,
  }) => {
    test.skip(!mentorUrl, 'um-17 setup did not run');
    await navigateToMentorApp(page, mentorUrl);
    await editMentorPage.open('LLM');
    await waitForPageReady(page);
    const um = editMentorPage.llm.usersModels;
    await um.open();
    await um.openProvider(PROVIDER);
    const saved = page.waitForResponse(
      (r) => /\/rbac\/llm-access\/set\//.test(r.url()) && r.ok(),
    );
    await um.model(PROVIDER, REMOVED).click();
    await saved;
    await expect(um.model(PROVIDER, REMOVED)).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(
      (await savedList(page)).some((r) => r.includes(`/models/${REMOVED}`)),
    ).toBe(false);
    await editMentorPage.close();

    await navigateToMentorApp(nonadminPage, mentorUrl);
    await waitForPageReady(nonadminPage);
    await nonadminChatPage.openPlusMenu();
    await nonadminChatPage.modelMenuTrigger.click();
    const provider = nonadminPage
      .locator(`[data-testid="composer-model-provider-${PROVIDER}"]`)
      .last();
    const item = (name: string) =>
      nonadminPage
        .locator(`[data-testid="composer-model-item"][data-model="${name}"]`)
        .last();
    await expect(provider.or(item(KEPT)).first()).toBeVisible({
      timeout: 15_000,
    });
    if (await provider.isVisible()) await provider.click();
    await expect(item(KEPT)).toBeVisible({ timeout: 15_000 });
    await expect(item(REMOVED)).toHaveCount(0);
  });
});
