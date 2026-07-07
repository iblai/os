import { Page, Locator, expect } from '@playwright/test';
import {
  LTI_LABELS,
  LTI_TEST_IDS,
  copyEndpoint,
  createKey,
  deleteKey,
  fillLinkName,
  fillToolForm,
  getLinkModal,
  getToolModal,
  openCreateLinkModal,
  openCreateToolModal,
  openEditLinkModal,
  openEditToolModal,
  expectAllEndpointsVisible,
  expectKeysEmpty,
  expectLinkInList,
  expectLinkNotInList,
  expectLinksEmpty,
  expectLtiHeader,
  expectToolsEmpty,
  openKeyDetail,
  readEndpointUrl,
  readKeyPublicJwk,
  readKeyPublicKey,
  renameKey,
  switchToLtiSubTab,
  type LtiEndpoint,
  type LtiKeySetMode,
  type LtiSubTab,
  type LtiToolFormData,
} from '@iblai/iblai-js/playwright';

/**
 * Page object for the LTI top-level tab inside the Edit Mentor (Agent) modal.
 *
 * The tab is rendered by the SDK's `AgentLtiTab`
 * (`@iblai/iblai-js/web-containers/next`). All DOM access goes through the
 * semantic helpers exported from `@iblai/iblai-js/playwright`, which resolve
 * elements via stable `data-testid` attributes, accessible roles, and
 * aria-labels emitted by the SDK. Selector changes in the SDK are absorbed by
 * bumping `@iblai/iblai-js` — no hand-rolled selectors here.
 *
 * VISIBILITY: the LTI tab is always mounted for admins regardless of the
 * "Enable LTI launches" (`is_lti_accessible`) toggle — the gate on that flag
 * was removed in feat/1853 so the tab stays reachable before the first link
 * is created. The tab remains hidden for non-admins. `expectTabHidden()` is
 * therefore only meaningful in a non-admin context; `expectTabVisible()` should
 * pass for any admin, even on a freshly created mentor.
 *
 * CATEGORY: the modal sidebar only mounts the segment tabs of the *active*
 * category (Configurations / Integrations / Analytics — see
 * `edit-mentor.page.ts` `navigateToTab`). LTI lives under **Integrations**, so
 * every navigation/visibility method here first activates that category. The
 * SDK's own `switchToLtiTab` / `isLtiTabVisible` are category-blind (a bare
 * `getByRole('tab', { name: 'LTI' })`) and would never find the tab while the
 * modal sits on Settings, so we drive the host sidebar trigger ourselves using
 * the same twin-safe `[aria-controls^="panel-"]:visible` pattern as the host.
 *
 * The instance scopes every helper to the Edit Mentor `dialog` Locator so that
 * other portaled dialogs in the same page (toasts, confirm dialogs, etc.)
 * cannot interfere with SDK locators.
 */
export class LtiTab {
  readonly page: Page;
  readonly dialog: Locator;

  /** Default labels shipped with the SDK — use when asserting exact text. */
  static readonly LABELS = LTI_LABELS;
  /** Stable `data-testid` values — use sparingly; prefer SDK helpers. */
  static readonly TEST_IDS = LTI_TEST_IDS;
  /** Sidebar category the LTI segment lives under (see `TAB_CATEGORY`). */
  static readonly CATEGORY = 'Integrations';

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  /** The Integrations category strip tab in the modal sidebar. */
  get categoryTab(): Locator {
    return this.dialog.getByRole('tab', {
      name: LtiTab.CATEGORY,
      exact: true,
    });
  }

  /**
   * The host sidebar trigger for the LTI segment. Scoped to the visible host
   * trigger via `[aria-controls^="panel-"]:visible` so it never collides with
   * the responsive twin or the SDK's in-panel sub-tabs (mirrors the host's
   * `navigateToTab`). Only resolves once the Integrations category is active.
   */
  get tabTrigger(): Locator {
    return this.dialog
      .getByRole('tab', { name: LtiTab.LABELS.tabName, exact: true })
      .and(this.dialog.locator('[aria-controls^="panel-"]:visible'));
  }

  /**
   * Activate the Integrations category so its segment triggers (including the
   * LTI tab, which is always mounted for admins) are shown. No-op when already
   * active. The Integrations category itself always exists (MCP, Datasets,
   * API, Embed live there too).
   */
  async activateCategory(): Promise<void> {
    const active =
      (await this.categoryTab.getAttribute('data-state').catch(() => null)) ===
      'active';
    if (!active) {
      await this.categoryTab.click();
      await expect(this.categoryTab).toHaveAttribute('data-state', 'active', {
        timeout: 5_000,
      });
    }
  }

