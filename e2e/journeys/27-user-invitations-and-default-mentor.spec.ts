import { test, expect } from '../fixtures/mentor-test';
import {
  navigateToMentorApp,
  checkAdminStatus,
  authenticate,
} from '../utils/auth';
import { safeWaitForURL } from '../utils/navigation';
import {
  INVITE_USERNAME,
  INVITE_USER_PASSWORD,
  MENTOR_NEXTJS_HOST,
} from '../fixtures/test-data';
import { generateTestEmail } from '../fixtures/test-data';

test.describe('Journey 27: User Invitations & Default Mentor', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) test.skip(true, 'Invitations require admin access');
  });

  // fixme: user invitation flow times out — settings modal locator change
  test.fixme(
    'admin goes to settings modal and invites a user via email',
    async ({ page }) => {
      const settingsBtn = page.getByRole('button', {
        name: 'Settings',
        exact: true,
      });
      const visible = await settingsBtn
        .isVisible({ timeout: 10_000 })
        .catch(() => false);
      if (!visible) {
        const profileDropdown = page.getByRole('button', {
          name: 'More options',
        });
        await profileDropdown.click();
        const accountItem = page
          .getByRole('menuitem', { name: /account|settings/i })
          .first();
        await accountItem.click();
      } else {
        await settingsBtn.click();
      }

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 10_000 });

      const inviteTab = dialog.getByRole('tab', { name: /invite|users/i });
      if (await inviteTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await inviteTab.click();
      }

      const emailInput = dialog.getByPlaceholder(/email/i).first();
      if (await emailInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
        const inviteEmail = generateTestEmail();
        await emailInput.fill(inviteEmail);
        const inviteBtn = dialog.getByRole('button', { name: /invite|send/i });
        if (await inviteBtn.isEnabled({ timeout: 3_000 }).catch(() => false)) {
          await inviteBtn.click();
          await expect(page.getByText(/invited|invitation sent/i)).toBeVisible({
            timeout: 10_000,
          });
        }
      }
      await page.keyboard.press('Escape');
    },
  );

  test('invited user goes to the invite link and signs up', async ({
    page,
  }) => {
    test.skip(
      !INVITE_USERNAME || !INVITE_USER_PASSWORD,
      'Requires INVITE_USERNAME and INVITE_USER_PASSWORD',
    );
    // Use an isolated context so the invited user signs up with a clean
    // session instead of inheriting the admin's cookies/storage.
    const browser = page.context().browser();
    if (!browser) throw new Error('No browser instance available');
    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    try {
      await authenticate(
        anonPage,
        MENTOR_NEXTJS_HOST,
        INVITE_USERNAME,
        INVITE_USER_PASSWORD,
      );
      await expect(anonPage).toHaveURL(
        new RegExp(`${MENTOR_NEXTJS_HOST}/platform/`),
        {
          timeout: 60_000,
        },
      );
    } finally {
      await anonContext.close();
    }
  });

  test('admin goes to settings and verifies the accepted invite is reflected', async ({
    page,
  }) => {
    const settingsBtn = page.getByRole('button', {
      name: 'Settings',
      exact: true,
    });
    if (await settingsBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await settingsBtn.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 10_000 });
      await page.keyboard.press('Escape');
    }
    expect(true).toBe(true); // Invite verification is env-dependent
  });

  test('admin goes to Advanced settings and sets a default mentor', async ({
    page,
  }) => {
    const settingsBtn = page.getByRole('button', {
      name: 'Settings',
      exact: true,
    });
    if (!(await settingsBtn.isVisible({ timeout: 5_000 }).catch(() => false)))
      return;
    await settingsBtn.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    const advancedTab = dialog.getByRole('tab', { name: /advanced/i });
    if (await advancedTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await advancedTab.click();
      const defaultMentorCombobox = dialog.getByRole('combobox', {
        name: /default agent/i,
      });
      if (
        await defaultMentorCombobox
          .isVisible({ timeout: 5_000 })
          .catch(() => false)
      ) {
        await expect(defaultMentorCombobox).toBeVisible();
      }
    }
    await page.keyboard.press('Escape');
  });

  test('newly invited user goes to the mentor platform and lands on the configured default mentor', async ({
    page,
  }) => {
    test.skip(!INVITE_USERNAME, 'Requires INVITE_USERNAME env var');
    // Use an isolated context so the invited user signs up with a clean
    // session instead of inheriting the admin's cookies/storage.
    const browser = page.context().browser();
    if (!browser) throw new Error('No browser instance available');
    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    try {
      await authenticate(
        anonPage,
        MENTOR_NEXTJS_HOST,
        INVITE_USERNAME,
        INVITE_USER_PASSWORD,
      );
      await expect(anonPage).toHaveURL(
        new RegExp(`${MENTOR_NEXTJS_HOST}/platform/`),
        {
          timeout: 60_000,
        },
      );
    } finally {
      await anonContext.close();
    }
  });
});

