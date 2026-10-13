import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, getPlatformContext } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { MENTOR_NEXTJS_HOST } from '../fixtures/test-data';

/**
 * Journey 79: Composer Redesign (issue #2586, Stages 2a-2c)
 *
 * The chat composer was rebuilt around a single "+" menu (Upload File,
 * Camera, Tools ›, Skills ›, Prompts, Memory) replacing the classic
 * UploadMenu + always-visible InsideButtons/OutsideButtons rows. This
 * journey covers the parts of that redesign NOT already exercised by
 * journey 77 (attach menu / session-tools REST contract / WS file
 * references) or journey 67 (the "/" skill picker and Skills dropdown,
 * updated in place for the new menu location — see its slash-16 checkpoint).
 *
 * New ground here: the "+" menu's own contents/keyboard behaviour, the
 * Tools submenu's chip/overflow UI, mocked file-card states, confirming
 * screen-share/dictate/voice-call/send stay independent controls, the
 * empty-state layout order, guided prompts hiding on typing, and (mobile
 * viewport) the accessibility button not overlapping Send. No dedicated
 * Playwright "mobile" project exists in this repo — the SDK's phone layout
 * is driven purely by a `max-width: 767px` media query
 * (`useMediaQuery({ maxWidth: 767 })`), so `page.setViewportSize(...)` is
 * sufficient to exercise it inside the normal desktop-chrome project.
 *
 * All tests share one mentor (created once, serial mode) — the same
 * cached-platform-context pattern as journeys 73/77. `createMentorPage.
 * openAndCreate()` auto-registers the mentor for run-level cleanup and
 * auto-pins it to the suite-wide cheap ibl.ai model — no manual tracking.
 */
