import { test, expect } from '../fixtures/mentor-test';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';

/**
 * Journey 74: Tenant-wide Analytics
 *
 * The same analytics section as Journey 18, but mounted directly under
 * `/platform/{tenantKey}/analytics` — no agent in the URL, so every container
 * reports on the whole tenant. The sidebar links here whenever no agent is
 * selected; these tests deep-link instead, since the fixtures always start on
 * an agent route.
 */
test.describe('Journey 74: Tenant-wide Analytics', () => {
  let tenantKey: string;

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Analytics requires admin access');
      return;
    }
    ({ tenantKey } = await getPlatformContext(page));
  });

  test('admin opens the tenant-wide analytics overview and gets the platform shell around the tab strip', async ({
    page,
    analyticsPage,
  }) => {
    await analyticsPage.gotoTenantWide(tenantKey);

    // Nothing above this route supplies the shell, so the layout wraps it
    // itself — a missing sidebar here means the wrap regressed.
    await expect(page.locator('aside').first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page).toHaveURL(
      new RegExp(`/platform/${tenantKey}/analytics/?$`),
    );
  });

  test('tab navigation from the tenant-wide overview keeps the route free of an agent id', async ({
    page,
    analyticsPage,
  }) => {
    await analyticsPage.gotoTenantWide(tenantKey);
    await analyticsPage.navigateToTab('users');

    await expect(page).toHaveURL(
      new RegExp(`/platform/${tenantKey}/analytics/users/?$`),
      { timeout: 15_000 },
    );
  });

  test('tenant-wide stats tabs are reachable by direct URL', async ({
    analyticsPage,
    page,
  }) => {
    for (const tab of ['users', 'topics', 'transcripts', 'financial']) {
      await analyticsPage.gotoTenantWide(tenantKey, tab);
      await expect(page).toHaveURL(
        new RegExp(`/platform/${tenantKey}/analytics/${tab}/?$`),
      );
    }
  });

  test('tenant-wide memory page loads without an agent scope', async ({
    analyticsPage,
    page,
  }) => {
    await analyticsPage.gotoTenantWide(tenantKey, 'memory');

    await expect(page).toHaveURL(
      new RegExp(`/platform/${tenantKey}/analytics/memory/?$`),
    );
  });

  test('tenant-wide data reports page loads without an agent scope', async ({
    analyticsPage,
    page,
  }) => {
    await analyticsPage.gotoTenantWide(tenantKey, 'reports');

    await expect(page).toHaveURL(
      new RegExp(`/platform/${tenantKey}/analytics/reports/?$`),
    );
    await expect(
      page.getByRole('tab', { name: /data reports/i }),
    ).toBeVisible();
  });

  test('the sidebar Analytics entry opens the tenant-wide section, agent in the URL or not', async ({
    analyticsPage,
    page,
  }) => {
    await analyticsPage.goto();

    await expect(page).toHaveURL(
      new RegExp(`/platform/${tenantKey}/analytics/?$`),
    );
  });

  test('navbar drops the chat-only chrome on the tenant-wide section', async ({
    page,
    navbarPage,
    analyticsPage,
  }) => {
    // Journey 65 owns the opposite assertion: on an AGENT's analytics page the
    // navbar keeps full parity with the chat page. Here there is no agent in
    // the URL, so the LLM selector and the agent dropdown have nothing to act
    // on — reading both states in one test keeps the contrast honest.
    await analyticsPage.gotoAgentAnalytics();
    await expect(navbarPage.llmModelSelectorButton).toBeVisible({
      timeout: 15_000,
    });

    await analyticsPage.gotoTenantWide(tenantKey);

    await expect(navbarPage.llmModelSelectorButton).not.toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByLabel('Selected agent dropdown button'),
    ).not.toBeVisible({ timeout: 15_000 });
  });

  test('tenant-wide audit page loads and the API decides what the viewer may see', async ({
    analyticsPage,
    page,
  }) => {
    // There is no mentor here to run `/mentors/{id}/#view_audit_logs` against,
    // so the page always mounts: either the log/empty state or the container's
    // own "no permission" card, both of which mean the route rendered.
    await analyticsPage.gotoTenantWide(tenantKey, 'audit');

    await expect(page).toHaveURL(
      new RegExp(`/platform/${tenantKey}/analytics/audit/?$`),
    );
  });
});
