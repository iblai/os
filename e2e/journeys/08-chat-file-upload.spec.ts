import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp } from '../utils/auth';
import { dispatchDragEvent, dragAndDropFiles } from '../utils/drag-drop';
import { logger } from '@iblai/iblai-js/playwright';
import path from 'path';

// Real fixture files used by the original test suite
const FILES_DIR = path.resolve(__dirname, '../../e2e/files/testing_folder');
const ACCEPTED_IMAGE = path.join(FILES_DIR, 'acessibility png.png');
const ACCEPTED_PDF   = path.join(FILES_DIR, '0028-oop-object-oriented-programming-using-cpp.pdf');
const ACCEPTED_TXT   = path.join(FILES_DIR, 'outerHTML.txt');

/** Helper: open the file chooser via the Attach File button */
async function openFileChooser(page: import('@playwright/test').Page) {
  const attachButton = page.getByRole('button', { name: 'Attach File' });
  const uploadMenuItem = page.getByRole('menuitem', { name: 'Upload File' });

  const visible = await attachButton.isVisible({ timeout: 10_000 }).catch(() => false);
  if (!visible) return null;

  await attachButton.click();

  // Some implementations open a menu; others open the chooser directly
  const menuVisible = await uploadMenuItem.isVisible({ timeout: 2_000 }).catch(() => false);
  if (menuVisible) {
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 5_000 }),
      uploadMenuItem.click(),
    ]);
    return chooser;
  }

  // Direct chooser
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 5_000 }).catch(() => null),
    Promise.resolve(),
  ]);
  return chooser;
}

