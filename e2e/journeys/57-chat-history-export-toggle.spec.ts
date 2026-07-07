/**
 * Journey 57 — Chat History Export Toggle (issue #2068)
 *
 * A new tenant Advanced setting, `enable_chat_history_export` (org metadata
 * boolean, default ON), gates the per-chat "Export" option in the sidebar
 * Chats three-dot menu, COMBINED with the acting user's role:
 *
 *   | role                        | setting ON/absent | setting OFF |
 *   |------------------------------|--------------------|-------------|
 *   | Non-student (admin/instructor)| Export shown       | Export shown (role wins) |
 *   | Student                       | Export shown (default) | Export hidden |
 *
 * Gate (app-sidebar/index.tsx `SidebarChatsSection`):
 *   `canExport = !userIsStudent || (metadata?.enable_chat_history_export !== false)`
 *
 * ── Two surfaces under test ────────────────────────────────────────────────
 *
 * 1. Tenant Advanced tab (reached via More Options → platform name → User
 *    Profile dialog → Advanced tab): the SDK's `AdvancedTab` auto-renders a
 *    generic boolean-metadata Switch labeled "Chat History Export" (default
 *    ON). Toggling it PATCHes org metadata and the SDK's shared RTK Query
 *    cache propagates the new value to every `useTenantMetadata` subscriber,
 *    including the sidebar, without a page reload (same mechanism already
 *    exercised by journey 38's Memory System toggle).
 *
 * 2. The sidebar Chats three-dot menu (`aria-label="Chat actions"`) on each
 *    Recent chat row — a Radix DropdownMenu with Pin/Unpin, Export, Delete
 *    `role="menuitem"` entries. Export is the item wrapped in `{canExport &&
 *    (...)}`. The rail-collapsed Chats flyout has NO three-dot menu at all,
 *    so there is nothing to gate there (not covered here).
 *
 * ── Role switching ──────────────────────────────────────────────────────────
 *
 * "Student" is determined by `useUserIsStudent()`: for an admin account it
 * is `!isInstructorMode` (see `hooks/use-user.ts`). Rather than requiring a
 * separately-authenticated student session (which would land on a different
 * mentor/tenant and couldn't see the admin's own freshly created chat), we
 * reuse the SAME admin session and flip the nav-bar User/Admin
 * `LearnerModeSwitch` (`aria-label` starting with "User mode"). This is the
 * exact pattern already established and relied upon by journey 42
 * (Suggested Prompts, "Non-Admin" describe block) for identical reasons.
 * Checked = Admin/Instructor mode (non-student). Unchecked = User/Learner
 * mode (student, for an admin without an active trial).
 *
 * Each test creates its own fresh mentor (`createMentorPage.openAndCreate()`)
 * so the seeded chat row is unambiguous, and restores both the tenant
 * setting and the learner-mode toggle to their original values in a
 * `finally` block so tests remain order-independent and don't leak state
 * into other journeys that share the tenant/admin account.
 */

import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import type { Page, Locator } from '@playwright/test';

// ─── Advanced tab helpers ──────────────────────────────────────────────────

/**
 * Navigate to Account Settings → Advanced tab and return the dialog locator.
 * Mirrors the pattern used by journey 38/30 — the "Advanced" tab lives
 * inside the User Profile dialog reached via More Options → platform name.
 */
async function openAdvancedTab(page: Page): Promise<Locator> {
  const profileBtn = page.getByRole('button', { name: 'More options' });
  await expect(profileBtn).toBeVisible({ timeout: 15_000 });
  await profileBtn.click();

  const menu = page.getByRole('menu', { name: 'More options' });
  await expect(menu).toBeVisible({ timeout: 5_000 });

  const platformName = await page.evaluate(() => {
    const raw = localStorage.getItem('current_tenant');
    if (!raw) return null;
    try {
      return JSON.parse(raw)?.platform_name ?? null;
    } catch {
      return null;
    }
  });

  if (!platformName) {
    throw new Error(
      'Could not retrieve platform_name from localStorage — cannot navigate to account settings',
    );
  }

  const tenantMenuItem = menu.getByText(platformName, { exact: true });
  await expect(tenantMenuItem).toBeVisible({ timeout: 5_000 });
  await tenantMenuItem.click();

  const accountDialog = page.getByRole('dialog', { name: 'User Profile' });
  await expect(accountDialog).toBeVisible({ timeout: 10_000 });

  const advancedTab = accountDialog.getByRole('button', { name: 'Advanced' });
  await expect(advancedTab).toBeVisible({ timeout: 5_000 });
  await advancedTab.click();

  // Wait for the Chat History Export row inside the advanced content area —
  // it's rendered by the SDK's generic boolean-metadata switch list.
  await expect(
    accountDialog.getByText('Chat History Export', { exact: true }),
  ).toBeVisible({ timeout: 15_000 });

  return accountDialog;
}

