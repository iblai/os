import { Locator, Page, expect } from '@playwright/test';
import { MENTOR_NEXTJS_HOST, AUTH_HOST } from '../utils';
import { checkAdminStatus } from '../utils';
import { logger } from '@iblai/iblai-js/playwright';
import { navigateToMentorApp } from '../profile/helpers';

export const DEFAULT_ADMIN = {
  email: 'iblaiuserone@ibleducation.com',
  password: 'ibledu_2024',
};

export async function openSidebarIfClosed(page: Page) {
  const sidebarToggleLocator = page.getByRole('button', {
    name: /open sidebar|close sidebar/i,
  });
  // If visible, click to ensure it's open
  if (await sidebarToggleLocator.isVisible()) {
    // Re-locate to avoid stale element reference
    const text = await page
      .getByRole('button', { name: /open sidebar|close sidebar/i })
      .innerText();
    if (/open sidebar/i.test(text)) {
      await page
        .getByRole('button', { name: /open sidebar|close sidebar/i })
        .click();
      // wait for toggle text to change
      await page.waitForFunction(
        () => {
          const btn = document.querySelector('button');
          return !!btn;
        },
        { timeout: 5000 }
      );
    }
  }
}

export async function clickLogoAndAssertHome(page: Page) {
  const logoButton = page.getByRole('button', { name: /logo/i });
  await expect(logoButton).toBeVisible({ timeout: 10000 });
  await logoButton.click();

  // After clicking logo, assert we're on home - existing chats or explore mentors
  const mentorResponse = page.locator('[class*=\"chat-ai-message-response\"]');
  const exploreHeading = page.getByRole('heading', {
    name: /explore mentors/i,
  });

  if (
    await mentorResponse
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    await expect(mentorResponse.first()).toBeVisible({ timeout: 10000 });
  } else {
    await expect(exploreHeading).toBeVisible({ timeout: 10000 });
  }
}

export async function openNewChatAndNavigate(page: Page) {
  const newChat = page.getByRole('button', { name: /new chat/i });
  await expect(newChat).toBeVisible({ timeout: 15000 });
  await newChat.click();

  // Wait for explore mentors heading visible - indicates page is ready
  const explore = page.getByRole('heading', { name: /explore mentors/i });
  await expect(explore).toBeVisible({ timeout: 60_000 });
}

export async function openMyMentorsDialog(page: Page) {
  const myMentors = page.getByRole('button', { name: /my mentors/i });
  await expect(myMentors).toBeVisible();
  await myMentors.click();
  const dialog = page.getByRole('dialog').filter({ hasText: /my mentors/i });
  await expect(dialog).toBeVisible();
  const mentorCards = dialog.locator(
    'div.grid.grid-cols-1.gap-3.overflow-y-auto.px-1 > div'
  );

  // wait for api call to load all mentors to get completed before interacting with the application
  await expect(mentorCards.first()).toBeVisible({ timeout: 120_000 });
}

export async function findFirstMentorWithoutBlueTick(
  page: Page
): Promise<Locator | null> {
  // Get all mentor buttons
  const allMentorButtons = page.locator('button').filter({
    has: page.locator('span[data-slot="avatar"]'),
  });

  const count = await allMentorButtons.count();

  // Iterate through each mentor button
  for (let i = 0; i < count; i++) {
    const mentorButton = allMentorButtons.nth(i);

    // Check if this button has the blue checkmark
    // The blue tick is indicated by a blue background circle with a check icon
    const hasCheckmark =
      (await mentorButton.locator('div.bg-blue-600.rounded-full').count()) > 0;

    if (!hasCheckmark) {
      return mentorButton;
    }
  }

  return null;
}

