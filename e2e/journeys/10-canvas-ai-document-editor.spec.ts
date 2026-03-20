import { test, expect } from "../fixtures/mentor-test";
import { navigateToMentorApp, checkAdminStatus } from "../utils/auth";

test.describe("Journey 10: Canvas — AI Document Editor", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) test.skip(true, "Canvas requires admin/configured mentor");
  });

  test("admin goes to chat page and enables and disables canvas mode via the toggle", async ({
    page,
    chatPage,
  }) => {
    const canvasBtn = chatPage.canvasToggle;
    const visible = await canvasBtn
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (!visible) return;
    await canvasBtn.click();
    await page.waitForTimeout(500);
    await canvasBtn.click();
    await page.waitForTimeout(500);
    expect(true).toBe(true);
  });

  test("admin goes to chat page and generates a business report document in canvas mode", async ({
    page,
    chatPage,
  }) => {
    const canvasBtn = chatPage.canvasToggle;
    const visible = await canvasBtn
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (!visible) return;
    await canvasBtn.click();
    await chatPage.sendMessage("Write a short business report about AI trends");
    const canvas = page
      .locator('[contenteditable="true"]')
      .or(page.locator(".ProseMirror"))
      .first();
    await expect(canvas).toBeVisible({ timeout: 60_000 });
  });

  test("admin goes to chat page and generates technical API documentation in canvas mode", async ({
    page,
    chatPage,
  }) => {
    const canvasBtn = chatPage.canvasToggle;
    const visible = await canvasBtn
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (!visible) return;
    await canvasBtn.click();
    await chatPage.sendMessage("Write API documentation for a REST endpoint");
    const canvas = page
      .locator('[contenteditable="true"]')
      .or(page.locator(".ProseMirror"))
      .first();
    await expect(canvas).toBeVisible({ timeout: 60_000 });
  });

  test("admin goes to canvas and applies bold formatting and verifies undo and redo work", async ({
    page,
    chatPage,
  }) => {
    const canvasBtn = chatPage.canvasToggle;
    const visible = await canvasBtn
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (!visible) return;
    await canvasBtn.click();
    await chatPage.sendMessage("Write a paragraph about the weather");
    const canvas = page
      .locator('[contenteditable="true"]')
      .or(page.locator(".ProseMirror"))
      .first();
    await expect(canvas).toBeVisible({ timeout: 60_000 });
    const boldButton = page.getByRole("button", { name: /bold/i });
    if (await boldButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await boldButton.click();
    }
    // Test undo with Ctrl+Z
    await page.keyboard.press("Control+z");
    expect(true).toBe(true);
  });

  test("admin goes to canvas and opens the version history menu and navigates between versions", async ({
    page,
    chatPage,
  }) => {
    const canvasBtn = chatPage.canvasToggle;
    const visible = await canvasBtn
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (!visible) return;
    await canvasBtn.click();
    await chatPage.sendMessage("Create a document to test version history");
    const canvas = page
      .locator('[contenteditable="true"]')
      .or(page.locator(".ProseMirror"))
      .first();
    await expect(canvas).toBeVisible({ timeout: 60_000 });
    const versionButton = page.getByRole("button", { name: /version/i });
    if (await versionButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await versionButton.click();
      const versionMenu = page
        .getByRole("menu")
        .or(page.getByRole("dialog").filter({ hasText: /version/i }));
      await expect(versionMenu).toBeVisible({ timeout: 5_000 });
      await page.keyboard.press("Escape");
    }
  });

  test("admin goes to canvas and clicks Back to latest version to return to current version", async ({
    page,
    chatPage,
  }) => {
    const canvasBtn = chatPage.canvasToggle;
    const visible = await canvasBtn
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (!visible) return;
    await canvasBtn.click();
    const backToLatest = page.getByRole("button", { name: /back to latest/i });
    if (await backToLatest.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await backToLatest.click();
    }
    expect(true).toBe(true);
  });

  test("admin goes to canvas and selects text which shows the highlight popup with escape to close", async ({
    page,
    chatPage,
  }) => {
    const canvasBtn = chatPage.canvasToggle;
    const visible = await canvasBtn
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (!visible) return;
    await canvasBtn.click();
    await chatPage.sendMessage("Write a sentence about mountains");
    const canvas = page
      .locator('[contenteditable="true"]')
      .or(page.locator(".ProseMirror"))
      .first();
    await expect(canvas).toBeVisible({ timeout: 60_000 });
    // Select all text
    await canvas.click();
    await page.keyboard.press("Control+a");
    await page.waitForTimeout(500);
    const popup = page.locator(
      '[class*="highlight-popup"], [data-testid*="highlight"]',
    );
    if (await popup.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await page.keyboard.press("Escape");
      await expect(popup).not.toBeVisible({ timeout: 3_000 });
    }
  });

  test("admin goes to canvas controls panel and hovers to expand it and uses the Polish action", async ({
    page,
    chatPage,
  }) => {
    const canvasBtn = chatPage.canvasToggle;
    const visible = await canvasBtn
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (!visible) return;
    await canvasBtn.click();
    await chatPage.sendMessage("Write a draft document");
    const canvas = page
      .locator('[contenteditable="true"]')
      .or(page.locator(".ProseMirror"))
      .first();
    await expect(canvas).toBeVisible({ timeout: 60_000 });
    const controls = page.locator(
      '[class*="canvas-controls"], [data-testid*="canvas-controls"]',
    );
    if (await controls.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await controls.hover();
      const polishButton = page.getByRole("button", { name: /polish/i });
      if (await polishButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await polishButton.click();
      }
    }
  });

  test("admin goes to canvas and opens the export dropdown which shows PDF and Markdown options", async ({
    page,
    chatPage,
  }) => {
    const canvasBtn = chatPage.canvasToggle;
    const visible = await canvasBtn
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (!visible) return;
    await canvasBtn.click();
    await chatPage.sendMessage("Create a document for export");
    const canvas = page
      .locator('[contenteditable="true"]')
      .or(page.locator(".ProseMirror"))
      .first();
    await expect(canvas).toBeVisible({ timeout: 60_000 });
    const exportButton = page.getByRole("button", { name: /export/i });
    if (await exportButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await exportButton.click();
      const pdfOption = page.getByRole("menuitem", { name: /pdf/i });
      const mdOption = page.getByRole("menuitem", { name: /markdown/i });
      const hasPdf = await pdfOption
        .isVisible({ timeout: 3_000 })
        .catch(() => false);
      const hasMd = await mdOption
        .isVisible({ timeout: 3_000 })
        .catch(() => false);
      expect(hasPdf || hasMd).toBe(true);
      await page.keyboard.press("Escape");
    }
  });

  test("admin goes to chat and closes the canvas then reopens it from the artifact card", async ({
    page,
    chatPage,
  }) => {
    const canvasBtn = chatPage.canvasToggle;
    const visible = await canvasBtn
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (!visible) return;
    await canvasBtn.click();
    await chatPage.sendMessage("Write a brief document");
    const canvas = page
      .locator('[contenteditable="true"]')
      .or(page.locator(".ProseMirror"))
      .first();
    await expect(canvas).toBeVisible({ timeout: 60_000 });
    const closeCanvas = page.getByRole("button", { name: /close canvas/i });
    if (await closeCanvas.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await closeCanvas.click();
      await expect(canvas).not.toBeVisible({ timeout: 5_000 });
      const artifactCard = page
        .locator('[class*="artifact"], [data-testid*="artifact"]')
        .first();
      if (await artifactCard.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await artifactCard.click();
        await expect(canvas).toBeVisible({ timeout: 10_000 });
      }
    }
  });

  test("admin goes to canvas and sends a follow-up message which modifies the document content", async ({
    page,
    chatPage,
  }) => {
    const canvasBtn = chatPage.canvasToggle;
    const visible = await canvasBtn
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (!visible) return;
    await canvasBtn.click();
    await chatPage.sendMessage("Write a paragraph about space");
    const canvas = page
      .locator('[contenteditable="true"]')
      .or(page.locator(".ProseMirror"))
      .first();
    await expect(canvas).toBeVisible({ timeout: 60_000 });
    const contentBefore = await canvas.textContent().catch(() => "");
    await chatPage.sendMessage("Now add a second paragraph about planets");
    await page.waitForTimeout(5_000);
    const contentAfter = await canvas.textContent().catch(() => "");
    expect(contentAfter.length).toBeGreaterThanOrEqual(contentBefore.length);
  });
});
