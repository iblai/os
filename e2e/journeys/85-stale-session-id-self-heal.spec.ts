/**
 * Journey 85 — Stale / Cross-Tenant Session Id Self-Heal (iblai-platform#2536)
 *
 * Bug: the chat caches the last session per agent in
 * `localStorage.session_id`. When the backend no longer knows that id
 * (purged, or minted under another tenant, since the key was the agent id
 * alone), every load spun ~5s, no new session was minted, and every message
 * failed with a "Session not found" toast. Embeds have no "New chat" to
 * recover with.
 *
 * Fix (SDK Chat + `@iblai/web-utils` / `@iblai/data-layer`):
 *   - The cache key is `${tenantKey}:${mentorId}`.
 *   - Retries are unchanged: the dead id is fetched 1 + 3 times. Only after
 *     the last 404 do `getSessionId` / `getSharedSessionId` return it as
 *     `{ error }` (instead of throwing), so the chat can see the status.
 *   - That 404, or a WS "Session not found" frame, calls `onSessionNotFound`
 *     (no toast): the dead id is dropped and a fresh session is minted
 *     (`POST .../sessions/`).
 *
 * Uses the tenant's default agent; nothing is created, so nothing to clean
 * up. sess-04 uses the in-app `?embed=true` URL (as journeys 13/58 do).
 */

import type { Page, WebSocketRoute } from '@playwright/test';
import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, getPlatformContext } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';

/** Mirrors `sessionCacheKey()` in `@iblai/web-utils` and `lib/utils.ts`. */
function sessionCacheKey(tenantKey: string, mentorId: string): string {
  return `${tenantKey}:${mentorId}`;
}

/** Browser-safe reload `waitUntil` — mirrors journey 50's pattern (WebKit needs 'load'). */
function reloadWaitUntil(page: Page): 'load' | 'domcontentloaded' {
  const browserName = page.context().browser()?.browserType().name();
  return browserName === 'webkit' ? 'load' : 'domcontentloaded';
}

/**
 * Seeds `localStorage.session_id` with a single `{key: sessionId}` entry via
 * `addInitScript` — runs before any app JS on every subsequent
 * navigation/reload for this page's context/lifetime.
 */
async function seedSessionIdCache(
  page: Page,
  key: string,
  sessionId: string,
): Promise<void> {
  await page.addInitScript(
    ({ key, sessionId }) => {
      localStorage.setItem('session_id', JSON.stringify({ [key]: sessionId }));
    },
    { key, sessionId },
  );
}