  /**
   * Returns `true` when the LTI tab is currently mounted in the sidebar.
   * Activates the Integrations category first, so the result reflects the
   * admin-only gating rather than the active-category accident. The
   * `is_lti_accessible` toggle no longer affects tab visibility (feat/1853).
   */
  async isTabVisible(): Promise<boolean> {
    await this.activateCategory();
    return this.tabTrigger
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
  }

  /** Assert the LTI tab IS present in the sidebar (Integrations category). */
  async expectTabVisible(): Promise<void> {
    await this.activateCategory();
    await expect(this.tabTrigger).toBeVisible({ timeout: 15_000 });
  }

  /**
   * Assert the LTI tab is NOT present in the sidebar. Only meaningful for
   * non-admins — the tab is always mounted for admins (feat/1853).
   */
  async expectTabHidden(): Promise<void> {
    await this.activateCategory();
    await expect(this.tabTrigger).toHaveCount(0, { timeout: 10_000 });
  }

  /**
   * Activate the Integrations category, click the LTI top-level tab, and wait
   * for the SDK sub-tab bar to render. Assumes the Edit Mentor dialog is open
   * (the tab is always mounted for admins). Note: LTI sub-resources
   * (links/keys/tools) still require `is_lti_accessible=true` on the backend,
   * so sub-resource tests enable it via the Settings toggle first.
   */
  async switchToTab(): Promise<void> {
    await this.activateCategory();
    await expect(this.tabTrigger).toBeVisible({ timeout: 15_000 });
    const isActive =
      (await this.tabTrigger.getAttribute('data-state').catch(() => null)) ===
      'active';
    if (!isActive) {
      await this.tabTrigger.click();
      await expect(this.tabTrigger).toHaveAttribute('data-state', 'active', {
        timeout: 5_000,
      });
    }
    await expect(this.dialog.getByTestId(LtiTab.TEST_IDS.subTabs)).toBeVisible({
      timeout: 10_000,
    });
  }

  /**
   * Switch to one of the four LTI sub-tabs (agentLinks | keys | tools |
   * toolEndpoints) and wait for it to become active.
   */
  switchToSubTab(subTab: LtiSubTab): Promise<void> {
    return switchToLtiSubTab(this.page, subTab);
  }

  // ---------------------------------------------------------------------------
  // Header
  // ---------------------------------------------------------------------------

  /**
   * Assert the LTI tab header (title + description) is rendered.
   * Uses SDK labels so a label change is caught by a single SDK bump.
   */
  expectHeader(): Promise<void> {
    return expectLtiHeader(this.dialog);
  }

  // ---------------------------------------------------------------------------
  // Links sub-tab
  // ---------------------------------------------------------------------------

  /**
   * Assert the Links sub-tab shows the "no links yet" empty state.
   */
  expectLinksEmpty(): Promise<void> {
    return expectLinksEmpty(this.dialog);
  }

  /**
   * Full create-link flow: opens the modal, fills the name, and submits.
   */
  async createLink(name: string): Promise<void> {
    await openCreateLinkModal(this.dialog);
    await fillLinkName(this.dialog, name);
    await this.submitLinkModal();
  }

  /**
   * Full rename-link flow: opens the row's edit pencil, renames, and saves.
   */
  async editLink(currentName: string, newName: string): Promise<void> {
    await openEditLinkModal(this.dialog, currentName);
    await fillLinkName(this.dialog, newName);
    await this.submitLinkModal();
  }

  /**
   * Submit the (already-open, already-filled) link modal and wait for it to
   * close. Reimplements the SDK's `submitLinkModal` because that helper caps
   * the modal-close wait at 15s: the create/rename POST can take longer on
   * staging (the data layer silently retries transient failures, holding the
   * modal in its "Creating…" state well past 15s), so the SDK's assertion
   * flakes even though the mutation ultimately succeeds (Journey 56 lti-07).
   * We keep the same click semantics (button enabled → click) but give the
   * round-trip a generous 45s to complete before failing.
   */
  private async submitLinkModal(): Promise<void> {
    const modal = getLinkModal(this.dialog);
    const submit = modal.getByRole('button', { name: /^(Create|Save)$/ });
    await expect(submit).toBeEnabled({ timeout: 10_000 });
    await submit.click({ timeout: 10_000 });
    await expect(modal).toBeHidden({ timeout: 45_000 });
  }

