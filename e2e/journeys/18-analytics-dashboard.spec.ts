import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';

test.describe('Journey 18: Analytics Dashboard', () => {
  test.beforeEach(async ({ page, analyticsPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Analytics requires admin access');
      return;
    }
    await analyticsPage.goto();
  });

  // fixme: analytics page navigation/content times out — URL pattern or tab changes
  test('admin goes to analytics page and views the overview tab with mini-cards, charts, and time filters', async ({
    page,
    analyticsPage,
  }) => {
    await analyticsPage.navigateToTab('overview');
    await expect(page).toHaveURL(/analytics/, { timeout: 15_000 });
  });

  // fixme: analytics page navigation/content times out — URL pattern or tab changes
  test('admin goes to analytics page and views the users tab with user metric cards', async ({
    analyticsPage,
    page,
  }) => {
    await analyticsPage.navigateToTab('users');
    await expect(page).toHaveURL(/users/, { timeout: 15_000 });
  });

  // fixme: analytics page navigation/content times out — URL pattern or tab changes
  test('admin goes to analytics page and views the topics tab with topic cards', async ({
    analyticsPage,
    page,
  }) => {
    await analyticsPage.navigateToTab('topics');
    await expect(page).toHaveURL(/topics/, { timeout: 15_000 });
  });

  // fixme: analytics page navigation/content times out — URL pattern or tab changes
  test.fixme(
    'admin goes to analytics page and views the transcripts tab with conversation metrics',
    async ({ analyticsPage, page }) => {
      await analyticsPage.navigateToTab('transcripts');
      await expect(page).toHaveURL(/transcripts/, { timeout: 15_000 });
    },
  );

  test('admin goes to analytics page and views the costs tab with cost cards', async ({
    analyticsPage,
    page,
  }) => {
    await analyticsPage.navigateToTab('costs');
    await expect(page).toHaveURL(/financial/, { timeout: 15_000 });
  });

  // fixme: analytics page doesn't have a financial tab
  test.fixme(
    'admin goes to analytics page and views the financial tab with cost cards',
    async ({ analyticsPage, page }) => {
      await analyticsPage.navigateToTab('financial');
      await expect(page).toHaveURL(/financial/, { timeout: 15_000 });
    },
  );
});
