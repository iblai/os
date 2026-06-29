import { Page, Locator, expect } from '@playwright/test';
import {
  LTI_LABELS,
  LTI_TEST_IDS,
  copyEndpoint,
  createKey,
  createLink,
  createTool,
  deleteKey,
  editLink,
  editTool,
  expectAllEndpointsVisible,
  expectKeyInList,
  expectKeyNotInList,
  expectKeysEmpty,
  expectLinkInList,
  expectLinkNotInList,
  expectLinksEmpty,
  expectLtiHeader,
  expectToolInList,
  expectToolNotInList,
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
 * GATING: the LTI tab is only visible when `is_lti_accessible` is `true` on
 * the mentor (toggled via Settings → Capabilities → "Allow LTI launches").
 * `isTabVisible()` returns `false` rather than throwing when the tab is absent.
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
   * LTI tab when `is_lti_accessible` is on) are mounted. No-op when already
   * active. The Integrations category itself always exists (MCP, Datasets,
   * API, Embed live there too), independent of the LTI toggle.
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
   * `is_lti_accessible` gating rather than the active-category accident.
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

  /** Assert the LTI tab is NOT present in the sidebar (gated off). */
  async expectTabHidden(): Promise<void> {
    await this.activateCategory();
    await expect(this.tabTrigger).toHaveCount(0, { timeout: 10_000 });
  }

  /**
   * Activate the Integrations category, click the LTI top-level tab, and wait
   * for the SDK sub-tab bar to render. Assumes the Edit Mentor dialog is open
   * and the mentor has `is_lti_accessible` enabled.
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
  createLink(name: string): Promise<void> {
    return createLink(this.dialog, name);
  }

  /**
   * Full rename-link flow: opens the row's edit pencil, renames, and saves.
   */
  editLink(currentName: string, newName: string): Promise<void> {
    return editLink(this.dialog, currentName, newName);
  }

  expectLinkInList(name: string): Promise<void> {
    return expectLinkInList(this.dialog, name);
  }

  expectLinkNotInList(name: string): Promise<void> {
    return expectLinkNotInList(this.dialog, name);
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
  openKeyDetail(name: string): Promise<void> {
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
  renameKey(name: string, newName: string): Promise<void> {
    return renameKey(this.dialog, name, newName);
  }

  /**
   * Full delete-key flow: menu → Delete → confirm. Expects the modal to close.
   */
  deleteKey(name: string): Promise<void> {
    return deleteKey(this.dialog, name);
  }

  expectKeyInList(name: string): Promise<void> {
    return expectKeyInList(this.dialog, name);
  }

  expectKeyNotInList(name: string): Promise<void> {
    return expectKeyNotInList(this.dialog, name);
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
  createTool(data: LtiToolFormData): Promise<void> {
    return createTool(this.dialog, data);
  }

  /**
   * Full edit-tool flow: opens the row's edit pencil, applies overrides, saves.
   */
  editTool(name: string, data: LtiToolFormData): Promise<void> {
    return editTool(this.dialog, name, data);
  }

  expectToolInList(name: string): Promise<void> {
    return expectToolInList(this.dialog, name);
  }

  expectToolNotInList(name: string): Promise<void> {
    return expectToolNotInList(this.dialog, name);
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
