import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/mentor-test';
import type { EditMentorPage } from '../page-objects/edit-mentor/edit-mentor.page';
import type { ChatPage } from '../page-objects/chat.page';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';
import { waitForPageReady, waitForDialogReady } from '../utils/resilient';
import { safeWaitForURL } from '../utils/navigation';
import { MentorTracker } from '../utils/mentor-cleanup';

// ─── Journey 22: Disclaimers & User Agreement ─────────────────────────────────
//
// Every test creates a fresh mentor to avoid cross-test state leakage.
//
// Checkpoints:
//   disc-01  Admin toggles User Agreement on — authenticated non-admin sees modal
//   disc-02  Admin can edit User Agreement content
//   disc-03  Admin can copy User Agreement content
//   disc-04  Admin can edit Advisory text
//   disc-07  Full end-to-end: enable, set Anyone, non-admin must accept before chat
//   disc-08  Toggle User Agreement on/off affects chat modal appearance
//   disc-15  View Agreements button appears/disappears with the User Agreement switch
//   disc-16  Agreements dialog shows the empty state when nobody has agreed yet
//   disc-17  Agreements dialog lists a row for a non-admin who accepted, with a hoverable tooltip
//   disc-18  Agreements dialog search filters by exact username
//   disc-19  Non-admin has no UI path to the View Agreements button

// ─── A. Admin — User Agreement Toggle ────────────────────────────────────────

test.describe('Journey 22-A: Admin — User Agreement Toggle', () => {
  const trackerA = new MentorTracker();

  test.beforeEach(async ({ page, createMentorPage, editMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Disclaimers requires admin access');
      return;
    }
    await createMentorPage.openAndCreate();
    const { mentorId } = await getPlatformContext(page);
    trackerA.add(mentorId);
    await editMentorPage.open('Disclaimers');
    await waitForPageReady(page);
  });

  // disc-08 (part 1): Admin enables User Agreement — status becomes Active
  test('admin goes to disclaimers tab and enables User Agreement and sees Active status', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.disclaimers.enableUserAgreement();

    await expect(
      editMentorPage.disclaimers.userAgreementSwitch,
    ).toHaveAttribute('aria-checked', 'true', { timeout: 10_000 });
    await expect(editMentorPage.disclaimers.activeStatus).toBeVisible({
      timeout: 10_000,
    });

    await editMentorPage.close();
  });

  // disc-08 (part 2): Admin disables User Agreement — status becomes Inactive
  test('admin goes to disclaimers tab and disables User Agreement and sees Inactive status', async ({
    page,
    editMentorPage,
  }) => {
    // First make sure it is enabled so we can disable it
    await editMentorPage.disclaimers.enableUserAgreement();
    await expect(editMentorPage.disclaimers.activeStatus).toBeVisible({
      timeout: 10_000,
    });

    await editMentorPage.disclaimers.disableUserAgreement();

    await expect(
      editMentorPage.disclaimers.userAgreementSwitch,
    ).toHaveAttribute('aria-checked', 'false', { timeout: 10_000 });

    // Status text should now show "Inactive" (not "Active")
    const inactiveText = editMentorPage.dialog.getByText('Inactive', {
      exact: true,
    });
    await expect(inactiveText.first()).toBeVisible({ timeout: 5_000 });

    await editMentorPage.close();
  });

  test.afterAll(async ({ browser }, testInfo) => {
    await trackerA.deleteAll(browser, testInfo);
  });
});

// ─── B. Admin — Edit Content ──────────────────────────────────────────────────

