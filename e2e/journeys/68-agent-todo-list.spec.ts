import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, getPlatformContext } from '../utils/auth';
import { MENTOR_NEXTJS_HOST } from '../fixtures/test-data';
import { ChatPage } from '../page-objects/chat.page';

/**
 * Journey 68: Agent Task List (write_todos)
 *
 * Covers the "agent task list" feature (issue #2216): a Base Agent plans
 * multi-step work with the deep-agent `write_todos` tool. Every call streams
 * a FULL REPLACEMENT todo list (`components/chat/agent-todo-list.tsx`), and
 * is gated on the mentor's `show_reasoning` setting
 * (`hooks/use-mentors/use-mentor-settings.ts`, default `false`) — same gate
 * as the generic tool-call indicator and reasoning section.
 *
 * Two independent, deterministic seams are used because no single seam
 * covers the whole feature:
 *
 * TIER 1 — REST history seam (live, authenticated chat page). Mocks the
 * mentor-settings GET (`show_reasoning: true`, patched onto the real
 * response via `route.fetch()` so every other field stays real) and the
 * session chat-history GET
 * (`GET /api/ai-mentor/orgs/{org}/users/{user_id}/sessions/{sessionId}/`,
 * `useLazyGetSessionIdQuery` from `@iblai/data-layer`) to inject a
 * `write_todos` tool call onto a historical AI message. This is the FIRST
 * real fixture-backed validation of the SDK's `toolCallFromHistoryEntry`
 * parser (`@iblai/web-utils`), which accepts two guessed-at shapes with no
 * prior fixture in either repo:
 *   - LangChain: `{ id, name, args: { todos: [...] } }`
 *   - OpenAI:    `{ id, type: 'function', function: { name, arguments: '<json>' } }`
 * Deliberately NOT the shared-chat REST seam used by Journey 61
 * (`ChatPage.mockSharedChatSession`): the shared-chat page never passes
 * `showReasoning` (the list would never render), and
 * `transformChatMessage` (`hooks/use-shared-chat-messages.ts`) normalizes
 * history down to `{role, content}`, dropping tool calls entirely.
 *
 * TIER 2 — `page.routeWebSocket()` against the live chat socket
 * (`wss://.../ws/langflow/`, `useChat` in `@iblai/iblai-js/web-utils`).
 * Scripts the minimum protocol (`generation_id` start frame, `tool_call` /
 * `tool_call.end` pairs, `eos`) to drive a real streaming turn end-to-end,
 * covering the behaviours a static history fixture cannot: auto-collapse on
 * completion, wholesale replacement of the list mid-turn, the shimmer on
 * the active row, and the throttled screen-reader announcer.
 *
 * Both tiers share the serial-mode + cached-platform-context pattern from
 * Journey 61: only the FIRST test performs a real `navigateToMentorApp`
 * login; every following test reuses the cached `tenantKey`/`mentorId` and
 * navigates directly (each test still gets Playwright's default fresh
 * page/context, so per-test mocks never leak across tests — only the two
 * *strings* are cached, not any live browser state).
 */
