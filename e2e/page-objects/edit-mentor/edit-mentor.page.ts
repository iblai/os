import { Page, Locator, expect } from '@playwright/test';
import { CreateMentorPage } from '../create-mentor.page';
import { SidebarPage } from '../sidebar.page';
import { waitForPageReady } from '../../utils/resilient';
import { SettingsTab } from './settings.tab';
import { LlmTab } from './llm.tab';
import { ToolsTab } from './tools.tab';
import { PromptsTab } from './prompts.tab';
import { DisclaimersTab } from './disclaimers.tab';
import { DatasetsTab } from './datasets.tab';
import { EvaluationTab } from './evaluation.tab';
import { HistoryTab } from './history.tab';
import { MemoryTab } from './memory.tab';
import { McpTab } from './mcp.tab';
import { EmbedTab } from './embed.tab';
import { CopyMentorPage } from './copy-mentor.page';
import { AccessTab } from './access.tab';
import { PrivacyTab } from './privacy.tab';
import { TasksTab } from './tasks.tab';
import { VoiceTab } from './voice.tab';
import { SkillsTab } from './skills.tab';
import { ScreenShareTab } from './screenshare.tab';
import { HumanSupportTab } from './human-support.tab';
import { LtiTab } from './lti.tab';
import { GraderTab } from './grader.tab';

/**
 * Which sidebar category each segment lives in. Mirrors the `navCategory`
 * field set on each entry in `MENTOR_SEGMENTS` (hooks/use-mentor-segments.ts).
 * Used by `navigateToTab` to switch the category strip before clicking a
 * segment tab — segment triggers are only mounted for the active category.
 *
 * Keep in sync with MENTOR_SEGMENTS. The e2e covering test journeys exercise
 * one tab per category, so any drift surfaces as a Playwright failure rather
 * than silent skip.
 */
const TAB_CATEGORY: Record<
  string,
  'Configurations' | 'Integrations' | 'Runtime'
> = {
  // Configurations
  Settings: 'Configurations',
  LLM: 'Configurations',
  Billing: 'Configurations',
  Access: 'Configurations',
  Prompts: 'Configurations',
  Skills: 'Configurations',
  Voice: 'Configurations',
  Privacy: 'Configurations',
  Safety: 'Configurations',
  Disclaimers: 'Configurations',
  Screen: 'Configurations',
  Grader: 'Configurations',
  // Integrations
  Sandbox: 'Integrations',
  Tools: 'Integrations',
  MCP: 'Integrations',
  Datasets: 'Integrations',
  API: 'Integrations',
  LTI: 'Integrations',
  Embed: 'Integrations',
  // Runtime (renamed from Analytics)
  Tasks: 'Runtime',
  Memory: 'Runtime',
  History: 'Runtime',
  // Host sidebar label for the human-support segment is "Support" (see
  // hooks/use-mentor-segments.ts), not "Human Support".
  Support: 'Runtime',
  Audit: 'Runtime',
  Analytics: 'Runtime',
  Evals: 'Runtime',
};

export class EditMentorPage {
  readonly page: Page;
  readonly dialog: Locator;
  readonly closeButton: Locator;

  // Tab accessors (lazy-initialised on first access)
  readonly settings: SettingsTab;
  readonly llm: LlmTab;
  readonly tools: ToolsTab;
  readonly prompts: PromptsTab;
  readonly disclaimers: DisclaimersTab;
  readonly datasets: DatasetsTab;
  readonly evaluation: EvaluationTab;
  readonly history: HistoryTab;
  readonly memory: MemoryTab;
  readonly mcp: McpTab;
  readonly embed: EmbedTab;
  readonly access: AccessTab;
  readonly privacy: PrivacyTab;
  readonly tasks: TasksTab;
  readonly voice: VoiceTab;
  readonly screenshare: ScreenShareTab;
  readonly humanSupport: HumanSupportTab;
  readonly lti: LtiTab;
  readonly skills: SkillsTab;
  readonly grader: GraderTab;
  readonly copyMentorDialog: CopyMentorPage;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByRole('dialog').filter({ hasText: 'Edit Agent' });
    this.closeButton = this.dialog.getByRole('button', {
      name: 'Close',
      exact: true,
    });

