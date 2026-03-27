import { Page, Locator, expect } from "@playwright/test";

/**
 * Wait for an element to be attached and visible, with a stability pause.
 */
export async function waitForElementStable(
  page: Page,
  locator: Locator,
  timeout = 10_000,
): Promise<Locator> {
  await locator.waitFor({ state: "attached", timeout });
  await expect(locator).toBeVisible({ timeout });
  await page.waitForTimeout(500);
  return locator;
}

/**
 * Click an element with retry logic, scroll-into-view, and stability wait.
 */
export async function reliableClick(
  page: Page,
  locator: Locator,
  timeout = 10_000,
  maxRetries = 3,
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await waitForElementStable(page, locator, timeout);
      await locator.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await locator.click({ force: true });
      return;
    } catch (error) {
      if (attempt === maxRetries) {
        throw new Error(
          `Failed to click element after ${maxRetries} attempts: ${(error as Error).message}`,
        );
      }
      await page.waitForTimeout(1_000);
    }
  }
}

/**
 * Fill an input with retry logic and value verification.
 */
export async function reliableFill(
  page: Page,
  locator: Locator,
  value: string,
  timeout = 10_000,
  maxRetries = 3,
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await waitForElementStable(page, locator, timeout);
      await locator.clear();
      await locator.fill(value);
      const actual = await locator.inputValue();
      if (actual !== value) {
        throw new Error(`Value mismatch: expected "${value}", got "${actual}"`);
      }
      return;
    } catch (error) {
      if (attempt === maxRetries) {
        throw new Error(
          `Failed to fill element after ${maxRetries} attempts: ${(error as Error).message}`,
        );
      }
      await page.waitForTimeout(1_000);
    }
  }
}

/**
 * Wait for the page document to be fully loaded and allow time for
 * SPA re-renders. More reliable than networkidle for apps with
 * persistent background requests.
 */
export async function waitForPageReady(
  page: Page,
  timeout = 30_000,
): Promise<void> {
  await page.waitForFunction(() => document.readyState === "complete", {
    timeout,
  });
  await page.waitForTimeout(2_000);
}

/**
 * Wait for a dialog to be fully visible and stable.
 */
export async function waitForDialogReady(
  page: Page,
  dialogLocator: Locator,
  timeout = 15_000,
): Promise<Locator> {
  await expect(dialogLocator).toBeVisible({ timeout });
  await page.waitForLoadState("domcontentloaded", { timeout });
  return dialogLocator;
}
