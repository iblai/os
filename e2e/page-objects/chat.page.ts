import { Page, Locator, Route, WebSocketRoute, expect } from '@playwright/test';

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
  /**
   * The composer's "Canvas" tool chip (inside-buttons row). Artifacts are
   * only produced for a session while this tool is active — without it the
   * agent's reply never becomes an artifact chip/canvas, so specs that
   * expect artifacts MUST call `enableCanvasTool()` before sending. The chip
   * has no aria-pressed; its active state is styling-only (active background
   * class `bg-[#F5F8FF]`).
   */
  readonly canvasToggle: Locator;
  /**
   * The chat chip rendered for ANY canvas artifact (text/code or binary) —
   * `CanvasMessagePreview`, `data-testid="canvas-message-preview"`. For
   * binary artifacts (pdf, xlsx, zip, …) it always shows "Open Canvas" with
   * a file-type label instead of a content snippet — there is no separate
   * "Download" chip variant.
   */
  readonly canvasMessagePreview: Locator;
  /** The chip's action button — always "Open Canvas", never "Download". */
  readonly canvasOpenButton: Locator;
  /**
   * Wraps `canvasOpenButton` (and disables it, with a "hang tight" tooltip)
   * while a binary artifact is still streaming — a half-written file can't
   * be opened. Absent once generation finishes; also absent entirely for
   * non-binary (text/code) canvas artifacts, which stay clickable while
   * streaming.
   */
  readonly canvasBinaryGenerating: Locator;
  /**
   * The read-only binary canvas (`BinaryCanvasComponent`,
   * `data-testid="binary-canvas"`) — renders for pdf/image/svg artifacts
   * (and a friendly fallback for non-previewable types like zip/xlsx). Opens
   * automatically at stream end for ANY binary artifact (not just
   * previewable ones) if no canvas is already open — see
   * `openBinaryCanvas()`.
   */
  readonly binaryCanvas: Locator;
  /** The pdf `<iframe>` inside the binary canvas — `src` is a `blob:` URL. */
  readonly binaryCanvasPdf: Locator;
  /** The image `<img>` inside the binary canvas (image/svg artifacts). */
  readonly binaryCanvasImage: Locator;
  /** The binary canvas's single header action — downloads the raw bytes. */
  readonly binaryCanvasExport: Locator;
  /**
   * Shown INSTEAD of the pdf/image preview when the file loaded but is
   * malformed (invalid SVG XML, non-PDF bytes, image decode failure). A
   * positive assertion on `binaryCanvasPdf`/`binaryCanvasImage` should never
   * be substituted with "this didn't appear" — assert this is absent too.
   */
  readonly binaryCanvasPreviewError: Locator;
  /**
   * The editable TEXT canvas's rich-text surface (TipTap contenteditable /
   * ProseMirror) — the path taken by text artifacts (`is_binary: false`),
   * including .txt files shared from the sandbox VM. Same locator strategy
   * as journey 10.
   */
  readonly canvasEditor: Locator;
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
    this.canvasMessagePreview = page.getByTestId('canvas-message-preview');
    this.canvasOpenButton = page.getByTestId('canvas-open-button');
    this.canvasBinaryGenerating = page.getByTestId('canvas-binary-generating');
    this.binaryCanvas = page.getByTestId('binary-canvas');
    this.binaryCanvasPdf = page.getByTestId('binary-canvas-pdf');
    this.binaryCanvasImage = page.getByTestId('binary-canvas-image');
    this.binaryCanvasExport = page.getByTestId('binary-canvas-export');
    this.binaryCanvasPreviewError = page.getByTestId(
      'binary-canvas-preview-error',
    );
    this.canvasEditor = page
      .locator('[contenteditable="true"]')
      .or(page.locator('.ProseMirror'))
      .first();
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
  /**
   * Intercepts the RBAC permissions-check POST and fulfills it with the
   * REAL response, mutated so every requested mentor-scoped resource
   * (`/mentors/{id}/`) carries `view_skill_assignments: true`. The
   * composer's skills fetch is gated on that grant — without it the
   * request never fires — so mocking the skills endpoint alone no longer
   * simulates the granted state. Keys the tests hermetic w.r.t. the
   * backend's grant rollout; must be registered before the mentor page
   * load that runs the permission check.
   */
  async grantSkillAssignmentsRead(): Promise<void> {
    await this.page.route(
      (url) => url.pathname.includes('/api/core/rbac/permissions/check'),
      async (route) => {
        const response = await route.fetch();
        let json: Record<string, unknown>;
        try {
          json = await response.json();
        } catch {
          await route.fulfill({ response });
          return;
        }
        // The POST body lists the resources being checked — grant the read
        // on each mentor-scoped one, adding the entry when the real
        // response omitted it (a user with no grants at all).
        const requested: string[] =
          route.request().postDataJSON()?.resources ?? [];
        for (const resource of requested) {
          if (/^\/mentors\/[^/]+\/$/.test(resource)) {
            const entry = json[resource];
            json[resource] = {
              ...(entry && typeof entry === 'object' ? entry : {}),
              view_skill_assignments: true,
            };
          }
        }
        await route.fulfill({ response, json });
      },
    );
  }

  async mockEffectiveSkills(skills: EffectiveSkillFixture[]): Promise<void> {
    // The fetch only fires for users granted `view_skill_assignments` —
    // grant it alongside the payload mock so the mock actually gets hit.
    await this.grantSkillAssignmentsRead();
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
   * journey so the intent stays explicit. Students get the picker only when
   * the mentor permission check grants them `view_skill_assignments` (the
   * composer never even fetches without it, since the endpoint 403s); this
   * mock simulates that granted state end to end — the grant via
   * `grantSkillAssignmentsRead`, the skill list via the endpoint mock.
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
   * The menu content, only while GENUINELY open. Radix keeps the content
   * element mounted (and visible) for a moment after a selection while its
   * close animation runs, with `data-state="closed"` — a locator that
   * ignores the state can match that dying instance, "find" its items, and
   * then interact with a menu that unmounts mid-step. Every item lookup
   * goes through this state-filtered locator instead.
   */
  private openSkillsMenuContent(): Locator {
    return this.page.locator(
      '[data-testid="skills-menu-content"][data-state="open"]',
    );
  }

  /**
   * Returns the Skills-dropdown item for a skill slug (menu must be open).
   * Resolved from the OPEN menu content — never the page, never a closing
   * menu instance — so nothing outside the live dropdown can ever match.
   */
  getSkillsMenuItem(slug: string): Locator {
    return this.openSkillsMenuContent().getByTestId(`skills-menu-item-${slug}`);
  }

  /**
   * Opens the Skills dropdown and waits until its items are actually
   * showing. A plain `skillsMenuTrigger.click()` is flaky right after a
   * previous selection, in both directions: Radix is still tearing down the
   * old menu instance (dismiss listeners / focus return), so a click landing
   * in that window toggles or gets swallowed — and the dying instance's
   * items remain visible with `data-state="closed"`, so a state-blind check
   * can wrongly conclude the menu is already open and skip clicking
   * entirely. Retry clicking until an item inside a data-state="open"
   * content is visible.
   */
  async openSkillsMenu(): Promise<void> {
    const anyOpenItem = this.openSkillsMenuContent()
      .locator('[data-testid^="skills-menu-item-"]')
      .first();
    await expect(async () => {
      if (!(await anyOpenItem.isVisible())) {
        await this.skillsMenuTrigger.click();
      }
      await expect(anyOpenItem).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
  }

  /** Returns the slash-picker option `<li>` whose text contains `name`. */
  getSlashSkillOption(name: string): Locator {
    return this.slashSkillPicker.getByRole('option', {
      name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    });
  }

  // ── Agent task list (write_todos) mocking helpers — Journey 68 ─────────────
  //
  // `AgentTodoList` (components/chat/agent-todo-list.tsx) renders only when
  // `showReasoning` (mentor-settings `show_reasoning`, default `false`) is on
  // AND the assistant turn's `toolCalls` contains a `write_todos` entry
  // (`extractLatestTodos` in `@iblai/iblai-js/web-utils`). Two independent
  // seams are needed to exercise it deterministically:
  //   - REST: patch the mentor-settings GET(s) to flip `show_reasoning`, and
  //     mock the session chat-history GET to inject a `write_todos` tool call
  //     onto a historical AI message (covers reload/history rendering).
  //   - WebSocket: mock the live chat socket to script `tool_call` /
  //     `tool_call.end` frames during an active turn (covers streaming
  //     behaviour: auto-collapse, wholesale replacement, shimmer, announcer).

  /**
   * Patches the mentor-settings GET(s) so `show_reasoning` reads `true`,
   * without stubbing the rest of the payload. Uses `route.fetch()` against
   * the REAL backend and only overwrites the one field, so every other
   * mentor-settings-derived value (name, avatar, LLM provider, ...) stays
   * real and the rest of the chat page renders normally.
   *
   * Both the admin settings endpoint AND the public-settings endpoint are
   * patched: `useMentorSettings` reads `effectiveSettings?.show_reasoning ??
   * effectivePublicSettings?.show_reasoning`, and only the first one is
   * strictly required for a logged-in admin, but patching both keeps this
   * helper correct if it's ever reused for a non-admin/public context.
   */
  async mockShowReasoning(enabled = true): Promise<void> {
    const patchShowReasoning = async (route: Route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      let json: Record<string, unknown>;
      try {
        json = await response.json();
      } catch {
        await route.continue();
        return;
      }
      json.show_reasoning = enabled;
      await route.fulfill({ response, json });
    };

    await this.page.route(
      '**/api/ai-mentor/orgs/*/users/*/mentors/*/settings/**',
      patchShowReasoning,
    );
    await this.page.route(
      '**/api/ai-mentor/orgs/*/users/*/mentors/*/public-settings/**',
      patchShowReasoning,
    );
  }

  /**
   * Seeds `localStorage.session_id` (the `Record<mentorId, sessionId>` map
   * read by `components/chat/index.tsx`) via `page.addInitScript`, so the
   * chat page picks up a caller-chosen `sessionId` for `mentorId` on its very
   * next navigation — before the app's own JS runs. Pairs with
   * `mockChatHistoryWithToolCalls`, which must intercept the history GET for
   * that same `sessionId` before the navigation that triggers the fetch.
   */
  async seedCachedSessionId(
    mentorId: string,
    sessionId: string,
  ): Promise<void> {
    await this.page.addInitScript(
      ({ mentorId, sessionId }) => {
        window.localStorage.setItem(
          'session_id',
          JSON.stringify({ [mentorId]: sessionId }),
        );
      },
      { mentorId, sessionId },
    );
  }

  /**
   * Intercepts the session chat-history GET
   * (`GET /api/ai-mentor/orgs/{org}/users/{user_id}/sessions/{sessionId}/`,
   * `useLazyGetSessionIdQuery` from `@iblai/data-layer`) for `sessionId` and
   * fulfills it with a synthetic two-message history: a human message
   * followed by an AI message carrying `aiToolCalls` verbatim as the raw
   * `tool_calls` array.
   *
   * The envelope is DRF-paginated (`{count, next, previous, results}`), and
   * `normalizeSessionResults` reverses `results` before use, so `results`
   * here is supplied newest-first: `[ai, human]`.
   *
   * A preceding human message is NOT optional: `components/chat/index.tsx`
   * special-cases a lone leading `assistant`-role message as a "welcome
   * message" and renders it via `WelcomeChatNew` instead of
   * `AIMessageBubble`/`ChatMessages` — which would never mount
   * `AgentTodoList`. Two messages `[human, ai]` sidesteps that path.
   *
   * `aiToolCalls` is passed through untouched onto the raw history entry's
   * `tool_calls` field, so callers can exercise both accepted shapes
   * (LangChain `{id, name, args}` and OpenAI `{id, type, function}`) and
   * malformed entries.
   */
  async mockChatHistoryWithToolCalls(
    sessionId: string,
    aiToolCalls: unknown[],
    options: { aiContent?: string; humanContent?: string } = {},
  ): Promise<void> {
    const aiContent = options.aiContent ?? 'Let me plan this out.';
    const humanContent = options.humanContent ?? 'Plan a course for me.';
    const now = Date.now();

    await this.page.route(
      `**/api/ai-mentor/orgs/*/users/*/sessions/${sessionId}/**`,
      async (route) => {
        if (route.request().method() !== 'GET') {
          await route.continue();
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            count: 2,
            next: null,
            previous: null,
            results: [
              {
                id: `e2e-msg-ai-${now}`,
                type: 'ai',
                content: aiContent,
                timestamp: new Date(now).toISOString(),
                tool_calls: aiToolCalls,
              },
              {
                id: `e2e-msg-human-${now}`,
                type: 'human',
                content: humanContent,
                timestamp: new Date(now - 1000).toISOString(),
              },
            ],
          }),
        });
      },
    );
  }

  /**
   * Navigates directly to a mentor's chat page (no `?prompt=`). Pair with
   * `seedCachedSessionId` + `mockChatHistoryWithToolCalls` /
   * `mockChatWebSocket`, which must be registered first.
   */
  async gotoChat(
    host: string,
    tenantKey: string,
    mentorId: string,
  ): Promise<void> {
    await this.page.goto(`${host}/platform/${tenantKey}/${mentorId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
  }

  /**
   * Mocks the live chat WebSocket (`wss://.../ws/langflow/`, opened by
   * `useChat` in `@iblai/iblai-js/web-utils`) via `page.routeWebSocket`. Must
   * be registered before navigation, since the socket opens on mount.
   *
   * Since `connectToServer()` is never called, Playwright fully mocks the
   * connection — nothing reaches the real ASGI backend. Returns a small
   * controller so the calling test can, in order:
   *   1. trigger a real UI send (`chatPage.sendMessage(...)`),
   *   2. `await waitForClientMessage()` to observe + assert the outbound
   *      `{flow, session_id, token, prompt}` payload,
   *   3. `send(frame)` scripted server frames one at a time, interleaving
   *      Playwright web-first assertions between them to verify each step
   *      of the turn as it streams in.
   *
   * Frame shapes match `CHAT_MESSAGE_TYPES` / the message handler in
   * `use-chat-v2.ts` (`@iblai/web-utils`): a bare `{generation_id}` frame
   * starts a turn, `{type: 'tool_call'|'tool_call.end', value, ...}` frames
   * carry tool calls (same `id` on both halves of a pair upserts one entry;
   * a different `id` appends a new one — this is what makes a *second*
   * `write_todos` pair a wholesale replacement, since `extractLatestTodos`
   * reads only the last `write_todos`-named entry), and `{eos: true}` ends
   * the turn.
   */
  async mockChatWebSocket(): Promise<{
    waitForClientMessage: () => Promise<Record<string, unknown>>;
    send: (frame: Record<string, unknown>) => void;
  }> {
    let capturedWs: WebSocketRoute | undefined;
    let resolveMessage: ((msg: Record<string, unknown>) => void) | undefined;
    const messagePromise = new Promise<Record<string, unknown>>((resolve) => {
      resolveMessage = resolve;
    });

    await this.page.routeWebSocket('**/ws/langflow/**', (ws) => {
      capturedWs = ws;
      ws.onMessage((raw) => {
        try {
          const parsed = JSON.parse(raw.toString());
          resolveMessage?.(parsed);
        } catch {
          // Non-JSON frame from the page — not expected on this socket,
          // ignore rather than throw out of the WS event handler.
        }
      });
    });

    return {
      waitForClientMessage: () => messagePromise,
      send: (frame: Record<string, unknown>) => {
        if (!capturedWs) {
          throw new Error(
            '[mockChatWebSocket] send() called before the page opened the mocked socket',
          );
        }
        capturedWs.send(JSON.stringify(frame));
      },
    };
  }

  /** Returns the agent task-list panel root within `scope` (default: page). */
  getAgentTodoList(scope?: Locator): Locator {
    return (scope ?? this.page).getByTestId('agent-todo-list');
  }

  /** Returns the collapsible trigger for the agent task-list panel. */
  getAgentTodoTrigger(scope?: Locator): Locator {
    return (scope ?? this.page).getByTestId('agent-todo-list-trigger');
  }

  /** Returns the "N of M done" progress summary node. */
  getAgentTodoProgress(scope?: Locator): Locator {
    return (scope ?? this.page).getByTestId('agent-todo-list-progress');
  }

  /** Returns the `<ol>` wrapping the rendered todo `<li>` rows. */
  getAgentTodoItemsContainer(scope?: Locator): Locator {
    return (scope ?? this.page).getByTestId('agent-todo-list-items');
  }

  /** Returns all rendered `<li data-testid="agent-todo-item">` rows. */
  getAgentTodoItems(scope?: Locator): Locator {
    return (scope ?? this.page).getByTestId('agent-todo-item');
  }

  /** Returns the sr-only `aria-live` announcer node for the task list. */
  getAgentTodoAnnouncer(scope?: Locator): Locator {
    return (scope ?? this.page).getByTestId('agent-todo-list-announcer');
  }

  // ── Binary artifact chip → binary canvas (Journey 71) ───────────────────────
  //
  // Binary artifacts (pdf, zip, xlsx, …) are produced by an agent with a
  // sandbox VM (or claw) enabled — see `SandboxTab` — and rendered via
  // `CanvasMessagePreview` (the chat chip) + `BinaryCanvasComponent` (the
  // read-only canvas). Unlike the rich-text canvas, opening never streams
  // live; the chip's button stays disabled until the file is fully written.

  /**
   * Waits for the most recent binary-artifact chat chip to appear and for it
   * to finish generating (the `canvas-binary-generating` wrapper clears and
   * `canvas-open-button` becomes enabled). Does NOT click anything — pair
   * with `openBinaryCanvas()`. VM boot + file generation against a live LLM
   * is slow, so the default timeouts here are generous; callers on a faster
   * env can tighten them.
   */
  async waitForBinaryArtifactChipReady(opts?: {
    /** Timeout for the chip itself to appear (artifact-stream-start). */
    chipTimeout?: number;
    /** Timeout for the generating wrapper to clear (artifact-stream-end). */
    generatingTimeout?: number;
  }): Promise<void> {
    const { chipTimeout = 120_000, generatingTimeout = 180_000 } = opts ?? {};
    await expect(this.canvasMessagePreview.first()).toBeVisible({
      timeout: chipTimeout,
    });
    await expect(this.canvasBinaryGenerating).toHaveCount(0, {
      timeout: generatingTimeout,
    });
    await expect(this.canvasOpenButton.first()).toBeEnabled({
      timeout: 15_000,
    });
  }

  /**
   * Opens the binary canvas for the most recently generated binary artifact.
   * Tolerant of the app's own auto-open-at-stream-end behavior: binary
   * artifacts open the canvas automatically once generation finishes AS LONG
   * AS no other canvas is already open (`components/chat/index.tsx`'s
   * `handleArtifactStreamEnd`). Rather than assume either outcome, this
   * probes for `binaryCanvas` already being visible first (a short `waitFor`
   * — never `isVisible().catch()`) and only clicks `canvas-open-button` when
   * it isn't. Call `waitForBinaryArtifactChipReady()` first so the button is
   * actually clickable in the fallback branch.
   */
  async openBinaryCanvas(): Promise<void> {
    let alreadyOpen = false;
    try {
      await this.binaryCanvas.waitFor({ state: 'visible', timeout: 5_000 });
      alreadyOpen = true;
    } catch {
      alreadyOpen = false;
    }
    if (!alreadyOpen) {
      await this.canvasOpenButton.first().click();
      await expect(this.binaryCanvas).toBeVisible({ timeout: 15_000 });
    }
  }

  /**
   * Whether the composer's Canvas tool chip is currently active (artifacts
   * enabled for outgoing messages). The chip carries no aria-pressed — its
   * active state is styling-only, so this reads the active background class
   * (`bg-[#F5F8FF]`, rendered literally by Tailwind's arbitrary-value
   * syntax).
   */
  async isCanvasToolActive(): Promise<boolean> {
    const cls = (await this.canvasToggle.first().getAttribute('class')) ?? '';
    return cls.includes('bg-[#F5F8FF]');
  }

  /**
   * Idempotently enables the composer's Canvas tool. The artifact pipeline
   * is inert without it — the agent's reply never becomes an artifact
   * chip/canvas — so any spec that expects artifacts must call this BEFORE
   * `sendMessage()`. Some environments/mentors default the tool on, hence
   * the state check instead of a blind (toggling) click.
   */
  async enableCanvasTool(): Promise<void> {
    await expect(this.canvasToggle.first()).toBeVisible({ timeout: 30_000 });
    if (await this.isCanvasToolActive()) return;
    await this.canvasToggle.first().click();
    await expect(this.canvasToggle.first()).toHaveClass(/bg-\[#F5F8FF\]/, {
      timeout: 10_000,
    });
  }

  // ── Persistent "agent is working" indicator — Journey 69 (issue #2217) ─────
  //
  // `WorkingIndicator` (components/chat/working-indicator.tsx) is the
  // shimmering `role="status"` line that replaces the old placeholder which
  // used to vanish the moment any token rendered. It is driven by the SDK's
  // `ChatPhase` (`@iblai/iblai-js/web-utils`) and is mounted in two places
  // that are mutually exclusive by design (never both at once): standalone,
  // inside `AIWorkingMessage` (`data-testid="chat-working-message"`) before
  // the streaming bubble has anything to show, and embedded at the foot of
  // the real streaming bubble (`AIMessageBubble`) once it does. Both wrap the
  // SAME `data-testid="chat-working-indicator"` element, so
  // `getWorkingIndicator(scope)` finds it regardless of which frame currently
  // owns it — pass the relevant frame (`getWorkingMessage()` or
  // `getLastAiMessage()`) as `scope` to disambiguate.

  /** Returns the standalone pre-token placeholder frame (whole turn, not just the indicator). */
  getWorkingMessage(): Locator {
    return this.page.getByTestId('chat-working-message');
  }

  /**
   * Returns the shimmering status line itself, within `scope` (default:
   * whole page). Renders nothing (`toHaveCount(0)`, not merely hidden) once
   * the component decides there is nothing to add — see the class-level note
   * above for the two frames this can be embedded in.
   */
  getWorkingIndicator(scope?: Locator): Locator {
    return (scope ?? this.page).getByTestId('chat-working-indicator');
  }

  /**
   * Returns the reasoning disclosure row's trigger, within `scope`. Its
   * label is ALWAYS "Thought" (never "Thinking" — that word belongs solely
   * to the shimmer), streaming or not; liveness is conveyed only by the
   * bouncing dots appearing/disappearing next to it (see `getBounceDots`).
   */
  getReasoningTrigger(scope?: Locator): Locator {
    return (scope ?? this.page).getByRole('button', {
      name: 'Thought',
      exact: true,
    });
  }

  /** Returns the generic tool-call disclosure row's trigger, within `scope`. */
  getToolCallTrigger(scope?: Locator): Locator {
    return (scope ?? this.page).getByRole('button', {
      name: /^Used \d+ tools?$/i,
    });
  }

  /**
   * Returns the bouncing-dot indicators within `scope` — rendered by
   * `ReasoningSection`/`ToolCallIndicator` only while `isActive` (i.e. only
   * one of them should ever be live at once; see working-indicator.tsx's
   * "exactly one element conveys progress" invariant), and additionally
   * exposed by `WorkingIndicator`'s shimmer treatment being independent of
   * this — the shimmer has no dots of its own, only the two disclosure rows
   * do.
   */
  getBounceDots(scope?: Locator): Locator {
    return (scope ?? this.page).locator('span.animate-bounce');
  }
}
