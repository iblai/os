/**
 * Journey 96 — Allowed file types for chat uploads (iblai-platform#2528)
 *
 * Edit Agent → Settings → Capabilities ends with a "File Uploads" group. Its
 * single row opens the "Allowed File Types" dialog: 12 common types to tick
 * plus an "add your own" input. Done writes the form field; the tab's Save
 * stores it with a JSON PUT (`allowed_file_upload_extensions`) to the agent.
 * In chat the composer's file input `accept` follows the list, a refused file
 * toasts "<name> can't be added. This agent only accepts …", and an empty list
 * means every type is allowed.
 *
 * One throwaway agent (auto-tracked and deleted by `createWithName`) is shared
 * by the serial checkpoints. Settings and chat are driven for real; only the
 * S3 upload leg is mocked (`mockFileUpload`) so an allowed file can attach.
 */

import fs from 'fs';
import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/mentor-test';
import { MENTOR_NEXTJS_HOST, generateMentorName } from '../fixtures/test-data';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';

const COMMON = [
  'pdf',
  'docx',
  'txt',
  'md',
  'csv',
  'xlsx',
  'pptx',
  'png',
  'jpg',
  'gif',
  'webp',
  'mp3',
];

async function skipIfNotAdmin(page: Page): Promise<void> {
  if (!(await checkAdminStatus(page))) test.skip(true, 'Requires admin access');
}

function writeFile(dir: string, name: string, content = 'e2e'): string {
  fs.mkdirSync(dir, { recursive: true });
  const file = `${dir}/${name}`;
  fs.writeFileSync(file, content);
  return file;
}

const REFUSAL = (name: string) =>
  `${name} can't be added. This agent only accepts pdf, docx, png and json files.`;

