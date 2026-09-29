import { Page, Locator, expect } from '@playwright/test';

/**
 * Copy for the SDK's `AgentApiTab` (`@iblai/web-containers` →
 * `@iblai/iblai-js/web-containers/next`), pinned here against the compiled
 * bundle's `AGENT_API_TAB_LABELS` i18n catalog entry. OS's `ApiTab` wrapper
 * (`components/modals/edit-mentor-modal/tabs/api-tab.tsx`) passes no
 * `labels` override, so these are exactly what renders (see the
 * `messages/en.json` diff on this branch removing OS's now-dead
 * `apiTabApiKeyModal` / `apiTabCreateApiModal` / `apiTabDeleteApiModal` /
 * `tabsApiTab` override keys — same story as the Tools tab, tracked in the
 * `project_settings_tab_label_override` / Tools-tab agent memory notes).
 */
const LABELS = {
  header: {
    title: 'API',
    description: 'Manage API keys and integrations.',
  },
  infoBox:
    'Use this agent from your own apps. Create API keys here to call it programmatically and build it into your product or workflow.',
  disclaimer: {
    lineOne:
      'Your secret API keys are listed below. Please note that we do not display your secret API keys again after you generate them.',
  },
  table: {
    emptyState: 'No API keys found',
    notAvailable: 'N/A',
    deleteAriaLabel: 'Delete API Key',
  },
  actions: {
    createNew: 'Create New',
  },
  createModal: {
    title: 'Create API Key',
    nameLabel: 'API Key Name',
    nameRequired: 'API Key name is required',
    nameInvalid: 'can only contain letters, numbers, and hyphens',
    expirationPlaceholder: 'Pick a date',
    submit: 'Submit',
    submitting: 'Submitting...',
    cancel: 'Cancel',
    successToast: 'API Key created successfully',
    errorToast: 'Failed to create API Key',
  },
  deleteModal: {
    title: 'Delete API Key',
    confirm: 'Delete',
    confirming: 'Deleting...',
    cancel: 'Cancel',
    successToast: 'API Key deleted successfully',
  },
  apiKeyModal: {
    title: 'API Key',
    copyAriaLabel: 'Copy API key',
    copiedAriaLabel: 'Copied',
  },
  pagination: {
    navLabel: 'pagination',
    prevLabel: 'Go to previous page',
    nextLabel: 'Go to next page',
  },
  calendar: {
    nextMonth: 'Go to the Next Month',
    previousMonth: 'Go to the Previous Month',
  },
  dialogClose: 'Close',
};

export class ApiTab {
  readonly page: Page;
  readonly dialog: Locator;

  static readonly LABELS = LABELS;

  readonly heading: Locator;
  readonly description: Locator;
  readonly infoBox: Locator;
  readonly createButton: Locator;
  readonly table: Locator;
  readonly rows: Locator;
  readonly paginationNav: Locator;
  readonly paginationPrev: Locator;
  readonly paginationNext: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;

    this.heading = this.dialog.getByRole('heading', {
      name: LABELS.header.title,
      exact: true,
    });
    this.description = this.dialog.getByText(LABELS.header.description, {
      exact: true,
    });
    this.infoBox = this.dialog.getByTestId('api-info-box');
    this.createButton = this.dialog.getByTestId('api-key-create-button');
    this.table = this.dialog.getByRole('table');
    this.rows = this.table.locator('tbody tr');

