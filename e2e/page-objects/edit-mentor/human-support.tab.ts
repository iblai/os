import { Page, Locator } from '@playwright/test';
import {
  SUPPORT_LABELS,
  getSupportTabTrigger,
  isSupportTabVisible,
  switchToSupportTab,
  getSupportInfoBox,
  getSupportToggle,
  isSupportEnabled,
  setSupportEnabled,
  enableSupport,
  disableSupport,
  getTicketList,
  getTicketRow,
  getTicketRowByIndex,
  expectTicketInList,
  expectNoTickets,
  expectTicketStatusInList,
  getStatusFilter,
  filterTicketsByStatus,
  getUserFilter,
  filterTicketsByUser,
  clearUserFilter,
  refreshTickets,
  waitForTicketInList,
  getTicketDetail,
  getTicketDescription,
  openTicket,
  expectTicketDescriptionContains,
  setTicketStatus,
  expectTicketClosedNotice,
  getReplyComposer,
  replyToTicket,
  expectMessageInConversation,
  expectNoRepliesYet,
  createSupportTicketViaChatAndVerify,
  type SupportTicketStatus,
} from '@iblai/iblai-js/playwright';

export type { SupportTicketStatus };

/**
 * Page object for the Human Support tab inside the Edit Mentor (Agent) modal.
 *
 * Rendered by the SDK's `AgentHumanSupportTab`
 * (`@iblai/iblai-js/web-containers/next`), wrapped in `AgentSettingsProvider`
 * by `components/modals/edit-mentor-modal/tabs/human-support-tab.tsx`. The tab
 * is admin-only (`userTypes: [UserType.ADMIN]`) and lives under the
 * **Runtime** sidebar category (`hooks/use-mentor-segments.ts`), alongside
 * Tasks / Memory / History / Audit. The host sidebar renders the segment's
 * label as **"Support"** (not "Human Support") — `SUPPORT_LABELS.tabName`
 * mirrors this; the SDK still calls its own internal export "Support" too, so
 * host and SDK never disagree on the trigger's accessible name.
 *
 * All DOM access goes through the semantic helpers exported from
 * `@iblai/iblai-js/playwright`'s `human-support-tab-helpers` module — resolved
 * via stable `data-testid` attributes, accessible roles, and aria-labels
 * emitted by the SDK. Selector changes in the SDK are absorbed by bumping
 * `@iblai/iblai-js`; no hand-rolled selectors live here beyond the couple of
 * label-derived locators the SDK doesn't itself export a getter for (heading,
 * empty-state text) — same convention as `TasksTab`/`VoiceTab`.
 *
 * CATEGORY: the modal sidebar only mounts the active category's segment
 * triggers (see `EditMentorPage.navigateToTab`). Support lives under
 * **Runtime**, so `switchToTab()` activates that category first via the
 * `bindTabNav` callback injected by `EditMentorPage` — mirrors `TasksTab`,
 * which has the identical problem (its SDK helper `switchToTasksTab`
 * predates the category strip and is category-blind).
 *
 * AVAILABILITY TOGGLE: `getSupportToggle`/`isSupportEnabled`/
 * `setSupportEnabled` resolve the info-box switch that mirrors the
 * human-support tool's on/off state (the same tool exposed on the Tools tab).
 * It is HIDDEN when the tenant's tool catalog has no human-support tool —
 * callers must guard with `hasToggle()` before calling `setEnabled`.
 *
 * The instance scopes every helper to the Edit Mentor `dialog` Locator so
 * other portaled dialogs in the same page (toasts, confirm dialogs, etc.)
 * cannot interfere with SDK locators.
 */
export class HumanSupportTab {
  readonly page: Page;
  readonly dialog: Locator;

  /** Default labels shipped with the SDK — use for text assertions. */
  static readonly LABELS = SUPPORT_LABELS;

  /**
   * Category-aware tab navigation injected by `EditMentorPage` (see
   * `bindTabNav` there). The Support segment lives in the modal's Runtime
   * category, and the sidebar only mounts the ACTIVE category's segment
   * triggers — so the SDK's `switchToSupportTab` (which predates the
   * category strip and expects the trigger to already be in the DOM) can't
   * find it while the modal sits on its default Configurations view.
   */
  private navigateToTab?: (tabName: string) => Promise<void>;

