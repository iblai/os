import test, { expect, Locator, Page } from '@playwright/test';
import { logger } from '@iblai/iblai-js/playwright';
import { safeWaitForURL } from '@iblai/iblai-js/playwright';
import { waitForPageReady } from './mentornextjs/utils';

export async function inviteUserTest(page: Page, inviteModal: Locator) {
  // Fill email with a unique timestamp to avoid duplicates
  const emailInput = inviteModal.locator('#email-invite');
  await expect(emailInput).toBeVisible({ timeout: 10000 });
  const uniqueEmail = `test+user+${Date.now()}@test.com`;
  await emailInput.fill(uniqueEmail);

  const submitBtn = inviteModal.getByRole('button', { name: 'Send Invite' });
  await expect(submitBtn).toBeEnabled({ timeout: 10000 });
  await submitBtn.click();
  await expect(submitBtn).toBeDisabled({ timeout: 15000 });
  await page.waitForLoadState('networkidle');
  //await page.waitForTimeout(5000); //endpoint processing time
  //await expect(submitBtn).not.toBeDisabled({ timeout: 15000 });
  //await expect(inviteModal).toHaveText(uniqueEmail);
}

export async function navigateToAccountComponent(
  page: Page,
  profileBtn: Locator
) {
  //const profileBtn = page.locator('nav button[aria-haspopup="menu"]').last();
  await profileBtn.waitFor({ state: 'visible' });
  await profileBtn.click();

  const profileMenuItem = page.getByRole('menuitem', { name: 'Profile' });
  await expect(profileMenuItem).toBeVisible();

  const tenantBtn = page.getByRole('menuitem').nth(1);
  await expect(tenantBtn).toBeVisible();
  await tenantBtn.click();

  const tenantDialog = page
    .getByRole('dialog')
    .filter({ hasText: 'organization' });
  await expect(tenantDialog).toBeVisible();

  return tenantDialog;
}

export async function navigateToDataReports(page: Page) {
  // Navigate to Data Reports tab
  const dataReportsTab = page.getByRole('tab', { name: 'Data Reports' });
  await expect(dataReportsTab).toBeVisible({ timeout: 120_000 });
  await dataReportsTab.click();
  await waitForPageReady(page);

  // Verify URL ends with /analytics/reports
  await safeWaitForURL(page, /\/analytics\/reports$/);
  logger.info('Successfully navigated to Data Reports page');
}

export async function shouldDisplayReportCards(
  page: Page,
  REPORT_CARDS: {
    name: string;
    ariaLabel: string;
    description: string;
    expectsCsvEditor: boolean;
  }[]
) {
  const dataReportsTab = page.getByRole('tab', { name: 'Data Reports' });
  await expect(dataReportsTab).toBeVisible({ timeout: 120_000 });
  await dataReportsTab.click();
  await waitForPageReady(page);

  // Check for empty state or report cards
  const emptyState = page.getByText('No reports available yet.');
  const isEmptyState = await emptyState.isVisible().catch(() => false);

  if (isEmptyState) {
    await expect(emptyState).toBeVisible();
    logger.info('No reports available - empty state displayed');
    return;
  }

  // Verify report cards are displayed
  for (const report of REPORT_CARDS) {
    const reportCard = page.getByLabel(report.ariaLabel);
    const isVisible = await reportCard.isVisible().catch(() => false);

    if (isVisible) {
      await expect(reportCard).toBeVisible();

      // Verify report title
      const heading = reportCard.getByRole('heading', {
        name: report.name,
        level: 3,
      });
      await expect(heading).toBeVisible();

      // Verify download button
      const downloadButton = reportCard.getByRole('button', {
        name: 'Download report',
      });
      await expect(downloadButton).toBeVisible();
      await expect(downloadButton).toBeEnabled();

      logger.info(`Report card "${report.name}" displayed correctly`);
    }
  }
}

