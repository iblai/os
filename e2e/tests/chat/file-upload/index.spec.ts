import { test, expect } from '@playwright/test';
import { logger } from '@iblai/iblai-js/playwright';
import { navigateToMentorApp } from '../../profile/helpers';
import {
  ACCEPTED_IMAGE,
  ACCEPTED_PDF,
  ACCEPTED_TXT,
  dispatchDragEvent,
  dragAndDropFiles,
  uploadFileViaButton,
} from './helpers';

// ── Tests ───────────────────────────────────────────────────────────

test.describe('file upload and drag-and-drop', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);

    // Wait for the chat to be ready (textarea visible)
    const textarea = page.getByRole('textbox', { name: /ask anything/i });
    await expect(textarea).toBeVisible({ timeout: 30000 });
  });

  // ── Upload via button ───────────────────────────────────────────

  test('user can upload an accepted image file via the upload button', async ({
    page,
  }) => {
    await uploadFileViaButton(page, ACCEPTED_IMAGE);

    // Verify the file appears in the attachments list
    await expect(page.getByText('acessibility png.png')).toBeVisible({
      timeout: 15000,
    });

    logger.info('Image file uploaded successfully via button');
  });

  test('user can upload a PDF file via the upload button', async ({ page }) => {
    await uploadFileViaButton(page, ACCEPTED_PDF);

    await expect(
      page.getByText('0028-oop-object-oriented-programming-using-cpp.pdf')
    ).toBeVisible({ timeout: 15000 });

    logger.info('PDF file uploaded successfully via button');
  });

  test('user can upload a text file via the upload button', async ({
    page,
  }) => {
    await uploadFileViaButton(page, ACCEPTED_TXT);

    await expect(page.getByText('outerHTML.txt')).toBeVisible({
      timeout: 15000,
    });

    logger.info('Text file uploaded successfully via button');
  });

  test('file input has correct accept attribute filtering unsupported types', async ({
    page,
  }) => {
    const fileInput = page.locator('input[type="file"]');

    // The accept attribute should include image and document MIME types
    const acceptValue = await fileInput.getAttribute('accept');
    expect(acceptValue).toBeTruthy();
    expect(acceptValue).toContain('image/png');
    expect(acceptValue).toContain('image/jpeg');
    expect(acceptValue).toContain('application/pdf');
    expect(acceptValue).toContain('text/plain');

    // Should NOT include json
    expect(acceptValue).not.toContain('application/json');
    expect(acceptValue).not.toContain('.json');

    logger.info('File input accept attribute correctly filters types');
  });

  // ── Upload via button – remove file ─────────────────────────────

  test('user can remove an uploaded file from the attachments list', async ({
    page,
  }) => {
    await uploadFileViaButton(page, ACCEPTED_IMAGE);

    // Wait for file to appear
    await expect(page.getByText('acessibility png.png')).toBeVisible({
      timeout: 15000,
    });

    // Click the remove button (X icon with sr-only "Remove file" text)
    const removeButton = page.getByRole('button', { name: 'Remove file' });
    await expect(removeButton).toBeVisible({ timeout: 5000 });
    await removeButton.click();

    // Verify the file is removed
    await expect(page.getByText('acessibility png.png')).not.toBeVisible({
      timeout: 5000,
    });

    logger.info('File removed from attachments list');
  });

  // ── Drag & drop overlay ─────────────────────────────────────────

  test('drag overlay appears when files are dragged over the chat area', async ({
    page,
  }) => {
    // Verify overlay is NOT visible initially
    await expect(page.getByText('Drop your files here')).not.toBeVisible();

    // Simulate dragover with a file
    await dispatchDragEvent(page, 'dragover', [
      { name: 'photo.png', type: 'image/png' },
    ]);

    // Verify overlay IS visible
    await expect(page.getByText('Drop your files here')).toBeVisible({
      timeout: 5000,
    });

    logger.info('Drag overlay appeared on dragover');
  });

  test('drag overlay disappears when files are dragged away', async ({
    page,
  }) => {
    // Show the overlay first
    await dispatchDragEvent(page, 'dragover', [
      { name: 'photo.png', type: 'image/png' },
    ]);
    await expect(page.getByText('Drop your files here')).toBeVisible({
      timeout: 5000,
    });

    // Simulate dragleave
    await dispatchDragEvent(page, 'dragleave');

    // Verify overlay disappears
    await expect(page.getByText('Drop your files here')).not.toBeVisible({
      timeout: 5000,
    });

    logger.info('Drag overlay disappeared on dragleave');
  });

  // ── Drag & drop – accepted files ───────────────────────────────

  test('user can drag and drop an accepted image file', async ({ page }) => {
    await dragAndDropFiles(page, [
      { name: 'test-image.png', type: 'image/png', content: 'fake-png-data' },
    ]);

    // Overlay should disappear after drop
    await expect(page.getByText('Drop your files here')).not.toBeVisible({
      timeout: 5000,
    });

    // File should appear in attachments list
    await expect(page.getByText('test-image.png')).toBeVisible({
      timeout: 15000,
    });

    logger.info('Image file accepted via drag and drop');
  });

  test('user can drag and drop an accepted PDF file', async ({ page }) => {
    await dragAndDropFiles(page, [
      {
        name: 'document.pdf',
        type: 'application/pdf',
        content: 'fake-pdf-data',
      },
    ]);

    await expect(page.getByText('Drop your files here')).not.toBeVisible({
      timeout: 5000,
    });

    await expect(page.getByText('document.pdf')).toBeVisible({
      timeout: 15000,
    });

    logger.info('PDF file accepted via drag and drop');
  });

  test('user can drag and drop an accepted text file', async ({ page }) => {
    await dragAndDropFiles(page, [
      {
        name: 'notes.txt',
        type: 'text/plain',
        content: 'some text content',
      },
    ]);

    await expect(page.getByText('notes.txt')).toBeVisible({
      timeout: 15000,
    });

    logger.info('Text file accepted via drag and drop');
  });

  // ── Drag & drop – rejected files ───────────────────────────────

  test('drag and drop a .json file shows rejection toast', async ({ page }) => {
    await dragAndDropFiles(page, [
      {
        name: 'config.json',
        type: 'application/json',
        content: '{"key":"value"}',
      },
    ]);

    // Overlay should disappear
    await expect(page.getByText('Drop your files here')).not.toBeVisible({
      timeout: 5000,
    });

    // Toast error should appear
    await expect(
      page.getByText('The dropped file type is not supported.')
    ).toBeVisible({ timeout: 10000 });

    // File should NOT appear in attachments
    await expect(page.getByText('config.json')).not.toBeVisible();

    logger.info('JSON file correctly rejected via drag and drop');
  });

  test('drag and drop an .xml file shows rejection toast', async ({ page }) => {
    await dragAndDropFiles(page, [
      {
        name: 'data.xml',
        type: 'application/xml',
        content: '<root></root>',
      },
    ]);

    await expect(
      page.getByText('The dropped file type is not supported.')
    ).toBeVisible({ timeout: 10000 });

    await expect(page.getByText('data.xml')).not.toBeVisible();

    logger.info('XML file correctly rejected via drag and drop');
  });

  test('drag and drop an .exe file shows rejection toast', async ({ page }) => {
    await dragAndDropFiles(page, [
      {
        name: 'program.exe',
        type: 'application/x-msdownload',
        content: '',
      },
    ]);

    await expect(
      page.getByText('The dropped file type is not supported.')
    ).toBeVisible({ timeout: 10000 });

    await expect(page.getByText('program.exe')).not.toBeVisible();

    logger.info('EXE file correctly rejected via drag and drop');
  });

  // ── Drag & drop – mixed valid and invalid files ────────────────

  test('drag and drop mix of accepted and rejected files shows partial rejection toast', async ({
    page,
  }) => {
    await dragAndDropFiles(page, [
      // Accepted
      { name: 'photo.png', type: 'image/png', content: 'png-data' },
      { name: 'report.pdf', type: 'application/pdf', content: 'pdf-data' },
      // Rejected
      { name: 'config.json', type: 'application/json', content: '{}' },
      { name: 'data.xml', type: 'application/xml', content: '<x/>' },
    ]);

    // Overlay should disappear
    await expect(page.getByText('Drop your files here')).not.toBeVisible({
      timeout: 5000,
    });

    // Toast should indicate 2 files were rejected
    await expect(
      page.getByText(/2 files were rejected due to unsupported type/)
    ).toBeVisible({ timeout: 10000 });

    // Accepted files should appear in attachments
    await expect(page.getByText('photo.png')).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText('report.pdf')).toBeVisible({
      timeout: 15000,
    });

    // Rejected files should NOT appear
    await expect(page.getByText('config.json')).not.toBeVisible();
    await expect(page.getByText('data.xml')).not.toBeVisible();

    logger.info(
      'Mixed file drop: accepted files uploaded, rejected files shown in toast'
    );
  });

  test('drag and drop one accepted and one rejected file shows singular rejection toast', async ({
    page,
  }) => {
    await dragAndDropFiles(page, [
      { name: 'image.jpg', type: 'image/jpeg', content: 'jpg-data' },
      { name: 'script.json', type: 'application/json', content: '{}' },
    ]);

    // Toast should indicate 1 file was rejected (singular)
    await expect(
      page.getByText(/1 file was rejected due to unsupported type/)
    ).toBeVisible({ timeout: 10000 });

    // Accepted file should appear
    await expect(page.getByText('image.jpg')).toBeVisible({
      timeout: 15000,
    });

    // Rejected file should NOT appear
    await expect(page.getByText('script.json')).not.toBeVisible();

    logger.info('Single rejection toast shown correctly with singular grammar');
  });

  // ── Upload button – multiple files at once ─────────────────────

  test('user can upload multiple accepted files via the upload button', async ({
    page,
  }) => {
    const attachButton = page.getByRole('button', { name: 'Attach File' });
    await expect(attachButton).toBeVisible({ timeout: 10000 });
    await attachButton.click();

    const uploadMenuItem = page.getByRole('menuitem', {
      name: 'Upload File',
    });
    await expect(uploadMenuItem).toBeVisible({ timeout: 5000 });

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      uploadMenuItem.click(),
    ]);
    await fileChooser.setFiles([ACCEPTED_IMAGE, ACCEPTED_TXT]);

    // Both files should appear in attachments
    await expect(page.getByText('acessibility png.png')).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText('outerHTML.txt')).toBeVisible({
      timeout: 15000,
    });

    logger.info('Multiple files uploaded successfully via button');
  });

  // ── Send message with file attachment ──────────────────────────

  test('send button is enabled when files are attached without text', async ({
    page,
  }) => {
    await uploadFileViaButton(page, ACCEPTED_IMAGE);

    // Wait for file to appear
    await expect(page.getByText('acessibility png.png')).toBeVisible({
      timeout: 15000,
    });

    // Wait for any upload to complete — the send button should be enabled
    // once files are in "success" status
    const sendButton = page.getByRole('button', { name: /send/i });

    // The textarea should be empty (no text typed)
    const textarea = page.getByRole('textbox', { name: /ask anything/i });
    await expect(textarea).toHaveValue('');

    // Send button should be enabled because files are attached
    // (allowEmptySubmit is true when attachedFiles.length > 0)
    await expect(sendButton).toBeEnabled({ timeout: 30000 });

    logger.info('Send button is enabled with file attachment and no text');
  });
});
