import { test, expect, ConsoleMessage } from '@playwright/test';
import {
  ANALYTICS_HOST,
  AUTH_HOST,
  SKILL_HOST,
  analyticsUrlsToTest,
  skillsUrlsToTest,
  mentorUrlsToTest,
  authUrlsToTest,
  MENTOR_HOST,
} from './utils';

const platformHostMap = {
  skills: SKILL_HOST,
  analytics: ANALYTICS_HOST,
  mentor: MENTOR_HOST,
  auth: AUTH_HOST,
};

const platformTestUrlsMap = {
  skills: skillsUrlsToTest,
  analytics: analyticsUrlsToTest,
  mentor: mentorUrlsToTest,
  auth: authUrlsToTest,
};

const platform = process.env.PLATFORM || 'skills';

const HOST = platformHostMap[platform];
const TEST_URLS = platformTestUrlsMap[platform];

const ignoredErrors = new Set([
  'There was an error setting cookie `_pk_testcookie_domain`. Please check domain and path.',
  "Can't write cookie on domain *.stg.acilearning.com",
  'downloadable font: download failed',
  'Download the React DevTools for a better development experience',
  "It looks like there are several instances of 'styled-components' initialized in this application",
  'Cookie “_pk_testcookie_domain” has been rejected for invalid domain.',
  'Warning: React does not recognize the `dataSlot` prop on a DOM element',
  'Cookie “openedx-language-preference” does not have a proper “SameSite” attribute value',
  'Layout was forced before the page was fully loaded',
  'Matched leaf route at location "/" does not have an element or Component',
  'does not have a proper “SameSite” attribute value',
  'matomo.js',
  'does not have a proper “SameSite” attribute value',
  'is registered more than once in "_paq" variable',
  'Couldn’t process unknown directive ‘require-trusted-types-for',
  'youtube',
  'The resource from “https://drive.google.com',
  new RegExp(
    'A resource is blocked by OpaqueResponseBlocking, please check browser console for details'
  ),
  new RegExp(
    'Error occurred: {readyState: 4, getResponseHeader: , getAllResponseHeaders: , setRequestHeader: , overrideMimeType: }'
  ),
  new RegExp('.*Failed to load resource.*'),
  new RegExp('.*Intercom Messenger error.*'),
]);

const isIgnoredError = (message) => {
  // @ts-ignore
  for (let error of ignoredErrors) {
    if (error instanceof RegExp) {
      if (error.test(message)) return true;
    } else {
      if (message.includes(error)) return true;
    }
  }
  return false;
};

/*TEST_URLS.forEach((url) => {
  test(`Ensure No Render Failures or Console Errors at ${url}`, async ({
    page,
  }, testInfo) => {
    let consoleErrors: string[] = [];

    const handleConsole = (message: ConsoleMessage) => {
      console.log(
        `################## Found console error on ${url}: ${message.text()}`
      );
      if (!isIgnoredError(message.text())) {
        console.log(
          '########################### Console Error above is not ignored'
        );
        consoleErrors.push(`${message.location().url}: ${message.text()}`);
      }
    };

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        handleConsole(msg);
      }
    });

    await page.goto(`${HOST}${url}`);
    // await page.goto(`${HOST}${url}`, { waitUntil: 'networkidle' });

    // try {
    //   await page.waitForLoadState('domcontentloaded', { timeout: 60000 });
    //   await page.waitForLoadState('networkidle', { timeout: 60000 });
    // } catch (error) {
    //   console.log(
    //     `############# Networkidle timeout for ${url}. Continuing with test...`
    //   );
    // }
    console.log('############### Current page url ', page.url());

    // Wait for specific elements if content is loaded dynamically
    await page.waitForSelector('#root > *', { timeout: 60000 });

    const hasChildren = await page.evaluate(() => {
      const root = document.getElementById('root');
      console.log('################## ', root);
      return root && root.hasChildNodes();
    });

    if (consoleErrors.length) {
      console.error(
        `Console Errors for ${url}:\n${consoleErrors.join(
          '\n'
        )}\n################### END`
      );
    }

    expect(hasChildren).toBeTruthy();
    expect(consoleErrors).toHaveLength(0);

    page.off('console', handleConsole);
  });
});*/
