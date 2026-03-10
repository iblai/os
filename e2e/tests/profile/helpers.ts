import { Page, Locator, expect } from '@playwright/test';
import { MENTOR_NEXTJS_HOST, AUTH_HOST } from '../utils';
import { getMentorIdFromUrl } from '../helpers';
import { safeWaitForURL } from '@iblai/iblai-js/playwright';
import { reAuthenticate } from '../utils';

/**
 * Navigate to the mentor app and wait for page to load.
 * Automatically handles re-authentication if tokens have expired
 * (detected by the app redirecting to the auth page).
 */
export async function navigateToMentorApp(
  page: Page,
  url?: string,
  locator?: Locator
): Promise<void> {
  const mentorAppUrl = url || MENTOR_NEXTJS_HOST;
  const startingUrl = url || MENTOR_NEXTJS_HOST + '/platform';
  const authHost = AUTH_HOST;

  const appLocator =
    locator || page.getByRole('heading', { name: 'Explore Mentors' });

  const conversationStartersHeading = page.getByRole('heading', {
    name: 'Conversation Starters',
  });

  await page.goto(mentorAppUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 120_000, // Allow slow CI machines enough time to load
  });

  // Wait for either the platform URL (tokens valid) or auth redirect (tokens expired).
  // Without this, an expired token causes a 120s timeout waiting for /platform.
  await safeWaitForURL(
    page,
    (url) =>
      url.href.startsWith(startingUrl) ||
      (!!authHost && url.href.includes(authHost)),
    { timeout: 120000 }
  );

  // If the app redirected us to the auth page, tokens have expired.
  // Re-authenticate inline and wait for the final platform redirect.
  if (authHost && page.url().includes(authHost)) {
    await reAuthenticate(page, startingUrl);
  }

  // Ensure we are on the platform URL
  if (!page.url().startsWith(startingUrl)) {
    await safeWaitForURL(page, (url) => url.href.startsWith(startingUrl), {
      timeout: 120000,
    });
  }

  // If the caller provided a locator, they know exactly
  // what UI state they expect. This becomes the single
  // source of truth for readiness.
  if (locator) {
    await expect(locator).toBeVisible({ timeout: 120_000 });
    return;
  }

  // ---- Fallback readiness detection ----
  // The app can validly land in one of several stable states.

  // State 1: User is not in a chat and sees the mentor list
  const exploreMentorsHeading = page.getByRole('heading', {
    name: 'Explore Mentors',
  });
  try {
    const sessionIdJson = await page.evaluate(() =>
      localStorage.getItem('session_id')
    );
    if (!sessionIdJson) {
      throw new Error('session_id not found in localStorage');
    }
    const parsed = JSON.parse(sessionIdJson);
    if (!parsed) {
      throw new Error('session_id is not a valid JSON object');
    }
    const mentorId = getMentorIdFromUrl(page.url());
    if (!mentorId || typeof mentorId !== 'string') {
      throw new Error('Failed to get valid mentor id from URL');
    }
    const currentMentor = parsed[mentorId as keyof typeof parsed];

    if (!currentMentor) {
      throw new Error('Current mentor not found');
    } else {
      //Expect the explore mentors heading to not be visible
      await expect(exploreMentorsHeading).not.toBeVisible({ timeout: 5000 });
      //WE ARE IN A CHAT SESSION SCENARIO
      const userMessage = page.locator('.chat-user-message-query', {
        hasText: /.+/,
      });
      const mentorResponse = page.locator('.chat-ai-message-response', {
        hasText: /.+/,
      });
      //one of the two should be visible
      await expect(mentorResponse.or(userMessage).first()).toBeVisible({
        timeout: 120_000,
      });
    }
  } catch (error) {
    await expect(exploreMentorsHeading).toBeVisible({ timeout: 120_000 });

    const userLoginState = await page.evaluate(() =>
      localStorage.getItem('userData')
    );

    if (!userLoginState) {
      await expect(conversationStartersHeading).not.toBeVisible();
    } else {
      await expect(conversationStartersHeading).toBeVisible({
        timeout: 120_000,
      });
    }
  }
}

/**
 * Open the user profile dropdown menu
 */
export async function openProfileDropdown(page: Page): Promise<Locator> {
  const profileButton = page.getByRole('button', { name: 'More options' });
  await expect(profileButton).toBeVisible({ timeout: 15000 });
  await profileButton.click();

  const profileMenu = page.getByRole('menu', { name: 'More options' });
  await expect(profileMenu).toBeVisible({ timeout: 5000 });

  return profileMenu;
}

