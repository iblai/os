import { Locator, Page } from "@playwright/test";
import { logger } from "@iblai/iblai-js/playwright";
import {
  expect,
  StepFn,
  waitForPageLoad,
  safeWaitForURL,
} from "@iblai/iblai-js/playwright";
import { AUTH_HOST } from "./utils";
import { MENTOR_NEXTJS_HOST, SKILL_HOST } from "./utils";

export interface SignUpCredentials {
  email: string;
  password: string;
}

export async function signUpWithEmailAndPassword(
  page: Page,
  credentials?: SignUpCredentials,
  alreadyInSignupPage = false,
) {
  logger.info("Checking for user credentials");

  if (!credentials) {
    const timeStamp = Date.now();
    logger.info(`Generating credentials for test ${timeStamp}`);
    credentials = {
      email: `test+${timeStamp}@ibleducation.com`,
      password: "test-password",
    };
  }

  if (!alreadyInSignupPage) {
    // Click on the sign up button
    const signUpButton = page.getByRole("button", { name: "Sign Up" });
    await expect(signUpButton).toBeVisible({ timeout: 10000 });
    await signUpButton.click();

    // Wait for the sign up page to load
    await safeWaitForURL(
      page,
      (url) => url.href.startsWith(AUTH_HOST + "/account/create"),
      { timeout: 60000 },
    );
  }

  // Click on the continue with Password button
  const continueWithPasswordButton = page.getByRole("button", {
    name: "continue with Password",
  });
  await expect(continueWithPasswordButton).toBeVisible({ timeout: 10000 });
  await continueWithPasswordButton.click();

  // Fill in Email field
  const emailInputField = page.getByPlaceholder("Email");
  await expect(emailInputField).toBeVisible();
  await emailInputField.fill(credentials.email);

  // Fill in Password field
  const passwordInputField = page.getByPlaceholder("Password", {
    exact: true,
  });
  await expect(passwordInputField).toBeVisible();
  await passwordInputField.fill(credentials.password);

  // Fill in Confirm Password field
  const confirmPasswordInputField = page.getByPlaceholder("Confirm Password");
  await expect(confirmPasswordInputField).toBeVisible();
  await confirmPasswordInputField.fill(credentials.password);

  // Click Create Account
  const createAccountButton = page.getByRole("button", {
    name: "Create Account",
  });
  await expect(createAccountButton).toBeVisible();
  await createAccountButton.click();

  // Wait to be redirected back to mentor application
  await safeWaitForURL(page, (url) => url.href.startsWith(MENTOR_NEXTJS_HOST), {
    timeout: 60000,
  });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(15000);
}

export async function loginWithEmailAndPassword(
  page: Page,
  username: string,
  password: string,
  hostUrl: string,
) {
  /* logger.info('Checking for email input field');
  const emailInput = page.locator('input[placeholder="Email or Username"]');
  await emailInput.waitFor({ state: 'visible' });
  await step('Input username or email', async () => {
    await emailInput.fill(username);
  });
  logger.info('Email input field ', await emailInput.innerHTML());

  const continueButton = page.locator('.auth-submit-btn');
  await continueButton.waitFor({ state: 'visible' });
  await continueButton.click();

  logger.info('Checking for password input field');
  const passwordInput = page.locator('input[placeholder="Password"]');
  page.waitForTimeout(5000);
  await passwordInput.waitFor({ state: 'visible' });
  logger.info('Password input visible');
  await step('Input password', async () => {
    await passwordInput.fill(password);
  });

  logger.info('Password input field ', await passwordInput.innerHTML());
  await page.waitForTimeout(5000);
  await step('Clicking continue button to login', async () => {
    await continueButton.click();
  }); */

  //NEW AUTH FLOW
  await page.click('button:has-text("Continue with Password")');

  logger.info("Waiting for 1 second before waiting for the email input");
  await page.waitForTimeout(1000);

  logger.info("Waiting for the password form to appear");
  await page.waitForSelector('input[type="email"]');

  logger.info("Filling in the login credentials");
  await page.fill('input[type="email"]', username);
  await page.fill('input[type="password"]', password);
  logger.info("Clicking the login button");
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(500);

  // logger.info('Waiting for the login to complete');
  // await page.waitForURL(authUrl + "/login/complete");
  // await page.waitForLoadState("networkidle");
  if (hostUrl == MENTOR_NEXTJS_HOST) {
    await safeWaitForURL(page, /\/platform\/[a-zA-Z0-9-]+\/[a-f0-9-]+/, {
      timeout: 80000,
    });
  }

  if (hostUrl == SKILL_HOST) {
    await safeWaitForURL(
      page,
      (url) => url.href.includes("/home") || url.href.includes("/start"),
      { timeout: 80000 },
    );
  }
}

