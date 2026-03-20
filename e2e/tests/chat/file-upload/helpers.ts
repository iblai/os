import { expect, Page } from "@playwright/test";
import path from "path";

/**
 * Resolve a fixture file path from the shared testing_folder.
 */
export function testFile(name: string): string {
  return path.resolve(__dirname, "../../../files/testing_folder", name);
}

// ── Accepted files ──────────────────────────────────────────────────
export const ACCEPTED_IMAGE = testFile("acessibility png.png");
export const ACCEPTED_PDF = testFile(
  "0028-oop-object-oriented-programming-using-cpp.pdf",
);
export const ACCEPTED_TXT = testFile("outerHTML.txt");
export const ACCEPTED_DOCX = testFile("audrey.docx");

// ── Rejected files ──────────────────────────────────────────────────
export const REJECTED_JSON = testFile("test-data.json");
export const REJECTED_PPTM = testFile("ppt1FC3.pptm");

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Returns the chat container element that holds the drag-and-drop handlers.
 * The selector targets the main content wrapper rendered by the Chat component.
 */
export const CHAT_CONTAINER_SELECTOR = "main div.relative.flex.h-full.flex-col";

/**
 * Dispatch a native DragEvent on the chat container.
 * Playwright's `dispatchEvent` doesn't support setting `dataTransfer.files`
 * directly, so we fall back to `page.evaluate`.
 */
export async function dispatchDragEvent(
  page: Page,
  eventType: "dragover" | "dragleave" | "drop",
  files?: { name: string; type: string; content?: string }[],
) {
  await page.evaluate(
    ({ selector, eventType, files }) => {
      const container = document.querySelector(selector);
      if (!container) throw new Error("Chat container not found");

      const dt = new DataTransfer();
      if (files) {
        for (const f of files) {
          dt.items.add(new File([f.content ?? ""], f.name, { type: f.type }));
        }
      }

      const event = new DragEvent(eventType, {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
        ...(eventType === "dragleave" ? { relatedTarget: null } : {}),
      });

      container.dispatchEvent(event);
    },
    { selector: CHAT_CONTAINER_SELECTOR, eventType, files },
  );
}

/**
 * Trigger a drag-over so the overlay appears, then drop the given files.
 */
export async function dragAndDropFiles(
  page: Page,
  files: { name: string; type: string; content?: string }[],
) {
  // 1. dragover to show the overlay
  await dispatchDragEvent(page, "dragover", files);
  await expect(page.getByText("Drop your files here")).toBeVisible({
    timeout: 5000,
  });

  // 2. drop
  await dispatchDragEvent(page, "drop", files);
}

/**
 * Upload a file via the "Attach File" → "Upload File" menu button.
 */
export async function uploadFileViaButton(page: Page, filePath: string) {
  // Open the upload menu and click "Upload File" to ensure the input is ready
  const attachButton = page.getByRole("button", { name: "Attach File" });
  await expect(attachButton).toBeVisible({ timeout: 10000 });
  await attachButton.click();

  const uploadMenuItem = page.getByRole("menuitem", {
    name: "Upload File",
  });
  await expect(uploadMenuItem).toBeVisible({ timeout: 5000 });

  // Use Promise.all to handle the fileChooser event
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    uploadMenuItem.click(),
  ]);
  await fileChooser.setFiles(filePath);
}