test.describe('Journey 68: Agent Task List', () => {
  test.describe.configure({ mode: 'serial' });

  let tenantKey = '';
  let mentorId = '';

  test.beforeEach(async ({ page, chatPage }) => {
    if (!tenantKey || !mentorId) {
      await navigateToMentorApp(page);
      ({ tenantKey, mentorId } = await getPlatformContext(page));
    }
    void chatPage;
  });

  /** Unique per-test session id so route mocks never collide across tests. */
  function newSessionId(label: string): string {
    return `e2e-todo-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /** Navigates to the (cached) mentor's chat page and waits for the shell. */
  async function gotoReadyChat(page: Page, chatPage: ChatPage) {
    await chatPage.gotoChat(MENTOR_NEXTJS_HOST, tenantKey, mentorId);
    await expect(
      page.getByRole('button', { name: 'Selected agent dropdown button' }),
    ).toBeVisible({ timeout: 30_000 });
  }

  test('admin views chat history with a LangChain-shape write_todos call and sees the rendered, collapsible task list', async ({
    page,
    chatPage,
  }) => {
    const sessionId = newSessionId('langchain');
    const todos = [
      { content: 'Gather course requirements', status: 'completed' },
      { content: 'Draft the course outline', status: 'in_progress' },
      { content: 'Get user approval', status: 'pending' },
    ];

    await chatPage.mockShowReasoning();
    await chatPage.seedCachedSessionId(mentorId, sessionId);
    await chatPage.mockChatHistoryWithToolCalls(
      sessionId,
      [{ id: 'toolu_01', name: 'write_todos', args: { todos } }],
      { aiContent: 'Let me plan this out.' },
    );

    await gotoReadyChat(page, chatPage);
    const aiMessage = await chatPage.waitForAiMessageWithText(
      'Let me plan this out.',
    );

    // Checkpoint 1 (panel + header): the panel and its collapsed trigger
    // are visible immediately — title + progress summary render even
    // before the row list itself is expanded.
    const panel = chatPage.getAgentTodoList(aiMessage);
    await expect(panel).toBeVisible({ timeout: 15_000 });

    // Checkpoint 2: "N of M done" progress summary (1 completed of 3) is
    // visible even while the row list underneath is collapsed.
    await expect(chatPage.getAgentTodoProgress(aiMessage)).toContainText(
      '1 of 3 done',
    );

    // Checkpoint 3 (collapsed-when-complete half): a historical (non
    // streaming) message's row list starts collapsed — Radix's
    // `CollapsibleContent` does not mount its children until opened, so the
    // `<li>` rows genuinely do not exist in the DOM yet.
    const itemsContainer = chatPage.getAgentTodoItemsContainer(aiMessage);
    await expect(itemsContainer).not.toBeVisible();
    await expect(chatPage.getAgentTodoItems(aiMessage)).toHaveCount(0);

    // Clicking the trigger re-expands it, mounting the rows.
    await chatPage.getAgentTodoTrigger(aiMessage).click();
    await expect(itemsContainer).toBeVisible({ timeout: 10_000 });

    // Checkpoint 1 (rows): a real <ol> with one <li> per todo, status via
    // data-status + sr-only word + icon — no visible status text on rows.
    const items = chatPage.getAgentTodoItems(aiMessage);
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toHaveAttribute('data-status', 'completed');
    await expect(items.nth(1)).toHaveAttribute('data-status', 'in_progress');
    await expect(items.nth(2)).toHaveAttribute('data-status', 'pending');
    // Each row carries a decorative (aria-hidden) status icon.
    await expect(items.nth(0).locator('svg[aria-hidden="true"]')).toHaveCount(
      1,
    );

    // Status words exist in the DOM for assistive tech but are not
    // rendered as visible row text — `sr-only` clips the box to 1x1px
    // rather than setting `display:none`, so Playwright's `toBeVisible()`
    // (which only checks display/visibility/zero-size) still reports it as
    // visible. Asserting the `sr-only` class directly is the precise,
    // cross-browser-safe proof that this is screen-reader-only content.
    await expect(items.nth(0).getByText('Done', { exact: true })).toHaveClass(
      /\bsr-only\b/,
    );
    await expect(
      items.nth(1).getByText('In progress', { exact: true }),
    ).toHaveClass(/\bsr-only\b/);
    await expect(items.nth(2).getByText('To do', { exact: true })).toHaveClass(
      /\bsr-only\b/,
    );

    // Bonus (component behaviour, not gated on streaming state): the
    // in-progress row's text carries the shimmer sweep class.
    await expect(items.nth(1).locator('.todo-shimmer')).toHaveCount(1);

    // Checkpoint 7: write_todos never appears in the generic "Used N
    // tools" indicator — with no other tool call present, that indicator
    // must not render at all.
    await expect(aiMessage.getByText(/Used \d+ tools?/)).toHaveCount(0);

    // Checkpoint 10: the list survives a page reload (recovered from chat
    // history), and mounts freshly collapsed again.
    await page.reload({ waitUntil: 'domcontentloaded' });
    const aiMessageAfterReload = await chatPage.waitForAiMessageWithText(
      'Let me plan this out.',
    );
    await expect(
      chatPage.getAgentTodoItemsContainer(aiMessageAfterReload),
    ).not.toBeVisible();
    await chatPage.getAgentTodoTrigger(aiMessageAfterReload).click();
    await expect(chatPage.getAgentTodoItems(aiMessageAfterReload)).toHaveCount(
      3,
    );
    await expect(
      chatPage.getAgentTodoProgress(aiMessageAfterReload),
    ).toContainText('1 of 3 done');
  });

  test('admin views chat history with an OpenAI-shape write_todos call alongside another tool, and write_todos stays out of the generic tool indicator', async ({
    page,
    chatPage,
  }) => {
    const sessionId = newSessionId('openai');
    const todos = [
      { content: 'Look up docs', status: 'completed' },
      { content: 'Summarize findings', status: 'pending' },
    ];

    await chatPage.mockShowReasoning();
    await chatPage.seedCachedSessionId(mentorId, sessionId);
    await chatPage.mockChatHistoryWithToolCalls(
      sessionId,
      [
        // A companion, non-write_todos tool call (LangChain shape) so the
        // generic "Used N tools" indicator has something legitimate to show.
        {
          id: 'call_web_1',
          name: 'web_search_call',
          args: { query: 'course design best practices' },
        },
        // The write_todos call itself, OpenAI shape: function.arguments is
        // a JSON *string*, not a structured object.
        {
          id: 'call_wt_1',
          type: 'function',
          function: {
            name: 'write_todos',
            arguments: JSON.stringify({ todos }),
          },
        },
      ],
      { aiContent: 'Let me look into that for you.' },
    );

    await gotoReadyChat(page, chatPage);
    const aiMessage = await chatPage.waitForAiMessageWithText(
      'Let me look into that for you.',
    );

    // Progress summary is visible even before the row list is expanded.
    await expect(chatPage.getAgentTodoProgress(aiMessage)).toContainText(
      '1 of 2 done',
    );

    // Expand the task-list panel — its rows render both todos from the
    // OpenAI-shape call.
    const itemsContainer = chatPage.getAgentTodoItemsContainer(aiMessage);
    await chatPage.getAgentTodoTrigger(aiMessage).click();
    await expect(itemsContainer).toBeVisible({ timeout: 10_000 });
    const items = chatPage.getAgentTodoItems(aiMessage);
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toHaveAttribute('data-status', 'completed');
    await expect(items.nth(1)).toHaveAttribute('data-status', 'pending');

    // Checkpoint 7: the generic indicator counts only the companion tool
    // (1) — write_todos is never counted, never shown as its own "Write
    // todos" row, and its todo text never leaks into the generic card.
    const genericTrigger = aiMessage.getByText(/^Used 1 tool$/);
    await expect(genericTrigger).toBeVisible({ timeout: 10_000 });
    await genericTrigger.click();
    await expect(
      aiMessage.getByText('course design best practices'),
    ).toBeVisible({ timeout: 10_000 });
    expect(await aiMessage.getByText('Write todos').count()).toBe(0);
    // The todo content itself only ever appears once on the page — inside
    // the task-list panel, never duplicated into a generic tool row.
    await expect(page.getByText('Look up docs')).toHaveCount(1);
  });

  test('admin views chat history with an unrecognized todo status and a malformed tool-call entry, and the task list degrades gracefully', async ({
    page,
    chatPage,
  }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    const sessionId = newSessionId('malformed');
    const todos = [
      { content: 'Investigate the issue', status: 'blocked' }, // unknown status
      { content: 'Confirm the fix', status: 'completed' },
    ];

    await chatPage.mockShowReasoning();
    await chatPage.seedCachedSessionId(mentorId, sessionId);
    await chatPage.mockChatHistoryWithToolCalls(
      sessionId,
      [
        // Malformed: no `name` and no `function.name` — must be dropped by
        // `toolCallFromHistoryEntry` without throwing.
        { id: 'bad-no-name' },
        { id: 'toolu_ok', name: 'write_todos', args: { todos } },
      ],
      { aiContent: 'Working through this now.' },
    );

    await gotoReadyChat(page, chatPage);
    const aiMessage = await chatPage.waitForAiMessageWithText(
      'Working through this now.',
    );

    // Expand the panel — rows only mount once opened.
    await chatPage.getAgentTodoTrigger(aiMessage).click();
    await expect(chatPage.getAgentTodoItemsContainer(aiMessage)).toBeVisible({
      timeout: 10_000,
    });

    // Checkpoint 5: unknown status ("blocked") renders as pending rather
    // than being dropped.
    const items = chatPage.getAgentTodoItems(aiMessage);
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toHaveAttribute('data-status', 'pending');
    await expect(items.nth(1)).toHaveAttribute('data-status', 'completed');
    // sr-only status word reflects the normalized status, attached to the
    // DOM even though visually hidden.
    await expect(
      items.nth(0).getByText('To do', { exact: true }),
    ).toBeAttached();

    // The malformed entry did not crash the page or trip the ErrorBoundary.
    await expect(page.getByText('Oops, there was an error!')).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test('admin views chat history for a turn with no write_todos call and sees no task-list affordance', async ({
    page,
    chatPage,
  }) => {
    const sessionId = newSessionId('none');

    await chatPage.mockShowReasoning();
    await chatPage.seedCachedSessionId(mentorId, sessionId);
    // No tool calls at all on this turn.
    await chatPage.mockChatHistoryWithToolCalls(sessionId, [], {
      aiContent: 'Here is a quick answer, no plan needed.',
    });

    await gotoReadyChat(page, chatPage);
    const aiMessage = await chatPage.waitForAiMessageWithText(
      'Here is a quick answer, no plan needed.',
    );

    // Checkpoint 6: no panel, no header, no skeleton — nothing at all.
    await expect(chatPage.getAgentTodoList(aiMessage)).toHaveCount(0);
    await expect(aiMessage.getByText(/Used \d+ tools?/)).toHaveCount(0);
  });

  // ── Tier 2: live streaming via the mocked chat WebSocket ──────────────────

  test('admin sends a message and watches the agent task list stream live, replace wholesale, and auto-collapse when the turn completes', async ({
    page,
    chatPage,
  }) => {
    await chatPage.mockShowReasoning();
    const ws = await chatPage.mockChatWebSocket();

    await gotoReadyChat(page, chatPage);
    await chatPage.startNewChat();

    const prompt = 'Plan a short onboarding course for new hires.';
    await chatPage.sendMessage(prompt);

    // Observe the client's outbound send before scripting any response.
    const clientMessage = await ws.waitForClientMessage();
    expect(clientMessage.prompt).toBe(prompt);
    const sid =
      typeof clientMessage.session_id === 'string'
        ? clientMessage.session_id
        : '';

    const genId = `e2e-gen-${Date.now()}`;
    ws.send({ generation_id: genId, session_id: sid });

    // First write_todos call — Plan A.
    const planA = [
      { content: 'Gather course requirements', status: 'completed' },
      { content: 'Draft the outline', status: 'in_progress' },
    ];
    ws.send({
      type: 'tool_call',
      value: {
        id: 'toolu_planA',
        name: 'write_todos',
        tool_input: { todos: planA },
        log: "Invoking: `write_todos` with `{'todos': [...]}`",
      },
      status_code: 200,
      session_id: sid,
    });
    ws.send({
      type: 'tool_call.end',
      value: {
        id: 'toolu_planA',
        name: 'write_todos',
        tool_input: { todos: planA },
        log: "Invoking: `write_todos` with `{'todos': [...]}`",
        result: 'Updated todo list to [...]',
      },
      status_code: 200,
      session_id: sid,
    });

    await expect(chatPage.aiMessages).toHaveCount(1, { timeout: 15_000 });
    const aiMessage = chatPage.getLastAiMessage();

    // Checkpoint 3 (expanded-while-streaming half): the panel is open by
    // default while the turn is still streaming — no click required.
    const itemsContainer = chatPage.getAgentTodoItemsContainer(aiMessage);
    await expect(itemsContainer).toBeVisible({ timeout: 15_000 });
    let items = chatPage.getAgentTodoItems(aiMessage);
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toHaveAttribute('data-status', 'completed');
    await expect(items.nth(1)).toHaveAttribute('data-status', 'in_progress');
    // Checkpoint 8: the in-progress row shimmers while streaming.
    await expect(items.nth(1).locator('.todo-shimmer')).toHaveCount(1);

    // Second write_todos call — Plan B, a DIFFERENT id, completely
    // different content and count.
    const planB = [
      { content: 'Review pricing options', status: 'pending' },
      { content: 'Send proposal', status: 'pending' },
      { content: 'Schedule kickoff', status: 'pending' },
    ];
    ws.send({
      type: 'tool_call',
      value: {
        id: 'toolu_planB',
        name: 'write_todos',
        tool_input: { todos: planB },
        log: "Invoking: `write_todos` with `{'todos': [...]}`",
      },
      status_code: 200,
      session_id: sid,
    });
    ws.send({
      type: 'tool_call.end',
      value: {
        id: 'toolu_planB',
        name: 'write_todos',
        tool_input: { todos: planB },
        log: "Invoking: `write_todos` with `{'todos': [...]}`",
        result: 'Updated todo list to [...]',
      },
      status_code: 200,
      session_id: sid,
    });

    // Checkpoint 4: wholesale replacement — Plan B entirely replaces Plan
    // A, never merges/appends.
    items = chatPage.getAgentTodoItems(aiMessage);
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toHaveAttribute('data-status', 'pending');
    await expect(items.nth(1)).toHaveAttribute('data-status', 'pending');
    await expect(items.nth(2)).toHaveAttribute('data-status', 'pending');
    await expect(chatPage.getAgentTodoProgress(aiMessage)).toContainText(
      '0 of 3 done',
    );
    const replacedText = await itemsContainer.innerText();
    expect(replacedText).not.toContain('Gather course requirements');
    expect(replacedText).not.toContain('Draft the outline');
    expect(replacedText).toContain('Review pricing options');

    // Checkpoint 9: the throttled announcer carries ONLY the summary for
    // the latest (Plan B) list, never todo text. `TODO_ANNOUNCE_THROTTLE_MS`
    // is 2s — `toHaveText` polls rather than a fixed sleep.
    const announcer = chatPage.getAgentTodoAnnouncer(aiMessage);
    await expect(announcer).toHaveText(/Step 0 of 3 complete/, {
      timeout: 6_000,
    });
    const announcerText = await announcer.innerText();
    expect(announcerText).not.toContain('Review pricing options');

    // End the turn.
    ws.send({ data: 'All set — check out the plan above.', session_id: sid });
    ws.send({ eos: true, session_id: sid });

    // Checkpoint 3 (auto-collapse half): once the turn completes, the
    // panel auto-collapses (but the panel itself, with its progress
    // summary, stays).
    await expect(itemsContainer).not.toBeVisible({ timeout: 15_000 });
    await expect(chatPage.getAgentTodoList(aiMessage)).toBeVisible();

    // Clicking the trigger re-expands it.
    await chatPage.getAgentTodoTrigger(aiMessage).click();
    await expect(itemsContainer).toBeVisible({ timeout: 10_000 });
  });
});