/**
 * Open the user profile modal
 */
export async function openProfileModal(page: Page): Promise<Locator> {
  await openProfileDropdown(page);

  const profileMenuItem = page.getByRole('menuitem', { name: 'Profile' });
  await expect(profileMenuItem).toBeVisible();
  await profileMenuItem.click();

  const profileModal = page.getByRole('dialog', {
    name: 'User Profile',
  });
  await expect(profileModal).toBeVisible({ timeout: 15000 });

  return profileModal;
}

/**
 * Close the user profile modal using the close button
 */
export async function closeProfileModal(page: Page): Promise<void> {
  const closeButton = page.getByRole('button', { name: 'Close' });
  await expect(closeButton).toBeVisible();
  await closeButton.click();

  const profileModal = page.getByRole('dialog', {
    name: 'User Profile',
  });
  await expect(profileModal).not.toBeVisible({ timeout: 5000 });
}

/**
 * Switch to a specific tab in the profile modal
 */
export async function switchToProfileTab(
  page: Page,
  tabName:
    | 'Basic'
    | 'Social'
    | 'Education'
    | 'Experience'
    | 'Resume'
    | 'Security'
): Promise<void> {
  const tabButton = page.getByRole('tab', { name: tabName, exact: true });
  await expect(tabButton).toBeVisible({ timeout: 10000 });
  await tabButton.click();
  //await page.waitForTimeout(500); // Wait for tab transition
}

/**
 * Get the currently active tab in the profile modal
 */
export async function getActiveTab(page: Page): Promise<string> {
  // Use aria-selected attribute for semantic tab selection instead of CSS class
  const activeTab = page.getByRole('tab', { selected: true });
  const tabName = await activeTab.textContent();
  return tabName?.trim() || '';
}

/**
 * Verify that the basic tab fields are visible
 */
