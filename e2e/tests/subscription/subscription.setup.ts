import test, { test as setup, expect } from '@playwright/test';
import { MENTOR_NEXTJS_HOST } from '../utils';
import { authenticate } from '../utils';
import { logger } from '@iblai/iblai-js/playwright';
import {
  callCreditExhaustionEndpoint,
  chooseSubscriptionPlan,
  exhaustCredit,
  expectSubscriptionBannerDisplay,
  fillStripePaymentForm,
  inviteNewStudent,
  signupUser,
  testChat,
  testExpectPricingModalOpening,
  testRedirectToAddCreditPage,
  testRedirectToBillingAndUpdatePlan,
} from './utils';

const timestamp = Date.now();
const email = `test+${timestamp}@mailnesia.com`;
const username = `test${timestamp}`;
const password = 'test-password';

const inviteEmail = `testinvite+${timestamp}@mailnesia.com`;
const inviteUsername = `testinvite${timestamp}`;
const invitePassword = 'test-password';

const sidebarAdminFeatures = [
  'New Mentor',
  'Invite Users',
  'Analytics',
  'Settings',
  'New Project',
];

const sampleBillingAddress = {
  name: 'John Doe',
  address: 'U.S. Capitol Building, East Capitol St NE',
  city: 'Washington',
  state: 'DC',
  zip: '20003',
  country: 'United States',
};

/* if (ENABLE_STRIPE_TEST !== 'true') {
  logger.info('Skipping Ecommerce tests as ENABLE_STRIPE_TEST is not true');
  test.skip();
} */

test.skip();

setup('User can sign up and store session', async ({ page, browserName }) => {
  // Define paths dynamically per browser
  /* const userCredentials = `playwright/.auth/user-credentials-${browserName}.json`;
  const authFile = `playwright/.auth/mentornextjs-user-${browserName}.json`; */

  //logger.info('Browser:', browserName);
  await signupUser(page, { email, username, password });

  // ✅ Save storage state for this browser
  /* fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });

  // ✅ Save user credentials JSON for this browser
  fs.mkdirSync(path.dirname(userCredentials), { recursive: true });
  fs.writeFileSync(
    userCredentials,
    JSON.stringify({ email, username, password }, null, 2),
    'utf8'
  ); */
});

test.describe.configure({ mode: 'serial' });

test.use(({ browserName }) => {
  return {
    storageState: `playwright/.auth/mentor_nextjs-user-${browserName}.json`,
  };
});

let userCredentials: { email: string; username: string; password: string };

test.beforeEach(async ({ browserName }) => {
  // Load credentials before each test
  /* const credentialsPath = `playwright/.auth/user-credentials-${browserName}.json`;
  userCredentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8')); */
  userCredentials = {
    email,
    username,
    password,
  };
});

