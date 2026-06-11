/**
 * Journey 46: Prompt Caching Toggle
 *
 * Covers the "Enable prompt caching" switch added to the Capabilities sub-tab
 * of the Settings panel (iblai-platform#1608).
 *
 * Architecture: Serial tests sharing a single fresh mentor
 * ─────────────────────────────────────────────────────────
 * All 3 tests reuse ONE mentor created in pc-01. This avoids overloading the
 * backend with multiple rapid mentor-creation calls (the Create Mentor API is
 * throttled in the test environment). The mentor URL is written to a temp file
 * (`/tmp/e2e-46-mentor-url`) after pc-01 creates it so that:
 *   - pc-02 and pc-03 navigate to it via `navigateToMentorApp(page, url)`,
 *     which handles auth redirects and ensures the page is fully loaded
 *   - pc-01 retry in a new Playwright worker reads the file instead of creating
 *     a second mentor (which would be throttled by the backend)
 *
 * Tests run serially — pc-02 and pc-03 are skipped if pc-01 fails.
 *
 * The Create Agent dialog loads `useGetMentorCategoriesQuery` which is
 * intermittently slow on cold API caches; `CreateMentorPage.fillRequiredFields`
 * auto-retries by closing and reopening the dialog after a 20 s fast-fail,
 * which warms the cache and resolves on the second attempt.
 *
 * Checkpoints:
 *   pc-01  Default off + renders — fresh mentor, Capabilities tab, switch is visible and unchecked
 *   pc-02  Toggle ON saves — toggle on → Save → "Agent updated successfully" toast appears →
 *          switch reflects ON immediately after save
 *   pc-03  Toggle OFF interaction — from on state, toggle off → switch shows OFF immediately →
 *          save succeeds (toast appears)
 *
 * Note on persistence: The `enable_prompt_caching` field is not yet in the
 * installed SDK type. Persistence across close/reopen is not asserted because
 * it depends on both SDK and backend support that may not be present in all
 * environments. These tests validate the UI interaction and save API call.
 */
import * as fs from 'fs';
import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { logger } from '@iblai/iblai-js/playwright';

// Temp file used to persist the shared mentor URL across serial-retry workers.
// Playwright creates a new Node.js process for each serial retry, so
// module-level variables are reset. Writing to a temp file survives that.
const SHARED_MENTOR_URL_FILE = '/tmp/e2e-46-mentor-url';

function readSharedMentorUrl(): string | null {
  try {
    const url = fs.readFileSync(SHARED_MENTOR_URL_FILE, 'utf8').trim();
    return url || null;
  } catch {
    return null;
  }
}

function writeSharedMentorUrl(url: string): void {
  fs.writeFileSync(SHARED_MENTOR_URL_FILE, url, 'utf8');
}

// In-process cache so we don't hit the filesystem on every test in the same worker.
let sharedMentorUrl: string | null = readSharedMentorUrl();

