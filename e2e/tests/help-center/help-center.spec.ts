import { test, expect, type Page, type Locator } from "@playwright/test";
import {
  checkAdminStatus,
  getCurrentPlatformName,
  selectDropdownWorksCorrectly,
} from "../utils";
import {
  navigateToMentorApp,
  openProfileDropdown,
  closeProfileModal,
} from "../profile/helpers";

const helpCenterInputPlaceholder = "Enter help center URL";

async function openOrganizationSettings(page: Page): Promise<Locator> {
  await openProfileDropdown(page);
  const platformName = await getCurrentPlatformName(page);

  const accountMenuItem = page.getByRole("menuitem", { name: platformName });
  await expect(accountMenuItem).toBeVisible({ timeout: 10000 });
  await accountMenuItem.click();

  const profileModal = page.getByRole("dialog", { name: "User Profile" });
  await expect(profileModal).toBeVisible({ timeout: 15000 });

  const organizationTab = profileModal.getByRole("button", {
    name: "Organization",
  });
  if (await organizationTab.isVisible().catch(() => false)) {
    await organizationTab.click();
  }

  await expect(
    profileModal.getByText("Help Center", { exact: true }),
  ).toBeVisible();

  return profileModal;
}

function getHelpCenterSection(modal: Locator): Locator {
  return modal
    .getByText("Help Center", { exact: true })
    .locator("..")
    .locator("..");
}

async function setHelpCenterEnabled(
  helpToggle: Locator,
  enabled: boolean,
): Promise<void> {
  const isChecked = (await helpToggle.getAttribute("aria-checked")) === "true";
  if (isChecked === enabled) {
    return;
  }

  await helpToggle.click();
  await expect(helpToggle).toHaveAttribute(
    "aria-checked",
    enabled ? "true" : "false",
  );
}

async function openProfileMenu(page: Page): Promise<Locator> {
  await openProfileDropdown(page);
  const menu = page.getByRole("menu", { name: "More options" });
  await expect(menu).toBeVisible({ timeout: 5000 });
  return menu;
}

async function expectHelpLinkVisible(
  page: Page,
  visible: boolean,
  expectedUrl?: string,
): Promise<void> {
  const profileMenu = await openProfileMenu(page);
  const helpLink = profileMenu.getByRole("link", { name: "Help" });

  if (visible) {
    await expect(helpLink).toBeVisible({ timeout: 10000 });
    if (expectedUrl) {
      const href = await helpLink.getAttribute("href");
      expect(href).toContain(expectedUrl);
    }
  } else {
    await expect(helpLink).not.toBeVisible();
  }

  await page.keyboard.press("Escape");
}

async function openEmbedPreview(page: Page): Promise<Locator> {
  await selectDropdownWorksCorrectly(page);

  const embedMenuItem = page.getByRole("menuitem", { name: "Embed" });
  await expect(embedMenuItem).toBeVisible({ timeout: 10000 });
  await embedMenuItem.click();

  const embedDialog = page
    .getByRole("dialog")
    .filter({ hasText: "Edit Mentor" });
  await expect(embedDialog).toBeVisible({ timeout: 15000 });

  const iframe = embedDialog.frameLocator("iframe");
  await expect(iframe.locator("body")).toBeVisible({ timeout: 60000 });

  return embedDialog;
}

async function expectEmbedHelpMenu(
  page: Page,
  visible: boolean,
  expectedUrl?: string,
): Promise<void> {
  const embedDialog = await openEmbedPreview(page);
  const iframe = embedDialog.frameLocator("iframe");

  const menuButton = iframe.getByRole("button", {
    name: /Open (menu options|settings menu)/i,
  });
  await expect(menuButton).toBeVisible({ timeout: 15000 });
  await menuButton.click();

  const helpMenuItem = iframe.getByRole("menuitem", { name: "Help" });
  if (visible) {
    await expect(helpMenuItem).toBeVisible({ timeout: 10000 });
    if (expectedUrl) {
      const [newTab] = await Promise.all([
        page.context().waitForEvent("page", { timeout: 15000 }),
        helpMenuItem.click(),
      ]);
      // Check URL immediately before navigation completes - this avoids
      // chrome-error://chromewebdata/ when the target URL doesn't exist
      const tabUrl = newTab.url();
      expect(tabUrl).toContain(expectedUrl);
      await newTab.close();
    }
  } else {
    await expect(helpMenuItem).not.toBeVisible();
  }

  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  const closeButton = embedDialog.getByRole("button", { name: "Close" });
  await expect(closeButton).toBeVisible({ timeout: 10000 });
  await closeButton.click();
  await expect(embedDialog).not.toBeVisible({ timeout: 10000 });
}

