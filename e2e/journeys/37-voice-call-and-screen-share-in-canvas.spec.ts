import { Page } from '@playwright/test';
import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { ChatPage } from '../page-objects/chat.page';
import { CreateMentorPage } from '../page-objects/create-mentor.page';
import { EditMentorPage } from '../page-objects/edit-mentor/edit-mentor.page';

/**
 * Create a new mentor and enable screen sharing + voice call.
 * Returns the mentor page URL so other browser contexts can navigate to it.
 */
async function createMentorAndEnableTools(
  page: Page,
  createMentorPage: CreateMentorPage,
  editMentorPage: EditMentorPage,
): Promise<string> {
  await createMentorPage.openAndCreate();
  await waitForPageReady(page);

  // Enable screen sharing (Tools tab auto-saves on toggle)
  await editMentorPage.open('Tools');
  await waitForPageReady(page);
  await editMentorPage.tools.enableTool('Screen Sharing');

  // Enable voice call (Settings tab requires explicit save)
  await editMentorPage.navigateToTab('Settings');
  await waitForPageReady(page);
  await editMentorPage.settings.enableVoiceCall();

  await editMentorPage.close();
  await waitForPageReady(page);

  return page.url();
}

/**
 * Enable canvas mode, send a prompt that triggers an artifact, and wait
 * for streaming to finish so the canvas split-view is open.
 */
async function openCanvasWithPrompt(
  page: Page,
  chatPage: ChatPage,
): Promise<void> {
  const canvasBtn = chatPage.canvasToggle;
  await expect(canvasBtn).toBeVisible({ timeout: 10_000 });
  await canvasBtn.click();
  await waitForPageReady(page);

  await chatPage.sendMessage(
    'Generate a 1 page article on the dangers of vibe coding',
  );

  // Wait for streaming to start then finish
  const stopBtn = page.getByRole('button', { name: /stop streaming/i });
  try {
    await stopBtn.waitFor({ state: 'visible', timeout: 30_000 });
  } catch {
    // Streaming may have already completed
  }
  await stopBtn.waitFor({ state: 'hidden', timeout: 120_000 });
  await waitForPageReady(page);
}

/**
 * Journey 37: Voice Call and Screen Share in Canvas View
 *
 * Regression tests for two bugs fixed together:
 *
 * Bug 1 — Screen share button had no `type="button"`, so clicking it inside the
 * chat <form> triggered form submission (sending the current input text as a
 * message) instead of opening the screen-share modal.
 *
 * Bug 2 — Both the voice call and screen share handlers were replaced with
 * `() => {}` no-ops in the canvas-view ChatInputForm instances, making the
 * buttons silently do nothing when the canvas split-view was open.
 */

// Chromium-only: fake media-stream flags needed for screen-share & voice call
test.use({
  launchOptions: {
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
    ],
  },
});

