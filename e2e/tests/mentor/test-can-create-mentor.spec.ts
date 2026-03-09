import { expect } from '@playwright/test';

import { MENTOR_HOST } from '../utils';
import { test } from '@iblai/iblai-js/playwright';
import { logger } from '@iblai/iblai-js/playwright';

test('user can create mentor a featured mentor', async ({ page }) => {
  logger.info('Navigating to mentor platform');
  await page.goto(MENTOR_HOST);

  logger.info("Wait to be redirected to the users's active mentor and tenant");
  await page.waitForURL((url) =>
    url.href.startsWith(`${MENTOR_HOST}/platform`)
  );

  const settingsIconLocator = page.locator(
    '.header-settings-dropdown > .header-action-btn'
  );

  logger.info('Check if the settings icon is visible');
  await expect(settingsIconLocator).toBeVisible();

  logger.info('Click on the settings icon');
  await settingsIconLocator.click();

  const mentorLoadingSpinnerLocator = page.getByTestId('tail-spin-svg');

  logger.info('Wait for the mentor loading spinner to be visible');
  await expect(mentorLoadingSpinnerLocator).toBeVisible();

  logger.info('Wait for the mentor loading spinner to be hidden');
  await mentorLoadingSpinnerLocator.waitFor({ state: 'hidden' });

  const createMentorButtonLocator = page.getByText('Create Mentor');

  logger.info('Check if the create mentor button is visible');
  await expect(createMentorButtonLocator).toBeVisible();

  logger.info('Click on the create mentor button');
  await createMentorButtonLocator.click();

  const createMentorNextButtonLocator = page.getByRole('link', {
    name: 'Next',
  });

  logger.info('Check if the create mentor next button is visible');
  await expect(createMentorNextButtonLocator).toBeVisible();

  const mentorNameInputLocator = page.getByPlaceholder('Mentor Name');

  logger.info('Check if the mentor name input is empty');
  expect(await mentorNameInputLocator.inputValue()).toBe('');

  logger.info('Fill the mentor name input with a value');
  await mentorNameInputLocator.fill(`Test Mentor ${new Date().getTime()}`);

  logger.info('Check if the mentor name input is not empty');
  expect(await mentorNameInputLocator.inputValue()).not.toBe('');

  const mentorDescriptionInputLocator =
    page.getByPlaceholder('Mentor Description');

  logger.info('Check if the mentor description input is empty');
  expect(await mentorDescriptionInputLocator.inputValue()).toBe('');

  logger.info('Fill the mentor description input with a value');
  await mentorDescriptionInputLocator.fill('Test Mentor Description');

  logger.info('Check if the mentor description input is not empty');
  expect(await mentorDescriptionInputLocator.inputValue()).not.toBe('');

  const mentorCategorySelectorLocator = page.locator('#field-11');

  logger.info('Check if the mentor category selector input is empty');
  expect(await mentorCategorySelectorLocator.inputValue()).toBe('');

  logger.info('Select mentor category');
  await mentorCategorySelectorLocator.selectOption({ label: 'Business' });

  logger.info('Check if the mentor category selector input is not empty');
  expect(await mentorCategorySelectorLocator.inputValue()).not.toBe('');

  const checkboxLocator = page.locator('input[name="featured"]');

  const mentorIsFeatured = await checkboxLocator.isChecked();

  logger.info('Check if the mentor is not featured');
  if (!mentorIsFeatured) {
    logger.info('Mentor is not featured, setting it to featured');
    const mentorFeaturedSwitchBtnLocator = page
      .locator('form')
      .filter({ hasText: 'Name*Description*Test Mentor' })
      .locator('span');

    await mentorFeaturedSwitchBtnLocator.click();
  } else {
    logger.info('Mentor is already featured');
  }

  logger.info('Mentor is featured');
  expect(await checkboxLocator.isChecked()).toBe(true);

  const mentorImageInputLocator = page.locator('input[name="file"]');

  logger.info('Upload mentor image');
  await mentorImageInputLocator.setInputFiles('images/assets/mentor_image.jpg');

  const mentorNextButtonLocator = page.getByRole('link', { name: 'Next' });

  logger.info('Click on the mentor next button');
  await mentorNextButtonLocator.click();

  const saveMentorBtnLocator = page.getByRole('link', { name: 'Save' });

  logger.info('Click on the save mentor button');
  await saveMentorBtnLocator.click();

  logger.info('Wait for the mentor to be created');
  await expect(
    page.getByText('Mentor has been successfully created')
  ).toBeVisible();
});

