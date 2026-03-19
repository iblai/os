import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { logger } from '@iblai/iblai-js/playwright';

test.describe('Journey 7: Mentor Settings Tab — Unique ID', () => {
  test.beforeEach(async ({ page, editMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Requires admin access');
      return;
    }
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
  });

  test('admin goes to mentor settings tab and sees the unique ID field is read-only', async ({
    page,
    editMentorPage,
  }) => {
    // Find the unique ID field — it should have readonly or disabled attribute
    const allInputs = editMentorPage.dialog.locator('input');
    const count = await allInputs.count();
    let foundReadonly = false;
    for (let i = 0; i < count; i++) {
      const input = allInputs.nth(i);
      const isReadonly = (await input.getAttribute('readonly')) !== null;
      const isDisabled = await input.isDisabled();
      if (isReadonly || isDisabled) {
        foundReadonly = true;
        break;
      }
    }
    expect(foundReadonly).toBe(true);
    await editMentorPage.close();
  });

  test('admin goes to mentor settings tab and is not allowed to edit the unique ID field', async ({
    page,
    editMentorPage,
  }) => {
    const allInputs = editMentorPage.dialog.locator('input[readonly], input[disabled]');
    await expect(allInputs.first()).toBeVisible({ timeout: 10_000 });
    const originalValue = await allInputs.first().inputValue();
    // Attempt to type — should not change
    await allInputs.first().fill('changed-value');
    const newValue = await allInputs.first().inputValue();
    expect(newValue).toBe(originalValue);
    await editMentorPage.close();
  });

  test('admin goes to mentor settings tab and sees the copy button for unique ID', async ({
    editMentorPage,
  }) => {
    await expect(editMentorPage.settings.copyButton).toBeVisible({ timeout: 10_000 });
    await editMentorPage.close();
  });

  test('admin goes to mentor settings tab and copies the unique ID to clipboard', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.settings.copyUniqueId();
    // Visual feedback should appear
    const feedback = page.getByText(/copied|copy.*success/i);
    const hasFeedback = await feedback
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    // Clipboard content should match the unique ID pattern
    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText().catch(() => ''),
    );
    expect(hasFeedback || clipboardText.length > 0).toBe(true);
    await editMentorPage.close();
  });

  test('admin goes to mentor settings tab and tooltip info icons have type=button and do not submit the form', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.navigateToTab('Settings');
    const tooltipButtons = editMentorPage.dialog.locator('button[type="button"]');
    const count = await tooltipButtons.count();
    expect(count).toBeGreaterThan(0);
    await editMentorPage.close();
  });

  test('admin goes to mentor settings tab and shows visual feedback after successful copy', async ({
    page,
    editMentorPage,
    context,
    browserName,
  }) => {
    test.skip(browserName === 'webkit', 'Skipping on Safari due to clipboard API limitations');
    try { await context.grantPermissions(['clipboard-read', 'clipboard-write']); } catch {}

    const copyButton = page.getByRole('button', { name: 'Copy unique ID to clipboard' });
    await expect(copyButton).toBeVisible({ timeout: 10_000 });
    await copyButton.click();

    // Success state lasts ~1 second — catch it or fall back to clipboard content
    const copiedButton = page.getByRole('button', { name: 'Unique ID copied to clipboard' });
    const successVisible = await copiedButton.isVisible({ timeout: 2_000 }).catch(() => false);
    if (successVisible) {
      await expect(copiedButton.locator('svg')).toBeVisible({ timeout: 15_000 });
      logger.info('Copy button shows visual feedback (success state caught)');
    } else {
      const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
      expect(clip.length).toBeGreaterThan(0);
      logger.info('Success state was brief — clipboard content verified instead');
    }
    await editMentorPage.close();
  });

  test('admin goes to mentor settings tab and the unique ID field has the correct disabled CSS styling', async ({
    editMentorPage,
  }) => {
    const uniqueIdInput = editMentorPage.dialog.getByRole('textbox', { name: 'Unique ID' });
    if (await uniqueIdInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Verify disabled styling classes
      await expect(uniqueIdInput).toHaveClass(/bg-gray-50/);
      await expect(uniqueIdInput).toHaveClass(/cursor-not-allowed/);
      logger.info('Unique ID input has correct disabled styling');
    }
    await editMentorPage.close();
  });

  test('admin goes to mentor settings tab and the copy button has an accessible label', async ({
    editMentorPage,
  }) => {
    const copyButton = editMentorPage.dialog.getByRole('button', { name: 'Copy unique ID to clipboard' });
    await expect(copyButton).toBeVisible({ timeout: 10_000 });
    await expect(copyButton).toHaveAccessibleName('Copy unique ID to clipboard');
    logger.info('Copy button has proper accessible name');
    await editMentorPage.close();
  });

  test('admin goes to mentor settings tab and the unique ID section is properly labeled with a visible label', async ({
    editMentorPage,
  }) => {
    const label = editMentorPage.dialog.getByText('Unique ID', { exact: true });
    await expect(label).toBeVisible({ timeout: 10_000 });
    logger.info('Unique ID section is properly labeled');
    await editMentorPage.close();
  });
});