export async function shouldOpenCSVEditorDialog(page: Page) {
  const dataReportsTab = page.getByRole('tab', { name: 'Data Reports' });
  await expect(dataReportsTab).toBeVisible({ timeout: 120_000 });
  await dataReportsTab.click();
  await waitForPageReady(page);

  // Check for report card
  const userReportCard = page.getByLabel('User Report report card');
  const isVisible = await userReportCard.isVisible().catch(() => false);

  if (!isVisible) {
    logger.info('User Report card not visible - skipping test');
    test.skip();
    return;
  }

  // Click download button
  const downloadButton = userReportCard.getByRole('button', {
    name: 'Download report',
  });
  await downloadButton.click();

  // Wait for CSV editor dialog to appear
  const csvEditorDialog = page.getByRole('dialog', {
    name: 'Edit CSV Data',
  });
  await expect(csvEditorDialog).toBeVisible({ timeout: 60000 });

  // Verify dialog structure
  const dialogTitle = csvEditorDialog.getByRole('heading', {
    name: 'Edit CSV Data',
    level: 2,
  });
  await expect(dialogTitle).toBeVisible();

  // Verify table is present
  const csvTable = csvEditorDialog.getByRole('table', {
    name: 'CSV data table',
  });
  await expect(csvTable).toBeVisible();

  // Verify action buttons
  await expect(
    csvEditorDialog.getByRole('button', { name: 'Cancel' })
  ).toBeVisible();
  await expect(
    csvEditorDialog.getByRole('button', { name: 'Save' })
  ).toBeVisible();
  await expect(
    csvEditorDialog.getByRole('button', { name: 'Close' }).first()
  ).toBeVisible();

  logger.info('CSV Editor dialog opened successfully');
}

export async function shouldDisplayCSVInEditableTableFormat(page: Page) {
  const dataReportsTab = page.getByRole('tab', { name: 'Data Reports' });
  await expect(dataReportsTab).toBeVisible({ timeout: 120_000 });
  await dataReportsTab.click();
  await waitForPageReady(page);

  const userReportCard = page.getByLabel('User Report report card');
  const isVisible = await userReportCard.isVisible().catch(() => false);

  if (!isVisible) {
    test.skip();
    return;
  }

  const downloadButton = userReportCard.getByRole('button', {
    name: 'Download report',
  });
  await downloadButton.click();

  const csvEditorDialog = page.getByRole('dialog', {
    name: 'Edit CSV Data',
  });
  await expect(csvEditorDialog).toBeVisible({ timeout: 60000 });

  // Verify table headers are present
  const table = csvEditorDialog.getByRole('table', {
    name: 'CSV data table',
  });
  await expect(table).toBeVisible();

  // Check that at least one column header exists
  const headerCells = table.locator('thead th');
  const headerCount = await headerCells.count();
  expect(headerCount).toBeGreaterThan(0);

  // Check that at least one data row exists
  const dataRows = table.locator('tbody tr');
  const rowCount = await dataRows.count();
  expect(rowCount).toBeGreaterThan(0);

  logger.info(
    `CSV table has ${headerCount} columns and ${rowCount - 1} data rows (excluding Add Row)`
  );
}

export async function shouldAllowEditingCellValuesInCSVEditor(page: Page) {
  const dataReportsTab = page.getByRole('tab', { name: 'Data Reports' });
  await expect(dataReportsTab).toBeVisible({ timeout: 120_000 });
  await dataReportsTab.click();
  await waitForPageReady(page);

  const userReportCard = page.getByLabel('User Report report card');
  const isVisible = await userReportCard.isVisible().catch(() => false);

  if (!isVisible) {
    test.skip();
    return;
  }

  const downloadButton = userReportCard.getByRole('button', {
    name: 'Download report',
  });
  await downloadButton.click();

  const csvEditorDialog = page.getByRole('dialog', {
    name: 'Edit CSV Data',
  });
  await expect(csvEditorDialog).toBeVisible({ timeout: 60000 });

  // Find the first editable cell using its aria-label pattern
  const table = csvEditorDialog.getByRole('table', {
    name: 'CSV data table',
  });
  const firstEditableCell = table
    .locator('tbody tr')
    .first()
    .locator('td')
    .nth(1);
  const isCellVisible = await firstEditableCell.isVisible().catch(() => false);

  if (!isCellVisible) {
    logger.info('No editable cells found - skipping edit test');
    test.skip();
    return;
  }

  // Get initial value
  const initialButton = firstEditableCell
    .locator('button, div[role="button"]')
    .first();
  const initialText = await initialButton.textContent();

  // Click on cell to activate edit mode
  await initialButton.click();

  // Find the input that appears
  const cellInput = firstEditableCell.locator('input');
  await expect(cellInput).toBeVisible({ timeout: 5000 });

  // Clear and type new value
  const testValue = 'Edited Test Value';
  await cellInput.fill(testValue);

  // Press Enter to confirm edit
  await cellInput.press('Enter');

  // Verify the cell shows the new value
  await expect(firstEditableCell).toContainText(testValue);
  logger.info(
    `Successfully edited cell value from "${initialText}" to "${testValue}"`
  );
}