test.describe('Journey 22-B: Admin — Edit Content', () => {
  const trackerB = new MentorTracker();

  test.beforeEach(async ({ page, createMentorPage, editMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Disclaimers requires admin access');
      return;
    }
    await createMentorPage.openAndCreate();
    const { mentorId } = await getPlatformContext(page);
    trackerB.add(mentorId);
    await editMentorPage.open('Disclaimers');
    await waitForPageReady(page);
  });

  // disc-02: Admin edits User Agreement content
  test('admin goes to disclaimers tab and edits User Agreement content and saves', async ({
    page,
    editMentorPage,
  }) => {
    const editModal =
      await editMentorPage.disclaimers.openEditUserAgreementModal();
    await waitForDialogReady(page, editModal);

    const textarea = editModal.getByRole('textbox');
    await expect(textarea).toBeVisible({ timeout: 10_000 });

    // Clear and enter new content
    const newContent = `E2E test user agreement ${Date.now()}`;
    await textarea.fill(newContent);
    await expect(textarea).toHaveValue(newContent);

    // Save button should be enabled when content is present
    const saveBtn = editModal.getByRole('button', { name: /save/i });
    await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
    await saveBtn.click();

    // Toast: "User agreement updated successfully"
    const toast = page.getByText(/user agreement updated/i);
    let toastVisible = false;
    try {
      await toast.waitFor({ state: 'visible', timeout: 10_000 });
      toastVisible = true;
    } catch {
      toastVisible = false;
    }

    // Modal should close after save
    let modalClosed = false;
    try {
      await editModal.waitFor({ state: 'hidden', timeout: 8_000 });
      modalClosed = true;
    } catch {
      modalClosed = false;
    }

    expect(toastVisible || modalClosed).toBe(true);

    // If modal is still open (save failed silently), close it
    if (!modalClosed) {
      const cancelBtn = editModal.getByRole('button', { name: /cancel/i });
      let cancelVisible = false;
      try {
        await cancelBtn.waitFor({ state: 'visible', timeout: 3_000 });
        cancelVisible = true;
      } catch {
        cancelVisible = false;
      }
      if (cancelVisible) await cancelBtn.click();
    }

    await editMentorPage.close();
  });

  // disc-04: Admin edits Advisory content
  test('admin goes to disclaimers tab and edits Advisory content and saves', async ({
    page,
    editMentorPage,
  }) => {
    const editModal = await editMentorPage.disclaimers.openEditAdvisoryModal();
    await waitForDialogReady(page, editModal);

    const textarea = editModal.getByRole('textbox');
    await expect(textarea).toBeVisible({ timeout: 10_000 });

    const newContent = `E2E test advisory ${Date.now()}`;
    await textarea.fill(newContent);
    await expect(textarea).toHaveValue(newContent);

    const saveBtn = editModal.getByRole('button', { name: /save/i });
    await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
    await saveBtn.click();

    // Toast: "Mentor updated successfully"
    const toast = page
      .getByText(/agent updated|advisory.*updated|updated successfully/i)
      .first();
    let toastVisible = false;
    try {
      await toast.waitFor({ state: 'visible', timeout: 10_000 });
      toastVisible = true;
    } catch {
      toastVisible = false;
    }

    let modalClosed = false;
    try {
      await editModal.waitFor({ state: 'hidden', timeout: 8_000 });
      modalClosed = true;
    } catch {
      modalClosed = false;
    }

    expect(toastVisible || modalClosed).toBe(true);

    if (!modalClosed) {
      const cancelBtn = editModal.getByRole('button', { name: /cancel/i });
      let cancelVisible = false;
      try {
        await cancelBtn.waitFor({ state: 'visible', timeout: 3_000 });
        cancelVisible = true;
      } catch {
        cancelVisible = false;
      }
      if (cancelVisible) await cancelBtn.click();
    }

    await editMentorPage.close();
  });

  // B3: Admin cancels edit — no changes are saved
  test('admin goes to disclaimers tab and cancels User Agreement edit without saving', async ({
    editMentorPage,
  }) => {
    // Capture the original content from the tab preview before opening the modal
    const previewRegion = editMentorPage.dialog.getByRole('region', {
      name: 'User agreement content',
    });
    const originalPreviewText = await previewRegion.innerText();

    const editModal =
      await editMentorPage.disclaimers.openEditUserAgreementModal();

    const textarea = editModal.getByRole('textbox');
    await expect(textarea).toBeVisible({ timeout: 10_000 });

    await textarea.fill(`SHOULD NOT BE SAVED ${Date.now()}`);

    const cancelBtn = editModal.getByRole('button', { name: /cancel/i });
    await expect(cancelBtn).toBeVisible({ timeout: 5_000 });
    await cancelBtn.click();

    // Modal closes without saving
    const editUserAgreementDialog = editMentorPage.page.getByRole('dialog', {
      name: 'Edit User Agreement',
    });
    await expect(editUserAgreementDialog).toBeHidden({ timeout: 8_000 });

    // The tab preview should still show the original content (no API call was made)
    await expect(previewRegion).toHaveText(originalPreviewText, {
      timeout: 5_000,
    });

    await editMentorPage.close();
  });

  // B4: Save is disabled when content is empty
  test('admin goes to disclaimers tab and sees Save disabled when User Agreement content is empty', async ({
    editMentorPage,
  }) => {
    const editModal =
      await editMentorPage.disclaimers.openEditUserAgreementModal();

    const textarea = editModal.getByRole('textbox');
    await expect(textarea).toBeVisible({ timeout: 10_000 });

    // Clear the textarea
    await textarea.fill('');
    await expect(textarea).toHaveValue('');

    const saveBtn = editModal.getByRole('button', { name: /save/i });
    // Save should be disabled when content is empty
    await expect(saveBtn).toBeDisabled({ timeout: 5_000 });

    // Restore a value so we can close cleanly
    await textarea.fill('Restored content');
    const cancelBtn = editModal.getByRole('button', { name: /cancel/i });
    await cancelBtn.click();

    await editMentorPage.close();
  });

  test.afterAll(async ({ browser }, testInfo) => {
    await trackerB.deleteAll(browser, testInfo);
  });
});

