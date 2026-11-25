import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/mentor-test';
import { MENTOR_NEXTJS_HOST, generateMentorName } from '../fixtures/test-data';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { MentorTracker } from '../utils/mentor-cleanup';
import {
  CAPABILITY_SLUGS,
  readCapabilityFlag,
} from '../page-objects/edit-mentor/capabilities.section';

/**
 * Journey 107: Agent Capabilities (iblai-platform#2838)
 *
 * The Tools tab is gone; what an agent can do is a set of switches that each
 * save one `capability_*` flag on the agent's settings the moment they are
 * clicked:
 *   - Settings > Capabilities > "Agent Capabilities": Web Search, Image
 *     Generation, Video Generation, Code Interpreter, Plan
 *   - Datasets tab: Enhanced Document Retrieval, under the info box
 *   - Grader tab: the Grading switch and a Lesson Completion row
 *   - Support tab: the Human Support switch
 *   - Screen tab: the Screen Sharing switch
 *
 * Everything is real (no mocks). The whole file runs serially on one agent
 * created by the first test, never a shared one. Needs the @iblai/iblai-js
 * release that ships these switches.
 *
 * Checkpoints: agc-01 Tools tab is gone, agc-02 one flat list of five switches,
 * agc-03 Web Search saves and survives reload, agc-04 Plan saves,
 * agc-05 Grading and Lesson Completion save, agc-06 Support switch saves,
 * agc-07 Screen switch saves, agc-08 an old link to the Tools tab opens
 * Settings, agc-09 info button tooltip and switch name, agc-10 MCP tab
 * header switch, agc-11 Enhanced Document Retrieval in the Datasets tab.
 */

const SETTINGS_PUT =
  (field: string) => (req: import('@playwright/test').Request) =>
    ['PUT', 'PATCH'].includes(req.method()) &&
    readCapabilityFlag(req.postData() ?? '', field) !== undefined;

async function skipIfNotAdmin(page: Page): Promise<void> {
  if (!(await checkAdminStatus(page))) test.skip(true, 'Requires admin access');
}

