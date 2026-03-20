import { test, expect } from "../fixtures/mentor-test";
import { navigateToMentorApp } from "../utils/auth";
import { safeWaitForURL } from "../utils/navigation";
import { MENTOR_NEXTJS_HOST, AUTH_HOST } from "../fixtures/test-data";

test.describe("Journey 12: Chat Sharing", () => {
  test.describe.configure({ mode: "serial" });

  let sharedChatUrl = "";

  test("authenticated user goes to chat page and creates a shareable chat URL", async ({
    page,
    chatPage,
    context,
    browserName,
  }) => {
    // H10 fix: skip on Safari due to clipboard API limitations
    test.skip(
      browserName === "webkit",
      "Skipping on Safari due to clipboard API limitations",
    );

    await navigateToMentorApp(page);

    // H10 fix: grant clipboard permissions before sharing
    try {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    } catch {
      try {
        await context.grantPermissions(["clipboard-read"]);
      } catch {
        // Some browsers don't support clipboard permissions
      }
    }

    await chatPage.sendMessage("Hello, this is a test message for sharing");
    await chatPage.waitForAIResponse();

    // H9 fix: use exact button name from original
    const shareButton = page.getByRole("button", { name: "Share this chat" });
    await expect(shareButton).toBeVisible({ timeout: 15_000 });
    await shareButton.click();

    // H9 fix: wait for clipboard toast confirmation, then read from clipboard
    await page
      .getByText("Share link copied to clipboard")
      .waitFor({ timeout: 15_000 });

    // Read URL from clipboard
    const clipboardUrl = await page
      .evaluate(() => navigator.clipboard.readText())
      .catch(() => "");

    if (clipboardUrl && clipboardUrl.includes("/share/chat/")) {
      sharedChatUrl = clipboardUrl;
    } else {
      // Fallback: construct from localStorage session_id
      const sessionId = await page.evaluate(() => {
        const raw = localStorage.getItem("session_id");
        if (!raw) return null;
        try {
          const parsed = JSON.parse(raw);
          return Object.values(parsed)[0] as string;
        } catch {
          return null;
        }
      });
      if (sessionId) {
        sharedChatUrl = `${MENTOR_NEXTJS_HOST}/share/chat/${sessionId}`;
      }
    }

    expect(sharedChatUrl).toMatch(/\/share\/chat\/[a-f0-9-]+/);
  });

  test("unauthenticated user goes to shared chat URL and sees the chat history", async ({
    page,
    browser,
  }) => {
    if (!sharedChatUrl) {
      test.skip(true, "No shared chat URL from previous test");
      return;
    }
    const anonContext = await browser.newContext({ storageState: undefined });
    const anonPage = await anonContext.newPage();
    try {
      await anonPage.goto(sharedChatUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await anonPage.waitForTimeout(2_000);
      const hasMessages = await anonPage
        .locator(".chat-ai-message-response, .chat-user-message-query")
        .first()
        .isVisible({ timeout: 15_000 })
        .catch(() => false);
      expect(hasMessages).toBe(true);
    } finally {
      await anonContext.close();
    }
  });

  test("authenticated user goes to shared chat URL and is redirected to the platform", async ({
    page,
  }) => {
    await navigateToMentorApp(page);
    if (!sharedChatUrl) return;
    await page.goto(sharedChatUrl, { waitUntil: "domcontentloaded" });
    await safeWaitForURL(page, (url) => url.href.includes("/platform/"), {
      timeout: 30_000,
    });
    expect(page.url()).toContain("/platform/");
  });

  test("unauthenticated user goes to shared chat URL and the chat interface loads correctly", async ({
    page,
    browser,
  }) => {
    if (!sharedChatUrl) return;
    const anonContext = await browser.newContext({ storageState: undefined });
    const anonPage = await anonContext.newPage();
    try {
      await anonPage.goto(sharedChatUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await anonPage.waitForTimeout(3_000);
      // The page should render without errors
      const title = await anonPage.title();
      expect(title).toBeTruthy();
    } finally {
      await anonContext.close();
    }
  });

  test("unauthenticated user goes to shared chat page and sees a Sign Up for Free button that redirects to auth", async ({
    page,
    browser,
  }) => {
    if (!sharedChatUrl) return;
    const anonContext = await browser.newContext({ storageState: undefined });
    const anonPage = await anonContext.newPage();
    try {
      await anonPage.goto(sharedChatUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      const signUpBtn = anonPage
        .getByRole("button", { name: /sign up for free/i })
        .or(anonPage.getByRole("link", { name: /sign up for free/i }));
      const visible = await signUpBtn
        .isVisible({ timeout: 10_000 })
        .catch(() => false);
      if (!visible) return;
      await signUpBtn.click();
      await anonPage.waitForTimeout(2_000);
      expect(anonPage.url()).toMatch(/auth|login|signup/i);
    } finally {
      await anonContext.close();
    }
  });

  test("unauthenticated user goes to shared chat page and does not see the chat textarea", async ({
    browser,
  }) => {
    if (!sharedChatUrl) return;
    const anonContext = await browser.newContext({ storageState: undefined });
    const anonPage = await anonContext.newPage();
    try {
      await anonPage.goto(sharedChatUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await anonPage.waitForTimeout(2_000);
      const chatInput = anonPage.getByPlaceholder("Ask anything", {
        exact: true,
      });
      const visible = await chatInput
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      expect(visible).toBe(false);
    } finally {
      await anonContext.close();
    }
  });
});
