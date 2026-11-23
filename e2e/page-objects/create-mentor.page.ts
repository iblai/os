import { Page, Locator, Request, expect } from '@playwright/test';
import { safeWaitForURL } from '../utils/navigation';
import {
  waitForPageReady,
  reliableClick,
  isVisibleWithin,
} from '../utils/resilient';
import { SidebarPage } from './sidebar.page';
import { NavbarPage } from './navbar.page';
import { EditMentorPage } from './edit-mentor/edit-mentor.page';
import { observeDmBase } from '../utils/dm-api';
import { registerMentor } from '../utils/resource-tracker';
import { E2E_LLM_DISPLAY_NAME, E2E_LLM_NAME } from '../fixtures/test-data';

export interface CreatedAgent {
  name: string;
  /** The agent's id (its slug in the platform URL), from the create response. */
  mentorId: string;
  /** The `mentor-with-settings` POST that created the agent. */
  request: Request;
}

/**
 * The Create Agent dialog. Create Agent is a wizard (iblai-platform#2853):
 * step 1 names the agent and creating it keeps the person in the wizard, so
 * the helpers that used to "create and land on the new agent" fill step 1,
 * click Next and then close the wizard, which opens the new agent's chat.
 */
export class CreateMentorPage {
  readonly page: Page;
  readonly dialog: Locator;
  readonly heading: Locator;
  readonly nameInput: Locator;
  readonly descriptionInput: Locator;
  readonly categoryCombobox: Locator;
  readonly categoryList: Locator;
  readonly categorySearchInput: Locator;
  readonly nextButton: Locator;
  readonly closeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByRole('dialog', { name: /create.*agent/i });
    this.heading = this.dialog.getByRole('heading', { name: 'Create Agent' });
    this.nameInput = this.dialog.locator('#create-agent-name');
    this.descriptionInput = this.dialog.locator('#create-agent-description');
    this.categoryCombobox = this.dialog.getByRole('combobox', {
      name: /category/i,
    });
    this.categoryList = page.locator('[cmdk-list]').last();
    this.categorySearchInput =
      this.dialog.getByPlaceholder('Search category...');
    this.nextButton = this.dialog.getByRole('button', {
      name: 'Next',
      exact: true,
    });
    this.closeButton = this.dialog.getByRole('button', {
      name: 'Close',
      exact: true,
    });
  }

  static isCreateRequest(request: Request): boolean {
    return (
      request.method() === 'POST' &&
      /\/mentor-with-settings\/?(?:\?|$)/.test(request.url())
    );
  }

  /** Multipart part names of a create request (`new_mentor_name`, `mentor_visibility`, ...). */
  static createRequestFields(request: Request): string[] {
    const body = request.postData();
    if (body === null) {
      throw new Error(`No readable body on create request ${request.url()}`);
    }
    return [
      ...body.matchAll(/content-disposition:\s*form-data;\s*name="([^"]+)"/gi),
    ].map((match) => match[1]);
  }

  /** Value of a single-line multipart part of a create request. */
  static createRequestValue(
    request: Request,
    field: string,
  ): string | undefined {
    return new RegExp(`name="${field}"\\r?\\n\\r?\\n([^\\r\\n]*)`).exec(
      request.postData() ?? '',
    )?.[1];
  }

  /**
   * Open the Create Mentor modal via the sidebar "New Agent" entry.
   *
   * In the new sidebar, "New Agent" lives inside the collapsible
   * "Agents" section (alongside "My Agents" and "Explore"). Radix
   * Collapsible hides items when the section is closed, so we expand
   * Agents first and only then click New Agent.
   */
  async open(): Promise<void> {
    observeDmBase(this.page);
    // "New Agent" only mounts at full sidebar width, and the sidebar starts in
    // its icon-rail form unless a `sidebar_state=true` cookie is present.
    await new SidebarPage(this.page).ensureExpanded();

    const agentsTrigger = this.page.getByRole('button', {
      name: 'Agents',
      exact: true,
    });
    if (await isVisibleWithin(agentsTrigger, 15_000)) {
      const expanded = await agentsTrigger
        .getAttribute('aria-expanded')
        .catch(() => null);
      if (expanded !== 'true') {
        await agentsTrigger.click();
      }
    }

    const newMentorBtn = this.page.getByRole('button', {
      name: 'New Agent',
      exact: true,
    });
    await expect(newMentorBtn).toBeVisible({ timeout: 10_000 });
    await newMentorBtn.click();
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Wait until the form accepts input. Inputs stay disabled while the
   * categories and the field permissions load, and the field grid renders only
   * once both settled, so a field that is absent after this returns is hidden
   * for good.
   */
  async waitUntilEditable(): Promise<void> {
    // The modal starts with fields disabled while mentor categories load from
    // the API (isLoadingMentorCategories). Use a generous timeout to
    // accommodate slow environments / cold API caches.
    //
    // When multiple parallel workers each open the Create Agent dialog at the
    // same time, the categories API can become overwhelmed and time out. In
    // that case we close and reopen the dialog once — the retry almost always
    // resolves because the server-side API cache has since warmed up. This
    // is a best-effort recovery; the second wait uses the full 60 s budget.
    let inputEnabled = false;
    try {
      await expect(this.nameInput).toBeEnabled({ timeout: 20_000 });
      inputEnabled = true;
    } catch {
      // Categories API may be overloaded — close, wait briefly, then reopen.
    }
    if (!inputEnabled) {
      await this.page.keyboard.press('Escape');
      try {
        await expect(this.dialog).not.toBeVisible({ timeout: 10_000 });
      } catch {
        // Dialog may have already closed; continue.
      }
      await this.open();
      await expect(this.nameInput).toBeEnabled({ timeout: 60_000 });
    }
  }

  /** Fill step 1's required fields; leaves Next enabled. Category is optional. */
  async fillRequiredFields(name: string, description?: string): Promise<void> {
    await this.waitUntilEditable();
    await this.nameInput.fill(name);
    await this.descriptionInput.fill(
      description || `E2E test mentor created at ${Date.now()}`,
    );
    await expect(this.nextButton).toBeEnabled({ timeout: 10_000 });
  }

  /** Select the first category of the (optional) Category field. */
  async pickFirstCategory(): Promise<void> {
    // The cmdk option list streams in from the categories API and can be slow
    // or briefly empty under parallel load; toggle the combobox to re-trigger
    // the fetch if nothing shows.
    await this.categoryCombobox.click();
    const firstCategory = this.page.locator('[role="option"]').first();
    const optionVisible = await firstCategory
      .waitFor({ state: 'visible', timeout: 20_000 })
      .then(() => true)
      .catch(() => false);
    if (!optionVisible) {
      await this.categoryCombobox.click();
      await this.page.waitForTimeout(1_000);
      await this.categoryCombobox.click();
      await firstCategory.waitFor({ state: 'visible', timeout: 20_000 });
    }
    // The list re-renders as more categories arrive, detaching the first
    // option mid-click; reliableClick retries the whole click.
    await reliableClick(this.page, firstCategory, 10_000);
  }

  /**
   * Fill step 1 and click Next. Creating keeps the wizard open on its next
   * step. Returns the agent and the create request.
   */
  async createInWizard(name?: string): Promise<CreatedAgent> {
    const mentorName = name || `E2E Mentor ${Date.now()}`;
    await this.fillRequiredFields(mentorName);

    let createRequest: Request | undefined;
    const onRequest = (request: Request) => {
      if (CreateMentorPage.isCreateRequest(request)) createRequest ??= request;
    };
    this.page.on('request', onRequest);
    try {
      const created = this.page.waitForResponse(
        (res) => CreateMentorPage.isCreateRequest(res.request()),
        { timeout: 60_000 },
      );
      await this.nextButton.click();
      const response = await created;
      if (!response.ok()) {
        throw new Error(`Creating the agent failed: ${response.status()}`);
      }
      const body = (await response.json()) as { unique_id?: string };
      if (!body.unique_id) {
        throw new Error('The create response names no agent (unique_id)');
      }
      if (!createRequest) {
        throw new Error('Next sent no mentor-with-settings request');
      }
      await registerMentor(this.page, mentorName, body.unique_id);
      return {
        name: mentorName,
        mentorId: body.unique_id,
        request: createRequest,
      };
    } finally {
      this.page.off('request', onRequest);
    }
  }

  /** Close the wizard after step 1: the new agent's chat opens. */
  async closeAndOpenAgent(mentorId: string): Promise<void> {
    await this.closeButton.click();
    await safeWaitForURL(
      this.page,
      (url) => url.pathname.split('/')[3] === mentorId,
      { timeout: 60_000 },
    );
    await waitForPageReady(this.page);
  }

  /**
   * Fill step 1, click Next, then close the wizard so the new agent's chat is
   * open, and pin it to the suite default LLM. Returns the generated name.
   */
  async createWithName(name?: string): Promise<string> {
    const { name: mentorName, mentorId } = await this.createInWizard(name);
    await this.closeAndOpenAgent(mentorId);
    await this.pinLlm();
    return mentorName;
  }

  /**
   * Like `createWithName` but leaves the wizard open on step 2 and returns the
   * create request so a test can inspect what was sent. Does not pin the LLM.
   */
  async createAndCaptureRequest(name?: string): Promise<CreatedAgent> {
    return this.createInWizard(name);
  }

  /**
   * Pin the mentor to the suite-wide default LLM (issue #2534) so
   * chat-driving tests don't depend on the backend's `iblai-pro` default,
   * which routes each message to whatever model it judges best and shares
   * quota with provider-specific tests (e.g. journey 52's OpenAI pins).
   * No-op if the navbar already shows the target model.
   */
  private async pinLlm(): Promise<void> {
    const navbarPage = new NavbarPage(this.page);
    const currentLlmLabel = await navbarPage.getLlmNameText();
    if (currentLlmLabel?.trim() === E2E_LLM_DISPLAY_NAME) return;

    const editMentorPage = new EditMentorPage(this.page);
    await editMentorPage.open('LLM');
    await editMentorPage.llm.selectProviderAndModel('ibl.ai', E2E_LLM_NAME);
    await editMentorPage.close();
  }

  /**
   * Open the modal and create a mentor in one step.
   * Returns the generated mentor name.
   */
  async openAndCreate(name?: string): Promise<string> {
    await this.open();
    return this.createWithName(name);
  }

  async isOpen(): Promise<boolean> {
    return isVisibleWithin(this.dialog, 2_000);
  }

  async close(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await expect(this.dialog).not.toBeVisible({ timeout: 15_000 });
  }
}
