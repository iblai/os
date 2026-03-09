import type { Browser, Page, BrowserContext } from '@playwright/test';
import { MENTOR_NEXTJS_HOST } from '../../../utils';
import { safeWaitForURL } from '@iblai/iblai-js/playwright';

type Props = {
  browser: Browser;
  platformKey: string;
  mentorId: string;
  clearStorageState?: boolean;
};

export async function navigateToSpecificTenantAndMentor({
  browser,
  platformKey,
  mentorId,
  clearStorageState = true,
}: Props): Promise<Page> {
  let _context: BrowserContext;

  if (clearStorageState) {
    _context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
  } else {
    _context = await browser.newContext();
  }

  const page = await _context.newPage();

  await page.goto(`${MENTOR_NEXTJS_HOST}/platform/${platformKey}/${mentorId}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });

  // wait until url starts with mentor nextjs platform url this is to ensure we land on the expected url and not redirected to another

  await safeWaitForURL(
    page,
    (url) => url.href.startsWith(MENTOR_NEXTJS_HOST + '/platform'),
    { timeout: 60000 }
  );

  // explicitly wait for 5 seconds
  await page.waitForTimeout(5_000);

  return page;
}
