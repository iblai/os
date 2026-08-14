import { Page, Locator, expect } from '@playwright/test';
import { safeWaitForURL } from '../utils/navigation';

export class AnalyticsPage {
  readonly page: Page;
  readonly sidebar: Locator;

  readonly overviewTab: Locator;
  readonly usersTab: Locator;
  readonly topicsTab: Locator;
  readonly transcriptsTab: Locator;
  readonly costsTab: Locator;
  readonly reportsTab: Locator;
  readonly analyticsButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // Scope sidebar lookups to the `<aside>` landmark so sidebar
    // sub-items like "Overview" don't clash with same-named tabs
    // rendered in the page content.
    this.sidebar = page.locator('aside').first();
    this.analyticsButton = this.sidebar.getByRole('button', {
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

  /**
   * Expand the sidebar's collapsible "Analytics" section idempotently.
   * Uses Radix's `aria-expanded` so a second click never collapses it.
   */
  private async expandSidebarAnalytics(): Promise<void> {
    await expect(this.analyticsButton).toBeVisible({ timeout: 120_000 });
    const expanded = await this.analyticsButton
      .getAttribute('aria-expanded')
      .catch(() => null);
    if (expanded !== 'true') {
      await this.analyticsButton.click();
      await expect(this.analyticsButton).toHaveAttribute(
        'aria-expanded',
        'true',
        { timeout: 5_000 },
      );
    }
  }

  /**
   * Open analytics from the sidebar. That entry now always lands on the
   * TENANT-WIDE section (`/platform/{tenantKey}/analytics`) — the navbar's
   * agent picker narrows it from there. Use `gotoAgentAnalytics()` for the
   * per-agent section.
   */
  async goto(): Promise<void> {
    // The sidebar's "Analytics" button is a collapsible-section trigger
    // (Agents/Workflows/Chats/Projects/Analytics all collapse). The
    // sub-item "Overview" is what actually navigates to `/analytics`.
    await this.expandSidebarAnalytics();
    const overviewLink = this.sidebar.getByRole('button', {
      name: 'Overview',
      exact: true,
    });
    await expect(overviewLink).toBeVisible({ timeout: 10_000 });
    await overviewLink.click();
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
    // The tab list reflects active state through `aria-selected`. Wait
    // for that to settle rather than sleeping a magic 1s — flakiness
    // here was caused by races between the click and content render.
    await expect(locator).toHaveAttribute('aria-selected', 'true', {
      timeout: 10_000,
    });
  }

  async navigateToMemory(): Promise<void> {
    // Memory has no on-page tab — it is reached through the sidebar's
    // "Memory" sub-item (rendered right after Transcripts), which
    // deep-links to `/analytics/memory`.
    await this.expandSidebarAnalytics();
    const memoryLink = this.sidebar.getByRole('button', {
      name: 'Memory',
      exact: true,
    });
    await expect(memoryLink).toBeVisible({ timeout: 10_000 });
    await memoryLink.click();
    await safeWaitForURL(
      this.page,
      (url) => /\/analytics\/memory\/?$/.test(url.href),
      { timeout: 60_000 },
    );
  }

  async navigateToDataReports(): Promise<void> {
    // Sidebar Analytics is a collapsible section now (see `goto()`).
    // Expand it, then click the "Data Reports" sub-item which deep-links
    // directly to `/analytics/reports` without needing the on-page tab.
    await this.expandSidebarAnalytics();
    const dataReportsLink = this.sidebar.getByRole('button', {
      name: 'Data Reports',
      exact: true,
    });
    await expect(dataReportsLink).toBeVisible({ timeout: 10_000 });
    await dataReportsLink.click();
    await safeWaitForURL(
      this.page,
      (url) => /\/analytics\/reports\/?$/.test(url.href),
      { timeout: 60_000 },
    );
  }

  /**
   * Open the CURRENT agent's analytics from the navbar agent dropdown — the
   * only click-path to the per-agent section now that the sidebar entry points
   * at the tenant-wide one.
   */
  async gotoAgentAnalytics(): Promise<void> {
    const dropdown = this.page.getByRole('button', {
      name: 'Selected agent dropdown button',
    });
    await expect(dropdown).toBeVisible({ timeout: 30_000 });
    await dropdown.click();
    const analyticsItem = this.page
      .getByRole('menuitem', { name: 'Analytics', exact: true })
      .or(this.page.getByRole('button', { name: 'Analytics', exact: true }))
      .last();
    await expect(analyticsItem).toBeVisible({ timeout: 10_000 });
    await analyticsItem.click();
    await safeWaitForURL(
      this.page,
      (url) => {
        const parts = url.pathname.split('/').filter(Boolean);
        // /platform/{tenantKey}/{mentorId}/analytics — agent segment intact.
        return parts[0] === 'platform' && parts[3] === 'analytics';
      },
      { timeout: 60_000 },
    );
  }

  /**
   * Deep-link to the tenant-wide analytics section — `/platform/{tenantKey}/
   * analytics[/tab]`, with no mentor segment. These routes are only reachable
   * by URL (or from the sidebar while no agent is selected), so there is no
   * click-path equivalent of `goto()` here.
   */
  async gotoTenantWide(tenantKey: string, tab = ''): Promise<void> {
    const path = `/platform/${tenantKey}/analytics${tab ? `/${tab}` : ''}`;
    await this.page.goto(path, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await safeWaitForURL(this.page, (url) => url.pathname === path, {
      timeout: 60_000,
    });
    // The tab strip is the one thing `AnalyticsLayout` renders regardless of
    // how the data queries resolve, so it is the stable "section mounted" cue.
    await expect(this.overviewTab).toBeVisible({ timeout: 60_000 });
  }
}
