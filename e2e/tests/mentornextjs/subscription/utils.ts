import { expect, Locator, Page } from '@playwright/test';
import { logger } from '@iblai/iblai-js/playwright';
import {
  DM_URL,
  EXTERNAL_STRIPE_PRICING_URL,
  MENTOR_NEXTJS_HOST,
  ECOMMERCE_CREDIT_CLEANUP_TOKEN,
  AUTH_HOST,
  EMBED_URL,
} from '../../utils';
import { checkAdminStatus, selectDropdownWorksCorrectly } from '../utils';
import { fillCreateMentorForm } from '../utils/create-mentor';
import { safeWaitForURL } from '@iblai/iblai-js/playwright';

export async function getPricingModalHandlers(page: Page) {
  const dialog = page.getByRole('dialog').last();
  await expect(dialog).toBeVisible({ timeout: 15000 });
  const closeButton = dialog.getByRole('button', { name: 'Close' });
  await expect(closeButton).toBeVisible();
  const iblIframe = dialog.frameLocator(
    `iframe[src*="${EXTERNAL_STRIPE_PRICING_URL}"]`
  );
  const stripeTableHandle = await iblIframe
    .locator('stripe-pricing-table')
    .elementHandle();
  if (!stripeTableHandle) throw new Error('stripe-pricing-table not found');

  const shadowRootHandle = await stripeTableHandle.evaluateHandle(
    (el) => el.shadowRoot
  );
  if (!shadowRootHandle) throw new Error('No shadow root');

  const innerIframeHandle = await shadowRootHandle.evaluateHandle((root) =>
    root?.querySelector('iframe')
  );
  const iframeElementHandle = innerIframeHandle.asElement();
  if (!iframeElementHandle)
    throw new Error('iframe inside shadow root not found');

  const innerFrame = await iframeElementHandle.contentFrame();
  if (!innerFrame)
    throw new Error('Could not access content frame of inner iframe');

  return {
    dialog,
    closeButton,
    innerFrame,
    stripeTableHandle,
    shadowRootHandle,
    innerIframeHandle,
    iframeElementHandle,
  };
}

export async function testExpectPricingModalOpening(
  page: Page,
  closePricingModal: boolean = true
) {
  const { closeButton } = await getPricingModalHandlers(page);
  if (closePricingModal) {
    await closeButton.click();
    await page.waitForTimeout(1000);
    //await expect(dialog).not.toBeVisible();
  }
}

export async function expectSubscriptionBannerDisplay(
  page: Page,
  currentPlan: 'free' | 'starter' | 'pro' | 'student'
) {
  logger.info('Expect subscription banner display');
  await expect(page.locator('#top-banner-component')).toBeVisible();
  if (currentPlan === 'student') {
    await expect(page.locator('#top-banner-component')).toHaveText(
      new RegExp(`Your organization has run out of credits.*`)
    );
  } else {
    await expect(page.locator('#top-banner-component')).toHaveText(
      new RegExp(
        `You've run out of credits on the ${
          currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)
        } plan.*`
      )
    );
  }

  let upgradeLabel = '';
  switch (currentPlan) {
    case 'free':
      upgradeLabel = 'Upgrade Plan 😎';
      break;
    case 'starter':
      upgradeLabel = 'Upgrade Plan 😎';
      break;
    case 'pro':
      upgradeLabel = 'Add Credits';
      break;
    default:
      upgradeLabel = 'Contact Now 🫶';
  }
  const bannerActionButton = page.getByRole('button', { name: upgradeLabel });
  await expect(bannerActionButton).toBeVisible();
  return bannerActionButton;
}

export async function chooseSubscriptionPlan(
  page: Page,
  plan: 'free' | 'starter' | 'pro'
) {
  const { innerFrame } = await getPricingModalHandlers(page);
  const gridLevel = plan === 'free' ? 0 : plan === 'starter' ? 1 : 2;
  const priceColumn = await innerFrame
    .locator(`[data-testid="price-column"]`)
    .nth(gridLevel);
  const button = await priceColumn.locator(`button`);
  await button.click();
  await page.waitForTimeout(1000);
  await expect(page).toHaveURL(/checkout\.stripe\.com\/c\/pay/);
}

