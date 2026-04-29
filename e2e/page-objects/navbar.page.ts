import { Page, Locator, expect } from '@playwright/test';

export class NavbarPage {
  readonly page: Page;

  readonly mentorDropdown: Locator;
  readonly mentorDropdownNewChatItem: Locator;
  readonly profileDropdown: Locator;
  readonly notificationBell: Locator;
  readonly newChatItem: Locator;
  readonly profileItem: Locator;
  readonly helpItem: Locator;
  readonly logoutItem: Locator;
  readonly vectorDocButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.mentorDropdown = page.getByRole('button', {
      name: 'Selected mentor dropdown button',
    });
    this.mentorDropdownNewChatItem = page.getByRole('menuitem', {
      name: 'New Chat',
      exact: true,
    });

    this.profileDropdown = page.getByRole('button', {
      name: 'More options',
      exact: true,
    });
    this.notificationBell = page.getByRole('button', { name: /notification/i });
    this.newChatItem = page
      .getByRole('menuitem', { name: /new chat/i })
      .or(page.getByRole('button', { name: /new chat/i }));
    this.profileItem = page.getByRole('menuitem', { name: /profile/i });
    this.helpItem = page.getByRole('menuitem', { name: /help/i });
    this.logoutItem = page.getByRole('menuitem', { name: /log out/i });
    this.vectorDocButton = page.getByRole('button', {
      name: /vector document/i,
    });
  }

  async openMentorDropdown(): Promise<void> {
    await expect(this.mentorDropdown).toBeVisible({ timeout: 15_000 });
    await this.mentorDropdown.click();
  }

  async openProfileDropdown(): Promise<void> {
    await expect(this.profileDropdown).toBeVisible({ timeout: 10_000 });
    await this.profileDropdown.click();
  }

  async logout(): Promise<void> {
    await this.openProfileDropdown();
    await expect(this.logoutItem).toBeVisible({ timeout: 5_000 });
    await this.logoutItem.click();
  }

  async getMenuItemCount(): Promise<number> {
    await this.openProfileDropdown();
    const items = this.page.getByRole('menuitem');
    return items.count();
  }
}
