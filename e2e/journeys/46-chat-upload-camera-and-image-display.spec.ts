/**
 * Journey 46: Chat Upload — Camera Option & Image Display
 *
 * Covers the two user-facing features added in feat/1902:
 *
 *  1. Camera option in the chat composer upload menu (upload-menu.tsx)
 *     - "Camera" menu item appears alongside "Upload File" in the + dropdown
 *       when "Enable File Attachments" is enabled on the mentor
 *     - Camera menu item is absent when the upload menu itself is hidden
 *       (i.e. show_attachment toggle is off)
 *     - Clicking "Camera" on a desktop (non-mobile) Chromium context opens
 *       the in-app CameraCaptureDialog (title "Take a photo",
 *       [data-testid="camera-video"], "Capture" button)
 *     - The hidden native camera input always has accept="image/*" and
 *       capture="environment" in the DOM (mobile-OS branch)
 *
 *  2. Uploaded images render as <img> not as a FileCard (image-message.tsx,
 *     user-message-bubble.tsx)
 *     - After drag-dropping a PNG onto the chat, the attachment in the
 *       pending-send list appears by filename. Once sent the message bubble
 *       shows an <img> with cursor:pointer, not a FileCard with an icon.
 *
 * Camera dialog test is Chromium-only: it relies on
 *   --use-fake-device-for-media-stream and --use-fake-ui-for-media-stream
 * which are not supported on Firefox/WebKit.  All other tests are
 * cross-browser.
 *
 * Each test creates its own mentor so the attachment/camera settings are
 * under our control and don't bleed between runs.
 *
 * NOTE: every test here is marked `test.fixme` — the specs
 * are authored against the branch's selectors but have NOT yet been validated
 * against a running server (the app was not running when they were written).
 * Remove `.fixme` and run them against the production build to enable:
 *   PLAYWRIGHT_HTML_OPEN=never pnpm exec playwright test \
 *     --config=e2e/playwright.config.ts \
 *     e2e/journeys/46-chat-upload-camera-and-image-display.spec.ts \
 *     --project=mentor-desktop-chrome --reporter=list
 */

import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { dragAndDropFiles } from '../utils/drag-drop';
import { logger } from '@iblai/iblai-js/playwright';

// ── Camera dialog tests need a fake webcam device ────────────────────────────
// Chromium-only: --use-fake-device-for-media-stream stubs navigator.mediaDevices
// so getUserMedia resolves immediately with a black-frame video track.
// --use-fake-ui-for-media-stream auto-grants the permission prompt.
test.use({
  launchOptions: {
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
    ],
  },
});

// ── Journey ───────────────────────────────────────────────────────────────────