  bindTabNav(navigateToTab: (tabName: string) => Promise<void>): void {
    this.navigateToTab = navigateToTab;
  }

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  /** True when the Support tab trigger is rendered (admin-only segment guard). */
  isTabVisible(): Promise<boolean> {
    return isSupportTabVisible(this.page);
  }

  /** The host sidebar trigger for the Support segment. */
  tabLink(): Locator {
    return getSupportTabTrigger(this.dialog);
  }

  /**
   * Click the Support tab inside the Edit Mentor modal.
   *
   * Activates the Runtime category first when the tab nav is bound (the
   * default via `EditMentorPage`'s constructor), then delegates to the SDK
   * helper — its click on the now-active trigger is a no-op, but its
   * wait-for-panel-ready assertion is still the readiness signal callers
   * rely on.
   */
  async switchToTab(): Promise<void> {
    if (this.navigateToTab) {
      await this.navigateToTab(SUPPORT_LABELS.tabName);
    }
    await switchToSupportTab(this.page);
  }

  // ---------------------------------------------------------------------------
  // Header (no dedicated SDK getter — built directly from SUPPORT_LABELS,
  // same convention as TasksTab.heading()/description()).
  // ---------------------------------------------------------------------------

  /** The "Support" heading at the top of the tab panel. Resolved by
   * `role="heading"` so it never collides with the sidebar `tab` element
   * that shares the same accessible name. */
  heading(): Locator {
    return this.dialog.getByRole('heading', {
      name: SUPPORT_LABELS.header.title,
      exact: true,
    });
  }

  headerDescription(): Locator {
    return this.dialog.getByText(SUPPORT_LABELS.header.description, {
      exact: false,
    });
  }

  // ---------------------------------------------------------------------------
  // Availability toggle (info box)
  // ---------------------------------------------------------------------------

  infoBox(): Locator {
    return getSupportInfoBox(this.dialog);
  }

  toggle(): Locator {
    return getSupportToggle(this.dialog);
  }

  /**
   * Whether the availability toggle is present at all. Hidden when the
   * tenant's tool catalog has no human-support tool — callers must check
   * this before `setEnabled`/`enable`/`disable`, which otherwise hang
   * waiting for a control that will never render.
   */
  async hasToggle(): Promise<boolean> {
    let visible = false;
    try {
      await this.toggle().waitFor({ state: 'visible', timeout: 5_000 });
      visible = true;
    } catch {
      visible = false;
    }
    return visible;
  }

  isEnabled(): Promise<boolean> {
    return isSupportEnabled(this.dialog);
  }

  setEnabled(enabled: boolean): Promise<void> {
    return setSupportEnabled(this.dialog, enabled);
  }

  enable(): Promise<void> {
    return enableSupport(this.dialog);
  }

  disable(): Promise<void> {
    return disableSupport(this.dialog);
  }

  // ---------------------------------------------------------------------------
  // Ticket list
  // ---------------------------------------------------------------------------

  ticketList(): Locator {
    return getTicketList(this.dialog);
  }

  /** The empty-state message rendered when there are no support tickets. */
  noTicketsMessage(): Locator {
    return this.dialog.getByText(SUPPORT_LABELS.list.noTickets, {
      exact: true,
    });
  }

  ticketRow(subject: string | RegExp): Locator {
    return getTicketRow(this.dialog, subject);
  }

  ticketRowByIndex(index: number): Locator {
    return getTicketRowByIndex(this.dialog, index);
  }

  expectTicketInList(
    subject: string | RegExp,
    timeoutMs?: number,
  ): Promise<void> {
    return expectTicketInList(this.dialog, subject, timeoutMs);
  }

  expectNoTickets(): Promise<void> {
    return expectNoTickets(this.dialog);
  }

  expectTicketStatusInList(
    subject: string | RegExp,
    status: SupportTicketStatus,
  ): Promise<void> {
    return expectTicketStatusInList(this.dialog, subject, status);
  }

