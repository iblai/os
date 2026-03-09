import { test, expect, Page } from '@playwright/test';

import { closeWithEsc } from '@iblai/iblai-js/playwright';
import { checkAdminStatus } from '../utils';
import { navigateToMentorApp } from '../profile/helpers';

let isAdminUser = false;

async function openLLMSelectionFromNav(page: Page) {
  const buttonWithProviderLogo = page.getByRole('button', {
    name: 'LLM Model Selector',
  });
  await expect(buttonWithProviderLogo).toBeVisible({ timeout: 10000 });
  await buttonWithProviderLogo.click();
}

test.describe('LLM Provider Selection Modal', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);

    isAdminUser = await checkAdminStatus(page);
  });

  test.describe('Navigation entry point', () => {
    test('hides configuration header when opened from the nav bar', async ({
      page,
    }) => {
      test.skip(
        !isAdminUser,
        'Requires admin privileges to manage LLM providers.'
      );

      await openLLMSelectionFromNav(page);

      const llmDialog = page.getByRole('dialog', { name: /LLM Providers/i });
      await expect(llmDialog).toBeVisible({ timeout: 10000 });

      await expect(
        page.getByRole('heading', { name: 'LLM Providers' })
      ).toBeVisible();
      await expect(page.getByText('LLM Configuration')).toHaveCount(0);
      await expect(
        page.getByText('Configure the language model settings for your mentor.')
      ).toHaveCount(0);

      await closeWithEsc(page);
      await expect(llmDialog).not.toBeVisible();
    });
  });

  test.describe('Edit mentor workflow', () => {
    test('retains configuration header inside the Edit Mentor modal', async ({
      page,
    }) => {
      test.skip(
        !isAdminUser,
        'Requires admin privileges to manage mentor settings.'
      );

      const mentorDropdownTrigger = page.getByRole('button', {
        name: 'Selected mentor dropdown button',
      });
      await mentorDropdownTrigger.click();

      const llmMenuItem = page.getByRole('menuitem', { name: 'LLM' });
      await llmMenuItem.click();

      const editMentorDialog = page.getByRole('dialog').filter({
        has: page.getByRole('heading', { name: 'LLM Configuration' }),
      });
      await expect(editMentorDialog).toBeVisible();

      await expect(
        page.getByRole('heading', { name: 'LLM Configuration' })
      ).toBeVisible();
      await expect(
        page.getByText('Configure the language model settings for your mentor.')
      ).toBeVisible();

      await closeWithEsc(page);
      await expect(editMentorDialog).not.toBeVisible();
    });
  });
});
