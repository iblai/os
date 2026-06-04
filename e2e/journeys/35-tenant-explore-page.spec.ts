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
    // h2 hidden when DefaultMentorsSection short-circuits to EmptyState; main landmark is the correct page-chrome signal.
    await expect(nonadminExplorePage.main).toBeVisible({ timeout: 20_000 });
    await expect(nonadminPage).toHaveURL(/\/explore/);
  });

  test('non-admin goes to tenant explore page and sees mentor cards', async ({
    nonadminExplorePage,
  }) => {
    await expect(nonadminExplorePage.main).toBeVisible({ timeout: 30_000 });
    const cards = nonadminExplorePage.mentorCards.first();
    const outcome = await Promise.race([
      cards
        .waitFor({ state: 'visible', timeout: 60_000 })
        .then(() => 'cards' as const),
      nonadminExplorePage.emptyState
        .waitFor({ state: 'visible', timeout: 60_000 })
        .then(() => 'empty' as const),
    ]).catch(() => 'timeout' as const);
    test.skip(
      outcome === 'empty',
      'Test tenant has no agents — cannot assert cards.',
    );
    expect(outcome).toBe('cards');
    await expect(cards).toBeVisible({ timeout: 5_000 });
  });

  test('non-admin goes to tenant explore page and clicks Mentors to stay on explore', async ({
    nonadminPage,
    nonadminSidebarPage,
    nonadminExplorePage,
  }) => {
    // "Explore" lives inside the collapsible "Agents" section in the new
    // sidebar; Radix unmounts collapsed content, so the link isn't in the
    // DOM until the section is expanded. Expand the sidebar itself first
    // (rail mode renders icon-only flyouts, no text section triggers), then
    // expand the Agents section before asserting on the link.
    await nonadminSidebarPage.ensureExpanded();
    await nonadminSidebarPage.expandSection('Agents');
    await expect(nonadminSidebarPage.exploreLink).toBeVisible({
      timeout: 10_000,
    });
    // Gate the click on the explore page chrome being ready — heading is
    // data-conditional (hidden when DefaultMentorsSection renders EmptyState),
    // but the <main> landmark is always rendered.
    await expect(nonadminExplorePage.main).toBeVisible({ timeout: 30_000 });
    await nonadminSidebarPage.exploreLink.click();
    await expect(nonadminPage).toHaveURL(/\/explore/, { timeout: 10_000 });
    // 2-min ceiling: explore page initial load can take ~30s when the
    // ?limit=8 mentors query gets aborted+retried during component mount.
    await expect(nonadminExplorePage.main).toBeVisible({ timeout: 120_000 });
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
    explorePage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.fail(!isAdmin, 'New Chat modal test requires admin access');

    await expect(explorePage.main).toBeVisible({ timeout: 30_000 });
    // Expand the sidebar first: in rail (collapsed) mode New Chat is an
    // icon button with aria-label "New chat", which the text-based
    // `newChatButton` locator ("New Chat", exact) doesn't match.
    await sidebarPage.ensureExpanded();
    await expect(sidebarPage.newChatButton).toBeVisible({
      timeout: 30_000,
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
    explorePage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.fail(!isAdmin, 'Workflows button requires admin access');

    await expect(explorePage.main).toBeVisible({ timeout: 30_000 });
    // "Workflows" is a collapsible section in the new sidebar — its trigger
    // only toggles open/close. The No-Agent-Selected modal fires from its
    // inner items (New/My Workflows → handleWorkflowMenuSelect when there's
    // no mentorId), so expand the sidebar + the section, then click an item.
    await sidebarPage.ensureExpanded();
    await sidebarPage.expandSection('Workflows');
    const newWorkflowItem = sidebarPage.sidebar.getByRole('button', {
      name: 'New Workflow',
      exact: true,
    });
    await expect(newWorkflowItem).toBeVisible({ timeout: 10_000 });
    await newWorkflowItem.click();

    const modal = page.getByRole('alertdialog');
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('No Agent Selected')).toBeVisible();

    const cancelButton = modal.getByRole('button', { name: /cancel/i });
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();
    await expect(modal).not.toBeVisible({ timeout: 5_000 });
  });

  test('admin goes to tenant explore page and clicks Explore Agents in No Agent Selected modal', async ({
    page,
    sidebarPage,
    explorePage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.fail(!isAdmin, 'Workflows button requires admin access');

    await expect(explorePage.main).toBeVisible({ timeout: 30_000 });
    // Same as above: open the modal via a Workflows inner item, not the
    // collapsible section trigger.
    await sidebarPage.ensureExpanded();
    await sidebarPage.expandSection('Workflows');
    const newWorkflowItem = sidebarPage.sidebar.getByRole('button', {
      name: 'New Workflow',
      exact: true,
    });
    await expect(newWorkflowItem).toBeVisible({ timeout: 10_000 });
    await newWorkflowItem.click();

    const modal = page.getByRole('alertdialog');
    await expect(modal).toBeVisible({ timeout: 10_000 });

    // Modal action button was renamed Mentor → Agent in main.
    const exploreAgentsButton = modal.getByRole('button', {
      name: /explore agents/i,
    });
    await expect(exploreAgentsButton).toBeVisible();
    await exploreAgentsButton.click();

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
