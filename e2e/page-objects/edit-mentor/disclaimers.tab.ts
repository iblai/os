import { Page, Locator, expect } from '@playwright/test';

export class DisclaimersTab {
  readonly page: Page;
  readonly dialog: Locator;

  readonly userAgreementSwitch: Locator;
  readonly activeStatus: Locator;
  // H20 fix: the Edit button is just labeled "Edit", not "Edit Agreement"
  readonly editButtons: Locator;

  // #2507: "View Agreements" button + the agreements list dialog it opens.
  // The button lives inside the Disclaimers tab (scoped to `dialog`), but the
  // dialog it opens is a Radix Dialog rendered via Portal to document.body —
  // a sibling of the Edit Agent dialog, not a descendant — so everything
  // below is scoped from `page`, not `dialog`.
  readonly viewAgreementsButton: Locator;
  readonly agreementsDialog: Locator;
  readonly agreementsSummary: Locator;
  readonly agreementsCount: Locator;
  readonly agreementsBanner: Locator;
  readonly agreementsSearch: Locator;
  readonly agreementsEmpty: Locator;
  readonly agreementsLoading: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.userAgreementSwitch = dialog.getByRole('switch', {
      name: /user agreement/i,
    });
    this.activeStatus = dialog.getByText('Active').first();
    // H20 fix: buttons are just "Edit" — first is User Agreement, second is Advisory
    this.editButtons = dialog.getByRole('button', { name: 'Edit' });
    this.saveButton = dialog.getByRole('button', { name: /save/i }).first();

    this.viewAgreementsButton = dialog.getByTestId('view-agreements-button');
    this.agreementsDialog = page.getByTestId('disclaimer-agreements');
    this.agreementsSummary = this.agreementsDialog.getByTestId(
      'disclaimer-agreements-summary',
    );
    this.agreementsCount = this.agreementsDialog.getByTestId(
      'disclaimer-agreements-count',
    );
    this.agreementsBanner = this.agreementsDialog.getByTestId(
      'disclaimer-agreements-banner',
    );
    this.agreementsSearch = this.agreementsDialog.getByTestId(
      'disclaimer-agreements-search',
    );
    this.agreementsEmpty = this.agreementsDialog.getByTestId(
      'disclaimer-agreements-empty',
    );
    this.agreementsLoading = this.agreementsDialog.getByTestId(
      'disclaimer-agreements-loading',
    );
  }

  /** A single agreement row, scoped by the platform username on `data-username`. */
  agreementRow(username: string): Locator {
    return this.agreementsDialog.locator(
      `[data-testid="disclaimer-agreement-row"][data-username="${username}"]`,
    );
  }

  async openAgreements(): Promise<void> {
    await expect(this.viewAgreementsButton).toBeVisible({ timeout: 10_000 });
    await this.viewAgreementsButton.click();
    await expect(this.agreementsDialog).toBeVisible({ timeout: 10_000 });
  }

  async closeAgreements(): Promise<void> {
    // Click the dialog's own Close button rather than pressing Escape: an open
    // Radix tooltip (e.g. after hovering an agreed-at cell) swallows the first
    // Escape, which would leave the dialog open.
    await this.agreementsDialog
      .getByRole('button', { name: /^close$/i })
      .click();
    await expect(this.agreementsDialog).not.toBeVisible({ timeout: 10_000 });
  }

  async enableUserAgreement(): Promise<void> {
    await expect(this.userAgreementSwitch).toBeVisible({ timeout: 10_000 });
    const isEnabled =
      (await this.userAgreementSwitch.getAttribute('aria-checked')) === 'true';
    if (!isEnabled) {
      await this.userAgreementSwitch.click();
      await expect(this.userAgreementSwitch).toHaveAttribute(
        'aria-checked',
        'true',
        { timeout: 10_000 },
      );
    }
  }

  async disableUserAgreement(): Promise<void> {
    await expect(this.userAgreementSwitch).toBeVisible({ timeout: 10_000 });
    const isEnabled =
      (await this.userAgreementSwitch.getAttribute('aria-checked')) === 'true';
    if (isEnabled) {
      await this.userAgreementSwitch.click();
      await expect(this.userAgreementSwitch).toHaveAttribute(
        'aria-checked',
        'false',
        { timeout: 10_000 },
      );
    }
  }

  async isUserAgreementEnabled(): Promise<boolean> {
    return (
      (await this.userAgreementSwitch
        .getAttribute('aria-checked')
        .catch(() => 'false')) === 'true'
    );
  }

  // H20 fix: open the Edit User Agreement modal (first Edit button)
  async openEditUserAgreementModal(): Promise<Locator> {
    await expect(this.editButtons.first()).toBeVisible({ timeout: 10_000 });
    await this.editButtons.first().click();
    const editModal = this.page
      .getByRole('dialog')
      .filter({ hasText: /edit|user agreement/i })
      .last();
    await expect(editModal).toBeVisible({ timeout: 10_000 });
    return editModal;
  }

  // H21 fix: open the Edit Advisory modal (second Edit button)
  // The advisory text is inside a separate modal, NOT inline in the tab
  async openEditAdvisoryModal(): Promise<Locator> {
    await expect(this.editButtons.nth(1)).toBeVisible({ timeout: 10_000 });
    await this.editButtons.nth(1).click();
    const editModal = this.page
      .getByRole('dialog')
      .filter({ hasText: /edit.*advisory|advisory/i })
      .last();
    await expect(editModal).toBeVisible({ timeout: 10_000 });
    return editModal;
  }
}
