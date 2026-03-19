import { Page, Locator, expect } from '@playwright/test';
import { safeWaitForURL } from '../utils/navigation';

const MENTOR_NEXTJS_HOST = process.env.MENTOR_NEXTJS_HOST || '';

export class NotificationsPage {
  readonly page: Page;

  readonly bell: Locator;
  readonly inboxTab: Locator;
  readonly alertsTab: Locator;
  readonly inboxContent: Locator;
  readonly alertsContent: Locator;
  readonly markAllReadButton: Locator;
  readonly createButton: Locator;
  readonly emptyInbox: Locator;

  constructor(page: Page) {
    this.page = page;
    this.bell = page.getByRole('button', { name: /notification/i });
    this.inboxTab = page.getByTestId('notification-inbox-tab')
      .or(page.getByRole('tab', { name: /inbox/i }));
    this.alertsTab = page.getByTestId('notification-alerts-tab')
      .or(page.getByRole('tab', { name: /alerts/i }));
    this.inboxContent = page.getByTestId('inbox-tab-content');
    this.alertsContent = page.getByTestId('alerts-tab-content');
    this.markAllReadButton = page.getByRole('button', {
      name: /mark all.*read/i,
    });
    this.createButton = page.getByRole('button', { name: /create/i }).first();
    this.emptyInbox = page.getByTestId('notifications-empty');
  }

  async goto(): Promise<void> {
    const notifBtn = this.page.getByRole('button', {
      name: 'Notifications',
      exact: true,
    });
    await expect(notifBtn).toBeVisible({ timeout: 10_000 });
    await notifBtn.click();
    await safeWaitForURL(
      this.page,
      new RegExp(
        `^${MENTOR_NEXTJS_HOST}/platform/[^/]+/[^/]+/notifications$`,
      ),
      { timeout: 30_000 },
    );
  }

  async isAlertsTabActive(): Promise<boolean> {
    return (
      (await this.alertsTab
        .getAttribute('data-state')
        .catch(() => null)) === 'active'
    );
  }

  async waitForTabsToSettle(): Promise<void> {
    await this.page.waitForSelector(
      '[data-testid="inbox-tab-content"][data-state="active"], [data-testid="alerts-tab-content"][data-state="active"]',
      { timeout: 30_000 },
    );
  }
}
