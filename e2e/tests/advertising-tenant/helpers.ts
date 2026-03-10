import { expect, Locator, Page } from '@playwright/test';
import { checkAdminStatus } from '../utils';
import { logger } from '@iblai/iblai-js/playwright';
import { safeWaitForURL } from '@iblai/iblai-js/playwright';

const password: string = process.env.PLAYWRIGHT_PASSWORD || '';
const username: string = process.env.PLAYWRIGHT_USERNAME || '';

export async function sendMessageAndVerifyResponse(
  page: Page,
  message: string
): Promise<void> {
  const textArea = page.getByPlaceholder('Ask anything', { exact: true });
  await expect(textArea).toBeVisible({ timeout: 10000 });

  // Wait for session_id to be initialized in localStorage to avoid UUID validation errors
  await page.waitForFunction(
    () => {
      const sessionIdJson = localStorage.getItem('session_id');
      if (!sessionIdJson) return false;
      try {
        const sessionIdMap = JSON.parse(sessionIdJson);
        // Check if any session ID exists and is not an empty string
        return Object.values(sessionIdMap).some(
          (id) => typeof id === 'string' && id.length > 0
        );
      } catch {
        return false;
      }
    },
    { timeout: 15000 }
  );

  await textArea.fill(message);

  const sendButton = page.getByRole('button', { name: /Send message/i });
  await expect(sendButton).toBeEnabled({ timeout: 5000 });
  // Wait for the reducers to be stable (to be improved)
  await page.waitForTimeout(5000);
  await sendButton.click();

  const userMessage = page.locator('.chat-user-message-query', {
    hasText: message,
  });
  await expect(userMessage).toBeVisible({ timeout: 10000 });

  const mentorResponse = page.locator('.chat-ai-message-response');
  await expect(mentorResponse).toBeVisible({ timeout: 30000 });
  const responseText = await mentorResponse.textContent();
  expect(responseText).toBeTruthy();
  expect(responseText?.trim().length).toBeGreaterThan(0);
}

export async function createNewAccount(page: Page): Promise<void> {
  const emailField = page.getByPlaceholder('Email');
  const passwordField = page.getByPlaceholder('Password', { exact: true });
  const confirmPasswordField = page.getByPlaceholder('Confirm Password');

  await expect(emailField).toBeVisible({ timeout: 10000 });
  await expect(passwordField).toBeVisible({ timeout: 10000 });
  await expect(confirmPasswordField).toBeVisible({ timeout: 10000 });

  const timestamp = Date.now();
  const randomEmail = `test+${timestamp}@ibleducation.com`;
  const testPassword = 'ibledu_2024';

  await emailField.fill(randomEmail);
  await passwordField.fill(testPassword);
  await confirmPasswordField.fill(testPassword);

  await clickButton(page, /Create account/i);
}

export async function navigateToSignUp(page: Page): Promise<void> {
  await clickButton(page, /Sign Up/i);

  await safeWaitForURL(page, (url) => url.href.includes('/account/create'), {
    timeout: 60000,
  });

  await expect(page.getByRole('button', { name: /Log in/i })).toBeVisible({
    timeout: 10000,
  });

  await clickButton(page, /Continue with password/i);
}

export async function verifyLoginPage(page: Page): Promise<void> {
  await expect(
    page.getByRole('heading', { name: /Create your own mentor/i })
  ).toBeVisible({ timeout: 10000 });

  await expect(page.getByRole('button', { name: /Sign Up/i })).toBeVisible({
    timeout: 10000,
  });
}

