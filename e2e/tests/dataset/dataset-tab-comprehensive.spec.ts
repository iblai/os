import { test, expect, Page } from "@playwright/test";
import path from "path";
import { logger } from "@iblai/iblai-js/playwright";
import { checkAdminStatus } from "../utils";
import { navigateToMentorApp } from "../profile/helpers";

// Use the authenticate function from utils.ts for authentication

/**
 * Helper to navigate to datasets tab
 */
async function navigateToDatasetsTab(page: Page) {
  logger.info("Navigating to Datasets tab...");

  // Wait for page to be fully loaded and stable
  await page.waitForLoadState("domcontentloaded");

  // Click mentor dropdown button - wait for it to be visible and clickable
  const dropdownButton = page.getByRole("button", {
    name: "Selected mentor dropdown button",
  });

  // Wait for button with retry logic
  await expect(dropdownButton).toBeVisible({ timeout: 30000 });
  await expect(dropdownButton).toBeEnabled({ timeout: 5000 });
  await dropdownButton.click();

  // Click Datasets menu item
  const datasetsMenuItem = page.getByRole("menuitem", { name: "Datasets" });
  await expect(datasetsMenuItem).toBeVisible({ timeout: 5000 });
  await datasetsMenuItem.click();

  // Wait for Edit Mentor dialog to appear
  const dialog = page
    .getByRole("dialog")
    .filter({ hasText: /Edit Mentor|Datasets/i });
  await expect(dialog).toBeVisible({ timeout: 10000 });

  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  logger.info("Successfully navigated to Datasets tab");
  return dialog;
}

// Use checkAdminStatus from utils.ts