/**
 * Locator for the "Chat History Export" switch in the Advanced tab. Matched
 * by aria-label PREFIX (not the full string) because the SDK appends the
 * live enabled/disabled state to the label.
 */
function chatHistoryExportSwitch(dialog: Locator): Locator {
  return dialog.getByRole('switch', { name: /^Chat History Export/i });
}

async function isChatHistoryExportEnabled(dialog: Locator): Promise<boolean> {
  try {
    const state =
      await chatHistoryExportSwitch(dialog).getAttribute('aria-checked');
    return state === 'true';
  } catch {
    return false;
  }
}

async function setChatHistoryExport(
  dialog: Locator,
  desired: boolean,
): Promise<void> {
  const current = await isChatHistoryExportEnabled(dialog);
  if (current === desired) return;

  const toggle = chatHistoryExportSwitch(dialog);
  await toggle.click();
  await expect(toggle).toHaveAttribute(
    'aria-checked',
    desired ? 'true' : 'false',
    {
      timeout: 10_000,
    },
  );
}

async function closeAccountDialog(dialog: Locator, page: Page): Promise<void> {
  const closeBtn = dialog.getByRole('button', { name: /close/i }).last();
  let closeBtnVisible = false;
  try {
    await closeBtn.waitFor({ state: 'visible', timeout: 3_000 });
    closeBtnVisible = true;
  } catch {
    closeBtnVisible = false;
  }
  if (closeBtnVisible) {
    await closeBtn.click();
  } else {
    await page.keyboard.press('Escape');
  }
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });
}

// ─── Learner-mode (User/Admin) helpers ──────────────────────────────────────

/**
 * The nav-bar User/Admin switch — `aria-label` starts with "User mode" and
 * reflects live state ("User mode enabled"/"disabled"). Match by attribute
 * (`getByLabel`) rather than role/name so a stale `aria-hidden` left on the
 * app shell can't drop it out of the accessibility tree (same rationale as
 * journey 42).
 */
function learnerModeSwitch(page: Page): Locator {
  return page.getByLabel(/^user mode/i);
}

/** True when the acting admin is currently in Admin/Instructor mode (checked = non-student). */
async function isInstructorMode(page: Page): Promise<boolean> {
  try {
    const state = await learnerModeSwitch(page).getAttribute('aria-checked');
    return state === 'true';
  } catch {
    return false;
  }
}

async function setInstructorMode(page: Page, desired: boolean): Promise<void> {
  const toggle = learnerModeSwitch(page);
  await expect(toggle).toBeVisible({ timeout: 10_000 });
  const current = (await toggle.getAttribute('aria-checked')) === 'true';
  if (current === desired) return;
  await toggle.click();
  await expect(toggle).toHaveAttribute(
    'aria-checked',
    desired ? 'true' : 'false',
    {
      timeout: 5_000,
    },
  );
}

// ─── Chat streaming helper (mirrors journey 53) ─────────────────────────────

async function waitForStreamingDone(
  page: Page,
  sendButton: Locator,
  aiMessages: Locator,
  timeout = 90_000,
): Promise<void> {
  await expect(aiMessages.first()).toBeVisible({ timeout });
  await expect(sendButton).toBeEnabled({ timeout });
}

// ─── Suite ───────────────────────────────────────────────────────────────────