export async function testRedirectToAddCreditPage(
  page: Page,
  billingAddress: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
  }
) {
  logger.info('Test redirect to add credit page');
  await page.waitForTimeout(1000);
  await expect(page).toHaveURL(/buy\.stripe\.com/);
  /* await expect(page).toHaveURL(
    new RegExp(`https://buy\\.stripe\\.com/.*prefilled_email=${email}`)
  ); */
  await page.waitForLoadState('load');
  await page.getByTestId('card-accordion-item').click();
  await page.waitForTimeout(2000);
  await page
    .getByRole('textbox', { name: 'Card number' })
    .fill('4242424242424242');
  const nextYear = (new Date().getFullYear() + 1).toString().slice(-2);
  await page
    .getByRole('textbox', { name: 'Expiration' })
    .fill(`01/${nextYear}`);
  await page.getByRole('textbox', { name: 'CVC' }).fill('123');
  await page
    .getByRole('textbox', { name: 'Cardholder name' })
    .fill(billingAddress.name);
  const zipField = page.getByRole('textbox', { name: 'ZIP' });
  if (await zipField.isVisible()) {
    await zipField.fill(billingAddress.zip);
    await page.getByRole('checkbox').first().click();
  }
  await page.waitForTimeout(2000);
  await page.getByTestId('hosted-payment-submit-button').click();
  await page.waitForTimeout(10000);
  if (MENTOR_NEXTJS_HOST.includes('localhost')) {
    await page.goto(MENTOR_NEXTJS_HOST);
    await page.waitForLoadState('domcontentloaded');
  }
  await expect(page).toHaveURL(new RegExp(`.*platform/(?!main/).*`));
}

export async function testRedirectToBillingAndUpdatePlan(
  page: Page,
  targetSubscriptionPlan: 'starter' | 'pro',
  billingAddress: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
  }
) {
  logger.info('Test redirect to stripe billing page');
  await page.waitForTimeout(1000);
  await expect(page).toHaveURL(/billing\.stripe\.com\/p\/session/);
  await page.waitForTimeout(5000);
  await page.waitForLoadState('load');
  const subscriptionPricingGrid = page.locator('[data-testid="pricing-table"]');
  const targetPlan = subscriptionPricingGrid
    .locator(`[data-testid="pricing-table-card"]`)
    .nth(targetSubscriptionPlan === 'starter' ? 1 : 2);
  await targetPlan.getByRole('button').click();
  await page.waitForTimeout(1000);
  await page.locator('[data-testid="continue-button"]').click();
  await page.waitForTimeout(3000);
  await page.locator('button[data-testid="confirm"]').click();
  await page.waitForTimeout(3000);
  if (await page.getByText('Update your payment method').isVisible()) {
    // Use a more specific selector to target the main payment input frame (without aria-hidden)
    const stripeIframe = page.frameLocator(
      `iframe[title*="Secure payment input frame"]:not([aria-hidden="true"])`
    );
    await stripeIframe
      .getByRole('textbox', { name: 'Card number' })
      .fill('4242424242424242');
    const nextYear = (new Date().getFullYear() + 1).toString().slice(-2);
    await stripeIframe
      .getByRole('textbox', { name: 'Expiration date MM / YY' })
      .fill(`01/${nextYear}`);
    await stripeIframe
      .getByRole('textbox', { name: 'Security code' })
      .fill('123');
    const zipField = stripeIframe.getByRole('textbox', { name: 'ZIP code' });
    if (await zipField.isVisible()) {
      await zipField.fill(billingAddress.zip);
      await stripeIframe.getByRole('checkbox').first().click();
    }
    await page.waitForTimeout(2000);
    await page.getByTestId('confirm').click();
    await page.waitForTimeout(10000);
    await expect(page.getByText('Subscription updated')).toBeVisible();
    await page.getByTestId('return-to-business-link').click();
    await page.waitForTimeout(1000);
    await page.waitForLoadState('load');
    await expect(page).toHaveURL(new RegExp(`.*platform/(?!main/).*`));
  }
}

