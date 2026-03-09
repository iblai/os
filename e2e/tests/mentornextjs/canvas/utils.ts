import { Page, expect } from '@playwright/test';
import { logger } from '@iblai/iblai-js/playwright';

/**
 * Canvas Test Utilities
 *
 * Helper functions for testing the Canvas component functionality
 */

// Timeout values for various operations
export const CANVAS_TIMEOUTS = {
  AI_RESPONSE: 120000, // 2 minutes for AI to generate content
  CANVAS_LOAD: 60000, // 1 minute for canvas to load
  SAVE_OPERATION: 10000, // 10 seconds for save
  ANIMATION: 2000, // 2 seconds for animations
  SHORT_WAIT: 500, // Half second for UI updates
};

// Document generation prompts for testing
export const TEST_PROMPTS = {
  BUSINESS_REPORT: `Create a comprehensive quarterly business report for a technology startup called "TechVenture Inc". 
Include sections for:
1. Executive Summary
2. Financial Overview with key metrics
3. Product Development Highlights
4. Market Analysis
5. Future Outlook

Use realistic placeholder data for Q3 2024.`,

  API_DOCUMENTATION: `Write comprehensive API documentation for a user authentication REST endpoint with the following:
- Endpoint: POST /api/v1/auth/login
- Request body with email and password
- Response format with access token and refresh token
- Error codes (401, 422, 429)
- Rate limiting information
- Example cURL request`,

  EDUCATIONAL_ARTICLE: `Create an educational article explaining the fundamentals of machine learning for beginners. Include sections on:
1. What is Machine Learning?
2. Types of ML (Supervised, Unsupervised, Reinforcement)
3. Real-world Applications
4. Getting Started resources`,

  SIMPLE_DOCUMENT:
    'Create a short article about climate change with 3 paragraphs.',

  PROJECT_SUMMARY:
    'Create a brief project summary document for a mobile app development project.',
};

// Partial update prompts
export const PARTIAL_UPDATE_PROMPTS = {
  MAKE_TECHNICAL:
    'Make this section more technical with specific data and statistics',
  SIMPLIFY: 'Simplify this section for a general audience',
  EXPAND: 'Expand this section with more details and examples',
  ADD_EXAMPLES: 'Add practical examples to illustrate this point',
};

/**
 * Wait for canvas container to be visible and loaded
 */
export async function waitForCanvasReady(page: Page): Promise<void> {
  // Wait for canvas container to appear
  const canvasContainer = page
    .locator('.bg-white.flex.flex-col.relative.h-full')
    .first();
  await expect(canvasContainer).toBeVisible({
    timeout: CANVAS_TIMEOUTS.CANVAS_LOAD,
  });

  // Wait for loading overlay to disappear
  await page.waitForFunction(
    () => {
      const overlay = document.querySelector(
        '.absolute.inset-0.z-10.pointer-events-none'
      );
      return !overlay || window.getComputedStyle(overlay).display === 'none';
    },
    { timeout: CANVAS_TIMEOUTS.CANVAS_LOAD }
  );

  // Wait for editor content area
  const editorContent = page.locator('[contenteditable="true"]');
  await expect(editorContent).toBeVisible({ timeout: 30000 });

  // Wait a bit more for content to fully render
  await page.waitForTimeout(CANVAS_TIMEOUTS.SHORT_WAIT);
}

/**
 * Enable canvas mode via the toggle button
 */
export async function enableCanvasMode(page: Page): Promise<boolean> {
  const canvasToggle = page.getByRole('button', { name: 'Canvas' });

  // Check if toggle exists and is visible
  const toggleVisible = await canvasToggle.isVisible().catch(() => false);
  if (!toggleVisible) {
    logger.info('Canvas toggle not visible, skipping canvas enable');
    return false;
  }

  // Check if already active
  const isActive = await canvasToggle.evaluate((el) => {
    return (
      el.classList.contains('bg-blue-100') ||
      el.getAttribute('data-state') === 'on' ||
      el.getAttribute('aria-pressed') === 'true'
    );
  });

  if (!isActive) {
    await canvasToggle.click();
    await page.waitForTimeout(CANVAS_TIMEOUTS.SHORT_WAIT);
  }

  return true;
}

/**
 * Disable canvas mode via the toggle button
 */
export async function disableCanvasMode(page: Page): Promise<boolean> {
  const canvasToggle = page.getByRole('button', { name: 'Canvas' });

  const toggleVisible = await canvasToggle.isVisible().catch(() => false);
  if (!toggleVisible) {
    return false;
  }

  // Check if currently active
  const isActive = await canvasToggle.evaluate((el) => {
    return (
      el.classList.contains('bg-blue-100') ||
      el.getAttribute('data-state') === 'on' ||
      el.getAttribute('aria-pressed') === 'true'
    );
  });

  if (isActive) {
    await canvasToggle.click();
    await page.waitForTimeout(CANVAS_TIMEOUTS.SHORT_WAIT);
  }

  return true;
}

