import { Page, Locator, expect } from '@playwright/test';

export class ChatPage {
  readonly page: Page;

  readonly chatInput: Locator;
  readonly sendButton: Locator;
  readonly newChatButton: Locator;
  readonly userMessages: Locator;
  readonly aiMessages: Locator;
  readonly canvasToggle: Locator;
  readonly memoryButton: Locator;
  readonly createMentorDialog: Locator;
  readonly loginBanner: Locator;
  readonly uploadButton: Locator;
  readonly voiceCallButton: Locator;
  readonly voiceInputButton: Locator;
  readonly dragOverlay: Locator;
  readonly promptsButton: Locator;
  readonly promptGalleryDialog: Locator;

  constructor(page: Page) {
    this.page = page;
    this.chatInput = page.getByRole('textbox', {
      name: 'Ask anything',
      exact: true,
    });
    this.sendButton = page.getByRole('button', { name: 'Send message' });
    this.newChatButton = page.getByRole('button', { name: 'New Chat' });
    this.userMessages = page.locator('.chat-user-message-query');
    this.aiMessages = page.locator('.chat-ai-message-response');
    this.canvasToggle = page.getByRole('button', { name: /canvas/i });
    this.memoryButton = page.getByRole('button', { name: /memory/i });
    this.createMentorDialog = page.getByRole('dialog', {
      name: /create.*mentor/i,
    });
    this.loginBanner = page.getByRole('button', { name: /log in/i });
    this.uploadButton = page.getByRole('button', { name: 'Attach file' });
    this.voiceCallButton = page.getByRole('button', { name: 'Voice call' });
    this.voiceInputButton = page.getByRole('button', { name: 'Voice input' });
    this.dragOverlay = page.locator(
      '[data-testid="drag-overlay"], [class*="drag-overlay"]',
    );
    this.promptsButton = page.getByRole('button', {
      name: 'Prompts',
      exact: true,
    });
    this.promptGalleryDialog = page.getByRole('dialog', {
      name: 'Prompt Gallery',
    });
  }

  async sendMessage(text: string): Promise<void> {
    await expect(this.chatInput).toBeVisible({ timeout: 15_000 });
    await this.chatInput.fill(text);
    await expect(this.sendButton).toBeEnabled({ timeout: 10_000 });
    await this.page.waitForTimeout(5_000);
    await this.sendButton.click();
  }

  async waitForAIResponse(timeout = 60_000): Promise<void> {
    await expect(this.aiMessages.first()).toBeVisible({ timeout });
  }

  async waitForUserMessage(text: string, timeout = 30_000): Promise<void> {
    await expect(
      this.page.locator('.chat-user-message-query', { hasText: text }),
    ).toBeVisible({ timeout });
  }

  async startNewChat(): Promise<void> {
    await expect(this.newChatButton).toBeVisible({ timeout: 5_000 });
    await this.newChatButton.click();
  }

  async openPromptGallery(): Promise<void> {
    await expect(this.promptsButton).toBeVisible({ timeout: 10_000 });
    await this.promptsButton.click();
    await expect(this.promptGalleryDialog).toBeVisible({ timeout: 10_000 });
  }

  /** Returns all Delete buttons inside the Prompt Gallery dialog. */
  getPromptGalleryDeleteButtons(): Locator {
    return this.promptGalleryDialog.getByRole('button', {
      name: 'Delete',
      exact: true,
    });
  }

  /** Returns all Run buttons inside the Prompt Gallery dialog. */
  getPromptGalleryRunButtons(): Locator {
    return this.promptGalleryDialog.getByRole('button', {
      name: 'Run',
      exact: true,
    });
  }

  /** Returns all Edit buttons inside the Prompt Gallery dialog. */
  getPromptGalleryEditButtons(): Locator {
    return this.promptGalleryDialog.getByRole('button', {
      name: 'Edit',
      exact: true,
    });
  }

  /** Returns the Add prompt button inside the Prompt Gallery dialog. */
  getPromptGalleryAddButton(): Locator {
    return this.promptGalleryDialog.getByRole('button', {
      name: 'Add',
      exact: true,
    });
  }

  /** Deletes the nth prompt (0-indexed) from the Prompt Gallery. */
  async deletePromptFromGallery(index = 0): Promise<void> {
    const deleteButton = this.getPromptGalleryDeleteButtons().nth(index);
    await expect(deleteButton).toBeVisible({ timeout: 10_000 });
    await deleteButton.click();
  }

  /** Clicks the Run button on the nth prompt (0-indexed) in the Prompt Gallery. */
  async runPromptFromGallery(index = 0): Promise<void> {
    const runButton = this.getPromptGalleryRunButtons().nth(index);
    await expect(runButton).toBeVisible({ timeout: 10_000 });
    await runButton.click();
  }

  async closePromptGallery(): Promise<void> {
    const closeButton = this.promptGalleryDialog
      .getByRole('button', { name: 'Close' })
      .first();
    await closeButton.click();
    await expect(this.promptGalleryDialog).not.toBeVisible({
      timeout: 10_000,
    });
  }
}