export async function upgradeSubscriptionPlan(
  page: Page,
  targetSubscriptionPlan: 'starter' | 'pro'
) {
  logger.info('Testing subscription upgrade on billing page');
  await expect(page).toHaveURL(/billing\.stripe\.com\/p\/session/);
  await page.waitForTimeout(5000);
  await page.waitForLoadState('load');
}

export async function fillStripePaymentForm(
  page: Page,
  billingAddress: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
  }
) {
  const nameField = await page.getByRole('textbox').nth(0);
  await nameField.fill(billingAddress.name);

  const enterManuallyButton = page.getByRole('button', {
    name: 'Enter address manually',
  });
  const enterManuallyButtonIsVisible = await enterManuallyButton.isVisible();
  if (enterManuallyButtonIsVisible) {
    await page.waitForTimeout(1000);
    await enterManuallyButton.click();
    await page.waitForTimeout(2000);
  }
  const adressField = await page.getByRole('textbox').nth(1);
  await adressField.fill(billingAddress.address);
  const cityField = await page.getByRole('textbox').nth(3);
  await cityField.fill(billingAddress.city);
  if (enterManuallyButtonIsVisible) {
    /* const stateField = await page.getByRole('textbox').nth(4);
    await stateField.fill(billingAddress.state); */
    const zipField = await page.getByRole('textbox').nth(4);
    await zipField.fill(billingAddress.zip);
  }
  await page.waitForTimeout(3000);
  await page.getByTestId('hosted-payment-submit-button').click();
  await page.waitForTimeout(5000);
  await page.waitForLoadState('load');
  await expect(page).toHaveURL(new RegExp(`${AUTH_HOST}.*`));
}

export async function callCreditExhaustionEndpoint(
  page: Page,
  token: string | null
) {
  try {
    logger.info(`Calling credit exhaustion endpoint with token: ${token}`);
    logger.info(`DM_URL: ${DM_URL}`);
    const response = await page.request.post(
      `${DM_URL}/api/service/credits/cleanup/`,
      {
        data: {
          token: ECOMMERCE_CREDIT_CLEANUP_TOKEN,
        },
        headers: {
          Authorization: `Token ${token}`,
        },
      }
    );
    if (response.status() !== 200) {
      throw new Error(
        `Failed to call credit exhaustion endpoint: ${response.status()}`
      );
    }
    return response;
  } catch (error) {
    logger.error(`Failed to call credit exhaustion endpoint: ${error}`);
    throw error;
  }
}

export async function exhaustCredit(page: Page) {
  logger.info('Exhausting credit...');
  const dm_token = await page.evaluate(() => {
    return localStorage.getItem('dm_token');
  });
  if (!(await callCreditExhaustionEndpoint(page, dm_token))) {
    //logger.info('Credit exhaustion endpoint called successfully');
    throw new Error('Failed to call credit exhaustion endpoint');
  }
}

export async function testChat(page: Page, expectChatResponse = false) {
  logger.info('Testing chat with Mentor');
  await page.fill('textarea[placeholder="Ask anything"]', 'Hello');
  const sendButton = page.getByRole('button', { name: 'Send message' });
  await expect(sendButton).toBeEnabled({ timeout: 15000 });
  // Wait for the reducers to be stable (to be improved)
  await page.waitForTimeout(5000);
  await sendButton.click();
  await page.waitForTimeout(10000);
  if (expectChatResponse) {
    const currentMentorName = await page
      .getByRole('button', { name: 'Selected mentor dropdown' })
      .textContent();
    await expect(
      page.getByRole('img', { name: `${currentMentorName}` }).nth(0)
    ).toBeVisible();
    logger.info(
      'Mentor chats so credit available and successfully upgraded to FREE Plan'
    );
  }
}