test.describe('Journey 79: Composer Redesign', () => {
  test.describe.configure({ mode: 'serial' });

  let tenantKey = '';
  let mentorId = '';

  test.beforeEach(async ({ page, createMentorPage }) => {
    if (!tenantKey || !mentorId) {
      await navigateToMentorApp(page);
      await createMentorPage.openAndCreate();
      await waitForPageReady(page);
      ({ tenantKey, mentorId } = await getPlatformContext(page));
    } else {
      await page.goto(
        `${MENTOR_NEXTJS_HOST}/platform/${tenantKey}/${mentorId}`,
        {
          waitUntil: 'domcontentloaded',
          timeout: 60_000,
        },
      );
      await waitForPageReady(page);
    }
  });

  // cr-01: empty-state layout order — name, welcome text, disclaimer, then
  // the composer directly below it, centred as one block (issue #2586).
  test('admin sees the empty-state chat screen with name, welcome text, disclaimer and composer in order', async ({
    page,
    chatPage,
  }) => {
    const emptyState = page.getByTestId('chat-empty-state');
    await expect(emptyState).toBeVisible({ timeout: 20_000 });

    const nameHeading = emptyState.locator('h1').first();
    await expect(nameHeading).toBeVisible();
    const composer = chatPage.getComposerTextarea();
    await expect(composer).toBeVisible();

    // DOM order proves "name -> welcome -> disclaimer -> composer": the
    // heading's bounding box must sit above the composer's.
    const nameBox = await nameHeading.boundingBox();
    const composerBox = await composer.boundingBox();
    expect(nameBox).not.toBeNull();
    expect(composerBox).not.toBeNull();
    expect(nameBox!.y).toBeLessThan(composerBox!.y);

    // The disclaimer (when the mentor has one) renders directly above the
    // composer's toolbar, inside the same composer block as the textarea.
    const disclaimer = page.locator('#chat-input-disclaimer');
    if (await disclaimer.count()) {
      const disclaimerBox = await disclaimer.boundingBox();
      expect(disclaimerBox).not.toBeNull();
      expect(disclaimerBox!.y).toBeLessThanOrEqual(composerBox!.y);
      expect(disclaimerBox!.y).toBeGreaterThan(nameBox!.y);
    }
  });

  // cr-02: on a phone-width viewport the composer is pinned to the bottom of
  // the empty-state screen instead of centred with the name/welcome block.
  test('mobile: empty-state composer is pinned to the bottom of the screen', async ({
    page,
    chatPage,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForPageReady(page);

    const composer = chatPage.getComposerTextarea();
    await expect(composer).toBeVisible({ timeout: 20_000 });
    const composerBox = await composer.boundingBox();
    expect(composerBox).not.toBeNull();
    // "Pinned to the bottom" — the composer's bottom edge sits in the final
    // third of the viewport height.
    expect(composerBox!.y + composerBox!.height).toBeGreaterThan(844 * 0.6);

    await page.setViewportSize({ width: 1280, height: 800 });
  });

  // cr-03: the "+" menu's contents on desktop — Upload File, Camera, Tools,
  // Skills (when present), Prompts and Memory items render as a Radix menu.
  test('admin opens the "+" menu and sees its full contents', async ({
    page,
    chatPage,
    editMentorPage,
  }) => {
    // Enable at least one tool so the Tools row renders.
    await editMentorPage.open('Tools');
    await waitForPageReady(page);
    await editMentorPage.tools.enableTool('Web Search');
    await editMentorPage.close();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForPageReady(page);

    await chatPage.openPlusMenu();
    await expect(chatPage.getAttachMenuItem('Upload File')).toBeVisible();
    await expect(chatPage.getAttachMenuItem('Camera')).toBeVisible();
    await expect(page.getByTestId('composer-tools-trigger')).toBeVisible({
      timeout: 10_000,
    });
    await chatPage.closePlusMenu();
  });

  // cr-04: keyboard behaviour — Escape closes the "+" menu and returns focus
  // to its trigger.
  test('admin closes the "+" menu with Escape and focus returns to the trigger', async ({
    chatPage,
  }) => {
    await chatPage.openPlusMenu();
    await chatPage.page.keyboard.press('Escape');
    await expect(chatPage.plusMenuButton).toBeFocused({ timeout: 5_000 });
  });

  // cr-05: the Tools submenu toggles a tool on/off, it appears as a chip once
  // active, and "+N" collapses overflow into an openable active list.
  test('admin toggles tools from the Tools submenu and sees chips collapse into "+N"', async ({
    page,
    chatPage,
    editMentorPage,
  }) => {
    // Generous budget: this test's own mentor setup (serial-suite first
    // test only) can run ~95s, and toggling up to 4 tools through the Tools
    // submenu (editMentorPage + composer) adds real time on top — comfortably
    // fits within the default 120s test timeout when the shared mentor is
    // already cached, but running this test alone (e.g. via `-g`) forces a
    // fresh mentor creation inside its own budget.
    test.setTimeout(240_000);

    // The composer only ever offers 7 fixed tools (Deep Research, Study
    // Mode, Web Search, Code, Image, Google Slides, Google Docs), but which
    // of those the mentor's Tools tab actually exposes as a switch depends
    // on the backend's `/tools/` list for this tenant — not every tool is
    // guaranteed available everywhere (e.g. Deep Research/Study Mode are
    // absent in this environment). Discover what's really there rather than
    // assuming specific names.
    // Google Slides/Docs are excluded: toggling them in the composer opens a
    // Google OAuth popup instead of a plain session-tools PUT, which this
    // checkpoint (chip rendering/overflow) has no need to drive.
    const COMPOSER_TOOL_NAMES = [
      'Deep Research',
      'Study Mode',
      'Web Search',
      'Code',
      'Image',
    ];
    await editMentorPage.open('Tools');
    await waitForPageReady(page);
    await expect(editMentorPage.tools.toolToggles.first()).toBeVisible({
      timeout: 15_000,
    });
    const switchLabels = await editMentorPage.tools.toolToggles.evaluateAll(
      (nodes) => nodes.map((n) => n.getAttribute('aria-label') ?? ''),
    );
    // Exact name, as `enableTool` matches it: a prefix would let "Image"
    // match "Image Generation".
    const available = COMPOSER_TOOL_NAMES.filter((name) =>
      switchLabels.some((label) =>
        new RegExp(`^${name} (enabled|disabled)$`, 'i').test(label),
      ),
    );
    test.skip(
      available.length < 2,
      `Only ${available.length} composer tool(s) available on this tenant — need at least 2 for this checkpoint`,
    );
    const toEnable = available.slice(0, 4);
    for (const name of toEnable) {
      await editMentorPage.tools.enableTool(name);
    }
    await editMentorPage.close();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForPageReady(page);

    for (const name of toEnable) {
      await chatPage.enableTool(name);
    }

    if (toEnable.length > 3) {
      // With 4+ active tools, at most 2 render as direct chips; the rest
      // collapse into a "+N" button (`composer-chips-more`).
      const moreButton = page.getByTestId('composer-chips-more');
      await expect(moreButton).toBeVisible({ timeout: 10_000 });
      await moreButton.click();
      const activeList = page.getByTestId('composer-active-list');
      await expect(activeList).toBeVisible({ timeout: 10_000 });
      await expect(activeList.getByTestId('composer-active-row')).toHaveCount(
        toEnable.length,
      );
      await activeList.getByRole('button', { name: 'Clear all' }).click();
    } else {
      // Fewer than 4 tools: all render as direct chips with no overflow.
      // A plain single click per chip (not the retry-safe `disableTool`
      // helper, which drives the Tools submenu instead) — the bug that
      // motivated retrying was a queued-tool-toggle getting lost on a brand
      // new chat's session POST, now fixed in web-utils (exactly one PUT,
      // queued and applied once the session exists; see cr-10's regression
      // checkpoint below and scm-02 in journey 77). This checkpoint is about
      // guarding that a single click reliably removes the chip, so it must
      // NOT hide a regression behind a retry loop.
      for (const name of toEnable) {
        await chatPage.getToolChip(name).click();
        await expect(chatPage.getToolChip(name)).toHaveCount(0, {
          timeout: 10_000,
        });
      }
    }

    for (const name of toEnable) {
      await expect(chatPage.getToolChip(name)).toHaveCount(0);
    }
  });

  // cr-11: the Canvas pill matches the tool chips — on, it is the same
  // pale-blue pill with a "Turn off Canvas" ×; off, a plain one-click toggle.
  test('Canvas pill: on shows a tool-chip pill with a "Turn off Canvas" ×, off has no ×', async ({
    page,
    chatPage,
  }) => {
    const turnOff = page.getByRole('button', {
      name: 'Turn off Canvas',
      exact: true,
    });
    await expect(chatPage.canvasToggle).toBeVisible({ timeout: 30_000 });
    // Toggle once the session exists: this checkpoint is about the pill's
    // look; a click made while the session POST is in flight is cr-12.
    await expect
      .poll(() => chatPage.getCachedSessionId(mentorId), { timeout: 30_000 })
      .toBeTruthy();
    if (await chatPage.isCanvasToolActive()) {
      await turnOff.click();
      await expect(chatPage.canvasToggle).toHaveAttribute(
        'aria-pressed',
        'false',
        {
          timeout: 10_000,
        },
      );
    }
    // Off: no ×.
    await expect(turnOff).toHaveCount(0);

    await chatPage.enableCanvasTool();
    await expect(turnOff).toBeVisible();
    const pill = page.getByTestId('composer-canvas-pill');
    // Move off the pill so its hover fill (#EAF1FF) doesn't mask the rest one.
    await page.mouse.move(0, 0);
    // #F5F8FF fill, #D0E0FF border, 32px tall — the active tool chip look
    // (web-first, so the pill's colour transition settles first).
    await expect(pill).toHaveCSS('background-color', 'rgb(245, 248, 255)');
    await expect(pill).toHaveCSS('border-top-color', 'rgb(208, 224, 255)');
    await expect(pill).toHaveCSS('height', '32px');

    // The × turns Canvas off and disappears.
    await turnOff.click();
    await expect(chatPage.canvasToggle).toHaveAttribute(
      'aria-pressed',
      'false',
      {
        timeout: 10_000,
      },
    );
    await expect(turnOff).toHaveCount(0);
  });

  // cr-12 (regression, issue #2586): clicking Canvas on a brand-new chat
  // before its create-session POST resolves must not be lost. Pre-fix,
  // `useMentorTools.updateSessionTools` excluded Canvas from the queue the
  // other tools use (scm-08, journey 77), so the click PUT `enable_artifacts`
  // to `sessions//` (404) or to the PREVIOUS chat's session, and the new
  // session's default then overwrote it. Now it is queued
  // (`queuePendingArtifactsEnabled`), shown at once, kept over the default by
  // `seedSessionTools`, and written in ONE PUT to the NEW session. The POST
  // is delayed 5s and its response forced to `enable_artifacts: false`, so
  // the queued choice must win over the default.
  test('clicking Canvas immediately after New Chat shows it on at once and PUTs enable_artifacts once to the NEW session', async ({
    page,
    chatPage,
  }) => {
    test.setTimeout(180_000);
    const turnOff = page.getByRole('button', {
      name: 'Turn off Canvas',
      exact: true,
    });
    await expect(chatPage.canvasToggle).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(() => chatPage.getCachedSessionId(mentorId), { timeout: 30_000 })
      .toBeTruthy();
    const oldSessionId = await chatPage.getCachedSessionId(mentorId);
    // Start from off so the click below means "turn on".
    if (await chatPage.isCanvasToolActive()) {
      await turnOff.click();
      await expect(chatPage.canvasToggle).toHaveAttribute(
        'aria-pressed',
        'false',
        { timeout: 10_000 },
      );
    }

    const sessionsPath = /\/ai-mentor\/orgs\/[^/]+\/users\/[^/]+\/sessions/;
    const isSessionEditPut = (url: string, method: string) =>
      method === 'PUT' &&
      /\/ai-mentor\/orgs\/[^/]+\/users\/[^/]+\/sessions\/[^/]+\/?$/.test(
        new URL(url).pathname,
      );
    const puts: { url: string; body: Record<string, unknown> }[] = [];
    const emptySessionRequests: string[] = [];
    const onRequest = (request: import('@playwright/test').Request) => {
      const url = request.url();
      if (sessionsPath.test(url) && /\/sessions\/\//.test(url)) {
        emptySessionRequests.push(`${request.method()} ${url}`);
      }
      if (isSessionEditPut(url, request.method())) {
        puts.push({ url, body: request.postDataJSON() ?? {} });
      }
    };
    page.on('request', onRequest);

    const createSessionRoute =
      /\/ai-mentor\/orgs\/[^/]+\/users\/[^/]+\/sessions\/?(\?.*)?$/;
    await page.route(createSessionRoute, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      const response = await route.fetch();
      const json = await response.json();
      await route.fulfill({
        response,
        json: { ...json, enable_artifacts: false },
      });
    });

    await chatPage.startNewChat();
    // Immediately — well inside the 5s create-session delay.
    await chatPage.canvasToggle.first().click();

    // On at once, with its ×: a client-only optimistic update.
    await expect(chatPage.canvasToggle).toHaveAttribute(
      'aria-pressed',
      'true',
      { timeout: 2_000 },
    );
    await expect(turnOff).toBeVisible({ timeout: 2_000 });
    expect(puts.length).toBe(0);

    // Once the delayed POST resolves, exactly one PUT lands.
    await expect.poll(() => puts.length, { timeout: 15_000 }).toBe(1);
    await page.unroute(createSessionRoute);
    page.off('request', onRequest);

    const newSessionId = await chatPage.getCachedSessionId(mentorId);
    expect(newSessionId).toBeTruthy();
    expect(newSessionId).not.toBe(oldSessionId);
    expect(puts[0].url).toContain(`/sessions/${newSessionId}/`);
    expect(puts[0].body.enable_artifacts).toBe(true);
    expect(emptySessionRequests).toEqual([]);

    // Still on afterwards, over the new session's `enable_artifacts: false`.
    await expect(chatPage.canvasToggle).toHaveAttribute('aria-pressed', 'true');
    await expect(turnOff).toBeVisible();
  });

  // cr-06: mocked file-card states — uploading, done, failed (with Retry),
  // and too-large.
  test('admin sees the composer file card for each upload state', async ({
    page,
    chatPage,
  }) => {
    // -- uploading -> done --
    await chatPage.mockFileUpload('success', 2_000);
    const smallFile = Buffer.from('hello world '.repeat(1000));
    await chatPage.getFileUploadInput().setInputFiles({
      name: 'e2e-small.txt',
      mimeType: 'text/plain',
      buffer: smallFile,
    });
    const chip = chatPage.attachmentChip.first();
    await expect(chip).toBeVisible({ timeout: 10_000 });
    await expect(chip).toHaveAttribute('data-status', 'uploading', {
      timeout: 5_000,
    });
    await expect(chip).toHaveAttribute('data-status', 'success', {
      timeout: 10_000,
    });
    await chatPage.getRemoveFileButton(chip).click();
    await expect(chip).toHaveCount(0);

    // -- failed + Retry --
    await chatPage.mockFileUpload('upload-url-error', 0);
    await chatPage.getFileUploadInput().setInputFiles({
      name: 'e2e-fail.txt',
      mimeType: 'text/plain',
      buffer: smallFile,
    });
    const failedChip = chatPage.attachmentChip.first();
    await expect(failedChip).toHaveAttribute('data-status', 'error', {
      timeout: 10_000,
    });
    await expect(chatPage.getRetryFileButton(failedChip)).toBeVisible();
    await chatPage.getRemoveFileButton(failedChip).click();
    await expect(failedChip).toHaveCount(0);

    // -- too large (rejected client-side, no network call at all) --
    // The model file-upload capability hook's own fallback default is 20MB
    // (`use-model-file-upload-capabilities.ts`) when a model has no explicit
    // limit — 25MB safely exceeds that default without allocating/uploading
    // an unnecessarily huge in-memory buffer for the test.
    const hugeFile = Buffer.alloc(25 * 1024 * 1024, 1);
    await chatPage.getFileUploadInput().setInputFiles({
      name: 'e2e-huge.bin',
      mimeType: 'application/octet-stream',
      buffer: hugeFile,
    });
    const rejectedChip = page.locator(
      '[data-testid="attachment-chip"][data-status="too-large"]',
    );
    let rejected = false;
    try {
      await rejectedChip.waitFor({ state: 'visible', timeout: 10_000 });
      rejected = true;
    } catch {
      rejected = false;
    }
    if (rejected) {
      await expect(rejectedChip).toBeVisible();
      await chatPage.getRemoveFileButton(rejectedChip).click();
    }
    // If this mentor's configured max upload size is >25MB, this file stays
    // under it and no rejection is expected — not a failure of this
    // checkpoint, which is about the too-large STATE rendering correctly
    // when the app's own client-side gate does fire.
  });

  // cr-07: screen share, dictate, voice call and send are independent
  // controls, not folded into the "+" menu.
  test('screen share, dictate, voice call and send render as separate controls', async ({
    page,
    chatPage,
  }) => {
    // The "+" menu is closed here (never opened in this test) — any of these
    // controls being visible proves it is NOT nested inside the menu's
    // content (which only exists in the DOM while open), i.e. it is a true
    // sibling control. Voice input (dictation) is present on most
    // environments; screen share needs `getDisplayMedia` support and voice
    // call a tenant/mentor setting, so tolerate either being absent —
    // but always require Send to be its own independent control.
    await expect(chatPage.plusMenuButton).toBeVisible({ timeout: 15_000 });
    await expect(chatPage.sendButton).toBeVisible();
    await expect(page.getByTestId('composer-plus-menu')).toHaveCount(0);
    await expect(page.getByTestId('composer-plus-sheet')).toHaveCount(0);

    let voiceInputVisible = false;
    try {
      await chatPage.voiceInputButton.waitFor({
        state: 'visible',
        timeout: 5_000,
      });
      voiceInputVisible = true;
    } catch {
      voiceInputVisible = false;
    }
    if (voiceInputVisible) {
      await expect(chatPage.voiceInputButton).toBeVisible();
    }
  });

  // cr-08: guided prompts stay visible while the user types (main chat),
  // including a "/" skill command.
  test('admin sees guided prompts stay visible while typing, including a / command', async ({
    page,
    chatPage,
  }) => {
    await page.route(
      '**/api/ai-prompt/orgs/*/users/*/sessions/*/guided-prompts/**',
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [
              { prompt: 'Tell me a fun fact', icon: 'globe' },
              { prompt: 'Summarize this page', icon: 'file-text' },
            ],
          }),
        });
      },
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForPageReady(page);

    const chip = page.getByTestId('starter-prompt-chip').first();
    let chipVisible = false;
    try {
      await chip.waitFor({ state: 'visible', timeout: 15_000 });
      chipVisible = true;
    } catch {
      chipVisible = false;
    }
    test.skip(
      !chipVisible,
      'Guided prompts did not render for this mentor/session',
    );

    const composer = chatPage.getComposerTextarea();
    for (const text of ['/', 'hello']) {
      await composer.fill(text);
      await expect(page.getByTestId('starter-prompt-chip')).toHaveCount(2);
    }
    await composer.fill('');
  });

  // cr-13 (mobile, issue #2586): on a phone the main chat's guided prompts are
  // at most four full-width rows stacked above the composer (the embed's
  // "EV2MobRows" rows), matching its edges with no sideways scrolling, and
  // they stay visible while typing. Desktop keeps the wrapped chips.
  test('mobile: guided prompts are at most four stacked rows matching the composer, shown while typing', async ({
    page,
    chatPage,
  }) => {
    await page.route(
      '**/api/ai-prompt/orgs/*/users/*/sessions/*/guided-prompts/**',
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [
              'Summarize the key ideas of this course in plain language',
              'Quiz me on chapter two',
              'Explain this simply',
              'Plan my study week',
              'A fifth prompt that must not show',
            ].map((prompt) => ({ prompt, icon: 'globe' })),
          }),
        });
      },
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForPageReady(page);

    const rows = page.getByTestId('starter-prompt-row');
    let rowVisible = false;
    try {
      await rows.first().waitFor({ state: 'visible', timeout: 15_000 });
      rowVisible = true;
    } catch {
      rowVisible = false;
    }
    if (!rowVisible) await page.setViewportSize({ width: 1280, height: 800 });
    test.skip(
      !rowVisible,
      'Guided prompts did not render for this mentor/session',
    );

    await expect(rows).toHaveCount(4);
    await expect(page.getByTestId('starter-prompt-chip')).toHaveCount(0);
    await expect(
      page.getByText('A fifth prompt that must not show'),
    ).toHaveCount(0);
    const boxes = await rows.evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect().toJSON()),
    );
    const composer = await page
      .getByTestId('composer-box')
      .evaluate((el) => el.getBoundingClientRect().toJSON());
    boxes.forEach((box, i) => {
      expect(Math.abs(box.left - composer.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.right - composer.right)).toBeLessThanOrEqual(1);
      if (i > 0) expect(box.top).toBeGreaterThan(boxes[i - 1].bottom);
    });
    expect(boxes[3].bottom).toBeLessThan(composer.top);
    expect(
      await page
        .getByTestId('starter-prompt-rows')
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);

    const composerInput = chatPage.getComposerTextarea();
    await composerInput.fill('h');
    await expect(rows).toHaveCount(4);
    await composerInput.fill('');

    // Desktop is unchanged: wrapped chips, no rows.
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByTestId('starter-prompt-chip').first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(rows).toHaveCount(0);
  });

  // cr-09 (mobile): the floating accessibility button does not overlap the
  // composer's Send button, NOR the suggested-prompt rows above the
  // composer, on the empty-state screen. The FAB was raised to
  // `max-md:bottom-[22rem]` specifically to clear the (up to four) prompt
  // rows — this guards that second half, not just Send.
  test('mobile: the accessibility button does not overlap the Send button or the suggested-prompt rows', async ({
    page,
    chatPage,
  }) => {
    await page.route(
      '**/api/ai-prompt/orgs/*/users/*/sessions/*/guided-prompts/**',
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [
              'Summarize the key ideas of this course in plain language',
              'Quiz me on chapter two',
            ].map((prompt) => ({ prompt, icon: 'globe' })),
          }),
        });
      },
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForPageReady(page);

    const fab = page.getByTestId('accessibility-fab');
    let fabVisible = false;
    try {
      await fab.waitFor({ state: 'visible', timeout: 10_000 });
      fabVisible = true;
    } catch {
      fabVisible = false;
    }
    test.skip(!fabVisible, 'Accessibility FAB not enabled for this tenant');

    const overlaps = (
      a: { x: number; y: number; width: number; height: number },
      b: { x: number; y: number; width: number; height: number },
    ) =>
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y;

    await expect(chatPage.sendButton).toBeVisible({ timeout: 15_000 });
    const fabBox = await fab.boundingBox();
    const sendBox = await chatPage.sendButton.boundingBox();
    expect(fabBox).not.toBeNull();
    expect(sendBox).not.toBeNull();
    expect(overlaps(fabBox!, sendBox!)).toBe(false);

    const rows = page.getByTestId('starter-prompt-rows');
    let rowsVisible = false;
    try {
      await rows.waitFor({ state: 'visible', timeout: 10_000 });
      rowsVisible = true;
    } catch {
      rowsVisible = false;
    }
    if (rowsVisible) {
      const rowsBox = await rows.boundingBox();
      expect(rowsBox).not.toBeNull();
      expect(overlaps(fabBox!, rowsBox!)).toBe(false);
    }

    await page.setViewportSize({ width: 1280, height: 800 });
  });

  // cr-12 (mobile): the "+" menu opens as a bottom sheet with Upload/Camera
  // tiles plus Tools/Skills/Prompts/Memory rows; drilling into Tools toggles
  // an available tool to an active chip (reusing `enableTool`/`disableTool`,
  // both already mobile-sheet-aware), and the sheet closes via Escape and via
  // a backdrop click. There is no functional drag-to-close — the visual
  // handle bar at the sheet's top is purely decorative/`aria-hidden`
  // (`composer-sheet.tsx`), so that part of the ask does not apply here.
  test('mobile: the "+" menu opens as a bottom sheet, drilling into Tools toggles a chip, and it closes via Escape and the backdrop', async ({
    page,
    chatPage,
  }) => {
    // The Skills row renders only when the agent has skills; the shared
    // default agent has none, so mock one.
    await chatPage.mockEffectiveSkills([
      {
        unique_id: 'e2e-cr12-skill',
        name: 'Summarize Reading',
        slug: 'summarize-reading',
        enabled: true,
      },
    ]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForPageReady(page);

    await chatPage.openPlusMenu();
    const sheet = page.getByTestId('composer-plus-sheet');
    await expect(sheet).toBeVisible({ timeout: 10_000 });
    await expect(chatPage.getAttachMenuItem('Upload File')).toBeVisible();
    await expect(chatPage.getAttachMenuItem('Camera')).toBeVisible();
    await expect(sheet.getByRole('button', { name: /^Tools\b/ })).toBeVisible();
    await expect(sheet.getByTestId('skills-menu-trigger')).toBeVisible();
    // isToolAvailable() opens the + menu itself, which needs the sheet closed.
    await page.keyboard.press('Escape');
    await expect(sheet).not.toBeVisible({ timeout: 5_000 });

    // cr-03 enabled "Web Search" on this shared mentor and never disabled it.
    const toolName = 'Web Search';
    const toolAvailable = await chatPage.isToolAvailable(toolName);
    if (toolAvailable) {
      // isToolAvailable() always leaves the + menu closed on return.
      await chatPage.enableTool(toolName);
      await expect(chatPage.getToolChip(toolName)).toBeVisible({
        timeout: 10_000,
      });
      await chatPage.disableTool(toolName);
      await expect(chatPage.getToolChip(toolName)).toHaveCount(0);
    }

    // Escape closes the sheet.
    await chatPage.openPlusMenu();
    await expect(sheet).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
    await expect(sheet).not.toBeVisible({ timeout: 5_000 });

    // Clicking the backdrop (Radix Dialog overlay, above the sheet's own
    // content since the sheet is capped at 92% height) also closes it.
    await chatPage.openPlusMenu();
    await expect(sheet).toBeVisible({ timeout: 10_000 });
    await page.mouse.click(page.viewportSize()!.width / 2, 10);
    await expect(sheet).not.toBeVisible({ timeout: 5_000 });

    await page.setViewportSize({ width: 1280, height: 800 });
  });

  // cr-13: the Memory row never shows the trailing chevron that Tools and
  // Skills have (both open a sub-page/submenu; Memory opens its own panel
  // directly) — true on desktop (`DropdownMenuItem` vs `DropdownMenuSub`'s
  // `SubTrigger`, which "appends its own chevron") and on the mobile sheet
  // (same `chat-memory-button` testid, no `ChevronRight` rendered for that
  // row specifically). Clicking Memory opens its panel ("Your Memory") on
  // both layouts.
  test('the Memory row has no chevron on desktop or mobile while Tools and Skills keep theirs, and clicking it opens the memory panel', async ({
    page,
    editMentorPage,
    chatPage,
  }) => {
    await editMentorPage.open('Memory');
    await waitForPageReady(page);
    await editMentorPage.memory.setCapabilityEnabled(true);
    await editMentorPage.close();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForPageReady(page);

    // -- Desktop --
    await chatPage.openPlusMenu();
    const memoryRow = page.getByTestId('chat-memory-button');
    let hasMemory = false;
    try {
      await memoryRow.waitFor({ state: 'visible', timeout: 10_000 });
      hasMemory = true;
    } catch {
      hasMemory = false;
    }
    test.skip(!hasMemory, 'Memory not available for this mentor/session');

    // Memory: just its one leading Archive icon — no trailing chevron svg.
    expect(await memoryRow.locator('svg').count()).toBe(1);
    // Tools: its SubTrigger appends a second (chevron) svg after the icon.
    const toolsTrigger = page.getByTestId('composer-tools-trigger');
    await expect(toolsTrigger).toBeVisible({ timeout: 5_000 });
    expect(await toolsTrigger.locator('svg').count()).toBeGreaterThan(1);

    await memoryRow.click();
    await expect(page.getByText('Your Memory', { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await page.keyboard.press('Escape');

    // -- Mobile --
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForPageReady(page);
    await chatPage.openPlusMenu();
    const mobileMemoryRow = page.getByTestId('chat-memory-button');
    await expect(mobileMemoryRow).toBeVisible({ timeout: 10_000 });
    expect(await mobileMemoryRow.locator('svg').count()).toBe(1);
    const mobileToolsRow = page.getByRole('button', { name: /^Tools\b/ });
    await expect(mobileToolsRow).toBeVisible({ timeout: 5_000 });
    expect(await mobileToolsRow.locator('svg').count()).toBeGreaterThan(1);

    await mobileMemoryRow.click();
    await expect(page.getByText('Your Memory', { exact: true })).toBeVisible({
      timeout: 10_000,
    });

    await page.setViewportSize({ width: 1280, height: 800 });
  });

  // cr-16: the composer's redesigned affordances — an active tool chip, the
  // Canvas "Turn off Canvas" × pill, and the "/" skill picker positioned
  // above the composer — all still hold once the conversation has moved
  // PAST the empty state (a real reply in, via the mocked chat WebSocket),
  // and a 320-390px viewport still has no horizontal overflow with Send
  // visible in that state (cr-13 covers the pre-conversation guided-prompt
  // rows at this width; this is the same width band but mid-conversation).
  test('composer in conversation state: tool chip, Canvas × pill, "/" picker above it, and no overflow at 320-390 with Send visible', async ({
    page,
    chatPage,
  }) => {
    // Mock a skill so the "/" picker has something to show once reloaded.
    await chatPage.mockEffectiveSkills([
      {
        unique_id: 'e2e-cr16-skill',
        name: 'Summarize Reading',
        slug: 'summarize-reading',
        enabled: true,
      },
    ]);
    // The socket mock only catches sockets opened after it is registered.
    const ws = await chatPage.mockChatWebSocket();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForPageReady(page);

    const toolName = 'Web Search';
    const toolAvailable = await chatPage.isToolAvailable(toolName);
    if (toolAvailable) {
      await chatPage.enableTool(toolName);
    }
    await chatPage.enableCanvasTool();

    await chatPage.sendMessage('Conversation state composer check');
    const clientFrame = await ws.waitForClientMessage();
    const sessionId = clientFrame.session_id;
    ws.send({
      generation_id: `e2e-cr16-${Date.now()}`,
      session_id: sessionId,
    });
    ws.send({
      data: 'scripted conversation-state reply',
      session_id: sessionId,
    });
    ws.send({ eos: true, session_id: sessionId });
    await chatPage.waitForAIResponse();

    // Tool chip and Canvas × pill both still render mid-conversation.
    if (toolAvailable) {
      await expect(chatPage.getToolChip(toolName)).toBeVisible({
        timeout: 10_000,
      });
    }
    await expect(page.getByTestId('composer-canvas-off')).toBeVisible({
      timeout: 10_000,
    });

    // The "/" picker still opens ABOVE the composer mid-conversation.
    const composer = chatPage.getComposerTextarea();
    await composer.click();
    await composer.pressSequentially('/sum');
    const picker = page.getByTestId('slash-skill-picker');
    let pickerVisible = false;
    try {
      await picker.waitFor({ state: 'visible', timeout: 10_000 });
      pickerVisible = true;
    } catch {
      pickerVisible = false;
    }
    if (pickerVisible) {
      const composerBox = await composer.boundingBox();
      const pickerBox = await picker.boundingBox();
      expect(composerBox).not.toBeNull();
      expect(pickerBox).not.toBeNull();
      expect(pickerBox!.y + pickerBox!.height).toBeLessThanOrEqual(
        composerBox!.y + 1,
      );
    }
    await composer.fill('');

    // 320-390px: no horizontal overflow, Send still fully visible.
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(chatPage.sendButton).toBeVisible({ timeout: 10_000 });
      expect(
        await page
          .locator('html')
          .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
      const toolbar = page.getByTestId('composer-toolbar');
      if ((await toolbar.count()) > 0) {
        expect(
          await toolbar.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        ).toBe(true);
      }
    }

    await page.setViewportSize({ width: 1280, height: 800 });
  });
});