test.describe.serial('Journey 107: Agent Capabilities', () => {
  test.setTimeout(240_000);

  const tracker = new MentorTracker();
  let mentorUrl = '';

  test.afterAll(async ({ browser }, testInfo) => {
    await tracker.deleteAll(browser, testInfo);
  });

  async function openAgent(page: Page): Promise<void> {
    test.skip(!mentorUrl, 'agc-01 setup did not run');
    await navigateToMentorApp(page, mentorUrl);
    await skipIfNotAdmin(page);
  }

  test('agc-01: a new agent has no Tools tab, in any category', async ({
    page,
    editMentorPage,
    createMentorPage,
  }) => {
    await navigateToMentorApp(page);
    await skipIfNotAdmin(page);

    await createMentorPage.openAndCreate(generateMentorName());
    await waitForPageReady(page);
    const { tenantKey, mentorId } = await getPlatformContext(page);
    tracker.add(mentorId);
    mentorUrl = `${MENTOR_NEXTJS_HOST}/platform/${tenantKey}/${mentorId}`;

    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    const toolsTab = editMentorPage.dialog.getByRole('tab', {
      name: 'Tools',
      exact: true,
    });
    await expect(toolsTab).toHaveCount(0);

    await editMentorPage.navigateToTab('MCP');
    await expect(
      editMentorPage.dialog.getByRole('tab', { name: 'MCP', exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(toolsTab).toHaveCount(0);
    await editMentorPage.close();
  });

  test('agc-02: Settings > Capabilities shows Agent Capabilities as one list of five switches, and no Enhanced Document Retrieval', async ({
    page,
    editMentorPage,
  }) => {
    await openAgent(page);
    const capabilities = editMentorPage.capabilities;
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await capabilities.open();

    await expect(capabilities.banner).toContainText('Agent Capabilities');
    await expect(capabilities.section.getByRole('heading')).toHaveCount(1);
    for (const slug of CAPABILITY_SLUGS) {
      await expect(capabilities.toggle(slug)).toHaveAttribute('role', 'switch');
    }
    const order = await capabilities.section
      .locator('[data-testid^="capability-toggle-"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
    expect(order).toEqual([
      'capability-toggle-web-search',
      'capability-toggle-image-generation',
      'capability-toggle-video-generation',
      'capability-toggle-code-interpreter',
      'capability-toggle-subagents',
    ]);
    await expect(
      capabilities.dialog.getByTestId(
        'capability-toggle-advanced-document-search',
      ),
    ).toHaveCount(0);
    await editMentorPage.close();
  });

  test('agc-03: admin turns Web Search on and off, each saved on the click, and the state survives a reload', async ({
    page,
    editMentorPage,
  }) => {
    await openAgent(page);
    const capabilities = editMentorPage.capabilities;
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await capabilities.open();

    test.skip(
      !(await capabilities.toggle('web-search').isEnabled()),
      "The agent's model cannot use Web Search",
    );
    await capabilities.setEnabled('web-search', false);

    const on = await capabilities.setEnabled('web-search', true);
    expect(on?.ok).toBe(true);
    expect(readCapabilityFlag(on?.body ?? '', 'capability_web_search')).toBe(
      true,
    );

    await editMentorPage.close();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForPageReady(page);
    await editMentorPage.open('Settings');
    await capabilities.open();
    expect(await capabilities.isEnabled('web-search')).toBe(true);

    const off = await capabilities.setEnabled('web-search', false);
    expect(off?.ok).toBe(true);
    expect(readCapabilityFlag(off?.body ?? '', 'capability_web_search')).toBe(
      false,
    );

    await editMentorPage.close();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForPageReady(page);
    await editMentorPage.open('Settings');
    await capabilities.open();
    expect(await capabilities.isEnabled('web-search')).toBe(false);
    await editMentorPage.close();
  });

  test('agc-04: admin turns Plan on and off from the same block', async ({
    page,
    editMentorPage,
  }) => {
    await openAgent(page);
    const capabilities = editMentorPage.capabilities;
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await capabilities.open();

    // Whether a new agent starts with Plan on is the platform's choice, so
    // the round trip starts from whatever it is and ends there.
    const wasOn = await capabilities.isEnabled('subagents');
    const flipped = await capabilities.setEnabled('subagents', !wasOn);
    expect(flipped?.ok).toBe(true);
    expect(
      readCapabilityFlag(flipped?.body ?? '', 'capability_subagents'),
    ).toBe(!wasOn);
    const restored = await capabilities.setEnabled('subagents', wasOn);
    expect(restored?.ok).toBe(true);
    expect(
      readCapabilityFlag(restored?.body ?? '', 'capability_subagents'),
    ).toBe(wasOn);
    await editMentorPage.close();
  });

  test('agc-05: the Grader tab saves its Grading switch and its Lesson Completion row', async ({
    page,
    editMentorPage,
  }) => {
    await openAgent(page);
    const grader = editMentorPage.grader;
    const gradingToggle = grader.body().getByTestId('grader-capability-toggle');
    await editMentorPage.open('Grader');
    await grader.waitUntilLoaded();

    await expect(grader.lessonCompletionToggle).toBeVisible({
      timeout: 10_000,
    });
    test.skip(
      await grader.lessonCompletionToggle.isDisabled(),
      "The agent's model cannot use Lesson Completion",
    );

    await grader.setGradingEnabled(false);
    await grader.setLessonCompletionEnabled(false);
    const lessonOn = await grader.setLessonCompletionEnabled(true);
    expect(
      readCapabilityFlag(lessonOn ?? '', 'capability_lesson_completion'),
    ).toBe(true);
    await expect(grader.capabilityContent).toHaveAttribute(
      'data-enabled',
      'false',
    );

    // Grading stays locked until the rubric has a criterion.
    await grader.prepareRubric();
    const gradingPut = page.waitForRequest(SETTINGS_PUT('capability_grading'), {
      timeout: 30_000,
    });
    gradingPut.catch(() => {});
    const gradingOn = await grader.tryEnableGrading();
    test.skip(!gradingOn, "The agent's model cannot use Grading");
    expect(
      readCapabilityFlag(
        (await gradingPut).postData() ?? '',
        'capability_grading',
      ),
    ).toBe(true);

    await editMentorPage.close();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForPageReady(page);
    await editMentorPage.open('Grader');
    await grader.waitUntilLoaded();
    await expect(gradingToggle).toHaveAttribute('aria-checked', 'true', {
      timeout: 15_000,
    });
    await expect(grader.lessonCompletionToggle).toHaveAttribute(
      'aria-checked',
      'true',
      { timeout: 15_000 },
    );

    await grader.setGradingEnabled(false);
    const lessonOff = await grader.setLessonCompletionEnabled(false);
    expect(
      readCapabilityFlag(lessonOff ?? '', 'capability_lesson_completion'),
    ).toBe(false);
    await editMentorPage.close();
  });

  test('agc-06: the Support tab switch saves capability_human_support', async ({
    page,
    editMentorPage,
  }) => {
    await openAgent(page);
    const support = editMentorPage.humanSupport;
    await editMentorPage.open('Support');
    await waitForPageReady(page);
    test.skip(
      !(await support.hasToggle()) || (await support.isLocked()),
      'Human Support is not available for this agent',
    );

    await support.setEnabled(false);
    const [request] = await Promise.all([
      page.waitForRequest(SETTINGS_PUT('capability_human_support'), {
        timeout: 30_000,
      }),
      support.setEnabled(true),
    ]);
    expect(
      readCapabilityFlag(request.postData() ?? '', 'capability_human_support'),
    ).toBe(true);

    await editMentorPage.close();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForPageReady(page);
    await editMentorPage.open('Support');
    await waitForPageReady(page);
    expect(await support.isEnabled()).toBe(true);
    await support.setEnabled(false);
    await editMentorPage.close();
  });

  test('agc-07: the Screen tab switch saves capability_screen_share', async ({
    page,
    editMentorPage,
  }) => {
    await openAgent(page);
    const screen = editMentorPage.screenshare;
    await editMentorPage.open('Screen');
    await waitForPageReady(page);
    await expect(screen.capabilityToggle).toBeVisible({ timeout: 15_000 });

    await screen.setCapabilityEnabled(false);
    const [request] = await Promise.all([
      page.waitForRequest(SETTINGS_PUT('capability_screen_share'), {
        timeout: 30_000,
      }),
      screen.setCapabilityEnabled(true),
    ]);
    expect(
      readCapabilityFlag(request.postData() ?? '', 'capability_screen_share'),
    ).toBe(true);

    await editMentorPage.close();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForPageReady(page);
    await editMentorPage.open('Screen');
    await waitForPageReady(page);
    expect(await screen.isCapabilityEnabled()).toBe(true);
    await screen.setCapabilityEnabled(false);
    await editMentorPage.close();
  });

  test('agc-08: an old link to the Tools tab opens Edit Agent on the Settings tab', async ({
    page,
    editMentorPage,
  }) => {
    test.skip(!mentorUrl, 'agc-01 setup did not run');
    const modal = encodeURIComponent(
      JSON.stringify([{ name: 'edit_mentor', tab: 'tools' }]),
    );
    // The editor opens on load and hides the page behind it, so the default
    // readiness check (the agent dropdown button by role) would never pass.
    await navigateToMentorApp(
      page,
      `${mentorUrl}?modal=${modal}`,
      editMentorPage.dialog,
    );
    await skipIfNotAdmin(page);
    await editMentorPage.waitForHydrated();

    const { dialog } = editMentorPage;
    await expect(
      dialog
        .getByRole('tab', { name: 'Settings', exact: true })
        .and(dialog.locator('[aria-controls="panel-settings"]:visible')),
    ).toHaveAttribute('data-state', 'active', { timeout: 15_000 });
    await expect(dialog.locator('#panel-settings')).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      dialog.getByRole('tab', { name: 'Tools', exact: true }),
    ).toHaveCount(0);
    await editMentorPage.close();
  });

  test('agc-09: a capability row has a labelled info button whose tooltip shows on hover and on focus, and its switch is named after the capability', async ({
    page,
    editMentorPage,
  }) => {
    await openAgent(page);
    const capabilities = editMentorPage.capabilities;
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await capabilities.open();

    await expect(capabilities.toggle('web-search')).toHaveAccessibleName(
      'Web Search',
    );

    await expect(capabilities.infoButton('web-search')).toBeVisible({
      timeout: 10_000,
    });
    await capabilities.infoButton('web-search').hover();
    const hoverTooltip = await capabilities.tooltipFor('web-search');
    await expect(hoverTooltip).toBeVisible({ timeout: 5_000 });
    await expect(hoverTooltip).toHaveText(/\S/);

    // Focus goes to another row: the hover-opened tooltip can stay open, so
    // the same button would not show that focus opens one by itself.
    await capabilities.infoButton('subagents').focus();
    const focusTooltip = await capabilities.tooltipFor('subagents');
    await expect(focusTooltip).toBeVisible({ timeout: 5_000 });
    await expect(focusTooltip).toHaveText(/\S/);
    await editMentorPage.close();
  });

  test('agc-10: the MCP tab switch is off on a new agent with the list greyed, saves tool_slugs with mcp when turned on, and without it when turned off', async ({
    page,
    editMentorPage,
  }) => {
    await openAgent(page);
    const mcp = editMentorPage.mcp;
    await editMentorPage.open('MCP');
    await waitForPageReady(page);
    await expect(mcp.mcpToggle).toBeVisible({ timeout: 15_000 });
    await expect(mcp.mcpToggle).toBeEnabled({ timeout: 30_000 });
    await expect(mcp.mcpToggle).toHaveAccessibleName('MCP');
    await expect(mcp.mcpToggle).toHaveAttribute('aria-checked', 'false');
    await expect(mcp.mcpContent).toHaveAttribute('data-enabled', 'false');

    const readToolSlugs = (req: import('@playwright/test').Request) => {
      const body = req.postData() ?? '';
      try {
        const parsed = JSON.parse(body) as { tool_slugs?: string[] };
        if (Array.isArray(parsed.tool_slugs)) return parsed.tool_slugs;
      } catch {
        // Turning MCP on saves as multipart, one `tool_slugs` part per tool;
        // only turning it off is JSON.
      }
      const parts = [
        ...body.matchAll(/name="tool_slugs"\r?\n\r?\n([^\r\n]*)/g),
      ].map((match) => match[1]);
      return parts.length > 0 ? parts : undefined;
    };
    const toolSlugsPut = (req: import('@playwright/test').Request) =>
      ['PUT', 'PATCH'].includes(req.method()) &&
      readToolSlugs(req) !== undefined;

    const onRequest = page.waitForRequest(toolSlugsPut, { timeout: 30_000 });
    onRequest.catch(() => {});
    await mcp.mcpToggle.click();
    const refused = await mcp.mcpError
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(refused, "The agent's model cannot use MCP");
    expect(readToolSlugs(await onRequest)).toContain('mcp');
    await mcp.expectToast('MCP turned on');
    await expect(mcp.mcpToggle).toHaveAttribute('aria-checked', 'true');
    await expect(mcp.mcpContent).toHaveAttribute('data-enabled', 'true');
    await expect(mcp.addConnectorButton).toBeEnabled();

    const offRequest = page.waitForRequest(toolSlugsPut, { timeout: 30_000 });
    offRequest.catch(() => {});
    await mcp.mcpToggle.click();
    expect(readToolSlugs(await offRequest)).not.toContain('mcp');
    await mcp.expectToast('MCP turned off');
    await expect(mcp.mcpToggle).toHaveAttribute('aria-checked', 'false');
    await expect(mcp.mcpContent).toHaveAttribute('data-enabled', 'false');
    await editMentorPage.close();
  });

  test('agc-11: the Datasets tab shows Enhanced Document Retrieval under the info box and saves capability_advanced_document_search and enable_multi_query_rag together, on and off', async ({
    page,
    editMentorPage,
  }) => {
    await openAgent(page);
    const datasets = editMentorPage.datasets;
    await editMentorPage.open('Datasets');
    await waitForPageReady(page);

    await expect(datasets.enhancedDocumentRetrievalCard).toBeVisible({
      timeout: 15_000,
    });
    await expect(datasets.enhancedDocumentRetrievalToggle).toHaveAccessibleName(
      'Enhanced Document Retrieval',
    );
    const infoBottom = (await datasets.infoBox.boundingBox())!;
    const cardBox =
      (await datasets.enhancedDocumentRetrievalCard.boundingBox())!;
    const searchBox = (await datasets.searchInput.boundingBox())!;
    expect(cardBox.y).toBeGreaterThanOrEqual(infoBottom.y + infoBottom.height);
    expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(searchBox.y);

    test.skip(
      await datasets.enhancedDocumentRetrievalToggle.isDisabled(),
      "The agent's model cannot use Enhanced Document Retrieval",
    );
    await datasets.setEnhancedDocumentRetrieval(false);

    const on = await datasets.setEnhancedDocumentRetrieval(true);
    expect(
      readCapabilityFlag(on ?? '', 'capability_advanced_document_search'),
    ).toBe(true);
    expect(readCapabilityFlag(on ?? '', 'enable_multi_query_rag')).toBe(true);
    const off = await datasets.setEnhancedDocumentRetrieval(false);
    expect(
      readCapabilityFlag(off ?? '', 'capability_advanced_document_search'),
    ).toBe(false);
    expect(readCapabilityFlag(off ?? '', 'enable_multi_query_rag')).toBe(false);
    await editMentorPage.close();
  });
});
