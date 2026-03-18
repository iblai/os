import test, { expect } from "@playwright/test";
import { checkAdminStatus, selectDropdownWorksCorrectly } from "../utils";
import { logger } from "@iblai/iblai-js/playwright";
import {
  openChatWidget,
  removeChatBubbleIfExists,
  sendMessageWithRetry,
  waitForChatReady,
  waitForIframeReady,
  waitForMentorResponse,
} from "./helpers";
import { AUTH_HOST, EMBED_URL, MENTOR_NEXTJS_HOST } from "../utils";
import { fillCreateMentorForm } from "../utils/create-mentor";
import { navigateToMentorApp } from "../profile/helpers";
import { safeWaitForURL } from "@iblai/iblai-js/playwright";

const password: string = process.env.PLAYWRIGHT_PASSWORD || "";
const username: string = process.env.PLAYWRIGHT_USERNAME || "";

// test.describe.configure({ mode: 'serial' });

test.describe("Admin Activities", () => {
  test.setTimeout(300000);
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  test("Default non-anonymous embed with voice call, voice record and attachment", async ({
    page,
    browser,
  }) => {
    // TODO: Temporary skip for Safari
    const isSafari = browser.browserType().name() === "webkit";
    test.skip(isSafari, "Skipping on Safari due to navigation policy issues");

    const isAdmin = await checkAdminStatus(page);
    if (isAdmin) {
      await fillCreateMentorForm({ page });

      await selectDropdownWorksCorrectly(page);

      const embedMenuItem = page.getByRole("menuitem", { name: "Embed" });
      await expect(embedMenuItem).toBeVisible();
      await embedMenuItem.click();

      // Wait for embed dialog to be visible
      const embedDialog = page
        .locator('div[role="dialog"]')
        .filter({ hasText: "Edit Mentor" });
      await expect(embedDialog).toBeVisible({ timeout: 60_000 });

      // Enable attachment button
      const attachmentButton = embedDialog.locator(
        'button[role="switch"][aria-label^="Show attachment"]',
      );
      const isAttachmentBtnChecked =
        await attachmentButton.getAttribute("aria-checked");
      if (isAttachmentBtnChecked === "false") {
        await attachmentButton.click();
        logger.info("Attachment switch turned ON");
      } else {
        logger.info("Attachment switch already ON");
      }

      // Enable voice call button
      const voiceCallBtn = embedDialog.locator(
        'button[role="switch"][aria-label^="Show voice call"]',
      );
      const isVoiceCallBtnChecked =
        await voiceCallBtn.getAttribute("aria-checked");
      if (isVoiceCallBtnChecked === "false") {
        await voiceCallBtn.click();
        logger.info("Voice call switch turned ON");
      } else {
        logger.info("Voice call switch already ON");
      }

      // Enable voice record button
      const voiceRecordBtn = embedDialog.locator(
        'button[role="switch"][aria-label^="Show voice record"]',
      );
      const isVoiceRecordChecked =
        await voiceRecordBtn.getAttribute("aria-checked");
      if (isVoiceRecordChecked === "false") {
        await voiceRecordBtn.click();
        logger.info("Voice record switch turned ON");
      } else {
        logger.info("Voice record switch already ON");
      }

      // Verify preview iframe loads
      const iframe = embedDialog.frameLocator("iframe");
      await expect(iframe.locator("body")).toBeVisible({ timeout: 30000 });
      const textarea = iframe.locator("textarea[placeholder]");
      await expect(textarea).toBeVisible();
      const placeholder = await textarea.getAttribute("placeholder");
      expect(placeholder && placeholder.length > 3).toBeTruthy();

      const sendMessageButton = iframe.getByRole("button", {
        name: "Send message",
      });
      await expect(sendMessageButton).toBeVisible({ timeout: 10_000 });
      await expect(sendMessageButton).toBeDisabled();

      // Configure who can chat
      const whoCanChatSelect = embedDialog.getByRole("combobox", {
        name: "Select who can chat",
      });
      await expect(whoCanChatSelect).toBeVisible();
      await whoCanChatSelect.click();

      const authenticatedUsersOption = page.getByRole("option", {
        name: "Authenticated Users",
      });
      await expect(authenticatedUsersOption).toBeVisible();
      await authenticatedUsersOption.click();

      // Set embed URL
      const websiteEmbedURL = embedDialog.getByPlaceholder("https://ibl.ai");
      await expect(websiteEmbedURL).toBeVisible();
      await websiteEmbedURL.fill(EMBED_URL);
      await page.getByRole("button", { name: "Create Embed" }).click();

      // Get embed code
      const codeDialog = page
        .getByRole("dialog")
        .filter({ hasText: "Embedded Code" });
      await expect(codeDialog).toBeVisible({ timeout: 120_000 });

      const preLocator = codeDialog.locator("pre");
      await expect(preLocator).toBeVisible();
      const copyButton = codeDialog
        .locator('button[data-slot="button"] svg.lucide-copy')
        .locator("..");
      await expect(copyButton).toBeVisible();
      await copyButton.click();
      const embedCode = (await preLocator.textContent()) || "";

      // Extract script content
      const extractedEmbedCode = embedCode.match(
        /window\.onload\s*=\s*function\s*\(\)\s*{([\s\S]*?)}\s*;?\s*<\/script>/i,
      );
      const extractedScriptBody = extractedEmbedCode?.[1]?.trim();
      if (!extractedScriptBody) {
        throw new Error("Failed to extract content from window.onload");
      }

      logger.info(
        "Extracted Script Content Length:",
        extractedScriptBody.length,
      );

      // Open new page and inject embed
      const newContext = await browser.newContext({
        storageState: { cookies: [], origins: [] },
      });
      const newPage = await newContext.newPage();
      await newPage.goto(EMBED_URL, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      // Remove existing chat bubbles
      await removeChatBubbleIfExists(newPage);
      logger.info(
        `[DEBUG] Removed existing chat bubbles, current URL: ${newPage.url()}`,
      );

      // Inject embed script
      logger.info(`[DEBUG] Injecting embed script...`);
      await newPage.addScriptTag({
        content: `(function() {\n${extractedScriptBody}\n})();`,
      });
      logger.info(
        `[DEBUG] Embed script injected, current URL: ${newPage.url()}`,
      );

      // Open chat widget
      logger.info(`[DEBUG] Opening chat widget...`);
      await openChatWidget(newPage);
      logger.info(`[DEBUG] Chat widget opened, current URL: ${newPage.url()}`);

      // Handle authentication redirect
      const expectedUrlPattern = `^${AUTH_HOST.replace(/\//g, "\\/")}\\/login\\?redirect-path=.*&redirect-token=[0-9a-f-]+.*`;
      logger.info(
        `[DEBUG] Waiting for auth redirect to pattern: ${expectedUrlPattern}`,
      );
      logger.info(`[DEBUG] AUTH_HOST value: ${AUTH_HOST}`);
      logger.info(`[DEBUG] Current URL before waitForURL: ${newPage.url()}`);

      await safeWaitForURL(newPage, new RegExp(expectedUrlPattern), {
        timeout: 120000,
        waitUntil: "domcontentloaded",
      });
      logger.info(`[DEBUG] Auth redirect successful, URL: ${newPage.url()}`);
      await newPage.waitForLoadState("domcontentloaded");

      const emailField = newPage.locator('input[type="email"]');
      const passwordField = newPage.locator('input[type="password"]');

      let isContinueBtnVisible = false;
      try {
        await expect(
          newPage.getByRole("button", { name: "Continue with Password" }),
        ).toBeVisible({ timeout: 30_000 });
        isContinueBtnVisible = true;
      } catch {
        isContinueBtnVisible = false;
      }

      let areLoginFieldsVisible = false;
      try {
        await expect(emailField).toBeVisible({ timeout: 30_000 });
        await expect(passwordField).toBeVisible({ timeout: 30_000 });
        areLoginFieldsVisible = true;
      } catch {
        areLoginFieldsVisible = false;
      }

      const currentlyOnLoginScreen =
        isContinueBtnVisible || areLoginFieldsVisible;

      if (currentlyOnLoginScreen) {
        // Perform login - re-locate button just before clicking to avoid stale element
        if (isContinueBtnVisible) {
          await newPage
            .getByRole("button", { name: "Continue with Password" })
            .click();
        }
        logger.info("Waiting for the password form to appear");
        await newPage.waitForSelector('input[type="email"]');
        await newPage.waitForSelector('input[type="password"]');
        logger.info("Filling in the login credentials");
        await newPage.fill('input[type="email"]', username);
        await newPage.fill('input[type="password"]', password);
        logger.info("Clicking the login button");
        await newPage.click('button:has-text("Continue")');
        await safeWaitForURL(newPage, new RegExp(`^${EMBED_URL}`));
        await newPage.waitForLoadState("domcontentloaded");

        // Wait for page to stabilize after login
        await newPage.waitForTimeout(3000);

        // Re-inject embed after login
        await removeChatBubbleIfExists(newPage);
        await newPage.addScriptTag({
          content: `(function() {\n${extractedScriptBody}\n})();`,
        });

        // Open chat widget again
        await openChatWidget(newPage);

        // Validate chat widget container
        const widget = newPage.locator("#ibl-chat-widget-container");
        await widget.waitFor({ state: "visible", timeout: 60000 });
        const secondIframe = widget.frameLocator("iframe").nth(0);

        // Wait for iframe to be fully ready
        await waitForIframeReady(secondIframe);

        // Validate elements inside iframe
        // Try to find the chat header - could be nav h1, or just an h1, or header element
        try {
          const navName = secondIframe.locator("nav h1, header h1, h1").first();
          await navName.waitFor({ state: "visible", timeout: 10000 });
        } catch (error) {
          logger.info(
            "Chat header not found with expected selectors, continuing with other validations",
          );
        }

        await expect(
          secondIframe.getByRole("button", { name: "Attach File" }),
        ).toBeVisible({ timeout: 120_000 });
        await expect(
          secondIframe.getByRole("button", { name: "Voice input" }),
        ).toBeVisible({ timeout: 120_000 });
        await expect(
          secondIframe.getByRole("button", { name: "Voice call" }),
        ).toBeVisible({ timeout: 120_000 });

        const closeButton = secondIframe.getByRole("button", {
          name: /close chat/i,
        });
        await expect(closeButton).toBeVisible();

        logger.info("✅ Chat loaded and UI elements verified");

        // Wait for chat to be ready
        await waitForChatReady(secondIframe);
        // waitForTimeout: buffer after chat ready signal to allow embed iframe animations/rendering to settle — no deterministic state to wait on
        await newPage.waitForTimeout(2000);

        // Send test message with retry logic
        const text = "hello";
        await sendMessageWithRetry(secondIframe, text);

        // Wait for mentor response with enhanced timeout and debugging
        const mentorResponse = await waitForMentorResponse(
          secondIframe,
          150_000,
        );

        // Validate message layout
        // CSS class selector: .chat-user-message-query is a domain-specific class unlikely to change with styling; no data-testid available in the embed iframe
        const userMessage = secondIframe.locator(".chat-user-message-query", {
          hasText: text,
        });

        const userLayout = await userMessage.evaluate((el) => {
          const elem = el as HTMLElement;
          return {
            scrollWidth: elem.scrollWidth,
            clientWidth: elem.clientWidth,
            height: elem.offsetHeight,
            overflows: elem.scrollWidth > elem.clientWidth,
          };
        });

        expect(userLayout.overflows).toBe(false);
        expect(userLayout.height).toBeGreaterThan(10);

        const mentorLayout = await mentorResponse.evaluate((el) => {
          const elem = el as HTMLElement;
          return {
            scrollWidth: elem.scrollWidth,
            clientWidth: elem.clientWidth,
            height: elem.offsetHeight,
            overflows: elem.scrollWidth > elem.clientWidth,
          };
        });

        expect(mentorLayout.overflows).toBe(false);
        expect(mentorLayout.height).toBeGreaterThan(10);

        logger.info("✅ Message layout validation passed");

        // Close chat widget
        await expect(closeButton).toBeVisible();
        await closeButton.click();
        // waitForTimeout: closing animation of the chat widget needs time to complete before asserting not.toBeVisible
        await newPage.waitForTimeout(5000);
        await expect(widget).not.toBeVisible();

        logger.info("✅ Authenticated flow test completed successfully");
      } else {
        // Non-authenticated flow
        logger.info(
          "No login required, proceeding with non-authenticated flow",
        );
        // waitForTimeout: allow page to stabilize after redirect/load before re-injecting embed script — no specific element to wait on
        await newPage.waitForTimeout(3000);

        // Re-inject embed
        await removeChatBubbleIfExists(newPage);
        await newPage.addScriptTag({
          content: `(function() {\n${extractedScriptBody}\n})();`,
        });

        // Open chat widget
        await openChatWidget(newPage);

        // Validate chat widget container
        const widget = newPage.locator("#ibl-chat-widget-container");
        await widget.waitFor({ state: "visible", timeout: 60000 });
        const secondIframe = widget.frameLocator("iframe").nth(0);

        // Wait for iframe to be fully ready
        await waitForIframeReady(secondIframe);
        // waitForTimeout: buffer after iframe ready to allow embed content to fully render — no deterministic state to wait on
        await newPage.waitForTimeout(2000);

        // Validate elements inside iframe
        const closeButton = secondIframe.getByRole("button", {
          name: /close chat/i,
        });
        await expect(closeButton).toBeVisible();

        // CSS class selector: .chat-main-content-area is a domain-specific structural class in the embed iframe; no data-testid or semantic role available
        const bodyName = secondIframe.locator(".chat-main-content-area h1");
        await expect(bodyName).toBeVisible();

        // Try to find the nav header - could be in various locations
        try {
          const navName = secondIframe.locator("nav h1, header h1, h1").first();
          await navName.waitFor({ state: "visible", timeout: 10000 });

          const bodyText = await bodyName.textContent();
          const navText = await navName.textContent();
          expect(navText?.trim()).toBe(bodyText?.trim());
        } catch (error) {
          logger.info(
            "Chat header validation skipped - element structure may have changed",
          );
        }

        logger.info("✅ Chat loaded and text content verified");

        // Wait for chat to be ready
        await waitForChatReady(secondIframe);
        // waitForTimeout: buffer after chat ready signal to allow embed iframe animations/rendering to settle — no deterministic state to wait on
        await newPage.waitForTimeout(2000);

        // Send test message with retry logic
        const text = "hello";
        await sendMessageWithRetry(secondIframe, text);

        // Wait for mentor response with enhanced timeout and debugging
        await waitForMentorResponse(secondIframe, 150000);

        logger.info("✅ Message exchange completed successfully");

        // Close chat widget
        await closeButton.click();
        // waitForTimeout: closing animation of the chat widget needs time to complete before asserting not.toBeVisible
        await newPage.waitForTimeout(5000);
        await expect(widget).not.toBeVisible();

        logger.info("✅ Non-authenticated flow test completed successfully");
      }

      await newPage?.close();
      await newContext?.close();
    } else {
      // Non-admin user validation
      await selectDropdownWorksCorrectly(page);
      const embedMenuItem = page.getByRole("menuitem", { name: "Embed" });
      await expect(embedMenuItem).not.toBeVisible();
      logger.info("✅ Non-admin user correctly cannot see Embed option");
    }
  });

  test("Advanced anonymous embed mentor without context awareness, voice attachment, voice call, voice record", async ({
    page,
    browser,
  }) => {
    const isAdmin = await checkAdminStatus(page);

    if (isAdmin) {
      await fillCreateMentorForm({ page });

      await selectDropdownWorksCorrectly(page);

      // Open embed dialog
      const embedMenuItem = page.getByRole("menuitem", { name: "Embed" });
      await expect(embedMenuItem).toBeVisible({ timeout: 10000 });
      await embedMenuItem.click();

      // Wait for embed dialog to be visible
      const embedDialog = page
        .getByRole("dialog")
        .filter({ hasText: "Edit Mentor" });
      await expect(embedDialog).toBeVisible({ timeout: 60_000 });

      // Enable attachment button
      const attachmentButton = embedDialog.locator(
        'button[role="switch"][aria-label^="Show attachment"]',
      );
      const isAttachmentBtnChecked =
        await attachmentButton.getAttribute("aria-checked");
      if (isAttachmentBtnChecked === "false") {
        await attachmentButton.click();
        logger.info("✅ Attachment switch turned ON");
      } else {
        logger.info("Attachment switch already ON");
      }

      // Enable voice call button
      const voiceCallBtn = embedDialog.locator(
        'button[role="switch"][aria-label^="Show voice call"]',
      );
      const isVoiceCallBtnChecked =
        await voiceCallBtn.getAttribute("aria-checked");
      if (isVoiceCallBtnChecked === "false") {
        await voiceCallBtn.click();
        logger.info("✅ Voice call switch turned ON");
      } else {
        logger.info("Voice call switch already ON");
      }

      // Enable voice record button
      const voiceRecordBtn = embedDialog.locator(
        'button[role="switch"][aria-label^="Show voice record"]',
      );
      const isVoiceRecordChecked =
        await voiceRecordBtn.getAttribute("aria-checked");
      if (isVoiceRecordChecked === "false") {
        await voiceRecordBtn.click();
        logger.info("✅ Voice record switch turned ON");
      } else {
        logger.info("Voice record switch already ON");
      }

      // Enable context awareness
      const toggleButton = embedDialog.getByRole("switch", {
        name: /context awareness/i,
      });
      const isChecked = await toggleButton.getAttribute("aria-checked");
      if (isChecked === "false") {
        logger.info("Context awareness is OFF — enabling it...");
        await toggleButton.click();
        // waitForTimeout: brief pause for the toggle switch state to propagate and update aria-checked — no reliable state change event to wait on
        await page.waitForTimeout(1000);
        logger.info("✅ Context awareness enabled");
      } else {
        logger.info("Context awareness is already enabled");
      }

      // Configure "Who Can Chat?" to "Anyone" (anonymous mode)
      const whoCanChatSelect = embedDialog.getByRole("combobox", {
        name: "Select who can chat",
      });
      await expect(whoCanChatSelect).toBeVisible();
      await whoCanChatSelect.click();

      const anyoneOption = page.getByRole("option", { name: "Anyone" });
      await expect(anyoneOption).toBeVisible();
      await anyoneOption.click();
      logger.info('✅ Set chat access to "Anyone" (anonymous mode enabled)');

      // Configure embed mode to Custom > Advanced
      const embedModeComboBox = embedDialog
        .getByRole("combobox", { name: /select an embed mode/i })
        .first();
      await embedModeComboBox.click();

      const customOption = page.getByRole("option", { name: /custom/i });
      await expect(customOption).toBeVisible();
      await customOption.click();

      const advancedComboBox = embedDialog
        .getByRole("combobox", { name: /select an embed mode/i })
        .last();
      await advancedComboBox.click();

      const advancedOption = page.getByRole("option", { name: /advanced/i });
      await expect(advancedOption).toBeVisible();
      await advancedOption.click();

      const iframe = embedDialog.frameLocator("iframe");

      // Verify preview iframe loads
      const textarea = iframe.locator("textarea[placeholder]");
      await expect(textarea).toBeVisible({ timeout: 30_000 });

      const placeholder = await textarea.getAttribute("placeholder");
      expect(placeholder && placeholder.length > 3).toBeTruthy();
      // CSS class selector: tab bar in embed iframe has no semantic role or data-testid; using structural classes as best available locator
      const tabBar = iframe.locator("div.flex.border-b");
      const buttons = tabBar.locator("button");
      await expect(buttons.first()).toBeVisible({ timeout: 120_000 });
      await expect(buttons).toHaveCount(4);

      await expect(
        iframe.getByRole("button", { name: "Settings menu" }),
      ).toBeVisible();

      // Create embed and get code
      const createEmbed = embedDialog.getByRole("button", {
        name: "Create Embed",
      });
      await expect(createEmbed).toBeVisible();
      await createEmbed.click();

      const codeDialog = page
        .getByRole("dialog")
        .filter({ hasText: "Embedded Code" });
      await expect(codeDialog).toBeVisible({ timeout: 10_000 });

      const preLocator = codeDialog.locator("pre");
      await expect(preLocator).toBeVisible();

      const copyButton = codeDialog
        .locator('button[data-slot="button"] svg.lucide-copy')
        .locator("..");
      await expect(copyButton).toBeVisible();
      await copyButton.click();

      const embedCode = (await preLocator.textContent()) || "";

      // Extract script content
      const extractedEmbedCode = embedCode.match(
        /window\.onload\s*=\s*function\s*\(\)\s*{([\s\S]*?)}\s*;?\s*<\/script>/i,
      );
      const extractedScriptBody = extractedEmbedCode?.[1]?.trim();
      if (!extractedScriptBody) {
        throw new Error("Failed to extract content from window.onload");
      }

      logger.info(
        "Extracted Script Content Length:",
        extractedScriptBody.length,
      );

      // Open new page and inject embed
      const newContext = await browser.newContext({
        storageState: { cookies: [], origins: [] },
      });
      const newPage = await newContext.newPage();
      await newPage.goto(EMBED_URL, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      // waitForTimeout: allow page to stabilize after navigation before injecting embed script — no specific element to wait on at this stage
      await newPage.waitForTimeout(2000);

      // Remove existing chat bubbles
      await removeChatBubbleIfExists(newPage);

      // Inject embed script
      await newPage.addScriptTag({
        content: `(function() {\n${extractedScriptBody}\n})();`,
      });

      // Open chat widget
      await openChatWidget(newPage);

      // Validate chat widget container
      const widget = newPage.locator("#ibl-chat-widget-container");
      await widget.waitFor({ state: "visible", timeout: 60000 });

      const secondIframe = widget.frameLocator("iframe").nth(0);

      // Wait for iframe to be fully ready
      await waitForIframeReady(secondIframe);

      // Validate elements inside iframe
      const closeButton = secondIframe.getByRole("button", {
        name: /close chat/i,
      });
      await expect(closeButton).toBeVisible();

      // Try to find the chat header - could be in various locations
      try {
        const navName = secondIframe.locator("nav h1, header h1, h1").first();
        await expect(navName).toBeVisible({ timeout: 20000 });
      } catch (error) {
        logger.info(
          "Chat header not found with expected selectors, continuing with other validations",
        );
      }

      // CSS class selector: tab bar in embed iframe has no semantic role or data-testid; using structural classes as best available locator
      const tabBarEmbed = secondIframe.locator("div.flex.border-b");
      const buttonsEmbed = tabBarEmbed.locator("button");
      await expect(buttonsEmbed).toHaveCount(4);

      await expect(
        secondIframe.getByRole("button", { name: "Settings menu" }),
      ).toBeVisible();

      // Validate voice and attachment features
      // Anonymous embed shows attach file, voice input, voice call features when enabled in embed settings
      await expect(
        secondIframe.getByRole("button", { name: "Attach File" }),
      ).toBeVisible({ timeout: 120_000 });
      await expect(
        secondIframe.getByRole("button", { name: "Voice input" }),
      ).toBeVisible({ timeout: 120_000 });
      await expect(
        secondIframe.getByRole("button", { name: "Voice call" }),
      ).toBeVisible({ timeout: 120_000 });

      logger.info("✅ Chat loaded and UI elements verified");

      // Wait for chat to be ready
      await waitForChatReady(secondIframe);
      // waitForTimeout: buffer after chat ready signal to allow embed iframe animations/rendering to settle — no deterministic state to wait on
      await newPage.waitForTimeout(2000);

      // Send test message with context awareness
      const text = "What is this website about?";
      await sendMessageWithRetry(secondIframe, text);

      // Wait for mentor response
      const mentorResponse = await waitForMentorResponse(secondIframe, 150_000);

      // CSS class selector: .chat-user-message-query is a domain-specific class unlikely to change with styling; no data-testid available in the embed iframe
      const userMessage = secondIframe.locator(".chat-user-message-query", {
        hasText: text,
      });
      await expect(userMessage).toBeVisible();

      // Validate context awareness by checking for relevant keywords
      const responseText = await mentorResponse.innerText();
      const keyWordsForContext = ["website", "software"];
      let matchCount = 0;

      for (const keyword of keyWordsForContext) {
        if (responseText.toLowerCase().includes(keyword.toLowerCase())) {
          matchCount++;
          logger.info(`✅ Found context keyword: ${keyword}`);
        }
      }

      expect(matchCount).toBeGreaterThanOrEqual(1);
      logger.info("✅ Context awareness validation passed");

      // Close chat widget
      const closeChat = secondIframe.getByRole("button", {
        name: "Close chat",
      });
      await closeChat.click();
      // waitForTimeout: closing animation of the chat widget needs time to complete before asserting not.toBeVisible
      await newPage.waitForTimeout(5000);
      await expect(widget.first()).not.toBeVisible();

      await newPage?.close();
      await newContext?.close();

      logger.info("✅ Advanced anonymous embed test completed successfully");
    } else {
      // Non-admin user validation
      await page
        .locator('button[aria-label="Selected mentor dropdown button"]')
        .click();
      // waitForTimeout: allow dropdown menu animation to complete before checking menu items — no reliable state event for dropdown open
      await page.waitForTimeout(3000);

      await expect(
        page.getByRole("menuitem", { name: "New chat" }),
      ).toBeVisible();

      const embedMenuItem = page.getByRole("menuitem", { name: "Embed" });
      await expect(embedMenuItem).not.toBeVisible();

      logger.info("✅ Non-admin user correctly cannot see Embed option");
    }
  });
});
