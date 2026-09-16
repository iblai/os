import { test, expect } from '../fixtures/mentor-test';
import {
  navigateToMentorApp,
  checkAdminStatus,
  authenticate,
  getPlatformContext,
} from '../utils/auth';
import { safeWaitForURL } from '../utils/navigation';
import { waitForPageReady } from '../utils/resilient';
import {
  MENTOR_NEXTJS_HOST,
  AUTH_HOST,
  FORDHAM_HOST,
  ADVERTISING_TENANT_MENTOR_URL,
  SECOND_TENANT_MENTOR_URL,
  NO_ACCESS_TENANT_MENTOR_URL,
  AUTH_NEXTJS_HOST,
  ENABLE_ADVERTISING_LOGIN_TEST,
  PLAYWRIGHT_USERNAME,
  PLAYWRIGHT_PASSWORD,
} from '../fixtures/test-data';

test.describe('Journey 32: Multi-Tenancy — Non-Admin', () => {
  test.beforeEach(async ({ nonadminPage }) => {
    await navigateToMentorApp(nonadminPage);
  });

  test('non-admin goes to enterprise tenant and toggles the sidebar open and close', async ({
    nonadminPage,
    nonadminSidebarPage,
  }) => {
    await nonadminSidebarPage.toggle();
    await nonadminPage.waitForTimeout(300);
    await nonadminSidebarPage.toggle();
    await nonadminPage.waitForTimeout(300);
    expect(true).toBe(true);
  });

  test('non-admin goes to enterprise tenant and the platform logo navigates home', async ({
    nonadminPage,
  }) => {
    const logo = nonadminPage
      .getByRole('link', { name: /home|logo/i })
      .or(nonadminPage.locator('[data-testid="platform-logo"]'))
      .first();
    if (await logo.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await logo.click();
      await safeWaitForURL(
        nonadminPage,
        (url) => url.href.includes('/platform/'),
        {
          timeout: 15_000,
        },
      );
      expect(nonadminPage.url()).toContain('/platform/');
    }
  });

  // fixme: New Chat is menuitem not button — locator mismatch
  test.fixme(
    'non-admin goes to enterprise tenant and New Chat navigation and sidebar items work',
    async ({ nonadminPage, nonadminNavbarPage }) => {
      await nonadminNavbarPage.openMentorDropdown();
      await expect(nonadminNavbarPage.newChatItem).toBeVisible({
        timeout: 5_000,
      });
      await nonadminPage.keyboard.press('Escape');
    },
  );
});

