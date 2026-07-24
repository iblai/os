import { test, expect } from '../fixtures/mentor-test';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { MentorTracker } from '../utils/mentor-cleanup';
import {
  sendAgentChatMessage,
  waitForAgentChatResponse,
} from '@iblai/iblai-js/playwright';

/**
 * Journey 64 — Mentor Human Support Tab.
 *
 * The Support tab (host sidebar label "Support"; SDK panel value
 * `human_support`) is rendered by the SDK's `AgentHumanSupportTab`
 * (`@iblai/iblai-js/web-containers/next`) inside
 * `components/modals/edit-mentor-modal/tabs/human-support-tab.tsx`. It is an
 * admin-only support-ticket inbox: a filter bar (user search + status
 * select), a ticket list, a detail pane (status select, description,
 * conversation, reply composer). Tickets are filed by the AGENT during chat
 * via a support tool — an admin asks the agent to open a ticket, the agent
 * runs the tool server-side, and the ticket then appears here.
 *
 * All DOM access flows through `HumanSupportTab`
 * (`e2e/page-objects/edit-mentor/human-support.tab.ts`), which delegates
 * every locator/action to the SDK's `human-support-tab-helpers` module
 * (`@iblai/iblai-js/playwright`) — no hand-rolled selectors. The chat step
 * uses `sendAgentChatMessage`/`waitForAgentChatResponse` directly (not the
 * SDK's `requestSupportTicketViaChat`): that helper's prompt phrasing
 * ("create a support ticket … Description: …") reads like a doc-authoring
 * request to the model, which made the agent ALSO invoke the canvas tool —
 * the canvas panel then streamed a document, the stop-streaming button never
 * unmounted, and `waitForAgentChatResponse` timed out. The inline prompt
 * below pins the flow to the plain chat: call the support tool, reply in
 * plain text, no canvas/document/artifact.
 *
 * CATEGORY: Support lives under the modal's **Runtime** sidebar category
 * (alongside Tasks / Memory / History / Audit), so `editMentorPage.open('Support')`
 * activates that category before the segment mounts.
 *
 * AVAILABILITY GUARD: the info-box toggle that mirrors the human-support
 * tool's on/off state is HIDDEN when the tenant's tool catalog has no
 * human-support tool. `HumanSupportTab.hasToggle()` guards this — the
 * chat-driven lifecycle test skips (rather than fails) when the toggle never
 * renders, since the agent has no tool to call in that case.
 *
 * ── Isolation ────────────────────────────────────────────────────────────
 *
 * This journey mutates mentor settings (the support availability toggle) and
 * creates support tickets — per house style (see journey 47), destructive
 * admin tests must not run against the shared most-recently-accessed mentor.
 * Every test gets its own freshly-created mentor in `beforeEach`, and the
 * whole file runs serially so no other test/worker can touch it mid-test.
 * Created mentors are tracked and deleted in `afterAll` via `MentorTracker`.
 */

test.describe.configure({ mode: 'serial' });