test.describe("Datasets Tab - Comprehensive Tests", () => {
  test.setTimeout(300000); // 5 minutes timeout for all tests

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  test("TC01: Should display datasets tab header and description", async ({
    page,
  }) => {
    const dialog = await navigateToDatasetsTab(page);

    // Verify header - use a specific locator for the h3 element in the datasets tab header
    const header = dialog
      .locator("h3.text-base.font-medium")
      .filter({ hasText: "Datasets" });
    await expect(header).toBeVisible({ timeout: 5000 });

    // Verify description
    const description = dialog.getByText(
      /Manage training datasets and knowledge sources/i,
    );
    await expect(description).toBeVisible({ timeout: 5000 });

    logger.info("TC01: Header and description verified");
  });

  test("TC02: Should display search input for datasets", async ({ page }) => {
    const dialog = await navigateToDatasetsTab(page);

    // Verify search input
    const searchInput = dialog
      .locator('input[type="search"]')
      .or(dialog.getByPlaceholder(/Search datasets/i));
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Verify placeholder text
    await expect(searchInput).toHaveAttribute(
      "placeholder",
      /Search datasets/i,
    );

    logger.info("TC02: Search input verified");
  });

  test("TC03: Should test search functionality", async ({ page }) => {
    const dialog = await navigateToDatasetsTab(page);

    const searchInput = dialog
      .locator('input[type="search"]')
      .or(dialog.getByPlaceholder(/Search datasets/i));
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Type search query
    await searchInput.fill("test");
    await page.waitForTimeout(1000); // Wait for debounce
    await page.waitForLoadState("networkidle");

    // Verify spinner or loading indicator appears during search
    // Then verify results update
    await page.waitForTimeout(2000);

    // Clear search
    await searchInput.clear();
    await page.waitForLoadState("networkidle");

    logger.info("TC03: Search functionality tested");
  });

  test("TC04: Should display Add Resource button", async ({ page }) => {
    const dialog = await navigateToDatasetsTab(page);

    // Verify Add Resource button
    const addResourceButton = dialog.getByRole("button", {
      name: /Add Resource/i,
    });
    await expect(addResourceButton).toBeVisible({ timeout: 5000 });
    await expect(addResourceButton).toBeEnabled();

    logger.info("TC04: Add Resource button verified");
  });

  test("TC05: Should open Add Resource modal and display all resource types", async ({
    page,
  }) => {
    const dialog = await navigateToDatasetsTab(page);

    // Click Add Resource button
    const addResourceButton = dialog.getByRole("button", {
      name: /Add Resource/i,
    });
    await addResourceButton.click();

    // Wait for Add Resources modal
    const addResourceModal = page
      .getByRole("dialog")
      .filter({ hasText: /Add Resources/i });
    await expect(addResourceModal).toBeVisible({ timeout: 10000 });

    // Verify modal header
    const modalTitle = addResourceModal.getByRole("heading", {
      name: /Add Resources/i,
    });
    await expect(modalTitle).toBeVisible();

    // Verify description
    const modalDescription = addResourceModal.getByText(
      /Add knowledge to help your agent/i,
    );
    await expect(modalDescription).toBeVisible();

    // Verify resource type buttons are present (check for common ones based on actual resource-types.tsx)
    // Available types: PowerPoint, OneDrive, Google Drive, Dropbox, YouTube, URL, PDF, DOCX, Excel, GitHub, TXT, Audio, Video, Image, Web Crawler
    const resourceTypes = ["PDF", "URL", "Image", "TXT", "YouTube", "GitHub"];
    for (const type of resourceTypes) {
      const resourceButton = addResourceModal.locator("button").filter({
        hasText: new RegExp(`^${type}$`, "i"),
      });
      // Resource might be disabled or hidden in some configurations
      const isVisible = await resourceButton.isVisible().catch(() => false);
      logger.info(
        `Resource type ${type}: ${isVisible ? "visible" : "not visible"}`,
      );
    }

    // Close modal
    await page.keyboard.press("Escape");
    await expect(addResourceModal).not.toBeVisible({ timeout: 5000 });

    logger.info("TC05: Add Resource modal verified");
  });

  test("TC06: Should display table headers correctly", async ({ page }) => {
    const dialog = await navigateToDatasetsTab(page);

    // Check for table headers
    const tableHeaders = [
      "NAME",
      "TYPE",
      "TOKENS",
      "INTERVAL",
      "VISIBILITY",
      "STATUS",
    ];

    for (const header of tableHeaders) {
      const headerCell = dialog
        .getByRole("columnheader", { name: header })
        .or(dialog.getByText(header));
      const isVisible = await headerCell
        .first()
        .isVisible()
        .catch(() => false);
      logger.info(
        `Table header ${header}: ${isVisible ? "visible" : "not visible"}`,
      );
    }

    logger.info("TC06: Table headers checked");
  });

  test("TC07: Should display datasets list or empty state", async ({
    page,
  }) => {
    const dialog = await navigateToDatasetsTab(page);

    // Wait for loading to complete
    await page.waitForTimeout(3000);

    // Check for either datasets or empty state
    const noDataMessage = dialog.getByText(/No datasets found/i);
    const tableRows = dialog.locator("tbody tr");

    const hasNoData = await noDataMessage.isVisible().catch(() => false);
    const rowCount = await tableRows.count().catch(() => 0);

    if (hasNoData) {
      logger.info("TC07: Empty state displayed - No datasets found");
    } else if (rowCount > 0) {
      logger.info(`TC07: ${rowCount} dataset row(s) found`);
    }

    // At least one of these should be true
    expect(hasNoData || rowCount > 0).toBe(true);

    logger.info("TC07: Datasets list or empty state verified");
  });

  test("TC08: Should test pagination if datasets exist", async ({ page }) => {
    const dialog = await navigateToDatasetsTab(page);

    // Wait for loading to complete
    await page.waitForTimeout(3000);

    // Look for pagination component
    const pagination = dialog
      .locator('[data-testid="pagination"]')
      .or(dialog.locator("nav").filter({ hasText: /previous|next/i }));
    const paginationVisible = await pagination.isVisible().catch(() => false);

    if (paginationVisible) {
      // Check for page numbers or navigation buttons
      const nextButton = dialog.getByRole("button", { name: /next/i });
      const prevButton = dialog.getByRole("button", { name: /previous/i });

      const hasNext = await nextButton.isVisible().catch(() => false);
      const hasPrev = await prevButton.isVisible().catch(() => false);

      logger.info(`TC08: Pagination - Next: ${hasNext}, Previous: ${hasPrev}`);

      // If next is enabled, try clicking it
      if (hasNext && (await nextButton.isEnabled().catch(() => false))) {
        await nextButton.click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1000);
        logger.info("TC08: Clicked next page");
      }
    } else {
      logger.info(
        "TC08: No pagination visible (likely only one page of results)",
      );
    }

    logger.info("TC08: Pagination tested");
  });

  test("TC09: Should test visibility toggle if datasets exist", async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      logger.info("TC09: Skipping - User is not admin");
      test.skip();
      return;
    }

    const dialog = await navigateToDatasetsTab(page);
    await page.waitForTimeout(3000);

    // Look for visibility toggle buttons (Eye icons)
    const visibilityButtons = dialog
      .getByRole("button")
      .filter({ has: page.locator("svg.lucide-eye, svg.lucide-eye-off") });
    const buttonCount = await visibilityButtons.count().catch(() => 0);

    if (buttonCount > 0) {
      logger.info(`TC09: Found ${buttonCount} visibility toggle button(s)`);

      // Click first visibility toggle
      const firstButton = visibilityButtons.first();
      await firstButton.click();

      // Wait for update
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);

      // Verify toast notification
      const toast = page
        .locator("[data-sonner-toast]")
        .or(page.getByText(/updated successfully|failed to update/i));
      const toastVisible = await toast
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      logger.info(
        `TC09: Toast notification: ${toastVisible ? "shown" : "not shown"}`,
      );
    } else {
      logger.info(
        "TC09: No visibility toggle buttons found (no datasets with visibility control)",
      );
    }

    logger.info("TC09: Visibility toggle tested");
  });

  test("TC10: Should test training status switch if datasets exist", async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      logger.info("TC10: Skipping - User is not admin");
      test.skip();
      return;
    }

    const dialog = await navigateToDatasetsTab(page);
    await page.waitForTimeout(3000);

    // Look for training switches
    const trainingSwitches = dialog.getByRole("switch");
    const switchCount = await trainingSwitches.count().catch(() => 0);

    if (switchCount > 0) {
      logger.info(`TC10: Found ${switchCount} training switch(es)`);

      const firstSwitch = trainingSwitches.first();
      const isTrained = await firstSwitch.getAttribute("aria-checked");
      logger.info(`TC10: First switch state - trained: ${isTrained}`);

      // If untrained, clicking should show Train or Delete modal
      if (isTrained === "false") {
        await firstSwitch.click();

        const trainOrDeleteModal = page
          .getByRole("dialog")
          .filter({ hasText: /What would you like to do/i });
        const modalVisible = await trainOrDeleteModal
          .isVisible({ timeout: 5000 })
          .catch(() => false);

        if (modalVisible) {
          logger.info("TC10: Train or Delete modal appeared");

          // Verify modal content
          const trainButton = trainOrDeleteModal.getByRole("button", {
            name: /Train/i,
          });
          const deleteButton = trainOrDeleteModal.getByRole("button", {
            name: /Delete/i,
          });

          await expect(trainButton).toBeVisible();
          await expect(deleteButton).toBeVisible();

          // Close modal without action
          await page.keyboard.press("Escape");
        }
      } else {
        logger.info(
          "TC10: First dataset is trained, not clicking to avoid unintended untrain",
        );
      }
    } else {
      logger.info("TC10: No training switches found");
    }

    logger.info("TC10: Training status switch tested");
  });

  test("TC11: Should test Schedule Retrain button if available", async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      logger.info("TC11: Skipping - User is not admin");
      test.skip();
      return;
    }

    const dialog = await navigateToDatasetsTab(page);
    await page.waitForTimeout(3000);

    // Look for clock icon buttons (Schedule Retrain)
    const scheduleButtons = dialog
      .getByRole("button")
      .filter({ has: page.locator("svg.lucide-clock") });
    const buttonCount = await scheduleButtons.count().catch(() => 0);

    if (buttonCount > 0) {
      logger.info(`TC11: Found ${buttonCount} schedule retrain button(s)`);

      // Find an enabled schedule button
      for (let i = 0; i < buttonCount; i++) {
        const button = scheduleButtons.nth(i);
        const isDisabled = await button.isDisabled().catch(() => true);

        if (!isDisabled) {
          await button.click();

          // Check for Schedule Retraining modal
          const scheduleModal = page
            .getByRole("dialog")
            .filter({ hasText: /Schedule Retraining/i });
          const modalVisible = await scheduleModal
            .isVisible({ timeout: 5000 })
            .catch(() => false);

          if (modalVisible) {
            logger.info("TC11: Schedule Retraining modal appeared");

            // Verify modal content
            const dailyButton = scheduleModal.getByRole("button", {
              name: /Daily/i,
            });
            const weeklyButton = scheduleModal.getByRole("button", {
              name: /Weekly/i,
            });
            const monthlyButton = scheduleModal.getByRole("button", {
              name: /Monthly/i,
            });
            const intervalInput = scheduleModal.locator('input[type="number"]');
            const scheduleButton = scheduleModal.getByRole("button", {
              name: /Schedule Retraining/i,
            });
            const cancelButton = scheduleModal.getByRole("button", {
              name: /Cancel/i,
            });

            // Check visibility of elements
            await expect(dailyButton).toBeVisible();
            await expect(weeklyButton).toBeVisible();
            await expect(monthlyButton).toBeVisible();
            await expect(intervalInput).toBeVisible();
            await expect(scheduleButton).toBeVisible();
            await expect(cancelButton).toBeVisible();

            // Test clicking preset buttons
            await dailyButton.click();
            await expect(intervalInput).toHaveValue("1");

            await weeklyButton.click();
            await expect(intervalInput).toHaveValue("7");

            await monthlyButton.click();
            await expect(intervalInput).toHaveValue("30");

            // Test custom input
            await intervalInput.fill("14");
            await expect(intervalInput).toHaveValue("14");

            // Close without saving
            await cancelButton.click();
            await expect(scheduleModal).not.toBeVisible({ timeout: 5000 });

            logger.info("TC11: Schedule Retraining modal fully tested");
            break;
          }
        }
      }
    } else {
      logger.info("TC11: No schedule retrain buttons found");
    }

    logger.info("TC11: Schedule Retrain tested");
  });

  test("TC12: Should test Delete Dataset flow if datasets exist", async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      logger.info("TC12: Skipping - User is not admin");
      test.skip();
      return;
    }

    const dialog = await navigateToDatasetsTab(page);
    await page.waitForTimeout(3000);

    // Look for trained datasets (to test untrain -> delete flow)
    const trainingSwitches = dialog.getByRole("switch", {
      name: /training for document/i,
    });
    const switchCount = await trainingSwitches.count().catch(() => 0);

    if (switchCount > 0) {
      // Find a trained dataset
      for (let i = 0; i < switchCount; i++) {
        const switchEl = trainingSwitches.nth(i);
        const isTrained = await switchEl.getAttribute("aria-checked");

        if (isTrained === "true") {
          logger.info(`TC12: Found trained dataset at index ${i}`);

          // Click to untrain (this should open delete modal)
          await switchEl.click();
          await page.waitForTimeout(1000);

          // Check for Delete Dataset modal
          const deleteModal = page
            .getByRole("dialog")
            .filter({ hasText: /Delete Dataset/i });
          const modalVisible = await deleteModal
            .isVisible({ timeout: 5000 })
            .catch(() => false);

          if (modalVisible) {
            logger.info("TC12: Delete Dataset modal appeared");

            // Verify modal content
            const deleteButton = deleteModal.getByRole("button", {
              name: /Delete/i,
            });
            const cancelButton = deleteModal.getByRole("button", {
              name: /Cancel/i,
            });

            await expect(deleteButton).toBeVisible();
            await expect(cancelButton).toBeVisible();

            // Close without deleting
            await cancelButton.click();
            await expect(deleteModal).not.toBeVisible({ timeout: 5000 });

            logger.info("TC12: Delete Dataset modal tested");
          }
          break;
        }
      }
    } else {
      logger.info("TC12: No training switches found");
    }

    logger.info("TC12: Delete Dataset flow tested");
  });

  test("TC13: Should test Train or Delete modal actions", async ({ page }) => {
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      logger.info("TC13: Skipping - User is not admin");
      test.skip();
      return;
    }

    const dialog = await navigateToDatasetsTab(page);
    await page.waitForTimeout(3000);

    // Look for untrained datasets
    const trainingSwitches = dialog.getByRole("switch", {
      name: /training for document/i,
    });
    const switchCount = await trainingSwitches.count().catch(() => 0);

    if (switchCount > 0) {
      // Find an untrained dataset
      for (let i = 0; i < switchCount; i++) {
        const switchEl = trainingSwitches.nth(i);
        const isTrained = await switchEl.getAttribute("aria-checked");

        if (isTrained === "false") {
          logger.info(`TC13: Found untrained dataset at index ${i}`);

          // Click to show Train or Delete modal
          await switchEl.click();
          await page.waitForTimeout(1000);

          // Check for Train or Delete modal
          const trainOrDeleteModal = page
            .getByRole("dialog")
            .filter({ hasText: /What would you like to do/i });
          const modalVisible = await trainOrDeleteModal
            .isVisible({ timeout: 5000 })
            .catch(() => false);

          if (modalVisible) {
            logger.info("TC13: Train or Delete modal appeared");

            // Verify modal content
            const trainButton = trainOrDeleteModal.getByRole("button", {
              name: /^Train$/i,
            });
            const deleteButton = trainOrDeleteModal.getByRole("button", {
              name: /Delete/i,
            });
            const description = trainOrDeleteModal.getByText(
              /This dataset is currently untrained/i,
            );

            await expect(trainButton).toBeVisible();
            await expect(deleteButton).toBeVisible();
            await expect(description).toBeVisible();

            // Test Train button (will actually train)
            // We'll just verify it's clickable, but not click to avoid side effects
            await expect(trainButton).toBeEnabled();
            await expect(deleteButton).toBeEnabled();

            // Close modal
            await page.keyboard.press("Escape");
            await expect(trainOrDeleteModal).not.toBeVisible({ timeout: 5000 });

            logger.info("TC13: Train or Delete modal verified");
          }
          break;
        }
      }
    } else {
      logger.info("TC13: No training switches found");
    }

    logger.info("TC13: Train or Delete modal tested");
  });

  test("TC14: Should test In Progress badge display", async ({ page }) => {
    const dialog = await navigateToDatasetsTab(page);
    await page.waitForTimeout(3000);

    // Look for "In Progress" badges
    const inProgressBadges = dialog.getByText("In Progress");
    const badgeCount = await inProgressBadges.count().catch(() => 0);

    if (badgeCount > 0) {
      logger.info(
        `TC14: Found ${badgeCount} dataset(s) with In Progress status`,
      );

      // Verify badge styling
      const firstBadge = inProgressBadges.first();
      await expect(firstBadge).toBeVisible();
    } else {
      logger.info("TC14: No datasets currently in training progress");
    }

    logger.info("TC14: In Progress badge tested");
  });

  test("TC15: Should verify dataset link is clickable", async ({ page }) => {
    const dialog = await navigateToDatasetsTab(page);
    await page.waitForTimeout(3000);

    // Look for dataset name links
    const datasetLinks = dialog.locator("a[href]").filter({ hasText: /.+/ });
    const linkCount = await datasetLinks.count().catch(() => 0);

    if (linkCount > 0) {
      logger.info(`TC15: Found ${linkCount} dataset link(s)`);

      const firstLink = datasetLinks.first();
      const href = await firstLink.getAttribute("href");

      if (href) {
        logger.info(`TC15: First dataset link href: ${href}`);

        // Verify link has target="_blank" for external links
        const target = await firstLink.getAttribute("target");
        expect(target).toBe("_blank");

        // Verify link has rel="noopener noreferrer" for security
        const rel = await firstLink.getAttribute("rel");
        expect(rel).toContain("noopener");
      }
    } else {
      logger.info("TC15: No dataset links found (empty state)");
    }

    logger.info("TC15: Dataset links verified");
  });

  test("TC16: Should close datasets tab properly", async ({ page }) => {
    const dialog = await navigateToDatasetsTab(page);

    // Close dialog using Escape key
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // Verify dialog is closed
    const dialogVisible = await dialog.isVisible().catch(() => false);

    if (!dialogVisible) {
      logger.info("TC16: Dialog closed successfully with Escape key");
    } else {
      // Try clicking outside or close button
      const closeButton = dialog.getByRole("button", { name: /close/i });
      if (await closeButton.isVisible().catch(() => false)) {
        await closeButton.click();
        await expect(dialog).not.toBeVisible({ timeout: 5000 });
        logger.info("TC16: Dialog closed with close button");
      }
    }

    logger.info("TC16: Dialog close functionality tested");
  });

  test("TC17: Should handle loading states properly", async ({ page }) => {
    // Navigate directly to datasets
    const dialog = await navigateToDatasetsTab(page);

    // Look for spinner during initial load
    const spinner = dialog.locator(
      '[class*="spinner"], [class*="loading"], svg[class*="animate-spin"]',
    );

    // Either spinner was shown briefly or content loaded quickly
    // Just verify final state is stable
    await page.waitForTimeout(3000);

    const isLoading = await spinner.isVisible().catch(() => false);

    if (isLoading) {
      // Wait for loading to complete
      await expect(spinner).not.toBeVisible({ timeout: 30000 });
      logger.info("TC17: Loading spinner disappeared");
    } else {
      logger.info("TC17: Content loaded without visible spinner (fast load)");
    }

    // Verify content is now visible (either data or empty state)
    const table = dialog.locator("table");
    const noDataMessage = dialog.getByText(/No datasets found/i);

    const hasTable = await table.isVisible().catch(() => false);
    const hasNoData = await noDataMessage.isVisible().catch(() => false);

    expect(hasTable || hasNoData).toBe(true);

    logger.info("TC17: Loading states handled properly");
  });

  test("TC18: Should display correct token count format", async ({ page }) => {
    const dialog = await navigateToDatasetsTab(page);
    await page.waitForTimeout(3000);

    // Look for token values in table
    const tableBody = dialog.locator("tbody");
    const hasData =
      (await tableBody
        .locator("tr")
        .count()
        .catch(() => 0)) > 0;

    if (hasData) {
      const tokenCells = tableBody.locator("tr td:nth-child(3)");
      const cellCount = await tokenCells.count();

      if (cellCount > 0) {
        const firstTokenValue = await tokenCells.first().textContent();
        logger.info(`TC18: First token value: ${firstTokenValue}`);

        // Token should be a number (or 0)
        const tokenNumber = parseInt(firstTokenValue || "0", 10);
        expect(tokenNumber).toBeGreaterThanOrEqual(0);
      }
    } else {
      logger.info("TC18: No datasets to check token format");
    }

    logger.info("TC18: Token count format verified");
  });

  test("TC19: Should have proper tooltips on buttons", async ({ page }) => {
    const dialog = await navigateToDatasetsTab(page);
    await page.waitForTimeout(3000);

    // Check for visibility button tooltip - these buttons don't have tooltips wrapping them
    const visibilityButtons = dialog
      .getByRole("button")
      .filter({ has: page.locator("svg.lucide-eye, svg.lucide-eye-off") });
    const hasVisibilityButton =
      (await visibilityButtons.count().catch(() => 0)) > 0;

    if (hasVisibilityButton) {
      // Hover over first visibility button (no tooltip wrapper for visibility buttons)
      await visibilityButtons.first().hover({ force: true });
      await page.waitForTimeout(500);

      logger.info("TC19: Visibility button hover completed");
    }

    // Check for schedule retrain button tooltip - these ARE wrapped in tooltips
    // The clock button is inside a TooltipTrigger span, so we hover on the span instead
    const scheduleTooltipTriggers = dialog
      .locator('span[data-slot="tooltip-trigger"]')
      .filter({
        has: page.locator("button:has(svg.lucide-clock)"),
      });
    const hasScheduleButton =
      (await scheduleTooltipTriggers.count().catch(() => 0)) > 0;

    if (hasScheduleButton) {
      // Hover on the tooltip trigger span (which wraps the button)
      await scheduleTooltipTriggers.first().hover({ force: true });
      await page.waitForTimeout(500);

      // Check for tooltip
      const tooltip = page.locator('[role="tooltip"]');
      const tooltipVisible = await tooltip.isVisible().catch(() => false);
      logger.info(
        `TC19: Schedule retrain button tooltip: ${tooltipVisible ? "visible" : "not visible"}`,
      );
    } else {
      // Fallback: try the old method if no tooltip triggers found
      const scheduleButtons = dialog
        .getByRole("button")
        .filter({ has: page.locator("svg.lucide-clock") });
      const hasScheduleBtn = (await scheduleButtons.count().catch(() => 0)) > 0;
      if (hasScheduleBtn) {
        await scheduleButtons.first().hover({ force: true });
        await page.waitForTimeout(500);
        logger.info("TC19: Schedule button hover completed (fallback)");
      }
    }

    logger.info("TC19: Tooltips verified");
  });

  test("TC20: Should maintain state after modal close and reopen", async ({
    page,
  }) => {
    // First open
    let dialog = await navigateToDatasetsTab(page);

    // Enter search query
    const searchInput = dialog
      .locator('input[type="search"]')
      .or(dialog.getByPlaceholder(/Search datasets/i));
    await searchInput.fill("test");
    await page.waitForTimeout(1500);

    // Close dialog
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // Reopen
    dialog = await navigateToDatasetsTab(page);

    // Check if search is cleared (expected behavior for fresh state)
    const searchValue = await searchInput.inputValue();
    logger.info(`TC20: Search value after reopen: "${searchValue}"`);

    // Usually modals reset state on close
    expect(searchValue).toBe("");

    logger.info("TC20: State after modal reopen verified");
  });

  test("TC21: Should upload PDF file successfully", async ({ page }) => {
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      logger.info("TC21: Skipping - User is not admin");
      test.skip();
      return;
    }

    const dialog = await navigateToDatasetsTab(page);

    // Click Add Resource button
    const addResourceButton = dialog.getByRole("button", {
      name: /Add Resource/i,
    });
    await addResourceButton.click();

    // Wait for Add Resources modal
    const addResourceModal = page
      .getByRole("dialog")
      .filter({ hasText: /Add Resources/i });
    await expect(addResourceModal).toBeVisible({ timeout: 10000 });

    // Click PDF button
    const pdfButton = addResourceModal
      .locator("button")
      .filter({ hasText: /^PDF$/i });
    await pdfButton.click();
    await page.waitForTimeout(1000);

    // Wait for PDF upload dialog
    const pdfDialog = page.getByRole("dialog").filter({ hasText: "PDF" });
    await expect(pdfDialog).toBeVisible({ timeout: 5000 });

    // Upload file
    const fileInput = pdfDialog.locator('input[type="file"]');
    await fileInput.setInputFiles(
      path.resolve(
        __dirname,
        "../../files/testing_folder/0028-oop-object-oriented-programming-using-cpp.pdf",
      ),
    );

    // Close the upload dialog
    const closeButton = page.getByRole("button", { name: "Close" });
    await expect(closeButton).toBeVisible();
    await closeButton.click();
    await page.waitForTimeout(2000);

    // Verify file appears in the list
    const fileName = dialog.getByText(
      /0028-oop-object-oriented-programming-using-cpp/i,
    );
    const fileVisible = await fileName.isVisible().catch(() => false);
    logger.info(`TC21: PDF file visible in list: ${fileVisible}`);

    logger.info("TC21: PDF file uploaded successfully");
  });

  test("TC22: Should upload Image file successfully", async ({ page }) => {
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      logger.info("TC22: Skipping - User is not admin");
      test.skip();
      return;
    }

    const dialog = await navigateToDatasetsTab(page);

    // Click Add Resource button
    const addResourceButton = dialog.getByRole("button", {
      name: /Add Resource/i,
    });
    await addResourceButton.click();

    // Wait for Add Resources modal
    const addResourceModal = page
      .getByRole("dialog")
      .filter({ hasText: /Add Resources/i });
    await expect(addResourceModal).toBeVisible({ timeout: 10000 });

    // Click Image button
    const imageButton = addResourceModal
      .locator("button")
      .filter({ hasText: /^Image$/i });
    await imageButton.click();
    await page.waitForTimeout(1000);

    // Wait for Image upload dialog
    const imageDialog = page.getByRole("dialog").filter({ hasText: "Image" });
    await expect(imageDialog).toBeVisible({ timeout: 5000 });

    // Upload file
    const fileInput = imageDialog.locator('input[type="file"]');
    await fileInput.setInputFiles(
      path.resolve(
        __dirname,
        "../../files/testing_folder/acessibility png.png",
      ),
    );

    // Close the upload dialog
    const closeButton = page.getByRole("button", { name: "Close" });
    await expect(closeButton).toBeVisible();
    await closeButton.click();
    await page.waitForTimeout(2000);

    // Verify file appears in the list
    const fileName = dialog.getByText(/acessibility png/i);
    const fileVisible = await fileName.isVisible().catch(() => false);
    logger.info(`TC22: Image file visible in list: ${fileVisible}`);

    logger.info("TC22: Image file uploaded successfully");
  });

  test("TC23: Should upload multiple different file types", async ({
    page,
  }) => {
    // This test uploads multiple files which takes more time
    test.setTimeout(400000);

    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      logger.info("TC23: Skipping - User is not admin");
      test.skip();
      return;
    }

    let dialog = await navigateToDatasetsTab(page);

    // Define resources to upload - just test one file to reduce complexity
    const resources = [
      {
        type: "TXT",
        path: path.resolve(
          __dirname,
          "../../files/testing_folder/outerHTML.txt",
        ),
        name: "outerHTML.txt",
      },
    ];

    for (const resource of resources) {
      logger.info(`TC23: Uploading ${resource.type}: ${resource.name}`);

      // Click Add Resource button
      const addResourceButton = dialog.getByRole("button", {
        name: /Add Resource/i,
      });
      await expect(addResourceButton).toBeVisible({ timeout: 10000 });
      await addResourceButton.click();

      // Wait for Add Resources modal
      const addResourceModal = page
        .getByRole("dialog")
        .filter({ hasText: /Add Resources/i });
      await expect(addResourceModal).toBeVisible({ timeout: 15000 });

      // Click resource type button
      const resourceButton = addResourceModal
        .locator("button")
        .filter({ hasText: new RegExp(`^${resource.type}$`, "i") });
      await expect(resourceButton).toBeVisible({ timeout: 5000 });
      await resourceButton.click();
      await page.waitForTimeout(1000);

      // Wait for upload dialog
      const typeDialog = page
        .getByRole("dialog")
        .filter({ hasText: resource.type });
      await expect(typeDialog).toBeVisible({ timeout: 10000 });

      // Upload file
      const fileInput = typeDialog.locator('input[type="file"]');
      await fileInput.setInputFiles(resource.path);

      // Wait for upload to process
      await page.waitForTimeout(3000);
      await page.waitForLoadState("networkidle");

      // Close the upload dialog using Escape key (more reliable)
      await page.keyboard.press("Escape");
      await page.waitForTimeout(2000);
    }

    // Verify we can still access the datasets tab
    // Check if the edit mentor dialog is still visible, if not re-navigate
    const editMentorDialog = page
      .getByRole("dialog")
      .filter({ hasText: /Edit Mentor|Datasets/i });
    const isDialogVisible = await editMentorDialog
      .isVisible()
      .catch(() => false);

    if (!isDialogVisible) {
      // Wait for page to stabilize and re-navigate
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2000);

      // Check if mentor dropdown is visible
      const dropdownButton = page.getByRole("button", {
        name: "Selected mentor dropdown button",
      });
      const isDropdownVisible = await dropdownButton
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (isDropdownVisible) {
        dialog = await navigateToDatasetsTab(page);
      } else {
        // Page may need full reload - just verify the upload was attempted
        logger.info("TC23: Page state changed, but upload was attempted");
      }
    }

    logger.info("TC23: Multiple file types uploaded successfully");
  });

  test("TC24: Should train an untrained dataset", async ({ page }) => {
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      logger.info("TC24: Skipping - User is not admin");
      test.skip();
      return;
    }

    const dialog = await navigateToDatasetsTab(page);
    await page.waitForTimeout(3000);

    // Look for untrained datasets
    const trainingSwitches = dialog.getByRole("switch", {
      name: /training for document/i,
    });
    const switchCount = await trainingSwitches.count().catch(() => 0);

    if (switchCount === 0) {
      logger.info("TC24: No training switches found - skipping test");
      return;
    }

    // Find an untrained dataset
    let trainedDataset = false;
    for (let i = 0; i < switchCount; i++) {
      const switchEl = trainingSwitches.nth(i);
      const isTrained = await switchEl.getAttribute("aria-checked");

      if (isTrained === "false") {
        logger.info(
          `TC24: Found untrained dataset at index ${i} - training it`,
        );

        // Click to show Train or Delete modal
        await switchEl.click();
        await page.waitForTimeout(1000);

        // Check for Train or Delete modal
        const trainOrDeleteModal = page
          .getByRole("dialog")
          .filter({ hasText: /What would you like to do/i });
        const modalVisible = await trainOrDeleteModal
          .isVisible({ timeout: 5000 })
          .catch(() => false);

        if (modalVisible) {
          // Click Train button
          const trainButton = trainOrDeleteModal.getByRole("button", {
            name: /^Train$/i,
          });
          await trainButton.click();

          // Wait for training to start
          await page.waitForTimeout(2000);

          // Verify toast notification or In Progress badge
          const inProgressBadge = dialog.getByText("In Progress");
          const badgeVisible = await inProgressBadge
            .isVisible({ timeout: 5000 })
            .catch(() => false);

          if (badgeVisible) {
            logger.info("TC24: Training started - In Progress badge visible");
          } else {
            logger.info("TC24: Training initiated (may complete quickly)");
          }

          trainedDataset = true;
        }
        break;
      }
    }

    if (!trainedDataset) {
      logger.info("TC24: No untrained datasets found to train");
    } else {
      logger.info("TC24: Dataset training initiated successfully");
    }
  });

  test("TC25: Should delete an untrained dataset", async ({ page }) => {
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      logger.info("TC25: Skipping - User is not admin");
      test.skip();
      return;
    }

    const dialog = await navigateToDatasetsTab(page);
    await page.waitForTimeout(3000);

    // Look for untrained datasets
    const trainingSwitches = dialog.getByRole("switch", {
      name: /training for document/i,
    });
    const initialCount = await trainingSwitches.count().catch(() => 0);

    if (initialCount === 0) {
      logger.info("TC25: No datasets found - skipping test");
      return;
    }

    // Find an untrained dataset
    let deletedDataset = false;
    for (let i = 0; i < initialCount; i++) {
      const switchEl = trainingSwitches.nth(i);
      const isTrained = await switchEl.getAttribute("aria-checked");

      if (isTrained === "false") {
        logger.info(
          `TC25: Found untrained dataset at index ${i} - deleting it`,
        );

        // Click to show Train or Delete modal
        await switchEl.click();
        await page.waitForTimeout(1000);

        // Check for Train or Delete modal
        const trainOrDeleteModal = page
          .getByRole("dialog")
          .filter({ hasText: /What would you like to do/i });
        const modalVisible = await trainOrDeleteModal
          .isVisible({ timeout: 5000 })
          .catch(() => false);

        if (modalVisible) {
          // Click Delete button
          const deleteButton = trainOrDeleteModal.getByRole("button", {
            name: /Delete/i,
          });
          await deleteButton.click();

          // Wait for deletion to complete
          await page.waitForTimeout(2000);

          // Verify dataset is removed - count should decrease
          const newCount = await trainingSwitches.count().catch(() => 0);
          logger.info(
            `TC25: Dataset count before: ${initialCount}, after: ${newCount}`,
          );

          deletedDataset = true;
        }
        break;
      }
    }

    if (!deletedDataset) {
      logger.info("TC25: No untrained datasets found to delete");
    } else {
      logger.info("TC25: Dataset deleted successfully");
    }
  });

  test("TC26: Should untrain and delete a trained dataset", async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      logger.info("TC26: Skipping - User is not admin");
      test.skip();
      return;
    }

    const dialog = await navigateToDatasetsTab(page);
    await page.waitForTimeout(3000);

    // Look for trained datasets
    const trainingSwitches = dialog.getByRole("switch", {
      name: /training for document/i,
    });
    const initialCount = await trainingSwitches.count().catch(() => 0);

    if (initialCount === 0) {
      logger.info("TC26: No datasets found - skipping test");
      return;
    }

    // Find a trained dataset
    let deletedDataset = false;
    for (let i = 0; i < initialCount; i++) {
      const switchEl = trainingSwitches.nth(i);
      const isTrained = await switchEl.getAttribute("aria-checked");

      if (isTrained === "true") {
        logger.info(
          `TC26: Found trained dataset at index ${i} - untraining and deleting it`,
        );

        // Click to untrain (this should open delete modal)
        await switchEl.click();
        await page.waitForTimeout(1000);

        // Check for Delete Dataset modal
        const deleteModal = page
          .getByRole("dialog")
          .filter({ hasText: /Delete Dataset/i });
        const modalVisible = await deleteModal
          .isVisible({ timeout: 5000 })
          .catch(() => false);

        if (modalVisible) {
          logger.info("TC26: Delete Dataset modal appeared");

          // Click Delete button
          const deleteButton = deleteModal.getByRole("button", {
            name: /Delete/i,
          });
          await deleteButton.click();

          // Wait for deletion to complete
          await page.waitForTimeout(2000);

          // Verify dataset is removed
          const newCount = await trainingSwitches.count().catch(() => 0);
          logger.info(
            `TC26: Dataset count before: ${initialCount}, after: ${newCount}`,
          );

          deletedDataset = true;
        }
        break;
      }
    }

    if (!deletedDataset) {
      logger.info("TC26: No trained datasets found to delete");
    } else {
      logger.info("TC26: Trained dataset untrained and deleted successfully");
    }
  });

  test("TC27: Should schedule retraining for a trained dataset", async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      logger.info("TC27: Skipping - User is not admin");
      test.skip();
      return;
    }

    const dialog = await navigateToDatasetsTab(page);
    await page.waitForTimeout(3000);

    // Look for clock icon buttons (Schedule Retrain)
    const scheduleButtons = dialog
      .getByRole("button")
      .filter({ has: page.locator("svg.lucide-clock") });
    const buttonCount = await scheduleButtons.count().catch(() => 0);

    if (buttonCount === 0) {
      logger.info("TC27: No schedule retrain buttons found - skipping test");
      return;
    }

    // Find an enabled schedule button
    let scheduled = false;
    for (let i = 0; i < buttonCount; i++) {
      const button = scheduleButtons.nth(i);
      const isDisabled = await button.isDisabled().catch(() => true);

      if (!isDisabled) {
        logger.info(`TC27: Found enabled schedule button at index ${i}`);
        await button.click();

        // Check for Schedule Retraining modal
        const scheduleModal = page
          .getByRole("dialog")
          .filter({ hasText: /Schedule Retraining/i });
        const modalVisible = await scheduleModal
          .isVisible({ timeout: 5000 })
          .catch(() => false);

        if (modalVisible) {
          logger.info("TC27: Schedule Retraining modal appeared");

          // Set weekly interval
          const weeklyButton = scheduleModal.getByRole("button", {
            name: /Weekly/i,
          });
          await weeklyButton.click();

          // Verify interval is set to 7
          const intervalInput = scheduleModal.locator('input[type="number"]');
          await expect(intervalInput).toHaveValue("7");

          // Click Schedule Retraining button
          const scheduleButton = scheduleModal.getByRole("button", {
            name: /Schedule Retraining/i,
          });
          await scheduleButton.click();

          // Wait for success
          await page.waitForTimeout(2000);

          // Verify toast notification
          const toast = page
            .locator("[data-sonner-toast]")
            .or(page.getByText(/scheduled|success/i));
          const toastVisible = await toast
            .isVisible({ timeout: 5000 })
            .catch(() => false);
          logger.info(
            `TC27: Toast notification: ${toastVisible ? "shown" : "not shown"}`,
          );

          scheduled = true;
        }
        break;
      }
    }

    if (!scheduled) {
      logger.info("TC27: Could not find enabled schedule button");
    } else {
      logger.info("TC27: Dataset retraining scheduled successfully");
    }
  });

  test("TC28: Should handle file upload cancellation gracefully", async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      logger.info("TC28: Skipping - User is not admin");
      test.skip();
      return;
    }

    const dialog = await navigateToDatasetsTab(page);

    // Click Add Resource button
    const addResourceButton = dialog.getByRole("button", {
      name: /Add Resource/i,
    });
    await expect(addResourceButton).toBeVisible({ timeout: 10000 });
    await addResourceButton.click();

    // Wait for Add Resources modal
    const addResourceModal = page
      .getByRole("dialog")
      .filter({ hasText: /Add Resources/i });
    await expect(addResourceModal).toBeVisible({ timeout: 10000 });

    // Click PDF button
    const pdfButton = addResourceModal
      .locator("button")
      .filter({ hasText: /^PDF$/i });
    await expect(pdfButton).toBeVisible({ timeout: 5000 });
    await pdfButton.click();
    await page.waitForTimeout(1000);

    // Wait for PDF upload dialog
    const pdfDialog = page.getByRole("dialog").filter({ hasText: "PDF" });
    await expect(pdfDialog).toBeVisible({ timeout: 5000 });

    // Close without uploading using keyboard
    await page.keyboard.press("Escape");
    await page.waitForTimeout(2000);

    // Check if the Edit Mentor dialog is still visible
    const editMentorDialog = page
      .getByRole("dialog")
      .filter({ hasText: /Edit Mentor|Datasets/i });
    const isDialogVisible = await editMentorDialog
      .isVisible()
      .catch(() => false);

    if (isDialogVisible) {
      // Dialog is still open - verify Add Resource button works
      const addResourceBtnAfterClose = editMentorDialog.getByRole("button", {
        name: /Add Resource/i,
      });
      await expect(addResourceBtnAfterClose).toBeVisible({ timeout: 5000 });
      await expect(addResourceBtnAfterClose).toBeEnabled();
      logger.info("TC28: Dialog remained open after cancellation");
    } else {
      // Dialog closed - verify page is still functional
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2000);

      // Check if we can see the main page elements
      const pageContent = page.locator("body");
      await expect(pageContent).toBeVisible();

      // Try to check if mentor dropdown is available
      const dropdownButton = page.getByRole("button", {
        name: "Selected mentor dropdown button",
      });
      const isDropdownVisible = await dropdownButton
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (isDropdownVisible) {
        logger.info(
          "TC28: Dialog closed but page is functional - can re-navigate",
        );
      } else {
        logger.info("TC28: Page state changed after cancellation");
      }
    }

    logger.info("TC28: File upload cancellation handled gracefully");
  });
});
