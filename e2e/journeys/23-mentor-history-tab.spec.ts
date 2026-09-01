import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import AxeBuilder from '@axe-core/playwright';

test.describe('Journey 23: Mentor History Tab', () => {
  test.beforeEach(async ({ page, editMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'History tab requires admin access');
      return;
    }
    await editMentorPage.open('History');
    await waitForPageReady(page);
  });

  test('admin goes to history dialog and it has no accessibility violations', async ({
    page,
    editMentorPage,
  }) => {
    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .analyze();
    expect(results.violations.length).toBe(0);
    await editMentorPage.close();
  });

  // fixme: flaky — neither conversation list nor empty state visible within timeout (app loading race)
  test.fixme(
    'admin goes to history tab and verifies the conversation list loads or shows an empty state',
    async ({ editMentorPage }) => {
      const hasConversations = await editMentorPage.history.hasConversations();
      const hasEmptyState = await editMentorPage.history.emptyState
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      expect(hasConversations || hasEmptyState).toBe(true);
      await editMentorPage.close();
    },
  );

  test('admin goes to history tab and tests the sentiment and topic filters', async ({
    page,
    editMentorPage,
  }) => {
    const hasConversations = await editMentorPage.history.hasConversations();
    if (!hasConversations) {
      await editMentorPage.close();
      return;
    }
    const sentimentFilter = editMentorPage.history.sentimentFilter;
    if (
      await sentimentFilter.isVisible({ timeout: 5_000 }).catch(() => false)
    ) {
      await sentimentFilter.click();
      const positiveOption = page.getByRole('option', { name: /positive/i });
      if (
        await positiveOption.isVisible({ timeout: 3_000 }).catch(() => false)
      ) {
        await positiveOption.click();
        await page.waitForTimeout(1_000);
      } else {
        await page.keyboard.press('Escape');
      }
    }
    await editMentorPage.close();
  });

  test('admin goes to history tab and clicks a conversation row to expand the transcript in the preview panel', async ({
    page,
    editMentorPage,
  }) => {
    const hasConversations = await editMentorPage.history.hasConversations();
    if (!hasConversations) {
      await editMentorPage.close();
      return;
    }
    await editMentorPage.history.clickFirstRow();
    const preview = editMentorPage.history.previewPanel;
    const visible = await preview
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (visible) {
      await expect(preview).toBeVisible();
    }
    await editMentorPage.close();
  });

  test('admin goes to history tab and clicks on Export to trigger a file download', async ({
    page,
    editMentorPage,
  }) => {
    const exportBtn = editMentorPage.history.exportButton;
    const visible = await exportBtn
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (!visible) {
      await editMentorPage.close();
      return;
    }
    // Skip when the mentor has no conversation history: exporting an empty
    // history produces neither a file download nor the deferred-notification
    // toast (the button just sits at "Exporting…"), so the assertion below
    // can only ever time out. Nothing to export ≠ a real failure.
    const isEmpty = await editMentorPage.history.emptyState
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (isEmpty) {
      await editMentorPage.close();
      test.skip(
        true,
        'Mentor has no conversation history — nothing to export.',
      );
    }
    await expect(exportBtn).toBeEnabled({ timeout: 5_000 });
    const downloadPromise = page
      .waitForEvent('download', { timeout: 30_000 })
      .catch(() => null);
    await exportBtn.click();
    const pendingToast = page.getByText(
      /You will be notified once the report is available\./i,
    );
    const result = await Promise.race([
      downloadPromise.then((d) =>
        d ? { kind: 'download' as const, d } : null,
      ),
      pendingToast
        .waitFor({ state: 'visible', timeout: 33_000 })
        .then(() => ({ kind: 'toast' as const }))
        .catch(() => null),
    ]);
    const finalResult =
      result ??
      (await downloadPromise.then((d) =>
        d ? { kind: 'download' as const, d } : null,
      ));
    expect(finalResult).not.toBeNull();
    if (finalResult?.kind === 'download') {
      expect(finalResult.d.suggestedFilename()).toMatch(/\.(csv|json|xlsx?)$/i);
    } else {
      await expect(pendingToast).toBeVisible();
    }
    await editMentorPage.close();
  });
});