export async function loginWithMicrosoftIdp(
  page: Page,
  username: string,
  password: string,
) {
  // Wait for SSO provider page to load (simulate login if needed)
  // This part may need to be customized for your client SSO
  await safeWaitForURL(page, /.*\/oauth2\/v2.0\/authorize.*/, {
    timeout: 60000,
  });
  await page.waitForLoadState("networkidle");
  const inputEmailEl = page.getByRole("textbox", { name: "NetId@syr.edu" });
  await inputEmailEl.waitFor({ state: "visible" });
  inputEmailEl.fill(username);
  const nextBtnEl = page.getByRole("button", { name: "Next" });
  await nextBtnEl.waitFor({ state: "visible" });
  nextBtnEl.click();
  const inputPasswordEl = page.getByPlaceholder("Password");
  await inputPasswordEl.waitFor({ state: "visible" });
  inputPasswordEl.fill(password);
  const signinBtnEl = page.getByRole("button", { name: "Sign in" });
  await signinBtnEl.waitFor({ state: "visible" });
  signinBtnEl.click();
  const confirmStaySignIn = page.getByRole("button", { name: "Yes" });
  await confirmStaySignIn.waitFor({ state: "visible" });
  confirmStaySignIn.click();
}

export async function canChatWithEmbedMentor(
  page: Page,
  openChatButton: Locator,
) {
  await openChatButton.click();
  await page.waitForTimeout(20000);
  const widget = page.locator("#ibl-chat-widget-container");
  await expect(widget).toBeVisible();

  const mentorIframe = widget.frameLocator("iframe").nth(0);
  const navName = mentorIframe.locator("nav h1");
  await expect(navName).toBeVisible({ timeout: 15000 });

  const closeButton = mentorIframe.getByRole("button", {
    name: /close chat/i,
  });
  await expect(closeButton).toBeVisible();
  const img = mentorIframe.locator('img[data-slot="avatar-image"]').first();
  await expect(img).toBeVisible();
  await expect(img).toHaveAttribute("src");

  const text = "Whats the context of this page";

  const textArea = mentorIframe.locator(
    'textarea[placeholder]:not([placeholder=""])',
  );
  await expect(textArea).toBeVisible();
  await expect(textArea).toHaveAttribute("placeholder", /.+/);
  const sendButton = mentorIframe.getByRole("button", {
    name: /send message/i,
  });

  await textArea.fill(text);
  await expect(sendButton).toBeEnabled();
  await sendButton.click();
  await page.waitForTimeout(5000);

  const userMessage = mentorIframe.locator(".chat-user-message-query", {
    hasText: text,
  });
  const mentorResponse = mentorIframe.locator(".chat-ai-message-response");
  await expect(userMessage).toBeVisible({ timeout: 10000 });
  await mentorResponse.waitFor({ state: "visible" });
  await expect(mentorResponse).toBeVisible();

  await expect(mentorResponse).toContainText(/courses/i);

  // 5. Check user message layout
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

  // 6. Check mentor message layout
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

  await closeButton.click();
  //await waitForPageReady(newPage);
  await expect(widget).not.toBeVisible();
}

/**
 * Resolve browser-specific credentials matching the auth setup pattern.
 * e.g., project 'mentor-desktop-chrome' -> PLAYWRIGHT_USERNAME_CHROME
 */
export function getCredentials(projectName: string) {
  const browserKey = projectName.replace(/.*-/, "").toUpperCase();
  return {
    username:
      process.env[`PLAYWRIGHT_USERNAME_${browserKey}`] ||
      process.env.PLAYWRIGHT_USERNAME ||
      "",
    password:
      process.env[`PLAYWRIGHT_PASSWORD_${browserKey}`] ||
      process.env.PLAYWRIGHT_PASSWORD ||
      "",
  };
}

export function getMentorIdFromUrl(url: string) {
  const { pathname } = new URL(url);
  const match = pathname.startsWith("/platform/");
  if (!match) {
    return null;
  }

  const parts = pathname.split("/").filter(Boolean); // ['platform', '<tenantKey>', '<mentorId>']
  return parts[2];
}
