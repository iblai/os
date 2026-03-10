import { Page } from '@playwright/test';
import { logger } from '@iblai/iblai-js/playwright';
import { safeWaitForURL } from '@iblai/iblai-js/playwright';

type LoadAuthServiceFromRedirectedServiceOptions = {
  platform?: string;
  authHost: string;
  host: string;
};

export async function loadAuthServiceFromRedirectedService(
  page: Page,
  { authHost, host, platform }: LoadAuthServiceFromRedirectedServiceOptions
) {
  logger.info('wait to be redirected to auth service');

  if (platform === 'mentor') {
    await safeWaitForURL(
      page,
      `${authHost}/login?app=mentor&redirect-to=${host}`,
      { timeout: 60000 }
    );
  } else {
    await safeWaitForURL(page, `${authHost}/login?redirect-to=${host}`, {
      timeout: 60000,
    });
  }

  logger.info('wait for auth service to fully load');
  try {
    await page.waitForLoadState('domcontentloaded', { timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 60000 });

    logger.info('auth service loaded');
  } catch (error) {
    logger.info(`############# Networkidle timeout for auth page`);
  }
}

export function generateNewUserCredentials() {
  const timeStamp = Date.now();
  return {
    email: `test+${timeStamp}@ibleducation.com`,
    username: `test${timeStamp}`,
    password: 'test-password',
  };
}

type LoadAuthLogoutServiceOptions = {
  authHost: string;
  host: string;
};

export async function loadAuthServiceLogout(
  page: Page,
  { authHost, host }: LoadAuthLogoutServiceOptions
) {
  await safeWaitForURL(page, `${authHost}/logout?redirect-to=${host}`, {
    timeout: 60000,
  });
}

export async function authRequiresMagicLink(page: Page) {
  const url = new URL(page.url());
  return url.pathname.startsWith('/email/verify');
}
