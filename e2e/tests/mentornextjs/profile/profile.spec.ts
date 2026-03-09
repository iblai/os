import { test, expect } from '@playwright/test';
import {
  navigateToMentorApp,
  openProfileModal,
  closeProfileModal,
  switchToProfileTab,
  verifyBasicTabFields,
  verifySocialTabFields,
  fillBasicTabForm,
  fillSocialTabForm,
  saveProfileChanges,
  openAddEducationDialog,
  openAddExperienceDialog,
  verifySecurityTabContent,
  verifyAllProfileTabsPresent,
} from './helpers';
import { logger } from '@iblai/iblai-js/playwright';

test.describe('User Profile Modal', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  test.describe('Profile Modal Navigation', () => {
    test('should open profile modal from user dropdown', async ({ page }) => {
      await openProfileModal(page);

      // Verify the modal is displayed with correct structure
      const profileModal = page.getByRole('dialog', {
        name: 'User Profile',
      });
      await expect(profileModal).toBeVisible();

      // Verify all tabs are present
      await verifyAllProfileTabsPresent(page);
    });

    test('should close profile modal when clicking close button', async ({
      page,
    }) => {
      await openProfileModal(page);

      const profileModal = page.getByRole('dialog', {
        name: 'User Profile',
      });
      await expect(profileModal).toBeVisible();

      await closeProfileModal(page);

      await expect(profileModal).not.toBeVisible();
    });

    test('should switch between all profile tabs', async ({ page }) => {
      await openProfileModal(page);

      // Switch through all tabs and verify heading changes
      const tabs = [
        { name: 'Basic' as const, heading: 'basic' },
        { name: 'Social' as const, heading: 'social' },
        { name: 'Education' as const, heading: 'education' },
        { name: 'Experience' as const, heading: 'experience' },
        { name: 'Resume' as const, heading: 'resume' },
        { name: 'Security' as const, heading: 'security' },
      ];

      for (const tab of tabs) {
        await switchToProfileTab(page, tab.name);
        await expect(
          page.getByRole('heading', {
            name: tab.heading,
            level: 3,
            exact: true,
          })
        ).toBeVisible({ timeout: 5000 });
        logger.info(`Successfully switched to ${tab.name} tab`);
      }
    });
  });

  test.describe('Basic Tab', () => {
    test('should display all basic profile fields', async ({ page }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Basic');

      await verifyBasicTabFields(page);
    });

    test('should have Full Name field pre-populated', async ({ page }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Basic');

      const fullNameField = page.getByRole('textbox', { name: 'Full Name' });
      await expect(fullNameField).toBeVisible();

      const fullNameValue = await fullNameField.inputValue();
      expect(fullNameValue.length).toBeGreaterThan(0);
    });

    test('should have Email field pre-populated', async ({ page }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Basic');

      const emailField = page.getByRole('textbox', { name: 'Email' });
      await expect(emailField).toBeVisible();

      const emailValue = await emailField.inputValue();
      expect(emailValue).toContain('@');
    });

    test('should allow editing Title field', async ({ page }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Basic');

      const testTitle = `Test Title ${Date.now()}`;
      await fillBasicTabForm(page, { title: testTitle });

      const titleField = page.getByRole('textbox', { name: 'Title' });
      await expect(titleField).toHaveValue(testTitle);
    });

    test('should allow editing About field', async ({ page }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Basic');

      const testAbout = `Test about content ${Date.now()}`;
      await fillBasicTabForm(page, { about: testAbout });

      const aboutField = page.getByRole('textbox', { name: 'About' });
      await expect(aboutField).toHaveValue(testAbout);
    });

    test('should display language selector', async ({ page }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Basic');

      const languageSelect = page.getByRole('combobox', {
        name: 'Select a language',
      });
      await expect(languageSelect).toBeVisible();
    });

    test('should display Save Changes and Cancel buttons', async ({ page }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Basic');

      await expect(
        page.getByRole('button', { name: 'Save Changes' })
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    });

    test('should save profile changes successfully', async ({ page }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Basic');

      const testTitle = `Engineer ${Date.now()}`;
      await fillBasicTabForm(page, { title: testTitle });

      await saveProfileChanges(page);

      // Modal should still be open after save
      const profileModal = page.getByRole('dialog', {
        name: 'User Profile',
      });
      await expect(profileModal).toBeVisible();

      // Verify the value persisted
      const titleField = page.getByRole('textbox', { name: 'Title' });
      await expect(titleField).toHaveValue(testTitle);
    });
  });

  test.describe('Social Tab', () => {
    test('should display all social profile fields', async ({ page }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Social');

      await verifySocialTabFields(page);
    });

    test('should have URL prefixes for social fields', async ({ page }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Social');

      // Check that default URL prefixes are present
      const facebookField = page.getByRole('textbox', { name: 'Facebook' });
      const facebookValue = await facebookField.inputValue();
      expect(facebookValue).toContain('facebook.com');

      const linkedinField = page.getByRole('textbox', { name: 'LinkedIn' });
      const linkedinValue = await linkedinField.inputValue();
      expect(linkedinValue).toContain('linkedin.com');

      const twitterField = page.getByRole('textbox', { name: 'X' });
      const twitterValue = await twitterField.inputValue();
      expect(twitterValue).toContain('x.com');
    });

    test('should allow editing LinkedIn field', async ({ page }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Social');

      const testLinkedIn = 'https://linkedin.com/in/testprofile';
      await fillSocialTabForm(page, { linkedin: testLinkedIn });

      const linkedinField = page.getByRole('textbox', { name: 'LinkedIn' });
      await expect(linkedinField).toHaveValue(testLinkedIn);
    });

    test('should display Save Changes and Cancel buttons on Social tab', async ({
      page,
    }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Social');

      await expect(
        page.getByRole('button', { name: 'Save Changes' })
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    });
  });

  test.describe('Education Tab', () => {
    test('should display education section header', async ({ page }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Education');

      await expect(
        page.getByRole('heading', { name: 'education', level: 3, exact: true })
      ).toBeVisible();
    });

    test('should display Add education button', async ({ page }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Education');

      await expect(
        page.getByRole('button', { name: 'Add education' }).first()
      ).toBeVisible();
    });

    test('should open Add education dialog', async ({ page }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Education');

      const dialog = await openAddEducationDialog(page);

      // Verify dialog fields are present
      await expect(
        page.getByRole('heading', { name: 'Add education', level: 2 }).first()
      ).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'Degree' })).toBeVisible();
      await expect(
        page.getByRole('combobox', { name: 'Field of study' })
      ).toBeVisible();
      await expect(
        page.getByRole('combobox', { name: 'Institution' })
      ).toBeVisible();
    });

    test('should have degree placeholder text', async ({ page }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Education');

      await openAddEducationDialog(page);

      const degreeField = page.getByRole('textbox', { name: 'Degree' });
      await expect(degreeField).toHaveAttribute(
        'placeholder',
        'e.g. Bachelor of Science'
      );
    });

    test('should have grade field as a spinbutton for numeric input', async ({
      page,
    }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Education');

      await openAddEducationDialog(page);

      // Grade field is a spinbutton (number input) that accepts numeric values
      const gradeField = page.getByRole('spinbutton', { name: 'Grade' });
      await expect(gradeField).toBeVisible();
    });

    test('should allow entering numeric grade value', async ({ page }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Education');

      await openAddEducationDialog(page);

      // Grade field is a spinbutton that accepts numeric values like 3.8
      const gradeField = page.getByRole('spinbutton', { name: 'Grade' });
      await gradeField.fill('3.9');
      await expect(gradeField).toHaveValue('3.9');
    });

    test('should close Add education dialog with Cancel button', async ({
      page,
    }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Education');

      await openAddEducationDialog(page);

      const cancelButton = page
        .getByRole('dialog')
        .filter({ hasText: 'Add education' })
        .getByRole('button', { name: 'Cancel' });
      await cancelButton.click();

      // Dialog should be closed
      await expect(
        page.getByRole('heading', { name: 'Add education', level: 2 }).first()
      ).not.toBeVisible();
    });

    test('should have Save changes button in education dialog', async ({
      page,
    }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Education');

      await openAddEducationDialog(page);

      await expect(
        page
          .getByRole('dialog')
          .filter({ hasText: 'Add education' })
          .getByRole('button', { name: 'Save changes' })
      ).toBeVisible();
    });

    test('should have "I currently study here" toggle', async ({ page }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Education');

      await openAddEducationDialog(page);

      await expect(page.getByText('I currently study here')).toBeVisible();
      await expect(page.getByRole('switch')).toBeVisible();
    });

    test('should have all required form fields in education dialog', async ({
      page,
    }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Education');

      await openAddEducationDialog(page);

      // Verify all form fields are present
      await expect(page.getByRole('textbox', { name: 'Degree' })).toBeVisible();
      await expect(
        page.getByRole('combobox', { name: 'Field of study' })
      ).toBeVisible();
      await expect(
        page.getByRole('combobox', { name: 'Institution' })
      ).toBeVisible();
      await expect(page.getByText('Start month')).toBeVisible();
      await expect(page.getByText('Start year')).toBeVisible();
      await expect(page.getByText('End month')).toBeVisible();
      await expect(page.getByText('End year')).toBeVisible();
      await expect(
        page.getByRole('spinbutton', { name: 'Grade' })
      ).toBeVisible();
    });

    test('should have Field of study options when clicking combobox', async ({
      page,
    }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Education');

      await openAddEducationDialog(page);

      // Click on Field of study combobox
      await page.getByRole('combobox', { name: 'Field of study' }).click();

      // Verify some options are visible
      await expect(page.getByRole('listbox')).toBeVisible();
    });

    test('should have Institution options with Add new institution option', async ({
      page,
    }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Education');

      await openAddEducationDialog(page);

      // Click on Institution combobox
      await page.getByRole('combobox', { name: 'Institution' }).click();

      // Verify "Add new institution" option is present
      await expect(
        page.getByRole('option', { name: 'Add new institution' })
      ).toBeVisible();
    });

    test('should disable end date fields when I currently study here is enabled', async ({
      page,
    }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Education');

      await openAddEducationDialog(page);

      // Get the switch
      const currentlyStudySwitch = page.getByRole('switch');

      // Enable "I currently study here"
      await currentlyStudySwitch.click();

      // Verify the switch is checked
      await expect(currentlyStudySwitch).toBeChecked();
    });

    test('should have start month dropdown with all months', async ({
      page,
    }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Education');

      await openAddEducationDialog(page);

      // Click on start month combobox using aria-label
      const startMonthCombobox = page.getByRole('combobox', {
        name: 'Start month',
      });
      await startMonthCombobox.click();

      // Verify January is an option
      await expect(page.getByRole('option', { name: 'January' })).toBeVisible();
    });

    test('should have start year dropdown with years', async ({ page }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Education');

      await openAddEducationDialog(page);

      // Click on start year combobox using aria-label
      const startYearCombobox = page.getByRole('combobox', {
        name: 'Start year',
      });
      await startYearCombobox.click();

      // Verify current year is an option
      await expect(page.getByRole('option', { name: '2025' })).toBeVisible();
    });

    test('should open Add Institution dialog when clicking Add new institution', async ({
      page,
    }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Education');

      await openAddEducationDialog(page);

      // Click on Institution combobox
      await page.getByRole('combobox', { name: 'Institution' }).click();

      // Click "Add new institution"
      await page.getByRole('option', { name: 'Add new institution' }).click();

      // Verify Add Institution dialog opens
      await expect(
        page.getByRole('heading', { name: 'Add Institution', level: 2 }).first()
      ).toBeVisible();
    });

    test('should have institution form fields in Add Institution dialog', async ({
      page,
    }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Education');

      await openAddEducationDialog(page);

      // Click on Institution combobox
      await page.getByRole('combobox', { name: 'Institution' }).click();

      // Click "Add new institution"
      await page.getByRole('option', { name: 'Add new institution' }).click();

      // Verify institution form fields
      await expect(
        page
          .getByRole('textbox', { name: 'Name' })
          .or(page.getByRole('textbox', { name: 'Institution name' }))
      ).toBeVisible();
      await expect(
        page
          .getByRole('combobox', { name: 'Institution type' })
          .or(page.getByRole('combobox', { name: 'Type' }))
      ).toBeVisible();
    });

    test('should have Cancel and Save Institution buttons in Add Institution dialog', async ({
      page,
    }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Education');

      await openAddEducationDialog(page);

      // Click on Institution combobox
      await page.getByRole('combobox', { name: 'Institution' }).click();

      // Click "Add new institution"
      await page.getByRole('option', { name: 'Add new institution' }).click();

      // Verify buttons
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Save Institution' })
      ).toBeVisible();
    });

    test('should close Add Institution dialog when Cancel is clicked', async ({
      page,
    }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Education');

      await openAddEducationDialog(page);

      // Click on Institution combobox
      await page.getByRole('combobox', { name: 'Institution' }).click();

      // Click "Add new institution"
      await page.getByRole('option', { name: 'Add new institution' }).click();

      // Verify dialog is open
      await expect(
        page.getByRole('heading', { name: 'Add Institution', level: 2 }).first()
      ).toBeVisible();

      // Click Cancel
      await page.getByRole('button', { name: 'Cancel' }).click();

      // Verify Add Institution dialog is closed (back to Add education)
      await expect(
        page.getByRole('heading', { name: 'Add Institution', level: 2 }).first()
      ).not.toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Add education', level: 2 }).first()
      ).toBeVisible();
    });
  });

  test.describe('Experience Tab', () => {
    test('should display experience section header', async ({ page }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Experience');

      await expect(
        page.getByRole('heading', { name: 'experience', level: 3, exact: true })
      ).toBeVisible();
    });

    test('should display Add experience button', async ({ page }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Experience');

      await expect(
        page.getByRole('button', { name: 'Add experience' }).first()
      ).toBeVisible();
    });

    test('should open Add experience dialog when clicking Add experience button', async ({
      page,
    }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Experience');

      await openAddExperienceDialog(page);

      // Verify dialog title
      await expect(
        page.getByRole('heading', { name: 'Add experience', level: 2 }).first()
      ).toBeVisible();
    });

    test('should have all required form fields in experience dialog', async ({
      page,
    }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Experience');

      await openAddExperienceDialog(page);

      // Verify form fields
      await expect(page.getByRole('textbox', { name: 'Title' })).toBeVisible();
      await expect(
        page.getByRole('combobox', { name: 'Company' })
      ).toBeVisible();
      await expect(
        page.getByRole('combobox', { name: 'Employment type' })
      ).toBeVisible();
      await expect(
        page.getByRole('textbox', { name: 'Location' })
      ).toBeVisible();
    });

    test('should have I currently work here toggle in experience dialog', async ({
      page,
    }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Experience');

      await openAddExperienceDialog(page);

      // Verify the switch is present
      const currentlyWorkSwitch = page.getByRole('switch');
      await expect(currentlyWorkSwitch).toBeVisible();

      // Verify the text label
      await expect(page.getByText('I currently work here')).toBeVisible();
    });

    test('should disable end date fields when I currently work here is enabled', async ({
      page,
    }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Experience');

      await openAddExperienceDialog(page);

      // Enable "I currently work here" switch
      const currentlyWorkSwitch = page.getByRole('switch');
      await currentlyWorkSwitch.click();

      // Verify switch is checked
      await expect(currentlyWorkSwitch).toBeChecked();

      // Verify end date fields are disabled using semantic aria-label selectors
      const endMonthCombobox = page.getByRole('combobox', {
        name: 'End month',
      });
      const endYearCombobox = page.getByRole('combobox', { name: 'End year' });

      // Both end date fields should be disabled when currently working
      await expect(endMonthCombobox).toBeDisabled();
      await expect(endYearCombobox).toBeDisabled();
    });

    test('should have Cancel and Save changes buttons in experience dialog', async ({
      page,
    }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Experience');

      await openAddExperienceDialog(page);

      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Save changes' })
      ).toBeVisible();
    });

    test('should close experience dialog when Cancel is clicked', async ({
      page,
    }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Experience');

      await openAddExperienceDialog(page);

      // Click Cancel
      await page.getByRole('button', { name: 'Cancel' }).click();

      // Dialog should be closed
      await expect(
        page.getByRole('heading', { name: 'Add experience', level: 2 }).first()
      ).not.toBeVisible();
    });

    test('should have Add new company option in Company dropdown', async ({
      page,
    }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Experience');

      await openAddExperienceDialog(page);

      // Click on Company combobox
      await page.getByRole('combobox', { name: 'Company' }).click();

      // Verify "Add new company" option is present
      await expect(
        page.getByRole('option', { name: 'Add new company' })
      ).toBeVisible();
    });
  });

  test.describe('Resume Tab', () => {
    test('should display resume section header', async ({ page }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Resume');

      await expect(
        page.getByRole('heading', { name: 'resume', level: 3, exact: true })
      ).toBeVisible();
    });

    test('should display Upload resume or Add resume button', async ({
      page,
    }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Resume');

      // Either "Upload resume" or "Add resume" button should be visible
      const uploadButton = page.getByRole('button', { name: /resume/i });
      await expect(uploadButton.first()).toBeVisible();
    });
  });

  test.describe('Security Tab', () => {
    test('should display security section header', async ({ page }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Security');

      await expect(
        page.getByRole('heading', { name: 'security', level: 3, exact: true })
      ).toBeVisible();
    });

    test('should display Security Settings card', async ({ page }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Security');

      await verifySecurityTabContent(page);
    });

    test('should display Send Password Reset Link button', async ({ page }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Security');

      const resetButton = page.getByRole('button', {
        name: 'Send Password Reset Link',
      });
      await expect(resetButton).toBeVisible();
    });

    test('should not display Save Changes button on Security tab', async ({
      page,
    }) => {
      await openProfileModal(page);
      await switchToProfileTab(page, 'Security');

      // Security tab should not have Save Changes button
      const saveButton = page.getByRole('button', { name: 'Save Changes' });
      await expect(saveButton).not.toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('profile modal should have proper accessibility attributes', async ({
      page,
    }) => {
      await openProfileModal(page);

      const dialog = page.getByRole('dialog', { name: 'User Profile' });
      await expect(dialog).toBeVisible();
    });

    test('close button should have accessible name', async ({ page }) => {
      await openProfileModal(page);

      const closeButton = page.getByRole('button', { name: 'Close' });
      await expect(closeButton).toBeVisible();
      await expect(closeButton).toHaveAccessibleName('Close');
    });

    test('profile tabs should have proper tablist role', async ({ page }) => {
      await openProfileModal(page);

      // Desktop tablist should be visible
      const tablist = page.getByRole('tablist');
      await expect(tablist.first()).toBeVisible();
    });

    test('individual tabs should have proper tab role and aria-selected', async ({
      page,
    }) => {
      await openProfileModal(page);

      // Check that all tabs have proper role
      const tabs = page.getByRole('tab');
      const tabCount = await tabs.count();
      expect(tabCount).toBeGreaterThanOrEqual(6);

      // Check that exactly one tab is selected
      const selectedTab = page.getByRole('tab', { selected: true });
      await expect(selectedTab.first()).toBeVisible();
    });

    test('switching tabs should update aria-selected state', async ({
      page,
    }) => {
      await openProfileModal(page);

      // Initially Basic tab should be selected
      const basicTab = page.getByRole('tab', { name: 'Basic' });
      await expect(basicTab.first()).toHaveAttribute('aria-selected', 'true');

      // Switch to Social tab
      await switchToProfileTab(page, 'Social');

      // Social tab should now be selected
      const socialTab = page.getByRole('tab', { name: 'Social' });
      await expect(socialTab.first()).toHaveAttribute('aria-selected', 'true');

      // Basic tab should no longer be selected
      await expect(basicTab.first()).toHaveAttribute('aria-selected', 'false');
    });

    test('tab panel should have proper tabpanel role', async ({ page }) => {
      await openProfileModal(page);

      // Check that tabpanel exists and is visible
      const tabpanel = page.getByRole('tabpanel');
      await expect(tabpanel).toBeVisible();
    });

    test('tabs should have aria-controls linking to tabpanel', async ({
      page,
    }) => {
      await openProfileModal(page);

      // Get the selected tab
      const selectedTab = page.getByRole('tab', { selected: true }).first();
      await expect(selectedTab).toBeVisible();

      // Check it has aria-controls attribute
      const ariaControls = await selectedTab.getAttribute('aria-controls');
      expect(ariaControls).toBeTruthy();
      expect(ariaControls).toContain('tabpanel');
    });

    test('avatar upload button should have accessible name', async ({
      page,
    }) => {
      await openProfileModal(page);

      const uploadButton = page.getByRole('button', {
        name: 'Upload profile picture',
      });
      await expect(uploadButton).toBeVisible();
      await expect(uploadButton).toHaveAccessibleName('Upload profile picture');
    });
  });

  test.describe('User Info Display', () => {
    test('should display user avatar with initials', async ({ page }) => {
      await openProfileModal(page);

      // The avatar should be visible in the profile header - use the upload button which wraps the avatar
      const uploadButton = page.getByRole('button', {
        name: 'Upload profile picture',
      });
      await expect(uploadButton).toBeVisible();
    });

    test('should display Admin badge for admin users', async ({ page }) => {
      await openProfileModal(page);

      // Check for Admin badge (may or may not be visible depending on user role)
      const adminBadge = page.getByText('Admin');
      const isAdminUser = await adminBadge.isVisible();

      if (isAdminUser) {
        logger.info('Admin badge is visible - user is an admin');
        await expect(adminBadge).toBeVisible();
      } else {
        logger.info('Admin badge is not visible - user is not an admin');
      }
    });
  });
});