function stripProtocol(rawUrl: string): string {
  return rawUrl.replace(/^https?:\/\//, "");
}
test.describe("Help Center settings", () => {
  // serial mode prevents parallel browsers from clobbering shared tenant metadata
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  test("help center toggle controls dropdown and embed visibility", async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Admin access required for organization settings");

    const profileModal = await openOrganizationSettings(page);
    const helpSection = getHelpCenterSection(profileModal);
    const helpToggle = helpSection.getByRole("switch", {
      name: "Toggle Help Center visibility",
    });
    await expect(helpToggle).toBeVisible();

    const wasEnabled =
      (await helpToggle.getAttribute("aria-checked")) === "true";

    await setHelpCenterEnabled(helpToggle, false);
    await closeProfileModal(page);
    await expectHelpLinkVisible(page, false);
    await expectEmbedHelpMenu(page, false);

    const reopenModal = await openOrganizationSettings(page);
    const reopenSection = getHelpCenterSection(reopenModal);
    const reopenToggle = reopenSection.getByRole("switch", {
      name: "Toggle Help Center visibility",
    });
    await setHelpCenterEnabled(reopenToggle, true);
    await closeProfileModal(page);
    await expectHelpLinkVisible(page, true);
    await expectEmbedHelpMenu(page, true);

    if (!wasEnabled) {
      const restoreModal = await openOrganizationSettings(page);
      const restoreSection = getHelpCenterSection(restoreModal);
      const restoreToggle = restoreSection.getByRole("switch", {
        name: "Toggle Help Center visibility",
      });
      await setHelpCenterEnabled(restoreToggle, false);
      await closeProfileModal(page);
    }
  });

  test("help center url updates in dropdown and embed menu", async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Admin access required for organization settings");

    const profileModal = await openOrganizationSettings(page);
    const helpSection = getHelpCenterSection(profileModal);
    const helpToggle = helpSection.getByRole("switch", {
      name: "Toggle Help Center visibility",
    });
    await setHelpCenterEnabled(helpToggle, true);

    const editButton = helpSection.getByRole("button").first();
    await expect(editButton).toBeVisible({ timeout: 10000 });
    await editButton.click();

    const helpInput = helpSection.getByPlaceholder(helpCenterInputPlaceholder);
    await expect(helpInput).toBeVisible({ timeout: 5000 });

    const previousHelpUrl = await helpInput.inputValue();
    const newHelpUrl = ["google.com", "ibl.ai", "wikipedia.org"][
      Math.floor(Math.random() * 3)
    ];

    await helpInput.fill(newHelpUrl);
    const saveButton = helpSection.getByRole("button", { name: "Save" });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    await expect(helpInput).not.toBeVisible({ timeout: 10000 });
    await expect(
      helpSection.getByText(stripProtocol(newHelpUrl), { exact: true }),
    ).toBeVisible();

    await closeProfileModal(page);

    await expectHelpLinkVisible(page, true, newHelpUrl);
    await expectEmbedHelpMenu(page, true, newHelpUrl);

    const restoreModal = await openOrganizationSettings(page);
    const restoreSection = getHelpCenterSection(restoreModal);
    const restoreEditButton = restoreSection.getByRole("button").first();
    await restoreEditButton.click();

    const restoreInput = restoreSection.getByPlaceholder(
      helpCenterInputPlaceholder,
    );
    await expect(restoreInput).toBeVisible({ timeout: 5000 });
    await restoreInput.fill(previousHelpUrl);

    const restoreSaveButton = restoreSection.getByRole("button", {
      name: "Save",
    });
    await expect(restoreSaveButton).toBeEnabled();
    await restoreSaveButton.click();

    await closeProfileModal(page);
  });
});
