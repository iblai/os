/**
 * Helpers for default mentor feature tests
 * Following resilient Playwright test patterns from TESTING_GUIDELINES.md
 */

import { Page, Locator, expect } from "@playwright/test";
import { logger } from "@iblai/iblai-js/playwright";

/**
 * Navigate to tenant account settings and open the Management tab
 */
export async function navigateToTenantSettings(page: Page): Promise<Locator> {
  // Open profile dropdown menu
  const profileBtn = page.getByRole("button", { name: "More options" });
  await expect(profileBtn).toBeVisible({ timeout: 15000 });
  await profileBtn.click();

  // Wait for menu to open
  const menu = page.getByRole("menu", { name: "More options" });
  await expect(menu).toBeVisible({ timeout: 5000 });

  // Get platform name from localStorage
  const platformName = await page.evaluate(() => {
    const currentTenant = localStorage.getItem("current_tenant");
    if (currentTenant) {
      try {
        const tenant = JSON.parse(currentTenant);
        return tenant?.platform_name;
      } catch {
        return null;
      }
    }
    return null;
  });

  if (!platformName) {
    throw new Error("Could not retrieve platform_name from localStorage");
  }

  // Click on the tenant/org menu item to open account settings
  const tenantMenuItem = menu.getByText(platformName, { exact: true });
  await expect(tenantMenuItem).toBeVisible({ timeout: 5000 });
  await tenantMenuItem.click();

  // Wait for the account settings dialog
  const accountDialog = page.getByRole("dialog", {
    name: "User Profile",
  });
  await expect(accountDialog).toBeVisible({ timeout: 10000 });

  logger.info(`Navigated to tenant settings for: ${platformName}`);
  return accountDialog;
}

/**
 * Navigate to the Advanced tab in tenant settings
 */
export async function navigateToAdvancedTab(
  _page: Page,
  dialog: Locator,
): Promise<void> {
  const advancedTab = dialog.getByRole("button", { name: "Advanced" });
  await expect(advancedTab).toBeVisible({ timeout: 5000 });
  await advancedTab.click();

  // Wait for Advanced settings content to load
  await expect(dialog.getByText("Default Mentor")).toBeVisible({
    timeout: 10000,
  });

  logger.info("Navigated to Advanced tab");
}

/**
 * Navigate to the Management tab in tenant settings
 */
export async function navigateToManagementTab(
  _page: Page,
  dialog: Locator,
): Promise<void> {
  const managementTab = dialog.getByRole("button", { name: "Management" });
  await expect(managementTab).toBeVisible({ timeout: 5000 });
  await managementTab.click();

  // Wait for Management tab content to load
  await expect(dialog.getByRole("button", { name: "Invite" })).toBeVisible({
    timeout: 10000,
  });

  logger.info("Navigated to Management tab");
}

/**
 * Select a mentor from the default mentor dropdown
 * Returns the selected mentor's name
 */
export async function selectDefaultMentor(
  page: Page,
  dialog: Locator,
): Promise<string> {
  // Find the Default Mentor section and its combobox
  const defaultMentorCombobox = dialog.getByRole("combobox").first();
  const mentorName = await defaultMentorCombobox.textContent();
  await expect(defaultMentorCombobox).not.toHaveText("Select mentor", {
    timeout: 10000,
  });
  const isMentorNotYetSelected = mentorName === "None";
  if (!isMentorNotYetSelected) {
    logger.info(`Mentor already selected: ${mentorName}`);
    return mentorName?.trim() || "";
  }

  await expect(defaultMentorCombobox).toBeVisible({ timeout: 10000 });

  // Click to open the dropdown
  await defaultMentorCombobox.click();

  // Wait for options to appear
  const optionsList = page.getByRole("listbox");
  await expect(optionsList).toBeVisible({ timeout: 5000 });

  await expect(page.getByLabel("Loading mentors...")).not.toBeVisible({
    timeout: 10000,
  });

  // Get all options and select a random one (excluding "None" if present)
  const options = optionsList.getByRole("option");

  const optionCount = await options.count();

  if (optionCount === 0) {
    throw new Error("No mentor options available in dropdown");
  }

  // Find an option that is not "None" or "Select a mentor"
  let selectedMentorName = "";
  for (let i = 0; i < optionCount; i++) {
    const option = options.nth(i);
    const optionText = (await option.textContent()) || "";
    if (
      !optionText.toLowerCase().includes("none") &&
      !optionText.toLowerCase().includes("select")
    ) {
      selectedMentorName = optionText.trim();
      console.log("selectedMentorName Level 0: ", selectedMentorName);
      await option.click();
      break;
    }
  }

  await expect(page.getByLabel("Updating mentor selection...")).not.toBeVisible(
    { timeout: 10000 },
  );

  if (!selectedMentorName) {
    // If all options are "None" or "Select", just pick the first one
    const firstOption = options.first();
    selectedMentorName = ((await firstOption.textContent()) || "").trim();
    console.log("selectedMentorName Level 1:", selectedMentorName);
    await firstOption.click();
  }

  // Wait for the selection to be applied
  await expect(optionsList).not.toBeVisible({ timeout: 5000 });
  console.log("selectedMentorName Level 2:", selectedMentorName);

  logger.info(`Selected default mentor: ${selectedMentorName}`);
  return selectedMentorName;
}

/**
 * Save the default mentor setting
 */
export async function saveDefaultMentorSetting(
  _page: Page,
  dialog: Locator,
): Promise<void> {
  const saveButton = dialog.getByRole("button", {
    name: "Save default mentor",
  });
  await expect(saveButton).toBeVisible({ timeout: 5000 });
  await expect(saveButton).toBeEnabled({ timeout: 5000 });
  await saveButton.click();

  // Wait for save to complete (button becomes disabled)
  await expect(saveButton).toBeDisabled({ timeout: 15000 });

  logger.info("Default mentor setting saved");
}

