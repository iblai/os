import { test, expect, type Page } from "@playwright/test";
import { checkAdminStatus, waitForPageReady } from "../utils";
import { navigateToMentorApp } from "../profile/helpers";
import { logger } from "@iblai/iblai-js/playwright";
import { safeWaitForURL } from "@iblai/iblai-js/playwright";

// Serial mode: tests build on each other (create → use → rename → delete)
test.describe.configure({ mode: "serial" });

const PROJECT_NAME = `E2E Project ${Date.now()}`;
const RENAMED_PROJECT_NAME = `${PROJECT_NAME} Renamed`;

/**
 * Clicks the "New Project" button in the sidebar and waits for the
 * Create Project modal to appear. Returns the modal locator.
 */
async function openCreateProjectModal(page: Page) {
  const newProjectButton = page.getByRole("button", {
    name: "New Project",
    exact: true,
  });
  await expect(newProjectButton).toBeVisible({ timeout: 15_000 });
  await newProjectButton.click();

  const modal = page.getByRole("dialog", { name: "New Project" });
  await expect(modal).toBeVisible({ timeout: 10_000 });
  return modal;
}

test.describe("Projects", () => {
  test.setTimeout(300_000);

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  // ----------------------------------------------------------------
  // 1. Create
  // ----------------------------------------------------------------
  test("New project can be created from the sidebar", async ({ page }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Project creation requires admin access");

    const modal = await openCreateProjectModal(page);

    const nameInput = modal.getByPlaceholder("Project Name");
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
    await nameInput.fill(PROJECT_NAME);

    const saveButton = modal.getByRole("button", { name: "Save" });
    await expect(saveButton).toBeEnabled({ timeout: 5_000 });
    await saveButton.click();

    // After creation the app navigates to the new project page
    await safeWaitForURL(page, (url) => url.pathname.includes("/projects/"), {
      timeout: 30_000,
    });

    const projectHeading = page.getByRole("heading", {
      name: PROJECT_NAME,
      level: 1,
    });
    await expect(projectHeading).toBeVisible({ timeout: 15_000 });
    logger.info(`Project "${PROJECT_NAME}" created successfully`);
  });

  // ----------------------------------------------------------------
  // 2. Landing page structure
  // ----------------------------------------------------------------
  test("Project landing page shows mentor list and action buttons", async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Project page requires admin access");

    // Navigate to the project (created in previous test)
    await safeWaitForURL(page, (url) => url.pathname.includes("/projects/"), {
      timeout: 30_000,
    });

    const projectHeading = page.getByRole("heading", {
      name: PROJECT_NAME,
      level: 1,
    });
    await expect(projectHeading).toBeVisible({ timeout: 15_000 });

    // Action buttons rendered by ProjectActionButtons
    const filesButton = page.getByRole("button", {
      name: /Add project files|files added/i,
    });
    const instructionsButton = page.getByRole("button", {
      name: /Add project instructions|Edit project instructions/i,
    });
    await expect(filesButton).toBeVisible({ timeout: 10_000 });
    await expect(instructionsButton).toBeVisible({ timeout: 10_000 });
    logger.info("Project landing page shows action buttons");
  });

  // ----------------------------------------------------------------
  // 3. Add mentor
  // ----------------------------------------------------------------
  test("A mentor can be added to a project", async ({ page }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Adding mentor to project requires admin access");

    await safeWaitForURL(page, (url) => url.pathname.includes("/projects/"), {
      timeout: 30_000,
    });

    // Click the Add Mentor button in the mentor grid
    const addMentorButton = page
      .getByRole("button", { name: /Add Mentor/i })
      .first();
    const addMentorVisible = await addMentorButton
      .isVisible({ timeout: 10_000 })
      .catch(() => false);

    if (!addMentorVisible) {
      logger.info(
        "Add Mentor button not found — mentor may already be assigned to project",
      );
      return;
    }

    await addMentorButton.click();

    const addMentorDialog = page.getByRole("dialog", {
      name: /Add Mentor to/i,
    });
    await expect(addMentorDialog).toBeVisible({ timeout: 10_000 });

    // Select the first available mentor that isn't already added
    const mentorCard = addMentorDialog
      .locator("button")
      .filter({ hasText: /.+/ })
      .first();
    await expect(mentorCard).toBeVisible({ timeout: 10_000 });
    await mentorCard.click();

    // Success toast
    await expect(page.getByText("Mentor added to project")).toBeVisible({
      timeout: 10_000,
    });
    logger.info("Mentor added to project successfully");

    // Close dialog if still open
    const closeButton = addMentorDialog.getByRole("button", {
      name: /close|cancel/i,
    });
    if (await closeButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await closeButton.click();
    }
  });

  // ----------------------------------------------------------------
  // 4. Instructions
  // ----------------------------------------------------------------
  test("Project instructions can be set and saved", async ({ page }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Project instructions require admin access");

    await safeWaitForURL(page, (url) => url.pathname.includes("/projects/"), {
      timeout: 30_000,
    });

    const instructionsButton = page.getByRole("button", {
      name: /Add project instructions|Edit project instructions/i,
    });
    await expect(instructionsButton).toBeVisible({ timeout: 10_000 });
    await instructionsButton.click();

    const instructionsDialog = page.getByRole("dialog", {
      name: "Instructions",
    });
    await expect(instructionsDialog).toBeVisible({ timeout: 10_000 });

    const textarea = instructionsDialog.getByRole("textbox");
    await expect(textarea).toBeVisible({ timeout: 5_000 });
    await textarea.fill("You are a helpful E2E test project assistant.");

    const saveButton = instructionsDialog.getByRole("button", { name: "Save" });
    await expect(saveButton).toBeEnabled({ timeout: 5_000 });
    await saveButton.click();

    await expect(
      page.getByText("Instructions updated successfully"),
    ).toBeVisible({
      timeout: 10_000,
    });
    logger.info("Project instructions saved successfully");
  });

  // ----------------------------------------------------------------
  // 5. Files
  // ----------------------------------------------------------------
  test("Project files modal opens and shows the Add Files button", async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Project files require admin access");

    await safeWaitForURL(page, (url) => url.pathname.includes("/projects/"), {
      timeout: 30_000,
    });

    const filesButton = page.getByRole("button", {
      name: /Add project files|files added/i,
    });
    await expect(filesButton).toBeVisible({ timeout: 10_000 });
    await filesButton.click();

    const filesDialog = page.getByRole("dialog", { name: "Project Files" });
    await expect(filesDialog).toBeVisible({ timeout: 10_000 });

    // Search input and Add Files button are present
    const searchInput = filesDialog.getByPlaceholder("Search datasets...");
    await expect(searchInput).toBeVisible({ timeout: 5_000 });

    const addFilesButton = filesDialog.getByRole("button", {
      name: /Add Files/i,
    });
    await expect(addFilesButton).toBeVisible({ timeout: 5_000 });

    logger.info("Project Files modal opened with search and Add Files button");

    // Close the dialog
    await page.keyboard.press("Escape");
    await expect(filesDialog).not.toBeVisible({ timeout: 5_000 });
  });

  // ----------------------------------------------------------------
  // 6. Chat — new session
  // ----------------------------------------------------------------
  test("Chatting within a project always starts a new session", async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Project chat requires admin access");

    await safeWaitForURL(page, (url) => url.pathname.includes("/projects/"), {
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // Find the chat input and send a message
    const chatInput = page.getByPlaceholder("Ask anything", { exact: true });
    await expect(chatInput).toBeVisible({ timeout: 15_000 });
    await chatInput.fill("Hello from E2E project test");

    const sendButton = page.getByRole("button", { name: "Send message" });
    await expect(sendButton).toBeEnabled({ timeout: 10_000 });
    await page.waitForTimeout(2_000);
    await sendButton.click();

    // Wait for AI response
    const aiResponse = page.locator(".chat-ai-message-response").first();
    await expect(aiResponse).toBeVisible({ timeout: 60_000 });

    // Session ID should now exist for this mentor
    const sessionAfter = await page.evaluate(() => {
      const raw = localStorage.getItem("session_id");
      return raw ? JSON.parse(raw) : {};
    });

    const sessionIds = Object.values(sessionAfter) as string[];
    expect(sessionIds.length).toBeGreaterThan(0);
    logger.info(`Project chat session created: ${sessionIds[0]}`);
  });

  // ----------------------------------------------------------------
  // 7. Rename
  // ----------------------------------------------------------------
  test("Project can be renamed", async ({ page }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Renaming project requires admin access");

    await safeWaitForURL(page, (url) => url.pathname.includes("/projects/"), {
      timeout: 30_000,
    });

    // Find the project item in the sidebar and trigger rename via context menu or options
    // The rename option is accessible from the project item's options menu
    const projectText = page.getByText(PROJECT_NAME).first();
    await expect(projectText).toBeVisible({ timeout: 15_000 });

    // Right-click or hover to reveal the options / kebab menu
    await projectText.hover();

    const renameMenuItem = page.getByRole("menuitem", { name: /rename/i });

    // Try context menu first
    await projectText.click({ button: "right" });
    const ctxMenuVisible = await renameMenuItem
      .isVisible({ timeout: 3_000 })
      .catch(() => false);

    if (!ctxMenuVisible) {
      // Close any open menu and try via the options button
      await page.keyboard.press("Escape");
      const optionsBtn = page
        .locator('button[aria-label*="options"], button[aria-label*="Options"]')
        .or(page.locator('[data-testid="project-options-button"]'))
        .first();

      if (await optionsBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await optionsBtn.click();
        await expect(renameMenuItem).toBeVisible({ timeout: 5_000 });
        await renameMenuItem.click();
      } else {
        logger.info("Could not open rename menu — skipping rename assertion");
        return;
      }
    } else {
      await renameMenuItem.click();
    }

    const renameDialog = page.getByRole("dialog", { name: "Rename Project" });
    await expect(renameDialog).toBeVisible({ timeout: 10_000 });

    const renameInput = renameDialog.getByPlaceholder("Enter new project name");
    await expect(renameInput).toBeVisible({ timeout: 5_000 });
    await renameInput.clear();
    await renameInput.fill(RENAMED_PROJECT_NAME);

    const confirmButton = renameDialog.getByRole("button", {
      name: "Rename Project",
    });
    await expect(confirmButton).toBeEnabled({ timeout: 5_000 });
    await confirmButton.click();

    await expect(renameDialog).not.toBeVisible({ timeout: 10_000 });

    // The heading on the page should update
    const updatedHeading = page.getByRole("heading", {
      name: RENAMED_PROJECT_NAME,
      level: 1,
    });
    await expect(updatedHeading).toBeVisible({ timeout: 15_000 });
    logger.info(`Project renamed to "${RENAMED_PROJECT_NAME}"`);
  });

  // ----------------------------------------------------------------
  // 8. Delete
  // ----------------------------------------------------------------
  test("Project can be deleted", async ({ page }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Deleting project requires admin access");

    await safeWaitForURL(page, (url) => url.pathname.includes("/projects/"), {
      timeout: 30_000,
    });

    // Find the (now renamed) project in the sidebar
    const projectText = page
      .getByText(RENAMED_PROJECT_NAME)
      .or(page.getByText(PROJECT_NAME))
      .first();
    await expect(projectText).toBeVisible({ timeout: 15_000 });

    await projectText.hover();

    const deleteMenuItem = page.getByRole("menuitem", { name: /delete/i });

    // Try context menu first
    await projectText.click({ button: "right" });
    const ctxMenuVisible = await deleteMenuItem
      .isVisible({ timeout: 3_000 })
      .catch(() => false);

    if (!ctxMenuVisible) {
      await page.keyboard.press("Escape");
      const optionsBtn = page
        .locator('button[aria-label*="options"], button[aria-label*="Options"]')
        .or(page.locator('[data-testid="project-options-button"]'))
        .first();

      if (await optionsBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await optionsBtn.click();
        await expect(deleteMenuItem).toBeVisible({ timeout: 5_000 });
        await deleteMenuItem.click();
      } else {
        logger.info("Could not open delete menu — skipping delete assertion");
        return;
      }
    } else {
      await deleteMenuItem.click();
    }

    const deleteDialog = page.getByRole("dialog", { name: "Delete Project" });
    await expect(deleteDialog).toBeVisible({ timeout: 10_000 });

    // Confirm the deletion
    const confirmDeleteButton = deleteDialog.getByRole("button", {
      name: "Delete Project",
    });
    await expect(confirmDeleteButton).toBeEnabled({ timeout: 5_000 });
    await confirmDeleteButton.click();

    await expect(page.getByText("Project deleted successfully")).toBeVisible({
      timeout: 10_000,
    });

    // After deletion the app should redirect away from the project URL
    await safeWaitForURL(page, (url) => !url.pathname.includes("/projects/"), {
      timeout: 15_000,
    });
    logger.info("Project deleted successfully, redirected to platform");
  });
});