export async function performLogin(page: Page): Promise<void> {
  await safeWaitForURL(page, (url) => url.href.includes('/login'), {
    timeout: 60000,
  });

  await expect(
    page.getByRole('heading', { name: /Create your own mentor/i })
  ).toBeVisible({ timeout: 10000 });

  await expect(page.getByRole('button', { name: /Sign Up/i })).toBeVisible({
    timeout: 10000,
  });

  await clickButton(page, /Continue with password/i);

  const emailField = page.getByPlaceholder('Email');
  const passwordField = page.getByPlaceholder('Password', { exact: true });

  await expect(emailField).toBeVisible({ timeout: 10000 });
  await expect(passwordField).toBeVisible({ timeout: 10000 });

  await emailField.fill(username);
  await passwordField.fill(password);

  await clickButton(page, /Continue/i);

  await safeWaitForURL(
    page,
    (url) => /\/platform\/[^/]+\/[^/]+$/.test(url.href),
    {
      timeout: 60000,
    }
  );
}

export async function verifyAdminStatus(page: Page): Promise<void> {
  const isAdmin = await checkAdminStatus(page);
  expect(isAdmin).toBe(true);
}

export async function switchToAdvertisingTenant(page: Page): Promise<void> {
  await clickButton(page, /More options/i, { timeout: 20_000 });

  const menuItems = page.getByRole('menuitem');
  await expect(menuItems).toHaveCount(4, { timeout: 5000 });

  const selectTenantMenuItem = page.getByRole('combobox', {
    name: /Select a tenant/i,
  });
  await expect(selectTenantMenuItem).toBeVisible();
  await selectTenantMenuItem.click();

  const advertisingTenant = page.getByText('spa-tests-advertising');
  await expect(advertisingTenant).toBeVisible({ timeout: 10000 });
  await advertisingTenant.click();

  await safeWaitForURL(
    page,
    (url) => /\/platform\/[^/]+\/[^/]+$/.test(url.href),
    {
      timeout: 120000,
    }
  );

  logger.info('wait for page to be fully loaded');
  await expect(
    page.getByRole('heading', { name: 'Explore Mentors' })
  ).toBeVisible({ timeout: 60000 });

  const conversationStartersHeading = page.getByRole('heading', {
    name: 'Conversation Starters',
  });

  await expect(conversationStartersHeading).toBeVisible({ timeout: 60000 });

  expect(page.url()).toContain('spa-tests-advertising');
}

export async function enablePublicRegistration(page: Page): Promise<void> {
  await clickButton(page, /More options/i, { timeout: 30_000 });

  const advertisingTenantMenuItem = page.getByRole('menuitem', {
    name: 'spa-tests-advertising',
  });
  await expect(advertisingTenantMenuItem).toBeVisible({ timeout: 10000 });
  await advertisingTenantMenuItem.click();

  const organizationDialog = page
    .getByRole('dialog')
    .filter({ hasText: /organization/i });
  await expect(organizationDialog).toBeVisible({ timeout: 10000 });

  await clickButton(organizationDialog, 'Advanced');

  const publicRegistrationSwitch = organizationDialog.getByRole('switch', {
    name: /public registration/i,
  });
  await expect(publicRegistrationSwitch).toBeVisible({ timeout: 60_000 });

  const isEnabled = await publicRegistrationSwitch.getAttribute('aria-checked');
  if (isEnabled !== 'true') {
    await publicRegistrationSwitch.click();
    await expect(publicRegistrationSwitch).toHaveAttribute(
      'aria-checked',
      'true',
      { timeout: 5000 }
    );
  }

  await clickButton(organizationDialog, 'Close');
  await expect(organizationDialog).not.toBeVisible({ timeout: 5000 });
}

export async function configureMentorSettings(page: Page): Promise<void> {
  await clickButton(page, /Selected mentor dropdown/i, { timeout: 10000 });

  const settingsMenuItem = page.getByRole('menuitem', { name: 'Settings' });
  await expect(settingsMenuItem).toBeVisible({ timeout: 10000 });
  await settingsMenuItem.click();

  const editMentorDialog = page
    .getByRole('dialog')
    .filter({ hasText: /Edit mentor/i });
  await expect(editMentorDialog).toBeVisible({ timeout: 10000 });

  await selectComboboxOption(editMentorDialog, /who can view/i, 'Anyone');
  await selectComboboxOption(
    editMentorDialog,
    /who can chat/i,
    /authenticated user/i
  );

  await clickButton(editMentorDialog, 'Save');
  await page.waitForTimeout(2000);

  await clickButton(editMentorDialog, 'Close');
  await expect(editMentorDialog).not.toBeVisible({ timeout: 5000 });
}