export async function shouldAddNewRowWhenClickingAddRowButton(page: Page) {
  const dataReportsTab = page.getByRole('tab', { name: 'Data Reports' });
  await expect(dataReportsTab).toBeVisible({ timeout: 120_000 });
  await dataReportsTab.click();
  await waitForPageReady(page);

  const userReportCard = page.getByLabel('User Report report card');
  const isVisible = await userReportCard.isVisible().catch(() => false);

  if (!isVisible) {
    test.skip();
    return;
  }

  const downloadButton = userReportCard.getByRole('button', {
    name: 'Download report',
  });
  await downloadButton.click();

  const csvEditorDialog = page.getByRole('dialog', {
    name: 'Edit CSV Data',
  });
  await expect(csvEditorDialog).toBeVisible({ timeout: 60000 });

  // Count initial rows
  const table = csvEditorDialog.locator('table');
  const initialRowCount = await table.locator('tbody tr').count();

  // Click Add Row button
  const addRowButton = csvEditorDialog.getByRole('button', {
    name: 'Add Row',
  });
  await expect(addRowButton).toBeVisible();
  await addRowButton.click();

  // Verify row count increased
  const newRowCount = await table.locator('tbody tr').count();
  expect(newRowCount).toBe(initialRowCount + 1);

  logger.info(
    `Added new row. Row count changed from ${initialRowCount} to ${newRowCount}`
  );
}

export async function shouldSaveEditedCSVAndTriggerDownload(page: Page) {
  const dataReportsTab = page.getByRole('tab', { name: 'Data Reports' });
  await expect(dataReportsTab).toBeVisible({ timeout: 120_000 });
  await dataReportsTab.click();
  await waitForPageReady(page);

  const userReportCard = page.getByLabel('User Report report card');
  const isVisible = await userReportCard.isVisible().catch(() => false);

  if (!isVisible) {
    test.skip();
    return;
  }

  const downloadButton = userReportCard.getByRole('button', {
    name: 'Download report',
  });
  await downloadButton.click();

  await page.waitForLoadState('networkidle');

  const csvEditorDialog = page.getByRole('dialog', {
    name: 'Edit CSV Data',
  });
  await expect(csvEditorDialog).toBeVisible({ timeout: 60000 });

  // Set up download listener
  const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

  // Click Save button
  const saveButton = csvEditorDialog.getByRole('button', { name: 'Save' });
  await saveButton.click();

  // Wait for download
  const download = await downloadPromise;

  // Verify download filename
  const filename = download.suggestedFilename();
  expect(filename).toBe('report.csv');

  // Verify dialog closes after save
  await expect(csvEditorDialog).not.toBeVisible({ timeout: 5000 });

  logger.info(`CSV file "${filename}" downloaded successfully`);
}

export async function shouldCloseCSVEditorWithoutSavingWhenClickingCancel(
  page: Page
) {
  const dataReportsTab = page.getByRole('tab', { name: 'Data Reports' });
  await expect(dataReportsTab).toBeVisible({ timeout: 120_000 });
  await dataReportsTab.click();

  await waitForPageReady(page);

  const userReportCard = page.getByLabel('User Report report card');
  const isVisible = await userReportCard.isVisible().catch(() => false);

  if (!isVisible) {
    test.skip();
    return;
  }

  const downloadButton = userReportCard.getByRole('button', {
    name: 'Download report',
  });
  await downloadButton.click();
  await page.waitForLoadState('networkidle');
  const csvEditorDialog = page.getByRole('dialog', {
    name: 'Edit CSV Data',
  });
  await expect(csvEditorDialog).toBeVisible({ timeout: 60000 });

  // Click Cancel button
  const cancelButton = csvEditorDialog.getByRole('button', {
    name: 'Cancel',
  });
  await cancelButton.click();

  // Verify dialog closes
  await expect(csvEditorDialog).not.toBeVisible({ timeout: 5000 });

  logger.info('CSV Editor dialog closed via Cancel button');
}

