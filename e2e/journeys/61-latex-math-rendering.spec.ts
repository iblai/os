import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, getPlatformContext } from '../utils/auth';
import { MENTOR_NEXTJS_HOST } from '../fixtures/test-data';

/**
 * Journey 61: LaTeX / Math Rendering
 *
 * Covers the behaviour first fixed for GitHub issue #2109 ("Improve latex
 * compatibility for rendering chat messages and artifacts"): currency like
 * "I have $5" must stay literal text, while backslash-free / digit-leading
 * inline math like `$3x + 5$` and `$x = 4$` must still render, and a leading
 * currency amount must not swallow the opening `$` of a real math span later
 * on the same line.
 *
 * Issue #2441 replaced the hand-rolled `preprocessLaTeX` string rewriter that
 * originally implemented this with a maintained tokenizer: `@ziloen/remark-math`
 * (patched) decides `$...$` at the micromark level using Pandoc's
 * `tex_math_dollars` rule — an opening `$` must be followed by a non-space, a
 * closing `$` preceded by a non-space and not followed by a digit. Currency
 * therefore never opens a span in the first place, so no escaping and no
 * rewind scan is needed. The user-visible contract asserted below is
 * unchanged, which is the point of keeping this journey.
 *
 * Deterministic seam: live chat streams over a raw WebSocket
 * (`useChat` in `@iblai/web-utils`), which has no practical Playwright
 * route-mocking seam without reimplementing the wire protocol. Instead this
 * journey drives the public "shared chat" page
 * (`app/share/chat/[sessionId]/[tenantKey]/[mentorId]/page.tsx`), which
 * fetches message history over a plain REST GET
 * (`.../sessions/{sessionId}/shared/`) and renders it through the exact same
 * `ChatMessages` -> `AIMessageBubble` -> `MessagePreview` -> `<Markdown>`
 * component tree as live chat. `ChatPage.mockSharedChatSession` intercepts
 * that GET with `page.route` and injects a FIXED assistant markdown message,
 * so every assertion below is against real KaTeX/Streamdown rendering of
 * known-in-advance content — no LLM in the loop, no flakiness from varying
 * model output.
 */
