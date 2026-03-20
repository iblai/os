import { test, expect } from "../fixtures/mentor-test";
import { navigateToMentorApp } from "../utils/auth";
import { MENTOR_NEXTJS_HOST } from "../fixtures/test-data";
import { logger } from "@iblai/iblai-js/playwright";
import type { ConsoleMessage } from "@playwright/test";

/**
 * Console errors that are known-benign and intentionally ignored.
 * Mirrors the original ui-render-console-errors.common.spec.ts ignoredErrors set.
 */
const IGNORED_ERRORS: Array<string | RegExp> = [
  "There was an error setting cookie `_pk_testcookie_domain`",
  "Can't write cookie on domain",
  "downloadable font: download failed",
  "Download the React DevTools",
  "It looks like there are several instances of 'styled-components'",
  'Cookie "_pk_testcookie_domain" has been rejected',
  "Warning: React does not recognize the `dataSlot` prop",
  'Cookie "openedx-language-preference" does not have a proper "SameSite" attribute value',
  "Layout was forced before the page was fully loaded",
  'Matched leaf route at location "/" does not have an element or Component',
  'does not have a proper "SameSite" attribute value',
  "matomo.js",
  'is registered more than once in "_paq" variable',
  "Couldn't process unknown directive 'require-trusted-types-for'",
  "youtube",
  'The resource from "https://drive.google.com',
  /A resource is blocked by OpaqueResponseBlocking/,
  /Error occurred: \{readyState: 4/,
  /.*Failed to load resource.*/,
  /.*Intercom Messenger error.*/,
];

function isIgnoredError(message: string): boolean {
  for (const pattern of IGNORED_ERRORS) {
    if (pattern instanceof RegExp) {
      if (pattern.test(message)) return true;
    } else {
      if (message.includes(pattern)) return true;
    }
  }
  return false;
}

test.describe("Journey 33: UI Render Console Errors", () => {
  test("non-admin goes to the platform URL and sees no render failures or console errors", async ({
    nonadminPage,
  }) => {
    const consoleErrors: string[] = [];

    const handleConsole = (msg: ConsoleMessage) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (!isIgnoredError(text)) {
          logger.info(`Console error (not ignored): ${text}`);
          consoleErrors.push(`${msg.location().url}: ${text}`);
        }
      }
    };

    nonadminPage.on("console", handleConsole);

    try {
      await navigateToMentorApp(nonadminPage);

      // Ensure the root element has rendered children
      const hasChildren = await nonadminPage.evaluate(() => {
        const root = document.getElementById("root") ?? document.body;
        return root?.hasChildNodes() ?? false;
      });

      if (consoleErrors.length) {
        logger.info(`Console errors at /:\n${consoleErrors.join("\n")}`);
      }

      expect(hasChildren).toBe(true);
      expect(consoleErrors).toHaveLength(0);
    } finally {
      nonadminPage.off("console", handleConsole);
    }
  });
});
