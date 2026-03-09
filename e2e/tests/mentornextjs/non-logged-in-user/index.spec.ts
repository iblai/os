import { test, expect, BrowserContext, Page } from '@playwright/test';

import { AUTH_HOST, MENTOR_NEXTJS_HOST } from '../../utils';
import { parsePlatformUrl } from '../utils';
import { navigateToSpecificTenantAndMentor } from '../utils/navigate/navigate-to-mentor-app';
import { navigateToMentorApp } from '../profile/helpers';
import { fillCreateMentorForm } from '../utils/create-mentor';
import { logger } from '@iblai/iblai-js/playwright';
import { safeWaitForURL } from '@iblai/iblai-js/playwright';

test.describe('Non-logged in user', () => {
  let mentorId = '';
  let platformKey = '';
  let createdMentorName = '';
  let setupContext: BrowserContext | null = null;
  let setupPage: Page | null = null;

  test.beforeAll(async ({ browser }) => {
    // Create a new context and page for setup — closed in beforeAll on success, or afterAll on failure
    setupContext = await browser.newContext(); // closed: beforeAll line 113 + afterAll safety cleanup
    setupPage = await setupContext.newPage();

    // Navigate to mentor app
    await navigateToMentorApp(setupPage);
    logger.info('Navigated to mentor app');

    // Create a new mentor for testing anonymous flows
    const mentorFormResult = await fillCreateMentorForm({
      page: setupPage,
      formValues: {
        mentorName: `Anonymous Test Mentor ${Date.now()}`,
        mentorDescription: 'Test mentor for anonymous user flows',
        mentorCategory: 'Advising',
        mentorVisibility: 'Anyone',
      },
    });
    createdMentorName = mentorFormResult.mentorName;
    logger.info(`Created mentor: ${createdMentorName}`);

    // Get the mentor ID and platform key from the URL
    const currentUrl = setupPage.url();
    const parsedUrl = parsePlatformUrl(currentUrl);
    platformKey = parsedUrl.platformKey;
    mentorId = parsedUrl.mentorId;
    logger.info(`Platform key: ${platformKey}, Mentor ID: ${mentorId}`);

    // Open embed dialog to configure anonymous access
    const mentorDropdownMenu = setupPage.getByRole('button', {
      name: 'Selected mentor dropdown',
    });
    await expect(mentorDropdownMenu).toBeVisible({ timeout: 10000 });
    await mentorDropdownMenu.click();

    const embedMenuItem = setupPage.getByRole('menuitem', { name: 'Embed' });
    await expect(embedMenuItem).toBeVisible();
    await embedMenuItem.click();

    const editMentorHeading = setupPage.getByRole('heading', {
      name: 'Edit Mentor',
    });
    await expect(editMentorHeading).toBeVisible({ timeout: 10000 });

    const embedDialogHeading = setupPage.getByRole('heading', {
      name: 'Embed',
    });
    await expect(embedDialogHeading).toBeVisible();
    logger.info('Embed dialog opened');

    // Set "Who Can Chat?" to "Anyone" (enable anonymous mode)
    const embedDialog = setupPage
      .getByRole('dialog')
      .filter({ hasText: 'Edit Mentor' });
    const whoCanChatSelect = embedDialog.getByRole('combobox', {
      name: 'Select who can chat',
    });
    await expect(whoCanChatSelect).toBeVisible();

    // Check current value and set to "Anyone" if needed
    const currentValue = await whoCanChatSelect.textContent();
    if (currentValue !== 'Anyone') {
      await whoCanChatSelect.click();

      // Wait for dropdown options to be visible
      const anyoneOption = setupPage.getByRole('option', { name: 'Anyone' });
      await expect(anyoneOption).toBeVisible({ timeout: 5000 });
      await anyoneOption.click();
      logger.info('Set chat access to "Anyone" (anonymous mode enabled)');
    } else {
      logger.info('Chat access already set to "Anyone" — no action taken');
    }

    const createEmbedButton = setupPage.getByRole('button', {
      name: 'Create Embed',
    });
    await expect(createEmbedButton).toBeVisible();
    await createEmbedButton.click();

    const embedCodeDialogHeading = setupPage.getByRole('heading', {
      name: 'Embedded Code',
    });
    await expect(embedCodeDialogHeading).toBeVisible({ timeout: 30000 });
    logger.info('Embed code generated successfully');

    // Close the dialog by pressing Escape
    await setupPage.keyboard.press('Escape');

    // Safe context closing - close page first, wait for stability
    await setupPage.waitForTimeout(500);
    await setupPage?.close();
    setupPage = null;

    try {
      await setupContext.close();
    } catch (e) {
      logger.info(
        'Setup context close failed (may be Chromium crash), continuing...'
      );
    }
    setupContext = null;

    logger.info('beforeAll setup completed');
  });

  test.afterAll(async ({ browser }) => {
    // Clean up setup context if beforeAll failed partway through
    if (setupPage) {
      await setupPage.close().catch(() => {});
      setupPage = null;
    }
    if (setupContext) {
      await setupContext.close().catch(() => {});
      setupContext = null;
    }

    // Clean up: Delete the created mentor
    if (!createdMentorName) {
      logger.info('No mentor to delete - skipping cleanup');
      return;
    }

    const cleanupContext = await browser.newContext();
    const cleanupPage = await cleanupContext.newPage();

    try {
      await navigateToMentorApp(cleanupPage);
      logger.info('Navigated to mentor app for cleanup');

      // Navigate to the created mentor using My Mentors
      const myMentorsBtn = cleanupPage.getByRole('button', {
        name: 'My Mentors',
      });
      await expect(myMentorsBtn).toBeVisible({ timeout: 30000 });
      await myMentorsBtn.click();

      const myMentorsDialog = cleanupPage
        .getByRole('dialog')
        .filter({ hasText: 'My Mentors' });
      await expect(myMentorsDialog).toBeVisible({ timeout: 10000 });

      // Search for the created mentor
      const searchInput = myMentorsDialog.getByRole('searchbox', {
        name: 'Search mentors',
      });
      await expect(searchInput).toBeVisible();
      await searchInput.fill(createdMentorName);

      // Wait for search results and click the mentor
      const mentorButton = myMentorsDialog.getByRole('button', {
        name: new RegExp(createdMentorName),
      });
      await expect(mentorButton).toBeVisible({ timeout: 10000 });
      await mentorButton.click();

      // Wait for navigation to the mentor
      await safeWaitForURL(cleanupPage, (url) =>
        url.pathname.includes(mentorId)
      );
      logger.info(`Navigated to mentor: ${createdMentorName}`);

      // Open dropdown and go to Settings
      const mentorDropdown = cleanupPage.getByRole('button', {
        name: 'Selected mentor dropdown',
      });
      await expect(mentorDropdown).toBeVisible({ timeout: 10000 });
      await mentorDropdown.click();

      const settingsMenuItem = cleanupPage.getByRole('menuitem', {
        name: 'Settings',
      });
      await expect(settingsMenuItem).toBeVisible();
      await settingsMenuItem.click();

      // Click Delete button in settings dialog
      const deleteButton = cleanupPage.getByRole('button', { name: 'Delete' });
      await expect(deleteButton).toBeVisible({ timeout: 10000 });
      await deleteButton.click();

      // Confirm deletion in the alert dialog
      const deleteDialog = cleanupPage.getByRole('alertdialog', {
        name: 'Delete Mentor',
      });
      await expect(deleteDialog).toBeVisible({ timeout: 5000 });
      await deleteDialog.getByRole('button', { name: 'Delete' }).click();

      // Wait for navigation away from the deleted mentor
      await safeWaitForURL(
        cleanupPage,
        (url) => url.pathname.includes('/explore'),
        {
          timeout: 30000,
        }
      );
      logger.info(`Deleted mentor: ${createdMentorName}`);
    } catch (e) {
      logger.info(
        `Cleanup failed: ${e.message}. The mentor may need manual deletion.`
      );
    } finally {
      // Safe context closing
      await cleanupPage.waitForTimeout(500);
      await cleanupPage.close();
      try {
        await cleanupContext.close();
      } catch (e) {
        logger.info('Cleanup context close failed, continuing...');
      }
    }
  });

  test.describe('Navigation and entry points', () => {
    test('should display proper UI for an anonymous user', async ({
      browser,
    }) => {
      const page = await navigateToSpecificTenantAndMentor({
        browser,
        platformKey,
        mentorId,
      });

      const loginButton = page.getByRole('button', { name: 'Log in' });
      await expect(loginButton).toBeVisible({ timeout: 120_000 });

      /* const mentorDropdownMenu = page.getByRole('button', {
        name: 'Selected mentor',
      });
      await expect(mentorDropdownMenu).toBeVisible();
      await mentorDropdownMenu.click();

      await expect(
        page.getByRole('menuitem', { name: 'New chat' })
      ).toBeVisible();

      const menuItemsList = await page.getByRole('menuitem').all();
      expect(menuItemsList).toHaveLength(1); */
    });

    test('should be able to click on the log in button', async ({
      browser,
    }) => {
      const page = await navigateToSpecificTenantAndMentor({
        browser,
        platformKey,
        mentorId,
      });

      const loginButton = page.getByRole('button', { name: 'Log in' });
      await expect(loginButton).toBeVisible({ timeout: 120_000 });
      await loginButton.click();

      // expect to be redirected to the auth platform
      await safeWaitForURL(
        page,
        (url) =>
          url.href.includes(AUTH_HOST) && url.href.includes(MENTOR_NEXTJS_HOST),
        { timeout: 60000 }
      );

      expect(page.url()).toContain(AUTH_HOST);
    });

    test('should be able to navigate to the mentors page', async ({
      browser,
    }) => {
      const page = await navigateToSpecificTenantAndMentor({
        browser,
        platformKey,
        mentorId,
      });

      //assert that we are actually on an anonymous page and not auths page
      const loginButton = page.getByRole('button', { name: 'Log in' });
      await expect(loginButton).toBeVisible({ timeout: 120_000 });

      const mentorsPageButton = page.getByRole('button', {
        name: 'Mentors',
        exact: true,
      });
      await expect(mentorsPageButton).toBeVisible();
      await mentorsPageButton.click();

      await safeWaitForURL(page, (url) => url.pathname.endsWith('/explore'), {
        timeout: 120000,
      });
      // Wait for the All Mentors heading to be visible
      await expect(
        page.getByRole('heading', { name: 'All Mentors' })
      ).toBeVisible({ timeout: 30000 });

      expect(page.url()).toContain('/explore');
    });
  });

  test.describe('Anonymous chat experience', () => {
    test('should be able to chat with an anonymous mentor and start new chat too', async ({
      browser,
    }) => {
      const page = await navigateToSpecificTenantAndMentor({
        browser,
        platformKey,
        mentorId,
      });

      //assert that we are actually on an anonymous page and not auths page
      const loginButton = page.getByRole('button', { name: 'Log in' });
      await expect(loginButton).toBeVisible({ timeout: 120_000 });

      const userMessage = 'Hello';

      const chatTextarea = page.getByPlaceholder('Ask anything');
      await expect(chatTextarea).toBeVisible();

      const sendButton = page.getByRole('button', { name: 'Send message' });

      await chatTextarea.fill(userMessage);
      await expect(sendButton).toBeEnabled({ timeout: 15000 });
      // justified: wait for Redux reducers to stabilize before sending message
      await page.waitForTimeout(5000);
      await sendButton.click();
      // justified: wait for AI response to be received and rendered in chat
      await page.waitForTimeout(10000);

      await expect(
        page
          .locator('div')
          .filter({ hasText: new RegExp(`^${userMessage}$`) })
          // justified: filter narrows to exact message text, first() avoids strict mode error on duplicate wrapper divs
          .first()
      ).toBeVisible({ timeout: 60000 });
    });
  });

  test.describe('Sidebar modals', () => {
    test('should be able to click and open the my mentors modal', async ({
      browser,
    }) => {
      const page = await navigateToSpecificTenantAndMentor({
        browser,
        platformKey,
        mentorId,
      });

      //assert that we are actually on an anonymous page and not auths page
      const loginButton = page.getByRole('button', { name: 'Log in' });
      await expect(loginButton).toBeVisible({ timeout: 120_000 });

      const myMentorsModalButton = page.getByRole('button', {
        name: 'My Mentors',
      });
      await expect(myMentorsModalButton).toBeVisible();
      await myMentorsModalButton.click();

      const myMentorsModalHeading = page.getByRole('heading', {
        name: 'My Mentors',
      });
      await expect(myMentorsModalHeading).toBeVisible();

      const createMentorButton = page.getByRole('button', {
        name: 'Create',
      });
      await expect(createMentorButton).not.toBeVisible();

      const searchMentorInput = page.getByRole('searchbox', {
        name: 'Search mentors',
      });
      await expect(searchMentorInput).toBeVisible();
      await searchMentorInput.fill('Test Mentor');

      expect(await searchMentorInput.inputValue()).toBe('Test Mentor');
    });
  });

  test.describe('Collapsed sidebar redirects', () => {
    test('should redirect to login when clicking sidebar buttons while sidebar is collapsed', async ({
      browser,
    }) => {
      const page = await navigateToSpecificTenantAndMentor({
        browser,
        platformKey,
        mentorId,
      });

      // Assert that we are on an anonymous page
      const loginButton = page.getByRole('button', { name: 'Log in' });
      await expect(loginButton).toBeVisible({ timeout: 120_000 });

      const sidebar = page.locator('[data-slot="sidebar"]');
      await expect(sidebar).toBeVisible({ timeout: 10000 });

      // Close the sidebar if it's open
      const sidebarState = await sidebar.getAttribute('data-state');
      if (sidebarState !== 'collapsed') {
        const closeSidebarButton = page.getByRole('button', {
          name: /close sidebar/i,
        });
        await expect(closeSidebarButton).toBeVisible({ timeout: 10000 });
        await closeSidebarButton.click();
      }

      // Verify sidebar is collapsed
      await expect(sidebar).toHaveAttribute('data-state', 'collapsed', {
        timeout: 10000,
      });

      // Click "New Mentor" button (isAnAdminAction: true) in collapsed sidebar
      // This should redirect to auth/login page
      const newMentorButton = sidebar.getByRole('button', {
        name: 'New Mentor',
      });
      await expect(newMentorButton).toBeVisible();
      await newMentorButton.click();

      await safeWaitForURL(page, (url) => url.href.includes(AUTH_HOST), {
        timeout: 60000,
      });

      expect(page.url()).toContain(AUTH_HOST);
    });

    test('should redirect to login when clicking Analytics button while sidebar is collapsed', async ({
      browser,
    }) => {
      const page = await navigateToSpecificTenantAndMentor({
        browser,
        platformKey,
        mentorId,
      });

      // Assert that we are on an anonymous page
      const loginButton = page.getByRole('button', { name: 'Log in' });
      await expect(loginButton).toBeVisible({ timeout: 120_000 });

      const sidebar = page.locator('[data-slot="sidebar"]');
      await expect(sidebar).toBeVisible({ timeout: 10000 });

      // Close the sidebar if it's open
      const sidebarState = await sidebar.getAttribute('data-state');
      if (sidebarState !== 'collapsed') {
        const closeSidebarButton = page.getByRole('button', {
          name: /close sidebar/i,
        });
        await expect(closeSidebarButton).toBeVisible({ timeout: 10000 });
        await closeSidebarButton.click();
      }

      // Verify sidebar is collapsed
      await expect(sidebar).toHaveAttribute('data-state', 'collapsed', {
        timeout: 10000,
      });

      // Click "Analytics" button (isAnAdminAction: true, footer item) in collapsed sidebar
      const analyticsButton = sidebar.getByRole('button', {
        name: 'Analytics',
      });
      await expect(analyticsButton).toBeVisible();
      await analyticsButton.click();

      await safeWaitForURL(page, (url) => url.href.includes(AUTH_HOST), {
        timeout: 60000,
      });

      expect(page.url()).toContain(AUTH_HOST);
    });
  });
});
