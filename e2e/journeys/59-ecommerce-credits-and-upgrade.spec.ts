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
import { dismissProductTourIfShown } from '../utils/product-tour';
import {
  closePlanPicker,
  expectChangePlanPicker,
  expectTrialPlanPicker,
  pickPlanExpectingCheckout,
  pickPlanInPlace,
  planCardButton,
  planPickerDialog,
} from '../utils/plan-picker';
import {
  addCreditsDialog,
  closeCreditBalanceDropdown,
  creditBalancePanel,
  creditBalancePlanBadge,
  creditBalanceTrigger,
  getBillingPlanLabel,
  getCreditBalanceRemaining,
  logger,
  openCreditBalanceDropdown,
  waitForBillingTabReady,
  clickBillingAddCredits,
  submitAddCreditsAmount,
} from '@iblai/iblai-js/playwright';

// ─── Journey 59: Ecommerce Credits & Upgrade ─────────────────────────────────
//
// End-to-end lifecycle of a brand-new free-trial user against the "main"
// tenant, exhausting credits twice and upgrading twice:
//
//   Flow 0 — free-trial signup via the auth service's /account/create form,
//            landing on <base>/platform/main/<mentorId>. Verifies the credit
//            dropdown ("Trial" badge, positive balance, "Upgrade" as the one
//            action), the profile dropdown (exactly Profile/Help/Log Out),
//            the collapsed sidebar's visible items, the "Choose Your Plan"
//            picker on every gated sidebar entry (Free / Pro / Max / Ultra
//            cards, "Choose <name>" each, Pro marked "Most Popular"), and a
//            working chat.
//   Flow 1 — three long agent conversations, each asserted to deduct
//            credits, then cleanup credits via the DM service's admin
//            cleanup endpoint.
//   Flow 2 — zero credits on the "main" tenant blocks chat: the trial 402
//            toast ("You've run out of your free trial credits. Pick a plan
//            to continue.") and the same plan picker instead of a reply.
//   Flow 3 — choosing the Free plan redirects to a Stripe-hosted,
//            zero-cost checkout (email pre-filled, no card required).
//   Flow 4 — the checkout's SSO redirect chain lands back on the app under a
//            REAL platform id (not "main") with a fresh Free-plan balance;
//            chat works again.
//   Flow 5 — the profile dropdown's "Account" item opens the "User Profile"
//            dialog; its Billing tab (?profileTab=billing) shows the Free
//            plan ("You're on the Free plan…", Change Plan + Add Credits; no
//            Auto Recharge section since no card is on file yet) and a
//            positive credit balance.
//   Flow 6 — three more long conversations, each asserted to deduct credits,
//            then cleanup credits again on the upgraded tenant.
//   Flow 7 — zero credits on the upgraded tenant: the admin 402 toast
//            ("You've run out of credits. Add credits to continue.") and the
//            Billing tab auto-opens (?profileTab=billing) showing 0 credits.
//   Flow 8 — "Add Credits" in the Billing tab opens the Add Credits dialog;
//            with no card on file its "Continue" redirects to the Stripe
//            customer portal (payment-method flow) with the amount + a
//            one-time nonce on the after-completion URL, so the app charges
//            that amount automatically once the card is saved. Saving the
//            card inside the portal is NOT automated; the journey confirms
//            the redirect and returns to the workspace without a card.
//   Flow 9 — "Change Plan" in the credit dropdown opens the "Change Your
//            Plan" picker with Free marked "Current Plan" and Pro / Max /
//            Ultra as upgrades. With no card on file "Upgrade to Pro" leaves
//            for a real Stripe test-mode checkout; the 4242 test card (Uruguay
//            billing country) completes it and the SSO chain lands back on
//            the workspace on the Pro plan, with the card now on file
//            (Manage Usage + Add Credits + Auto Recharge) and Pro credits.
//   Flow 10 — "Upgrade to Max" is applied in place (no checkout): the toast
//            "You're now on the Max plan.", the badge reads Max, and the Max
//            allowance is granted once the upgrade invoice is paid against
//            the saved card (iblai-dm-pro#3206).
//   Flow 11 — "Add Credits" with a card on file: the dialog's "Other amount"
//            takes $1 and "Add Credits" charges at once ("Credits added
//            successfully"), and the balance grows.
//   Flow 12 — "Downgrade to Pro" is scheduled for the end of the period
//            ("Your current plan ends…") and the badge stays Max.
//   Flow 13 — chat works with the paid balance.
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
 * Long prompts that each ask for a long reply, so every turn burns a
 * measurable amount of credits. Plain-knowledge topics that need no tools
 * (web search, canvas), keeping the turns fast and the charge purely LLM.
 */
