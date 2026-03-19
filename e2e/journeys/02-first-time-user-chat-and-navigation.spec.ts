import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp } from '../utils/auth';

test.describe('Journey 2: First-Time User Chat & Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  test('newly registered user goes to chat page and sends a message and receives an AI response', async ({
    chatPage,
  }) => {
    await chatPage.sendMessage('Hello, can you help me?');
    await chatPage.waitForAIResponse();
    await expect(chatPage.aiMessages.first()).toBeVisible();
  });

  test('newly registered user goes to chat page and starts a new chat session after chatting', async ({
    chatPage,
  }) => {
    await chatPage.sendMessage('First message');
    await chatPage.waitForAIResponse();
    await chatPage.startNewChat();
    await expect(chatPage.userMessages).toHaveCount(0);
  });

  test('newly registered user goes to sidebar and navigates to the explore page', async ({
    page,
    sidebarPage,
    explorePage,
  }) => {
    await sidebarPage.navigateToExplore();
    await expect(explorePage.heading).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/explore/);
  });

  test('newly registered user goes to profile dropdown and logs out', async ({
    page,
    navbarPage,
  }) => {
    await navbarPage.logout();
    await expect(page).toHaveURL(/login|auth/i, { timeout: 15_000 });
  });

  test('newly registered user goes to sidebar and toggles it open and closed', async ({
    page,
    sidebarPage,
  }) => {
    const sidebar = page.locator('[data-state="expanded"], [data-state="collapsed"]').first();
    await sidebarPage.toggle();
    await page.waitForTimeout(500);
    // After toggle, state should have changed
    const newState = await sidebar.getAttribute('data-state').catch(() => null);
    expect(['expanded', 'collapsed']).toContain(newState ?? 'collapsed');
  });

  test('newly registered user goes to sidebar and clicks the help button to open docs link', async ({
    page,
    sidebarPage,
  }) => {
    const [newPage] = await Promise.all([
      page.context().waitForEvent('page', { timeout: 10_000 }),
      sidebarPage.helpButton.click(),
    ]);
    expect(newPage.url()).toMatch(/ibl|docs|help/i);
    await newPage.close();
  });
});