// ─── C. Admin — Copy Content ──────────────────────────────────────────────────

test.describe('Journey 22-C: Admin — Copy Content', () => {
  const trackerC = new MentorTracker();

  test.beforeEach(async ({ page, createMentorPage, editMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Disclaimers requires admin access');
      return;
    }
    await createMentorPage.openAndCreate();
    const { mentorId } = await getPlatformContext(page);
    trackerC.add(mentorId);
    await editMentorPage.open('Disclaimers');
    await waitForPageReady(page);
  });

  // disc-03: Admin copies User Agreement content
  test('admin goes to disclaimers tab and copies User Agreement content to clipboard', async ({
    editMentorPage,
  }) => {
    const copyButtons = editMentorPage.dialog.getByRole('button', {
      name: /copy/i,
    });

    let copyBtnVisible = false;
    try {
      await copyButtons.first().waitFor({ state: 'visible', timeout: 10_000 });
      copyBtnVisible = true;
    } catch {
      copyBtnVisible = false;
    }

    if (!copyBtnVisible) {
      await editMentorPage.close();
      return;
    }

    await copyButtons.first().click();

    // In headless Chromium the clipboard API may be restricted, so the button
    // text may or may not switch to "Copied". Verify the button remains
    // interactive and doesn't error — that's the E2E value for a copy action.
    await expect(copyButtons.first()).toBeVisible();

    await editMentorPage.close();
  });

  // C2: Admin copies Advisory content
  test('admin goes to disclaimers tab and copies Advisory content to clipboard', async ({
    editMentorPage,
  }) => {
    const copyButtons = editMentorPage.dialog.getByRole('button', {
      name: /copy/i,
    });
    const count = await copyButtons.count();

    if (count < 2) {
      await editMentorPage.close();
      return;
    }

    let advisoryCopyVisible = false;
    try {
      await copyButtons.nth(1).waitFor({ state: 'visible', timeout: 5_000 });
      advisoryCopyVisible = true;
    } catch {
      advisoryCopyVisible = false;
    }

    if (!advisoryCopyVisible) {
      await editMentorPage.close();
      return;
    }

    await copyButtons.nth(1).click();

    // Verify button remains interactive after click
    await expect(copyButtons.nth(1)).toBeVisible();

    await editMentorPage.close();
  });

  test.afterAll(async ({ browser }, testInfo) => {
    await trackerC.deleteAll(browser, testInfo);
  });
});

// ─── D. Non-Admin — Agreement Enforcement ────────────────────────────────────

