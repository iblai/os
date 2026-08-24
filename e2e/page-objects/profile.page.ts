import { Page, Locator, expect } from '@playwright/test';
import type { Download } from '@playwright/test';
import {
  isMemoryTabVisible,
  switchToMemoryTab,
  verifyMemoryTabSettings,
  verifyMemoryTabMemoriesList,
  openAddMemoryDialog,
  toggleMemorySwitch,
  addMemory,
  deleteFirstMemory,
  deleteMemoryByContent,
  getMemoryCount,
  verifyMemoryExists,
  verifyMemoryNotExists,
  openHistoryTab,
  switchHistorySubTab,
  getConversationList,
  getConversationPreview,
  getConversationRows,
  waitForConversations,
  selectConversation,
  downloadConversationCsv,
  filterHistoryByAgent,
  clearHistoryAgentFilter,
  filterHistoryBySentiment,
  filterHistoryByTopic,
  startHistoryExport,
  exportHistoryAndWaitForDownload,
  getExportsTable,
  getExportRowsByState,
  waitForCompletedExportRow,
  downloadExportedReport,
  HISTORY_TAB_LABELS,
} from '@iblai/iblai-js/playwright';
import type {
  HistorySubTab,
  HistorySentiment,
} from '@iblai/iblai-js/playwright';

export class ProfilePage {
  readonly page: Page;

  readonly modal: Locator;
  readonly closeButton: Locator;
  readonly tabNav: Locator;
  readonly tabs: Locator;

  // Basic tab
  readonly fullNameField: Locator;
  readonly emailField: Locator;
  readonly titleField: Locator;
  readonly aboutField: Locator;
  readonly languageSelector: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  // Social tab
  readonly linkedInField: Locator;
  readonly twitterField: Locator;
  readonly facebookField: Locator;

  // Education tab
  readonly addEducationButton: Locator;

  // Experience tab
  readonly addExperienceButton: Locator;

  // Resume tab
  readonly uploadResumeButton: Locator;

  // Security tab
  readonly sendPasswordResetButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = page.getByRole('dialog', { name: /profile/i });
    this.closeButton = this.modal.getByRole('button', {
      name: 'Close',
      exact: true,
    });
    this.tabNav = this.modal.getByRole('navigation', { name: /profile tabs/i });
    this.tabs = this.tabNav.getByRole('tablist');

    this.fullNameField = this.modal
      .getByLabel(/full name/i)
      .or(this.modal.getByPlaceholder(/full name/i));
    this.emailField = this.modal
      .getByLabel(/email/i)
      .or(this.modal.getByPlaceholder(/email/i));
    this.titleField = this.modal
      .getByLabel(/title/i)
      .or(this.modal.getByPlaceholder(/title/i));
    this.aboutField = this.modal
      .getByLabel(/about/i)
      .or(this.modal.locator('textarea[name*="about"]'));
    this.languageSelector = this.modal.getByRole('combobox', {
      name: /language/i,
    });
    this.saveButton = this.modal.getByRole('button', { name: /save/i }).first();
    this.cancelButton = this.modal.getByRole('button', { name: /cancel/i });

    this.linkedInField = this.modal
      .getByRole('textbox', { name: 'LinkedIn' })
      .or(this.modal.getByPlaceholder(/linkedin/i));
    this.twitterField = this.modal
      .getByRole('textbox', { name: 'X' })
      .or(this.modal.getByPlaceholder('X'));
    this.facebookField = this.modal
      .getByRole('textbox', { name: 'Facebook' })
      .or(this.modal.getByPlaceholder('Facebook'));