/**
 * Open the Invite Users modal from the Management tab
 */
export async function openInviteUsersModal(
  page: Page,
  dialog: Locator,
): Promise<Locator> {
  const inviteButton = dialog.getByRole("button", { name: "Invite" });
  await expect(inviteButton).toBeVisible({ timeout: 10000 });
  await inviteButton.click();

  // Wait for the Invite Users modal to appear
  const inviteModal = page.getByRole("dialog", { name: "Invite Users" });
  await expect(inviteModal).toBeVisible({ timeout: 10000 });

  logger.info("Opened Invite Users modal");
  return inviteModal;
}

/**
 * Invite a user by email
 */
export async function inviteUserByEmail(
  _page: Page,
  inviteModal: Locator,
  email: string,
): Promise<void> {
  const emailInput = inviteModal.getByRole("textbox", {
    name: "Enter email to invite...",
  });
  await expect(emailInput).toBeVisible({ timeout: 5000 });
  await emailInput.fill(email);

  const sendInviteButton = inviteModal.getByRole("button", {
    name: "Send Invite",
  });
  await expect(sendInviteButton).toBeVisible();
  await expect(sendInviteButton).toBeEnabled({ timeout: 5000 });
  await sendInviteButton.click();

  // Wait for invite to be sent (button becomes disabled during processing)
  await expect(sendInviteButton).not.toBeEnabled({ timeout: 15000 });

  logger.info(`Invited user: ${email}`);
}

/**
 * Close a dialog using the Close button
 */
export async function closeDialog(_page: Page, dialog: Locator): Promise<void> {
  const closeButton = dialog.getByRole("button", { name: "Close" });
  await expect(closeButton).toBeVisible({ timeout: 5000 });
  await closeButton.click();
  await expect(dialog).not.toBeVisible({ timeout: 5000 });
  logger.info("Dialog closed");
}

/**
 * Logout from the mentor app
 */
export async function logout(page: Page, authHost: string): Promise<void> {
  // Open profile dropdown menu
  const profileBtn = page.getByRole("button", { name: "More options" });
  await expect(profileBtn).toBeVisible({ timeout: 15000 });
  await profileBtn.click();

  // Wait for menu to open
  const menu = page.getByRole("menu", { name: "More options" });
  await expect(menu).toBeVisible({ timeout: 5000 });

  // Click logout
  const logoutMenuItem = menu.getByRole("menuitem", { name: /log out/i });
  await expect(logoutMenuItem).toBeVisible({ timeout: 5000 });
  await logoutMenuItem.click();

  // Wait to be redirected to auth page
  await page.waitForURL((url) => url.href.includes(authHost), {
    timeout: 30000,
  });

  logger.info("Successfully logged out");
}

/**
 * Navigate to signup page from auth login page
 */
export async function navigateToSignupPage(
  page: Page,
  _authHost: string,
): Promise<void> {
  // Click on Sign Up button
  const signUpButton = page.getByRole("button", { name: "Sign Up" });
  await expect(signUpButton).toBeVisible({ timeout: 10000 });
  await signUpButton.click();

  // Wait for signup page
  await page.waitForURL((url) => url.href.includes("/account/create"), {
    timeout: 15000,
  });

  logger.info("Navigated to signup page");
}

/**
 * Sign up with email and password
 */
export async function signUpWithCredentials(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  // Click Continue with Password
  const continueWithPasswordButton = page.getByRole("button", {
    name: /continue with password/i,
  });
  await expect(continueWithPasswordButton).toBeVisible({ timeout: 10000 });
  await continueWithPasswordButton.click();

  // Fill email
  const emailInput = page.getByPlaceholder("Email");
  await expect(emailInput).toBeVisible({ timeout: 5000 });
  await emailInput.fill(email);

  // Fill password
  const passwordInput = page.getByPlaceholder("Password", { exact: true });
  await expect(passwordInput).toBeVisible({ timeout: 5000 });
  await passwordInput.fill(password);

  // Fill confirm password
  const confirmPasswordInput = page.getByPlaceholder("Confirm Password");
  await expect(confirmPasswordInput).toBeVisible({ timeout: 5000 });
  await confirmPasswordInput.fill(password);

  // Click Create Account
  const createAccountButton = page.getByRole("button", {
    name: "Create Account",
  });
  await expect(createAccountButton).toBeVisible({ timeout: 5000 });
  await createAccountButton.click();

  logger.info(`Signed up with email: ${email}`);
}

/**
 * Get the current mentor name displayed on the page
 */
export async function getCurrentMentorNameFromPage(
  page: Page,
): Promise<string> {
  // The mentor name is typically displayed in an h1 heading
  const mentorHeading = page.locator("h1").first();
  await expect(mentorHeading).toBeVisible({ timeout: 15000 });

  const mentorName = await mentorHeading.textContent();
  return (mentorName || "").trim();
}

/**
 * Generate a unique test email with timestamp
 */
export function generateTestEmail(): string {
  const timestamp = Date.now();
  return `test+user+${timestamp}@test.com`;
}

/**
 * Extract platform key and mentor ID from the current URL
 */
export function extractUrlParts(
  url: string,
): { platformKey: string; mentorId: string } | null {
  try {
    const currentUrl = new URL(url);
    const pathParts = currentUrl.pathname.split("/").filter(Boolean);
    if (pathParts.length >= 3 && pathParts[0] === "platform") {
      return {
        platformKey: pathParts[1],
        mentorId: pathParts[2],
      };
    }
    return null;
  } catch {
    return null;
  }
}
