import { Page, Locator } from '@playwright/test';
import { AGENT_HUMAN_SUPPORT_TAB_LABELS } from '@iblai/iblai-js/web-containers/next';

/**
 * Page object for the Human Support tab inside the Edit Mentor modal.
 *
 * Rendered by the SDK's `AgentHumanSupportTab`
 * (`@iblai/iblai-js/web-containers/next`), wrapped in `AgentSettingsProvider`
 * by `components/modals/edit-mentor-modal/tabs/human-support-tab.tsx`. The tab
 * is admin-only (userTypes: [UserType.ADMIN]) and lives under the "Analytics"
 * category in the modal sidebar, after History and before Audit.
 *
 * Because the SDK does not yet export semantic Playwright helpers for this tab
 * (no `@iblai/iblai-js/playwright` equivalents), all locators are derived from
 * `AGENT_HUMAN_SUPPORT_TAB_LABELS` (the SDK-exported label object) and from
 * `data-testid` attributes baked into the SDK component. This keeps the
 * page-object decoupled from CSS class names and positional DOM structure — a
 * label change in the SDK updates `AGENT_HUMAN_SUPPORT_TAB_LABELS` and the
 * page-object picks it up automatically.
 *
 * Selector policy (do not regress):
 *   1. Sidebar tab trigger  → `[role="tab"][aria-controls="panel-human_support"]:visible`
 *      The `aria-controls` id is `panel-${tab.value}` (see
 *      `components/modals/edit-mentor-modal/index.tsx`), and `tab.value` is
 *      `MODALS.EDIT_MENTOR.tabs.human_support === "human_support"`. Filtering
 *      on `:visible` excludes the hidden responsive twin (desktop + compact
 *      sidebar both render the same trigger; only one is visible at a time).
 *   2. Tab header title → `role="heading"` + `AGENT_HUMAN_SUPPORT_TAB_LABELS.header.title`
 *   3. "Search for User" combobox trigger → `role="combobox"` + aria-label
 *   4. Status filter select → `aria-label` from labels.filters.allStatuses i18n key
 *   5. Ticket list region → `data-testid="human-support-ticket-list"` (when tickets exist)
 *   6. Empty state        → `labels.list.noTickets` text (when no tickets)
 *   7. Detail pane region → `data-testid="human-support-ticket-detail"`
 *   8. Detail pane prompt → `labels.detail.selectPrompt` text (nothing selected)
 */
export class HumanSupportTab {
  readonly page: Page;
  readonly dialog: Locator;

  /** Default labels exported by the SDK — use for text assertions. */
  static readonly LABELS = AGENT_HUMAN_SUPPORT_TAB_LABELS;

  /**
   * Sidebar tab trigger (host-rendered).
   *
   * `:visible` excludes the host's hidden responsive twin — the sidebar is
   * rendered twice (desktop `#desktop-tab-human_support` + compact
   * `#tab-human_support`), both owning `aria-controls="panel-human_support"`,
   * and only the viewport-appropriate one is visible at any given time.
   */
  readonly tabLink: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;

    this.tabLink = dialog.locator(
      '[role="tab"][aria-controls="panel-human_support"]:visible',
    );
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  /**
   * Returns true when the Human Support tab trigger is visible in the sidebar.
   * Used to assert admin-only visibility and skip non-admin tests gracefully.
   */
  async isTabVisible(): Promise<boolean> {
    return this.tabLink.isVisible({ timeout: 5_000 }).catch(() => false);
  }

  // ---------------------------------------------------------------------------
  // Surface locators
  // ---------------------------------------------------------------------------

  /**
   * The "Human Support" heading at the top of the tab panel.
   * Resolved by `role="heading"` so it never collides with the sidebar `tab`
   * element that also displays the label "Human Support".
   */
  heading(): Locator {
    return this.dialog.getByRole('heading', {
      name: HumanSupportTab.LABELS.header.title,
      exact: true,
    });
  }

  /**
   * The header description paragraph below the "Human Support" heading.
   * Matched by a substring of the SDK label text so minor i18n rewording
   * doesn't break the assertion (use `{ exact: false }`).
   */
  headerDescription(): Locator {
    return this.dialog.getByText(HumanSupportTab.LABELS.header.description, {
      exact: false,
    });
  }

  /**
   * The "Search for User" combobox trigger (opens the user-search popover).
   * Resolved by `role="combobox"` + `aria-label` set by the SDK.
   */
  userSearchCombobox(): Locator {
    return this.dialog.getByRole('combobox', {
      name: HumanSupportTab.LABELS.filters.searchUser,
      exact: true,
    });
  }

  /**
   * The status-filter `<Select>` trigger. The SDK sets
   * `aria-label={t('tabsHumanSupportTab.filterByStatus')}` on the trigger, but
   * the i18n key value is "Filter by status" (from the `tabsHumanSupportTab`
   * namespace, not the same as `AGENT_HUMAN_SUPPORT_TAB_LABELS`). We locate it
   * by the displayed placeholder text ("All Statuses") which is available via
   * the SDK labels object and is unique in the panel.
   */
  statusFilterTrigger(): Locator {
    return this.dialog.getByRole('combobox', {
      name: HumanSupportTab.LABELS.filters.allStatuses,
      exact: false,
    });
  }

  /**
   * The ticket-list region (`data-testid="human-support-ticket-list"`).
   * Only mounted by the SDK when there are tickets; assert with a short
   * timeout and fall back to `noTicketsMessage()` in the empty state.
   */
  ticketList(): Locator {
    return this.dialog.getByTestId('human-support-ticket-list');
  }

  /**
   * The empty-state message rendered when there are no support tickets.
   * Text matches `AGENT_HUMAN_SUPPORT_TAB_LABELS.list.noTickets`.
   */
  noTicketsMessage(): Locator {
    return this.dialog.getByText(HumanSupportTab.LABELS.list.noTickets, {
      exact: true,
    });
  }

  /**
   * The detail pane region (`data-testid="human-support-ticket-detail"`).
   * Rendered on desktop viewports (hidden on mobile). When no ticket is
   * selected it shows `labels.detail.selectPrompt`.
   */
  detailPane(): Locator {
    return this.dialog.getByTestId('human-support-ticket-detail');
  }

  /**
   * The "Select a ticket to view details." prompt shown in the detail pane
   * before any ticket is selected.
   */
  detailSelectPrompt(): Locator {
    return this.dialog.getByText(HumanSupportTab.LABELS.detail.selectPrompt, {
      exact: true,
    });
  }
}
