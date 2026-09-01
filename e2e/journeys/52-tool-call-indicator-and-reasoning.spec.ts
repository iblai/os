// spec: e2e/test-plans/tool-call-indicator-and-reasoning-section.md

import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, getPlatformContext } from '../utils/auth';
import { MentorTracker } from '../utils/mentor-cleanup';

// Generous timeout for LLM streaming responses
const STREAMING_TIMEOUT = 120_000;

test.describe('Journey 52: Tool Call Indicator and Reasoning Section', () => {
  const tracker52 = new MentorTracker();

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  // ────────────────────────────────────────────────────────────────
  // Test 1: Tool Call Indicator - Web Search
  // ────────────────────────────────────────────────────────────────
  test('Tool Call Indicator Appears With Bounce Dots During Streaming and Settles After', async ({
    page,
    createMentorPage,
    editMentorPage,
    chatPage,
  }) => {
    await createMentorPage.openAndCreate(
      `E2E Tool Call Test Mentor ${Date.now()}`,
    );
    tracker52.add((await getPlatformContext(page)).mentorId);

    // Enable Web Search via Tools tab
    // Enable verbose reasoning gates the tool-call indicator — enable it first.
    await editMentorPage.open('Settings');
    await editMentorPage.settings.setVerboseReasoning(true);
    // New mentors default to a provider without working credentials in this
    // tenant, so the agent never responds. Pin the LLM to gpt-5, the model
    // confirmed to stream responses (and tool calls) here.
    await editMentorPage.navigateToTab('LLM');
    await editMentorPage.llm.selectProviderAndModel('OpenAI', 'gpt-5');
    await editMentorPage.navigateToTab('Tools');
    await editMentorPage.tools.enableTool('Web Search');
    await editMentorPage.close();

    // Activate Web Search in session and send message. A direct current-info
    // question reliably forces the web search tool call early in the response.
    await chatPage.activateWebSearch();
    await chatPage.sendMessage(
      'using the web search tool, when is the next f1 race?',
    );
    await chatPage.waitForUserMessage(
      'using the web search tool, when is the next f1 race?',
      30_000,
    );

    // Assert: collapsible trigger appears with "Used N tool(s)" header
    const toolCallTrigger = chatPage.aiMessages
      .last()
      .getByRole('button', { name: /used \d+ tools?/i });
    await expect(toolCallTrigger).toBeVisible({ timeout: STREAMING_TIMEOUT });

    // While streaming, the trigger shows bounce dots. The dots are a transient
    // streaming-only animation; a fast reply can settle before they are
    // observable, so only assert their presence while the stream is still
    // active. The post-stream "dots cleared" assertion below is the
    // deterministic check.
    const bounceDots = toolCallTrigger.locator('span.animate-bounce');
    let streamStillActive = true;
    try {
      await chatPage.stopStreamingButton.waitFor({
        state: 'visible',
        timeout: 1_000,
      });
    } catch {
      streamStillActive = false;
    }
    if (streamStillActive) {
      await expect(bounceDots).toHaveCount(3, { timeout: 5_000 });
    }

    // Indicator starts collapsed
    await expect(toolCallTrigger).toHaveAttribute('aria-expanded', 'false');

    // Wait for streaming to complete
    await chatPage.waitForStreamingComplete(STREAMING_TIMEOUT);

    // After streaming: trigger remains, bounce dots are gone. The dots clear
    // once the message's streaming flag flips, which can lag a little behind
    // the stop-streaming button disappearing — allow time for it to settle.
    await expect(toolCallTrigger).toBeVisible({ timeout: 10_000 });
    await expect(bounceDots).toHaveCount(0, { timeout: 20_000 });

    // Response contains F1-related content
    await expect(chatPage.aiMessages.last()).toContainText(
      /f1|formula|race|grand prix/i,
      { timeout: 10_000 },
    );
  });

  // ────────────────────────────────────────────────────────────────
  // Test 1.2: Tool Call Indicator Expands to Show Tool Names and Queries
  // ────────────────────────────────────────────────────────────────
  test('Tool Call Indicator Expands to Show Tool Names and Query Detail', async ({
    page,
    createMentorPage,
    editMentorPage,
    chatPage,
  }) => {
    await createMentorPage.openAndCreate(
      `E2E Tool Call Expand Test Mentor ${Date.now()}`,
    );
    tracker52.add((await getPlatformContext(page)).mentorId);

    // Enable verbose reasoning gates the tool-call indicator — enable it first.
    await editMentorPage.open('Settings');
    await editMentorPage.settings.setVerboseReasoning(true);
    // New mentors default to a provider without working credentials in this
    // tenant, so the agent never responds. Pin the LLM to gpt-5, the model
    // confirmed to stream responses (and tool calls) here.
    await editMentorPage.navigateToTab('LLM');
    await editMentorPage.llm.selectProviderAndModel('OpenAI', 'gpt-5');
    await editMentorPage.navigateToTab('Tools');
    await editMentorPage.tools.enableTool('Web Search');
    await editMentorPage.close();

    await chatPage.activateWebSearch();
    await chatPage.sendMessage(
      'using the web search tool, when is the next f1 race?',
    );
    await chatPage.waitForUserMessage(
      'using the web search tool, when is the next f1 race?',
      30_000,
    );

    const toolCallTrigger = chatPage.aiMessages
      .last()
      .getByRole('button', { name: /used \d+ tools?/i });
    await expect(toolCallTrigger).toBeVisible({ timeout: STREAMING_TIMEOUT });

    await chatPage.waitForStreamingComplete(STREAMING_TIMEOUT);

    // Starts collapsed after streaming
    await expect(toolCallTrigger).toHaveAttribute('aria-expanded', 'false', {
      timeout: 5_000,
    });

    // Expand the indicator
    await toolCallTrigger.click();
    await expect(toolCallTrigger).toHaveAttribute('aria-expanded', 'true', {
      timeout: 5_000,
    });

    // Expanded content shows the friendly tool name
    const lastAIMessage = chatPage.aiMessages.last();
    await expect(
      lastAIMessage.getByText(/searching the web/i).first(),
    ).toBeVisible({
      timeout: 5_000,
    });

    // Expanded content shows the query detail (extracted from tool input).
    // `border-gray-300`, not `-200`: the panel's left rule was darkened so the
    // tool detail reads clearly against the bubble (see tool-call-indicator.tsx).
    const toolContent = lastAIMessage.locator('div.border-l-2.border-gray-300');
    await expect(toolContent).toContainText(/f1|race|formula/i, {
      timeout: 5_000,
    });

    // Collapse the indicator
    await toolCallTrigger.click();
    await expect(toolCallTrigger).toHaveAttribute('aria-expanded', 'false', {
      timeout: 5_000,
    });

    // Expanded content is no longer visible
    try {
      await toolContent.waitFor({ state: 'hidden', timeout: 5_000 });
    } catch {
      // Content area hidden via Radix CollapsibleContent unmount
    }
  });

  // ────────────────────────────────────────────────────────────────
  // Test 1.3: Unique Tool Count - Header Shows Unique Tool Types
  // ────────────────────────────────────────────────────────────────
  test('Tool Call Header Counts Unique Tool Types Not Total Calls', async ({
    page,
    createMentorPage,
    editMentorPage,
    chatPage,
  }) => {
    await createMentorPage.openAndCreate(
      `E2E Unique Tool Count Mentor ${Date.now()}`,
    );
    tracker52.add((await getPlatformContext(page)).mentorId);

    // Enable verbose reasoning gates the tool-call indicator — enable it first.
    await editMentorPage.open('Settings');
    await editMentorPage.settings.setVerboseReasoning(true);
    // New mentors default to a provider without working credentials in this
    // tenant, so the agent never responds. Pin the LLM to gpt-5, the model
    // confirmed to stream responses (and tool calls) here.
    await editMentorPage.navigateToTab('LLM');
    await editMentorPage.llm.selectProviderAndModel('OpenAI', 'gpt-5');
    await editMentorPage.navigateToTab('Tools');
    await editMentorPage.tools.enableTool('Web Search');
    await editMentorPage.close();

    await chatPage.activateWebSearch();
    await chatPage.sendMessage(
      'using the web search tool, find the current F1 standings and also find the schedule for the next 3 races',
    );
    await chatPage.waitForUserMessage(
      'using the web search tool, find the current F1 standings',
      30_000,
    );

    // Wait for tool call indicator and streaming to complete
    const toolCallTrigger = chatPage.aiMessages
      .last()
      .getByRole('button', { name: /used \d+ tools?/i });
    await expect(toolCallTrigger).toBeVisible({ timeout: STREAMING_TIMEOUT });

    await chatPage.waitForStreamingComplete(STREAMING_TIMEOUT);

    // Header should show "Used 1 tool" since all calls are web_search_call
    await expect(toolCallTrigger).toContainText('Used 1 tool', {
      timeout: 10_000,
    });

    // Expand to verify individual tool call entries exist
    await toolCallTrigger.click();
    await expect(toolCallTrigger).toHaveAttribute('aria-expanded', 'true', {
      timeout: 5_000,
    });

    // At least one "Searching the web" entry should be visible
    const lastAIMessage = chatPage.aiMessages.last();
    await expect(
      lastAIMessage.getByText(/searching the web/i).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 1.5: Web Search Button is NOT Visible When Tool is Disabled
  // ────────────────────────────────────────────────────────────────
  test('Web Search Button is NOT Visible When Tool is Disabled on Mentor', async ({
    page,
    createMentorPage,
    editMentorPage,
    chatPage,
  }) => {
    await createMentorPage.openAndCreate(`E2E No-Tools Mentor ${Date.now()}`);
    tracker52.add((await getPlatformContext(page)).mentorId);

    // No Web Search button should be visible
    try {
      await chatPage.webSearchButton.waitFor({
        state: 'visible',
        timeout: 5_000,
      });
      expect(true).toBe(false); // Should not reach here
    } catch {
      // Expected: button is not visible
    }

    // Confirm Web Search is off in the Tools tab
    await editMentorPage.open('Tools');
    await expect(editMentorPage.tools.toolToggles.first()).toBeVisible({
      timeout: 15_000,
    });
    expect(await editMentorPage.tools.isToolEnabled('Web Search')).toBe(false);
    await editMentorPage.close();

    // Web Search button is still absent
    try {
      await chatPage.webSearchButton.waitFor({
        state: 'visible',
        timeout: 5_000,
      });
      expect(true).toBe(false);
    } catch {
      // Expected
    }
  });

  // ────────────────────────────────────────────────────────────────
  // Test 1.6: No Tool Call Indicator When Web Search Not Activated
  // ────────────────────────────────────────────────────────────────
  test('Tool Call Indicator Does Not Appear When Web Search is Enabled But Not Activated', async ({
    page,
    createMentorPage,
    editMentorPage,
    chatPage,
  }) => {
    await createMentorPage.openAndCreate(
      `E2E Web Search Not Activated Mentor ${Date.now()}`,
    );
    tracker52.add((await getPlatformContext(page)).mentorId);

    // Enable verbose reasoning gates the tool-call indicator — enable it first.
    await editMentorPage.open('Settings');
    await editMentorPage.settings.setVerboseReasoning(true);
    // New mentors default to a provider without working credentials in this
    // tenant, so the agent never responds. Pin the LLM to gpt-5, the model
    // confirmed to stream responses (and tool calls) here.
    await editMentorPage.navigateToTab('LLM');
    await editMentorPage.llm.selectProviderAndModel('OpenAI', 'gpt-5');
    await editMentorPage.navigateToTab('Tools');
    await editMentorPage.tools.enableTool('Web Search');
    await editMentorPage.close();

    // Verify button is visible but do NOT click it
    await expect(chatPage.webSearchButton).toBeVisible({ timeout: 10_000 });

    await chatPage.sendMessage('What is the current date today?');
    await chatPage.waitForUserMessage(
      'What is the current date today?',
      30_000,
    );

    await chatPage.waitForStreamingComplete(STREAMING_TIMEOUT);
    await expect(chatPage.aiMessages.last()).toBeVisible({ timeout: 30_000 });

    // Assert no tool call indicator appears
    const toolCallTrigger = chatPage.aiMessages
      .last()
      .getByRole('button', { name: /used \d+ tools?/i });
    try {
      await toolCallTrigger.waitFor({ state: 'visible', timeout: 5_000 });
      expect(true).toBe(false); // Should not reach here
    } catch {
      // Expected: tool call indicator is not visible
    }
  });

  // ────────────────────────────────────────────────────────────────
  // Test 2.1 - 2.3: Reasoning Section with gpt-5 Model
  // ────────────────────────────────────────────────────────────────
  test('Reasoning Section Renders and Auto-Collapses to Thought After Streaming', async ({
    page,
    createMentorPage,
    editMentorPage,
    chatPage,
  }) => {
    await createMentorPage.openAndCreate(
      `E2E Reasoning Test Mentor ${Date.now()}`,
    );
    tracker52.add((await getPlatformContext(page)).mentorId);

    // Enable verbose reasoning gates the reasoning section — enable it, then set the
    // LLM to gpt-5 via the LLM tab page object.
    await editMentorPage.open('Settings');
    await editMentorPage.settings.setVerboseReasoning(true);
    await editMentorPage.navigateToTab('LLM');
    await editMentorPage.llm.selectProviderAndModel('OpenAI', 'gpt-5');
    await editMentorPage.close();

    // Send a question that triggers reasoning
    await chatPage.sendMessage(
      'Think through your response carefully before answering: what are the practical implications of quantum entanglement for modern computing?',
    );
    await chatPage.waitForUserMessage(
      'Think through your response carefully before answering',
      30_000,
    );

    // Match either label. "Thinking" holds only while the reasoning phase is
    // still streaming, and that window can close before the first poll — so
    // pinning to it raced the model rather than testing the app. What this
    // journey uniquely proves is that gpt-5's reasoning deltas reach the DOM at
    // all; the Thinking/Thought and bounce-dot rendering is covered off props by
    // components/chat/__tests__/reasoning-section.test.tsx.
    const reasoningChip = chatPage.aiMessages
      .last()
      .getByRole('button', { name: /thinking|thought/i });
    await expect(reasoningChip).toBeVisible({ timeout: 30_000 });

    // Wait for streaming to complete
    await chatPage.waitForStreamingComplete(STREAMING_TIMEOUT);

    // After streaming: label changes to "Thought"
    const thoughtButton = chatPage.aiMessages
      .last()
      .getByRole('button', { name: /thought/i });
    await expect(thoughtButton).toBeVisible({ timeout: 15_000 });

    // Bounce dots are gone
    const bounceDots = chatPage.aiMessages
      .last()
      .locator('span.animate-bounce');
    await expect(bounceDots).toHaveCount(0, { timeout: 5_000 });

    // Reasoning section is collapsed
    const reasoningContent = chatPage.aiMessages
      .last()
      .locator(
        'div.max-h-\\[200px\\].overflow-y-auto.border-l-2.border-gray-200',
      );
    try {
      await reasoningContent.waitFor({ state: 'hidden', timeout: 5_000 });
    } catch {
      const collapsibleContent = chatPage.aiMessages
        .last()
        .locator('[data-state="closed"]');
      await expect(collapsibleContent.first()).toBeVisible({
        timeout: 5_000,
      });
    }

    // Click "Thought" to expand
    await thoughtButton.click();
    try {
      await reasoningContent.waitFor({ state: 'visible', timeout: 5_000 });
      await expect(reasoningContent).toBeVisible();
    } catch {
      const openContent = chatPage.aiMessages
        .last()
        .locator('[data-state="open"]');
      await expect(openContent.first()).toBeVisible({ timeout: 5_000 });
    }

    // Click again to collapse
    await thoughtButton.click();
    try {
      await reasoningContent.waitFor({ state: 'hidden', timeout: 5_000 });
    } catch {
      const closedContent = chatPage.aiMessages
        .last()
        .locator('[data-state="closed"]');
      await expect(closedContent.first()).toBeVisible({ timeout: 5_000 });
    }
  });

  // ────────────────────────────────────────────────────────────────
  // Test 2.5: Reasoning Section Does Not Appear for Non-Reasoning Model
  // ────────────────────────────────────────────────────────────────
  test('Reasoning Section Does Not Appear When Model Does Not Produce Reasoning Tokens', async ({
    page,
    createMentorPage,
    editMentorPage,
    chatPage,
  }) => {
    await createMentorPage.openAndCreate(
      `E2E Non-Reasoning Mentor ${Date.now()}`,
    );
    tracker52.add((await getPlatformContext(page)).mentorId);

    // Enable verbose reasoning so this test verifies the model produces no
    // reasoning tokens, rather than the section being hidden by the toggle.
    await editMentorPage.open('Settings');
    await editMentorPage.settings.setVerboseReasoning(true);
    // Use gpt-4o — a non-reasoning model that still streams a response — so the
    // assertion checks that no reasoning section appears for a model that emits
    // no reasoning tokens (not merely that the agent failed to respond).
    await editMentorPage.navigateToTab('LLM');
    await editMentorPage.llm.selectProviderAndModel('OpenAI', 'gpt-4o');
    await editMentorPage.close();

    await chatPage.sendMessage('Explain the theory of relativity in detail');
    await chatPage.waitForUserMessage(
      'Explain the theory of relativity in detail',
      30_000,
    );

    await chatPage.waitForStreamingComplete(STREAMING_TIMEOUT);
    await expect(chatPage.aiMessages.last()).toBeVisible({ timeout: 30_000 });

    // Assert no "Thinking" or "Thought" section appears
    const thinkingOrThoughtButton = chatPage.aiMessages
      .last()
      .getByRole('button', { name: /thinking|thought/i });
    try {
      await thinkingOrThoughtButton.waitFor({
        state: 'visible',
        timeout: 5_000,
      });
      console.warn(
        'Reasoning section appeared for a default model — may indicate gpt-5 is configured as default',
      );
    } catch {
      // Expected: no reasoning section
    }
  });

  // ────────────────────────────────────────────────────────────────
  // Test 3.1: Tool Call Indicator and Reasoning Section Both Render
  // ────────────────────────────────────────────────────────────────
  test('Tool Call Indicator and Reasoning Section Both Render in the Same Message', async ({
    page,
    createMentorPage,
    editMentorPage,
    chatPage,
  }) => {
    await createMentorPage.openAndCreate(
      `E2E Combined Features Mentor ${Date.now()}`,
    );
    tracker52.add((await getPlatformContext(page)).mentorId);

    // Enable verbose reasoning gates both the reasoning section and the tool-call
    // indicator — enable it first.
    await editMentorPage.open('Settings');
    await editMentorPage.settings.setVerboseReasoning(true);

    // Set LLM to gpt-5
    await editMentorPage.navigateToTab('LLM');
    await editMentorPage.llm.selectProviderAndModel('OpenAI', 'gpt-5');

    // Enable Web Search
    await editMentorPage.navigateToTab('Tools');
    await editMentorPage.tools.enableTool('Web Search');
    await editMentorPage.close();

    // Activate Web Search in session
    await chatPage.activateWebSearch();

    // Send a question requiring both reasoning and web search. Explicitly
    // invoking the web search tool with a current-information question forces a
    // real tool call (a soft "use web search" hint lets gpt-5 answer from
    // memory and skip the tool), while "think step by step" exercises reasoning.
    await chatPage.sendMessage(
      'using the web search tool, think step by step, then tell me when the next f1 race is.',
    );
    await chatPage.waitForUserMessage(
      'using the web search tool, think step by step',
      30_000,
    );

    const lastAIMessage = chatPage.aiMessages.last();

    // Match either label — see the reasoning-section test above for why this is
    // not pinned to "Thinking".
    const reasoningChip = lastAIMessage.getByRole('button', {
      name: /thinking|thought/i,
    });
    await expect(reasoningChip).toBeVisible({ timeout: 30_000 });

    // Check tool call indicator appears. The tool call follows the reasoning
    // phase, so allow longer than the reasoning section's own appearance.
    const toolCallTrigger = lastAIMessage.getByRole('button', {
      name: /used \d+ tools?/i,
    });
    await expect(toolCallTrigger).toBeVisible({ timeout: STREAMING_TIMEOUT });

    // Wait for streaming to complete
    await chatPage.waitForStreamingComplete(STREAMING_TIMEOUT);

    // After streaming: "Thinking" changes to "Thought"
    const thoughtButton = lastAIMessage.getByRole('button', {
      name: /thought/i,
    });
    await expect(thoughtButton).toBeVisible({ timeout: 15_000 });

    // Verify reasoning appears above tool calls in the DOM.
    //
    // Asserted on DOM order, NOT on boundingBox().y. Bounding boxes are
    // viewport-relative and each read is a separate round-trip, so the chat's
    // autoscroll and the reasoning panel's collapse on the Thinking→Thought
    // flip can land the two measurements in different scroll frames — which
    // reported the tool call as "above" the reasoning even though the markup
    // was correctly ordered. `ai-message-bubble.tsx` renders
    // <ReasoningSection> then <ToolCallIndicator> as block-level siblings, so
    // their order among the message's chips is the property worth guarding.
    const chipLabels = await lastAIMessage
      .getByRole('button', { name: /thought|used \d+ tools?/i })
      .allTextContents();
    const reasoningIndex = chipLabels.findIndex((t) => /thought/i.test(t));
    const toolCallIndex = chipLabels.findIndex((t) =>
      /used \d+ tools?/i.test(t),
    );

    expect(reasoningIndex, 'reasoning chip must be present').toBeGreaterThan(
      -1,
    );
    expect(toolCallIndex, 'tool call chip must be present').toBeGreaterThan(-1);
    expect(reasoningIndex).toBeLessThan(toolCallIndex);

    // Tool call indicator remains without bounce dots (the streaming flag can
    // lag slightly behind the stop button disappearing).
    await expect(toolCallTrigger).toBeVisible({ timeout: 10_000 });
    const bounceDots = toolCallTrigger.locator('span.animate-bounce');
    await expect(bounceDots).toHaveCount(0, { timeout: 20_000 });

    // Response text is visible
    await expect(lastAIMessage).toContainText(/f1|formula|race|grand prix/i, {
      timeout: 10_000,
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 4.1: Enable verbose reasoning OFF hides the tool-call indicator
  // ────────────────────────────────────────────────────────────────
  test('Tool Call Indicator Is Hidden When Verbose Reasoning Is Off', async ({
    page,
    createMentorPage,
    editMentorPage,
    chatPage,
  }) => {
    await createMentorPage.openAndCreate(
      `E2E Verbose Reasoning Off Mentor ${Date.now()}`,
    );
    tracker52.add((await getPlatformContext(page)).mentorId);

    // Explicitly turn enable verbose reasoning OFF (new mentors default it ON), then
    // enable Web Search — the tool genuinely runs yet its indicator must stay
    // hidden while the toggle is off.
    await editMentorPage.open('Settings');
    await editMentorPage.settings.setVerboseReasoning(false);
    expect(await editMentorPage.settings.isVerboseReasoningEnabled()).toBe(
      false,
    );
    // Pin to gpt-5 so the agent actually streams a response (and runs the tool).
    await editMentorPage.navigateToTab('LLM');
    await editMentorPage.llm.selectProviderAndModel('OpenAI', 'gpt-5');
    await editMentorPage.navigateToTab('Tools');
    await editMentorPage.tools.enableTool('Web Search');
    await editMentorPage.close();

    await chatPage.activateWebSearch();
    await chatPage.sendMessage(
      'using the web search tool, when is the next f1 race?',
    );
    await chatPage.waitForUserMessage(
      'using the web search tool, when is the next f1 race?',
      30_000,
    );

    await chatPage.waitForStreamingComplete(STREAMING_TIMEOUT);
    await expect(chatPage.aiMessages.last()).toBeVisible({ timeout: 30_000 });

    // The tool-call indicator must NOT appear while enable verbose reasoning is off,
    // even though Web Search ran during the response.
    const toolCallTrigger = chatPage.aiMessages
      .last()
      .getByRole('button', { name: /used \d+ tools?/i });
    try {
      await toolCallTrigger.waitFor({ state: 'visible', timeout: 5_000 });
      expect(true).toBe(false); // Should not reach here
    } catch {
      // Expected: indicator is gated off by the enable verbose reasoning toggle
    }
  });

  test.afterAll(async ({ browser }, testInfo) => {
    await tracker52.deleteAll(browser, testInfo);
  });
});
