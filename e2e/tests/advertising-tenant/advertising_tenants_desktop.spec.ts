import { test, expect, Page, BrowserContext } from "@playwright/test";
import {
  AUTH_HOST,
  MENTOR_NEXTJS_HOST,
  waitForPageReady,
  checkAdminStatus,
} from "../utils";
import { logger } from "@iblai/iblai-js/playwright";
import {
  configureMentorSettings,
  enablePublicRegistration,
  ensureSidebarOpen,
  performLogin,
  switchToAdvertisingTenant,
  verifyAdminStatus,
  verifyAdvancedFeaturesPromo,
  verifyVisibleButtons,
  verifyLoginPage,
  navigateToSignUp,
  createNewAccount,
  sendMessageAndVerifyResponse,
} from "./helpers";
import { safeWaitForURL } from "@iblai/iblai-js/playwright";

// Set ENABLE_ADVERTISING_LOGIN_TEST=true once the invalid UUID / session_id bug
// is fixed on the advertising tenant (new user onboarding).
// See: advertising tenant session_id UUID bug — new user lands with an invalid
// mentor UUID in session_id causing a runtime error during onboarding navigation.
const enableAdvertisingLoginTest = !!process.env.ENABLE_ADVERTISING_LOGIN_TEST;

test.describe("Advertising Tenant Tests", () => {
  let mentorUrl = "";
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    await page.goto(MENTOR_NEXTJS_HOST, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    const currentUrl = page.url();
    if (currentUrl.includes("/login") || currentUrl.includes(AUTH_HOST)) {
      await performLogin(page);
      await verifyAdminStatus(page);
    } else {
      await safeWaitForURL(
        page,
        (url) => /\/platform\/[^/]+\/[^/]+$/.test(url.href),
        { timeout: 60000 },
      );
    }

    await switchToAdvertisingTenant(page);
    await enablePublicRegistration(page);
    await configureMentorSettings(page);

    mentorUrl = page.url();
    logger.info(`Mentor URL captured: ${mentorUrl}`);

    // Wait for stability, close page first, then close context with error handling
    // This prevents Chromium crashes (SIGSEGV) that can occur when closing context abruptly
    await page.waitForTimeout(500);
    await page.close();
    try {
      await context.close();
    } catch (e) {
      logger.info(
        "Context close failed (may be Chromium crash), continuing...",
      );
    }
  });

  test.afterAll(async () => {
    await page?.close();
    await context?.close();
  });

  test.describe("Test Suite 1: user can access this mentor", () => {
    test("User can access mentor without login", async ({ browser }) => {
      const context = await browser.newContext({ storageState: undefined });
      const page = await context.newPage();

      expect(mentorUrl).toBeTruthy();
      await page.goto(mentorUrl, {
        waitUntil: "domcontentloaded",
        timeout: 80000,
      });

      // Wait for page to be ready by checking for a visible button
      await expect(page.getByRole("button", { name: /Log in/i })).toBeVisible({
        timeout: 60_000,
      });

      await verifyVisibleButtons(page, [
        { name: /Log in/i },
        { name: /Sign up for free/i },
        { name: /Invite user/i },
        { name: /New mentor/i },
        { name: "Mentors", exact: true },
        { name: /New chat/i },
        { name: /Notifications/i },
        { name: /Analytics/i },
        { name: /Settings/i },
      ]);

      await ensureSidebarOpen(page);
      await verifyAdvancedFeaturesPromo(page);

      await page?.close();
      await context?.close();
    });
  });

  test.describe("Test Suite 2: user can login to this mentor", () => {
    // Env-gated: blocked by invalid UUID / session_id bug on advertising tenant
    // new-user onboarding. Enable once the backend bug is fixed.
    test.skip(
      !enableAdvertisingLoginTest,
      "Set ENABLE_ADVERTISING_LOGIN_TEST=true after the advertising-tenant session_id UUID bug is fixed",
    );

    test("User can login to mentor", async ({ browser }) => {
      const context = await browser.newContext({ storageState: undefined });
      const page = await context.newPage();

      try {
        expect(mentorUrl).toBeTruthy();
        await page.goto(mentorUrl, {
          waitUntil: "domcontentloaded",
          timeout: 60_000,
        });
        await waitForPageReady(page);

        // Click Log in → arrives at auth login page
        const loginButton = page.getByRole("button", { name: /Log in/i });
        await expect(loginButton).toBeVisible({ timeout: 15_000 });
        await loginButton.click();

        await safeWaitForURL(page, (url) => url.href.includes("/login"), {
          timeout: 60_000,
        });

        await verifyLoginPage(page);
        await navigateToSignUp(page);
        await createNewAccount(page);

        // After account creation the app should navigate to the platform
        await safeWaitForURL(
          page,
          (url) => /\/platform\/[^/]+\/[^/]+$/.test(url.href),
          { timeout: 60_000 },
        );
        await waitForPageReady(page);

        // New user should be a non-admin
        const isAdmin = await checkAdminStatus(page);
        expect(isAdmin).toBe(false);

        // Verify the user can chat with the mentor
        await sendMessageAndVerifyResponse(page, "hello");
      } finally {
        await page.close();
        await context.close();
      }
    });
  });
});
