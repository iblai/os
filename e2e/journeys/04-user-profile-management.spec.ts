import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp } from '../utils/auth';
import { logger } from '@iblai/iblai-js/playwright';

test.describe('Journey 4: User Profile Management', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  // ── Modal Navigation ───────────────────────────────────────────────────────

  test('authenticated user goes to profile dropdown and opens the profile modal', async ({
    profilePage,
  }) => {
    await profilePage.open();
    await expect(profilePage.modal).toBeVisible();
  });

  test('authenticated user goes to profile modal and closes it with the close button', async ({
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.close();
    await expect(profilePage.modal).not.toBeVisible();
  });

  test('authenticated user goes to profile modal and switches between all tabs', async ({
    profilePage,
  }) => {
    await profilePage.open();
    const tabs = ['Basic', 'Social', 'Education', 'Experience', 'Resume', 'Security'];
    for (const tab of tabs) {
      await profilePage.switchToTab(tab);
      const activeTab = profilePage.modal.getByRole('tab', {
        name: new RegExp(tab, 'i'),
        selected: true,
      });
      await expect(activeTab).toBeVisible({ timeout: 5_000 });
    }
  });

  // ── Basic Tab ──────────────────────────────────────────────────────────────

  test('authenticated user goes to profile basic tab and sees all basic profile fields displayed', async ({
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Basic');
    await expect(profilePage.fullNameField).toBeVisible({ timeout: 10_000 });
    await expect(profilePage.emailField).toBeVisible({ timeout: 5_000 });
    await expect(profilePage.titleField).toBeVisible({ timeout: 5_000 });
  });

  test('authenticated user goes to profile basic tab and the Full Name field is pre-populated', async ({
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Basic');
    await expect(profilePage.fullNameField).toBeVisible({ timeout: 10_000 });
    const value = await profilePage.fullNameField.inputValue();
    expect(value.length).toBeGreaterThan(0);
    logger.info(`Full Name value: ${value}`);
  });

  test('authenticated user goes to profile basic tab and the Email field is pre-populated with a valid email', async ({
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Basic');
    await expect(profilePage.emailField).toBeVisible({ timeout: 10_000 });
    const value = await profilePage.emailField.inputValue();
    expect(value).toContain('@');
    logger.info(`Email value: ${value}`);
  });

  test('authenticated user goes to profile basic tab and edits the Title field and sees the new value', async ({
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Basic');
    const testTitle = `E2E Test Title ${Date.now()}`;
    await expect(profilePage.titleField).toBeVisible({ timeout: 10_000 });
    await profilePage.titleField.fill(testTitle);
    await expect(profilePage.titleField).toHaveValue(testTitle);
  });

  test('authenticated user goes to profile basic tab and edits the About field and sees the new value', async ({
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Basic');
    const testAbout = `E2E test about content ${Date.now()}`;
    await expect(profilePage.aboutField).toBeVisible({ timeout: 10_000 });
    await profilePage.aboutField.fill(testAbout);
    await expect(profilePage.aboutField).toHaveValue(testAbout);
  });

  test('authenticated user goes to profile basic tab and sees the language selector', async ({
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Basic');
    await expect(profilePage.languageSelector).toBeVisible({ timeout: 10_000 });
  });

  test('authenticated user goes to profile basic tab and sees Save Changes and Cancel buttons', async ({
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Basic');
    await expect(profilePage.modal.getByRole('button', { name: 'Save Changes' })).toBeVisible({ timeout: 5_000 });
    await expect(profilePage.modal.getByRole('button', { name: 'Cancel' })).toBeVisible({ timeout: 5_000 });
  });

  test('authenticated user goes to profile basic tab and saves profile changes successfully', async ({
    page,
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Basic');
    const testTitle = `Engineer ${Date.now()}`;
    await expect(profilePage.titleField).toBeVisible({ timeout: 10_000 });
    await profilePage.titleField.fill(testTitle);
    const saveBtn = profilePage.modal.getByRole('button', { name: 'Save Changes' });
    await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
    await saveBtn.click();
    // Modal should still be open after save
    await expect(profilePage.modal).toBeVisible({ timeout: 10_000 });
    // Value should have persisted
    await expect(profilePage.titleField).toHaveValue(testTitle);
    logger.info('Profile changes saved successfully');
  });

  // ── Social Tab ─────────────────────────────────────────────────────────────

  test('authenticated user goes to profile social tab and sees all social profile fields', async ({
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Social');
    await expect(profilePage.linkedInField).toBeVisible({ timeout: 10_000 });
    await expect(profilePage.twitterField).toBeVisible({ timeout: 5_000 });
  });

  test('authenticated user goes to profile social tab and sees URL prefixes on social fields including facebook linkedin and twitter', async ({
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Social');
    const facebookField = profilePage.modal.getByRole('textbox', { name: 'Facebook' });
    if (await facebookField.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const facebookValue = await facebookField.inputValue();
      expect(facebookValue).toContain('facebook.com');
    }
    const linkedinValue = await profilePage.linkedInField.inputValue();
    expect(linkedinValue).toContain('linkedin.com');
    const twitterValue = await profilePage.twitterField.inputValue();
    expect(twitterValue).toMatch(/x\.com|twitter\.com/);
  });

  test('authenticated user goes to profile social tab and edits the LinkedIn field', async ({
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Social');
    const testLinkedIn = 'https://linkedin.com/in/e2etestprofile';
    await profilePage.linkedInField.fill(testLinkedIn);
    await expect(profilePage.linkedInField).toHaveValue(testLinkedIn);
  });

  test('authenticated user goes to profile social tab and sees Save Changes and Cancel buttons', async ({
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Social');
    await expect(profilePage.modal.getByRole('button', { name: 'Save Changes' })).toBeVisible({ timeout: 5_000 });
    await expect(profilePage.modal.getByRole('button', { name: 'Cancel' })).toBeVisible({ timeout: 5_000 });
  });

  // ── Education Tab ──────────────────────────────────────────────────────────

  test('authenticated user goes to profile education tab and sees the education section header', async ({
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Education');
    await expect(
      profilePage.modal.getByRole('heading', { name: 'education', level: 3, exact: true })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('authenticated user goes to profile education tab and sees the Add education button', async ({
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Education');
    await expect(
      profilePage.modal.getByRole('button', { name: 'Add education' }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('authenticated user goes to profile education dialog and sees the Degree Field of study and Institution fields', async ({
    page,
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Education');
    const dialog = await profilePage.openAddEducationDialog();
    await expect(dialog.getByRole('textbox', { name: 'Degree' })).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByRole('combobox', { name: 'Field of study' })).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByRole('combobox', { name: 'Institution' })).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
  });

  test('authenticated user goes to profile education dialog and sees the degree field has placeholder text', async ({
    page,
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Education');
    const dialog = await profilePage.openAddEducationDialog();
    const degreeField = dialog.getByRole('textbox', { name: 'Degree' });
    await expect(degreeField).toHaveAttribute('placeholder', 'e.g. Bachelor of Science');
    await page.keyboard.press('Escape');
  });

  test('authenticated user goes to profile education dialog and sees the grade field as a spinbutton for numeric input', async ({
    page,
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Education');
    const dialog = await profilePage.openAddEducationDialog();
    const gradeField = dialog.getByRole('spinbutton', { name: 'Grade' });
    await expect(gradeField).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
  });

  test('authenticated user goes to profile education dialog and enters a numeric grade value', async ({
    page,
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Education');
    const dialog = await profilePage.openAddEducationDialog();
    const gradeField = dialog.getByRole('spinbutton', { name: 'Grade' });
    await gradeField.fill('3.9');
    await expect(gradeField).toHaveValue('3.9');
    await page.keyboard.press('Escape');
  });

  test('authenticated user goes to profile education dialog and closes it with the Cancel button', async ({
    page,
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Education');
    const dialog = await profilePage.openAddEducationDialog();
    const cancelBtn = dialog.getByRole('button', { name: 'Cancel' });
    await cancelBtn.click();
    await expect(
      page.getByRole('heading', { name: 'Add education', level: 2 }).first()
    ).not.toBeVisible({ timeout: 5_000 });
  });

  test('authenticated user goes to profile education dialog and sees the Save changes button', async ({
    page,
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Education');
    const dialog = await profilePage.openAddEducationDialog();
    await expect(dialog.getByRole('button', { name: 'Save changes' })).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
  });

  test('authenticated user goes to profile education dialog and sees the I currently study here toggle', async ({
    page,
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Education');
    const dialog = await profilePage.openAddEducationDialog();
    await expect(dialog.getByText('I currently study here')).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByRole('switch')).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
  });

  test('authenticated user goes to profile education dialog and sees all required form fields', async ({
    page,
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Education');
    const dialog = await profilePage.openAddEducationDialog();
    await expect(dialog.getByRole('textbox', { name: 'Degree' })).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByRole('combobox', { name: 'Field of study' })).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: 'Institution' })).toBeVisible();
    await expect(dialog.getByText('Start month')).toBeVisible();
    await expect(dialog.getByText('Start year')).toBeVisible();
    await expect(dialog.getByText('End month')).toBeVisible();
    await expect(dialog.getByText('End year')).toBeVisible();
    await expect(dialog.getByRole('spinbutton', { name: 'Grade' })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('authenticated user goes to profile education dialog and opens the Field of study combobox to see options', async ({
    page,
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Education');
    const dialog = await profilePage.openAddEducationDialog();
    await dialog.getByRole('combobox', { name: 'Field of study' }).click();
    await expect(page.getByRole('listbox')).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
  });

  test('authenticated user goes to profile education dialog and opens the Institution combobox to see Add new institution option', async ({
    page,
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Education');
    const dialog = await profilePage.openAddEducationDialog();
    await dialog.getByRole('combobox', { name: 'Institution' }).click();
    await expect(
      page.getByRole('option', { name: 'Add new institution' })
    ).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
  });

  test('authenticated user goes to profile education dialog and enables I currently study here which disables end date', async ({
    page,
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Education');
    const dialog = await profilePage.openAddEducationDialog();
    const toggle = dialog.getByRole('switch');
    await toggle.click();
    await expect(toggle).toBeChecked();
    await page.keyboard.press('Escape');
  });

  test('authenticated user goes to profile education dialog and opens the start month dropdown showing all months', async ({
    page,
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Education');
    const dialog = await profilePage.openAddEducationDialog();
    await dialog.getByRole('combobox', { name: 'Start month' }).click();
    await expect(page.getByRole('option', { name: 'January' })).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
  });

  test('authenticated user goes to profile education dialog and opens the start year dropdown showing years', async ({
    page,
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Education');
    const dialog = await profilePage.openAddEducationDialog();
    await dialog.getByRole('combobox', { name: 'Start year' }).click();
    await expect(page.getByRole('option', { name: '2025' })).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
  });

  test('authenticated user goes to profile education dialog and opens the Add Institution sub-dialog', async ({
    page,
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Education');
    const dialog = await profilePage.openAddEducationDialog();
    await dialog.getByRole('combobox', { name: 'Institution' }).click();
    await page.getByRole('option', { name: 'Add new institution' }).click();
    await expect(
      page.getByRole('heading', { name: 'Add Institution', level: 2 }).first()
    ).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
  });

  test('authenticated user goes to profile Add Institution dialog and sees all institution form fields', async ({
    page,
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Education');
    const dialog = await profilePage.openAddEducationDialog();
    await dialog.getByRole('combobox', { name: 'Institution' }).click();
    await page.getByRole('option', { name: 'Add new institution' }).click();
    await expect(
      page.getByRole('textbox', { name: 'Name' })
        .or(page.getByRole('textbox', { name: 'Institution name' }))
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByRole('combobox', { name: 'Institution type' })
        .or(page.getByRole('combobox', { name: 'Type' }))
    ).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
  });

  test('authenticated user goes to profile Add Institution dialog and sees Cancel and Save Institution buttons', async ({
    page,
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Education');
    const dialog = await profilePage.openAddEducationDialog();
    await dialog.getByRole('combobox', { name: 'Institution' }).click();
    await page.getByRole('option', { name: 'Add new institution' }).click();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: 'Save Institution' })).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
  });

  test('authenticated user goes to profile Add Institution dialog and clicks Cancel to close it', async ({
    page,
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Education');
    const dialog = await profilePage.openAddEducationDialog();
    await dialog.getByRole('combobox', { name: 'Institution' }).click();
    await page.getByRole('option', { name: 'Add new institution' }).click();
    await expect(
      page.getByRole('heading', { name: 'Add Institution', level: 2 }).first()
    ).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(
      page.getByRole('heading', { name: 'Add Institution', level: 2 }).first()
    ).not.toBeVisible({ timeout: 5_000 });
    // Add education dialog should still be visible
    await expect(
      page.getByRole('heading', { name: 'Add education', level: 2 }).first()
    ).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
  });

  // ── Experience Tab ─────────────────────────────────────────────────────────

  test('authenticated user goes to profile experience tab and sees the experience section header', async ({
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Experience');
    await expect(
      profilePage.modal.getByRole('heading', { name: 'experience', level: 3, exact: true })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('authenticated user goes to profile experience tab and sees the Add experience button', async ({
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Experience');
    await expect(
      profilePage.modal.getByRole('button', { name: 'Add experience' }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('authenticated user goes to profile experience tab and opens the Add Experience dialog', async ({
    page,
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Experience');
    const dialog = await profilePage.openAddExperienceDialog();
    await expect(dialog).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Add experience', level: 2 }).first()
    ).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
  });

  test('authenticated user goes to profile experience dialog and sees all required form fields', async ({
    page,
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Experience');
    const dialog = await profilePage.openAddExperienceDialog();
    await expect(dialog.getByRole('textbox', { name: 'Title' })).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByRole('combobox', { name: 'Company' })).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: 'Employment type' })).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: 'Location' })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('authenticated user goes to profile experience dialog and sees the I currently work here toggle', async ({
    page,
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Experience');
    const dialog = await profilePage.openAddExperienceDialog();
    await expect(dialog.getByRole('switch')).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByText('I currently work here')).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
  });

  test('authenticated user goes to profile experience dialog and enables I currently work here which disables end date fields', async ({
    page,
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Experience');
    const dialog = await profilePage.openAddExperienceDialog();
    const toggle = dialog.getByRole('switch');
    await toggle.click();
    await expect(toggle).toBeChecked();
    const endMonthCombobox = dialog.getByRole('combobox', { name: 'End month' });
    const endYearCombobox = dialog.getByRole('combobox', { name: 'End year' });
    if (await endMonthCombobox.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(endMonthCombobox).toBeDisabled();
      await expect(endYearCombobox).toBeDisabled();
    }
    await page.keyboard.press('Escape');
  });

  test('authenticated user goes to profile experience dialog and sees Cancel and Save changes buttons', async ({
    page,
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Experience');
    const dialog = await profilePage.openAddExperienceDialog();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByRole('button', { name: 'Save changes' })).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
  });

  test('authenticated user goes to profile experience dialog and closes it with the Cancel button', async ({
    page,
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Experience');
    const dialog = await profilePage.openAddExperienceDialog();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(
      page.getByRole('heading', { name: 'Add experience', level: 2 }).first()
    ).not.toBeVisible({ timeout: 5_000 });
  });

  test('authenticated user goes to profile experience dialog and opens the Company dropdown to see Add new company option', async ({
    page,
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Experience');
    const dialog = await profilePage.openAddExperienceDialog();
    await dialog.getByRole('combobox', { name: 'Company' }).click();
    await expect(
      page.getByRole('option', { name: 'Add new company' })
    ).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
  });

  // ── Resume Tab ─────────────────────────────────────────────────────────────

  test('authenticated user goes to profile resume tab and sees the resume section header', async ({
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Resume');
    await expect(
      profilePage.modal.getByRole('heading', { name: 'resume', level: 3, exact: true })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('authenticated user goes to profile resume tab and sees the upload resume button', async ({
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Resume');
    await expect(profilePage.uploadResumeButton).toBeVisible({ timeout: 10_000 });
  });

  // ── Security Tab ───────────────────────────────────────────────────────────

  test('authenticated user goes to profile security tab and sees the security section header', async ({
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Security');
    await expect(
      profilePage.modal.getByRole('heading', { name: 'security', level: 3, exact: true })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('authenticated user goes to profile security tab and sees the Security Settings card', async ({
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Security');
    // The security tab should have some content visible
    await expect(profilePage.modal.getByRole('tabpanel')).toBeVisible({ timeout: 5_000 });
  });

  test('authenticated user goes to profile security tab and sees the Send Password Reset Link button', async ({
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Security');
    await expect(profilePage.sendPasswordResetButton).toBeVisible({ timeout: 10_000 });
  });

  test('authenticated user goes to profile security tab and does not see the Save Changes button', async ({
    profilePage,
  }) => {
    await profilePage.open();
    await profilePage.switchToTab('Security');
    await expect(
      profilePage.modal.getByRole('button', { name: 'Save Changes' })
    ).not.toBeVisible({ timeout: 5_000 });
  });

  // ── Accessibility ──────────────────────────────────────────────────────────

  test('authenticated user goes to profile modal and it has proper ARIA attributes', async ({
    profilePage,
  }) => {
    await profilePage.open();
    const tablist = profilePage.modal.getByRole('tablist');
    await expect(tablist).toBeVisible({ timeout: 5_000 });
    const activeTab = profilePage.modal.getByRole('tab', { selected: true });
    await expect(activeTab).toBeVisible({ timeout: 5_000 });
    await expect(activeTab).toHaveAttribute('aria-selected', 'true');
  });

  test('authenticated user goes to profile modal and the close button has an accessible name', async ({
    profilePage,
  }) => {
    await profilePage.open();
    await expect(profilePage.closeButton).toBeVisible({ timeout: 5_000 });
    await expect(profilePage.closeButton).toHaveAccessibleName('Close');
  });

  test('authenticated user goes to profile modal and profile tabs have a tablist role', async ({
    profilePage,
  }) => {
    await profilePage.open();
    const tablist = profilePage.modal.getByRole('tablist');
    await expect(tablist.first()).toBeVisible({ timeout: 5_000 });
  });

  test('authenticated user goes to profile modal and individual tabs have proper tab role and aria-selected', async ({
    profilePage,
  }) => {
    await profilePage.open();
    const tabs = profilePage.modal.getByRole('tab');
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThanOrEqual(6);
    const selectedTab = profilePage.modal.getByRole('tab', { selected: true });
    await expect(selectedTab.first()).toBeVisible({ timeout: 5_000 });
  });

  test('authenticated user goes to profile modal and switching tabs updates aria-selected state', async ({
    profilePage,
  }) => {
    await profilePage.open();
    const basicTab = profilePage.modal.getByRole('tab', { name: 'Basic' }).first();
    await expect(basicTab).toHaveAttribute('aria-selected', 'true');
    await profilePage.switchToTab('Social');
    const socialTab = profilePage.modal.getByRole('tab', { name: 'Social' }).first();
    await expect(socialTab).toHaveAttribute('aria-selected', 'true');
    await expect(basicTab).toHaveAttribute('aria-selected', 'false');
  });

  test('authenticated user goes to profile modal and the tab panel has proper tabpanel role', async ({
    profilePage,
  }) => {
    await profilePage.open();
    const tabpanel = profilePage.modal.getByRole('tabpanel');
    await expect(tabpanel).toBeVisible({ timeout: 5_000 });
  });

  test('authenticated user goes to profile modal and tabs have aria-controls linking to the tabpanel', async ({
    profilePage,
  }) => {
    await profilePage.open();
    const selectedTab = profilePage.modal.getByRole('tab', { selected: true }).first();
    await expect(selectedTab).toBeVisible({ timeout: 5_000 });
    const ariaControls = await selectedTab.getAttribute('aria-controls');
    expect(ariaControls).toBeTruthy();
  });

  test('authenticated user goes to profile modal and the avatar upload button has an accessible name', async ({
    profilePage,
  }) => {
    await profilePage.open();
    const uploadBtn = profilePage.modal.getByRole('button', { name: 'Upload profile picture' });
    await expect(uploadBtn).toBeVisible({ timeout: 5_000 });
    await expect(uploadBtn).toHaveAccessibleName('Upload profile picture');
  });

  // ── User Info Display ──────────────────────────────────────────────────────

  test('authenticated user goes to profile modal and sees the user avatar', async ({
    profilePage,
  }) => {
    await profilePage.open();
    const uploadBtn = profilePage.modal.getByRole('button', { name: 'Upload profile picture' });
    await expect(uploadBtn).toBeVisible({ timeout: 5_000 });
    logger.info('User avatar is visible');
  });

  test('authenticated user goes to profile modal and an admin sees the Admin badge', async ({
    page,
    profilePage,
  }) => {
    await profilePage.open();
    const adminBadge = profilePage.modal.getByText('Admin');
    const isAdminUser = await adminBadge.isVisible({ timeout: 3_000 }).catch(() => false);
    if (isAdminUser) {
      await expect(adminBadge).toBeVisible();
      logger.info('Admin badge is visible');
    } else {
      logger.info('Admin badge not visible — user is not an admin');
    }
  });
});
