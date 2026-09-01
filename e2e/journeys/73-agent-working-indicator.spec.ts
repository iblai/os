import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, getPlatformContext } from '../utils/auth';
import { MENTOR_NEXTJS_HOST } from '../fixtures/test-data';
import { ChatPage } from '../page-objects/chat.page';

/**
 * Journey 73: Agent Working Indicator (issue #2217)
 *
 * A persistent "agent is working" indicator in chat, replacing a placeholder
 * that used to vanish the moment any token rendered — during a long agentic
 * turn (tool calls, reasoning, workflow steps) that disappearance made it
 * impossible to tell whether the agent was working or the app had hung.
 *
 * Driven end-to-end by the SDK's `ChatPhase` (`@iblai/iblai-js/web-utils`,
 * consumed via `useAdvancedChat`'s `chatPhase`), which the chat WebSocket
 * transport emits from raw frames — `WorkingIndicator`
 * (`components/chat/working-indicator.tsx`) renders a shimmering
 * `role="status"` line from it, mounted either standalone
 * (`AIWorkingMessage`, `data-testid="chat-working-message"`, before the
 * streaming bubble has anything to show) or embedded at the foot of the real
 * streaming bubble (`AIMessageBubble`) once it does — the two are mutually
 * exclusive by construction (`hasVisibleBubbleContent` gates both sides of
 * that switch identically).
 *
 * Chat is a raw WebSocket (`wss://.../ws/langflow/`), not REST, so frames
 * cannot be `page.route`-mocked. This spec reuses Journey 68's
 * (`68-agent-todo-list.spec.ts`) Tier-2 technique —
 * `ChatPage.mockChatWebSocket()`, a thin `page.routeWebSocket()` wrapper that
 * captures the client's real outbound send and lets the test script server
 * frames one at a time — and extends it with two frame shapes journey 68
 * never needed: a bare `{error, status_code}` frame with NO `eos` (the
 * original hang bug: real error frames are never followed by `eos`, the
 * socket just closes) and an `eos` carrying a session_id that does NOT match
 * the session in view (background-turn scoping). Exact phase-emission rules
 * were confirmed by reading `@iblai/web-utils`'s `useChat` message handler
 * directly (`node_modules/.../@iblai/web-utils/dist/index.esm.js`):
 *   - `{generation_id, session_id}` (no `data`, no `eos` key)  → `thinking`
 *   - `{type:'tool_call'|'tool_call.start', value:{name}}`     → `tool`
 *   - `{type:'tool_call.end', value:{...}}`                    → `thinking`
 *     (a finished tool tells us nothing about what runs next)
 *   - `{data: '<non-empty text>', session_id}` (no `eos`)      → `writing`
 *   - `{eos: true, session_id}`                                → turn ends,
 *     phase → idle (same for a frame with `error` — see the dedicated test)
 *   - a frame whose `session_id` differs from the session currently in view
 *     is silently ignored (background-session scoping)
 *
 * Both tiers of tests below share Journey 68's serial-mode +
 * cached-platform-context pattern: only the FIRST test performs a real
 * `navigateToMentorApp` login; every following test reuses the cached
 * `tenantKey`/`mentorId` and navigates directly. Each test still gets
 * Playwright's default fresh page/context, so per-test WS/REST mocks never
 * leak across tests. No mentor is ever created by this spec (unlike Journey
 * 52), so there is nothing to track/clean up: the "verbose reasoning"
 * (`show_reasoning`) setting is toggled via `ChatPage.mockShowReasoning()` —
 * a REST route patch — rather than by mutating the shared default mentor's
 * real settings, so parallel/subsequent runs against the same tenant are
 * unaffected.
 */
