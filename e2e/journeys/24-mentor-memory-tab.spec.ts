import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';

test.describe('Journey 24: Mentor Memory Tab', () => {
  test.beforeEach(async ({ page, createMentorPage, editMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Memory tab requires admin access');
      return;
    }
    // Each test owns its own mentor — the memory tab tests share categories
    // and entries server-side, so without isolation parallel workers race
    // (e.g. one worker's category cleanup 404s another worker's create POST).
    await createMentorPage.openAndCreate();
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

  test('admin goes to memory tab and enables then disables the Enable Memory toggle', async ({
    editMentorPage,
  }) => {
    const wasEnabled = await editMentorPage.memory.isEnableMemoryChecked();
    await editMentorPage.memory.toggleEnableMemory();
    await editMentorPage.memory.toggleEnableMemory();
    // Restore original state
    const currentState = await editMentorPage.memory.isEnableMemoryChecked();
    if (currentState !== wasEnabled) {
      await editMentorPage.memory.toggleEnableMemory();
    }
    await editMentorPage.close();
  });

  test('admin goes to memory tab and verifies user memories list shows entries or empty state and can delete an entry', async ({
    editMentorPage,
  }) => {
    await expect(editMentorPage.memory.addMemoryButton).toBeVisible({
      timeout: 10_000,
    });
    // Seed our own entry so we can delete it without racing other parallel
    // specs that may be adding/removing entries concurrently.
    const seedContent = `Delete-target memory ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await editMentorPage.memory.createMemory(seedContent);
    await expect(
      editMentorPage.memory.entryByContent(seedContent).first(),
    ).toBeVisible({ timeout: 10_000 });

    // deleteByContent already asserts the entry is gone; no extra check needed.
    await editMentorPage.memory.deleteByContent(seedContent);
    await editMentorPage.close();
  });

  test('admin creates a new memory from the memory tab', async ({
    editMentorPage,
  }) => {
    const testContent = `E2E test memory ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await editMentorPage.memory.createMemory(testContent);
    // Auto-retrying expect rides out the brief RTK Query refetch window
    // that follows the "Memory created" toast.
    await expect(
      editMentorPage.memory.entryByContent(testContent).first(),
    ).toBeVisible({ timeout: 10_000 });
    await editMentorPage.close();
  });

  test('admin edits a memory entry from the memory tab', async ({
    editMentorPage,
  }) => {
    // Always seed our own memory so the edit targets a known entry. Do NOT
    // edit the "first" entry — parallel specs may insert/remove entries and
    // shift positions mid-test.
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const seedContent = `Seed memory ${suffix}`;
    const updatedContent = `Updated memory ${suffix}`;

    await editMentorPage.memory.createMemory(seedContent);
    await expect(
      editMentorPage.memory.entryByContent(seedContent).first(),
    ).toBeVisible({ timeout: 10_000 });

    await editMentorPage.memory.editByContent(seedContent, updatedContent);

    // After save, the list refetches; use auto-retrying assertions so we
    // wait for the DOM to settle into the post-update state instead of
    // snapshotting it mid-refetch.
    await expect(
      editMentorPage.memory.entryByContent(updatedContent).first(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(editMentorPage.memory.entryByContent(seedContent)).toHaveCount(
      0,
      { timeout: 10_000 },
    );
    await editMentorPage.close();
  });

  test('admin manages memory categories (create, rename, delete)', async ({
    editMentorPage,
  }) => {
    const suffix = Date.now();
    const created = `E2E Cat ${suffix}`;
    const renamed = `E2E Cat Renamed ${suffix}`;

    await editMentorPage.memory.openManageCategories();

    try {
      await editMentorPage.memory.createCategory(created);
      expect(await editMentorPage.memory.hasCategory(created)).toBe(true);

      await editMentorPage.memory.renameCategory(created, renamed);
      expect(await editMentorPage.memory.hasCategory(renamed)).toBe(true);
      expect(await editMentorPage.memory.hasCategory(created)).toBe(false);

      await editMentorPage.memory.deleteCategory(renamed);
      expect(await editMentorPage.memory.hasCategory(renamed)).toBe(false);
    } finally {
      // Best-effort cleanup in case an assertion failed mid-flow.
      for (const name of [created, renamed]) {
        if (await editMentorPage.memory.hasCategory(name)) {
          await editMentorPage.memory
            .deleteCategory(name)
            .catch(() => undefined);
        }
      }
      await editMentorPage.memory.closeManageCategories();
    }

    await editMentorPage.close();
  });

  test('admin creates then deletes a memory to verify full CRUD cycle', async ({
    editMentorPage,
  }) => {
    const testContent = `CRUD test memory ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await editMentorPage.memory.createMemory(testContent);
    await expect(
      editMentorPage.memory.entryByContent(testContent).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Delete by content, not position — parallel specs mutate the list.
    // deleteByContent has its own auto-retrying detached assertion.
    await editMentorPage.memory.deleteByContent(testContent);
    await editMentorPage.close();
  });
});

test.describe('Journey 24: Memory in Prompt Box', () => {
  test('Memory button visibility in chat input reflects mentor memory setting', async ({
    page,
    chatPage,
    createMentorPage,
    editMentorPage,
  }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Requires admin access');
      return;
    }
    // Own mentor per test — see Journey 24 describe block above for rationale.
    await createMentorPage.openAndCreate();

    // First ensure memory is enabled on the mentor
    await editMentorPage.open('Memory');
    await waitForPageReady(page);

    const wasEnabled = await editMentorPage.memory.isEnableMemoryChecked();
    if (!wasEnabled) {
      await editMentorPage.memory.toggleEnableMemory();
    }
    await editMentorPage.close();
    await page.waitForTimeout(2_000);

    // Check if Memory button is visible in the chat input area
    // Note: visibility also depends on tenant-level memsearch config
    const memoryBtnVisible = await chatPage.memoryButton
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (memoryBtnVisible) {
      // If visible, clicking it should open the memory popover
      await chatPage.memoryButton.click();
      await expect(
        page.getByText('Your Memory').or(page.getByText('Your saved memories')),
      ).toBeVisible({ timeout: 10_000 });
    }

    // Now disable memory on the mentor and verify button disappears
    await editMentorPage.open('Memory');
    await waitForPageReady(page);
    const isCurrentlyEnabled =
      await editMentorPage.memory.isEnableMemoryChecked();
    if (isCurrentlyEnabled) {
      await editMentorPage.memory.toggleEnableMemory();
    }
    await editMentorPage.close();
    await page.waitForTimeout(2_000);

    // Memory button should not be visible when memory is disabled
    await expect(chatPage.memoryButton).not.toBeVisible({ timeout: 5_000 });

    // Restore original state
    if (wasEnabled) {
      await editMentorPage.open('Memory');
      await waitForPageReady(page);
      await editMentorPage.memory.toggleEnableMemory();
      await editMentorPage.close();
    }
  });
});
