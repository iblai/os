import { expect, Page } from '@playwright/test';

export async function navigateToLLMTab({ page }: { page: Page }) {
  const mentorSettingsDropdown = page.getByRole('button', {
    name: 'Selected mentor dropdown',
  });
  await expect(mentorSettingsDropdown).toBeVisible({ timeout: 120000 });

  await mentorSettingsDropdown.click();

  const llmTab = page.getByRole('menuitem', { name: 'LLM' });
  await expect(llmTab).toBeVisible();

  await llmTab.click();

  const llmTabHeading = page.getByRole('heading', {
    name: 'LLM Configuration',
  });

  await expect(llmTabHeading).toBeVisible({ timeout: 120000 });
}