export async function inviteNewStudent(page: Page, studentEmail: string) {
  logger.info('Inviting new student');
  await page.getByRole('button', { name: 'Invite Users' }).click();
  await page.waitForTimeout(2000);
  const inviteUserDialog = page.getByRole('dialog', { name: 'Invite Users' });
  await expect(inviteUserDialog).toBeVisible();
  await inviteUserDialog
    .getByRole('textbox', { name: 'Enter email to invite...' })
    .fill(studentEmail);
  await inviteUserDialog.locator('button[type="submit"]').click();
  //
  await page.waitForTimeout(5000);
  await expect(page.getByText(studentEmail)).toBeVisible();
  logger.info(`Student ${studentEmail} invited`);
}

export async function signupUser(
  page: Page,
  userCredentials: { email: string; password: string; username: string },
  toMainTenant: boolean = true
) {
  await page.goto(MENTOR_NEXTJS_HOST);
  logger.info('Navigating to', MENTOR_NEXTJS_HOST);

  // Flexible wait for login redirect
  await safeWaitForURL(
    page,
    (url) => url.href.includes('/login') && url.href.includes('redirect-to'),
    { timeout: 60000 }
  );

  // Wait for auth page to be ready
  await expect(page.getByRole('button', { name: 'Sign Up' })).toBeVisible({
    timeout: 60_000,
  });

  // Signup flow
  await page.getByRole('button', { name: 'Sign Up' }).click({ force: true });
  await expect(page).toHaveURL(new RegExp(`${AUTH_HOST}/account/create.*`), {
    timeout: 60_000,
  });

  await page.getByPlaceholder('Email').fill(userCredentials.email);
  await page.getByPlaceholder('Username').fill(userCredentials.username);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  await page
    .getByPlaceholder('Password', { exact: true })
    .fill(userCredentials.password);
  await page
    .getByPlaceholder('Confirm password')
    .fill(userCredentials.password);
  await page.getByRole('button', { name: 'Create Account' }).click();

  //Expect user to be on the main tenant
  const platformRegex = toMainTenant
    ? '/platform/main/.*'
    : '/platform/(?!main/).*';
  await safeWaitForURL(page, new RegExp(`.*${platformRegex}`), {
    timeout: 80000,
  });

  // Wait for 5 seconds
  await page.waitForTimeout(5_000);
}

export async function testTriggerMailToLink(page: Page) {
  logger.info('Testing trigger mail to link');
  //check if browser is redirecting to mailto link
  await expect(page).toHaveURL(new RegExp(`mailto:.*`));
}

export async function MenuItem(page: Page, menuitem: string) {
  const promptMenuItem = page.getByRole('menuitem', { name: menuitem });
  await expect(promptMenuItem).toBeVisible({ timeout: 15000 });
  await promptMenuItem.click();

  const promptModal = page
    .getByRole('dialog')
    .filter({ hasText: 'Edit Mentor' });
  await expect(promptModal).toBeVisible({ timeout: 15000 });
}

