/**
 * Journey 105 — Create Agent wizard (iblai-platform#2853)
 *
 * Create Agent is a wizard: name the agent (Next creates it and stays in the
 * wizard), optional LLM / Prompts / Datasets / MCP steps, and Finish, which
 * opens the new agent's chat.
 *
 *  - caw-01 create, skip LLM, save a prompt, skip Datasets, Finish on MCP:
 *    the new agent opens and carries the prompt.
 *  - caw-02 an agent created by the wizard is Admins Only (Edit Agent >
 *    Settings > Discovery) with the three discovery switches off.
 *  - caw-03 regression: the wizard's tabs edit the NEW agent, not the agent
 *    the page is on.
 *  - caw-04 closing after step 1 opens the new agent; closing on step 1 creates
 *    nothing and does not navigate.
 *  - caw-05 Skip on every step, including the last, opens the new agent.
 *  - caw-07 the Skills step (between Prompts and Datasets) shows the agent and
 *    available skills tabs and the last step says Finish.
 *  - caw-06 Back: absent on step 2, shown from step 3, and returns to the
 *    previous step.
 *
 * Every agent the tests create is registered for the run-level residue
 * teardown (`registerMentor`) and tracked for the suite's afterAll.
 */

import type { Page, Request } from '@playwright/test';
import { test, expect } from '../fixtures/mentor-test';
import { generateMentorName } from '../fixtures/test-data';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';
import { MentorTracker } from '../utils/mentor-cleanup';
import { waitForPageReady } from '../utils/resilient';
import { CreateMentorPage } from '../page-objects/create-mentor.page';
import type { EditMentorPage } from '../page-objects/edit-mentor/edit-mentor.page';
import type { CreateAgentWizardPage } from '../page-objects/create-agent-wizard.page';

const UI_TIMEOUT = 20_000;

test.describe.configure({ mode: 'default', timeout: 300_000 });

async function systemPromptText(
  editMentorPage: EditMentorPage,
): Promise<string> {
  const content = editMentorPage.dialog.getByRole('region', {
    name: 'System prompt content',
  });
  await expect(content).toBeVisible({ timeout: UI_TIMEOUT });
  return (await content.textContent()) ?? '';
}

