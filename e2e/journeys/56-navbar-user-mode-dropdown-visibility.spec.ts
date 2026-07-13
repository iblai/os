import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';

/**
 * Journey 56: Navbar User Mode Dropdown Visibility (issue #2048)
 *
 * When an admin flips the navbar User/Admin switch to "User" (student) mode,
 * the admin-only segments in the "Selected agent" dropdown (Settings, LLM,
 * Prompts, Tools, ...) must disappear — only the "New Chat" top action
 * remains. Flipping back to Admin mode must bring the full list back.
 *
 * This is a regression guard for a memoization bug in
 * `hooks/use-mentor-segments.ts`: the `filterContext` useMemo did not list
 * `userType` as a dependency, so toggling the switch didn't recompute the
 * segment list and admin items stayed visible in User mode. The fix adds
 * `userType` to the deps array and makes `hooks/use-user-type.ts`
 * `isUserTypeAllowed` early-return `false` for `UserType.STUDENT` unless a
 * segment's `userTypes` explicitly includes STUDENT (none currently do).
 *
 * The dropdown menu does not live-update while open, so every checkpoint
 * below closes the dropdown, toggles the switch, then re-opens it before
 * asserting — opening once and asserting across a toggle would pass even
 * with the bug present.
 */
test.describe('Journey 56: Navbar User Mode Dropdown Visibility', () => {
  test.setTimeout(200_000);

  test.beforeEach(async ({ page, createMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Requires admin access');
      return;
    }

    // Each test creates its own mentor so the dropdown's admin-segment
    // visibility isn't polluted by another test's mentor state.
    await createMentorPage.openAndCreate();
  });

  test('admin toggling User/Admin mode hides and reshows admin settings items in the Selected agent dropdown', async ({
    page,
    navbarPage,
  }) => {
    const newChatItem = page.getByRole('menuitem', {
      name: 'New Chat',
      exact: true,
    });
    const settingsItem = page.getByRole('menuitem', {
      name: 'Settings',
      exact: true,
    });
    const llmItem = page.getByRole('menuitem', { name: 'LLM', exact: true });
    const promptsItem = page.getByRole('menuitem', {
      name: 'Prompts',
      exact: true,
    });
    const toolsItem = page.getByRole('menuitem', {
      name: 'Tools',
      exact: true,
    });
    const modifyItem = page.getByRole('menuitem', {
      name: 'Modify',
      exact: true,
    });

    await waitForPageReady(page);

    // ── 1. Admin mode (default): the full admin list is present ────────────
    await navbarPage.openAgentDropdown();
    await expect(newChatItem).toBeVisible({ timeout: 15_000 });
    await expect(settingsItem).toBeVisible({ timeout: 10_000 });
    await expect(llmItem).toBeVisible({ timeout: 10_000 });
    await expect(promptsItem).toBeVisible({ timeout: 10_000 });
    await expect(toolsItem).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');

    // ── 2. Toggle to User mode, then re-open the dropdown ───────────────────
    await navbarPage.switchToUserMode();
    await navbarPage.openAgentDropdown();

    await expect(newChatItem).toBeVisible({ timeout: 15_000 });
    await expect(settingsItem).not.toBeVisible();
    await expect(llmItem).not.toBeVisible();
    await expect(promptsItem).not.toBeVisible();
    await expect(toolsItem).not.toBeVisible();
    await expect(modifyItem).not.toBeVisible();

    // Only "New Chat" remains — assert the full visible item list collapses
    // to exactly that one entry.
    const userModeItems = await navbarPage.getDropdownItems();
    expect(userModeItems).toEqual(['New Chat']);

    await page.keyboard.press('Escape');

    // ── 3. Regression guard: back to Admin mode, the full list reappears ───
    // (This is the checkpoint that catches the memoization bug: without
    // `userType` in the useMemo deps, the stale filtered list would still
    // show only "New Chat" here.)
    await navbarPage.switchToAdminMode();
    await navbarPage.openAgentDropdown();

    await expect(newChatItem).toBeVisible({ timeout: 15_000 });
    await expect(settingsItem).toBeVisible({ timeout: 10_000 });
    await expect(llmItem).toBeVisible({ timeout: 10_000 });
    await expect(promptsItem).toBeVisible({ timeout: 10_000 });
    await expect(toolsItem).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');

    // ── 4. Toggle to User mode again: collapses back down ───────────────────
    await navbarPage.switchToUserMode();
    await navbarPage.openAgentDropdown();

    await expect(newChatItem).toBeVisible({ timeout: 15_000 });
    await expect(settingsItem).not.toBeVisible();
    await expect(llmItem).not.toBeVisible();
    await expect(promptsItem).not.toBeVisible();
    await expect(toolsItem).not.toBeVisible();

    const userModeItemsAgain = await navbarPage.getDropdownItems();
    expect(userModeItemsAgain).toEqual(['New Chat']);

    await page.keyboard.press('Escape');
  });
});
