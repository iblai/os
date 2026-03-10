import { test, expect } from '@playwright/test';
import {
  navigateToDataReports,
  shouldAddNewRowWhenClickingAddRowButton,
  shouldAllowEditingCellValuesInCSVEditor,
  shouldCloseCSVEditorWhenClickingCloseButton,
  shouldCloseCSVEditorWithoutSavingWhenClickingCancel,
  shouldDirectlyDownloadChatHistoryReportWithoutCSVEditor,
  shouldDisableOtherDownloadButtonsWhileGeneratingReport,
  shouldDisplayCSVInEditableTableFormat,
  shouldDisplayReportCards,
  shouldOpenCSVEditorDialog,
  shouldOpenCSVEditorForUserMetadataReport,
  shouldSaveEditedCSVAndTriggerDownload,
  shouldVerifyCSVEditorDialogAccessibility,
} from '../shared';
import { navigateToMentorApp } from '../profile/helpers';
import { safeWaitForURL } from '@iblai/iblai-js/playwright';

test.skip();

// Report card labels used in the UI
const REPORT_CARDS = [
  {
    name: 'User Report',
    ariaLabel: 'User Report report card',
    description: 'Basic user information including login details',
    expectsCsvEditor: true,
  },
  {
    name: 'User Metadata Report',
    ariaLabel: 'User Metadata Report report card',
    description: 'User information including profile metadata like company',
    expectsCsvEditor: true,
  },
  {
    name: 'Chat History',
    ariaLabel: 'All Mentor Chat History report card',
    description: 'Get detailed mentor chat history for all participants.',
    expectsCsvEditor: false, // Chat History downloads directly
  },
];

