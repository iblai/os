import { Page, Locator, expect } from '@playwright/test';
import { safeWaitForURL } from '../utils/navigation';
import { waitForPageReady } from '../utils/resilient';

export class CreateMentorPage {
  readonly page: Page;
  readonly dialog: Locator;
  readonly heading: Locator;
  readonly nameInput: Locator;
  readonly descriptionInput: Locator;
  readonly categoryCombobox: Locator;
  readonly visibilityCombobox: Locator;
  readonly imageUploadButton: Locator;
  readonly nextButton: Locator;
  readonly saveButton: Locator;
  readonly closeButton: Locator;
  readonly settingsTab: Locator;
  readonly promptsTab: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByRole('dialog', { name: /create.*agent/i });
    this.heading = this.dialog.getByRole('heading', { name: 'Create Agent' });
    this.nameInput = this.dialog.getByRole('textbox', {
      name: 'Agent Name',
    });
    this.descriptionInput = this.dialog.getByRole('textbox', {
      name: 'Agent Description',
    });
    this.categoryCombobox = this.dialog.getByRole('combobox', {
      name: /category/i,
    });
    this.visibilityCombobox = this.dialog.getByRole('combobox', {
      name: /visibility/i,
    });
    this.imageUploadButton = this.dialog.getByRole('button', {
      name: 'Upload agent image',
    });
    this.nextButton = this.dialog.getByRole('button', { name: 'Next' });
    this.saveButton = this.dialog.getByRole('button', { name: /save/i });
    this.closeButton = this.dialog.getByRole('button', { name: 'Close' });
    this.settingsTab = this.dialog.getByRole('tab', { name: 'Settings' });
    this.promptsTab = this.dialog.getByRole('tab', { name: 'Prompts' });
  }

  /**
   * Open the Create Mentor modal via the sidebar "New Agent" entry.
   *
   * In the new sidebar, "New Agent" lives inside the collapsible
   * "Agents" section (alongside "My Agents" and "Explore"). Radix
   * Collapsible hides items when the section is closed, so we expand
   * Agents first and only then click New Agent.
   */
  async open(): Promise<void> {
    const agentsTrigger = this.page.getByRole('button', {
      name: 'Agents',
      exact: true,
    });
    if (await agentsTrigger.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const expanded = await agentsTrigger
        .getAttribute('aria-expanded')
        .catch(() => null);
      if (expanded !== 'true') {
        await agentsTrigger.click();
      }
    }

    const newMentorBtn = this.page.getByRole('button', {
      name: 'New Agent',
      exact: true,
    });
    await expect(newMentorBtn).toBeVisible({ timeout: 10_000 });
    await newMentorBtn.click();
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Fill the required fields on the Settings tab and advance to Prompts.
   */
  async fillRequiredFields(name: string, description?: string): Promise<void> {
    await expect(this.nameInput).toBeEnabled({ timeout: 30_000 });
    await this.nameInput.fill(name);

    await this.descriptionInput.fill(
      description || `E2E test mentor created at ${Date.now()}`,
    );

    // Select first available category
    await this.categoryCombobox.click();
    const firstCategory = this.page.locator('[role="option"]').first();
    await expect(firstCategory).toBeVisible({ timeout: 5_000 });
    await firstCategory.click();

    // Wait for Next button to become enabled
    await expect(this.nextButton).toBeEnabled({ timeout: 5_000 });
  }

  /**
   * Fill required fields, click Next, then Save to create the mentor.
   * Returns the generated mentor name.
   */
  async createWithName(name?: string): Promise<string> {
    const mentorName = name || `E2E Mentor ${Date.now()}`;

    await this.fillRequiredFields(mentorName);
    await this.nextButton.click();

    // On the Prompts tab, click Save
    await expect(this.saveButton).toBeVisible({ timeout: 5_000 });
    await expect(this.saveButton).toBeEnabled({ timeout: 5_000 });
    await this.saveButton.click();

    const previousUrl = this.page.url();

    await safeWaitForURL(
      this.page,
      (url) => url.href.includes('/platform/') && previousUrl != url.href,
      {
        timeout: 30_000,
      },
    );
    await waitForPageReady(this.page);
    return mentorName;
  }

  /**
   * Open the modal and create a mentor in one step.
   * Returns the generated mentor name.
   */
  async openAndCreate(name?: string): Promise<string> {
    await this.open();
    return this.createWithName(name);
  }

  async isOpen(): Promise<boolean> {
    return this.dialog.isVisible({ timeout: 2_000 }).catch(() => false);
  }

  async close(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await expect(this.dialog).not.toBeVisible({ timeout: 15_000 });
  }
}
