import { test, expect } from '@playwright/test';
import { AUTH_HOST, MENTOR_NEXTJS_HOST } from '../utils';
import { signUpWithEmailAndPassword } from '../helpers';
import { safeWaitForURL } from '@iblai/iblai-js/playwright';

const date = Date.now();
const email = `testUser${date}@gmail.com`;
const password = 'testUsers';

test.describe('new user sees stripe modal when trying to create a mentor', () => {
  // Clear cookies and origins before each test
  test.use({ storageState: { cookies: [], origins: [] } });

  test('new user sees stripe modal when trying to create a mentor', async ({
    page,
  }) => {
    // Navigate to the mentor
    await page.goto(MENTOR_NEXTJS_HOST, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
    console.log('################################ AUTH_HOST ', AUTH_HOST);
    // Wait to be redirected to Auth Host
    await safeWaitForURL(page, (url) => url.href.startsWith(AUTH_HOST));

    // signup user with email and password
    await signUpWithEmailAndPassword(page);

    // Click New Mentor button
    const newMentorButton = page.getByRole('button', {
      name: 'New Mentor',
      exact: true,
    });
    await expect(newMentorButton).toBeVisible({ timeout: 10000 });
    await newMentorButton.click();

    // Verify Stripe modal dialog appears
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 15000 });

    // Access iframe inside the dialog
    const iblIframe = dialog.frameLocator(
      'iframe[src*="https://ibl.ai/plans?embedded-for-pricing=true"]'
    );

    // Locate stripe pricing table inside iframe
    const stripeTableHandle = await iblIframe
      .locator('stripe-pricing-table')
      .elementHandle();
    if (!stripeTableHandle) throw new Error('stripe-pricing-table not found');

    // Access shadow root of the stripe-pricing-table
    const shadowRootHandle = await stripeTableHandle.evaluateHandle(
      (el) => el.shadowRoot
    );
    if (!shadowRootHandle) throw new Error('No shadow root');

    // Get the inner iframe inside the shadow root
    const innerIframeHandle = await shadowRootHandle.evaluateHandle((root) =>
      root?.querySelector('iframe')
    );

    // Validate the inner iframe exists
    const iframeElementHandle = innerIframeHandle.asElement();
    if (!iframeElementHandle)
      throw new Error('iframe inside shadow root not found');

    // Access content frame of inner iframe
    const innerFrame = await iframeElementHandle.contentFrame();
    if (!innerFrame)
      throw new Error('Could not access content frame of inner iframe');

    // Verify Stripe Subscribe button is visible
    const stripeSubscribeButton = innerFrame
      .getByRole('button', { name: 'Pay' })
      .first();
    await expect(stripeSubscribeButton).toBeVisible({ timeout: 10000 });
  });
});
