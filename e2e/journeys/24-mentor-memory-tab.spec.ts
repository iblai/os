import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';

test.describe('Journey 24: Mentor Memory Tab', () => {
  test.beforeEach(async ({ page, editMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Memory tab requires admin access');
      return;
    }
    await editMentorPage.open('Memory');
    await waitForPageReady(page);
  });

  test('admin goes to edit mentor modal and verifies the Memory tab label is visible', async ({
    editMentorPage,
  }) => {
    const memoryTab = editMentorPage.dialog.getByRole('tab', {
      name: 'Memory',
    });
    await expect(memoryTab).toBeVisible({ timeout: 10_000 });
    await editMentorPage.close();
  });

  test('admin goes to memory tab and enables then disables the Reference saved memories toggle', async ({
    page,
    editMentorPage,
  }) => {
    const wasEnabled = await editMentorPage.memory.isReferenceEnabled();
    await editMentorPage.memory.toggleReference();
    await editMentorPage.memory.toggleReference();
    // Restore original state
    const currentState = await editMentorPage.memory.isReferenceEnabled();
    if (currentState !== wasEnabled) {
      await editMentorPage.memory.toggleReference();
    }
    await editMentorPage.close();
  });

  test('admin goes to memory tab and verifies user memories list shows entries or empty state and can delete an entry', async ({
    editMentorPage,
  }) => {
    await expect(editMentorPage.memory.addMemoryButton).toBeVisible({
      timeout: 10_000,
    });
    const hasMemories = await editMentorPage.memory.hasMemories();
    if (!hasMemories) {
      await expect(editMentorPage.memory.emptyState).toBeVisible({
        timeout: 5_000,
      });
      await editMentorPage.close();
      return;
    }
    const initialCount = await editMentorPage.memory.deleteButtons.count();
    await editMentorPage.memory.deleteFirst();
    await editMentorPage.page.waitForTimeout(2_000);
    const finalCount = await editMentorPage.memory.deleteButtons
      .count()
      .catch(() => 0);
    expect(finalCount).toBeLessThan(initialCount);
    await editMentorPage.close();
  });
});