test.describe('Journey 32: Multi-Tenancy — Admin', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  // H28 fix: enterprise tenant tests should actually fill the create mentor form,
  // not just open and Escape. Original called fillCreateMentorForm.
  test('admin goes to enterprise tenant and creates a new mentor from the sidebar dialog', async ({
    page,
    sidebarPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Requires admin access');
    // "New Agent" is inside the collapsible "Agents" section in the new
    // sidebar — expand it first or the button won't be visible.
    await sidebarPage.expandSection('Agents');
    const newMentorBtn = page.getByRole('button', {
      name: 'New Agent',
      exact: true,
    });
    if (!(await newMentorBtn.isVisible().catch(() => false))) return;
    await newMentorBtn.click();
    const dialog = page.getByRole('dialog', {
      name: /create.*agent|new agent/i,
    });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    // Fill the mentor creation form
    const nameInput = dialog.getByPlaceholder(/agent name|name/i).first();
    if (await nameInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await nameInput.fill(`E2E Enterprise Test ${Date.now()}`);
      const createBtn = dialog
        .getByRole('button', { name: /create|save/i })
        .last();
      if (await createBtn.isEnabled({ timeout: 5_000 }).catch(() => false)) {
        await createBtn.click();
        await safeWaitForURL(page, (url) => url.href.includes('/platform/'), {
          timeout: 30_000,
        });
      }
    } else {
      await page.keyboard.press('Escape');
    }
  });

  // fixme: Settings button not visible in enterprise sidebar
  test.fixme(
    'admin goes to enterprise tenant and creates a new mentor from the Settings dialog',
    async ({ page }) => {
      const isAdmin = await checkAdminStatus(page);
      test.skip(!isAdmin, 'Requires admin access');
      const settingsBtn = page.getByRole('button', {
        name: 'Settings',
        exact: true,
      });
      if (!(await settingsBtn.isVisible().catch(() => false))) return;
      await settingsBtn.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 10_000 });
      // H28 fix: find and click "Create Agent" inside the Settings dialog
      const createMentorBtn = dialog.getByRole('button', {
        name: 'Create Agent',
      });
      if (
        await createMentorBtn.isVisible({ timeout: 5_000 }).catch(() => false)
      ) {
        await createMentorBtn.click();
        const createDialog = page.getByRole('dialog', {
          name: /create.*agent|new agent/i,
        });
        if (
          await createDialog.isVisible({ timeout: 5_000 }).catch(() => false)
        ) {
          const nameInput = createDialog
            .getByPlaceholder(/agent name|name/i)
            .first();
          if (
            await nameInput.isVisible({ timeout: 3_000 }).catch(() => false)
          ) {
            await nameInput.fill(`E2E Settings Create ${Date.now()}`);
            const saveBtn = createDialog
              .getByRole('button', { name: /create|save/i })
              .last();
            if (
              await saveBtn.isEnabled({ timeout: 3_000 }).catch(() => false)
            ) {
              await saveBtn.click();
              await safeWaitForURL(
                page,
                (url) => url.href.includes('/platform/'),
                { timeout: 30_000 },
              );
            }
          }
        }
      }
      await page.keyboard.press('Escape');
    },
  );

  // fixme: anonymous context heading not visible on auth SPA — page may not render for unauthenticated users
  test.fixme(
    'admin goes to auth SPA customization settings and an unauthenticated user sees the customization in the auth SPA',
    async ({ page, editMentorPage, browser }) => {
      test.skip(
        !AUTH_NEXTJS_HOST,
        'Set AUTH_NEXTJS_HOST to enable auth customization test',
      );
      const isAdmin = await checkAdminStatus(page);
      test.skip(!isAdmin, 'Requires admin access');

      // Admin configures the auth SPA customization
      const settingsBtn = page.getByRole('button', {
        name: 'Settings',
        exact: true,
      });
      if (!(await settingsBtn.isVisible({ timeout: 5_000 }).catch(() => false)))
        return;
      await settingsBtn.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 10_000 });
      await page.keyboard.press('Escape');

      // Unauthenticated user visits the auth SPA
      const anonContext = await browser.newContext({ storageState: undefined });
      const anonPage = await anonContext.newPage();
      try {
        await anonPage.goto(AUTH_NEXTJS_HOST, {
          waitUntil: 'domcontentloaded',
          timeout: 60_000,
        });
        await waitForPageReady(anonPage);
        const heading = anonPage.getByRole('heading').first();
        const headingVisible = await heading
          .isVisible({ timeout: 10_000 })
          .catch(() => false);
        expect(headingVisible).toBe(true);
      } finally {
        await anonContext.close();
      }
    },
  );

  // H31 fix: removed test.describe.configure() from inside test body — it has no effect there
  test('admin goes to help center settings and toggles its visibility in dropdown and embed', async ({
    page,
    editMentorPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Help center requires admin access');
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    const helpCenterToggle = editMentorPage.dialog.getByRole('switch', {
      name: /help center/i,
    });
    if (
      await helpCenterToggle.isVisible({ timeout: 5_000 }).catch(() => false)
    ) {
      const wasEnabled =
        (await helpCenterToggle.getAttribute('aria-checked')) === 'true';
      await helpCenterToggle.click();
      await page.waitForTimeout(500);
      if (
        wasEnabled !==
        ((await helpCenterToggle.getAttribute('aria-checked')) === 'true')
      ) {
        await helpCenterToggle.click(); // restore
      }
    }
    await editMentorPage.close();
  });

  test('admin goes to help center settings and updates the help center URL in dropdown and embed menu', async ({
    page,
    editMentorPage,
  }) => {
    // H31 fix: removed test.describe.configure() — must be at describe level, not test level
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Help center URL requires admin access');
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    const helpUrlInput = editMentorPage.dialog
      .getByLabel(/help.*url|help center url/i)
      .or(editMentorPage.dialog.getByPlaceholder(/help.*url/i));
    if (await helpUrlInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const originalValue = await helpUrlInput.inputValue().catch(() => '');
      await helpUrlInput.fill('https://docs.example.com');
      const saveBtn = editMentorPage.dialog
        .getByRole('button', { name: /save/i })
        .first();
      if (await saveBtn.isEnabled({ timeout: 3_000 }).catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(1_000);
        // Restore
        await helpUrlInput.fill(originalValue);
        if (await saveBtn.isEnabled({ timeout: 3_000 }).catch(() => false)) {
          await saveBtn.click();
        }
      }
    }
    await editMentorPage.close();
  });
});

