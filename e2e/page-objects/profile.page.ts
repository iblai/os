import { Page, Locator, expect } from '@playwright/test';

export class ProfilePage {
  readonly page: Page;

  readonly modal: Locator;
  readonly closeButton: Locator;
  readonly tabs: Locator;

  // Basic tab
  readonly fullNameField: Locator;
  readonly emailField: Locator;
  readonly titleField: Locator;
  readonly aboutField: Locator;
  readonly languageSelector: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  // Social tab
  readonly linkedInField: Locator;
  readonly twitterField: Locator;

  // Education tab
  readonly addEducationButton: Locator;

  // Experience tab
  readonly addExperienceButton: Locator;

  // Resume tab
  readonly uploadResumeButton: Locator;

  // Security tab
  readonly sendPasswordResetButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = page.getByRole('dialog', { name: /profile/i });
    this.closeButton = this.modal.getByRole('button', {
      name: 'Close',
      exact: true,
    });
    this.tabs = this.modal.getByRole('tablist');

    this.fullNameField = this.modal
      .getByLabel(/full name/i)
      .or(this.modal.getByPlaceholder(/full name/i));
    this.emailField = this.modal
      .getByLabel(/email/i)
      .or(this.modal.getByPlaceholder(/email/i));
    this.titleField = this.modal
      .getByLabel(/title/i)
      .or(this.modal.getByPlaceholder(/title/i));
    this.aboutField = this.modal
      .getByLabel(/about/i)
      .or(this.modal.locator('textarea[name*="about"]'));
    this.languageSelector = this.modal.getByRole('combobox', {
      name: /language/i,
    });
    this.saveButton = this.modal
      .getByRole('button', { name: /save/i })
      .first();
    this.cancelButton = this.modal.getByRole('button', { name: /cancel/i });

    this.linkedInField = this.modal
      .getByLabel(/linkedin/i)
      .or(this.modal.getByPlaceholder(/linkedin/i));
    this.twitterField = this.modal
      .getByLabel(/twitter/i)
      .or(this.modal.getByPlaceholder(/twitter/i));

    this.addEducationButton = this.modal.getByRole('button', {
      name: /add education/i,
    });
    this.addExperienceButton = this.modal.getByRole('button', {
      name: /add experience/i,
    });
    this.uploadResumeButton = this.modal.getByRole('button', {
      name: /upload|add resume/i,
    });
    this.sendPasswordResetButton = this.modal.getByRole('button', {
      name: /send password reset/i,
    });
  }

  async open(): Promise<void> {
    const profileDropdown = this.page.getByRole('button', {
      name: 'More options',
    });
    await expect(profileDropdown).toBeVisible({ timeout: 10_000 });
    await profileDropdown.click();
    const profileItem = this.page.getByRole('menuitem', { name: /profile/i });
    await expect(profileItem).toBeVisible({ timeout: 5_000 });
    await profileItem.click();
    await expect(this.modal).toBeVisible({ timeout: 15_000 });
  }

  async close(): Promise<void> {
    await expect(this.closeButton).toBeVisible({ timeout: 5_000 });
    await this.closeButton.click();
    await expect(this.modal).not.toBeVisible({ timeout: 10_000 });
  }

  async switchToTab(tabName: string): Promise<void> {
    const tab = this.modal.getByRole('tab', { name: new RegExp(tabName, 'i') });
    await expect(tab).toBeVisible({ timeout: 5_000 });
    await tab.click();
    await this.page.waitForTimeout(300);
  }

  async save(): Promise<void> {
    await expect(this.saveButton).toBeEnabled({ timeout: 5_000 });
    await this.saveButton.click();
    await expect(
      this.page.getByText(/saved|success/i),
    ).toBeVisible({ timeout: 10_000 });
  }

  async openAddEducationDialog(): Promise<Locator> {
    await expect(this.addEducationButton).toBeVisible({ timeout: 10_000 });
    await this.addEducationButton.click();
    const dialog = this.page
      .getByRole('dialog')
      .filter({ hasText: /education/i })
      .last();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    return dialog;
  }

  async openAddExperienceDialog(): Promise<Locator> {
    await expect(this.addExperienceButton).toBeVisible({ timeout: 10_000 });
    await this.addExperienceButton.click();
    const dialog = this.page
      .getByRole('dialog')
      .filter({ hasText: /experience/i })
      .last();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    return dialog;
  }
}