/**
 * Send a message and wait for response
 */
export async function sendMessage(
  page: Page,
  message: string,
  waitForCanvas = true
): Promise<void> {
  const textarea = page.getByRole('textbox').first();
  await expect(textarea).toBeVisible({ timeout: 10000 });
  await textarea.fill(message);

  const sendButton = page.getByRole('button', { name: /send/i }).first();
  await expect(sendButton).toBeEnabled({ timeout: 5000 });
  await sendButton.click();

  if (waitForCanvas) {
    await waitForCanvasReady(page);
  } else {
    // Wait for at least one response message
    await page.waitForTimeout(5000);
    await page.waitForLoadState('networkidle', {
      timeout: CANVAS_TIMEOUTS.AI_RESPONSE,
    });
  }
}

/**
 * Get the canvas editor content
 */
export async function getCanvasContent(page: Page): Promise<string> {
  const editorContent = page.locator('[contenteditable="true"]');
  return (await editorContent.textContent()) || '';
}

/**
 * Select text in the canvas editor by coordinates
 */
export async function selectTextInEditor(
  page: Page,
  startOffset: number = 50,
  endOffset: number = 300
): Promise<boolean> {
  const editorContent = page.locator('[contenteditable="true"]');
  const boundingBox = await editorContent.boundingBox();

  if (!boundingBox) {
    logger.info('Could not get editor bounding box');
    return false;
  }

  await page.mouse.move(boundingBox.x + startOffset, boundingBox.y + 30);
  await page.mouse.down();
  await page.mouse.move(boundingBox.x + endOffset, boundingBox.y + 30);
  await page.mouse.up();

  await page.waitForTimeout(CANVAS_TIMEOUTS.SHORT_WAIT);
  return true;
}

/**
 * Check if highlight popup is visible
 */
export async function isHighlightPopupVisible(page: Page): Promise<boolean> {
  const highlightPopup = page.locator('.highlight-popup');
  return await highlightPopup.isVisible().catch(() => false);
}

/**
 * Send a partial update request via the highlight popup
 */
export async function sendPartialUpdateRequest(
  page: Page,
  request: string
): Promise<boolean> {
  const inputField = page.locator('#partial-update-input');
  const inputVisible = await inputField.isVisible().catch(() => false);

  if (!inputVisible) {
    logger.info('Partial update input not visible');
    return false;
  }

  await inputField.fill(request);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(CANVAS_TIMEOUTS.AI_RESPONSE);

  return true;
}

/**
 * Close the canvas panel
 */
export async function closeCanvas(page: Page): Promise<void> {
  const closeButton = page
    .locator('button')
    .filter({ has: page.locator('svg.lucide-x') })
    .first();
  await closeButton.click();
  await page.waitForTimeout(1000);
}

/**
 * Apply text formatting in the canvas editor
 */
export async function applyFormatting(
  page: Page,
  format: 'bold' | 'italic' | 'heading1' | 'heading2' | 'heading3'
): Promise<void> {
  const buttonNames: Record<string, string> = {
    bold: 'Toggle bold',
    italic: 'Toggle italic',
    heading1: 'Toggle heading 1',
    heading2: 'Toggle heading 2',
    heading3: 'Toggle heading 3',
  };

  const button = page.getByRole('button', { name: buttonNames[format] });
  await button.click();
}

/**
 * Navigate to a previous version
 */
export async function navigateToPreviousVersion(page: Page): Promise<boolean> {
  const moreOptionsButton = page.locator('button').filter({
    has: page.locator('svg.lucide-more-vertical'),
  });

  const menuVisible = await moreOptionsButton
    .first()
    .isVisible()
    .catch(() => false);
  if (!menuVisible) {
    return false;
  }

  await moreOptionsButton.first().click();
  await page.waitForTimeout(CANVAS_TIMEOUTS.SHORT_WAIT);

  const prevVersionItem = page.getByRole('menuitem', {
    name: /Previous Version/i,
  });
  const prevEnabled = await prevVersionItem.isVisible().catch(() => false);

  if (!prevEnabled) {
    return false;
  }

  await prevVersionItem.click();
  await page.waitForTimeout(CANVAS_TIMEOUTS.ANIMATION);

  return true;
}

/**
 * Navigate to the next version
 */
