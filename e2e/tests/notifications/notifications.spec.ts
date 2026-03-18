import { test, expect } from "@playwright/test";
import { MENTOR_NEXTJS_HOST } from "../utils";
import {
  expectNoAccessibilityViolationsOnDialogs,
  checkAdminStatus,
} from "../utils";
import { logger } from "@iblai/iblai-js/playwright";
import { navigateToMentorApp } from "../profile/helpers";
import { safeWaitForURL } from "@iblai/iblai-js/playwright";

const currentUserEmail = process.env.PLAYWRIGHT_USERNAME || "";

const notificationFormData = {
  title: "Test Notification " + new Date().toISOString(),
  message: "This is a test notification",
  users: [currentUserEmail],
  sendTime: "now",
};

test.describe("Notifications Management", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  test.describe("Notification Display Accessibility", () => {
    test("Land on notification page from notification bell", async ({
      page,
    }) => {
      const notificationsMenuItem = page.getByRole("button", {
        name: "Notifications",
        exact: true,
      });
      await notificationsMenuItem.click();
      await safeWaitForURL(
        page,
        new RegExp(
          `^${MENTOR_NEXTJS_HOST}/platform/[^/]+/[^/]+/notifications$`,
        ),
      );
      await page.waitForLoadState("domcontentloaded");
    });

    test("Create new notification", async ({ page }) => {
      const notificationsMenuItem = page.getByRole("button", {
        name: "Notifications",
        exact: true,
      });
      await notificationsMenuItem.click();

      await safeWaitForURL(page, (url) => url.href.endsWith("/notifications"), {
        timeout: 60_000,
      });

      await page.waitForLoadState("domcontentloaded");

      const newNotificationButton = page.getByTestId("new-notification-button");
      await expect(newNotificationButton).toBeVisible({ timeout: 60_000 });
      await newNotificationButton.click();

      await expect(page.getByTestId("send-notification-dialog")).toBeVisible({
        timeout: 60_000,
      });
      await page.waitForLoadState("domcontentloaded");

      logger.info("Filling in the notification form");
      const notificationPreviewInput = page.getByTestId(
        "notification-preview-input",
      );
      await expect(notificationPreviewInput).toBeVisible({ timeout: 30_000 });
      await notificationPreviewInput.fill(notificationFormData.title);

      const richTextEditor = page.locator(".tiptap");
      await expect(richTextEditor).toBeVisible({ timeout: 30_000 });
      await richTextEditor.fill(notificationFormData.message);

      await page.getByTestId("users-search-input").fill("invite");
      //await page.waitForTimeout(10000);
      //await page.waitForTimeout(2000)
      const notificationButton = page.getByTestId("notification-submit-button");
      if (await notificationButton.isVisible()) {
        await expect(notificationButton).toBeVisible();
        await notificationButton.click();
        await page.getByTestId("notification-submit-button").click();
      }
    });

    test("Mark all as read button should be visible", async ({ page }) => {
      const markAllAsReadButton = page.getByTestId("mark-all-read-button");
      if (await markAllAsReadButton.isVisible()) {
        await markAllAsReadButton.click();
        // State-based wait - button should disappear after marking all as read
        await expect(markAllAsReadButton).not.toBeVisible({ timeout: 5000 });
      } else {
        test.skip();
      }
    });

    test("Edit alert dialog from alerts tab exposes proactive fields with accessible attributes", async ({
      page,
    }) => {
      const notificationsMenuItem = page.getByRole("button", {
        name: "Notifications",
        exact: true,
      });
      await notificationsMenuItem.click();
      await safeWaitForURL(
        page,
        new RegExp(
          `^${MENTOR_NEXTJS_HOST}/platform/[^/]+/[^/]+/notifications$`,
        ),
      );
      await page.waitForLoadState("domcontentloaded");

      const alertsTabTrigger = page.getByTestId("notification-alerts-tab");
      // Wait for tab trigger to be interactive before clicking
      await expect(alertsTabTrigger).toBeVisible({ timeout: 15_000 });
      await alertsTabTrigger.click();
      await page.waitForSelector(
        '[data-testid="alerts-tab-content"]:not([data-state="inactive"])',
      );

      const proactiveCard = page.getByTestId(
        "alerts-template-card-PROACTIVE_LEARNER_NOTIFICATION",
      );
      // Extended timeout for proactive card to load
      await expect(proactiveCard).toBeVisible({ timeout: 30_000 });

      const editButton = page.getByTestId(
        "alerts-template-edit-PROACTIVE_LEARNER_NOTIFICATION",
      );
      await expect(editButton).toBeVisible();
      await editButton.click();

      const dialog = page.getByRole("dialog", {
        name: "Edit Notification Template",
      });
      await expect(dialog).toBeVisible();

      const messageTitleInput = dialog.getByLabel("Message Title");
      await expect(messageTitleInput).toHaveAttribute("aria-required", "true");
      await expect(messageTitleInput).toHaveAttribute("required", "");

      const messageBodyField = dialog.getByLabel("Message Body");
      await expect(messageBodyField).toHaveAttribute("aria-required", "true");
      await expect(messageBodyField).toHaveAttribute("role", "textbox");
      await expect(messageBodyField).toHaveAttribute("aria-multiline", "true");

      const learnerScopeSelect = dialog.getByLabel("Learner Scope");
      await expect(learnerScopeSelect).toBeVisible();

      const frequencySelect = dialog.getByLabel("Frequency");
      await expect(frequencySelect).toBeVisible();

      const periodicSettingsHeading = dialog.getByRole("heading", {
        name: "Periodic Delivery Settings",
      });
      await expect(periodicSettingsHeading).toBeVisible();

      const mentorsSelector = dialog.getByLabel("Periodic Mentors");
      await expect(mentorsSelector).toBeVisible();

      await expectNoAccessibilityViolationsOnDialogs(page);

      const cancelButton = dialog.getByRole("button", { name: "Cancel" });
      await cancelButton.click();
      await expect(dialog).not.toBeVisible();
    });

    test("Auto-open alerts tab for admin when inbox is empty", async ({
      page,
    }) => {
      const isAdmin = await checkAdminStatus(page);
      test.skip(!isAdmin, "Auto-open alerts tab test requires admin access");

      logger.info("User is admin, proceeding with auto-open alerts tab test");

      // Navigate to notifications page
      const notificationsMenuItem = page.getByRole("button", {
        name: "Notifications",
        exact: true,
      });
      await notificationsMenuItem.click();
      await safeWaitForURL(
        page,
        new RegExp(
          `^${MENTOR_NEXTJS_HOST}/platform/[^/]+/[^/]+/notifications$`,
        ),
      );

      // Wait for either inbox or alerts tab to become active.
      // When the inbox is empty the app auto-switches to the alerts tab, so the
      // inbox testids are never visible — wait for whichever tab stabilises first.
      await page.waitForSelector(
        '[data-testid="inbox-tab-content"][data-state="active"], [data-testid="alerts-tab-content"][data-state="active"]',
        { timeout: 30_000 },
      );

      const alertsTabTrigger = page.getByTestId("notification-alerts-tab");
      const alertsIsActive =
        (await alertsTabTrigger
          .getAttribute("data-state")
          .catch(() => null)) === "active";

      if (alertsIsActive) {
        logger.info("Inbox is empty — alerts tab was auto-opened");

        // Verify alerts tab content is visible
        const alertsTabContent = page.getByTestId("alerts-tab-content");
        await expect(alertsTabContent).toBeVisible({ timeout: 10_000 });

        // Verify inbox tab content is inactive
        const inboxTabContent = page.getByTestId("inbox-tab-content");
        await expect(inboxTabContent).toHaveAttribute("data-state", "inactive");

        // Verify alerts tab root is visible (content loaded)
        const alertsTabRoot = page.getByTestId("alerts-tab-root");
        await expect(alertsTabRoot).toBeVisible({ timeout: 10_000 });

        logger.info(
          "✅ Alerts tab was automatically opened for admin with empty inbox",
        );
      } else {
        logger.info(
          "Inbox has notifications — alerts tab auto-open not triggered (correct behaviour)",
        );
      }
    });
  });
});
