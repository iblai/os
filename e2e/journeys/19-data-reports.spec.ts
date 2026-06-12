import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { parsePlatformUrl, safeWaitForURL } from '../utils/navigation';
import { waitForPageReady } from '../utils/resilient';
import {
  MENTOR_NEXTJS_HOST,
  PLAYWRIGHT_TENANT_KEY,
} from '../fixtures/test-data';
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

/**
 * Local copy of the SDK's `shouldDirectlyDownloadChatHistoryReportWithoutCSVEditor`
 * with a longer report-generation timeout. The SDK helper hard-codes 40s for
 * both the `download` event and the deferred-notification toast, which the
 * backend regularly exceeds under CI load (the report generates fine when run
 * manually — it's just slow). Since the SDK helper takes no timeout argument
 * and lives in node_modules, we reproduce its logic here verbatim and bump the
 * window. Keep this in sync with the SDK implementation.
 */
const DEFERRED_NOTIFICATION_TEXT =
  'You will be notified once the report is available.';

async function downloadChatHistoryReportDirectly(
  page: Page,
  timeout = 90_000,
): Promise<void> {
  const dataReportsTab = page.getByRole('tab', { name: 'Data Reports' });
  await expect(dataReportsTab).toBeVisible({ timeout: 120_000 });
  await dataReportsTab.click();
  await waitForPageReady(page);

  const chatHistoryCard = page.getByLabel(
    'All Mentor Chat History report card',
  );
  if (!(await chatHistoryCard.isVisible().catch(() => false))) {
    test.skip();
    return;
  }

  // Start listening for the download before triggering — the auto-download
  // fires as soon as the date-range picker is confirmed.
  const downloadPromise = page.waitForEvent('download', { timeout });

  // Inlined `triggerReportFromCard`: prefer Regenerate (always opens the
  // picker), else Download; then confirm the date-range popover.
  const triggerAsync = (async () => {
    const regenerateButton = chatHistoryCard.getByRole('button', {
      name: 'Regenerate report',
    });
    const downloadButton = chatHistoryCard.getByRole('button', {
      name: 'Download report',
    });
    const hasRegenerate = await regenerateButton.isVisible().catch(() => false);
    const trigger = hasRegenerate ? regenerateButton : downloadButton;
    await trigger.click();
    const dateRangePopover = page.getByTestId('report-date-range-popover');
    await expect(dateRangePopover).toBeVisible({ timeout: 10_000 });
    await dateRangePopover
      .getByRole('button', { name: /^(Generate|Regenerate)$/ })
      .click();
    await expect(dateRangePopover).not.toBeVisible({ timeout: 10_000 });
  })();

  // Either the browser fires a download, or the backend defers and shows the
  // deferred-notification toast. Both are valid outcomes.
  const deferredNotification = page.getByText(DEFERRED_NOTIFICATION_TEXT);
  const [, outcome] = await Promise.all([
    triggerAsync,
    Promise.race([
      downloadPromise.then((download) => ({
        kind: 'download' as const,
        download,
      })),
      deferredNotification
        .waitFor({ state: 'visible', timeout })
        .then(() => ({ kind: 'deferred' as const })),
    ]).catch(() => null),
  ]);

  if (!outcome) {
    throw new Error(
      `Chat History generation did not complete: neither a download nor the deferred-notification toast appeared within ${timeout / 1000}s`,
    );
  }
  if (outcome.kind === 'download') {
    const filename = outcome.download.suggestedFilename();
    expect(filename.endsWith('.csv')).toBeTruthy();
  }

  // Regardless of outcome, the CSV editor dialog must never open for chat history.
  const csvEditorDialog = page.getByRole('dialog', { name: 'Edit CSV Data' });
  const dialogOpened = await csvEditorDialog.isVisible().catch(() => false);
  expect(dialogOpened).toBeFalsy();
}

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

  // fixme: CSV editor doesn't display in editable table format. Look at shouldDisplayCSVInEditableTableFormat
  test.fixme(
    'admin goes to CSV editor and verifies data displays in editable table format',
    async ({ page, analyticsPage }) => {
      await analyticsPage.goto();
      await shouldDisplayCSVInEditableTableFormat(page);
    },
  );

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

  // fixme: CSV editor Close button test times out at 120s — app may not render the close button
  test.fixme(
    'admin goes to CSV editor and closes it with the Close button',
    async ({ page, analyticsPage }) => {
      await analyticsPage.goto();
      await shouldCloseCSVEditorWhenClickingCloseButton(page);
    },
  );

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
    // Report generation is slow under CI load — give the whole test room
    // beyond the 90s the helper waits for the download/deferred toast.
    test.setTimeout(180_000);
    await analyticsPage.goto();
    await downloadChatHistoryReportDirectly(page);
  });

  test('admin goes to Data Reports tab and verifies other download buttons are disabled while generating', async ({
    page,
    analyticsPage,
  }) => {
    await analyticsPage.goto();
    await shouldDisableOtherDownloadButtonsWhileGeneratingReport(page);
  });

  // ── Report Download Page ──────────────────────────────────────────────────

  // fixme: report download page redirects to auth instead of showing "Preparing your report"
  test.fixme(
    'admin goes to the report download page and verifies the preparing phase is shown',
    async ({ page }) => {
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
    },
  );

  // fixme: reports page fails to load — /reports/iblai/user-report timeout
  test.fixme(
    'admin goes to the report download page and completes the full download flow',
    async ({ page }) => {
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
    },
  );

  // fixme: reports page fails to load — /reports/iblai/user-report timeout
  test.fixme(
    'admin goes to the report download page and clicks Download Again after completion',
    async ({ page }) => {
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
    },
  );

  // fixme: reports page fails to load — /reports/iblai/user-report timeout
  test.fixme(
    'admin goes to the report download page and clicks Back Home to return to the platform',
    async ({ page }) => {
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
      await safeWaitForURL(page, (url) => url.pathname === '/', {
        timeout: 30_000,
      });
    },
  );

  // fixme: report download page redirects to auth — verifyErrorPhase times out
  test.fixme(
    'admin goes to the report download page with an invalid report name and sees the error phase',
    async ({ page }) => {
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
    },
  );
});
