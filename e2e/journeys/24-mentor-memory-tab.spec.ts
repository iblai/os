import { test, expect } from "../fixtures/mentor-test";
import { navigateToMentorApp, checkAdminStatus } from "../utils/auth";
import { waitForPageReady } from "../utils/resilient";

test.describe("Journey 24: Mentor Memory Tab", () => {
  test.beforeEach(async ({ page, editMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, "Memory tab requires admin access");
      return;
    }
    await editMentorPage.open("Memory");
    await waitForPageReady(page);
  });

  test("CP-24.1: admin can view the Memory tab and the Enable Memory section", async ({
    editMentorPage,
  }) => {
    // Verify the Memory tab itself is visible
    const memoryTab = editMentorPage.dialog.getByRole("tab", {
      name: "Memory",
    });
    await expect(memoryTab).toBeVisible({ timeout: 10_000 });

    // Verify the Enable Memory toggle and label
    await editMentorPage.memory.verifyEnableMemorySection();

    await editMentorPage.close();
  });

  test("CP-24.2: admin can toggle Enable Memory on and off", async ({
    editMentorPage,
  }) => {
    const wasEnabled = await editMentorPage.memory.isMemoryEnabled();

    // Toggle once
    await editMentorPage.memory.toggleMemory();
    const afterFirstToggle = await editMentorPage.memory.isMemoryEnabled();
    expect(afterFirstToggle).toBe(!wasEnabled);

    // Toggle back to restore original state
    await editMentorPage.memory.toggleMemory();
    const afterSecondToggle = await editMentorPage.memory.isMemoryEnabled();
    expect(afterSecondToggle).toBe(wasEnabled);

    await editMentorPage.close();
  });

  test("CP-24.3: admin can view memory entries or empty state and Add Memory button", async ({
    editMentorPage,
  }) => {
    await editMentorPage.memory.verifyManageMemoriesSection();

    const hasMemories = await editMentorPage.memory.hasMemories();
    if (!hasMemories) {
      await expect(editMentorPage.memory.emptyState).toBeVisible({
        timeout: 5_000,
      });
    } else {
      const count = await editMentorPage.memory.getMemoryCount();
      expect(count).toBeGreaterThan(0);
    }

    await editMentorPage.close();
  });

  test("CP-24.4: admin can add a new memory entry", async ({
    editMentorPage,
  }) => {
    const testContent = `E2E test memory ${Date.now()}`;

    await editMentorPage.memory.addMemory(testContent);

    // Verify the new memory appears in the list
    await expect(editMentorPage.dialog.getByText(testContent)).toBeVisible({
      timeout: 10_000,
    });

    // Clean up: delete the memory we just created
    await editMentorPage.memory.deleteFirst();

    await editMentorPage.close();
  });

  test("CP-24.5: admin can edit a memory entry", async ({ editMentorPage }) => {
    const hasMemories = await editMentorPage.memory.hasMemories();

    if (!hasMemories) {
      // Create a memory first so we have something to edit
      await editMentorPage.memory.addMemory("Memory to edit");
    }

    const editedContent = `Edited memory ${Date.now()}`;
    await editMentorPage.memory.editFirst(editedContent);

    // Verify edited content appears
    await expect(editMentorPage.dialog.getByText(editedContent)).toBeVisible({
      timeout: 10_000,
    });

    // Clean up
    await editMentorPage.memory.deleteFirst();

    await editMentorPage.close();
  });

  test("CP-24.6: admin can delete a memory entry", async ({
    editMentorPage,
  }) => {
    const hasMemories = await editMentorPage.memory.hasMemories();

    if (!hasMemories) {
      // Create a memory first so we have something to delete
      await editMentorPage.memory.addMemory("Memory to delete");
    }

    const initialCount = await editMentorPage.memory.getMemoryCount();
    await editMentorPage.memory.deleteFirst();

    // deleteFirst() already waits for the list to refresh via waitForLoaded()
    const finalCount = await editMentorPage.memory.getMemoryCount();
    expect(finalCount).toBeLessThan(initialCount);

    await editMentorPage.close();
  });

  test("CP-24.7: admin can see user filter and date range filter in manage memories", async ({
    editMentorPage,
  }) => {
    // Verify the user filter combobox is visible
    await expect(editMentorPage.memory.userFilter).toBeVisible({
      timeout: 10_000,
    });

    // Verify the date range picker button is visible
    await expect(editMentorPage.memory.dateRangeButton).toBeVisible({
      timeout: 10_000,
    });

    await editMentorPage.close();
  });
});
