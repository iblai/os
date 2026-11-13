import { test, expect } from '../fixtures/mentor-test';
import { ECOMMERCE_CHECKOUT_URL } from '../fixtures/test-data';
import { dismissProductTourIfShown } from '../utils/product-tour';
import {
  expectChangePlanPicker,
  pickPlanExpectingCheckout,
} from '../utils/plan-picker';
import {
  creditBalancePlanBadge,
  creditBalanceTrigger,
  getCreditBalanceRemaining,
  logger,
  openCreditBalanceDropdown,
} from '@iblai/iblai-js/playwright';

test.describe('Journey 55: Free Credits Checkout Onboarding', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  // External multi-hop flow (Stripe → auth SSO → mentor SPA → Stripe) — give it room.
  test.setTimeout(240_000);

  test('new user completes the free-credits Stripe checkout, lands on the mentor SPA on the Free plan, and Change Plan offers Pro through the Stripe card checkout', async ({
    browser,
  }) => {
    test.skip(
      !ECOMMERCE_CHECKOUT_URL,
      'ECOMMERCE_CHECKOUT_URL is not configured for this environment',
    );

    // Fresh, unauthenticated context — the checkout provisions + authenticates
    // its own account.
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      const email = `test+${Date.now()}@ibleducation.com`;
      logger.info(`[free-credits] checkout email: ${email}`);

      // ── Step 1: open the checkout redirect → Stripe-hosted page ────────────
      await page.goto(ECOMMERCE_CHECKOUT_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      });

      const emailField = page.locator('input#email');
      await expect(emailField).toBeVisible({ timeout: 30_000 });
      const submitButton = page.getByTestId('hosted-payment-submit-button');
      await expect(submitButton).toBeVisible({ timeout: 15_000 });

      // ── Step 2: submit email → SSO redirect chain → mentor SPA platform ────
      await emailField.fill(email);
      await submitButton.click();

      // The auth SSO redirect chain ends on the mentor SPA platform page.
      await page.waitForURL(/\/platform\/[^/]+\/[^/]+/, { timeout: 120_000 });

      // Readiness gate — same signal `navigateToMentorApp` waits on.
      await expect(
        page.getByRole('button', { name: 'Selected agent dropdown button' }),
      ).toBeVisible({ timeout: 60_000 });

      await dismissProductTourIfShown(page);

      // Final URL must match <base-url>/platform/<platform-key>/<mentor-id>.
      const finalUrl = new URL(page.url());
      const pathMatch = finalUrl.pathname.match(
        /^\/platform\/([^/]+)\/([^/]+)$/,
      );
      expect(
        pathMatch,
        `expected <base>/platform/<platform-key>/<mentor-id>, got ${page.url()}`,
      ).not.toBeNull();
      const [, platformKey, mentorId] = pathMatch!;
      expect(platformKey).toBeTruthy();
      expect(mentorId).toBeTruthy();
      logger.info(
        `[free-credits] landed on ${finalUrl.origin}/platform/${platformKey}/${mentorId}`,
      );

      // ── Step 3: credit dropdown: X credits, "Free" badge, Add Credits only ─
      await expect(creditBalanceTrigger(page)).toBeVisible({ timeout: 30_000 });
      const panel = await openCreditBalanceDropdown(page);

      await expect(creditBalancePlanBadge(page)).toHaveText('Free', {
        timeout: 10_000,
      });

      const remaining = await getCreditBalanceRemaining(page);
      expect(
        remaining,
        'expected a parseable "Remaining … Credits" value',
      ).not.toBeNull();
      expect(remaining!).toBeGreaterThan(0);
      logger.info(
        `[free-credits] Free plan with ${remaining} credits remaining`,
      );

      // A new workspace has no card on file: one "Add Credits" button (its
      // dialog collects the card on Stripe first), no Manage Usage, no Auto
      // Recharge, and never the trial's "Upgrade".
      await expect(
        panel.getByRole('button', { name: /^Add Credits$/ }),
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        panel.getByRole('button', { name: /^(Manage Usage|Upgrade)$/ }),
      ).toHaveCount(0);
      await expect(panel.getByText(/^Auto Recharge$/)).toHaveCount(0);

      // ── Step 4: Change Plan → "Change Your Plan" with Free as the current plan
      const changePlan = panel.getByRole('button', { name: /^Change Plan$/ });
      await expect(changePlan).toBeVisible({ timeout: 10_000 });
      await changePlan.click();
      const keys = await expectChangePlanPicker(page, 'free');
      expect(keys, 'expected Pro to be offered as an upgrade').toContain(
        'premium',
      );

      // ── Step 5: Upgrade to Pro → Stripe checkout requiring a card ──────────
      // No card on file yet, so the change goes through a Stripe checkout.
      await pickPlanExpectingCheckout(page, 'premium');
      await expect(page).toHaveURL(
        /store\.ibl\.ai|buy\.stripe\.com|checkout\.stripe\.com/,
        { timeout: 60_000 },
      );
      logger.info(`[free-credits] Pro upgrade redirected to ${page.url()}`);

      await expect(
        page.locator('iframe[name^="__privateStripeFrame"]').first(),
      ).toBeAttached({ timeout: 30_000 });
      await expect(
        page.getByTestId('hosted-payment-submit-button'),
      ).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(/payment method/i).first()).toBeVisible({
        timeout: 15_000,
      });
    } finally {
      await context.close();
    }
  });
});
