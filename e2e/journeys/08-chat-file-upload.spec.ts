import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp } from '../utils/auth';
import { dispatchDragEvent, dragAndDropFiles } from '../utils/drag-drop';
import { logger } from '@iblai/iblai-js/playwright';
import path from 'path';

// Real fixture files used by the original test suite
const FILES_DIR = path.resolve(__dirname, '../../e2e/files/testing_folder');
const ACCEPTED_IMAGE = path.join(FILES_DIR, 'acessibility png.png');
const ACCEPTED_PDF = path.join(
  FILES_DIR,
  '0028-oop-object-oriented-programming-using-cpp.pdf',
);
const ACCEPTED_TXT = path.join(FILES_DIR, 'outerHTML.txt');
const ACCEPTED_CSV = path.join(FILES_DIR, 'test-data.csv');

/** Helper: open the file chooser via the Attach File button */
async function openFileChooser(page: import('@playwright/test').Page) {
  const attachButton = page.getByRole('button', { name: 'Attach File' });

  const visible = await attachButton
    .isVisible({ timeout: 10_000 })
    .catch(() => false);
  if (!visible) return null;

  // First click: check if a menu appears or if the chooser opens directly
  await attachButton.click();
  const uploadMenuItem = page.getByRole('menuitem', { name: 'Upload File' });
  const menuVisible = await uploadMenuItem
    .isVisible({ timeout: 2_000 })
    .catch(() => false);

  if (menuVisible) {
    // Menu appeared → clicking the menu item triggers the file chooser
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 10_000 }),
      uploadMenuItem.click(),
    ]);
    return chooser;
  }

  // No menu appeared → the button itself triggers the file input.
  // We need to click again while listening for the filechooser event.
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 10_000 }),
    attachButton.click(),
  ]);
  return chooser;
}

