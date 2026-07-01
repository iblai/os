/**
 * Journey: Chat URL ?prompt= Auto-Injection
 *
 * Covers the feature introduced in iblai/iblai-platform#1722:
 * when a mentor chat page loads with `?prompt=<text>` in the URL,
 * the hook reads `searchParams.get('prompt')?.trim()` and auto-submits
 * that text as a user message exactly once per mount.
 *
 * Scenarios:
 *   1. Fresh session + ?prompt= → message auto-submitted, AI responds
 *   2. Dedup: reload same ?prompt= URL → no second submission (bubble count === 1)
 *   3. Cached session + different ?prompt= → history preserved, new message appended
 *   4. No ?prompt= → welcome state, nothing auto-submitted
 *   5. URL-encoded prompt (%20 → space) → decoded text rendered in bubble
 *
 * Implementation contract:
 *   - `location.search` keeps `?prompt=...` after submission (no router.replace)
 *   - localStorage `session_id[mentorId]` stays unchanged on dedup reload
 *   - New session id is NOT created when deduplicating
 */

import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, getPlatformContext } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { MENTOR_NEXTJS_HOST } from '../fixtures/test-data';
import { logger } from '@iblai/iblai-js/playwright';

const SESSION_ID_KEY = 'session_id';

test.describe('Journey: Chat URL ?prompt= Auto-Injection', () => {
  test.setTimeout(180_000);

  // Shared platform context resolved once in beforeEach via the admin page
  let tenantKey = '';
  let mentorId = '';

  test.beforeEach(async ({ page }) => {
    test.skip(!MENTOR_NEXTJS_HOST, 'Requires MENTOR_NEXTJS_HOST');
    await navigateToMentorApp(page);
    const ctx = await getPlatformContext(page);
    tenantKey = ctx.tenantKey;
    mentorId = ctx.mentorId;
    logger.info(`prompt-injection: tenant=${tenantKey} mentor=${mentorId}`);
  });

  // ---------------------------------------------------------------------------
  // TC1 — Fresh session: ?prompt= auto-submits the message and AI responds
  // ---------------------------------------------------------------------------

  test('admin navigates to mentor with ?prompt= on a fresh session and message is auto-submitted', async ({
    page,
    chatPage,
  }) => {
    const promptText = `e2e auto-submit ${Date.now()}`;

    // Clear any cached session for this mentor so we start fresh
    await page.evaluate(
      ({ key, mid }) => {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) return;
          const sessions = JSON.parse(raw) as Record<string, string>;
          delete sessions[mid];
          localStorage.setItem(key, JSON.stringify(sessions));
        } catch {
          // ignore parse errors
        }
      },
      { key: SESSION_ID_KEY, mid: mentorId },
    );

    const mentorUrl = `${MENTOR_NEXTJS_HOST}/platform/${tenantKey}/${mentorId}?prompt=${encodeURIComponent(promptText)}`;
    await page.goto(mentorUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

    // TC1-a: user message bubble appears automatically
    await expect(
      page.locator('.chat-user-message-query', { hasText: promptText }),
    ).toBeVisible({ timeout: 90_000 });

    // TC1-b: AI responds (at least one response bubble visible)
    await expect(chatPage.aiMessages.first()).toBeVisible({ timeout: 90_000 });

    // TC1-c: URL still contains ?prompt= after the submission settled
    expect(page.url()).toContain('prompt=');
  });

  // ---------------------------------------------------------------------------
  // TC2 — Dedup: reloading with the same ?prompt= does NOT create a second bubble
  // ---------------------------------------------------------------------------

  test('admin reloads same ?prompt= URL and gets no duplicate user bubble', async ({
    page,
    chatPage,
  }) => {
    const promptText = `e2e dedup test ${Date.now()}`;

    // Ensure a fresh session so TC2 is not poisoned by a prior run
    await page.evaluate(
      ({ key, mid }) => {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) return;
          const sessions = JSON.parse(raw) as Record<string, string>;
          delete sessions[mid];
          localStorage.setItem(key, JSON.stringify(sessions));
        } catch {
          // ignore parse errors
        }
      },
      { key: SESSION_ID_KEY, mid: mentorId },
    );

    const mentorUrl = `${MENTOR_NEXTJS_HOST}/platform/${tenantKey}/${mentorId}?prompt=${encodeURIComponent(promptText)}`;

    // First visit: message is submitted and a session is created
    await page.goto(mentorUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await expect(
      page.locator('.chat-user-message-query', { hasText: promptText }),
    ).toBeVisible({ timeout: 90_000 });
    // Wait for AI to respond so the session is fully flushed to localStorage
    await expect(chatPage.aiMessages.first()).toBeVisible({ timeout: 90_000 });

    // Capture the session id that was created
    const sessionIdAfterFirst = await page.evaluate(
      ({ key, mid }) => {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) return null;
          return (JSON.parse(raw) as Record<string, string>)[mid] ?? null;
        } catch {
          return null;
        }
      },
      { key: SESSION_ID_KEY, mid: mentorId },
    );

    logger.info(
      `prompt-injection dedup: sessionId after first load = ${sessionIdAfterFirst}`,
    );

    // Second visit: same URL, session is cached, hook should dedup
    await page.goto(mentorUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await waitForPageReady(page);

    // TC2-a: exactly one user bubble for this prompt text (no duplicate)
    const bubbleCount = await page
      .locator('.chat-user-message-query', { hasText: promptText })
      .count();
    expect(bubbleCount).toBe(1);

    // TC2-b: session id is unchanged (no new session was created)
    const sessionIdAfterSecond = await page.evaluate(
      ({ key, mid }) => {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) return null;
          return (JSON.parse(raw) as Record<string, string>)[mid] ?? null;
        } catch {
          return null;
        }
      },
      { key: SESSION_ID_KEY, mid: mentorId },
    );

    logger.info(
      `prompt-injection dedup: sessionId after second load = ${sessionIdAfterSecond}`,
    );

    expect(sessionIdAfterSecond).toBe(sessionIdAfterFirst);
  });

  // ---------------------------------------------------------------------------
  // TC3 — Cached session + different prompt: history preserved, new message added
  // ---------------------------------------------------------------------------

  test('admin navigates with a different ?prompt= on a cached session and history is preserved', async ({
    page,
    chatPage,
  }) => {
    const firstPrompt = `e2e first msg ${Date.now()}`;
    const secondPrompt = `e2e second different msg ${Date.now() + 1}`;

    // Step 1 — Start a fresh session with the first prompt
    await page.evaluate(
      ({ key, mid }) => {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) return;
          const sessions = JSON.parse(raw) as Record<string, string>;
          delete sessions[mid];
          localStorage.setItem(key, JSON.stringify(sessions));
        } catch {
          // ignore parse errors
        }
      },
      { key: SESSION_ID_KEY, mid: mentorId },
    );

    const firstUrl = `${MENTOR_NEXTJS_HOST}/platform/${tenantKey}/${mentorId}?prompt=${encodeURIComponent(firstPrompt)}`;
    await page.goto(firstUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await expect(
      page.locator('.chat-user-message-query', { hasText: firstPrompt }),
    ).toBeVisible({ timeout: 90_000 });
    await expect(chatPage.aiMessages.first()).toBeVisible({ timeout: 90_000 });

    // Capture session id so we can assert it is reused
    const originalSessionId = await page.evaluate(
      ({ key, mid }) => {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) return null;
          return (JSON.parse(raw) as Record<string, string>)[mid] ?? null;
        } catch {
          return null;
        }
      },
      { key: SESSION_ID_KEY, mid: mentorId },
    );

    // Step 2 — Navigate with a DIFFERENT prompt (same mentor, same tenant)
    const secondUrl = `${MENTOR_NEXTJS_HOST}/platform/${tenantKey}/${mentorId}?prompt=${encodeURIComponent(secondPrompt)}`;
    await page.goto(secondUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

    // TC3-a: original user message still visible (history preserved)
    await expect(
      page.locator('.chat-user-message-query', { hasText: firstPrompt }),
    ).toBeVisible({ timeout: 60_000 });

    // TC3-b: new user message also appears
    await expect(
      page.locator('.chat-user-message-query', { hasText: secondPrompt }),
    ).toBeVisible({ timeout: 90_000 });

    // TC3-c: AI responds again (at least 2 AI messages now)
    await expect(chatPage.aiMessages).toHaveCount(2, { timeout: 90_000 });

    // TC3-d: session id unchanged — no new session was created
    const newSessionId = await page.evaluate(
      ({ key, mid }) => {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) return null;
          return (JSON.parse(raw) as Record<string, string>)[mid] ?? null;
        } catch {
          return null;
        }
      },
      { key: SESSION_ID_KEY, mid: mentorId },
    );
    expect(newSessionId).toBe(originalSessionId);
  });

  // ---------------------------------------------------------------------------
  // TC4 — No ?prompt= → welcome state, nothing auto-submitted
  // ---------------------------------------------------------------------------

  test('admin navigates to mentor with no ?prompt= and sees welcome state with no auto-submit', async ({
    page,
    chatPage,
  }) => {
    // Clear cached session so welcome screen is shown
    await page.evaluate(
      ({ key, mid }) => {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) return;
          const sessions = JSON.parse(raw) as Record<string, string>;
          delete sessions[mid];
          localStorage.setItem(key, JSON.stringify(sessions));
        } catch {
          // ignore parse errors
        }
      },
      { key: SESSION_ID_KEY, mid: mentorId },
    );

    const mentorUrl = `${MENTOR_NEXTJS_HOST}/platform/${tenantKey}/${mentorId}`;
    await page.goto(mentorUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await waitForPageReady(page);

    // TC4-a: chat input is visible (UI is ready)
    await expect(chatPage.chatInput).toBeVisible({ timeout: 30_000 });

    // TC4-b: no user message bubbles (nothing auto-submitted)
    await expect(chatPage.userMessages).toHaveCount(0);

    // TC4-c: wait 3 seconds to confirm nothing is auto-submitted
    await page.waitForTimeout(3_000);
    await expect(chatPage.userMessages).toHaveCount(0);

    // TC4-d: URL has no ?prompt= param
    expect(page.url()).not.toContain('prompt=');
  });

  // ---------------------------------------------------------------------------
  // TC5 — URL-encoded prompt: %20 → space in rendered bubble
  // ---------------------------------------------------------------------------

  test('admin navigates with a URL-encoded ?prompt= and bubble renders decoded text', async ({
    page,
  }) => {
    const rawText = 'hi there e2e';
    const encodedPrompt = rawText.replace(/ /g, '%20'); // manual percent-encoding

    // Clear cached session for a clean test
    await page.evaluate(
      ({ key, mid }) => {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) return;
          const sessions = JSON.parse(raw) as Record<string, string>;
          delete sessions[mid];
          localStorage.setItem(key, JSON.stringify(sessions));
        } catch {
          // ignore parse errors
        }
      },
      { key: SESSION_ID_KEY, mid: mentorId },
    );

    // Bypass encodeURIComponent to keep literal %20 in the URL
    const mentorUrl = `${MENTOR_NEXTJS_HOST}/platform/${tenantKey}/${mentorId}?prompt=${encodedPrompt}`;
    await page.goto(mentorUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

    // TC5: bubble text is decoded — "hi there e2e" (not "hi%20there%20e2e")
    await expect(
      page.locator('.chat-user-message-query', { hasText: rawText }),
    ).toBeVisible({ timeout: 90_000 });

    // TC5-b: no bubble with the raw percent-encoded text
    await expect(
      page.locator('.chat-user-message-query', { hasText: encodedPrompt }),
    ).not.toBeVisible({ timeout: 3_000 });
  });
});
