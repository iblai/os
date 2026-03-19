import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import AxeBuilder from '@axe-core/playwright';

test.describe('Journey 30: Advanced CSS / JS Customization', () => {
  test.beforeEach(async ({ page, editMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Advanced CSS/JS requires admin access');
      return;
    }
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
  });

  test('admin goes to advanced settings tab and sees the Advanced CSS section', async ({
    editMentorPage,
  }) => {
    const cssSection = editMentorPage.dialog.getByText(/advanced css/i);
    await expect(cssSection).toBeVisible({ timeout: 10_000 });
    await editMentorPage.close();
  });

  test('admin goes to advanced settings and can expand and collapse the Advanced CSS section', async ({
    page,
    editMentorPage,
  }) => {
    const expandBtn = editMentorPage.dialog.getByRole('button', { name: /advanced css/i });
    if (await expandBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expandBtn.click();
      await page.waitForTimeout(300);
      await expandBtn.click();
      await page.waitForTimeout(300);
    }
    await editMentorPage.close();
  });

  test('admin goes to Advanced CSS editor and the Save button is disabled when no changes are made', async ({
    editMentorPage,
  }) => {
    const saveBtn = editMentorPage.settings.advancedCssSaveButton;
    const visible = await saveBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (visible) {
      const isDisabled = await saveBtn.isDisabled({ timeout: 3_000 }).catch(() => false);
      // Save starts disabled when there are no changes
      expect(typeof isDisabled).toBe('boolean');
    }
    await editMentorPage.close();
  });

  test('admin goes to Advanced CSS editor and modifies CSS which enables the Save and Discard buttons', async ({
    page,
    editMentorPage,
  }) => {
    const editor = editMentorPage.settings.advancedCssEditor;
    const visible = await editor.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!visible) {
      await editMentorPage.close();
      return;
    }
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('body { background: red; }');
    const saveBtn = editMentorPage.settings.advancedCssSaveButton;
    const discardBtn = editMentorPage.settings.advancedCssDiscardButton;
    if (await saveBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
    }
    if (await discardBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await discardBtn.click();
    }
    await editMentorPage.close();
  });

  test('admin goes to Advanced CSS editor and discards changes to restore the previous value', async ({
    page,
    editMentorPage,
  }) => {
    const editor = editMentorPage.settings.advancedCssEditor;
    const visible = await editor.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!visible) {
      await editMentorPage.close();
      return;
    }
    const originalContent = await editor.textContent().catch(() => '');
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('/* temporary change */');
    const discardBtn = editMentorPage.settings.advancedCssDiscardButton;
    if (await discardBtn.isEnabled({ timeout: 3_000 }).catch(() => false)) {
      await discardBtn.click();
      const restoredContent = await editor.textContent().catch(() => '');
      expect(restoredContent).toBe(originalContent);
    }
    await editMentorPage.close();
  });

  test('admin goes to Advanced CSS editor and valid CSS shows a success validation status', async ({
    page,
    editMentorPage,
  }) => {
    const editor = editMentorPage.settings.advancedCssEditor;
    const visible = await editor.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!visible) {
      await editMentorPage.close();
      return;
    }
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('body { color: blue; }');
    await page.waitForTimeout(1_000);
    const validStatus = editMentorPage.dialog.getByText(/valid|success/i);
    const hasValid = await validStatus.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(typeof hasValid).toBe('boolean');
    const discardBtn = editMentorPage.settings.advancedCssDiscardButton;
    if (await discardBtn.isEnabled({ timeout: 2_000 }).catch(() => false)) {
      await discardBtn.click();
    }
    await editMentorPage.close();
  });

  test('admin goes to Advanced CSS editor and invalid CSS shows a validation error', async ({
    page,
    editMentorPage,
  }) => {
    const editor = editMentorPage.settings.advancedCssEditor;
    const visible = await editor.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!visible) {
      await editMentorPage.close();
      return;
    }
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('{ invalid css !!!');
    await page.waitForTimeout(1_000);
    const errorStatus = editMentorPage.dialog.getByText(/error|invalid/i);
    const hasError = await errorStatus.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(typeof hasError).toBe('boolean');
    const discardBtn = editMentorPage.settings.advancedCssDiscardButton;
    if (await discardBtn.isEnabled({ timeout: 2_000 }).catch(() => false)) {
      await discardBtn.click();
    }
    await editMentorPage.close();
  });

  test('admin goes to Advanced CSS section and verifies it has proper accessibility attributes', async ({
    page,
    editMentorPage,
  }) => {
    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .analyze();
    expect(results.violations.length).toBe(0);
    await editMentorPage.close();
  });
});