test('user can create mentor a non-featured mentor', async ({ page }) => {
  logger.info('Navigating to mentor platform');
  await page.goto(MENTOR_HOST);

  logger.info("Wait to be redirected to the users's active mentor and tenant");
  await page.waitForURL((url) =>
    url.href.startsWith(`${MENTOR_HOST}/platform`)
  );

  const settingsIconLocator = page.locator(
    '.header-settings-dropdown > .header-action-btn'
  );

  logger.info('Check if the settings icon is visible');
  await expect(settingsIconLocator).toBeVisible();

  logger.info('Click on the settings icon');
  await settingsIconLocator.click();

  const mentorLoadingSpinnerLocator = page.getByTestId('tail-spin-svg');

  logger.info('Wait for the mentor loading spinner to be visible');
  await expect(mentorLoadingSpinnerLocator).toBeVisible();

  logger.info('Wait for the mentor loading spinner to be hidden');
  await mentorLoadingSpinnerLocator.waitFor({ state: 'hidden' });

  const createMentorButtonLocator = page.getByText('Create Mentor');

  logger.info('Check if the create mentor button is visible');
  await expect(createMentorButtonLocator).toBeVisible();

  logger.info('Click on the create mentor button');
  await createMentorButtonLocator.click();

  const createMentorNextButtonLocator = page.getByRole('link', {
    name: 'Next',
  });

  logger.info('Check if the create mentor next button is visible');
  await expect(createMentorNextButtonLocator).toBeVisible();

  const mentorNameInputLocator = page.getByPlaceholder('Mentor Name');

  logger.info('Check if the mentor name input is empty');
  expect(await mentorNameInputLocator.inputValue()).toBe('');

  logger.info('Fill the mentor name input with a value');
  await mentorNameInputLocator.fill(`Test Mentor ${new Date().getTime()}`);

  logger.info('Check if the mentor name input is not empty');
  expect(await mentorNameInputLocator.inputValue()).not.toBe('');

  const mentorDescriptionInputLocator =
    page.getByPlaceholder('Mentor Description');

  logger.info('Check if the mentor description input is empty');
  expect(await mentorDescriptionInputLocator.inputValue()).toBe('');

  logger.info('Fill the mentor description input with a value');
  await mentorDescriptionInputLocator.fill('Test Mentor Description');

  logger.info('Check if the mentor description input is not empty');
  expect(await mentorDescriptionInputLocator.inputValue()).not.toBe('');

  const mentorCategorySelectorLocator = page.locator('#field-11');

  logger.info('Check if the mentor category selector input is empty');
  expect(await mentorCategorySelectorLocator.inputValue()).toBe('');

  logger.info('Select mentor category');
  await mentorCategorySelectorLocator.selectOption({ label: 'Business' });

  logger.info('Check if the mentor category selector input is not empty');
  expect(await mentorCategorySelectorLocator.inputValue()).not.toBe('');

  const checkboxLocator = page.locator('input[name="featured"]');

  const mentorIsFeatured = await checkboxLocator.isChecked();

  logger.info('Check if the mentor is not featured');
  if (mentorIsFeatured) {
    logger.info('Mentor is featured, setting it to not featured');
    const mentorFeaturedSwitchBtnLocator = page
      .locator('form')
      .filter({ hasText: 'Name*Description*Test Mentor' })
      .locator('span');

    await mentorFeaturedSwitchBtnLocator.click();
  } else {
    logger.info('Mentor is already not featured');
  }

  logger.info('Mentor is not featured');
  expect(await checkboxLocator.isChecked()).toBe(false);

  const mentorImageInputLocator = page.locator('input[name="file"]');

  logger.info('Upload mentor image');
  await mentorImageInputLocator.setInputFiles('images/assets/mentor_image.jpg');

  const mentorNextButtonLocator = page.getByRole('link', { name: 'Next' });

  logger.info('Click on the mentor next button');
  await mentorNextButtonLocator.click();

  const saveMentorBtnLocator = page.getByRole('link', { name: 'Save' });

  logger.info('Click on the save mentor button');
  await saveMentorBtnLocator.click();

  logger.info('Wait for the mentor to be created');
  await expect(
    page.getByText('Mentor has been successfully created')
  ).toBeVisible();
});
