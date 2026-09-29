import { Page, Locator, expect } from '@playwright/test';
import { isVisibleWithin } from '../../utils/resilient';

export class HistoryTab {
  readonly page: Page;
  readonly dialog: Locator;

  readonly conversationRows: Locator;
  readonly emptyState: Locator;
  readonly nextButton: Locator;
  readonly exportButton: Locator;
  readonly sentimentFilter: Locator;
  readonly topicFilter: Locator;
  readonly previewPanel: Locator;
  /** The scrollable conversation list (rows are its direct children). */
  readonly conversationList: Locator;
  /** Owner label of each list row: a "View profile for …" button when the
   *  user has a platform profile, else a plain span (LTI-only / Anonymous). */
  readonly rowOwners: Locator;
  readonly linkedRowOwners: Locator;
  /** Owner label of the selected conversation in the preview pane/dialog. */
  readonly previewOwner: Locator;
  /** The shared Profile viewer an owner link opens (same as Management → Users). */
  readonly ownerProfileDialog: Locator;
  /** "Tools · N" chips on list rows. */
  readonly rollupBadges: Locator;
  /** "Documents · N" chips on list rows: the chat's documents dialog, one click away. */
  readonly documentsChips: Locator;
  /** The chat's "Retrieved Documents" dialog (opened by any sources control). */
  readonly retrievedDocumentsDialog: Locator;
  /** Per-turn "Show Details" / "Hide Details" toggles in the transcript. */
  readonly turnDetailsToggles: Locator;
  readonly turnDetailsPanels: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.conversationList = dialog.getByRole('region', {
      name: /conversation list/i,
    });
    // Rows are the list region's direct children. (Owner links and topic
    // tags carry `cursor-pointer` too, so a class-based locator would match
    // them first.)
    this.conversationRows = this.conversationList.locator('> div');
    this.rowOwners = this.conversationList.getByTestId(
      'history-conversation-owner',
    );
    this.linkedRowOwners = this.conversationList.getByRole('button', {
      name: /^view profile for /i,
    });
    this.previewOwner = dialog.getByTestId('history-preview-owner');
    this.ownerProfileDialog = page.getByTestId('user-profile-link-dialog');
    this.rollupBadges = this.conversationList.getByTestId(
      'transcript-rollup-badges',
    );
    this.documentsChips = this.conversationList.getByTestId(
      'retrieved-documents-button',
    );
    this.retrievedDocumentsDialog = page
      .getByRole('dialog')
      .filter({ hasText: /retrieved documents/i });
    this.turnDetailsToggles = dialog.getByRole('button', {
      name: /^(show|hide) details$/i,
    });
    this.turnDetailsPanels = dialog.getByTestId('transcript-turn-details');
    this.emptyState = dialog.getByText(/no conversations/i);
    this.nextButton = dialog.getByRole('button', { name: /next/i });
    this.exportButton = dialog.getByRole('button', { name: /export/i });
    this.sentimentFilter = dialog
      .getByRole('combobox', { name: /sentiment/i })
      .first();
    this.topicFilter = dialog.getByRole('combobox', { name: /topic/i }).first();
    this.previewPanel = dialog
      .locator(
        '[class*="preview"], [class*="transcript"], [data-testid*="preview"]',
      )
      .first();
  }

  async hasConversations(): Promise<boolean> {
    return isVisibleWithin(this.conversationRows.first(), 15_000);
  }

  async clickFirstRow(): Promise<void> {
    await expect(this.conversationRows.first()).toBeVisible({
      timeout: 10_000,
    });
    await this.conversationRows.first().click();
  }

  async triggerExport(): Promise<import('@playwright/test').Download> {
    const [download] = await Promise.all([
      this.page.waitForEvent('download', { timeout: 120_000 }),
      this.exportButton.click(),
    ]);
    return download;
  }
}
