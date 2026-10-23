import {
  Page,
  Locator,
  Route,
  WebSocketRoute,
  Download,
  expect,
} from '@playwright/test';

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
   * The runtime "User Agreement" consent modal. An agent with the agreement
   * enabled gates chatting behind it, so a sent message produces this instead
   * of a reply until it is accepted.
   */
  readonly userAgreementDialog: Locator;
  readonly userAgreementAccept: Locator;
  /**
   * The composer's "Canvas" tool chip (inside-buttons row). Artifacts are
   * only produced for a session while this tool is active — without it the
   * agent's reply never becomes an artifact chip/canvas, so specs that
   * expect artifacts MUST call `enableCanvasTool()` before sending. The chip
   * exposes its state as `aria-pressed` (see `renderToolButton` in
   * components/chat-input-form/inside-buttons.tsx) — read THAT, never the
   * class list: the inactive pill carries `hover:bg-[#F5F8FF]`, which
   * contains the active `bg-[#F5F8FF]` token as a substring and made the
   * old class-based check report "already on" while the tool was off.
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
  /**
   * The "Memory" row/item — only ever mounted inside the "+" menu now (issue
   * #2586). Resolved from `openPlusMenuAny()`, so it only ever "exists" while
   * the + menu is open — callers MUST `openPlusMenu()` first, both to click
   * it and to assert it absent/present for a given mentor.
   */
  readonly memoryButton: Locator;
  readonly createMentorDialog: Locator;
  readonly loginBanner: Locator;
  /**
   * The composer's single "+" menu trigger (issue #2586). Its aria-label is
   * still exactly "Attach file" (`chatInputFormUploadMenu.attachFile`) even
   * though it now opens Upload/Camera/Tools/Skills/Prompts/Memory, not just
   * attachments — kept for backward compatibility with any direct callers.
   * Prefer `plusMenuButton` in new code; both resolve the same element.
   */
  readonly uploadButton: Locator;
  /** Alias for `uploadButton` — the composer's "+" trigger (`composer-plus-button`). */
  readonly plusMenuButton: Locator;
  readonly voiceCallButton: Locator;
  readonly voiceInputButton: Locator;
  readonly screenShareButton: Locator;
  readonly dragOverlay: Locator;
  /**
   * The rendered "Web Search" chip/menu item, whichever is currently in the
   * DOM (issue #2586): the active chip (`Turn off Web Search`) when the tool
   * is ON, or the Tools-submenu row (`menuitemcheckbox`/`switch` named "Web
   * Search") when the + menu's Tools page is open. See `getToolButton`,
   * `isToolActive`, `enableTool`/`disableTool` for the full state machine —
   * this field alone does NOT open any menu, so a bare visibility check on it
   * only tells you "currently mounted", not "tool is enabled for this
   * mentor" (use `isToolAvailable` for that).
   */
  readonly webSearchButton: Locator;
  readonly stopStreamingButton: Locator;
  /**
   * The "Prompts" item — only ever mounted inside the "+" menu now (issue
   * #2586). Resolved from `openPlusMenuAny()` — callers MUST `openPlusMenu()`
   * first, both to click it and to assert it absent/present.
   */
  readonly promptsButton: Locator;
  readonly promptGalleryDialog: Locator;
  readonly guidedSuggestedPrompts: Locator;
  readonly guidedSuggestedPromptButtons: Locator;
  readonly slashSkillPicker: Locator;
  readonly skillTokenHighlights: Locator;
  /**
   * The Skills row/submenu-trigger — now only ever mounted inside the "+"
   * menu (issue #2586's `ComposerPlusMenu`), desktop (a `DropdownMenuSub`
   * trigger) and mobile (a sheet row) alike, both sharing the SAME
   * `skills-menu-trigger` testid. Shows the armed skill's name whenever a
   * `/slug` token is present in the composer, "Skills" otherwise. Callers
   * MUST `openPlusMenu()` first — see `openSkillsMenu()`, which does that.
   */
  readonly skillsMenuTrigger: Locator;
  /**
   * REMOVED in the #2586 redesign — the old inline ✕ on the armed Skills
   * trigger no longer exists (the trigger is now a plain submenu row with a
   * count badge, not a standalone pill). To disarm a skill without typing,
   * re-select it in the Skills menu (`getSkillsMenuItem(slug)` — a checkbox
   * item that un-arms on a second click) or use its "Remove {name}" active
   * chip (`getToolChip`/`composer-active-row`, when it isn't collapsed into
   * "+N"). Kept as a locator that never matches anything, so any caller that
   * still references it fails loudly (a missing property would be a
   * TypeScript error; an always-empty locator fails at the `expect()` site
   * with a clear "0 elements" message) rather than silently reinterpreting
   * unrelated DOM.
   */
  readonly skillsMenuClear: Locator;
  /** The Skills dropdown's content panel (Radix portal), when open. */
  readonly skillsMenuContent: Locator;
  /**
   * The AI message toolbar's download trigger — sr-only accessible name
   * "Download this chat" (`ai-message-download.tsx`), rendered right after
   * the share button under the same `!showingSharedChat && !chatPrivacyActive`
   * gate. One instance per AI bubble; scope with `.first()`/`.last()` or
   * `getDownloadButton(scope)` when more than one reply is on screen.
   */
  readonly downloadButton: Locator;
  /** The "Download Chat" dialog opened by `downloadButton` — a radio-group scope picker. */
  readonly downloadDialog: Locator;
  /** "Entire chat" radio inside the download dialog — preselected on every open. */
  readonly downloadScopeChatRadio: Locator;
  /** "This message only" radio inside the download dialog. */
  readonly downloadScopeMessageRadio: Locator;
  /** The dialog's single primary action button ("Download"). There is no Cancel — dismiss via Escape or the dialog's built-in close. */
  readonly downloadConfirmButton: Locator;
  /** The shared SDK dialog (`data-testid="chat-download-dialog"`) — "Download Chat" from a reply, "Export Chat" from the sidebar row menu. */
  readonly exportDialogRoot: Locator;
  /** The "File type" dropdown (Text / Excel) inside the shared dialog. */
  readonly downloadFormatSelect: Locator;
  /** Footer status slot — "Getting the whole chat…", "Getting your file ready…" or an error; absent when idle. */
  readonly downloadStatus: Locator;
  /**
   * One rendered file-attachment chip (SDK `file-attachments-list.tsx`,
   * `data-testid="attachment-chip"`). Use `.first()`/`.nth()` to disambiguate
   * when more than one file is attached.
   */
  readonly attachmentChip: Locator;

  constructor(page: Page) {
    this.page = page;
    this.chatInput = page.getByRole('textbox', {
      name: 'Ask anything',
      exact: true,
    });
    this.sendButton = page.getByRole('button', { name: 'Send message' });
    // Exact: the Incognito pill's accessible name can end in "…start a new
    // chat", and a bare `name` is a case-insensitive substring match.
    this.newChatButton = page.getByRole('button', {
      name: 'New Chat',
      exact: true,
    });
    this.userMessages = page.locator('.chat-user-message-query');
    this.aiMessages = page.locator('.chat-ai-message-response');
    this.userAgreementDialog = page.getByRole('dialog', {
      name: /user agreement/i,
    });
    this.userAgreementAccept = this.userAgreementDialog.getByRole('button', {
      name: /i accept/i,
    });
    // Exact name: when Canvas is on, its pill also carries a "Turn off
    // Canvas" × (like the tool chips), which a /canvas/i regex would match.
    this.canvasToggle = page.getByRole('button', {
      name: 'Canvas',
      exact: true,
    });
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
    // `chat-memory-button` (a DropdownMenuItem on desktop, a sheet row on
    // mobile — SAME testid both layouts) now lives ONLY inside the "+" menu
    // (issue #2586's `ComposerPlusMenu`), never standalone in the composer
    // row. Resolved from `openPlusMenuAny()` (the currently-OPEN desktop
    // dropdown content or mobile sheet) so it can never match a stray
    // same-testid element elsewhere, and so it correctly reports "not
    // visible" both when the + menu is closed AND when Memory genuinely isn't
    // offered — callers that need to tell those apart MUST `openPlusMenu()`
    // first (see the field's doc comment).
    this.memoryButton =
      this.openPlusMenuAny().getByTestId('chat-memory-button');
    this.createMentorDialog = page.getByRole('dialog', {
      name: /create.*mentor/i,
    });
    this.loginBanner = page.getByRole('button', { name: /log in/i });
    // Still "Attach file" — `ComposerPlusMenu`'s trigger reuses the classic
    // UploadMenu's aria-label verbatim even though it now opens far more than
    // attachments (issue #2586).
    this.uploadButton = page.getByRole('button', { name: 'Attach file' });
    this.plusMenuButton = this.uploadButton;
    this.voiceCallButton = page.getByRole('button', { name: 'Voice call' });
    this.voiceInputButton = page.getByRole('button', { name: 'Voice input' });
    // Always "Screen Sharing" (`ScreenSharingButton`'s aria-label never
    // changes with state — only its tooltip text does).
    this.screenShareButton = page.getByRole('button', {
      name: 'Screen Sharing',
      exact: true,
    });
    this.dragOverlay = page.locator(
      '[data-testid="drag-overlay"], [class*="drag-overlay"]',
    );
    // Resolves to whichever the DOM currently has (issue #2586): the active
    // chip ("Turn off Web Search") when the tool is on, or the Tools-submenu
    // row (a `menuitemcheckbox` on desktop, a `switch` on mobile — both named
    // "Web Search") when the + menu's Tools page happens to be open. See the
    // field's doc comment — a bare visibility check on this alone conflates
    // "not currently mounted" with "not enabled for this mentor".
    this.webSearchButton = this.getToolButton('Web Search');
    this.stopStreamingButton = page.locator('.chat-stop-streaming-button');
    // "Prompts" is a DropdownMenuItem (desktop) / sheet row (mobile) inside
    // the "+" menu now (issue #2586) — resolved from `openPlusMenuAny()`, so
    // callers MUST `openPlusMenu()` first (see the field's doc comment).
    // `.or(...)` covers both the desktop `menuitem` role and the mobile
    // sheet's plain `button` role for the same visible row.
    this.promptsButton = this.openPlusMenuAny()
      .getByRole('menuitem', { name: 'Prompts', exact: true })
      .or(
        this.openPlusMenuAny().getByRole('button', {
          name: 'Prompts',
          exact: true,
        }),
      );
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
    // Only ever mounted inside the "+" menu now (issue #2586) — resolved from
    // `openPlusMenuAny()`, so callers MUST `openPlusMenu()` first (see the
    // field's doc comment; `openSkillsMenu()` does this for you).
    this.skillsMenuTrigger = this.openPlusMenuAny().getByTestId(
      'skills-menu-trigger',
    );
    // Never matches anything post-#2586 — see the field's doc comment.
    this.skillsMenuClear = page.getByTestId('skills-menu-clear-REMOVED-2586');
    this.skillsMenuContent = page.getByTestId('skills-menu-content');
    this.downloadButton = page.getByRole('button', {
      name: 'Download this chat',
    });
    this.downloadDialog = page.getByRole('dialog', { name: 'Download Chat' });
    this.exportDialogRoot = page.getByTestId('chat-download-dialog');
    this.downloadFormatSelect = this.exportDialogRoot.getByRole('combobox', {
      name: 'File type',
    });
    this.downloadStatus = this.exportDialogRoot.getByTestId(
      'chat-download-status',
    );
    this.downloadScopeChatRadio = this.downloadDialog.getByRole('radio', {
      name: 'Entire chat',
    });
    this.downloadScopeMessageRadio = this.downloadDialog.getByRole('radio', {
      name: 'This message only',
    });
    this.downloadConfirmButton = this.downloadDialog.getByRole('button', {
      name: 'Download',
      exact: true,
    });
    this.attachmentChip = page.getByTestId('attachment-chip');
  }

  async sendMessage(text: string): Promise<void> {
    // Role-agnostic id-based locator, NOT `this.chatInput` — the composer's
    // accessible role flips from `textbox` to `combobox` whenever the
    // current mentor has any enabled skills (see the "`/` skill picker"
    // section below), which `sendMessage` has no business caring about. Any
    // mentor with skills configured made every caller of `sendMessage`
    // (nearly every journey) fail on `chatInput` alone (issue #2464 sh-07).
    const composer = this.getComposerTextarea();
    await expect(composer).toBeVisible({ timeout: 15_000 });
    await composer.fill(text);
    await expect(this.sendButton).toBeEnabled({ timeout: 10_000 });
    await this.page.waitForTimeout(5_000);
    await this.sendButton.click();
  }

  async waitForAIResponse(timeout = 60_000): Promise<void> {
    await expect(this.aiMessages.first()).toBeVisible({ timeout });
  }

  /**
   * Resolves on whichever the agent produces first: its reply, or the User
   * Agreement modal that gates the reply.
   *
   * Whether an agent carries a user agreement is a property of the agent, not
   * of the flow under test, so a caller that only needs "the chat is live"
   * cannot assume a reply. Callers that specifically test replies should keep
   * using waitForAIResponse.
   */
  async waitForAIResponseOrUserAgreement(
    timeout = 60_000,
  ): Promise<'response' | 'user-agreement'> {
    try {
      return await Promise.any([
        this.aiMessages
          .first()
          .waitFor({ state: 'visible', timeout })
          .then(() => 'response' as const),
        this.userAgreementDialog
          .waitFor({ state: 'visible', timeout })
          .then(() => 'user-agreement' as const),
      ]);
    } catch {
      throw new Error(
        `Neither an assistant reply nor the User Agreement modal appeared within ${timeout}ms`,
      );
    }
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
   * Activate the Web Search session tool. Delegates to `enableTool` (issue
   * #2586): an enabled-but-inactive tool no longer has a permanently-visible
   * standalone button in the chat input bar (the classic `OutsideButtons`
   * row) — it only surfaces once the "+" menu's Tools page is opened, which
   * `enableTool`/`setToolState` already handle (open, click, verify it holds).
   */
  async activateWebSearch(): Promise<void> {
    await this.enableTool('Web Search');
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
    // "Prompts" is a "+" menu item now (issue #2586) — open the menu first.
    await this.openPlusMenu();
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
   * `session_id` (see `lib/constants.ts → LOCAL_STORAGE_KEYS.SESSION_ID`),
   * keyed `${tenantKey}:${mentorId}` (#2536).
   */
  async getCachedSessionId(mentorId: string): Promise<string | null> {
    return this.page.evaluate((mid: string) => {
      try {
        const raw = window.localStorage.getItem('session_id');
        if (!raw) return null;
        const cache = JSON.parse(raw) as Record<string, string>;
        const key = Object.keys(cache).find((k) => k.endsWith(`:${mid}`));
        return key ? cache[key] : null;
      } catch {
        return null;
      }
    }, mentorId);
  }

  /** Drops `mentorId`'s entry from the device session cache so the next open must look the conversation up. */
  async forgetCachedSession(mentorId: string): Promise<void> {
    await this.page.evaluate((mid: string) => {
      try {
        const cache = JSON.parse(
          window.localStorage.getItem('session_id') ?? '{}',
        ) as Record<string, string>;
        for (const key of Object.keys(cache)) {
          if (key.endsWith(`:${mid}`)) delete cache[key];
        }
        window.localStorage.setItem('session_id', JSON.stringify(cache));
      } catch {
        window.localStorage.removeItem('session_id');
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
    // Desktop: a `DropdownMenuSubContent` portal, `data-state="open"` while
    // showing. Phones: the SAME testid on a plain `<div>` sheet PAGE (no
    // `data-state` at all — that attribute is Radix dropdown-specific) —
    // matched instead via the currently-open sheet, which already implies
    // this page is the one showing.
    return this.page
      .locator('[data-testid="skills-menu-content"][data-state="open"]')
      .or(this.openPlusMenuSheet().getByTestId('skills-menu-content'));
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
    await this.openPlusMenu();
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
  // `showReasoning` (mentor-settings `show_reasoning`; the backend default
  // may be `true`) is on AND the assistant turn's `toolCalls` contains a `write_todos` entry
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
    tenantKey?: string,
  ): Promise<void> {
    await this.page.addInitScript(
      ({ mentorId, sessionId, tenantKey }) => {
        // The app keys the cache `${tenantKey}:${mentorId}` (#2536).
        window.localStorage.setItem(
          'session_id',
          JSON.stringify({
            [mentorId]: sessionId,
            ...(tenantKey ? { [`${tenantKey}:${mentorId}`]: sessionId } : {}),
          }),
        );
      },
      { mentorId, sessionId, tenantKey },
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
  /**
   * Shared implementation behind `mockChatWebSocket()` and
   * `mockStopGenerationWebSocket()` — routes `urlPattern` via
   * `page.routeWebSocket()` and exposes a small QUEUE-based controller: each
   * `waitForClientMessage()` call resolves the next not-yet-consumed client
   * frame (oldest first), so a test can observe several client sends in
   * sequence (e.g. the turn-start prompt, then later the stop frame) rather
   * than only ever the very first one — the original one-shot-Promise
   * version silently dropped every message after the first.
   */
  private async mockWebSocketRoute(urlPattern: string): Promise<{
    waitForClientMessage: () => Promise<Record<string, unknown>>;
    send: (frame: Record<string, unknown>) => void;
    close: () => void;
  }> {
    let capturedWs: WebSocketRoute | undefined;
    const pendingMessages: Record<string, unknown>[] = [];
    const pendingWaiters: Array<(msg: Record<string, unknown>) => void> = [];

    await this.page.routeWebSocket(urlPattern, (ws) => {
      capturedWs = ws;
      ws.onMessage((raw) => {
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(raw.toString());
        } catch {
          // Non-JSON frame from the page — not expected on this socket,
          // ignore rather than throw out of the WS event handler.
          return;
        }
        const waiter = pendingWaiters.shift();
        if (waiter) waiter(parsed);
        else pendingMessages.push(parsed);
      });
    });

    return {
      waitForClientMessage: () =>
        pendingMessages.length
          ? Promise.resolve(pendingMessages.shift() as Record<string, unknown>)
          : new Promise((resolve) => pendingWaiters.push(resolve)),
      send: (frame: Record<string, unknown>) => {
        if (!capturedWs) {
          throw new Error(
            `[mockWebSocketRoute] send() called before the page opened the mocked socket (${urlPattern})`,
          );
        }
        capturedWs.send(JSON.stringify(frame));
      },
      close: () => {
        capturedWs?.close();
      },
    };
  }

  async mockChatWebSocket(): Promise<{
    waitForClientMessage: () => Promise<Record<string, unknown>>;
    send: (frame: Record<string, unknown>) => void;
    close: () => void;
  }> {
    return this.mockWebSocketRoute('**/ws/langflow/**');
  }

  /**
   * Mocks the dedicated stop-generation socket
   * (`wss://.../ws/langflow-stop-generation/`) — a SEPARATE connection opened
   * fresh every time the Stop button is clicked (`stopGenerating()` in
   * `@iblai/web-utils`'s `use-chat-v2.ts`), never the same socket as
   * `mockChatWebSocket()`. On open the client sends
   * `{generation_id, name, tenant, username, token}` (the `generation_id`
   * must match whatever the mocked main socket's turn-start frame carried —
   * that's the only id the stop handler recognises). Replying with ANY
   * message (e.g. `{detail: 'Stopped'}`) is what actually flips the app out
   * of the streaming state and re-enables the composer
   * (`handleStopGenerationSocketMessage`) — clicking Stop alone only pauses
   * the main socket (`isWebSocketPaused.current = true`, set synchronously,
   * which is also why a frame sent on the main socket right after Stop is
   * silently ignored even before this reply arrives). Must be registered
   * before navigation, alongside `mockChatWebSocket()`.
   */
  async mockStopGenerationWebSocket(): Promise<{
    waitForClientMessage: () => Promise<Record<string, unknown>>;
    send: (frame: Record<string, unknown>) => void;
    close: () => void;
  }> {
    return this.mockWebSocketRoute('**/ws/langflow-stop-generation/**');
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
   * enabled for outgoing messages). Reads the pill's `aria-pressed` — the
   * only reliable signal. Do NOT fall back to the class list: the INACTIVE
   * pill is styled `hover:bg-[#F5F8FF]`, and a substring check for the
   * active `bg-[#F5F8FF]` token matches that too, so a class-based check
   * reported "already active" on a fresh session and `enableCanvasTool`
   * silently skipped the click (journey 71's 4-minute chip timeout).
   */
  async isCanvasToolActive(): Promise<boolean> {
    const pressed = await this.canvasToggle
      .first()
      .getAttribute('aria-pressed');
    return pressed === 'true';
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
    await expect(this.canvasToggle.first()).toHaveAttribute(
      'aria-pressed',
      'true',
      { timeout: 10_000 },
    );
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

  // ── Chat download (issue #2464) ─────────────────────────────────────────

  /** Returns the reply body within `scope` (default: first AI bubble) — excludes the reasoning/tool-call/todo/permission rows rendered above it. */
  getAiMessageBody(scope: Locator = this.aiMessages.first()): Locator {
    return scope.getByTestId('ai-message-body');
  }

  /** Returns the download trigger within `scope` (default: whole page) — disambiguates when multiple AI bubbles are on screen. */
  getDownloadButton(scope?: Locator): Locator {
    return (scope ?? this.page).getByRole('button', {
      name: 'Download this chat',
    });
  }

  /**
   * Opens the download dialog via `trigger` (default: the first
   * "Download this chat" button on the page) and waits for it to render.
   * The scope selection always resets to "Entire chat" on open — callers
   * that want "This message only" must select it explicitly every time.
   */
  async openDownloadDialog(trigger?: Locator): Promise<void> {
    const button = trigger ?? this.downloadButton.first();
    await expect(button).toBeVisible({ timeout: 15_000 });
    await button.click();
    await expect(this.downloadDialog).toBeVisible({ timeout: 10_000 });
  }

  /** Picks "Text (.txt)" or "Excel (.xlsx)" in the dialog's File type dropdown. */
  async selectDownloadFormat(format: 'Text' | 'Excel'): Promise<void> {
    await this.downloadFormatSelect.click();
    await this.page
      .getByRole('option', { name: new RegExp(`^${format}`) })
      .click();
    await expect(this.downloadFormatSelect).toContainText(format);
  }

  /** Reads a triggered `Download`'s full content as a Buffer (binary files such as .xlsx). */
  async readDownloadBuffer(download: Download): Promise<Buffer> {
    const stream = await download.createReadStream();
    if (!stream) return Buffer.alloc(0);
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve());
      stream.on('error', reject);
    });
    return Buffer.concat(chunks);
  }

  /**
   * Reads a triggered `Download`'s full content as UTF-8 text. Uses
   * `createReadStream()` rather than `download.path()` — the stream works
   * the same across Chromium/Firefox/WebKit, while `path()` is not always
   * available depending on how the download was accepted.
   */
  async readDownloadText(download: Download): Promise<string> {
    const stream = await download.createReadStream();
    if (!stream) return '';
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve());
      stream.on('error', reject);
    });
    return Buffer.concat(chunks).toString('utf-8');
  }

  // ── SDK Chat migration (issue #2586, Stage 1 Tier 1) ────────────────────────
  //
  // The chat surface is now the SDK `Chat` component
  // (`@iblai/iblai-js/web-containers/next`, wired via
  // `components/chat/sdk-chat.tsx`) — the composer, attach menu, tool chips
  // and WS transport below are all owned by that package now, not by OS's
  // (now-unrendered-on-this-page) `components/chat-input-form/*`. Selectors
  // and wire shapes here were confirmed by reading the SDK's own source
  // directly (`upload-menu.tsx`, `file-attachments-list.tsx`,
  // `web-search-button.tsx`, `use-chat-v2.ts`, `use-mentor-tools.ts` in
  // `@iblai/web-containers`/`@iblai/web-utils`), not the bundled `dist/`.

  // ── The single "+" composer menu (issue #2586) ──────────────────────────
  //
  // `ComposerPlusMenu` (SDK, `chat-input-form/composer-plus-menu.tsx`)
  // replaced the classic UploadMenu + InsideButtons/OutsideButtons rows with
  // ONE trigger (`composer-plus-button`, still aria-labelled "Attach file" —
  // see `uploadButton`) that opens either a desktop Radix dropdown
  // (`composer-plus-menu`, with a `composer-tools-menu` / `skills-menu-content`
  // sub-popover per item) or, on phones, a bottom sheet
  // (`composer-plus-sheet`) with paged content (main → tools/skills/memory).
  // Tools/Skills/Prompts/Memory now only exist in the DOM while this is open.

  /** The desktop dropdown's currently OPEN content. */
  private openPlusMenuContent(): Locator {
    return this.page.locator(
      '[data-testid="composer-plus-menu"][data-state="open"]',
    );
  }

  /** The phone bottom-sheet's currently OPEN content (any page). */
  private openPlusMenuSheet(): Locator {
    return this.page.locator(
      '[data-testid="composer-plus-sheet"][data-state="open"]',
    );
  }

  /**
   * Whichever of the desktop dropdown / phone sheet is genuinely open right
   * now — the two are mutually exclusive by viewport, so this always
   * resolves to at most one open surface. Every "+" menu item locator is
   * scoped from this, never the bare page, so a closed menu correctly
   * reports its items as absent rather than matching a stray leftover DOM
   * node from a previous open/close cycle.
   */
  private openPlusMenuAny(): Locator {
    return this.openPlusMenuContent().or(this.openPlusMenuSheet());
  }

  /** "+" menu → Model row (#2633); only exists while the "+" menu is open. */
  get modelMenuTrigger(): Locator {
    return this.openPlusMenuAny().getByTestId('composer-model-trigger');
  }

  /** The composer chip naming the model picked for this chat. */
  get modelChip(): Locator {
    return this.page.getByTestId('composer-model-chip');
  }

  /** The "Switched to X for this chat" notices in the thread. */
  get modelSwitchNotices(): Locator {
    return this.page.getByTestId('chat-model-switch-notice');
  }

  /**
   * Picks a model for this chat through "+" › Model › provider › model, by
   * provider key and model wire key (`data-model`). Works for the desktop
   * submenus and the phone sheet pages alike. With a single usable provider
   * the picker lists its models straight away, so the provider step is
   * skipped when no provider row shows.
   */
  async pickChatModel(providerKey: string, modelKey: string): Promise<void> {
    await this.openPlusMenu();
    await expect(this.modelMenuTrigger).toBeVisible({ timeout: 10_000 });
    await this.modelMenuTrigger.click();
    const provider = this.page
      .locator(`[data-testid="composer-model-provider-${providerKey}"]`)
      .last();
    const model = this.page
      .locator(`[data-testid="composer-model-item"][data-model="${modelKey}"]`)
      .last();
    await expect(provider.or(model).first()).toBeVisible({ timeout: 10_000 });
    if (await provider.isVisible()) await provider.click();
    await expect(model).toBeVisible({ timeout: 10_000 });
    await model.click();
    await expect(this.openPlusMenuAny()).not.toBeVisible({ timeout: 5_000 });
  }

  /**
   * Picks, through the UI only, the first model the user can use other than
   * the one the chat is already on: "+" › Model › (first provider that has
   * one) › that model. Names no model, so it works for whatever catalogue the
   * user has. Returns the provider key (null when the picker skips the
   * provider step), the model's wire key and its label. Desktop submenus and
   * phone sheet pages alike.
   */
  async pickFirstAvailableChatModel(): Promise<{
    provider: string | null;
    llmName: string;
    label: string;
  }> {
    await this.openPlusMenu();
    await expect(this.modelMenuTrigger).toBeVisible({ timeout: 10_000 });
    await this.modelMenuTrigger.click();

    const providers = this.page
      .locator('[data-testid^="composer-model-provider-"]')
      .filter({ visible: true });
    const items = this.page
      .locator('[data-testid="composer-model-item"]')
      .filter({ visible: true });
    const usable = items.and(
      this.page.locator(
        '[data-unavailable="false"]:not([aria-checked="true"]):not([aria-pressed="true"])',
      ),
    );
    await expect(providers.or(items).first()).toBeVisible({ timeout: 10_000 });

    const providerCount = await providers.count();
    for (let i = 0; i < Math.max(providerCount, 1); i++) {
      let provider: string | null = null;
      if (providerCount > 0) {
        const row = providers.nth(i);
        const testId = (await row.getAttribute('data-testid')) ?? '';
        provider = testId.replace('composer-model-provider-', '');
        await row.click();
      }
      await expect(items.first()).toBeVisible({ timeout: 10_000 });
      if ((await usable.count()) > 0) {
        const pick = usable.first();
        const llmName = (await pick.getAttribute('data-model')) ?? '';
        const label = (await pick.innerText()).trim();
        await pick.click();
        await expect(this.openPlusMenuAny()).not.toBeVisible({
          timeout: 5_000,
        });
        return { provider, llmName, label };
      }
      const back = this.page.getByRole('button', { name: 'Back' });
      if (providerCount > 0 && (await back.isVisible())) await back.click();
    }
    throw new Error('the model picker offers no usable model to pick');
  }

  /**
   * Records every message the chat socket sends (parsed JSON), so a test can
   * assert on the payload of each turn. Call before the page connects.
   */
  recordChatFrames(): Record<string, unknown>[] {
    const frames: Record<string, unknown>[] = [];
    this.page.on('websocket', (socket) => {
      if (!socket.url().includes('/ws/langflow/')) return;
      socket.on('framesent', ({ payload }) => {
        try {
          const frame = JSON.parse(String(payload));
          if (frame && typeof frame === 'object' && 'prompt' in frame) {
            frames.push(frame);
          }
        } catch {
          // Not JSON (pings): not a chat turn.
        }
      });
    });
    return frames;
  }

  /** The desktop Tools submenu's currently OPEN content (`DropdownMenuSub`). */
  private openToolsSubmenuContent(): Locator {
    return this.page.locator(
      '[data-testid="composer-tools-menu"][data-state="open"]',
    );
  }

  /**
   * Opens the composer's "+" menu (desktop dropdown or phone sheet) and
   * waits until it is genuinely showing — retried like `openSkillsMenu()`,
   * since a click landing while a previous Radix instance is still tearing
   * down can be swallowed or double-toggle.
   */
  async openPlusMenu(): Promise<void> {
    await expect(this.plusMenuButton).toBeVisible({ timeout: 15_000 });
    await expect(async () => {
      if (!(await this.openPlusMenuAny().isVisible())) {
        await this.plusMenuButton.click();
      }
      await expect(this.openPlusMenuAny()).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
  }

  /** Closes the "+" menu (and any open submenu/sheet page) via Escape. */
  async closePlusMenu(): Promise<void> {
    // Radix sends Escape only to the topmost dismissable layer. Right after a
    // sidebar click, that button's tooltip can still be fading out above the
    // menu and swallow the first Escape, so press again until the menu closes.
    await expect(async () => {
      await this.page.keyboard.press('Escape');
      await expect(this.openPlusMenuAny()).not.toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 10_000 });
  }

  /**
   * Returns an item inside the OPEN "+" menu — only "Upload File" and
   * "Camera" are implemented. `.or(...)` covers both the desktop dropdown's
   * `menuitem` role and the phone sheet's plain `button` tiles for the same
   * visible row. Call `openPlusMenu()`/`openAttachMenu()` first.
   */
  getAttachMenuItem(name: 'Upload File' | 'Camera'): Locator {
    return this.openPlusMenuAny()
      .getByRole('menuitem', { name, exact: true })
      .or(this.openPlusMenuAny().getByRole('button', { name, exact: true }));
  }

  /** Opens the composer's "+" menu and waits for Upload File/Camera to render. */
  async openAttachMenu(): Promise<void> {
    await this.openPlusMenu();
    // Asserted separately, not via a combined `.or()`: Upload File and
    // Camera are both present/visible at once, so a single `.or()` locator
    // resolves to 2 real elements and `toBeVisible()` throws a strict-mode
    // violation rather than treating it as "at least one".
    await expect(this.getAttachMenuItem('Upload File')).toBeVisible({
      timeout: 10_000,
    });
    await expect(this.getAttachMenuItem('Camera')).toBeVisible({
      timeout: 10_000,
    });
  }

  // ── Composer tools (issue #2586) ─────────────────────────────────────────
  //
  // A session tool the mentor has ENABLED is only ever in the DOM two ways:
  // ACTIVE, as a removable chip in the toolbar (`composer-tool-chip`, named
  // "Turn off {name}") — or, active or not, as a row inside the "+" menu's
  // Tools page (a `menuitemcheckbox` on desktop, a `switch` on phones, both
  // named exactly `{name}`, e.g. "Web Search"). There is no longer a
  // permanently-visible always-there button for an enabled-but-inactive tool
  // (that was the classic `OutsideButtons` row) — it only surfaces once the
  // Tools page is opened. `isToolAvailable()` is for "is this tool enabled
  // for the mentor at all"; `isToolActive()`/`getToolButton()` are for "is it
  // currently ON", which callers should check without assuming a menu is open.

  /** The active-chip form of a tool, if currently rendered (`Turn off {name}`). */
  getToolChip(name: string): Locator {
    return this.page.getByRole('button', {
      name: `Turn off ${name}`,
      exact: true,
    });
  }

  /** The Tools-submenu row for `name` — only present while that page is open. */
  private getSubmenuToolItem(name: string): Locator {
    return this.openToolsSubmenuContent()
      .getByRole('menuitemcheckbox', { name, exact: true })
      .or(this.openPlusMenuSheet().getByRole('switch', { name, exact: true }));
  }

  /**
   * Resolves to whichever form of tool `name` is CURRENTLY mounted: its
   * active chip, or its Tools-submenu row if that page happens to be open.
   * A bare visibility check on this is NOT "is the tool enabled" — an
   * enabled-but-inactive tool with the + menu closed matches nothing here
   * (use `isToolAvailable` for that question).
   */
  getToolButton(name: string): Locator {
    return this.getToolChip(name).or(this.getSubmenuToolItem(name));
  }

  /**
   * Whether tool `name` is currently ON: true if its active chip is showing,
   * else — if the Tools submenu happens to be open — whatever its row's
   * `aria-checked` says, else false (nothing on-screen claims it's active).
   */
  async isToolActive(name: string): Promise<boolean> {
    if (await this.getToolChip(name).first().isVisible()) return true;
    const menuItem = this.getSubmenuToolItem(name).first();
    if (await menuItem.isVisible()) {
      return (await menuItem.getAttribute('aria-checked')) === 'true';
    }
    return false;
  }

  /**
   * Opens the "+" menu's Tools page: the desktop `DropdownMenuSub` (hover or
   * click its `composer-tools-trigger`) or the phone sheet's "Tools" row.
   * Asserts the Tools entry point exists — for a mentor that may have NO
   * tools enabled, check `isToolAvailable()` first, which tolerates absence.
   */
  async openToolsMenu(): Promise<void> {
    await this.openPlusMenu();
    if (await this.openPlusMenuSheet().isVisible()) {
      const toolsRow = this.openPlusMenuSheet().getByRole('button', {
        name: /^Tools\b/,
      });
      await expect(toolsRow).toBeVisible({ timeout: 10_000 });
      await toolsRow.click();
      await expect(
        this.openPlusMenuSheet().getByRole('switch').first(),
      ).toBeVisible({ timeout: 10_000 });
      return;
    }
    const trigger = this.openPlusMenuAny().getByTestId(
      'composer-tools-trigger',
    );
    await expect(trigger).toBeVisible({ timeout: 10_000 });
    await expect(async () => {
      if (!(await this.openToolsSubmenuContent().isVisible())) {
        await trigger.click();
      }
      await expect(this.openToolsSubmenuContent()).toBeVisible({
        timeout: 1_000,
      });
    }).toPass({ timeout: 15_000 });
  }

  /**
   * Whether tool `name` is enabled for the mentor AT ALL (active or not) —
   * checks the active chip first (no menu needed), then opens the + menu's
   * Tools page to look for its row, tolerating a mentor with no tools/attach
   * options at all (no "+" menu) or no tools specifically (no Tools page).
   * Always leaves the + menu closed on return.
   */
  async isToolAvailable(name: string): Promise<boolean> {
    if (await this.getToolChip(name).first().isVisible()) return true;
    let hasPlusMenu = false;
    try {
      await this.plusMenuButton.waitFor({ state: 'visible', timeout: 5_000 });
      hasPlusMenu = true;
    } catch {
      hasPlusMenu = false;
    }
    if (!hasPlusMenu) return false;

    await this.openPlusMenu();
    const isMobileSheet = await this.openPlusMenuSheet().isVisible();
    const toolsTrigger = isMobileSheet
      ? this.openPlusMenuSheet().getByRole('button', { name: /^Tools\b/ })
      : this.openPlusMenuAny().getByTestId('composer-tools-trigger');

    let hasTools = false;
    try {
      await toolsTrigger.waitFor({ state: 'visible', timeout: 5_000 });
      hasTools = true;
    } catch {
      hasTools = false;
    }
    if (!hasTools) {
      await this.closePlusMenu();
      return false;
    }

    await toolsTrigger.click();
    let available = false;
    try {
      await this.getSubmenuToolItem(name)
        .first()
        .waitFor({ state: 'visible', timeout: 8_000 });
      available = true;
    } catch {
      available = false;
    }
    await this.closePlusMenu();
    return available;
  }

  /**
   * Drives a tool to `target` (active/inactive) via the Tools submenu and
   * confirms the resulting state both lands AND holds. The classic chip's
   * double-PUT bug was rooted in `OutsideButtons.tsx`'s nested-button chip
   * (an inner ✕ `<span onClick>` inside an outer `<button>`, whose click
   * could bubble to both handlers); the redesigned menuitemcheckbox/switch
   * row is a single non-nested element with only a decorative check/thumb
   * inside, which structurally can't repro that. Journey 52's `sw-tools-01`
   * checkpoint asserts exactly one PUT per click network-side; this
   * retry-until-holds shape stays as a low-cost guard against any other
   * timing flake in the underlying `editSession` mutation, not as a
   * still-needed workaround for the old bug.
   */
  private async setToolState(name: string, target: boolean): Promise<void> {
    await expect(async () => {
      if ((await this.isToolActive(name)) !== target) {
        await this.openToolsMenu();
        await this.getSubmenuToolItem(name).first().click();
        await this.closePlusMenu();
      }
      expect(await this.isToolActive(name)).toBe(target);
      await this.page.waitForTimeout(1_000);
      expect(await this.isToolActive(name)).toBe(target);
    }).toPass({ timeout: 25_000 });
  }

  /** Idempotently enables a named composer tool (no-op if already on and holding). */
  async enableTool(name: string): Promise<void> {
    await this.setToolState(name, true);
  }

  /** Idempotently disables a named composer tool (no-op if already off and holding). */
  async disableTool(name: string): Promise<void> {
    await this.setToolState(name, false);
  }

  /**
   * Waits for the next PUT to the session-update endpoint whose body
   * satisfies `bodyPredicate` — the REST call `useMentorTools`'s
   * `updateSessionTools`/`setSessionTools` fire
   * (`PUT .../ai-mentor/orgs/{org}/users/{user}/sessions/{session_id}/` with
   * body `{tools: string[], enable_artifacts?: boolean}`) — and resolves
   * with its parsed JSON body. `bodyPredicate` defaults to matching any body;
   * pass one when OTHER PUTs to this same endpoint may be in flight around
   * the same time (e.g. an unrelated session-metadata autosave that also
   * happens to PUT a `tools` field) and only a specific tools list should
   * resolve the wait — confirmed necessary in practice, not merely
   * defensive. The request is observed, not intercepted: it proceeds to the
   * real backend so the session's tool list stays consistent with whatever
   * the (possibly mocked) chat WS turn reads server-side. Note enabled tools
   * are NOT resent in the per-message WS frame (confirmed in
   * `use-chat-v2.ts`'s `sendMessage`) — they're session-scoped, read back by
   * the backend from this same PUT per `session_id`.
   */
  waitForSessionToolsUpdate(
    timeout = 15_000,
    bodyPredicate: (body: { tools?: string[] }) => boolean = () => true,
  ): Promise<{ tools?: string[] }> {
    return this.page
      .waitForRequest(
        (request) => {
          if (request.method() !== 'PUT') return false;
          if (
            !/\/ai-mentor\/orgs\/[^/]+\/users\/[^/]+\/sessions\/[^/]+\/?$/.test(
              new URL(request.url()).pathname,
            )
          ) {
            return false;
          }
          try {
            return bodyPredicate(request.postDataJSON());
          } catch {
            return false;
          }
        },
        { timeout },
      )
      .then((request) => request.postDataJSON());
  }

  // ── File attachments (composer) ─────────────────────────────────────────

  /** The chip's spinner overlay — visible only while `uploadStatus === 'uploading'`. */
  getAttachmentSpinner(scope?: Locator): Locator {
    return (scope ?? this.attachmentChip).locator('.animate-spin');
  }

  /** The chip's "Retry" button — visible only once `uploadStatus === 'error'`. */
  getRetryFileButton(scope?: Locator): Locator {
    return (scope ?? this.page).getByRole('button', {
      name: 'Retry',
      exact: true,
    });
  }

  /** The chip's "Remove file" button — present in every state except mid-upload. */
  getRemoveFileButton(scope?: Locator): Locator {
    return (scope ?? this.page).getByRole('button', { name: 'Remove file' });
  }

  /**
   * The hidden device-upload `<input type="file">` (`upload-menu.tsx`'s
   * `fileUploadInputRef`). Excludes the sibling camera input, which carries
   * `capture="environment"`.
   */
  getFileUploadInput(): Locator {
    return this.page.locator('input[type="file"]:not([capture])');
  }

  /**
   * Attaches `filePath` via the hidden upload input directly — equivalent to
   * picking a file from `openAttachMenu()` → "Upload File" without needing to
   * drive the native file-picker dialog. Pair with `mockFileUpload()`,
   * registered first.
   */
  async attachFile(filePath: string): Promise<void> {
    await this.getFileUploadInput().setInputFiles(filePath);
  }

  /**
   * Mocks the two-step upload the composer performs for every attached file
   * (`use-chat-file-upload.ts`): a presigned-URL POST
   * (`.../chat/files/upload-url/`), then a direct PUT of the raw bytes to
   * that URL (real S3 in production — never reached in tests). Must be
   * registered before `attachFile()`.
   *
   * `outcome`:
   *  - `'success'` (default): both legs succeed.
   *  - `'upload-url-error'`: the presigned-URL POST 500s (S3 never
   *    contacted) — drives the chip to its error/retry state.
   *  - `'s3-error'`: the presigned-URL POST succeeds but the PUT 500s — same
   *    observable chip state, different failing leg.
   *
   * `s3DelayMs` stalls the mocked PUT so the chip's transient "uploading"
   * spinner is actually observable instead of resolving within one render
   * tick.
   */
  async mockFileUpload(
    outcome: 'success' | 'upload-url-error' | 's3-error' = 'success',
    s3DelayMs = 1_000,
  ): Promise<{ uploadUrl: string; fileId: string; fileKey: string }> {
    // Must match the app's CSP `connect-src` allowlist — an arbitrary/invalid
    // domain is blocked by the BROWSER before Playwright's route interception
    // ever sees the request (confirmed via a CSP violation console error:
    // "Refused to connect to '...' because it violates the following
    // Content Security Policy directive"). `*.s3.amazonaws.com` is on the
    // allowlist (real presigned upload URLs are S3), so this subdomain is
    // never actually resolved/contacted — `page.route` fulfills it first.
    const uploadUrl = `https://e2e-mock.s3.amazonaws.com/upload/${Date.now()}`;
    const fileId = `e2e-file-id-${Date.now()}`;
    const fileKey = `e2e-file-key-${Date.now()}`;

    await this.page.route(
      '**/api/ai-mentor/orgs/*/users/*/chat/files/upload-url/**',
      async (route) => {
        if (outcome === 'upload-url-error') {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ detail: 'e2e mock: upload-url failure' }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            upload_url: uploadUrl,
            file_id: fileId,
            file_key: fileKey,
          }),
        });
      },
    );

    await this.page.route(uploadUrl, async (route) => {
      // The mocked upload URL is a different origin from the app, and the
      // real upload sets a custom Content-Type header, so the browser issues
      // a CORS preflight (OPTIONS) before the actual PUT — Playwright's
      // interception happens at the network layer, but the BROWSER still
      // enforces CORS on the (mocked) response, so both legs need explicit
      // CORS headers or axios's PUT rejects with a network error regardless
      // of the mocked status code.
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'PUT, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      };
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }
      if (s3DelayMs > 0) await new Promise((r) => setTimeout(r, s3DelayMs));
      if (outcome === 's3-error') {
        await route.fulfill({
          status: 500,
          headers: corsHeaders,
          body: 'e2e mock: s3 put failure',
        });
        return;
      }
      await route.fulfill({ status: 200, headers: corsHeaders, body: '' });
    });

    return { uploadUrl, fileId, fileKey };
  }
}