    this.settings = new SettingsTab(page, this.dialog);
    this.llm = new LlmTab(page, this.dialog);
    this.tools = new ToolsTab(page, this.dialog);
    this.prompts = new PromptsTab(page, this.dialog);
    this.disclaimers = new DisclaimersTab(page, this.dialog);
    this.datasets = new DatasetsTab(page, this.dialog);
    this.evaluation = new EvaluationTab(page, this.dialog);
    this.history = new HistoryTab(page, this.dialog);
    this.memory = new MemoryTab(page, this.dialog);
    this.mcp = new McpTab(page, this.dialog);
    this.embed = new EmbedTab(page, this.dialog);
    this.access = new AccessTab(page, this.dialog);
    this.privacy = new PrivacyTab(page, this.dialog);
    this.tasks = new TasksTab(page, this.dialog);
    this.voice = new VoiceTab(page, this.dialog);
    this.screenshare = new ScreenShareTab(page, this.dialog);
    this.humanSupport = new HumanSupportTab(page, this.dialog);
    this.lti = new LtiTab(page, this.dialog);
    this.skills = new SkillsTab(page, this.dialog);
    this.grader = new GraderTab(page, this.dialog);
    this.copyMentorDialog = new CopyMentorPage(page);

    // The modal only mounts the active category's segments, so the Settings
    // sub-tab triggers (Basic / Discovery / Capabilities) are absent from the
    // DOM whenever another category is active (e.g. LtiTab activates
    // Integrations before every LTI check). Hand the Settings page-object the
    // dialog's tab nav so `selectSubTab` can restore the Settings segment
    // itself, making its helpers safe regardless of caller order.
    this.settings.bindTabNav(this.navigateToTab.bind(this));

    // Same story for Tasks: the SDK's `switchToTasksTab` helper predates the
    // category strip and expects the Tasks trigger to be in the DOM already —
    // but Tasks lives in the Runtime category, which isn't mounted while the
    // modal sits on its default Configurations view. Binding the tab nav lets
    // `TasksTab.switchToTab()` activate Runtime first.
    this.tasks.bindTabNav(this.navigateToTab.bind(this));

