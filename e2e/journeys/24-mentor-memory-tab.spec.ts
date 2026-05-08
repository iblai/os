import { test, expect } from '../fixtures/mentor-test';
import type { Locator, Page } from '@playwright/test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';

async function selectConcreteMemoryCategory(
  page: Page,
  memoryDialog: Locator,
): Promise<void> {
  const categoryTrigger = memoryDialog.getByRole('combobox').first();
  await expect(categoryTrigger).toBeVisible({ timeout: 10_000 });
  await categoryTrigger.click();

  // "All" is a filter tab, not a create/edit category option. Prefer a
  // seeded category over any E2E category left behind by a previous failed run.
  let option = page
    .getByRole('option')
    .filter({ hasNotText: /^All$/i })
    .filter({ hasNotText: /^E2E /i })
    .first();

  if (
    !(await option
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false))
  ) {
    option = page.getByRole('option').filter({ hasNotText: /^All$/i }).first();
  }

  await expect(option).toBeVisible({ timeout: 10_000 });
  const categoryName = ((await option.textContent()) ?? '').trim();
  expect(categoryName, 'memory category option text').not.toBe('');
  await option.click();
  await expect(categoryTrigger).toContainText(categoryName, {
    timeout: 5_000,
  });
}

async function expectDialogClosedWithoutError(
  page: Page,
  dialog: Locator,
  errorText: RegExp,
  actionName: string,
): Promise<void> {
  const result = await Promise.race([
    dialog
      .waitFor({ state: 'hidden', timeout: 30_000 })
      .then(() => 'closed' as const)
      .catch(() => 'timeout' as const),
    page
      .getByText(errorText)
      .first()
      .waitFor({ state: 'visible', timeout: 30_000 })
      .then(() => 'error' as const)
      .catch(() => 'timeout' as const),
  ]);

  expect(result, `${actionName} should close without an error toast`).toBe(
    'closed',
  );
}