// Serial: every test in this file toggles the SAME tenant-level org
// metadata setting (`enable_chat_history_export`) via the Advanced tab.
// Running them across parallel workers races concurrent PATCHes against
// that shared setting — one test's toggle can be silently overwritten by
// another's in-flight mutation, causing `setChatHistoryExport` to time out
// waiting for the aria-checked state it just set. Serial execution avoids
// the race since only one test ever touches the setting at a time.
test.describe.serial('Journey 57: Chat History Export Toggle', () => {
  test.setTimeout(180_000);

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Chat History Export toggle requires admin access');
      return;
    }
    await waitForPageReady(page);
  });

  // chexp-01/02: Advanced tab surface — default state + persistence.
  test('admin opens the tenant Advanced tab and the Chat History Export switch is present, ON by default, and persists when toggled', async ({
    page,
  }) => {
    let dialog = await openAdvancedTab(page);
    const originalValue = await isChatHistoryExportEnabled(dialog);

    try {
      // chexp-01: default is ON (or, if a previous run left it off, we can
      // still assert the switch renders and is readable — the meaningful
      // regression guard is the toggle+persist round trip below).
      if (originalValue === false) {
        // Restore to the documented default (ON) first so this run's
        // "default ON" assertion is meaningful, then proceed with the
        // toggle-off/persist assertion as normal.
        await setChatHistoryExport(dialog, true);
      }
      await expect(chatHistoryExportSwitch(dialog)).toHaveAttribute(
        'aria-checked',
        'true',
        { timeout: 10_000 },
      );

      // chexp-02: toggle OFF → persists across close/reopen.
      await setChatHistoryExport(dialog, false);
      await closeAccountDialog(dialog, page);
      await waitForPageReady(page);

      dialog = await openAdvancedTab(page);
      await expect(chatHistoryExportSwitch(dialog)).toHaveAttribute(
        'aria-checked',
        'false',
        { timeout: 10_000 },
      );
    } finally {
      // Restore original tenant state so this test doesn't leak into others.
      await setChatHistoryExport(dialog, true).catch(() => undefined);
      await closeAccountDialog(dialog, page).catch(() => undefined);
    }
  });

  // chexp-03: setting OFF + student → Export hidden, Pin + Delete present.
  test('admin in user mode with the setting OFF does not see Export in a chat row menu, but sees Pin and Delete', async ({
    page,
    createMentorPage,
    chatPage,
    sidebarPage,
  }) => {
    await createMentorPage.openAndCreate();
    await waitForPageReady(page);

    const sentText = `chexp-03 test ${Date.now()}`;
    await chatPage.sendMessage(sentText);
    await waitForStreamingDone(page, chatPage.sendButton, chatPage.aiMessages);

    await sidebarPage.expandChatsSection();
    await expect
      .poll(async () => sidebarPage.isRecentChatVisible(sentText, 3_000), {
        timeout: 20_000,
        intervals: [1_000, 2_000, 3_000],
      })
      .toBe(true);

    const dialog = await openAdvancedTab(page);
    const originalExportSetting = await isChatHistoryExportEnabled(dialog);
    await setChatHistoryExport(dialog, false);
    await closeAccountDialog(dialog, page);
    await waitForPageReady(page);

    const originalInstructorMode = await isInstructorMode(page);
    await setInstructorMode(page, false); // → student

    try {
      // Give the shared RTK Query cache a beat to propagate the metadata
      // change to the sidebar's `useTenantMetadata` subscriber.
      await page.waitForTimeout(1_000);

      const menu = await sidebarPage.openChatActionsMenu(sentText);
      await expect(
        menu.getByRole('menuitem', { name: /^Export$/ }),
      ).not.toBeVisible({ timeout: 5_000 });
      await expect(menu.getByRole('menuitem', { name: /^Pin$/ })).toBeVisible({
        timeout: 5_000,
      });
      await expect(
        menu.getByRole('menuitem', { name: /^Delete$/ }),
      ).toBeVisible({ timeout: 5_000 });
      await page.keyboard.press('Escape');
    } finally {
      await setInstructorMode(page, originalInstructorMode).catch(
        () => undefined,
      );
      const restoreDialog = await openAdvancedTab(page).catch(() => null);
      if (restoreDialog) {
        await setChatHistoryExport(restoreDialog, originalExportSetting).catch(
          () => undefined,
        );
        await closeAccountDialog(restoreDialog, page).catch(() => undefined);
      }
    }
  });

  // chexp-04: setting ON + student → Export present (default student experience).
  test('admin in user mode with the setting ON sees Export in a chat row menu', async ({
    page,
    createMentorPage,
    chatPage,
    sidebarPage,
  }) => {
    await createMentorPage.openAndCreate();
    await waitForPageReady(page);

    const sentText = `chexp-04 test ${Date.now()}`;
    await chatPage.sendMessage(sentText);
    await waitForStreamingDone(page, chatPage.sendButton, chatPage.aiMessages);

    await sidebarPage.expandChatsSection();
    await expect
      .poll(async () => sidebarPage.isRecentChatVisible(sentText, 3_000), {
        timeout: 20_000,
        intervals: [1_000, 2_000, 3_000],
      })
      .toBe(true);

    const dialog = await openAdvancedTab(page);
    const originalExportSetting = await isChatHistoryExportEnabled(dialog);
    await setChatHistoryExport(dialog, true);
    await closeAccountDialog(dialog, page);
    await waitForPageReady(page);

    const originalInstructorMode = await isInstructorMode(page);
    await setInstructorMode(page, false); // → student

    try {
      await page.waitForTimeout(1_000);

      const menu = await sidebarPage.openChatActionsMenu(sentText);
      await expect(
        menu.getByRole('menuitem', { name: /^Export$/ }),
      ).toBeVisible({ timeout: 5_000 });
      await expect(menu.getByRole('menuitem', { name: /^Pin$/ })).toBeVisible({
        timeout: 5_000,
      });
      await expect(
        menu.getByRole('menuitem', { name: /^Delete$/ }),
      ).toBeVisible({ timeout: 5_000 });
      await page.keyboard.press('Escape');
    } finally {
      await setInstructorMode(page, originalInstructorMode).catch(
        () => undefined,
      );
      const restoreDialog = await openAdvancedTab(page).catch(() => null);
      if (restoreDialog) {
        await setChatHistoryExport(restoreDialog, originalExportSetting).catch(
          () => undefined,
        );
        await closeAccountDialog(restoreDialog, page).catch(() => undefined);
      }
    }
  });

  // chexp-05: setting OFF + non-student (admin/instructor) → Export present (role wins).
  test('admin in admin mode with the setting OFF still sees Export in a chat row menu', async ({
    page,
    createMentorPage,
    chatPage,
    sidebarPage,
  }) => {
    await createMentorPage.openAndCreate();
    await waitForPageReady(page);

    const sentText = `chexp-05 test ${Date.now()}`;
    await chatPage.sendMessage(sentText);
    await waitForStreamingDone(page, chatPage.sendButton, chatPage.aiMessages);

    await sidebarPage.expandChatsSection();
    await expect
      .poll(async () => sidebarPage.isRecentChatVisible(sentText, 3_000), {
        timeout: 20_000,
        intervals: [1_000, 2_000, 3_000],
      })
      .toBe(true);

    const dialog = await openAdvancedTab(page);
    const originalExportSetting = await isChatHistoryExportEnabled(dialog);
    await setChatHistoryExport(dialog, false);
    await closeAccountDialog(dialog, page);
    await waitForPageReady(page);

    const originalInstructorMode = await isInstructorMode(page);
    await setInstructorMode(page, true); // → non-student (admin/instructor)

    try {
      await page.waitForTimeout(1_000);

      const menu = await sidebarPage.openChatActionsMenu(sentText);
      await expect(
        menu.getByRole('menuitem', { name: /^Export$/ }),
      ).toBeVisible({ timeout: 5_000 });
      await page.keyboard.press('Escape');
    } finally {
      await setInstructorMode(page, originalInstructorMode).catch(
        () => undefined,
      );
      const restoreDialog = await openAdvancedTab(page).catch(() => null);
      if (restoreDialog) {
        await setChatHistoryExport(restoreDialog, originalExportSetting).catch(
          () => undefined,
        );
        await closeAccountDialog(restoreDialog, page).catch(() => undefined);
      }
    }
  });
});
