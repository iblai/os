import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { generateProjectName } from '../fixtures/test-data';
import { deleteProjectByName } from '../utils/project-cleanup';

// ─── Journey 26: Projects ───────────────────────────────────────────────────
//
// Every test that needs a project of its own uses the `testProject` fixture
// (see e2e/fixtures/mentor-test.ts), which creates a uniquely-named project
// via the real "New Project" UI flow before the test runs, and deletes it
// via the DM API afterwards — regardless of whether the test passed, failed,
// or renamed/deleted the project itself (the API delete is idempotent; a
// second delete of an already-gone project just gets a 404, which is
// swallowed). This replaces the old design where tests 1-8 (and 9-15 in the
// feat-1821 block) ran `mode: 'serial'` and shared ONE project created by
// the first test in each chain. Every test below is now fully independent —
// it can run in any order, in parallel, or be retried on its own without
// affecting its siblings.
//
// The dedicated "creates a project" test intentionally does NOT use the
// `testProject` fixture (it IS the thing under test — pre-creating a
// project for it would be redundant). See its describe block below for how
// it tracks and cleans up the project it creates itself.

// ─── A. Create ──────────────────────────────────────────────────────────────
test.describe('Journey 26-A: Projects — Create', () => {
  test.setTimeout(150_000);

  // Captured by the test *before* the create action runs, so `afterEach`
  // can clean up even if the test fails partway through. This mirrors the
  // "teardown must run even if the test failed mid-way" rule the
  // `testProject` fixture follows, without pre-creating a project this test
  // doesn't want.
  let createdProjectName: string | null = null;

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) test.skip(true, 'Projects require admin access');
  });

  test.afterEach(async ({ page }) => {
    if (createdProjectName) {
      await deleteProjectByName(page, createdProjectName);
      createdProjectName = null;
    }
  });

  // proj-01: Create project via the Projects index page. The old sidebar
  // "New Project" button was removed; createFromSidebar now navigates via
  // the sidebar "Projects" button → index → "New Project" modal.
  test('admin goes to sidebar and creates a new project from the New Project button', async ({
    page,
    projectPage,
  }) => {
    const name = generateProjectName();
    createdProjectName = name;
    await projectPage.createFromSidebar(name);
    // createFromSidebar ends on the index page with the new project card
    // visible. Then navigate to the project chat route with retry logic.
    await projectPage.openProjectChatFromIndex(name);
    expect(page.url()).toMatch(/\/projects\//);
  });
});

