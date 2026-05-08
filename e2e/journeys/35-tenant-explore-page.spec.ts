import { test, expect } from '../fixtures/mentor-test';
import { checkAdminStatus } from '../utils/auth';
import { navigateToTenantExplorePage } from '../utils/navigation';

test.describe('Journey 35: Tenant Explore Page — Non-Admin', () => {
  test.beforeEach(async ({ nonadminPage }) => {
    await navigateToTenantExplorePage(nonadminPage);
  });

  test('non-admin goes to tenant explore page and sees sidebar and navbar', async ({
    nonadminPage,
    nonadminSidebarPage,
    nonadminExplorePage,
  }) => {
    await expect(nonadminSidebarPage.toggleButton).toBeVisible({
      timeout: 10_000,
    });
    await expect(nonadminExplorePage.heading).toBeVisible({ timeout: 20_000 });
    await expect(nonadminPage).toHaveURL(/\/explore/);
  });

  test('non-admin goes to tenant explore page and sees mentor cards', async ({
    nonadminExplorePage,
  }) => {
    await expect(nonadminExplorePage.mentorCards.first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test('non-admin goes to tenant explore page and clicks Mentors to stay on explore', async ({
    nonadminPage,
    nonadminSidebarPage,
    nonadminExplorePage,
  }) => {
    await expect(nonadminSidebarPage.exploreLink).toBeVisible({
      timeout: 10_000,
    });
    await nonadminPage.waitForTimeout(5_000);
    await nonadminSidebarPage.exploreLink.click();
    await expect(nonadminPage).toHaveURL(/\/explore/, { timeout: 10_000 });
    // 2-min ceiling: explore page initial load can take ~30s when the
    // ?limit=8 mentors query gets aborted+retried during component mount.
    await expect(nonadminExplorePage.heading).toBeVisible({ timeout: 120_000 });
  });

  test('non-admin goes to tenant explore page and clicks a mentor card to navigate to that mentor', async ({
    nonadminPage,
    nonadminExplorePage,
    nonadminChatPage,
  }) => {
    await expect(nonadminExplorePage.mentorCards.first()).toBeVisible({
      timeout: 15_000,
    });
    await nonadminExplorePage.clickFirstMentorCard();
    await expect(nonadminPage).toHaveURL(/\/platform\/[^/]+\/[^/]+$/, {
      timeout: 20_000,
    });
    await expect(nonadminChatPage.chatInput).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Journey 35: Tenant Explore Page — Admin', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToTenantExplorePage(page);
  });

  test('admin goes to tenant explore page and clicks New Chat to see No Mentor Selected modal', async ({
    page,
    sidebarPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.fail(!isAdmin, 'New Chat modal test requires admin access');

    await expect(sidebarPage.newChatButton).toBeVisible({
      timeout: 10_000,
    });
    await sidebarPage.newChatButton.click();

    const modal = page.getByRole('alertdialog');
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('No Agent Selected')).toBeVisible();

    const cancelButton = modal.getByRole('button', { name: /cancel/i });
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();
    await expect(modal).not.toBeVisible({ timeout: 5_000 });
  });

  test('admin goes to tenant explore page and clicks Workflows to see No Mentor Selected modal', async ({
    page,
    sidebarPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.fail(!isAdmin, 'Workflows button requires admin access');

    await expect(sidebarPage.workflowsButton).toBeVisible({
      timeout: 10_000,
    });
    await sidebarPage.workflowsButton.click();

    const modal = page.getByRole('alertdialog');
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('No Agent Selected')).toBeVisible();

    const cancelButton = modal.getByRole('button', { name: /cancel/i });
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();
    await expect(modal).not.toBeVisible({ timeout: 5_000 });
  });

  test('admin goes to tenant explore page and clicks Explore Mentors in No Mentor Selected modal', async ({
    page,
    sidebarPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.fail(!isAdmin, 'Workflows button requires admin access');

    await sidebarPage.workflowsButton.click();

    const modal = page.getByRole('alertdialog');
    await expect(modal).toBeVisible({ timeout: 10_000 });

    const exploreMentorsButton = modal.getByRole('button', {
      name: /explore mentors/i,
    });
    await expect(exploreMentorsButton).toBeVisible();
    await exploreMentorsButton.click();

    await expect(modal).not.toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/explore/, { timeout: 10_000 });
  });

  test('admin goes to explore page and clicks Notifications to navigate with sidebar', async ({
    page,
    sidebarPage,
  }) => {
    await expect(sidebarPage.notificationsLink).toBeVisible({
      timeout: 10_000,
    });
    await sidebarPage.notificationsLink.click();

    await expect(page).toHaveURL(/\/notifications/, {
      timeout: 20_000,
    });
    await expect(sidebarPage.toggleButton).toBeVisible({ timeout: 10_000 });
  });

  test('admin goes to explore page and verifies no 404 API calls for undefined mentorId', async ({
    page,
  }) => {
    // Page is already on explore from beforeEach — check that no requests
    // were made with "undefined" as the mentor ID
    const undefinedMentorCalls: string[] = [];

    await page.route('**/mentors/undefined/**', (route) => {
      undefinedMentorCalls.push(route.request().url());
      return route.continue();
    });

    // Reload to capture requests with the route handler active
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5_000);

    expect(undefinedMentorCalls).toHaveLength(0);
  });
});
