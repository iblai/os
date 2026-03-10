import { test, expect } from '@playwright/test';
import { logger } from '@iblai/iblai-js/playwright';
import { navigateToMentorApp } from '../profile/helpers';

test.describe('chat functionality', () => {
  test('user can send message and receives a response', async ({ page }) => {
    await navigateToMentorApp(page);
    // make sure the user selects a valid llm provider
    const mentorMenuItems = page.getByRole('button', {
      name: 'Selected mentor dropdown',
    });
    await expect(mentorMenuItems).toBeVisible({ timeout: 10000 });
    await mentorMenuItems.click();

    // make sure the user selects a valid model
    const llmProviderTab = page.getByRole('menuitem', { name: 'LLM' });
    await expect(llmProviderTab).toBeVisible();
    await llmProviderTab.click();

    const openaiModelButton = page
      .locator('div')
      .filter({ hasText: /^OpenAI$/ })
      .first();
    await expect(openaiModelButton).toBeVisible();
    await openaiModelButton.click();

    const llmModel = page.getByRole('button', {
      name: 'OpenAI icon gpt-4o-mini',
    });
    await expect(llmModel).toBeVisible();

    const modelIsAlreadySelected = await llmModel.isDisabled();

    if (!modelIsAlreadySelected) {
      await llmModel.click();
    }

    // Close LLM Selection dialog and verify it's closed
    const llmSelectionDialog = page.getByRole('dialog', {
      name: 'LLM Selection',
    });
    const closeButton = llmSelectionDialog.getByRole('button', {
      name: 'Close',
    });
    await expect(closeButton).toBeVisible();
    await closeButton.click();
    await expect(llmSelectionDialog).not.toBeVisible({ timeout: 5000 });

    // Close Edit Mentor dialog and verify it's closed
    const editMentorDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Edit Mentor' });
    const editMentorCloseButton = editMentorDialog.getByRole('button', {
      name: 'Close',
    });
    await expect(editMentorCloseButton).toBeVisible();
    await editMentorCloseButton.click();
    await expect(editMentorDialog).not.toBeVisible({ timeout: 5000 });

    const textarea = page.getByRole('textbox');
    await expect(textarea).toBeVisible({ timeout: 10000 });
    await textarea.fill('hello');

    const sendButton = page.getByRole('button', { name: /send/i });
    await expect(sendButton).toBeEnabled({ timeout: 5000 });
    // Wait for the reducers to be stable (to be improved)
    await page.waitForTimeout(5000);
    await sendButton.click();

    // Wait for AI response using semantic selector instead of fragile CSS
    logger.info('Waiting for reply to be visible');
    const replyLocator = page.locator('.chat-ai-message-response').last();
    await expect(replyLocator).toBeVisible({ timeout: 60000 });

    await expect(replyLocator).not.toBeEmpty();
  });
});
