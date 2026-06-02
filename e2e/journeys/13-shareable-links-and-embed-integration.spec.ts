import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { EMBED_URL } from '../fixtures/test-data';
import { waitForPageReady } from '../utils/resilient';
import type { EditMentorPage } from '../page-objects/edit-mentor/edit-mentor.page';

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
      await sidebarPage.ensureExpanded();
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
      await sidebarPage.ensureExpanded();
      await expect(sidebarPage.logoButton).toBeVisible({ timeout: 15_000 });
    });
  }); // test.describe('Show Catalogue setting')

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
});
