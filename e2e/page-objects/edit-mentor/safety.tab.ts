import { Page, Locator, expect } from '@playwright/test';

/**
 * Page object for the Safety tab inside the Edit Mentor modal.
 *
 * Locators are deliberately behavioural (role / accessible name / visible
 * text) so the same page object keeps working when OS's own `SafetyTab` is
 * replaced by the SDK's `AgentSafetyTab`. Do NOT add OS-only class names or
 * `data-testid`s here (e.g. OS's `safety-info-box` has no SDK counterpart).
 */

export type SafetyCard =
  | 'Moderation Prompt'
  | 'Safety Prompt'
  | 'Moderation Response'
  | 'Safety Response';

export const SAFETY_CARDS: readonly SafetyCard[] = [
  'Moderation Prompt',
  'Safety Prompt',
  'Moderation Response',
  'Safety Response',
];

/** The two cards that carry an Active/Inactive switch. */
export type SafetySwitchCard = 'Moderation Prompt' | 'Safety Prompt';

/** aria-label of each card's scrollable content region. */
const CONTENT_REGION: Record<SafetyCard, string> = {
  'Moderation Prompt': 'Moderation prompt content',
  'Safety Prompt': 'Safety prompt content',
  'Moderation Response': 'Moderation response content',
  'Safety Response': 'Safety response content',
};

/** Accessible-name stem of each switch ("{stem} enabled|disabled"). */
const SWITCH_STEM: Record<SafetySwitchCard, string> = {
  'Moderation Prompt': 'Moderation prompt',
  'Safety Prompt': 'Safety prompt',
};

/** aria-label of each switch card's info icon. */
const INFO_LABEL: Record<SafetySwitchCard, string> = {
  'Moderation Prompt': 'More info about moderation prompt',
  'Safety Prompt': 'More info about safety prompt',
};

export const SAFETY_TOOLTIP: Record<SafetySwitchCard, string> = {
  'Moderation Prompt': 'Controls Content Moderation',
  'Safety Prompt': 'Controls Safety Filtering',
};

export const SAFETY_UPDATED_TOAST = 'Agent updated successfully';

export interface MockModerationLog {
  id: number;
  username: string;
  target_system: 'Moderation System' | 'Safety System';
  prompt: string;
  reason: string;
  date_created: string;
}

export class SafetyTab {
  readonly page: Page;
  readonly dialog: Locator;

  readonly heading: Locator;
  readonly description: Locator;
  readonly viewFlaggedPromptsButton: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.heading = dialog.getByRole('heading', { name: 'Safety', exact: true });
    this.description = dialog.getByText(
      'Configure safety and moderation settings.',
      { exact: true },
    );
    this.viewFlaggedPromptsButton = dialog.getByRole('button', {
      name: 'View Flagged Prompts',
    });
  }

  cardHeading(card: SafetyCard): Locator {
    return this.dialog.getByRole('heading', { name: card, exact: true });
  }

  /** Nearest ancestor of the card's heading that also holds its Edit button. */
  card(card: SafetyCard): Locator {
    return this.cardHeading(card).locator(
      'xpath=ancestor::div[.//button[normalize-space()="Edit"]][1]',
    );
  }

  contentRegion(card: SafetyCard): Locator {
    return this.dialog.getByRole('region', { name: CONTENT_REGION[card] });
  }

  editButton(card: SafetyCard): Locator {
    return this.card(card).getByRole('button', { name: 'Edit', exact: true });
  }

  copyButton(card: SafetyCard): Locator {
    return this.card(card).getByRole('button', {
      name: /^(Copy text to clipboard|Text copied to clipboard)$/,
    });
  }

  infoIcon(card: SafetySwitchCard): Locator {
    return this.dialog.getByRole('button', { name: INFO_LABEL[card] });
  }

  /** Switch for a card, matched in either state. */
  switchFor(card: SafetySwitchCard): Locator {
    return this.dialog.getByRole('switch', {
      name: new RegExp(`^${SWITCH_STEM[card]} (enabled|disabled)$`),
    });
  }

  /** Visible "Active" / "Inactive" label inside the card. */
  statusLabel(card: SafetySwitchCard): Locator {
    return this.card(card).getByText(/^(Active|Inactive)$/);
  }

  async isSwitchOn(card: SafetySwitchCard): Promise<boolean> {
    const sw = this.switchFor(card);
    await expect(sw).toBeVisible({ timeout: 15_000 });
    return (await sw.getAttribute('aria-checked')) === 'true';
  }

  /**
   * Click the switch and wait for the PUT + refetch round trip to land (the
   * switch is controlled by the settings query, not optimistic), then return
   * the new state.
   */
  async toggle(card: SafetySwitchCard): Promise<boolean> {
    const before = await this.isSwitchOn(card);
    const sw = this.switchFor(card);
    await expect(sw).toBeEnabled({ timeout: 15_000 });
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', String(!before), {
      timeout: 20_000,
    });
    await expect(sw).toBeEnabled({ timeout: 15_000 });
    return !before;
  }

  /** Dialog opened by a card's Edit button ("Edit {label}"). */
  editDialog(card: SafetyCard): Locator {
    return this.page.getByRole('dialog', {
      name: `Edit ${card}`,
      exact: true,
    });
  }

  async openEditDialog(card: SafetyCard): Promise<Locator> {
    const btn = this.editButton(card);
    await expect(btn).toBeEnabled({ timeout: 15_000 });
    await btn.click();
    const dlg = this.editDialog(card);
    await expect(dlg).toBeVisible({ timeout: 10_000 });
    return dlg;
  }

  /** Editor surface inside an open edit dialog (rich-text editor). */
  editorIn(dlg: Locator): Locator {
    return dlg.getByRole('textbox').first().locator('div');
  }

  /** Empty the rich-text editor the way a user does (select all + delete). */
  async emptyEditor(dlg: Locator): Promise<void> {
    const editor = this.editorIn(dlg);
    await editor.click();
    await this.page.keyboard.press('ControlOrMeta+A');
    await this.page.keyboard.press('Backspace');
  }

  /**
   * Open the card's edit dialog, replace its content, Save, wait for the
   * success toast, and close the dialog.
   */
  async editPrompt(card: SafetyCard, content: string): Promise<void> {
    const dlg = await this.openEditDialog(card);
    const editor = this.editorIn(dlg);
    await expect(editor).toBeVisible({ timeout: 10_000 });
    await editor.clear();
    await editor.fill(content);
    const save = dlg.getByRole('button', { name: 'Save', exact: true });
    await expect(save).toBeEnabled({ timeout: 10_000 });
    await save.click();
    await expect(this.page.getByText(SAFETY_UPDATED_TOAST).first()).toBeVisible(
      { timeout: 15_000 },
    );
    await this.closeEditDialog(card);
  }

  async closeEditDialog(card: SafetyCard): Promise<void> {
    const dlg = this.editDialog(card);
    const close = dlg.getByRole('button', { name: 'Close', exact: true });
    await expect(close).toBeVisible({ timeout: 10_000 });
    await close.click();
    await expect(dlg).toBeHidden({ timeout: 10_000 });
  }
}