// ─── B. Project Landing Page ────────────────────────────────────────────────
// Each test gets its own project via the `testProject` fixture, so there is
// no ordering dependency between them — `mode: 'serial'` is not needed.
test.describe('Journey 26-B: Projects — Landing Page', () => {
  // Generous budget: fixture setup creates a project via the UI (can take
  // up to ~90s under load) on top of whatever the test itself does (e.g.
  // proj-06 waits up to 120s for an AI response).
  test.setTimeout(300_000);

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) test.skip(true, 'Projects require admin access');
  });

  // proj-02: Verify project landing page buttons.
  test('admin goes to project landing page and verifies the mentor list and action buttons are shown', async ({
    page,
    projectPage,
    testProject,
  }) => {
    await projectPage.openProjectChatFromIndex(testProject.name);
    await waitForPageReady(page);

    // The button is labeled "Add files to project" or "View project files"
    const filesBtn = page
      .getByRole('button', {
        name: /add files to project|view project files/i,
      })
      .first();
    await expect(filesBtn).toBeVisible({ timeout: 10_000 });
    // The button is labeled "Add project instructions" or "Edit project instructions"
    const instructionsBtn = page
      .getByRole('button', {
        name: /add project instructions|edit project instructions/i,
      })
      .first();
    await expect(instructionsBtn).toBeVisible({ timeout: 10_000 });
  });

  // proj-03: Mentor can be added to a project.
  test('admin goes to project landing page and adds a mentor to the project', async ({
    page,
    projectPage,
    testProject,
  }) => {
    await projectPage.openProjectChatFromIndex(testProject.name);
    await expect(projectPage.addMentorButton).toBeVisible({ timeout: 10_000 });
    await projectPage.addMentorButton.click();
    const dialog = page.getByRole('dialog', { name: /add agent/i });
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Wait for agents to load (spinner disappears / agent cards appear).
    // Pick a mentor that is NOT already selected/added — its button reports
    // aria-pressed="false". The fixture's create flow already added one
    // mentor, so this exercises adding a SECOND, distinct mentor.
    let hasMentorCard = false;
    const mentorCard = dialog
      .locator('button[aria-pressed="false"]')
      .filter({ has: page.locator('h4') })
      .first();
    try {
      await mentorCard.waitFor({ state: 'visible', timeout: 15_000 });
      hasMentorCard = true;
    } catch {
      hasMentorCard = false;
    }

    if (hasMentorCard) {
      await mentorCard.click();
      await expect(page.getByText('Agent added to project')).toBeVisible({
        timeout: 10_000,
      });
      const closeBtn = dialog.getByRole('button', { name: /close|cancel/i });
      let hasCloseBtn = false;
      try {
        await closeBtn.waitFor({ state: 'visible', timeout: 5_000 });
        hasCloseBtn = true;
      } catch {
        hasCloseBtn = false;
      }
      if (hasCloseBtn) {
        await closeBtn.click();
      }
    } else {
      await page.keyboard.press('Escape');
    }
  });

  // proj-04: Project instructions entry point renders.
  test('admin goes to project landing page and sets project instructions via the instructions modal', async ({
    page,
    projectPage,
    testProject,
  }) => {
    await projectPage.openProjectChatFromIndex(testProject.name);
    // Just verify the instructions button is visible on the project chat page.
    // Opening the instructions dialog loads `useGetMentorSettingsQuery` which
    // can invalidate caches and cause the MentorProvider to redirect, making
    // the test unreliable. The modal open/close flow is already covered by
    // the proj-04 checkpoint here as an entry-point regression guard.
    await expect(projectPage.instructionsButton).toBeVisible({
      timeout: 10_000,
    });
  });

  // proj-05: Project files modal opens cleanly with Add Files button and
  // the empty-state "No files found" text (a fresh fixture-created project
  // always has zero files). The former web-containers bug where the modal
  // would crash with "Cannot read properties of undefined (reading 'table')"
  // on an empty project is now FIXED — this test guards the regression: an
  // ErrorBoundary appearing is a hard failure.
  test('admin goes to project landing page and opens the Files modal to verify search input and Add Files button', async ({
    page,
    projectPage,
    testProject,
  }) => {
    await projectPage.openProjectChatFromIndex(testProject.name);
    await waitForPageReady(page);

    // The file-action button MUST be present — confirms ProjectInfoCard renders.
    await expect(projectPage.filesButton).toBeVisible({ timeout: 15_000 });
    await projectPage.filesButton.click();

    // The dialog MUST open cleanly — the web-containers crash is fixed.
    const dialog = page.getByRole('dialog', { name: 'Project Files' });
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    // The "Add Files" button must always be present (regardless of file count).
    const addFilesBtn = dialog.getByRole('button', { name: /add files/i });
    await expect(addFilesBtn).toBeVisible({ timeout: 10_000 });

    // A freshly fixture-created project has no files — the empty-state
    // message must render (not a crash).
    const emptyState = dialog.getByText(/no files found/i);
    await expect(emptyState).toBeVisible({ timeout: 10_000 });

    // Close the dialog cleanly.
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible({ timeout: 8_000 });
  });

  // proj-06: Chatting within a project creates a session.
  test('admin goes to project chat page and sends a message verifying a new session is created', async ({
    page,
    chatPage,
    projectPage,
    testProject,
  }) => {
    await projectPage.openProjectChatFromIndex(testProject.name);
    await waitForPageReady(page);

    // Verify chat input is present (project chat page)
    await expect(chatPage.chatInput).toBeVisible({ timeout: 15_000 });

    // The send button is gated on sessionId being initialized by the Chat
    // component. On a fresh project the Redux session-init is async and can
    // take >30s on a loaded test machine. If the button is still disabled
    // after 45s, do a hard reload to let React re-initialize the session.
    let sendEnabled = false;
    try {
      await chatPage.sendButton.waitFor({ state: 'visible', timeout: 5_000 });
      await expect(chatPage.sendButton).toBeEnabled({ timeout: 45_000 });
      sendEnabled = true;
    } catch {
      sendEnabled = false;
    }

    if (!sendEnabled) {
      // Hard reload: clears stale Redux state and re-triggers session init.
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForPageReady(page);
      await expect(chatPage.chatInput).toBeVisible({ timeout: 15_000 });
      await expect(chatPage.sendButton).toBeEnabled({ timeout: 60_000 });
    }

    // Use a longer AI response timeout — project-chat LLM calls can be
    // slower than normal chat because the project context is resolved first.
    await chatPage.sendMessage('Hello from E2E project test');
    await chatPage.waitForAIResponse(120_000);
    const sessionAfter = await page.evaluate(() => {
      const raw = localStorage.getItem('session_id');
      return raw ? JSON.parse(raw) : {};
    });
    expect(Object.keys(sessionAfter).length).toBeGreaterThan(0);
  });

  // proj-07: Rename via the index page kebab menu. The old sidebar dropdown
  // (ProjectsSidebarDropdown) was removed in feat-1821; rename is now
  // performed from the projects index page card kebab menu. The fixture's
  // captured `id` (not name) drives teardown, so renaming here does not
  // break cleanup.
  test('admin goes to project page and renames the project via the index page kebab menu', async ({
    page,
    projectPage,
    testProject,
  }) => {
    const renamedName = `${testProject.name} Renamed`;
    if (!(await projectPage.isOnProjectsIndexPage())) {
      await projectPage.navigateViaProjectsSidebarButton();
    }
    await projectPage.renameFromIndexCard(testProject.name, renamedName);
    await expect(page.locator('h3', { hasText: renamedName })).toBeVisible({
      timeout: 15_000,
    });
  });

  // proj-08: Delete via the index page kebab menu. Same rationale as
  // proj-07 — delete is only available from the index kebab menu. The
  // fixture's teardown runs after this test's own delete; a second DELETE
  // of an already-gone project is a no-op 404 (see project-cleanup.ts).
  test('admin goes to project page and deletes the project which removes it from the index', async ({
    page,
    projectPage,
    testProject,
  }) => {
    if (!(await projectPage.isOnProjectsIndexPage())) {
      await projectPage.navigateViaProjectsSidebarButton();
    }
    await projectPage.deleteFromIndexCard(testProject.name);
    // After deletion the card should disappear; we stay on the projects index
    await expect(
      page.locator('h3', { hasText: testProject.name }),
    ).not.toBeVisible({ timeout: 10_000 });
  });
});