test.describe.serial('Journey 96: Allowed file types', () => {
  test.setTimeout(180_000);

  let mentorUrl = '';

  test('aft-01: Capabilities ends with a File Uploads group holding the File Types Users Can Attach row', async ({
    page,
    editMentorPage,
    createMentorPage,
  }) => {
    await navigateToMentorApp(page);
    await skipIfNotAdmin(page);

    await createMentorPage.openAndCreate(generateMentorName());
    await waitForPageReady(page);
    const { tenantKey, mentorId } = await getPlatformContext(page);
    mentorUrl = `${MENTOR_NEXTJS_HOST}/platform/${tenantKey}/${mentorId}`;

    const settings = editMentorPage.settings;
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await settings.selectSubTab('Capabilities');

    await expect(settings.fileUploadsGroup).toBeVisible({ timeout: 15_000 });
    const box = settings.allowedFileTypesBox;
    await expect(box).toContainText('File Types Users Can Attach');
    await expect(settings.allowedFileTypesInfoButton).toBeVisible();
    await expect(settings.allowedFileTypesButton).toHaveText(
      'Allowed File Types',
    );
    // No count text next to the button (the list lives in the dialog).
    await expect(box).not.toContainText(/\ball\b.*types|\d+ file types/i);

    // After Context Limits, and the last group of the tab.
    const order = await settings.dialog
      .locator(
        '[data-testid="settings-context-limits"], [data-testid="settings-file-uploads"]',
      )
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
    expect(order).toEqual(['settings-context-limits', 'settings-file-uploads']);
    const isLast = await settings.fileUploadsGroup.evaluate((el) => {
      const groups = Array.from(
        el.parentElement?.querySelectorAll('[data-testid^="settings-"]') ?? [],
      ).filter((g) => g.parentElement === el.parentElement);
      return groups.length === 0 || groups[groups.length - 1] === el;
    });
    expect(isLast, 'File Uploads must be the last Capabilities group').toBe(
      true,
    );
    await editMentorPage.close();
  });

  test('aft-02: the dialog lists 12 common types, adds .JSON as json, and shows the duplicate and invalid errors', async ({
    page,
    editMentorPage,
  }) => {
    test.skip(!mentorUrl, 'aft-01 setup did not run');
    await navigateToMentorApp(page, mentorUrl);
    await skipIfNotAdmin(page);

    const settings = editMentorPage.settings;
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await settings.openAllowedFileTypes();

    for (const ext of COMMON) {
      await expect(settings.allowedFileTypeToggle(ext)).toBeVisible();
    }
    await expect(
      settings.allowedFileTypesDialog.getByTestId(/^allowed-file-type-/),
    ).toHaveCount(COMMON.length);
    await expect(settings.allowedFileTypesDraftCount).toBeVisible();

    await settings.addAllowedFileType('.JSON');
    await expect(settings.allowedFileTypesCustom).toContainText('json');
    await expect(settings.allowedFileTypesDialog).toContainText('Added by You');

    await settings.addAllowedFileType('json');
    await expect(settings.allowedFileTypesError).toHaveText(
      'json is already in the list.',
    );

    await settings.addAllowedFileType('js-on');
    await expect(settings.allowedFileTypesError).toHaveText(
      'Use letters and numbers only, like json.',
    );

    await settings.clearAllAllowedFileTypes();
    for (const ext of COMMON) {
      await expect(settings.allowedFileTypeToggle(ext)).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    }
    await expect(settings.allowedFileTypesCustom).toBeHidden();
    await editMentorPage.close();
  });

  test('aft-03: Done then Save stores the list with one JSON PUT; an unrelated save does not resend it; reload and reopen shows it', async ({
    page,
    editMentorPage,
  }) => {
    test.skip(!mentorUrl, 'aft-01 setup did not run');
    await navigateToMentorApp(page, mentorUrl);
    await skipIfNotAdmin(page);

    const settings = editMentorPage.settings;
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await settings.openAllowedFileTypes();
    for (const ext of ['pdf', 'docx', 'png']) {
      await settings.allowedFileTypeToggle(ext).click();
    }
    await settings.addAllowedFileType('.JSON');
    await settings.doneAllowedFileTypes();

    const saved = await settings.saveAllowedFileTypes();
    expect(saved.ok).toBe(true);
    expect(saved.extensions).toEqual(['pdf', 'docx', 'png', 'json']);

    // A save of something else must not resend the unchanged list.
    const resent: string[] = [];
    const onRequest = (req: import('@playwright/test').Request) => {
      if (
        req.method() === 'PUT' &&
        (req.postData() ?? '').includes('allowed_file_upload_extensions')
      ) {
        resent.push(req.url());
      }
    };
    page.on('request', onRequest);
    const other = await settings.setShowLastConversation(true);
    expect(other?.ok).toBe(true);
    page.off('request', onRequest);
    expect(resent, 'unchanged list must not be re-sent').toHaveLength(0);
    await editMentorPage.close();

    await navigateToMentorApp(page, mentorUrl);
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await settings.openAllowedFileTypes();
    for (const ext of ['pdf', 'docx', 'png']) {
      await expect(settings.allowedFileTypeToggle(ext)).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    }
    await expect(settings.allowedFileTypeToggle('csv')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(settings.allowedFileTypesCustom).toContainText('json');
    await settings.allowedFileTypesDialog
      .getByRole('button', { name: /close|cancel/i })
      .first()
      .click()
      .catch(() => undefined);
    await page.keyboard.press('Escape');
    await editMentorPage.close();
  });

  test('aft-04: in chat the file input accepts only the list, refuses report.exe and a file with no extension, and attaches an allowed file', async ({
    page,
    chatPage,
  }, testInfo) => {
    test.skip(!mentorUrl, 'aft-01 setup did not run');
    const dir = testInfo.outputPath('files');
    const exe = writeFile(dir, 'report.exe');
    const readme = writeFile(dir, 'README');
    const pdf = writeFile(dir, 'report.pdf', '%PDF-1.4 e2e');

    await chatPage.mockFileUpload('success', 0);
    await page.goto(mentorUrl, { waitUntil: 'domcontentloaded' });
    await expect(chatPage.getComposerTextarea()).toBeVisible({
      timeout: 30_000,
    });

    const input = chatPage.getFileUploadInput();
    await expect(input).toHaveAttribute('accept', '.pdf,.docx,.png,.json');

    await chatPage.attachFile(exe);
    await expect(page.getByText(REFUSAL('report.exe')).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(chatPage.attachmentChip).toHaveCount(0);

    await chatPage.attachFile(readme);
    await expect(page.getByText(REFUSAL('README')).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(chatPage.attachmentChip).toHaveCount(0);

    await chatPage.attachFile(pdf);
    await expect(chatPage.attachmentChip.first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(chatPage.getRetryFileButton()).toHaveCount(0);
  });

  test('aft-05: Clear All then Save means everything is allowed, and a csv attaches', async ({
    page,
    editMentorPage,
    chatPage,
  }, testInfo) => {
    test.skip(!mentorUrl, 'aft-01 setup did not run');
    await navigateToMentorApp(page, mentorUrl);
    await skipIfNotAdmin(page);

    const settings = editMentorPage.settings;
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await settings.openAllowedFileTypes();
    await settings.clearAllAllowedFileTypes();
    await settings.doneAllowedFileTypes();
    const saved = await settings.saveAllowedFileTypes();
    expect(saved.ok).toBe(true);
    expect(saved.extensions).toEqual([]);
    await editMentorPage.close();

    const csv = writeFile(
      testInfo.outputPath('files'),
      'data.csv',
      'a,b\n1,2\n',
    );
    await chatPage.mockFileUpload('success', 0);
    await page.goto(mentorUrl, { waitUntil: 'domcontentloaded' });
    await expect(chatPage.getComposerTextarea()).toBeVisible({
      timeout: 30_000,
    });
    await chatPage.attachFile(csv);
    await expect(chatPage.attachmentChip.first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/can't be added/i)).toHaveCount(0);
  });
  test("aft-06: a server refusal of the upload URL (400) names the file and says it can't be used with this agent", async ({
    page,
    chatPage,
  }, testInfo) => {
    test.skip(!mentorUrl, 'aft-01 setup did not run');
    const pdf = writeFile(
      testInfo.outputPath('files'),
      'refused.pdf',
      '%PDF-1.4 e2e',
    );
    const message = 'This file type is not allowed for this mentor.';
    await page.route(
      '**/api/ai-mentor/orgs/*/users/*/chat/files/upload-url/**',
      (route) =>
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: message }),
        }),
    );
    await page.goto(mentorUrl, { waitUntil: 'domcontentloaded' });
    await expect(chatPage.getComposerTextarea()).toBeVisible({
      timeout: 30_000,
    });
    await chatPage.attachFile(pdf);
    await expect(
      page
        .getByText("refused.pdf can't be used with this agent", {
          exact: false,
        })
        .first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(chatPage.getRetryFileButton()).toBeVisible();
  });
});