    // Human Support has the identical problem — it also lives in the Runtime
    // category and its SDK helper `switchToSupportTab` is category-blind.
    this.humanSupport.bindTabNav(this.navigateToTab.bind(this));
  }

  /**
   * Opens the Edit Mentor modal via the mentor dropdown menu item.
   * Pass the tab name to navigate directly to a specific tab.
   */
  /**
   * Restore the app chrome the SDK Edit Agent dialog fails to clean up.
   *
   * Radix/SDK Dialog teardown can leave `body[data-scroll-locked]`,
   * `<body style="pointer-events: none">` and a stale
   * `[data-slot="sidebar-wrapper"][aria-hidden="true"]` behind after the
   * dialog unmounts. The aria-hidden one is the worst: it drops the entire
   * app shell (navbar, sidebar, chat chrome) out of the accessibility tree,
   * so every `getByRole`/role-based query against page chrome returns
   * nothing even though it's visually present. We remove these ourselves
   * (the SDK should) and confirm they're gone. Called both before opening
   * the dialog and after closing it so callers can interact with the page
   * chrome immediately afterward.
   */
  private async restoreAppChrome(): Promise<void> {
    const staleChrome = this.page
      .locator(
        'body[data-scroll-locked="1"], [data-slot="sidebar-wrapper"][aria-hidden="true"]',
      )
      .first();
    if ((await staleChrome.count()) > 0) {
      await this.page.evaluate(() => {
        document.body.removeAttribute('data-scroll-locked');
        document.body.style.removeProperty('pointer-events');
        document
          .querySelectorAll('[data-slot="sidebar-wrapper"][aria-hidden="true"]')
          .forEach((el) => el.removeAttribute('aria-hidden'));
      });
    }
    await expect(staleChrome).toHaveCount(0, { timeout: 5_000 });
    await this.page
      .waitForFunction(
        () => getComputedStyle(document.body).pointerEvents !== 'none',
        undefined,
        { timeout: 5_000 },
      )
      .catch(() => {});
  }

  /**
   * Restore the Edit Agent dialog to the accessibility tree.
   *
   * When the Edit Agent modal is opened from the My Agents list, the
   * SettingsModal dialog stays open underneath it (the modal stack pushes
   * rather than replaces — see `openEditMentorModal` in
   * `hooks/user-navigate.ts`). Radix's stacked-dialog `aria-hidden`
   * management then drops the Edit dialog's subtree out of the a11y tree,
   * so the dialog renders on screen but every `getByRole` query against it
   * (the dialog itself and its tabs) returns nothing. We clear the stale
   * `aria-hidden` from the Edit dialog's ancestor chain so role-based
   * locators resolve again.
   *
   * Locating the dialog uses a raw `[role="dialog"]` CSS query rather than
   * `getByRole`, because the latter consults the a11y tree we're trying to
   * repair.
   */
  private async unhideEditDialog(): Promise<void> {
    const editDialog = this.page
      .locator('[role="dialog"]')
      .filter({ hasText: 'Edit Agent' })
      .first();
    // toBeVisible checks layout (CSS), not the a11y tree, so it resolves even
    // while the dialog is aria-hidden — confirming the click opened it.
    await expect(editDialog).toBeVisible({ timeout: 35_000 });

    // A one-time strip doesn't hold: the still-open settings dialog re-runs
    // Radix's hideOthers and keeps re-applying aria-hidden to the backgrounded
    // Edit portal. Install a MutationObserver that re-strips it (and inert)
    // from the Edit dialog's ancestor chain whenever it reappears, so
    // role-based queries stay valid for the rest of the test.
    await this.page.evaluate(() => {
      const strip = () => {
        const dialog = Array.from(
          document.querySelectorAll('[role="dialog"]'),
        ).find((d) => d.textContent?.includes('Edit Agent'));
        let node: Element | null = dialog ?? null;
        while (node) {
          if (node.getAttribute('aria-hidden') === 'true') {
            node.removeAttribute('aria-hidden');
          }
          if (node.hasAttribute('inert')) {
            node.removeAttribute('inert');
          }
          node = node.parentElement;
        }
      };

      strip();
      // Observing a live node keeps the observer reachable for the page's
      // lifetime; no need to stash a reference.
      new MutationObserver(strip).observe(document.body, {
        subtree: true,
        attributes: true,
        attributeFilter: ['aria-hidden', 'inert'],
      });
    });
  }

  async open(tabName?: string): Promise<void> {
    // Copy Mentor's submit leaves the Edit Agent dialog open and re-points
    // it at the freshly-copied mentor via a client-side navigation that
    // still carries `?modal=edit_mentor` (`handleSuccessfulCopy` in
    // `edit-mentor-modal/settings-tab.tsx` — see the context-switch comment
    // on navigateToTab below for the same case). If a caller then calls
    // open() again expecting a closed dialog, the navbar dropdown click
    // below hits that still-open dialog's own overlay — Radix's hideOthers
    // marks a live dialog's own overlay aria-hidden as a side effect of
    // hiding body siblings (see unhideEditDialog's docstring), so the
    // overlay is visually `fixed inset-0 z-50` and intercepts the click even
    // though it's correctly hidden from the a11y tree. Detect an
    // already-open dialog up front and skip straight to repairing/hydrating/
    // navigating instead of trying to reopen it.
    if (await this.isOpen()) {
      await this.unhideEditDialog();
      await this.waitForHydrated();
      if (tabName) {
        await this.navigateToTab(tabName);
      }
      return;
    }

    // Restore any chrome a previous dialog left in a broken state before
    // looking for the nav-bar trigger (see restoreAppChrome).
    await this.restoreAppChrome();

    // Match the trigger by its `aria-label` attribute. A DOM query is robust
    // even if any stale `aria-hidden` slips past the cleanup above, and
    // `toBeVisible` / `click` operate on layout rather than the a11y tree.
    const dropdown = this.page.locator(
      'button[aria-label="Selected agent dropdown button"]',
    );
    await expect(dropdown).toBeVisible({ timeout: 30_000 });
    await dropdown.click();

    // Find the menu item — under the new SDK CategorizedDropdownMenu,
    // "Modify" is the fork action and never opens the edit modal. The prior
    // regex-OR (/modify/i, /settings/i) resolved to whichever matched first,
    // which is often "Modify". Match "Settings" exactly to open the edit
    // dialog reliably.
    const menuTarget = this.page.getByRole('menuitem', {
      name: 'Settings',
      exact: true,
    });

    // `navigateToMentorApp` (bare /platform) redirects to the account-wide
    // most-recently-accessed mentor, which can be one this admin doesn't own
    // (e.g. a shared/template mentor forked from the main tenant catalog —
    // see e2e-shared-mentor-isolation). Non-owned mentors only expose
    // "New Chat" and "Modify" in this dropdown — never "Settings" — so
    // blindly waiting for "Settings" here would hang forever. Detect that
    // case with a short wait and, only then, switch onto an editable mentor
    // before retrying. When "Settings" IS present (the common case) this
    // adds nothing beyond the same wait the unconditional expect used to do.
    //
    // NOTE: an earlier version of this fallback preferred clicking "Modify"
    // (the dropdown's one-click fork action) before falling back to
    // CreateMentorPage. That was dropped — live runs showed the fork can
    // complete server-side (the copy appears under Explore/My Agents)
    // WITHOUT the page actually navigating, so `safeWaitForURL` waiting on
    // the redirect timed out at 60s with no fallback. CreateMentorPage's
    // create flow is the proven, already-widely-used isolation primitive
    // (journeys 02/09/44/47/54/56/etc.) with a verified navigation
    // (`createWithName` asserts the URL change itself), so it's used
    // unconditionally instead of relying on the fork's redirect at all.
    let hasSettings = false;
    try {
      await menuTarget.waitFor({ state: 'visible', timeout: 10_000 });
      hasSettings = true;
    } catch {
      hasSettings = false;
    }

    if (!hasSettings) {
      await this.switchToEditableMentor();
      // The dropdown may have closed (navigation) or re-rendered for the
      // newly-selected, owned mentor — (re)open it and retry.
      await expect(dropdown).toBeVisible({ timeout: 30_000 });
      await dropdown.click();
      await expect(menuTarget).toBeVisible({ timeout: 10_000 });
    }

    await menuTarget.click();

    await expect(this.dialog).toBeVisible({ timeout: 15_000 });

    // The SDK sometimes leaves aria-hidden on the Edit dialog's ancestor chain
    // (e.g. after a prior dialog unmounted without fully cleaning up Radix's
    // hideOthers). Repair the a11y tree unconditionally so that
    // navigateToTab's getByRole queries always resolve.
    await this.unhideEditDialog();

    // Wait for the modal to finish hydrating before handing control back.
    await this.waitForHydrated();

    if (tabName) {
      await this.navigateToTab(tabName);
    }
  }

  /**
   * Block until the Edit Agent modal has finished loading its segment list.
   *
   * The modal renders only a header + spinner (`isLoading`) until BOTH the
   * per-mentor settings query AND the modal's RBAC prefetch resolve
   * (see `edit-mentor-modal/index.tsx`). On freshly-created or
   * rapidly-navigated mentors — exactly what these journeys create in their
   * `beforeEach` — the mentor context churns while it settles and the RBAC
   * prefetch can 400 for a not-yet-fully-provisioned mentor, so hydration
   * routinely takes ~30s+ locally and longer on slower CI workers (a 60s cap
   * was observed to be exceeded there — hence 90s). Waiting on the first real
   * segment tab (a Radix `TabsTrigger`, uniquely `aria-controls="panel-…"`)
   * means every segment is mounted before callers (navigateToTab / test
   * bodies) touch the sidebar, instead of racing the spinner.
   *
   * Public so specs that open the modal through their own path (e.g. the
   * navbar mentor-dropdown deep-link in journey 39) can wait for the same
   * signal before asserting on segment tabs.
   */
  async waitForHydrated(): Promise<void> {
    // Fail fast with a meaningful signal when the dialog isn't open at all
    // (a caller drove a tab helper without open()) — otherwise the segment
    // wait below burns its full 90s on a dialog that will never appear.
    await expect(
      this.dialog,
      'Edit Agent dialog must be open before waiting for hydration — call open() first',
    ).toBeVisible({ timeout: 15_000 });
    await this.dialog
      .locator('[role="tab"][aria-controls^="panel-"]:visible')
      .first()
      .waitFor({ state: 'visible', timeout: 90_000 });
  }

  /**
   * Get off a mentor this admin can't edit and onto one they can.
   *
   * Called from `open()` when the "Selected agent" dropdown is open but has
   * no "Settings" menu item — only mentors this admin owns expose it. A
   * non-owned mentor (e.g. a public/forkable template mentor from the main
   * tenant catalog) instead shows only "New Chat" and, for forkable ones, a
   * "Modify" footer action (see `handleModifyMentor` / `showForkButton` in
   * `app/platform/[tenantKey]/[mentorId]/_components/nav-bar/index.tsx`).
   *
   * Does NOT use "Modify": it's a one-click server-side fork
   * (`useForkMentorMutation`) that is supposed to redirect to the new copy,
   * but a live run showed the fork can complete (the copy shows up under
   * Explore/My Agents) WITHOUT the page navigating — leaving nothing to
   * `safeWaitForURL` on and hanging for the full timeout. Unconditionally
   * uses `CreateMentorPage.openAndCreate()` instead: the same isolation
   * primitive already proven across journeys 02/09/44/47/54/56/etc., whose
   * `createWithName` step asserts the resulting URL change itself, so there
   * is no redirect to guess at.
   *
   * Assumes the dropdown is currently open on the non-editable mentor's
   * menu. Leaves the dropdown closed and the page navigated to a fresh,
   * owned, editable mentor — the caller is responsible for reopening it.
   */
  private async switchToEditableMentor(): Promise<void> {
    // Close the open dropdown first — CreateMentorPage.open() drives the
    // sidebar's "Agents" / "New Agent" entry points and doesn't expect a
    // dropdown menu floating on top of them.
    await this.page.keyboard.press('Escape');

    // CreateMentorPage.open() clicks "Agents" expecting it to expand an
    // inline collapsible section containing "New Agent" — that only mounts
    // when the sidebar itself is in its full (non icon-rail) width. A live
    // run hit a session where the sidebar was already collapsed to the icon
    // rail (a `<aside>`-level "Expand sidebar" toggle, a different concept
    // from the "Agents" section's own aria-expanded state), so "New Agent"
    // never appeared and openAndCreate() timed out. Reuse SidebarPage's
    // proven `ensureExpanded()` (already used by other page objects for the
    // same reason) so this is deterministic regardless of leftover sidebar
    // state on the shared admin storageState.
    await new SidebarPage(this.page).ensureExpanded();

    await new CreateMentorPage(this.page).openAndCreate();
    await waitForPageReady(this.page);
    await this.restoreAppChrome();
  }

  /**
   * Opens the Edit Mentor modal via the sidebar's Agents → My Agents flow:
   * expands the Agents section, clicks My Agents to surface the agent list,
   * then clicks the first row. This path is the regression case behind
   * `edit-mentor-modal/index.tsx`'s RBAC-hydration effect — the page mentor's
   * RBAC is loaded on boot, but a sibling agent opened from this list has no
   * permissions cached and the segment filter would otherwise strip every
   * tab except Privacy. The companion test in journey 06 asserts the full
   * sidebar still renders.
   */
  async openFromMyAgents(): Promise<void> {
    await this.restoreAppChrome();

    const sidebar = this.page.locator('aside').first();
    const agentsTrigger = sidebar.getByRole('button', {
      name: 'Agents',
      exact: true,
    });
    await expect(agentsTrigger).toBeVisible({ timeout: 10_000 });
    const expanded = await agentsTrigger
      .getAttribute('aria-expanded')
      .catch(() => null);
    if (expanded !== 'true') {
      await agentsTrigger.click();
      await expect(agentsTrigger).toHaveAttribute('aria-expanded', 'true', {
        timeout: 5_000,
      });
    }

    const myAgents = sidebar.getByRole('button', {
      name: 'My Agents',
      exact: true,
    });
    await expect(myAgents).toBeVisible({ timeout: 10_000 });
    await myAgents.click();

    const settingsDialog = this.page.getByRole('dialog').filter({
      hasText: 'Showing the list of agents available in your tenant',
    });
    await expect(settingsDialog).toBeVisible({ timeout: 30_000 });

    // Agents list is fetched server-side with pagination — on tenants with
    // many agents the first page can take a while to arrive. Wait for the
    // first row to render before reaching for the clickable name inside it.
    const agentRows = settingsDialog.locator('tbody tr');
    await expect(agentRows.first()).toBeVisible({ timeout: 90_000 });

    // Mentor names live in a `div` with `cursor-pointer` inside the first
    // cell of each row (see `components/modals/settings-modal.tsx`).
    const firstAgentName = settingsDialog
      .locator('tbody tr td:first-child div.cursor-pointer')
      .first();
    await expect(firstAgentName).toBeVisible({ timeout: 30_000 });
    await firstAgentName.click();

    // The Edit dialog opens on top of the still-open settings list, which
    // leaves it aria-hidden. Repair the a11y tree before role-based queries.
    await this.unhideEditDialog();

    await expect(this.dialog).toBeVisible({ timeout: 35_000 });

    // Same hydration story as open(): a sibling mentor picked from the list
    // has no cached settings/RBAC, so the modal shows its spinner while both
    // load — callers (journey 06 asserts the full segment sidebar) must not
    // race it.
    await this.waitForHydrated();
  }

  async navigateToTab(tabName: string): Promise<void> {
    // The modal re-enters its loading spinner whenever its mentor context
    // changes with the dialog left open (e.g. Copy Mentor's submit points the
    // open dialog at the freshly-copied mentor — journey 36), unmounting every
    // segment tab until settings + RBAC re-hydrate. Wait for hydration at
    // entry so callers never race the spinner; on an already-hydrated modal
    // the first segment tab is visible and this returns immediately.
    //
    // A single entry-wait is not enough for the context-switch case: right
    // after the switch there is a pre-spinner window where the OLD mentor's
    // tabs are still mounted, so the entry-wait passes instantly and the
    // spinner then swallows the tabs mid-navigation. `attemptNavigate` throws
    // on that race (its 15s tab-wait outlives the window), so retry once —
    // by then waitForHydrated genuinely blocks until re-hydration completes.
    await this.waitForHydrated();
    try {
      await this.attemptNavigateToTab(tabName);
    } catch (firstError) {
      const spinnerLikelyAppeared =
        (await this.dialog
          .locator('[role="tab"][aria-controls^="panel-"]:visible')
          .count()
          .catch(() => 0)) === 0;
      if (!spinnerLikelyAppeared) throw firstError;
      await this.waitForHydrated();
      await this.attemptNavigateToTab(tabName);
    }
  }

  private async attemptNavigateToTab(tabName: string): Promise<void> {
    // The sidebar now renders only the segments belonging to the active
    // category, so segment triggers outside that category aren't in the DOM
    // yet. Switch to the segment's category first when known.
    const category = TAB_CATEGORY[tabName];
    if (category) {
      // Scope to the visible category pill. Each pill is rendered twice
      // (desktop sidebar + compact mobile strip); `:visible` isolates the one
      // for the active breakpoint so the locator resolves to a single element.
      const categoryTab = this.dialog
        .getByRole('tab', { name: category, exact: true })
        .and(this.dialog.locator(':visible'));
      // The category strip only renders when MORE THAN ONE category has items
      // (see `showCategoryStrip` in edit-mentor-modal/index.tsx). When RBAC
      // leaves a single category, the strip is dropped and every segment sits
      // in the one visible list already — so treat the category switch as
      // best-effort: wait a bounded time for the pill, and if it never
      // appears, fall through to the segment lookup below.
      const hasStrip = await categoryTab
        .first()
        .waitFor({ state: 'visible', timeout: 15_000 })
        .then(() => true)
        .catch(() => false);
      if (hasStrip) {
        const categoryActive =
          (await categoryTab
            .first()
            .getAttribute('data-state')
            .catch(() => null)) === 'active';
        if (!categoryActive) {
          await categoryTab.first().click();
          // Wait for the pill to flip `data-state` to active rather than
          // sleeping — when active, the category's segments are guaranteed
          // mounted.
          await expect(categoryTab.first()).toHaveAttribute(
            'data-state',
            'active',
            { timeout: 5_000 },
          );
        }
      }
    }

    // Scope to the host sidebar trigger. The SDK's Voice tab renders its own
    // "Voice" sub-tab pill (also role="tab", same accessible name) inside the
    // panel once it mounts, so a bare getByRole('tab', { name }) match raises a
    // strict-mode violation for Voice/Screen. Every host sidebar trigger
    // uniquely owns `aria-controls="panel-<value>"`; the SDK sub-tabs control a
    // generated `radix-*` id, so filtering on that prefix isolates the sidebar
    // tab without needing to know each segment's value.
    //
    // `:visible` additionally excludes the host's hidden responsive twin —
    // every sidebar trigger is rendered twice (desktop `#desktop-tab-<value>`
    // + compact `#tab-<value>`); both own the same `aria-controls`, so without
    // the visibility filter the locator resolves to two elements and `.click`
    // hangs waiting for the strict-mode collision to resolve itself.
    const tab = this.dialog
      .getByRole('tab', { name: tabName, exact: true })
      .and(this.dialog.locator('[aria-controls^="panel-"]:visible'));
    // Wait for the tab to actually appear before reaching for its state.
    // The modal renders a loading spinner until mentor-settings + RBAC have
    // hydrated; segment-list tabs only mount once both resolve. Using waitFor
    // here means callers don't have to know about that timing.
    await tab.waitFor({ state: 'visible', timeout: 15_000 });
    const isActive =
      (await tab.getAttribute('data-state').catch(() => null)) === 'active';
    if (!isActive) {
      await tab.click();
      // Wait for the tab to register as active; this is more reliable than
      // a fixed sleep across slow/fast machines.
      await expect(tab).toHaveAttribute('data-state', 'active', {
        timeout: 5_000,
      });
    }
  }

  async close(): Promise<void> {
    // If the parent dialog is already gone (e.g. an earlier teardown step
    // already closed it), nothing to do.
    const dialogCount = await this.dialog.count().catch(() => 0);
    if (dialogCount === 0) return;

    // The Edit Mentor dialog hosts portal-rendered child modals (New Skill,
    // Edit Skill, Delete Skill, New/Edit Instance, Disconnect Instance,
    // generated Embed Code dialog, etc.). When a child modal is left open,
    // its overlay covers the parent and intercepts pointer events — making
    // the parent's Close button appear "visible, enabled and stable" yet
    // unclickable. Dismiss any leftover child modals first via Escape so
    // cleanup can proceed even when an earlier API call left a modal stuck open.
    //
    // Two overlay patterns for child modals:
    //   1. SDK custom layers: [data-iblai-dialog-interaction-layer][data-state="open"]
    //   2. Standard Radix dialogs (e.g. the "Embedded Code" dialog rendered by
    //      `components/ui/dialog.tsx`) that use a plain `[data-state="open"]`
    //      overlay without the SDK custom attribute.
    //
    // IMPORTANT: the My Agents flow opens Edit Agent on top of the still-open
    // Settings list dialog (a PARENT dialog, not a child). We must NOT press
    // Escape in that case — it would dismiss the topmost Edit Agent dialog
    // rather than a child, leaving the Settings parent open and the test dirty.
    // We detect this by subtracting known parent dialogs from the count: the
    // Settings list dialog contains the text "Showing the list of agents".
    for (let attempt = 0; attempt < 8; attempt++) {
      const sdkOverlay = this.page.locator(
        '[data-iblai-dialog-interaction-layer][data-state="open"]',
      );
      const sdkOverlayCount = await sdkOverlay.count().catch(() => 0);

      // Count open dialogs then subtract any known parent dialogs (the
      // Settings list that remains open in the My Agents flow). Child
      // modals are those opened ON TOP of Edit Agent — they need dismissal.
      const allDialogCount = await this.page
        .getByRole('dialog')
        .count()
        .catch(() => 0);
      const parentSettingsDialogCount = await this.page
        .getByRole('dialog')
        .filter({ hasText: 'Showing the list of agents' })
        .count()
        .catch(() => 0);
      const childDialogCount = allDialogCount - parentSettingsDialogCount;

      if (sdkOverlayCount === 0 && childDialogCount <= 1) break;
      await this.page.keyboard.press('Escape').catch(() => {});
      await this.page.waitForTimeout(300);
    }

    // The parent might have been closed by a stray Escape that propagated
    // through the modal stack. Re-check before asserting the close button.
    const stillOpen = await this.dialog.count().catch(() => 0);
    if (stillOpen === 0) return;

    await expect(this.closeButton).toBeVisible({ timeout: 5_000 });
    // The Edit Agent dialog's top-right Close (X) can be occluded at its exact
    // pixel by a stacked, aria-hidden sibling "Edit Agent" dialog. In the My
    // Agents flow the global `showEditMentorModal` flag drives TWO mounted
    // EditMentorModal instances at once (nav-bar/index.tsx and the one the open
    // SettingsModal renders, settings-modal.tsx). Both portal a layout-identical
    // DialogContent to <body> with the X at the same `absolute top-4 right-4`.
    // Radix's hideOthers() marks the backgrounded duplicate aria-hidden — so
    // getByRole resolves `closeButton` to the single foreground one — but
    // aria-hidden only drops a node from the a11y tree; it stays in layout and
    // remains a valid pointer hit-test target, so the duplicate's X (or the
    // Settings overlay) can sit on top and intercept the click, timing it out.
    //
    // Dispatch a native click straight onto the resolved Close button instead of
    // click()'s hit-testing. Radix DialogClose closes purely via React onClick
    // (no onPointerDown/onMouseDown — @radix-ui/react-dialog), and the dialog
    // portals under React's root container, so the bubbling DOM click reaches
    // React's delegated listener and fires onOpenChange(false) → onClose
    // regardless of what is painted on top. The toBeVisible() above guarantees
    // `closeButton` is the single mounted, attached Edit Agent Close before we
    // dispatch. On the non-stacked open() path (one dialog, no occlusion) this
    // behaves identically to a normal click.
    await this.closeButton.dispatchEvent('click');
    await expect(this.dialog).not.toBeVisible({ timeout: 10_000 });

    // The SDK dialog frequently leaves the app shell `aria-hidden="true"`
    // after closing, hiding the navbar/chat chrome from the a11y tree and
    // breaking role-based queries that callers run right after close()
    // (e.g. the chat "Prompts" button, the User-mode switch). Restore it.
    await this.restoreAppChrome();
  }

  async isOpen(): Promise<boolean> {
    return this.dialog.isVisible({ timeout: 2_000 }).catch(() => false);
  }
}
