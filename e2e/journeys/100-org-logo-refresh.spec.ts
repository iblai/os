import { test, expect } from '../fixtures/mentor-test';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';
import { OrganizationLogoPage } from '../page-objects/organization-logo.page';
import { SidebarPage } from '../page-objects/sidebar.page';

/**
 * Journey 100: Sidebar logo refreshes after a logo upload
 * (iblai/iblai-platform#2809)
 *
 * The logo URL never changes, so the image optimizer and the browser kept
 * serving the old image after an admin uploaded a new one. After a successful
 * LIGHT upload the SDK stores `tenant_logo_version:<tenant>` in localStorage
 * and `components/logo.tsx` appends `?v=<version>` to the logo URL.
 *
 * The logo upload POST and the logo image are mocked (see
 * `OrganizationLogoPage.mock`), so no tenant is ever changed and the checks
 * do not depend on the tenant's current logo. next/image wraps the URL in
 * `/_next/image?url=<encoded>`, so assertions decode it first.
 */
test.describe('Journey 100: Org logo refresh', () => {
  let tenantKey = '';
  let logoPath: RegExp;

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    if (!(await checkAdminStatus(page))) {
      test.skip(true, 'Requires admin access');
    }
    ({ tenantKey } = await getPlatformContext(page));
    logoPath = new RegExp(`/api/core/orgs/${tenantKey}/logo/$`);
    await page.evaluate(
      (key) => localStorage.removeItem(`tenant_logo_version:${key}`),
      tenantKey,
    );
  });

  test('logo-01: admin with no stored logo version sees the bare logo URL in the sidebar', async ({
    page,
    sidebarPage,
  }) => {
    const logo = new OrganizationLogoPage(page);
    await OrganizationLogoPage.mock(page);
    await page.reload();
    await sidebarPage.ensureExpanded(30_000);

    await expect
      .poll(async () => (await logo.sidebarLogoUrl()).pathname)
      .toMatch(logoPath);
    expect((await logo.sidebarLogoUrl()).search).toBe('');
  });

  test('logo-02: admin uploads a light logo and the sidebar logo gains ?v= with no reload, in a second open tab and after a reload', async ({
    page,
    sidebarPage,
  }) => {
    const logo = new OrganizationLogoPage(page);
    const mock = await OrganizationLogoPage.mock(page);
    await page.reload();
    await sidebarPage.ensureExpanded(30_000);
    await expect.poll(() => logo.sidebarLogoVersion()).toBeNull();

    const secondTab = await page.context().newPage();
    await secondTab.goto(page.url());
    await new SidebarPage(secondTab).ensureExpanded(30_000);
    await expect.poll(() => logo.sidebarLogoVersion(secondTab)).toBeNull();

    await logo.open();
    await logo.uploadLight();
    await expect(
      page.getByText('Light logo uploaded successfully'),
    ).toBeVisible({ timeout: 10_000 });

    await expect
      .poll(() => logo.sidebarLogoVersion(), { timeout: 10_000 })
      .toMatch(/^\d+$/);
    const version = await logo.sidebarLogoVersion();
    expect(await logo.storedVersion(page, tenantKey)).toBe(version);
    expect((await logo.sidebarLogoUrl()).pathname).toMatch(logoPath);
    expect(mock.posts.length).toBeGreaterThan(0);

    await expect
      .poll(() => logo.sidebarLogoVersion(secondTab), { timeout: 10_000 })
      .toBe(version);
    await secondTab.close();

    await page.reload();
    await sidebarPage.ensureExpanded(30_000);
    await expect
      .poll(() => logo.sidebarLogoVersion(), { timeout: 10_000 })
      .toBe(version);
  });

  test('logo-03: admin whose light logo upload fails keeps the bare logo URL and no stored version', async ({
    page,
    sidebarPage,
  }) => {
    const logo = new OrganizationLogoPage(page);
    const mock = await OrganizationLogoPage.mock(page, 500);
    await page.reload();
    await sidebarPage.ensureExpanded(30_000);

    await logo.open();
    await logo.uploadLight();
    await expect(page.getByText('Failed to upload logo')).toBeVisible({
      timeout: 10_000,
    });

    expect(mock.posts.length).toBeGreaterThan(0);
    expect(await logo.sidebarLogoVersion()).toBeNull();
    expect(await logo.storedVersion(page, tenantKey)).toBeNull();
  });

  test('logo-04: admin uploads a dark logo and the sidebar logo does not change', async ({
    page,
    sidebarPage,
  }) => {
    const logo = new OrganizationLogoPage(page);
    const mock = await OrganizationLogoPage.mock(page);
    await page.reload();
    await sidebarPage.ensureExpanded(30_000);

    await logo.open();
    await logo.uploadDark();
    await expect(page.getByText('Dark logo uploaded successfully')).toBeVisible(
      {
        timeout: 10_000,
      },
    );

    expect(mock.posts.length).toBeGreaterThan(0);
    expect(mock.posts[0].path).toContain('/dark-mode-logo/create/');
    expect(await logo.sidebarLogoVersion()).toBeNull();
    expect(await logo.storedVersion(page, tenantKey)).toBeNull();
  });
});
