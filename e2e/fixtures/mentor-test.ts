import { test as base, expect } from "@playwright/test";
import path from "path";
import { ChatPage } from "../page-objects/chat.page";
import { SidebarPage } from "../page-objects/sidebar.page";
import { NavbarPage } from "../page-objects/navbar.page";
import { ExplorePage } from "../page-objects/explore.page";
import { EditMentorPage } from "../page-objects/edit-mentor/edit-mentor.page";
import { AnalyticsPage } from "../page-objects/analytics.page";
import { ProfilePage } from "../page-objects/profile.page";
import { ProjectPage } from "../page-objects/project.page";
import { NotificationsPage } from "../page-objects/notifications.page";
import { BillingPage } from "../page-objects/billing.page";

export type StepFn = (title: string, fn: () => unknown) => Promise<void>;

/**
 * Extended test fixture providing all mentor app page objects for both
 * admin (default `page`) and non-admin (`nonadminPage`) browser contexts.
 *
 * The default `page` inherits the project's admin storageState.
 * The `nonadminPage` creates a separate browser context loaded with
 * the per-browser non-admin storageState file.
 *
 * Usage in journey specs:
 *   import { test, expect } from '../fixtures/mentor-test';
 *
 *   // Admin tests use the default page fixtures:
 *   test('admin goes to ...', async ({ chatPage }) => { ... });
 *
 *   // Non-admin tests use the nonadmin fixtures:
 *   test('non-admin goes to ...', async ({ nonadminChatPage }) => { ... });
 */
export const test = base.extend<{
  step: StepFn;
  // ── Admin page objects (default storageState) ──────────────────────────────
  chatPage: ChatPage;
  sidebarPage: SidebarPage;
  navbarPage: NavbarPage;
  explorePage: ExplorePage;
  editMentorPage: EditMentorPage;
  analyticsPage: AnalyticsPage;
  profilePage: ProfilePage;
  projectPage: ProjectPage;
  notificationsPage: NotificationsPage;
  billingPage: BillingPage;
  // ── Non-admin page + page objects ──────────────────────────────────────────
  nonadminPage: import("@playwright/test").Page;
  nonadminChatPage: ChatPage;
  nonadminSidebarPage: SidebarPage;
  nonadminNavbarPage: NavbarPage;
  nonadminExplorePage: ExplorePage;
  nonadminEditMentorPage: EditMentorPage;
  nonadminAnalyticsPage: AnalyticsPage;
  nonadminProfilePage: ProfilePage;
  nonadminProjectPage: ProjectPage;
  nonadminNotificationsPage: NotificationsPage;
  nonadminBillingPage: BillingPage;
}>({
  step: async ({}, use) => {
    await use(async (title, fn) => {
      await base.step(title, fn);
    });
  },

  // ── Admin page objects ─────────────────────────────────────────────────────
  chatPage: async ({ page }, use) => {
    await use(new ChatPage(page));
  },
  sidebarPage: async ({ page }, use) => {
    await use(new SidebarPage(page));
  },
  navbarPage: async ({ page }, use) => {
    await use(new NavbarPage(page));
  },
  explorePage: async ({ page }, use) => {
    await use(new ExplorePage(page));
  },
  editMentorPage: async ({ page }, use) => {
    await use(new EditMentorPage(page));
  },
  analyticsPage: async ({ page }, use) => {
    await use(new AnalyticsPage(page));
  },
  profilePage: async ({ page }, use) => {
    await use(new ProfilePage(page));
  },
  projectPage: async ({ page }, use) => {
    await use(new ProjectPage(page));
  },
  notificationsPage: async ({ page }, use) => {
    await use(new NotificationsPage(page));
  },
  billingPage: async ({ page }, use) => {
    await use(new BillingPage(page));
  },

  // ── Non-admin page (separate browser context with non-admin storageState) ──
  nonadminPage: async ({ browser }, use, testInfo) => {
    const browserKey = testInfo.project.name
      .replace("mentor-desktop-", "")
      .toLowerCase();
    const authFile = path.join(
      __dirname,
      `../../playwright/.auth/nonadmin-${browserKey}.json`,
    );
    const context = await browser.newContext({ storageState: authFile });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  // ── Non-admin page objects ─────────────────────────────────────────────────
  nonadminChatPage: async ({ nonadminPage }, use) => {
    await use(new ChatPage(nonadminPage));
  },
  nonadminSidebarPage: async ({ nonadminPage }, use) => {
    await use(new SidebarPage(nonadminPage));
  },
  nonadminNavbarPage: async ({ nonadminPage }, use) => {
    await use(new NavbarPage(nonadminPage));
  },
  nonadminExplorePage: async ({ nonadminPage }, use) => {
    await use(new ExplorePage(nonadminPage));
  },
  nonadminEditMentorPage: async ({ nonadminPage }, use) => {
    await use(new EditMentorPage(nonadminPage));
  },
  nonadminAnalyticsPage: async ({ nonadminPage }, use) => {
    await use(new AnalyticsPage(nonadminPage));
  },
  nonadminProfilePage: async ({ nonadminPage }, use) => {
    await use(new ProfilePage(nonadminPage));
  },
  nonadminProjectPage: async ({ nonadminPage }, use) => {
    await use(new ProjectPage(nonadminPage));
  },
  nonadminNotificationsPage: async ({ nonadminPage }, use) => {
    await use(new NotificationsPage(nonadminPage));
  },
  nonadminBillingPage: async ({ nonadminPage }, use) => {
    await use(new BillingPage(nonadminPage));
  },
});

export { expect };
