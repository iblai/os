import { Page, Locator, expect } from '@playwright/test';

/**
 * Page object for the auth service create-account page (/account/create).
 * Locators derived from apps/auth/app/account/create/page.tsx.
 *
 * The signup form is a two-step flow:
 *   Step 1: Email input + "Continue with Password" button
 *   Step 2: Password + Confirm Password + "Create Account" button
 */
export class SignupPage {
  readonly page: Page;

  // ── Step 1 ────────────────────────────────────────────────────────────────
  readonly heading: Locator;
  readonly emailInput: Locator;
  readonly continueWithPasswordButton: Locator;
  /** "Log In" button on the create-account form (navigates back to login). */
  readonly logInButton: Locator;

  // ── Step 2 (password fields, shown after "Continue with Password") ────────
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

    this.heading = page.locator('h1');
    this.emailInput = page.getByPlaceholder('Email');
    this.continueWithPasswordButton = page.getByRole('button', {
      name: 'Continue with Password',
    });
    this.logInButton = page.getByRole('button', { name: 'Log In' });

    this.passwordInput = page.getByPlaceholder('Password', { exact: true });
    this.confirmPasswordInput = page.getByPlaceholder('Confirm Password');
    this.createAccountButton = page.getByRole('button', {
      name: 'Create Account',
    });
    this.backButton = page.getByRole('button', { name: 'Back' });

    this.emailError = page.locator('p').filter({
      hasText: /Email is required|Please enter a valid email/,
    });
    this.passwordError = page.locator('p').filter({
      hasText:
        /Password is required|Password must be at least|Passwords do not match/,
    });
    this.generalError = page.locator('p').filter({
      hasText: /Failed to create account/,
    });
  }

  /** Fill the email address field. */
  async fillEmail(email: string) {
    await this.emailInput.click();
    await this.emailInput.fill(email);
  }

  /** Click "Continue with Password" to reveal password fields. */
  async clickContinue() {
    await this.continueWithPasswordButton.click();
  }

  /** Fill both password fields. */
  async fillPasswords(password: string, confirm?: string) {
    await this.passwordInput.click();
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.click();
    await this.confirmPasswordInput.fill(confirm ?? password);
  }

  /**
   * Full password-based signup flow:
   *   email → "Continue with Password" → passwords → "Create Account".
   * Assumes the page is already on /account/create.
   */
  async signUp(email: string, password: string) {
    await this.fillEmail(email);
    await this.clickContinue();
    await expect(this.passwordInput).toBeVisible({ timeout: 10_000 });
    await this.fillPasswords(password);
    await this.createAccountButton.click();
  }
}
