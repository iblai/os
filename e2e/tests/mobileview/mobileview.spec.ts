import { test, expect, devices } from '@playwright/test';
import { MENTOR_NEXTJS_HOST } from '../utils';
import {
  checkAdminStatus,
  headerComponentsDisplayCorrectly,
  searchMentor,
  selectDropdownWorksCorrectly,
  toggleSidebar,
  userProfileButtonWorksCorrectly,
} from '../utils';

test.use(devices['Pixel 5']);

// Suite: Ensures the mentor application behaves correctly on smaller viewports.
test.describe('Mentor App - Mobile View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(MENTOR_NEXTJS_HOST, { waitUntil: 'domcontentloaded' });
    // Wait for specific UI element indicating page is ready instead of arbitrary timeout
    await expect(
      page.getByRole('button', { name: 'Selected mentor dropdown button' })
    ).toBeVisible({ timeout: 30000 });
  });

  test.describe('Sidebar navigation', () => {
    test('should display correct menu items', async ({ page }) => {
      const isAdmin = await checkAdminStatus(page);
      const sideBarDialog = await toggleSidebar(page);
      await expect(sideBarDialog).toBeVisible();

      if (isAdmin) {
        const sideBarMenus = [
          'Mentors',
          'New Mentor',
          'Invite Users',
          'Analytics',
          'Settings',
        ];
        for (const sideBarMenu of sideBarMenus) {
          await expect(
            sideBarDialog.getByRole('button', {
              name: sideBarMenu,
              exact: true,
            })
          ).toBeVisible();
        }
      } else {
        const sideBarMenus = ['Mentors'];
        for (const sideBarMenu of sideBarMenus) {
          await expect(
            sideBarDialog.getByRole('button', {
              name: sideBarMenu,
              exact: true,
            })
          ).toBeVisible();
        }
      }
    });
  });

  test.describe('Header and profile interactions', () => {
    test('mentor dropdown works correctly in mobile view', async ({ page }) => {
      await selectDropdownWorksCorrectly(page);
    });

    test('user profile button works correctly in mobile view', async ({
      page,
    }) => {
      await userProfileButtonWorksCorrectly(page);
    });

    test('navbar components render correctly', async ({ page }) => {
      const isAdmin = await checkAdminStatus(page);
      const navBar = page.locator('nav');
      await navBar.waitFor();
      const navBarBtn = navBar.getByRole('button');
      if (isAdmin) {
        await expect(navBarBtn).toHaveCount(5);
      } else {
        await expect(navBarBtn).toHaveCount(4);
      }
    });
  });
});
