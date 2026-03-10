import { test, expect, devices } from '@playwright/test';
import { MENTOR_NEXTJS_HOST } from '../utils';
import {
  loadMoreMentors,
  mentorCardDisplay,
  NavigateToMentorPageOnClickingMentorCard,
  searchMentor,
  switchBetweenTabs,
  toggleSidebar,
} from '../utils';
import { expectMentorTextsVisible } from '../utils';
import { safeWaitForURL } from '@iblai/iblai-js/playwright';
const pageURL = MENTOR_NEXTJS_HOST;

test.skip();

test.use(devices['Pixel 5']);

// Suite: Validates the mentors discovery experience on mobile devices.
test.describe('Mentors Page (Mobile)', () => {
  test.setTimeout(200000);
  test.beforeEach(async ({ page }) => {
    await page.goto(pageURL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    const sideBarDialog = await toggleSidebar(page);
    const exploreBtn = sideBarDialog.getByRole('button', {
      name: 'Mentors',
      exact: true,
    });
    await expect(exploreBtn).toBeVisible();
    await exploreBtn.click();
    // Wait for the navigation to /explore
    await safeWaitForURL(page, (url) => url.pathname.endsWith('/explore'), {
      timeout: 80000,
      waitUntil: 'domcontentloaded',
    });
    // Wait for the All Mentors heading to be visible
    await expect(
      page.getByRole('heading', { name: 'All Mentors' })
    ).toBeVisible({ timeout: 30000 });
  });

  test.describe('Mentors catalog visibility', () => {
    test('should display page title and description', async ({ page }) => {
      await expectMentorTextsVisible(page);
    });

    test('should display and switch between tabs', async ({ page }) => {
      await switchBetweenTabs(page);
    });
  });

  test.describe('Mentor discovery interactions', () => {
    test('should have working search functionality', async ({ page }) => {
      await searchMentor(page);
    });

    test('should display mentor card with correct information', async ({
      page,
    }) => {
      await mentorCardDisplay(page);
    });

    test('should load more mentors when clicking see more', async ({
      page,
    }) => {
      await loadMoreMentors(page);
    });

    test('should navigate to mentor page when clicking mentor card', async ({
      page,
    }) => {
      await NavigateToMentorPageOnClickingMentorCard(page);
    });
  });
});