/**
 * Flagged Prompts list modal (opened by "View Flagged Prompts"). Behaviour is
 * identical before and after the SDK swap because the modal is host-provided
 * (the SDK tab takes it as the `FlaggedPromptsModal` prop).
 *
 * `mock` serves a stateful in-memory list for the moderation-logs endpoint so
 * the populated paths (pagination, filters, detail, delete) are testable
 * without creating real flagged prompts.
 */
export class FlaggedPromptsDialog {
  readonly page: Page;
  readonly root: Locator;
  readonly searchInput: Locator;
  readonly typeFilter: Locator;
  readonly emptyState: Locator;
  readonly detailPlaceholder: Locator;
  readonly nextPageButton: Locator;
  readonly previousPageButton: Locator;

  /** Query strings of every GET the dialog issued (for request assertions). */
  readonly requests: URLSearchParams[] = [];
  /** Ids the UI asked the mock to DELETE. */
  readonly deletedIds: number[] = [];

  constructor(page: Page) {
    this.page = page;
    this.root = page.getByRole('dialog', { name: 'Flagged Prompts' });
    this.searchInput = this.root.getByPlaceholder('Search for User');
    this.typeFilter = this.root.getByRole('combobox');
    this.emptyState = this.root.getByText('No flagged prompts found').first();
    this.detailPlaceholder = this.root.getByText(
      'Select a flagged prompt to view details.',
    );
    // The pagination anchors carry no href, so they expose no `link` role —
    // match by their aria-label instead.
    this.nextPageButton = this.root.getByLabel('Go to next page');
    this.previousPageButton = this.root.getByLabel('Go to previous page');
  }

  /** Install the moderation-logs mock. Must run before the dialog opens. */
  async mock(logs: MockModerationLog[]): Promise<void> {
    const remaining = [...logs];
    await this.page.route(/\/moderation-logs\//, async (route) => {
      const req = route.request();
      if (req.method() === 'DELETE') {
        const id = Number(
          new URL(req.url()).pathname.split('/').filter(Boolean).pop(),
        );
        this.deletedIds.push(id);
        const idx = remaining.findIndex((l) => l.id === id);
        if (idx >= 0) remaining.splice(idx, 1);
        await route.fulfill({ status: 204, body: '' });
        return;
      }
      if (req.method() !== 'GET') {
        await route.fallback();
        return;
      }
      const params = new URL(req.url()).searchParams;
      this.requests.push(params);
      const page = Number(params.get('page') ?? '1');
      const pageSize = Number(params.get('page_size') ?? '5');
      const search = (params.get('search') ?? '').toLowerCase();
      const target = params.get('target_system');
      const filtered = remaining.filter(
        (l) =>
          (!search || l.username.toLowerCase().includes(search)) &&
          (!target || l.target_system === target),
      );
      const results = filtered.slice((page - 1) * pageSize, page * pageSize);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: filtered.length,
          next: null,
          previous: null,
          results,
        }),
      });
    });
  }

  summary(total: number): Locator {
    return this.root.getByText(`${total} Total Flagged Prompts`);
  }

  /** Row in the list, identified by its prompt text. */
  row(promptText: string): Locator {
    return this.root.getByText(promptText, { exact: true }).first();
  }

  pageLink(n: number): Locator {
    return this.root
      .getByRole('navigation')
      .getByText(String(n), { exact: true });
  }

  async close(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await expect(this.root).toBeHidden({ timeout: 10_000 });
  }
}