test.describe('Journey 24: Mentor Memory Tab', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Memory tab requires admin access');
      return;
    }
  });

  // Each test owns its own mentor — the memory tab tests share categories
  // and entries server-side, so without isolation parallel workers race
  // (e.g. one worker's category cleanup 404s another worker's create POST).
  // The mentor-creation + memory-tab-open setup lives inside each test
  // (not in beforeEach) so flakes in the Create Agent dialog surface on the
  // owning test rather than collapsing the whole describe block.

  test('admin goes to edit mentor modal and verifies the Memory tab label is visible', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate();
    await editMentorPage.open('Memory');
    await waitForPageReady(page);

    const memoryTab = editMentorPage.dialog.getByRole('tab', {
      name: 'Memory',
    });
    await expect(memoryTab).toBeVisible({ timeout: 10_000 });
    await editMentorPage.close();
  });

  test('admin goes to settings tab and enables then disables the Memory toggle', async ({
    createMentorPage,
    editMentorPage,
    page,
  }) => {
    await createMentorPage.openAndCreate();
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    // The Memory toggle moved from the Memory tab to the Settings tab (fix/1584).
    // It is now a form-driven field — changes persist only on Save.
    const wasEnabled = await editMentorPage.settings.isMemoryEnabled();
    // Toggle to the opposite state, then toggle back to restore.
    await editMentorPage.settings.setMemoryEnabled(!wasEnabled);
    await editMentorPage.settings.setMemoryEnabled(wasEnabled);
    await editMentorPage.close();
  });

  /**
   * Consolidated CRUD lifecycle: add → edit → delete in one test.
   *
   * Replaced the previous separate add/edit/delete tests because each one
   * paid the full mentor-creation cost and they collectively retried the
   * same RTK refetch window 4× — multiplying the chance of CI flakes.
   *
   * Selectors are pinned to the source:
   *   - List container:  role="list", aria-label="Saved memories"
   *   - Entry:           role="listitem"
   *   - Action button:   role="button", aria-label="Memory actions"
   *   - Add button:      "Add Memory" text (full label, sm:inline)
   *   - Add dialog:      DialogTitle "Add Memory"
   *   - Edit dialog:     DialogTitle "Edit Memory"
   *   - Delete dialog:   DialogTitle "Delete Memory"
   *   - Save / Delete:   role="button" with the literal text
   *   - Categories tab:  role="tablist", aria-label="Memory categories"
   *
   * No success-toast waits — sonner toasts auto-dismiss after ~4s and are
   * racy in CI. We wait on durable post-state UI, but fail fast on explicit
   * error toasts so rejected mutations don't burn the full hidden timeout.
   *
   * Save button is gated on content >= 10 chars (source: add/edit modals).
   */
  test('admin completes the full memory CRUD lifecycle in one flow: add → edit → delete', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate();
    await editMentorPage.open('Memory');
    await waitForPageReady(page);

    const dialog = editMentorPage.dialog;
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const initialContent = `E2E memory ${suffix}`;
    const updatedContent = `E2E memory updated ${suffix}`;

    const memoryList = dialog.getByRole('list', { name: 'Saved memories' });
    const allTab = dialog
      .getByRole('tablist', { name: 'Memory categories' })
      .getByRole('tab', { name: 'All', exact: true });

    /** Click "All" filter (if available) so the unfiltered list is showing. */
    const ensureAllFilter = async () => {
      if (await allTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await allTab.click();
      }
      // Wait for the in-flight memories fetch to settle before assertions.
      await dialog
        .getByText('Loading memories...')
        .waitFor({ state: 'hidden', timeout: 15_000 })
        .catch(() => undefined);
    };

    // Pre-settle the list so the Add Memory button is stable.
    await dialog
      .getByText('Loading memories...')
      .waitFor({ state: 'hidden', timeout: 15_000 })
      .catch(() => undefined);

    // ─── ADD ────────────────────────────────────────────────────────────
    const addMemoryBtn = dialog.getByRole('button', {
      name: /^add memory$/i,
    });
    await expect(addMemoryBtn).toBeVisible({ timeout: 15_000 });
    await addMemoryBtn.click();

    // IMPORTANT: identify each child modal by its DialogTitle (Radix wires
    // it to the dialog's accessible name) rather than `filter({ hasText })`.
    // The parent "Edit Agent" dialog contains an "Add Memory" button, so a
    // hasText filter would match BOTH dialogs and `toBeHidden()` would never
    // resolve after the child closes.
    const addDialog = page.getByRole('dialog', {
      name: 'Add Memory',
      exact: true,
    });
    await expect(addDialog).toBeVisible({ timeout: 10_000 });

    // Fill ≥ 10 chars (source: Save is disabled below 10). Pick a concrete
    // category: "All" is only a filter, and its "general" fallback may not be
    // a valid category slug in the E2E tenant.
    await selectConcreteMemoryCategory(page, addDialog);
    await addDialog
      .getByPlaceholder('Enter memory content...')
      .fill(initialContent);

    const addSaveBtn = addDialog.getByRole('button', { name: 'Save' });
    await expect(addSaveBtn).toBeEnabled({ timeout: 5_000 });
    await addSaveBtn.click();

    // Dialog close = create mutation resolved. Don't wait on success toasts.
    await expectDialogClosedWithoutError(
      page,
      addDialog,
      /Failed to create memory/i,
      'Add memory',
    );

    await ensureAllFilter();

    const initialEntry = memoryList
      .getByRole('listitem')
      .filter({ hasText: initialContent });
    await expect(initialEntry).toBeVisible({ timeout: 30_000 });

    // ─── EDIT ───────────────────────────────────────────────────────────
    await initialEntry.getByRole('button', { name: 'Memory actions' }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();

    const editDialog = page.getByRole('dialog', {
      name: 'Edit Memory',
      exact: true,
    });
    await expect(editDialog).toBeVisible({ timeout: 10_000 });

    const editTextarea = editDialog.getByPlaceholder('Enter memory content...');
    await editTextarea.fill(updatedContent);

    const editSaveBtn = editDialog.getByRole('button', { name: 'Save' });
    await expect(editSaveBtn).toBeEnabled({ timeout: 5_000 });
    await editSaveBtn.click();

    await expectDialogClosedWithoutError(
      page,
      editDialog,
      /Failed to update memory/i,
      'Edit memory',
    );

    await ensureAllFilter();

    const updatedEntry = memoryList
      .getByRole('listitem')
      .filter({ hasText: updatedContent });
    await expect(updatedEntry).toBeVisible({ timeout: 30_000 });
    await expect(
      memoryList.getByRole('listitem').filter({ hasText: initialContent }),
    ).toHaveCount(0, { timeout: 30_000 });

    // ─── DELETE ─────────────────────────────────────────────────────────
    await updatedEntry.getByRole('button', { name: 'Memory actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();

    const deleteDialog = page.getByRole('dialog', {
      name: 'Delete Memory',
      exact: true,
    });
    await expect(deleteDialog).toBeVisible({ timeout: 10_000 });

    const confirmDeleteBtn = deleteDialog.getByRole('button', {
      name: 'Delete',
      exact: true,
    });
    await expect(confirmDeleteBtn).toBeEnabled({ timeout: 5_000 });
    await confirmDeleteBtn.click();

    await expectDialogClosedWithoutError(
      page,
      deleteDialog,
      /Failed to delete memory/i,
      'Delete memory',
    );

    await expect(
      memoryList.getByRole('listitem').filter({ hasText: updatedContent }),
    ).toHaveCount(0, { timeout: 30_000 });

    await editMentorPage.close();
  });

  test('admin manages memory categories (create, rename, delete)', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate();
    await editMentorPage.open('Memory');
    await waitForPageReady(page);

    // Random suffix (not just Date.now()) so category names cannot collide
    // when two parallel workers reach this test in the same millisecond.
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

    // The Memory toggle is now in the Settings tab (fix/1584).
    // First ensure memory is enabled on the mentor.
    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    const wasEnabled = await editMentorPage.settings.isMemoryEnabled();
    if (!wasEnabled) {
      await editMentorPage.settings.setMemoryEnabled(true);
    }
    await editMentorPage.close();
    await page.waitForTimeout(2_000);

    // Check if Memory button is visible in the chat input area.
    // Note: visibility also depends on tenant-level memsearch config.
    const memoryBtnVisible = await chatPage.memoryButton
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (memoryBtnVisible) {
      // If visible, clicking it should open the memory popover.
      // The popover always renders the "Your Memory" heading; targeting the
      // heading role keeps this stable even though the popup also includes a
      // separate "Your saved memories for this mentor" paragraph (a previous
      // `.or()` fallback against both texts tripped strict mode).
      await chatPage.memoryButton.click();
      await expect(
        page.getByRole('heading', { name: 'Your Memory' }),
      ).toBeVisible({ timeout: 10_000 });
    }

    // Now disable memory on the mentor and verify button disappears.
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await editMentorPage.settings.setMemoryEnabled(false);
    await editMentorPage.close();
    await page.waitForTimeout(2_000);

    // Memory button should not be visible when memory is disabled
    await expect(chatPage.memoryButton).not.toBeVisible({ timeout: 5_000 });

    // Restore original state
    if (wasEnabled) {
      await editMentorPage.open('Settings');
      await waitForPageReady(page);
      await editMentorPage.settings.setMemoryEnabled(true);
      await editMentorPage.close();
    }
  });
});
