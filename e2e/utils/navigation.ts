import { Page } from '@playwright/test';

export interface SafeWaitForURLOptions {
  timeout?: number;
  waitUntil?: 'commit' | 'domcontentloaded' | 'load' | 'networkidle';
  maxRetries?: number;
}

function isFirefox(page: Page): boolean {
  return page.context().browser()?.browserType().name() === 'firefox';
}

function isNavigationAbortedError(error: unknown): boolean {
  const message = (error as Error)?.message ?? '';
  return (
    message.includes('NS_BINDING_ABORTED') ||
    message.includes('Navigation interrupted')
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
  const {
    timeout = 60_000,
    waitUntil = isFirefox(page) ? 'commit' : 'domcontentloaded',
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
