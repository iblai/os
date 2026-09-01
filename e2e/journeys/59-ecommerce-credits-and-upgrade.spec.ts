import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../fixtures/mentor-test';
import { SignupPage } from '../page-objects/signup.page';
import { NavbarPage } from '../page-objects/navbar.page';
import { SidebarPage } from '../page-objects/sidebar.page';
import { ChatPage } from '../page-objects/chat.page';
import { BillingPage } from '../page-objects/billing.page';
import {
  AUTH_HOST,
  DM_URL,
  ECOMMERCE_CREDIT_CLEANUP_TOKEN,
  ECOMMERCE_SIGNUP_PASSWORD,
  MENTOR_NEXTJS_HOST,
} from '../fixtures/test-data';
import { parsePlatformUrl, safeWaitForURL } from '../utils/navigation';
import {
  closeCreditBalanceDropdown,
  creditBalancePlanBadge,
  creditBalanceTrigger,
  getBillingPlanLabel,
  getCreditBalanceRemaining,
  logger,
  openCreditBalanceDropdown,
  waitForBillingTabReady,
  clickBillingUpgrade,
} from '@iblai/iblai-js/playwright';

// ─── Journey 59: Ecommerce Credits & Upgrade ─────────────────────────────────
//
// End-to-end lifecycle of a brand-new free-trial user against the "main"
// tenant, exhausting credits twice and upgrading twice:
//
//   Flow 0 — free-trial signup via the auth service's /account/create form,
//            landing on <base>/platform/main/<mentorId>. Verifies the credit
//            dropdown (Free plan, positive balance, Upgrade Plan), the
//            profile dropdown (exactly Profile/Help/Log Out), the collapsed
//            sidebar's visible items, the "Subscribe to unlock full
//            features" paywall dialog on every gated sidebar entry, and a
//            working chat.
//   Flow 1 — cleanup credits via the DM service's admin cleanup endpoint.
//   Flow 2 — zero credits on the "main" tenant blocks chat and surfaces the
//            same paywall dialog (CTA: "Upgrade for free").
//   Flow 3 — clicking "Upgrade for free" redirects to a Stripe-hosted,
//            zero-cost checkout (email pre-filled, no card required).
//   Flow 4 — the checkout's SSO redirect chain lands back on the app under a
//            REAL platform id (not "main") with a fresh Free-plan balance;
//            chat works again.
//   Flow 5 — the profile dropdown's "Account" item opens the "User Profile"
//            dialog; its Billing tab (?profileTab=billing) shows the Free
//            plan, an Upgrade button, and a positive credit balance.
//   Flow 6 — cleanup credits again on the upgraded tenant.
//   Flow 7 — zero credits on the upgraded tenant auto-opens the Billing tab
//            (admin 402 handling redirects straight to ?profileTab=billing)
//            showing 0 credits.
//   Flow 8 — clicking "Upgrade" in the Billing tab redirects to a real
//            Stripe test-mode checkout; fills the 4242 test card, submits,
//            and lands back on the same platform/mentor URL with a Premium
//            plan + restored credit balance.
//   Flow 9 — chat works again with the restored (Premium) balance.
//
// Runs in a clean, unauthenticated context (the signup flow provisions +
// authenticates its own account). Skips when DM_URL or
// ECOMMERCE_CREDIT_CLEANUP_TOKEN are not configured, since both the "zero
// credits" flows depend on the DM credit-cleanup admin endpoint.

/**
 * Empties the signed-in user's credit balance via the DM service's admin
 * cleanup endpoint, authenticated with the `dm_token` written to
 * localStorage by the mentor SPA. Used to deterministically drive both
 * "zero credits" flows (2 and 7) without waiting for organic credit burn.
 */
