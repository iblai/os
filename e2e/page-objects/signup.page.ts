import { Page, Locator, expect } from "@playwright/test";

/**
 * Page object for the auth service signup page.
 * Locators derived from apps/auth/app/account/create/page.tsx.
 *
 * The signup form is a two-step flow:
 *   Step 1: Email input + Continue button (+ "Continue with Password" toggle)
 *   Step 2: Password + Confirm Password + Create Account button
 */
export class SignupPage {
  readonly page: Page;

  // ── Step 1 ────────────────────────────────────────────────────────────────
  readonly heading: Locator;
  readonly emailInput: Locator;
  readonly continueButton: Locator;
  readonly continueWithPasswordButton: Locator;
  /** "Log In" button on the create-account form (navigates back to login). */
  readonly logInButton: Locator;

  // ── Step 2 (password fields, shown after Continue with Password) ──────────
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly createAccountButton: Locator;
  readonly backButton: Locator;

  // ── Errors ────────────────────────────────────────────────────────────────
  readonly emailError: Locator;
  readonly passwordError: Locator;
  readonly generalError: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading = page.locator("h1");
    this.emailInput = page.getByPlaceholder("Email address");
    this.continueButton = page
      .locator("div")
      .filter({ hasText: /^Continue$/ })
      .first();
    // "Log In" is a <button> on the create-account page (navigates back to login)
    this.logInButton = page.getByRole("button", { name: "Log In" });
    this.continueWithPasswordButton = page.getByRole("button", {
      name: "Continue with Password",
    });

    this.passwordInput = page.getByPlaceholder("Password", { exact: true });
    this.confirmPasswordInput = page.getByPlaceholder("Confirm password");
    this.createAccountButton = page
      .locator("div")
      .filter({ hasText: /^Continue$/ })
      .first();
    this.backButton = page.getByRole("button", { name: "Back" });

    this.emailError = page.locator("p").filter({
      hasText: /Email is required|Please enter a valid email/,
    });
    this.passwordError = page.locator("p").filter({
      hasText:
        /Password is required|Password must be at least|Passwords do not match/,
    });
    this.generalError = page.locator("p").filter({
      hasText: /Failed to create account/,
    });
  }

  /** Fill the email address field. */
  async fillEmail(email: string) {
    await this.emailInput.click();
    await this.emailInput.fill(email);
  }

  /** Click Continue after filling email. */
  async clickContinue() {
    await this.continueButton.click();
  }

  /** Fill both password fields. */
  async fillPasswords(password: string, confirm?: string) {
    await this.passwordInput.click();
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.click();
    await this.confirmPasswordInput.fill(confirm ?? password);
  }

  /**
   * Full signup flow: email → Continue → passwords → Continue.
   * Assumes the page is already on the signup form.
   */
  async signUp(email: string, password: string) {
    await this.fillEmail(email);
    await this.emailInput.press("Tab");
    await this.clickContinue();
    await expect(this.passwordInput).toBeVisible({ timeout: 10_000 });
    await this.fillPasswords(password);
    await this.clickContinue();
  }
}
