import { Page, Locator, expect } from '@playwright/test';

export class ChatPage {
  readonly page: Page;

  readonly chatInput: Locator;
  readonly sendButton: Locator;
  readonly newChatButton: Locator;
  readonly userMessages: Locator;
  readonly aiMessages: Locator;
  readonly canvasToggle: Locator;
  readonly memoryButton: Locator;
  readonly createMentorDialog: Locator;
  readonly loginBanner: Locator;
  readonly uploadButton: Locator;
  readonly voiceCallButton: Locator;
  readonly voiceInputButton: Locator;
  readonly dragOverlay: Locator;
  readonly webSearchButton: Locator;
  readonly stopStreamingButton: Locator;
  readonly promptsButton: Locator;
  readonly promptGalleryDialog: Locator;
  readonly guidedSuggestedPrompts: Locator;
  readonly guidedSuggestedPromptButtons: Locator;

  constructor(page: Page) {
    this.page = page;
    this.chatInput = page.getByRole('textbox', {
      name: 'Ask anything',
      exact: true,
    });
    this.sendButton = page.getByRole('button', { name: 'Send message' });
    this.newChatButton = page.getByRole('button', { name: 'New Chat' });
    this.userMessages = page.locator('.chat-user-message-query');
    this.aiMessages = page.locator('.chat-ai-message-response');
    this.canvasToggle = page.getByRole('button', { name: /canvas/i });
    // Exact name — NOT /memory/i. The chat-privacy toggle's aria-label is
    // "Turn on Private Mode. This chat won't be saved to history or used for
    // memory.", so a loose /memory/i match also resolves the (always-present,
    // desktop-visible) privacy toggle. That made `not.toBeVisible()` fail when
    // memory was off (toggle still visible) and let `toBeVisible()` pass off the
    // toggle even when the real button was gone. The MemoryButton renders text
    // "Memory" with only decorative icons, so its accessible name is exactly
    // "Memory" — which the privacy toggle never matches.
    this.memoryButton = page.getByRole('button', {
      name: 'Memory',
      exact: true,
    });
    this.createMentorDialog = page.getByRole('dialog', {
      name: /create.*mentor/i,
    });
    this.loginBanner = page.getByRole('button', { name: /log in/i });
    this.uploadButton = page.getByRole('button', { name: 'Attach file' });
    this.voiceCallButton = page.getByRole('button', { name: 'Voice call' });
    this.voiceInputButton = page.getByRole('button', { name: 'Voice input' });
    this.dragOverlay = page.locator(
      '[data-testid="drag-overlay"], [class*="drag-overlay"]',
    );
    this.webSearchButton = page.locator('button[data-slot="button"]', {
      hasText: 'Web Search',
    });
    this.stopStreamingButton = page.locator('.chat-stop-streaming-button');
    this.promptsButton = page.getByRole('button', {
      name: 'Prompts',
      exact: true,
    });
    this.promptGalleryDialog = page.getByRole('dialog', {
      name: 'Prompt Gallery',
    });
    // The guided-prompts row renders only when the AI returns prompts. The
    // container carries a single stable hook (`data-testid`); the individual
    // prompt buttons share the `chat-guided-suggested-prompts` class, so the
    // container — not the button class — is the unique selector.
    this.guidedSuggestedPrompts = page.getByTestId('guided-suggested-prompts');
    this.guidedSuggestedPromptButtons = this.guidedSuggestedPrompts.locator(
      '.chat-guided-suggested-prompts',
    );
  }

  async sendMessage(text: string): Promise<void> {
    await expect(this.chatInput).toBeVisible({ timeout: 15_000 });
    await this.chatInput.fill(text);
    await expect(this.sendButton).toBeEnabled({ timeout: 10_000 });
    await this.page.waitForTimeout(5_000);
    await this.sendButton.click();
  }

  async waitForAIResponse(timeout = 60_000): Promise<void> {
    await expect(this.aiMessages.first()).toBeVisible({ timeout });
  }

  async waitForUserMessage(text: string, timeout = 30_000): Promise<void> {
    await expect(
      this.page.locator('.chat-user-message-query', { hasText: text }),
    ).toBeVisible({ timeout });
  }

  async startNewChat(): Promise<void> {
    await expect(this.newChatButton).toBeVisible({ timeout: 5_000 });
    await this.newChatButton.click();
  }

  /**
   * Activate the Web Search session toggle in the chat input bar.
   */
  async activateWebSearch(): Promise<void> {
    await expect(this.webSearchButton).toBeVisible({ timeout: 10_000 });
    await this.webSearchButton.click();
  }

