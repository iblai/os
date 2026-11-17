import { Page, Locator, Request, expect } from '@playwright/test';
import { CreateMentorPage } from './create-mentor.page';
import { PromptsTab } from './edit-mentor/prompts.tab';
import { LlmTab } from './edit-mentor/llm.tab';
import { safeWaitForURL } from '../utils/navigation';

/**
 * The Create Agent wizard (iblai-platform#2853): name step, optional LLM /
 * Prompts / Datasets / MCP steps; Finish (or Skip on the last step) opens the
 * new agent. Opened through
 * CreateMentorPage.open(), which is the same sidebar entry as the old modal.
 */
export type PromptKind = 'system' | 'proactive';

const PROMPT_KINDS: Record<
  PromptKind,
  { index: number; title: string; label: string }
> = {
  system: { index: 0, title: 'System Prompt', label: 'System prompt' },
  proactive: { index: 1, title: 'Proactive Prompt', label: 'Proactive prompt' },
};

export class CreateAgentWizardPage {
  readonly page: Page;
  readonly create: CreateMentorPage;
  readonly dialog: Locator;
  readonly stepLine: Locator;
  readonly nameInput: Locator;
  readonly descriptionInput: Locator;
  readonly categoryCombobox: Locator;
  readonly nextButton: Locator;
  readonly skipButton: Locator;
  readonly backButton: Locator;
  readonly finishButton: Locator;
  readonly closeButton: Locator;
  readonly prompts: PromptsTab;
  readonly llm: LlmTab;

  constructor(page: Page) {
    this.page = page;
    this.create = new CreateMentorPage(page);
    this.dialog = this.create.dialog;
    this.stepLine = this.dialog.getByText(/^Step \d+ of \d+$/);
    this.nameInput = this.dialog.locator('#create-agent-name');
    this.descriptionInput = this.dialog.locator('#create-agent-description');
    this.categoryCombobox = this.create.categoryCombobox;
    this.nextButton = this.dialog.getByRole('button', {
      name: 'Next',
      exact: true,
    });
    this.skipButton = this.dialog.getByRole('button', {
      name: 'Skip',
      exact: true,
    });
    this.backButton = this.dialog.getByRole('button', {
      name: 'Back',
      exact: true,
    });
    this.finishButton = this.dialog.getByRole('button', {
      name: 'Finish',
      exact: true,
    });
    this.closeButton = this.dialog.getByRole('button', {
      name: 'Close',
      exact: true,
    });
    this.prompts = new PromptsTab(page, this.dialog);
    this.llm = new LlmTab(page, this.dialog);
  }

  /** The dialog's body is named "Create Agent, step N of M". */
  body(step: number, total: number): Locator {
    return this.page.getByRole('region', {
      name: `Create Agent, step ${step} of ${total}`,
    });
  }

  async open(): Promise<void> {
    await this.create.open();
    await expect(this.nameInput).toBeEnabled({ timeout: 60_000 });
  }

  /** Fills step 1 and clicks Next; returns the new agent's id. */
  async createAgent(name: string) {
    const { mentorId } = await this.create.createInWizard(name);
    await expect(
      this.page.getByText('Agent created successfully').first(),
    ).toBeVisible({ timeout: 15_000 });
    return mentorId;
  }

  async expectStep(step: number, total?: number): Promise<void> {
    await expect(
      this.dialog.getByText(
        total
          ? `Step ${step} of ${total}`
          : new RegExp(`^Step ${step} of \\d+$`),
      ),
    ).toBeVisible({ timeout: 20_000 });
  }

  /** The "Step N of M" line: how many steps this agent's wizard has depends on the tabs the admin may use. */
  async stepPosition(): Promise<{ step: number; total: number }> {
    const line = this.dialog.getByText(/^Step \d+ of \d+$/);
    await expect(line).toBeVisible({ timeout: 20_000 });
    const [, step, total] = /Step (\d+) of (\d+)/.exec(
      (await line.innerText()).trim(),
    )!;
    return { step: Number(step), total: Number(total) };
  }

  /** Clicks Skip until the last step, where the primary button reads Finish. */
  async skipUntilFinish(): Promise<void> {
    for (let i = 0; i < 8; i += 1) {
      if (await this.finishButton.isVisible()) return;
      const { step } = await this.stepPosition();
      await this.skipButton.click();
      await expect
        .poll(async () => (await this.stepPosition()).step, {
          timeout: 20_000,
        })
        .toBeGreaterThan(step);
    }
    await expect(this.finishButton).toBeVisible({ timeout: 20_000 });
  }

  /** Clicks Skip on every step, the last one included, which finishes the wizard. */
  async skipAllSteps(): Promise<void> {
    await this.skipUntilFinish();
    await this.skipButton.click();
  }

  /** Waits for the platform URL to name `mentorId`. */
  async waitForAgentUrl(mentorId: string): Promise<void> {
    await safeWaitForURL(
      this.page,
      (url) => url.pathname.split('/')[3] === mentorId,
      { timeout: 60_000 },
    );
  }

  static createRequestCount(requests: Request[]): number {
    return requests.filter((r) => CreateMentorPage.isCreateRequest(r)).length;
  }

  /** The preview of a prompt on the Prompts step. */
  promptContent(kind: PromptKind): Locator {
    return this.dialog.getByRole('region', {
      name: `${PROMPT_KINDS[kind].label} content`,
    });
  }

  /** The popup opened by a prompt's Edit button ("Edit <prompt>"). */
  promptPopup(kind: PromptKind): Locator {
    return this.page.getByRole('dialog', {
      name: `Edit ${PROMPT_KINDS[kind].title}`,
      exact: true,
    });
  }

  /** Opens the prompt's popup, replaces its text with `text` and returns it. */
  async openPromptPopupAndType(
    kind: PromptKind,
    text: string,
  ): Promise<Locator> {
    await this.dialog
      .getByRole('button', { name: 'Edit', exact: true })
      .nth(PROMPT_KINDS[kind].index)
      .click();
    const popup = this.promptPopup(kind);
    await expect(popup).toBeVisible({ timeout: 10_000 });
    const editor = popup.locator('[contenteditable="true"]').last();
    await expect(editor).toBeVisible();
    await editor.click();
    await this.page.keyboard.press(
      process.platform === 'darwin' ? 'Meta+A' : 'Control+A',
    );
    await this.page.keyboard.press('Delete');
    await this.page.keyboard.type(text);
    return popup;
  }

  /** Skips step 2 and waits for the Prompts step. */
  async goToPromptsStep(): Promise<void> {
    await this.skipButton.click();
    await expect(this.dialog.getByTestId('prompts-info-box')).toBeVisible({
      timeout: 20_000,
    });
  }
}
