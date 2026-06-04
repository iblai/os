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
  async open(tabName?: string): Promise<void> {
    // Radix/SDK Dialog cleanup can leave behind body[data-scroll-locked],
    // <body style="pointer-events: none"> and a stale
    // `[data-slot="sidebar-wrapper"][aria-hidden="true"]` when a previous
    // Dialog is unmounted while still open. The SDK Edit Agent dialog does
    // NOT reliably restore these on close, so a passive
    // `waitFor({ state: 'detached' })` never resolves — it burns its full
    // timeout and surfaces as a red step even though the test continues.
    // Restore the page chrome ourselves (the SDK should have), then confirm
    // the stale markers are gone. This keeps the nav-bar trigger clickable
    // and visible to the a11y tree, and leaves the trace green.
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

    const tab = this.dialog.getByRole('tab', { name: tabName, exact: true });
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
  }

  async isOpen(): Promise<boolean> {
    return this.dialog.isVisible({ timeout: 2_000 }).catch(() => false);
  }
}