  statusFilter(): Locator {
    return getStatusFilter(this.dialog);
  }

  filterByStatus(status: SupportTicketStatus | 'all'): Promise<void> {
    return filterTicketsByStatus(this.dialog, status);
  }

  userFilter(): Locator {
    return getUserFilter(this.dialog);
  }

  filterByUser(search: string, optionText?: string | RegExp): Promise<void> {
    return filterTicketsByUser(this.dialog, search, optionText);
  }

  clearUserFilter(): Promise<void> {
    return clearUserFilter(this.dialog);
  }

  /** Force the ticket list to re-query (bounces the status filter). */
  refresh(): Promise<void> {
    return refreshTickets(this.dialog);
  }

  /**
   * Wait for a ticket to appear in the list, refreshing between polls.
   * Agent-created tickets land after the chat tool call completes
   * server-side, so allow a generous deadline.
   */
  waitForTicketInList(
    subject: string | RegExp,
    opts?: { timeoutMs?: number; refresh?: () => Promise<void> },
  ): Promise<void> {
    return waitForTicketInList(this.dialog, subject, opts);
  }

  // ---------------------------------------------------------------------------
  // Ticket detail
  // ---------------------------------------------------------------------------

  detailPane(): Locator {
    return getTicketDetail(this.dialog);
  }

  /** The "Select a ticket to view details." prompt shown before any ticket
   * is selected. */
  detailSelectPrompt(): Locator {
    return this.dialog.getByText(SUPPORT_LABELS.detail.selectPrompt, {
      exact: true,
    });
  }

  description(): Locator {
    return getTicketDescription(this.dialog);
  }

  /** Open a ticket from the list and wait for its detail to render. */
  openTicket(subject: string | RegExp): Promise<Locator> {
    return openTicket(this.dialog, subject);
  }

  expectDescriptionContains(text: string | RegExp): Promise<void> {
    return expectTicketDescriptionContains(this.dialog, text);
  }

  /**
   * Change the opened ticket's status via the detail pane's Status select.
   * Selecting "closed" routes through the dedicated close endpoint and
   * replaces the composer with the closed notice.
   */
  setStatus(status: SupportTicketStatus): Promise<void> {
    return setTicketStatus(this.dialog, status);
  }

  expectClosedNotice(): Promise<void> {
    return expectTicketClosedNotice(this.dialog);
  }

  replyComposer(): Locator {
    return getReplyComposer(this.dialog);
  }

  /** Send a reply on the opened ticket; waits for the composer to clear. */
  reply(message: string): Promise<void> {
    return replyToTicket(this.dialog, message);
  }

  expectMessageInConversation(message: string | RegExp): Promise<void> {
    return expectMessageInConversation(this.dialog, message);
  }

  expectNoRepliesYet(): Promise<void> {
    return expectNoRepliesYet(this.dialog);
  }

  // ---------------------------------------------------------------------------
  // Chat-driven ticket creation
  // ---------------------------------------------------------------------------

  /**
   * Full flow: with support enabled, ask the agent (via the main chat
   * surface) for a ticket, then verify it shows up in this tab.
   *
   * The Edit Agent modal is host-specific to open/close, so the caller
   * supplies `openEditAgentModal` (and optionally `closeEditAgentModal`,
   * used to get the modal out of the chat's way before sending). Steps:
   *
   *  1. `openEditAgentModal()` → Support tab → ensure the toggle is ON.
   *  2. `closeEditAgentModal()` (when provided) → chat-request the ticket.
   *  3. `openEditAgentModal()` → Support tab → wait for the ticket row.
   *
   * Returns the dialog locator with the Support tab open and the new ticket
   * listed, so specs can keep asserting (open it, reply, close it).
   */
  createTicketViaChatAndVerify(opts: {
    subject: string;
    description?: string;
    openEditAgentModal: () => Promise<void>;
    closeEditAgentModal?: () => Promise<void>;
    listTimeoutMs?: number;
  }): Promise<Locator> {
    return createSupportTicketViaChatAndVerify(this.page, opts);
  }
}