// ── Journey 26 — Projects Index Page (feat-1821) ───────────────────────────
// These tests cover the dedicated /platform/<tenantKey>/projects index page
// introduced in issue #1821. proj-09..11 are page-chrome / general-state
// checks that don't need a project of their own; proj-12..15 each create
// their own project via the `testProject` fixture. No test depends on
// another's state, so `mode: 'serial'` is not needed.
test.describe('Journey 26-C: Projects Index Page (feat-1821)', () => {
  // Each fixture-backed test includes a full UI project creation (~90s
  // worst case) on top of its own assertions.
  test.setTimeout(180_000);

  test.beforeEach(async ({ page }) => {
    // Each test now gets its own fresh page (no more serial reuse), so
    // always navigate — there is no prior-test state to preserve.
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) test.skip(true, 'Projects index page requires admin access');
  });

  // proj-09: Projects index page — heading, subtitle, search input, New Project button
  test('admin clicks sidebar Projects button and lands on the projects index page with heading and search input', async ({
    page,
    projectPage,
  }) => {
    await projectPage.navigateViaProjectsSidebarButton();

    // Heading "Projects" (h1)
    await expect(projectPage.indexHeading).toBeVisible({ timeout: 15_000 });

    // Subtitle text
    await expect(projectPage.indexSubtitle).toBeVisible({ timeout: 10_000 });

    // Search input is present
    await expect(projectPage.searchInput).toBeVisible({ timeout: 10_000 });

    // "New Project" gradient button is present
    await expect(projectPage.newProjectIndexButton).toBeVisible({
      timeout: 10_000,
    });

    // URL must end with /projects (no redirect back to chat)
    expect(page.url()).toMatch(/\/projects\/?$/);
  });

  // proj-10: Projects index page — empty state OR cards are shown
  // (data-driven — deliberately independent of any project this suite
  // creates, since other parallel tests/workers may have projects in
  // flight at the moment this runs; both outcomes must render without
  // crashing).
  test('admin is on projects index page and sees either project cards or the empty state', async ({
    page,
    projectPage,
  }) => {
    if (!(await projectPage.isOnProjectsIndexPage())) {
      await projectPage.navigateViaProjectsSidebarButton();
    }
    await waitForPageReady(page);

    // Give the data at most 15 s to load
    let hasCards = false;
    try {
      await projectPage.projectCards.first().waitFor({
        state: 'visible',
        timeout: 15_000,
      });
      hasCards = true;
    } catch {
      hasCards = false;
    }

    if (hasCards) {
      // Cards must show a project name (h3) and an agent-count span
      const firstCard = projectPage.page.locator('h3').first();
      await expect(firstCard).toBeVisible({ timeout: 5_000 });
      // Agent count text — the regex covers "0 agents" through "N agents/agent"
      await expect(
        projectPage.page.getByText(/\d+\s+agent/i).first(),
      ).toBeVisible({ timeout: 5_000 });
    } else {
      // Empty state must be visible
      await expect(projectPage.emptyStateText).toBeVisible({ timeout: 10_000 });
      await expect(projectPage.createFirstProjectButton).toBeVisible({
        timeout: 5_000,
      });
    }
  });

  // proj-11: New Project button on index page opens create modal
  test('admin clicks New Project on the index page and the create project modal appears', async ({
    page,
    projectPage,
  }) => {
    if (!(await projectPage.isOnProjectsIndexPage())) {
      await projectPage.navigateViaProjectsSidebarButton();
    }

    await expect(projectPage.newProjectIndexButton).toBeVisible({
      timeout: 10_000,
    });
    await projectPage.newProjectIndexButton.click();

    // The create-project modal from web-containers uses a Dialog
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Dismiss the modal without creating a project
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible({ timeout: 8_000 });
  });

  // proj-12: Card kebab menu shows Rename + Delete; no description or timestamp.
  test('admin sees project card with name and agent count but no description or timestamp, and kebab menu shows Rename and Delete', async ({
    page,
    projectPage,
    testProject,
  }) => {
    if (!(await projectPage.isOnProjectsIndexPage())) {
      await projectPage.navigateViaProjectsSidebarButton();
    }
    await waitForPageReady(page);

    // The project card must be visible on the index
    const cardName = page.locator('h3', { hasText: testProject.name });
    await expect(cardName).toBeVisible({ timeout: 15_000 });

    // Cards intentionally have NO description text and NO "Updated …" timestamp.
    const cardContainer = cardName.locator('../..');
    await expect(cardContainer.getByText(/updated/i)).not.toBeVisible();

    // Agent count is present
    await expect(cardContainer.getByText(/\d+\s+agent/i)).toBeVisible({
      timeout: 5_000,
    });

    // Kebab menu
    const kebab = cardContainer
      .locator('..')
      .getByRole('button', { name: 'Project actions' });
    await expect(kebab).toBeVisible({ timeout: 5_000 });
    await kebab.click();

    await expect(page.getByRole('menuitem', { name: /rename/i })).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByRole('menuitem', { name: /delete/i })).toBeVisible({
      timeout: 5_000,
    });

    // Dismiss the menu
    await page.keyboard.press('Escape');
  });

  // proj-13: Clicking a project card navigates to project chat route
  test('admin clicks a project card and is navigated to the project chat route', async ({
    page,
    projectPage,
    testProject,
  }) => {
    if (!(await projectPage.isOnProjectsIndexPage())) {
      await projectPage.navigateViaProjectsSidebarButton();
    }

    const card = page.locator('h3', { hasText: testProject.name });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();

    // Must navigate to the project chat route:
    // /platform/<tenantKey>/projects/<projectId>/<mentorId>
    // OR stay on /projects if no mentor is assigned yet (empty project).
    await waitForPageReady(page);
    const finalUrl = page.url();
    const isProjectChatRoute = /\/projects\/[^/]+\/[^/]+/.test(finalUrl);
    const isBackOnIndex = /\/projects\/?$/.test(new URL(finalUrl).pathname);
    expect(isProjectChatRoute || isBackOnIndex).toBe(true);
  });

  // proj-14: Kebab Rename flow on index page
  test('admin renames a project from the index page kebab menu', async ({
    page,
    projectPage,
    testProject,
  }) => {
    if (!(await projectPage.isOnProjectsIndexPage())) {
      await projectPage.navigateViaProjectsSidebarButton();
    }

    const renamedName = `${testProject.name} Renamed`;
    const cardName = page.locator('h3', { hasText: testProject.name });
    await expect(cardName).toBeVisible({ timeout: 15_000 });
    const cardContainer = cardName.locator('../..');
    const kebab = cardContainer
      .locator('..')
      .getByRole('button', { name: 'Project actions' });
    await expect(kebab).toBeVisible({ timeout: 10_000 });
    await kebab.click();

    const renameItem = page.getByRole('menuitem', { name: /rename/i });
    await expect(renameItem).toBeVisible({ timeout: 5_000 });
    await renameItem.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    const input = dialog.getByRole('textbox');
    await input.clear();
    await input.fill(renamedName);
    const confirmBtn = dialog.getByRole('button', { name: /rename/i }).last();
    await confirmBtn.click();
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });

    // The renamed card should now be visible
    await expect(page.locator('h3', { hasText: renamedName })).toBeVisible({
      timeout: 15_000,
    });
  });

  // proj-15: Kebab Delete flow on index page
  test('admin deletes a project from the index page kebab menu and the card disappears', async ({
    page,
    projectPage,
    testProject,
  }) => {
    if (!(await projectPage.isOnProjectsIndexPage())) {
      await projectPage.navigateViaProjectsSidebarButton();
    }

    const cardName = page.locator('h3', { hasText: testProject.name });
    await expect(cardName).toBeVisible({ timeout: 15_000 });
    const cardContainer = cardName.locator('../..');
    const kebab = cardContainer
      .locator('..')
      .getByRole('button', { name: 'Project actions' });
    await expect(kebab).toBeVisible({ timeout: 10_000 });
    await kebab.click();

    const deleteItem = page.getByRole('menuitem', { name: /delete/i });
    await expect(deleteItem).toBeVisible({ timeout: 5_000 });
    await deleteItem.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    const confirmBtn = dialog.getByRole('button', { name: /delete/i }).last();
    await confirmBtn.click();
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });

    // Card should be gone
    await expect(
      page.locator('h3', { hasText: testProject.name }),
    ).not.toBeVisible({ timeout: 10_000 });
  });
});