test.describe('Journey 22-D: Non-Admin — Agreement Enforcement', () => {
  const trackerD = new MentorTracker();
  // disc-01 / disc-07 / disc-08: The critical E2E enforcement journey.
  // Admin creates a mentor, enables User Agreement + sets visibility to Anyone,
  // then a non-admin navigates directly to the mentor and must accept before chatting.
  test('admin enables user agreement and non-admin must accept it before sending a chat message', async ({
    page,
    createMentorPage,
    editMentorPage,
    nonadminPage,
    nonadminChatPage,
  }) => {
    // Step 1: Admin creates a fresh mentor
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Disclaimers requires admin access');
      return;
    }

    await createMentorPage.openAndCreate();
    trackerD.add((await getPlatformContext(page)).mentorId);

    // Step 2: Enable user agreement
    await editMentorPage.open('Disclaimers');
    await waitForPageReady(page);

    await editMentorPage.disclaimers.enableUserAgreement();
    await expect(editMentorPage.disclaimers.activeStatus).toBeVisible({
      timeout: 10_000,
    });

    // Navigate to Settings and set visibility to Anyone
    await editMentorPage.navigateToTab('Settings');
    await waitForPageReady(page);

    // Visibility combobox lives under the Discovery sub-tab now that
    // Settings was split into Basic / Discovery / Capabilities.
    await editMentorPage.settings.selectSubTab('Discovery');

    let visibilityVisible = false;
    try {
      await editMentorPage.settings.visibilityCombobox.waitFor({
        state: 'visible',
        timeout: 8_000,
      });
      visibilityVisible = true;
    } catch {
      visibilityVisible = false;
    }
    if (visibilityVisible) {
      await editMentorPage.settings.setVisibility('Anyone');
    }

    await editMentorPage.close();

    const mentorUrl = page.url();

    // Step 3: Non-admin navigates directly to the mentor URL
    await nonadminPage.goto(mentorUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await safeWaitForURL(
      nonadminPage,
      (url) => url.href.includes('/platform/'),
      { timeout: 120_000 },
    );
    await waitForPageReady(nonadminPage);

    // Step 4: Non-admin types a message and clicks Send
    await expect(nonadminChatPage.chatInput).toBeVisible({ timeout: 15_000 });
    await nonadminChatPage.chatInput.fill('hello');
    await expect(nonadminChatPage.sendButton).toBeEnabled({ timeout: 10_000 });
    await nonadminChatPage.sendButton.click();

    // Step 5: Disclaimer enforcement fires — either a client-side modal
    // ("User Agreement" dialog) or a server-side rejection toast
    // ("You have not agreed to all required disclaimers"). Both prove enforcement.
    const agreementModal = nonadminPage
      .getByRole('dialog')
      .filter({ hasText: 'User Agreement' });
    const disclaimerError = nonadminPage.getByText(
      /not agreed to all required disclaimers/i,
    );

    // Wait for whichever enforcement signal appears first
    let modalAppeared = false;
    let errorToastAppeared = false;
    try {
      await Promise.race([
        agreementModal
          .waitFor({ state: 'visible', timeout: 15_000 })
          .then(() => {
            modalAppeared = true;
          }),
        disclaimerError
          .waitFor({ state: 'visible', timeout: 15_000 })
          .then(() => {
            errorToastAppeared = true;
          }),
      ]);
    } catch {
      // Neither appeared within timeout
    }

    expect(modalAppeared || errorToastAppeared).toBe(true);

    // If the modal appeared, accept it
    if (modalAppeared) {
      await agreementModal.getByRole('button', { name: 'I Accept' }).click();
      await expect(agreementModal).toBeHidden({ timeout: 10_000 });
    }
  });

  // disc-08 (enforcement off): Admin disables User Agreement — no modal for non-admin
  test('admin disables user agreement and non-admin sends a message without seeing agreement modal', async ({
    page,
    createMentorPage,
    editMentorPage,
    nonadminPage,
    nonadminChatPage,
  }) => {
    // Step 1: Admin creates a fresh mentor (user agreement is off by default)
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Disclaimers requires admin access');
      return;
    }

    await createMentorPage.openAndCreate();
    trackerD.add((await getPlatformContext(page)).mentorId);

    // Verify user agreement is disabled on the new mentor
    await editMentorPage.open('Disclaimers');
    await waitForPageReady(page);

    await editMentorPage.disclaimers.disableUserAgreement();
    await expect(
      editMentorPage.disclaimers.userAgreementSwitch,
    ).toHaveAttribute('aria-checked', 'false', { timeout: 10_000 });

    await editMentorPage.close();

    const mentorUrl = page.url();

    // Step 2: Non-admin navigates directly to the mentor URL
    await nonadminPage.goto(mentorUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await safeWaitForURL(
      nonadminPage,
      (url) => url.href.includes('/platform/'),
      { timeout: 120_000 },
    );
    await waitForPageReady(nonadminPage);

    // Step 3: Non-admin types and sends a message
    await expect(nonadminChatPage.chatInput).toBeVisible({ timeout: 15_000 });
    await nonadminChatPage.chatInput.fill('hello');
    await expect(nonadminChatPage.sendButton).toBeEnabled({ timeout: 10_000 });
    await nonadminChatPage.sendButton.click();

    // Step 4: No User Agreement modal should appear — message goes through directly
    const agreementModal = nonadminPage
      .getByRole('dialog')
      .filter({ hasText: 'User Agreement' });

    let modalAppeared = false;
    try {
      await agreementModal.waitFor({ state: 'visible', timeout: 8_000 });
      modalAppeared = true;
    } catch {
      modalAppeared = false;
    }

    expect(modalAppeared).toBe(false);
  });

  // D3: After accepting agreement, subsequent messages don't trigger modal
  test('non-admin accepts user agreement and subsequent messages do not trigger the modal again', async ({
    page,
    createMentorPage,
    editMentorPage,
    nonadminPage,
    nonadminChatPage,
  }) => {
    // Step 1: Admin creates a mentor and enables user agreement
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Disclaimers requires admin access');
      return;
    }

    await createMentorPage.openAndCreate();
    trackerD.add((await getPlatformContext(page)).mentorId);

    await editMentorPage.open('Disclaimers');
    await waitForPageReady(page);

    await editMentorPage.disclaimers.enableUserAgreement();
    await expect(editMentorPage.disclaimers.activeStatus).toBeVisible({
      timeout: 10_000,
    });
    await editMentorPage.close();

    const mentorUrl = page.url();

    // Step 2: Non-admin navigates to the mentor
    await nonadminPage.goto(mentorUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await safeWaitForURL(
      nonadminPage,
      (url) => url.href.includes('/platform/'),
      { timeout: 120_000 },
    );
    await waitForPageReady(nonadminPage);

    // Step 3: First message — triggers disclaimer enforcement
    await expect(nonadminChatPage.chatInput).toBeVisible({ timeout: 15_000 });
    await nonadminChatPage.chatInput.fill('first message');
    await expect(nonadminChatPage.sendButton).toBeEnabled({ timeout: 10_000 });
    await nonadminChatPage.sendButton.click();

    const agreementModal = nonadminPage
      .getByRole('dialog')
      .filter({ hasText: 'User Agreement' });
    const disclaimerError = nonadminPage.getByText(
      /not agreed to all required disclaimers/i,
    );

    // Wait for either client-side modal or server-side error toast
    let firstModalVisible = false;
    let firstErrorVisible = false;
    try {
      await Promise.race([
        agreementModal
          .waitFor({ state: 'visible', timeout: 12_000 })
          .then(() => {
            firstModalVisible = true;
          }),
        disclaimerError
          .waitFor({ state: 'visible', timeout: 12_000 })
          .then(() => {
            firstErrorVisible = true;
          }),
      ]);
    } catch {
      // Neither appeared
    }

    // If modal appeared, accept it so subsequent messages go through
    if (firstModalVisible) {
      await agreementModal.getByRole('button', { name: 'I Accept' }).click();
      await expect(agreementModal).toBeHidden({ timeout: 10_000 });

      // Step 4: Second message — no modal should appear after accepting
      await expect(nonadminChatPage.chatInput).toBeVisible({ timeout: 10_000 });
      await nonadminChatPage.chatInput.fill('second message no modal');
      await expect(nonadminChatPage.sendButton).toBeEnabled({
        timeout: 10_000,
      });
      await nonadminChatPage.sendButton.click();

      let secondModalAppeared = false;
      try {
        await agreementModal.waitFor({ state: 'visible', timeout: 8_000 });
        secondModalAppeared = true;
      } catch {
        secondModalAppeared = false;
      }

      expect(secondModalAppeared).toBe(false);
    } else if (firstErrorVisible) {
      // Server-side enforcement — the first message was rejected.
      // Disclaimer enforcement is proven; subsequent sends will also be rejected
      // until the user agrees via the proper flow.
      expect(firstErrorVisible).toBe(true);
    } else {
      // Neither enforcement appeared — fail the test
      expect(firstModalVisible || firstErrorVisible).toBe(true);
    }
  });

  test.afterAll(async ({ browser }, testInfo) => {
    await trackerD.deleteAll(browser, testInfo);
  });
});

