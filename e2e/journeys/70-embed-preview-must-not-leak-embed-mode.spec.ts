/**
 * Journey 70 — Embed Tab Preview Must Not Leak Embed Mode Into The App
 *
 * Regression guard for a bug where opening the Edit Agent → Embed tab flipped
 * the SURROUNDING app into the stripped-down embed shell. After visiting that
 * tab, the next re-render (clicking "New Chat" is the common one) replaced the
 * full admin sidebar with the 3-icon embed rail — no Agents, Workflows,
 * Projects, Analytics, Management, no LLM selector, no User/Admin toggle —
 * on a plain mentor URL with no query string at all. It then survived a
 * reload, so the tab stayed broken until it was closed.
 *
 * ── Root cause ────────────────────────────────────────────────────────────
 *
 * `sessionStorage` is scoped to the TAB, not to the browsing context, so a
 * SAME-ORIGIN iframe writes into its parent tab's store. The Embed tab renders
 * a live preview of the app at `?embed=true&internalPreview=true`
 * (`embed-tab.tsx`), pointed at `window.location.origin`. That preview booted a
 * full copy of the app, whose `Providers` effect called
 * `persistEmbedContextFromUrl()` (`lib/embed-context.ts`) and mirrored
 * `ibl:embed-context` into what was really the HOST tab's storage.
 *
 * `useEmbedMode` checks the URL first, then falls back to that stored copy —
 * so with the key present, every subsequent render of the host app resolved to
 * embed mode. It is read during render and is not reactive, which is why the
 * flip surfaced on the next re-render rather than immediately.
 *
 * Real customer embeds are CROSS-origin (the `agent-ai` web component iframes
 * mentorai from the host site), so their storage is partitioned away and they
 * never had this problem — only the internal preview did.
 *
 * ── The fix (lib/embed-context.ts) ────────────────────────────────────────
 *
 *   1. `persistEmbedContextFromUrl()` no-ops when `internalPreview=true`, so
 *      the preview never writes at all.
 *   2. `readStoredEmbedContext()` returns null unless `isInIframe()`, so a
 *      top-level tab ignores a stored copy no matter who wrote it.
 *
 * Test 1 covers guard 1 via the real UI. Test 2 covers guard 2 by planting the
 * key directly — that half must hold even if some future same-origin iframe
 * starts writing it again.
 *
 * ── Why assert the FULL sidebar (the inverse of journey 58) ───────────────
 *
 * Journey 58 guards the opposite direction: inside a genuine embed, the full
 * sidebar must NEVER leak to students. This journey guards that the embed
 * shell must never leak into the full app. The two are complementary — a fix
 * that over-corrects either way breaks the other, so both assert on the same
 * `SidebarPage` helpers.
 */