/** Reads and parses the `session_id` localStorage cache (empty object if absent/unparsable). */
async function readSessionIdCache(page: Page): Promise<Record<string, string>> {
  const raw = await page.evaluate(() => localStorage.getItem('session_id'));
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** True for the `POST .../sessions/` mint-a-new-session request (not a `GET .../sessions/<id>/`). */
function isCreateSessionRequest(url: string, method: string): boolean {
  if (method !== 'POST') return false;
  return /\/sessions\/(\?.*)?$/.test(new URL(url).pathname);
}

/**
 * Same contract as `ChatPage.mockChatWebSocket()` (`e2e/page-objects/chat.page.ts`)
 * but supports capturing MULTIPLE outbound client messages in one test.
 * `mockChatWebSocket()`'s `waitForClientMessage()` resolves a single Promise
 * created at registration time, so it can only ever observe the first
 * client send. Scenario 3 below needs a broken first turn (errors out) then
 * a working second turn over the same mocked socket, so this is a small
 * queue-based variant kept local to this spec rather than a shared
 * page-object change — no other journey currently sends more than once per
 * mocked socket.
 */
async function mockChatWebSocketMulti(page: Page): Promise<{
  waitForClientMessage: () => Promise<Record<string, unknown>>;
  send: (frame: Record<string, unknown>) => void;
}> {
  let capturedWs: WebSocketRoute | undefined;
  const queue: Record<string, unknown>[] = [];
  const waiters: Array<(msg: Record<string, unknown>) => void> = [];

  await page.routeWebSocket('**/ws/langflow/**', (ws) => {
    capturedWs = ws;
    ws.onMessage((raw) => {
      try {
        const parsed = JSON.parse(raw.toString());
        const waiter = waiters.shift();
        if (waiter) waiter(parsed);
        else queue.push(parsed);
      } catch {
        // Non-JSON frame from the page — not expected on this socket, ignore.
      }
    });
  });

  return {
    waitForClientMessage: () => {
      if (queue.length) return Promise.resolve(queue.shift()!);
      return new Promise((resolve) => waiters.push(resolve));
    },
    send: (frame: Record<string, unknown>) => {
      if (!capturedWs) {
        throw new Error(
          '[mockChatWebSocketMulti] send() called before the page opened the mocked socket',
        );
      }
      capturedWs.send(JSON.stringify(frame));
    },
  };
}

/** Same in-app embed URL construction as journeys 13/58: `?embed=true&extra-body-classes=iframed-externally`. */
function embedUrlFor(mentorUrl: string): string {
  const url = new URL(mentorUrl);
  url.searchParams.set('embed', 'true');
  url.searchParams.set('extra-body-classes', 'iframed-externally');
  return url.toString();
}

/** The literal string every error toast (`ToastErrorMessage`) renders — see `components/chat/toast-error-message.tsx`. */
const ERROR_TOAST_TEXT = /Sorry about that!/i;

/**
 * Polls the `session_id` cache until it holds a NEW, truthy value for `key`
 * that differs from `staleId` — not merely "cleared". `onSessionNotFound`
 * deletes the dead entry first and only writes the replacement once
 * `startNewChat()`'s `POST .../sessions/` resolves, so polling for "not
 * equal to the stale id" alone is satisfied the instant the entry is
 * deleted (the value becomes `undefined`, which already differs from
 * `staleId`) — well before the real replacement id lands. This waits for
 * the full self-heal (a truthy, different value) instead of that
 * transient cleared state.
 */
async function pollHealedSessionId(
  page: Page,
  key: string,
  staleId: string,
): Promise<string> {
  await expect
    .poll(
      async () => {
        const cache = await readSessionIdCache(page);
        const value = cache[key];
        return value && value !== staleId ? value : null;
      },
      {
        timeout: 45_000,
        message: `expected a fresh session id to replace ${staleId}`,
      },
    )
    .not.toBeNull();
  const cache = await readSessionIdCache(page);
  return cache[key];
}

const START_CHAT_FALLBACK = "We couldn't start a new chat. Please try again.";

/**
 * Fails every `POST .../sessions/` with `status`/`body` and records the error toast. A non-402 start-chat failure makes
 * the SDK toast and then call `redirectToAuthSpa(undefined, undefined, true)`
 * (logout); holding that navigation keeps the page and the toast alive, so
 * the shared e2e account is never logged out.
 */
async function mockStartChatFailure(
  page: Page,
  status: number,
  body: Record<string, unknown>,
): Promise<void> {
  await page.route(
    (url) => /\/sessions\/$/.test(url.pathname),
    async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    },
  );
  // The logout that follows the toast resets app state and can remove the
  // toast within milliseconds, so record toast text the moment it is added.
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { __toastTexts: string[] }).__toastTexts = seen;
    const record = (mutations: MutationRecord[]) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          const text = node.textContent ?? '';
          if (/Sorry about that!/i.test(text) && !seen.includes(text)) {
            seen.push(text);
          }
        });
        const text = mutation.target.textContent ?? '';
        if (/Sorry about that!/i.test(text) && !seen.includes(text)) {
          seen.push(text);
        }
      }
    };
    new MutationObserver(record).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  });
  const appOrigin = new URL(page.url()).origin;
  await page.route('**/*', (route) => {
    const request = route.request();
    const target = new URL(request.url());
    const logsOut =
      request.isNavigationRequest() &&
      request.frame() === page.mainFrame() &&
      (target.origin !== appOrigin ||
        target.pathname.endsWith('/auth-redirect'));
    // Left pending on purpose: aborting commits Chrome's error page, which
    // would replace the document and destroy the toast.
    if (!logsOut) return route.fallback();
  });
}

