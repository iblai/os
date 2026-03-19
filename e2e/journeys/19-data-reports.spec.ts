import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { parsePlatformUrl, safeWaitForURL } from '../utils/navigation';
import { MENTOR_NEXTJS_HOST, PLAYWRIGHT_TENANT_KEY } from '../fixtures/test-data';
import {
  navigateToDataReports,
  shouldDisplayReportCards,
  shouldOpenCSVEditorDialog,
  shouldDisplayCSVInEditableTableFormat,
  shouldAllowEditingCellValuesInCSVEditor,
  shouldAddNewRowWhenClickingAddRowButton,
  shouldSaveEditedCSVAndTriggerDownload,
  shouldCloseCSVEditorWithoutSavingWhenClickingCancel,
  shouldCloseCSVEditorWhenClickingCloseButton,
  shouldVerifyCSVEditorDialogAccessibility,
  shouldOpenCSVEditorForUserMetadataReport,
  shouldDirectlyDownloadChatHistoryReportWithoutCSVEditor,
  shouldDisableOtherDownloadButtonsWhileGeneratingReport,
  navigateToReportDownload,
  verifyPreparingPhase,
  verifyErrorPhase,
  clickBackHome,
  clickDownloadAgain,
  waitForReportDownload,
} from '@iblai/iblai-js/playwright';

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
    expectsCsvEditor: false,
  },
];

test.describe('Journey 19: Data Reports', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) test.skip(true, 'Data reports requires admin access');
  });

  // ── Data Reports Feature (requires real user/chat data in env) ────────────

  test('admin goes to analytics page and navigates to the Data Reports tab', async ({
    page,
    analyticsPage,
  }) => {
    await analyticsPage.goto();
    await navigateToDataReports(page);
  });

  test('admin goes to Data Reports tab and verifies all report cards display with download buttons', async ({
    page,
    analyticsPage,
  }) => {
    await analyticsPage.goto();
    await shouldDisplayReportCards(page, REPORT_CARDS);
  });

  test('admin goes to Data Reports tab and opens the CSV editor by clicking download on User Report', async ({
    page,
    analyticsPage,
  }) => {
    await analyticsPage.goto();
    await shouldOpenCSVEditorDialog(page);
  });

  test('admin goes to CSV editor and verifies data displays in editable table format', async ({
    page,
    analyticsPage,
  }) => {
    await analyticsPage.goto();
    await shouldDisplayCSVInEditableTableFormat(page);
  });

  test('admin goes to CSV editor and edits a cell value', async ({
    page,
    analyticsPage,
  }) => {
    await analyticsPage.goto();
    await shouldAllowEditingCellValuesInCSVEditor(page);
  });

  test('admin goes to CSV editor and adds a new row by clicking the Add Row button', async ({
    page,
    analyticsPage,
  }) => {
    await analyticsPage.goto();
    await shouldAddNewRowWhenClickingAddRowButton(page);
  });

  test('admin goes to CSV editor and saves the edited CSV which triggers a file download', async ({
    page,
    analyticsPage,
  }) => {
    await analyticsPage.goto();
    await shouldSaveEditedCSVAndTriggerDownload(page);
  });

  test('admin goes to CSV editor and clicks Cancel to close without saving', async ({
    page,
    analyticsPage,
  }) => {
    await analyticsPage.goto();
    await shouldCloseCSVEditorWithoutSavingWhenClickingCancel(page);
  });

  test('admin goes to CSV editor and closes it with the Close button', async ({
    page,
    analyticsPage,
  }) => {
    await analyticsPage.goto();
    await shouldCloseCSVEditorWhenClickingCloseButton(page);
  });

  test('admin goes to CSV editor and verifies it has proper ARIA labels and roles', async ({
    page,
    analyticsPage,
  }) => {
    await analyticsPage.goto();
    await shouldVerifyCSVEditorDialogAccessibility(page);
  });

  test('admin goes to Data Reports tab and opens the CSV editor for the User Metadata Report', async ({
    page,
    analyticsPage,
  }) => {
    await analyticsPage.goto();
    await shouldOpenCSVEditorForUserMetadataReport(page);
  });

  test('admin goes to Data Reports tab and downloads the Chat History report directly without CSV editor', async ({
    page,
    analyticsPage,
  }) => {
    await analyticsPage.goto();
    await shouldDirectlyDownloadChatHistoryReportWithoutCSVEditor(page);
  });

  test('admin goes to Data Reports tab and verifies other download buttons are disabled while generating', async ({
    page,
    analyticsPage,
  }) => {
    await analyticsPage.goto();
    await shouldDisableOtherDownloadButtonsWhileGeneratingReport(page);
  });

  // ── Report Download Page ──────────────────────────────────────────────────

  test('admin goes to the report download page and verifies the preparing phase is shown', async ({
    page,
  }) => {
    let tenantKey = PLAYWRIGHT_TENANT_KEY;
    if (!tenantKey) {
      const { platformKey } = parsePlatformUrl(page.url());
      tenantKey = platformKey;
    }
    await navigateToReportDownload(page, {
      baseUrl: MENTOR_NEXTJS_HOST,
      platformKey: tenantKey,
      reportName: 'user-report',
    });
    await verifyPreparingPhase(page);
  });

  test('admin goes to the report download page and completes the full download flow', async ({
    page,
  }) => {
    let tenantKey = PLAYWRIGHT_TENANT_KEY;
    if (!tenantKey) {
      const { platformKey } = parsePlatformUrl(page.url());
      tenantKey = platformKey;
    }
    await waitForReportDownload(page, {
      baseUrl: MENTOR_NEXTJS_HOST,
      platformKey: tenantKey,
      reportName: 'user-report',
      timeout: 120_000,
    });
  });

  test('admin goes to the report download page and clicks Download Again after completion', async ({
    page,
  }) => {
    let tenantKey = PLAYWRIGHT_TENANT_KEY;
    if (!tenantKey) {
      const { platformKey } = parsePlatformUrl(page.url());
      tenantKey = platformKey;
    }
    await waitForReportDownload(page, {
      baseUrl: MENTOR_NEXTJS_HOST,
      platformKey: tenantKey,
      reportName: 'user-report',
      timeout: 120_000,
    });
    await clickDownloadAgain(page);
  });

  test('admin goes to the report download page and clicks Back Home to return to the platform', async ({
    page,
  }) => {
    let tenantKey = PLAYWRIGHT_TENANT_KEY;
    if (!tenantKey) {
      const { platformKey } = parsePlatformUrl(page.url());
      tenantKey = platformKey;
    }
    await navigateToReportDownload(page, {
      baseUrl: MENTOR_NEXTJS_HOST,
      platformKey: tenantKey,
      reportName: 'user-report',
    });
    await verifyPreparingPhase(page);
    await clickBackHome(page);
    await safeWaitForURL(page, (url) => url.pathname === '/', { timeout: 30_000 });
  });

  test('admin goes to the report download page with an invalid report name and sees the error phase', async ({
    page,
  }) => {
    let tenantKey = PLAYWRIGHT_TENANT_KEY;
    if (!tenantKey) {
      const { platformKey } = parsePlatformUrl(page.url());
      tenantKey = platformKey;
    }
    await navigateToReportDownload(page, {
      baseUrl: MENTOR_NEXTJS_HOST,
      platformKey: tenantKey,
      reportName: 'nonexistent-report',
    });
    await verifyErrorPhase(page, { timeout: 120_000 });
  });
});