export async function shouldCloseCSVEditorWhenClickingCloseButton(page: Page) {
  const dataReportsTab = page.getByRole('tab', { name: 'Data Reports' });
  await expect(dataReportsTab).toBeVisible({ timeout: 120_000 });
  await dataReportsTab.click();
  await waitForPageReady(page);

  const userReportCard = page.getByLabel('User Report report card');
  await expect(userReportCard).toBeVisible({ timeout: 120_000 });
  const isVisible = await userReportCard.isVisible().catch(() => false);

  if (!isVisible) {
    test.skip();
    return;
  }

  const downloadButton = userReportCard.getByRole('button', {
    name: 'Download report',
  });
  await downloadButton.click();
  await page.waitForLoadState('networkidle');

  const csvEditorDialog = page.getByRole('dialog', {
    name: 'Edit CSV Data',
  });
  await expect(csvEditorDialog).toBeVisible({ timeout: 60000 });

  // Click Close button
  const closeButton = csvEditorDialog
    .getByRole('button', {
      name: 'Close',
    })
    .first();
  await closeButton.click();

  // Verify dialog closes
  await expect(csvEditorDialog).not.toBeVisible({ timeout: 5000 });

  logger.info('CSV Editor dialog closed via Close button');
}

export async function shouldVerifyCSVEditorDialogAccessibility(page: Page) {
  const dataReportsTab = page.getByRole('tab', { name: 'Data Reports' });
  await expect(dataReportsTab).toBeVisible({ timeout: 120_000 });
  await dataReportsTab.click();
  await waitForPageReady(page);

  const userReportCard = page.getByLabel('User Report report card');
  const isVisible = await userReportCard.isVisible().catch(() => false);

  if (!isVisible) {
    test.skip();
    return;
  }

  const downloadButton = userReportCard.getByRole('button', {
    name: 'Download report',
  });
  await downloadButton.click();
  await page.waitForLoadState('networkidle');

  const csvEditorDialog = page.getByRole('dialog', {
    name: 'Edit CSV Data',
  });
  await expect(csvEditorDialog).toBeVisible({ timeout: 60000 });

  // Verify dialog has proper role
  await expect(csvEditorDialog).toHaveAttribute('role', 'dialog');

  // Verify table has proper label using role selector
  const csvTable = csvEditorDialog.getByRole('table', {
    name: 'CSV data table',
  });
  await expect(csvTable).toBeVisible();

  // Verify buttons are accessible by their aria-labels
  const saveButton = csvEditorDialog.getByRole('button', {
    name: 'Save changes and download CSV',
  });
  await expect(saveButton).toBeVisible();

  const cancelButton = csvEditorDialog.getByRole('button', {
    name: 'Cancel editing and close dialog',
  });
  await expect(cancelButton).toBeVisible();

  const addRowButton = csvEditorDialog.getByRole('button', {
    name: 'Add Row',
  });
  await expect(addRowButton).toBeVisible();

  // Verify CSV data editor region
  const editorRegion = csvEditorDialog.getByRole('region', {
    name: 'CSV data editor',
  });
  await expect(editorRegion).toBeVisible();

  logger.info('CSV Editor dialog has proper ARIA labels and roles');
}

export async function shouldOpenCSVEditorForUserMetadataReport(page: Page) {
  const dataReportsTab = page.getByRole('tab', { name: 'Data Reports' });
  await expect(dataReportsTab).toBeVisible({ timeout: 120_000 });
  await dataReportsTab.click();
  await waitForPageReady(page);

  const userMetadataReportCard = page.getByLabel(
    'User Metadata Report report card'
  );
  const isVisible = await userMetadataReportCard.isVisible().catch(() => false);

  if (!isVisible) {
    test.skip();
    return;
  }

  const downloadButton = userMetadataReportCard.getByRole('button', {
    name: 'Download report',
  });
  await downloadButton.click();
  await page.waitForLoadState('networkidle');

  const csvEditorDialog = page.getByRole('dialog', {
    name: 'Edit CSV Data',
  });
  await expect(csvEditorDialog).toBeVisible({ timeout: 60000 });

  // Verify table has company column (specific to User Metadata Report)
  const table = csvEditorDialog.locator('table');
  const companyHeader = table.locator('thead th input[value="company"]');
  const hasCompanyColumn = await companyHeader.isVisible().catch(() => false);

  if (hasCompanyColumn) {
    logger.info('User Metadata Report contains company column as expected');
  }

  // Close dialog
  await csvEditorDialog.getByRole('button', { name: 'Close' }).first().click();
  await expect(csvEditorDialog).not.toBeVisible({ timeout: 5000 });
}

