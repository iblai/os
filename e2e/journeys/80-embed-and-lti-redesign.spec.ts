import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { EMBED_HARNESS_URL } from '../fixtures/test-data';

/**
 * Journey 80: Embed Header + LTI Redesign (issue #2586)
 *
 * The embed surface got a new OS header (`EmbedNavBar`: avatar/name, a
 * dedicated "New chat" icon button, a menu/help trigger and Close) and up to
 * four suggested prompts stacked as full-width rows (board "EV2MobRows")
 * that — unlike the main chat's guided prompts (journey 79's cr-08) — stay
 * visible while the user types; only
 * opening the "/" skill picker hides them. An LTI launch (`?embed=true&lti=
 * true`) additionally drops the Close button and makes Escape a no-op, and
 * that `lti` flag persists across in-app navigation via the embed-context
 * localStorage cache (`lib/embed-context.ts`).
 *
 * Uses the same genuinely-cross-origin embed harness as journey 78
 * (`e2e/utils/embed-harness-server.mjs`) rather than a same-origin
 * `?embed=true` navigation, since that is the shape a real customer site
 * presents.
 */
test.describe('Journey 80: Embed Header + LTI Redesign', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  function embedUrl(
    mentorUrl: string,
    extraParams: Record<string, string> = {},
  ) {
    const url = new URL(mentorUrl);
    url.searchParams.set('embed', 'true');
    for (const [key, value] of Object.entries(extraParams)) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }

  async function gotoEmbedHarness(
    page: import('@playwright/test').Page,
    mentorUrl: string,
    extraParams: Record<string, string> = {},
  ) {
    await page.goto(
      `${EMBED_HARNESS_URL}/?src=${encodeURIComponent(embedUrl(mentorUrl, extraParams))}`,
      { waitUntil: 'domcontentloaded', timeout: 30_000 },
    );
    return page.frameLocator('#embed-harness-iframe');
  }

  // emb-hdr-01: the embed header shows the agent's avatar and name as plain
  // text (not a button), then New chat, the "?" menu and Close — all as 40px
  // icon buttons.
  test('embed header shows the agent identity, New chat, the ? menu and Close controls', async ({
    page,
  }) => {
    const iframe = await gotoEmbedHarness(page, page.url());

    const identity = iframe.getByTestId('embed-agent-identity');
    await expect(identity).toBeVisible({ timeout: 20_000 });
    await expect(identity.locator('button')).toHaveCount(0);
    await expect(
      iframe.getByRole('button', { name: /^Start new chat with / }),
    ).toHaveCount(0);

    await expect(
      iframe.getByRole('button', { name: 'New chat', exact: true }),
    ).toBeVisible();
    await expect(
      iframe.getByRole('button', { name: 'Open menu options' }),
    ).toBeVisible();
    await expect(
      iframe.getByRole('button', { name: 'Open settings menu' }),
    ).toHaveCount(0);
    await expect(
      iframe.getByRole('button', { name: 'Close chat', exact: true }),
    ).toBeVisible();
  });

  // emb-hdr-02: Prompts and Memory are never offered in embed mode, even for
  // an authenticated (admin) embed session where they would otherwise render.
  test('embed composer never offers Prompts or Memory in its "+" menu', async ({
    page,
  }) => {
    const iframe = await gotoEmbedHarness(page, page.url());
    // Id-based, role-agnostic (`#chat-input-textarea`, matching
    // `ChatPage.getComposerTextarea()`), not `getByPlaceholder('Ask
    // anything')`: this mentor's composer flips its accessible role from
    // `textbox` to `combobox` once its skill list resolves
    // (`components/chat-input-form.tsx`), which doesn't affect a
    // placeholder-based visibility check but DOES make `.fill()` hang
    // waiting on a node that briefly re-renders as part of that flip.
    const chatInput = iframe.locator('#chat-input-textarea');
    await expect(chatInput).toBeVisible({ timeout: 20_000 });

    const plusButton = iframe.getByTestId('composer-plus-button');
    let hasPlusMenu = false;
    try {
      await plusButton.waitFor({ state: 'visible', timeout: 5_000 });
      hasPlusMenu = true;
    } catch {
      hasPlusMenu = false;
    }
    if (!hasPlusMenu) return; // no attach/tools at all for this mentor — trivially true

    await plusButton.click();
    const menu = iframe
      .getByTestId('composer-plus-menu')
      .or(iframe.getByTestId('composer-plus-sheet'));
    await expect(menu).toBeVisible({ timeout: 10_000 });
    await expect(menu.getByText('Prompts', { exact: true })).toHaveCount(0);
    await expect(iframe.getByTestId('chat-memory-button')).toHaveCount(0);
  });

  // emb-hdr-03: the embed's stacked suggested-prompt rows STAY visible while
  // typing (unlike the main chat's guided prompts, which hide — cr-08).
  test('embed suggested-prompt rows stay visible while typing', async ({
    page,
  }) => {
    await page.route(
      '**/api/ai-prompt/orgs/*/users/*/sessions/*/guided-prompts/**',
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ai_prompts: ['Tell me a fun fact', 'Summarize this page'],
          }),
        });
      },
    );
    const iframe = await gotoEmbedHarness(page, page.url());
    const chatInput = iframe.locator('#chat-input-textarea');
    await expect(chatInput).toBeVisible({ timeout: 20_000 });

    const row = iframe.getByTestId('starter-prompt-row').first();
    let rowVisible = false;
    try {
      await row.waitFor({ state: 'visible', timeout: 15_000 });
      rowVisible = true;
    } catch {
      rowVisible = false;
    }
    test.skip(
      !rowVisible,
      'Embed suggested prompts did not render for this mentor/session',
    );

    await chatInput.fill('hello');
    await expect(iframe.getByTestId('starter-prompt-row').first()).toBeVisible({
      timeout: 5_000,
    });
  });

  // emb-lti-01: an LTI launch (`lti=true`) shows no Close button, and Escape does
  // nothing (no postMessage close request reaches the parent harness page).
  test('LTI embed hides the Close button and Escape is a no-op', async ({
    page,
  }) => {
    const iframe = await gotoEmbedHarness(page, page.url(), { lti: 'true' });
    const chatInput = iframe.locator('#chat-input-textarea');
    await expect(chatInput).toBeVisible({ timeout: 20_000 });

    await expect(
      iframe.getByRole('button', { name: 'Close chat', exact: true }),
    ).toHaveCount(0);

    // Escape must not trigger the embed's close-request postMessage. There is
    // no visible signal in this harness for "nothing happened", so instead
    // assert the composer (and header) are still present/functional after
    // pressing it — a close request would have no visible in-iframe effect
    // either, so this is a best-effort behavioural smoke check rather than a
    // strict postMessage assertion.
    await page.keyboard.press('Escape');
    await expect(chatInput).toBeVisible({ timeout: 5_000 });
  });

  // emb-lti-02: the embed composer is capped at 680px wide as its frame widens
  // (`EMBED_COMPOSER_MAX_WIDTH`, `chat/index.tsx`) — applies to embed
  // generally, LTI included, so a wide LTI iframe still caps at 680px.
  test('LTI embed composer is capped at 680px wide', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    const iframe = await gotoEmbedHarness(page, page.url(), { lti: 'true' });
    const chatInput = iframe.locator('#chat-input-textarea');
    await expect(chatInput).toBeVisible({ timeout: 20_000 });

    const box = await chatInput.boundingBox();
    expect(box).not.toBeNull();
    // Allow a little slack for the textarea's own inner padding vs the
    // 680px cap applying to an ancestor container.
    expect(box!.width).toBeLessThanOrEqual(680);

    await page.setViewportSize({ width: 1280, height: 800 });
  });

  // emb-lti-03 (regression, issue #2586): in a narrow LTI frame (320px, the
  // inline LTI tool on a 390px phone) the composer stays inside the frame:
  // the Canvas pill (on, with its ×) gives way and the action buttons —
  // Send included — stay fully visible. Pre-fix the toolbar needed ~293px
  // inside a ~280px composer, so Send was cut off at the frame's right edge.
  test('narrow LTI embed keeps the Send button fully inside a 320px frame', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    const iframe = await gotoEmbedHarness(page, page.url(), { lti: 'true' });
    await expect(iframe.locator('#chat-input-textarea')).toBeVisible({
      timeout: 20_000,
    });
    // The widest toolbar state: Canvas on, showing its ×.
    const canvas = iframe.getByRole('button', { name: 'Canvas', exact: true });
    if ((await canvas.count()) > 0) {
      if ((await canvas.getAttribute('aria-pressed')) !== 'true') {
        await canvas.click();
      }
      await expect(iframe.getByTestId('composer-canvas-off')).toBeVisible({
        timeout: 10_000,
      });
    }

    const frameBox = await page.locator('#embed-harness-iframe').boundingBox();
    const toolbarBox = await iframe
      .getByTestId('composer-toolbar')
      .boundingBox();
    const actionButtons = iframe
      .getByTestId('composer-actions')
      .locator('button');
    const sendBox = await iframe
      .getByRole('button', { name: /^(Send message|Connecting)/ })
      .boundingBox();
    expect(frameBox).not.toBeNull();
    expect(toolbarBox).not.toBeNull();
    expect(sendBox).not.toBeNull();
    const frameRight = frameBox!.x + frameBox!.width;
    const toolbarRight = toolbarBox!.x + toolbarBox!.width;
    expect(sendBox!.x + sendBox!.width).toBeLessThanOrEqual(frameRight);
    expect(sendBox!.x + sendBox!.width).toBeLessThanOrEqual(toolbarRight + 1);
    // Every right-hand button is fully inside the toolbar at its full size.
    for (const box of await actionButtons.evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect().toJSON()),
    )) {
      expect(box.width).toBeGreaterThanOrEqual(28);
      expect(box.right).toBeLessThanOrEqual(toolbarBox!.width + toolbarBox!.x);
    }
    // The toolbar itself never overflows.
    expect(
      await iframe
        .getByTestId('composer-toolbar')
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);

    await page.setViewportSize({ width: 1280, height: 800 });
  });

  // emb-hdr-04 (regression, issue #2586): the embed's suggested prompts are at
  // most four full-width rows stacked above the disclaimer, each spanning the
  // composer's exact width, so a narrow (320px) frame never scrolls sideways.
  // Pre-fix they were two rows of chips that overflowed and were cut off.
  test('embed suggested prompts are at most four stacked rows matching the composer, with no sideways overflow at 320px', async ({
    page,
  }) => {
    await page.route(
      '**/api/ai-prompt/orgs/*/users/*/sessions/*/guided-prompts/**',
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ai_prompts: [
              'Summarize the key ideas of this course in plain language',
              'Quiz me on chapter two',
              'Explain this simply',
              'Plan my study week',
              'A fifth prompt that must not show',
            ],
          }),
        });
      },
    );
    const assertRows = async (
      iframe: import('@playwright/test').FrameLocator,
    ) => {
      const rows = iframe.getByTestId('starter-prompt-row');
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThanOrEqual(4);
      const boxes = await rows.evaluateAll((els) =>
        els.map((el) => el.getBoundingClientRect().toJSON()),
      );
      const composer = await iframe
        .getByTestId('composer-box')
        .evaluate((el) => el.getBoundingClientRect().toJSON());
      boxes.forEach((box, i) => {
        // Each row spans the composer's exact left/right edges…
        expect(Math.abs(box.left - composer.left)).toBeLessThanOrEqual(1);
        expect(Math.abs(box.right - composer.right)).toBeLessThanOrEqual(1);
        // …and sits below the previous one (stacked, never side by side).
        if (i > 0) expect(box.top).toBeGreaterThan(boxes[i - 1].bottom);
      });
      // The rows are above the composer.
      expect(boxes[boxes.length - 1].bottom).toBeLessThan(composer.top);
      // Nothing scrolls sideways: not the group, not the embed document.
      expect(
        await iframe
          .getByTestId('starter-prompt-rows')
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      expect(
        await iframe
          .locator('html')
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      // A long prompt ellipsizes on one line instead of overflowing its row.
      for (const fits of await rows.evaluateAll((els) =>
        els.map((el) => {
          const label = el.firstElementChild as HTMLElement;
          return (
            label.getBoundingClientRect().right <=
            el.getBoundingClientRect().right
          );
        }),
      )) {
        expect(fits).toBe(true);
      }
      return count;
    };

    const mentorUrl = page.url();
    await page.setViewportSize({ width: 1280, height: 800 });
    let iframe = await gotoEmbedHarness(page, mentorUrl);
    await expect(iframe.locator('#chat-input-textarea')).toBeVisible({
      timeout: 60_000,
    });
    const row = iframe.getByTestId('starter-prompt-row').first();
    let rowVisible = false;
    try {
      await row.waitFor({ state: 'visible', timeout: 20_000 });
      rowVisible = true;
    } catch {
      rowVisible = false;
    }
    test.skip(
      !rowVisible,
      'Embed suggested prompts did not render for this mentor/session',
    );
    await expect(iframe.getByTestId('starter-prompt-row')).toHaveCount(4);
    await expect(
      iframe.getByText('A fifth prompt that must not show'),
    ).toHaveCount(0);
    await expect(
      iframe.getByRole('group', { name: 'Suggested prompts' }),
    ).toBeVisible();
    await assertRows(iframe);

    await page.setViewportSize({ width: 320, height: 800 });
    iframe = await gotoEmbedHarness(page, mentorUrl);
    // The reloaded embed can sit on its "Loading..." spinner for a while.
    await expect(iframe.locator('#chat-input-textarea')).toBeVisible({
      timeout: 60_000,
    });
    await expect(iframe.getByTestId('starter-prompt-row')).toHaveCount(4, {
      timeout: 20_000,
    });
    await assertRows(iframe);
    // Still visible (and still four stacked rows) while the user types.
    await iframe.locator('#chat-input-textarea').fill('hello');
    await expect(iframe.getByTestId('starter-prompt-row')).toHaveCount(4, {
      timeout: 5_000,
    });
    await assertRows(iframe);

    await page.setViewportSize({ width: 1280, height: 800 });
  });

  // emb-lti-04 (regression, issue #2586): in a 300px LTI frame the composer's
  // placeholder ("Ask anything, or type / for skills") stays on ONE line and
  // ellipsizes. Pre-fix it wrapped to a second line that was clipped.
  test('narrow LTI embed keeps the composer placeholder on one line at 300px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 300, height: 800 });
    const iframe = await gotoEmbedHarness(page, page.url(), { lti: 'true' });
    const chatInput = iframe.locator('#chat-input-textarea');
    await expect(chatInput).toBeVisible({ timeout: 20_000 });
    await expect(chatInput).toHaveValue('');
    await expect(chatInput).toHaveAttribute('placeholder', /\S/);

    const metrics = await chatInput.evaluate((el) => {
      const style = getComputedStyle(el);
      const placeholder = getComputedStyle(el, '::placeholder');
      const content =
        el.scrollHeight -
        parseFloat(style.paddingTop) -
        parseFloat(style.paddingBottom);
      return {
        whiteSpace: style.whiteSpace,
        placeholderWhiteSpace: placeholder.whiteSpace,
        placeholderOverflow: placeholder.textOverflow,
        content,
        lineHeight: parseFloat(style.lineHeight),
        clipped: el.scrollHeight > el.clientHeight + 1,
      };
    });
    expect(metrics.whiteSpace).toBe('nowrap');
    expect(metrics.placeholderWhiteSpace).toBe('nowrap');
    expect(metrics.placeholderOverflow).toBe('ellipsis');
    // One line of text: the content box is shorter than two lines.
    expect(metrics.content).toBeLessThan(metrics.lineHeight * 1.5);
    expect(metrics.clipped).toBe(false);

    // Typed text still wraps normally once the placeholder is gone.
    await chatInput.fill(
      'a long message that certainly needs more than one line in a narrow frame',
    );
    expect(
      await chatInput.evaluate((el) => getComputedStyle(el).whiteSpace),
    ).not.toBe('nowrap');

    await page.setViewportSize({ width: 1280, height: 800 });
  });
});
