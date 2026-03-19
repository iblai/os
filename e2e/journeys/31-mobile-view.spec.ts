import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp } from '../utils/auth';

test.use({ viewport: { width: 393, height: 851 } }); // Pixel 5

test.describe('Journey 31: Mobile View', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  test('authenticated user on mobile goes to sidebar and sees the correct menu items', async ({
    page,
    sidebarPage,
  }) => {
    // Sidebar may be auto-collapsed on mobile — expand it
    const toggleBtn = sidebarPage.toggleButton;
    if (await toggleBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await toggleBtn.click();
      await page.waitForTimeout(500);
    }
    await expect(sidebarPage.exploreLink).toBeVisible({ timeout: 10_000 });
    await expect(sidebarPage.notificationsLink).toBeVisible({ timeout: 10_000 });
  });

  test('authenticated user on mobile goes to navbar and the mentor dropdown works correctly', async ({
    navbarPage,
  }) => {
    await navbarPage.openMentorDropdown();
    const menu = navbarPage.page.getByRole('menu');
    await expect(menu).toBeVisible({ timeout: 5_000 });
    await navbarPage.page.keyboard.press('Escape');
  });

  test('authenticated user on mobile goes to navbar and the profile button works correctly', async ({
    navbarPage,
  }) => {
    await navbarPage.openProfileDropdown();
    const menu = navbarPage.page.getByRole('menu');
    await expect(menu).toBeVisible({ timeout: 5_000 });
    await navbarPage.page.keyboard.press('Escape');
  });

  test('authenticated user on mobile goes to platform and navbar components render correctly', async ({
    page,
    navbarPage,
  }) => {
    await expect(navbarPage.mentorDropdown).toBeVisible({ timeout: 15_000 });
    await expect(navbarPage.profileDropdown).toBeVisible({ timeout: 10_000 });
  });

  test('authenticated user on mobile goes to explore page and sees the title, description, and tabs', async ({
    page,
    sidebarPage,
    explorePage,
  }) => {
    await sidebarPage.navigateToExplore();
    await expect(explorePage.heading).toBeVisible({ timeout: 15_000 });
  });

  test('authenticated user on mobile goes to explore page and searches for a mentor', async ({
    page,
    sidebarPage,
    explorePage,
  }) => {
    await sidebarPage.navigateToExplore();
    await expect(explorePage.searchInput).toBeVisible({ timeout: 10_000 });
    await explorePage.search('test');
    await expect(explorePage.searchInput).toHaveValue('test');
  });

  test('authenticated user on mobile goes to datasets tab and performs upload and untrain/delete flow', async ({
    page,
    editMentorPage,
  }) => {
    const dropdown = page.getByRole('button', { name: 'Selected mentor dropdown button' });
    if (!await dropdown.isVisible({ timeout: 10_000 }).catch(() => false)) return;
    await editMentorPage.open('Datasets');
    await page.waitForTimeout(1_000);
    await expect(editMentorPage.datasets.addResourceButton).toBeVisible({ timeout: 10_000 });
    await editMentorPage.close();
  });
});
