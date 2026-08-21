import { test as base, expect } from '@playwright/test';
import path from 'path';
import { ChatPage } from '../page-objects/chat.page';
import { SidebarPage } from '../page-objects/sidebar.page';
import { NavbarPage } from '../page-objects/navbar.page';
import { ExplorePage } from '../page-objects/explore.page';
import { EditMentorPage } from '../page-objects/edit-mentor/edit-mentor.page';
import { AnalyticsPage } from '../page-objects/analytics.page';
import { ProfilePage } from '../page-objects/profile.page';
import { ProjectPage } from '../page-objects/project.page';
import { NotificationsPage } from '../page-objects/notifications.page';
import { BillingPage } from '../page-objects/billing.page';
import { MemoryAdminPage } from '../page-objects/memory-admin.page';
import { CreateMentorPage } from '../page-objects/create-mentor.page';
import { ChatSearchDialogPage } from '../page-objects/chat-search-dialog.pom';
import { generateProjectName } from './test-data';
import {
  findProjectIdByName,
  deleteProjectById,
  deleteProjectByName,
} from '../utils/project-cleanup';

export type StepFn = (title: string, fn: () => unknown) => Promise<void>;

/**
 * A project created fresh for a single test by the `testProject` fixture.
 * `id` is the numeric project id captured immediately after creation (via
 * an API lookup by name) — it is used for teardown so that deletion still
 * works even if the test renames the project. `id` can be `null` if the
 * lookup failed (e.g. missing auth context); teardown falls back to a
 * name-based lookup in that case.
 */
export interface TestProject {
  name: string;
  id: string | null;
}

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
  createMentorPage: CreateMentorPage;
  chatSearchDialogPage: ChatSearchDialogPage;
  analyticsPage: AnalyticsPage;
  profilePage: ProfilePage;
  projectPage: ProjectPage;
  notificationsPage: NotificationsPage;
  billingPage: BillingPage;
  /**
   * Tenant-settings Memory admin tab (`MemoryAdminTab`), reached from the
   * "User Profile" dialog's tenant-settings rail — admin-only, so there is
   * no `nonadminMemoryAdminPage` counterpart.
   */
  memoryAdminPage: MemoryAdminPage;
  /**
   * Creates a uniquely-named project (via the projects index "New Project"
   * UI flow, matching how a real admin creates one) before the test runs,
   * and deletes it via the DM API after — regardless of whether the test
   * passed, failed, or renamed/deleted the project itself (API delete is
   * idempotent; see utils/project-cleanup.ts).
   *
   * Requires the page to already be authenticated and navigated into the
   * app (i.e. call `navigateToMentorApp` in `beforeEach` first) — the
   * fixture does not navigate on its own.
   *
   * Tests that are specifically exercising the CREATE flow itself should
   * not use this fixture (it would create a redundant project) — see the
   * dedicated "creates a new project" test in 26-projects.spec.ts for the
   * pattern used there instead (manual describe-scoped cleanup).
   */
  testProject: TestProject;
  // ── Non-admin page + page objects ──────────────────────────────────────────
  nonadminPage: import('@playwright/test').Page;
  nonadminChatPage: ChatPage;
  nonadminSidebarPage: SidebarPage;
  nonadminNavbarPage: NavbarPage;
  nonadminExplorePage: ExplorePage;
  nonadminEditMentorPage: EditMentorPage;
  nonadminCreateMentorPage: CreateMentorPage;
  nonadminChatSearchDialogPage: ChatSearchDialogPage;
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
  createMentorPage: async ({ page }, use) => {
    await use(new CreateMentorPage(page));
  },
  chatSearchDialogPage: async ({ page }, use) => {
    await use(new ChatSearchDialogPage(page));
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
  memoryAdminPage: async ({ page }, use) => {
    await use(new MemoryAdminPage(page));
  },
  testProject: async ({ page, projectPage }, use) => {
    const name = generateProjectName();
    await projectPage.createFromSidebar(name);
    const id = await findProjectIdByName(page, name);

    await use({ name, id });

    // Teardown — runs even if the test failed or threw, per Playwright
    // fixture semantics (equivalent to a try/finally around the test body).
    if (id) {
      await deleteProjectById(page, id);
    } else {
      // Lookup failed at setup time (e.g. transient auth/read-after-write
      // race) — fall back to a fresh name-based lookup. If the test
      // renamed the project, this will not find it and cleanup is skipped;
      // the global janitor pattern used for mentors does not exist for
      // projects, so a renamed project without a captured id can leak. In
      // practice `findProjectIdByName` retries 3x at setup, making this
      // fallback path rare.
      await deleteProjectByName(page, name);
    }
  },

  // ── Non-admin page (separate browser context with non-admin storageState) ──
  nonadminPage: async ({ browser }, use, testInfo) => {
    const browserKey = testInfo.project.name
      .replace('mentor-desktop-', '')
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
  nonadminCreateMentorPage: async ({ nonadminPage }, use) => {
    await use(new CreateMentorPage(nonadminPage));
  },
  nonadminChatSearchDialogPage: async ({ nonadminPage }, use) => {
    await use(new ChatSearchDialogPage(nonadminPage));
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