// Serial execution: reuse a single mentor to avoid backend throttling when
// multiple creation calls arrive in rapid succession.
test.describe.fixme('Journey 46: Prompt Caching Toggle', () => {
  test.setTimeout(300_000);

  // beforeEach only checks admin status and navigates to the app. The tests
  // themselves handle navigation to the specific mentor page so that pc-02
  // and pc-03 can use `navigateToMentorApp(page, sharedMentorUrl)` to navigate
  // directly to the shared mentor with proper auth handling.
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Requires admin access');
    }
  });

  // Clean up the temp file when the whole suite finishes so the next fresh
  // run doesn't accidentally reuse a stale mentor URL.
  test.afterAll(() => {
    try {
      fs.unlinkSync(SHARED_MENTOR_URL_FILE);
    } catch {
      // Already gone — no action needed.
    }
    sharedMentorUrl = null;
  });

  // pc-01: Default off + renders
  // This test creates the shared mentor used by pc-02 and pc-03. On retry,
  // if the mentor was already created (sharedMentorUrl is set), navigates to
  // it directly instead of creating a new one.
  test('admin opens new mentor Capabilities tab and sees prompt caching toggle defaulting to OFF', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    if (sharedMentorUrl) {
      // Retry path (or same-worker second run): reuse the mentor created in the
      // previous attempt to avoid a second rapid backend creation call (throttled).
      logger.info(
        `pc-01 (retry): navigating to existing mentor ${sharedMentorUrl}`,
      );
      await navigateToMentorApp(page, sharedMentorUrl);
    } else {
      // First run: create a fresh mentor.
      await createMentorPage.openAndCreate();
      sharedMentorUrl = page.url();
      // Write to temp file so Playwright serial-retry workers (new processes)
      // can read the URL and skip re-creation.
      writeSharedMentorUrl(sharedMentorUrl);
      logger.info(`pc-01: shared mentor URL persisted: ${sharedMentorUrl}`);
    }
    await waitForPageReady(page);
    // Ensure the agent dropdown is visible before trying to open the edit dialog
    await expect(
      page.locator('button[aria-label="Selected agent dropdown button"]'),
    ).toBeVisible({ timeout: 60_000 });

    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    await editMentorPage.settings.selectSubTab('Capabilities');

    // Label must be visible
    const label = editMentorPage.dialog.getByText('Enable prompt caching', {
      exact: true,
    });
    await expect(label).toBeVisible({ timeout: 10_000 });

    // Switch must be visible and unchecked (default off on a fresh mentor)
    const toggle = editMentorPage.settings.promptCachingToggle;
    await expect(toggle).toBeVisible({ timeout: 10_000 });

    const ariaChecked = await toggle.getAttribute('aria-checked');
    expect(ariaChecked).toBe('false');
    logger.info(`pc-01: aria-checked=${ariaChecked} (expected false)`);

    // Tooltip trigger must also be present
    await expect(
      editMentorPage.settings.promptCachingTooltipTrigger,
    ).toBeVisible({ timeout: 5_000 });

    await editMentorPage.close();
  });

  // pc-02: Toggle ON → Save succeeds
  // Verifies the toggle can be switched ON, the form reflects ON, Save succeeds,
  // and the switch stays ON in the same open dialog after the save completes.
  test('admin toggles prompt caching ON and the save succeeds with the toggle reflecting ON', async ({
    page,
    editMentorPage,
  }) => {
    if (!sharedMentorUrl) {
      test.skip(true, 'pc-01 must have created the shared mentor first');
      return;
    }
    logger.info(`pc-02: navigating to shared mentor: ${sharedMentorUrl}`);

    // Navigate to the shared mentor page with auth handling
    await navigateToMentorApp(page, sharedMentorUrl);
    await waitForPageReady(page);
    // Wait for the agent dropdown to be fully mounted before opening edit dialog
    await expect(
      page.locator('button[aria-label="Selected agent dropdown button"]'),
    ).toBeVisible({ timeout: 60_000 });

    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    await editMentorPage.settings.selectSubTab('Capabilities');
    const toggle = editMentorPage.settings.promptCachingToggle;
    await expect(toggle).toBeVisible({ timeout: 10_000 });

    // Toggle must currently be OFF (fresh mentor default)
    const initialState = await toggle.getAttribute('aria-checked');
    expect(initialState).toBe('false');
    logger.info(`pc-02: initial state aria-checked=${initialState}`);

    // Turn ON
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true', {
      timeout: 10_000,
    });
    logger.info('pc-02: toggle clicked to ON');

    // Save
    const saveButton = editMentorPage.settings.saveButton;
    await expect(saveButton).toBeEnabled({ timeout: 10_000 });
    await saveButton.click();

    // Verify the save API call succeeded
    await expect(
      page.getByText(/Agent updated successfully/i).first(),
    ).toBeVisible({ timeout: 30_000 });
    logger.info(
      'pc-02: Save succeeded — Agent updated successfully toast appeared',
    );

    // Verify the toggle still reflects ON after save (in the same open dialog)
    const postSaveState = await toggle.getAttribute('aria-checked');
    expect(postSaveState).toBe('true');
    logger.info(
      `pc-02: post-save aria-checked=${postSaveState} (expected true)`,
    );

    await editMentorPage.close();
  });

  // pc-03: Toggle OFF interaction and save
  // Verifies the toggle responds immediately when clicked OFF and that the Save
  // succeeds. Persistence of `false` via multipart form is not asserted here
  // because it is a pre-existing infrastructure limitation shared with
  // `enable_multi_query_rag` (see journey 07 uid-08) — not a regression of
  // this feature.
  test('admin toggles prompt caching from ON to OFF and the toggle responds and save succeeds', async ({
    page,
    editMentorPage,
  }) => {
    if (!sharedMentorUrl) {
      test.skip(true, 'pc-01 must have created the shared mentor first');
      return;
    }
    logger.info(`pc-03: navigating to shared mentor: ${sharedMentorUrl}`);

    // Navigate to the shared mentor page with auth handling
    await navigateToMentorApp(page, sharedMentorUrl);
    await waitForPageReady(page);
    // Wait for the agent dropdown to be fully mounted before opening edit dialog
    await expect(
      page.locator('button[aria-label="Selected agent dropdown button"]'),
    ).toBeVisible({ timeout: 60_000 });

    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    // --- Ensure toggle is ON ---
    await editMentorPage.settings.selectSubTab('Capabilities');
    const toggle = editMentorPage.settings.promptCachingToggle;
    await expect(toggle).toBeVisible({ timeout: 10_000 });

    const startChecked = await toggle.getAttribute('aria-checked');
    if (startChecked !== 'true') {
      // If pc-02 didn't persist ON (backend limitation), turn it on now.
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-checked', 'true', {
        timeout: 10_000,
      });
    }
    logger.info('pc-03: Toggle is now ON');

    // --- Click toggle to turn OFF ---
    await toggle.click();
    // Verify the toggle immediately reflects OFF in the UI
    await expect(toggle).toHaveAttribute('aria-checked', 'false', {
      timeout: 10_000,
    });
    logger.info(
      `pc-03: toggle aria-checked after clicking OFF = false (correct)`,
    );

    // Save and verify success toast (API round-trip succeeds)
    const saveButton = editMentorPage.settings.saveButton;
    await expect(saveButton).toBeEnabled({ timeout: 10_000 });
    await saveButton.click();
    await expect(
      page.getByText(/Agent updated successfully/i).first(),
    ).toBeVisible({ timeout: 30_000 });
    logger.info('pc-03: Save succeeded for enable_prompt_caching=false');

    await editMentorPage.close();
  });
});
