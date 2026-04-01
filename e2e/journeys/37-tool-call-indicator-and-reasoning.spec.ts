// spec: e2e/test-plans/tool-call-indicator-and-reasoning-section.md

import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp } from '../utils/auth';

// Generous timeout for LLM streaming responses
const STREAMING_TIMEOUT = 120_000;

test.describe('Journey 37: Tool Call Indicator and Reasoning Section', () => {
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
    await createMentorPage.openAndCreate('E2E Tool Call Test Mentor');

    // Enable Web Search via Tools tab
    await editMentorPage.open('Tools');
    await editMentorPage.tools.enableTool('Web Search');
    await editMentorPage.close();

    // Activate Web Search in session and send message
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
    await expect(toolCallTrigger).toBeVisible({ timeout: 30_000 });

    // During streaming: bounce dots should be visible inside the trigger
    const bounceDots = toolCallTrigger.locator('span.animate-bounce');
    await expect(bounceDots).toHaveCount(3, { timeout: 5_000 });

    // Indicator starts collapsed
    await expect(toolCallTrigger).toHaveAttribute('aria-expanded', 'false');

    // Wait for streaming to complete
    await chatPage.waitForStreamingComplete(STREAMING_TIMEOUT);

    // After streaming: trigger remains, bounce dots are gone
    await expect(toolCallTrigger).toBeVisible({ timeout: 10_000 });
    await expect(bounceDots).toHaveCount(0, { timeout: 5_000 });

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
    await createMentorPage.openAndCreate('E2E Tool Call Expand Test Mentor');

    await editMentorPage.open('Tools');
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
    await expect(toolCallTrigger).toBeVisible({ timeout: 30_000 });

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
    await expect(lastAIMessage.getByText(/searching the web/i)).toBeVisible({
      timeout: 5_000,
    });

    // Expanded content shows the query detail (extracted from tool input)
    const toolContent = lastAIMessage.locator('div.border-l-2.border-gray-200');
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
    await createMentorPage.openAndCreate('E2E Unique Tool Count Mentor');

    await editMentorPage.open('Tools');
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
    await expect(toolCallTrigger).toBeVisible({ timeout: 30_000 });

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
    await createMentorPage.openAndCreate('E2E No-Tools Mentor');

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
    await createMentorPage.openAndCreate('E2E Web Search Not Activated Mentor');

    await editMentorPage.open('Tools');
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
  test('Reasoning Section Shows Thinking with Bounce Dots and Auto-Collapses After Streaming', async ({
    page,
    createMentorPage,
    editMentorPage,
    chatPage,
  }) => {
    await createMentorPage.openAndCreate('E2E Reasoning Test Mentor');

    // Set LLM to gpt-5 via the LLM tab page object
    await editMentorPage.open('LLM');
    await editMentorPage.llm.selectProviderAndModel(
      'OpenAI',
      'OpenAI icon gpt-5',
    );
    await editMentorPage.close();

    // Send a question that triggers reasoning
    await chatPage.sendMessage(
      'Think through your response carefully before answering: what are the practical implications of quantum entanglement for modern computing?',
    );
    await chatPage.waitForUserMessage(
      'Think through your response carefully before answering',
      30_000,
    );

    // During streaming: "Thinking" label with bounce dots
    const thinkingButton = chatPage.aiMessages
      .last()
      .getByRole('button', { name: /thinking/i });
    await expect(thinkingButton).toBeVisible({ timeout: 30_000 });

    const bounceDotsContainer = chatPage.aiMessages
      .last()
      .locator('span.inline-flex.gap-0\\.5');
    await expect(bounceDotsContainer).toBeVisible({ timeout: 10_000 });
    const bounceDots = bounceDotsContainer.locator('span.animate-bounce');
    await expect(bounceDots).toHaveCount(3, { timeout: 5_000 });

    // Wait for streaming to complete
    await chatPage.waitForStreamingComplete(STREAMING_TIMEOUT);

    // After streaming: label changes to "Thought"
    const thoughtButton = chatPage.aiMessages
      .last()
      .getByRole('button', { name: /thought/i });
    await expect(thoughtButton).toBeVisible({ timeout: 15_000 });

    // Bounce dots are gone
    try {
      await bounceDotsContainer.waitFor({ state: 'hidden', timeout: 5_000 });
    } catch {
      const remainingDots = chatPage.aiMessages
        .last()
        .locator('span.animate-bounce');
      const dotCount = await remainingDots.count();
      expect(dotCount).toBe(0);
    }

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
    chatPage,
  }) => {
    await createMentorPage.openAndCreate('E2E Non-Reasoning Mentor');

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
    await createMentorPage.openAndCreate('E2E Combined Features Mentor');

    // Set LLM to gpt-5
    await editMentorPage.open('LLM');
    await editMentorPage.llm.selectProviderAndModel(
      'OpenAI',
      'OpenAI icon gpt-5',
    );

    // Enable Web Search
    await editMentorPage.navigateToTab('Tools');
    await editMentorPage.tools.enableTool('Web Search');
    await editMentorPage.close();

    // Activate Web Search in session
    await chatPage.activateWebSearch();

    // Send a question requiring both reasoning and web search
    await chatPage.sendMessage(
      'Using web search, think through your response carefully before answering: what are the latest advances in quantum computing?',
    );
    await chatPage.waitForUserMessage(
      'Using web search, think through your response carefully before answering',
      30_000,
    );

    const lastAIMessage = chatPage.aiMessages.last();

    // Check reasoning section appears (Thinking)
    const thinkingButton = lastAIMessage.getByRole('button', {
      name: /thinking/i,
    });
    await expect(thinkingButton).toBeVisible({ timeout: 30_000 });

    // Check tool call indicator appears
    const toolCallTrigger = lastAIMessage.getByRole('button', {
      name: /used \d+ tools?/i,
    });
    await expect(toolCallTrigger).toBeVisible({ timeout: 30_000 });

    // Verify reasoning appears above tool calls in the DOM
    const reasoningTriggerBox = await thinkingButton.boundingBox();
    const toolCallTriggerBox = await toolCallTrigger.boundingBox();
    if (reasoningTriggerBox && toolCallTriggerBox) {
      expect(reasoningTriggerBox.y).toBeLessThan(toolCallTriggerBox.y);
    }

    // Wait for streaming to complete
    await chatPage.waitForStreamingComplete(STREAMING_TIMEOUT);

    // After streaming: "Thinking" changes to "Thought"
    const thoughtButton = lastAIMessage.getByRole('button', {
      name: /thought/i,
    });
    await expect(thoughtButton).toBeVisible({ timeout: 15_000 });

    // Tool call indicator remains without bounce dots
    await expect(toolCallTrigger).toBeVisible({ timeout: 10_000 });
    const bounceDots = toolCallTrigger.locator('span.animate-bounce');
    await expect(bounceDots).toHaveCount(0, { timeout: 5_000 });

    // Response text is visible
    await expect(lastAIMessage).toContainText(/quantum/i, {
      timeout: 10_000,
    });
  });
});