test.describe('Journey 61: LaTeX / Math Rendering', () => {
  // Run this journey's tests serially on a single worker. Each test's setup
  // navigates the real app with the shared admin storageState; letting the
  // five tests race across parallel workers had them hit the backend with the
  // same admin JWT simultaneously, which intermittently failed the app shell
  // load (`Selected agent dropdown button` never appearing). Serial keeps a
  // single warmed session — combined with the cached platform context below,
  // the app login happens exactly once for the whole journey.
  test.describe.configure({ mode: 'serial' });

  let tenantKey = '';
  let mentorId = '';

  // Resolve the (constant) admin tenant + mentor once per worker rather than
  // once per test. `navigateToMentorApp` is a full real-backend SSO login;
  // running it in every `beforeEach` put 5+ concurrent logins on the auth
  // service (×N under --repeat-each), which starved the local prod server and
  // made the shared-chat bubble render race past its wait — a load-induced
  // flake. The shared-chat page under test is fully network-mocked and auth
  // rides on the saved storageState, so tests after the first only need the
  // cached ids. `tenantKey`/`mentorId` persist across tests within a worker.
  test.beforeEach(async ({ page, chatPage }) => {
    if (!tenantKey || !mentorId) {
      await navigateToMentorApp(page);
      ({ tenantKey, mentorId } = await getPlatformContext(page));
    }
    void chatPage;
  });

  test('admin views a shared chat message with inline math and it renders as KaTeX with no raw dollar signs', async ({
    page,
    chatPage,
  }) => {
    const content =
      'Solving for x: $3x + 5$ is the expression, $x = 4$ is one solution, ' +
      '$2x + 6$ is another form, and $3(4) + 5$ shows substitution.';

    const sessionId = await chatPage.mockSharedChatSession(
      tenantKey,
      mentorId,
      content,
    );
    await chatPage.gotoSharedChat(
      MENTOR_NEXTJS_HOST,
      sessionId,
      tenantKey,
      mentorId,
    );

    const aiMessage = await chatPage.waitForAiMessageWithText('Solving for x:');

    const math = chatPage.getRenderedMath(aiMessage);
    await expect(math).toHaveCount(4, { timeout: 15_000 });

    // The raw, undelimited-by-KaTeX source must not leak through as plain
    // text — that's exactly the bug: `$3x` mangled into `\$3x`.
    const bubbleText = await aiMessage.innerText();
    expect(bubbleText).not.toContain('$3x + 5$');
    expect(bubbleText).not.toContain('$x = 4$');
    expect(bubbleText).not.toContain('$2x + 6$');
    expect(bubbleText).not.toContain('$3(4) + 5$');
    expect(bubbleText).not.toMatch(/\\\$/);
  });

  test('admin views a shared chat message with block math and it renders as KaTeX display blocks', async ({
    page,
    chatPage,
  }) => {
    // The fenced form below — `$$` alone on its own line either side — is the
    // canonical shape for display math and what LLMs naturally emit for a
    // standalone equation, so it is the realistic case for this checkpoint.
    // (A single-line `$$3x + 5$$` also renders as display math; that variant
    // is pinned by unit tests rather than here.)
    const content = [
      '$$',
      '3x + 5',
      '$$',
      '',
      '$$',
      '17',
      '$$',
      '',
      '$$',
      '0.075 \\text{ L} \\times \\frac{1000 \\text{ mL}}{1 \\text{ L}} = 75 \\text{ mL}',
      '$$',
    ].join('\n');

    const sessionId = await chatPage.mockSharedChatSession(
      tenantKey,
      mentorId,
      content,
    );
    await chatPage.gotoSharedChat(
      MENTOR_NEXTJS_HOST,
      sessionId,
      tenantKey,
      mentorId,
    );

    // '17' is a unique rendered marker across the three equations (does not
    // appear as a substring of "0.075", "1000", or "3x + 5").
    const aiMessage = await chatPage.waitForAiMessageWithText('17');

    const blockMath = chatPage.getRenderedBlockMath(aiMessage);
    await expect(blockMath).toHaveCount(3, { timeout: 15_000 });

    const mathSource = await chatPage
      .getRenderedMathSource(aiMessage)
      .allTextContents();
    expect(mathSource.some((s) => s.replace(/\s+/g, '') === '3x+5')).toBe(true);
    expect(mathSource.some((s) => s.replace(/\s+/g, '') === '17')).toBe(true);
    expect(mathSource.some((s) => s.includes('75') && s.includes('mL'))).toBe(
      true,
    );

    const bubbleText = await aiMessage.innerText();
    expect(bubbleText).not.toContain('$$3x + 5$$');
    expect(bubbleText).not.toContain('$$17$$');
    expect(bubbleText).not.toMatch(/\\\$/);
  });

  test('admin views a shared chat message with currency amounts and they stay literal text, not KaTeX', async ({
    page,
    chatPage,
  }) => {
    const content = 'I have $5 and $10, it costs $5, and the total is $3.50.';

    const sessionId = await chatPage.mockSharedChatSession(
      tenantKey,
      mentorId,
      content,
    );
    await chatPage.gotoSharedChat(
      MENTOR_NEXTJS_HOST,
      sessionId,
      tenantKey,
      mentorId,
    );

    const aiMessage = await chatPage.waitForAiMessageWithText('$3.50');

    // No math should have been detected at all.
    await expect(chatPage.getRenderedMath(aiMessage)).toHaveCount(0, {
      timeout: 15_000,
    });

    const bubbleText = await aiMessage.innerText();
    expect(bubbleText).toContain('$5');
    expect(bubbleText).toContain('$10');
    expect(bubbleText).toContain('$3.50');
    // The escape backslash itself must never be visible to the user.
    expect(bubbleText).not.toMatch(/\\\$/);
  });

  test('admin views a shared chat message mixing currency and math on the same line — money first, then math', async ({
    page,
    chatPage,
  }) => {
    const content =
      'the kit costs $12, and the formula $3x + 5$ gives the price.';

    const sessionId = await chatPage.mockSharedChatSession(
      tenantKey,
      mentorId,
      content,
    );
    await chatPage.gotoSharedChat(
      MENTOR_NEXTJS_HOST,
      sessionId,
      tenantKey,
      mentorId,
    );

    const aiMessage = await chatPage.waitForAiMessageWithText('$12');

    // Exactly one math expression ($3x + 5$); $12 stays literal.
    await expect(chatPage.getRenderedMath(aiMessage)).toHaveCount(1, {
      timeout: 15_000,
    });

    const mathSource = await chatPage
      .getRenderedMathSource(aiMessage)
      .allTextContents();
    expect(mathSource.some((s) => s.replace(/\s+/g, '') === '3x+5')).toBe(true);

    const bubbleText = await aiMessage.innerText();
    expect(bubbleText).toContain('$12');
    expect(bubbleText).not.toContain('$3x + 5$');
    expect(bubbleText).not.toMatch(/\\\$/);
  });

  test('admin views a shared chat message mixing currency and math on the same line — math first, then money', async ({
    page,
    chatPage,
  }) => {
    const content = 'since $2x = 8$, each unit is $8 and the pair is $16.';

    const sessionId = await chatPage.mockSharedChatSession(
      tenantKey,
      mentorId,
      content,
    );
    await chatPage.gotoSharedChat(
      MENTOR_NEXTJS_HOST,
      sessionId,
      tenantKey,
      mentorId,
    );

    // '$16' is a unique literal marker (unlike '$8', which is a substring of
    // neither other amount but is worth avoiding for clarity of intent).
    const aiMessage = await chatPage.waitForAiMessageWithText('$16');

    // Exactly one math expression ($2x = 8$); $8 and $16 stay literal.
    await expect(chatPage.getRenderedMath(aiMessage)).toHaveCount(1, {
      timeout: 15_000,
    });

    const mathSource = await chatPage
      .getRenderedMathSource(aiMessage)
      .allTextContents();
    expect(mathSource.some((s) => s.replace(/\s+/g, '') === '2x=8')).toBe(true);

    const bubbleText = await aiMessage.innerText();
    expect(bubbleText).toContain('$8');
    expect(bubbleText).toContain('$16');
    expect(bubbleText).not.toContain('$2x = 8$');
    expect(bubbleText).not.toMatch(/\\\$/);
  });
});
