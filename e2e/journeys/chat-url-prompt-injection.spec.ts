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
 *
 * Sanitization scenarios (iblai-platform#2164 — `sanitizePromptParam()` in
 * `lib/utils.ts`, consumed at `components/chat/index.tsx:279`):
 *   6. Clean prompt → sanitization is a no-op, text renders verbatim
 *   7. Invisible/control chars interleaved with visible text → stripped, only
 *      visible text renders. "Invisible" here spans zero-width chars, the
 *      Unicode Tag block, AND bidirectional controls (Trojan Source /
 *      CVE-2021-42574) — all removed by `sanitizePromptParam()`. The exact
 *      per-class stripping is asserted at the unit level; this journey covers
 *      the end-to-end "only visible text reaches the bubble" contract.
 *   8. Whitespace + zero-width only (empty after cleaning) → no auto-submit
 *   9. HTML/script-ish payload → renders as inert literal text, no real
 *      element is inserted, no script executes
 *
 * The oversized-input (>4000 char cap) case is intentionally NOT covered here
 * — see `lib/__tests__/sanitize-prompt-param.test.ts` for that behavior at
 * the unit level (truncation + re-trim). See coverage.json checkpoint upi-10.
 */

import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, getPlatformContext } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { MENTOR_NEXTJS_HOST } from '../fixtures/test-data';
import { logger } from '@iblai/iblai-js/playwright';

const SESSION_ID_KEY = 'session_id';

/**
 * Clear the cached session id for `mentorId` so the next navigation starts a
 * fresh chat session. Factored out of the per-test inline `page.evaluate`
 * blocks below (TC1-TC5 keep their original inline form to avoid touching
 * passing tests; TC6+ use this helper).
 */