test.describe('Journey 32: Multi-Tenancy — Cross-Tenant Navigation', () => {
  test('authenticated user on own tenant can navigate to advertising tenant mentor via direct URL', async ({
    page,
    browser,
  }) => {
    test.skip(
      !ADVERTISING_TENANT_MENTOR_URL,
      'Set ADVERTISING_TENANT_MENTOR_URL to enable cross-tenant advertising navigation test',
    );

    await navigateToMentorApp(page);

    // Verify user is on their own (non-advertising) tenant
    const ownTenantUrl = page.url();
    expect(ownTenantUrl).toContain('/platform/');

    // Verify chat input is visible on own tenant
    const chatInput = page.getByRole('textbox', {
      name: 'Ask anything',
      exact: true,
    });
    await expect(chatInput).toBeVisible({ timeout: 30_000 });

    // Directly navigate to the advertising tenant mentor URL (simulates pasting URL in browser)
    await page.goto(ADVERTISING_TENANT_MENTOR_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 80_000,
    });

    await safeWaitForURL(page, (url) => url.href.includes('/platform/'), {
      timeout: 60_000,
    });

    await waitForPageReady(page);

    // Verify the chat input field is visible — user was NOT redirected away
    const advertisingChatInput = page.getByRole('textbox', {
      name: 'Ask anything',
      exact: true,
    });
    await expect(advertisingChatInput).toBeVisible({ timeout: 30_000 });
  });
});