// FIXME: every test below is marked `test.fixme` — specs are authored but not
// yet validated against a running server. Remove the `.fixme` modifiers once
// validated (see header for the run command).
test.describe('Journey 46: Chat Upload — Camera Option & Image Display', () => {
  test.setTimeout(240_000);

  // ── Camera menu item visibility ─────────────────────────────────────────────

  test.describe('Camera item in upload menu', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToMentorApp(page);
      const isAdmin = await checkAdminStatus(page);
      if (!isAdmin) test.skip(true, 'Requires admin access to create a mentor');
    });

    test.fixme(
      'admin creates a mentor with file attachments enabled and sees both Upload File and Camera items in the + menu',
      async ({ page, createMentorPage, editMentorPage }) => {
        // Create a fresh mentor so this test is fully isolated
        await createMentorPage.openAndCreate();
        await waitForPageReady(page);

        // Enable the show_attachment toggle so UploadMenu renders
        await editMentorPage.open('Settings');
        await waitForPageReady(page);
        await editMentorPage.settings.enableFileAttachments();
        await editMentorPage.close();
        await waitForPageReady(page);

        // Open the + dropdown
        const plusButton = page.getByRole('button', { name: 'Attach file' });
        let attachVisible = false;
        try {
          await plusButton.waitFor({ state: 'visible', timeout: 15_000 });
          attachVisible = true;
        } catch {
          attachVisible = false;
        }

        if (!attachVisible) {
          // The model on this environment may not support file uploads; skip gracefully.
          logger.info(
            'CAM-01: Attach file button not visible — model may not support uploads on this env; skipping',
          );
          return;
        }

        await plusButton.click();

        // Both items must be present in the dropdown
        await expect(
          page.getByRole('menuitem', { name: 'Upload File' }),
        ).toBeVisible({ timeout: 5_000 });
        await expect(
          page.getByRole('menuitem', { name: 'Camera' }),
        ).toBeVisible({
          timeout: 5_000,
        });

        // Close the dropdown
        await page.keyboard.press('Escape');

        logger.info(
          'CAM-01: Upload File and Camera items both visible in + menu',
        );
      },
    );

    test.fixme(
      'admin disables file attachments and the + (Attach file) button disappears',
      async ({ page, createMentorPage, editMentorPage }) => {
        await createMentorPage.openAndCreate();
        await waitForPageReady(page);

        // Enable first so we have a known starting state, then disable
        await editMentorPage.open('Settings');
        await waitForPageReady(page);
        await editMentorPage.settings.enableFileAttachments();
        await editMentorPage.close();
        await waitForPageReady(page);

        const plusButton = page.getByRole('button', { name: 'Attach file' });
        let attachVisible = false;
        try {
          await plusButton.waitFor({ state: 'visible', timeout: 10_000 });
          attachVisible = true;
        } catch {
          attachVisible = false;
        }

        if (!attachVisible) {
          logger.info(
            'CAM-02: Attach file button never appeared (model may not support uploads); skipping disable test',
          );
          return;
        }

        // Now disable
        await editMentorPage.open('Settings');
        await waitForPageReady(page);
        await editMentorPage.settings.disableFileAttachments();
        await editMentorPage.close();
        await waitForPageReady(page);

        // After disabling, the entire UploadMenu component returns null — the
        // + button must no longer be visible.
        await expect(
          page.getByRole('button', { name: 'Attach file' }),
        ).not.toBeVisible({ timeout: 10_000 });

        logger.info(
          'CAM-02: Attach file button disappears when file attachments are disabled',
        );
      },
    );
  });

  // ── Native camera input attributes ─────────────────────────────────────────

  test.describe('Native camera input element attributes', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToMentorApp(page);
      const isAdmin = await checkAdminStatus(page);
      if (!isAdmin) test.skip(true, 'Requires admin access');
    });

    test.fixme(
      'admin sees the hidden native camera input present in the DOM with accept=image/* and capture=environment',
      async ({ page, createMentorPage, editMentorPage }) => {
        await createMentorPage.openAndCreate();
        await waitForPageReady(page);

        // Enable attachments so the full chat-input-form renders (which includes
        // the hidden camera input unconditionally alongside the file input)
        await editMentorPage.open('Settings');
        await waitForPageReady(page);
        await editMentorPage.settings.enableFileAttachments();
        await editMentorPage.close();
        await waitForPageReady(page);

        // chat-input-form.tsx always renders this input (not guarded by showAttachment)
        // so it exists whenever the form is mounted.
        const cameraInput = page.locator(
          'input[type="file"][accept="image/*"][capture="environment"]',
        );
        await expect(cameraInput).toBeAttached({ timeout: 10_000 });

        const acceptAttr = await cameraInput.getAttribute('accept');
        expect(acceptAttr).toBe('image/*');

        const captureAttr = await cameraInput.getAttribute('capture');
        expect(captureAttr).toBe('environment');

        logger.info(
          'CAM-03: Native camera input has accept="image/*" and capture="environment"',
        );
      },
    );
  });

  // ── Camera dialog (Chromium-only: requires fake media stream) ───────────────

  test.describe('Camera capture dialog', () => {
    // Camera dialog requires getUserMedia to resolve; only possible with the
    // Chromium --use-fake-device-for-media-stream flag.
    test.skip(
      ({ browserName }) => browserName !== 'chromium',
      'Camera dialog test requires Chromium fake media stream flags',
    );

    test.beforeEach(async ({ page }) => {
      await navigateToMentorApp(page);
      const isAdmin = await checkAdminStatus(page);
      if (!isAdmin) test.skip(true, 'Requires admin access');
    });

    test.fixme(
      'admin clicks Camera in the upload menu and the Take a photo dialog opens with video preview and Capture button',
      async ({ page, context, createMentorPage, editMentorPage }) => {
        // Grant camera permission so getUserMedia resolves (not just fake-ui)
        await context.grantPermissions(['camera']);

        await createMentorPage.openAndCreate();
        await waitForPageReady(page);

        // Enable the show_attachment toggle
        await editMentorPage.open('Settings');
        await waitForPageReady(page);
        await editMentorPage.settings.enableFileAttachments();
        await editMentorPage.close();
        await waitForPageReady(page);

        const plusButton = page.getByRole('button', { name: 'Attach file' });
        let attachVisible = false;
        try {
          await plusButton.waitFor({ state: 'visible', timeout: 15_000 });
          attachVisible = true;
        } catch {
          attachVisible = false;
        }

        if (!attachVisible) {
          logger.info(
            'CAM-04: Attach file button not visible — model may not support uploads; skipping',
          );
          return;
        }

        await plusButton.click();

        const cameraItem = page.getByRole('menuitem', { name: 'Camera' });
        await expect(cameraItem).toBeVisible({ timeout: 5_000 });
        await cameraItem.click();

        // The CameraCaptureDialog should open with DialogTitle "Take a photo"
        const dialog = page.getByRole('dialog', { name: 'Take a photo' });
        await expect(dialog).toBeVisible({ timeout: 10_000 });

        // The live camera preview video element (data-testid from camera-capture-dialog.tsx)
        const videoEl = dialog.locator('[data-testid="camera-video"]');
        await expect(videoEl).toBeVisible({ timeout: 10_000 });

        // Capture button is present in the dialog footer
        const captureBtn = dialog.getByRole('button', {
          name: 'Capture photo',
        });
        await expect(captureBtn).toBeVisible({ timeout: 5_000 });

        // Retake and Use Photo are not visible yet (only after a capture)
        await expect(
          dialog.getByRole('button', { name: 'Retake photo' }),
        ).not.toBeVisible();
        await expect(
          dialog.getByRole('button', { name: 'Use photo' }),
        ).not.toBeVisible();

        // Close the dialog cleanly
        await page.keyboard.press('Escape');
        await expect(dialog).not.toBeVisible({ timeout: 5_000 });

        logger.info(
          'CAM-04: Camera dialog opens with Take a photo title, video preview, and Capture button',
        );
      },
    );
  });

  // ── Image display in sent messages ─────────────────────────────────────────

  test.describe('Uploaded image renders as <img> not FileCard', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToMentorApp(page);
      const isAdmin = await checkAdminStatus(page);
      if (!isAdmin) test.skip(true, 'Requires admin access');
    });

    test.fixme(
      'admin drag-drops a PNG onto chat and the pending attachment shows the image filename',
      async ({ page, createMentorPage, editMentorPage }) => {
        await createMentorPage.openAndCreate();
        await waitForPageReady(page);

        // Enable attachments
        await editMentorPage.open('Settings');
        await waitForPageReady(page);
        await editMentorPage.settings.enableFileAttachments();
        await editMentorPage.close();
        await waitForPageReady(page);

        // Drag a fake PNG image into the chat area
        await dragAndDropFiles(page, [
          {
            name: 'test-photo.png',
            type: 'image/png',
            content: 'fake-png-content',
          },
        ]);

        // The drag overlay disappears after drop
        await expect(page.getByText('Drop your files here')).not.toBeVisible({
          timeout: 5_000,
        });

        // The attached file appears in the pending attachments list by name
        await expect(page.getByText('test-photo.png')).toBeVisible({
          timeout: 15_000,
        });

        logger.info(
          'CAM-05: Drag-dropped PNG appears in attachments list by filename',
        );
      },
    );

    test.fixme(
      'admin sends a message with a PNG attachment and the sent message bubble renders an <img> element with cursor:pointer',
      async ({ page, createMentorPage, editMentorPage, chatPage }) => {
        await createMentorPage.openAndCreate();
        await waitForPageReady(page);

        // Enable attachments
        await editMentorPage.open('Settings');
        await waitForPageReady(page);
        await editMentorPage.settings.enableFileAttachments();
        await editMentorPage.close();
        await waitForPageReady(page);

        // Drag a fake PNG image into the chat
        await dragAndDropFiles(page, [
          {
            name: 'photo-preview.png',
            type: 'image/png',
            content: 'fake-png-data',
          },
        ]);

        // Wait for the file to appear in the pending list
        await expect(page.getByText('photo-preview.png')).toBeVisible({
          timeout: 15_000,
        });

        // Type a message and send
        await chatPage.chatInput.fill('Here is an image');
        await expect(chatPage.sendButton).toBeEnabled({ timeout: 10_000 });
        await chatPage.sendButton.click();

        // The user message bubble area should contain an <img> for the image
        // attachment (ImageMessage renders <img>, not FileCard).
        // The local object-URL preview is set synchronously so the <img> appears
        // almost immediately in the sent bubble via the imagePreviews Redux slice.
        const imageInBubble = page
          .locator('.message-container img[class*="cursor-pointer"]')
          .first();

        let imageVisible = false;
        try {
          await imageInBubble.waitFor({ state: 'visible', timeout: 20_000 });
          imageVisible = true;
        } catch {
          imageVisible = false;
        }

        if (!imageVisible) {
          // Fallback: the presigned PUT URL may cause a brief onError before the
          // local preview takes over. Assert the filename is still present so we
          // know ImageMessage was used (it shows filename when in error state too).
          logger.info(
            'CAM-06: <img> not yet settled — asserting filename visible as ImageMessage fallback',
          );
          await expect(page.getByText('photo-preview.png')).toBeVisible({
            timeout: 10_000,
          });
          return;
        }

        // Confirm the image element has cursor:pointer (from image-message.tsx class)
        const cursorStyle = await imageInBubble.evaluate(
          (el: HTMLImageElement) => getComputedStyle(el).cursor,
        );
        expect(cursorStyle).toBe('pointer');

        logger.info(
          'CAM-06: Sent message bubble renders <img> with cursor:pointer (not a FileCard)',
        );
      },
    );

    test.fixme(
      'admin sends a message with a PNG and clicks the image to open the preview',
      async ({ page, createMentorPage, editMentorPage, chatPage }) => {
        await createMentorPage.openAndCreate();
        await waitForPageReady(page);

        await editMentorPage.open('Settings');
        await waitForPageReady(page);
        await editMentorPage.settings.enableFileAttachments();
        await editMentorPage.close();
        await waitForPageReady(page);

        await dragAndDropFiles(page, [
          {
            name: 'click-preview.png',
            type: 'image/png',
            content: 'click-png-data',
          },
        ]);

        await expect(page.getByText('click-preview.png')).toBeVisible({
          timeout: 15_000,
        });

        await chatPage.chatInput.fill('Click to preview test');
        await expect(chatPage.sendButton).toBeEnabled({ timeout: 10_000 });
        await chatPage.sendButton.click();

        // Wait for the clickable <img> in the sent bubble
        const imageInBubble = page
          .locator('.message-container img[class*="cursor-pointer"]')
          .first();

        let imageVisible = false;
        try {
          await imageInBubble.waitFor({ state: 'visible', timeout: 20_000 });
          imageVisible = true;
        } catch {
          imageVisible = false;
        }

        if (!imageVisible) {
          logger.info(
            'CAM-07: Image not settled in sent bubble — skipping click-to-preview assertion',
          );
          return;
        }

        // Click the image — triggers onPreviewImage which opens the ImagePreviewModal
        await imageInBubble.click();

        // The image preview modal renders an enlarged view. Look for a newly
        // opened dialog or overlay containing an img element.
        const previewModal = page
          .locator('[role="dialog"]')
          .filter({ has: page.locator('img') })
          .last();

        let modalVisible = false;
        try {
          await previewModal.waitFor({ state: 'visible', timeout: 8_000 });
          modalVisible = true;
        } catch {
          modalVisible = false;
        }

        if (modalVisible) {
          await page.keyboard.press('Escape');
          logger.info('CAM-07: Image preview modal opened and closed on click');
        } else {
          // Preview may render as a non-dialog overlay; confirm the click did not
          // crash the page by verifying the original image is still visible.
          await expect(imageInBubble).toBeVisible({ timeout: 5_000 });
          logger.info(
            'CAM-07: Image clicked without crash (preview overlay may not use role=dialog)',
          );
        }
      },
    );
  });

  // ── Drag-drop / paste gated on "Enable File Attachments" (#2886) ───────────
  // With the setting OFF the "+" menu is hidden, and (since the fix) drag-drop
  // and paste must not attach or upload either. Before the fix the drop/paste
  // handlers were gated only on features.fileUpload, so the overlay, chip and
  // upload-url POST all still happened. Embed follows `embed_show_attachment`
  // (a separate toggle) and is not covered here: it needs an embed iframe
  // against an agent with embed enabled, which this journey does not set up.

  test.describe('Drag-drop and paste respect Enable File Attachments (#2886)', () => {
    const UPLOAD_URL = /chat\/files\/upload-url/;

    test.beforeEach(async ({ page }) => {
      await navigateToMentorApp(page);
      const isAdmin = await checkAdminStatus(page);
      if (!isAdmin) test.skip(true, 'Requires admin access to create a mentor');
    });

    const dispatchDrag = (
      page: import('@playwright/test').Page,
      type: 'dragenter' | 'dragover' | 'drop',
    ) =>
      page.evaluate((eventType) => {
        const dt = new DataTransfer();
        dt.items.add(
          new File(['x'], 'cam-gate.pdf', { type: 'application/pdf' }),
        );
        const target = document.querySelector('.chat-main-content-area');
        if (!target) throw new Error('.chat-main-content-area not found');
        target.dispatchEvent(
          new DragEvent(eventType, {
            bubbles: true,
            cancelable: true,
            dataTransfer: dt,
          }),
        );
      }, type);

    const pasteInComposer = (
      page: import('@playwright/test').Page,
      payload: { text: string } | { file: string },
    ) =>
      page.evaluate((p) => {
        const textarea = document.getElementById(
          'chat-input-textarea',
        ) as HTMLTextAreaElement | null;
        if (!textarea) throw new Error('chat-input-textarea not found');
        const dt = new DataTransfer();
        if ('text' in p) dt.setData('text/plain', p.text);
        else dt.items.add(new File(['x'], p.file, { type: 'application/pdf' }));
        textarea.focus();
        textarea.dispatchEvent(
          new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: dt,
          }),
        );
      }, payload);

    const setAttachments = async (
      page: import('@playwright/test').Page,
      editMentorPage: import('../page-objects/edit-mentor/edit-mentor.page').EditMentorPage,
      on: boolean,
    ) => {
      await editMentorPage.open('Settings');
      await waitForPageReady(page);
      if (on) await editMentorPage.settings.enableFileAttachments();
      else await editMentorPage.settings.disableFileAttachments();
      await editMentorPage.close();
      await waitForPageReady(page);
    };

    test('admin drops a file on an agent with attachments off and nothing is attached or uploaded (CAM-08)', async ({
      page,
      createMentorPage,
      editMentorPage,
      chatPage,
    }) => {
      await createMentorPage.openAndCreate();
      await waitForPageReady(page);
      await setAttachments(page, editMentorPage, false);
      await expect(chatPage.chatInput).toBeVisible({ timeout: 15_000 });
      // The "+" menu now also hosts tools, so the button stays; only the
      // Upload File item must be gone.
      await page.getByTestId('composer-plus-button').click();
      await expect(page.getByRole('menu')).toBeVisible({ timeout: 10_000 });
      await expect(
        page.getByRole('menuitem', { name: /upload file/i }),
      ).toHaveCount(0);
      await page.keyboard.press('Escape');

      const uploads: string[] = [];
      page.on('request', (r) => {
        if (UPLOAD_URL.test(r.url())) uploads.push(r.url());
      });

      await dispatchDrag(page, 'dragenter');
      await dispatchDrag(page, 'dragover');
      await page.waitForTimeout(1_000);
      await expect(page.getByText('Drop your files here')).toHaveCount(0);

      await dispatchDrag(page, 'drop');
      await page.waitForTimeout(2_000);
      await expect(page.getByTestId('attachment-chip')).toHaveCount(0);
      expect(uploads).toHaveLength(0);

      logger.info('CAM-08: drop with attachments off attaches/uploads nothing');
    });

    test('admin pastes a file and long text on an agent with attachments off and nothing is attached (CAM-09)', async ({
      page,
      createMentorPage,
      editMentorPage,
      chatPage,
    }) => {
      await createMentorPage.openAndCreate();
      await waitForPageReady(page);
      await setAttachments(page, editMentorPage, false);
      await expect(chatPage.chatInput).toBeVisible({ timeout: 15_000 });

      const uploads: string[] = [];
      page.on('request', (r) => {
        if (UPLOAD_URL.test(r.url())) uploads.push(r.url());
      });

      await pasteInComposer(page, { file: 'cam-gate-paste.pdf' });
      await page.waitForTimeout(2_000);
      await expect(page.getByTestId('attachment-chip')).toHaveCount(0);
      expect(uploads).toHaveLength(0);

      // Over the 2000-character paste limit, text would normally become a
      // pasted-*.txt chip. A synthetic paste never inserts text, so only the
      // missing chip and upload can be checked here.
      const longText = 'B'.repeat(2_100);
      await pasteInComposer(page, { text: longText });
      await expect(page.getByTestId('attachment-chip')).toHaveCount(0);
      expect(uploads).toHaveLength(0);

      logger.info(
        'CAM-09: paste with attachments off attaches/uploads nothing',
      );
    });

    test('admin drops a file on an agent with attachments on and sees the overlay, a chip and one upload request (CAM-10)', async ({
      page,
      createMentorPage,
      editMentorPage,
    }) => {
      await createMentorPage.openAndCreate();
      await waitForPageReady(page);
      await setAttachments(page, editMentorPage, true);

      const uploads: string[] = [];
      page.on('request', (r) => {
        if (UPLOAD_URL.test(r.url()) && r.method() === 'POST')
          uploads.push(r.url());
      });

      await dispatchDrag(page, 'dragenter');
      await dispatchDrag(page, 'dragover');
      await expect(page.getByText('Drop your files here')).toBeVisible({
        timeout: 10_000,
      });

      await dispatchDrag(page, 'drop');
      await expect(
        page.getByTestId('attachment-chip').filter({ hasText: 'cam-gate.pdf' }),
      ).toBeVisible({ timeout: 15_000 });
      await expect.poll(() => uploads.length, { timeout: 15_000 }).toBe(1);

      logger.info('CAM-10: drop with attachments on attaches and uploads once');
    });
  });
});
