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

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1 });
    this.filesButton = page.getByRole('button', {
      name: /add project files|files added/i,
    });
    this.instructionsButton = page.getByRole('button', {
      name: /add project instructions|edit project instructions/i,
    });
    this.addMentorButton = page
      .getByRole('button', { name: /add agent/i })
      .first();
    this.chatInput = page.getByPlaceholder('Ask anything', { exact: true });
    this.sendButton = page.getByRole('button', { name: 'Send message' });
  }

  async createFromSidebar(name: string): Promise<void> {
    const sidebar = this.page.locator('aside').first();
    const newProjectButton = sidebar.getByRole('button', {
      name: 'New Project',
      exact: true,
    });

    // Expand the rail if collapsed — items only render when the sidebar
    // is open. The toggle's aria-label is "Expand sidebar" when collapsed.
    const isVisible = await newProjectButton
      .isVisible({ timeout: 2_000 })
      .catch(() => false);
    if (!isVisible) {
      const expandToggle = sidebar.getByRole('button', {
        name: 'Expand sidebar',
        exact: true,
      });
      if (await expandToggle.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await expandToggle.click();
      }
    }

    // "New Project" is inside the collapsible "Projects" section in the
    // new sidebar — expand it idempotently before clicking the inner item.
    const projectsTrigger = sidebar.getByRole('button', {
      name: 'Projects',
      exact: true,
    });
    await expect(projectsTrigger).toBeVisible({ timeout: 10_000 });
    const projectsExpanded = await projectsTrigger
      .getAttribute('aria-expanded')
      .catch(() => null);
    if (projectsExpanded !== 'true') {
      await projectsTrigger.click();
      await expect(projectsTrigger).toHaveAttribute('aria-expanded', 'true', {
        timeout: 5_000,
      });
    }

    await expect(newProjectButton).toBeVisible({ timeout: 15_000 });
    await newProjectButton.click();

    const modal = this.page.getByRole('dialog', { name: /new project/i });
    await expect(modal).toBeVisible({ timeout: 10_000 });

    const nameInput = modal.getByPlaceholder('Project Name');
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
    await nameInput.fill(name);

    const saveButton = modal.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled({ timeout: 5_000 });
    await saveButton.click();

    await safeWaitForURL(
      this.page,
      (url) => url.pathname.includes('/projects/'),
      { timeout: 30_000 },
    );
  }

  async isOnProjectPage(): Promise<boolean> {
    return this.page.url().includes('/projects/');
  }

  /**
   * The new sidebar's per-project context menu is a left-click
   * DropdownMenu (Radix), NOT the old right-click context menu. The
   * trigger is a hover-revealed three-dot button with
   * `aria-label="Project actions"` inside each project's `<li>`.
   *
   * Scoping rules: we constrain the search to the sidebar `<aside>`,
   * then narrow to `<li>` rows that contain BOTH a "Project actions"
   * button AND a name button whose accessible name matches exactly.
   * That eliminates ambiguity from generic `<li>` matches anywhere
   * else on the page (e.g. menu items, dropdown options).
   */
  private async openProjectActions(name: string): Promise<void> {
    const sidebar = this.page.locator('aside').first();
    const projectRow = sidebar
      .locator('li')
      .filter({
        has: this.page.getByRole('button', { name: 'Project actions' }),
      })
      .filter({
        has: this.page.getByRole('button', { name, exact: true }),
      });
    await expect(projectRow).toHaveCount(1, { timeout: 10_000 });
    await projectRow.hover();
    const actionsBtn = projectRow.getByRole('button', {
      name: 'Project actions',
    });
    await expect(actionsBtn).toBeVisible({ timeout: 5_000 });
    await actionsBtn.click();
  }

  async rename(newName: string): Promise<void> {
    const oldName = newName.replace(' Renamed', '');
    await this.openProjectActions(oldName);

    const renameMenuItem = this.page.getByRole('menuitem', { name: /rename/i });
    await expect(renameMenuItem).toBeVisible({ timeout: 5_000 });
    await renameMenuItem.click();

    const dialog = this.page.getByRole('dialog', { name: 'Rename Project' });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    const input = dialog.getByPlaceholder('Enter new project name');
    await input.clear();
    await input.fill(newName);
    await dialog.getByRole('button', { name: 'Rename Project' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });
  }

  async delete(name: string): Promise<void> {
    await this.openProjectActions(name);

    const deleteMenuItem = this.page.getByRole('menuitem', { name: /delete/i });
    await expect(deleteMenuItem).toBeVisible({ timeout: 5_000 });
    await deleteMenuItem.click();

    const dialog = this.page.getByRole('dialog', { name: 'Delete Project' });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.getByRole('button', { name: 'Delete Project' }).click();
    await expect(
      this.page.getByText('Project deleted successfully'),
    ).toBeVisible({ timeout: 10_000 });
  }
}
