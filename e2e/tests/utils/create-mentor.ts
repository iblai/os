import { expect, Page } from '@playwright/test';
import { safeWaitForURL } from '@iblai/iblai-js/playwright';

type CreateMentorFormValues = {
  mentorName: string;
  mentorDescription: string;
  mentorCategory: string;
  mentorVisibility: 'Students' | 'Administrators' | 'Anyone';
};

type FillCreateMentorForm = {
  page: Page;
  formValues?: CreateMentorFormValues;
  buttonName?: string; //
};

function generateCreateMentorFormValues(): CreateMentorFormValues {
  const mentorName = `Test Mentor ${Date.now()}`;
  const mentorDescription = `${mentorName} description`;
  const mentorCategory = 'Advising';
  const mentorVisibility: CreateMentorFormValues['mentorVisibility'] =
    'Students';
  return { mentorName, mentorDescription, mentorCategory, mentorVisibility };
}

export async function fillCreateMentorForm({
  page,
  formValues = generateCreateMentorFormValues(),
  buttonName = 'New Mentor', // ✅ default value
}: FillCreateMentorForm) {
  // Merge defaults with overrides (overrides take precedence)
  const mergedValues: CreateMentorFormValues = {
    ...generateCreateMentorFormValues(),
    ...formValues,
  };

  const createMentorButton = page.getByRole('button', {
    name: buttonName,
  });
  await expect(createMentorButton).toBeVisible({ timeout: 30_000 });
  await createMentorButton.scrollIntoViewIfNeeded();
  await createMentorButton.click({ force: true });

  const createMentorDialogTitle = page.getByRole('heading', {
    name: 'Create Mentor',
  });
  await expect(createMentorDialogTitle).toBeVisible({ timeout: 30_000 });

  const mentorNameInput = page.getByRole('textbox', {
    name: 'Mentor Name',
  });

  await expect(mentorNameInput).toBeEnabled({ timeout: 10_000 });
  await mentorNameInput.fill(mergedValues.mentorName);

  const mentorDescriptionInput = page.getByRole('textbox', {
    name: 'Mentor Description',
  });

  await expect(mentorDescriptionInput).toBeEnabled({ timeout: 10_000 });
  await mentorDescriptionInput.fill(mergedValues.mentorDescription);

  const mentorCategoryDropdown = page.getByRole('combobox', {
    name: 'Select category',
  });
  await mentorCategoryDropdown.click();

  const mentorCategoryOption = page.getByRole('option', {
    name: mergedValues.mentorCategory,
  });
  await expect(mentorCategoryDropdown).toBeVisible({ timeout: 10_000 });
  await mentorCategoryOption.click({ force: true });

  // close dropdown
  await page.keyboard.press('Escape');

  // open the visibility combobox (avoid hard-coded visible value)

  const mentorVisibilitySelector = page.getByRole('combobox', {
    name: 'Select mentor visibility',
  });
  await mentorVisibilitySelector.click();

  const mentorVisibilityOption = page.getByRole('option', {
    name: mergedValues.mentorVisibility,
  });
  await expect(mentorVisibilityOption).toBeVisible({ timeout: 10_000 });
  await mentorVisibilityOption.click();

  const mentorNextButton = page.getByRole('button', { name: 'Next' });
  await mentorNextButton.click();

  const saveMentorButton = page.getByRole('button', { name: 'Save' });
  await saveMentorButton.click();

  // wait for switching-mentor=true to be on the current url
  await safeWaitForURL(
    page,
    (url) => url.searchParams.get('switching-mentor') === 'true',
    { timeout: 60000 }
  );

  // wait for switching-mentor=true no longer on the current url
  await safeWaitForURL(
    page,
    (url) => !url.searchParams.get('switching-mentor'),
    { timeout: 30000 }
  );

  await page
    .locator('h1')
    .filter({ hasText: new RegExp(`^${mergedValues.mentorName}$`) })
    .waitFor();

  await expect(
    page
      .locator('h1')
      .filter({ hasText: new RegExp(`^${mergedValues.mentorName}$`) })
  ).toBeVisible({ timeout: 30_000 });

  const exploreMentorsButton = page.getByRole('heading', {
    name: 'Explore Mentors',
  });
  await expect(exploreMentorsButton).toBeVisible({ timeout: 30_000 });

  return {
    mentorName: mergedValues.mentorName,
    mentorDescription: mergedValues.mentorDescription,
    mentorCategory: mergedValues.mentorCategory,
    mentorVisibility: mergedValues.mentorVisibility,
  };
}
