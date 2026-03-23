import { test, expect } from "@playwright/test";

const HOST = process.env.MENTOR_NEXTJS_HOST || "";

/**
 * Seed test for Playwright Test Agents (planner, generator, healer).
 *
 * This test navigates to the mentorai platform using the admin storageState
 * set up by auth.setup.ts. It waits for the page to be ready and stable
 * before handing off to the agent.
 *
 * Agents use this seed to bootstrap the environment before exploring,
 * generating, or healing tests.
 */
test.describe("MentorAI Seed", () => {
  test("seed", async ({ page }) => {
    test.skip(!HOST, "Requires MENTOR_NEXTJS_HOST");

    // Navigate to the mentor platform (auth tokens come from storageState)
    await page.goto(HOST + "/platform", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    // Wait for the page to stabilize — the chat textarea indicates the app is ready
    await expect(
      page.getByRole("textbox", { name: /type a message|ask anything/i }),
    ).toBeVisible({ timeout: 30_000 });
  });
});
