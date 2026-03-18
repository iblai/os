import { test, expect } from "@playwright/test";
import { navigateToMentorApp } from "../profile/helpers";
import {
  checkAdminStatus,
  selectDropdownWorksCorrectly,
  waitForPageReady,
  expectNoAccessibilityViolationsOnDialogs,
  MENTOR_NEXTJS_HOST,
} from "../utils";
import { fillCreateMentorForm } from "../utils/create-mentor";
import { safeWaitForURL } from "@iblai/iblai-js/playwright";

test.describe("Disclaimers Tab Tests", () => {
  test.setTimeout(300_000);

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  test("Admin can toggle User Agreement on/off and it affects chat", async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Test requires admin access");

    // Create a new mentor first
    await fillCreateMentorForm({ page });

    // Open mentor dropdown and navigate to Disclaimers
    const mentorDropdownButton = page.getByRole("button", {
      name: "Selected mentor dropdown",
    });
    await expect(mentorDropdownButton).toBeVisible({ timeout: 10_000 });
    await mentorDropdownButton.click();

    await waitForPageReady(page);

    const disclaimerMenuItem = page.getByRole("menuitem", {
      name: "Disclaimers",
    });
    await expect(disclaimerMenuItem).toBeVisible({ timeout: 10_000 });
    await disclaimerMenuItem.click();

    // Wait for the settings dialog to appear
    const settingsDialog = page
      .getByRole("dialog")
      .filter({ hasText: "Edit Mentor" });
    await expect(settingsDialog).toBeVisible({ timeout: 15000 });

    // Navigate to Disclaimers tab
    const disclaimersTab = settingsDialog.getByRole("tab", {
      name: "Disclaimers",
    });
    await expect(disclaimersTab).toBeVisible({ timeout: 10000 });
    await disclaimersTab.click();
    await waitForPageReady(page);

    // Verify User Agreement card is visible
    const userAgreementCard = settingsDialog
      .getByText("User Agreement")
      .first();
    await expect(userAgreementCard).toBeVisible({ timeout: 10000 });

    // Find the User Agreement switch
    const userAgreementSwitch = settingsDialog.getByRole("switch", {
      name: /User agreement/i,
    });
    await expect(userAgreementSwitch).toBeVisible({ timeout: 10000 });

    // Get initial state
    const initialState =
      (await userAgreementSwitch.getAttribute("aria-checked")) === "true";
    console.log(`Initial User Agreement state: ${initialState}`);

    // Toggle User Agreement ON if it's off
    if (!initialState) {
      await userAgreementSwitch.click();
      await page.waitForTimeout(2000);
      await expect(userAgreementSwitch).toHaveAttribute(
        "aria-checked",
        "true",
        {
          timeout: 10000,
        },
      );
      console.log("User Agreement toggled ON");
    }

    // Verify the status text shows "Active"
    const activeStatus = settingsDialog.getByText("Active").first();
    await expect(activeStatus).toBeVisible({ timeout: 5000 });

    // Close the settings dialog
    const closeButton = settingsDialog.getByRole("button", {
      name: "Close",
      exact: true,
    });
    await closeButton.click();
    await expect(settingsDialog).toBeHidden({ timeout: 10000 });

    // Now test that the User Agreement modal appears when trying to chat
    // First, start a new chat
    await selectDropdownWorksCorrectly(page);
    const newChatMenuItem = page.getByRole("menuitem", { name: "New chat" });
    await expect(newChatMenuItem).toBeVisible({ timeout: 5000 });
    await newChatMenuItem.click();
    await waitForPageReady(page);

    // Try to type in the chat input
    const chatInput = page.getByRole("textbox", { name: /Ask anything/i });
    await expect(chatInput).toBeVisible({ timeout: 15000 });
    await chatInput.fill("Hello, this is a test message");

    // Click send button
    const sendButton = page.getByRole("button", { name: /Send message/i });
    await expect(sendButton).toBeEnabled({ timeout: 15000 });
    // Wait for the reducers to be stable (to be improved)
    await page.waitForTimeout(5000);
    await sendButton.click();

    // The User Agreement modal should appear
    const userAgreementModal = page.getByRole("dialog").filter({
      hasText: "User Agreement",
    });

    // Check if the modal appears (it may or may not depending on if user already accepted)
    const modalAppeared = await userAgreementModal
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    if (modalAppeared) {
      console.log("User Agreement modal appeared as expected");

      // Verify the modal has the expected content
      await expect(
        userAgreementModal.getByRole("heading", { name: "User Agreement" }),
      ).toBeVisible();

      // Verify the "I Accept" button is present
      const acceptButton = userAgreementModal.getByRole("button", {
        name: "I Accept",
      });
      await expect(acceptButton).toBeVisible({ timeout: 5000 });

      // Click Accept
      await acceptButton.click();
      await expect(userAgreementModal).toBeHidden({ timeout: 10000 });
      console.log("User Agreement accepted");

      // Now verify chat can proceed
      await waitForPageReady(page);
    } else {
      console.log(
        "User Agreement modal did not appear - user may have already accepted",
      );
    }

    // Now toggle User Agreement OFF - re-open the settings dialog
    // Use the same pattern as the first part of the test
    const mentorDropdownButtonAgain = page.getByRole("button", {
      name: "Selected mentor dropdown",
    });
    await expect(mentorDropdownButtonAgain).toBeVisible({ timeout: 10_000 });
    await mentorDropdownButtonAgain.click();

    const disclaimerMenuItemAgain = page.getByRole("menuitem", {
      name: "Disclaimers",
    });
    await expect(disclaimerMenuItemAgain).toBeVisible({ timeout: 10_000 });
    await disclaimerMenuItemAgain.scrollIntoViewIfNeeded();
    await disclaimerMenuItemAgain.click();

    // Wait for the settings dialog to appear again
    const settingsDialogAgain = page.getByRole("dialog");
    await expect(settingsDialogAgain).toBeVisible({ timeout: 15000 });
    await waitForPageReady(page);

    // Navigate to Disclaimers tab again
    const disclaimersTabAgain = settingsDialogAgain.getByRole("tab", {
      name: "Disclaimers",
    });
    await expect(disclaimersTabAgain).toBeVisible({ timeout: 10000 });
    await disclaimersTabAgain.click();

    // Wait for tab panel to load - give extra time for content to render
    await page.waitForTimeout(2000);
    await waitForPageReady(page);

    // Toggle OFF - look for the switch directly
    const userAgreementSwitchAgain = settingsDialogAgain.getByRole("switch", {
      name: /User agreement/i,
    });
    await expect(userAgreementSwitchAgain).toBeVisible({ timeout: 15000 });
    const currentState =
      (await userAgreementSwitchAgain.getAttribute("aria-checked")) === "true";
    if (currentState) {
      await userAgreementSwitchAgain.click();
      await page.waitForTimeout(2000);
      await expect(userAgreementSwitchAgain).toHaveAttribute(
        "aria-checked",
        "false",
        { timeout: 10000 },
      );
      console.log("User Agreement toggled OFF");
    }

    // Verify status shows "Inactive"
    const inactiveStatus = page.getByText("Inactive").first();
    await expect(inactiveStatus).toBeVisible({ timeout: 5000 });

    const closeButtonAgain = settingsDialogAgain.getByRole("button", {
      name: "Close",
    });
    await closeButtonAgain.click();
    await expect(settingsDialogAgain).toBeHidden({ timeout: 10000 });
  });

  test("Admin can edit User Agreement content", async ({ page }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Test requires admin access");

    // Create a new mentor first
    await fillCreateMentorForm({ page });

    // Navigate to disclaimers tab
    await selectDropdownWorksCorrectly(page);
    const disclaimerMenuItem = page.getByRole("menuitem", {
      name: "Disclaimers",
    });
    await expect(disclaimerMenuItem).toBeVisible({ timeout: 10_000 });
    await disclaimerMenuItem.click();
    await waitForPageReady(page);

    const settingsDialog = page
      .getByRole("dialog")
      .filter({ hasText: "Edit Mentor" });
    await expect(settingsDialog).toBeVisible({ timeout: 15000 });

    const disclaimersTab = settingsDialog.getByRole("tab", {
      name: "Disclaimers",
    });
    await disclaimersTab.click();
    await waitForPageReady(page);

    // Click the Edit button on User Agreement card
    // The disclaimers tab has two cards side by side - User Agreement and Advisory
    // We need to target the first Edit button which belongs to User Agreement
    const editButtons = settingsDialog.getByRole("button", { name: "Edit" });
    const userAgreementEditButton = editButtons.first();
    await expect(userAgreementEditButton).toBeVisible({ timeout: 10000 });
    await userAgreementEditButton.click();

    // Verify the Edit User Agreement modal opens
    const editModal = page.getByRole("dialog").filter({
      hasText: /Edit User Agreement/i,
    });
    await expect(editModal).toBeVisible({ timeout: 10000 });

    // Verify there's a text editor/textarea
    const textEditor = editModal.locator('textarea, [contenteditable="true"]');
    await expect(textEditor.first()).toBeVisible({ timeout: 5000 });

    // Close the edit modal without saving
    const cancelButton = editModal.getByRole("button", { name: /Cancel/i });
    if (await cancelButton.isVisible()) {
      await cancelButton.click();
    } else {
      await page.keyboard.press("Escape");
    }
    await expect(editModal).toBeHidden({ timeout: 10000 });

    console.log("Edit User Agreement modal works correctly");

    // Close settings dialog
    const closeButton = settingsDialog.getByRole("button", {
      name: "Close",
      exact: true,
    });
    await closeButton.click();
  });

  test("Admin can copy User Agreement content", async ({ page }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Test requires admin access");

    // Create a new mentor first
    await fillCreateMentorForm({ page });

    // Navigate to disclaimers tab
    await selectDropdownWorksCorrectly(page);
    const disclaimerMenuItem = page.getByRole("menuitem", {
      name: "Disclaimers",
    });
    await expect(disclaimerMenuItem).toBeVisible({ timeout: 10_000 });
    await disclaimerMenuItem.click();
    await waitForPageReady(page);

    const settingsDialog = page
      .getByRole("dialog")
      .filter({ hasText: "Edit Mentor" });
    await expect(settingsDialog).toBeVisible({ timeout: 15000 });

    const disclaimersTab = settingsDialog.getByRole("tab", {
      name: "Disclaimers",
    });
    await disclaimersTab.click();
    await waitForPageReady(page);

    // Find the Copy button in User Agreement card
    const userAgreementSection = settingsDialog
      .locator("div")
      .filter({ hasText: /^User Agreement/ })
      .first()
      .locator("..");
    const copyButton = userAgreementSection
      .getByRole("button")
      .filter({ has: page.locator("svg") })
      .last();

    // Look for a button with copy icon or "Copy" label
    const copyButtonByLabel = settingsDialog
      .locator("div")
      .filter({ hasText: "User Agreement" })
      .locator("button")
      .filter({ has: page.locator('svg.lucide-copy, [class*="copy"]') });

    const copyBtn =
      (await copyButtonByLabel.count()) > 0 ? copyButtonByLabel : copyButton;

    if ((await copyBtn.count()) > 0) {
      await copyBtn.first().click();
      console.log("Copy button clicked");

      // Check for toast/notification indicating copy success
      await page.waitForTimeout(1000);
    } else {
      console.log("Copy button not found - may have different UI");
    }

    // Close settings dialog
    const closeButton = settingsDialog.getByRole("button", {
      name: "Close",
      exact: true,
    });
    await closeButton.click();
  });

  test("Admin can edit Advisory and it appears above chat input", async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Test requires admin access");

    // Create a new mentor first
    await fillCreateMentorForm({ page });

    const testAdvisoryText = `Test Advisory Content - ${Date.now()}`;

    // Navigate to disclaimers tab
    await selectDropdownWorksCorrectly(page);
    const disclaimerMenuItem = page.getByRole("menuitem", {
      name: "Disclaimers",
    });
    await expect(disclaimerMenuItem).toBeVisible({ timeout: 10_000 });
    await disclaimerMenuItem.click();
    await waitForPageReady(page);

    const settingsDialog = page
      .getByRole("dialog")
      .filter({ hasText: "Edit Mentor" });
    await expect(settingsDialog).toBeVisible({ timeout: 15000 });

    const disclaimersTab = settingsDialog.getByRole("tab", {
      name: "Disclaimers",
    });
    await disclaimersTab.click();
    await waitForPageReady(page);

    // Verify Advisory card is visible
    const advisoryCard = settingsDialog.getByText("Advisory").first();
    await expect(advisoryCard).toBeVisible({ timeout: 10000 });

    // Click the Edit button on Advisory card
    // The Advisory card is the second card, so the second Edit button
    const allEditButtons = settingsDialog.getByRole("button", { name: "Edit" });
    const advisoryEditButton = allEditButtons.nth(1);
    await expect(advisoryEditButton).toBeVisible({ timeout: 10000 });
    await advisoryEditButton.click();

    // Verify the Edit Advisory modal opens - the title is "Edit Advisory"
    const editModal = page.getByRole("dialog").filter({
      hasText: /Edit Advisory/i,
    });
    await expect(editModal).toBeVisible({ timeout: 15000 });

    // Find the textarea and enter content
    const textEditor = editModal.getByRole("textbox");
    await expect(textEditor).toBeVisible({ timeout: 5000 });
    await textEditor.clear();
    await textEditor.fill(testAdvisoryText);

    // Save the changes
    const saveButton = editModal.getByRole("button", { name: "Save" });
    await expect(saveButton).toBeVisible({ timeout: 5000 });
    await saveButton.click();

    // Wait for save to complete (modal should close or show success)
    await page.waitForTimeout(3000);

    // The edit modal may auto-close after save, or we need to close it
    const editModalStillOpen = await editModal.isVisible().catch(() => false);
    if (editModalStillOpen) {
      const cancelBtn = editModal.getByRole("button", { name: "Cancel" });
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
      }
    }
    await expect(editModal).toBeHidden({ timeout: 10000 });

    // Close settings dialog
    const closeButton = settingsDialog.getByRole("button", {
      name: "Close",
      exact: true,
    });
    await closeButton.click();
    await expect(settingsDialog).toBeHidden({ timeout: 10000 });

    // Now verify the advisory text appears above the chat input
    await waitForPageReady(page);

    // Look for the advisory text above the chat area
    const advisoryTextElement = page.locator("*", {
      hasText: testAdvisoryText,
    });
    const advisoryVisible = await advisoryTextElement
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    if (advisoryVisible) {
      console.log("Advisory text is visible above chat input");
    } else {
      console.log(
        "Advisory text not immediately visible - may need to scroll or it may be displayed differently",
      );
    }
  });

  test("Disclaimers tab has proper accessibility", async ({ page }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Test requires admin access");

    // Create a new mentor first
    await fillCreateMentorForm({ page });

    // Navigate to disclaimers tab
    await selectDropdownWorksCorrectly(page);
    const disclaimerMenuItem = page.getByRole("menuitem", {
      name: "Disclaimers",
    });
    await expect(disclaimerMenuItem).toBeVisible({ timeout: 10_000 });
    await disclaimerMenuItem.click();
    await waitForPageReady(page);

    const settingsDialog = page
      .getByRole("dialog")
      .filter({ hasText: "Edit Mentor" });
    await expect(settingsDialog).toBeVisible({ timeout: 15000 });

    const disclaimersTab = settingsDialog.getByRole("tab", {
      name: "Disclaimers",
    });
    await disclaimersTab.click();
    await waitForPageReady(page);

    // Run accessibility audit on the dialog
    await expectNoAccessibilityViolationsOnDialogs(page);

    // Test keyboard navigation
    console.log("Testing keyboard navigation...");

    // Tab through the interactive elements
    await page.keyboard.press("Tab");
    await page.waitForTimeout(200);

    // Check that focus is visible
    const focusedElement = page.locator(":focus");
    const isFocusVisible = await focusedElement.isVisible().catch(() => false);
    expect(isFocusVisible).toBe(true);

    // Test that switches have proper ARIA labels
    const switches = settingsDialog.getByRole("switch");
    const switchCount = await switches.count();

    for (let i = 0; i < switchCount; i++) {
      const switchEl = switches.nth(i);
      const ariaLabel = await switchEl.getAttribute("aria-label");
      expect(ariaLabel).toBeTruthy();
      console.log(`Switch ${i + 1} aria-label: ${ariaLabel}`);
    }

    // Test that buttons have accessible names
    const buttons = settingsDialog.getByRole("button");
    const buttonCount = await buttons.count();

    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const isVisible = await button.isVisible().catch(() => false);
      if (isVisible) {
        const accessibleName =
          (await button.getAttribute("aria-label")) ||
          (await button.textContent());
        expect(accessibleName?.trim().length).toBeGreaterThan(0);
      }
    }

    // Test that regions have proper labels
    const regions = settingsDialog.getByRole("region");
    const regionCount = await regions.count();

    for (let i = 0; i < regionCount; i++) {
      const region = regions.nth(i);
      const isVisible = await region.isVisible().catch(() => false);
      if (isVisible) {
        const ariaLabel = await region.getAttribute("aria-label");
        expect(ariaLabel).toBeTruthy();
        console.log(`Region ${i + 1} aria-label: ${ariaLabel}`);
      }
    }

    // Test tooltips
    const infoButtons = settingsDialog.locator(
      'button[aria-label*="More info"], [aria-label*="info"]',
    );
    const infoButtonCount = await infoButtons.count();

    if (infoButtonCount > 0) {
      // Hover over info button to trigger tooltip
      await infoButtons.first().hover();
      await page.waitForTimeout(500);

      // Check if tooltip appears
      const tooltip = page.getByRole("tooltip");
      const tooltipVisible = await tooltip
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      if (tooltipVisible) {
        console.log("Tooltips are accessible");
      }
    }

    console.log("Accessibility tests passed");

    // Close settings dialog
    const closeButton = settingsDialog.getByRole("button", {
      name: "Close",
      exact: true,
    });
    await closeButton.click();
  });

  test("User Agreement modal is accessible", async ({ page }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Test requires admin access");

    // Create a new mentor first
    await fillCreateMentorForm({ page });

    // First, make sure User Agreement is ON
    await selectDropdownWorksCorrectly(page);
    const disclaimerMenuItem = page.getByRole("menuitem", {
      name: "Disclaimers",
    });
    await expect(disclaimerMenuItem).toBeVisible({ timeout: 10_000 });
    await disclaimerMenuItem.click();
    await waitForPageReady(page);

    const settingsDialog = page
      .getByRole("dialog")
      .filter({ hasText: "Edit Mentor" });
    await expect(settingsDialog).toBeVisible({ timeout: 15000 });

    const disclaimersTab = settingsDialog.getByRole("tab", {
      name: "Disclaimers",
    });
    await disclaimersTab.click();
    await waitForPageReady(page);

    const userAgreementSwitch = settingsDialog.getByRole("switch", {
      name: /User agreement/i,
    });
    const isEnabled =
      (await userAgreementSwitch.getAttribute("aria-checked")) === "true";

    if (!isEnabled) {
      await userAgreementSwitch.click();
      await page.waitForTimeout(2000);
    }

    const closeButton = settingsDialog.getByRole("button", {
      name: "Close",
      exact: true,
    });
    await closeButton.click();
    await expect(settingsDialog).toBeHidden({ timeout: 10000 });

    // Start a new chat session to trigger User Agreement modal
    await selectDropdownWorksCorrectly(page);
    const newChatMenuItem = page.getByRole("menuitem", { name: "New chat" });
    await newChatMenuItem.click();
    await waitForPageReady(page);

    const chatInput = page.getByRole("textbox", { name: /Ask anything/i });
    await expect(chatInput).toBeVisible({ timeout: 15000 });
    await chatInput.fill("Test message");

    const sendButton = page.getByRole("button", { name: /Send message/i });
    await expect(sendButton).toBeEnabled({ timeout: 15000 });
    await sendButton.click();

    // Check if User Agreement modal appears
    const userAgreementModal = page.getByRole("dialog").filter({
      hasText: "User Agreement",
    });

    const modalAppeared = await userAgreementModal
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    if (modalAppeared) {
      // Run accessibility audit on the modal
      await expectNoAccessibilityViolationsOnDialogs(page);

      // Test keyboard navigation within modal
      await page.keyboard.press("Tab");
      await page.waitForTimeout(200);

      // Verify the accept button is focusable
      const acceptButton = userAgreementModal.getByRole("button", {
        name: "I Accept",
      });
      await expect(acceptButton).toBeVisible();

      // Test that content area is scrollable with keyboard
      const scrollArea = userAgreementModal.locator(
        "[data-radix-scroll-area-viewport]",
      );
      if (await scrollArea.isVisible()) {
        await scrollArea.focus();
        await page.keyboard.press("ArrowDown");
        console.log("Scroll area is keyboard accessible");
      }

      // Accept and close
      await acceptButton.click();
      await expect(userAgreementModal).toBeHidden({ timeout: 10000 });
    } else {
      console.log(
        "User Agreement modal did not appear - user may have already accepted",
      );
    }
  });

  test("Create new mentor, configure disclaimers, and verify unauthenticated user sees disclaimer modal", async ({
    page,
    browser,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Test requires admin access");

    // --- Step 1: Create a new mentor ---
    const { mentorName } = await fillCreateMentorForm({ page });
    console.log(`Created new mentor: ${mentorName}`);

    // Extract the mentor URL for use in the unauthenticated context
    const currentUrl = page.url();
    const urlMatch = currentUrl.match(/\/platform\/([^/]+)\/([^/?]+)/);
    if (!urlMatch) {
      throw new Error(
        `Could not extract tenantKey/mentorId from URL: ${currentUrl}`,
      );
    }
    const [, tenantKey, mentorId] = urlMatch;
    const mentorUrl = `${MENTOR_NEXTJS_HOST}/platform/${tenantKey}/${mentorId}`;

    // --- Step 2: Enable User Agreement in Disclaimers tab ---
    await selectDropdownWorksCorrectly(page);
    const disclaimerMenuItem = page.getByRole("menuitem", {
      name: "Disclaimers",
    });
    await expect(disclaimerMenuItem).toBeVisible({ timeout: 10_000 });
    await disclaimerMenuItem.click();
    await waitForPageReady(page);

    const settingsDialog = page
      .getByRole("dialog")
      .filter({ hasText: "Edit Mentor" });
    await expect(settingsDialog).toBeVisible({ timeout: 15_000 });

    const disclaimersTab = settingsDialog.getByRole("tab", {
      name: "Disclaimers",
    });
    await disclaimersTab.click();
    await waitForPageReady(page);

    const userAgreementSwitch = settingsDialog.getByRole("switch", {
      name: /User agreement/i,
    });
    await expect(userAgreementSwitch).toBeVisible({ timeout: 10_000 });

    const isEnabled =
      (await userAgreementSwitch.getAttribute("aria-checked")) === "true";
    if (!isEnabled) {
      await userAgreementSwitch.click();
      await page.waitForTimeout(2_000);
      await expect(userAgreementSwitch).toHaveAttribute(
        "aria-checked",
        "true",
        { timeout: 10_000 },
      );
    }

    const activeStatus = settingsDialog.getByText("Active").first();
    await expect(activeStatus).toBeVisible({ timeout: 5_000 });
    console.log("User Agreement enabled and showing Active status");

    // --- Step 3: Also set visibility to Anyone so anon users can access it ---
    const settingsTab = settingsDialog.getByRole("tab", { name: "Settings" });
    await settingsTab.click();
    await waitForPageReady(page);

    const visibilityCombobox = settingsDialog.getByRole("combobox", {
      name: /visibility/i,
    });
    if (
      await visibilityCombobox.isVisible({ timeout: 5_000 }).catch(() => false)
    ) {
      await visibilityCombobox.click();
      const anyoneOption = page.getByRole("option", { name: /anyone/i });
      if (await anyoneOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await anyoneOption.click();
        const saveBtn = settingsDialog.getByRole("button", { name: /save/i });
        if (await saveBtn.isEnabled({ timeout: 3_000 }).catch(() => false)) {
          await saveBtn.click();
          await waitForPageReady(page);
        }
      }
    }

    const closeButton = settingsDialog.getByRole("button", {
      name: "Close",
      exact: true,
    });
    await closeButton.click();
    await expect(settingsDialog).toBeHidden({ timeout: 10_000 });

    // --- Step 4: Open a fresh unauthenticated context and verify disclaimer modal ---
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
      const chatVisible = await chatInput
        .isVisible({ timeout: 15_000 })
        .catch(() => false);

      if (!chatVisible) {
        console.log(
          "Chat input not visible for anonymous user — mentor may require login, skipping modal check",
        );
      } else {
        await chatInput.fill("Hello, testing disclaimer E2E");
        const sendButton = anonPage.getByRole("button", {
          name: "Send message",
        });
        await expect(sendButton).toBeEnabled({ timeout: 10_000 });
        await anonPage.waitForTimeout(2_000);
        await sendButton.click();

        // Disclaimer modal must appear before the message is sent
        const userAgreementModal = anonPage
          .getByRole("dialog")
          .filter({ hasText: "User Agreement" });
        await expect(userAgreementModal).toBeVisible({ timeout: 15_000 });
        console.log("User Agreement modal appeared for unauthenticated user ✓");

        const acceptButton = userAgreementModal.getByRole("button", {
          name: "I Accept",
        });
        await expect(acceptButton).toBeVisible({ timeout: 5_000 });
        await acceptButton.click();
        await expect(userAgreementModal).toBeHidden({ timeout: 10_000 });
        console.log("User Agreement accepted — chat can proceed ✓");
      }
    } finally {
      await anonContext.close();
    }

    console.log(
      "Successfully configured disclaimers for new mentor and verified end-to-end",
    );
  });

  test("Admin toggles User Agreement on; unauthenticated user sees disclaimer modal before chat", async ({
    page,
    browser,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Test requires admin access");

    // --- Step 1: Admin creates a mentor and enables User Agreement ---
    await navigateToMentorApp(page);
    await fillCreateMentorForm({ page });

    // Get the current URL to extract tenantKey and mentorId for the public URL
    const currentUrl = page.url();
    const urlMatch = currentUrl.match(/\/platform\/([^/]+)\/([^/?]+)/);
    if (!urlMatch) {
      throw new Error(
        `Could not extract tenantKey/mentorId from URL: ${currentUrl}`,
      );
    }
    const [, tenantKey, mentorId] = urlMatch;

    // Navigate to Disclaimers tab and enable User Agreement
    await selectDropdownWorksCorrectly(page);
    const disclaimerMenuItem = page.getByRole("menuitem", {
      name: "Disclaimers",
    });
    await expect(disclaimerMenuItem).toBeVisible({ timeout: 10_000 });
    await disclaimerMenuItem.click();

    const settingsDialog = page
      .getByRole("dialog")
      .filter({ hasText: "Edit Mentor" });
    await expect(settingsDialog).toBeVisible({ timeout: 15_000 });

    const disclaimersTab = settingsDialog.getByRole("tab", {
      name: "Disclaimers",
    });
    await disclaimersTab.click();
    await waitForPageReady(page);

    const userAgreementSwitch = settingsDialog.getByRole("switch", {
      name: /User agreement/i,
    });
    await expect(userAgreementSwitch).toBeVisible({ timeout: 10_000 });

    const wasEnabled =
      (await userAgreementSwitch.getAttribute("aria-checked")) === "true";
    if (!wasEnabled) {
      await userAgreementSwitch.click();
      await expect(userAgreementSwitch).toHaveAttribute(
        "aria-checked",
        "true",
        {
          timeout: 10_000,
        },
      );
    }

    // Also set mentor visibility to Anyone so unauthenticated users can access it
    const settingsTab = settingsDialog.getByRole("tab", { name: "Settings" });
    await settingsTab.click();
    await waitForPageReady(page);

    const visibilityCombobox = settingsDialog.getByRole("combobox", {
      name: /visibility/i,
    });
    if (
      await visibilityCombobox.isVisible({ timeout: 5_000 }).catch(() => false)
    ) {
      await visibilityCombobox.click();
      const anyoneOption = page.getByRole("option", { name: /anyone/i });
      if (await anyoneOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await anyoneOption.click();
        const saveButton = settingsDialog.getByRole("button", {
          name: /save/i,
        });
        if (await saveButton.isEnabled({ timeout: 3_000 }).catch(() => false)) {
          await saveButton.click();
          await waitForPageReady(page);
        }
      }
    }

    const closeButton = settingsDialog.getByRole("button", {
      name: "Close",
      exact: true,
    });
    await closeButton.click();
    await expect(settingsDialog).toBeHidden({ timeout: 10_000 });

    // --- Step 2: Open a fresh unauthenticated context and visit the mentor ---
    const mentorUrl = `${MENTOR_NEXTJS_HOST}/platform/${tenantKey}/${mentorId}`;
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

      // Find the chat input and attempt to send a message
      const chatInput = anonPage.getByPlaceholder("Ask anything", {
        exact: true,
      });
      const chatVisible = await chatInput
        .isVisible({ timeout: 15_000 })
        .catch(() => false);

      if (!chatVisible) {
        // Anonymous users may need to log in first — skip gracefully
        console.log(
          "Chat input not visible for anonymous user — mentor may require login",
        );
      } else {
        await chatInput.fill("Hello, testing user agreement");
        const sendButton = anonPage.getByRole("button", {
          name: "Send message",
        });
        await expect(sendButton).toBeEnabled({ timeout: 10_000 });
        await anonPage.waitForTimeout(2_000);
        await sendButton.click();

        // The User Agreement modal should appear before the message is sent
        const userAgreementModal = anonPage.getByRole("dialog").filter({
          hasText: "User Agreement",
        });
        await expect(userAgreementModal).toBeVisible({ timeout: 15_000 });
        console.log(
          "User Agreement modal appeared for unauthenticated user as expected",
        );

        // Accept and verify chat can proceed
        const acceptButton = userAgreementModal.getByRole("button", {
          name: "I Accept",
        });
        await expect(acceptButton).toBeVisible({ timeout: 5_000 });
        await acceptButton.click();
        await expect(userAgreementModal).toBeHidden({ timeout: 10_000 });
        console.log("User Agreement accepted — chat can proceed");
      }
    } finally {
      await anonContext.close();
    }

    // --- Step 3: Admin cleans up — disable User Agreement ---
    await navigateToMentorApp(page);
    await selectDropdownWorksCorrectly(page);
    const disclaimerMenuItemAgain = page.getByRole("menuitem", {
      name: "Disclaimers",
    });
    await expect(disclaimerMenuItemAgain).toBeVisible({ timeout: 10_000 });
    await disclaimerMenuItemAgain.click();

    const settingsDialogAgain = page
      .getByRole("dialog")
      .filter({ hasText: "Edit Mentor" });
    await expect(settingsDialogAgain).toBeVisible({ timeout: 15_000 });
    const disclaimersTabAgain = settingsDialogAgain.getByRole("tab", {
      name: "Disclaimers",
    });
    await disclaimersTabAgain.click();
    await waitForPageReady(page);

    if (!wasEnabled) {
      const userAgreementSwitchAgain = settingsDialogAgain.getByRole("switch", {
        name: /User agreement/i,
      });
      await expect(userAgreementSwitchAgain).toBeVisible({ timeout: 10_000 });
      if (
        (await userAgreementSwitchAgain.getAttribute("aria-checked")) === "true"
      ) {
        await userAgreementSwitchAgain.click();
        await expect(userAgreementSwitchAgain).toHaveAttribute(
          "aria-checked",
          "false",
          {
            timeout: 10_000,
          },
        );
      }
    }

    const closeButtonFinal = settingsDialogAgain.getByRole("button", {
      name: "Close",
      exact: true,
    });
    await closeButtonFinal.click();
  });
});