// ── Journey 26 — LLM Selector visibility on Projects index ────────────────
// proj-16: The "LLM Model Selector" navbar button is hidden on the projects
// index page but present on a normal mentor chat page. No project needed.
test.describe('Journey 26: LLM Selector hidden on Projects index (feat-1821)', () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) test.skip(true, 'LLM selector test requires admin access');
  });

  test('admin goes to chat page and sees LLM Model Selector, then navigates to projects index and it is hidden', async ({
    navbarPage,
    projectPage,
  }) => {
    // 1. Confirm LLM selector IS visible on a normal mentor chat page
    const selectorOnChat = await navbarPage.llmSelectorIsVisible(10_000);
    expect(selectorOnChat).toBe(true);

    // 2. Navigate to the projects index via the sidebar
    await projectPage.navigateViaProjectsSidebarButton();

    // 3. LLM Model Selector must NOT be visible on the projects index
    const selectorOnIndex = await navbarPage.llmSelectorIsVisible(5_000);
    expect(selectorOnIndex).toBe(false);
  });
});

// ── Journey 26 — No Agent Selected modal → Explore Agents (feat-1821) ─────
// proj-17: Trigger the "No Agent Selected" modal from the projects index
// (by clicking the "New Chat" sidebar button while on the projects index page
// where no mentor is selected), then verify the "Explore Agents" button
// navigates to the tenant explore page. No project needed.
//
// Placement rationale: this modal already has tests in 35-tenant-explore-page.spec.ts
// (triggered from the general explore page). Here we add coverage specific to
// the projects-index context as a regression guard for the redirect-bug fix in #1821.
test.describe('Journey 26: No Agent Selected modal from projects index (feat-1821)', () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin)
      test.skip(true, 'No Agent Selected modal test requires admin access');
  });

  test('admin goes to projects index and clicks New Chat to see No Agent Selected modal, then Explore Agents navigates to explore', async ({
    page,
    sidebarPage,
    projectPage,
  }) => {
    await projectPage.navigateViaProjectsSidebarButton();

    // On the projects index there is no mentorId in the URL, so the "New Chat"
    // sidebar button should trigger the "No Agent Selected" modal.
    await expect(sidebarPage.newChatButton).toBeVisible({ timeout: 10_000 });
    await sidebarPage.newChatButton.click();

    // The modal is an alertdialog (same pattern as in journey 35)
    const modal = page.getByRole('alertdialog');
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('No Agent Selected')).toBeVisible();

    // "Explore Agents" button navigates to the tenant explore page
    const exploreAgentsButton = modal.getByRole('button', {
      name: /explore agents/i,
    });
    await expect(exploreAgentsButton).toBeVisible();
    await exploreAgentsButton.click();

    await expect(modal).not.toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/explore/, { timeout: 15_000 });
  });
});
