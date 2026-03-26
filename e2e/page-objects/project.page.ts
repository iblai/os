import { Page, Locator, expect } from "@playwright/test";
import { safeWaitForURL } from "../utils/navigation";

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
    this.heading = page.getByRole("heading", { level: 1 });
    this.filesButton = page.getByRole("button", {
      name: /add project files|files added/i,
    });
    this.instructionsButton = page.getByRole("button", {
      name: /add project instructions|edit project instructions/i,
    });
    this.addMentorButton = page
      .getByRole("button", { name: /add mentor/i })
      .first();
    this.chatInput = page.getByPlaceholder("Ask anything", { exact: true });
    this.sendButton = page.getByRole("button", { name: "Send message" });
  }

  async createFromSidebar(name: string): Promise<void> {
    const newProjectButton = this.page.getByRole("button", {
      name: "New Project",
      exact: true,
    });

    // Expand sidebar if collapsed — "New Project" only renders when sidebar is open
    const isVisible = await newProjectButton
      .isVisible({ timeout: 2_000 })
      .catch(() => false);
    if (!isVisible) {
      const toggle = this.page.getByRole("button", { name: /toggle sidebar/i });
      if (await toggle.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await toggle.click();
      }
    }

    await expect(newProjectButton).toBeVisible({ timeout: 15_000 });
    await newProjectButton.click();

    const modal = this.page.getByRole("dialog", { name: /new project/i });
    await expect(modal).toBeVisible({ timeout: 10_000 });

    const nameInput = modal.getByPlaceholder("Project Name");
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
    await nameInput.fill(name);

    const saveButton = modal.getByRole("button", { name: "Save" });
    await expect(saveButton).toBeEnabled({ timeout: 5_000 });
    await saveButton.click();

    await safeWaitForURL(
      this.page,
      (url) => url.pathname.includes("/projects/"),
      { timeout: 30_000 },
    );
  }

  async isOnProjectPage(): Promise<boolean> {
    return this.page.url().includes("/projects/");
  }

  async rename(newName: string): Promise<void> {
    const projectText = this.page.getByText(newName.replace(" Renamed", ""));
    await projectText.hover();

    const renameMenuItem = this.page.getByRole("menuitem", { name: /rename/i });
    await projectText.click({ button: "right" });

    const ctxVisible = await renameMenuItem
      .isVisible({ timeout: 3_000 })
      .catch(() => false);

    if (!ctxVisible) {
      await this.page.keyboard.press("Escape");
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

    const dialog = this.page.getByRole("dialog", { name: "Rename Project" });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    const input = dialog.getByPlaceholder("Enter new project name");
    await input.clear();
    await input.fill(newName);
    await dialog.getByRole("button", { name: "Rename Project" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });
  }

  async delete(name: string): Promise<void> {
    const projectText = this.page.getByText(name).first();
    await projectText.hover();

    const deleteMenuItem = this.page.getByRole("menuitem", { name: /delete/i });
    await projectText.click({ button: "right" });

    const ctxVisible = await deleteMenuItem
      .isVisible({ timeout: 3_000 })
      .catch(() => false);

    if (!ctxVisible) {
      await this.page.keyboard.press("Escape");
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

    const dialog = this.page.getByRole("dialog", { name: "Delete Project" });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.getByRole("button", { name: "Delete Project" }).click();
    await expect(
      this.page.getByText("Project deleted successfully"),
    ).toBeVisible({ timeout: 10_000 });
  }
}
