import { test as base, expect } from '@playwright/test';
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

export type StepFn = (title: string, fn: () => unknown) => Promise<void>;

/**
 * Extended test fixture providing all mentor app page objects
 * and a step helper for structured, readable test authoring.
 *
 * Usage in journey specs:
 *   import { test, expect } from '../fixtures/mentor-test';
 *
 *   test('user with admin privileges goes to ...', async ({ chatPage }) => {
 *     await chatPage.sendMessage('hello');
 *   });
 */
export const test = base.extend<{
  step: StepFn;
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
}>({
  step: async ({}, use) => {
    await use(async (title, fn) => {
      await base.step(title, fn);
    });
  },
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
});

export { expect };