test('PRE-FREE Plan : Test Admin Features', async ({ page }) => {
  await authenticate(
    page,
    MENTOR_NEXTJS_HOST,
    userCredentials.email,
    userCredentials.password
  );

  await expect(page).toHaveURL(new RegExp(`.*platform/main/.*`));

  logger.info('Testing sidebar admin features');

  for (const feature of sidebarAdminFeatures) {
    if (!(await page.getByRole('button', { name: feature }).isVisible())) {
      logger.info(`Admin feature ${feature} not visible, skipping`);
      continue;
    }
    logger.info(`Testing admin feature: ${feature}`);
    await expect(page.getByRole('button', { name: feature })).toBeVisible();
    await page.getByRole('button', { name: feature }).click();
    await testExpectPricingModalOpening(page, true);
    logger.info(`Admin feature ${feature} tested successfully`);
  }

  logger.info('Testing user input prompt box button admin features');

  const promptBoxAdminFeatures = ['Voice call', 'Voice input'];

  for (const feature of promptBoxAdminFeatures) {
    if (!(await page.getByRole('button', { name: feature }).isVisible())) {
      logger.info(`Admin feature ${feature} not visible, skipping`);
      continue;
    }
    logger.info(`Testing admin feature: ${feature}`);
    await expect(page.getByRole('button', { name: feature })).toBeVisible();
    await page.getByRole('button', { name: feature }).click();
    await testExpectPricingModalOpening(page, true);
    logger.info(`Admin feature ${feature} tested successfully`);
  }

  logger.info('Testing user input prompt box Attach upload feature');
  const attachFileButton = page.getByRole('button', { name: 'Attach File' });
  if (!(await attachFileButton.isVisible())) {
    logger.info('Attach File button not visible, skipping');
    return;
  } else {
    await attachFileButton.click();
    //await page.waitForTimeout(1000);
    const attachFileMenuButton = page.getByRole('menu', {
      name: 'Attach File',
    });
    await expect(attachFileMenuButton).toBeVisible();
    await attachFileMenuButton.click();
    await testExpectPricingModalOpening(page, true);
    logger.info('Admin feature Attach File tested successfully');
  }

  logger.info('Testing Add Prompt admin feature');
  const promptModalButton = page.getByRole('button', { name: 'Prompts' });
  if (!(await promptModalButton.isVisible())) {
    logger.info('Prompts button not visible, skipping');
    return;
  } else {
    await promptModalButton.click();
    const promptDialog = page.getByRole('dialog', { name: 'Prompt Gallery' });
    const closeButton = promptDialog.getByRole('button', { name: 'Close' });
    await expect(promptDialog).toBeVisible();
    const addPromptButton = promptDialog.getByRole('button', { name: 'Add' });
    await expect(addPromptButton).toBeVisible();
    await addPromptButton.click();
    await testExpectPricingModalOpening(page, true);
    await page.waitForTimeout(1000);
    await expect(closeButton).toBeVisible();
    await closeButton.click();
    await page.waitForTimeout(1000);
    await expect(promptDialog).not.toBeVisible();
    logger.info('Admin feature Prompts tested successfully');
  }

  logger.info('Testing mentor settings dropdown admin feature');

  const mentorSettingsDropdown = page.getByRole('button', {
    name: 'Selected mentor dropdown',
  });
  await expect(mentorSettingsDropdown).toBeVisible();
  if (!(await mentorSettingsDropdown.isVisible())) {
    logger.info('Mentor settings dropdown not visible, skipping');
    return;
  } else {
    await mentorSettingsDropdown.click();
    const mentorSettingsDropdownMenu = page.getByRole('menu', {
      name: 'Selected mentor dropdown',
    });
    await expect(mentorSettingsDropdownMenu).toBeVisible();
    //await mentorSettingsDropdownMenu.click();
    const mentorSettingsDropdownMenuItems =
      mentorSettingsDropdownMenu.getByRole('menuitem');
    //TESTING ALL MENU ITEMS EXCEPT THE FIRST ONE (i.e NEW CHAT)
    const mentorSettingsDropdownMenuItemsArray = (
      await mentorSettingsDropdownMenuItems.all()
    ).slice(1);
    //console.log({mentorSettingsDropdownMenuItemsArray});
    if (mentorSettingsDropdownMenuItemsArray.length > 0) {
      for (const item of mentorSettingsDropdownMenuItemsArray) {
        await expect(item).toBeVisible();
        logger.info(
          `Testing mentor settings dropdown admin feature: ${item.textContent()}`
        );
        await item.click();
        await testExpectPricingModalOpening(page, true);
        logger.info(
          `Test mentor settings dropdown admin feature: ${item.textContent()} successfully`
        );
      }
      //await testExpectPricingModalOpening(page, false);
      logger.info('Admin feature Mentor settings dropdown tested successfully');
    }
  }
});

test('PRE-FREE Plan : Exhaust Credit, chat & trigger payment modal', async ({
  page,
}) => {
  await authenticate(
    page,
    MENTOR_NEXTJS_HOST,
    userCredentials.email,
    userCredentials.password
  );

  await expect(page).toHaveURL(new RegExp(`.*platform/main/.*`));
  const dm_token = await page.evaluate(() => {
    return localStorage.getItem('dm_token');
  });
  if (!(await callCreditExhaustionEndpoint(page, dm_token))) {
    //logger.info('Credit exhaustion endpoint called successfully');
    throw new Error('Failed to call credit exhaustion endpoint');
  }
  await testChat(page);
  //await expect(page.getByText('Hello')).toBeVisible();
  await testExpectPricingModalOpening(page, true);
});

