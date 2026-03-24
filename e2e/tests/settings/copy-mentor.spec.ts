import { test, expect } from "@playwright/test";
import { logger } from "@iblai/iblai-js/playwright";
import { navigateToMentorApp, openSettingsTab } from "./helpers";

test.describe("Settings Tab - Copy Mentor", () => {
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  test.describe("Copy Button", () => {
    test("should display Copy button in settings tab", async ({ page }) => {
      const editMentorDialog = await openSettingsTab(page);

      const copyButton = editMentorDialog.getByRole("button", {
        name: "Copy",
        exact: true,
      });
      await expect(copyButton).toBeVisible({ timeout: 10000 });
      await expect(copyButton).toBeEnabled();

      logger.info("Copy button is visible and enabled");
    });

    test("should open copy mentor modal when Copy button is clicked", async ({
      page,
    }) => {
      const editMentorDialog = await openSettingsTab(page);

      const copyButton = editMentorDialog.getByRole("button", {
        name: "Copy",
        exact: true,
      });
      await expect(copyButton).toBeVisible({ timeout: 10000 });
      await copyButton.click();

      const copyDialog = page.getByRole("dialog", { name: /Copy Mentor/i });
      await expect(copyDialog).toBeVisible({ timeout: 10000 });

      logger.info("Copy mentor modal opened successfully");
    });
  });

  test.describe("Copy Mentor Modal", () => {
    test("should display modal title and description", async ({ page }) => {
      const editMentorDialog = await openSettingsTab(page);

      const copyButton = editMentorDialog.getByRole("button", {
        name: "Copy",
        exact: true,
      });
      await copyButton.click();

      const copyDialog = page.getByRole("dialog", { name: /Copy Mentor/i });
      await expect(copyDialog).toBeVisible({ timeout: 10000 });

      await expect(copyDialog.getByText("Copy Mentor")).toBeVisible();
      await expect(
        copyDialog.getByText(/Create a copy of this mentor/),
      ).toBeVisible();

      logger.info("Modal title and description are visible");
    });

    test("should display Include training data toggle", async ({ page }) => {
      const editMentorDialog = await openSettingsTab(page);

      const copyButton = editMentorDialog.getByRole("button", {
        name: "Copy",
        exact: true,
      });
      await copyButton.click();

      const copyDialog = page.getByRole("dialog", { name: /Copy Mentor/i });
      await expect(copyDialog).toBeVisible({ timeout: 10000 });

      await expect(copyDialog.getByText("Include training data")).toBeVisible();

      logger.info("Training data toggle is visible");
    });

    test("should display Cancel and Copy buttons", async ({ page }) => {
      const editMentorDialog = await openSettingsTab(page);

      const copyButton = editMentorDialog.getByRole("button", {
        name: "Copy",
        exact: true,
      });
      await copyButton.click();

      const copyDialog = page.getByRole("dialog", { name: /Copy Mentor/i });
      await expect(copyDialog).toBeVisible({ timeout: 10000 });

      const cancelButton = copyDialog.getByRole("button", { name: "Cancel" });
      const confirmCopyButton = copyDialog.getByRole("button", {
        name: "Copy",
        exact: true,
      });

      await expect(cancelButton).toBeVisible();
      await expect(confirmCopyButton).toBeVisible();

      logger.info("Cancel and Copy buttons are visible");
    });

    test("should close modal when Cancel is clicked", async ({ page }) => {
      const editMentorDialog = await openSettingsTab(page);

      const copyButton = editMentorDialog.getByRole("button", {
        name: "Copy",
        exact: true,
      });
      await copyButton.click();

      const copyDialog = page.getByRole("dialog", { name: /Copy Mentor/i });
      await expect(copyDialog).toBeVisible({ timeout: 10000 });

      const cancelButton = copyDialog.getByRole("button", { name: "Cancel" });
      await cancelButton.click();

      await expect(copyDialog).not.toBeVisible({ timeout: 5000 });

      logger.info("Modal closed via Cancel button");
    });

    test("should close modal when pressing Escape", async ({ page }) => {
      const editMentorDialog = await openSettingsTab(page);

      const copyButton = editMentorDialog.getByRole("button", {
        name: "Copy",
        exact: true,
      });
      await copyButton.click();

      const copyDialog = page.getByRole("dialog", { name: /Copy Mentor/i });
      await expect(copyDialog).toBeVisible({ timeout: 10000 });

      await page.keyboard.press("Escape");

      await expect(copyDialog).not.toBeVisible({ timeout: 5000 });

      logger.info("Modal closed via Escape key");
    });
  });
});
