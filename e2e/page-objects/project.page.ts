import { Page, Locator, expect } from '@playwright/test';
import { safeWaitForURL } from '../utils/navigation';

export class ProjectPage {
  readonly page: Page;

  readonly heading: Locator;
  readonly filesButton: Locator;
  readonly instructionsButton: Locator;
  readonly addMentorButton: Locator;
  readonly chatInput: Locator;
  readonly sendButton: Locator;

  // ── Projects index page (/platform/<tenantKey>/projects) ──────────────────
  /** The "Projects" h1 rendered by ProjectsPage from web-containers */
  readonly indexHeading: Locator;
  /** Subtitle text on the index page */
  readonly indexSubtitle: Locator;
  /** "Search projects..." input on the index page */
  readonly searchInput: Locator;
  /** Gradient "New Project" button on the index page */
  readonly newProjectIndexButton: Locator;
  /** Grid of project cards on the index page */
  readonly projectCards: Locator;
  /** Empty-state "No projects found" text */
  readonly emptyStateText: Locator;
  /** Empty-state "Create your first project" button */
  readonly createFirstProjectButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1 });
    // Project chat page file button: "Add files to project" (empty) or "View project files"
    this.filesButton = page
      .getByRole('button', {
        name: /add files to project|view project files/i,
      })
      .first();
    // Project chat page instructions button: "Add project instructions" or "Edit project instructions"
    this.instructionsButton = page
      .getByRole('button', {
        name: /add project instructions|edit project instructions/i,
      })
      .first();
    this.addMentorButton = page
      .getByRole('button', { name: /add agent/i })
      .first();
    this.chatInput = page.getByPlaceholder('Ask anything', { exact: true });
    this.sendButton = page.getByRole('button', { name: 'Send message' });

    // ── Projects index page locators ─────────────────────────────────────────
    this.indexHeading = page.getByRole('heading', {
      name: 'Projects',
      exact: true,
      level: 1,
    });
    this.indexSubtitle = page.getByText(
      /organize your agents.*files.*instructions/i,
    );
    this.searchInput = page.getByPlaceholder('Search projects...');
    this.newProjectIndexButton = page.getByRole('button', {
      name: 'New Project',
      exact: true,
    });
    // Cards are rendered inside a responsive grid — select by the kebab button
    // aria-label that uniquely identifies each project card.
    this.projectCards = page.locator('[aria-label="Project actions"]');
    this.emptyStateText = page.getByText('No projects found');
    this.createFirstProjectButton = page.getByRole('button', {
      name: /create your first project/i,
    });
  }

  /**
   * Creates a new project via the Projects index page.
   *
   * The old sidebar "New Project" button was removed in feat-1821. Projects are
   * now created from the dedicated /projects index page:
   *   Sidebar "Projects" button → index page → "New Project" button → modal.
   *
   * After creation the page stays on the projects index (or wherever the internal
   * navigation landed). Callers that need the chat route must navigate there separately.
   *
   * Background: the project chat route (/projects/<id>/<mentorId>) runs MentorProvider
   * which makes a public-settings API check. Under Playwright's headless load, this
   * check can fail (network error → mentorExists=false), redirecting back to the
   * default mentor page. We therefore leave navigation to the caller to control.
   */
  async createFromSidebar(name: string): Promise<void> {
    // 1. Navigate to the projects index via the sidebar "Projects" button
    await this.navigateViaProjectsSidebarButton();

    // 2. Click the "New Project" button on the index page
    await expect(this.newProjectIndexButton).toBeVisible({ timeout: 15_000 });
    await this.newProjectIndexButton.click();

    // 3. The create-project modal appears
    const modal = this.page.getByRole('dialog', { name: /new project/i });
    await expect(modal).toBeVisible({ timeout: 10_000 });

    // 4. Fill the project name
    const nameInput = modal.getByRole('textbox').first();
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
    await nameInput.fill(name);

    // 5. Wait for agents to finish loading.
    // The CreateProjectModal uses lazy Suspense (fallback: null) so the loading
    // text may not appear immediately. Wait up to 60s for it to disappear — the
    // agents API can be slow when the full test suite runs in parallel.
    try {
      await modal.getByText('Loading agents...').waitFor({
        state: 'visible',
        timeout: 15_000,
      });
      await expect(modal.getByText('Loading agents...')).not.toBeVisible({
        timeout: 60_000,
      });
    } catch {
      // Loading text never appeared — agents already loaded
    }

    // 6. Click the first agent card (button containing an h4 agent name)
    const agentCard = modal
      .locator('button')
      .filter({ has: this.page.locator('h4') })
      .first();
    await expect(agentCard).toBeVisible({ timeout: 15_000 });
    await agentCard.click();

    // 7. Wait for Save to become enabled (requires name + ≥1 agent selected)
    const saveButton = modal.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled({ timeout: 10_000 });
    await saveButton.click();

    // 8. Wait for the modal to close (project created successfully)
    await expect(modal).not.toBeVisible({ timeout: 15_000 });

    // 9. Navigate back to the index to confirm the card was created
    await this.navigateViaProjectsSidebarButton();
    const card = this.page.locator('h3', { hasText: name });
    await expect(card).toBeVisible({ timeout: 15_000 });
  }

  /**
   * Navigates from the projects index to the project chat route by clicking the
   * card for `projectName`. Waits for the chat route URL and re-tries if the
   * MentorProvider redirects back to the default mentor (headless API race).
   * Also handles the ErrorBoundary crash that can occur on the first render in
   * headless mode — detected via the "Oops, there was an error!" h2 heading.
   */
  async openProjectChatFromIndex(
    projectName: string,
    maxRetries = 3,
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // Ensure we're on the index
      if (!(await this.isOnProjectsIndexPage())) {
        await this.navigateViaProjectsSidebarButton();
      }
      const card = this.page.locator('h3', { hasText: projectName });
      await expect(card).toBeVisible({ timeout: 15_000 });
      await card.click();

      // Wait for either the chat route or a redirect back to a non-project page
      try {
        await this.page.waitForURL(
          (url) => url.pathname.includes('/projects/'),
          { timeout: 20_000, waitUntil: 'domcontentloaded' },
        );
      } catch {
        // URL didn't match — may have been redirected elsewhere; retry
        continue;
      }

      // Wait for either the project content OR an ErrorBoundary to appear.
      // The ErrorBoundary fires asynchronously after React renders.
      // We wait up to 15s for either the filesButton to appear OR the error heading.
      let contentOrError: 'content' | 'error' | 'timeout' = 'timeout';
      try {
        await Promise.race([
          this.filesButton
            .waitFor({ state: 'visible', timeout: 15_000 })
            .then(() => {
              contentOrError = 'content';
            }),
          this.page
            .getByRole('heading', { name: /oops.*error/i })
            .waitFor({ state: 'visible', timeout: 15_000 })
            .then(() => {
              contentOrError = 'error';
            }),
        ]);
      } catch {
        contentOrError = 'timeout';
      }

      if (contentOrError === 'content') {
        return; // page is stable with project content
      }

      if (contentOrError === 'error' || contentOrError === 'timeout') {
        // Hard-reload to clear the crashed state and retry
        await this.page.reload({ waitUntil: 'domcontentloaded' });
        await this.page.waitForTimeout(2_000);
        // After reload, check if content appears without error
        let reloadOk = false;
        try {
          await this.filesButton.waitFor({ state: 'visible', timeout: 10_000 });
          reloadOk = true;
        } catch {
          reloadOk = false;
        }
        if (reloadOk) return;
        continue; // retry by navigating back to index
      }

      // URL is stable and no error — if still on projects route, we're good
      if (this.page.url().includes('/projects/')) {
        return;
      }

      if (attempt === maxRetries) {
        throw new Error(
          `openProjectChatFromIndex: could not stabilise on project chat route after ${maxRetries} attempts. Final URL: ${this.page.url()}`,
        );
      }
    }
  }

  async isOnProjectPage(): Promise<boolean> {
    return this.page.url().includes('/projects/');
  }

  /**
   * Returns true when the URL matches the projects INDEX page
   * (/platform/<tenantKey>/projects) — NOT a project-chat route.
   */
  async isOnProjectsIndexPage(): Promise<boolean> {
    return /\/projects\/?$/.test(new URL(this.page.url()).pathname);
  }

  /**
   * Navigates to the projects index page via the "Projects" sidebar button.
   * Waits for the index heading to confirm arrival.
   */
  async navigateViaProjectsSidebarButton(): Promise<void> {
    const projectsButton = this.page.getByRole('button', {
      name: 'Projects',
      exact: true,
    });
    await expect(projectsButton).toBeVisible({ timeout: 15_000 });
    await projectsButton.click();
    await safeWaitForURL(
      this.page,
      (url) => /\/projects\/?$/.test(url.pathname),
      { timeout: 30_000 },
    );
    await expect(this.indexHeading).toBeVisible({ timeout: 20_000 });
  }

  /**
   * Clicks the kebab ("Project actions") button on the first project card
   * that matches `projectName`, then clicks the Rename menu item.
   * Fills in the new name and confirms.
   */
  async renameFromIndexCard(
    projectName: string,
    newName: string,
  ): Promise<void> {
    // Find the card that contains this project name, then its kebab button
    const card = this.page
      .locator('h3', { hasText: projectName })
      .locator('../..')
      .locator('..');
    const kebab = card.getByRole('button', { name: 'Project actions' });
    await expect(kebab).toBeVisible({ timeout: 10_000 });
    await kebab.click();

    const renameItem = this.page.getByRole('menuitem', { name: /rename/i });
    await expect(renameItem).toBeVisible({ timeout: 5_000 });
    await renameItem.click();

    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    const input = dialog.getByRole('textbox');
    await input.clear();
    await input.fill(newName);
    const confirmBtn = dialog.getByRole('button', { name: /rename/i }).last();
    await confirmBtn.click();
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });
  }

  /**
   * Clicks the kebab ("Project actions") button on the project card
   * that matches `projectName`, then clicks the Delete menu item and confirms.
   */
  async deleteFromIndexCard(projectName: string): Promise<void> {
    const card = this.page
      .locator('h3', { hasText: projectName })
      .locator('../..')
      .locator('..');
    const kebab = card.getByRole('button', { name: 'Project actions' });
    await expect(kebab).toBeVisible({ timeout: 10_000 });
    await kebab.click();

    const deleteItem = this.page.getByRole('menuitem', { name: /delete/i });
    await expect(deleteItem).toBeVisible({ timeout: 5_000 });
    await deleteItem.click();

    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    const confirmBtn = dialog.getByRole('button', { name: /delete/i }).last();
    await confirmBtn.click();
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });
  }

  /**
   * Clicks the first project card to open the project chat page.
   * Returns the project name that was clicked.
   */
  async openFirstProjectCard(): Promise<string> {
    // The first h3 inside a card is the project name
    const firstCardName = this.page.locator('h3').first();
    await expect(firstCardName).toBeVisible({ timeout: 10_000 });
    const name = (await firstCardName.textContent()) ?? '';
    // Click the card body (not the kebab) — target the card element above h3
    await firstCardName.click();
    return name.trim();
  }

  async rename(newName: string): Promise<void> {
    const projectText = this.page.getByText(newName.replace(' Renamed', ''));
    await projectText.hover();

    const renameMenuItem = this.page.getByRole('menuitem', { name: /rename/i });
    await projectText.click({ button: 'right' });

    const ctxVisible = await renameMenuItem
      .isVisible({ timeout: 3_000 })
      .catch(() => false);

    if (!ctxVisible) {
      await this.page.keyboard.press('Escape');
      const optionsBtn = this.page
        .locator('button[aria-label*="options"], button[aria-label*="Options"]')
        .first();
      if (await optionsBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await optionsBtn.click();
        await expect(renameMenuItem).toBeVisible({ timeout: 5_000 });
        await renameMenuItem.click();
      }
    } else {
      await renameMenuItem.click();
    }

    const dialog = this.page.getByRole('dialog', { name: 'Rename Project' });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    const input = dialog.getByPlaceholder('Enter new project name');
    await input.clear();
    await input.fill(newName);
    await dialog.getByRole('button', { name: 'Rename Project' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });
  }

  async delete(name: string): Promise<void> {
    const projectText = this.page.getByText(name).first();
    await projectText.hover();

    const deleteMenuItem = this.page.getByRole('menuitem', { name: /delete/i });
    await projectText.click({ button: 'right' });

    const ctxVisible = await deleteMenuItem
      .isVisible({ timeout: 3_000 })
      .catch(() => false);

    if (!ctxVisible) {
      await this.page.keyboard.press('Escape');
      const optionsBtn = this.page
        .locator('button[aria-label*="options"], button[aria-label*="Options"]')
        .first();
      if (await optionsBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await optionsBtn.click();
        await expect(deleteMenuItem).toBeVisible({ timeout: 5_000 });
        await deleteMenuItem.click();
      }
    } else {
      await deleteMenuItem.click();
    }

    const dialog = this.page.getByRole('dialog', { name: 'Delete Project' });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.getByRole('button', { name: 'Delete Project' }).click();
    await expect(
      this.page.getByText('Project deleted successfully'),
    ).toBeVisible({ timeout: 10_000 });
  }
}