  expectLinkInList(name: string): Promise<void> {
    return expectLinkInList(this.dialog, name);
  }

  expectLinkNotInList(name: string): Promise<void> {
    return expectLinkNotInList(this.dialog, name);
  }

  // ---------------------------------------------------------------------------
  // Pagination-aware row finder (keys + tools)
  // ---------------------------------------------------------------------------

  /**
   * Reveal a list row by name, paginating forward if necessary, and leave that
   * page active so the SDK's single-page row helpers (detail / rename / delete)
   * can act on it.
   *
   * LTI keys and tools are platform-wide, server-paginated at
   * `LTI_PAGE_SIZE = 10` rows/page (`IblPagination` → shadcn), and ordered by
   * the backend (alphabetically by name). Residue from parallel workers grows
   * the list past one page, so a freshly-created uniquely-named row routinely
   * lands on page 2+ where the SDK's `getKeyRow`/`getToolRow` (which only see
   * the current page) can't find it — the flake behind Journey 56 lti-14.
   *
   * We walk from the current page via the "Go to next page" control until the
   * row is on screen or the control is `aria-disabled` (last page / no
   * pagination — `IblPagination` renders nothing when there is a single page).
   * After each click we wait for the page to actually turn (the first row's
   * text changes on the server refetch) rather than sleeping. The page cap is
   * a runaway guard well above any real residue level; when the row is genuinely
   * absent we return the (hidden) locator so the caller's assertion decides.
   */
  private async revealRow(
    sectionTestId: string,
    rowTestId: string,
    name: string,
  ): Promise<Locator> {
    const section = this.dialog.getByTestId(sectionTestId);
    const row = section.getByTestId(rowTestId).filter({ hasText: name });
    const firstRow = section.getByTestId(rowTestId).first();
    // Match by aria-label attribute (robust to how the anchor's role resolves).
    const nextControl = section.locator('[aria-label="Go to next page"]');

    for (let i = 0; i < 30; i++) {
      if (await row.isVisible().catch(() => false)) return row;

      const nextDisabled =
        !(await nextControl.isVisible().catch(() => false)) ||
        (await nextControl
          .getAttribute('aria-disabled')
          .catch(() => 'true')) === 'true';
      if (nextDisabled) return row;

      const before = await firstRow.textContent().catch(() => null);
      await nextControl.click();
      if (before !== null) {
        await expect(firstRow).not.toHaveText(before, { timeout: 15_000 });
      }
    }
    return row;
  }

  // ---------------------------------------------------------------------------
  // Keys sub-tab
  // ---------------------------------------------------------------------------

  /**
   * Assert the Keys sub-tab shows the "no keys yet" empty state.
   */
  expectKeysEmpty(): Promise<void> {
    return expectKeysEmpty(this.dialog);
  }

  /**
   * Full create-key flow: opens the modal, fills the name, and submits.
   */
  createKey(name: string): Promise<void> {
    return createKey(this.dialog, name);
  }

  /**
   * Open the key detail modal via the row's actions menu → Edit.
   * Returns after the detail modal is visible.
   */
  async openKeyDetail(name: string): Promise<void> {
    await this.revealKeyRow(name);
    return openKeyDetail(this.dialog, name);
  }

  /** Read the PEM public-key text from an open key detail modal. */
  readKeyPublicKey(): Promise<string> {
    return readKeyPublicKey(this.dialog);
  }

  /** Read the public JWK JSON string from an open key detail modal. */
  readKeyPublicJwk(): Promise<string> {
    return readKeyPublicJwk(this.dialog);
  }

  /**
   * Rename a key via detail modal (menu → Edit → rename → Save).
   */
  async renameKey(name: string, newName: string): Promise<void> {
    await this.revealKeyRow(name);
    return renameKey(this.dialog, name, newName);
  }

  /**
   * Full delete-key flow: menu → Delete → confirm. Expects the modal to close.
   */
  async deleteKey(name: string): Promise<void> {
    await this.revealKeyRow(name);
    return deleteKey(this.dialog, name);
  }

  async expectKeyInList(name: string): Promise<void> {
    const row = await this.revealKeyRow(name);
    await expect(row).toBeVisible({ timeout: 10_000 });
  }

  async expectKeyNotInList(name: string): Promise<void> {
    // Walk every page: a key absent from page 1 may still exist on a later one.
    const row = await this.revealKeyRow(name);
    await expect(row).toBeHidden({ timeout: 10_000 });
  }

