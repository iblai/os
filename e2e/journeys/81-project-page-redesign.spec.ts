import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';

/**
 * Journey 81: Project Page Redesign (issue #2586)
 *
 * The project landing page (SDK `ProjectLandingPage`, rendered by OS's
 * `WelcomeChatNew` for the project chat route) got the same composer as the
 * main chat plus a redesigned header/context section: a small label with
 * the PROJECT name above the gradient AGENT name (the same heading as the
 * main chat), Files/Instructions cards with count
 * badges (hidden for students), a "Project agents" list with a count badge,
 * "Add agent", click-to-switch agent cards, a per-agent "…" menu with
 * "Remove from project", and a "Cannot Remove Agent" guard when only one
 * agent remains. Journey 26 already covers the Files/Instructions modal
 * entry points and basic chat send; this journey covers the NEW layout and
 * the agent-list interactions specifically.
 *
 * Uses the `testProject` fixture (`e2e/fixtures/mentor-test.ts`) — a project
 * created fresh per test with exactly ONE attached agent (see
 * `ProjectPage.createFromSidebar`, fixed in this same change to skip any
 * leftover "Test Workflow" mentor) and deleted in the fixture's teardown, so
 * "Cannot Remove Agent" is exercised against a REAL single-agent project
 * rather than a mocked one — the guard itself prevents any mutation, so
 * nothing needs to be undone.
 */
