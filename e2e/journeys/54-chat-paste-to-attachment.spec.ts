import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { logger } from '@iblai/iblai-js/playwright';

const MAX_CHARACTERS_TO_COPY_DEFAULT = 2000;
const CHARACTERS_OVER_LIMIT = MAX_CHARACTERS_TO_COPY_DEFAULT + 100;
const OVER_LIMIT_TEXT = 'A'.repeat(CHARACTERS_OVER_LIMIT);
const UNDER_LIMIT_TEXT = 'short paste text';

const MAX_UPLOAD_BYTES_DEFAULT = 20 * 1024 * 1024;
const OVERSIZED_FILE_BYTES = MAX_UPLOAD_BYTES_DEFAULT + 5 * 1024 * 1024;

async function simulateTextPaste(
  page: import('@playwright/test').Page,
  text: string,
): Promise<void> {
  await page.evaluate((pastedText: string) => {
    const textarea = document.getElementById(
      'chat-input-textarea',
    ) as HTMLTextAreaElement | null;
    if (!textarea) throw new Error('chat-input-textarea not found');

    const dt = new DataTransfer();
    dt.setData('text/plain', pastedText);

    textarea.focus();
    textarea.dispatchEvent(
      new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dt,
      }),
    );
  }, text);
}

async function simulateFilePaste(
  page: import('@playwright/test').Page,
  fileName: string,
  fileType: string,
  fileContent: string,
): Promise<void> {
  await page.evaluate(
    ({
      name,
      type,
      content,
    }: {
      name: string;
      type: string;
      content: string;
    }) => {
      const textarea = document.getElementById(
        'chat-input-textarea',
      ) as HTMLTextAreaElement | null;
      if (!textarea) throw new Error('chat-input-textarea not found');

      const file = new File([content], name, { type });
      const dt = new DataTransfer();
      dt.items.add(file);

      textarea.focus();
      textarea.dispatchEvent(
        new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: dt,
        }),
      );
    },
    { name: fileName, type: fileType, content: fileContent },
  );
}

test.describe('Journey 54: Chat Paste-to-Attachment', () => {
  test.setTimeout(240_000);

  test.beforeEach(async ({ page, createMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Requires admin access to create a mentor');
      return;
    }

    await createMentorPage.openAndCreate();
    await waitForPageReady(page);
  });

  test('admin pastes large text into the chat composer and it becomes an attachment chip with an empty textarea', async ({
    page,
    chatPage,
  }) => {
    await expect(chatPage.chatInput).toBeVisible({ timeout: 15_000 });

    await simulateTextPaste(page, OVER_LIMIT_TEXT);

    const pastedTxtChip = page.getByTestId('attachment-chip').filter({
      hasText: /pasted-\d+\.txt/,
    });

    await expect(pastedTxtChip).toBeVisible({ timeout: 15_000 });
    await expect(chatPage.chatInput).toHaveValue('', { timeout: 5_000 });

    logger.info(
      'PTA-01: Large text paste produced a pasted-*.txt chip and left textarea empty',
    );
  });

  test('admin pastes small text into the chat composer and it is not converted into an attachment chip', async ({
    page,
    chatPage,
  }) => {
    await expect(chatPage.chatInput).toBeVisible({ timeout: 15_000 });

    await simulateTextPaste(page, UNDER_LIMIT_TEXT);

    await expect(page.getByTestId('attachment-chip')).toHaveCount(0, {
      timeout: 3_000,
    });

    logger.info(
      'PTA-02: Small text paste was not converted into an attachment chip',
    );
  });

  test('admin pastes an image file into the chat composer and an attachment chip appears', async ({
    page,
    chatPage,
  }) => {
    await expect(chatPage.chatInput).toBeVisible({ timeout: 15_000 });

    await simulateFilePaste(
      page,
      'pasted-image.png',
      'image/png',
      'fake-png-data',
    );

    const pastedImageChip = page.getByTestId('attachment-chip').filter({
      hasText: 'pasted-image.png',
    });

    await expect(pastedImageChip).toBeVisible({ timeout: 15_000 });
    await expect(chatPage.chatInput).toHaveValue('', { timeout: 3_000 });

    logger.info('PTA-03: Pasted image file produced an attachment chip');
  });

  test('admin pastes an oversized file and sees a validation error toast with no attachment chip', async ({
    page,
    chatPage,
  }) => {
    await expect(chatPage.chatInput).toBeVisible({ timeout: 15_000 });

    const oversizedContent = 'X'.repeat(OVERSIZED_FILE_BYTES);

    await simulateFilePaste(
      page,
      'huge-file.pdf',
      'application/pdf',
      oversizedContent,
    );

    const validationToast = page.locator('[data-sonner-toast]', {
      hasText: /exceeds maximum/i,
    });

    await expect(validationToast).toBeVisible({ timeout: 10_000 });

    const oversizedChip = page.getByTestId('attachment-chip').filter({
      hasText: 'huge-file.pdf',
    });
    await expect(oversizedChip).not.toBeVisible({ timeout: 3_000 });

    logger.info(
      'PTA-04: Oversized file paste showed validation error toast and no chip was added',
    );
  });
});
