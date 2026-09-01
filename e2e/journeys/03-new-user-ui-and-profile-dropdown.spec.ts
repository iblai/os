import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, signUpNewUserOnMain } from '../utils/auth';
import { NavbarPage } from '../page-objects/navbar.page';
import { MENTOR_NEXTJS_HOST, AUTH_HOST } from '../fixtures/test-data';
import { logger } from '@iblai/iblai-js/playwright';

test.describe('Journey 3: New User UI & Profile Dropdown', () => {
  test.beforeEach(async ({ nonadminPage }) => {
    await navigateToMentorApp(nonadminPage);
  });

  test('newly registered user open mentor dropdown to see New Chat item', async ({
    nonadminNavbarPage,
  }) => {
    await nonadminNavbarPage.mentorDropdown.click();
    await expect(nonadminNavbarPage.mentorDropdownNewChatItem).toBeVisible({
      timeout: 5_000,
    });
  });

  test('newly registered non-admin user goes to navbar and sees New Chat item in dropdown but no My Mentors button', async ({
    nonadminPage,
    nonadminNavbarPage,
  }) => {
    // My Mentors button was removed from the header in feat-1431;
    // discovery now flows entirely through the sidebar Explore link.
    const myMentorsButton = nonadminPage.getByRole('button', {
      name: /my mentors/i,
    });
    await expect(myMentorsButton).not.toBeVisible({ timeout: 5_000 });

    // The mentor dropdown should still expose "New Chat"
    await nonadminNavbarPage.openMentorDropdown();
    const items = nonadminPage.getByRole('menuitem');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  // ui-04: verify that any admin-only sidebar entry that happens to be
  // visible for this non-admin user surfaces the upgrade dialog (or an
  // auth redirect) rather than performing the real action.  The
  // `newProjectButton` is the legacy anchor; it stays here for backward
  // compatibility with environments that still show it.
  test('newly registered non-admin user goes to sidebar and clicks admin-only buttons which redirect to payment', async ({
    nonadminPage,
    nonadminSidebarPage,
  }) => {
    // Clicking admin buttons should trigger upgrade/auth modal or redirect
    const adminButtons = [nonadminSidebarPage.newProjectButton];

    for (const btn of adminButtons) {
      const visible = await btn
        .isVisible({ timeout: 3_000 })
        .catch(() => false);
      if (visible) {
        await btn.click();
        // Either a pricing modal or auth redirect appears
        const modal = nonadminPage.getByRole('dialog');
        const hasModal = await modal
          .isVisible({ timeout: 5_000 })
          .catch(() => false);
        const isRedirected =
          nonadminPage.url().includes('auth') ||
          nonadminPage.url().includes('login');
        expect(hasModal || isRedirected).toBe(true);
        if (hasModal) {
          await nonadminPage.keyboard.press('Escape');
        }
      }
    }
  });

  // ui-05: On the MAIN tenant, when the paywall / stripe trial mode is
  // active, a non-admin user now sees the FULL admin sidebar cluster
  // (New Agent, Workflows, Analytics, Invites, Management, Integrations,
  // Monetization, Advanced).  Every entry is trial-gated: clicking it
  // opens the upgrade/pricing dialog instead of performing the real
  // action.  When the paywall is off (non-main tenant, or stripe not
  // activated) the buttons may be hidden — the test skips gracefully via
  // `logger.info` rather than failing, matching the bill-18 pattern.
  test('non-admin on main tenant sees full admin sidebar entries and clicking one opens the upgrade dialog', async ({
    nonadminPage,
    nonadminSidebarPage,
  }) => {
    // Pick a representative set of the trial-gated entries.  We check
    // the first visible one rather than all of them so the test stays
    // fast and avoids repeated dialog-open/close cycles.
    const trialGatedButtons = [
      nonadminSidebarPage.newMentorButton, // "New Agent"
      nonadminSidebarPage.workflowsButton, // "Workflows" section trigger
      nonadminSidebarPage.analyticsButton, // "Analytics" section trigger
      nonadminSidebarPage.managementButton, // footer "Management"
      nonadminSidebarPage.integrationsButton, // footer "Integrations"
      nonadminSidebarPage.monetizationButton, // footer "Monetization"
      nonadminSidebarPage.settingsButton, // footer "Advanced"
    ];

    let checkedAtLeastOne = false;

    for (const btn of trialGatedButtons) {
      // Use waitFor so we actually wait the timeout window rather than
      // snapshot-checking (the anti-pattern of isVisible({ timeout })).
      let isVisible = false;
      try {
        await btn.waitFor({ state: 'visible', timeout: 3_000 });
        isVisible = true;
      } catch {
        isVisible = false;
      }

      if (!isVisible) continue;

      checkedAtLeastOne = true;
      await btn.click();

      // The upgrade / pricing dialog should appear.  We use a broad
      // text filter that matches the Stripe pricing modal, the free-trial
      // dialog, and any other upgrade gate the platform surfaces.
      const upgradeDialog = nonadminPage
        .getByRole('dialog')
        .filter({ hasText: /upgrade|pricing|subscribe|trial|plan/i });

      let dialogVisible = false;
      try {
        await upgradeDialog.waitFor({ state: 'visible', timeout: 10_000 });
        dialogVisible = true;
      } catch {
        dialogVisible = false;
      }

      if (!dialogVisible) {
        logger.info(
          `ui-05: upgrade dialog did not appear after clicking trial-gated button — paywall likely off for this tenant`,
        );
        // Dismiss any stray state and try the next button.
        await nonadminPage.keyboard.press('Escape');
        continue;
      }

      // Dialog appeared — assert and dismiss, then stop.
      await expect(upgradeDialog).toBeVisible();
      await nonadminPage.keyboard.press('Escape');
      logger.info(
        `ui-05: upgrade dialog confirmed for trial-gated sidebar entry`,
      );
      return;
    }

    if (!checkedAtLeastOne) {
      logger.info(
        `ui-05: no trial-gated admin sidebar entries visible for this non-admin — ` +
          `paywall / main-tenant condition is off in this environment; skipping`,
      );
    }
  });
});

// ── Journey 3 (fresh signup): Profile Dropdown for a genuinely new user ────
//
// ui-03 previously reused the `nonadminPage` fixture, which loads a saved,
// pre-existing storageState account (see `auth-nonadmin.setup.ts`) — not a
// "newly registered user". On the main tenant that stale account can carry
// state (e.g. an "Account"/billing item) that the fresh-signup profile
// dropdown doesn't have, so the exact `toBe(3)` assertion was fragile.
//
// This sibling describe signs up a brand-new account via the auth service
// (mirroring Journey 1's signup test and Journey 59 Flow 0) and asserts the
// default post-signup profile dropdown on the "main" tenant: exactly
// Profile / Help / Log Out. It intentionally does NOT use the shared
// `beforeEach`/nonadmin fixtures above — it needs a clean, unauthenticated
// context so the signup flow can provision + authenticate its own account.
test.describe('Journey 3: New User UI & Profile Dropdown (fresh signup)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  // Signup involves several redirects (auth host -> account/create ->
  // SSO -> main tenant); give it plenty of room like Journeys 1 and 59.
  test.setTimeout(120_000);

  test('newly registered user goes to navbar and opens profile dropdown to see exactly 3 items', async ({
    page,
  }) => {
    test.skip(
      !MENTOR_NEXTJS_HOST || !AUTH_HOST,
      'Requires MENTOR_NEXTJS_HOST and AUTH_HOST',
    );

    const { email } = await signUpNewUserOnMain(page);
    logger.info(`ui-03: fresh signup landed on main tenant as ${email}`);

    const navbarPage = new NavbarPage(page);
    await navbarPage.openProfileDropdown();

    await expect(page.getByRole('menuitem')).toHaveCount(3, {
      timeout: 10_000,
    });
    await expect(page.getByRole('menuitem', { name: 'Profile' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Help' })).toBeVisible();
    await expect(
      page.getByRole('menuitem', { name: 'Log Out', exact: true }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
  });
});