export async function testEmbedWithCss(
  page: Page,
  ADVANCED_CSS: string,
  expectedColor?: string
) {
  const isAdmin = await checkAdminStatus(page);

  if (!isAdmin) {
    await selectDropdownWorksCorrectly(page);
    await expect(
      page.getByRole('menuitem', { name: 'Embed' })
    ).not.toBeVisible();
  }

  await fillCreateMentorForm({ page });
  await selectDropdownWorksCorrectly(page);
  const embedMenuItem = page.getByRole('menuitem', { name: 'Embed' });
  await expect(embedMenuItem).toBeVisible({ timeout: 10000 });
  await embedMenuItem.click();

  const embedDialog = page.locator('div[role="dialog"]');
  await embedDialog.waitFor();
  await expect(embedDialog).toBeVisible();

  // Expand the Advanced CSS collapsible card
  const advancedCssExpandButton = embedDialog.getByRole('button', {
    name: /Expand Advanced CSS/i,
  });
  await expect(advancedCssExpandButton).toBeVisible({ timeout: 10000 });
  await advancedCssExpandButton.click();

  // Wait for the card to expand and locate the textarea
  const advancedCssTextArea = embedDialog.getByRole('textbox', {
    name: 'Custom CSS input',
  });
  await expect(advancedCssTextArea).toBeVisible({ timeout: 5000 });
  await advancedCssTextArea.fill('');
  await advancedCssTextArea.fill(ADVANCED_CSS);

  // Save the Advanced CSS
  const saveCssButton = embedDialog.getByRole('button', {
    name: 'Save advanced CSS',
  });
  await expect(saveCssButton).toBeEnabled({ timeout: 5000 });
  await saveCssButton.click();

  // Wait for save to complete
  await page.waitForTimeout(2000);

  // Set "Who Can Chat?" to "Anyone" (anonymous mode)
  const whoCanChatSelect = embedDialog.getByRole('combobox', {
    name: 'Select who can chat',
  });
  await expect(whoCanChatSelect).toBeVisible();
  await whoCanChatSelect.click();

  const anyoneOption = page.getByRole('option', { name: 'Anyone' });
  await expect(anyoneOption).toBeVisible();
  await anyoneOption.click();
  logger.info('Set chat access to "Anyone" (anonymous mode enabled)');

  await page.getByRole('button', { name: 'Create Embed' }).click();
  // assert embed dialog is visible

  const codeDialog = page
    .getByRole('dialog')
    .filter({ hasText: 'Embedded Code' });
  await expect(codeDialog).toBeVisible({ timeout: 120_000 });
  const preLocator = codeDialog.locator('pre');
  await expect(preLocator).toBeVisible();
  const copyButton = codeDialog
    .locator('button[data-slot="button"] svg.lucide-copy')
    .locator('..');
  await expect(copyButton).toBeVisible();
  await copyButton.click();
  const embedCode = (await preLocator.textContent()) || '';

  const extractedEmbedCode = embedCode.match(
    /window\.onload\s*=\s*function\s*\(\)\s*{([\s\S]*?)}\s*;?\s*<\/script>/i
  );
  const extractedScriptBody = extractedEmbedCode?.[1]?.trim();
  const newPage = await page.context().newPage();
  await newPage.goto(EMBED_URL, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('domcontentloaded');
  await newPage.waitForTimeout(5000);

  await newPage.addScriptTag({
    content: `(function() {\n${extractedScriptBody}\n})();`,
  });
  await page.waitForLoadState('domcontentloaded');

  await expect(newPage.locator('#ibl-chat-widget-container')).not.toBeVisible();
  //return removed;
  const openChatButton = newPage.getByRole('button', {
    name: 'Open chat assistant',
  });
  await expect(openChatButton).toBeVisible({ timeout: 10000 });

  await openChatButton.click();
  await page.waitForTimeout(5000);

  logger.info('Chat button clicked');

  // Step 5: Validate the chat widget container
  const widget = newPage.locator('#ibl-chat-widget-container');
  await expect(widget).toBeVisible();

  // Step 6: Access second iframe
  const secondIframe = widget.frameLocator('iframe').nth(0);
  const closeButton = secondIframe.getByRole('button', {
    name: /close chat/i,
  });
  const sendBtn = secondIframe.locator('.chat-submit-message-button');
  await expect(sendBtn).toBeVisible({ timeout: 120_000 });
  const styles = await sendBtn.evaluate(
    (el) => {
      const computed = window.getComputedStyle(el);
      return {
        backgroundColor: computed.backgroundColor,
        backgroundImage: computed.backgroundImage,
      };
    },
    { timeout: 60_000 }
  );
  expect(styles.backgroundColor).toBe(expectedColor);
  await closeButton.click();
  await expect(widget).not.toBeVisible();
}

export async function testEmbedWithJs(
  page: Page,
  ADVANCED_JS: string,
  options?: {
    expectValidation?: boolean;
    expectWarnings?: boolean;
    expectAlert?: boolean;
    expectedAlertMessage?: string;
  }
) {
  const isAdmin = await checkAdminStatus(page);

  if (!isAdmin) {
    await selectDropdownWorksCorrectly(page);
    await expect(
      page.getByRole('menuitem', { name: 'Embed' })
    ).not.toBeVisible();
    return;
  }

  await fillCreateMentorForm({ page });
  await selectDropdownWorksCorrectly(page);
  const embedMenuItem = page.getByRole('menuitem', { name: 'Embed' });
  await expect(embedMenuItem).toBeVisible({ timeout: 10000 });
  await embedMenuItem.click();

  const embedDialog = page.locator('div[role="dialog"]');
  await embedDialog.waitFor();
  await expect(embedDialog).toBeVisible();

  // Expand the Advanced JavaScript collapsible card
  const advancedJsExpandButton = embedDialog.getByRole('button', {
    name: /Expand Advanced JavaScript/i,
  });
  await expect(advancedJsExpandButton).toBeVisible({ timeout: 10000 });
  await advancedJsExpandButton.click();

  // Check if Custom JavaScript is disabled
  const jsDisabledMessage = embedDialog.getByRole('heading', {
    name: 'Custom JavaScript is Disabled',
  });
  const isJsDisabled = await jsDisabledMessage.isVisible().catch(() => false);

  if (isJsDisabled) {
    logger.info(
      'Custom JavaScript feature is disabled for this tenant/mentor - skipping test'
    );
    // Close the dialog and return early
    const closeButton = embedDialog.getByRole('button', { name: 'Close' });
    if (await closeButton.isVisible()) {
      await closeButton.click();
    }
    return;
  }

  // Wait for the card to expand and locate the textarea
  const advancedJsTextArea = embedDialog.getByRole('textbox', {
    name: 'Custom JavaScript input',
  });
  await expect(advancedJsTextArea).toBeVisible({ timeout: 5000 });
  await advancedJsTextArea.fill('');
  await advancedJsTextArea.fill(ADVANCED_JS);

  // Verify validation status if expected
  if (options?.expectValidation !== false) {
    // Wait for validation to complete
    await page.waitForTimeout(500);

    // Check if validation indicator shows "Valid"
    const validIndicator = embedDialog.locator('text=Valid').first();
    const isValid = await validIndicator.isVisible().catch(() => false);

    if (isValid) {
      logger.info('JavaScript validation passed');
    }
  }

  // Check for warnings if expected
  if (options?.expectWarnings) {
    const warningsIndicator = embedDialog.locator('text=Warnings').first();
    await expect(warningsIndicator).toBeVisible({ timeout: 5000 });
    logger.info('JavaScript validation warnings detected as expected');
  }

  // Save the Advanced JavaScript
  const saveJsButton = embedDialog.getByRole('button', {
    name: 'Save advanced JavaScript',
  });

  // Only attempt to save if the button is enabled (validation passed)
  const isEnabled = await saveJsButton.isEnabled();
  if (isEnabled) {
    await saveJsButton.click();

    // Wait for save to complete
    await page.waitForTimeout(2000);
    logger.info('Advanced JavaScript saved successfully');
  } else {
    logger.info('Save button disabled - validation may have failed');
  }

  // Set "Who Can Chat?" to "Anyone" (anonymous mode)
  const whoCanChatSelect = embedDialog.getByRole('combobox', {
    name: 'Select who can chat',
  });
  await expect(whoCanChatSelect).toBeVisible();
  await whoCanChatSelect.click();

  const anyoneOption = page.getByRole('option', { name: 'Anyone' });
  await expect(anyoneOption).toBeVisible();
  await anyoneOption.click();
  logger.info('Set chat access to "Anyone" (anonymous mode enabled)');

  await page.getByRole('button', { name: 'Create Embed' }).click();

  const codeDialog = page
    .getByRole('dialog')
    .filter({ hasText: 'Embedded Code' });
  await expect(codeDialog).toBeVisible({ timeout: 120_000 });
  const preLocator = codeDialog.locator('pre');
  await expect(preLocator).toBeVisible();

  logger.info('Embed code generated successfully with Advanced JavaScript');

  const copyButton = codeDialog
    .locator('button[data-slot="button"] svg.lucide-copy')
    .locator('..');
  await expect(copyButton).toBeVisible();
  await copyButton.click();
  const embedCode = (await preLocator.textContent()) || '';

  const extractedEmbedCode = embedCode.match(
    /window\.onload\s*=\s*function\s*\(\)\s*{([\s\S]*?)}\s*;?\s*<\/script>/i
  );
  const extractedScriptBody = extractedEmbedCode?.[1]?.trim();
  const newPage = await page.context().newPage();

  // Set up dialog handler to capture alert messages
  let alertMessage: string | null = null;
  newPage.on('dialog', async (dialog) => {
    alertMessage = dialog.message();
    logger.info(`Alert detected: ${alertMessage}`);
    await dialog.accept();
  });

  await newPage.goto(EMBED_URL, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('domcontentloaded');
  await newPage.waitForTimeout(5000);

  await newPage.addScriptTag({
    content: `(function() {\n${extractedScriptBody}\n})();`,
  });
  await page.waitForLoadState('domcontentloaded');

  await expect(newPage.locator('#ibl-chat-widget-container')).not.toBeVisible();

  const openChatButton = newPage.getByRole('button', {
    name: 'Open chat assistant',
  });
  await expect(openChatButton).toBeVisible({ timeout: 10000 });

  await openChatButton.click();
  await page.waitForTimeout(5000);

  logger.info('Chat button clicked');

  // Step 5: Validate the chat widget container
  const widget = newPage.locator('#ibl-chat-widget-container');
  await expect(widget).toBeVisible();

  const secondIframe = widget.frameLocator('iframe').nth(0);
  const closeButton = secondIframe.getByRole('button', {
    name: /close chat/i,
  });
  await expect(closeButton).toBeVisible({ timeout: 120_000 });

  // Step 5.1: Verify the alert was triggered by the custom JavaScript
  // Wait a moment for any delayed alerts
  if (options?.expectAlert) {
    expect(alertMessage).not.toBeNull();
    if (options.expectedAlertMessage) {
      expect(alertMessage).toBe(options.expectedAlertMessage);
      logger.info(
        `Alert message verified: "${alertMessage}" matches expected "${options.expectedAlertMessage}"`
      );
    } else {
      logger.info(`Alert was triggered with message: "${alertMessage}"`);
    }
  }

  // Step 6: Access second iframe
  await closeButton.click();
  await expect(widget).not.toBeVisible();
}

export async function EditMentor(
  page: Page,
  menuItem: string,
  prompt: string,
  editDialogText: string
) {
  const isAdmin = await checkAdminStatus(page);
  await selectDropdownWorksCorrectly(page);

  if (isAdmin) {
    await MenuItem(page, menuItem);
    logger.info(`Navigated to ${menuItem} menu item`);

    // Wait for the Edit Mentor dialog to be visible and ready
    const editMentorDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Edit Mentor' });
    await expect(editMentorDialog).toBeVisible({ timeout: 15000 });

    // Use semantic locator to find the Edit button within the dialog
    const firstEditButton = editMentorDialog
      .getByRole('button', { name: 'Edit' })
      .first();
    await expect(firstEditButton).toBeVisible({ timeout: 10000 });
    await expect(firstEditButton).toBeEnabled();
    await firstEditButton.click();
    logger.info('Clicked Edit button');

    // Wait for the system prompt dialog to appear
    const systemPromptDialog = page
      .getByRole('dialog')
      .filter({ hasText: editDialogText });
    await expect(systemPromptDialog).toBeVisible({ timeout: 15000 });
    logger.info(`${editDialogText} dialog is visible`);

    // Use data-testid or more specific locator for contenteditable
    // First try to find by role textbox, then fall back to contenteditable
    const editor = systemPromptDialog.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10000 });

    // Focus the editor first
    await editor.click();

    // Clear existing content completely using ControlOrMeta+A (cross-platform select all)
    // This is more reliable for TipTap/ProseMirror editors than triple-click
    await expect(async () => {
      // Focus and select all
      await editor.focus();
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.press('Backspace');

      // Verify editor is empty
      const text = await editor.textContent();
      expect(text?.trim().length ?? 0).toBe(0);
    }).toPass({ timeout: 15000, intervals: [500, 1000, 2000] });

    logger.info('Editor cleared successfully - verified empty');

    // Type the new prompt using keyboard input (proper Playwright method)
    await editor.pressSequentially(prompt, { delay: 10 });
    logger.info('Entered new prompt text');

    // Verify the content was entered correctly before saving
    await expect(editor).toHaveText(prompt, { timeout: 10000 });

    // Click Save and wait for the save operation to complete
    const saveButton = systemPromptDialog.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    logger.info('Clicked Save button');

    // Wait for save to complete by checking for success state
    // The save button should remain enabled after successful save
    await expect(saveButton).toBeEnabled({ timeout: 15000 });

    // Verify the content persisted after save
    await expect(editor).toHaveText(prompt, { timeout: 10000 });
    logger.info('Verified prompt text persisted after save');

    // Close the dialog
    const closeButton = systemPromptDialog.getByRole('button', {
      name: 'Close',
    });
    await expect(closeButton).toBeVisible();
    await closeButton.click();

    // Verify dialog is closed
    await expect(systemPromptDialog).not.toBeVisible({ timeout: 10000 });
    logger.info('System prompt dialog closed successfully');
  } else {
    const promptMenuItem = page.getByRole('menuitem', { name: menuItem });
    await expect(promptMenuItem).not.toBeVisible({ timeout: 5000 });
    logger.info(
      `Non-admin user: ${menuItem} menu item not visible as expected`
    );
  }
}

