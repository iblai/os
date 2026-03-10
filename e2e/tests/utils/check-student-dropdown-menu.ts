import { expect, Page } from '@playwright/test';

export async function checkStudentDropdownMenu({ page }: { page: Page }) {
  const mentorSettingsDropdown = page.getByRole('button', {
    name: 'Selected mentor dropdown',
  });
  await expect(mentorSettingsDropdown).toBeVisible();

  await mentorSettingsDropdown.click();

  const newChatMenuItem = page.getByRole('menuitem', { name: 'New Chat' });
  await expect(newChatMenuItem).toBeVisible();

  const llmTab = page.getByRole('menuitem', { name: 'LLM' });
  await expect(llmTab).not.toBeVisible();
}