test.describe('Journey 64: Mentor Human Support Tab', () => {
  const tracker = new MentorTracker();

  test.beforeEach(async ({ page, editMentorPage, createMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Human Support tab requires admin access');
      return;
    }

    // Dedicated mentor per test — see the isolation note above.
    await createMentorPage.openAndCreate();
    const { mentorId } = await getPlatformContext(page);
    tracker.add(mentorId);
  });

  test.afterAll(async ({ browser }, testInfo) => {
    await tracker.deleteAll(browser, testInfo);
  });

  // ── support-01: cheap render contract ────────────────────────────────────
  // Non-chat checkpoint: the tab loads and renders its header plus either the
  // ticket list or the empty state — whichever the fresh mentor's (empty)
  // ticket set produces. Both are correct; this guards the render/API
  // contract without depending on chat/LLM latency.
  test('admin opens the Human Support tab and the ticket surface renders (list or empty state)', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('Support');
    await waitForPageReady(page);

    await expect(editMentorPage.humanSupport.heading()).toBeVisible({
      timeout: 15_000,
    });
    await expect(editMentorPage.humanSupport.headerDescription()).toBeVisible({
      timeout: 10_000,
    });

    // A freshly-created mentor has no tickets yet, so the empty state is the
    // expected branch here — tolerate either to keep this checkpoint honest
    // about the render contract rather than the specific data state.
    await expect(
      editMentorPage.humanSupport
        .ticketList()
        .or(editMentorPage.humanSupport.noTicketsMessage())
        .first(),
    ).toBeVisible({ timeout: 15_000 });

    await editMentorPage.close();
  });

  // ── support-02: status filter round-trip ─────────────────────────────────
  // Non-chat checkpoint: cycling the status filter through every value and
  // back to "All" re-queries the backend each time without erroring, and the
  // surface keeps rendering a valid state (list or empty) after every change.
  test('admin round-trips the Human Support status filter', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('Support');
    await waitForPageReady(page);

    await expect(editMentorPage.humanSupport.statusFilter()).toBeVisible({
      timeout: 15_000,
    });

    for (const status of ['open', 'inProgress', 'closed', 'all'] as const) {
      await editMentorPage.humanSupport.filterByStatus(status);
      await expect(
        editMentorPage.humanSupport
          .ticketList()
          .or(editMentorPage.humanSupport.noTicketsMessage())
          .first(),
      ).toBeVisible({ timeout: 15_000 });
    }

    await editMentorPage.close();
  });

  // ── support-03..support-08: full chat-driven ticket lifecycle ────────────
  test('admin runs the full support ticket lifecycle through agent chat: create, reply, In Progress, Closed', async ({
    page,
    editMentorPage,
    chatPage,
  }) => {
    // Chat + LLM tool execution is slow (up to 90s per turn) and this test
    // chains two chat-adjacent waits (creation reply, ticket-list poll) plus
    // two Edit Agent modal hydrations (~30-90s each) — generous budget.
    test.setTimeout(600_000);
    test.slow();

    await editMentorPage.open('Support');
    await waitForPageReady(page);

    // support-03: ensure the support tool is available and enabled. The
    // toggle is hidden entirely when the tenant's tool catalog has no
    // human-support tool — skip the chat-driven lifecycle rather than fail,
    // since the agent has no tool to call in that case.
    const hasToggle = await editMentorPage.humanSupport.hasToggle();
    test.skip(
      !hasToggle,
      'human-support tool not available in this tenant catalog — Support toggle not rendered',
    );
    await editMentorPage.humanSupport.setEnabled(true);
    await editMentorPage.close();

    // Round-trip verification that the toggle PERSISTED before any chat:
    // reload (drops every client cache), re-open the tab, and assert the
    // switch reads back as enabled from the server.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForPageReady(page);
    await editMentorPage.open('Support');
    await waitForPageReady(page);
    expect(await editMentorPage.humanSupport.isEnabled()).toBe(true);
    await editMentorPage.close();

    // CRITICAL: the chat session snapshots the mentor's tool list when the
    // session is CREATED, and the page creates/restores its session on
    // boot — BEFORE the toggle above was flipped. A reload alone does not
    // help: it restores the same session id (trace-confirmed: session
    // POSTed at 15:37:39, toggle PUT at 15:37:50, post-reload GETs still
    // on the same session; the model then had only `write_todos`, put
    // "create a support ticket" on its todo list, and REPLIED "created
    // successfully" without any ticket existing). Start a NEW chat so the
    // message rides a fresh session that includes the support tool.
    await chatPage.startNewChat();
    await waitForPageReady(page);

    // Identity guard: the message must go to the SAME dedicated agent whose
    // Support tab we verify below. Both the chat surface and the Edit Agent
    // modal bind to the page's URL mentor, so pin it here and re-check it
    // after the chat before asserting on the ticket list.
    const { mentorId: chatMentorId } = await getPlatformContext(page);

    // support-04: ask the agent (main chat) to open a ticket with a unique,
    // timestamped subject, then verify it lands in the Human Support list.
    // The prompt explicitly forbids canvas/document output: without that,
    // the model treats the subject+description phrasing as doc-authoring
    // and opens a streaming canvas artifact alongside the support tool
    // call, which keeps the stop-streaming button mounted forever and
    // times out `waitForAgentChatResponse` (observed in the first run of
    // this journey — the ticket itself was created fine).
    const subject = `E2E Support ${Date.now()}`;
    await sendAgentChatMessage(
      page,
      `Use your support ticket tool to create a support ticket now. ` +
        `Use exactly this subject: "${subject}". ` +
        `Description: E2E automated ticket lifecycle test — please assist. ` +
        `Reply with a short plain-text confirmation only — do NOT create ` +
        `a canvas, document, file, or any other artifact.`,
    );
    // Best-effort: if the model disobeys and opens a canvas anyway, the
    // stop-streaming button can stay mounted past the deadline even though
    // the support tool already ran. The authoritative assertion is the
    // ticket appearing in the list below, so a response-wait timeout is
    // logged but not fatal — genuine chat breakage still fails the test
    // because no ticket ever lands.
    await waitForAgentChatResponse(page).catch(() => {});

    // Re-check the identity guard: the page must still be on the mentor the
    // message was sent to — the Support tab below lists tickets for the
    // page's URL mentor, so any drift here would verify the wrong agent.
    const { mentorId: listMentorId } = await getPlatformContext(page);
    expect(listMentorId).toBe(chatMentorId);

    await editMentorPage.open('Support');
    await waitForPageReady(page);
    // The default refresh (status-filter bounce) only refetches the FIRST
    // bounce — after that both filter combos sit in the RTK Query cache and
    // later bounces produce zero network calls (confirmed via trace: two
    // tickets GETs total across a 2.6-minute poll). A full page reload is
    // the only host-side refresh that guarantees a fresh query, so each
    // poll closes the modal, reloads, and re-opens the Support tab.
    await editMentorPage.humanSupport.waitForTicketInList(subject, {
      timeoutMs: 120_000,
      refresh: async () => {
        await editMentorPage.close();
        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitForPageReady(page);
        await editMentorPage.open('Support');
        await waitForPageReady(page);
      },
    });
    await editMentorPage.humanSupport.expectTicketStatusInList(subject, 'open');

    // support-05: open the ticket and confirm real (agent-authored) content
    // rendered. Not asserting exact wording — the description is LLM
    // output, so only its presence is a stable signal (same
    // non-empty-content pattern used for LTI key material in journey 60).
    await editMentorPage.humanSupport.openTicket(subject);
    const descriptionText =
      (await editMentorPage.humanSupport.description().textContent()) ?? '';
    expect(descriptionText.trim().length).toBeGreaterThan(0);

    // support-06: admin replies from the detail pane; the message must
    // appear in the conversation.
    const replyMessage = `Admin reply ${Date.now()} — we're looking into this.`;
    await editMentorPage.humanSupport.reply(replyMessage);
    await editMentorPage.humanSupport.expectMessageInConversation(replyMessage);

    // support-07: move the ticket to "In Progress"; the list badge updates.
    await editMentorPage.humanSupport.setStatus('inProgress');
    await editMentorPage.humanSupport.expectTicketStatusInList(
      subject,
      'inProgress',
    );

    // support-08: close the ticket; the closed notice replaces the composer
    // and the list badge reflects the closed status.
    await editMentorPage.humanSupport.setStatus('closed');
    await editMentorPage.humanSupport.expectClosedNotice();
    await editMentorPage.humanSupport.expectTicketStatusInList(
      subject,
      'closed',
    );

    await editMentorPage.close();
  });
});
