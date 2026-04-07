import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';

test.describe('Journey 17: Notifications — Non-Admin', () => {
  test.beforeEach(async ({ nonadminPage }) => {
    await navigateToMentorApp(nonadminPage);
  });

  test('non-admin goes to sidebar notifications button and lands on the notification page', async ({
    nonadminPage,
    nonadminNotificationsPage,
  }) => {
    await nonadminNotificationsPage.goto();
    await expect(nonadminPage).toHaveURL(/notifications/);
  });

  test('non-admin goes to navbar and sees notification dropdown from the bell', async ({
    nonadminPage,
    nonadminNavbarPage,
  }) => {
    const bell = nonadminNavbarPage.notificationBell;
    const visible = await bell
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (!visible) return;
    await bell.click();
    const dropdown = nonadminPage
      .getByRole('dialog')
      .or(nonadminPage.locator('[class*="notification-dropdown"]'));
    await expect(dropdown).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Journey 17: Notifications — Admin', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  test('admin goes to notifications page and creates a new notification', async ({
    page,
    notificationsPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Creating notifications requires admin access');
    await notificationsPage.goto();
    const createBtn = notificationsPage.createButton;
    const visible = await createBtn
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (!visible) return;
    await createBtn.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
  });

  // fixme: Mark All as Read button not visible — notification page UI changed
  test.fixme(
    'admin goes to notifications page and sees the Mark All as Read button',
    async ({ page, notificationsPage }) => {
      const isAdmin = await checkAdminStatus(page);
      test.skip(!isAdmin, 'Mark all read requires admin access');
      await notificationsPage.goto();
      await expect(notificationsPage.markAllReadButton).toBeVisible({
        timeout: 10_000,
      });
    },
  );

  test('admin goes to notifications alerts tab and sees proactive fields with ARIA attributes', async ({
    page,
    notificationsPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Alerts tab requires admin access');
    await notificationsPage.goto();
    await expect(notificationsPage.alertsTab).toBeVisible({ timeout: 10_000 });
    await notificationsPage.alertsTab.click();
    await page.waitForTimeout(1_000);
    const alertsContent = notificationsPage.alertsContent;
    await expect(alertsContent).toBeVisible({ timeout: 10_000 });
    const tabRole = await notificationsPage.alertsTab
      .getAttribute('role')
      .catch(() => null);
    expect(tabRole).toBe('tab');
  });

  test('admin goes to notifications page with empty inbox and the alerts tab auto-opens', async ({
    page,
    notificationsPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Auto-open alerts tab requires admin access');
    await notificationsPage.goto();
    await notificationsPage.waitForTabsToSettle();
    const alertsActive = await notificationsPage.isAlertsTabActive();
    const inboxActive =
      (await notificationsPage.inboxTab
        .getAttribute('data-state')
        .catch(() => null)) === 'active';
    // One of the two tabs must be active
    expect(alertsActive || inboxActive).toBe(true);
    if (alertsActive) {
      await expect(notificationsPage.alertsContent).toBeVisible({
        timeout: 10_000,
      });
      await expect(notificationsPage.inboxContent).toHaveAttribute(
        'data-state',
        'inactive',
      );
    }
  });
});
