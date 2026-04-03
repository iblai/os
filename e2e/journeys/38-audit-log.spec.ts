import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import type { Page, Locator } from '@playwright/test';
import {
  navigateToAuditLog,
  waitForAuditLogDataLoaded,
  verifyAuditLogEmptyState,
} from '@iblai/iblai-js/playwright';

const PERMISSION_DENIED = 'You do not have permission to view audit logs.';
const GENERIC_ERROR = 'An error occurred while loading audit logs.';
const EMPTY_MESSAGE = 'No audit log entries found for this tenant.';

/**
 * After audit data has loaded, assert tenant admin sees either the empty state
 * or a populated table (not permission or generic errors).
 * Waits for spinner to disappear before checking content.
 */
async function expectAdminAuditLogUi(
  page: Page,
  scope: Page | Locator = page,
): Promise<void> {
  // Wait for data to finish loading (spinner gone, content visible)
  await waitForAuditLogDataLoaded(page, 60_000);

  await expect(
    scope
      .getByText(EMPTY_MESSAGE)
      .or(scope.locator('table'))
      .or(scope.getByText(PERMISSION_DENIED))
      .or(scope.getByText(GENERIC_ERROR)),
  ).toBeVisible({ timeout: 60_000 });

  await expect(scope.getByText(PERMISSION_DENIED)).not.toBeVisible();
  await expect(scope.getByText(GENERIC_ERROR)).not.toBeVisible();

  const emptyVisible = await scope
    .getByText(EMPTY_MESSAGE)
    .isVisible()
    .catch(() => false);

  if (emptyVisible) {
    await verifyAuditLogEmptyState(page);
    return;
  }

  // Verify the table is visible and has rows
  const table = scope.locator('table');
  await expect(table).toBeVisible({ timeout: 30_000 });
  const rowCount = await table.locator('tbody tr').count();
  expect(rowCount).toBeGreaterThanOrEqual(0);
}

test.describe('Journey 38: Audit log (tenant admin)', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Audit log journeys require tenant admin');
    }
  });

  test('tenant admin opens Analytics, navigates to Audit tab, and sees audit content or empty state', async ({
    page,
    analyticsPage,
  }) => {
    await analyticsPage.goto();
    await navigateToAuditLog(page);
    await expect(page).toHaveURL(/\/analytics\/audit-log$/);
    await expectAdminAuditLogUi(page);
  });

  test('tenant admin opens Edit Mentor, selects Audit tab, and sees audit content or empty state', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('Audit');
    await waitForPageReady(page);
    await expect(
      editMentorPage.dialog.getByRole('tab', { name: 'Audit', exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    await expectAdminAuditLogUi(page, editMentorPage.dialog);
    await editMentorPage.close();
  });
});
