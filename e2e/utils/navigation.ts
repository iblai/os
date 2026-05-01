import { Page } from '@playwright/test';

import { expect } from '../fixtures/mentor-test';
export interface SafeWaitForURLOptions {
  timeout?: number;
  waitUntil?: 'commit' | 'domcontentloaded' | 'load' | 'networkidle';
  maxRetries?: number;
}

function isFirefox(page: Page): boolean {
  return page.context().browser()?.browserType().name() === 'firefox';
}

function isWebKit(page: Page): boolean {
  return page.context().browser()?.browserType().name() === 'webkit';
}

function isNavigationAbortedError(error: unknown): boolean {
  const message = (error as Error)?.message ?? '';
  return (
    message.includes('NS_BINDING_ABORTED') ||
    message.includes('Navigation interrupted') ||
    message.includes('net::ERR_ABORTED')
  );
}

function isSafariNavigationPolicyError(error: unknown): boolean {
  const message = (error as Error)?.message ?? '';
  return message.includes('Navigation canceled by policy check');
}

function urlMatchesPattern(
  currentUrl: string,
  pattern: string | RegExp | ((url: URL) => boolean),
): boolean {
  try {
    const url = new URL(currentUrl);
    if (typeof pattern === 'function') return pattern(url);
    if (pattern instanceof RegExp) return pattern.test(currentUrl);
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*');
    return new RegExp(`^${regexPattern}$`).test(currentUrl);
  } catch {
    return false;
  }
}

/**
 * Safe wrapper around page.waitForURL that handles browser-specific
 * navigation errors (Firefox NS_BINDING_ABORTED, Safari policy errors).
 */
export async function safeWaitForURL(
  page: Page,
  urlPattern: string | RegExp | ((url: URL) => boolean),
  options: SafeWaitForURLOptions = {},
): Promise<void> {
  // WebKit needs "load" to ensure all chunks have finished loading before
  // proceeding, otherwise ChunkLoadError can occur on subsequent navigations.
  // Firefox uses "commit" to avoid NS_BINDING_ABORTED errors.
  const defaultWaitUntil = isWebKit(page)
    ? 'load'
    : isFirefox(page)
      ? 'commit'
      : 'domcontentloaded';

  const {
    timeout = 120_000,
    waitUntil = defaultWaitUntil,
    maxRetries = 3,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await page.waitForLoadState('load', { timeout });
      await page.waitForURL(urlPattern, { timeout, waitUntil });
      return;
    } catch (error) {
      lastError = error as Error;

      if (isNavigationAbortedError(error)) {
        if (urlMatchesPattern(page.url(), urlPattern)) return;
        if (attempt < maxRetries) {
          await page.waitForTimeout(500 * attempt);
          continue;
        }
      }

      if (isSafariNavigationPolicyError(error)) {
        await page.waitForTimeout(3_000);
        await page.waitForLoadState('domcontentloaded');
        if (urlMatchesPattern(page.url(), urlPattern)) return;
        if (attempt < maxRetries) continue;
      }

      throw error;
    }
  }
  throw lastError;
}

export interface ParsedPlatformUrl {
  platformKey: string;
  mentorId: string;
}

/**
 * Extracts tenantKey and mentorId from a /platform/{tenantKey}/{mentorId} URL.
 */
export function parsePlatformUrl(url: string): ParsedPlatformUrl {
  const { pathname } = new URL(url);
  const parts = pathname.split('/').filter(Boolean);

  if (parts[0] !== 'platform' || parts.length < 3) {
    throw new Error(
      `Unexpected URL format. Expected /platform/{tenantKey}/{mentorId}, got: ${pathname}`,
    );
  }

  return {
    platformKey: parts[1],
    mentorId: parts[2],
  };
}

/**
 * Navigate directly to the tenant-level explore page (/platform/{tenantKey}/explore).
 * First lands on the platform to resolve the tenant key, then navigates to
 * the explore page and waits for the heading to confirm stability.
 */
export async function navigateToTenantExplorePage(page: Page): Promise<string> {
  const host = process.env.MENTOR_NEXTJS_HOST || '';

  // Navigate to the platform root to resolve tenant key via auth/redirect
  await page.goto(host, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await safeWaitForURL(page, (url) => url.pathname.startsWith('/platform/'), {
    timeout: 120_000,
  });

  const { platformKey: tenantKey } = parsePlatformUrl(page.url());

  // Navigate to the tenant explore page
  await page.goto(`${host}/platform/${tenantKey}/explore`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });

  // Wait for explore heading to confirm the page is stable
  const heading = page.getByRole('heading', { name: /all agents/i });
  await expect(heading).toBeVisible({ timeout: 60_000 });

  return tenantKey;
}

export async function openMoreOptionsMenu(page: Page) {
  const moreOptionsButton = page
    .locator('nav button[aria-haspopup="menu"]')
    .last();
  await expect(moreOptionsButton).toBeVisible({ timeout: 10000 });
  await moreOptionsButton.click();
  console.log('✓ More options button clicked');

  const menuModal = page
    .getByRole('menu', { name: /more options/i })
    .or(page.getByRole('dialog'));
  await expect(menuModal).toBeVisible({ timeout: 5000 });
  console.log('✓ Menu modal visible');

  return menuModal;
}