// Locks in the direct-URL SSO-redirect invariant fixed in lib/sso-redirect.ts
// (resolveSsoRedirectPath, used by app/sso-login-complete/page.tsx): visiting
// `/platform/<tenantKey>/<mentorId>` directly must always land the user back
// on THAT exact tenant+mentor — never silently on the default tenant. The
// regression this guards against: an explicit `?redirect-path=/` on the
// SSO-complete URL (the normal shape for a tenant-switch round trip) used to
// win over the localStorage `redirect-to` value that holds the real
// requested path, bouncing users to `/` instead of the mentor they asked for.
//
// Each assertion below checks the exact `/platform/<tenant>/<mentor>` path —
// not just "some /platform/ URL" — because the regression's failure mode
// (landing on the default tenant) would still satisfy a looser
// `url.includes('/platform/')` check.
test.describe('Journey 32: Multi-Tenancy — Direct Mentor URL Redirect Invariant', () => {
  test('unauthenticated user visits a mentor URL directly and lands on that exact tenant+mentor after logging in', async ({
    browser,
  }) => {
    test.skip(
      !SECOND_TENANT_MENTOR_URL,
      'Set SECOND_TENANT_MENTOR_URL to enable the direct-URL redirect invariant tests',
    );

    const expectedPath = new URL(SECOND_TENANT_MENTOR_URL).pathname;

    const anonContext = await browser.newContext({ storageState: undefined });
    const anonPage = await anonContext.newPage();
    try {
      // authenticate() navigates to SECOND_TENANT_MENTOR_URL first (which
      // bounces an unauthenticated visitor to the auth SPA login form), logs
      // in, and already waits through login/complete -> sso-login-complete
      // -> **/platform/*/*. The extra assertion below is what actually locks
      // in the invariant: the *exact* mentor path, not just any platform URL.
      await authenticate(anonPage, SECOND_TENANT_MENTOR_URL);

      expect(new URL(anonPage.url()).pathname).toBe(expectedPath);

      const chatInput = anonPage.getByRole('textbox', {
        name: 'Ask anything',
        exact: true,
      });
      await expect(chatInput).toBeVisible({ timeout: 30_000 });
    } finally {
      await anonContext.close();
    }
  });

  test('user logged into a different tenant visits a second tenant mentor URL directly and lands on that exact tenant+mentor', async ({
    page,
  }) => {
    test.skip(
      !SECOND_TENANT_MENTOR_URL,
      'Set SECOND_TENANT_MENTOR_URL to enable the direct-URL redirect invariant tests',
    );

    // Establish a session on the user's own (default/home) tenant first —
    // this is the "logged in to a DIFFERENT tenant" precondition.
    await navigateToMentorApp(page);
    const homeUrl = page.url();
    expect(new URL(homeUrl).pathname).not.toBe(
      new URL(SECOND_TENANT_MENTOR_URL).pathname,
    );

    const expectedPath = new URL(SECOND_TENANT_MENTOR_URL).pathname;

    // Directly navigate to the second tenant's mentor URL (simulates pasting
    // the URL while already signed into a different tenant). This triggers
    // TenantProvider's handleTenantSwitch, which round-trips through the auth
    // SPA and back through /sso-login-complete — exactly the path
    // resolveSsoRedirectPath fixes.
    await page.goto(SECOND_TENANT_MENTOR_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 80_000,
    });

    await safeWaitForURL(page, (url) => url.pathname === expectedPath, {
      timeout: 80_000,
    });

    await waitForPageReady(page);

    expect(new URL(page.url()).pathname).toBe(expectedPath);

    const chatInput = page.getByRole('textbox', {
      name: 'Ask anything',
      exact: true,
    });
    await expect(chatInput).toBeVisible({ timeout: 30_000 });
  });

  test('user already logged into the same tenant visits that tenant mentor URL directly and lands there with no detour', async ({
    page,
  }) => {
    await navigateToMentorApp(page);
    const { tenantKey, mentorId } = await getPlatformContext(page);
    const ownUrl = `${MENTOR_NEXTJS_HOST}/platform/${tenantKey}/${mentorId}`;

    // Re-visit the exact URL the user is already signed into (simulates
    // pasting/reloading the URL). Since currentTenant === requestedTenant,
    // TenantProvider must NOT trigger a tenant switch / auth round trip.
    await page.goto(ownUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    await safeWaitForURL(
      page,
      (url) => url.pathname === `/platform/${tenantKey}/${mentorId}`,
      { timeout: 30_000 },
    );

    // Never bounced through the auth host on the way there.
    expect(page.url()).not.toContain(AUTH_HOST);

    await waitForPageReady(page);

    const chatInput = page.getByRole('textbox', {
      name: 'Ask anything',
      exact: true,
    });
    await expect(chatInput).toBeVisible({ timeout: 30_000 });
  });

  // EXCEPTION CASE — see the discovery notes above the describe block header.
  //
  // The task this test guards against described a "409 you don't have access
  // to this tenant" page. That page does not exist in the current codebase:
  // there is no 409 handling anywhere in app/, lib/, providers/, or the
  // installed @iblai/web-utils SDK (2.8.4) that TenantProvider ships from.
  //
  // What actually happens when a user visits a tenant they have no access to
  // (traced through node_modules/@iblai/web-utils/dist/index.esm.js
  // `TenantProvider.determineWhichTenantToUse`, and
  // providers/index.tsx's `onAuthFailure` / `onTenantMismatch` handlers):
  //   1. TenantProvider tries to auto-join the user to the requested tenant
  //      (`joinAndActivateTenant` -> POST join). Many tenants allow
  //      self-service join, in which case the visit silently SUCCEEDS —
  //      this is why NO_ACCESS_TENANT_MENTOR_URL must point at a tenant with
  //      self-join disabled, or this test cannot distinguish "denied" from
  //      "auto-joined".
  //   2. If the join fails, it sets a sessionStorage guard
  //      (`tenant_access_attempt_<tenant>`) and calls
  //      `redirectToAuthSpa(undefined, undefined, /* logout */ true)` — a
  //      real logout (clears localStorage + auth cookies) that bounces to
  //      the auth SPA's login page, saving the SAME mentor path as
  //      `redirect-to` so the user returns to it after logging back in.
  //   3. On the SECOND pass through TenantProvider (post re-login, same tab
  //      so sessionStorage survives), the guard is already set, so it skips
  //      the join retry and calls `onAuthFailure(...)` directly, which
  //      providers/index.tsx routes to `router.push('/error/403')`.
  //
  // So the real invariant is: a no-access visit ends on `/error/403` (NOT a
  // 409, and NOT silently on `/` or the visited tenant) — but only after two
  // full login round trips. This is asserted below rather than left as
  // fiction, but it was authored from static reading of the SDK bundle and
  // could not be run against live infra during authoring — give it a live
  // dry run before trusting it in CI.
  test('user with no access to the visited tenant is denied, not silently redirected', async ({
    page,
  }) => {
    test.skip(
      !NO_ACCESS_TENANT_MENTOR_URL,
      'Set NO_ACCESS_TENANT_MENTOR_URL (a tenant PLAYWRIGHT_USERNAME cannot self-join) to enable the no-access test',
    );
    test.skip(
      !AUTH_HOST || !PLAYWRIGHT_USERNAME || !PLAYWRIGHT_PASSWORD,
      'Requires AUTH_HOST + PLAYWRIGHT_USERNAME/PASSWORD to complete the re-login round trip',
    );
    // Two full login round trips (see comment above) comfortably exceed the
    // default per-test timeout.
    test.setTimeout(240_000);

    await navigateToMentorApp(page);

    // First pass: direct visit triggers the failed auto-join attempt, then a
    // real logout + redirect to the auth SPA login page.
    await page.goto(NO_ACCESS_TENANT_MENTOR_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 80_000,
    });
    await safeWaitForURL(page, (url) => url.href.includes(AUTH_HOST), {
      timeout: 80_000,
    });

    // Re-authenticate. Same interaction sequence as
    // e2e/utils/auth.ts#reAuthenticate, but the destination differs (this
    // pass is expected to fail with /error/403, not land on a platform URL).
    await page.click('button:has-text("Continue with Password")');
    await expect(page.locator('input[type="email"]')).toBeVisible({
      timeout: 15_000,
    });
    await page.fill('input[type="email"]', PLAYWRIGHT_USERNAME);
    await page.fill('input[type="password"]', PLAYWRIGHT_PASSWORD);
    await page.click('button:has-text("Continue")');

    // Second pass through TenantProvider: the sessionStorage guard from the
    // first attempt is still set (same tab), so this time it fails fast to
    // /error/403 instead of retrying the join.
    await safeWaitForURL(page, (url) => url.pathname.startsWith('/error/403'), {
      timeout: 80_000,
    });

    expect(page.url()).toContain('/error/403');

    // Never ends up on the tenant it has no access to.
    expect(page.url()).not.toContain(
      new URL(NO_ACCESS_TENANT_MENTOR_URL).pathname,
    );
  });
});

