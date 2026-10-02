import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';

test.use({ viewport: { width: 393, height: 851 } }); // Pixel 5

test.describe('Journey 31: Mobile View', () => {
  test.beforeEach(async ({ nonadminPage }) => {
    await navigateToMentorApp(nonadminPage);
  });

  // fixme: mobile sidebar/explore elements not visible — viewport or layout change
  test.fixme(
    'non-admin on mobile goes to sidebar and sees the correct menu items',
    async ({ nonadminPage, nonadminSidebarPage }) => {
      // Sidebar may be auto-collapsed on mobile — expand it
      const toggleBtn = nonadminSidebarPage.toggleButton;
      if (await toggleBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await toggleBtn.click();
        await nonadminPage.waitForTimeout(500);
      }
      await expect(nonadminSidebarPage.exploreLink).toBeVisible({
        timeout: 10_000,
      });
      await expect(nonadminSidebarPage.notificationsLink).toBeVisible({
        timeout: 10_000,
      });
    },
  );

  test('non-admin on mobile goes to navbar and the mentor dropdown works correctly', async ({
    nonadminNavbarPage,
  }) => {
    await nonadminNavbarPage.openMentorDropdown();
    const menu = nonadminNavbarPage.page.getByRole('menu');
    await expect(menu).toBeVisible({ timeout: 5_000 });
    await nonadminNavbarPage.page.keyboard.press('Escape');
  });

  // test('non-admin on mobile goes to navbar and the profile button works correctly', async ({
  //   nonadminNavbarPage,
  // }) => {
  //   await nonadminNavbarPage.openProfileDropdown();
  //   const menu = nonadminNavbarPage.page.getByRole('menu');
  //   await expect(menu).toBeVisible({ timeout: 5_000 });
  //   await nonadminNavbarPage.page.keyboard.press('Escape');
  // });

  // test('non-admin on mobile goes to platform and navbar components render correctly', async ({
  //   nonadminPage,
  //   nonadminNavbarPage,
  // }) => {
  //   await expect(nonadminNavbarPage.mentorDropdown).toBeVisible({
  //     timeout: 15_000,
  //   });
  //   await expect(nonadminNavbarPage.profileDropdown).toBeVisible({
  //     timeout: 10_000,
  //   });
  // });

  // fixme: mobile sidebar/explore elements not visible — viewport or layout change
  test.fixme(
    'non-admin on mobile goes to explore page and sees the title, description, and tabs',
    async ({ nonadminPage, nonadminSidebarPage, nonadminExplorePage }) => {
      await nonadminSidebarPage.navigateToExplore();
      await expect(nonadminExplorePage.heading).toBeVisible({
        timeout: 15_000,
      });
    },
  );

  // fixme: mobile sidebar/explore elements not visible — viewport or layout change
  test.fixme(
    'non-admin on mobile goes to explore page and searches for a mentor',
    async ({ nonadminPage, nonadminSidebarPage, nonadminExplorePage }) => {
      await nonadminSidebarPage.navigateToExplore();
      await expect(nonadminExplorePage.searchInput).toBeVisible({
        timeout: 10_000,
      });
      await nonadminExplorePage.search('test');
      await expect(nonadminExplorePage.searchInput).toHaveValue('test');
    },
  );

  // fixme: mobile sidebar/explore elements not visible — viewport or layout change
  test.fixme(
    'non-admin on mobile goes to datasets tab and performs upload and untrain/delete flow',
    async ({ nonadminPage, nonadminEditMentorPage }) => {
      const dropdown = nonadminPage.getByRole('button', {
        name: 'Selected agent dropdown button',
      });
      if (!(await dropdown.isVisible({ timeout: 10_000 }).catch(() => false)))
        return;
      await nonadminEditMentorPage.open('Datasets');
      await nonadminPage.waitForTimeout(1_000);
      await expect(
        nonadminEditMentorPage.datasets.addResourceButton,
      ).toBeVisible({ timeout: 10_000 });
      await nonadminEditMentorPage.close();
    },
  );
});

// ── Journey 31 (admin): Profile dropdown learner-mode label (issue #2592) ──
//
// Below the `xl` breakpoint, the profile dropdown grows a learner-mode row
// (label + switch) that is otherwise hidden — the equivalent desktop switch
// lives directly in the navbar instead. Issue #2592 relabels that row's text
// from "Instructor"/"Learner" to "Admin"/"User". Only an admin viewing a
// non-`main` tenant gets the row at all (`showLearnerModeSwitch` in
// `nav-bar/user-profile.tsx`), so this uses the admin `page` fixture, not
// `nonadminPage`.
test.describe('Journey 31: Profile Dropdown Learner Mode Label (mobile, admin)', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Requires admin access');
    }
  });

  // Snapshot check for whether the dropdown row is currently rendered —
  // used instead of `isVisible({timeout}).catch()` (that timeout is
  // misleading: isVisible() never waits for it). `waitFor` with a short
  // window gives the close animation a moment to settle before we decide.
  async function rowIsOpen(
    row: import('@playwright/test').Locator,
    timeout = 2_000,
  ): Promise<boolean> {
    try {
      await row.waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
  }

  // mob-08
  test('admin on mobile opens the profile dropdown and sees Admin/User learner-mode labels, not Instructor/Learner', async ({
    page,
    navbarPage,
  }) => {
    // Restore admin mode at the end regardless of pass/fail, so this test
    // never leaves the shared e2e account stuck in User mode.
    try {
      // ── 1. Default admin mode: the row reads "Admin" ────────────────────
      await navbarPage.openProfileDropdown();
      await expect(navbarPage.mobileLearnerModeRow).toBeVisible({
        timeout: 10_000,
      });
      expect(await navbarPage.getMobileLearnerModeLabel()).toBe('Admin');

      // ── 2. Flip the switch; the dropdown may close as a side effect ─────
      await navbarPage.toggleMobileLearnerMode();
      if (!(await rowIsOpen(navbarPage.mobileLearnerModeRow))) {
        await navbarPage.openProfileDropdown();
      }
      await expect(navbarPage.mobileLearnerModeRow).toBeVisible({
        timeout: 10_000,
      });
      expect(await navbarPage.getMobileLearnerModeLabel()).toBe('User');

      // ── 3. Flip back; confirm "Admin" again ─────────────────────────────
      await navbarPage.toggleMobileLearnerMode();
      if (!(await rowIsOpen(navbarPage.mobileLearnerModeRow))) {
        await navbarPage.openProfileDropdown();
      }
      await expect(navbarPage.mobileLearnerModeRow).toBeVisible({
        timeout: 10_000,
      });
      expect(await navbarPage.getMobileLearnerModeLabel()).toBe('Admin');

      // ── 4. The old wording must never appear in this row ────────────────
      const rowText = await navbarPage.mobileLearnerModeRow.textContent();
      expect(rowText).not.toMatch(/Instructor/);
      expect(rowText).not.toMatch(/Learner/);
    } finally {
      // Leave the account in Admin mode for subsequent tests/journeys.
      let isOpen = await rowIsOpen(navbarPage.mobileLearnerModeRow, 500);
      if (!isOpen) {
        await navbarPage.openProfileDropdown().catch(() => undefined);
        isOpen = await rowIsOpen(navbarPage.mobileLearnerModeRow, 2_000);
      }
      if (isOpen) {
        const label = await navbarPage
          .getMobileLearnerModeLabel()
          .catch(() => '');
        if (label !== 'Admin') {
          await navbarPage.toggleMobileLearnerMode().catch(() => undefined);
        }
      }
      await page.keyboard.press('Escape').catch(() => undefined);
    }
  });
});