test.describe('Journey 81: Project Page Redesign', () => {
  test.beforeEach(async ({ page }) => {
    // `testProject`'s fixture setup (used only by the test body, so it runs
    // AFTER this hook) drives the sidebar's "Projects" button via
    // `ProjectPage.createFromSidebar` — that sidebar only exists once the
    // mentor app itself has been navigated to and rendered.
    await navigateToMentorApp(page);
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  // pjr-01: the redesigned header/composer/context layout renders in order —
  // project-name label, gradient AGENT name (like the main chat), composer,
  // then Files/Instructions cards (equal height, both subtitles 2-line clamp).
  test('admin sees the project-name label, agent-name heading, composer and context cards in order', async ({
    page,
    projectPage,
    chatPage,
    testProject,
  }) => {
    await projectPage.openProjectChatFromIndex(testProject.name);
    await waitForPageReady(page);

    const landing = page.getByTestId('project-landing-page');
    await expect(landing).toBeVisible({ timeout: 20_000 });
    // The small label now carries the project's name (not the word "Project").
    const projectLabel = landing.getByTestId('project-landing-project-name');
    await expect(projectLabel).toHaveText(testProject.name);
    await expect(projectLabel).toHaveAttribute('title', testProject.name);
    await expect(landing.getByText('Project', { exact: true })).toHaveCount(0);
    // The h1 is the current agent's name — the selected Project agents card —
    // and the project name stays exposed as its accessible description.
    const currentAgent = page.locator('button[aria-current="true"]').first();
    await expect(currentAgent).toBeVisible({ timeout: 15_000 });
    const agentName = (
      await currentAgent.locator('span.truncate').first().innerText()
    ).trim();
    const nameHeading = landing.getByRole('heading', { level: 1 });
    await expect(nameHeading).toHaveText(agentName);
    await expect(nameHeading).toHaveAccessibleDescription(testProject.name);

    const composer = chatPage.getComposerTextarea();
    await expect(composer).toBeVisible();

    const filesCard = page.getByTestId('project-files-card');
    await expect(filesCard).toBeVisible({ timeout: 15_000 });
    const instructionsCard = page.getByTestId('project-instructions-card');
    await expect(instructionsCard).toBeVisible();

    // Order: label above name above composer, composer above the cards.
    const labelBox = await projectLabel.boundingBox();
    const nameBox = await nameHeading.boundingBox();
    const composerBox = await composer.boundingBox();
    const filesBox = await filesCard.boundingBox();
    expect(labelBox!.y).toBeLessThan(nameBox!.y);
    expect(nameBox!.y).toBeLessThan(composerBox!.y);
    expect(composerBox!.y).toBeLessThan(filesBox!.y);

    // Both card subtitles wrap to two lines (then ellipsize) the same way,
    // and the two cards share a row at the same height.
    const clampOf = (testId: string) =>
      page
        .getByTestId(testId)
        .evaluate((el) => getComputedStyle(el).webkitLineClamp);
    expect(await clampOf('project-files-card-subtitle')).toBe('2');
    expect(await clampOf('project-instructions-card-subtitle')).toBe('2');
    const instructionsBox = await instructionsCard.boundingBox();
    expect(
      Math.abs(filesBox!.height - instructionsBox!.height),
    ).toBeLessThanOrEqual(1);
    expect(Math.abs(filesBox!.y - instructionsBox!.y)).toBeLessThanOrEqual(1);
  });

  // pjr-02: "Project agents" shows a count badge, "Add agent", and the
  // current agent selected with a checkmark.
  test('admin sees the "Project agents" section with a count badge and Add agent', async ({
    page,
    projectPage,
    testProject,
  }) => {
    await projectPage.openProjectChatFromIndex(testProject.name);
    await waitForPageReady(page);

    const agentsHeading = page.getByRole('heading', {
      name: 'Project agents',
      exact: true,
    });
    await expect(agentsHeading).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('project-agents-count')).toHaveText('1');
    await expect(
      page.getByRole('button', { name: 'Add agent', exact: true }),
    ).toBeVisible();
    // The single attached agent renders as a selected card (aria-current).
    await expect(page.locator('button[aria-current="true"]')).toHaveCount(1);
  });

  // pjr-03: removing the LAST agent from a project is blocked by the
  // "Cannot Remove Agent" guard — no mutation happens.
  test('admin cannot remove the last agent from a project', async ({
    page,
    projectPage,
    testProject,
  }) => {
    await projectPage.openProjectChatFromIndex(testProject.name);
    await waitForPageReady(page);

    const agentCard = page.locator('button[aria-current="true"]').first();
    await expect(agentCard).toBeVisible({ timeout: 15_000 });
    // Only one agent is attached, so there is exactly one "…" trigger
    // ("More actions for {name}") on the whole page.
    const moreButton = page.getByRole('button', {
      name: /^More actions for /i,
    });
    await expect(moreButton).toBeVisible({ timeout: 10_000 });
    await moreButton.click();
    await page
      .getByRole('menuitem', { name: 'Remove from project', exact: true })
      .click();

    await expect(
      page.getByRole('heading', { name: 'Cannot Remove Agent', exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(
        'A project must have at least one agent. Please add another agent before removing this one.',
      ),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();

    // The agent is still there — the guard genuinely blocked the removal.
    await expect(page.getByTestId('project-agents-count')).toHaveText('1');
  });

  // pjr-04 (mobile, 390px): the label/heading order holds, the composer is
  // pinned to the viewport bottom (`project-landing-page.tsx`'s phone
  // branch: a scrollable header+context area, then a `shrink-0` composer),
  // and the Files/Instructions cards stack as one bordered list (`layout=
  // "rows"`) with the SAME 2-line subtitle clamp as desktop's 2-up grid.
  test('mobile (390px): label/heading order holds, the composer is pinned to the bottom, and the Files/Instructions cards stack with a 2-line clamp', async ({
    page,
    projectPage,
    chatPage,
    testProject,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await projectPage.openProjectChatFromIndex(testProject.name);
    await waitForPageReady(page);

    const landing = page.getByTestId('project-landing-page');
    await expect(landing).toBeVisible({ timeout: 20_000 });
    const projectLabel = landing.getByTestId('project-landing-project-name');
    const nameHeading = landing.getByRole('heading', { level: 1 });
    await expect(projectLabel).toBeVisible();
    await expect(nameHeading).toBeVisible();

    const labelBox = await projectLabel.boundingBox();
    const nameBox = await nameHeading.boundingBox();
    expect(labelBox).not.toBeNull();
    expect(nameBox).not.toBeNull();
    expect(labelBox!.y).toBeLessThan(nameBox!.y);

    // The composer is pinned to the bottom of the viewport, not flowing
    // below the context cards.
    const composer = chatPage.getComposerTextarea();
    await expect(composer).toBeVisible();
    const composerBox = await composer.boundingBox();
    expect(composerBox).not.toBeNull();
    expect(composerBox!.y + composerBox!.height).toBeGreaterThan(844 - 120);

    // Files/Instructions: one bordered stack (rows), not a 2-up grid — the
    // Instructions card sits directly BELOW the Files card at the same left
    // edge, full width.
    const filesCard = page.getByTestId('project-files-card');
    const instructionsCard = page.getByTestId('project-instructions-card');
    await expect(filesCard).toBeVisible({ timeout: 15_000 });
    await expect(instructionsCard).toBeVisible();
    const filesBox = await filesCard.boundingBox();
    const instructionsBox = await instructionsCard.boundingBox();
    expect(filesBox).not.toBeNull();
    expect(instructionsBox).not.toBeNull();
    expect(Math.abs(filesBox!.x - instructionsBox!.x)).toBeLessThanOrEqual(1);
    expect(
      Math.abs(filesBox!.width - instructionsBox!.width),
    ).toBeLessThanOrEqual(1);
    expect(instructionsBox!.y).toBeGreaterThan(filesBox!.y);

    // Same 2-line clamp as desktop's pjr-01 (shared `subtitleClass`).
    const clampOf = (testId: string) =>
      page
        .getByTestId(testId)
        .evaluate((el) => getComputedStyle(el).webkitLineClamp);
    expect(await clampOf('project-files-card-subtitle')).toBe('2');
    expect(await clampOf('project-instructions-card-subtitle')).toBe('2');

    await page.setViewportSize({ width: 1280, height: 800 });
  });

  // pjr-05 (mobile, 390px): the per-agent "…" trigger opens a bottom sheet
  // (`project-agent-actions-sheet`, `ComposerSheet`) instead of the desktop
  // dropdown — it shows the agent's name and a "Remove from project" row,
  // which (same guard as pjr-03) is blocked by "Cannot Remove Agent" since
  // this project has only one agent.
  test('mobile (390px): the agent "…" trigger opens an actions sheet, and removing the last agent is still blocked', async ({
    page,
    projectPage,
    testProject,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await projectPage.openProjectChatFromIndex(testProject.name);
    await waitForPageReady(page);

    const moreButton = page.getByRole('button', {
      name: /^More actions for /i,
    });
    await expect(moreButton).toBeVisible({ timeout: 15_000 });
    await moreButton.click();

    const sheet = page.getByTestId('project-agent-actions-sheet');
    await expect(sheet).toBeVisible({ timeout: 10_000 });
    const removeRow = sheet.getByRole('button', {
      name: 'Remove from project',
      exact: true,
    });
    await expect(removeRow).toBeVisible();
    await removeRow.click();

    await expect(
      page.getByRole('heading', { name: 'Cannot Remove Agent', exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByTestId('project-agents-count')).toHaveText('1');

    await page.setViewportSize({ width: 1280, height: 800 });
  });
});
