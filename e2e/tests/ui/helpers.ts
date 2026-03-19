import { expect, Page } from "@playwright/test";

export async function assertButtons(page: Page) {
  await expect(
    page.getByRole("button", { name: "Mentors", exact: true }),
  ).toBeVisible({ timeout: 10_000 });

  await expect(page.getByRole("button", { name: "Invite Users" })).toBeVisible({
    timeout: 10_000,
  });

  await expect(page.getByRole("button", { name: "New Chat" })).toBeVisible({
    timeout: 10_000,
  });

  await expect(page.getByRole("button", { name: "New Mentor" })).toBeVisible({
    timeout: 10_000,
  });
}
