import { test, expect, Page } from '@playwright/test';

import { logger } from '@iblai/iblai-js/playwright';
import {
  closeWithEsc,
  isJSON,
} from '@iblai/iblai-js/playwright';
import {
  headerComponentsDisplayCorrectly,
  selectDropdownWorksCorrectly,
  userProfileButtonWorksCorrectly,
  switchInstructorLearnerMode,
} from '../utils';
import { navigateToMentorApp } from '../profile/helpers';

const STUDENT_MODE = 'student';
const INSTRUCTOR_MODE = 'instructor';
let isAdmin = false;
let currentMode = STUDENT_MODE;

// Suite: Verifies the overview landing experience for authenticated users.
test.describe('Overview Page', () => {
  test.setTimeout(200000);
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);

    const currentTenant =
      (await page.evaluate(() => localStorage.getItem('current_tenant'))) ||
      '{}';
    isAdmin = isJSON(currentTenant) && JSON.parse(currentTenant).is_admin;
  });

  test.describe('Header experience', () => {
    test('should display header components correctly', async ({ page }) => {
      await headerComponentsDisplayCorrectly(page);
    });

    test('ensures current mentor dropdown responds to clicks', async ({
      page,
    }) => {
      await selectDropdownWorksCorrectly(page);
    });

    test('ensures user profile dropdown buttons work as expected', async ({
      page,
    }) => {
      logger.info('Click on the profile button');
      await userProfileButtonWorksCorrectly(page);
    });
  });

  test.describe('Sidebar experience', () => {
    test('should display sidebar components correctly', async ({ page }) => {
      currentMode = INSTRUCTOR_MODE;
      logger.info('Check if sidebar is visible');
      const sidebar = page.locator('[data-slot="sidebar"]');
      await expect(sidebar).toBeVisible({ timeout: 60000 });

      //Check if the expand menu button is visible
      logger.info('Check if the expand menu button is visible');
      const expandMenuButton = page.getByRole('button', {
        name: 'Open sidebar Toggle Sidebar',
      });
      await expect(expandMenuButton).toBeVisible();
      logger.info('Click the expand menu button');
      await expandMenuButton.click();
      // Wait for sidebar to expand
      await expect(sidebar).toHaveAttribute('data-state', 'expanded', {
        timeout: 10000,
      });

      logger.info('Check if the sidebar is expanded');
      await expect(sidebar).toHaveAttribute('data-state', 'expanded');
      logger.info('Check if the mentors button is visible');
      const exploreButton = sidebar.getByRole('button', {
        name: 'Mentors',
        exact: true,
      });
      await expect(exploreButton).toBeVisible();

      //Check if the new chat button is visible
      logger.info('Check if the new chat button is visible');
      const newChatButton = sidebar.getByRole('button', {
        name: 'New Chat',
        exact: true,
      });
      await expect(newChatButton).toBeVisible();

      //Click the explore button
      logger.info('Click the mentors button');
      await exploreButton.click();
      await expect(page).toHaveURL(/.*explore/, { timeout: 120_000 });

      await newChatButton.click();

      // Wait for URL change instead of arbitrary timeout
      await expect(page).toHaveURL(/\/platform\/[^/]+\/[^/]+/, {
        timeout: 15000,
      });

      //Click the collapse menu button
      logger.info('Click the collapse menu button');

      await page
        .getByRole('button', { name: 'Close sidebar Toggle Sidebar' })
        .click();

      //Check if the sidebar is collapsed (state-based wait instead of arbitrary timeout)
      logger.info('Check if the sidebar is collapsed');
      await expect(sidebar).toHaveAttribute('data-state', 'collapsed', {
        timeout: 10000,
      });

      //Check if the Mentors, new chat, invite user and new button is visible
      logger.info(
        'Check if the Mentors, new chat, invite user and new button is visible'
      );
      const listItems = page
        .locator(
          'div[data-slot="sidebar-content"] ul[data-slot="sidebar-menu"]'
        )
        .first()
        .locator('> li[data-slot="sidebar-menu-item"]');

      const count = await listItems.count();
      console.log('Found', count, 'main sidebar menu items.');
      expect(count).toBe(4);

      //Check if the sidebar settings is visible
      logger.info('Check if the sidebar settings is visible');
      const settingsButton = page.getByRole('button', { name: 'Settings' });

      // Assert it is visible
      await expect(settingsButton).toBeVisible();
      //Click the sidebar settings button
      logger.info('Click the sidebar settings button');
      await settingsButton.click();

      //Check if the sidebar settings modal is visible (state-based wait)
      logger.info('Check if the sidebar settings modal is visible');
      const sidebarSettingsModal = page
        .getByRole('dialog')
        .filter({ hasText: 'Settings' });
      await expect(sidebarSettingsModal).toBeVisible({ timeout: 10000 });

      //Close the sidebar settings modal
      logger.info('Close the sidebar settings modal');
      const closeSideBarSettingsModal = sidebarSettingsModal.getByRole(
        'button',
        { name: 'Close' }
      );
      await expect(closeSideBarSettingsModal).toBeVisible();
      await closeSideBarSettingsModal.click();
      // expect settings dialog should not be visible
      await expect(sidebarSettingsModal).not.toBeVisible({ timeout: 10_000 });
      logger.info('Sidebar settings modal closes');

      if (isAdmin) {
        if (currentMode === STUDENT_MODE) {
          //Switch to instructor mode
          logger.info('Switch to instructor mode');
          await switchInstructorLearnerMode(page);
          currentMode = INSTRUCTOR_MODE;
        }
        //Check if the sidebar settings button is not visible
        logger.info('Check if the New Mentor button is  visible');
        const newMentorButton = sidebar.getByRole('button', {
          name: 'New Mentor',
        });
        await expect(newMentorButton).toBeVisible();

        //Click the New Mentor button
        logger.info('Click the New Mentor button');
        await newMentorButton.click();
        // Wait for create mentor modal to appear
        await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 });
        await handleCreateMentorModalTest(page);
        //Check if Invite User button is visible
        logger.info('Check if Invite User button is visible');
        const inviteUserButton = sidebar.getByRole('button', {
          name: 'Invite User',
        });
        await expect(inviteUserButton).toBeVisible();

        //Click the Invite User button
        logger.info('Click the Invite User button');
        await inviteUserButton.click();
        //Check if the Invite User modal is visible
        logger.info('Check if the Invite User modal is visible');
        await expect(
          page.getByRole('heading', { name: 'Invite Users' })
        ).toBeVisible({
          timeout: 6000,
        });

        //Close the Invite User modal
        logger.info('Close the Invite User modal');
        await closeWithEsc(page);
        await expect(
          page.getByRole('dialog').filter({ hasText: 'Invite Users' })
        ).not.toBeVisible();
        logger.info('Invite User modal closes');

        //Check if Ananlytics button is visible
        logger.info('Check if Ananlytics button is visible');
        const analyticsButton = sidebar.getByRole('button', {
          name: 'Analytics',
        });
        await expect(analyticsButton).toBeVisible();

        //Click the Analytics button
        logger.info('Click the Analytics button');
        await analyticsButton.click();

        await expect(page).toHaveURL(/.*analytics/, { timeout: 120_000 });
      }
    });
  });

  test('Sidebar Vector document should be visible', async ({ page }) => {
    logger.info('Check if the sidebar container is visible');
    const sidebarContainer = page.getByRole('complementary');
    logger.info('Check if the Vector Document sidebar is visible');
    if (await sidebarContainer.isVisible()) {
      logger.info('Check if the sidebar Vector document toggler is visible');
      const sidebarContainerToggler = sidebarContainer.locator('div').nth(1);
      await expect(sidebarContainerToggler).toBeVisible();

      logger.info('Click on the sidebar Vector document toggler');
      await sidebarContainerToggler.click();

      // State-based wait for sidebar collapse animation
      await expect(sidebarContainer).toHaveClass(/.*w-\[40px\].*/, {
        timeout: 10000,
      });

      logger.info('Click on the sidebar Vector document toggler again');
      await sidebarContainer.locator('div').nth(1).click();

      // State-based wait for sidebar expand animation
      await expect(sidebarContainer).toHaveClass(/.*w-\[380px\].*/, {
        timeout: 10000,
      });
    }
  });
});

async function handleCreateMentorModalTest(page: Page) {
  //Check if the New Mentor modal is visible (state-based wait)
  logger.info('Check if the New Mentor modal is visible');
  await expect(page.getByText('Create Mentor').first()).toBeVisible({
    timeout: 10000,
  });

  //Close the New Mentor modal
  logger.info('Close the New Mentor modal');
  await closeWithEsc(page);
  await expect(page.getByText('Create Mentor').nth(1)).not.toBeVisible({
    timeout: 6000,
  });
  logger.info('New Mentor modal closes');
}