    this.addEducationButton = this.modal
      .getByRole('button', {
        name: /add education/i,
      })
      .first();
    this.addExperienceButton = this.modal
      .getByRole('button', {
        name: /add experience/i,
      })
      .first();
    this.uploadResumeButton = this.modal
      .getByRole('button', {
        name: 'Upload resume',
        exact: true,
      })
      .filter({ hasText: 'Upload resume' });
    this.sendPasswordResetButton = this.modal.getByRole('button', {
      name: /send password reset/i,
    });
  }

  async open(): Promise<void> {
    const profileDropdown = this.page.getByRole('button', {
      name: 'More options',
    });
    await expect(profileDropdown).toBeVisible({ timeout: 10_000 });
    await profileDropdown.click();
    const profileItem = this.page.getByRole('menuitem', { name: /profile/i });
    await expect(profileItem).toBeVisible({ timeout: 5_000 });
    await profileItem.click();
    await expect(this.modal).toBeVisible({ timeout: 15_000 });
  }

  async close(): Promise<void> {
    await expect(this.closeButton).toBeVisible({ timeout: 5_000 });
    await this.closeButton.click();
    await expect(this.modal).not.toBeVisible({ timeout: 10_000 });
  }

  async switchToTab(tabName: string): Promise<void> {
    const tab = this.tabNav
      .getByRole('tab', { name: new RegExp(tabName, 'i') })
      .first();
    await expect(tab).toBeVisible({ timeout: 5_000 });
    await tab.click();
    await this.page.waitForTimeout(300);
  }

  activeTab(tabName: string): Locator {
    return this.tabNav.getByRole('tab', {
      name: new RegExp(tabName, 'i'),
      selected: true,
    });
  }

  async switchToSubTab(subTabName: string): Promise<void> {
    const subTab = this.modal
      .getByRole('tabpanel')
      .getByRole('tab', { name: new RegExp(`^${subTabName}$`, 'i') })
      .first();
    await expect(subTab).toBeVisible({ timeout: 5_000 });
    await subTab.click();
    await this.page.waitForTimeout(300);
  }

  async save(): Promise<void> {
    await expect(this.saveButton).toBeEnabled({ timeout: 5_000 });
    await this.saveButton.click();
    await expect(this.page.getByText(/saved|success/i)).toBeVisible({
      timeout: 10_000,
    });
  }

  async openAddEducationDialog(): Promise<Locator> {
    await expect(this.addEducationButton).toBeVisible({ timeout: 10_000 });
    await this.addEducationButton.click();
    const dialog = this.page
      .getByRole('dialog')
      .filter({ hasText: /education/i })
      .last();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    return dialog;
  }

  async openAddExperienceDialog(): Promise<Locator> {
    await expect(this.addExperienceButton).toBeVisible({ timeout: 10_000 });
    await this.addExperienceButton.click();
    const dialog = this.page
      .getByRole('dialog')
      .filter({ hasText: /experience/i })
      .last();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    return dialog;
  }

  // ---------------------------------------------------------------------------
  // Memory tab ("My Memories" — personal profile side)
  // ---------------------------------------------------------------------------
  //
  // Rendered by the SDK's `MemoryTab` (`@iblai/iblai-js/web-containers/next`)
  // — the host wires it in unconditionally (`enableMemoryTab={true}` in
  // `app/platform/[tenantKey]/[mentorId]/_components/nav-bar/user-profile.tsx`).
  // All DOM access below flows through the SDK's official Playwright helpers
  // (`@iblai/iblai-js/playwright`, `memory-test-helpers.d.ts`) EXCEPT
  // `editMemoryByContent`, which the SDK has no helper for (only add/delete
  // are covered) — see its own doc comment for the gap and the hand-rolled
  // selectors used to fill it, all stable aria/testid hooks.

  /** Whether the "Memory" tab exists and is visible in the profile modal. */
  isMemoryTabVisible(): Promise<boolean> {
    return isMemoryTabVisible(this.page);
  }

  /** Switch to the "Memory" tab. Assumes the profile modal is open and the tab is visible. */
  switchToMemoryTab(): Promise<void> {
    return switchToMemoryTab(this.page);
  }

  /** Assert the "Memory & Personalization" settings section (both switches) is visible. */
  verifyMemoryTabSettings(): Promise<void> {
    return verifyMemoryTabSettings(this.page);
  }

  /** Assert the "My Memories" section (list + Add Memory button) is visible. */
  verifyMemoryTabMemoriesList(): Promise<void> {
    return verifyMemoryTabMemoriesList(this.page);
  }

  /** Open the Add Memory dialog. Assumes the Memory tab is active. */
  openAddMemoryDialog(): Promise<Locator> {
    return openAddMemoryDialog(this.page);
  }

  /**
   * Toggle a memory setting switch (match by its accessible-name prefix,
   * e.g. `/^Auto memory capture/i` or `/^Use memory in responses/i` — the
   * full name carries the current state suffix). Returns the new checked
   * state; gated on `aria-checked` flipping.
   */
  toggleMemorySwitch(switchName: RegExp | string): Promise<boolean> {
    return toggleMemorySwitch(this.page, switchName);
  }

  /** Add a memory via the Add Memory dialog (content must be ≥10 characters). */
  addMemory(content: string): Promise<void> {
    return addMemory(this.page, content);
  }

  /** Delete the first visible memory via its three-dots menu + confirm dialog. */
  deleteFirstMemory(): Promise<void> {
    return deleteFirstMemory(this.page);
  }

  /** Delete a memory matched by content via its three-dots menu + confirm dialog. */
  deleteMemoryByContent(content: string): Promise<void> {
    return deleteMemoryByContent(this.page, content);
  }

  /** Count of visible memory rows (0 when the empty state is shown). */
  getMemoryCount(): Promise<number> {
    return getMemoryCount(this.page);
  }

  verifyMemoryExists(content: string): Promise<void> {
    return verifyMemoryExists(this.page, content);
  }

  verifyMemoryNotExists(content: string): Promise<void> {
    return verifyMemoryNotExists(this.page, content);
  }

  /**
   * Edit a memory found by its current content via the three-dots menu →
   * Edit → Edit Memory dialog → Save.
   *
   * GAP: the SDK's `memory-test-helpers.d.ts` covers add/delete for the
   * profile Memory tab but has no edit helper (only the tenant-admin
   * popup's `editUserGlobalMemory` exists, in `memory-admin-helpers.d.ts`).
   * Both surfaces render the exact same `MemoriesList` component though
   * (confirmed in the SDK bundle: "Shared by the profile Memory tab and the
   * tenant-settings memory popup so the two stay identical"), so this
   * reimplements the same three-dots → Edit → dialog flow using the same
   * stable hooks `deleteMemoryByContent` uses for its own menu step:
   *   - row: `data-testid="memory-row"` filtered by `currentContent`
   *   - three-dots trigger: `aria-label` prefix "Memory actions:" (the SDK's
   *     `MEMORY_ADMIN_LABELS.menu.actionsAriaPrefix` — shared translation key)
   *   - menu portals to `<body>`; only one dropdown is ever open at once, so
   *     an unscoped `getByRole('menuitem', { name: 'Edit', exact: true })`
   *     is safe (mirrors the SDK's own `deleteMemoryRow` internal helper)
   *   - the Edit Memory dialog has accessible name "Edit Memory" (Radix
   *     wires `DialogTitle` → `aria-labelledby`) and a real `<Textarea>`
   *     labelled "Memory Content" (`id="edit-memory-content"`, not a
   *     ProseMirror contenteditable) — `getByLabel` resolves it directly.
   */
  async editMemoryByContent(
    currentContent: string,
    newContent: string,
  ): Promise<void> {
    const row = this.modal
      .getByTestId('memory-row')
      .filter({ hasText: currentContent });
    await expect(row).toBeVisible({ timeout: 10_000 });

    const trigger = row.getByRole('button', { name: /^Memory actions:/ });
    await trigger.click();

    const editItem = this.page.getByRole('menuitem', {
      name: 'Edit',
      exact: true,
    });
    await expect(editItem).toBeVisible({ timeout: 5_000 });
    await editItem.click();

    const editDialog = this.page.getByRole('dialog', {
      name: 'Edit Memory',
      exact: true,
    });
    await expect(editDialog).toBeVisible({ timeout: 10_000 });

    const textarea = editDialog.getByLabel('Memory Content');
    await expect(textarea).toBeVisible({ timeout: 5_000 });
    await textarea.fill(newContent);

    const saveButton = editDialog.getByRole('button', {
      name: 'Save Memory',
      exact: true,
    });
    await expect(saveButton).toBeEnabled({ timeout: 5_000 });
    await saveButton.click();

    await expect(editDialog).toBeHidden({ timeout: 10_000 });
  }

  // ---------------------------------------------------------------------------
  // History tab ("History" — profile-level chat history across every agent)
  // ---------------------------------------------------------------------------
  //
  // Rendered by the SDK's `ChatHistoryTab` (`@iblai/iblai-js/web-containers/next`,
  // wired inside `UserProfileDropdown`). Unlike the Memory tab there is no
  // `enableHistoryTab` prop — the tab is unconditional and only renders on the
  // user's OWN profile (it rides the user-scoped `my-chat-history*`
  // endpoints). Two sub-tabs: "Conversations" (filter toolbar + two-column
  // list/preview) and "Exports" (a table of previously generated personal
  // chat-history reports). All DOM access flows through the SDK's official
  // Playwright helpers (`@iblai/iblai-js/playwright`,
  // `history-tab-helpers.d.ts`), which scope every sub-element to a SINGLE
  // profile-dialog locator captured tag-first (`getByRole('dialog')` +
  // `.filter(...)`) — see that file's own header for the anti-flake
  // rationale. There is no delete/clear affordance on this tab (confirmed
  // against the SDK bundle) — it is view/filter/export only.

  /**
   * Open the "History" tab (the profile modal must already be open, e.g. via
   * `open()`) and wait for its Conversations sub-tab to settle into either
   * rendered rows or the empty state. Returns the scoped dialog locator every
   * other History method below expects.
   */
  openHistoryTab(): Promise<Locator> {
    return openHistoryTab(this.page);
  }

  /** Switch between the "Conversations" and "Exports" sub-tabs. */
  switchHistorySubTab(dialog: Locator, subTab: HistorySubTab): Promise<void> {
    return switchHistorySubTab(dialog, subTab);
  }

  /** The Conversations sub-tab's list region (`aria-label="Conversation list"`). */
  getConversationList(dialog: Locator): Locator {
    return getConversationList(dialog);
  }

  /** The Conversations sub-tab's transcript preview region. */
  getConversationPreview(dialog: Locator): Locator {
    return getConversationPreview(dialog);
  }

  /** Every conversation row (each row is a `role="button"`). */
  getConversationRows(dialog: Locator): Locator {
    return getConversationRows(dialog);
  }

  /**
   * A single conversation row identified by its backend session id — the SDK
   * component stamps each row with `data-testid="history-conversation-row"`
   * and `data-session-id={session.id}`. This is the most solid anchor for a
   * SPECIFIC conversation: matching by list position ("first row") would race
   * against other parallel workers appending new sessions under the same
   * shared admin storageState, and matching by title/text races against the
   * backend's asynchronous session-title generation (same hazard documented
   * in journey 53's Recent-chats checkpoints).
   */
  historyConversationRow(dialog: Locator, sessionId: string): Locator {
    return dialog.locator(
      `[data-testid="history-conversation-row"][data-session-id="${sessionId}"]`,
    );
  }

  /** Wait for the conversation area to settle: rows rendered, or the empty state. */
  waitForConversations(dialog: Locator): Promise<void> {
    return waitForConversations(dialog);
  }

  /** The "No conversations found" empty-state text (structural — renders regardless of data). */
  conversationsEmptyState(dialog: Locator): Locator {
    return dialog.getByText(HISTORY_TAB_LABELS.emptyState, { exact: true });
  }

  /** The Conversations toolbar's agent autocomplete (placeholder & accessible name "Search Agents"). */
  historyAgentFilterInput(dialog: Locator): Locator {
    return dialog.getByPlaceholder(HISTORY_TAB_LABELS.filters.searchAgents);
  }

  /** The Conversations toolbar's date-range picker trigger button. */
  historyDateRangeButton(dialog: Locator): Locator {
    return dialog.getByRole('button', {
      name: HISTORY_TAB_LABELS.filters.pickDateRange,
    });
  }

  /** The Conversations toolbar's sentiment filter select trigger. */
  historySentimentFilter(dialog: Locator): Locator {
    return dialog.getByRole('combobox', {
      name: HISTORY_TAB_LABELS.filters.sentiment,
    });
  }

  /** The Conversations toolbar's topic filter select trigger. */
  historyTopicFilter(dialog: Locator): Locator {
    return dialog.getByRole('combobox', {
      name: HISTORY_TAB_LABELS.filters.topic,
    });
  }

  /** The Conversations toolbar's Export button. */
  historyExportButton(dialog: Locator): Locator {
    return dialog.getByRole('button', {
      name: HISTORY_TAB_LABELS.filters.export,
      exact: true,
    });
  }

  /** The Exports sub-tab's "No exports yet." empty-state text. */
  exportsEmptyState(dialog: Locator): Locator {
    return dialog.getByText(HISTORY_TAB_LABELS.exports.empty, {
      exact: true,
    });
  }

  /**
   * Click a conversation row (by zero-based `index` or first-row `title`
   * substring match) and wait for the transcript preview to show its
   * per-conversation Download button.
   */
  selectConversation(
    dialog: Locator,
    options?: { index?: number; title?: string },
  ): Promise<void> {
    return selectConversation(dialog, options);
  }

  /** Download the currently previewed conversation as CSV. */
  downloadConversationCsv(dialog: Locator): Promise<Download> {
    return downloadConversationCsv(dialog);
  }

  /** Type into the agent autocomplete and pick the matching agent, collapsing to a selected chip. */
  filterHistoryByAgent(dialog: Locator, agentName: string): Promise<void> {
    return filterHistoryByAgent(dialog, agentName);
  }

  /**
   * Filter History by SOME agent the mentors search index actually knows,
   * preferring `preferredName`. Returns the selected agent's label.
   *
   * The agent autocomplete is served by the search-index-backed mentors
   * endpoint, and the index lags mentor creation by minutes (the same
   * product limitation MA-06 in journey 70 documents). `preferredName`
   * often resolves from the navbar's mentor dropdown — i.e. the account's
   * MOST RECENTLY ACCESSED mentor, which on the shared e2e account is
   * routinely a minutes-old, not-yet-indexed mentor another journey just
   * created. Checkpoints that only need *an* agent selected (filter
   * round-trip, export tracking) shouldn't fail on that, so this tries the
   * full preferred name, then its first word, then its first two
   * characters, and clicks the FIRST option the search returns.
   */
  async filterHistoryByAnyIndexedAgent(
    dialog: Locator,
    preferredName: string,
  ): Promise<string> {
    const input = dialog.getByTestId('history-agent-filter-input');
    await expect(input).toBeVisible({ timeout: 10_000 });

    const options = dialog
      .getByTestId('history-agent-filter-results')
      .getByRole('button');

    const firstWord = preferredName.split(/\s+/)[0] ?? '';
    const terms = [
      preferredName,
      ...(firstWord.length >= 2 && firstWord !== preferredName
        ? [firstWord]
        : []),
      preferredName.slice(0, 2),
    ];

    let found = false;
    let lastError: unknown;
    for (const term of terms) {
      await input.fill(term);
      try {
        await expect(options.first()).toBeVisible({ timeout: 10_000 });
        found = true;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!found) throw lastError;

    // The option button renders the label in its first span (an optional
    // sublabel follows) — read it before clicking so the caller knows what
    // got selected.
    const label = (
      (await options.first().locator('span').first().innerText()) ?? ''
    ).trim();
    await options.first().click();
    await expect(
      dialog.getByTestId('history-agent-filter-selected'),
    ).toBeVisible({ timeout: 10_000 });
    return label;
  }

  /** Clear the agent filter chip, returning the search input. */
  clearHistoryAgentFilter(dialog: Locator): Promise<void> {
    return clearHistoryAgentFilter(dialog);
  }

  filterHistoryBySentiment(
    dialog: Locator,
    sentiment: HistorySentiment | 'All Sentiments',
  ): Promise<void> {
    return filterHistoryBySentiment(dialog, sentiment);
  }

  filterHistoryByTopic(
    dialog: Locator,
    topic: string | 'All Topics',
  ): Promise<void> {
    return filterHistoryByTopic(dialog, topic);
  }

  /** Click Export on the Conversations sub-tab (report generates server-side). */
  startHistoryExport(dialog: Locator): Promise<void> {
    return startHistoryExport(dialog);
  }

  /** Full export flow: click Export, wait for the report to finish and the browser download to fire. */
  exportHistoryAndWaitForDownload(
    dialog: Locator,
    options?: { timeout?: number },
  ): Promise<Download> {
    return exportHistoryAndWaitForDownload(dialog, options);
  }

  /** The Exports sub-tab's reports table. */
  getExportsTable(dialog: Locator): Locator {
    return getExportsTable(dialog);
  }

  /** Rows of the Exports table matching a state badge label (e.g. "Completed"). */
  getExportRowsByState(dialog: Locator, state: string): Locator {
    return getExportRowsByState(dialog, state);
  }

  /** Wait until at least one report row reaches the Completed state. */
  waitForCompletedExportRow(
    dialog: Locator,
    options?: { timeout?: number },
  ): Promise<Locator> {
    return waitForCompletedExportRow(dialog, options);
  }

  /** Re-download a completed report from its Exports-table row. */
  downloadExportedReport(dialog: Locator, row: Locator): Promise<Download> {
    return downloadExportedReport(dialog, row);
  }
}
