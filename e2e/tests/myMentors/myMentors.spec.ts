import { test, expect } from '@playwright/test';

import { checkAdminStatus } from '../utils';
import { logger } from '@iblai/iblai-js/playwright';
import { inviteUserTest } from '../shared';
import { navigateToMentorApp } from '../profile/helpers';

test.describe('my mentor dropdown', () => {
  test.setTimeout(200000);
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  test('User should be able to access the mentor through the my mentor dropdown', async ({
    page,
  }) => {
    const myMentorsButton = page.getByRole('button', { name: 'My Mentors' });
    await expect(myMentorsButton).toBeVisible({ timeout: 10000 });
    await myMentorsButton.click();

    const mentorCardGrid = page.locator(
      'div.grid.grid-cols-1.gap-3.overflow-y-auto.px-1'
    );
    await expect(mentorCardGrid.first()).toBeVisible({ timeout: 120_000 });

    const cardCount = await mentorCardGrid.count();
    expect(cardCount).toBeGreaterThan(0);
    const myMentorButtons = page.getByText('My Mentors');
    const createButtons = page.locator('button:has-text("Create")');

    expect(await myMentorButtons.count()).toBeGreaterThanOrEqual(2);
    // The create button was remove from the header in v3 from v0 (v0 the vercel application)
    // So we have only one create button in the DOM.
    expect(await createButtons.count()).toBeGreaterThanOrEqual(1);

    await expect(myMentorButtons.first()).toBeVisible();
    await expect(createButtons.first()).toBeVisible();
    const firstMentorCard = mentorCardGrid.locator('> div').first();
    const firstMentorCardTextContent = await firstMentorCard.textContent();
    console.log('First element in card grid ', firstMentorCardTextContent);
    await firstMentorCard.click();
    // Wait for mentor card grid to become hidden (indicating navigation)
    await expect(mentorCardGrid).not.toBeVisible({ timeout: 15000 });
    console.log('After mentor selection - URL:', page.url());
    const afterCount = await page
      .locator('div.grid.grid-cols-1.gap-3.overflow-y-auto.px-1')
      .count();
    console.log('After mentor selection - Grid count:', afterCount);
    await expect(mentorCardGrid).not.toBeVisible();
  });

  test('IF my mentor modal has next button a user should navigate easily', async ({
    page,
  }) => {
    const myMentorsButton = page.getByRole('button', { name: 'My Mentors' });
    await expect(myMentorsButton).toBeVisible();
    await myMentorsButton.click();

    const myMentorDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'My Mentors' });
    await expect(myMentorDialog).toBeVisible();

    // CORRECT locator: actual mentor cards
    const mentorCards = myMentorDialog.locator(
      'div.grid.grid-cols-1.gap-3.overflow-y-auto.px-1 > div'
    );

    // wait till the first card is fully loaded (this is to ensure the endpoint to get mentors is completed before interaction)
    await expect(mentorCards.first()).toBeVisible({ timeout: 120_000 });

    // get mentor cards count
    const count = await mentorCards.count();
    expect(count).toBeGreaterThan(0);

    const createMentorButtons = myMentorDialog.getByRole('button', {
      name: 'Create',
    });
    await expect(createMentorButtons).toBeVisible();

    if (await myMentorDialog.getByLabel('Go to next page').isVisible()) {
      // Re-locate element immediately before clicking to avoid stale element reference
      await myMentorDialog.getByLabel('Go to next page').click();

      // Locate the <a> element that has aria-current="page"
      const currentPageLink = page.locator('a[aria-current="page"]');

      // Ensure it’s visible
      await expect(currentPageLink).toBeVisible();

      // Assert that the text inside it is "2"
      await expect(currentPageLink).toHaveText('2');

      await expect(mentorCards.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('invite user', async ({ page }) => {
    const isAdmin = await checkAdminStatus(page);

    if (isAdmin) {
      const inviteUserBtn = page.getByRole('button', { name: 'Invite User' });
      await expect(inviteUserBtn).toBeVisible({ timeout: 15000 });
      await inviteUserBtn.click();
      const inviteModal = page.getByRole('dialog', { name: 'Invite Users' });
      await inviteUserTest(page, inviteModal);
      const closeBtn = page.getByRole('button', { name: 'Close' });
      await expect(closeBtn).toBeVisible({ timeout: 10000 });
      await closeBtn.click();
      await expect(inviteModal).toBeHidden({ timeout: 10000 });
    } else {
      const inviteUserBtn = page.getByRole('button', { name: 'Invite User' });
      await expect(inviteUserBtn).not.toBeVisible({ timeout: 5000 });
      logger.info('You do not have permission to perform this action.');
    }
  });
});
