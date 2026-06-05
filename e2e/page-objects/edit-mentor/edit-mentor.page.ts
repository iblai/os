import { Page, Locator, expect } from '@playwright/test';
import { SettingsTab } from './settings.tab';
import { LlmTab } from './llm.tab';
import { ToolsTab } from './tools.tab';
import { PromptsTab } from './prompts.tab';
import { DisclaimersTab } from './disclaimers.tab';
import { DatasetsTab } from './datasets.tab';
import { HistoryTab } from './history.tab';
import { MemoryTab } from './memory.tab';
import { McpTab } from './mcp.tab';
import { EmbedTab } from './embed.tab';
import { CopyMentorPage } from './copy-mentor.page';
import { AccessTab } from './access.tab';
import { PrivacyTab } from './privacy.tab';
import { VoiceTab } from './voice.tab';
import { ScreenShareTab } from './screenshare.tab';

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
  'Configurations' | 'Integrations' | 'Analytics'
> = {
  Settings: 'Configurations',
  Sandbox: 'Configurations',
  Access: 'Configurations',
  LLM: 'Configurations',
  Prompts: 'Configurations',
  Skills: 'Configurations',
  Safety: 'Configurations',
  Privacy: 'Configurations',
  Disclaimers: 'Configurations',
  Tools: 'Configurations',
  MCP: 'Integrations',
  Datasets: 'Integrations',
  API: 'Integrations',
  Embed: 'Integrations',
  Voice: 'Configurations',
  'Screen Share': 'Configurations',
  Memory: 'Analytics',
  History: 'Analytics',
  Audit: 'Analytics',
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
  readonly history: HistoryTab;
  readonly memory: MemoryTab;
  readonly mcp: McpTab;
  readonly embed: EmbedTab;
  readonly access: AccessTab;
  readonly privacy: PrivacyTab;
  readonly voice: VoiceTab;
  readonly screenshare: ScreenShareTab;
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
    this.history = new HistoryTab(page, this.dialog);
    this.memory = new MemoryTab(page, this.dialog);
    this.mcp = new McpTab(page, this.dialog);
    this.embed = new EmbedTab(page, this.dialog);
    this.access = new AccessTab(page, this.dialog);
    this.privacy = new PrivacyTab(page, this.dialog);
    this.voice = new VoiceTab(page, this.dialog);
    this.screenshare = new ScreenShareTab(page, this.dialog);
    this.copyMentorDialog = new CopyMentorPage(page);
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

    await expect(menuTarget).toBeVisible({ timeout: 10_000 });
    await menuTarget.click();

    await expect(this.dialog).toBeVisible({ timeout: 15_000 });

    if (tabName) {
      await this.navigateToTab(tabName);
    }
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

    const settingsDialog = this.page
      .getByRole('dialog')
      .filter({ hasText: 'Showing the list of agents available in your tenant' });
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
  }

  async navigateToTab(tabName: string): Promise<void> {
    // The sidebar now renders only the segments belonging to the active
    // category, so segment triggers outside that category aren't in the DOM
    // yet. Switch to the segment's category first when known.
    const category = TAB_CATEGORY[tabName];
    if (category) {
      const categoryTab = this.dialog.getByRole('tab', {
        name: category,
        exact: true,
      });
      const categoryActive =
        (await categoryTab.getAttribute('data-state').catch(() => null)) ===
        'active';
      if (!categoryActive) {
        await categoryTab.click();
        // Wait for Radix to flip `data-state` to active rather than sleeping —
        // when active, the new category's segments are guaranteed mounted.
        await expect(categoryTab).toHaveAttribute('data-state', 'active', {
          timeout: 5_000,
        });
      }
    }

    // Scope to the host sidebar trigger. The SDK's Voice tab renders its own
    // "Voice" sub-tab pill (also role="tab", same accessible name) inside the
    // panel once it mounts, so a bare getByRole('tab', { name }) match raises a
    // strict-mode violation for Voice/Screen Share. Every host sidebar trigger
    // uniquely owns `aria-controls="panel-<value>"`; the SDK sub-tabs control a
    // generated `radix-*` id, so filtering on that prefix isolates the sidebar
    // tab without needing to know each segment's value.
    const tab = this.dialog
      .getByRole('tab', { name: tabName, exact: true })
      .and(this.dialog.locator('[aria-controls^="panel-"]'));
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
    // etc.). When a child modal is left open, its Radix overlay
    // (`[data-iblai-dialog-interaction-layer]`) covers the parent and
    // intercepts pointer events — making the parent's Close button
    // appear "visible, enabled and stable" yet unclickable. Dismiss any
    // leftover child modals first via Escape so cleanup can proceed
    // even when an earlier API call left a modal stuck open.
    for (let attempt = 0; attempt < 5; attempt++) {
      const overlay = this.page.locator(
        '[data-iblai-dialog-interaction-layer][data-state="open"]',
      );
      const overlayCount = await overlay.count().catch(() => 0);
      if (overlayCount === 0) break;
      await this.page.keyboard.press('Escape').catch(() => {});
      await this.page.waitForTimeout(250);
    }

    // The parent might have been closed by a stray Escape that propagated
    // through the modal stack. Re-check before asserting the close button.
    const stillOpen = await this.dialog.count().catch(() => 0);
    if (stillOpen === 0) return;

    await expect(this.closeButton).toBeVisible({ timeout: 5_000 });
    await this.closeButton.click();
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