export async function navigateToNextVersion(page: Page): Promise<boolean> {
  const moreOptionsButton = page.locator('button').filter({
    has: page.locator('svg.lucide-more-vertical'),
  });

  const menuVisible = await moreOptionsButton
    .first()
    .isVisible()
    .catch(() => false);
  if (!menuVisible) {
    return false;
  }

  await moreOptionsButton.first().click();
  await page.waitForTimeout(CANVAS_TIMEOUTS.SHORT_WAIT);

  const nextVersionItem = page.getByRole('menuitem', {
    name: /Next Version/i,
  });
  const nextEnabled = await nextVersionItem.isVisible().catch(() => false);

  if (!nextEnabled) {
    return false;
  }

  await nextVersionItem.click();
  await page.waitForTimeout(CANVAS_TIMEOUTS.ANIMATION);

  return true;
}

/**
 * Restore the currently viewed version as the current version
 */
export async function restoreCurrentVersion(page: Page): Promise<boolean> {
  const restoreButton = page.getByRole('button', {
    name: /Restore this version/i,
  });
  const visible = await restoreButton.isVisible().catch(() => false);

  if (!visible) {
    return false;
  }

  await restoreButton.click();
  await page.waitForTimeout(CANVAS_TIMEOUTS.ANIMATION);

  return true;
}

/**
 * Go back to the latest version
 */
export async function goToLatestVersion(page: Page): Promise<boolean> {
  const backButton = page.getByRole('button', {
    name: /Back to latest version/i,
  });
  const visible = await backButton.isVisible().catch(() => false);

  if (!visible) {
    return false;
  }

  await backButton.click();
  await page.waitForTimeout(CANVAS_TIMEOUTS.ANIMATION);

  return true;
}

/**
 * Open the export dropdown
 */
export async function openExportDropdown(page: Page): Promise<void> {
  const exportButton = page.getByRole('button', { name: /Export/i });
  await exportButton.click();
}

/**
 * Export document in specified format
 */
export async function exportDocument(
  page: Page,
  format: 'pdf' | 'docx' | 'markdown'
): Promise<string | null> {
  const downloadPromise = page
    .waitForEvent('download', { timeout: 30000 })
    .catch(() => null);

  await openExportDropdown(page);

  const optionNames: Record<string, string> = {
    pdf: 'PDF Document',
    docx: 'Microsoft Word',
    markdown: 'Markdown Document',
  };

  const option = page.getByText(optionNames[format]);
  await option.click();

  const download = await downloadPromise;
  if (download) {
    return download.suggestedFilename();
  }

  return null;
}

/**
 * Open canvas controls panel
 */
export async function openCanvasControls(page: Page): Promise<boolean> {
  const pencilButton = page.locator('button').filter({
    has: page.locator('svg.lucide-pencil'),
  });

  const visible = await pencilButton
    .first()
    .isVisible()
    .catch(() => false);
  if (!visible) {
    return false;
  }

  await pencilButton.first().hover();
  await page.waitForTimeout(CANVAS_TIMEOUTS.SHORT_WAIT);

  return true;
}

/**
 * Use canvas control: Add final polish
 */
export async function addFinalPolish(page: Page): Promise<boolean> {
  const opened = await openCanvasControls(page);
  if (!opened) {
    return false;
  }

  const polishButton = page.locator('button').filter({
    has: page.locator('svg.lucide-sparkles'),
  });

  const visible = await polishButton
    .first()
    .isVisible()
    .catch(() => false);
  if (!visible) {
    return false;
  }

  await polishButton.first().click();
  await page.waitForTimeout(CANVAS_TIMEOUTS.SHORT_WAIT);

  // Click send button
  const sendButton = page.locator('button').filter({
    has: page.locator('svg.lucide-arrow-up'),
  });

  const sendVisible = await sendButton
    .first()
    .isVisible()
    .catch(() => false);
  if (sendVisible) {
    await sendButton.first().click();
    await page.waitForTimeout(CANVAS_TIMEOUTS.AI_RESPONSE);
    return true;
  }

  return false;
}

/**
 * Verify canvas is displaying the version warning banner
 */
export async function isViewingPreviousVersion(page: Page): Promise<boolean> {
  const versionBanner = page.getByText('You are viewing a previous version');
  return await versionBanner.isVisible().catch(() => false);
}

/**
 * Rename the canvas document
 */
export async function renameCanvas(
  page: Page,
  newTitle: string
): Promise<boolean> {
  // Click on the title to open rename modal
  const titleButton = page.locator('button.font-medium.text-gray-900').first();
  const visible = await titleButton.isVisible().catch(() => false);

  if (!visible) {
    return false;
  }

  await titleButton.click();
  await page.waitForTimeout(CANVAS_TIMEOUTS.SHORT_WAIT);

  // Find and fill the input
  const titleInput = page.getByRole('textbox', { name: /canvas title/i });
  const inputVisible = await titleInput.isVisible().catch(() => false);

  if (!inputVisible) {
    return false;
  }

  await titleInput.fill(newTitle);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(CANVAS_TIMEOUTS.SAVE_OPERATION);

  return true;
}