export async function selectComboboxOption(
  container: Locator,
  comboboxName: string | RegExp,
  optionName: string | RegExp
): Promise<void> {
  const combobox = container.getByRole('combobox', { name: comboboxName });
  // Wait for combobox to be visible AND enabled (form data loaded from API)
  // Use 60s timeout to account for slow API responses
  await expect(combobox).toBeVisible({ timeout: 60_000 });
  await expect(combobox).toBeEnabled({ timeout: 60_000 });
  await combobox.click();

  const option = container.page().getByRole('option', { name: optionName });
  await expect(option).toBeVisible({ timeout: 10_000 });
  await option.click();
}

export async function switchTenant(
  page: Page,
  tenantPattern: string | RegExp
): Promise<void> {
  await clickButton(page, /More options/i, { timeout: 20_000 });

  const menuItems = page.getByRole('menuitem');
  await expect(menuItems).toHaveCount(4, { timeout: 5000 });

  const selectTenantMenuItem = page.getByRole('combobox', {
    name: /Select a tenant/i,
  });
  await expect(selectTenantMenuItem).toBeVisible();
  await selectTenantMenuItem.click();

  const switchTenantOption = page.getByText(tenantPattern);
  await expect(switchTenantOption).toBeVisible({ timeout: 10000 });
  await switchTenantOption.click();

  await safeWaitForURL(
    page,
    (url) => /\/platform\/[^/]+\/[^/]+$/.test(url.href),
    {
      timeout: 120000,
    }
  );

  logger.info('wait for page to be fully loaded');
  await expect(
    page.getByRole('heading', { name: 'Explore Mentors' })
  ).toBeVisible({ timeout: 60000 });

  const tenantText = await switchTenantOption.textContent();
  if (tenantText) {
    expect(page.url()).toContain(tenantText);
  }
}

export async function clickButton(
  pageOrContainer: Page | Locator,
  name: string | RegExp,
  options: { timeout?: number } = {}
): Promise<void> {
  const button = pageOrContainer.getByRole('button', { name });
  await expect(button).toBeVisible({ timeout: 10000, ...options });
  await button.click();
}

interface ButtonConfig {
  name: string | RegExp;
  exact?: boolean;
}

export async function verifyVisibleButtons(
  page: Page,
  buttons: ButtonConfig[]
): Promise<void> {
  for (const button of buttons) {
    const btn = page.getByRole('button', button);
    await expect(btn).toBeVisible(
      button.exact ? undefined : { timeout: 10000 }
    );
  }
}

export async function ensureSidebarOpen(page: Page): Promise<void> {
  const sidebarButton = page.getByRole('button', {
    name: /open sidebar|close sidebar/i,
  });
  const buttonText = await sidebarButton.textContent();
  if (buttonText && /open sidebar/i.test(buttonText)) {
    await sidebarButton.click();
    await expect(sidebarButton).toHaveText(/close sidebar/i, {
      timeout: 5000,
    });
  }
}

export async function verifyAdvancedFeaturesPromo(page: Page): Promise<void> {
  const newMentorButton = page.getByRole('button', { name: /New mentor/i });
  await newMentorButton.hover();
  await page.waitForTimeout(500);

  await expect(
    page.getByRole('heading', { name: /Try advanced features for free/i })
  ).toBeVisible({ timeout: 10000 });

  await expect(
    page.getByText(
      /Get better responses, create mentors with your data, and more by logging in/i
    )
  ).toBeVisible({ timeout: 10000 });

  await expect(
    page.getByRole('button', { name: /Log in/i }).nth(1)
  ).toBeVisible({
    timeout: 10000,
  });

  await expect(
    page.getByRole('button', { name: /Sign up for free/i }).nth(1)
  ).toBeVisible();
}
