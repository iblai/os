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
    this.copyMentorDialog = new CopyMentorPage(page);
  }

  /**
   * Opens the Edit Mentor modal via the mentor dropdown menu item.
   * Pass the tab name to navigate directly to a specific tab.
   */
  async open(tabName?: string): Promise<void> {
    const dropdown = this.page.getByRole('button', {
      name: 'Selected agent dropdown button',
    });
    await expect(dropdown).toBeVisible({ timeout: 15_000 });
    await dropdown.click();

    // Find the menu item — the dropdown now shows "Modify" to open the edit dialog
    const menuTarget = this.page
      .getByRole('menuitem', { name: /modify/i })
      .or(this.page.getByRole('menuitem', { name: /settings/i }).first());

    await expect(menuTarget).toBeVisible({ timeout: 10_000 });
    await menuTarget.click();

    await expect(this.dialog).toBeVisible({ timeout: 15_000 });

    if (tabName) {
      await this.navigateToTab(tabName);
    }
  }

  async navigateToTab(tabName: string): Promise<void> {
    const tab = this.dialog.getByRole('tab', { name: tabName });
    const isActive =
      (await tab.getAttribute('data-state').catch(() => null)) === 'active';
    if (!isActive) {
      await tab.click();
      await this.page.waitForTimeout(500);
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