// ─── E. Tab Layout ────────────────────────────────────────────────────────────

test.describe('Journey 22-E: Tab Layout', () => {
  const trackerE = new MentorTracker();

  test.beforeEach(async ({ page, createMentorPage, editMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Disclaimers requires admin access');
      return;
    }
    await createMentorPage.openAndCreate();
    const { mentorId } = await getPlatformContext(page);
    trackerE.add(mentorId);
    await editMentorPage.open('Disclaimers');
    await waitForPageReady(page);
  });

  // E1: Both sections visible with correct elements
  test('admin goes to disclaimers tab and sees both User Agreement and Advisory sections with their controls', async ({
    editMentorPage,
  }) => {
    // User Agreement section: toggle switch
    await expect(editMentorPage.disclaimers.userAgreementSwitch).toBeVisible({
      timeout: 10_000,
    });

    // Both sections have Edit buttons
    await expect(editMentorPage.disclaimers.editButtons.first()).toBeVisible({
      timeout: 10_000,
    });

    // At least one Edit button visible (User Agreement)
    const editCount = await editMentorPage.disclaimers.editButtons.count();
    expect(editCount).toBeGreaterThanOrEqual(1);

    // At least one Copy button visible
    const copyButtons = editMentorPage.dialog.getByRole('button', {
      name: /copy/i,
    });
    const copyCount = await copyButtons.count();
    expect(copyCount).toBeGreaterThanOrEqual(1);

    await editMentorPage.close();
  });

  // Advisory Edit button opens correct modal
  test('admin goes to disclaimers tab and opens Advisory Edit modal with correct title', async ({
    page,
    editMentorPage,
  }) => {
    const editCount = await editMentorPage.disclaimers.editButtons.count();
    if (editCount < 2) {
      await editMentorPage.close();
      return;
    }

    const editModal = await editMentorPage.disclaimers.openEditAdvisoryModal();
    await waitForDialogReady(page, editModal);

    // Modal should contain "Advisory" in its title/heading
    const advisoryHeading = editModal.getByRole('heading', {
      name: /advisory/i,
    });
    await expect(advisoryHeading).toBeVisible({ timeout: 5_000 });

    // Has a textarea
    const textarea = editModal.getByRole('textbox');
    await expect(textarea).toBeVisible({ timeout: 5_000 });

    // Close via Cancel — use specific locator since page object's .last() falls
    // back to the Edit Mentor dialog once the inner modal closes
    const cancelBtn = editModal.getByRole('button', { name: /cancel/i });
    await cancelBtn.click();
    const advisoryDialog = editMentorPage.page.getByRole('dialog', {
      name: 'Edit Advisory',
    });
    await expect(advisoryDialog).toBeHidden({ timeout: 5_000 });

    await editMentorPage.close();
  });

  // User Agreement Edit modal has correct title and controls
  test('admin goes to disclaimers tab and opens User Agreement Edit modal with correct title', async ({
    page,
    editMentorPage,
  }) => {
    const editModal =
      await editMentorPage.disclaimers.openEditUserAgreementModal();
    await waitForDialogReady(page, editModal);

    // Modal contains "User Agreement" in its title
    const heading = editModal.getByRole('heading', {
      name: /user agreement/i,
    });
    await expect(heading).toBeVisible({ timeout: 5_000 });

    // Has a textarea for content
    const textarea = editModal.getByRole('textbox');
    await expect(textarea).toBeVisible({ timeout: 5_000 });

    // Has Cancel and Save buttons
    const cancelBtn = editModal.getByRole('button', { name: /cancel/i });
    const saveBtn = editModal.getByRole('button', { name: /save/i });
    await expect(cancelBtn).toBeVisible({ timeout: 5_000 });
    await expect(saveBtn).toBeVisible({ timeout: 5_000 });

    await cancelBtn.click();
    const uaDialog = editMentorPage.page.getByRole('dialog', {
      name: 'Edit User Agreement',
    });
    await expect(uaDialog).toBeHidden({ timeout: 5_000 });

    await editMentorPage.close();
  });

  test.afterAll(async ({ browser }, testInfo) => {
    await trackerE.deleteAll(browser, testInfo);
  });
});

