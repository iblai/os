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
} from "../embedding-mentor/helpers";
import { EMBED_URL } from "../utils";
import { fillCreateMentorForm } from "../utils/create-mentor";
import { navigateToMentorApp } from "../profile/helpers";
import {
  generateShareableLink,
  sendChatMessage,
  waitForMentorResponseToAppear,
} from "./helpers";

test.describe("Shareable Links", () => {
  test.setTimeout(300000);
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  test("Default non-anonymous embed with voice call, voice record and attachment", async ({
    page,
    browser,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    if (isAdmin) {
      await fillCreateMentorForm({ page });

      const shareableLink = await generateShareableLink({
        page,
        isPublic: false,
      });

      // paste shareable link

      // Open new page and inject embed
      const newContext = await browser.newContext({
        storageState: { cookies: [], origins: [] },
      });
      const newPage = await newContext.newPage();
      await navigateToMentorApp(newPage, shareableLink);

      const loginButton = newPage.getByRole("button", { name: "Log in" });
      await expect(loginButton).toBeVisible({ timeout: 30_000 });

      const signUpButton = newPage.getByRole("button", {
        name: "Sign up for free",
      });
      await expect(signUpButton).toBeVisible({ timeout: 30_000 });

      const sendMessageButton = newPage.getByRole("button", {
        name: "Send message",
      });
      await expect(sendMessageButton).toBeVisible({ timeout: 30_000 });
      await expect(sendMessageButton).not.toBeEnabled({ timeout: 30_000 });

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

      const shareableLink = await generateShareableLink({
        page,
        isPublic: true,
      });

      // paste shareable link

      // Open new page and inject embed
      const newContext = await browser.newContext({
        storageState: { cookies: [], origins: [] },
      });
      const newPage = await newContext.newPage();
      await navigateToMentorApp(newPage, shareableLink);

      const loginButton = newPage.getByRole("button", { name: "Log in" });
      await expect(loginButton).toBeVisible({ timeout: 30_000 });

      const signUpButton = newPage.getByRole("button", {
        name: "Sign up for free",
      });
      await expect(signUpButton).toBeVisible({ timeout: 30_000 });

      const sendMessageButton = newPage.getByRole("button", {
        name: "Send message",
      });
      await expect(sendMessageButton).toBeVisible({ timeout: 30_000 });
      await expect(sendMessageButton).toBeEnabled({ timeout: 30_000 });

      // send message
      await sendChatMessage(newPage, "Hello");

      await waitForMentorResponseToAppear(newPage);

      await newPage?.close();
      await newContext?.close();
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

  test("Advanced anonymous embed mentor with disclaimer asks user to accept disclaimer", async ({
    page,
    browser,
  }) => {
    const isAdmin = await checkAdminStatus(page);

    if (isAdmin) {
      await fillCreateMentorForm({ page });

      await selectDropdownWorksCorrectly(page);

      // navigate to the embed tab
      const disclaimersMenuItem = page.getByRole("menuitem", {
        name: "Disclaimers",
      });
      await expect(disclaimersMenuItem).toBeVisible();
      await disclaimersMenuItem.click();

      const disclaimersTab = page.getByRole("heading", { name: "Disclaimers" });
      await expect(disclaimersTab).toBeVisible({ timeout: 60_000 });

      let userAgreementSwitch = page.getByRole("switch", {
        name: "User agreement disabled",
      });
      await expect(userAgreementSwitch).toBeVisible({ timeout: 10_000 });
      await userAgreementSwitch.click({ timeout: 10_000 });

      userAgreementSwitch = page.getByRole("switch", {
        name: "User agreement enabled",
      });
      await expect(userAgreementSwitch).toBeVisible({ timeout: 60_000 });

      const embedTab = page.getByRole("tab", { name: "Embed" });
      await expect(embedTab).toBeVisible({ timeout: 10_000 });

      const closeDisclaimersTabButton = page.getByRole("button", {
        name: "Close",
      });
      await expect(closeDisclaimersTabButton).toBeVisible({ timeout: 10_000 });
      await closeDisclaimersTabButton.click({ timeout: 10_000 });

      const shareableLink = await generateShareableLink({
        page,
        isPublic: true,
      });

      await navigateToMentorApp(page, shareableLink);

      const userText = "hello";
      const chatTextbox = page.getByRole("textbox", { name: "Ask anything" });
      await expect(chatTextbox).toBeVisible({ timeout: 10_000 });
      await chatTextbox.fill(userText);

      const sendMessageButton = page.getByRole("button", {
        name: "Send message",
      });
      await expect(sendMessageButton).toBeVisible({ timeout: 10_000 });
      await sendMessageButton.click({ timeout: 10_000 });

      const agreeButton = page.getByRole("button", { name: "I Accept" });
      await expect(agreeButton).toBeVisible({ timeout: 60_000 });
      await agreeButton.click({ timeout: 10_000 });

      const userMessage = page.locator(".chat-user-message-query", {
        hasText: userText,
      });
      await expect(userMessage).toBeVisible({ timeout: 10_000 });

      await waitForMentorResponseToAppear(page);

      // // paste shareable link

      // // Open new page and inject embed
      // const newContext = await browser.newContext({
      //   storageState: { cookies: [], origins: [] },
      // });
      // const newPage = await newContext.newPage();
      // await navigateToMentorApp(newPage, shareableLink);

      // const loginButton = newPage.getByRole('button', { name: 'Log in' });
      // await expect(loginButton).toBeVisible({ timeout: 30_000 });

      // const signUpButton = newPage.getByRole('button', {
      //   name: 'Sign up for free',
      // });
      // await expect(signUpButton).toBeVisible({ timeout: 30_000 });

      // const sendMessageButton = newPage.getByRole('button', {
      //   name: 'Send message',
      // });
      // await expect(sendMessageButton).toBeVisible({ timeout: 30_000 });
      // await expect(sendMessageButton).toBeEnabled({ timeout: 30_000 });

      // // send message
      // await sendChatMessage(newPage, 'Hello');

      // await waitForMentorResponseToAppear(newPage);

      // await newPage?.close();
      // await newContext?.close();
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
