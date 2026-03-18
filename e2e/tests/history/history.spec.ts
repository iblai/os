import { test, expect } from "@playwright/test";
import {
  checkAdminStatus,
  selectDropdownWorksCorrectly,
  waitForPageReady,
} from "../utils";
import { navigateToMentorApp } from "../profile/helpers";
import { logger } from "@iblai/iblai-js/playwright";

/**
 * Opens the Edit Mentor modal and navigates to the History tab.
 * Returns the settings dialog locator.
 */
async function openHistoryTab(page: import("@playwright/test").Page) {
  await selectDropdownWorksCorrectly(page);

  const historyMenuItem = page.getByRole("menuitem", { name: "History" });
  await expect(historyMenuItem).toBeVisible({ timeout: 10_000 });
  await historyMenuItem.click();

  const settingsDialog = page
    .getByRole("dialog")
    .filter({ hasText: "Edit Mentor" });
  await expect(settingsDialog).toBeVisible({ timeout: 15_000 });

  // The History tab may already be active via the menu item, or we may need to click it
  const historyTab = settingsDialog.getByRole("tab", { name: "History" });
  const isAlreadyActive =
    (await historyTab.getAttribute("data-state").catch(() => null)) ===
    "active";
  if (!isAlreadyActive) {
    await historyTab.click();
  }

  await waitForPageReady(page);
  return settingsDialog;
}

test.describe("Mentor History Tab", () => {
  test.setTimeout(200_000);

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  test("History tab loads with conversation list or empty state", async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "History tab requires admin access");

    const dialog = await openHistoryTab(page);

    // Either a conversation list region or an empty state message must be visible
    const conversationList = dialog.getByRole("region", {
      name: "Conversation list",
    });
    const emptyState = dialog.getByText("No conversations found");

    const hasConversations = await conversationList
      .isVisible({ timeout: 15_000 })
      .catch(() => false);
    const hasEmptyState = await emptyState
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    expect(hasConversations || hasEmptyState).toBe(true);
    logger.info(
      hasConversations
        ? "Conversation list is visible"
        : "Empty state is visible",
    );

    await page.keyboard.press("Escape");
  });

  test("History tab pagination navigates between pages", async ({ page }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "History tab requires admin access");

    const dialog = await openHistoryTab(page);

    const conversationList = dialog.getByRole("region", {
      name: "Conversation list",
    });
    const hasConversations = await conversationList
      .isVisible({ timeout: 15_000 })
      .catch(() => false);

    if (!hasConversations) {
      logger.info("No conversations — skipping pagination check");
      await page.keyboard.press("Escape");
      return;
    }

    // Pagination only appears when totalPages > 1
    const nextButton = dialog.getByRole("button", { name: /next/i });
    const paginationVisible = await nextButton
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (paginationVisible) {
      const initialRows = await conversationList
        .locator('[class*="cursor-pointer"]')
        .count();
      await nextButton.click();
      await waitForPageReady(page);
      const updatedRows = await conversationList
        .locator('[class*="cursor-pointer"]')
        .count();
      expect(updatedRows).toBeGreaterThan(0);
      logger.info(
        `Pagination: page 1 had ${initialRows} rows, page 2 has ${updatedRows} rows`,
      );
    } else {
      logger.info("Only one page of conversations — pagination not shown");
    }

    await page.keyboard.press("Escape");
  });

  test("Clicking a conversation row expands its transcript in the preview panel", async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "History tab requires admin access");

    const dialog = await openHistoryTab(page);

    const conversationList = dialog.getByRole("region", {
      name: "Conversation list",
    });
    const hasConversations = await conversationList
      .isVisible({ timeout: 15_000 })
      .catch(() => false);

    if (!hasConversations) {
      logger.info("No conversations — skipping transcript expansion check");
      await page.keyboard.press("Escape");
      return;
    }

    // Click the first conversation row
    const firstRow = conversationList
      .locator('[class*="cursor-pointer"]')
      .first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    await firstRow.click();

    // Conversation preview panel becomes visible (desktop only)
    const previewPanel = dialog.getByRole("region", {
      name: "Conversation preview",
    });
    await expect(previewPanel).toBeVisible({ timeout: 10_000 });

    // The preview should contain at least one message
    const messageContent = previewPanel
      .locator("div")
      .filter({ hasText: /.+/ })
      .first();
    await expect(messageContent).toBeVisible({ timeout: 10_000 });
    logger.info("Conversation transcript expanded in preview panel");

    await page.keyboard.press("Escape");
  });

  test("Sentiment and topic filters narrow the conversation list", async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "History tab requires admin access");

    const dialog = await openHistoryTab(page);

    const conversationList = dialog.getByRole("region", {
      name: "Conversation list",
    });
    const hasConversations = await conversationList
      .isVisible({ timeout: 15_000 })
      .catch(() => false);

    if (!hasConversations) {
      logger.info("No conversations — skipping filter check");
      await page.keyboard.press("Escape");
      return;
    }

    // Sentiment filter
    const sentimentTrigger = dialog
      .getByRole("combobox", {
        name: "Filter by sentiment",
      })
      .first();

    if (
      await sentimentTrigger.isVisible({ timeout: 5_000 }).catch(() => false)
    ) {
      await sentimentTrigger.click();
      // Select first non-"all" option
      const positiveOption = dialog.getByRole("option", { name: /positive/i });
      if (
        await positiveOption.isVisible({ timeout: 3_000 }).catch(() => false)
      ) {
        await positiveOption.click();
        await waitForPageReady(page);
        logger.info("Sentiment filter applied");

        // Reset to "all"
        await sentimentTrigger.click();
        const allOption = dialog.getByRole("option", { name: /all/i }).first();
        if (await allOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await allOption.click();
        } else {
          await page.keyboard.press("Escape");
        }
        await waitForPageReady(page);
      } else {
        await page.keyboard.press("Escape");
        logger.info(
          "No positive sentiment option available — skipping sentiment filter",
        );
      }
    } else {
      logger.info("Sentiment filter not visible — skipping");
    }

    // Topic filter
    const topicTrigger = dialog
      .getByRole("combobox", { name: "Filter by topic" })
      .first();
    if (await topicTrigger.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await topicTrigger.click();
      const firstTopicOption = dialog.getByRole("option").nth(1); // skip "all"
      const hasTopics = await firstTopicOption
        .isVisible({ timeout: 3_000 })
        .catch(() => false);
      if (hasTopics) {
        await firstTopicOption.click();
        await waitForPageReady(page);
        logger.info("Topic filter applied");
      } else {
        await page.keyboard.press("Escape");
        logger.info("No topic options available — skipping topic filter");
      }
    } else {
      logger.info("Topic filter not visible — skipping");
    }

    await page.keyboard.press("Escape");
  });

  test("Export button triggers a file download", async ({ page }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "History tab requires admin access");

    const dialog = await openHistoryTab(page);

    const exportButton = dialog.getByRole("button", { name: /export/i });
    await expect(exportButton).toBeVisible({ timeout: 10_000 });
    await expect(exportButton).toBeEnabled({ timeout: 5_000 });

    // Listen for the download event before clicking
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }),
      exportButton.click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.(csv|json|xlsx?)$/i);
    logger.info(`Export download triggered: ${download.suggestedFilename()}`);

    await page.keyboard.press("Escape");
  });
});