test.describe('Journey 105: Create Agent wizard', () => {
  const tracker = new MentorTracker();

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    if (!(await checkAdminStatus(page))) {
      test.skip(true, 'Requires admin access');
    }
  });

  test.afterAll(async ({ browser }, testInfo) => {
    await tracker.deleteAll(browser, testInfo);
  });

  async function createThroughWizard(
    page: Page,
    wizard: CreateAgentWizardPage,
    name = generateMentorName(),
  ) {
    await wizard.open();
    const mentorId = await wizard.createAgent(name);
    tracker.add(mentorId);
    return { name, mentorId };
  }

  test('caw-01: admin creates an agent in the wizard, skips LLM, saves a prompt, skips Datasets and MCP, and Finish opens the new agent with the saved prompt', async ({
    page,
    createAgentWizardPage: wizard,
    editMentorPage,
  }) => {
    const marker = `Wizard prompt ${Date.now()}`;
    const startId = (await getPlatformContext(page)).mentorId;
    await wizard.open();
    await wizard.expectStep(1);
    await expect(wizard.nextButton).toBeDisabled();
    await wizard.nameInput.fill('x');
    await expect(
      wizard.nextButton,
      'Next stays disabled until both fields are filled',
    ).toBeDisabled();

    const name = generateMentorName();
    const mentorId = await wizard.createAgent(name);
    tracker.add(mentorId);
    expect(mentorId).not.toBe(startId);
    expect(
      (await getPlatformContext(page)).mentorId,
      'creating stays in the wizard, no redirect',
    ).toBe(startId);

    // Step 2: LLM, skipped.
    await expect(
      wizard.dialog.getByText('LLM Configuration').first(),
    ).toBeVisible({ timeout: UI_TIMEOUT });
    await expect(wizard.backButton, 'no Back before step 3').toHaveCount(0);
    await wizard.skipButton.click();

    // Step 3: Prompts, one change.
    await expect(wizard.dialog.getByTestId('prompts-info-box')).toBeVisible({
      timeout: UI_TIMEOUT,
    });
    await expect(wizard.backButton).toBeVisible();
    await wizard.prompts.systemPromptEditButton.click();
    await wizard.prompts.setSystemPrompt(marker);
    await wizard.nextButton.click();

    // Skills, Datasets and MCP, skipped; the last step says Finish.
    await wizard.skipUntilFinish();
    await wizard.finishButton.click();
    await wizard.waitForAgentUrl(mentorId);
    await waitForPageReady(page);
    expect((await getPlatformContext(page)).mentorId).toBe(mentorId);
    await expect(wizard.dialog).toBeHidden({ timeout: UI_TIMEOUT });
    await editMentorPage.open('Prompts');
    expect(await systemPromptText(editMentorPage)).toContain(marker);
  });

  test('caw-02: admin opens Discovery on a wizard-created agent and sees Admins Only with the public catalog, guest chat and featured switches off', async ({
    page,
    createAgentWizardPage: wizard,
    editMentorPage,
  }) => {
    const { mentorId } = await createThroughWizard(page, wizard);
    await wizard.closeButton.click();
    await wizard.waitForAgentUrl(mentorId);
    await waitForPageReady(page);

    await editMentorPage.open('Settings');
    const settings = editMentorPage.settings;
    await settings.selectSubTab('Discovery');
    await expect(settings.visibilityCombobox).toContainText('Admins Only', {
      timeout: UI_TIMEOUT,
    });
    for (const sw of [
      settings.publicCatalogSwitch,
      settings.guestChatSwitch,
      editMentorPage.dialog.getByRole('switch', {
        name: /Highlight In Featured Listings/i,
      }),
    ]) {
      await expect(sw).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(sw).toHaveAttribute('aria-checked', 'false');
    }
  });

  test('caw-03: admin starts the wizard from an existing agent, saves a prompt in its Prompts step, and it lands on the new agent while the page agent is unchanged', async ({
    page,
    createAgentWizardPage: wizard,
    editMentorPage,
  }) => {
    // The page agent: created by the wizard, then opened with Close.
    const { mentorId: pageAgentId } = await createThroughWizard(page, wizard);
    await wizard.closeButton.click();
    await wizard.waitForAgentUrl(pageAgentId);
    await waitForPageReady(page);

    const marker = `Wizard-only prompt ${Date.now()}`;
    await wizard.open();
    const newId = await wizard.createAgent(generateMentorName());
    tracker.add(newId);
    expect(newId).not.toBe(pageAgentId);
    expect((await getPlatformContext(page)).mentorId).toBe(pageAgentId);

    await wizard.skipButton.click();
    await expect(wizard.dialog.getByTestId('prompts-info-box')).toBeVisible({
      timeout: UI_TIMEOUT,
    });
    await wizard.prompts.systemPromptEditButton.click();
    await wizard.prompts.setSystemPrompt(marker);
    await wizard.skipUntilFinish();
    await wizard.finishButton.click();
    await wizard.waitForAgentUrl(newId);
    await waitForPageReady(page);

    await editMentorPage.open('Prompts');
    expect(await systemPromptText(editMentorPage)).toContain(marker);
    await editMentorPage.close();

    await navigateToMentorApp(
      page,
      page.url().replace(`/${newId}`, `/${pageAgentId}`),
    );
    expect((await getPlatformContext(page)).mentorId).toBe(pageAgentId);
    await editMentorPage.open('Prompts');
    expect(
      await systemPromptText(editMentorPage),
      'the page agent kept its own prompt',
    ).not.toContain(marker);
  });

  test('caw-04: admin closes the wizard after step 1 and lands on the new agent, and closes it on step 1 with nothing created and no navigation', async ({
    page,
    createAgentWizardPage: wizard,
  }) => {
    const startUrl = page.url();
    const created: Request[] = [];
    page.on('request', (r) => {
      if (CreateMentorPage.isCreateRequest(r)) created.push(r);
    });

    await wizard.open();
    await wizard.nameInput.fill(generateMentorName());
    await wizard.closeButton.click();
    await expect(wizard.dialog).toBeHidden({ timeout: UI_TIMEOUT });
    await page.waitForTimeout(1_000);
    expect(created, 'closing on step 1 creates nothing').toHaveLength(0);
    expect(page.url(), 'closing on step 1 does not navigate').toBe(startUrl);

    const { mentorId } = await createThroughWizard(page, wizard);
    expect(created).toHaveLength(1);
    await wizard.closeButton.click();
    await wizard.waitForAgentUrl(mentorId);
    await waitForPageReady(page);
    expect((await getPlatformContext(page)).mentorId).toBe(mentorId);
  });

  test('caw-05: admin clicks Skip on every wizard step, including the last, and the new agent opens', async ({
    page,
    createAgentWizardPage: wizard,
  }) => {
    const { mentorId } = await createThroughWizard(page, wizard);
    await wizard.expectStep(2);
    await wizard.skipAllSteps();
    await wizard.waitForAgentUrl(mentorId);
    await waitForPageReady(page);
    await expect(wizard.dialog).toBeHidden({ timeout: UI_TIMEOUT });
  });

  test('caw-06: admin sees no Back on step 2, Back from step 3 on, and Back returns to the previous step', async ({
    page,
    createAgentWizardPage: wizard,
  }) => {
    await createThroughWizard(page, wizard);
    const { total } = await wizard.stepPosition();
    await wizard.expectStep(2, total);
    await expect(wizard.backButton).toHaveCount(0);
    await wizard.skipButton.click();
    await wizard.expectStep(3, total);
    await expect(wizard.dialog.getByTestId('prompts-info-box')).toBeVisible({
      timeout: UI_TIMEOUT,
    });
    await wizard.backButton.click();
    await wizard.expectStep(2, total);
    await expect(
      wizard.dialog.getByText('LLM Configuration').first(),
    ).toBeVisible({ timeout: UI_TIMEOUT });
  });

  test('caw-07: admin steps through LLM and Prompts to the Skills step and sees the agent and available skills tabs, and the last step says Finish', async ({
    page,
    createAgentWizardPage: wizard,
  }) => {
    await createThroughWizard(page, wizard);
    const { total } = await wizard.stepPosition();
    expect(
      total,
      'name, LLM, Prompts, Skills, Datasets and MCP; fewer only when the admin lacks a tab',
    ).toBeGreaterThanOrEqual(5);
    await wizard.skipButton.click();
    await wizard.skipButton.click();
    await wizard.expectStep(4, total);
    if (total === 6) {
      await expect(
        wizard.dialog.getByTestId('agent-skills-tab-agent'),
      ).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(
        wizard.dialog.getByTestId('agent-skills-tab-available'),
      ).toBeVisible({ timeout: UI_TIMEOUT });
    } else {
      await expect(
        wizard.dialog.getByTestId('agent-skills-tab-agent'),
        'no Skills step for this agent',
      ).toHaveCount(0);
    }
    await wizard.skipUntilFinish();
    await expect(wizard.finishButton).toBeVisible();
  });
});