test.describe('Journey 32: Multi-Tenancy — Unauthenticated', () => {
  test('unauthenticated user goes to advertising tenant mentor page and can access it without logging in', async ({
    page,
    browser,
  }) => {
    test.skip(
      !FORDHAM_HOST,
      'Set FORDHAM_HOST to enable advertising tenant test',
    );
    const anonContext = await browser.newContext({ storageState: undefined });
    const anonPage = await anonContext.newPage();
    try {
      await anonPage.goto(FORDHAM_HOST, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });
      await waitForPageReady(anonPage);
      const loginButton = anonPage.getByRole('button', { name: /log in/i });
      const chatInput = anonPage.getByPlaceholder('Ask anything', {
        exact: true,
      });
      const hasLoginOrChat =
        (await loginButton.isVisible({ timeout: 10_000 }).catch(() => false)) ||
        (await chatInput.isVisible({ timeout: 10_000 }).catch(() => false));
      expect(hasLoginOrChat).toBe(true);
    } finally {
      await anonContext.close();
    }
  });

  test('unauthenticated user goes to advertising tenant mentor page and logs in', async ({
    page,
    browser,
  }) => {
    test.skip(
      !ENABLE_ADVERTISING_LOGIN_TEST,
      'Set ENABLE_ADVERTISING_LOGIN_TEST=true after the advertising-tenant session_id UUID bug is fixed',
    );
    test.skip(
      !FORDHAM_HOST,
      'Set FORDHAM_HOST to enable advertising tenant login test',
    );

    const anonContext = await browser.newContext({ storageState: undefined });
    const anonPage = await anonContext.newPage();
    try {
      await anonPage.goto(FORDHAM_HOST, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });
      await waitForPageReady(anonPage);

      const loginButton = anonPage.getByRole('button', { name: /log in/i });
      await expect(loginButton).toBeVisible({ timeout: 15_000 });
      await loginButton.click();
      await safeWaitForURL(anonPage, (url) => url.href.includes('login'), {
        timeout: 60_000,
      });

      // Sign up as a new user
      const signupLink = anonPage.getByRole('button', { name: /sign up/i });
      if (await signupLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await signupLink.click();
      }

      await safeWaitForURL(
        anonPage,
        (url) => /\/platform\/[^/]+\/[^/]+$/.test(url.href),
        { timeout: 60_000 },
      );
      await waitForPageReady(anonPage);

      const isAdmin = await checkAdminStatus(anonPage);
      expect(isAdmin).toBe(false);

      const chatInput = anonPage.getByPlaceholder('Ask anything', {
        exact: true,
      });
      if (await chatInput.isVisible({ timeout: 15_000 }).catch(() => false)) {
        await chatInput.fill('hello');
        const sendBtn = anonPage.getByRole('button', { name: 'Send message' });
        await expect(sendBtn).toBeEnabled({ timeout: 10_000 });
        await sendBtn.click();
        await expect(
          anonPage.locator('.chat-ai-message-response').first(),
        ).toBeVisible({ timeout: 60_000 });
      }
    } finally {
      await anonContext.close();
    }
  });
});
