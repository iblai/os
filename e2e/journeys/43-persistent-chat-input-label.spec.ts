/**
 * Journey 43: Persistent Chat Input Label (WCAG 3.3.2 — LEARN-41466)
 *
 * The `persistent_chat_input_label` tenant-metadata flag controls whether the
 * "Ask anything" label above the chat textarea is visually visible or
 * screen-reader-only.
 *
 * Flag OFF (default):
 *   - <label id="chat-input-label"> has class `sr-only` (visually hidden)
 *   - Textarea placeholder is "Ask anything"
 *   - Accessible name still resolves to "Ask anything" via aria-labelledby
 *
 * Flag ON:
 *   - <label id="chat-input-label"> has classes `block px-[18.5px] pt-3 …`
 *     (visually visible above the textarea)
 *   - Textarea placeholder is "" (empty string — label is already visible)
 *   - Aria wiring unchanged; accessible name still resolves to "Ask anything"
 *
 * Both tests restore the flag to `false` in afterEach so subsequent runs
 * are not contaminated.
 *
 * Prerequisite: DM_URL env var must be set. If absent the tests are skipped.
 */

import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, getPlatformContext } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import {
  setTenantMetadataFlag,
  getTenantMetadata,
} from '../utils/tenant-metadata';
import { DM_URL } from '../fixtures/test-data';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Locator for the visible/sr-only label element. */
function chatInputLabel(page: import('@playwright/test').Page) {
  return page.locator('#chat-input-label');
}

/** Locator for the textarea (always accessible as "Ask anything" via aria-labelledby). */
function chatTextarea(page: import('@playwright/test').Page) {
  return page.getByRole('textbox', { name: 'Ask anything', exact: true });
}

// ---------------------------------------------------------------------------
// Journey 43: Flag OFF (default behaviour)
// ---------------------------------------------------------------------------

test.describe('Journey 43: Persistent Chat Input Label — flag OFF (default)', () => {
  let tenantKey = '';
  let originalFlagValue: boolean | undefined;

  test.beforeEach(async ({ page }) => {
    test.skip(!DM_URL, 'DM_URL env var is required for tenant metadata tests');

    await navigateToMentorApp(page);
    const ctx = await getPlatformContext(page);
    tenantKey = ctx.tenantKey;

    // Snapshot the flag's original value so afterEach can restore it exactly.
    const meta = await getTenantMetadata(page, tenantKey);
    originalFlagValue =
      meta.persistent_chat_input_label === true ? true : false;

    // Ensure the flag is OFF for this test suite.
    await setTenantMetadataFlag(
      page,
      tenantKey,
      'persistent_chat_input_label',
      false,
    );

    // Reload so the React app picks up the updated metadata.
    await navigateToMentorApp(page);
    await waitForPageReady(page);
  });

  test.afterEach(async ({ page }) => {
    if (!DM_URL || !tenantKey) return;
    // Restore original flag state.
    await setTenantMetadataFlag(
      page,
      tenantKey,
      'persistent_chat_input_label',
      originalFlagValue ?? false,
    );
  });

  test('user goes to chat page and the label is sr-only when persistent_chat_input_label is false', async ({
    page,
  }) => {
    const label = chatInputLabel(page);

    // Label must exist in the DOM for aria-labelledby to resolve.
    await expect(label).toBeAttached({ timeout: 15_000 });

    // With flag OFF the label carries the sr-only class (screen-reader only).
    await expect(label).toHaveClass(/sr-only/, { timeout: 5_000 });

    // It must NOT have the visible-label classes.
    const className = await label.getAttribute('class');
    expect(className).not.toMatch(/\bblock\b/);

    // Label text is always "Ask anything" regardless of flag state.
    await expect(label).toHaveText('Ask anything');
  });

  test('user goes to chat page and the textarea placeholder is "Ask anything" when persistent_chat_input_label is false', async ({
    page,
  }) => {
    const textarea = chatTextarea(page);
    await expect(textarea).toBeVisible({ timeout: 15_000 });

    // With flag OFF the placeholder carries the full prompt text.
    await expect(textarea).toHaveAttribute('placeholder', 'Ask anything');
  });

  test('user goes to chat page and aria-labelledby wires the textarea to the label when flag is false', async ({
    page,
  }) => {
    const textarea = chatTextarea(page);
    await expect(textarea).toBeVisible({ timeout: 15_000 });

    // Textarea must reference the label via aria-labelledby.
    await expect(textarea).toHaveAttribute(
      'aria-labelledby',
      'chat-input-label',
    );

    // The label element must exist in the DOM.
    const label = chatInputLabel(page);
    await expect(label).toBeAttached();
    await expect(label).toHaveText('Ask anything');
  });

  test('user goes to chat page and sends a message when persistent_chat_input_label is false', async ({
    page,
    chatPage,
  }) => {
    await expect(chatPage.chatInput).toBeVisible({ timeout: 15_000 });
    await chatPage.chatInput.fill('Hello, this is an E2E accessibility test');
    await expect(chatPage.sendButton).toBeEnabled({ timeout: 10_000 });
    // A brief pause to ensure the button registers as enabled and avoids
    // the existing ChatPage.sendMessage 5-second wait being skipped.
    await page.waitForTimeout(500);
    await chatPage.sendButton.click();
    await chatPage.waitForUserMessage(
      'Hello, this is an E2E accessibility test',
      30_000,
    );
  });
});

