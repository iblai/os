import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, waitForAdmin } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import type { Locator, Page } from '@playwright/test';

/**
 * Journey 103 - Welcome greeting fit (iblai/iblai-platform#2884).
 *
 * A long agent greeting used to push the composer off the screen on a new
 * chat. The SDK (`WelcomeMessage`) now shows the whole greeting whenever the
 * welcome screen fits its visible height, and otherwise cuts it to as many
 * lines as fit (never fewer than 3, never hiding exactly one line) plus a
 * blue Show More / Show Less button. Opened, the greeting scrolls inside its
 * own box and stays centred. The greeting comes from
 * `GET /mentors/<id>/(public-)settings/` (`greeting_method: proactive_response`
 * + `proactive_response`), so each test answers that with its own text via
 * `page.route` and runs on the default agent (no agent is created).
 */

const LONG = `Welcome! I'm your study companion for this course, and I'm here to help you understand the material, practise what you've learned and get ready for your exams. Here's what I can do for you:

- **Explain concepts** in plain words, with examples that fit how you learn
- **Quiz you** on any topic, with instant feedback on every answer
- **Plan your study time** so you cover everything before the deadline

Not sure where to start? Try one of these:

1. What are the main ideas in this week's reading?
2. Can you quiz me on the last lesson?
3. How should I plan my revision for the final exam?
4. Explain this topic as if I were new to it.
5. What should I review before my next assignment?

Whenever you're ready, just type your question below and we'll get going together.`;
const SHORT = 'Hi! How can I help you today?';

const TALL = { width: 1440, height: 900 };
const SHORT_SCREEN = { width: 1440, height: 560 };

async function mockGreeting(page: Page, greeting: string) {
  await page.route(
    /\/mentors\/[^/]+\/(public-)?settings\/(\?.*)?$/,
    async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      const res = await route.fetch();
      let body: Record<string, unknown>;
      try {
        body = await res.json();
      } catch {
        return route.fulfill({ response: res });
      }
      body.greeting_method = 'proactive_response';
      body.proactive_response = greeting;
      return route.fulfill({ response: res, json: body });
    },
  );
}

async function openWithGreeting(
  page: Page,
  greeting: string,
  viewport = SHORT_SCREEN,
) {
  await mockGreeting(page, greeting);
  await page.setViewportSize(viewport);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForPageReady(page);
  await expect(page.getByTestId('welcome-message-box')).toBeVisible({
    timeout: 60_000,
  });
}

const linesOf = async (box: Locator) =>
  Number((await box.getAttribute('data-lines')) ?? 0);

