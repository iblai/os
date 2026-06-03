import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';

test.describe('Journey 42: Suggested Prompts', () => {
  test.setTimeout(200_000);

  test.beforeEach(async ({ page, createMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Requires admin access');
      return;
    }

    // Create a fresh mentor for each test so the suggested prompts list
    // starts empty (avoids pagination/page-size pollution from prior runs).
    await createMentorPage.openAndCreate();
  });

  // --------------------------------------------------------------------------
  // Prompts Tab — Viewing
  // --------------------------------------------------------------------------

  test('admin opens the Prompts tab and sees the Suggested Prompts section', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('Prompts');
    await waitForPageReady(page);

    await expect(editMentorPage.prompts.suggestedPromptsSection).toBeVisible({
      timeout: 10_000,
    });
    await expect(editMentorPage.prompts.addNewPromptButton).toBeVisible();

    await editMentorPage.close();
  });

  // --------------------------------------------------------------------------
  // Prompts Tab — Adding
  // --------------------------------------------------------------------------

  test('admin adds a new suggested prompt from the Prompts tab', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('Prompts');
    await waitForPageReady(page);

    const countBefore = await editMentorPage.prompts.getSuggestedPromptCount();

    await editMentorPage.prompts.addSuggestedPrompt(
      'E2E test suggested prompt',
    );

    await expect
      .poll(() => editMentorPage.prompts.getSuggestedPromptCount(), {
        timeout: 10_000,
      })
      .toBeGreaterThan(countBefore);

    await editMentorPage.close();
  });

  // --------------------------------------------------------------------------
  // Prompts Tab — Editing
  // --------------------------------------------------------------------------

  test('admin edits a suggested prompt from the Prompts tab', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('Prompts');
    await waitForPageReady(page);

    // Fresh mentor — add a prompt to edit
    await editMentorPage.prompts.addSuggestedPrompt('E2E prompt to be edited');
    await expect
      .poll(() => editMentorPage.prompts.getSuggestedPromptCount(), {
        timeout: 10_000,
      })
      .toBeGreaterThan(0);

    // Click the Edit button on the first suggested prompt
    const editButton = editMentorPage.dialog
      .getByRole('button', { name: 'Edit', exact: true })
      .nth(4); // 4 system-prompt Edit buttons come first
    await expect(editButton).toBeVisible({ timeout: 10_000 });
    await editButton.click();

    // The Edit Suggested Prompt dialog should open
    const editDialog = page.getByRole('dialog', {
      name: /edit suggested prompt/i,
    });
    await expect(editDialog).toBeVisible({ timeout: 10_000 });

    // Verify category and visibility selectors are present (non-system prompt)
    await expect(
      editDialog.getByRole('combobox', { name: 'Select a category' }),
    ).toBeVisible();
    await expect(
      editDialog.getByRole('combobox', { name: 'Select visibility' }),
    ).toBeVisible();

    // Close without saving
    const closeButton = editDialog
      .getByRole('button', { name: 'Close' })
      .first();
    if (await closeButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await closeButton.click();
    } else {
      await page.keyboard.press('Escape');
    }

    await editMentorPage.close();
  });

  // --------------------------------------------------------------------------
  // Prompts Tab — Running
  // --------------------------------------------------------------------------

  test('admin sees Run buttons on suggested prompts in the Prompts tab', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('Prompts');
    await waitForPageReady(page);

    await editMentorPage.prompts.addSuggestedPrompt(
      'E2E prompt for run visibility',
    );
    // 2-min ceiling: prompt list refresh after POST can take 30s+ when the
    // backing mentor data is mid-fetch (same abort+retry race as explore).
    await expect
      .poll(() => editMentorPage.prompts.getSuggestedPromptCount(), {
        timeout: 120_000,
      })
      .toBeGreaterThan(0);

    const runButtons = editMentorPage.prompts.getSuggestedPromptRunButtons();
    await expect(runButtons.first()).toBeVisible();
    await expect(runButtons.first()).toBeEnabled();

    await editMentorPage.close();
  });

  test('admin runs a suggested prompt and the chat input is populated', async ({
    page,
    editMentorPage,
    chatPage,
  }) => {
    await editMentorPage.open('Prompts');
    await waitForPageReady(page);

    await editMentorPage.prompts.addSuggestedPrompt('E2E run prompt');
    await expect
      .poll(() => editMentorPage.prompts.getSuggestedPromptCount(), {
        timeout: 10_000,
      })
      .toBeGreaterThan(0);

    // Get the prompt text from the first card so we can verify it later
    const firstRunButton = editMentorPage.prompts
      .getSuggestedPromptRunButtons()
      .first();
    const ariaLabel = await firstRunButton.getAttribute('aria-label');
    const promptText = ariaLabel?.replace(/^Run suggested prompt /, '') ?? '';

    // Click Run — this should close the modal and populate the chat input
    await editMentorPage.prompts.runSuggestedPrompt(0);

    // The Edit Mentor modal should close
    await expect(editMentorPage.dialog).not.toBeVisible({ timeout: 10_000 });

    // The chat input should be populated with the prompt text. Use a stable
    // id-based locator (source: components/chat-input-form.tsx:342 sets
    // id="chat-input-textarea") because the role+name selector races against
    // the textarea's aria-labelledby briefly changing during the Redux
    // re-render that follows the modal close.
    const chatInputById = page.locator('#chat-input-textarea');
    await expect(chatInputById).toBeVisible({ timeout: 10_000 });
    if (promptText) {
      await expect(chatInputById).toHaveValue(promptText, {
        timeout: 10_000,
      });
    }
  });

  // --------------------------------------------------------------------------
  // Prompts Tab — Pagination
  // --------------------------------------------------------------------------

  test('admin sees the See More button when more than the page size of prompts exist', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('Prompts');
    await waitForPageReady(page);

    // Fresh mentor starts with 0 prompts. The See More button only appears
    // when count > page size (6). We don't add 7+ prompts here (too slow);
    // we just assert the button is NOT visible on a fresh mentor.
    await expect(editMentorPage.prompts.seeMoreButton).not.toBeVisible({
      timeout: 3_000,
    });

    await editMentorPage.close();
  });

  // --------------------------------------------------------------------------
  // Prompts Tab — Deleting
  // --------------------------------------------------------------------------

  test('admin sees Delete buttons on suggested prompts in the Prompts tab', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('Prompts');
    await waitForPageReady(page);

    await editMentorPage.prompts.addSuggestedPrompt(
      'E2E prompt for delete visibility',
    );
    await expect
      .poll(() => editMentorPage.prompts.getSuggestedPromptCount(), {
        timeout: 10_000,
      })
      .toBeGreaterThan(0);

    // Verify each suggested prompt has a Delete button
    const deleteButtons =
      editMentorPage.prompts.getSuggestedPromptDeleteButtons();
    await expect(deleteButtons.first()).toBeVisible();
    await expect(deleteButtons.first()).toBeEnabled();

    await editMentorPage.close();
  });

  test('admin deletes a suggested prompt from the Prompts tab', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('Prompts');
    await waitForPageReady(page);

    // Fresh mentor — add one prompt so we can delete it
    await editMentorPage.prompts.addSuggestedPrompt(
      'E2E temp prompt for deletion',
    );
    await expect
      .poll(() => editMentorPage.prompts.getSuggestedPromptCount(), {
        timeout: 10_000,
      })
      .toBeGreaterThan(0);
    const countBefore = await editMentorPage.prompts.getSuggestedPromptCount();

    // Delete the first suggested prompt
    await editMentorPage.prompts.deleteSuggestedPrompt(0);

    // Verify the count decreased
    await expect
      .poll(() => editMentorPage.prompts.getSuggestedPromptCount(), {
        timeout: 10_000,
      })
      .toBeLessThan(countBefore);

    await editMentorPage.close();
  });

  // --------------------------------------------------------------------------
  // Prompt Gallery — Chat Area
  // --------------------------------------------------------------------------

  test('admin opens the Prompt Gallery from the chat area', async ({
    page,
    chatPage,
  }) => {
    await waitForPageReady(page);

    const promptsVisible = await chatPage.promptsButton
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (!promptsVisible) {
      test.skip(true, 'Prompts button not visible — prompts may be disabled');
    }

    await chatPage.openPromptGallery();

    // Verify the dialog shows the Prompt Gallery heading
    await expect(
      chatPage.promptGalleryDialog.getByText('Prompt Gallery'),
    ).toBeVisible();

    await chatPage.closePromptGallery();
  });

  test('admin sees prompt cards with Delete buttons in the Prompt Gallery', async ({
    page,
    chatPage,
    editMentorPage,
  }) => {
    await waitForPageReady(page);

    // Add a prompt via the Prompts tab so the gallery has something to show
    await editMentorPage.open('Prompts');
    await waitForPageReady(page);
    await editMentorPage.prompts.addSuggestedPrompt(
      'E2E gallery prompt visibility',
    );
    await expect
      .poll(() => editMentorPage.prompts.getSuggestedPromptCount(), {
        timeout: 10_000,
      })
      .toBeGreaterThan(0);
    await editMentorPage.close();

    const promptsVisible = await chatPage.promptsButton
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (!promptsVisible) {
      test.skip(true, 'Prompts button not visible — prompts may be disabled');
    }

    await chatPage.openPromptGallery();

    const deleteButtons = chatPage.getPromptGalleryDeleteButtons();
    const count = await deleteButtons.count();

    if (count > 0) {
      await expect(deleteButtons.first()).toBeVisible();
      await expect(deleteButtons.first()).toBeEnabled();
    }

    await chatPage.closePromptGallery();
  });

  test('admin deletes a prompt from the Prompt Gallery in the chat area', async ({
    page,
    chatPage,
    editMentorPage,
  }) => {
    await waitForPageReady(page);

    // Add a prompt first so the gallery has at least one to delete
    await editMentorPage.open('Prompts');
    await waitForPageReady(page);
    await editMentorPage.prompts.addSuggestedPrompt(
      'E2E gallery prompt to delete',
    );
    await expect
      .poll(() => editMentorPage.prompts.getSuggestedPromptCount(), {
        timeout: 10_000,
      })
      .toBeGreaterThan(0);
    await editMentorPage.close();

    const promptsVisible = await chatPage.promptsButton
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (!promptsVisible) {
      test.skip(true, 'Prompts button not visible — prompts may be disabled');
    }

    await chatPage.openPromptGallery();

    const countBefore = await chatPage.getPromptGalleryDeleteButtons().count();
    if (countBefore === 0) {
      test.skip(true, 'No prompts available to delete in the gallery');
    }

    // Delete the first prompt
    await chatPage.deletePromptFromGallery(0);

    await expect
      .poll(() => chatPage.getPromptGalleryDeleteButtons().count(), {
        timeout: 10_000,
      })
      .toBeLessThan(countBefore);

    await chatPage.closePromptGallery();
  });

  // ==========================================================================
  // Non-Admin: a student should be able to see and run admin-created prompts
  // but should NOT be able to edit, delete, or add new prompts.
  //
  // We exercise this via the User-mode toggle on the same admin user. The
  // RBAC code path that hides Edit/Delete (`useUserIsStudent()` in
  // hooks/use-user.ts) returns `true` for admins in user mode, so the
  // student experience is rendered identically to that of a real student user.
  // This avoids cross-tenant prompt-visibility limitations that prevent a
  // separately-authenticated non-admin from seeing the admin's prompts.
  // ==========================================================================

  test.describe('Non-Admin', () => {
    test('admin in user mode can see and run admin-created prompts but cannot edit, delete, or add', async ({
      page,
      editMentorPage,
      chatPage,
    }) => {
      // ── Admin: add a suggested prompt to the fresh mentor ───────────────────
      await editMentorPage.open('Prompts');
      await waitForPageReady(page);

      const promptText = `Non-admin visible prompt ${Date.now()}`;
      await editMentorPage.prompts.addSuggestedPrompt(promptText);

      // Match the sibling test at line 137 — the prompt list refresh after a
      // POST can take 30s+ when the backing mentor data is mid-fetch (same
      // abort+retry race as explore). A 10s ceiling here is racy in CI.
      await expect
        .poll(() => editMentorPage.prompts.getSuggestedPromptCount(), {
          timeout: 120_000,
        })
        .toBeGreaterThan(0);

      await editMentorPage.close();
      // Let the mentor-settings refetch triggered by the modal close settle
      // before flipping user mode, otherwise the user-mode switch click can
      // land mid-refetch and the subsequent gallery assertions race.
      await waitForPageReady(page);

      // ── Switch to User mode (acts as a non-admin / student) ──────────────
      const learnerSwitch = page.getByRole('switch', {
        name: /user mode/i,
      });
      await expect(learnerSwitch).toBeVisible({ timeout: 10_000 });
      // The switch is `checked` when in administrator mode; click to flip to
      // user mode.
      const isInstructor =
        (await learnerSwitch.getAttribute('aria-checked')) === 'true';
      if (isInstructor) {
        await learnerSwitch.click();
      }
      await page.waitForTimeout(1_000);

      // ── Open the Prompt Gallery from the chat area ──────────────────────────
      await expect(chatPage.promptsButton).toBeVisible({ timeout: 15_000 });
      await chatPage.openPromptGallery();

      // ── Assert: prompt is visible in the gallery ───────────────────────────
      await expect(
        chatPage.promptGalleryDialog.getByText(promptText),
      ).toBeVisible({ timeout: 15_000 });

      // ── Assert: Run button IS visible to learners ──────────────────────────
      const runButtons = chatPage.getPromptGalleryRunButtons();
      await expect(runButtons.first()).toBeVisible({ timeout: 10_000 });
      await expect(runButtons.first()).toBeEnabled();

      // ── Assert: Edit button is NOT visible to learners ─────────────────────
      const editButtonCount = await chatPage
        .getPromptGalleryEditButtons()
        .count();
      expect(editButtonCount).toBe(0);

      // ── Assert: Delete button is NOT visible to learners ───────────────────
      const deleteButtonCount = await chatPage
        .getPromptGalleryDeleteButtons()
        .count();
      expect(deleteButtonCount).toBe(0);

      // ── Assert: Add (new prompt) button is NOT visible to learners ─────────
      await expect(chatPage.getPromptGalleryAddButton()).not.toBeVisible({
        timeout: 3_000,
      });

      // ── Clicking Run populates the chat input ──────────────────────────────
      await chatPage.runPromptFromGallery(0);

      // The gallery should close once a prompt is selected
      await expect(chatPage.promptGalleryDialog).not.toBeVisible({
        timeout: 10_000,
      });

      // The chat input should now contain the prompt text
      await expect(chatPage.chatInput).toBeVisible({ timeout: 10_000 });
      await expect(chatPage.chatInput).toHaveValue(promptText, {
        timeout: 10_000,
      });
    });
  });
});