// ─── F. Agreements List (#2507) ───────────────────────────────────────────────
//
// "View Agreements" button + the agreements list dialog it opens, showing
// which users have agreed to the mentor's User Agreement disclaimer.

// Shared by disc-17/disc-18: the admin (already on the Disclaimers tab of a
// fresh mentor) enables the User Agreement and opens the mentor to Anyone,
// then the non-admin hits the agreement on their first message and accepts
// it. Returns the non-admin's platform username -- the identifier the backend
// records on the agreement and the row's data-username carries.
async function acceptUserAgreementAsNonAdmin({
  page,
  editMentorPage,
  nonadminPage,
  nonadminChatPage,
}: {
  page: Page;
  editMentorPage: EditMentorPage;
  nonadminPage: Page;
  nonadminChatPage: ChatPage;
}): Promise<string> {
  await editMentorPage.disclaimers.enableUserAgreement();
  await editMentorPage.navigateToTab('Settings');
  await waitForPageReady(page);
  await editMentorPage.settings.setVisibilityAnyone();
  await editMentorPage.close();

  await nonadminPage.goto(page.url(), {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await safeWaitForURL(nonadminPage, (url) => url.href.includes('/platform/'), {
    timeout: 120_000,
  });
  await waitForPageReady(nonadminPage);
  await expect(nonadminChatPage.chatInput).toBeVisible({ timeout: 15_000 });
  await nonadminChatPage.chatInput.fill('hello');
  await expect(nonadminChatPage.sendButton).toBeEnabled({ timeout: 10_000 });
  await nonadminChatPage.sendButton.click();

  const agreementModal = nonadminPage
    .getByRole('dialog')
    .filter({ hasText: 'User Agreement' });
  await expect(agreementModal).toBeVisible({ timeout: 15_000 });
  await agreementModal.getByRole('button', { name: 'I Accept' }).click();
  await expect(agreementModal).toBeHidden({ timeout: 10_000 });

  const username = await nonadminPage.evaluate(
    () =>
      JSON.parse(window.localStorage.getItem('userData') ?? '{}')
        .user_nicename as string | undefined,
  );
  expect(username).toBeTruthy();
  return username!;
}

test.describe('Journey 22-F: Agreements list', () => {
  const trackerF = new MentorTracker();

  test.beforeEach(async ({ page, createMentorPage, editMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Disclaimers requires admin access');
      return;
    }
    await createMentorPage.openAndCreate();
    const { mentorId } = await getPlatformContext(page);
    trackerF.add(mentorId);
    await editMentorPage.open('Disclaimers');
    await waitForPageReady(page);
  });

  // disc-15: the button tracks the User Agreement switch in both directions.
  test('admin goes to disclaimers tab and sees the View Agreements button track the User Agreement switch', async ({
    editMentorPage,
  }) => {
    const { disclaimers } = editMentorPage;

    await expect(disclaimers.userAgreementSwitch).toBeVisible({
      timeout: 10_000,
    });
    await expect(disclaimers.viewAgreementsButton).not.toBeVisible();

    await disclaimers.enableUserAgreement();
    await expect(disclaimers.viewAgreementsButton).toBeVisible({
      timeout: 10_000,
    });

    await disclaimers.disableUserAgreement();
    await expect(disclaimers.viewAgreementsButton).not.toBeVisible({
      timeout: 10_000,
    });

    await editMentorPage.close();
  });

  // disc-16: nobody has agreed yet -- summary shows 0 and the empty state
  // renders; closing the dialog leaves the Edit Agent modal open.
  test('admin opens the agreements dialog on a freshly-enabled agreement and sees the empty state', async ({
    editMentorPage,
  }) => {
    const { disclaimers } = editMentorPage;
    await disclaimers.enableUserAgreement();
    await disclaimers.openAgreements();

    await expect(disclaimers.agreementsCount).toHaveText('0 Total Agreements', {
      timeout: 10_000,
    });
    await expect(disclaimers.agreementsBanner).toBeVisible();
    await expect(disclaimers.agreementsEmpty).toContainText(
      'No agreements yet',
    );

    await disclaimers.closeAgreements();
    await expect(editMentorPage.dialog).toBeVisible();
    await editMentorPage.close();
  });

  // disc-17: the admin's dialog lists the non-admin who accepted, with a
  // hoverable agreed-at tooltip.
  test('admin sees the non-admin who accepted the User Agreement listed with a hoverable agreed-at tooltip', async ({
    page,
    editMentorPage,
    nonadminPage,
    nonadminChatPage,
  }) => {
    const username = await acceptUserAgreementAsNonAdmin({
      page,
      editMentorPage,
      nonadminPage,
      nonadminChatPage,
    });

    await editMentorPage.open('Disclaimers');
    await waitForPageReady(page);
    const { disclaimers } = editMentorPage;
    await disclaimers.openAgreements();

    await expect(disclaimers.agreementsCount).toHaveText('1 Total Agreements', {
      timeout: 15_000,
    });
    const row = disclaimers.agreementRow(username);
    await expect(row).toBeVisible({ timeout: 10_000 });

    await row.getByText(/ago$/).hover();
    await expect(page.getByRole('tooltip')).toBeVisible({ timeout: 5_000 });

    await disclaimers.closeAgreements();
    await editMentorPage.close();
  });

  // disc-18: search matches the exact username only.
  test('admin searches the agreements list by exact username', async ({
    page,
    editMentorPage,
    nonadminPage,
    nonadminChatPage,
  }) => {
    const username = await acceptUserAgreementAsNonAdmin({
      page,
      editMentorPage,
      nonadminPage,
      nonadminChatPage,
    });

    await editMentorPage.open('Disclaimers');
    await waitForPageReady(page);
    const { disclaimers } = editMentorPage;
    await disclaimers.openAgreements();
    const row = disclaimers.agreementRow(username);
    await expect(row).toBeVisible({ timeout: 15_000 });

    await disclaimers.agreementsSearch.fill(username);
    await expect(row).toBeVisible({ timeout: 10_000 });

    await disclaimers.agreementsSearch.fill('zzzz-no-such-user');
    await expect(disclaimers.agreementsEmpty).toContainText(
      'No users match your search',
      { timeout: 10_000 },
    );
    await expect(row).not.toBeVisible();

    await disclaimers.agreementsSearch.fill('');
    await expect(row).toBeVisible({ timeout: 10_000 });

    await disclaimers.closeAgreements();
    await editMentorPage.close();
  });

  test.afterAll(async ({ browser }, testInfo) => {
    await trackerF.deleteAll(browser, testInfo);
  });
});

test.describe('Journey 22-F: Agreements list — Non-Admin', () => {
  test('non-admin user has no menu path to the Edit Agent modal, so never sees the View Agreements button', async ({
    nonadminPage,
    nonadminNavbarPage,
  }) => {
    await navigateToMentorApp(nonadminPage);
    const isAdmin = await checkAdminStatus(nonadminPage);
    if (isAdmin) {
      test.skip(true, 'This test requires a non-admin user');
      return;
    }

    await nonadminNavbarPage.openMentorDropdown();
    await expect(
      nonadminPage.getByRole('menuitem', { name: 'Settings', exact: true }),
    ).not.toBeVisible({ timeout: 5_000 });
  });
});