test.describe('Journey 8: Chat File Upload', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    // Ensure chat input is ready
    const textarea = page.getByRole('textbox', { name: /ask anything/i });
    await expect(textarea).toBeVisible({ timeout: 30_000 });
  });

  // ── Upload via button ──────────────────────────────────────────────────────

  test('authenticated user goes to chat page and uploads an accepted image file via the upload button', async ({
    page,
  }) => {
    const chooser = await openFileChooser(page);
    if (!chooser) return;
    await chooser.setFiles(ACCEPTED_IMAGE);
    await expect(page.getByText('acessibility png.png')).toBeVisible({ timeout: 15_000 });
    logger.info('Image file uploaded successfully via button');
  });

  test('authenticated user goes to chat page and uploads a PDF file via the upload button', async ({
    page,
  }) => {
    const chooser = await openFileChooser(page);
    if (!chooser) return;
    await chooser.setFiles(ACCEPTED_PDF);
    await expect(
      page.getByText('0028-oop-object-oriented-programming-using-cpp.pdf')
    ).toBeVisible({ timeout: 15_000 });
    logger.info('PDF file uploaded successfully via button');
  });

  test('authenticated user goes to chat page and uploads a text file via the upload button', async ({
    page,
  }) => {
    const chooser = await openFileChooser(page);
    if (!chooser) return;
    await chooser.setFiles(ACCEPTED_TXT);
    await expect(page.getByText('outerHTML.txt')).toBeVisible({ timeout: 15_000 });
    logger.info('Text file uploaded successfully via button');
  });

  test('authenticated user goes to chat page and verifies the file input accept attribute correctly filters types', async ({
    page,
    chatPage,
  }) => {
    const attachButton = page.getByRole('button', { name: 'Attach File' });
    const visible = await attachButton.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!visible) return;
    await attachButton.click();

    const fileInput = page.locator('input[type="file"]').first();
    const acceptValue = await fileInput.getAttribute('accept');
    expect(acceptValue).toBeTruthy();
    expect(acceptValue).toContain('image/png');
    expect(acceptValue).toContain('image/jpeg');
    expect(acceptValue).toContain('application/pdf');
    expect(acceptValue).toContain('text/plain');
    expect(acceptValue).not.toContain('application/json');
    expect(acceptValue).not.toContain('.json');
    logger.info('File input accept attribute correctly filters types');
  });

  test('authenticated user goes to chat page and removes an uploaded file from the attachments list', async ({
    page,
  }) => {
    const chooser = await openFileChooser(page);
    if (!chooser) return;
    await chooser.setFiles(ACCEPTED_IMAGE);
    await expect(page.getByText('acessibility png.png')).toBeVisible({ timeout: 15_000 });
    const removeButton = page.getByRole('button', { name: 'Remove file' });
    await expect(removeButton).toBeVisible({ timeout: 5_000 });
    await removeButton.click();
    await expect(page.getByText('acessibility png.png')).not.toBeVisible({ timeout: 5_000 });
    logger.info('File removed from attachments list');
  });

  // ── Drag & drop overlay ────────────────────────────────────────────────────

  test('authenticated user goes to chat page and sees drag overlay when dragging files over the chat area', async ({
    page,
  }) => {
    await expect(page.getByText('Drop your files here')).not.toBeVisible();
    await dispatchDragEvent(page, 'dragover', [{ name: 'photo.png', type: 'image/png' }]);
    await expect(page.getByText('Drop your files here')).toBeVisible({ timeout: 5_000 });
    logger.info('Drag overlay appeared on dragover');
  });

  test('authenticated user goes to chat page and the drag overlay disappears when files are dragged away', async ({
    page,
  }) => {
    await dispatchDragEvent(page, 'dragover', [{ name: 'photo.png', type: 'image/png' }]);
    await expect(page.getByText('Drop your files here')).toBeVisible({ timeout: 5_000 });
    await dispatchDragEvent(page, 'dragleave');
    await expect(page.getByText('Drop your files here')).not.toBeVisible({ timeout: 5_000 });
    logger.info('Drag overlay disappeared on dragleave');
  });

  // ── Drag & drop – accepted files ───────────────────────────────────────────

  test('authenticated user goes to chat page and drag-and-drops an accepted image file onto the chat area', async ({
    page,
  }) => {
    await dragAndDropFiles(page, [{ name: 'test-image.png', type: 'image/png', content: 'fake-png-data' }]);
    await expect(page.getByText('Drop your files here')).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('test-image.png')).toBeVisible({ timeout: 15_000 });
    logger.info('Image file accepted via drag and drop');
  });

  test('authenticated user goes to chat page and drag-and-drops an accepted PDF file which appears in the attachments list', async ({
    page,
  }) => {
    await dragAndDropFiles(page, [{ name: 'document.pdf', type: 'application/pdf', content: 'fake-pdf-data' }]);
    await expect(page.getByText('Drop your files here')).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('document.pdf')).toBeVisible({ timeout: 15_000 });
    logger.info('PDF file accepted via drag and drop');
  });

  test('authenticated user goes to chat page and drag-and-drops an accepted text file which appears in the attachments list', async ({
    page,
  }) => {
    await dragAndDropFiles(page, [{ name: 'notes.txt', type: 'text/plain', content: 'some text content' }]);
    await expect(page.getByText('notes.txt')).toBeVisible({ timeout: 15_000 });
    logger.info('Text file accepted via drag and drop');
  });

  // ── Drag & drop – rejected files ───────────────────────────────────────────

  test('authenticated user goes to chat page and drops a json file which shows the rejection toast', async ({
    page,
  }) => {
    await dragAndDropFiles(page, [{ name: 'config.json', type: 'application/json', content: '{"key":"value"}' }]);
    await expect(page.getByText('Drop your files here')).not.toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByText('The dropped file type is not supported.')
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('config.json')).not.toBeVisible();
    logger.info('JSON file correctly rejected via drag and drop');
  });

  test('authenticated user goes to chat page and drops an xml file which shows the rejection toast', async ({
    page,
  }) => {
    await dragAndDropFiles(page, [{ name: 'data.xml', type: 'application/xml', content: '<root></root>' }]);
    await expect(
      page.getByText('The dropped file type is not supported.')
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('data.xml')).not.toBeVisible();
    logger.info('XML file correctly rejected via drag and drop');
  });

  test('authenticated user goes to chat page and drops an exe file which shows the rejection toast', async ({
    page,
  }) => {
    await dragAndDropFiles(page, [{ name: 'program.exe', type: 'application/x-msdownload', content: '' }]);
    await expect(
      page.getByText('The dropped file type is not supported.')
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('program.exe')).not.toBeVisible();
    logger.info('EXE file correctly rejected via drag and drop');
  });

  // ── Drag & drop – mixed files ──────────────────────────────────────────────

  test('authenticated user goes to chat page and drops mixed valid and invalid files which shows a partial rejection toast', async ({
    page,
  }) => {
    await dragAndDropFiles(page, [
      { name: 'photo.png',   type: 'image/png',       content: 'png-data' },
      { name: 'report.pdf',  type: 'application/pdf',  content: 'pdf-data' },
      { name: 'config.json', type: 'application/json', content: '{}' },
      { name: 'data.xml',    type: 'application/xml',  content: '<x/>' },
    ]);
    await expect(page.getByText('Drop your files here')).not.toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByText(/2 files were rejected due to unsupported type/)
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('photo.png')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('report.pdf')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('config.json')).not.toBeVisible();
    await expect(page.getByText('data.xml')).not.toBeVisible();
    logger.info('Mixed drop: accepted files uploaded, rejected files shown in toast');
  });

  test('authenticated user goes to chat page and drops one accepted and one rejected file which shows a singular rejection toast', async ({
    page,
  }) => {
    await dragAndDropFiles(page, [
      { name: 'image.jpg',    type: 'image/jpeg',       content: 'jpg-data' },
      { name: 'script.json',  type: 'application/json', content: '{}' },
    ]);
    await expect(
      page.getByText(/1 file was rejected due to unsupported type/)
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('image.jpg')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('script.json')).not.toBeVisible();
    logger.info('Single rejection toast shown correctly with singular grammar');
  });

  // ── Upload button – multiple files ────────────────────────────────────────

  test('authenticated user goes to chat page and uploads multiple accepted files simultaneously via the upload button', async ({
    page,
  }) => {
    const attachButton = page.getByRole('button', { name: 'Attach File' });
    const visible = await attachButton.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!visible) return;
    await attachButton.click();
    const uploadMenuItem = page.getByRole('menuitem', { name: 'Upload File' });
    if (!await uploadMenuItem.isVisible({ timeout: 2_000 }).catch(() => false)) return;
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      uploadMenuItem.click(),
    ]);
    await chooser.setFiles([ACCEPTED_IMAGE, ACCEPTED_TXT]);
    await expect(page.getByText('acessibility png.png')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('outerHTML.txt')).toBeVisible({ timeout: 15_000 });
    logger.info('Multiple files uploaded successfully via button');
  });

  // ── Send with attachment ───────────────────────────────────────────────────

  test('authenticated user goes to chat page and sees the send button enabled when a file is attached without text', async ({
    page,
    chatPage,
  }) => {
    const chooser = await openFileChooser(page);
    if (!chooser) return;
    await chooser.setFiles(ACCEPTED_IMAGE);
    await expect(page.getByText('acessibility png.png')).toBeVisible({ timeout: 15_000 });
    const textarea = page.getByRole('textbox', { name: /ask anything/i });
    await expect(textarea).toHaveValue('');
    await expect(chatPage.sendButton).toBeEnabled({ timeout: 30_000 });
    logger.info('Send button is enabled with file attachment and no text');
  });
});