import { test, expect } from '../fixtures/mentor-test';
import { checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { navigateAndObserveTenantMetadata } from '../utils/tenant-metadata-observed';

/** The sessionStorage key the embed context is mirrored into. */
const EMBED_CONTEXT_KEY = 'ibl:embed-context';

/**
 * Asserts the FULL admin app chrome is present: the sections that embed mode
 * strips must all still be there. This is the assertion that failed before the
 * fix — every one of these disappeared once the tab was poisoned.
 *
 * The 4 section triggers (Agents/Workflows/Projects/Analytics) are the
 * primary embed-leak signal: they are unconditional, full-app-only chrome
 * that has nothing to do with tenant config, so they catch a leak in either
 * direction regardless of the tenant under test.
 *
 * The Support link, by contrast, is gated by the tenant's OWN
 * `show_help` metadata (`hooks/use-help-center.ts`: `showHelp =
 * metadata.show_help !== false`) — a pristine tenant shows it, but a
 * tenant that explicitly sets `show_help: false` never renders it, even in
 * the correct, un-leaked full app. Hardcoding `true` here made this journey
 * depend on ambient tenant configuration it has no business assuming (see
 * #uat-9). `expectedShowHelp` is derived from the SAME tenant-metadata
 * response the app itself fetches on load (`navigateAndObserveTenantMetadata`
 * in `beforeEach`), so this asserts the CORRECT visibility for whatever the
 * tenant under test is actually configured to do — still catching a leak
 * for any tenant where the control is expected to be visible, without
 * requiring one specific config to be seeded.
 */
async function assertFullAppSidebar(
  sidebarPage: import('../page-objects/sidebar.page').SidebarPage,
  context: string,
  expectedShowHelp: boolean,
): Promise<void> {
  await expect(sidebarPage.newChatButton).toBeVisible({ timeout: 15_000 });

  for (const name of ['Agents', 'Workflows', 'Projects', 'Analytics']) {
    const visible = await sidebarPage.isSectionTriggerVisible(name, 10_000);
    expect(
      visible,
      `"${name}" must still be PRESENT in the full app (${context})`,
    ).toBe(true);
  }

  const supportVisible = await sidebarPage.isSupportLinkVisible(10_000);
  if (expectedShowHelp) {
    expect(
      supportVisible,
      `Support link must still be PRESENT in the full app (${context}) — tenant metadata shows show_help !== false`,
    ).toBe(true);
  } else {
    expect(
      supportVisible,
      `Support link must remain ABSENT in the full app (${context}) — tenant metadata has show_help: false, so this is the CORRECT full-app state, not a leak`,
    ).toBe(false);
  }
}

/** Reads the mirrored embed context out of the HOST tab's sessionStorage. */
async function readEmbedContext(
  page: import('@playwright/test').Page,
): Promise<string | null> {
  return page.evaluate(
    (key) => window.sessionStorage.getItem(key),
    EMBED_CONTEXT_KEY,
  );
}

test.describe('Journey 70: Embed preview must not leak embed mode', () => {
  test.setTimeout(180_000);

  // Set fresh in `beforeEach` for every test — see `assertFullAppSidebar`
  // for why this is derived from the live tenant rather than hardcoded.
  let expectedShowHelp = true;

  test.beforeEach(async ({ page, createMentorPage }) => {
    const metadata = await navigateAndObserveTenantMetadata(page);
    expectedShowHelp = metadata.show_help !== false;

    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Requires admin access to create a mentor');
      return;
    }

    // Per-project convention: each test creates its own fresh agent, so the
    // Embed tab opens against a mentor no other test is mutating.
    await createMentorPage.openAndCreate();
    await waitForPageReady(page);
  });

  test('opening the Embed tab does not flip the app into embed mode on the next New Chat', async ({
    page,
    sidebarPage,
    editMentorPage,
  }) => {
    // ── Step 1: baseline — the full app, and a clean store ───────────────────
    await assertFullAppSidebar(
      sidebarPage,
      'before opening the Embed tab',
      expectedShowHelp,
    );
    expect(
      await readEmbedContext(page),
      'embed context must not be set before the Embed tab is opened',
    ).toBeNull();

    // ── Step 2: open Edit Agent → Embed, which mounts the preview iframe ─────
    await editMentorPage.open('Embed');

    // Wait for the preview iframe to actually boot. Without this the test can
    // pass vacuously: the old code only poisoned the store once the iframe's
    // own `Providers` effect ran, several seconds after the tab rendered.
    const preview = page.locator('iframe#embed-mentor-preview');
    await expect(preview).toBeAttached({ timeout: 30_000 });
    const previewFrame = preview.contentFrame();
    await expect(
      previewFrame.locator('body'),
      'the preview iframe must render the app before we assert on storage',
    ).toBeVisible({ timeout: 60_000 });

    // ── Step 3: guard 1 — the preview must not have written to our store ─────
    // Poll rather than read once: the write was an effect, so a single early
    // read could miss it and pass against the buggy build.
    await expect
      .poll(() => readEmbedContext(page), {
        message:
          'the same-origin preview iframe must NEVER write ibl:embed-context into the host tab',
        timeout: 20_000,
        intervals: [1_000, 2_000, 3_000],
      })
      .toBeNull();

    // ── Step 4: close the dialog and click New Chat — the reported trigger ───
    await editMentorPage.close();
    await waitForPageReady(page);

    await sidebarPage.newChatButton.click();

    // ── Step 5: the regression assertion ────────────────────────────────────
    await assertFullAppSidebar(
      sidebarPage,
      'after clicking New Chat',
      expectedShowHelp,
    );

    // The URL must still be a plain mentor URL — a poisoned tab also fed
    // `embedContextQuery()`, which appended `?embed=true` to the app's own
    // navigations and wrote the corruption into the URL.
    expect(
      new URL(page.url()).searchParams.get('embed'),
      'New Chat must not add embed=true to the app URL',
    ).toBeNull();

    // ── Step 6: and it must not come back after a reload ────────────────────
    await page.reload();
    await waitForPageReady(page);
    await assertFullAppSidebar(sidebarPage, 'after reload', expectedShowHelp);
  });

  test('a top-level tab ignores a stored embed context it did not get from its own URL', async ({
    page,
    sidebarPage,
  }) => {
    await assertFullAppSidebar(
      sidebarPage,
      'before planting the stored copy',
      expectedShowHelp,
    );

    // Plant exactly what the preview iframe used to write. This models any
    // same-origin iframe writing the key — the read-side guard must hold
    // regardless of who the writer was.
    await page.evaluate(
      ([key, value]) => window.sessionStorage.setItem(key, value),
      [
        EMBED_CONTEXT_KEY,
        JSON.stringify({ embed: 'true', mode: 'anonymous' }),
      ] as const,
    );

    expect(
      await readEmbedContext(page),
      'the stored copy must actually be present for this test to mean anything',
    ).not.toBeNull();

    // Re-render the shell the same way the reported bug did.
    await sidebarPage.newChatButton.click();
    await assertFullAppSidebar(
      sidebarPage,
      'after New Chat with a planted stored copy',
      expectedShowHelp,
    );

    // A reload re-reads the store from scratch — the guard must hold there too.
    await page.reload();
    await waitForPageReady(page);
    await assertFullAppSidebar(
      sidebarPage,
      'after reload with a planted stored copy',
      expectedShowHelp,
    );
  });
});