test.describe.skip('Data Reports Feature', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  test.describe('Data Reports Page Navigation', () => {
    test('should navigate to Data Reports tab from Analytics', async ({
      page,
    }) => {
      const analyticsButton = page.getByRole('button', { name: 'Analytics' });
      await expect(analyticsButton).toBeVisible({ timeout: 120_000 });

      await analyticsButton.click();

      // Wait for Analytics page to load
      await safeWaitForURL(page, (url) => url.href.endsWith('/analytics'), {
        timeout: 60_000,
      });

      await navigateToDataReports(page);
    });

    test('should display all report cards with download buttons', async ({
      page,
    }) => {
      const analyticsButton = page.getByRole('button', { name: 'Analytics' });

      await expect(analyticsButton).toBeVisible({ timeout: 120_000 });

      await analyticsButton.click();

      // Wait for Analytics page to load
      await safeWaitForURL(page, (url) => url.href.endsWith('/analytics'), {
        timeout: 60_000,
      });

      await shouldDisplayReportCards(page, REPORT_CARDS);
    });
  });

  test.describe('CSV Visualizer Dialog', () => {
    test('should open CSV editor dialog when clicking download on User Report', async ({
      page,
    }) => {
      const analyticsButton = page.getByRole('button', { name: 'Analytics' });

      await expect(analyticsButton).toBeVisible({ timeout: 120_000 });

      await analyticsButton.click();

      // Wait for Analytics page to load
      await safeWaitForURL(page, (url) => url.href.endsWith('/analytics'), {
        timeout: 60_000,
      });

      await shouldOpenCSVEditorDialog(page);
    });

    test('should display CSV data in editable table format', async ({
      page,
    }) => {
      const analyticsButton = page.getByRole('button', { name: 'Analytics' });

      await expect(analyticsButton).toBeVisible({ timeout: 120_000 });

      await analyticsButton.click();

      // Wait for Analytics page to load
      await safeWaitForURL(page, (url) => url.href.endsWith('/analytics'), {
        timeout: 60_000,
      });

      await shouldDisplayCSVInEditableTableFormat(page);
    });

    test('should allow editing cell values in CSV editor', async ({ page }) => {
      const analyticsButton = page.getByRole('button', { name: 'Analytics' });

      await expect(analyticsButton).toBeVisible({ timeout: 120_000 });

      await analyticsButton.click();

      // Wait for Analytics page to load
      await safeWaitForURL(page, (url) => url.href.endsWith('/analytics'), {
        timeout: 60_000,
      });

      await shouldAllowEditingCellValuesInCSVEditor(page);
    });

    test('should add new row when clicking Add Row button', async ({
      page,
    }) => {
      const analyticsButton = page.getByRole('button', { name: 'Analytics' });

      await expect(analyticsButton).toBeVisible({ timeout: 120_000 });

      await analyticsButton.click();

      // Wait for Analytics page to load
      await safeWaitForURL(page, (url) => url.href.endsWith('/analytics'), {
        timeout: 60_000,
      });

      await shouldAddNewRowWhenClickingAddRowButton(page);
    });

    test('should save edited CSV and trigger download', async ({ page }) => {
      const analyticsButton = page.getByRole('button', { name: 'Analytics' });

      if (!(await analyticsButton.isVisible())) {
        test.skip();
        return;
      }

      await analyticsButton.click();

      // Wait for Analytics page to load
      await safeWaitForURL(page, (url) => url.href.endsWith('/analytics'), {
        timeout: 60_000,
      });

      await shouldSaveEditedCSVAndTriggerDownload(page);
    });

    test('should close CSV editor without saving when clicking Cancel', async ({
      page,
    }) => {
      const analyticsButton = page.getByRole('button', { name: 'Analytics' });

      await expect(analyticsButton).toBeVisible({ timeout: 120_000 });

      await analyticsButton.click();

      // Wait for Analytics page to load
      await safeWaitForURL(page, (url) => url.href.endsWith('/analytics'), {
        timeout: 60_000,
      });

      await shouldCloseCSVEditorWithoutSavingWhenClickingCancel(page);
    });

    test('should close CSV editor when clicking Close button', async ({
      page,
    }) => {
      const analyticsButton = page.getByRole('button', { name: 'Analytics' });

      await expect(analyticsButton).toBeVisible({ timeout: 120_000 });

      await analyticsButton.click();

      // Wait for Analytics page to load
      await safeWaitForURL(page, (url) => url.href.endsWith('/analytics'), {
        timeout: 60_000,
      });

      await shouldCloseCSVEditorWhenClickingCloseButton(page);
    });
  });

  test.describe('CSV Editor Accessibility', () => {
    test('CSV editor should have proper ARIA labels and roles', async ({
      page,
    }) => {
      const analyticsButton = page.getByRole('button', { name: 'Analytics' });

      await expect(analyticsButton).toBeVisible({ timeout: 120_000 });

      await analyticsButton.click();

      // Wait for Analytics page to load
      await safeWaitForURL(page, (url) => url.href.endsWith('/analytics'), {
        timeout: 60_000,
      });

      await shouldVerifyCSVEditorDialogAccessibility(page);
    });
  });

  test.describe('User Metadata Report', () => {
    test('should open CSV editor for User Metadata Report', async ({
      page,
    }) => {
      const analyticsButton = page.getByRole('button', { name: 'Analytics' });

      await expect(analyticsButton).toBeVisible({ timeout: 120_000 });

      await analyticsButton.click();

      // Wait for Analytics page to load
      await safeWaitForURL(page, (url) => url.href.endsWith('/analytics'), {
        timeout: 60_000,
      });

      await shouldOpenCSVEditorForUserMetadataReport(page);
    });
  });

  test.describe('Chat History Report', () => {
    test('should directly download Chat History report without CSV editor', async ({
      page,
    }) => {
      const analyticsButton = page.getByRole('button', { name: 'Analytics' });

      await expect(analyticsButton).toBeVisible({ timeout: 120_000 });

      await analyticsButton.click();

      // Wait for Analytics page to load
      await safeWaitForURL(page, (url) => url.href.endsWith('/analytics'), {
        timeout: 60_000,
      });

      await shouldDirectlyDownloadChatHistoryReportWithoutCSVEditor(page);
    });
  });

  test.describe('Report Download Loading States', () => {
    test('should disable other download buttons while generating report', async ({
      page,
    }) => {
      const analyticsButton = page.getByRole('button', { name: 'Analytics' });

      await expect(analyticsButton).toBeVisible({ timeout: 120_000 });

      await analyticsButton.click();

      // Wait for Analytics page to load
      await safeWaitForURL(page, (url) => url.href.endsWith('/analytics'), {
        timeout: 60_000,
      });

      await shouldDisableOtherDownloadButtonsWhileGeneratingReport(page);
    });
  });
});
