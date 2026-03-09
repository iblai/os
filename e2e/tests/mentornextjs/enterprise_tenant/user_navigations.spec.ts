import test, { expect } from '@playwright/test';
import { MENTOR_NEXTJS_HOST } from '../../utils';
import { checkAdminStatus } from '../utils';
import {
  openSidebarIfClosed,
  clickLogoAndAssertHome,
  openNewChatAndNavigate,
  navigateToMentor,
} from './helpers';
import { logger } from '@iblai/iblai-js/playwright';
import { safeWaitForURL } from '@iblai/iblai-js/playwright';

const timeStamp = Date.now();
const projectName = `project-${timeStamp}`;

test.describe('Enterprise tenant ', () => {
  test.beforeEach(async ({ page }) => {
    logger.info('Logging in as admin before test');
    await navigateToMentor(page);
  });

  test('Suite 1: Sidebar open/close behavior', async ({ page }) => {
    // Try to open sidebar if it's closed
    await openSidebarIfClosed(page);

    // Toggle button should switch text between open/close (if available)
    const sidebarToggle = page.getByRole('button', {
      name: /open sidebar|close sidebar/i,
    });
    if (await sidebarToggle.isVisible()) {
      const before = await sidebarToggle.innerText();
      await sidebarToggle.click();
      const after = await sidebarToggle.innerText();
      expect(before).not.toBe(after);
    } else {
      test.skip();
    }
  });

  test('Suite 2: Logo navigates home', async ({ page }) => {
    const isAdmin = await checkAdminStatus(page);
    expect(isAdmin).toBeTruthy();

    // Ensure sidebar state won't block interactions
    await openSidebarIfClosed(page);

    // Click logo and assert home content
    await clickLogoAndAssertHome(page);
  });

  test('Suite 3: New chat navigation and sidebar items', async ({ page }) => {
    const isAdmin = await checkAdminStatus(page);
    expect(isAdmin).toBeTruthy();

    // Open New Chat
    await openNewChatAndNavigate(page);

    // Expect mentors button visible in the explore view
    const mentorsButton = page.getByRole('button', {
      name: 'Mentors',
      exact: true,
    });
    await expect(mentorsButton).toBeVisible({ timeout: 10000 });

    // Click mentors
    await mentorsButton.click();
    await safeWaitForURL(
      page,
      new RegExp(`^${MENTOR_NEXTJS_HOST}/platform/.*/.*/explore`)
    );

    // Notifications and analytics from sidebar
    const notifications = page.getByRole('button', {
      name: 'Notifications',
      exact: true,
    });
    await expect(notifications).toBeVisible({ timeout: 10000 });
    await notifications.click();
    await safeWaitForURL(
      page,
      new RegExp(`^${MENTOR_NEXTJS_HOST}/platform/.*/.*/notifications`)
    );

    const analytics = page.getByRole('button', { name: /analytics/i });
    if (await analytics.isVisible()) {
      await analytics.click();
      await safeWaitForURL(
        page,
        new RegExp(`^${MENTOR_NEXTJS_HOST}/platform/.*/.*/analytics`)
      );
    }

    // Return to explore by clicking new chat again
    const newChat = page.getByRole('button', { name: /new chat/i });
    await expect(newChat).toBeVisible();
    await newChat.click();

    // Wait for explore page to be visible
    await expect(
      page.getByRole('heading', { name: /explore mentors/i })
    ).toBeVisible({ timeout: 60_000 });
  });
});
