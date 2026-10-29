/**
 * Journey 96 — Allowed file types for chat uploads (iblai-platform#2528)
 *
 * Edit Agent → Settings → Capabilities ends with a "File Uploads" group. Its
 * single row opens the "Allowed File Types" dialog: 12 common types to tick
 * plus an "add your own" input. Done writes the form field; the tab's Save
 * stores it with a JSON PUT (`allowed_file_upload_extensions`) to the agent.
 * In chat the composer's file input `accept` follows the list, a refused file
 * shows an error toast (".exe files aren't accepted by this agent.", or
 * "<name> has no file type, so this agent can't accept it.", or "N files can't
 * be added: …") whose "See allowed types" link opens a searchable dialog of the
 * agent's list, and an empty list means every type is allowed. Refused files
 * never reach the per-message file limit.
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

const TYPE_REFUSAL = (type: string) =>
  `.${type} files aren't accepted by this agent.`;
const NO_TYPE_REFUSAL = (name: string) =>
  `${name} has no file type, so this agent can't accept it.`;

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
    await expect(page.getByText(TYPE_REFUSAL('exe')).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(chatPage.attachmentChip).toHaveCount(0);

    await chatPage.attachFile(readme);
    await expect(page.getByText(NO_TYPE_REFUSAL('README')).first()).toBeVisible(
      {
        timeout: 10_000,
      },
    );
    await expect(chatPage.attachmentChip).toHaveCount(0);

    await chatPage.attachFile(pdf);
    await expect(chatPage.attachmentChip.first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(chatPage.getRetryFileButton()).toHaveCount(0);
  });

  test("aft-07: a refused file links to a dialog of the agent's accepted types (count, search, no-match, Got It), and several refused files share one toast", async ({
    page,
    chatPage,
  }, testInfo) => {
    test.skip(!mentorUrl, 'aft-01 setup did not run');
    const dir = testInfo.outputPath('files');
    const exe = writeFile(dir, 'report.exe');
    const zip = writeFile(dir, 'notes.zip');

    await chatPage.mockFileUpload('success', 0);
    await page.goto(mentorUrl, { waitUntil: 'domcontentloaded' });
    await expect(chatPage.getComposerTextarea()).toBeVisible({
      timeout: 30_000,
    });

    await chatPage.attachFile(exe);
    const toast = page.locator('[data-sonner-toast]').filter({
      hasText: TYPE_REFUSAL('exe'),
    });
    await expect(toast).toBeVisible({ timeout: 10_000 });
    await toast.getByRole('button', { name: 'See allowed types' }).click();
    await expect(toast).toBeHidden({ timeout: 10_000 });

    const dialog = page.getByTestId('agent-allowed-file-types-dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(
      dialog.getByText('File Types This Agent Accepts'),
    ).toBeVisible();
    await expect(
      dialog.getByText('You can attach any of these 4 file types.'),
    ).toBeVisible();
    for (const ext of ['pdf', 'docx', 'png', 'json']) {
      await expect(dialog.getByText(ext, { exact: true })).toBeVisible();
    }

    const search = page.getByTestId('agent-allowed-file-types-search');
    const noMatch = page.getByTestId('agent-allowed-file-types-no-match');
    await search.fill('.png');
    await expect(dialog.getByText('png', { exact: true })).toBeVisible();
    await expect(dialog.getByText('pdf', { exact: true })).toBeHidden();
    await expect(dialog.getByText('json', { exact: true })).toBeHidden();
    await expect(noMatch).toBeHidden();

    await search.fill('exe');
    await expect(noMatch).toHaveText(".exe isn't one of them.");

    await dialog.getByRole('button', { name: 'Got It' }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });
    await expect(toast).toBeHidden();

    // Two refused files in one pick produce a single combined toast.
    await chatPage.getFileUploadInput().setInputFiles([exe, zip]);
    await expect(
      page
        .getByText("2 files can't be added: report.exe and notes.zip.")
        .first(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(chatPage.attachmentChip).toHaveCount(0);
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
    await expect(page.getByText(/aren't accepted by this agent/i)).toHaveCount(
      0,
    );
    await expect(page.getByText(/has no file type/i)).toHaveCount(0);
    await expect(page.getByText(/files can't be added/i)).toHaveCount(0);
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
