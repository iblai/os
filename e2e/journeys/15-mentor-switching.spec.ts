import { test, expect } from '../fixtures/mentor-test';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';
import { safeWaitForURL } from '../utils/navigation';
import { waitForPageReady } from '../utils/resilient';
import { MENTOR_NEXTJS_HOST, generateMentorName } from '../fixtures/test-data';

test.describe('Journey 15: Mentor Switching', () => {
  test.beforeEach(async ({ nonadminPage }) => {
    await navigateToMentorApp(nonadminPage);
  });

  test('non-admin goes to explore page and switches to a different mentor by clicking a card', async ({
    nonadminPage,
    nonadminSidebarPage,
    nonadminExplorePage,
  }) => {
    await nonadminSidebarPage.navigateToExplore();
    // 2-min ceiling: explore page initial load can take ~30s when the
    // ?limit=8 mentors query gets aborted+retried during component mount.
    await expect(nonadminExplorePage.mentorCards.first()).toBeVisible({
      timeout: 120_000,
    });
    await nonadminExplorePage.clickFirstMentorCard();
    await safeWaitForURL(
      nonadminPage,
      (url) => !url.href.includes('explore') && url.href.includes('/platform/'),
      { timeout: 15_000 },
    );
  });

  test('non-admin goes to explore page using the dedicated switch spec and selects a mentor', async ({
    nonadminPage,
    nonadminSidebarPage,
    nonadminExplorePage,
  }) => {
    await nonadminSidebarPage.navigateToExplore();
    await expect(nonadminExplorePage.mentorCards.first()).toBeVisible({
      timeout: 120_000,
    });
    await nonadminExplorePage.clickFirstMentorCard();
    await safeWaitForURL(
      nonadminPage,
      (url) => url.href.includes('/platform/'),
      { timeout: 15_000 },
    );
    expect(nonadminPage.url()).toContain('/platform/');
  });

  // sw-06: the home page's "Explore Agents" section (issue #2544) only
  // renders when the current mentor's `show_explore_mentors` setting is ON —
  // it used to be unconditional, so this test could get away with an
  // early-return "not in explore-mentors state" no-op whenever the shared
  // default mentor happened to have it off. Now that the setting is
  // per-mentor and OFF by default in some environments, this test seeds its
  // OWN throw-away mentor (visibility "Anyone" so the non-admin session can
  // view it, toggle explicitly ON) instead of depending on ambient state, so
  // the checkpoint is deterministic instead of silently skippable.
  test('non-admin goes to explore section on home page and switches mentor', async ({
    page,
    editMentorPage,
    createMentorPage,
    nonadminPage,
  }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(
        true,
        'Requires admin access to seed the Explore Agents toggle',
      );
      return;
    }

    await createMentorPage.openAndCreate(generateMentorName());
    await waitForPageReady(page);
    const { tenantKey, mentorId } = await getPlatformContext(page);
    const mentorUrl = `${MENTOR_NEXTJS_HOST}/platform/${tenantKey}/${mentorId}`;

    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await editMentorPage.settings.setVisibilityAnyone();
    await editMentorPage.settings.setChatAccessAnyone();
    // Saves the whole form (visibility + chat access + the toggle below).
    await editMentorPage.settings.setShowExploreMentors(true);
    await editMentorPage.close();

    await navigateToMentorApp(nonadminPage, mentorUrl);
    await waitForPageReady(nonadminPage);

    const exploreMentorsHeading = nonadminPage.getByRole('heading', {
      name: /explore agents/i,
    });
    await expect(exploreMentorsHeading).toBeVisible({ timeout: 30_000 });

    // Explore Agents cards (welcome-chat/explore-mentors.tsx) are
    // role="button" elements whose accessible name is built from the
    // `exploreAgentAriaLabel` translation ("Explore agent: {name}. ...").
    const mentorCard = nonadminPage
      .getByRole('button', { name: /^Explore agent:/i })
      .first();
    await expect(mentorCard).toBeVisible({ timeout: 10_000 });
    await mentorCard.click();
    await safeWaitForURL(
      nonadminPage,
      (url) => url.href.includes('/platform/'),
      { timeout: 15_000 },
    );
    expect(nonadminPage.url()).toContain('/platform/');
  });
});