  /**
   * Wait for streaming to complete by watching the stop-streaming button
   * appear then disappear. Silently succeeds if streaming is already done.
   */
  async waitForStreamingComplete(timeout = 120_000): Promise<void> {
    try {
      await this.stopStreamingButton.waitFor({
        state: 'visible',
        timeout: 5_000,
      });
      await this.stopStreamingButton.waitFor({
        state: 'hidden',
        timeout,
      });
    } catch {
      // Stop button may have already disappeared or streaming was very fast
    }
  }

  async openPromptGallery(): Promise<void> {
    await expect(this.promptsButton).toBeVisible({ timeout: 10_000 });
    await this.promptsButton.click();
    await expect(this.promptGalleryDialog).toBeVisible({ timeout: 10_000 });
  }

  /** Returns all Delete buttons inside the Prompt Gallery dialog. */
  getPromptGalleryDeleteButtons(): Locator {
    return this.promptGalleryDialog.getByRole('button', {
      name: 'Delete',
      exact: true,
    });
  }

  /** Returns all Run buttons inside the Prompt Gallery dialog. */
  getPromptGalleryRunButtons(): Locator {
    return this.promptGalleryDialog.getByRole('button', {
      name: 'Run',
      exact: true,
    });
  }

  /** Returns all Edit buttons inside the Prompt Gallery dialog. */
  getPromptGalleryEditButtons(): Locator {
    return this.promptGalleryDialog.getByRole('button', {
      name: 'Edit',
      exact: true,
    });
  }

  /** Returns the Add prompt button inside the Prompt Gallery dialog. */
  getPromptGalleryAddButton(): Locator {
    return this.promptGalleryDialog.getByRole('button', {
      name: 'Add',
      exact: true,
    });
  }

  // ── URL ?prompt= injection helpers ─────────────────────────────────────────

  /**
   * Navigate to a mentor chat page with a URL-encoded `?prompt=` query param.
   * Uses the project's MENTOR_NEXTJS_HOST base — pass the tenant key and
   * mentor ID obtained from `getPlatformContext(page)`.
   */
  async gotoWithPrompt(
    host: string,
    tenantKey: string,
    mentorId: string,
    prompt: string,
  ): Promise<void> {
    const url = `${host}/platform/${tenantKey}/${mentorId}?prompt=${encodeURIComponent(prompt)}`;
    await this.page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
  }

  /**
   * Count the number of visible user-message bubbles that contain `content`.
   */
  async getUserBubbleCount(content: string): Promise<number> {
    return this.page
      .locator('.chat-user-message-query', { hasText: content })
      .count();
  }

  /**
   * Read the cached session id for a specific `mentorId` from localStorage.
   * The app stores sessions as `Record<string, string>` under the key
   * `session_id` (see `lib/constants.ts → LOCAL_STORAGE_KEYS.SESSION_ID`).
   */
  async getCachedSessionId(mentorId: string): Promise<string | null> {
    return this.page.evaluate((mid: string) => {
      try {
        const raw = window.localStorage.getItem('session_id');
        if (!raw) return null;
        return (JSON.parse(raw) as Record<string, string>)[mid] ?? null;
      } catch {
        return null;
      }
    }, mentorId);
  }

  // ── Deterministic message rendering via the shared-chat REST seam ──────────
  //
  // Journey 61 (LaTeX/math rendering) needs a FIXED assistant markdown
  // response to assert on, without depending on a real (non-deterministic)
  // LLM reply. Live chat is delivered over a raw WebSocket
  // (`useChat({ wsUrl, ... })` in `@iblai/web-utils`), which Playwright can
  // only intercept via `page.routeWebSocket()` — impractical here because it
  // would require re-implementing the app's whole streaming/artifact wire
  // protocol.
  //
  // Instead we use the public "shared chat" page
  // (`app/share/chat/[sessionId]/[tenantKey]/[mentorId]/page.tsx`), which
  // fetches message history over a plain REST GET
  // (`useGetChatMessagesForSessionQuery` ->
  // `GET /api/ai-mentor/orgs/{org}/users/{user_id}/sessions/{session_id}/shared/`)
  // and renders it through `ChatMessages` -> `AIMessageBubble` ->
  // `MessagePreview` -> `<Markdown>` — the EXACT same component tree (and
  // `.chat-ai-message-response` / `.chat-user-message-query` classes) as live
  // chat. Mocking that one GET with `page.route` gives byte-for-byte control
  // over the rendered markdown while exercising the real renderer.
  //
  // Raw message shape (see `hooks/use-shared-chat-messages.ts` ->
  // `transformChatMessage`): `type: 'human'` becomes role `user`, anything
  // else (e.g. `'ai'`) becomes role `assistant`. The `content` field is
  // passed straight through to `<Markdown>`.

