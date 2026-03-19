import test, { BrowserContext, expect, Page } from "@playwright/test";
import { AUTH_HOST, MENTOR_NEXTJS_HOST } from "../utils";
import { checkAdminStatus } from "../utils";
import { openMoreOptionsMenu, openSidebar } from "./helpers";
import { logger } from "@iblai/iblai-js/playwright";
import { safeWaitForURL } from "@iblai/iblai-js/playwright";

test.describe("Newly Created User Test Suites", () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    logger.info("BeforeEach: Starting sign-up flow");

    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).slice(-8);
    const email = `playwright+${timestamp}_${randomSuffix}@example.com`;
    const password = "ibledu_2024";
    logger.info(`Generated test email: ${email}`);

    context = await browser.newContext({ storageState: undefined });
    page = await context.newPage();

    logger.info(`Navigating to ${MENTOR_NEXTJS_HOST}`);
    await page.goto(MENTOR_NEXTJS_HOST);
    await safeWaitForURL(
      page,
      (url) => url.href.startsWith(AUTH_HOST + "/login"),
      {
        timeout: 60000,
      },
    );

    logger.info("✓ Redirected to login page");

    await expect(
      page.getByRole("heading", { name: "Create Your Own Agent" }),
    ).toBeVisible({ timeout: 120_000 });
    logger.info("✓ Landing page heading visible");

    const signUpBtn = page.getByRole("button", { name: "Sign up" });
    await expect(signUpBtn).toBeVisible();
    await signUpBtn.click();
    logger.info("✓ Sign up button clicked");

    // expect we are redirected to the sign up page

    await safeWaitForURL(
      page,
      (url) => url.href.startsWith(AUTH_HOST + "/account"),
      {
        timeout: 60000,
      },
    );

    const signUpWithPassword = page.getByRole("button", {
      name: "Continue with Password",
    });
    await expect(signUpWithPassword).toBeVisible();
    await signUpWithPassword.click();
    logger.info("✓ Continue with Password clicked");

    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password", { exact: true }).fill(password);
    await page.getByPlaceholder("Confirm Password").fill(password);
    logger.info("✓ Sign-up form filled");

    const createAccountBtn = page.getByRole("button", {
      name: /create account/i,
    });
    await expect(createAccountBtn).toBeVisible();
    await createAccountBtn.click();
    logger.info("✓ Create account button clicked");

    await safeWaitForURL(page, (url) => url.href.includes("/platform"), {
      timeout: 120000,
    });

    expect(page.url()).toContain("main");
    logger.info(`✓ URL validated: ${page.url()}`);

    const adminStatus = await checkAdminStatus(page);
    expect(adminStatus).toBeFalsy();
    logger.info("✓ Admin status verified (student)");

    await expect(
      page.getByRole("heading", { name: "Explore Mentors" }),
    ).toBeVisible({ timeout: 120_000 });
    logger.info("wait for page to be full loaded");

    const newChatButton = page.getByRole("button", { name: "New Chat" });
    await expect(newChatButton).toBeVisible({ timeout: 10000 });
    logger.info("✓ New Chat button visible");
    logger.info("BeforeEach: Sign-up flow completed successfully");
  });

  test.afterEach(async () => {
    if (context) {
      // Wait for stability, close page first, then close context with error handling
      // This prevents Chromium crashes (SIGSEGV) that can occur when closing context abruptly
      if (page && !page.isClosed()) {
        await page.waitForTimeout(500);
        await page.close();
      }
      try {
        await context.close();
        logger.info("✓ Context closed in afterEach");
      } catch (e) {
        logger.info(
          "Context close failed (may be Chromium crash), continuing...",
        );
      }
    }
  });

  test("Test Suite 1: Newly created user should be able to click on the explore page", async () => {
    logger.info("Test Suite 1: User can click on explore page");

    const sidebarDialog = await openSidebar(page);

    const mentorsButton = sidebarDialog.getByRole("button", {
      name: /mentors/i,
    });
    await expect(mentorsButton).toBeVisible({ timeout: 10000 });
    await mentorsButton.click();
    logger.info("✓ Mentors button clicked");

    await safeWaitForURL(page, (url) => url.pathname.includes("/explore"), {
      timeout: 15000,
    });
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/platform\/[^/]+\/[^/]+\/explore/);
    logger.info(`✓ URL verified: ${currentUrl}`);

    await expect(
      page.getByRole("heading", { name: /all mentors/i }),
    ).toBeVisible({ timeout: 10000 });
    logger.info("✓ All Mentors heading visible");

    const featuredMentorsHeading = page
      .getByRole("heading", { name: /featured mentors/i })
      .first();
    if (await featuredMentorsHeading.isVisible().catch(() => false)) {
      logger.info("✓ Featured Mentors section visible");
    }

    logger.info("✓ Test Suite 1 passed");
  });

  test("Test Suite 2: Newly created user should be able to logout", async () => {
    logger.info("Test Suite 2: User can logout");

    const menuModal = await openMoreOptionsMenu(page);

    const logoutMenuItem = menuModal.getByRole("menuitem", {
      name: /log out/i,
    });
    await expect(logoutMenuItem).toBeVisible();
    await logoutMenuItem.click();
    logger.info("✓ Logout menu item clicked");

    await safeWaitForURL(
      page,
      (url) => url.href.startsWith(AUTH_HOST + "/login"),
      {
        timeout: 60000,
      },
    );
    const currentUrl = page.url();
    expect(currentUrl).toContain("/login");
    logger.info(`✓ URL verified: ${currentUrl}`);

    logger.info("✓ Test Suite 2 passed");
  });

  test("Test Suite 3: Newly created user can open and close sidebar", async () => {
    logger.info("Test Suite 3: User can open and close sidebar");

    const sidebar = page
      .locator('div[data-slot="sidebar"][data-state]')
      .first();
    const sidebarToggle = page
      .getByRole("button", {
        name: /(toggle sidebar|close sidebar|open sidebar)/i,
      })
      .or(page.locator('button:has(img[alt="Toggle Sidebar"])'));

    await expect(sidebarToggle).toBeVisible({ timeout: 10000 });
    logger.info("✓ Sidebar toggle button visible");

    const initialState = await sidebar.getAttribute("data-state");
    const isInitiallyExpanded = initialState === "expanded";
    logger.info(`✓ Initial sidebar state: ${initialState}`);

    // Test toggle functionality - expect assertions already have timeout, no need for waitForTimeout
    if (isInitiallyExpanded) {
      await sidebarToggle.click();
      await expect(sidebar).toHaveAttribute("data-state", "collapsed", {
        timeout: 5000,
      });
      logger.info("✓ Sidebar collapsed successfully");

      await sidebarToggle.click();
      await expect(sidebar).toHaveAttribute("data-state", "expanded", {
        timeout: 5000,
      });
      logger.info("✓ Sidebar expanded successfully");
    } else {
      await sidebarToggle.click();
      await expect(sidebar).toHaveAttribute("data-state", "expanded", {
        timeout: 5000,
      });
      logger.info("✓ Sidebar expanded successfully");

      await sidebarToggle.click();
      await expect(sidebar).toHaveAttribute("data-state", "collapsed", {
        timeout: 5000,
      });
      logger.info("✓ Sidebar collapsed successfully");

      await sidebarToggle.click();
      await expect(sidebar).toHaveAttribute("data-state", "expanded", {
        timeout: 5000,
      });
      logger.info("✓ Sidebar opened again for logo verification");
    }

    // Verify logo
    const logo = page.locator('img[alt="logo"]');
    await expect(logo).toBeVisible({ timeout: 10000 });
    logger.info("✓ Platform logo visible");

    const logoSrc = await logo.getAttribute("src");
    expect(logoSrc).toBeTruthy();
    logger.info("✓ Logo image has valid src attribute");

    const logoButton = page.locator('button:has(img[alt="logo"])');
    await expect(logoButton).toBeVisible({ timeout: 10000 });
    await logoButton.click();
    logger.info("✓ Platform logo clicked");

    // Verify new/existing chat session
    const exploreHeading = page.getByRole("heading", {
      name: /explore mentors/i,
    });
    const hasExploreHeading = await exploreHeading
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const chatResponse = page.locator(".chat-ai-message-response").first();
    const hasChatResponse = await chatResponse
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasExploreHeading || hasChatResponse).toBeTruthy();

    if (hasExploreHeading) {
      logger.info(
        "✓ New chat session verified - Explore mentors heading visible",
      );
    } else if (hasChatResponse) {
      logger.info("✓ Existing chat session verified - Chat response visible");
    }

    logger.info("✓ Test Suite 3 passed");
  });

  test("Test Suite 4: Newly created user can click on the help button", async () => {
    logger.info("Test Suite 4: User can click help button");

    const menuModal = await openMoreOptionsMenu(page);

    const helpMenuItem = menuModal.getByRole("menuitem", { name: /help/i });
    await expect(helpMenuItem).toBeVisible();

    const [docsPage] = await Promise.all([
      page.context().waitForEvent("page"),
      helpMenuItem.click(),
    ]);

    logger.info("✓ Help menu item clicked");

    await docsPage.waitForLoadState("domcontentloaded");

    await expect(docsPage).toHaveURL(/https:\/\/ibl\.ai\/docs/);

    const currentUrl = docsPage.url();
    expect(currentUrl).toContain("ibl.ai/docs");

    logger.info(`✓ URL verified: ${currentUrl}`);

    logger.info("✓ Test Suite 4 passed");
  });
});