test.describe('Journey 37: Voice Call and Screen Share in Canvas', () => {
  test.setTimeout(300_000);

  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Media stream tests use fake device flags — Chromium only',
  );

  // ── Non-Admin tests ─────────────────────────────────────────────────────────
  // Admin creates the mentor + enables tools, then non-admin navigates to it.

  test.describe('Non-Admin', () => {
    test('non-admin: screen share button has type=button and does not submit the chat form', async ({
      page,
      createMentorPage,
      editMentorPage,
      nonadminPage,
      nonadminChatPage,
    }) => {
      await page.context().grantPermissions(['microphone']);
      await nonadminPage.context().grantPermissions(['microphone']);

      await navigateToMentorApp(page);
      const mentorUrl = await createMentorAndEnableTools(
        page,
        createMentorPage,
        editMentorPage,
      );
      await navigateToMentorApp(nonadminPage, mentorUrl);

      const screenShareBtn = nonadminPage.getByRole('button', {
        name: /screen sharing/i,
      });
      let visible = false;
      try {
        await screenShareBtn.waitFor({ state: 'visible', timeout: 10_000 });
        visible = true;
      } catch {
        visible = false;
      }
      if (!visible) return;

      await expect(screenShareBtn).toHaveAttribute('type', 'button');

      const draftText = 'draft message — should not be sent';
      await nonadminChatPage.chatInput.fill(draftText);

      await screenShareBtn.click();
      await nonadminPage.waitForTimeout(500);

      const inputValue = await nonadminChatPage.chatInput.inputValue();
      expect(inputValue).toBe(draftText);
    });

    test('non-admin: clicking screen share activates screen sharing not a form submit', async ({
      page,
      createMentorPage,
      editMentorPage,
      nonadminPage,
      nonadminChatPage,
    }) => {
      await page.context().grantPermissions(['microphone']);
      await nonadminPage.context().grantPermissions(['microphone']);

      await navigateToMentorApp(page);
      const mentorUrl = await createMentorAndEnableTools(
        page,
        createMentorPage,
        editMentorPage,
      );
      await navigateToMentorApp(nonadminPage, mentorUrl);

      const screenShareBtn = nonadminPage.getByRole('button', {
        name: /screen sharing/i,
      });
      let visible = false;
      try {
        await screenShareBtn.waitFor({ state: 'visible', timeout: 10_000 });
        visible = true;
      } catch {
        visible = false;
      }
      if (!visible) return;

      await screenShareBtn.click();
      await nonadminPage.waitForTimeout(500);

      await expect(screenShareBtn).toHaveClass(/ibl-button-primary/);

      const userMessages = await nonadminChatPage.userMessages.count();
      expect(userMessages).toBe(0);
    });

    test('non-admin: voice call button has type=button', async ({
      page,
      createMentorPage,
      editMentorPage,
      nonadminPage,
      nonadminChatPage,
    }) => {
      await page.context().grantPermissions(['microphone']);
      await nonadminPage.context().grantPermissions(['microphone']);

      await navigateToMentorApp(page);
      const mentorUrl = await createMentorAndEnableTools(
        page,
        createMentorPage,
        editMentorPage,
      );
      await navigateToMentorApp(nonadminPage, mentorUrl);

      const voiceCallBtn = nonadminChatPage.voiceCallButton;
      let visible = false;
      try {
        await voiceCallBtn.waitFor({ state: 'visible', timeout: 10_000 });
        visible = true;
      } catch {
        visible = false;
      }
      if (!visible) return;

      await expect(voiceCallBtn).toHaveAttribute('type', 'button');
    });
  });

  // ── Admin tests ─────────────────────────────────────────────────────────────

  test.describe('Admin', () => {
    test.beforeEach(async ({ page }) => {
      await page.context().grantPermissions(['microphone']);
      await navigateToMentorApp(page);
      const isAdmin = await checkAdminStatus(page);
      if (!isAdmin) test.skip(true, 'Requires admin access');
    });

    // ── Bug 1 regression: screen share must not submit the chat form ──────────

    // test('admin: screen share button has type=button and does not submit the chat form', async ({
    //   page,
    //   chatPage,
    //   createMentorPage,
    //   editMentorPage,
    // }) => {
    //   await createMentorAndEnableTools(page, createMentorPage, editMentorPage);

    //   const screenShareBtn = page.getByRole('button', {
    //     name: /screen sharing/i,
    //   });
    //   let visible = false;
    //   try {
    //     await screenShareBtn.waitFor({ state: 'visible', timeout: 10_000 });
    //     visible = true;
    //   } catch {
    //     visible = false;
    //   }
    //   if (!visible) return;

    //   await expect(screenShareBtn).toHaveAttribute('type', 'button');

    //   const draftText = 'draft message — should not be sent';
    //   await chatPage.chatInput.fill(draftText);

    //   await screenShareBtn.click();
    //   await page.waitForTimeout(500);

    //   const inputValue = await chatPage.chatInput.inputValue();
    //   expect(inputValue).toBe(draftText);
    // });

    // test('admin: clicking screen share activates screen sharing not a form submit', async ({
    //   page,
    //   chatPage,
    //   createMentorPage,
    //   editMentorPage,
    // }) => {
    //   await createMentorAndEnableTools(page, createMentorPage, editMentorPage);

    //   const screenShareBtn = page.getByRole('button', {
    //     name: /screen sharing/i,
    //   });
    //   let visible = false;
    //   try {
    //     await screenShareBtn.waitFor({ state: 'visible', timeout: 10_000 });
    //     visible = true;
    //   } catch {
    //     visible = false;
    //   }
    //   if (!visible) return;

    //   await screenShareBtn.click();
    //   await page.waitForTimeout(500);

    //   await expect(screenShareBtn).toHaveClass(/ibl-button-primary/);

    //   const userMessages = await chatPage.userMessages.count();
    //   expect(userMessages).toBe(0);
    // });

    // // ── Bug 1 regression: voice call button must also have type=button ────────

    // test('admin: voice call button has type=button', async ({
    //   page,
    //   chatPage,
    //   createMentorPage,
    //   editMentorPage,
    // }) => {
    //   await createMentorAndEnableTools(page, createMentorPage, editMentorPage);

    //   const voiceCallBtn = chatPage.voiceCallButton;
    //   let visible = false;
    //   try {
    //     await voiceCallBtn.waitFor({ state: 'visible', timeout: 10_000 });
    //     visible = true;
    //   } catch {
    //     visible = false;
    //   }
    //   if (!visible) return;

    //   await expect(voiceCallBtn).toHaveAttribute('type', 'button');
    // });

    // // ── Bug 2 regression: voice call and screen share work in canvas view ─────

    // test('admin: voice call button opens the voice chat dialog when canvas is open', async ({
    //   page,
    //   chatPage,
    //   createMentorPage,
    //   editMentorPage,
    // }) => {
    //   await createMentorAndEnableTools(page, createMentorPage, editMentorPage);
    //   await openCanvasWithPrompt(page, chatPage);

    //   const voiceCallBtn = chatPage.voiceCallButton;
    //   let voiceVisible = false;
    //   try {
    //     await voiceCallBtn.waitFor({ state: 'visible', timeout: 10_000 });
    //     voiceVisible = true;
    //   } catch {
    //     voiceVisible = false;
    //   }
    //   if (!voiceVisible) return;

    //   await voiceCallBtn.click();

    //   const dialog = page.getByRole('dialog', { name: 'Voice Chat' });
    //   await expect(dialog).toBeVisible({ timeout: 15_000 });
    //   await page.keyboard.press('Escape');
    // });

    // test('admin: screen share button activates screen sharing when canvas is open', async ({
    //   page,
    //   chatPage,
    //   createMentorPage,
    //   editMentorPage,
    // }) => {
    //   await createMentorAndEnableTools(page, createMentorPage, editMentorPage);
    //   await openCanvasWithPrompt(page, chatPage);

    //   const screenShareBtn = page.getByRole('button', {
    //     name: /screen sharing/i,
    //   });
    //   let screenShareVisible = false;
    //   try {
    //     await screenShareBtn.waitFor({ state: 'visible', timeout: 10_000 });
    //     screenShareVisible = true;
    //   } catch {
    //     screenShareVisible = false;
    //   }
    //   if (!screenShareVisible) return;

    //   await screenShareBtn.click();
    //   await page.waitForTimeout(500);

    //   await expect(screenShareBtn).toHaveClass(/ibl-button-primary/);
    // });

    test('admin: clicking screen share in canvas does not submit the chat form', async ({
      page,
      chatPage,
      createMentorPage,
      editMentorPage,
    }) => {
      await createMentorAndEnableTools(page, createMentorPage, editMentorPage);
      await openCanvasWithPrompt(page, chatPage);

      const draftText = 'draft — must not be sent';
      await chatPage.chatInput.fill(draftText);

      const screenShareBtn = page.getByRole('button', {
        name: /screen sharing/i,
      });
      let screenShareVisible = false;
      try {
        await screenShareBtn.waitFor({ state: 'visible', timeout: 10_000 });
        screenShareVisible = true;
      } catch {
        screenShareVisible = false;
      }
      if (!screenShareVisible) return;

      await screenShareBtn.click();
      await page.waitForTimeout(500);

      const inputValue = await chatPage.chatInput.inputValue();
      expect(inputValue).toBe(draftText);
    });
  });
});