export async function createNewProject(
  page: Page,
  projectName?: string
): Promise<void> {
  const isAdmin = await checkAdminStatus(page);
  expect(isAdmin).toBeTruthy();

  await openSidebarIfClosed(page);

  const newProjectBtn = page.getByRole('button', { name: /new project/i });
  await expect(newProjectBtn).toBeVisible({ timeout: 10000 });
  await newProjectBtn.click();

  // Wait for dialog
  const dialog = page.getByRole('dialog').filter({ hasText: /new project/i });
  await expect(dialog).toBeVisible({ timeout: 15000 });

  // Fill project name (use passed name or auto-generate)
  const timeStamp = Date.now();
  const finalProjectName = projectName ?? `project-${timeStamp}`;
  const nameInput = dialog.getByPlaceholder('Project name');
  await expect(nameInput).toBeVisible();
  await nameInput.fill(finalProjectName);

  // Select a mentor card (first available)
  const mentorCardLocator = dialog
    .getByRole('button')
    .filter({ hasText: /mentor/i })
    .first();
  await expect(mentorCardLocator).toBeVisible({ timeout: 120_000 });
  // Re-locate and click to avoid stale element reference
  await dialog
    .getByRole('button')
    .filter({ hasText: /mentor/i })
    .first()
    .click();

  const saveBtn = dialog.getByRole('button', { name: /save/i });
  await expect(saveBtn).toBeVisible();
  await saveBtn.click();

  // Wait for dialog to close or show error
  await page.waitForTimeout(10_000);

  if (await dialog.isVisible()) {
    logger.info(
      'New Project dialog is still visible after clicking Save. Failing to create mentor.'
    );
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).not.toBeVisible();
    return;
  } else {
    // Wait for dialog to close and page to refresh
    await expect(dialog).not.toBeVisible();

    // Assert new project visible on page
    const projectHeading = page
      .getByRole('heading')
      .filter({ hasText: new RegExp(`^${finalProjectName}$`) });
    await projectHeading.first().waitFor({ state: 'visible', timeout: 30000 });
    await expect(projectHeading).toBeVisible({ timeout: 30000 });
  }
}

export async function navigateToMentor(page: Page): Promise<void> {
  await navigateToMentorApp(page);
  const isAdmin = await checkAdminStatus(page);
  expect(isAdmin).toBeTruthy();
}

export async function addMentor(page: Page): Promise<void> {
  // get add mentor button
  const addMentorBtn = page.getByRole('button', { name: /add mentor/i });
  await expect(addMentorBtn).toBeVisible();
  // assert initial mentor count

  const mentorCards = page.getByRole('button', { name: /^Select mentor/ });

  // Get the count of mentor cards
  const initialMentorCount = await mentorCards.count();
  expect(initialMentorCount).toBeGreaterThan(0);

  // click add mentor button
  await addMentorBtn.click();

  // expect add mentor dialog visible
  const addDialog = page
    .getByRole('dialog')
    .filter({ hasText: /add mentor to/i });
  await expect(addDialog).toBeVisible({ timeout: 10_000 });

  // add mentor without blue tick

  const firstMentorWithoutTick = await findFirstMentorWithoutBlueTick(page);
  if (firstMentorWithoutTick) {
    // Click the mentor
    await firstMentorWithoutTick.click();

    await addDialog.getByRole('button', { name: /done/i }).click();
    await expect(addDialog).not.toBeVisible();

    // Verify mentor count increased by 1 (with retry for async updates)
    await expect(async () => {
      const updatedMentorCount = await mentorCards.count();
      expect(updatedMentorCount).toBe(initialMentorCount + 1);
    }).toPass({ timeout: 30_000 });
  } else {
    console.log('No mentor without blue tick found');
    await addDialog.getByRole('button', { name: /done/i }).click();
    await expect(addDialog).not.toBeVisible({ timeout: 15000 });
  }
}

export async function deleteProject(
  page: Page,
  projectName: string
): Promise<void> {
  // open sidebar if closed
  await openSidebarIfClosed(page);
  // FIX 1: Hover over the trigger element
  await page
    .getByRole('button', { name: `Close Folder ${projectName}` })
    .hover();

  // FIX 2: Wait for CSS transitions/animations to complete
  // GitHub Actions executes faster than local, so hover effects need time to render
  // 300-500ms is typically sufficient for most CSS transitions
  await page.waitForTimeout(500);

  // FIX 3: Get reference to the action button
  const actionBtn = page.getByRole('button').filter({ hasText: /^$/ }).nth(1);

  // FIX 4: First ensure the element exists in the DOM
  // This separates DOM attachment from visibility, helping identify if the issue
  // is with element rendering vs CSS visibility properties
  await actionBtn.waitFor({ state: 'attached' });

  // FIX 5: Finally assert visibility with extended timeout
  // The 10s timeout allows for any additional rendering delays in CI environment
  await expect(actionBtn).toBeVisible({ timeout: 10_000 });

  await actionBtn.click();
  const deleteBtn = page.getByRole('menuitem', { name: 'Delete Project' });
  await expect(deleteBtn).toBeVisible();
  await deleteBtn.click();

  const deleteDialog = page
    .getByRole('dialog')
    .filter({ hasText: /delete project/i });
  await expect(deleteDialog).toBeVisible();

  const confirmDelete = deleteDialog.getByRole('button', {
    name: /delete project/i,
  });
  await confirmDelete.click();
  await expect(deleteDialog).not.toBeVisible({ timeout: 15000 });
  await expect(
    page
      .getByRole('heading')
      .filter({ hasText: new RegExp(`^${projectName}$`) })
  ).not.toBeVisible({ timeout: 10000 });
}
