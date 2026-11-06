import { Page, Locator, expect } from '@playwright/test';

// 1x1 transparent PNG: a valid image so the sidebar <img> never fires onError
// (which would swap the logo src for the fallback and mask the version).
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const LOGO_POST = /\/api\/core\/orgs\/[^/]+\/(dark-mode-)?logo\/create\/?$/;
const LOGO_IMAGE = /\/_next\/image\?.*logo/;

export interface LogoUploadMock {
  /** Number of logo POSTs the mock answered (none ever reaches the backend). */
  readonly posts: { path: string }[];
}

/**
 * Tenant settings > Workspace > Organization logo uploads, and the sidebar
 * brand logo they refresh. Logo uploads and the logo image are mocked, so the
 * tenant is never changed.
 */
export class OrganizationLogoPage {
  readonly page: Page;
  readonly dialog: Locator;
  readonly sidebarLogo: Locator;
  readonly lightInput: Locator;
  readonly darkInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByRole('dialog', { name: 'User Profile' });
    this.sidebarLogo = page.locator('aside').first().getByAltText('logo');
    this.lightInput = this.dialog.locator('input[type="file"]').nth(0);
    this.darkInput = this.dialog.locator('input[type="file"]').nth(1);
  }

  /** Answers logo uploads (200, or `status`) and every logo image request. */
  static async mock(page: Page, status = 200): Promise<LogoUploadMock> {
    const posts: { path: string }[] = [];
    const context = page.context();
    await context.route(
      (url) => LOGO_POST.test(url.pathname),
      async (route) => {
        if (route.request().method() !== 'POST') return route.fallback();
        posts.push({ path: new URL(route.request().url()).pathname });
        await route.fulfill({
          status,
          contentType: 'application/json',
          body: status === 200 ? '{}' : '{"detail":"mocked failure"}',
        });
      },
    );
    await context.route(LOGO_IMAGE, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: TINY_PNG,
      }),
    );
    return { posts };
  }

  /** The logo URL the sidebar asks for, with next/image's wrapper removed. */
  async sidebarLogoUrl(page: Page = this.page): Promise<URL> {
    const src = await page
      .locator('aside')
      .first()
      .getByAltText('logo')
      .getAttribute('src');
    const url = new URL(src ?? '', 'http://placeholder.invalid');
    return url.pathname === '/_next/image'
      ? new URL(url.searchParams.get('url') ?? '')
      : url;
  }

  async sidebarLogoVersion(page: Page = this.page): Promise<string | null> {
    return (await this.sidebarLogoUrl(page)).searchParams.get('v');
  }

  async storedVersion(page: Page, tenantKey: string): Promise<string | null> {
    return page.evaluate(
      (key) => localStorage.getItem(`tenant_logo_version:${key}`),
      tenantKey,
    );
  }

  async open(): Promise<void> {
    await this.page.getByRole('button', { name: 'More options' }).click();
    const platformName = await this.page.evaluate(() => {
      const raw = localStorage.getItem('current_tenant');
      return raw ? (JSON.parse(raw)?.platform_name as string) : null;
    });
    if (!platformName) throw new Error('current_tenant has no platform_name');
    await this.page
      .getByRole('menu', { name: 'More options' })
      .getByText(platformName, { exact: true })
      .click();
    await expect(this.dialog).toBeVisible({ timeout: 10_000 });
    await expect(this.lightInput).toBeAttached({ timeout: 15_000 });
  }

  async uploadLight(): Promise<void> {
    await this.lightInput.setInputFiles({
      name: 'logo.png',
      mimeType: 'image/png',
      buffer: TINY_PNG,
    });
  }

  async uploadDark(): Promise<void> {
    await this.darkInput.setInputFiles({
      name: 'dark.png',
      mimeType: 'image/png',
      buffer: TINY_PNG,
    });
  }
}
