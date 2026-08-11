import { Page, Locator, expect } from '@playwright/test';

/**
 * Minimal shape accepted by `mockEffectiveSkills` — mirrors the SDK's
 * `EffectiveAgentSkill` (`@iblai/data-layer`'s `skills-utils`/`types`) closely
 * enough to drive the chat `/` skill picker (`SlashSkillPicker` /
 * `useSlashSkillPicker` from `@iblai/iblai-js/web-containers`). Only
 * `enabled: true` skills are ever offered by the picker.
 */
export interface EffectiveSkillFixture {
  unique_id: string;
  name: string;
  slug: string;
  description?: string;
  category?: string;
  enabled: boolean;
}

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
  readonly slashSkillPicker: Locator;
  readonly skillTokenHighlights: Locator;
  /**
   * The Skills dropdown trigger in the inside-buttons row — the discoverable
   * alternative to typing `/`. Shows the armed skill's name (active pill
   * styling) whenever a `/slug` token is present in the composer, "Skills"
   * otherwise. Hidden entirely when the mentor has no skills.
   */
  readonly skillsMenuTrigger: Locator;
  /**
   * The ✕ inside the active skills pill (disarms the token without opening
   * the menu). Resolved FROM `skillsMenuTrigger` — never the page — so the
   * testid can only ever match inside the trigger it belongs to.
   */
  readonly skillsMenuClear: Locator;
  /** The Skills dropdown's content panel (Radix portal), when open. */
  readonly skillsMenuContent: Locator;

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
    // `SlashSkillPicker` (SDK, web-containers) renders its listbox with this
    // fixed testid regardless of the generated `listboxId`.
    this.slashSkillPicker = page.getByTestId('slash-skill-picker');
    // In-place invocation highlights (`components/chat-input-form.tsx`).
    // Selecting a picker option completes the `/<slug> ` token AT the typed
    // index; a backdrop layer behind the textarea paints a pill background
    // under each enabled `/skill` token (one element per token). Backspace
    // at a token's end (or Delete at its start) removes the whole token in
    // one stroke.
    this.skillTokenHighlights = page.getByTestId('skill-token-highlight');
    this.skillsMenuTrigger = page.getByTestId('skills-menu-trigger');
    this.skillsMenuClear =
      this.skillsMenuTrigger.getByTestId('skills-menu-clear');
    this.skillsMenuContent = page.getByTestId('skills-menu-content');
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

  // ── `/` skill picker (chat composer) ────────────────────────────────────
  //
  // `ChatInputForm` resolves the mentor's skill list client-side from its
  // ONLY skill source — the mentor's skill assignments
  // (`GET .../agents/{uuid}/skills/`; the platform-wide `/agent-skills/`
  // catalog is deliberately never fetched from chat) — via the SDK's
  // `resolveEffectiveAgentSkills`, eagerly on mount, not lazily on the first
  // `/` keypress. The composer textarea's role flips from the implicit
  // `textbox` to `combobox` whenever the resolved list is non-empty (see
  // `components/chat-input-form.tsx`). Two consequences for e2e:
  //   1. `mockEffectiveSkills` MUST be called before `navigateToMentorApp` /
  //      any navigation to the chat page — registering the routes after the
  //      page has already loaded misses the requests that populate the list.
  //   2. Use `getComposerTextarea()` (an id-based, role-agnostic locator)
  //      rather than `chatInput` (`getByRole('textbox', ...)`) whenever a
  //      test might put the composer into its combobox state — `chatInput`
  //      only resolves while the accessible role is `textbox`.
  // NOTE: the resolved list is sorted by skill NAME, so the picker's option
  // order is alphabetical regardless of fixture order.

  /**
   * Role-agnostic locator for the chat composer's `<textarea>`. Safe to use
   * whether or not the `/` skill picker's combobox aria wiring is active.
   */
  getComposerTextarea(): Locator {
    return this.page.locator('#chat-input-textarea');
  }

  /**
   * Intercepts the composer's ONLY skill source — the mentor's skill
   * assignments (`GET .../agents/{uuid}/skills/`) — and fulfills it from a
   * fixed fixture list, so the `/` skill picker's contents are deterministic
   * instead of depending on whatever skills (if any) happen to be assigned
   * server-side. Each fixture becomes an assignment row (name/slug/enabled —
   * assignment rows carry no descriptions, and the platform-wide
   * `/agent-skills/` catalog is deliberately never fetched from chat). Must
   * be registered BEFORE navigating to the chat page — see the
   * class-of-methods note above.
   */
  async mockEffectiveSkills(skills: EffectiveSkillFixture[]): Promise<void> {
    // Assignments: /agents/{uuid}/skills/ — NOT /agent-skills/ (catalog).
    await this.page.route(
      (url) => /\/agents\/[^/]+\/skills\//.test(url.pathname),
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            skills.map((skill, index) => ({
              id: index + 1,
              mentor: 'e2e-mentor',
              skill: skill.unique_id,
              skill_name: skill.name,
              skill_slug: skill.slug,
              enabled: skill.enabled,
            })),
          ),
        });
      },
    );
  }

  /**
   * Same as `mockEffectiveSkills` — kept as a named alias for the non-admin
   * journey so the intent stays explicit. Students get the picker only if
   * the backend lets them read the assignments endpoint (today it is
   * platform-admin-only and 403s for them, which the composer degrades to
   * an inactive picker); this mock simulates that granted state.
   */
  async mockStudentSkills(skills: EffectiveSkillFixture[]): Promise<void> {
    await this.mockEffectiveSkills(skills);
  }

  /**
   * The `id` of the slash-picker option currently marked
   * `aria-selected="true"` (the keyboard/hover-active option). Compare
   * against the composer's `aria-activedescendant` attribute to verify the
   * combobox wiring, not just the visual highlight.
   */
  async activeSlashSkillOptionId(): Promise<string | null> {
    return this.slashSkillPicker
      .locator('[aria-selected="true"]')
      .first()
      .getAttribute('id');
  }

  /**
   * Returns the Skills-dropdown item for a skill slug (menu must be open).
   * Resolved from the menu's content panel — never the page — so nothing
   * outside the open dropdown can ever match.
   */
  getSkillsMenuItem(slug: string): Locator {
    return this.skillsMenuContent.getByTestId(`skills-menu-item-${slug}`);
  }

  /**
   * Opens the Skills dropdown and waits until its items are actually
   * showing. A plain `skillsMenuTrigger.click()` is flaky right after a
   * previous selection: Radix is still tearing down the old menu instance
   * (dismiss listeners / focus return), and a programmatic click landing in
   * that window toggles or gets swallowed, leaving the menu closed. Retry
   * clicking until an item is visible.
   */
  async openSkillsMenu(): Promise<void> {
    const anyItem = this.skillsMenuContent
      .locator('[data-testid^="skills-menu-item-"]')
      .first();
    await expect(async () => {
      if (!(await anyItem.isVisible())) {
        await this.skillsMenuTrigger.click();
      }
      await expect(anyItem).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
  }

  /** Returns the slash-picker option `<li>` whose text contains `name`. */
  getSlashSkillOption(name: string): Locator {
    return this.slashSkillPicker.getByRole('option', {
      name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    });
  }
}