export async function verifyBasicTabFields(page: Page): Promise<void> {
  await expect(page.getByRole('textbox', { name: 'Full Name' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Title' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'About' })).toBeVisible();
  await expect(
    page.getByRole('combobox', { name: 'Select a language' })
  ).toBeVisible();
}

/**
 * Verify that the social tab fields are visible
 */
export async function verifySocialTabFields(page: Page): Promise<void> {
  await expect(page.getByRole('textbox', { name: 'Facebook' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'LinkedIn' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'X' })).toBeVisible();
}

/**
 * Fill in the basic tab form with test data
 */
export async function fillBasicTabForm(
  page: Page,
  data: {
    title?: string;
    about?: string;
  }
): Promise<void> {
  if (data.title) {
    const titleField = page.getByRole('textbox', { name: 'Title' });
    await titleField.clear();
    await titleField.fill(data.title);
  }

  if (data.about) {
    const aboutField = page.getByRole('textbox', { name: 'About' });
    await aboutField.clear();
    await aboutField.fill(data.about);
  }
}

/**
 * Fill in the social tab form with test data
 */
export async function fillSocialTabForm(
  page: Page,
  data: {
    facebook?: string;
    linkedin?: string;
    twitter?: string;
  }
): Promise<void> {
  if (data.facebook) {
    const facebookField = page.getByRole('textbox', { name: 'Facebook' });
    await facebookField.clear();
    await facebookField.fill(data.facebook);
  }

  if (data.linkedin) {
    const linkedinField = page.getByRole('textbox', { name: 'LinkedIn' });
    await linkedinField.clear();
    await linkedinField.fill(data.linkedin);
  }

  if (data.twitter) {
    const twitterField = page.getByRole('textbox', { name: 'X' });
    await twitterField.clear();
    await twitterField.fill(data.twitter);
  }
}

/**
 * Click the Save Changes button and wait for success
 */
export async function saveProfileChanges(page: Page): Promise<void> {
  const saveButton = page.getByRole('button', { name: 'Save Changes' });
  await expect(saveButton).toBeVisible();
  await expect(saveButton).toBeEnabled();
  await saveButton.click();

  // Wait for the save to complete (button might show "Saving...")
  await page.waitForTimeout(2000);
  // Wait for save button to re-enable (indicates save is complete)
  await expect(saveButton).toBeEnabled({ timeout: 10000 });
}

/**
 * Click the Cancel button
 */
export async function cancelProfileChanges(page: Page): Promise<void> {
  const cancelButton = page.getByRole('button', { name: 'Cancel' });
  await expect(cancelButton).toBeVisible();
  await cancelButton.click();
}

/**
 * Open the Add Education dialog
 */
export async function openAddEducationDialog(page: Page): Promise<Locator> {
  const addEducationButton = page
    .getByRole('button', { name: 'Add education' })
    .first();
  await expect(addEducationButton).toBeVisible({ timeout: 10000 });
  await addEducationButton.click();

  const dialog = page.getByRole('dialog').filter({ hasText: 'Add education' });
  await expect(dialog).toBeVisible({ timeout: 5000 });

  return dialog;
}

/**
 * Fill in the education form with test data
 * Note: Grade should be a numeric value (e.g., 3.8), not text like "3.8 GPA"
 */
export async function fillEducationForm(
  page: Page,
  data: {
    degree?: string;
    fieldOfStudy?: string;
    institution?: string;
    startMonth?: string;
    startYear?: string;
    endMonth?: string;
    endYear?: string;
    grade?: string; // Numeric value only (e.g., "3.8")
    currentlyStudying?: boolean;
  }
): Promise<void> {
  const dialog = page.getByRole('dialog').filter({ hasText: 'Add education' });

  if (data.degree) {
    const degreeField = dialog.getByRole('textbox', { name: 'Degree' });
    await degreeField.clear();
    await degreeField.fill(data.degree);
  }

  if (data.fieldOfStudy) {
    const fieldOfStudyCombobox = dialog.getByRole('combobox', {
      name: 'Field of study',
    });
    await fieldOfStudyCombobox.click();
    await page.getByRole('option', { name: data.fieldOfStudy }).click();
  }

  if (data.institution) {
    const institutionCombobox = dialog.getByRole('combobox', {
      name: 'Institution',
    });
    await institutionCombobox.click();
    await page.getByRole('option', { name: data.institution }).click();
  }

  if (data.startMonth) {
    const startMonthCombobox = dialog.getByRole('combobox', {
      name: 'Start month',
    });
    await startMonthCombobox.click();
    await page.getByRole('option', { name: data.startMonth }).click();
  }

  if (data.startYear) {
    const startYearCombobox = dialog.getByRole('combobox', {
      name: 'Start year',
    });
    await startYearCombobox.click();
    await page.getByRole('option', { name: data.startYear }).click();
  }

  if (data.currentlyStudying) {
    const currentlyStudyingSwitch = dialog.getByRole('switch');
    await currentlyStudyingSwitch.click();
  }

  if (data.endMonth && !data.currentlyStudying) {
    const endMonthCombobox = dialog.getByRole('combobox', {
      name: 'End month',
    });
    await endMonthCombobox.click();
    await page.getByRole('option', { name: data.endMonth }).click();
  }

  if (data.endYear && !data.currentlyStudying) {
    const endYearCombobox = dialog.getByRole('combobox', { name: 'End year' });
    await endYearCombobox.click();
    await page.getByRole('option', { name: data.endYear }).click();
  }

  if (data.grade) {
    // Grade field is a spinbutton (number input) that only accepts numeric values
    const gradeField = dialog.getByRole('spinbutton', { name: 'Grade' });
    await gradeField.clear();
    await gradeField.fill(data.grade);
  }
}

/**
 * Open the Add Experience dialog
 */
export async function openAddExperienceDialog(page: Page): Promise<Locator> {
  const addExperienceButton = page
    .getByRole('button', { name: 'Add experience' })
    .first();
  await expect(addExperienceButton).toBeVisible({ timeout: 10000 });
  await addExperienceButton.click();

  const dialog = page.getByRole('dialog').filter({ hasText: 'Add experience' });
  await expect(dialog).toBeVisible({ timeout: 5000 });

  return dialog;
}

/**
 * Experience form data interface
 */
interface ExperienceFormData {
  title?: string;
  location?: string;
  startMonth?: string;
  startYear?: string;
  currentlyWorkHere?: boolean;
}

/**
 * Fill the experience form with provided data
 * Note: Company and Employment type selection are complex comboboxes
 * that may require selecting existing options or creating new ones
 */
export async function fillExperienceForm(
  page: Page,
  dialog: Locator,
  data: ExperienceFormData
): Promise<void> {
  if (data.title) {
    const titleField = dialog.getByRole('textbox', { name: 'Title' });
    await titleField.clear();
    await titleField.fill(data.title);
  }

  if (data.location) {
    const locationField = dialog.getByRole('textbox', { name: 'Location' });
    await locationField.clear();
    await locationField.fill(data.location);
  }

  if (data.startMonth) {
    // Start month combobox - use aria-label for semantic selection
    const startMonthCombobox = dialog.getByRole('combobox', {
      name: 'Start month',
    });
    await startMonthCombobox.click();
    await page.getByRole('option', { name: data.startMonth }).click();
  }

  if (data.startYear) {
    // Start year combobox - use aria-label for semantic selection
    const startYearCombobox = dialog.getByRole('combobox', {
      name: 'Start year',
    });
    await startYearCombobox.click();
    await page.getByRole('option', { name: data.startYear }).click();
  }

  if (data.currentlyWorkHere !== undefined) {
    const currentSwitch = dialog.getByRole('switch');
    const isChecked = await currentSwitch.isChecked();
    if (isChecked !== data.currentlyWorkHere) {
      await currentSwitch.click();
    }
  }
}

/**
 * Verify that the education empty state is displayed
 */
export async function verifyEducationEmptyState(page: Page): Promise<void> {
  await expect(
    page.getByRole('heading', { name: 'No education added yet' })
  ).toBeVisible();
  await expect(
    page.getByText('Add your degrees, schools, and major achievements.')
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Add education' })
  ).toBeVisible();
}

/**
 * Verify that the experience empty state is displayed
 */
export async function verifyExperienceEmptyState(page: Page): Promise<void> {
  await expect(
    page.getByRole('heading', { name: 'No experience added yet' })
  ).toBeVisible();
  await expect(
    page.getByText('Add your roles, responsibilities, and achievements.')
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Add experience' })
  ).toBeVisible();
}

/**
 * Verify that the resume empty state is displayed
 */
export async function verifyResumeEmptyState(page: Page): Promise<void> {
  await expect(
    page.getByRole('heading', { name: 'No resume added yet' })
  ).toBeVisible();
  await expect(
    page.getByText(
      'Upload your resume to share with mentors and administrators.'
    )
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Upload resume' })
  ).toBeVisible();
}

/**
 * Verify that the security tab content is displayed
 */
export async function verifySecurityTabContent(page: Page): Promise<void> {
  await expect(
    page.getByRole('heading', { name: 'Security Settings' })
  ).toBeVisible();
  await expect(page.getByText('Click to reset your password.')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Send Password Reset Link' })
  ).toBeVisible();
}

/**
 * Verify profile modal header displays username
 */
export async function verifyProfileHeader(
  page: Page,
  expectedUsername: string
): Promise<void> {
  const usernameHeading = page.getByRole('heading', {
    name: expectedUsername,
    level: 2,
  });
  await expect(usernameHeading).toBeVisible({ timeout: 10000 });
}

/**
 * Verify all profile tabs are present
 */
export async function verifyAllProfileTabsPresent(page: Page): Promise<void> {
  const tabs = [
    'Basic',
    'Social',
    'Education',
    'Experience',
    'Resume',
    'Security',
  ];
  for (const tab of tabs) {
    await expect(page.getByRole('tab', { name: tab })).toBeVisible({
      timeout: 5000,
    });
  }
}

// this function is useful if we are not navigating to mentor app first e.g after login we expect the page to be fully loaded this extracted code works fine
export async function waitForMentorAppReady(page: Page): Promise<void> {
  const exploreMentorsHeading = page.getByRole('heading', {
    name: 'Explore Mentors',
  });
  try {
    const sessionIdJson = await page.evaluate(() =>
      localStorage.getItem('session_id')
    );
    if (!sessionIdJson) {
      throw new Error('session_id not found in localStorage');
    }
    const parsed = JSON.parse(sessionIdJson);
    if (!parsed) {
      throw new Error('session_id is not a valid JSON object');
    }
    const mentorId = getMentorIdFromUrl(page.url());
    if (!mentorId || typeof mentorId !== 'string') {
      throw new Error('Failed to get valid mentor id from URL');
    }
    const currentMentor = parsed[mentorId as keyof typeof parsed];

    if (!currentMentor) {
      throw new Error('Current mentor not found');
    } else {
      //Expect the explore mentors heading to not be visible
      await expect(exploreMentorsHeading).not.toBeVisible({ timeout: 5000 });
      //WE ARE IN A CHAT SESSION SCENARIO
      const userMessage = page.locator('.chat-user-message-query', {
        hasText: /.+/,
      });
      const mentorResponse = page.locator('.chat-ai-message-response', {
        hasText: /.+/,
      });
      //one of the two should be visible
      await expect(mentorResponse.or(userMessage).first()).toBeVisible({
        timeout: 120_000,
      });
    }
  } catch (error) {
    await expect(exploreMentorsHeading).toBeVisible({ timeout: 120_000 });
  }
}
