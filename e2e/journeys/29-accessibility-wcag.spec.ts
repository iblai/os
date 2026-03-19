import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import AxeBuilder from '@axe-core/playwright';

async function expectNoViolations(page: import('@playwright/test').Page, selector?: string) {
  const builder = new AxeBuilder({ page });
  if (selector) builder.include(selector);
  const { violations } = await builder.analyze();
  expect(violations).toEqual([]);
}

async function openEditMentorTab(
  page: import('@playwright/test').Page,
  editMentorPage: import('../page-objects/edit-mentor/edit-mentor.page').EditMentorPage,
  tabName: string,
) {
  if (await editMentorPage.isOpen()) {
    await editMentorPage.navigateToTab(tabName);
  } else {
    await editMentorPage.open(tabName);
  }
  await waitForPageReady(page);
}

test.describe('Journey 29: Accessibility — WCAG 2.1 AA', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  test('authenticated user goes to homepage and it has no accessibility violations', async ({ page }) => {
    await expectNoViolations(page);
  });

  test('authenticated user goes to explore page and the mentors catalog has no accessibility violations', async ({
    page,
    sidebarPage,
  }) => {
    await sidebarPage.navigateToExplore();
    await page.waitForTimeout(2_000);
    await expectNoViolations(page);
  });

  test('admin goes to Create Mentor modal and it meets accessibility guidelines', async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Requires admin access');
    const newMentorBtn = page.getByRole('button', { name: 'New Mentor', exact: true });
    if (await newMentorBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await newMentorBtn.click();
      await page.waitForTimeout(1_000);
      await expectNoViolations(page, '[role="dialog"]');
      await page.keyboard.press('Escape');
    }
  });

  test('admin goes to Invite Users modal and it meets accessibility guidelines', async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Requires admin access');
    const inviteBtn = page.getByRole('button', { name: 'Invite Users', exact: true });
    if (await inviteBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await inviteBtn.click();
      await page.waitForTimeout(1_000);
      await expectNoViolations(page, '[role="dialog"]');
      await page.keyboard.press('Escape');
    }
  });

  test('admin goes to Settings modal and it meets accessibility guidelines', async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Requires admin access');
    const settingsBtn = page.getByRole('button', { name: 'Settings', exact: true });
    if (await settingsBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await settingsBtn.click();
      await page.waitForTimeout(1_000);
      await expectNoViolations(page, '[role="dialog"]');
      await page.keyboard.press('Escape');
    }
  });

  test('authenticated user goes to My Mentors dialog and it meets accessibility guidelines', async ({
    page,
    navbarPage,
  }) => {
    await navbarPage.openMyMentors();
    await page.waitForTimeout(1_000);
    await expectNoViolations(page, '[role="dialog"]');
    await page.keyboard.press('Escape');
  });

  test('admin goes to Embed dialog and it is accessible', async ({
    page,
    editMentorPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Requires admin access');
    await openEditMentorTab(page, editMentorPage, 'Embed');
    await expectNoViolations(page, '[role="dialog"]');
    await editMentorPage.close();
  });

  test('admin goes to Dataset dialog and it is accessible', async ({
    page,
    editMentorPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Requires admin access');
    await openEditMentorTab(page, editMentorPage, 'Datasets');
    await expectNoViolations(page, '[role="dialog"]');
    await editMentorPage.close();
  });

  test('admin goes to Mentor Settings dialog and it is accessible', async ({
    page,
    editMentorPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Requires admin access');
    await openEditMentorTab(page, editMentorPage, 'Settings');
    await expectNoViolations(page, '[role="dialog"]');
    await editMentorPage.close();
  });

  test('admin goes to LLM provider dialog and it is accessible', async ({
    page,
    editMentorPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Requires admin access');
    await openEditMentorTab(page, editMentorPage, 'LLM');
    await expectNoViolations(page, '[role="dialog"]');
    await editMentorPage.close();
  });

  test('admin goes to Prompts dialog and it is accessible', async ({
    page,
    editMentorPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Requires admin access');
    await openEditMentorTab(page, editMentorPage, 'Prompts');
    await expectNoViolations(page, '[role="dialog"]');
    await editMentorPage.close();
  });

  test('admin goes to Tools dialog and it is accessible', async ({
    page,
    editMentorPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Requires admin access');
    await openEditMentorTab(page, editMentorPage, 'Tools');
    await expectNoViolations(page, '[role="dialog"]');
    await editMentorPage.close();
  });

  test('admin goes to Add Resources dialog and it is accessible', async ({
    page,
    editMentorPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Requires admin access');
    await openEditMentorTab(page, editMentorPage, 'Datasets');
    await editMentorPage.datasets.openAddResourceModal();
    await expectNoViolations(page, '[role="dialog"]');
    await page.keyboard.press('Escape');
    await editMentorPage.close();
  });

  test('admin goes to History dialog and it is accessible', async ({
    page,
    editMentorPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Requires admin access');
    await openEditMentorTab(page, editMentorPage, 'History');
    await expectNoViolations(page, '[role="dialog"]');
    await editMentorPage.close();
  });

  test('admin goes to Safety dialog and it is accessible', async ({
    page,
    editMentorPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Requires admin access');
    await openEditMentorTab(page, editMentorPage, 'Safety');
    await expectNoViolations(page, '[role="dialog"]');
    await editMentorPage.close();
  });

  test('admin goes to API key dialog and it is accessible', async ({
    page,
    editMentorPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Requires admin access');
    await openEditMentorTab(page, editMentorPage, 'API');
    await expectNoViolations(page, '[role="dialog"]');
    await editMentorPage.close();
  });
});
