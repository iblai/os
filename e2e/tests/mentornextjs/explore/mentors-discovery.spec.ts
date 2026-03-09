import { test, expect } from '@playwright/test';
import { loadMoreMentors, mentorCardDisplay, searchMentor } from '../utils';
import { navigateToMentorApp } from '../profile/helpers';
import { safeWaitForURL } from '@iblai/iblai-js/playwright';

// Suite: Covers the mentors catalog behaviour on desktop viewports.
test.describe('Mentors Page (Desktop)', () => {
  test.setTimeout(200000);
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);

    const exploreButton = page.getByRole('button', {
      name: 'Mentors',
      exact: true,
    });
    await expect(exploreButton).toBeVisible();
    await exploreButton.click();

    // Wait for the navigation to /explore
    await safeWaitForURL(page, (url) => url.pathname.endsWith('/explore'), {
      timeout: 120000,
    });

    // Wait for All Mentors heading to be visible - indicates page is ready
    await expect(
      page.getByRole('heading', { name: 'All Mentors' })
    ).toBeVisible({ timeout: 60_000 });
  });

  test.describe('Mentor discovery interactions', () => {
    test('should have working search functionality', async ({ page }) => {
      await searchMentor(page);
    });

    test('should display mentor cards with correct information', async ({
      page,
    }) => {
      await mentorCardDisplay(page);
    });

    test('should load more mentors when clicking see more', async ({
      page,
    }) => {
      await loadMoreMentors(page);
    });
  });
});