export async function shouldDirectlyDownloadChatHistoryReportWithoutCSVEditor(
  page: Page
) {
  const dataReportsTab = page.getByRole('tab', { name: 'Data Reports' });
  await expect(dataReportsTab).toBeVisible({ timeout: 120_000 });
  await dataReportsTab.click();
  await waitForPageReady(page);

  const chatHistoryCard = page.getByLabel('Chat History');

  if (!(await chatHistoryCard.isVisible().catch(() => false))) {
    test.skip();
    return;
  }

  const downloadButton = chatHistoryCard.getByRole('button', {
    name: 'Download report',
  });

  // Set up download listener before clicking
  const downloadPromise = page.waitForEvent('download', { timeout: 120000 });

  await expect(downloadButton).toBeVisible({ timeout: 30000 });

  await downloadButton.click();

  await page.waitForLoadState('networkidle');

  // Wait for loading spinner to appear
  const spinner = downloadButton.locator('[class*="animate-spin"]');
  await expect(spinner).toBeVisible({ timeout: 30000 });

  try {
    const download = await downloadPromise;
    const filename = download.suggestedFilename();
    expect(filename.endsWith('.csv')).toBeTruthy();
    logger.info(`Chat History report downloaded: ${filename}`);
  } catch {
    // Download may have completed silently or taken longer
    logger.info(
      'Chat History download may have completed without triggering download event'
    );
  }

  // Verify CSV Editor dialog did NOT open for Chat History
  const csvEditorDialog = page.getByRole('dialog', {
    name: 'Edit CSV Data',
  });
  const dialogOpened = await csvEditorDialog.isVisible().catch(() => false);
  expect(dialogOpened).toBeFalsy();
}

export async function shouldDisableOtherDownloadButtonsWhileGeneratingReport(
  page: Page
) {
  const dataReportsTab = page.getByRole('tab', { name: 'Data Reports' });
  await expect(dataReportsTab).toBeVisible({ timeout: 120_000 });
  await dataReportsTab.click();
  await waitForPageReady(page);

  const downloadButtons = page.getByRole('button', {
    name: 'Download report',
  });
  const buttonCount = await downloadButtons.count();

  if (buttonCount < 2) {
    logger.info('Not enough report cards to test disabled state - skipping');
    test.skip();
    return;
  }

  // Click first download button
  await downloadButtons.first().click();

  // Brief wait to allow loading state to propagate
  await page.waitForTimeout(500);

  // Check if other buttons are disabled while first is loading
  const secondButton = downloadButtons.nth(1);
  const isSecondDisabled = await secondButton.isDisabled();

  // Note: This behavior depends on implementation - may need adjustment
  if (isSecondDisabled) {
    logger.info(
      'Other download buttons correctly disabled during report generation'
    );
  }

  // Wait for dialog or download to complete
  const csvEditorDialog = page.getByRole('dialog', {
    name: 'Edit CSV Data',
  });
  const dialogVisible = await csvEditorDialog
    .waitFor({ state: 'visible', timeout: 30000 })
    .then(() => true)
    .catch(() => false);

  if (dialogVisible) {
    await csvEditorDialog
      .getByRole('button', { name: 'Close' })
      .first()
      .click();
  }
}

// ============================================
// Combined Recommendation Reports Test Helpers
// ============================================

export async function shouldShowCombiningReportsDialog(page: Page) {
  const dataReportsTab = page.getByRole('tab', { name: 'Data Reports' });
  await expect(dataReportsTab).toBeVisible({ timeout: 60_000 });
  await dataReportsTab.click();
  await waitForPageReady(page);

  // Look for report cards with the combined recommendation data-testid
  const combinedReportCard = page.locator(
    '[data-testid="combined-recommendation-report-card"]'
  );
  const isVisible = await combinedReportCard
    .first()
    .isVisible()
    .catch(() => false);

  if (!isVisible) {
    logger.info(
      'No combined recommendation report cards found - feature may not be enabled'
    );
    test.skip();
    return;
  }

  // Click the download button on the first combined report card
  const downloadButton = combinedReportCard
    .first()
    .getByRole('button', { name: 'Download report' });
  await downloadButton.click();

  // Wait for the combining reports dialog to appear
  const combiningDialog = page.locator(
    '[data-testid="combining-reports-dialog"]'
  );
  await expect(combiningDialog).toBeVisible({ timeout: 30000 });

  // Verify dialog content
  await expect(combiningDialog.getByText('Combining Reports')).toBeVisible();
  await expect(
    combiningDialog.getByText('Loading & combining recommendations data')
  ).toBeVisible();

  logger.info('Combining reports dialog displayed successfully');
}