    // `IblPagination` renders a plain `<nav role="navigation" aria-label="pagination">`
    // (`ui/pagination.tsx`) and is NOT portalled, so it stays scoped to the
    // dialog. Its Prev/Next/page links are `<a>` elements with no `href`
    // (`onClick`-driven), which per the ARIA spec have no implicit "link"
    // role — `getByRole('link', ...)` would not resolve them. Raw attribute/
    // tag CSS locators sidestep that entirely.
    this.paginationNav = this.dialog.getByRole('navigation', {
      name: LABELS.pagination.navLabel,
    });
    this.paginationPrev = this.paginationNav.locator(
      `a[aria-label="${LABELS.pagination.prevLabel}"]`,
    );
    this.paginationNext = this.paginationNav.locator(
      `a[aria-label="${LABELS.pagination.nextLabel}"]`,
    );
  }

  // ── Table ────────────────────────────────────────────────────────────────

  /** A row matched by its exact NAME cell text. */
  rowByName(name: string): Locator {
    return this.rows.filter({
      has: this.page.getByRole('cell', { name, exact: true }),
    });
  }

  /** The EXPIRES cell (3rd column) for a row, e.g. a PPP date string or "N/A". */
  expiresCellFor(name: string): Locator {
    return this.rowByName(name).locator('td').nth(2);
  }

  deleteButtonFor(name: string): Locator {
    return this.rowByName(name).getByRole('button', {
      name: LABELS.table.deleteAriaLabel,
    });
  }

  /** Every NAME cell's text on the currently-visible page, in row order. */
  async rowNames(): Promise<string[]> {
    const count = await this.rows.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await this.rows.nth(i).locator('td').first().textContent();
      names.push(text?.trim() ?? '');
    }
    return names;
  }

  // ── Pagination ───────────────────────────────────────────────────────────

  async hasPagination(): Promise<boolean> {
    return (await this.paginationNav.count()) > 0;
  }

  /** A specific page-number link (exact text match — avoids "1" matching "10"). */
  pageNumberLink(n: number): Locator {
    return this.paginationNav
      .locator('a')
      .filter({ hasText: new RegExp(`^${n}$`) });
  }

  async goToPage(n: number): Promise<void> {
    await this.pageNumberLink(n).click();
  }

  async goToNextPage(): Promise<void> {
    await this.paginationNext.click();
  }

  async goToPreviousPage(): Promise<void> {
    await this.paginationPrev.click();
  }

  async isNextPageDisabled(): Promise<boolean> {
    return (await this.paginationNext.getAttribute('aria-disabled')) === 'true';
  }

  /**
   * Walks forward from page 1 looking for a row named `name`, returning the
   * 1-indexed page it was found on (or `null` if it's nowhere in
   * `maxPages`). Used instead of assuming new/target rows sit on page 1 —
   * newest-first ordering means OUR rows normally do, but this is the
   * documented fallback for callers that must not assume that (see the
   * pagination checkpoint's class-doc note on tenant data ordering).
   */
  async findPageContaining(
    name: string,
    maxPages = 20,
  ): Promise<number | null> {
    if (await this.hasPagination()) {
      const first = this.pageNumberLink(1);
      if ((await first.count()) > 0) await first.click();
    }
    for (let p = 1; p <= maxPages; p++) {
      await expect(this.table).toBeVisible({ timeout: 10_000 });
      if ((await this.rowByName(name).count()) > 0) return p;
      if (!(await this.hasPagination())) return null;
      if (await this.isNextPageDisabled()) return null;
      await this.goToNextPage();
      // Settle on the new page's fetch before the next iteration's row check.
      await this.page.waitForTimeout(300);
    }
    return null;
  }

  // ── Create dialog (portalled to `document.body` — page-scoped) ─────────────

  get createDialog(): Locator {
    return this.page.getByRole('dialog', {
      name: LABELS.createModal.title,
      exact: true,
    });
  }

  async openCreateDialog(): Promise<void> {
    await expect(this.createButton).toBeVisible({ timeout: 10_000 });
    await this.createButton.click();
    await expect(this.createDialog).toBeVisible({ timeout: 10_000 });
  }

  nameInput(): Locator {
    // The `<Label>` renders "API Key Name" immediately followed by a red
    // "*" required-marker span with no separating space, so the accessible
    // name is "API Key Name*" — match the stable prefix.
    return this.createDialog.getByLabel(
      new RegExp(`^${LABELS.createModal.nameLabel}`),
    );
  }

  nameErrorText(): Locator {
    return this.createDialog.getByText(
      new RegExp(
        `${LABELS.createModal.nameRequired}|${LABELS.createModal.nameInvalid}`,
      ),
    );
  }

  /**
   * The expiration date popover trigger. Its own accessible name flips
   * between "Pick a date" and a formatted PPP date depending on state, so it
   * is matched via Radix's `aria-haspopup="dialog"` (set unconditionally on
   * every `PopoverTrigger`) instead — stable regardless of which label is
   * currently showing, and there is only one Popover in this dialog.
   */
  expirationTrigger(): Locator {
    return this.createDialog.locator('button[aria-haspopup="dialog"]');
  }

  submitButton(): Locator {
    return this.createDialog.getByRole('button', {
      name: LABELS.createModal.submit,
      exact: true,
    });
  }

  cancelButton(): Locator {
    return this.createDialog.getByRole('button', {
      name: LABELS.createModal.cancel,
      exact: true,
    });
  }

  async closeCreateDialogViaCancel(): Promise<void> {
    if ((await this.createDialog.count()) === 0) return;
    await this.cancelButton().click();
    await expect(this.createDialog).toHaveCount(0, { timeout: 5_000 });
  }

  // ── Calendar popover (react-day-picker; also portalled — page-scoped) ──────

  /** The day grid. react-day-picker renders `role="grid"` on its `MonthGrid`. */
  get calendarGrid(): Locator {
    return this.page.getByRole('grid');
  }

  get calendarNextMonthButton(): Locator {
    return this.page.getByRole('button', {
      name: LABELS.calendar.nextMonth,
      exact: true,
    });
  }

  get calendarPreviousMonthButton(): Locator {
    return this.page.getByRole('button', {
      name: LABELS.calendar.previousMonth,
      exact: true,
    });
  }

  async openCalendar(): Promise<void> {
    await this.expirationTrigger().click();
    await expect(this.calendarGrid).toBeVisible({ timeout: 5_000 });
  }

  /** Every currently-rendered, selectable (non-disabled) day button. */
  enabledDayButtons(): Locator {
    return this.calendarGrid.locator('button:not([disabled])');
  }

  /**
   * Clicks an arbitrary enabled day in the open calendar and returns its
   * accessible name (react-day-picker's `labelDayButton`, formatted `PPPP`,
   * e.g. "Friday, October 16th, 2026").
   *
   * Regression guard for the calendar popover bug (fixed via
   * `pointer-events-auto` in the SDK's `ui/popover.tsx`): asserts the
   * enclosing Create dialog is STILL open immediately after the click —
   * before the fix, this click fell through the popover to the dialog's own
   * overlay and closed the whole Create Key dialog.
   */
  async pickAnyEnabledDay(): Promise<string> {
    const days = this.enabledDayButtons();
    const count = await days.count();
    expect(count, 'Calendar has no selectable day to pick').toBeGreaterThan(0);
    const day = days.nth(Math.floor(count / 2));
    const label = (await day.getAttribute('aria-label')) ?? '';
    await day.click();
    await expect(
      this.createDialog,
      'Create API Key dialog closed after picking a calendar day — the popover-overlay click-through bug has regressed',
    ).toBeVisible({ timeout: 2_000 });
    return label;
  }

  // ── Full create flow ─────────────────────────────────────────────────────

  successToast(text: string): Locator {
    return this.page.getByText(text).first();
  }

  /**
   * Opens Create, fills the name, optionally picks an expiration date (via
   * the calendar, advancing a month first when asked), submits, and waits
   * for the success toast + reveal ("API Key") dialog. Returns the picked
   * day's accessible-name label (`null` when no date was picked) so callers
   * can derive the PPP string the new row's EXPIRES cell should show.
   */
  async createKey(options: {
    name: string;
    pickExpiration?: boolean;
    advanceMonth?: boolean;
  }): Promise<{ dayLabel: string | null }> {
    await this.openCreateDialog();
    await this.nameInput().fill(options.name);

    let dayLabel: string | null = null;
    if (options.pickExpiration) {
      await this.openCalendar();
      if (options.advanceMonth) {
        await this.calendarNextMonthButton.click();
        await this.page.waitForTimeout(200);
      }
      dayLabel = await this.pickAnyEnabledDay();
    }

    await this.submitButton().click();
    await expect(
      this.successToast(LABELS.createModal.successToast),
    ).toBeVisible({ timeout: 15_000 });
    await expect(this.revealDialog).toBeVisible({ timeout: 10_000 });
    return { dayLabel };
  }

  // ── Reveal ("API Key") dialog (page-scoped) ─────────────────────────────

  get revealDialog(): Locator {
    return this.page.getByRole('dialog', {
      name: LABELS.apiKeyModal.title,
      exact: true,
    });
  }

  /**
   * The copy button, matched by EITHER of its two accessible-name states
   * (`useCopyToClipboard`'s `status` flips its `aria-label` between "Copy
   * API key" and "Copied" — there is no other stable attribute to key off).
   */
  revealCopyToggleButton(): Locator {
    return this.revealDialog.getByRole('button', {
      name: new RegExp(
        `^(${LABELS.apiKeyModal.copyAriaLabel}|${LABELS.apiKeyModal.copiedAriaLabel})$`,
      ),
    });
  }

  async isRevealedKeyCopied(): Promise<boolean> {
    return (
      (await this.revealDialog
        .getByRole('button', {
          name: LABELS.apiKeyModal.copiedAriaLabel,
          exact: true,
        })
        .count()) > 0
    );
  }

  revealCloseButton(): Locator {
    return this.revealDialog.getByRole('button', {
      name: LABELS.dialogClose,
      exact: true,
    });
  }

  async closeRevealDialog(): Promise<void> {
    await this.revealCloseButton().click();
    await expect(this.revealDialog).toHaveCount(0, { timeout: 5_000 });
  }

  /**
   * Closes the reveal ("API Key") dialog AND the Create dialog underneath
   * it. Both stay mounted simultaneously after a successful create (`apiKey`
   * state keeps the Create dialog open behind the reveal one — see
   * `CreateApiModal`), so `closeRevealDialog()` alone leaves the Create
   * dialog open and, with it, the parent Edit Agent dialog `aria-hidden`
   * (Radix's stacked-dialog `hideOthers`) until this also runs. Callers that
   * need to get back to the table after a create should use this rather
   * than `closeRevealDialog()` alone.
   */
  async dismissCreateFlow(): Promise<void> {
    await this.closeRevealDialog();
    await this.closeCreateDialogViaCancel();
  }

  // ── Delete dialog (page-scoped) ─────────────────────────────────────────

  get deleteDialog(): Locator {
    return this.page.getByRole('dialog', {
      name: LABELS.deleteModal.title,
      exact: true,
    });
  }

  async openDeleteDialogFor(name: string): Promise<void> {
    await this.deleteButtonFor(name).click();
    await expect(this.deleteDialog).toBeVisible({ timeout: 10_000 });
  }

  deleteConfirmButton(): Locator {
    return this.deleteDialog.getByRole('button', {
      name: LABELS.deleteModal.confirm,
      exact: true,
    });
  }

  deleteCancelButton(): Locator {
    return this.deleteDialog.getByRole('button', {
      name: LABELS.deleteModal.cancel,
      exact: true,
    });
  }

  async confirmDelete(): Promise<void> {
    await this.deleteConfirmButton().click();
    await expect(
      this.successToast(LABELS.deleteModal.successToast),
    ).toBeVisible({ timeout: 15_000 });
    await expect(this.deleteDialog).toHaveCount(0, { timeout: 10_000 });
  }

  async cancelDelete(): Promise<void> {
    await this.deleteCancelButton().click();
    await expect(this.deleteDialog).toHaveCount(0, { timeout: 5_000 });
  }

  // ── Naming ────────────────────────────────────────────────────────────────

  /**
   * A resource name that is unlikely to collide with other parallel workers
   * or retries, and is safely reapable as stale residue after
   * `STALE_AFTER_MS` (see `utils/api-key-residue.ts`). Mirrors
   * `LtiTab.uniqueName` exactly — same `<prefix>-<ts13>-<rand5>` shape.
   */
  static uniqueName(prefix = 'e2e-apikey'): string {
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 7);
    return `${prefix}-${ts}-${rand}`;
  }
}
