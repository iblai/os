import { test, expect } from "@playwright/test";
import { safeWaitForURL } from "../utils/navigation";
import {
  waitForMailnesiaEmail,
  getMailnesiaMailboxUrl,
} from "../utils/mailnesia";
import { SignupPage } from "../page-objects/signup.page";

const HOST = process.env.MENTOR_NEXTJS_HOST || "";
const AUTH_HOST = process.env.AUTH_HOST || "";

// ── Sign Up & Password Reset (serial, no auth) ─────────────────────────────

test.describe
  .serial("Journey 1: Authentication — Sign Up & Password Reset", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  const timestamp = Date.now();
  const email = `test+${timestamp}@mailnesia.com`;
  const username = `test${timestamp}`;
  const password = "test-password";
  const newPassword = "new_test_password";
  const mailnesiaUrl = getMailnesiaMailboxUrl(email);

  test.setTimeout(120_000);

  test("unauthenticated user goes to mentor platform and signs up with email and password", async ({
    page,
    context,
  }) => {
    test.skip(!HOST || !AUTH_HOST, "Requires MENTOR_NEXTJS_HOST and AUTH_HOST");

    // Navigate to the mentor app — should redirect to auth login
    await page.goto(HOST, { waitUntil: "domcontentloaded" });
    await safeWaitForURL(
      page,
      (url) => url.href.includes(`/login?app=mentor&redirect-to=${HOST}`),
      { timeout: 60_000 },
    );

    // Click the "Sign Up" button on the login page (it's a <button>, not a link)
    await expect(page.getByRole("button", { name: "Sign Up" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Sign Up" }).click();

    // Wait for redirect to the create-account page
    await safeWaitForURL(page, (url) => url.href.includes("/account/create"), {
      timeout: 30_000,
    });

    // Now on the signup form (/account/create)
    const signupPage = new SignupPage(page);

    // Fill email
    await signupPage.fillEmail(email);

    // Click "Continue with Password" to reveal password fields
    await signupPage.clickContinue();

    // Fill passwords (Step 2)
    await expect(signupPage.passwordInput).toBeVisible({ timeout: 10_000 });
    await signupPage.fillPasswords(password);

    // Submit the registration
    await signupPage.createAccountButton.click();
    await safeWaitForURL(
      page,
      (url) => url.href.includes(AUTH_HOST) && url.href.includes("/login?"),
      { timeout: 60_000 },
    );
  });

  test("newly signed-up non-admin goes to mentor platform and logs in after signup", async ({
    page,
  }) => {
    test.skip(!HOST || !AUTH_HOST, "Requires MENTOR_NEXTJS_HOST and AUTH_HOST");

    // Navigate to the mentor app — should redirect to auth login
    await page.goto(HOST, { waitUntil: "domcontentloaded" });
    await safeWaitForURL(page, (url) => url.href.includes(AUTH_HOST), {
      timeout: 60_000,
    });

    // Click "Continue with Password"
    await expect(
      page.getByRole("button", { name: "Continue with Password" }),
    ).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Continue with Password" }).click();

    // Fill credentials from test 1
    await expect(page.locator('input[type="email"]')).toBeVisible({
      timeout: 10_000,
    });
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button:has-text("Continue")');

    // Wait for redirect to platform
    await safeWaitForURL(
      page,
      (url) => url.href.startsWith(HOST + "/platform"),
      { timeout: 80_000 },
    );
  });

  test("non-admin goes to auth service and resets password via forgot password flow", async ({
    page,
    context,
  }) => {
    test.setTimeout(180_000);
    test.skip(!HOST || !AUTH_HOST, "Requires MENTOR_NEXTJS_HOST and AUTH_HOST");

    // Navigate to the auth login page
    await page.goto(`${AUTH_HOST}/login?app=mentor&redirect-to=${HOST}`, {
      waitUntil: "domcontentloaded",
    });

    // Enter email/username and click Continue
    const emailOrUsername = page.getByPlaceholder("Email");
    await emailOrUsername.waitFor({ state: "visible", timeout: 15_000 });
    await emailOrUsername.fill(email);
    await page.getByRole("button", { name: "Continue with Password" }).click();

    // Click "Forgot password?"
    await expect(
      page.getByRole("button", { name: "Forgot password?" }),
    ).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Forgot password?" }).click();

    await safeWaitForURL(
      page,
      (url) => url.href.includes(`/password/reset?redirect-to=`),
      { timeout: 30_000 },
    );

    // Fill email on forgot-password page
    await page.getByPlaceholder("Email address").fill(email);
    await expect(
      page.getByRole("heading", { name: "Forgot Your Password" }),
    ).toBeVisible();

    // Click Continue and wait for success message (retry up to 3 times)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await page.getByText("Continue").click();
        await expect(page.getByRole("paragraph")).toContainText(
          "sent password reset instructions to",
          { timeout: 15_000 },
        );
        break;
      } catch {
        if (attempt === 2)
          throw new Error(
            "Failed to see reset password message after 3 attempts",
          );
        await page.waitForTimeout(1_000);
      }
    }

    // Poll mailnesia for the password reset email
    const resetEmailPage = await waitForMailnesiaEmail(
      context,
      mailnesiaUrl,
      "Password reset on ibl",
      { maxRetries: 12, intervalMs: 10_000 },
    );

    // Click the reset email and follow the reset link
    await resetEmailPage
      .getByRole("link", { name: "Password reset on ibl" })
      .click();
    await expect(
      resetEmailPage.getByRole("heading", { name: "Password reset" }),
    ).toBeVisible({ timeout: 10_000 });
    await resetEmailPage
      .getByRole("link", { name: "Reset my password" })
      .click();

    await safeWaitForURL(
      resetEmailPage,
      (url) => url.href.includes("/password_reset_confirm/"),
      { timeout: 30_000 },
    );
    await resetEmailPage.waitForLoadState("networkidle").catch(() => {});

    // Fill the new password
    await expect(resetEmailPage.getByText("Reset Your Password")).toBeVisible();
    await resetEmailPage.getByLabel("New Password").fill(newPassword);
    await resetEmailPage.getByLabel("New Password").press("Tab");
    await resetEmailPage.getByLabel("Confirm Password").fill(newPassword);
    await resetEmailPage
      .getByRole("button", { name: "Reset My Password" })
      .click();

    await expect(
      resetEmailPage.getByRole("heading", { name: "Password Reset Complete" }),
    ).toBeVisible({ timeout: 15_000 });

    // Poll mailnesia for the confirmation email
    const confirmEmailPage = await waitForMailnesiaEmail(
      context,
      mailnesiaUrl,
      "Password reset completed on",
      { maxRetries: 12, intervalMs: 5_000 },
    );
    await confirmEmailPage
      .getByRole("link", { name: "Password reset completed on" })
      .click();
    await expect(
      confirmEmailPage.getByRole("heading", { name: "Password reset success" }),
    ).toBeVisible({ timeout: 10_000 });
    await confirmEmailPage.close();
    await resetEmailPage.close();

    // Verify login with the new password
    await page.goto(HOST, { waitUntil: "domcontentloaded" });
    await safeWaitForURL(
      page,
      (url) => url.href.includes(`/login?app=mentor&redirect-to=${HOST}`),
      { timeout: 60_000 },
    );

    try {
      await page.waitForLoadState("domcontentloaded", { timeout: 60_000 });
      await page.waitForLoadState("networkidle", { timeout: 60_000 });
    } catch {
      // networkidle timeout is non-fatal for auth page
    }

    // Enter email/username
    const loginEmailInput = page.locator(
      'input[placeholder="Email or Username"]',
    );
    await loginEmailInput.waitFor({ state: "visible", timeout: 15_000 });
    await loginEmailInput.fill(username);

    const continueBtn = page.locator(".auth-submit-btn");
    await continueBtn.waitFor({ state: "visible" });
    await continueBtn.click();

    // Enter new password
    const loginPasswordInput = page.locator('input[placeholder="Password"]');
    await page.waitForTimeout(2_000);
    await loginPasswordInput.waitFor({ state: "visible", timeout: 15_000 });
    await loginPasswordInput.fill(newPassword);
    await page.waitForTimeout(2_000);
    await continueBtn.click();

    // Wait for successful redirect to platform
    await safeWaitForURL(page, (url) => url.href.startsWith(HOST), {
      timeout: 30_000,
    });

    // Verify non-admin indicator
    await expect(page.getByRole("link", { name: "Upgrade" })).toBeVisible({
      timeout: 15_000,
    });
  });
});

// ── Invalid Credentials (independent, no auth) ─────────────────────────────

test.describe("Journey 1: Authentication — Invalid Credentials", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("unauthenticated user goes to login page and sees an error with invalid credentials", async ({
    page,
  }) => {
    test.skip(!AUTH_HOST, "Requires AUTH_HOST");

    await page.goto(`${AUTH_HOST}/login`, { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("button", { name: "Continue with Password" }),
    ).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Continue with Password" }).click();
    await page.fill('input[type="email"]', "invalid@doesnotexist.example.com");
    await page.fill('input[type="password"]', "WrongPassword123!");
    await page.click('button:has-text("Continue")');

    await expect(page.getByText("Invalid email or password")).toBeVisible({
      timeout: 15_000,
    });

    await page.waitForLoadState("networkidle", {});
  });
});
