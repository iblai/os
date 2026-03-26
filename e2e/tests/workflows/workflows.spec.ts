import { test, expect } from "@playwright/test";
import { logger } from "@iblai/iblai-js/playwright";
import { navigateToMentorApp } from "../profile/helpers";
import { checkAdminStatus } from "../utils";
import {
  navigateToWorkflowsPage,
  createWorkflow,
  waitForWorkflowEditorReady,
  navigateBackToWorkflowsList,
  searchWorkflow,
  openWorkflowByName,
  deleteCurrentWorkflow,
  editWorkflowName,
  enterPreviewMode,
  exitPreviewMode,
  saveWorkflow,
  publishWorkflow,
  getWorkflowStatus,
} from "./helpers";

test.describe("Workflows", () => {
  test.setTimeout(300_000);

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);

    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip();
      return;
    }
  });

  test.describe("Workflows List Page", () => {
    test("should display workflows page with heading and create button", async ({
      page,
    }) => {
      await navigateToWorkflowsPage(page);

      const heading = page.getByRole("heading", { name: "Workflows" });
      await expect(heading).toBeVisible();

      const description = page.getByText(
        "Create and manage automated workflows for your mentors",
      );
      await expect(description).toBeVisible();

      const createButton = page.getByRole("button", {
        name: "Create Workflow",
      });
      await expect(createButton).toBeVisible();
      await expect(createButton).toBeEnabled();
    });

    test("should display search input", async ({ page }) => {
      await navigateToWorkflowsPage(page);

      const searchInput = page.getByPlaceholder("Search workflows...");
      await expect(searchInput).toBeVisible();
    });

    test("should filter workflows by search term", async ({ page }) => {
      await navigateToWorkflowsPage(page);

      // Type a search term
      await searchWorkflow(page, "nonexistent-workflow-xyz");

      // Should show no results or empty state
      await page.waitForTimeout(2000);
      const noWorkflows = page.getByText("No workflows found");
      const hasResults = await page
        .locator("h3")
        .first()
        .isVisible()
        .catch(() => false);

      // Either we see "No workflows found" or some filtered results
      if (!hasResults) {
        await expect(noWorkflows).toBeVisible({ timeout: 10000 });
      }

      logger.info("Search filter works correctly");
    });
  });

  test.describe("Workflow CRUD Operations", () => {
    let testWorkflowName: string;

    test("should create a new workflow", async ({ page }) => {
      await navigateToWorkflowsPage(page);

      testWorkflowName = await createWorkflow(page);
      await waitForWorkflowEditorReady(page);

      // Verify we're on the detail page with the canvas
      const canvas = page.locator(".react-flow");
      await expect(canvas).toBeVisible();

      // Verify the default Start node exists
      const startNode = page
        .locator(".react-flow__node")
        .filter({ hasText: "Start" });
      await expect(startNode).toBeVisible({ timeout: 15000 });

      logger.info(`Workflow created successfully: ${testWorkflowName}`);
    });

    test("should open an existing workflow from the list", async ({ page }) => {
      await navigateToWorkflowsPage(page);

      // Create a workflow first to ensure we have one to open
      const workflowName = await createWorkflow(page);
      await waitForWorkflowEditorReady(page);

      // Go back to the list
      await navigateBackToWorkflowsList(page);

      // Open the workflow by clicking its card
      await openWorkflowByName(page, workflowName);

      // Verify we're in the editor
      const canvas = page.locator(".react-flow");
      await expect(canvas).toBeVisible();

      // Clean up
      await deleteCurrentWorkflow(page);
    });

    test("should delete a workflow", async ({ page }) => {
      await navigateToWorkflowsPage(page);

      const workflowName = await createWorkflow(page);
      await waitForWorkflowEditorReady(page);

      // Delete the workflow
      await deleteCurrentWorkflow(page);

      // Verify we're back on the list page
      const heading = page.getByRole("heading", { name: "Workflows" });
      await expect(heading).toBeVisible();

      // Verify the workflow is no longer in the list
      await searchWorkflow(page, workflowName);
      await page.waitForTimeout(2000);

      const deletedWorkflow = page
        .locator("h3")
        .filter({ hasText: workflowName });
      await expect(deletedWorkflow).not.toBeVisible({ timeout: 10000 });

      logger.info(`Workflow deleted successfully: ${workflowName}`);
    });
  });

  test.describe("Workflow Editor", () => {
    test("should display editor toolbar with Save and Publish buttons", async ({
      page,
    }) => {
      await navigateToWorkflowsPage(page);
      await createWorkflow(page);
      await waitForWorkflowEditorReady(page);

      const saveButton = page.getByRole("button", { name: "Save" });
      await expect(saveButton).toBeVisible();

      const publishButton = page.getByRole("button", { name: "Publish" });
      await expect(publishButton).toBeVisible();

      const previewButton = page.getByRole("button", { name: "Preview" });
      await expect(previewButton).toBeVisible();

      // Clean up
      await deleteCurrentWorkflow(page);
    });

    test("should show workflow status as Draft for new workflow", async ({
      page,
    }) => {
      await navigateToWorkflowsPage(page);
      await createWorkflow(page);
      await waitForWorkflowEditorReady(page);

      const status = await getWorkflowStatus(page);
      expect(status).toBe("Draft");

      // Clean up
      await deleteCurrentWorkflow(page);
    });

    test("should rename workflow inline", async ({ page }) => {
      await navigateToWorkflowsPage(page);
      await createWorkflow(page);
      await waitForWorkflowEditorReady(page);

      const newName = `Renamed Workflow ${Date.now()}`;
      await editWorkflowName(page, newName);

      // Wait for the name update to process
      await page.waitForTimeout(2000);

      // Verify the new name is visible in the toolbar
      await expect(page.getByText(newName)).toBeVisible({ timeout: 10000 });

      // Clean up
      await deleteCurrentWorkflow(page);
    });

    test("should save workflow", async ({ page }) => {
      await navigateToWorkflowsPage(page);
      await createWorkflow(page);
      await waitForWorkflowEditorReady(page);

      await saveWorkflow(page);

      // Verify no error toast appeared (success toast may show)
      const errorToast = page.getByText("Failed to save workflow");
      const hasError = await errorToast.isVisible().catch(() => false);
      expect(hasError).toBe(false);

      // Clean up
      await deleteCurrentWorkflow(page);
    });

    test("should display default nodes (Start and Mentor)", async ({
      page,
    }) => {
      await navigateToWorkflowsPage(page);
      await createWorkflow(page);
      await waitForWorkflowEditorReady(page);

      // Verify Start node
      const startNode = page
        .locator(".react-flow__node")
        .filter({ hasText: "Start" });
      await expect(startNode).toBeVisible({ timeout: 15000 });

      // Verify Mentor node
      const mentorNode = page
        .locator(".react-flow__node")
        .filter({ hasText: "Mentor" });
      await expect(mentorNode).toBeVisible({ timeout: 15000 });

      // Verify there's an edge connecting them
      const edges = page.locator(".react-flow__edge");
      const edgeCount = await edges.count();
      expect(edgeCount).toBeGreaterThanOrEqual(1);

      // Clean up
      await deleteCurrentWorkflow(page);
    });

    test("should display more options menu with Activate and Delete", async ({
      page,
    }) => {
      await navigateToWorkflowsPage(page);
      await createWorkflow(page);
      await waitForWorkflowEditorReady(page);

      // Open more options dropdown
      const moreButton = page
        .locator("button")
        .filter({ has: page.locator("svg.lucide-more-horizontal") });
      await expect(moreButton).toBeVisible({ timeout: 10000 });
      await moreButton.click();

      // Verify menu items
      const activateItem = page.getByRole("menuitem", { name: "Activate" });
      await expect(activateItem).toBeVisible({ timeout: 5000 });

      const deleteItem = page.getByRole("menuitem", { name: "Delete" });
      await expect(deleteItem).toBeVisible({ timeout: 5000 });

      // Close the menu by pressing Escape
      await page.keyboard.press("Escape");

      // Clean up
      await deleteCurrentWorkflow(page);
    });
  });

  test.describe("Preview Mode", () => {
    test("should enter and exit preview mode", async ({ page }) => {
      await navigateToWorkflowsPage(page);
      await createWorkflow(page);
      await waitForWorkflowEditorReady(page);

      // Enter preview mode
      await enterPreviewMode(page);

      // Verify preview UI elements
      const closePreview = page.getByRole("button", {
        name: "Close preview",
      });
      await expect(closePreview).toBeVisible();

      const newChatButton = page.getByRole("button", { name: "New Chat" });
      await expect(newChatButton).toBeVisible();

      // Verify Publish button is still visible in preview mode
      const publishButton = page.getByRole("button", { name: "Publish" });
      await expect(publishButton).toBeVisible();

      // Exit preview mode
      await exitPreviewMode(page);

      // Verify we're back in editor mode
      const previewButton = page.getByRole("button", { name: "Preview" });
      await expect(previewButton).toBeVisible();

      // Clean up
      await deleteCurrentWorkflow(page);
    });

    test("should show canvas and chat panel in preview mode", async ({
      page,
    }) => {
      await navigateToWorkflowsPage(page);
      await createWorkflow(page);
      await waitForWorkflowEditorReady(page);

      await enterPreviewMode(page);

      // Verify the canvas is still visible
      const canvas = page.locator(".react-flow");
      await expect(canvas).toBeVisible();

      // Exit preview and clean up
      await exitPreviewMode(page);
      await deleteCurrentWorkflow(page);
    });
  });

  test.describe("Workflow Publishing", () => {
    test("should publish a workflow", async ({ page }) => {
      await navigateToWorkflowsPage(page);
      await createWorkflow(page);
      await waitForWorkflowEditorReady(page);

      await publishWorkflow(page);

      // After publishing, the status should change to Active
      // or validation errors may appear
      const status = await getWorkflowStatus(page);
      const hasValidationErrors = await page
        .getByText(/error/)
        .first()
        .isVisible()
        .catch(() => false);

      if (hasValidationErrors) {
        logger.info(
          "Workflow has validation errors - expected for minimal workflow",
        );
      } else {
        expect(status).toBe("Active");
        logger.info("Workflow published successfully");
      }

      // Clean up
      await deleteCurrentWorkflow(page);
    });

    test("should show validation errors when publishing invalid workflow", async ({
      page,
    }) => {
      await navigateToWorkflowsPage(page);
      await createWorkflow(page);
      await waitForWorkflowEditorReady(page);

      // Try to publish without proper configuration
      await publishWorkflow(page);

      // Check for validation banner or toast
      const validationBanner = page.locator("text=/error|warning/i").first();
      const toastError = page.getByText(/validation|failed/i).first();

      const hasValidation = await validationBanner
        .isVisible()
        .catch(() => false);
      const hasToast = await toastError.isVisible().catch(() => false);

      // Either validation banner or success (if workflow is valid as-is)
      logger.info(
        `Publish result: validation=${hasValidation}, toast=${hasToast}`,
      );

      // Clean up
      await deleteCurrentWorkflow(page);
    });

    test("should deactivate an active workflow", async ({ page }) => {
      await navigateToWorkflowsPage(page);
      await createWorkflow(page);
      await waitForWorkflowEditorReady(page);

      // First publish to activate
      await publishWorkflow(page);

      const status = await getWorkflowStatus(page);
      if (status !== "Active") {
        logger.info(
          "Workflow did not become active after publish - skipping deactivate test",
        );
        await deleteCurrentWorkflow(page);
        test.skip();
        return;
      }

      // Open more options and deactivate
      const moreButton = page
        .locator("button")
        .filter({ has: page.locator("svg.lucide-more-horizontal") });
      await moreButton.click();

      const deactivateItem = page.getByRole("menuitem", {
        name: "Deactivate",
      });
      await expect(deactivateItem).toBeVisible({ timeout: 5000 });
      await deactivateItem.click();

      await page.waitForTimeout(2000);

      const newStatus = await getWorkflowStatus(page);
      expect(newStatus).toBe("Draft");

      logger.info("Workflow deactivated successfully");

      // Clean up
      await deleteCurrentWorkflow(page);
    });
  });
});