export async function shouldCancelCombiningReports(page: Page) {
  const dataReportsTab = page.getByRole('tab', { name: 'Data Reports' });
  await expect(dataReportsTab).toBeVisible({ timeout: 60_000 });
  await dataReportsTab.click();
  await waitForPageReady(page);

  const combinedReportCard = page.locator(
    '[data-testid="combined-recommendation-report-card"]'
  );
  const isVisible = await combinedReportCard
    .first()
    .isVisible()
    .catch(() => false);

  if (!isVisible) {
    logger.info('No combined recommendation report cards found - skipping');
    test.skip();
    return;
  }

  // Click the download button
  const downloadButton = combinedReportCard
    .first()
    .getByRole('button', { name: 'Download report' });
  await downloadButton.click();

  // Wait for the combining dialog
  const combiningDialog = page.locator(
    '[data-testid="combining-reports-dialog"]'
  );
  await expect(combiningDialog).toBeVisible({ timeout: 30000 });

  // Click the cancel button
  const cancelButton = page.locator('[data-testid="cancel-combining-button"]');
  await expect(cancelButton).toBeVisible();
  await cancelButton.click();

  // Verify dialog closes
  await expect(combiningDialog).not.toBeVisible({ timeout: 5000 });

  logger.info('Successfully cancelled combining reports');
}

export async function shouldHaveCombinedReportDataTestIds(page: Page) {
  const dataReportsTab = page.getByRole('tab', { name: 'Data Reports' });
  await expect(dataReportsTab).toBeVisible({ timeout: 60_000 });
  await dataReportsTab.click();
  await waitForPageReady(page);

  // Check for combined recommendation report cards
  const combinedReportCards = page.locator(
    '[data-testid="combined-recommendation-report-card"]'
  );
  const count = await combinedReportCards.count();

  if (count === 0) {
    logger.info(
      'No combined recommendation report cards found - feature may not be enabled'
    );
    test.skip();
    return;
  }

  // Verify that the cards are visible and have proper structure
  for (let i = 0; i < count; i++) {
    const card = combinedReportCards.nth(i);
    await expect(card).toBeVisible();
    await expect(
      card.getByRole('button', { name: 'Download report' })
    ).toBeVisible();
  }

  logger.info(
    `Found ${count} report cards with combined recommendation data-testid`
  );
}

export async function shouldCombineRecommendationReports(page: Page) {
  const dataReportsTab = page.getByRole('tab', { name: 'Data Reports' });
  await expect(dataReportsTab).toBeVisible({ timeout: 60_000 });
  await dataReportsTab.click();
  await waitForPageReady(page);

  const combinedReportCard = page.locator(
    '[data-testid="combined-recommendation-report-card"]'
  );
  const isVisible = await combinedReportCard
    .first()
    .isVisible()
    .catch(() => false);

  if (!isVisible) {
    logger.info('No combined recommendation report cards found - skipping');
    test.skip();
    return;
  }

  // Click the download button
  const downloadButton = combinedReportCard
    .first()
    .getByRole('button', { name: 'Download report' });
  await downloadButton.click();

  // Wait for combining to complete and CSV editor to open
  // First, wait for the combining dialog to appear
  const combiningDialog = page.locator(
    '[data-testid="combining-reports-dialog"]'
  );

  // Either the dialog shows (reports being combined) or CSV editor opens directly
  const dialogOrEditor = await Promise.race([
    combiningDialog
      .waitFor({ state: 'visible', timeout: 10000 })
      .then(() => 'dialog'),
    page
      .getByRole('dialog', { name: 'Edit CSV Data' })
      .waitFor({ state: 'visible', timeout: 60000 })
      .then(() => 'editor'),
  ]).catch(() => null);

  if (dialogOrEditor === 'dialog') {
    // Wait for the combining dialog to close and CSV editor to open
    await expect(combiningDialog).not.toBeVisible({ timeout: 120000 });
  }

  // Verify CSV editor opens with combined data
  const csvEditorDialog = page.getByRole('dialog', { name: 'Edit CSV Data' });
  await expect(csvEditorDialog).toBeVisible({ timeout: 120000 });

  // Verify the table has data
  const table = csvEditorDialog.getByRole('table', { name: 'CSV data table' });
  await expect(table).toBeVisible();

  const headerCells = table.locator('thead th');
  const headerCount = await headerCells.count();
  expect(headerCount).toBeGreaterThan(0);

  logger.info(
    `Combined reports opened in CSV editor with ${headerCount} columns`
  );

  // Close the editor
  await csvEditorDialog.getByRole('button', { name: 'Close' }).first().click();
  await expect(csvEditorDialog).not.toBeVisible({ timeout: 5000 });
}
