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

  test('admin goes to Memory tab and enables then disables the capability toggle', async ({
    createMentorPage,
    editMentorPage,
    page,
  }) => {
    await createMentorPage.openAndCreate();
    // The "Long-term Memory" master toggle moved from Settings →
    // Capabilities to an in-tab `CapabilityGate` at the top of the Memory
    // tab itself (feat/2040). It now auto-saves on click (optimistic local
    // state via `useEditMentorMutation`) — no footer Save button involved.
    await editMentorPage.open('Memory');
    await waitForPageReady(page);
    const wasEnabled = await editMentorPage.memory.isCapabilityEnabled();
    // Toggle to the opposite state, then toggle back to restore.
    await editMentorPage.memory.setCapabilityEnabled(!wasEnabled);
    await editMentorPage.memory.setCapabilityEnabled(wasEnabled);
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

    // Seed a category before the CRUD flow: selectConcreteMemoryCategory waits
    // for a non-"All" option, but on a fresh mentor with zero admin categories
    // the SelectContent renders 0 SelectItems and the locator times out. Seed
    // an E2E category so the dropdown has at least one concrete entry. We
    // best-effort clean it up at the end so the suite stays idempotent.
    const seededCategory = `E2E Seed ${suffix}`;
    await editMentorPage.memory.openManageCategories();
    await editMentorPage.memory.createCategory(seededCategory);
    await editMentorPage.memory.closeManageCategories();

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

    // Best-effort cleanup of the seeded category so leftover E2E rows don't
    // accumulate. Failures here are swallowed — the CRUD flow already passed.
    try {
      await editMentorPage.memory.openManageCategories();
      if (await editMentorPage.memory.hasCategory(seededCategory)) {
        await editMentorPage.memory
          .deleteCategory(seededCategory)
          .catch(() => undefined);
      }
      await editMentorPage.memory.closeManageCategories();
    } catch {
      // Ignore cleanup errors.
    }

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

  // ── Shared Memories sub-tab ─────────────────────────────────────────────
  // The Memory tab is the SDK's AgentMemoryTab: capability gate on top, then
  // "Personal Memories" (default) and "Shared Memories" sub-tabs. Both sit inside the
  // gate, which is inert while the toggle is off, so each test switches the
  // capability on first (a no-op when the fresh mentor already has it on).

  test('admin sees Personal Memories and Shared Memories sub-tabs, Personal Memories is active by default, and the Shared Memories sub-tab shows the empty-state guidance on a fresh mentor', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate();
    await editMentorPage.open('Memory');
    await waitForPageReady(page);

    const memory = editMentorPage.memory;
    await memory.setCapabilityEnabled(true);

    await expect(memory.subTabs).toBeVisible({ timeout: 15_000 });
    await expect(memory.personalSubTab).toHaveText('Personal Memories');
    await expect(memory.sharedSubTab).toHaveText('Shared Memories');

    // Personal Memories is the default view: its Categories button is on screen
    // and the Shared Memories section is not mounted yet. (Both sub-tabs have an
    // "Add Memory" button, so the Categories button is the personal-only marker.)
    await expect(memory.personalSubTab).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(memory.sharedSubTab).toHaveAttribute('aria-selected', 'false');
    await expect(memory.manageCategoriesButton).toBeVisible({
      timeout: 15_000,
    });
    await expect(memory.sharedMemorySection).toHaveCount(0);

    await memory.switchToSubTab('shared');
    await expect(memory.sharedSubTab).toHaveAttribute('aria-selected', 'true');
    await expect(memory.personalSubTab).toHaveAttribute(
      'aria-selected',
      'false',
    );
    await expect(memory.manageCategoriesButton).toHaveCount(0);

    // A brand-new agent has no shared memories yet: the empty state (not a
    // blank list) explains what the section is for. Like Personal Memories,
    // there is no repeated title, subtitle or note above the list.
    await expect(memory.sharedMemoryEmptyState).toBeVisible({
      timeout: 15_000,
    });
    await expect(memory.sharedMemoryEmptyTitle).toBeVisible();
    await expect(memory.sharedMemoryList).toHaveCount(0);
    await expect(memory.sharedMemoryAddButton).toBeVisible();

    // Going back restores the Personal Memories content.
    await memory.switchToSubTab('personal');
    await expect(memory.manageCategoriesButton).toBeVisible({
      timeout: 15_000,
    });
    await expect(memory.sharedMemorySection).toHaveCount(0);

    await editMentorPage.close();
  });

  test('admin adds, edits and deletes a shared memory (delete asks for confirmation)', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate();
    await editMentorPage.open('Memory');
    await waitForPageReady(page);

    const memory = editMentorPage.memory;
    await memory.setCapabilityEnabled(true);
    await memory.switchToSubTab('shared');
    await expect(memory.sharedMemoryEmptyState).toBeVisible({
      timeout: 15_000,
    });

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const initialContent = `E2E shared memory ${suffix}`;
    const updatedContent = `E2E shared memory updated ${suffix}`;

    // ─── ADD ────────────────────────────────────────────────────────────
    await memory.addSharedMemory(initialContent);
    await expect(memory.sharedMemoryEntryByContent(initialContent)).toHaveCount(
      1,
    );
    // Same card as Personal Memories: the created-at time on the left and the
    // author (the signed-in admin) on the right.
    await expect(
      memory.sharedMemoryEntryByContent(initialContent),
    ).toContainText(/ago/);
    // The empty-state guidance gives way to the list once an entry exists.
    await expect(memory.sharedMemoryEmptyState).toHaveCount(0);

    // ─── EDIT ───────────────────────────────────────────────────────────
    await memory.editSharedMemoryByContent(initialContent, updatedContent);
    await expect(memory.sharedMemoryEntryByContent(updatedContent)).toHaveCount(
      1,
    );

    // ─── DELETE (asks for confirmation first) ───────────────────────────
    const deleteDialog =
      await memory.openSharedMemoryDeleteDialog(updatedContent);
    await expect(deleteDialog).toContainText(
      'Are you sure you want to delete this memory? This action cannot be undone.',
    );
    await memory.cancelSharedMemoryDialog(deleteDialog);
    // Cancelling leaves the entry untouched.
    await expect(memory.sharedMemoryEntryByContent(updatedContent)).toHaveCount(
      1,
    );

    await memory.deleteSharedMemoryByContent(updatedContent);
    await expect(memory.sharedMemoryEntryByContent(updatedContent)).toHaveCount(
      0,
    );
    await expect(memory.sharedMemoryEmptyState).toBeVisible({
      timeout: 15_000,
    });

    await editMentorPage.close();
  });

  test('adding a shared memory that already exists shows the duplicate message inside the dialog', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate();
    await editMentorPage.open('Memory');
    await waitForPageReady(page);

    const memory = editMentorPage.memory;
    await memory.setCapabilityEnabled(true);
    await memory.switchToSubTab('shared');

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const content = `E2E shared memory duplicate ${suffix}`;

    await memory.addSharedMemory(content);

    try {
      await memory.expectDuplicateError(content);
      // The rejected repeat must not have created a second row.
      await expect(memory.sharedMemoryEntryByContent(content)).toHaveCount(1);
    } finally {
      // Best-effort: the run-level teardown deletes the mentor anyway, so a
      // failed cleanup here must not mask the real assertion failure.
      await memory.deleteSharedMemoryByContent(content).catch(() => undefined);
    }

    await editMentorPage.close();
  });

  test('the Save button stays disabled until the shared memory text has at least 10 characters', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate();
    await editMentorPage.open('Memory');
    await waitForPageReady(page);

    const memory = editMentorPage.memory;
    await memory.setCapabilityEnabled(true);

    const dialog = await memory.openSharedMemoryAddDialog();
    const input = memory.sharedMemoryContentInput(dialog);
    const saveButton = memory.sharedMemorySaveButton(dialog);

    // Nothing typed yet: Save is off.
    await expect(saveButton).toBeDisabled();

    await input.fill('abcde');
    await expect(dialog.getByText('5/10 characters minimum')).toBeVisible();
    await expect(saveButton).toBeDisabled();

    await input.fill('abcdefghijkl');
    await expect(
      dialog.getByText('12 characters', { exact: true }),
    ).toBeVisible();
    await expect(dialog.getByText('/10 characters minimum')).toHaveCount(0);
    await expect(saveButton).toBeEnabled();

    // Cancelling must not create anything.
    await memory.cancelSharedMemoryDialog(dialog);
    await expect(memory.sharedMemoryEmptyState).toBeVisible({
      timeout: 15_000,
    });

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
    // Every Edit Agent open blocks on the modal's hydration spinner
    // (settings + RBAC prefetch churn — ~30-90s per open, see
    // EditMentorPage.waitForHydrated), and this test opens the modal up to
    // THREE times (enable memory, disable memory, restore) plus creates a
    // fresh mentor first. The default 120s budget expired mid-hydration on
    // the second open (observed on staging). Mirrors journey 50's
    // cp-agent-02 and journey 60's sub-resource budget.
    test.setTimeout(420_000);

    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Requires admin access');
      return;
    }
    // Own mentor per test — see Journey 24 describe block above for rationale.
    await createMentorPage.openAndCreate();

    // The "Long-term Memory" master toggle now lives in-tab on
    // the Memory tab itself (feat/2040 — moved off Settings → Capabilities).
    // First ensure memory is enabled on the mentor.
    await editMentorPage.open('Memory');
    await waitForPageReady(page);

    const wasEnabled = await editMentorPage.memory.isCapabilityEnabled();
    if (!wasEnabled) {
      await editMentorPage.memory.setCapabilityEnabled(true);
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
    await editMentorPage.open('Memory');
    await waitForPageReady(page);
    await editMentorPage.memory.setCapabilityEnabled(false);
    await editMentorPage.close();
    await page.waitForTimeout(2_000);

    // Memory button should not be visible when memory is disabled
    await expect(chatPage.memoryButton).not.toBeVisible({ timeout: 5_000 });

    // Restore original state
    if (wasEnabled) {
      await editMentorPage.open('Memory');
      await waitForPageReady(page);
      await editMentorPage.memory.setCapabilityEnabled(true);
      await editMentorPage.close();
    }
  });
});
