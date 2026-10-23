import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp } from '../utils/auth';
import { EMBED_HARNESS_URL } from '../fixtures/test-data';

/**
 * Journey 78: Embed Second-Origin Harness (issue #2586)
 *
 * A small, deliberately generic static page (`e2e/utils/embed-harness-server.mjs`,
 * wired as a Playwright `webServer` on `127.0.0.1:4599`) that iframes any URL
 * passed via `?src=`, from a genuinely different origin than the mentor app.
 * Built so embed specs can exercise a real cross-origin iframe embed — the
 * shape a customer's website actually presents — without depending on an
 * external, personally-owned demo site (`EMBED_URL`, now optional; see
 * journey 13's emb-02).
 *
 * This journey covers the harness infrastructure itself. Issue #2590's
 * origin-allowlist security work is expected to reuse it unchanged (e.g.
 * pointing `?src=` at the mentor app from a disallowed origin and asserting
 * the postMessage bridge rejects it).
 */
test.describe('Journey 78: Embed Second-Origin Harness', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  // ehh-01: the harness is reachable and falls back to a visible placeholder
  // (rather than a blank page) when no ?src= is given.
  test('embed harness serves a placeholder page when no ?src is given', async ({
    page,
  }) => {
    await page.goto(EMBED_HARNESS_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 15_000,
    });
    await expect(page.getByText(/pass \?src=/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  // ehh-02: a genuinely cross-origin iframe (harness origin != mentor app
  // origin) renders the embedded chat UI end to end.
  test('embed harness on a different origin renders the mentor chat inside its iframe', async ({
    page,
  }) => {
    const mentorUrl = page.url();
    const harnessOrigin = new URL(EMBED_HARNESS_URL).origin;
    const mentorOrigin = new URL(mentorUrl).origin;
    expect(harnessOrigin).not.toBe(mentorOrigin);

    const embedUrl = new URL(mentorUrl);
    embedUrl.searchParams.set('embed', 'true');

    await page.goto(
      `${EMBED_HARNESS_URL}/?src=${encodeURIComponent(embedUrl.toString())}`,
      { waitUntil: 'domcontentloaded', timeout: 30_000 },
    );
    const iframe = page.frameLocator('#embed-harness-iframe');
    await expect(
      iframe.getByPlaceholder('Ask anything', { exact: true }),
    ).toBeVisible({ timeout: 20_000 });
  });
});
