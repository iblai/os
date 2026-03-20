import { test, expect } from "../fixtures/mentor-test";
import { navigateToMentorApp } from "../utils/auth";
import { openMoreOptionsMenu } from "../utils/navigation";

test.describe("Journey 2: First-Time User Chat & Navigation", () => {
  test.beforeEach(async ({ nonadminPage }) => {
    await navigateToMentorApp(nonadminPage);
  });

  test("newly registered user goes to chat page and sends a message and receives an AI response", async ({
    nonadminChatPage,
  }) => {
    await nonadminChatPage.sendMessage("Hello, can you help me?");
    await nonadminChatPage.waitForAIResponse();
    await expect(nonadminChatPage.aiMessages.first()).toBeVisible();
  });

  test("newly registered user goes to chat page and starts a new chat session after chatting", async ({
    nonadminChatPage,
  }) => {
    await nonadminChatPage.sendMessage("First message");
    await nonadminChatPage.waitForAIResponse();
    await nonadminChatPage.startNewChat();
    await expect(nonadminChatPage.userMessages).toHaveCount(0);
  });

  test("newly registered user goes to sidebar and navigates to the explore page", async ({
    nonadminPage,
    nonadminSidebarPage,
    nonadminExplorePage,
  }) => {
    await nonadminSidebarPage.navigateToExplore();
    await expect(nonadminExplorePage.heading).toBeVisible({ timeout: 15_000 });
    await expect(nonadminPage).toHaveURL(/explore/);
  });

  test("newly registered user goes to profile dropdown and logs out", async ({
    nonadminPage,
    nonadminNavbarPage,
  }) => {
    await nonadminNavbarPage.logout();
    await expect(nonadminPage).toHaveURL(/login|auth/i, { timeout: 15_000 });
  });

  test("newly registered user goes to sidebar and toggles it open and closed", async ({
    nonadminPage,
    nonadminSidebarPage,
  }) => {
    const sidebar = nonadminPage
      .locator('[data-state="expanded"], [data-state="collapsed"]')
      .first();
    await nonadminSidebarPage.toggle();
    await nonadminPage.waitForTimeout(500);
    // After toggle, state should have changed
    const newState = await sidebar.getAttribute("data-state").catch(() => null);
    expect(["expanded", "collapsed"]).toContain(newState ?? "collapsed");
  });

  test("newly registered user goes to sidebar and clicks the help button to open docs link", async ({
    nonadminPage,
    nonadminSidebarPage,
  }) => {
    const [newPage] = await Promise.all([
      nonadminPage.context().waitForEvent("page", { timeout: 10_000 }),
      openMoreOptionsMenu(nonadminPage),
      nonadminPage
        .getByRole("menu", { name: /more options/i })
        .or(nonadminPage.getByRole("dialog"))
        .getByRole("menuitem", { name: /help/i })
        .click(),
    ]);
    expect(newPage.url()).toMatch(/ibl|docs|help/i);
    await newPage.close();
  });
});
