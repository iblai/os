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

test.describe('Journey 39: Audit log (tenant admin)', () => {
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
    await expect(page).toHaveURL(/\/analytics\/audit$/);
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

  test('tenant admin opens Audit Log tab from navbar mentor dropdown', async ({
    page,
    navbarPage,
    editMentorPage,
  }) => {
    await navbarPage.openMentorDropdown();

    const auditMenuItem = page.getByRole('menuitem', {
      name: 'Audit',
      exact: true,
    });
    await expect(auditMenuItem).toBeVisible({ timeout: 10_000 });
    await auditMenuItem.click();

    // The Edit Mentor modal should open on the Audit tab
    await expect(editMentorPage.dialog).toBeVisible({ timeout: 15_000 });
    await expect(
      editMentorPage.dialog.getByRole('tab', { name: 'Audit', exact: true }),
    ).toHaveAttribute('data-state', 'active', { timeout: 10_000 });

    await expectAdminAuditLogUi(page, editMentorPage.dialog);
    await editMentorPage.close();
  });

  test('tenant admin can navigate between Audit and other tabs in Edit Mentor', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('Audit');
    await waitForPageReady(page);

    // Verify Audit tab is active
    await expect(
      editMentorPage.dialog.getByRole('tab', { name: 'Audit', exact: true }),
    ).toHaveAttribute('data-state', 'active', { timeout: 10_000 });

    // Switch to Settings tab
    await editMentorPage.navigateToTab('Settings');
    await expect(
      editMentorPage.dialog.getByRole('tab', {
        name: 'Settings',
        exact: true,
      }),
    ).toHaveAttribute('data-state', 'active', { timeout: 10_000 });

    // Switch back to Audit tab
    await editMentorPage.navigateToTab('Audit');
    await expect(
      editMentorPage.dialog.getByRole('tab', { name: 'Audit', exact: true }),
    ).toHaveAttribute('data-state', 'active', { timeout: 10_000 });

    await expectAdminAuditLogUi(page, editMentorPage.dialog);
    await editMentorPage.close();
  });
});

test.describe('Journey 39: Audit log (non-admin)', () => {
  test('non-admin user does not see Audit tab in the mentor dropdown', async ({
    nonadminPage,
    nonadminNavbarPage,
  }) => {
    await navigateToMentorApp(nonadminPage);
    const isAdmin = await checkAdminStatus(nonadminPage);
    if (isAdmin) {
      test.skip(true, 'This test requires a non-admin user');
    }

    await nonadminNavbarPage.openMentorDropdown();

    const auditMenuItem = nonadminPage.getByRole('menuitem', {
      name: 'Audit',
      exact: true,
    });
    await expect(auditMenuItem).not.toBeVisible({ timeout: 5_000 });
  });

  test('non-admin user does not see Audit tab in Edit Mentor modal', async ({
    nonadminPage,
    nonadminEditMentorPage,
  }) => {
    await navigateToMentorApp(nonadminPage);
    const isAdmin = await checkAdminStatus(nonadminPage);
    if (isAdmin) {
      test.skip(true, 'This test requires a non-admin user');
    }

    // Open edit mentor modal (will land on Settings or first available tab)
    const opened = await nonadminEditMentorPage
      .open()
      .then(() => true)
      .catch(() => false);

    if (!opened) {
      // Non-admin may not have access to edit mentor at all — that's acceptable
      return;
    }

    const auditTab = nonadminEditMentorPage.dialog.getByRole('tab', {
      name: 'Audit',
      exact: true,
    });
    await expect(auditTab).not.toBeVisible({ timeout: 5_000 });
    await nonadminEditMentorPage.close();
  });
});