// ---------------------------------------------------------------------------
// Journey 43: Flag ON
// ---------------------------------------------------------------------------

test.describe('Journey 43: Persistent Chat Input Label — flag ON', () => {
  let tenantKey = '';
  let originalFlagValue: boolean | undefined;

  test.beforeEach(async ({ page }) => {
    test.skip(!DM_URL, 'DM_URL env var is required for tenant metadata tests');

    await navigateToMentorApp(page);
    const ctx = await getPlatformContext(page);
    tenantKey = ctx.tenantKey;

    // Snapshot the original flag value for teardown.
    const meta = await getTenantMetadata(page, tenantKey);
    originalFlagValue =
      meta.persistent_chat_input_label === true ? true : false;

    // Enable the flag.
    await setTenantMetadataFlag(
      page,
      tenantKey,
      'persistent_chat_input_label',
      true,
    );

    // Reload so the React app picks up the updated metadata.
    await navigateToMentorApp(page);
    await waitForPageReady(page);
  });

  test.afterEach(async ({ page }) => {
    if (!DM_URL || !tenantKey) return;
    // Always restore to the original value — even on test failure.
    await setTenantMetadataFlag(
      page,
      tenantKey,
      'persistent_chat_input_label',
      originalFlagValue ?? false,
    );
  });

  test('user goes to chat page and the label is visually visible when persistent_chat_input_label is true', async ({
    page,
  }) => {
    const label = chatInputLabel(page);
    await expect(label).toBeAttached({ timeout: 15_000 });

    // With flag ON the label has `block` (visible above the textarea).
    await expect(label).toHaveClass(/\bblock\b/, { timeout: 5_000 });

    // It must NOT have sr-only.
    const className = await label.getAttribute('class');
    expect(className).not.toMatch(/\bsr-only\b/);

    // Label text is always "Ask anything".
    await expect(label).toHaveText('Ask anything');

    // The label should be in the viewport (visually rendered, not hidden).
    await expect(label).toBeVisible();
  });

  test('user goes to chat page and the textarea placeholder is empty when persistent_chat_input_label is true', async ({
    page,
  }) => {
    const textarea = chatTextarea(page);
    await expect(textarea).toBeVisible({ timeout: 15_000 });

    // With flag ON the label is visible, so the placeholder is cleared to
    // avoid redundant text (WCAG 3.3.2 — the label alone provides the instruction).
    await expect(textarea).toHaveAttribute('placeholder', '');
  });

  test('user goes to chat page and aria wiring is intact when persistent_chat_input_label is true', async ({
    page,
  }) => {
    const textarea = chatTextarea(page);
    await expect(textarea).toBeVisible({ timeout: 15_000 });

    // aria-labelledby must still reference the label element.
    await expect(textarea).toHaveAttribute(
      'aria-labelledby',
      'chat-input-label',
    );

    // The label element must exist and carry the correct text.
    const label = chatInputLabel(page);
    await expect(label).toBeAttached();
    await expect(label).toHaveText('Ask anything');

    // The accessible name resolves to "Ask anything" — verified indirectly
    // because getByRole('textbox', { name: 'Ask anything' }) found the element.
    // (Playwright resolves accessible names when matching by role+name.)
  });

  test('user goes to chat page and sends a message when persistent_chat_input_label is true', async ({
    page,
    chatPage,
  }) => {
    await expect(chatPage.chatInput).toBeVisible({ timeout: 15_000 });
    await chatPage.chatInput.fill('Hello from accessible label mode E2E test');
    await expect(chatPage.sendButton).toBeEnabled({ timeout: 10_000 });
    await page.waitForTimeout(500);
    await chatPage.sendButton.click();
    await chatPage.waitForUserMessage(
      'Hello from accessible label mode E2E test',
      30_000,
    );
  });
});