/** Asserts the error toast shows `expected` verbatim and no raw error leakage. */
async function expectCleanStartChatToast(
  page: Page,
  expected: string,
): Promise<void> {
  let text = '';
  await expect
    .poll(
      async () => {
        const texts = await page.evaluate(
          () =>
            (window as unknown as { __toastTexts?: string[] }).__toastTexts ??
            [],
        );
        text = (texts.find((t) => /Sorry about that!/i.test(t)) ?? '')
          .replace(/\s+/g, ' ')
          .trim();
        return text;
      },
      { timeout: 20_000, message: 'expected the start-chat error toast' },
    )
    .not.toBe('');
  expect(text).toContain(expected);
  expect(text).not.toContain('{');
  expect(text).not.toContain('status');
  expect(text).not.toContain('[object Object]');
  expect(text).not.toContain('Failed to start new chat');
}

test.describe('Journey 85: Stale Session Id Self-Heal', () => {
  test('sess-01: a stale localStorage session id is retried 1 + 3 times, then self-heals, and chat remains usable', async ({
    page,
    chatPage,
  }) => {
    // Establish a real session first so we know the current tenant/mentor
    // and land on a mounted chat page.
    await navigateToMentorApp(page);
    const { tenantKey, mentorId } = await getPlatformContext(page);
    const key = sessionCacheKey(tenantKey, mentorId);
    const deadSessionId = 'deadbeef-1234-4abc-8def-000000000001';

    // chat-privacy-effective still retries and throws on the dead id, as on
    // main; it is not part of this fix, so its console.error noise (with and
    // without the URL — RTK re-logs the bare `{status, data}`) is excluded.
    // getSessionId's 404 is returned as `{ error }`, so RTK never logs it.
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (text.includes('chat-privacy-effective')) return;
      // Same for the SDK's tools restore (use-mentor-tools), which reads the
      // session from my-chat-history and 404s on the dead id; the OS logger
      // stamps the cached session id onto every error, so match by endpoint.
      if (text.includes('my-chat-history')) return;
      if (
        (text.includes('{"status":404,"data":{"error":"Session not found"}}') ||
          text.includes(
            '{"status":404,"data":{"detail":"No Session matches the given query."}}',
          )) &&
        !text.includes('"context"')
      ) {
        return;
      }
      if (text.includes(deadSessionId) || /session not found/i.test(text)) {
        consoleErrors.push(text);
      }
    });

    // Timestamped so we can assert ordering (all dead-id GETs before the
    // POST that mints the replacement), not just counts.
    const sessionGetRequests: number[] = [];
    const createSessionRequests: number[] = [];
    page.on('request', (req) => {
      const url = req.url();
      const method = req.method();
      if (method === 'GET' && url.includes(`/sessions/${deadSessionId}/`)) {
        sessionGetRequests.push(Date.now());
      }
      if (isCreateSessionRequest(url, method)) {
        createSessionRequests.push(Date.now());
      }
    });

    // Overwrite the freshly-minted real session with a dead one, tenant-namespaced.
    await seedSessionIdCache(page, key, deadSessionId);
    await page.reload({ waitUntil: reloadWaitUntil(page), timeout: 60_000 });
    await waitForPageReady(page);

    // Self-heal: a fresh session gets minted and persisted under the same key.
    await pollHealedSessionId(page, key, deadSessionId);
    expect(createSessionRequests.length).toBeGreaterThanOrEqual(1);
    const firstCreateAt = createSessionRequests[0];

    // No "Session not found" toast.
    await expect(page.getByText(ERROR_TOAST_TEXT)).not.toBeVisible({
      timeout: 5_000,
    });

    // Chat input is usable and a real round trip succeeds.
    const composer = chatPage.getComposerTextarea();
    await expect(composer).toBeVisible({ timeout: 15_000 });
    await expect(composer).toBeEditable({ timeout: 15_000 });
    await chatPage.sendMessage('Hello, this is an e2e sanity check message.');
    await chatPage.waitForAIResponseOrUserAgreement(60_000);

    // Retries unchanged: 1 initial + 3 retries, all before the POST that
    // mints the replacement, and never re-fetched after it (the errored
    // query provides no `sessionId` tag for createSessionId to invalidate).
    expect(sessionGetRequests.length).toBe(4);
    for (const t of sessionGetRequests) {
      expect(t).toBeLessThanOrEqual(firstCreateAt);
    }
    expect(consoleErrors).toEqual([]);
  });

  test('sess-02: a legacy bare-mentorId cache entry is ignored (tenant-namespaced key)', async ({
    page,
  }) => {
    await navigateToMentorApp(page);
    const { tenantKey, mentorId } = await getPlatformContext(page);
    const key = sessionCacheKey(tenantKey, mentorId);
    const legacyDeadSessionId = 'deadbeef-5678-4abc-8def-000000000002';

    const legacyGetRequests: string[] = [];
    page.on('request', (req) => {
      if (
        req.method() === 'GET' &&
        req.url().includes(`/sessions/${legacyDeadSessionId}/`)
      ) {
        legacyGetRequests.push(req.url());
      }
    });

    // Seed the OLD (pre-fix) shape: keyed by bare mentorId, no tenant prefix.
    await seedSessionIdCache(page, mentorId, legacyDeadSessionId);
    await page.reload({ waitUntil: reloadWaitUntil(page), timeout: 60_000 });
    await waitForPageReady(page);

    // The app mints/uses a session under the NEW namespaced key.
    await expect
      .poll(
        async () => {
          const cache = await readSessionIdCache(page);
          return Object.keys(cache);
        },
        {
          timeout: 45_000,
          message: 'expected the tenant-namespaced key to appear',
        },
      )
      .toContain(key);

    const cache = await readSessionIdCache(page);
    expect(cache[key]).toBeTruthy();
    expect(cache[key]).not.toBe(legacyDeadSessionId);

    // The legacy bare-mentorId id was never looked up — no fallback.
    expect(legacyGetRequests).toEqual([]);
  });

  test('sess-03: a WS "Session not found" frame mid-chat self-heals without an error toast', async ({
    page,
    chatPage,
  }) => {
    const ws = await mockChatWebSocketMulti(page);

    await navigateToMentorApp(page);
    const { tenantKey, mentorId } = await getPlatformContext(page);
    const key = sessionCacheKey(tenantKey, mentorId);

    await waitForPageReady(page);
    await expect
      .poll(
        async () => {
          const cache = await readSessionIdCache(page);
          return cache[key];
        },
        {
          timeout: 45_000,
          message: 'expected an initial session id to be cached',
        },
      )
      .toBeTruthy();
    const initialCache = await readSessionIdCache(page);
    const initialSessionId = initialCache[key];

    // First send over the (already-established) session — the backend
    // rejects it as unrecognized, simulating a server-side session purge
    // mid-conversation.
    await chatPage.sendMessage('Hello, first message.');
    const clientMessage1 = await ws.waitForClientMessage();
    const sid = clientMessage1.session_id as string;
    expect(sid).toBe(initialSessionId);

    ws.send({
      error: `Session not found: ${sid}`,
      status_code: 400,
      session_id: sid,
    });

    // Streaming/working state clears (no hang).
    await expect(chatPage.getWorkingMessage()).not.toBeVisible({
      timeout: 15_000,
    });
    // No error toast — this is the self-healing path, not the generic
    // errorHandler path.
    await expect(page.getByText(ERROR_TOAST_TEXT)).not.toBeVisible({
      timeout: 5_000,
    });

    // The dead id is cleared and a fresh session is minted + persisted.
    const newSessionId = await pollHealedSessionId(page, key, initialSessionId);

    // A follow-up message over the healed session succeeds.
    await chatPage.sendMessage('Are you still there?');
    const clientMessage2 = await ws.waitForClientMessage();
    const sid2 = clientMessage2.session_id as string;
    expect(sid2).toBe(newSessionId);

    ws.send({ generation_id: `e2e-gen-${Date.now()}`, session_id: sid2 });
    ws.send({ data: 'Yes, still here.', session_id: sid2 });
    ws.send({ eos: true, session_id: sid2 });

    await expect(chatPage.getLastAiMessage()).toContainText(
      'Yes, still here.',
      { timeout: 15_000 },
    );
  });

  test('sess-04: stale session id self-heals in embed mode with no manual New Chat needed', async ({
    page,
    chatPage,
  }) => {
    await navigateToMentorApp(page);
    const { tenantKey, mentorId } = await getPlatformContext(page);
    const key = sessionCacheKey(tenantKey, mentorId);
    const deadSessionId = 'deadbeef-9abc-4abc-8def-000000000003';

    const sessionGetRequests: number[] = [];
    const createSessionRequests: number[] = [];
    page.on('request', (req) => {
      const url = req.url();
      const method = req.method();
      if (method === 'GET' && url.includes(`/sessions/${deadSessionId}/`)) {
        sessionGetRequests.push(Date.now());
      }
      if (isCreateSessionRequest(url, method)) {
        createSessionRequests.push(Date.now());
      }
    });

    await seedSessionIdCache(page, key, deadSessionId);
    const target = embedUrlFor(page.url());
    await page.goto(target, {
      waitUntil: reloadWaitUntil(page),
      timeout: 60_000,
    });
    await waitForPageReady(page);
    expect(page.url()).toContain('embed=true');

    // Self-heals with zero manual interaction — no "New Chat" click, no
    // navigation away — before a message is even sent.
    await pollHealedSessionId(page, key, deadSessionId);
    expect(createSessionRequests.length).toBeGreaterThanOrEqual(1);
    const firstCreateAt = createSessionRequests[0];

    await expect(page.getByText(ERROR_TOAST_TEXT)).not.toBeVisible({
      timeout: 5_000,
    });

    const composer = chatPage.getComposerTextarea();
    await expect(composer).toBeVisible({ timeout: 20_000 });
    await expect(composer).toBeEditable({ timeout: 15_000 });
    await chatPage.sendMessage('Hello from embed.');
    await chatPage.waitForAIResponseOrUserAgreement(60_000);

    // Exactly 4 (1 initial + 3 retries), all before the POST that mints the
    // replacement — see sess-01.
    expect(sessionGetRequests.length).toBe(4);
    for (const t of sessionGetRequests) {
      expect(t).toBeLessThanOrEqual(firstCreateAt);
    }
  });

  test("sess-05: a 403 on starting a new chat toasts the backend's own sentence, not the raw error object (iblai-platform#2712)", async ({
    page,
    chatPage,
  }) => {
    await navigateToMentorApp(page);
    await waitForPageReady(page);
    await expect(chatPage.getComposerTextarea()).toBeEditable({
      timeout: 30_000,
    });
    const message = 'You do not have permission to chat with this agent.';
    await mockStartChatFailure(page, 403, { error: message });

    await chatPage.startNewChat();

    await expectCleanStartChatToast(page, message);
  });

  test('sess-06: a failed start-chat with no readable message toasts the plain fallback sentence (iblai-platform#2712)', async ({
    page,
    chatPage,
  }) => {
    await navigateToMentorApp(page);
    await waitForPageReady(page);
    await expect(chatPage.getComposerTextarea()).toBeEditable({
      timeout: 30_000,
    });
    await mockStartChatFailure(page, 400, {});

    await chatPage.startNewChat();

    await expectCleanStartChatToast(page, START_CHAT_FALLBACK);
  });
});
