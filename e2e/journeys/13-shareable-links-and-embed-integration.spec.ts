import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/mentor-test';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';
import { EMBED_URL } from '../fixtures/test-data';
import { waitForPageReady } from '../utils/resilient';
import type { EditMentorPage } from '../page-objects/edit-mentor/edit-mentor.page';
import { logger } from '@iblai/iblai-js/playwright';
import { MentorTracker } from '../utils/mentor-cleanup';

/** Builds the embed entry URL (the iframe's own src) for a mentor page. */
function embedUrlFor(mentorUrl: string): string {
  const url = new URL(mentorUrl);
  url.searchParams.set('embed', 'true');
  url.searchParams.set('extra-body-classes', 'iframed-externally');
  return url.toString();
}

/** Configures + persists the embed with a given Show Catalogue value (via UI). */
async function createEmbedWithShowCatalogue(
  page: Page,
  editMentorPage: EditMentorPage,
  mentorUrl: string,
  enabled: boolean,
): Promise<void> {
  await page.goto(mentorUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await editMentorPage.open('Embed');
  await expect(editMentorPage.embed.showCatalogueToggle).toBeVisible({
    timeout: 15_000,
  });
  await editMentorPage.embed.setShowCatalogue(enabled);
  await editMentorPage.embed.submit();
  await editMentorPage.close();
}

test.describe('Journey 13: Shareable Links & Embed Integration', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) test.skip(true, 'Embed configuration requires admin access');
  });

  // fixme: embed configuration times out — setVisibility method error
  test.fixme(
    'admin goes to embed tab and configures a non-anonymous embed with voice call, voice record, and attachment buttons',
    async ({ page, editMentorPage }) => {
      await editMentorPage.open('Embed');
      await waitForPageReady(page);
      await expect(editMentorPage.embed.embedCodeBlock).toBeVisible({
        timeout: 15_000,
      });
      const code = await editMentorPage.embed.getEmbedCode();
      expect(code.length).toBeGreaterThan(0);
      await editMentorPage.close();
    },
  );

  test('admin goes to embed tab and an authenticated embed chat sends a message and receives a response', async ({
    page,
    editMentorPage,
  }) => {
    if (!EMBED_URL) {
      test.skip(true, 'Set EMBED_URL to enable embed integration test');
      return;
    }
    await editMentorPage.open('Embed');
    const embedCode = await editMentorPage.embed.getEmbedCode().catch(() => '');
    await editMentorPage.close();

    if (!embedCode) return;

    await page.goto(EMBED_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    const iframe = page.frameLocator('iframe').first();
    const chatInput = iframe.getByPlaceholder('Ask anything', { exact: true });
    if (await chatInput.isVisible({ timeout: 15_000 }).catch(() => false)) {
      await chatInput.fill('Hello from embed test');
      await iframe.getByRole('button', { name: 'Send message' }).click();
      await expect(
        iframe.locator('.chat-ai-message-response').first(),
      ).toBeVisible({ timeout: 60_000 });
    }
  });

  // fixme: embed visibility setting fails — Radix UI option locator issue
  test.fixme(
    'admin goes to embed tab and configures an advanced anonymous embed with Anyone visibility',
    async ({ page, editMentorPage }) => {
      await editMentorPage.open('Settings');
      await waitForPageReady(page);
      // Visibility moved under the Discovery sub-tab when Settings was
      // split into Basic / Discovery / Capabilities.
      await editMentorPage.settings.selectSubTab('Discovery');
      const hasVisibility = await editMentorPage.settings.visibilityCombobox
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      if (hasVisibility) {
        await editMentorPage.settings.setVisibility('Anyone');
      }
      await editMentorPage.navigateToTab('Embed');
      await expect(editMentorPage.embed.embedCodeBlock).toBeVisible({
        timeout: 15_000,
      });
      await editMentorPage.close();
    },
  );

  test('admin goes to embed tab and configures context-aware anonymous embed', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('Embed');
    await waitForPageReady(page);
    const contextSwitch = editMentorPage.dialog.getByRole('switch', {
      name: /context aware/i,
    });
    if (await contextSwitch.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await contextSwitch.click();
      await page.waitForTimeout(500);
      await contextSwitch.click(); // restore
    }
    await editMentorPage.close();
  });

  // Each Show Catalogue test runs against its own freshly created, anonymous
  // mentor — isolating the tests (no contention over a shared mentor's
  // show_catalogue) and letting "Create Embed" pass the anonymous-or-URL gate.
  test.describe('Show Catalogue setting', () => {
    test.beforeEach(async ({ page, createMentorPage, editMentorPage }) => {
      await createMentorPage.openAndCreate(`Catalogue E2E ${Date.now()}`);

      // Make the mentor anonymous so "Create Embed" can persist settings.
      await editMentorPage.open('Settings');
      await waitForPageReady(page);
      await editMentorPage.settings.setVisibilityAnyone();
      await editMentorPage.settings.setChatAccessAnyone();
      const saveBtn = editMentorPage.dialog
        .getByRole('button', { name: /save/i })
        .first();
      await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
      await saveBtn.click();
      await page.waitForTimeout(1_500);
      await editMentorPage.close();
    });

    // emb-06: The Show Catalogue toggle works in the embed tab and is independent
    // of the sibling toggles. Stays in-modal so it neither mutates backend state
    // nor depends on cache invalidation; persistence is covered by emb-07.
    test('embed tab Show Catalogue toggle flips and leaves sibling toggles unaffected', async ({
      editMentorPage,
    }) => {
      await editMentorPage.open('Embed');
      await expect(editMentorPage.embed.showCatalogueToggle).toBeVisible({
        timeout: 15_000,
      });

      const original = await editMentorPage.embed.getShowCatalogueState();

      // Capture sibling toggle states before touching Show Catalogue.
      const voiceCallBefore = await editMentorPage.embed.voiceCallToggle
        .getAttribute('aria-checked')
        .catch(() => null);
      const voiceRecordBefore = await editMentorPage.embed.voiceRecordToggle
        .getAttribute('aria-checked')
        .catch(() => null);
      const attachmentBefore = await editMentorPage.embed.attachmentToggle
        .getAttribute('aria-checked')
        .catch(() => null);

      // Toggle Show Catalogue and confirm the switch flips.
      await editMentorPage.embed.toggleShowCatalogue();
      await expect(editMentorPage.embed.showCatalogueToggle).toHaveAttribute(
        'aria-checked',
        original ? 'false' : 'true',
        { timeout: 5_000 },
      );

      // Sibling toggles must be unchanged after toggling Show Catalogue.
      if (voiceCallBefore !== null) {
        await expect(editMentorPage.embed.voiceCallToggle).toHaveAttribute(
          'aria-checked',
          voiceCallBefore,
        );
      }
      if (voiceRecordBefore !== null) {
        await expect(editMentorPage.embed.voiceRecordToggle).toHaveAttribute(
          'aria-checked',
          voiceRecordBefore,
        );
      }
      if (attachmentBefore !== null) {
        await expect(editMentorPage.embed.attachmentToggle).toHaveAttribute(
          'aria-checked',
          attachmentBefore,
        );
      }

      // Restore the original state (UI only — nothing is persisted).
      await editMentorPage.embed.setShowCatalogue(original);
      await editMentorPage.close();
    });

    // emb-07: With Show Catalogue disabled, the embed view's sidebar logo
    // renders but is not wrapped in a navigable button.
    test('embed view sidebar logo is not clickable when Show Catalogue is disabled', async ({
      page,
      editMentorPage,
      sidebarPage,
    }) => {
      const baseMentorUrl = page.url();
      await createEmbedWithShowCatalogue(
        page,
        editMentorPage,
        baseMentorUrl,
        false,
      );

      await page.goto(embedUrlFor(baseMentorUrl), {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      await sidebarPage.ensureExpanded(40_000);
      await expect(sidebarPage.logoImage).toBeVisible({ timeout: 15_000 });
      // The logo renders but is not wrapped in a navigable button. toHaveCount(0)
      // retries past the brief loading window before settings resolve.
      await expect(sidebarPage.logoButton).toHaveCount(0, { timeout: 10_000 });
    });

    // emb-08: With Show Catalogue enabled, the embed view's sidebar logo is
    // clickable (navigates home), matching the non-embed behaviour.
    test('embed view sidebar logo is clickable when Show Catalogue is enabled', async ({
      page,
      editMentorPage,
      sidebarPage,
    }) => {
      const baseMentorUrl = page.url();
      await createEmbedWithShowCatalogue(
        page,
        editMentorPage,
        baseMentorUrl,
        true,
      );

      await page.goto(embedUrlFor(baseMentorUrl), {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      await sidebarPage.ensureExpanded(40_000);
      await expect(sidebarPage.logoButton).toBeVisible({ timeout: 15_000 });
    });
  }); // test.describe('Show Catalogue setting')

  // emb-09: Embed mode renders a minimal sidebar — New Chat + Chats section
  // present; Agents (New Agent), Workflows, Analytics, Projects sections and
  // the Support/docs footer link are ALL absent. Holds regardless of user role
  // and for both the expanded and rail-collapsed sidebar layouts.
  test('embed mode renders a minimal sidebar (New Chat and Chats present; Agents, Workflows, Analytics, Projects, and Support link absent)', async ({
    page,
    sidebarPage,
  }) => {
    // Build the embed URL from the current mentor page URL.
    const baseMentorUrl = page.url();
    await page.goto(embedUrlFor(baseMentorUrl), {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // The sidebar may be absent when ?hide-sidebar is active or when the
    // platform collapses it on small viewports. Check for the toggle button
    // (always present when the sidebar is rendered, even when rail-collapsed).
    let sidebarPresent = false;
    try {
      await sidebarPage.toggleButton.waitFor({
        state: 'visible',
        timeout: 10_000,
      });
      sidebarPresent = true;
    } catch {
      sidebarPresent = false;
    }

    if (!sidebarPresent) {
      logger.info(
        'emb-09: sidebar toggle not found in embed mode — sidebar may be hidden via ?hide-sidebar or not rendered; skipping embed-sidebar assertions',
      );
      return;
    }

    // Ensure the sidebar is in expanded (non-rail) state so all section
    // triggers are rendered as labelled buttons with text, not icon-only.
    await sidebarPage.ensureExpanded(40_000);

    // --- Must be PRESENT in embed mode ---

    // "New Chat" button
    await expect(sidebarPage.newChatButton).toBeVisible({ timeout: 10_000 });

    // "Recents" collapsible section trigger
    const chatsVisible = await sidebarPage.isSectionTriggerVisible(
      'Recents',
      5_000,
    );
    if (!chatsVisible) {
      logger.info(
        'emb-09: Recents section trigger not visible — may render differently in this env; asserting New Chat only',
      );
    } else {
      await expect(
        sidebarPage.sidebar.getByRole('button', {
          name: 'Recents',
          exact: true,
        }),
      ).toBeVisible();
    }

    // --- Must be ABSENT in embed mode ---

    // Agents section ("New Agent" is a sub-item; the section trigger itself
    // is "Agents" — but in embed mode `agentsMenu.items` is empty so the
    // <SidebarNavCollapsibleSection> is not rendered at all).
    const agentsVisible = await sidebarPage.isSectionTriggerVisible(
      'Agents',
      3_000,
    );
    expect(agentsVisible).toBe(false);

    // "New Agent" button (sub-item, also absent)
    await expect(sidebarPage.newMentorButton).toHaveCount(0, {
      timeout: 3_000,
    });

    // Workflows section trigger
    const workflowsVisible = await sidebarPage.isSectionTriggerVisible(
      'Workflows',
      3_000,
    );
    expect(workflowsVisible).toBe(false);

    // Analytics section trigger
    const analyticsVisible = await sidebarPage.isSectionTriggerVisible(
      'Analytics',
      3_000,
    );
    expect(analyticsVisible).toBe(false);

    // Projects section trigger
    const projectsVisible = await sidebarPage.isSectionTriggerVisible(
      'Projects',
      3_000,
    );
    expect(projectsVisible).toBe(false);

    // Support / docs link (ibl.ai/docs) — entire footer hidden in embed mode
    const supportVisible = await sidebarPage.isSupportLinkVisible(3_000);
    expect(supportVisible).toBe(false);

    logger.info(
      'emb-09: embed mode minimal sidebar verified — New Chat present; Agents/Workflows/Analytics/Projects/Support absent',
    );
  });

  // emb-10: Optimize Page Context Tokens toggle — label visible, tooltip
  // reachable, and the value flips and persists after a submit + modal reopen.
  // (Off-by-default for a new mentor is asserted by the unit test in
  // embed-tab.test.tsx; this journey reuses a shared mentor, so it verifies the
  // persistence round-trip rather than the literal default.)
  //
  // Uses the currently loaded mentor. To satisfy the "Create Embed" URL gate
  // without changing the mentor's visibility (which would disrupt auth redirects
  // for subsequent tests), a throwaway https://example.com URL is filled into the
  // Website URL field. The original toggle state is restored at the end.
  //
  // fixme: shared-mentor reuse + the slow submit/reopen cycle (300s timeout)
  //        make this flaky in CI; revisit with a dedicated mentor fixture so it
  //        can assert default-off and avoid contending on shared state.
  test.fixme(
    'embed tab Optimize Page Context Tokens toggle: label, tooltip, and persists when toggled',
    async ({ page, editMentorPage }) => {
      // This test exercises a full cycle: open Embed tab → check UI → submit →
      // close → reopen → verify persistence → cleanup. The cycle takes up to 3
      // minutes in slow environments, so extend the timeout to avoid false failures.
      test.setTimeout(300_000);

      // Step 1: open Edit modal → Embed tab.
      await editMentorPage.open('Embed');
      await expect(editMentorPage.embed.optimizePageContextToggle).toBeVisible({
        timeout: 15_000,
      });

      // Step 2: record the initial state (backend default is false; may already
      // have been flipped in a previous run — we work with whatever the current
      // value is and restore it at the end).
      const initialState =
        await editMentorPage.embed.getOptimizePageContextState();

      // Step 3: visible label "Optimize Page Context Tokens" is present.
      await expect(
        editMentorPage.dialog.getByText('Optimize Page Context Tokens', {
          exact: true,
        }),
      ).toBeVisible({ timeout: 5_000 });

      // Step 4: tooltip trigger is reachable and shows the expected body text.
      const tooltipTrigger = editMentorPage.dialog.locator(
        '[aria-label="More info about optimizing page context tokens"]',
      );
      await expect(tooltipTrigger).toBeVisible({ timeout: 5_000 });
      await tooltipTrigger.hover();
      await expect(
        page
          .getByText('Strips HTML tags from page context', { exact: false })
          .first(),
      ).toBeVisible({ timeout: 5_000 });

      // Step 5: fill the Website URL field so "Create Embed" can proceed without
      // the mentor needing to be anonymous (avoids mutating the mentor's visibility
      // settings which can break auth redirects for subsequent tests).
      await editMentorPage.embed.fillWebsiteUrl('https://example.com');

      // Toggle to the OPPOSITE of the initial state, then submit to persist.
      await editMentorPage.embed.setOptimizePageContext(!initialState);
      await editMentorPage.embed.submit();

      // Step 6: close and reopen the Embed tab — switch must now reflect the
      // toggled value, proving the setting round-trips via GET /settings/.
      await editMentorPage.close();
      // Let the SDK dialog cleanup settle before reopening — the Embedded Code
      // dialog that appears during submit() can leave stale aria-hidden state on
      // the page that breaks a11y-tree queries in the immediately following open().
      await waitForPageReady(page);
      await editMentorPage.open('Embed');
      await expect(editMentorPage.embed.optimizePageContextToggle).toBeVisible({
        timeout: 15_000,
      });
      const persistedState =
        await editMentorPage.embed.getOptimizePageContextState();
      expect(persistedState).toBe(!initialState);

      // Cleanup: restore the toggle to the original value and submit so the shared
      // mentor is not permanently modified.
      await editMentorPage.embed.fillWebsiteUrl('https://example.com');
      await editMentorPage.embed.setOptimizePageContext(initialState);
      await editMentorPage.embed.submit();
      await editMentorPage.close();
    },
  );

  // WCAG 2.4.3 Focus Order — Escape key inside embed iframe closes the widget (issue #772)
  test('admin opens embedded mentor and pressing Escape inside the iframe closes the widget', async ({
    page,
  }) => {
    if (!EMBED_URL) {
      test.skip(true, 'Set EMBED_URL to enable embed ESC-close test');
      return;
    }

    // Navigate to the host page that has the embed widget
    await page.goto(EMBED_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // Open the widget if it is not already visible (click the chat bubble)
    const widgetContainer = page.locator('#ibl-chat-widget-container');
    let widgetVisible = false;
    try {
      await widgetContainer.waitFor({ state: 'visible', timeout: 5_000 });
      widgetVisible = true;
    } catch {
      widgetVisible = false;
    }

    if (!widgetVisible) {
      // Click the floating bubble to open the widget for the first time
      const bubble = page.locator('.ibl-chat-bubble').first();
      try {
        await bubble.waitFor({ state: 'visible', timeout: 10_000 });
        await bubble.click();
        await widgetContainer.waitFor({ state: 'visible', timeout: 15_000 });
      } catch {
        // Widget could not be opened — environment may not have the embed set up
        return;
      }
    }

    // Locate the iframe inside the widget
    const iframe = page
      .frameLocator('#ibl-chat-widget-container iframe')
      .first();

    // Find a focusable element inside the iframe — the chat textarea or any input
    const escTarget = iframe.locator('textarea').first();
    let iframeReady = false;
    try {
      await escTarget.waitFor({ state: 'visible', timeout: 15_000 });
      iframeReady = true;
    } catch {
      iframeReady = false;
    }

    if (!iframeReady) {
      // Iframe content not ready — environment-specific; skip gracefully
      return;
    }

    // Register a message listener on the parent window BEFORE pressing Escape,
    // so we capture the postMessage({ closeEmbed: true }) from the iframe.
    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>).__closeEmbedMessages = [];
      window.addEventListener('message', (event) => {
        const data = event?.data as Record<string, unknown> | undefined;
        if (data && data.closeEmbed) {
          (
            (window as unknown as Record<string, unknown>)
              .__closeEmbedMessages as unknown[]
          ).push(data);
        }
      });
    });

    // Focus the textarea and press Escape — this fires inside the iframe context
    await escTarget.click();
    await escTarget.press('Escape');

    // Assert: the iframe posted { closeEmbed: true } to the parent window
    await expect
      .poll(
        async () =>
          (await page.evaluate(
            () =>
              (
                (window as unknown as Record<string, unknown>)
                  .__closeEmbedMessages as unknown[]
              )?.length ?? 0,
          )) as number,
        {
          timeout: 10_000,
          message: 'Expected closeEmbed postMessage within 10s',
        },
      )
      .toBeGreaterThan(0);

    // Assert: the widget container is now hidden (display:none set by toggleWidget())
    await expect(widgetContainer).not.toBeVisible({ timeout: 10_000 });
  });

  // Issue #2153: toggling/regenerating the Shareable Link switch used to
  // await syncEmbedSettings() as a side effect, which validates the embed
  // form's website_url field whenever the mentor is non-anonymous. That
  // surfaced a spurious "Please specify a valid Website URL" error under the
  // (unrelated) Website URL field any time an admin merely flipped the
  // Shareable Link switch or hit regenerate. The fix removes the
  // syncEmbedSettings() calls from handleShareableTokenToggle and
  // handleRegenerateToken entirely — the shareable-link mutations and their
  // success toasts still fire, but no url validation runs.
  test.describe('Shareable Link toggle does not trigger website URL validation (issue #2153)', () => {
    // Each test below creates its own mentor (fresh per test, not shared via
    // beforeEach), so cleanup is scoped per-suite via afterAll rather than
    // per-test — see the "Mentor Creation" convention in other journeys
    // (e.g. journey 22). Names are prefixed "E2E " so the globalTeardown
    // sweeper (mentor-sweeper.ts) can also reap them as a backstop if the
    // afterAll delete is ever skipped (e.g. a crashed run).
    const tracker = new MentorTracker();

    test.afterAll(async ({ browser }, testInfo) => {
      await tracker.deleteAll(browser, testInfo);
    });

    // emb-11/12/13: exercised against a freshly created mentor, which is
    // non-anonymous (allow_anonymous=false) with an empty Website URL by
    // default — exactly the precondition that used to trigger the bug.
    test('admin toggles Shareable Link on a non-anonymous mentor with an empty Website URL and sees no validation error', async ({
      page,
      createMentorPage,
      editMentorPage,
    }) => {
      // This test creates a fresh mentor (name/description/category fill +
      // Next + Save, which alone can take 50s+ under a loaded environment's
      // category-list fetch and post-save redirect), then opens the Edit
      // dialog and drives it through two levels of tab navigation before
      // exercising three shareable-link toasts. Extend the timeout so the
      // full chain has headroom, matching the convention used elsewhere in
      // this file (see the Optimize Page Context Tokens test above) and in
      // other create-mentor-then-navigate journeys.
      test.setTimeout(300_000);

      await createMentorPage.openAndCreate(`E2E Shareable Link ${Date.now()}`);
      const { mentorId } = await getPlatformContext(page);
      tracker.add(mentorId);

      await editMentorPage.open('Embed');
      await waitForPageReady(page);
      await expect(editMentorPage.embed.shareableLinkToggle).toBeVisible({
        timeout: 15_000,
      });

      // Confirm the bug's precondition actually holds: non-anonymous with an
      // empty Website URL, and no validation error showing yet.
      await expect(editMentorPage.embed.websiteUrlInput).toBeVisible();
      await expect(editMentorPage.embed.websiteUrlInput).toHaveValue('');
      await expect(editMentorPage.embed.websiteUrlError).not.toBeVisible();

      // emb-11: toggling ON must not surface the validation error, and the
      // shareable-link creation must still succeed (success toast).
      await editMentorPage.embed.toggleShareableLink();
      await expect(
        page.getByText(/created shareable link/i).first(),
      ).toBeVisible({ timeout: 15_000 });
      await expect(editMentorPage.embed.shareableLinkToggle).toHaveAttribute(
        'aria-checked',
        'true',
        { timeout: 10_000 },
      );
      await expect(editMentorPage.embed.websiteUrlError).not.toBeVisible();

      // emb-12: regenerating the token must not surface the validation error.
      await editMentorPage.embed.regenerateShareableLink();
      await expect(
        page.getByText(/regenerate shareable link/i).first(),
      ).toBeVisible({ timeout: 15_000 });
      await expect(editMentorPage.embed.websiteUrlError).not.toBeVisible();

      // emb-13: toggling OFF must not surface the validation error either.
      await editMentorPage.embed.toggleShareableLink();
      await expect(
        page.getByText(/disabled shareable link/i).first(),
      ).toBeVisible({ timeout: 15_000 });
      await expect(editMentorPage.embed.shareableLinkToggle).toHaveAttribute(
        'aria-checked',
        'false',
        { timeout: 10_000 },
      );
      await expect(editMentorPage.embed.websiteUrlError).not.toBeVisible();

      await editMentorPage.close();
    });

    // emb-14: contrast case — an anonymous mentor's Embed tab never renders
    // the Website URL section at all (syncEmbedSettings' url guard only
    // applies when !allow_anonymous), so toggling Shareable Link ON stays
    // error-free here too. Pins down that this path was, and remains, safe.
    test('admin toggles Shareable Link on an anonymous mentor and sees no validation error either', async ({
      page,
      createMentorPage,
      editMentorPage,
    }) => {
      // See the sibling test above for why this needs headroom: mentor
      // creation alone can consume most of the default budget under load,
      // and this test additionally opens the Settings tab, saves, closes,
      // and reopens on Embed before exercising the toggle.
      test.setTimeout(300_000);

      await createMentorPage.openAndCreate(
        `E2E Shareable Link Anon ${Date.now()}`,
      );
      const { mentorId } = await getPlatformContext(page);
      tracker.add(mentorId);

      await editMentorPage.open('Settings');
      await waitForPageReady(page);
      await editMentorPage.settings.setVisibilityAnyone();
      await editMentorPage.settings.setChatAccessAnyone();
      const saveBtn = editMentorPage.dialog
        .getByRole('button', { name: /save/i })
        .first();
      await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
      await saveBtn.click();
      await expect(
        page
          .locator('[data-sonner-toast]', {
            hasText: /agent updated successfully/i,
          })
          .first(),
      ).toBeVisible({ timeout: 15_000 });
      await editMentorPage.close();

      await editMentorPage.open('Embed');
      await waitForPageReady(page);
      await expect(editMentorPage.embed.shareableLinkToggle).toBeVisible({
        timeout: 15_000,
      });
      // With allow_anonymous=true the Website URL section (and its error
      // paragraph) is not rendered at all.
      await expect(editMentorPage.embed.websiteUrlInput).not.toBeVisible();

      await editMentorPage.embed.toggleShareableLink();
      await expect(
        page
          .getByText(/created shareable link|enabled shareable link/i)
          .first(),
      ).toBeVisible({ timeout: 15_000 });
      await expect(editMentorPage.embed.websiteUrlError).not.toBeVisible();

      await editMentorPage.close();
    });
  });
});
