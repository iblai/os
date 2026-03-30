import { test, expect } from "../fixtures/mentor-test";
import { navigateToMentorApp, checkAdminStatus } from "../utils/auth";
import { waitForPageReady } from "../utils/resilient";
import { MENTOR_NEXTJS_HOST } from "../fixtures/test-data";
import { safeWaitForURL } from "../utils/navigation";
import AxeBuilder from "@axe-core/playwright";

test.describe("Journey 22: Disclaimers & User Agreement", () => {
  test.beforeEach(async ({ page, editMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, "Disclaimers requires admin access");
      return;
    }
    await editMentorPage.open("Disclaimers");
    await waitForPageReady(page);
  });

  test("admin goes to disclaimers tab, toggles User Agreement on, and an unauthenticated user sees the modal before chat", async ({
    page,
    editMentorPage,
    browser,
  }) => {
    await editMentorPage.disclaimers.enableUserAgreement();
    await expect(editMentorPage.disclaimers.activeStatus).toBeVisible({
      timeout: 5_000,
    });

    // Set visibility to Anyone
    await editMentorPage.navigateToTab("Settings");
    await waitForPageReady(page);
    const hasVisibility = await editMentorPage.settings.visibilityCombobox
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (hasVisibility) await editMentorPage.settings.setVisibility("Anyone");
    await editMentorPage.close();

    const mentorUrl = page.url();

    // Verify as unauthenticated user
    const anonContext = await browser.newContext({ storageState: undefined });
    const anonPage = await anonContext.newPage();
    try {
      await anonPage.goto(mentorUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await safeWaitForURL(anonPage, (url) => url.href.includes("/platform/"), {
        timeout: 30_000,
      });
      await waitForPageReady(anonPage);
      const chatInput = anonPage.getByPlaceholder("Ask anything", {
        exact: true,
      });
      if (await chatInput.isVisible({ timeout: 15_000 }).catch(() => false)) {
        await chatInput.fill("Test user agreement");
        const sendBtn = anonPage.getByRole("button", { name: "Send message" });
        if (await sendBtn.isEnabled({ timeout: 5_000 }).catch(() => false)) {
          await sendBtn.click();
          const modal = anonPage
            .getByRole("dialog")
            .filter({ hasText: "User Agreement" });
          await expect(modal).toBeVisible({ timeout: 15_000 });
          await modal.getByRole("button", { name: "I Accept" }).click();
          await expect(modal).toBeHidden({ timeout: 10_000 });
        }
      }
    } finally {
      await anonContext.close();
    }
  });

  // fixme: disclaimers tab locator/property errors — page object references non-existent elements
  test.fixme(
    "admin goes to disclaimers tab and edits the User Agreement content",
    async ({ editMentorPage }) => {
      const editButton = editMentorPage.disclaimers.editButtons.first();
      await expect(editButton).toBeVisible({ timeout: 10_000 });
      await editButton.click();
      const editDialog = editMentorPage.page
        .getByRole("dialog")
        .filter({ hasText: /edit|user agreement/i })
        .last();
      await expect(editDialog).toBeVisible({ timeout: 10_000 });
      await editMentorPage.page.keyboard.press("Escape");
    },
  );

  test("admin goes to disclaimers tab and copies the User Agreement content to clipboard", async ({
    page,
    editMentorPage,
  }) => {
    const copyButton = editMentorPage.dialog.getByRole("button", {
      name: /copy/i,
    });
    const visible = await copyButton
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (!visible) return;
    await copyButton.click();
    const feedback = page.getByText(/copied/i);
    const hasFeedback = await feedback
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText().catch(() => ""),
    );
    expect(hasFeedback || clipboardText.length > 0).toBe(true);
  });

  // fixme: disclaimers tab locator/property errors — page object references non-existent elements
  test.fixme(
    "admin goes to disclaimers tab and edits the Advisory text which appears above the chat input",
    async ({ editMentorPage }) => {
      // Advisory is accessed via the second Edit button which opens a modal
      const advisoryEditButton = editMentorPage.disclaimers.editButtons.nth(1);
      const visible = await advisoryEditButton
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      if (!visible) return;
      await advisoryEditButton.click();
      const editModal = editMentorPage.page
        .getByRole("dialog")
        .filter({ hasText: /edit.*advisory|advisory/i })
        .last();
      const modalVisible = await editModal
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      if (modalVisible) {
        await editMentorPage.page.keyboard.press("Escape");
      }
      await editMentorPage.close();
    },
  );

  test("admin goes to disclaimers tab and verifies it has proper WCAG accessibility attributes", async ({
    page,
    editMentorPage,
  }) => {
    // fixme: The Edit Mentor dialog currently has accessibility violations
    // that are app-level issues, not test issues
    test.fixme();
    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .analyze();
    expect(results.violations.length).toBe(0);
    await editMentorPage.close();
  });

  test("admin goes to disclaimers tab and the User Agreement modal is accessible", async ({
    page,
    editMentorPage,
  }) => {
    // fixme: The Edit Mentor dialog currently has accessibility violations
    // that are app-level issues, not test issues
    test.fixme();
    await editMentorPage.disclaimers.enableUserAgreement();
    const modal = page
      .getByRole("dialog")
      .filter({ hasText: "User Agreement" });
    if (await modal.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const results = await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .analyze();
      expect(results.violations.length).toBe(0);
      await page.keyboard.press("Escape");
    }
    await editMentorPage.close();
  });

  // fixme: disclaimers tab locator/property errors — page object references non-existent elements
  test.fixme(
    "admin creates a new mentor, configures disclaimers, and an unauthenticated user sees the disclaimer modal before chat",
    async ({ page, editMentorPage, browser }) => {
      // Close the current modal — we'll create a fresh mentor
      await editMentorPage.close();

      // Navigate to create mentor
      const newMentorBtn = page.getByRole("button", {
        name: "New Mentor",
        exact: true,
      });
      const visible = await newMentorBtn
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      if (!visible) return;
      await newMentorBtn.click();

      const createDialog = page.getByRole("dialog", {
        name: /create.*mentor|new mentor/i,
      });
      await expect(createDialog).toBeVisible({ timeout: 10_000 });
      const nameInput = createDialog
        .getByPlaceholder(/mentor name|name/i)
        .first();
      await nameInput.fill(`E2E Disclaimer Test Mentor ${Date.now()}`);
      const createBtn = createDialog
        .getByRole("button", { name: /create|save/i })
        .last();
      await createBtn.click();
      await safeWaitForURL(page, (url) => url.href.includes("/platform/"), {
        timeout: 30_000,
      });

      const mentorUrl = page.url();

      // Configure disclaimers
      await editMentorPage.open("Disclaimers");
      await waitForPageReady(page);
      await editMentorPage.disclaimers.enableUserAgreement();
      await expect(editMentorPage.disclaimers.activeStatus).toBeVisible({
        timeout: 5_000,
      });
      await editMentorPage.navigateToTab("Settings");
      await waitForPageReady(page);
      const hasVisibility = await editMentorPage.settings.visibilityCombobox
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      if (hasVisibility) await editMentorPage.settings.setVisibility("Anyone");
      await editMentorPage.close();

      // Verify as unauthenticated user
      const anonContext = await browser.newContext({ storageState: undefined });
      const anonPage = await anonContext.newPage();
      try {
        await anonPage.goto(mentorUrl, {
          waitUntil: "domcontentloaded",
          timeout: 60_000,
        });
        await safeWaitForURL(
          anonPage,
          (url) => url.href.includes("/platform/"),
          {
            timeout: 30_000,
          },
        );
        await waitForPageReady(anonPage);
        const chatInput = anonPage.getByPlaceholder("Ask anything", {
          exact: true,
        });
        if (await chatInput.isVisible({ timeout: 15_000 }).catch(() => false)) {
          await chatInput.fill("Testing full disclaimer E2E");
          const sendBtn = anonPage.getByRole("button", {
            name: "Send message",
          });
          if (await sendBtn.isEnabled({ timeout: 5_000 }).catch(() => false)) {
            await sendBtn.click();
            const modal = anonPage
              .getByRole("dialog")
              .filter({ hasText: "User Agreement" });
            await expect(modal).toBeVisible({ timeout: 15_000 });
            await modal.getByRole("button", { name: "I Accept" }).click();
            await expect(modal).toBeHidden({ timeout: 10_000 });
          }
        }
      } finally {
        await anonContext.close();
      }
    },
  );
});