test('Upgrade PRE-FREE Plan --> FREE Plan', async ({ page }) => {
  await authenticate(
    page,
    MENTOR_NEXTJS_HOST,
    userCredentials.email,
    userCredentials.password
  );
  await expect(page).toHaveURL(new RegExp(`.*platform/main/.*`));
  await testChat(page);
  await testExpectPricingModalOpening(page, false);
  await chooseSubscriptionPlan(page, 'free');
  await fillStripePaymentForm(page, sampleBillingAddress);
  // in local environment, the stripe redirect to the mentor product url, so we need to update the redirect-to parameter to the MENTOR_NEXTJS_HOST
  if (MENTOR_NEXTJS_HOST.includes('localhost')) {
    const currentURL = page.url();
    const decomposedURL = new URL(currentURL);
    //update the redirect-to parameter to the MENTOR_NEXTJS_HOST
    decomposedURL.searchParams.set('redirect-to', MENTOR_NEXTJS_HOST);
    const newURL = decomposedURL.toString();
    logger.info(`New URL: ${newURL}`);
    await page.goto(newURL);
    await page.waitForLoadState('domcontentloaded');
  }
  await authenticate(
    page,
    MENTOR_NEXTJS_HOST,
    userCredentials.email,
    userCredentials.password,
    false
  );
  logger.info('Check if we are on a non-main platform');
  await expect(page).toHaveURL(new RegExp(`.*platform/(?!main/).*`));
  await testChat(page, true);
});

test('FREE Plan : Exhaust Credit, chat, trigger banner display & redirect to billing', async ({
  page,
}) => {
  await authenticate(
    page,
    MENTOR_NEXTJS_HOST,
    userCredentials.email,
    userCredentials.password
  );

  logger.info('Check if we are on a non-main platform');
  await expect(page).toHaveURL(new RegExp(`.*platform/(?!main/).*`));
  await exhaustCredit(page);
  await testChat(page);
  //await expect(page.getByText('Hello')).toBeVisible();
  //await testExpectPricingModalOpening(page, true);
  //await expectSubscriptionBannerDisplay(page, 'free');
  await testRedirectToBillingAndUpdatePlan(
    page,
    'starter',
    sampleBillingAddress
  );
});

test('STARTER Plan : Exhaust Credit, chat, trigger banner display & redirect to billing', async ({
  page,
}) => {
  await authenticate(
    page,
    MENTOR_NEXTJS_HOST,
    userCredentials.email,
    userCredentials.password
  );

  logger.info('Check if we are on a non-main platform');
  await expect(page).toHaveURL(new RegExp(`.*platform/(?!main/).*`));

  await testChat(page, true);

  await exhaustCredit(page);

  await testChat(page);

  await testRedirectToBillingAndUpdatePlan(page, 'pro', sampleBillingAddress);
});

test('PRO plan : Exhaust Credit, chat, trigger banner display & redirect to Add Credit page', async ({
  page,
}) => {
  await authenticate(
    page,
    MENTOR_NEXTJS_HOST,
    userCredentials.email,
    userCredentials.password
  );

  logger.info('Check if we are on a non-main platform');
  await expect(page).toHaveURL(new RegExp(`.*platform/(?!main/).*`));

  await testChat(page, true);

  await exhaustCredit(page);

  await testChat(page);

  await testRedirectToAddCreditPage(page, sampleBillingAddress);

  await testChat(page, true);
});

test('Paid Plan : Invite New Student', async ({ page }) => {
  await authenticate(
    page,
    MENTOR_NEXTJS_HOST,
    userCredentials.email,
    userCredentials.password
  );
  logger.info('Check if we are on a non-main platform');
  await expect(page).toHaveURL(new RegExp(`.*platform/(?!main/).*`));
  await testChat(page, true);
  await inviteNewStudent(page, inviteEmail);
});

test('Student Mode : Test all features with Student', async ({ page }) => {
  await signupUser(
    page,
    { email: inviteEmail, username: inviteUsername, password: invitePassword },
    false
  );
  await expect(page).toHaveURL(new RegExp(`.*platform/(?!main/).*`));
  logger.info(
    'Checking if sidebar admin features are not visible on Student mode'
  );
  for (const feature of sidebarAdminFeatures) {
    await expect(page.getByRole('button', { name: feature })).not.toBeVisible();
    logger.info(`Admin feature ${feature} not visible`);
  }
  await testChat(page, true);
  await exhaustCredit(page);
  await testChat(page);
  await testChat(page, true);
});

test('Paid plan: Exhaust Tenant Credit', async ({ page }) => {
  await authenticate(
    page,
    MENTOR_NEXTJS_HOST,
    userCredentials.email,
    userCredentials.password
  );
  await exhaustCredit(page);
});

test('Student Mode / Credit Exhausted : Redirect to tenant mailto link', async ({
  page,
}) => {
  await authenticate(page, MENTOR_NEXTJS_HOST, inviteEmail, invitePassword);
  await testChat(page);
  await page.waitForTimeout(2000);
  await expectSubscriptionBannerDisplay(page, 'student');
  const bannerActionButton = await expectSubscriptionBannerDisplay(
    page,
    'student'
  );
  await bannerActionButton.click();
});