const LONG_CONVERSATION_PROMPTS = [
  'I am preparing a lesson for first-year university biology students and ' +
    'need a thorough explanation of photosynthesis. Please cover the light-' +
    'dependent reactions, the Calvin cycle, the role of chlorophyll and ' +
    'accessory pigments, and how factors like light intensity, carbon ' +
    'dioxide concentration, and temperature affect the overall rate. Write ' +
    'about 400 words in clear paragraphs.',
  'Continuing the teaching theme, I also run an introductory programming ' +
    'course. Compare bubble sort, merge sort, and quicksort for my students: ' +
    'describe how each algorithm works step by step, give the best, average, ' +
    'and worst-case time complexity of each, explain their memory usage and ' +
    'stability, and say when each is a sensible choice in practice. Write ' +
    'about 400 words in clear paragraphs.',
  'Finally, one of my students has final exams in both biology and computer ' +
    'science in two weeks and is feeling overwhelmed. Draft a detailed ' +
    'day-by-day two-week study plan that balances both subjects, mixes ' +
    'active recall and practice problems with rest, includes a mock exam ' +
    'for each subject, and ends with advice for the night before and the ' +
    'morning of each exam. Write about 400 words.',
];

/**
 * Reads the signed-in user's exact credit balance. The credit dropdown
 * renders `parseInt(available_credits)`, so a sub-credit charge never moves
 * the visible number — instead this captures the raw `available_credits`
 * from the `GET <DM>/api/billing/account/` refetch that every dropdown open
 * fires, then asserts the dropdown shows that same balance.
 */
async function readCreditBalance(page: Page): Promise<number> {
  // Opening only refetches on a closed → open transition.
  if (await creditBalancePanel(page).isVisible()) {
    await closeCreditBalanceDropdown(page);
  }
  const billingResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname.endsWith('/api/billing/account/') &&
      response.ok(),
    { timeout: 30_000 },
  );
  await openCreditBalanceDropdown(page);
  const { available_credits } = (await (await billingResponse).json()) as {
    available_credits?: string;
  };
  const exact = Number.parseFloat(available_credits ?? '');
  expect(
    Number.isFinite(exact),
    `expected a numeric available_credits, got ${available_credits}`,
  ).toBe(true);
  // The helper's parser drops a minus sign, so only compare non-negative
  // balances against the rendered value.
  if (exact >= 0) {
    await expect
      .poll(() => getCreditBalanceRemaining(page), { timeout: 10_000 })
      .toBe(Math.trunc(exact));
  }
  await closeCreditBalanceDropdown(page);
  return exact;
}

/**
 * Holds three long conversation turns with the agent and asserts the exact
 * credit balance drops after each one. Charges are recorded server-side
 * after the reply streams, so each check re-opens the dropdown (refetching)
 * until the balance falls below its pre-turn value.
 */
async function converseAndExpectCreditsDeducted(
  page: Page,
  chatPage: ChatPage,
  tenantLabel: string,
): Promise<void> {
  await expect(chatPage.stopStreamingButton).toBeHidden({ timeout: 180_000 });
  let balance = await readCreditBalance(page);
  logger.info(`[ecommerce] ${tenantLabel}: ${balance} credits before chatting`);

  for (const [index, prompt] of LONG_CONVERSATION_PROMPTS.entries()) {
    const turn = `turn ${index + 1}/${LONG_CONVERSATION_PROMPTS.length}`;
    const before = balance;
    await sendMessageAndAwaitNewResponse(chatPage, prompt);
    await chatPage.waitForStreamingComplete(180_000);
    await expect(chatPage.stopStreamingButton).toBeHidden({
      timeout: 180_000,
    });

    await expect(async () => {
      balance = await readCreditBalance(page);
      expect(
        balance,
        `${tenantLabel} ${turn}: expected credits to drop below ${before}`,
      ).toBeLessThan(before);
    }).toPass({ timeout: 90_000, intervals: [3_000, 5_000] });
    logger.info(
      `[ecommerce] ${tenantLabel} ${turn}: ${before} -> ${balance} credits ` +
        `(deducted ${before - balance})`,
    );
  }
}

