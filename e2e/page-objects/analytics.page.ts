import { Page, Locator, expect } from '@playwright/test';
import { safeWaitForURL } from '../utils/navigation';

export class AnalyticsPage {
  readonly page: Page;

  readonly overviewTab: Locator;
  readonly usersTab: Locator;
  readonly topicsTab: Locator;
  readonly transcriptsTab: Locator;
  readonly costsTab: Locator;
  readonly reportsTab: Locator;
  readonly analyticsButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.analyticsButton = page.getByRole('button', {
      name: 'Analytics',
      exact: true,
    });
    this.overviewTab = page.getByRole('tab', { name: /overview/i });
    this.usersTab = page.getByRole('tab', { name: /users/i });
    this.topicsTab = page.getByRole('tab', { name: /topics/i });
    this.transcriptsTab = page.getByRole('tab', { name: /transcripts/i });
    this.costsTab = page.getByRole('tab', { name: /costs/i });
    this.reportsTab = page.getByRole('tab', { name: /reports|data reports/i });
  }

  async goto(): Promise<void> {
    await expect(this.analyticsButton).toBeVisible({ timeout: 120_000 });
    await this.analyticsButton.click();
    await safeWaitForURL(this.page, (url) => url.href.endsWith('/analytics'), {
      timeout: 60_000,
    });
  }

  async navigateToTab(
    tab: 'overview' | 'users' | 'topics' | 'transcripts' | 'costs' | 'reports',
  ): Promise<void> {
    const tabLocators = {
      overview: this.overviewTab,
      users: this.usersTab,
      topics: this.topicsTab,
      transcripts: this.transcriptsTab,
      costs: this.costsTab,
      reports: this.reportsTab,
    };
    const locator = tabLocators[tab];
    await expect(locator).toBeVisible({ timeout: 15_000 });
    await locator.click();
    await this.page.waitForTimeout(1_000);
  }

  async navigateToDataReports(): Promise<void> {
    await expect(this.analyticsButton).toBeVisible({ timeout: 120_000 });
    await this.analyticsButton.click();
    await safeWaitForURL(this.page, (url) => url.href.endsWith('/analytics'), {
      timeout: 60_000,
    });
    await expect(this.reportsTab).toBeVisible({ timeout: 30_000 });
    await this.reportsTab.click();
  }
}