test.describe('Journey 8: Chat File Upload', () => {
  // fixme: The non-admin user is on the free tier and a persistent pricing/subscription
  // dialog (ibl.ai Pricing Plans) blocks the Attach File functionality.
  // File upload tests require a paid subscription or should use an admin user.
  test.fixme();

  test.beforeEach(async ({ nonadminPage }) => {
    await navigateToMentorApp(nonadminPage);
    // Ensure chat input is ready
    const textarea = nonadminPage.getByRole('textbox', {
      name: /ask anything/i,
    });
    await expect(textarea).toBeVisible({ timeout: 30_000 });
  });

  // ── Upload via button ──────────────────────────────────────────────────────

  // fixme: non-admin user encounters pricing paywall that blocks file upload
  test.fixme(
    'non-admin goes to chat page and uploads an accepted image file via the upload button',
    async ({ nonadminPage }) => {
      const chooser = await openFileChooser(nonadminPage);
      if (!chooser) return;
      await chooser.setFiles(ACCEPTED_IMAGE);
      await expect(nonadminPage.getByText('acessibility png.png')).toBeVisible({
        timeout: 15_000,
      });
      logger.info('Image file uploaded successfully via button');
    },
  );

  // fixme: non-admin user encounters pricing paywall that blocks file upload
  test.fixme(
    'non-admin goes to chat page and uploads a PDF file via the upload button',
    async ({ nonadminPage }) => {
      const chooser = await openFileChooser(nonadminPage);
      if (!chooser) return;
      await chooser.setFiles(ACCEPTED_PDF);
      await expect(
        nonadminPage.getByText(
          '0028-oop-object-oriented-programming-using-cpp.pdf',
        ),
      ).toBeVisible({ timeout: 15_000 });
      logger.info('PDF file uploaded successfully via button');
    },
  );

  // fixme: non-admin user encounters pricing paywall that blocks file upload
  test.fixme(
    'non-admin goes to chat page and uploads a text file via the upload button',
    async ({ nonadminPage }) => {
      const chooser = await openFileChooser(nonadminPage);
      if (!chooser) return;
      await chooser.setFiles(ACCEPTED_TXT);
      await expect(nonadminPage.getByText('outerHTML.txt')).toBeVisible({
        timeout: 15_000,
      });
      logger.info('Text file uploaded successfully via button');
    },
  );

  test('non-admin goes to chat page and verifies the file input accept attribute correctly filters types', async ({
    nonadminPage,
    nonadminChatPage,
  }) => {
    const attachButton = nonadminPage.getByRole('button', {
      name: 'Attach File',
    });
    const visible = await attachButton
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (!visible) return;
    await attachButton.click();

    const fileInput = nonadminPage.locator('input[type="file"]').first();
    const acceptValue = await fileInput.getAttribute('accept');
    expect(acceptValue).toBeTruthy();
    expect(acceptValue).toContain('image/png');
    expect(acceptValue).toContain('image/jpeg');
    expect(acceptValue).toContain('application/pdf');
    expect(acceptValue).toContain('text/plain');
    expect(acceptValue).toContain('.csv');
    expect(acceptValue).not.toContain('application/json');
    expect(acceptValue).not.toContain('.json');
    logger.info('File input accept attribute correctly filters types');
  });

  // fixme: non-admin user encounters pricing paywall that blocks file upload
  test.fixme(
    'non-admin goes to chat page and removes an uploaded file from the attachments list',
    async ({ nonadminPage }) => {
      const chooser = await openFileChooser(nonadminPage);
      if (!chooser) return;
      await chooser.setFiles(ACCEPTED_IMAGE);
      await expect(nonadminPage.getByText('acessibility png.png')).toBeVisible({
        timeout: 15_000,
      });
      const removeButton = nonadminPage.getByRole('button', {
        name: 'Remove file',
      });
      await expect(removeButton).toBeVisible({ timeout: 5_000 });
      await removeButton.click();
      await expect(
        nonadminPage.getByText('acessibility png.png'),
      ).not.toBeVisible({ timeout: 5_000 });
      logger.info('File removed from attachments list');
    },
  );

  // ── Drag & drop overlay ────────────────────────────────────────────────────

  test('non-admin goes to chat page and sees drag overlay when dragging files over the chat area', async ({
    nonadminPage,
  }) => {
    await expect(
      nonadminPage.getByText('Drop your files here'),
    ).not.toBeVisible();
    await dispatchDragEvent(nonadminPage, 'dragover', [
      { name: 'photo.png', type: 'image/png' },
    ]);
    await expect(nonadminPage.getByText('Drop your files here')).toBeVisible({
      timeout: 5_000,
    });
    logger.info('Drag overlay appeared on dragover');
  });

  test('non-admin goes to chat page and the drag overlay disappears when files are dragged away', async ({
    nonadminPage,
  }) => {
    await dispatchDragEvent(nonadminPage, 'dragover', [
      { name: 'photo.png', type: 'image/png' },
    ]);
    await expect(nonadminPage.getByText('Drop your files here')).toBeVisible({
      timeout: 5_000,
    });
    await dispatchDragEvent(nonadminPage, 'dragleave');
    await expect(
      nonadminPage.getByText('Drop your files here'),
    ).not.toBeVisible({ timeout: 5_000 });
    logger.info('Drag overlay disappeared on dragleave');
  });

  // ── Drag & drop – accepted files ───────────────────────────────────────────

  test('non-admin goes to chat page and drag-and-drops an accepted image file onto the chat area', async ({
    nonadminPage,
  }) => {
    await dragAndDropFiles(nonadminPage, [
      { name: 'test-image.png', type: 'image/png', content: 'fake-png-data' },
    ]);
    await expect(
      nonadminPage.getByText('Drop your files here'),
    ).not.toBeVisible({ timeout: 5_000 });
    await expect(nonadminPage.getByText('test-image.png')).toBeVisible({
      timeout: 15_000,
    });
    logger.info('Image file accepted via drag and drop');
  });

  test('non-admin goes to chat page and drag-and-drops an accepted PDF file which appears in the attachments list', async ({
    nonadminPage,
  }) => {
    await dragAndDropFiles(nonadminPage, [
      {
        name: 'document.pdf',
        type: 'application/pdf',
        content: 'fake-pdf-data',
      },
    ]);
    await expect(
      nonadminPage.getByText('Drop your files here'),
    ).not.toBeVisible({ timeout: 5_000 });
    await expect(nonadminPage.getByText('document.pdf')).toBeVisible({
      timeout: 15_000,
    });
    logger.info('PDF file accepted via drag and drop');
  });

  test('non-admin goes to chat page and drag-and-drops an accepted text file which appears in the attachments list', async ({
    nonadminPage,
  }) => {
    await dragAndDropFiles(nonadminPage, [
      { name: 'notes.txt', type: 'text/plain', content: 'some text content' },
    ]);
    await expect(nonadminPage.getByText('notes.txt')).toBeVisible({
      timeout: 15_000,
    });
    logger.info('Text file accepted via drag and drop');
  });

  test('non-admin goes to chat page and drag-and-drops a CSV file which appears in the attachments list', async ({
    nonadminPage,
  }) => {
    await dragAndDropFiles(nonadminPage, [
      {
        name: 'test-data.csv',
        type: 'text/csv',
        content: 'col1,col2\nval1,val2',
      },
    ]);
    await expect(
      nonadminPage.getByText('Drop your files here'),
    ).not.toBeVisible({ timeout: 5_000 });
    await expect(nonadminPage.getByText('test-data.csv')).toBeVisible({
      timeout: 15_000,
    });
    logger.info('CSV file accepted via drag and drop');
  });

  // fixme: non-admin user encounters pricing paywall that blocks file upload
  test.fixme(
    'non-admin goes to chat page and uploads a CSV file via the upload button',
    async ({ nonadminPage }) => {
      const chooser = await openFileChooser(nonadminPage);
      if (!chooser) return;
      await chooser.setFiles(ACCEPTED_CSV);
      await expect(nonadminPage.getByText('test-data.csv')).toBeVisible({
        timeout: 15_000,
      });
      logger.info('CSV file uploaded successfully via button');
    },
  );

  // ── Drag & drop – rejected files ───────────────────────────────────────────

  test('non-admin goes to chat page and drops a json file which shows the rejection toast', async ({
    nonadminPage,
  }) => {
    await dragAndDropFiles(nonadminPage, [
      {
        name: 'config.json',
        type: 'application/json',
        content: '{"key":"value"}',
      },
    ]);
    await expect(
      nonadminPage.getByText('Drop your files here'),
    ).not.toBeVisible({ timeout: 5_000 });
    await expect(
      nonadminPage.getByText('The dropped file type is not supported.'),
    ).toBeVisible({ timeout: 10_000 });
    await expect(nonadminPage.getByText('config.json')).not.toBeVisible();
    logger.info('JSON file correctly rejected via drag and drop');
  });

  test('non-admin goes to chat page and drops an xml file which shows the rejection toast', async ({
    nonadminPage,
  }) => {
    await dragAndDropFiles(nonadminPage, [
      { name: 'data.xml', type: 'application/xml', content: '<root></root>' },
    ]);
    await expect(
      nonadminPage.getByText('The dropped file type is not supported.'),
    ).toBeVisible({ timeout: 10_000 });
    await expect(nonadminPage.getByText('data.xml')).not.toBeVisible();
    logger.info('XML file correctly rejected via drag and drop');
  });

  test('non-admin goes to chat page and drops an exe file which shows the rejection toast', async ({
    nonadminPage,
  }) => {
    await dragAndDropFiles(nonadminPage, [
      { name: 'program.exe', type: 'application/x-msdownload', content: '' },
    ]);
    await expect(
      nonadminPage.getByText('The dropped file type is not supported.'),
    ).toBeVisible({ timeout: 10_000 });
    await expect(nonadminPage.getByText('program.exe')).not.toBeVisible();
    logger.info('EXE file correctly rejected via drag and drop');
  });

  // ── Drag & drop – mixed files ──────────────────────────────────────────────

  test('non-admin goes to chat page and drops mixed valid and invalid files which shows a partial rejection toast', async ({
    nonadminPage,
  }) => {
    await dragAndDropFiles(nonadminPage, [
      { name: 'photo.png', type: 'image/png', content: 'png-data' },
      { name: 'report.pdf', type: 'application/pdf', content: 'pdf-data' },
      { name: 'config.json', type: 'application/json', content: '{}' },
      { name: 'data.xml', type: 'application/xml', content: '<x/>' },
    ]);
    await expect(
      nonadminPage.getByText('Drop your files here'),
    ).not.toBeVisible({ timeout: 5_000 });
    await expect(
      nonadminPage.getByText(/2 files were rejected due to unsupported type/),
    ).toBeVisible({ timeout: 10_000 });
    await expect(nonadminPage.getByText('photo.png')).toBeVisible({
      timeout: 15_000,
    });
    await expect(nonadminPage.getByText('report.pdf')).toBeVisible({
      timeout: 15_000,
    });
    await expect(nonadminPage.getByText('config.json')).not.toBeVisible();
    await expect(nonadminPage.getByText('data.xml')).not.toBeVisible();
    logger.info(
      'Mixed drop: accepted files uploaded, rejected files shown in toast',
    );
  });

  test('non-admin goes to chat page and drops one accepted and one rejected file which shows a singular rejection toast', async ({
    nonadminPage,
  }) => {
    await dragAndDropFiles(nonadminPage, [
      { name: 'image.jpg', type: 'image/jpeg', content: 'jpg-data' },
      { name: 'script.json', type: 'application/json', content: '{}' },
    ]);
    await expect(
      nonadminPage.getByText(/1 file was rejected due to unsupported type/),
    ).toBeVisible({ timeout: 10_000 });
    await expect(nonadminPage.getByText('image.jpg')).toBeVisible({
      timeout: 15_000,
    });
    await expect(nonadminPage.getByText('script.json')).not.toBeVisible();
    logger.info('Single rejection toast shown correctly with singular grammar');
  });

  // ── Upload button – multiple files ────────────────────────────────────────

  // fixme: non-admin user encounters pricing paywall that blocks file upload
  test.fixme(
    'non-admin goes to chat page and uploads multiple accepted files simultaneously via the upload button',
    async ({ nonadminPage }) => {
      const attachButton = nonadminPage.getByRole('button', {
        name: 'Attach File',
      });
      const visible = await attachButton
        .isVisible({ timeout: 10_000 })
        .catch(() => false);
      if (!visible) return;
      await attachButton.click();
      const uploadMenuItem = nonadminPage.getByRole('menuitem', {
        name: 'Upload File',
      });
      if (
        !(await uploadMenuItem.isVisible({ timeout: 2_000 }).catch(() => false))
      )
        return;
      const [chooser] = await Promise.all([
        nonadminPage.waitForEvent('filechooser'),
        uploadMenuItem.click(),
      ]);
      await chooser.setFiles([ACCEPTED_IMAGE, ACCEPTED_TXT]);
      await expect(nonadminPage.getByText('acessibility png.png')).toBeVisible({
        timeout: 15_000,
      });
      await expect(nonadminPage.getByText('outerHTML.txt')).toBeVisible({
        timeout: 15_000,
      });
      logger.info('Multiple files uploaded successfully via button');
    },
  );

  // ── Send with attachment ───────────────────────────────────────────────────

  // fixme: non-admin user encounters pricing paywall that blocks file upload
  test.fixme(
    'non-admin goes to chat page and sees the send button enabled when a file is attached without text',
    async ({ nonadminPage, nonadminChatPage }) => {
      const chooser = await openFileChooser(nonadminPage);
      if (!chooser) return;
      await chooser.setFiles(ACCEPTED_IMAGE);
      await expect(nonadminPage.getByText('acessibility png.png')).toBeVisible({
        timeout: 15_000,
      });
      const textarea = nonadminPage.getByRole('textbox', {
        name: /ask anything/i,
      });
      await expect(textarea).toHaveValue('');
      await expect(nonadminChatPage.sendButton).toBeEnabled({
        timeout: 30_000,
      });
      logger.info('Send button is enabled with file attachment and no text');
    },
  );
});