async function clearCachedSession(page: Page, mid: string): Promise<void> {
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
    { key: SESSION_ID_KEY, mid },
  );
}

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

    // The session and message record are only flushed once streaming finishes
    // (see TC3 below) — reloading mid-stream creates a brand-new session and
    // the bubble is lost. Wait for the stop-streaming button to flip back to
    // send, then settle so the save lands.
    await chatPage.waitForStreamingComplete();
    await page.waitForTimeout(2_000);

    // Second visit: same URL, session is cached, hook should dedup
    await page.goto(mentorUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await waitForPageReady(page);

    // TC2-a: exactly one user bubble for this prompt text (no duplicate).
    // History comes from the sessions endpoint which can be slow, so wait for
    // the restored bubble to render rather than counting immediately, then
    // give a would-be duplicate injection a moment to land before counting.
    const promptBubbles = page.locator('.chat-user-message-query', {
      hasText: promptText,
    });
    await expect(promptBubbles.first()).toBeVisible({ timeout: 90_000 });
    await page.waitForTimeout(2_000);
    expect(await promptBubbles.count()).toBe(1);

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

    // The message record is only saved to the backend once streaming finishes,
    // so wait for it to complete before navigating away, then add a deliberate
    // settle to let the save land.
    await chatPage.waitForStreamingComplete();
    await page.waitForTimeout(2_000);

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

  // ---------------------------------------------------------------------------
  // TC6 — Sanitization sanity: clean prompt passes through unchanged
  // (iblai-platform#2164)
  // ---------------------------------------------------------------------------

  test('admin navigates with a clean ?prompt= and the sanitized text renders unchanged', async ({
    page,
    chatPage,
  }) => {
    const promptText = 'Explain recursion in Python';
    await clearCachedSession(page, mentorId);

    const mentorUrl = `${MENTOR_NEXTJS_HOST}/platform/${tenantKey}/${mentorId}?prompt=${encodeURIComponent(promptText)}`;
    await page.goto(mentorUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

    // TC6: sanitization is a no-op for already-clean text — bubble shows it
    // verbatim. Deliberately does not wait for an AI response to keep this
    // checkpoint fast (see TC1 for the full auto-submit + AI-response path).
    const bubble = chatPage.userMessages.first();
    await expect(bubble).toBeVisible({ timeout: 30_000 });
    await expect(bubble).toHaveText(promptText);
  });

  // ---------------------------------------------------------------------------
  // TC7 — Invisible/control chars interleaved with visible text are stripped
  // (iblai-platform#2164)
  // ---------------------------------------------------------------------------

  test('admin navigates with invisible/control chars embedded in ?prompt= and only visible text renders', async ({
    page,
    chatPage,
  }) => {
    // Interleave visible text with a zero-width space (encodes to
    // %E2%80%8B), a NUL control char (encodes to %00), and a Unicode
    // Tag-block char (invisible-instruction injection vector, encodes to a
    // 4-byte UTF-8 percent sequence) — all must be stripped by
    // sanitizePromptParam(), leaving only the visible text.
    const zeroWidthSpace = '\u200B'; // U+200B ZERO WIDTH SPACE
    const nulControlChar = '\x00';
    const tagBlockChar = String.fromCodePoint(0xe0041); // TAG LATIN SMALL LETTER A
    const rawInput = `Hello${zeroWidthSpace}World${nulControlChar}${tagBlockChar}!`;
    const expectedClean = 'HelloWorld!';

    await clearCachedSession(page, mentorId);

    const mentorUrl = `${MENTOR_NEXTJS_HOST}/platform/${tenantKey}/${mentorId}?prompt=${encodeURIComponent(rawInput)}`;
    logger.info(
      `prompt-sanitization TC7: encoded prompt param = ${encodeURIComponent(rawInput)}`,
    );
    await page.goto(mentorUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

    // TC7: bubble text is EXACTLY the cleaned string — no invisible/control
    // chars leaked through into the rendered message.
    const bubble = chatPage.userMessages.first();
    await expect(bubble).toBeVisible({ timeout: 30_000 });
    await expect(bubble).toHaveText(expectedClean);
  });

  // ---------------------------------------------------------------------------
  // TC8 — Whitespace + zero-width only (empty after cleaning): no auto-submit
  // (iblai-platform#2164)
  // ---------------------------------------------------------------------------

  test('admin navigates with a whitespace/zero-width-only ?prompt= and nothing is auto-submitted', async ({
    page,
    chatPage,
  }) => {
    await clearCachedSession(page, mentorId);

    // %20 %E2%80%8B %20 — space, zero-width space, space. Cleans to an empty
    // string, so sanitizePromptParam() returns undefined and no submission
    // should occur.
    const mentorUrl = `${MENTOR_NEXTJS_HOST}/platform/${tenantKey}/${mentorId}?prompt=%20%E2%80%8B%20`;
    await page.goto(mentorUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await waitForPageReady(page);

    // TC8-a: welcome/empty state chat input is visible (UI is ready)
    await expect(chatPage.chatInput).toBeVisible({ timeout: 30_000 });

    // TC8-b: no user message bubbles
    await expect(chatPage.userMessages).toHaveCount(0);

    // TC8-c: settle period to confirm nothing is auto-submitted late
    await page.waitForTimeout(3_000);
    await expect(chatPage.userMessages).toHaveCount(0);
  });

  // ---------------------------------------------------------------------------
  // TC9 — HTML/script-ish payload renders as inert literal text, no real
  // element/script executes (iblai-platform#2164) — most safety-critical
  // ---------------------------------------------------------------------------

  test('admin navigates with an HTML/script-ish ?prompt= and it renders as inert literal text', async ({
    page,
    chatPage,
  }) => {
    const payload = '<img src=x onerror=alert(1)>';
    let dialogFired = false;
    page.on('dialog', (dialog) => {
      dialogFired = true;
      void dialog.dismiss();
    });

    await clearCachedSession(page, mentorId);

    const mentorUrl = `${MENTOR_NEXTJS_HOST}/platform/${tenantKey}/${mentorId}?prompt=${encodeURIComponent(payload)}`;
    await page.goto(mentorUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

    const bubble = chatPage.userMessages.first();
    await expect(bubble).toBeVisible({ timeout: 30_000 });

    // TC9-a: the bubble's own text content is the literal payload string —
    // proves the render layer treated it as plain text, not markup, and that
    // sanitizePromptParam() did NOT alter/escape the visible characters. If
    // HTML escaping regressed and corrupted the text (e.g. entity-encoded
    // it), this would also fail.
    await expect(bubble).toHaveText(payload);

    // TC9-b: no real <img> element was inserted into the DOM. If the render
    // layer regressed to dangerouslySetInnerHTML (or similar), this fails —
    // and the bubble's textContent would also go empty/blank, failing TC9-a.
    await expect(page.locator('.chat-user-message-query img')).toHaveCount(0);

    // TC9-c: settle period, then confirm the onerror handler never executed
    // (no dialog was ever triggered). Defense-in-depth alongside TC9-b —
    // catches actual script execution even if the DOM-shape check above were
    // somehow insufficient.
    await page.waitForTimeout(2_000);
    expect(dialogFired).toBe(false);
  });
});
