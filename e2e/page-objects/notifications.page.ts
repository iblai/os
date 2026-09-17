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
    this.inboxTab = page
      .getByTestId('notification-inbox-tab')
      .or(page.getByRole('tab', { name: /inbox/i }));
    this.alertsTab = page
      .getByTestId('notification-alerts-tab')
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
      new RegExp(`^${MENTOR_NEXTJS_HOST}/platform/[^/]+/[^/]+/notifications$`),
      { timeout: 30_000 },
    );
  }

  // Both panels' data-state are read in ONE evaluate so a tab switch cannot
  // land between two reads: the CI trace showed alerts-tab-content sampled
  // `inactive` just before the empty-inbox auto-switch and inbox-tab-content
  // `inactive` just after it. 'inbox' is only terminal once the list has
  // rendered; while loading or empty the auto-switch to alerts may still fire.
  private readActiveTab(): Promise<'inbox' | 'alerts' | null> {
    return this.page.evaluate(() => {
      const state = (id: string) =>
        document
          .querySelector(`[data-testid="${id}"]`)
          ?.getAttribute('data-state');
      if (state('alerts-tab-content') === 'active') return 'alerts';
      if (
        state('inbox-tab-content') === 'active' &&
        document.querySelector('[data-testid="notifications-list"]')
      )
        return 'inbox';
      return null;
    });
  }

  async waitForActiveTab(): Promise<'inbox' | 'alerts'> {
    await expect
      .poll(() => this.readActiveTab(), { timeout: 30_000 })
      .not.toBeNull();
    return (await this.readActiveTab()) as 'inbox' | 'alerts';
  }
}