/**
 * The `UpgradePackageModal` plan picker (`@iblai/web-containers`) shown for
 * both the sidebar paywall gates and the zero-credit chat block on the "main"
 * tenant: title "Choose Your Plan", one card per plan with a "Choose <name>"
 * button (see `utils/plan-picker` for both of its modes).
 */
const subscribeDialog = planPickerDialog;

/** The free plan's button in the picker: "Choose Free". */
function chooseFreeButton(page: Page): Locator {
  return planCardButton(page, 'free');
}

/**
 * Asserts the gated-feature plan picker is visible with its "Choose Free"
 * button, then closes it via the dialog's Close button and waits for it to
 * detach. Used for every gated sidebar entry point, which all render the same
 * shared modal (the first entry verifies the whole picker).
 */
async function expectSubscribeModalAndClose(page: Page): Promise<void> {
  await expect(subscribeDialog(page)).toBeVisible({ timeout: 15_000 });
  await expect(chooseFreeButton(page)).toHaveText('Choose Free', {
    timeout: 15_000,
  });
  await closePlanPicker(page);
}

test.describe('Journey 59: Ecommerce Credits & Upgrade', () => {
  // Signup + two full Stripe checkouts + four agent chats + two rounds of
  // three long credit-metered conversations + two credit cleanups — give the
  // whole lifecycle plenty of room.
  test.use({ storageState: { cookies: [], origins: [] } });
  test.setTimeout(1_500_000);

  test('new user signs up for a free trial, exhausts credits, starts the Free plan via Stripe, exhausts credits again, is sent to add a payment method, upgrades to Pro with a test card, moves to Max in place, tops up, and schedules a downgrade', async ({
    browser,
    step,
  }) => {
    test.skip(
      !DM_URL || !ECOMMERCE_CREDIT_CLEANUP_TOKEN,
      'DM_URL / ECOMMERCE_CREDIT_CLEANUP_TOKEN not configured for this environment',
    );
    test.skip(
      process.env.ECOMMERCE_E2E !== '1',
      'ECOMMERCE_E2E not enabled for this environment',
    );

    // Fresh, unauthenticated context — the signup flow provisions +
    // authenticates its own account.
    const context = await browser.newContext();
    const page = await context.newPage();

    const chatPage = new ChatPage(page);
    let platformKey = '';
    let mentorId = '';
    /** The app's origin once the Free checkout returned to the workspace. */
    let appOrigin = '';
    let proBalance = 0;
    let maxBalance = 0;

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
          await dismissProductTourIfShown(page);
          logger.info(`[ecommerce] landed on main tenant: ${page.url()}`);
        },
      );

      await step(
        'Flow 0: credit dropdown shows a positive free-trial balance',
        async () => {
          await expect(creditBalanceTrigger(page)).toBeVisible({
            timeout: 30_000,
          });
          const panel = await openCreditBalanceDropdown(page);
          await expect(creditBalancePlanBadge(page)).toHaveText('Trial', {
            timeout: 10_000,
          });
          const remaining = await getCreditBalanceRemaining(page);
          expect(remaining).not.toBeNull();
          expect(remaining!).toBeGreaterThan(0);
          logger.info(
            `[ecommerce] main tenant: free trial, ${remaining} credits`,
          );
          // "Upgrade" is the trial's one action: no Add Credits, Manage Usage
          // or Change Plan until a plan is chosen.
          await expect(
            panel.getByRole('button', { name: /^Upgrade$/ }),
          ).toBeVisible({ timeout: 10_000 });
          await expect(
            panel.getByRole('button', {
              name: /^(Add Credits|Manage Usage|Change Plan)$/,
            }),
          ).toHaveCount(0);
          await closeCreditBalanceDropdown(page);
        },
      );

      await step(
        'Flow 0: profile dropdown shows exactly Profile / Organizations / Help / Log Out',
        async () => {
          const navbarPage = new NavbarPage(page);
          await navbarPage.openProfileDropdown();
          // Organizations is always offered — the chooser fetches its own list.
          await expect(page.getByRole('menuitem')).toHaveCount(4, {
            timeout: 10_000,
          });
          await expect(
            page.getByRole('menuitem', { name: 'Profile' }),
          ).toBeVisible();
          await expect(
            page.getByRole('menuitem', { name: 'Organizations' }),
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
          await expect(sidebarPage.secretsButton).toBeVisible({
            timeout: 10_000,
          });
          await expect(sidebarPage.apiButton).toBeVisible({
            timeout: 10_000,
          });
          await expect(sidebarPage.monetizationButton).toBeVisible({
            timeout: 10_000,
          });
          await expect(sidebarPage.memoryButton).toBeVisible({
            timeout: 10_000,
          });
          await expect(sidebarPage.settingsButton).toBeVisible({
            timeout: 10_000,
          });
          expect(await sidebarPage.isSupportLinkVisible(10_000)).toBe(true);
        },
      );

      await step(
        'Flow 0: gated sidebar entries all open the Choose Your Plan picker',
        async () => {
          const sidebarPage = new SidebarPage(page);

          await sidebarPage.expandSection('Agents');
          await sidebarPage.newMentorButton.click(); // "New Agent"
          // The first gate is verified in full (every card, its "Choose
          // <name>" button, the "Most Popular" chip); the rest only need the
          // same picker to open.
          const planKeys = await expectTrialPlanPicker(page);
          expect(planKeys, 'expected the Free plan to be offered').toContain(
            'free',
          );
          await closePlanPicker(page);

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

          await sidebarPage.secretsButton.click();
          await expectSubscribeModalAndClose(page);

          await sidebarPage.apiButton.click();
          await expectSubscribeModalAndClose(page);

          await sidebarPage.monetizationButton.click();
          await expectSubscribeModalAndClose(page);

          await sidebarPage.memoryButton.click();
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

      // ── Flow 1: metered conversations, then cleanup credits (round 1) ──
      await step(
        'Flow 1: three long conversations each deduct credits on the main tenant',
        async () => {
          await converseAndExpectCreditsDeducted(page, chatPage, 'main tenant');
        },
      );

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
          await expect(
            page.getByText(
              "You've run out of your free trial credits. Pick a plan to continue.",
            ),
          ).toBeVisible({ timeout: 15_000 });
          await expect(subscribeDialog(page)).toBeVisible({ timeout: 15_000 });
          await expect(chooseFreeButton(page)).toBeVisible({
            timeout: 15_000,
          });
        },
      );

      // ── Flow 3: choose the Free plan in the picker → Stripe ───────────
      await step(
        'Flow 3: choosing the Free plan redirects to a zero-cost Stripe checkout',
        async () => {
          await pickPlanExpectingCheckout(page, 'free');

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
            { timeout: 180_000 },
          );

          const parsed = parsePlatformUrl(page.url());
          platformKey = parsed.platformKey;
          mentorId = parsed.mentorId;
          appOrigin = new URL(page.url()).origin;
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
          // A brand-new workspace has no card on file yet: still one
          // "Add Credits" button (its dialog collects the card on Stripe
          // first), and no Auto Recharge section.
          await expect(
            panel.getByRole('button', { name: /^Add Credits$/ }),
          ).toBeVisible({ timeout: 10_000 });
          await expect(
            panel.getByRole('button', { name: /^Manage Usage$/ }),
          ).toHaveCount(0);
          await expect(panel.getByText(/^Auto Recharge$/)).toHaveCount(0);
          // The backend names the plan, so the Billing row offers Change Plan.
          await expect(
            panel.getByRole('button', { name: /^Change Plan$/ }),
          ).toBeVisible({ timeout: 10_000 });
          await expect(
            panel.getByRole('button', { name: /^Upgrade$/ }),
          ).toHaveCount(0);
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
            billingPage.creditsSection.getByRole('button', {
              name: /^Add Credits$/,
            }),
          ).toBeVisible({ timeout: 10_000 });
          await expect(billingPage.autoRechargeSection).toHaveCount(0);
          await expect(billingPage.changePlanButton).toBeVisible({
            timeout: 10_000,
          });
          await expect(billingPage.upgradeButton).toHaveCount(0);
          expect(await billingPage.getCreditsDescription()).toMatch(
            /^You're on the Free plan\. Add credits whenever you need more\./,
          );
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

      // ── Flow 6: metered conversations, then cleanup credits (round 2) ──
      await step(
        'Flow 6: three long conversations each deduct credits on the upgraded tenant',
        async () => {
          await converseAndExpectCreditsDeducted(
            page,
            chatPage,
            'upgraded tenant',
          );
        },
      );

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
          await expect(
            page.getByText(
              "You've run out of credits. Add credits to continue.",
            ),
          ).toBeVisible({ timeout: 20_000 });

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

      // ── Flow 8: Add Credits without a card goes through the Stripe portal ─
      await step(
        'Flow 8: Billing tab Add Credits (no card) redirects to the Stripe customer portal',
        async () => {
          await clickBillingAddCredits(page);
          // No card on file: the dialog's button reads "Continue", not
          // "Add Credits", and nothing is charged before the redirect.
          const pressed = await submitAddCreditsAmount(page, 5);
          expect(pressed).toBe('Continue');
          // The customer portal is served from the platform's Stripe domain
          // (validated live: store.ibl.ai/p/session/payment-methods).
          await expect(page).toHaveURL(
            /store\.ibl\.ai\/p\/session|billing\.stripe\.com/,
            { timeout: 60_000 },
          );
          logger.info(`[ecommerce] Add Credits redirected to ${page.url()}`);
          // Saving the 4242 test card inside the portal is not automated:
          // the portal's payment-method form is a different hosted page from
          // the checkout this journey fills. Once it is saved, Stripe returns
          // to the app with the amount + nonce on the URL and the app charges
          // $5 and adds the credits on its own. The card arrives through the
          // Pro checkout below instead.
        },
      );

      await step(
        'Flow 8: back on the workspace, still without a card',
        async () => {
          await page.goto(`${appOrigin}/platform/${platformKey}/${mentorId}`, {
            waitUntil: 'domcontentloaded',
            timeout: 60_000,
          });
          await expect(
            page.getByRole('button', {
              name: 'Selected agent dropdown button',
            }),
          ).toBeVisible({ timeout: 60_000 });
          await dismissProductTourIfShown(page);
          const panel = await openCreditBalanceDropdown(page);
          await expect(
            panel.getByRole('button', { name: /^Add Credits$/ }),
          ).toBeVisible({ timeout: 10_000 });
          await expect(
            panel.getByRole('button', { name: /^Manage Usage$/ }),
          ).toHaveCount(0);
          await closeCreditBalanceDropdown(page);
        },
      );

      // ── Flow 9: Free → Pro through the Stripe card checkout ────────────
      await step(
        'Flow 9: Change Plan offers Pro as an upgrade and leaves for the Stripe checkout',
        async () => {
          const panel = await openCreditBalanceDropdown(page);
          await panel.getByRole('button', { name: /^Change Plan$/ }).click();
          const keys = await expectChangePlanPicker(page, 'free');
          expect(keys, 'expected the Pro plan to be offered').toContain(
            'premium',
          );
          // No card on file yet, so the change goes through a Stripe checkout.
          await pickPlanExpectingCheckout(page, 'premium');
          await expect(page).toHaveURL(
            /store\.ibl\.ai|buy\.stripe\.com|checkout\.stripe\.com/,
            { timeout: 60_000 },
          );
          logger.info(`[ecommerce] Pro upgrade redirected to ${page.url()}`);
        },
      );

      await step(
        'Flow 9: the 4242 test card completes the Pro checkout',
        async () => {
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
        'Flow 9: back on the workspace on the Pro plan, with a card on file and Pro credits',
        async () => {
          await safeWaitForURL(
            page,
            (u) =>
              u.origin === appOrigin &&
              u.pathname.startsWith(`/platform/${platformKey}/`),
            { timeout: 180_000 },
          );
          await expect(
            page.getByRole('button', {
              name: 'Selected agent dropdown button',
            }),
          ).toBeVisible({ timeout: 60_000 });
          await dismissProductTourIfShown(page);

          // The return may auto-open the account dialog on Billing; close it
          // so the nav bar is reachable.
          const accountDialog = page.getByRole('dialog', {
            name: 'User Profile',
          });
          if (await isVisibleWithin(accountDialog, 15_000)) {
            await accountDialog.getByRole('button', { name: 'Close' }).click();
            await expect(accountDialog).toBeHidden({ timeout: 10_000 });
          }

          // The plan and the saved card arrive through Stripe's webhooks:
          // re-open the dropdown (each open refetches) until both show.
          await expect(async () => {
            if (await creditBalancePanel(page).isVisible()) {
              await closeCreditBalanceDropdown(page);
            }
            const panel = await openCreditBalanceDropdown(page);
            await expect(creditBalancePlanBadge(page)).toHaveText(
              /^(Pro|Premium)$/i,
            );
            await expect(
              panel.getByRole('button', { name: /^Manage Usage$/ }),
            ).toBeVisible();
          }).toPass({ timeout: 120_000, intervals: [3_000, 5_000] });

          const panel = await openCreditBalanceDropdown(page);
          await expect(
            panel.getByRole('button', { name: /^Add Credits$/ }),
          ).toBeVisible();
          await expect(
            panel.getByRole('button', { name: /^Change Plan$/ }),
          ).toBeVisible();
          await expect(panel.getByText(/^Auto Recharge$/)).toBeVisible();
          await expect(
            panel.getByRole('button', { name: /^Upgrade$/ }),
          ).toHaveCount(0);
          await closeCreditBalanceDropdown(page);

          proBalance = await readCreditBalance(page);
          expect(proBalance, 'expected Pro credits').toBeGreaterThan(0);
          logger.info(`[ecommerce] Pro plan with ${proBalance} credits`);
        },
      );

      // ── Flow 10: Pro → Max in place ───────────────────────────────────
      await step(
        'Flow 10: Upgrade to Max is applied in place and grants the Max credits',
        async () => {
          const before = proBalance;
          const panel = await openCreditBalanceDropdown(page);
          await panel.getByRole('button', { name: /^Change Plan$/ }).click();
          const keys = await expectChangePlanPicker(page, 'premium');
          expect(keys, 'expected the Max plan to be offered').toContain('max');
          // A card is on file now, so the upgrade is charged today and
          // applied without leaving the app.
          await pickPlanInPlace(page, 'max', /You're now on the Max plan\./);

          await expect(async () => {
            if (await creditBalancePanel(page).isVisible()) {
              await closeCreditBalanceDropdown(page);
            }
            await openCreditBalanceDropdown(page);
            await expect(creditBalancePlanBadge(page)).toHaveText('Max');
          }).toPass({ timeout: 60_000, intervals: [2_000, 5_000] });
          await closeCreditBalanceDropdown(page);

          // The upgrade invoice is charged to the card saved at the Pro
          // checkout, and the Max allowance is granted once it is paid
          // (iblai-dm-pro#3206): the balance must rise above the Pro one.
          await expect(async () => {
            maxBalance = await readCreditBalance(page);
            expect(
              maxBalance,
              'expected the Max upgrade to add credits',
            ).toBeGreaterThan(before);
          }).toPass({ timeout: 120_000, intervals: [3_000, 5_000] });
          logger.info(
            `[ecommerce] Max plan: ${before} -> ${maxBalance} credits`,
          );
        },
      );

      // ── Flow 11: Add Credits with a card on file ──────────────────────
      await step(
        'Flow 11: Add Credits with a card on file charges at once and adds the credits',
        async () => {
          const before = maxBalance;
          const panel = await openCreditBalanceDropdown(page);
          await panel.getByRole('button', { name: /^Add Credits$/ }).click();
          const dialog = addCreditsDialog(page);
          await expect(dialog).toBeVisible({ timeout: 10_000 });
          await expect(
            dialog.getByText(
              'Add credits to your account using your payment method on file.',
            ),
          ).toBeVisible();
          // $1 is not a preset, so this goes through "Other amount".
          const pressed = await submitAddCreditsAmount(page, 1);
          expect(pressed).toBe('Add Credits');
          await expect(
            page.getByText('Credits added successfully').first(),
          ).toBeVisible({ timeout: 10_000 });

          await expect(async () => {
            const balance = await readCreditBalance(page);
            expect(
              balance,
              'expected the top-up to add credits',
            ).toBeGreaterThan(before);
          }).toPass({ timeout: 60_000, intervals: [2_000, 5_000] });
        },
      );

      // ── Flow 12: Max → Pro is scheduled, not immediate ────────────────
      await step(
        'Flow 12: Downgrade to Pro is scheduled for the end of the period and the plan stays Max',
        async () => {
          const panel = await openCreditBalanceDropdown(page);
          await panel.getByRole('button', { name: /^Change Plan$/ }).click();
          await expectChangePlanPicker(page, 'max');
          await pickPlanInPlace(
            page,
            'premium',
            /Your current plan ends (on .+|at the end of the billing period)\. You'll be on Pro after that\./,
          );
          await openCreditBalanceDropdown(page);
          await expect(creditBalancePlanBadge(page)).toHaveText('Max');
          await closeCreditBalanceDropdown(page);
        },
      );

      // ── Flow 13: has credits, can chat ────────────────────────────────
      await step('Flow 13: chat works with the paid balance', async () => {
        await sendMessageAndAwaitNewResponse(
          chatPage,
          'Final check - do you still respond with credits available?',
        );
      });
    } finally {
      await context.close();
    }
  });
});
