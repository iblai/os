import test, { expect } from "@playwright/test";
import { fillCreateMentorForm } from "../utils/create-mentor";
import { navigateToMentorApp } from "../profile/helpers";
import { openSettingsTab } from "../settings/helpers";
import { assertButtons } from "./helpers";

// test.describe.configure({ mode: 'serial' });

test.describe("Admin UI Works as supposed to on refresh", () => {
  test.setTimeout(300000);

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  test("admin sees the dropdown settings after refresh", async ({ page }) => {
    await fillCreateMentorForm({ page });

    const currentUrl = page.url();

    await assertButtons(page);

    await openSettingsTab(page);

    const whoCanChatCombobox = page.getByRole("combobox", {
      name: "Select who can chat",
    });
    await whoCanChatCombobox.click();

    const whoCanChatOption = page.getByRole("option", {
      name: "Anyone",
    });
    await expect(whoCanChatOption).toBeVisible({ timeout: 10_000 });
    await whoCanChatOption.click({ force: true });

    const saveMentorButton = page.getByRole("button", { name: "Save" });
    await saveMentorButton.click();

    await page.goto(currentUrl, {
      waitUntil: "domcontentloaded",
      timeout: 120_000, // Allow slow CI machines enough time to load
    });

    const exploreMentorsHeading = page.getByRole("heading", {
      name: "Explore Mentors",
    });

    const conversationStartersHeading = page.getByRole("heading", {
      name: "Conversation Starters",
    });

    await expect(exploreMentorsHeading).toBeVisible({
      timeout: 120_000,
    });

    await expect(conversationStartersHeading).toBeVisible({
      timeout: 120_000,
    });

    await assertButtons(page);

    await openSettingsTab(page);
  });
});