export async function openUserProfileDropdown(page: Page) {
  const profileButton = page.getByLabel('User Profile Dropdown Button');
  await expect(profileButton).toBeVisible();
  await profileButton.click();
  await page.waitForTimeout(1000);
  const userProfileDropdown = page.getByTestId('user-profile-dropdown-content');
  await expect(userProfileDropdown).toBeVisible();
  return userProfileDropdown;
}

export async function openAccountModal(
  page: Page,
  userProfileDropdown: Locator
) {
  const accountMenuItem = userProfileDropdown.getByTestId(
    'user-profile-dropdown-tenant-account-menu-item'
  );
  await expect(accountMenuItem).toBeVisible();
  await accountMenuItem.click();
  await page.waitForTimeout(2000);
  const accountModal = page.getByRole('dialog').last();
  await expect(accountModal).toBeVisible();
  return accountModal;
}

export async function closeAccountModal(page: Page, accountModal: Locator) {
  const closeButton = accountModal.getByRole('button', { name: 'Close' });
  await expect(closeButton).toBeVisible();
  await closeButton.click();
  await page.waitForTimeout(1000);
  await expect(accountModal).not.toBeVisible();
}

export async function clickAndAssert(expected: boolean, toggleSwitch: Locator) {
  await toggleSwitch.click();
  await expect(toggleSwitch).toHaveAttribute('aria-checked', String(expected), {
    timeout: 5000,
  });
  if (expected) {
    await expect(toggleSwitch).toHaveClass(/bg-blue-500/, {
      timeout: 5000,
    });
  }
}
