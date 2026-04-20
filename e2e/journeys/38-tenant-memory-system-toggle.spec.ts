import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import type { Page, Locator } from '@playwright/test';

/**
 * Navigate to Account Settings → Advanced tab and return the dialog locator.
 * Mirrors the pattern used by journey 30 — the "Advanced" tab lives inside
 * the User Profile dialog reached via More Options → platform name.
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

  // Wait for the Memory System row inside the advanced content area.
  await expect(accountDialog.getByText('Memory System')).toBeVisible({
    timeout: 10_000,
  });

  return accountDialog;
}

/**
 * Locator for the Memory System switch in the Advanced tab. The switch's
 * aria-label reflects state ("Memory system enabled" or "Memory system
 * disabled"), so we match on the prefix to find it regardless of state.
 */
function memorySystemSwitch(dialog: Locator): Locator {
  return dialog.getByRole('switch', { name: /^Memory system/i });
}

async function isMemorySystemEnabled(dialog: Locator): Promise<boolean> {
  const state = await memorySystemSwitch(dialog)
    .getAttribute('aria-checked')
    .catch(() => 'false');
  return state === 'true';
}

async function setMemorySystem(
  dialog: Locator,
  page: Page,
  desired: boolean,
): Promise<void> {
  const current = await isMemorySystemEnabled(dialog);
  if (current === desired) return;

  const toggle = memorySystemSwitch(dialog);
  await toggle.click();
  // The aria-label is rebuilt from the updated state after the mutation
  // resolves — waiting for it asserts the switch actually flipped instead
  // of relying on a brittle toast match.
  await expect(toggle).toHaveAttribute(
    'aria-label',
    desired ? /enabled/i : /disabled/i,
    { timeout: 10_000 },
  );
  // Let tenant settings propagate through RTK Query caches before the next
  // page action reads them.
  await page.waitForTimeout(1_000);
}

async function closeAccountDialog(dialog: Locator, page: Page): Promise<void> {
  const closeBtn = dialog.getByRole('button', { name: /close/i }).last();
  if (await closeBtn.isVisible().catch(() => false)) {
    await closeBtn.click();
  } else {
    await page.keyboard.press('Escape');
  }
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });
}

test.describe('Journey 38: Tenant Memory System toggle', () => {
  test('admin toggles Memory System in Advanced tab and the chat Memory button reflects it', async ({
    page,
    chatPage,
    editMentorPage,
  }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Tenant Memory System toggle requires admin access');
      return;
    }
    await waitForPageReady(page);

    // Ensure the mentor itself has memory enabled — the chat Memory button
    // only appears when BOTH the tenant memsearch config and the mentor's
    // enable_memory_component are on (see hooks/use-mentors/use-mentor-settings.ts).
    await editMentorPage.open('Memory');
    await waitForPageReady(page);
    const mentorMemoryWasEnabled =
      await editMentorPage.memory.isEnableMemoryChecked();
    if (!mentorMemoryWasEnabled) {
      await editMentorPage.memory.toggleEnableMemory();
    }
    await editMentorPage.close();
    await page.waitForTimeout(1_000);

    // Snapshot original tenant-level state so we can restore it later.
    let accountDialog = await openAdvancedTab(page);
    const tenantMemoryWasEnabled = await isMemorySystemEnabled(accountDialog);

    try {
      // --- Disable Memory System at tenant level ---
      await setMemorySystem(accountDialog, page, false);
      await closeAccountDialog(accountDialog, page);
      await waitForPageReady(page);

      await expect(chatPage.memoryButton).not.toBeVisible({ timeout: 10_000 });

      // --- Re-enable Memory System at tenant level ---
      accountDialog = await openAdvancedTab(page);
      await setMemorySystem(accountDialog, page, true);
      await closeAccountDialog(accountDialog, page);
      await waitForPageReady(page);

      await expect(chatPage.memoryButton).toBeVisible({ timeout: 10_000 });
    } finally {
      // Restore tenant state.
      const restoreDialog = await openAdvancedTab(page).catch(() => null);
      if (restoreDialog) {
        await setMemorySystem(
          restoreDialog,
          page,
          tenantMemoryWasEnabled,
        ).catch(() => undefined);
        await closeAccountDialog(restoreDialog, page).catch(() => undefined);
      }

      // Restore mentor memory state.
      if (!mentorMemoryWasEnabled) {
        await editMentorPage.open('Memory');
        await waitForPageReady(page);
        const stillOn = await editMentorPage.memory.isEnableMemoryChecked();
        if (stillOn) {
          await editMentorPage.memory.toggleEnableMemory();
        }
        await editMentorPage.close();
      }
    }
  });
});
