import { test, expect } from "../fixtures/mentor-test";
import { navigateToMentorApp, checkAdminStatus } from "../utils/auth";
import { waitForPageReady } from "../utils/resilient";

/**
 * Post-suite cleanup: deletes test mentors created during the test run.
 * This is NOT a user journey — it is infrastructure cleanup.
 * Original: cleanup.mentornextjs.cleanup.ts
 */
test.describe("Cleanup: Delete test mentors", () => {
  test("admin goes to mentor settings and deletes test mentors created during the test run", async ({
    page,
    editMentorPage,
  }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Cleanup requires admin access");

    await editMentorPage.open("Settings");
    await waitForPageReady(page);
    const deleteBtn = editMentorPage.settings.deleteButton;
    const visible = await deleteBtn
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (!visible) return;
    await editMentorPage.settings.deleteMentor();
    await expect(page).toHaveURL(/\/platform\//, { timeout: 15_000 });
  });
});