  /**
   * Intercepts the shared-chat-history GET for a synthetic `sessionId` and
   * fulfills it with a single fixed assistant message containing `content`.
   * Returns the generated `sessionId` to use with `gotoSharedChat`.
   */
  async mockSharedChatSession(
    tenantKey: string,
    mentorId: string,
    content: string,
  ): Promise<string> {
    const sessionId = `e2e-latex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await this.page.route(
      `**/api/ai-mentor/orgs/*/users/*/sessions/${sessionId}/shared/**`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            count: 1,
            title: 'E2E LaTeX rendering test',
            is_shared: true,
            proactive_prompt: '',
            mentor_unique_id: mentorId,
            platform_key: tenantKey,
            previous: null,
            next: null,
            results: [
              {
                id: `e2e-msg-${Date.now()}`,
                type: 'ai',
                content,
                timestamp: new Date().toISOString(),
              },
            ],
          }),
        });
      },
    );
    return sessionId;
  }

  /**
   * Navigates to the shared-chat page for `sessionId`/`tenantKey`/`mentorId`.
   * Pair with `mockSharedChatSession` — the route must be registered first.
   */
  async gotoSharedChat(
    host: string,
    sessionId: string,
    tenantKey: string,
    mentorId: string,
  ): Promise<void> {
    await this.page.goto(
      `${host}/share/chat/${sessionId}/${tenantKey}/${mentorId}`,
      { waitUntil: 'domcontentloaded', timeout: 60_000 },
    );
  }

  /** Returns the most recently rendered AI message bubble. */
  getLastAiMessage(): Locator {
    return this.aiMessages.last();
  }

  /**
   * Returns the AI message bubble containing `text`, and waits for it to be
   * visible. Prefer this over `getLastAiMessage()` + a bare visibility check
   * when the bubble's content is known in advance (e.g. an injected mock
   * message) — asserting on distinctive rendered text is a stronger,
   * web-first signal that the real content has mounted than asserting
   * visibility of a `.chat-ai-message-response` container alone, which
   * could in principle match a transient/placeholder render first.
   */
  async waitForAiMessageWithText(
    text: string,
    timeout = 30_000,
  ): Promise<Locator> {
    const message = this.aiMessages.filter({ hasText: text });
    await expect(message).toBeVisible({ timeout });
    return message;
  }

  /** Returns all rendered KaTeX nodes (inline + block) within `scope`. */
  getRenderedMath(scope?: Locator): Locator {
    return (scope ?? this.page).locator('.katex');
  }

  /** Returns all rendered KaTeX *block* (display-mode) nodes within `scope`. */
  getRenderedBlockMath(scope?: Locator): Locator {
    return (scope ?? this.page).locator('.katex-display');
  }

  /**
   * Returns the raw TeX source annotations KaTeX embeds for each rendered
   * expression (`<annotation encoding="application/x-tex">`) — useful for
   * asserting *which* expression rendered, not just that something did.
   */
  getRenderedMathSource(scope?: Locator): Locator {
    return (scope ?? this.page).locator(
      '.katex annotation[encoding="application/x-tex"]',
    );
  }

  /** Deletes the nth prompt (0-indexed) from the Prompt Gallery. */
  async deletePromptFromGallery(index = 0): Promise<void> {
    const deleteButton = this.getPromptGalleryDeleteButtons().nth(index);
    await expect(deleteButton).toBeVisible({ timeout: 10_000 });
    await deleteButton.click();
  }

  /** Clicks the Run button on the nth prompt (0-indexed) in the Prompt Gallery. */
  async runPromptFromGallery(index = 0): Promise<void> {
    const runButton = this.getPromptGalleryRunButtons().nth(index);
    await expect(runButton).toBeVisible({ timeout: 10_000 });
    await runButton.click();
  }

  async closePromptGallery(): Promise<void> {
    const closeButton = this.promptGalleryDialog
      .getByRole('button', { name: 'Close' })
      .first();
    await closeButton.click();
    await expect(this.promptGalleryDialog).not.toBeVisible({
      timeout: 10_000,
    });
  }
}
