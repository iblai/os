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
    const hasMemories = await editMentorPage.memory.hasMemories();
    if (!hasMemories) {
      await expect(editMentorPage.memory.emptyState).toBeVisible({
        timeout: 5_000,
      });
      await editMentorPage.close();
      return;
    }
    const initialCount = await editMentorPage.memory.getMemoryCount();
    await editMentorPage.memory.deleteFirst();
    await editMentorPage.page.waitForTimeout(2_000);
    const finalCount = await editMentorPage.memory.getMemoryCount();
    expect(finalCount).toBeLessThan(initialCount);
    await editMentorPage.close();
  });

  test('admin creates a new memory from the memory tab', async ({
    editMentorPage,
  }) => {
    const testContent = `E2E test memory ${Date.now()}`;
    await editMentorPage.memory.createMemory(testContent);
    // Verify the new memory appears in the list
    await editMentorPage.page.waitForTimeout(2_000);
    const hasMemories = await editMentorPage.memory.hasMemories();
    expect(hasMemories).toBe(true);
    await editMentorPage.close();
  });

  test('admin edits the first memory entry from the memory tab', async ({
    editMentorPage,
  }) => {
    // Ensure there is at least one memory to edit
    const hasMemories = await editMentorPage.memory.hasMemories();
    if (!hasMemories) {
      // Create a memory first so we have something to edit
      await editMentorPage.memory.createMemory(`Seed memory ${Date.now()}`);
      await editMentorPage.page.waitForTimeout(2_000);
    }

    const updatedContent = `Updated memory ${Date.now()}`;
    await editMentorPage.memory.editFirst(updatedContent);

    // Verify the memory was updated
    await editMentorPage.page.waitForTimeout(2_000);
    const firstContent = await editMentorPage.memory.getFirstMemoryContent();
    expect(firstContent).toContain('Updated memory');
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
    const testContent = `CRUD test memory ${Date.now()}`;
    await editMentorPage.memory.createMemory(testContent);
    await editMentorPage.page.waitForTimeout(2_000);

    const countAfterCreate = await editMentorPage.memory.getMemoryCount();
    expect(countAfterCreate).toBeGreaterThan(0);

    // Delete the memory we just created
    await editMentorPage.memory.deleteFirst();
    await editMentorPage.page.waitForTimeout(2_000);

    const countAfterDelete = await editMentorPage.memory.getMemoryCount();
    expect(countAfterDelete).toBeLessThan(countAfterCreate);
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
