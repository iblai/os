/**
 * Journey 45: Dataset Cloud Pickers
 *
 * Verifies that clicking the Google Drive, Microsoft OneDrive, and Dropbox
 * buttons in the Add Resources modal opens the third-party auth/picker popup.
 * The issue (#1677) only requires asserting "a click of the button works"
 * (i.e., the auth window or iframe pops up — we do NOT complete the auth flow).
 *
 * Confirmed runtime behaviour (manual verification at localhost:3000 against
 * the configured tenant credentials):
 *
 * - Google Drive → popup at `accounts.google.com/v3/signin/...` (OAuth flow).
 * - Microsoft OneDrive → popup at `login.microsoftonline.com/common/oauth2/...`
 *   (uses `openInNewWindow: true` in the SDK options).
 * - Dropbox → popup at `www.dropbox.com/chooser?app_key=...&iframe=false`
 *   (window.Dropbox.choose() opens the Chooser as a popup).
 *
 * Each test races `page.waitForEvent('popup')` against the click. The popup's
 * URL is asserted to match the expected provider domain. If no popup opens
 * within the timeout, the test fails — that is exactly the regression #1677
 * exists to catch (broken click handler, missing credentials, SDK not loaded).
 *
 * Each test creates a fresh mentor first (matching journey 36 / 45 pattern)
 * so the datasets tab is always reachable from a known-good starting state.
 */

import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { logger } from '@iblai/iblai-js/playwright';

test.describe('Journey 45: Dataset Cloud Pickers', () => {
  test.setTimeout(200_000);

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    // Hard-fail on non-admin — the cloud picker buttons are admin-gated and
    // a silent skip would hide a misconfigured E2E user.
    expect(
      isAdmin,
      'Test user must be admin — check PLAYWRIGHT_USERNAME in e2e/.env.local',
    ).toBe(true);
  });

  // ── dscp-01: Google Drive ──────────────────────────────────────────────────
  //
  // Clicking the Google Drive button calls handlePickerOpen() which loads the
  // Google Identity Services SDK and opens an OAuth popup at accounts.google.com.

  test('admin creates a mentor and clicks Google Drive button which opens the OAuth popup', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate();
    await editMentorPage.open('Datasets');
    await waitForPageReady(page);

    const modal = await editMentorPage.datasets.openAddResourceModal();
    await expect(modal).toBeVisible({ timeout: 10_000 });

    const googleDriveBtn = editMentorPage.datasets.googleDriveButton(modal);
    await expect(googleDriveBtn).toBeVisible({ timeout: 10_000 });
    await expect(googleDriveBtn).toBeEnabled({ timeout: 5_000 });

    // The picker hook loads apis.google.com/js/api.js asynchronously and
    // clicking before window.gapi is defined silently fails. Wait for the
    // SDK before clicking.
    await page.waitForFunction(
      () => typeof (window as { gapi?: unknown }).gapi !== 'undefined',
      undefined,
      { timeout: 15_000 },
    );

    // Race the popup open against the click — `waitForEvent` must be set up
    // BEFORE the click that triggers it.
    const popupPromise = page.waitForEvent('popup', { timeout: 15_000 });
    await googleDriveBtn.click();
    const popup = await popupPromise;

    // The popup may briefly load an SDK-internal URL (about:blank or a local
    // redirect endpoint) before navigating to the provider domain.
    // waitForURL polls until the popup reaches the expected URL.
    await popup.waitForURL(/accounts\.google\.com/, { timeout: 15_000 });
    logger.info(`dscp-01: Google Drive popup navigated to ${popup.url()}`);

    await popup.close();
  });

  // ── dscp-02: Microsoft OneDrive ────────────────────────────────────────────
  //
  // Clicking the OneDrive button calls pickOneDriveFile() which opens a popup
  // at login.microsoftonline.com (openInNewWindow: true in the SDK options).

  test('admin creates a mentor and clicks Microsoft OneDrive button which opens the OAuth popup', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate();
    await editMentorPage.open('Datasets');
    await waitForPageReady(page);

    const modal = await editMentorPage.datasets.openAddResourceModal();
    await expect(modal).toBeVisible({ timeout: 10_000 });

    const oneDriveBtn = editMentorPage.datasets.oneDriveButton(modal);
    await expect(oneDriveBtn).toBeVisible({ timeout: 10_000 });
    await expect(oneDriveBtn).toBeEnabled({ timeout: 5_000 });

    // The picker hook loads js.live.net/v7.2/OneDrive.js asynchronously.
    // Clicking before window.OneDrive is defined toasts "SDK not loaded" — wait.
    await page.waitForFunction(
      () => typeof (window as { OneDrive?: unknown }).OneDrive !== 'undefined',
      undefined,
      { timeout: 15_000 },
    );

    const popupPromise = page.waitForEvent('popup', { timeout: 15_000 });
    await oneDriveBtn.click();
    const popup = await popupPromise;

    // OneDrive's SDK opens the popup on its local /uploads redirect endpoint
    // (with the OAuth params) and then navigates to login.microsoftonline.com.
    // waitForURL polls past the intermediate URL.
    await popup.waitForURL(/login\.microsoftonline\.com/, { timeout: 15_000 });
    logger.info(`dscp-02: OneDrive popup navigated to ${popup.url()}`);

    await popup.close();
  });

  // ── dscp-03: Dropbox ───────────────────────────────────────────────────────
  //
  // Clicking the Dropbox button calls window.Dropbox.choose() which opens the
  // Dropbox Chooser as a popup at www.dropbox.com/chooser.

  test('admin creates a mentor and clicks Dropbox button which opens the Chooser popup', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate();
    await editMentorPage.open('Datasets');
    await waitForPageReady(page);

    const modal = await editMentorPage.datasets.openAddResourceModal();
    await expect(modal).toBeVisible({ timeout: 10_000 });

    const dropboxBtn = editMentorPage.datasets.dropboxButton(modal);
    await expect(dropboxBtn).toBeVisible({ timeout: 10_000 });
    await expect(dropboxBtn).toBeEnabled({ timeout: 5_000 });

    // The picker hook loads dropbox.com/static/api/2/dropins.js asynchronously.
    // The Dropbox hook silently returns null if window.Dropbox is undefined —
    // no popup, no toast — so the test must wait for the SDK before clicking.
    await page.waitForFunction(
      () => typeof (window as { Dropbox?: unknown }).Dropbox !== 'undefined',
      undefined,
      { timeout: 15_000 },
    );

    const popupPromise = page.waitForEvent('popup', { timeout: 15_000 });
    await dropboxBtn.click();
    const popup = await popupPromise;

    // Wait for the Chooser URL — the popup may briefly hold about:blank
    // before the SDK navigates it.
    await popup.waitForURL(/dropbox\.com\/chooser/, { timeout: 15_000 });
    logger.info(`dscp-03: Dropbox popup navigated to ${popup.url()}`);

    await popup.close();
  });
});