test.describe('Journey 73: Agent Working Indicator', () => {
  test.describe.configure({ mode: 'serial' });

  let tenantKey = '';
  let mentorId = '';

  test.beforeEach(async ({ page }) => {
    if (!tenantKey || !mentorId) {
      await navigateToMentorApp(page);
      ({ tenantKey, mentorId } = await getPlatformContext(page));
    }
  });

  /** Navigates to the (cached) mentor's chat page and waits for the shell. */
  async function gotoReadyChat(page: Page, chatPage: ChatPage) {
    await chatPage.gotoChat(MENTOR_NEXTJS_HOST, tenantKey, mentorId);
    await expect(
      page.getByRole('button', { name: 'Selected agent dropdown button' }),
    ).toBeVisible({ timeout: 30_000 });
  }

  /**
   * Fills and submits the composer without going through `chatPage.sendMessage()`.
   * That helper locates the textarea by ARIA role, and this journey's agent has
   * skills assigned — which flips the composer's role from `textbox` to
   * `combobox` (see the note above `getComposerTextarea()` in chat.page.ts), so
   * the role-based locator never resolves here. The id-based locator is stable
   * in both states.
   */
  async function sendViaComposer(
    chatPage: ChatPage,
    text: string,
  ): Promise<void> {
    const composer = chatPage.getComposerTextarea();
    await expect(composer).toBeVisible({ timeout: 15_000 });
    await composer.fill(text);
    await expect(chatPage.sendButton).toBeEnabled({ timeout: 10_000 });
    // Same settle as `chatPage.sendMessage()`: clicking the moment the button
    // enables can land before the app is ready to dispatch, and the prompt is
    // then never put on the socket — `waitForClientMessage()` waits forever.
    await chatPage.page.waitForTimeout(5_000);
    await chatPage.sendButton.click();
  }

  /** Sends `prompt` over the mocked socket and returns the client's session id. */
  async function sendAndCaptureSession(
    chatPage: ChatPage,
    ws: Awaited<ReturnType<ChatPage['mockChatWebSocket']>>,
    prompt: string,
  ): Promise<string> {
    await sendViaComposer(chatPage, prompt);
    const clientMessage = await ws.waitForClientMessage();
    expect(clientMessage.prompt).toBe(prompt);
    const sid =
      typeof clientMessage.session_id === 'string'
        ? clientMessage.session_id
        : '';
    expect(sid).not.toBe('');
    return sid;
  }

  // ── Checkpoint 1 (+ partial 4, 5): survives the first token, reports a stall ──

  test('the working indicator survives the first token and returns with reassurance copy once the stream stalls', async ({
    page,
    chatPage,
  }) => {
    const ws = await chatPage.mockChatWebSocket();
    await gotoReadyChat(page, chatPage);
    await chatPage.startNewChat();

    const prompt = 'Write me a short paragraph about lighthouses.';
    const sid = await sendAndCaptureSession(chatPage, ws, prompt);

    // Turn starts: the pre-token placeholder appears immediately, labeled by
    // the "thinking" phase.
    ws.send({ generation_id: `e2e-gen-${Date.now()}`, session_id: sid });
    const workingMessage = chatPage.getWorkingMessage();
    await expect(workingMessage).toBeVisible({ timeout: 10_000 });
    await expect(chatPage.getWorkingIndicator(workingMessage)).toContainText(
      /thinking/i,
    );

    // Checkpoint 5: exactly one Stop control on screen — the composer's, not
    // a second one from the indicator (it deliberately renders none).
    await expect(
      page.getByRole('button', { name: /stop streaming/i }),
    ).toHaveCount(1);
    await expect(workingMessage.locator('button')).toHaveCount(0);

    // First answer token arrives. The regression this feature fixes: the
    // whole "working" system used to unmount the instant ANY token
    // rendered. Prove it survived by later catching a stall and reappearing
    // — an unmounted component could never do that.
    ws.send({
      data: 'Lighthouses have guided sailors ',
      session_id: sid,
    });

    const aiMessage = chatPage.getLastAiMessage();
    await expect(aiMessage).toContainText('Lighthouses have guided sailors', {
      timeout: 10_000,
    });
    // The pre-token placeholder is gone — the real bubble now owns the turn.
    await expect(workingMessage).toHaveCount(0);
    // Checkpoint 4 (hide half): text is visibly moving, so the shimmer
    // legitimately stands down rather than repeating what is already on
    // screen.
    await expect(chatPage.getWorkingIndicator(aiMessage)).toHaveCount(0);

    // Checkpoint 4 (reappear half): no further tokens for longer than
    // STALLED_STREAM_DELAY_MS (15s, working-indicator.tsx) — the line must
    // come back with the reassurance copy.
    await expect(chatPage.getWorkingIndicator(aiMessage)).toBeVisible({
      timeout: 20_000,
    });
    await expect(chatPage.getWorkingIndicator(aiMessage)).toContainText(
      /still working/i,
    );

    // A fresh token is a new sign of life — the reassurance line stands
    // down again immediately.
    ws.send({ data: 'for centuries.', session_id: sid });
    await expect(aiMessage).toContainText('for centuries.', {
      timeout: 10_000,
    });
    await expect(chatPage.getWorkingIndicator(aiMessage)).toHaveCount(0);

    ws.send({ eos: true, session_id: sid });
    await expect(chatPage.getWorkingIndicator(aiMessage)).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: /stop streaming/i }),
    ).toHaveCount(0);
  });

  // ── Checkpoint 2: verbose reasoning OFF — shimmer alone carries the turn ──

  test('with verbose reasoning off, the shimmer alone carries the turn through thinking, tool use, and writing — no disclosure rows ever render', async ({
    page,
    chatPage,
  }) => {
    // Force verbose reasoning OFF rather than trusting the agent's server-side
    // default. Relying on that default made this test depend on tenant state:
    // with reasoning ON the tool_call frame renders a disclosure row, the
    // bubble becomes visible, and the shimmer correctly moves out of the
    // standalone placeholder into it — so the placeholder-scoped assertions
    // below stopped resolving.
    await chatPage.mockShowReasoning(false);
    const ws = await chatPage.mockChatWebSocket();
    await gotoReadyChat(page, chatPage);
    await chatPage.startNewChat();

    const prompt = 'What is the weather like on Mars?';
    const sid = await sendAndCaptureSession(chatPage, ws, prompt);

    ws.send({ generation_id: `e2e-gen-${Date.now()}`, session_id: sid });
    const workingMessage = chatPage.getWorkingMessage();
    await expect(chatPage.getWorkingIndicator(workingMessage)).toContainText(
      /thinking/i,
      { timeout: 10_000 },
    );
    await expect(chatPage.getReasoningTrigger()).toHaveCount(0);
    await expect(chatPage.getToolCallTrigger()).toHaveCount(0);

    // A tool call runs mid-turn — with reasoning off there is still no
    // disclosure row, so the shimmer itself carries the "Using ..." label.
    ws.send({
      type: 'tool_call',
      value: {
        id: 'toolu_1',
        name: 'Web Search',
        tool_input: { query: 'mars weather' },
        log: 'Invoking: `web_search`',
      },
      status_code: 200,
      session_id: sid,
    });
    await expect(chatPage.getWorkingIndicator(workingMessage)).toContainText(
      /using web search/i,
      { timeout: 10_000 },
    );
    await expect(chatPage.getToolCallTrigger()).toHaveCount(0);

    ws.send({
      type: 'tool_call.end',
      value: {
        id: 'toolu_1',
        name: 'Web Search',
        tool_input: { query: 'mars weather' },
        log: 'Invoking: `web_search`',
        result: 'about -60C on average',
      },
      status_code: 200,
      session_id: sid,
    });

    ws.send({
      data: 'Mars is very cold, averaging about -60°C.',
      session_id: sid,
    });
    const aiMessage = chatPage.getLastAiMessage();
    await expect(aiMessage).toContainText('Mars is very cold', {
      timeout: 10_000,
    });

    ws.send({ eos: true, session_id: sid });
    await expect(chatPage.getWorkingIndicator(aiMessage)).toHaveCount(0);

    // No disclosure rows ever rendered on this turn, from start to end.
    await expect(chatPage.getReasoningTrigger(aiMessage)).toHaveCount(0);
    await expect(chatPage.getToolCallTrigger(aiMessage)).toHaveCount(0);
  });

  // ── Checkpoint 3: verbose reasoning ON — rows take over liveness ──────────

  test('with verbose reasoning on, disclosure rows take over liveness and the shimmer stands down for exactly the phase already stated', async ({
    page,
    chatPage,
  }) => {
    await chatPage.mockShowReasoning();
    const ws = await chatPage.mockChatWebSocket();
    await gotoReadyChat(page, chatPage);
    await chatPage.startNewChat();

    const prompt =
      'Think it through, then search the web for the current Mars weather.';
    const sid = await sendAndCaptureSession(chatPage, ws, prompt);

    ws.send({ generation_id: `e2e-gen-${Date.now()}`, session_id: sid });
    const workingMessage = chatPage.getWorkingMessage();
    await expect(chatPage.getWorkingIndicator(workingMessage)).toContainText(
      /thinking/i,
      { timeout: 10_000 },
    );
    // No disclosure row yet — reasoningContent is still empty, so the
    // shimmer is the only thing conveying progress.
    await expect(chatPage.getReasoningTrigger()).toHaveCount(0);

    // Reasoning tokens arrive — the row mounts and takes over liveness from
    // the shimmer.
    ws.send({
      data: '',
      annotations: [
        {
          type: 'reasoning',
          text: 'Considering current Martian atmospheric data before answering.',
        },
      ],
      session_id: sid,
    });

    await expect(chatPage.aiMessages).toHaveCount(1, { timeout: 15_000 });
    const aiMessage = chatPage.getLastAiMessage();
    const thoughtTrigger = chatPage.getReasoningTrigger(aiMessage);
    await expect(thoughtTrigger).toBeVisible({ timeout: 10_000 });
    await expect(chatPage.getBounceDots(thoughtTrigger)).toHaveCount(3);
    // Invariant: exactly one element conveys progress — the shimmer stands
    // down the instant a visible row states the same phase.
    await expect(chatPage.getWorkingIndicator(aiMessage)).toHaveCount(0);

    // A tool call starts — liveness moves to the tool row; the reasoning
    // row goes static (its dots disappear) rather than both animating at
    // once.
    ws.send({
      type: 'tool_call',
      value: {
        id: 'toolu_1',
        name: 'Web Search',
        tool_input: { query: 'mars weather' },
        log: 'Invoking: `web_search`',
      },
      status_code: 200,
      session_id: sid,
    });
    const toolTrigger = chatPage.getToolCallTrigger(aiMessage);
    await expect(toolTrigger).toBeVisible({ timeout: 10_000 });
    await expect(chatPage.getBounceDots(toolTrigger)).toHaveCount(3, {
      timeout: 10_000,
    });
    await expect(chatPage.getBounceDots(thoughtTrigger)).toHaveCount(0);
    // Total animated dots across the whole message never exceed one row's
    // worth — never both rows, never zero while a live phase matches one.
    await expect(chatPage.getBounceDots(aiMessage)).toHaveCount(3);
    await expect(chatPage.getWorkingIndicator(aiMessage)).toHaveCount(0);

    ws.send({
      type: 'tool_call.end',
      value: {
        id: 'toolu_1',
        name: 'Web Search',
        tool_input: { query: 'mars weather' },
        log: 'Invoking: `web_search`',
        result: 'about -60C',
      },
      status_code: 200,
      session_id: sid,
    });
    // A finished tool with nothing queued next falls back to "thinking" —
    // liveness returns to the reasoning row.
    await expect(chatPage.getBounceDots(thoughtTrigger)).toHaveCount(3, {
      timeout: 10_000,
    });
    await expect(chatPage.getBounceDots(toolTrigger)).toHaveCount(0);
    await expect(chatPage.getBounceDots(aiMessage)).toHaveCount(3);

    // Answer text starts — both rows go static and the growing text itself
    // is the progress signal; the shimmer stays stood down.
    ws.send({ data: 'Mars is cold.', session_id: sid });
    await expect(aiMessage).toContainText('Mars is cold.', {
      timeout: 10_000,
    });
    await expect(chatPage.getBounceDots(aiMessage)).toHaveCount(0);
    await expect(chatPage.getWorkingIndicator(aiMessage)).toHaveCount(0);

    ws.send({ eos: true, session_id: sid });
    // Both rows remain as the completed record of the turn.
    await expect(toolTrigger).toBeVisible();
    await expect(thoughtTrigger).toBeVisible();
    await expect(chatPage.getWorkingIndicator(aiMessage)).toHaveCount(0);
  });

  // ── Checkpoint 6: prefers-reduced-motion ───────────────────────────────────

  test('prefers-reduced-motion: reduce renders static text and frozen dots, never the shimmer class', async ({
    page,
    chatPage,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await chatPage.mockShowReasoning();
    const ws = await chatPage.mockChatWebSocket();
    await gotoReadyChat(page, chatPage);
    await chatPage.startNewChat();

    const prompt = 'Explain tidal locking briefly.';
    const sid = await sendAndCaptureSession(chatPage, ws, prompt);

    ws.send({ generation_id: `e2e-gen-${Date.now()}`, session_id: sid });
    const workingMessage = chatPage.getWorkingMessage();
    const shimmerSpan = chatPage
      .getWorkingIndicator(workingMessage)
      .locator('span')
      .first();
    await expect(shimmerSpan).toBeVisible({ timeout: 10_000 });
    await expect(shimmerSpan).not.toHaveClass(/ibl-text-shimmer/);
    await expect(shimmerSpan).toHaveClass(/text-muted-foreground/);

    // The reasoning row's bounce dots exist in the DOM (isActive is still
    // true) but must not actually animate under reduced motion.
    ws.send({
      data: '',
      annotations: [
        {
          type: 'reasoning',
          text: 'Thinking about tidal locking mechanics in some detail here.',
        },
      ],
      session_id: sid,
    });
    const aiMessage = chatPage.getLastAiMessage();
    const thoughtTrigger = chatPage.getReasoningTrigger(aiMessage);
    await expect(thoughtTrigger).toBeVisible({ timeout: 10_000 });
    const dots = chatPage.getBounceDots(thoughtTrigger);
    await expect(dots).toHaveCount(3);
    const animationName = await dots
      .first()
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(animationName).toBe('none');

    ws.send({ eos: true, session_id: sid });
  });

  // ── Checkpoint 7: error frame with NO eos must clear the indicator ────────

  test('an error frame with no eos clears the working indicator — the original hang bug', async ({
    page,
    chatPage,
  }) => {
    const ws = await chatPage.mockChatWebSocket();
    await gotoReadyChat(page, chatPage);
    await chatPage.startNewChat();

    const prompt = 'Trigger a simulated backend failure.';
    const sid = await sendAndCaptureSession(chatPage, ws, prompt);

    ws.send({ generation_id: `e2e-gen-${Date.now()}`, session_id: sid });
    const workingMessage = chatPage.getWorkingMessage();
    await expect(workingMessage).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole('button', { name: /stop streaming/i }),
    ).toHaveCount(1);

    // Error frame, deliberately with NO `eos` — real error frames are never
    // followed by one; the socket just closes right after. This is exactly
    // the shape that used to leave the placeholder stuck forever.
    ws.send({
      error: 'Simulated backend failure',
      status_code: 500,
      session_id: sid,
    });

    await expect(workingMessage).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByTestId('chat-working-indicator')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: /stop streaming/i }),
    ).toHaveCount(0);
  });

  // ── Checkpoint 8: background-session scoping ───────────────────────────────

  test('an eos frame for a different session does not clear the indicator for the session in view', async ({
    page,
    chatPage,
  }) => {
    const ws = await chatPage.mockChatWebSocket();
    await gotoReadyChat(page, chatPage);
    await chatPage.startNewChat();

    const prompt = 'How many moons does Jupiter have?';
    const sid = await sendAndCaptureSession(chatPage, ws, prompt);

    ws.send({ generation_id: `e2e-gen-${Date.now()}`, session_id: sid });
    const workingMessage = chatPage.getWorkingMessage();
    await expect(workingMessage).toBeVisible({ timeout: 10_000 });

    // A DIFFERENT (background) session finishing must not clear the
    // indicator for the session currently in view — the SDK ignores any
    // frame whose session_id doesn't match the active one.
    const foreignSessionId = `e2e-other-session-${Date.now()}`;
    ws.send({ eos: true, session_id: foreignSessionId });

    // There is no positive event to await for a frame that is correctly
    // ignored — give it a moment to have been (mis)processed, then confirm
    // nothing changed.
    await page.waitForTimeout(2_000);
    await expect(workingMessage).toBeVisible();
    await expect(
      page.getByRole('button', { name: /stop streaming/i }),
    ).toHaveCount(1);

    // The REAL session's eos correctly ends the turn — contrast confirms
    // the scoping check above, not just a socket that ignores everything.
    ws.send({ eos: true, session_id: sid });
    await expect(workingMessage).toHaveCount(0, { timeout: 10_000 });
  });

  // ── Checkpoint 9: one agent frame per turn, including on write_todos ──────

  test('a write_todos turn never stacks two agent message frames', async ({
    page,
    chatPage,
  }) => {
    await chatPage.mockShowReasoning();
    const ws = await chatPage.mockChatWebSocket();
    await gotoReadyChat(page, chatPage);
    await chatPage.startNewChat();

    const prompt = 'Plan a 3-step onboarding checklist.';
    const sid = await sendAndCaptureSession(chatPage, ws, prompt);

    // Exactly one of {standalone placeholder, real bubble} exists at any
    // instant — the two are mutually exclusive by construction.
    const agentFrame = page
      .getByTestId('chat-working-message')
      .or(chatPage.aiMessages);

    ws.send({ generation_id: `e2e-gen-${Date.now()}`, session_id: sid });
    await expect(agentFrame).toHaveCount(1, { timeout: 10_000 });

    const todos = [
      { content: 'Send welcome email', status: 'pending' },
      { content: 'Assign onboarding buddy', status: 'pending' },
    ];
    ws.send({
      type: 'tool_call',
      value: {
        id: 'toolu_wt',
        name: 'write_todos',
        tool_input: { todos },
        log: "Invoking: `write_todos` with `{'todos': [...]}`",
      },
      status_code: 200,
      session_id: sid,
    });
    ws.send({
      type: 'tool_call.end',
      value: {
        id: 'toolu_wt',
        name: 'write_todos',
        tool_input: { todos },
        log: "Invoking: `write_todos` with `{'todos': [...]}`",
        result: 'Updated todo list to [...]',
      },
      status_code: 200,
      session_id: sid,
    });

    await expect(agentFrame).toHaveCount(1, { timeout: 10_000 });
    await expect(
      chatPage.getAgentTodoList(chatPage.getLastAiMessage()),
    ).toBeVisible({ timeout: 10_000 });

    ws.send({ data: 'Here is your checklist.', session_id: sid });
    await expect(chatPage.getLastAiMessage()).toContainText(
      'Here is your checklist.',
      { timeout: 10_000 },
    );
    await expect(agentFrame).toHaveCount(1);

    ws.send({ eos: true, session_id: sid });
    await expect(agentFrame).toHaveCount(1);
  });
});
