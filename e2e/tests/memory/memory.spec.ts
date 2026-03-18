import { test, expect } from "@playwright/test";
import {
  checkAdminStatus,
  selectDropdownWorksCorrectly,
  waitForPageReady,
} from "../utils";
import { navigateToMentorApp } from "../profile/helpers";
import { logger } from "@iblai/iblai-js/playwright";

/**
 * Opens the Edit Mentor modal and navigates to the Memory tab.
 * Returns the settings dialog locator.
 */
async function openMemoryTab(page: import("@playwright/test").Page) {
  await selectDropdownWorksCorrectly(page);

  const memoryMenuItem = page.getByRole("menuitem", { name: "Memory" });
  await expect(memoryMenuItem).toBeVisible({ timeout: 10_000 });
  await memoryMenuItem.click();

  const settingsDialog = page
    .getByRole("dialog")
    .filter({ hasText: "Edit Mentor" });
  await expect(settingsDialog).toBeVisible({ timeout: 15_000 });

  const memoryTab = settingsDialog.getByRole("tab", { name: "Memory" });
  const isAlreadyActive =
    (await memoryTab.getAttribute("data-state").catch(() => null)) === "active";
  if (!isAlreadyActive) {
    await memoryTab.click();
  }

  await waitForPageReady(page);
  return settingsDialog;
}

test.describe("Mentor Memory Tab", () => {
  test.setTimeout(200_000);

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  test("Memory tab is visible in the Edit Mentor modal", async ({ page }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Memory tab requires admin access");

    await selectDropdownWorksCorrectly(page);

    const settingsDialog = page
      .getByRole("dialog")
      .filter({ hasText: "Edit Mentor" });
    await expect(settingsDialog).toBeVisible({ timeout: 15_000 });

    // The Memory tab label must be present in the tab list
    const memoryTab = settingsDialog.getByRole("tab", { name: "Memory" });
    await expect(memoryTab).toBeVisible({ timeout: 10_000 });
    logger.info("Memory tab is visible in the Edit Mentor modal");

    await page.keyboard.press("Escape");
  });

  test('"Reference saved memories" toggle can be enabled and disabled', async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Memory tab requires admin access");

    const dialog = await openMemoryTab(page);

    // The toggle is labelled by the adjacent text "Reference saved memories"
    const toggle = dialog
      .getByText("Reference saved memories")
      .locator("..")
      .locator("..")
      .getByRole("switch");

    await expect(toggle).toBeVisible({ timeout: 10_000 });

    const wasChecked = (await toggle.getAttribute("aria-checked")) === "true";
    logger.info(`Initial state: reference_saved_memories = ${wasChecked}`);

    // Toggle ON if currently off
    if (!wasChecked) {
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-checked", "true", {
        timeout: 10_000,
      });
      // Expect a success toast from sonner
      await expect(
        page.getByText("Reference saved memories updated"),
      ).toBeVisible({
        timeout: 10_000,
      });
      logger.info("Toggled reference saved memories ON");
    }

    // Toggle OFF
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false", {
      timeout: 10_000,
    });
    await expect(
      page.getByText("Reference saved memories updated"),
    ).toBeVisible({
      timeout: 10_000,
    });
    logger.info("Toggled reference saved memories OFF");

    // Restore original state if it was on
    if (wasChecked) {
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-checked", "true", {
        timeout: 10_000,
      });
    }

    await page.keyboard.press("Escape");
  });

  test("User memories list shows entries or empty state, and an entry can be deleted", async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Memory tab requires admin access");

    const dialog = await openMemoryTab(page);

    // Either the memory list or empty state must be visible
    const emptyState = dialog.getByText("No saved memories yet.");
    const addMemoryButton = dialog.getByRole("button", { name: /Add Memory/i });

    await expect(addMemoryButton).toBeVisible({ timeout: 10_000 });

    const hasEmptyState = await emptyState
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (hasEmptyState) {
      logger.info(
        "No saved memories — empty state is visible, Add Memory button present",
      );
      await page.keyboard.press("Escape");
      return;
    }

    // Memory entries exist — find a delete button and test deletion
    // Each row has a Delete button (trash icon with accessible label or within a menu)
    const deleteButtons = dialog.getByRole("button", { name: /delete/i });
    const hasDeleteButtons = await deleteButtons
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (!hasDeleteButtons) {
      logger.info(
        "Memory entries exist but no delete buttons found — skipping delete check",
      );
      await page.keyboard.press("Escape");
      return;
    }

    const initialCount = await deleteButtons.count();
    logger.info(`Found ${initialCount} memory entries`);

    await deleteButtons.first().click();

    // Confirm dialog may appear
    const confirmDialog = page
      .getByRole("dialog")
      .filter({ hasText: /delete|confirm/i })
      .last();
    const confirmVisible = await confirmDialog
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (confirmVisible) {
      const confirmButton = confirmDialog
        .getByRole("button", { name: /delete|confirm/i })
        .last();
      await confirmButton.click();
      logger.info("Confirmed memory deletion");
    }

    // Wait for the list to update — either one fewer entry or the empty state
    await page.waitForTimeout(2_000);
    const finalDeleteButtons = dialog.getByRole("button", { name: /delete/i });
    const finalCount = await finalDeleteButtons.count().catch(() => 0);
    expect(finalCount).toBeLessThan(initialCount);
    logger.info(`Memory entry deleted — entries remaining: ${finalCount}`);

    await page.keyboard.press("Escape");
  });
});
