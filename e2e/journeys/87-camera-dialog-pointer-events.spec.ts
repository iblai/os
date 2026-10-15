import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import type { ChatPage } from '../page-objects/chat.page';
import { CameraCapturePage } from '../page-objects/camera-capture.page';

/**
 * Journey 87: Camera dialog leaves the page clickable
 *
 * Regression: composer "+" -> Camera opens the SDK `CameraCaptureDialog` from
 * the menu item's `onSelect`. The "+" DropdownMenu and the Dialog use separate
 * copies of Radix DismissableLayer, so the dialog captured
 * `body { pointer-events: none }` (set by the still-closing menu) as the body's
 * "original" value and restored it on close, freezing every click on the page.
 * The fix opens the camera only after the menu has fully closed.
 *
 * Fake camera (Chromium only, desktop; mobile uses the native file picker) is
 * scoped to this file via `test.use`; no other spec is affected. The photo
 * upload is never asserted: against some environments it fails (S3 CORS) and
 * leaves a failed-attachment chip, which the flow removes.
 */

test.use({
  viewport: { width: 1440, height: 900 },
  permissions: ['camera'],
  launchOptions: {
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
    ],
  },
});

test.describe('Journey 87: Camera dialog leaves the page clickable', () => {
  let ws: Awaited<ReturnType<ChatPage['mockChatWebSocket']>>;

  test.beforeEach(async ({ page, chatPage, browserName }) => {
    test.skip(
      browserName !== 'chromium',
      'Fake camera flags are Chromium-only',
    );
    ws = await chatPage.mockChatWebSocket();
    await navigateToMentorApp(page);
    await waitForPageReady(page);
    await expect(chatPage.getComposerTextarea()).toBeVisible({
      timeout: 30_000,
    });
  });

  async function expectPageUsable(
    camera: CameraCapturePage,
    page: import('@playwright/test').Page,
    chatPage: ChatPage,
  ) {
    await expect(camera.dialog).toBeHidden();
    await expect
      .poll(() => camera.bodyPointerEvents(), {
        message: 'body must not keep pointer-events: none after the dialog',
      })
      .not.toBe('none');

    const composer = chatPage.getComposerTextarea();
    await composer.click();
    await page.keyboard.type('still clickable');
    await expect(composer).toHaveValue('still clickable');

    await camera.plusButton.click();
    await expect(camera.cameraMenuItem).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(camera.cameraMenuItem).toBeHidden();
  }

  test('user captures a photo with the camera, taps Use photo, and the page stays clickable', async ({
    page,
    chatPage,
  }) => {
    const camera = new CameraCapturePage(page);
    await camera.openFromPlusMenu();
    await expect(camera.dialog).toBeVisible();
    await camera.waitForLiveFeed();

    await camera.captureButton.click();
    await camera.usePhotoButton.click();

    // The upload outcome is not under test; drop the chip so it can't block the send.
    await chatPage.getRemoveFileButton().first().click();
    await expect(chatPage.attachmentChip).toHaveCount(0);

    await expectPageUsable(camera, page, chatPage);
  });

  test('user opens the camera, captures, presses Escape, and the page stays clickable', async ({
    page,
    chatPage,
  }) => {
    const camera = new CameraCapturePage(page);
    await camera.openFromPlusMenu();
    await expect(camera.dialog).toBeVisible();
    await camera.waitForLiveFeed();

    await camera.captureButton.click();
    await expect(camera.usePhotoButton).toBeVisible();
    await page.keyboard.press('Escape');

    await expectPageUsable(camera, page, chatPage);
  });

  test('user retakes a photo, uses it, and can still send a message', async ({
    page,
    chatPage,
  }) => {
    const camera = new CameraCapturePage(page);
    await camera.openFromPlusMenu();
    await camera.waitForLiveFeed();

    await camera.captureButton.click();
    await camera.retakeButton.click();
    await camera.waitForLiveFeed();
    await camera.captureButton.click();
    await camera.usePhotoButton.click();

    await chatPage.getRemoveFileButton().first().click();
    await expect(chatPage.attachmentChip).toHaveCount(0);

    await expectPageUsable(camera, page, chatPage);

    await chatPage.getComposerTextarea().fill('hello after camera');
    await expect(chatPage.sendButton).toBeEnabled();
    await chatPage.sendButton.click();
    const frame = await ws.waitForClientMessage();
    expect(String(frame.prompt)).toContain('hello after camera');
    await expect(chatPage.userMessages.last()).toContainText(
      'hello after camera',
    );
  });
});
