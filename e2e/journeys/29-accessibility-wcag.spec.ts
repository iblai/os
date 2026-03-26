import { test, expect } from "../fixtures/mentor-test";
import { navigateToMentorApp, checkAdminStatus } from "../utils/auth";
import { waitForPageReady } from "../utils/resilient";
import AxeBuilder from "@axe-core/playwright";

async function expectNoViolations(
  page: import("@playwright/test").Page,
  selector?: string,
) {
  const builder = new AxeBuilder({ page });
  if (selector) builder.include(selector);
  const { violations } = await builder.analyze();
  expect(violations).toEqual([]);
}

async function openEditMentorTab(
  page: import("@playwright/test").Page,
  editMentorPage: import("../page-objects/edit-mentor/edit-mentor.page").EditMentorPage,
  tabName: string,
) {
  if (await editMentorPage.isOpen()) {
    await editMentorPage.navigateToTab(tabName);
  } else {
    await editMentorPage.open(tabName);
  }
  await waitForPageReady(page);
}

test.describe("Journey 29: Accessibility — WCAG 2.1 AA — Non-Admin", () => {
  test.beforeEach(async ({ nonadminPage }) => {
    await navigateToMentorApp(nonadminPage);
  });

  test("non-admin goes to homepage and it has no accessibility violations", async ({
    nonadminPage,
  }) => {
    // fixme: The homepage currently has accessibility violations that are app-level issues
    test.fixme();
    const mentorButton = nonadminPage
      .getByRole("button", { name: "Mentors", exact: true })
      .or(nonadminPage.getByRole("button", { name: /explore/i }));
    await expect(mentorButton).toBeVisible({ timeout: 120_000 });
    await expectNoViolations(nonadminPage);
  });

  test("non-admin goes to explore page and the mentors catalog has no accessibility violations", async ({
    nonadminPage,
    nonadminSidebarPage,
  }) => {
    await nonadminSidebarPage.navigateToExplore();
    await expect(
      nonadminPage.getByRole("heading", { name: /all mentors/i }),
    ).toBeVisible({ timeout: 15_000 });
    await expectNoViolations(nonadminPage);
  });

  // fixme: real accessibility violations in the app — not test bugs
  test.fixme(
    "non-admin goes to My Mentors dialog and it meets accessibility guidelines",
    async ({ nonadminPage, nonadminNavbarPage }) => {
      await nonadminNavbarPage.openMyMentors();
      await nonadminPage.waitForTimeout(1_000);
      await expectNoViolations(nonadminPage, '[role="dialog"]');
      await nonadminPage.keyboard.press("Escape");
    },
  );
});

test.describe("Journey 29: Accessibility — WCAG 2.1 AA — Admin", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  test("admin goes to Create Mentor modal and it meets accessibility guidelines", async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Requires admin access");
    const newMentorBtn = page.getByRole("button", {
      name: "New Mentor",
      exact: true,
    });
    if (await newMentorBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await newMentorBtn.click();
      await page.waitForTimeout(1_000);
      await expectNoViolations(page, '[role="dialog"]');
      await page.keyboard.press("Escape");
    }
  });

  test("admin goes to Invite Users modal and it meets accessibility guidelines", async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Requires admin access");
    const inviteBtn = page.getByRole("button", {
      name: "Invite Users",
      exact: true,
    });
    if (await inviteBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await inviteBtn.click();
      await page.waitForTimeout(1_000);
      await expectNoViolations(page, '[role="dialog"]');
      await page.keyboard.press("Escape");
    }
  });

  // fixme: real accessibility violations in the app — not test bugs
  test.fixme(
    "admin goes to Settings modal and it meets accessibility guidelines",
    async ({ page }) => {
      const isAdmin = await checkAdminStatus(page);
      test.skip(!isAdmin, "Requires admin access");
      const settingsBtn = page.getByRole("button", {
        name: "Settings",
        exact: true,
      });
      if (await settingsBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await settingsBtn.click();
        await page.waitForTimeout(1_000);
        await expectNoViolations(page, '[role="dialog"]');
        await page.keyboard.press("Escape");
      }
    },
  );

  // fixme: WCAG violations — buttons without discernible text in Embed dialog
  test.fixme(
    "admin goes to Embed dialog and it is accessible",
    async ({ page, editMentorPage }) => {
      const isAdmin = await checkAdminStatus(page);
      test.skip(!isAdmin, "Requires admin access");
      await openEditMentorTab(page, editMentorPage, "Embed");
      await expectNoViolations(page, '[role="dialog"]');
      await editMentorPage.close();
    },
  );

  test("admin goes to Dataset dialog and it is accessible", async ({
    page,
    editMentorPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Requires admin access");
    await openEditMentorTab(page, editMentorPage, "Datasets");
    await expectNoViolations(page, '[role="dialog"]');
    await editMentorPage.close();
  });

  test("admin goes to Mentor Settings dialog and it is accessible", async ({
    page,
    editMentorPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Requires admin access");
    await openEditMentorTab(page, editMentorPage, "Settings");
    await expectNoViolations(page, '[role="dialog"]');
    await editMentorPage.close();
  });

  test("admin goes to LLM provider dialog and it is accessible", async ({
    page,
    editMentorPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Requires admin access");
    await openEditMentorTab(page, editMentorPage, "LLM");
    await expectNoViolations(page, '[role="dialog"]');
    await editMentorPage.close();
  });

  test("admin goes to Prompts dialog and it is accessible", async ({
    page,
    editMentorPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Requires admin access");
    await openEditMentorTab(page, editMentorPage, "Prompts");
    await expectNoViolations(page, '[role="dialog"]');
    await editMentorPage.close();
  });

  test("admin goes to Tools dialog and it is accessible", async ({
    page,
    editMentorPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Requires admin access");
    await openEditMentorTab(page, editMentorPage, "Tools");
    await expectNoViolations(page, '[role="dialog"]');
    await editMentorPage.close();
  });

  test("admin goes to Add Resources dialog and it is accessible", async ({
    page,
    editMentorPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Requires admin access");
    await openEditMentorTab(page, editMentorPage, "Datasets");
    await editMentorPage.datasets.openAddResourceModal();
    await expectNoViolations(page, '[role="dialog"]');
    await page.keyboard.press("Escape");
    await editMentorPage.close();
  });

  test("admin goes to History dialog and it is accessible", async ({
    page,
    editMentorPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Requires admin access");
    await openEditMentorTab(page, editMentorPage, "History");
    await expectNoViolations(page, '[role="dialog"]');
    await editMentorPage.close();
  });

  // fixme: WCAG violations — scrollable regions without keyboard access in Safety dialog
  test.fixme(
    "admin goes to Safety dialog and it is accessible",
    async ({ page, editMentorPage }) => {
      const isAdmin = await checkAdminStatus(page);
      test.skip(!isAdmin, "Requires admin access");
      await openEditMentorTab(page, editMentorPage, "Safety");
      await expectNoViolations(page, '[role="dialog"]');
      await editMentorPage.close();
    },
  );

  test("admin goes to API key dialog and it is accessible", async ({
    page,
    editMentorPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Requires admin access");
    await openEditMentorTab(page, editMentorPage, "API");
    await expectNoViolations(page, '[role="dialog"]');
    await editMentorPage.close();
  });
});