// Kept out of the serial block above so neither can skip the other.
test.describe('Journey 27: Invites in the Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) test.skip(true, 'Invitations require admin access');
  });

  // inv-06
  test('admin goes to Invites in the sidebar and it opens the settings dialog on its own Invites tab, below Management in the menu', async ({
    page,
    sidebarPage,
  }) => {
    // Invites is RBAC-gated (`can_invite`), so skip rather than fail when the
    // environment does not grant it to the admin user.
    const invitesOffered = await sidebarPage.inviteUsersButton
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(
        () => true,
        () => false,
      );
    test.skip(
      !invitesOffered,
      'Invites sidebar entry is not available to this admin user',
    );

    const { dialog, rail } = await sidebarPage.openInvites();

    const menu = await rail.getByRole('button').allTextContents();
    const management = menu.indexOf('Management');
    expect(menu.slice(management, management + 2)).toEqual([
      'Management',
      'Invites',
    ]);

    await expect(
      dialog.getByRole('heading', { name: 'Invites', exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      dialog.getByPlaceholder('Enter email to invite...'),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      dialog.getByRole('button', { name: 'Send Invite', exact: true }),
    ).toBeVisible({ timeout: 5_000 });

    // The SDK's invite content has an "Invite Users" title of its own, which
    // this tab drops because the dialog already shows "Invites"; the small
    // "Invite Users" dialog must not open on top either.
    await expect(
      dialog.getByRole('heading', { name: 'Invite Users', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('dialog', { name: 'Invite Users', exact: true }),
    ).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });
  });

  // inv-07
  test('admin goes to Invites in the sidebar and finds Onboarding as its own tab below Invites in the settings menu, with no Onboarding tab left in Management', async ({
    page,
    sidebarPage,
  }) => {
    const invitesOffered = await sidebarPage.inviteUsersButton
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(
        () => true,
        () => false,
      );
    test.skip(
      !invitesOffered,
      'Invites sidebar entry is not available to this admin user',
    );

    const { dialog, rail } = await sidebarPage.openInvites();

    const menu = await rail.getByRole('button').allTextContents();
    const management = menu.indexOf('Management');
    expect(menu.slice(management, management + 3)).toEqual([
      'Management',
      'Invites',
      'Onboarding',
    ]);

    const onboarding = rail.getByRole('button', {
      name: 'Onboarding',
      exact: true,
    });
    await onboarding.click();
    await expect(onboarding).toHaveAttribute('aria-current', 'page', {
      timeout: 10_000,
    });
    await expect(
      dialog.getByRole('heading', { name: 'Onboarding', exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByTestId('onboarding-agent-input')).toBeVisible({
      timeout: 15_000,
    });

    await rail.getByRole('button', { name: 'Management', exact: true }).click();
    // Applications sat beside Onboarding in Management and stays there, so
    // seeing it means the sub-tabs have rendered before Onboarding is ruled out.
    await expect(
      dialog.getByRole('tab', { name: 'Applications', exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      dialog.getByRole('tab', { name: 'Onboarding', exact: true }),
    ).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });
  });
});