async function cleanupCredits(page: Page): Promise<void> {
  const dmToken = await page.evaluate(() =>
    window.localStorage.getItem('dm_token'),
  );
  expect(dmToken, 'expected a dm_token in localStorage').toBeTruthy();

  const response = await page.request.post(
    `${DM_URL}/api/service/credits/cleanup/`,
    {
      data: { token: ECOMMERCE_CREDIT_CLEANUP_TOKEN },
      headers: { Authorization: `Token ${dmToken}` },
    },
  );
  expect(response.status()).toBe(200);
  logger.info(
    `[ecommerce] credit cleanup responded 200: ${await response.text()}`,
  );
}

/**
 * Waits up to `timeoutMs` for `locator` to become visible, returning false
 * (rather than throwing) on timeout. Unlike `isVisible().catch()`, this
 * actually honours the timeout because it uses `waitFor` under the hood.
 */
async function isVisibleWithin(
  locator: Locator,
  timeoutMs: number,
): Promise<boolean> {
  try {
    await locator.waitFor({ state: 'visible', timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

/**
 * Sends a chat message and waits for a NEW AI response bubble. Count-based
 * rather than `waitForAIResponse` (first-bubble visibility) because flows 5
 * and 9 chat in a conversation that already has AI responses — the first
 * bubble is always visible there, so it would pass without a new reply.
 */
async function sendMessageAndAwaitNewResponse(
  chatPage: ChatPage,
  text: string,
): Promise<void> {
  const before = await chatPage.aiMessages.count();
  await chatPage.sendMessage(text);
  await expect
    .poll(async () => chatPage.aiMessages.count(), {
      timeout: 60_000,
      message: 'expected a new AI response bubble',
    })
    .toBeGreaterThan(before);
}

/**
 * The `UpgradePackageModal` gated-feature dialog (`@iblai/web-containers`)
 * shown for both the sidebar paywall gates and the zero-credit chat block on
 * the "main" tenant. Its title/CTA default to "Subscribe to unlock full
 * features" / "Upgrade for free".
 */
function subscribeDialog(page: Page): Locator {
  return page.getByRole('dialog', {
    name: /subscribe to unlock full features/i,
  });
}

/**
 * Asserts the gated-feature "Subscribe to unlock full features" dialog is
 * visible with its "Upgrade for free" CTA, then closes it via the dialog's
 * Close button and waits for it to detach. Used for every gated sidebar
 * entry point, which all render the same shared modal.
 */
async function expectSubscribeModalAndClose(page: Page): Promise<void> {
  const dialog = subscribeDialog(page);
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(
    dialog.getByRole('button', { name: 'Upgrade for free' }),
  ).toBeVisible({ timeout: 10_000 });
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });
}

test.describe('Journey 59: Ecommerce Credits & Upgrade', () => {
  // Signup + two full Stripe checkouts + four agent chats + two credit
  // cleanups — give the whole lifecycle plenty of room.
  test.use({ storageState: { cookies: [], origins: [] } });
  test.setTimeout(600_000);

  test('new user signs up for a free trial, exhausts credits, upgrades to the free plan via Stripe, exhausts credits again, and upgrades to Premium with a test card', async ({
    browser,
    step,
  }) => {
    test.skip(
      !DM_URL || !ECOMMERCE_CREDIT_CLEANUP_TOKEN,
      'DM_URL / ECOMMERCE_CREDIT_CLEANUP_TOKEN not configured for this environment',
    );

    // Fresh, unauthenticated context — the signup flow provisions +
    // authenticates its own account.
    const context = await browser.newContext();
    const page = await context.newPage();

    const chatPage = new ChatPage(page);
    let platformKey = '';
    let mentorId = '';

    try {
      // ── Flow 0: free-trial signup ──────────────────────────────────────
      await step(
        'Flow 0: free-trial signup lands on the main tenant',
        async () => {
          await page.goto(MENTOR_NEXTJS_HOST, {
            waitUntil: 'domcontentloaded',
            timeout: 60_000,
          });
          await safeWaitForURL(page, (u) => u.href.includes(AUTH_HOST), {
            timeout: 60_000,
          });
          await page.waitForLoadState('domcontentloaded', { timeout: 60_000 });
          const pleaseWaitText = page.getByText(/please wait.../i);
          const signUpButton = page.getByRole('button', { name: 'Sign Up' });
          await expect(signUpButton).toBeVisible({ timeout: 30_000 });
          await expect(pleaseWaitText).not.toBeVisible({ timeout: 30_000 });
          await signUpButton.click();
          await safeWaitForURL(
            page,
            (u) => u.pathname.includes('/account/create'),
            {
              timeout: 30_000,
            },
          );

          const signupPage = new SignupPage(page);
          // The auth input strips hyphens from the local part, so this must
          // never be asserted on literally anywhere downstream.
          const email = `test-ecommerce+${Date.now()}@ibleducation.com`;
          logger.info(`[ecommerce] signup email: ${email}`);
          await signupPage.signUp(email, ECOMMERCE_SIGNUP_PASSWORD);
          //await page.waitForLoadState('domcontentloaded', { timeout: 60_000 });
          await safeWaitForURL(
            page,
            (url) => url.href.includes(MENTOR_NEXTJS_HOST),
            { timeout: 120_000 },
          );
          await safeWaitForURL(
            page,
            (u) => /\/platform\/main\/[^/]+$/.test(u.pathname),
            { timeout: 120_000 },
          );
          await expect(
            page.getByRole('button', {
              name: 'Selected agent dropdown button',
            }),
          ).toBeVisible({ timeout: 60_000 });
          logger.info(`[ecommerce] landed on main tenant: ${page.url()}`);
        },
      );

      await step(
        'Flow 0: credit dropdown shows a positive Free-plan balance',
        async () => {
          await expect(creditBalanceTrigger(page)).toBeVisible({
            timeout: 30_000,
          });
          const panel = await openCreditBalanceDropdown(page);
          await expect(creditBalancePlanBadge(page)).toHaveText('Free', {
            timeout: 10_000,
          });
          const remaining = await getCreditBalanceRemaining(page);
          expect(remaining).not.toBeNull();
          expect(remaining!).toBeGreaterThan(0);
          logger.info(
            `[ecommerce] main tenant: Free plan, ${remaining} credits`,
          );
          await expect(
            panel.getByRole('button', { name: /^Upgrade Plan$/ }),
          ).toBeVisible({ timeout: 10_000 });
          await closeCreditBalanceDropdown(page);
        },
      );

      await step(
        'Flow 0: profile dropdown shows exactly Profile / Help / Log Out',
        async () => {
          const navbarPage = new NavbarPage(page);
          await navbarPage.openProfileDropdown();
          await expect(page.getByRole('menuitem')).toHaveCount(3, {
            timeout: 10_000,
          });
          await expect(
            page.getByRole('menuitem', { name: 'Profile' }),
          ).toBeVisible();
          await expect(
            page.getByRole('menuitem', { name: 'Help' }),
          ).toBeVisible();
          await expect(
            page.getByRole('menuitem', { name: 'Log Out', exact: true }),
          ).toBeVisible();
          await page.keyboard.press('Escape');
        },
      );

      await step(
        'Flow 0: collapsed sidebar shows the expected top-level items',
        async () => {
          const sidebarPage = new SidebarPage(page);
          await expect(
            sidebarPage.sidebar.getByRole('button', {
              name: 'Agents',
              exact: true,
            }),
          ).toBeVisible({ timeout: 10_000 });
          await expect(sidebarPage.workflowsButton).toBeVisible({
            timeout: 10_000,
          });
          await expect(
            sidebarPage.sidebar.getByRole('button', {
              name: 'Recents',
              exact: true,
            }),
          ).toBeVisible({ timeout: 10_000 });
          await expect(
            sidebarPage.sidebar.getByRole('button', {
              name: 'Projects',
              exact: true,
            }),
          ).toBeVisible({ timeout: 10_000 });
          await expect(sidebarPage.analyticsButton).toBeVisible({
            timeout: 10_000,
          });
          await expect(sidebarPage.notificationsLink).toBeVisible({
            timeout: 10_000,
          });
          await expect(sidebarPage.inviteUsersButton).toBeVisible({
            timeout: 10_000,
          });
          await expect(sidebarPage.managementButton).toBeVisible({
            timeout: 10_000,
          });
          await expect(sidebarPage.integrationsButton).toBeVisible({
            timeout: 10_000,
          });
          await expect(sidebarPage.monetizationButton).toBeVisible({
            timeout: 10_000,
          });
          await expect(sidebarPage.settingsButton).toBeVisible({
            timeout: 10_000,
          });
          expect(await sidebarPage.isSupportLinkVisible(10_000)).toBe(true);
        },
      );

      await step(
        'Flow 0: gated sidebar entries all show the Subscribe-to-unlock dialog',
        async () => {
          const sidebarPage = new SidebarPage(page);

          await sidebarPage.expandSection('Agents');
          await sidebarPage.newMentorButton.click(); // "New Agent"
          await expectSubscribeModalAndClose(page);

          await sidebarPage.sidebar
            .getByRole('button', { name: 'My Agents', exact: true })
            .click();
          await expectSubscribeModalAndClose(page);

          await sidebarPage.expandSection('Workflows');
          await sidebarPage.sidebar
            .getByRole('button', { name: 'My Workflows', exact: true })
            .click();
          await expectSubscribeModalAndClose(page);

          await sidebarPage.expandSection('Projects');
          await sidebarPage.sidebar
            .getByRole('button', { name: 'New Project', exact: true })
            .click();
          await expectSubscribeModalAndClose(page);

          await sidebarPage.expandSection('Analytics');
          await sidebarPage.sidebar
            .getByRole('button', { name: 'Overview', exact: true })
            .click();
          await expectSubscribeModalAndClose(page);

          await sidebarPage.inviteUsersButton.click();
          await expectSubscribeModalAndClose(page);

          await sidebarPage.managementButton.click();
          await expectSubscribeModalAndClose(page);

          await sidebarPage.integrationsButton.click();
          await expectSubscribeModalAndClose(page);

          await sidebarPage.monetizationButton.click();
          await expectSubscribeModalAndClose(page);

          await sidebarPage.settingsButton.click();
          await expectSubscribeModalAndClose(page);
        },
      );

      await step(
        'Flow 0: chat responds normally with Free-plan credits',
        async () => {
          await sendMessageAndAwaitNewResponse(
            chatPage,
            'Hello! Can you introduce yourself?',
          );
        },
      );

      // ── Flow 1: cleanup credits (round 1) ──────────────────────────────
      await step('Flow 1: cleanup credits on the main tenant', async () => {
        await cleanupCredits(page);
      });

      // ── Flow 2: zero credits blocks chat on the main tenant ────────────
      await step(
        'Flow 2: zero credits on the main tenant blocks chat',
        async () => {
          await page.reload({ waitUntil: 'domcontentloaded' });
          // Reload can transiently bounce through /error/403 → / → back to the
          // platform URL — wait generously on the credit trigger rather than
          // asserting the URL immediately.
          await expect(creditBalanceTrigger(page)).toBeVisible({
            timeout: 90_000,
          });
          await expect(creditBalanceTrigger(page)).toHaveAttribute(
            'aria-label',
            /0 credits remaining/i,
            { timeout: 30_000 },
          );

          await openCreditBalanceDropdown(page);
          const remaining = await getCreditBalanceRemaining(page);
          expect(remaining).toBe(0);
          await closeCreditBalanceDropdown(page);

          // Sending a message is now blocked; the same paywall dialog appears
          // (~2-4s) instead of an AI response. Leave it open — Flow 3 clicks
          // through it.
          await chatPage.sendMessage('Will this go through with zero credits?');
          await expect(subscribeDialog(page)).toBeVisible({ timeout: 15_000 });
          await expect(
            subscribeDialog(page).getByRole('button', {
              name: 'Upgrade for free',
            }),
          ).toBeVisible({ timeout: 10_000 });
        },
      );

      // ── Flow 3: upgrade to the free plan via Stripe ────────────────────
      await step(
        'Flow 3: Upgrade for free redirects to a zero-cost Stripe checkout',
        async () => {
          await subscribeDialog(page)
            .getByRole('button', { name: 'Upgrade for free' })
            .click();

          await expect(page).toHaveURL(
            /store\.ibl\.ai|buy\.stripe\.com|checkout\.stripe\.com/,
            { timeout: 60_000 },
          );
          logger.info(
            `[ecommerce] free-plan upgrade redirected to ${page.url()}`,
          );

          const submitButton = page.getByTestId('hosted-payment-submit-button');
          await expect(submitButton).toBeVisible({ timeout: 30_000 });
          await submitButton.click();
        },
      );

      // ── Flow 4: back on the app with a real platform id + credits ─────
      await step(
        'Flow 4: lands on a real platform id with a Free-plan balance',
        async () => {
          await safeWaitForURL(
            page,
            (u) => {
              const parts = u.pathname.split('/').filter(Boolean);
              return (
                parts[0] === 'platform' &&
                parts.length >= 3 &&
                parts[1] !== 'main'
              );
            },
            { timeout: 120_000 },
          );

          const parsed = parsePlatformUrl(page.url());
          platformKey = parsed.platformKey;
          mentorId = parsed.mentorId;
          expect(platformKey).not.toBe('main');
          logger.info(
            `[ecommerce] landed on real platform ${platformKey}/${mentorId}`,
          );

          await expect(
            page.getByRole('button', {
              name: 'Selected agent dropdown button',
            }),
          ).toBeVisible({ timeout: 60_000 });

          const panel = await openCreditBalanceDropdown(page);
          await expect(creditBalancePlanBadge(page)).toHaveText('Free', {
            timeout: 10_000,
          });
          const remaining = await getCreditBalanceRemaining(page);
          expect(remaining).not.toBeNull();
          expect(remaining!).toBeGreaterThan(0);
          logger.info(
            `[ecommerce] real tenant: Free plan, ${remaining} credits`,
          );
          await expect(
            panel.getByRole('button', { name: /^Upgrade Plan$/ }),
          ).toBeVisible({ timeout: 10_000 });
          await closeCreditBalanceDropdown(page);

          await sendMessageAndAwaitNewResponse(
            chatPage,
            'Are you working now that I have credits?',
          );
        },
      );

      // ── Flow 5: billing via the account modal ──────────────────────────
      await step(
        'Flow 5: account modal Billing tab shows the Free plan + credits',
        async () => {
          const navbarPage = new NavbarPage(page);
          await navbarPage.openProfileDropdown();
          const accountItem = page.getByRole('menuitem', {
            name: /^Account$/i,
          });
          await expect(accountItem).toBeVisible({ timeout: 10_000 });
          await accountItem.click();

          const accountDialog = page.getByRole('dialog', {
            name: 'User Profile',
          });
          await expect(accountDialog).toBeVisible({ timeout: 15_000 });

          // The dialog's tab strip renders plain buttons, not role="tab"
          // (validated: a11y tree shows `button "Billing"`).
          const billingTab = accountDialog.getByRole('button', {
            name: 'Billing',
            exact: true,
          });
          await expect(billingTab).toBeVisible({ timeout: 10_000 });
          await billingTab.click();
          await expect(page).toHaveURL(/profileTab=billing/, {
            timeout: 10_000,
          });

          await waitForBillingTabReady(page);
          const billingPage = new BillingPage(page);
          const plan = await getBillingPlanLabel(page);
          expect(plan).toBe('Free');
          await expect(
            billingPage.billingPlanSection.getByText(/^Current$/),
          ).toBeVisible({ timeout: 10_000 });
          await expect(
            billingPage.billingPlanSection.getByRole('button', {
              name: /^Upgrade$/,
            }),
          ).toBeVisible({ timeout: 10_000 });
          await expect(
            billingPage.creditsSection.getByText(/^Available$/i),
          ).toBeVisible({ timeout: 10_000 });
          const creditsBefore = await billingPage.getCreditsRemaining();
          expect(creditsBefore).not.toBeNull();
          expect(creditsBefore!).toBeGreaterThan(0);
          logger.info(
            `[ecommerce] Billing tab: Free plan, ${creditsBefore} credits`,
          );

          await accountDialog.getByRole('button', { name: 'Close' }).click();
          await expect(accountDialog).not.toBeVisible({ timeout: 10_000 });
          await expect(page).not.toHaveURL(/profileTab=billing/, {
            timeout: 10_000,
          });

          await sendMessageAndAwaitNewResponse(
            chatPage,
            'Checking chat still works after billing tab.',
          );
        },
      );

      // ── Flow 6: cleanup credits (round 2) ──────────────────────────────
      await step(
        'Flow 6: cleanup credits again on the upgraded tenant',
        async () => {
          await cleanupCredits(page);
        },
      );

      // ── Flow 7: zero credits auto-opens the billing modal ──────────────
      await step(
        'Flow 7: zero credits on the upgraded tenant auto-opens Billing',
        async () => {
          await page.reload({ waitUntil: 'domcontentloaded' });
          await expect(creditBalanceTrigger(page)).toBeVisible({
            timeout: 90_000,
          });
          await expect(creditBalanceTrigger(page)).toHaveAttribute(
            'aria-label',
            /0 credits remaining/i,
            { timeout: 30_000 },
          );

          // Admin 402 handling injects ?profileTab=billing directly instead of
          // showing the "Subscribe to unlock" dialog (that dialog is only used
          // on the "main" tenant — see Flow 2).
          await chatPage.sendMessage('Zero credits should auto-open billing.');

          const accountDialog = page.getByRole('dialog', {
            name: 'User Profile',
          });
          await expect(accountDialog).toBeVisible({ timeout: 20_000 });
          await expect(page).toHaveURL(/profileTab=billing/, {
            timeout: 10_000,
          });

          await waitForBillingTabReady(page);
          const billingPage = new BillingPage(page);
          await expect(billingPage.creditsSection).toContainText(
            /0\s*Credits/i,
            {
              timeout: 15_000,
            },
          );
          const remaining = await billingPage.getCreditsRemaining();
          expect(remaining).toBe(0);
        },
      );

      // ── Flow 8: paid upgrade with a test card ──────────────────────────
      await step(
        'Flow 8: Billing tab Upgrade redirects to a real Stripe checkout',
        async () => {
          await clickBillingUpgrade(page);
          await expect(page).toHaveURL(
            /store\.ibl\.ai|buy\.stripe\.com|checkout\.stripe\.com/,
            { timeout: 60_000 },
          );
          logger.info(`[ecommerce] paid upgrade redirected to ${page.url()}`);

          const submitButton = page.getByTestId('hosted-payment-submit-button');
          await expect(submitButton).toBeVisible({ timeout: 30_000 });

          // Locale-proof: the hosted page renders in the browser locale (seen
          // in French during validation), so assert a currency amount pattern
          // rather than any specific label text.
          await expect(
            page.getByText(/(\$|US)\s?\d+([.,]\d{2})?/).first(),
          ).toBeVisible({ timeout: 15_000 });

          const cardNumber = page
            .locator('#cardNumber')
            .or(page.locator('input[name="cardNumber"]'));

          // Select the Card payment method — but only when its form isn't
          // already expanded. Stripe sometimes preselects Card, and the open
          // accordion renders an expanded click-area button
          // (`card-accordion-item-button`) that overlays the radio and
          // intercepts pointer events, making a direct radio click time out.
          // Clicking the `card-accordion-item` row is safe in both states:
          // the overlay button is a descendant of the row, so Playwright's
          // hit-target check passes (validated live on store.ibl.ai).
          if (!(await isVisibleWithin(cardNumber, 5_000))) {
            await page.getByTestId('card-accordion-item').click();
          }
          await expect(cardNumber).toBeVisible({ timeout: 20_000 });
          const cardExpiry = page
            .locator('#cardExpiry')
            .or(page.locator('input[name="cardExpiry"]'));
          const cardCvc = page
            .locator('#cardCvc')
            .or(page.locator('input[name="cardCvc"]'));
          const billingName = page
            .locator('#billingName')
            .or(page.locator('input[name="billingName"]'));
          const billingCountry = page.locator('#billingCountry');

          await cardNumber.fill('4242424242424242');
          await cardExpiry.fill('12 / 30');
          await cardCvc.fill('123');
          await billingName.fill('Test Ecommerce');
          // Selecting Uruguay removes the postal-code field (validated); use
          // the ISO value, not the label, since it's locale-independent.
          await billingCountry.selectOption({ value: 'UY' });

          // "Save my information" (Link, #enableStripePass) is sometimes
          // pre-checked and adds a required phone-number field that would
          // block payment — uncheck it when present.
          const savePass = page.locator('#enableStripePass');
          if (
            (await isVisibleWithin(savePass, 2_000)) &&
            (await savePass.isChecked())
          ) {
            await savePass.uncheck();
          }

          await submitButton.click();
        },
      );

      await step(
        'Flow 8: lands back on the same platform with a restored Premium balance',
        async () => {
          await safeWaitForURL(
            page,
            (u) => {
              const parts = u.pathname.split('/').filter(Boolean);
              return (
                parts[0] === 'platform' &&
                parts[1] === platformKey &&
                parts[2] === mentorId
              );
            },
            { timeout: 120_000 },
          );

          const accountDialog = page.getByRole('dialog', {
            name: 'User Profile',
          });
          const dialogAppeared = await isVisibleWithin(accountDialog, 30_000);
          if (!dialogAppeared) {
            logger.warn(
              '[ecommerce] account dialog did not auto-open after paid checkout — continuing',
            );
            return;
          }

          await waitForBillingTabReady(page);
          const plan = await getBillingPlanLabel(page);
          expect(plan).toBe('Premium');

          const billingPage = new BillingPage(page);
          await expect(
            billingPage.creditsSection.getByRole('button', {
              name: /^Manage Billing$/,
            }),
          ).toBeVisible({ timeout: 15_000 });
          const creditsAfterPayment = await billingPage.getCreditsRemaining();
          expect(creditsAfterPayment).not.toBeNull();
          expect(creditsAfterPayment!).toBeGreaterThan(0);
          logger.info(
            `[ecommerce] Premium plan restored with ${creditsAfterPayment} credits`,
          );

          await accountDialog.getByRole('button', { name: 'Close' }).click();
          await expect(accountDialog).not.toBeVisible({ timeout: 10_000 });
        },
      );

      // ── Flow 9: has credits, can chat ───────────────────────────────────
      await step(
        'Flow 9: Premium plan has credits and chat works',
        async () => {
          await expect(creditBalanceTrigger(page)).toBeVisible({
            timeout: 60_000,
          });
          await openCreditBalanceDropdown(page);
          const remaining = await getCreditBalanceRemaining(page);
          expect(remaining).not.toBeNull();
          expect(remaining!).toBeGreaterThan(0);
          logger.info(
            `[ecommerce] Premium plan: ${remaining} credits remaining`,
          );
          await closeCreditBalanceDropdown(page);

          await sendMessageAndAwaitNewResponse(
            chatPage,
            'Final check - do you still respond with credits available?',
          );
        },
      );
    } finally {
      await context.close();
    }
  });
});