test.describe('Journey 103: Welcome Greeting Fit', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    await waitForAdmin(page);
  });

  test('wgf-01: a long greeting shows whole with no Show More button when the welcome screen fits', async ({
    page,
    chatPage,
  }) => {
    await openWithGreeting(page, LONG, TALL);
    const box = page.getByTestId('welcome-message-box');
    await expect(page.getByTestId('welcome-message-toggle')).toHaveCount(0);
    await expect(box).not.toHaveAttribute('data-lines', /.*/);
    await expect(box).toContainText('type your question below');
    expect(
      await box.evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
    ).toBe(true);
    await expect(chatPage.getComposerTextarea()).toBeInViewport();
  });

  test('wgf-02: on a short screen the greeting is cut to at least 3 lines with a blue Show More button and the composer stays on screen', async ({
    page,
    chatPage,
  }) => {
    await openWithGreeting(page, LONG);
    const box = page.getByTestId('welcome-message-box');
    const toggle = page.getByTestId('welcome-message-toggle');
    await expect(toggle).toBeVisible({ timeout: 15_000 });
    await expect(toggle).toHaveText('Show More');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toHaveClass(/text-blue-600/);
    await expect(toggle).toHaveAttribute(
      'aria-controls',
      (await box.getAttribute('id')) ?? '',
    );
    expect(await linesOf(box)).toBeGreaterThanOrEqual(3);
    await expect(chatPage.getComposerTextarea()).toBeInViewport();
    await expect(toggle).toBeInViewport();
    await page.screenshot({
      path: test.info().outputPath('wgf-02-cut.png'),
    });
  });

  test('wgf-03: the cut never hides exactly one line, at any screen height', async ({
    page,
  }) => {
    await openWithGreeting(page, LONG, TALL);
    const box = page.getByTestId('welcome-message-box');
    const toggle = page.getByTestId('welcome-message-toggle');
    for (const height of [860, 820, 780, 740, 700, 660, 620, 580, 540]) {
      await page.setViewportSize({ width: 1440, height });
      // Settle: the box either carries data-lines or is whole.
      await expect
        .poll(
          async () =>
            (await toggle.count()) ===
            ((await box.getAttribute('data-lines')) ? 1 : 0),
          { timeout: 5_000 },
        )
        .toBe(true);
      if ((await toggle.count()) === 0) continue;
      const hidden = await box.evaluate((el) => {
        const lh = parseFloat(
          getComputedStyle(el.firstElementChild ?? el).lineHeight,
        );
        return (el.scrollHeight - el.clientHeight) / lh;
      });
      // More than one line of overflow; tolerance for paragraph spacing.
      expect(hidden, `height ${height}`).toBeGreaterThan(1.5);
    }
  });

  test('wgf-04: resizing the window re-fits the greeting (button appears on a short window and goes on a tall one)', async ({
    page,
  }) => {
    await openWithGreeting(page, LONG, TALL);
    const toggle = page.getByTestId('welcome-message-toggle');
    await expect(toggle).toHaveCount(0);

    await page.setViewportSize(SHORT_SCREEN);
    await expect(toggle).toBeVisible({ timeout: 10_000 });

    await page.setViewportSize(TALL);
    await expect(toggle).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByTestId('welcome-message-box')).not.toHaveAttribute(
      'data-lines',
      /.*/,
    );
  });

  test('wgf-05: Show More opens the greeting taller, scrolling inside its own box and still centred; Show Less returns to the cut scrolled to the top', async ({
    page,
  }) => {
    await openWithGreeting(page, LONG);
    const box = page.getByTestId('welcome-message-box');
    const toggle = page.getByTestId('welcome-message-toggle');
    await expect(toggle).toBeVisible({ timeout: 15_000 });
    const cutLines = await linesOf(box);
    const cutHeight = (await box.boundingBox())!.height;

    await toggle.click();
    await expect(toggle).toHaveText('Show Less');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(box).not.toHaveAttribute('data-lines', /.*/);

    const openHeight = (await box.boundingBox())!.height;
    expect(openHeight).toBeGreaterThan(cutHeight);
    expect(openHeight).toBeLessThanOrEqual(
      page.viewportSize()!.height * 0.4 + 1,
    );
    expect(await box.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(
      true,
    );

    // Centred, never left-aligned.
    expect(
      await box.evaluate(
        (el) => getComputedStyle(el.firstElementChild ?? el).textAlign,
      ),
    ).toBe('center');
    await expect(box).not.toHaveClass(/text-left/);

    const pageScrollBefore = await page.evaluate(() => window.scrollY);
    await box.hover();
    await page.mouse.wheel(0, 120);
    await expect
      .poll(() => box.evaluate((el) => el.scrollTop), { timeout: 5_000 })
      .toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(pageScrollBefore);
    await page.screenshot({
      path: test.info().outputPath('wgf-05-opened.png'),
    });

    await toggle.click();
    await expect(toggle).toHaveText('Show More');
    await expect(box).toHaveAttribute('data-lines', String(cutLines));
    await expect
      .poll(() => box.evaluate((el) => el.scrollTop), { timeout: 5_000 })
      .toBe(0);
  });

  test('wgf-06: a new chat starts with the greeting cut again', async ({
    page,
    chatPage,
  }) => {
    await openWithGreeting(page, LONG);
    const box = page.getByTestId('welcome-message-box');
    const toggle = page.getByTestId('welcome-message-toggle');
    await expect(toggle).toBeVisible({ timeout: 15_000 });
    await toggle.click();
    await expect(toggle).toHaveText('Show Less');

    await chatPage.sendMessage('Hello');
    await expect(chatPage.userMessages.first()).toBeVisible({
      timeout: 60_000,
    });
    await chatPage.newChatButton.click();

    await expect(toggle).toBeVisible({ timeout: 60_000 });
    await expect(toggle).toHaveText('Show More');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(box).toHaveAttribute('data-lines', /\d+/);
  });

  test('wgf-07: a short greeting shows in full with no Show More button even on a short screen', async ({
    page,
  }) => {
    await openWithGreeting(page, SHORT);
    await expect(page.getByTestId('welcome-message-box')).toContainText(SHORT);
    await expect(page.getByTestId('welcome-message-toggle')).toHaveCount(0);
  });

  test('wgf-08: the agent name stays reachable on a short desktop screen, cut or open', async ({
    page,
  }) => {
    await openWithGreeting(page, LONG);
    const heading = page.getByTestId('welcome-heading');
    await expect(heading).toBeVisible();
    expect((await heading.boundingBox())!.y).toBeGreaterThanOrEqual(0);

    await page.getByTestId('welcome-message-toggle').click();
    await expect(page.getByTestId('welcome-message-toggle')).toHaveText(
      'Show Less',
    );
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeInViewport();
  });
});