  /** Reveal a key row across the paginated Keys list. */
  private revealKeyRow(name: string): Promise<Locator> {
    return this.revealRow(
      LTI_TEST_IDS.keys.section,
      LTI_TEST_IDS.keys.row,
      name,
    );
  }

  // ---------------------------------------------------------------------------
  // Tools sub-tab
  // ---------------------------------------------------------------------------

  /**
   * Assert the Tools sub-tab shows the "no tools yet" empty state.
   */
  expectToolsEmpty(): Promise<void> {
    return expectToolsEmpty(this.dialog);
  }

  /**
   * Full create-tool flow. `data.signingKeyName` must name a key that already
   * exists in the Keys sub-tab (created first in the same test).
   */
  async createTool(data: LtiToolFormData): Promise<void> {
    await openCreateToolModal(this.dialog);
    await fillToolForm(this.dialog, data);
    await this.submitToolModal();
  }

  /**
   * Full edit-tool flow: opens the row's edit pencil, applies overrides, saves.
   */
  async editTool(name: string, data: LtiToolFormData): Promise<void> {
    await this.revealToolRow(name);
    await openEditToolModal(this.dialog, name);
    await fillToolForm(this.dialog, data);
    await this.submitToolModal();
  }

  /**
   * Submit the (already-open, already-filled) tool modal and wait for it to
   * close. Reimplements the SDK's `submitToolModal` for the same reason as
   * `submitLinkModal`: the SDK caps the modal-close wait at 15s, but the
   * create/update POST can take longer on staging (data-layer retries hold the
   * modal in a "Creating…" state past 15s). Gives the round-trip 45s.
   */
  private async submitToolModal(): Promise<void> {
    // `getToolModal` resolves via the page (`asPage`), not the Edit Agent
    // dialog: the tool modal is a Radix dialog rendered in a portal OUTSIDE
    // the dialog subtree, so scoping to `this.dialog` finds nothing (the
    // "Create button not found" flake). Mirror `submitLinkModal`.
    const modal = getToolModal(this.dialog);
    const submit = modal.getByRole('button', { name: /^(Create|Save)$/ });
    await expect(submit).toBeEnabled({ timeout: 10_000 });
    await submit.click({ timeout: 10_000 });
    await expect(modal).toBeHidden({ timeout: 45_000 });
  }

  async expectToolInList(name: string): Promise<void> {
    const row = await this.revealToolRow(name);
    await expect(row).toBeVisible({ timeout: 10_000 });
  }

  async expectToolNotInList(name: string): Promise<void> {
    // Walk every page: a tool absent from page 1 may still exist on a later one.
    const row = await this.revealToolRow(name);
    await expect(row).toBeHidden({ timeout: 10_000 });
  }

  /** Reveal a tool row across the paginated Tools list. */
  private revealToolRow(name: string): Promise<Locator> {
    return this.revealRow(
      LTI_TEST_IDS.tools.section,
      LTI_TEST_IDS.tools.row,
      name,
    );
  }

  // ---------------------------------------------------------------------------
  // Tool Endpoints sub-tab
  // ---------------------------------------------------------------------------

  /**
   * Assert all four platform endpoints (redirectUri, login, deepLinking, jwks)
   * are rendered with non-empty URLs.
   */
  expectAllEndpointsVisible(): Promise<void> {
    return expectAllEndpointsVisible(this.dialog);
  }

  /**
   * Read a single platform endpoint URL (redirectUri | login | deepLinking |
   * jwks). Used to assert the endpoints are built from the configured LMS URL.
   */
  readEndpointUrl(endpoint: LtiEndpoint): Promise<string> {
    return readEndpointUrl(this.dialog, endpoint);
  }

  /**
   * Click an endpoint's "Copy URL" button. The button label flips to "Copied"
   * to confirm the clipboard write.
   */
  copyEndpoint(endpoint: LtiEndpoint): Promise<void> {
    return copyEndpoint(this.dialog, endpoint);
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  /**
   * A resource name that is unlikely to collide with other parallel workers or
   * retries. Used for links, keys, and tool names created in this journey.
   *
   * NOTE: `Date.now()` and `Math.random()` are the project-approved generators
   * (see `test-data.ts` — `generateMentorName`, `generateConnectorName`, etc.
   * all use the same pattern). The `prefix` param lets callers scope names
   * by resource type.
   */
  static uniqueName(prefix = 'e2e-lti'): string {
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 7);
    return `${prefix}-${ts}-${rand}`;
  }
}

// Re-export SDK types so journey specs can import them from this one location.
export type { LtiSubTab, LtiEndpoint, LtiKeySetMode, LtiToolFormData };
