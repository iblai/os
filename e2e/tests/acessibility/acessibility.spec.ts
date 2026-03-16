import { test, expect } from '@playwright/test';
import { MENTOR_NEXTJS_HOST } from '../utils';
import {
  expectNoAccessibilityViolations,
  expectNoAccessibilityViolationsOnDialogs,
} from '../utils';
import { navigateToMentorApp } from '../profile/helpers';
import { safeWaitForURL } from '@iblai/iblai-js/playwright';

// Suite: Runs accessibility checks across high-traffic mentor workflows.
test.describe('IBL AI Mentor Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  test.describe('Primary navigation accessibility', () => {
    test('ensures homepage has no accessibility violations', async ({
      page,
    }) => {
      const mentorButton = page.getByRole('button', {
        name: 'Mentors',
        exact: true,
      });
      await expect(mentorButton).toBeVisible({ timeout: 120_000 });
      await expectNoAccessibilityViolations(page);
    });

    test('ensures mentors catalog has no accessibility violations', async ({
      page,
    }) => {
      const mentorsButton = page.getByRole('button', {
        name: 'Mentors',
        exact: true,
      });
      await expect(mentorsButton).toBeVisible({ timeout: 60000 });
      await mentorsButton.click();

      await safeWaitForURL(page, (url) => url.pathname.endsWith('/explore'), {
        timeout: 60000,
      });
      // Wait for the All Mentors heading to be visible
      await expect(
        page.getByRole('heading', { name: 'All Mentors' })
      ).toBeVisible({ timeout: 120_000 });
      await page.waitForTimeout(1000);
      await expectNoAccessibilityViolations(page);
    });

    test('ensures create mentor modal meets accessibility guidelines', async ({
      page,
    }) => {
      const newMentorBtn = page.getByRole('button', { name: 'New Mentor' });
      await expect(newMentorBtn).toBeVisible({ timeout: 10000 });
      await newMentorBtn.click();
      const createMentorDialog = page
        .getByRole('dialog')
        .filter({ hasText: 'Create Mentor' });
      await expect(createMentorDialog).toBeVisible();

      await expectNoAccessibilityViolationsOnDialogs(page);
    });

    test('ensures invite users modal meets accessibility guidelines', async ({
      page,
    }) => {
      const inviteUser = page.getByRole('button', { name: 'Invite Users' });
      await expect(inviteUser).toBeVisible();
      await inviteUser.click();
      await safeWaitForURL(
        page,
        (url: URL) => url.href.startsWith(`${MENTOR_NEXTJS_HOST}/platform`),
        { timeout: 60000 }
      );

      const inviteUsersDialog = page
        .getByRole('dialog')
        .filter({ hasText: 'Invite Users' });
      await expect(inviteUsersDialog).toBeVisible({ timeout: 10000 });

      await expectNoAccessibilityViolationsOnDialogs(page);
    });

    test('ensures settings modal meets accessibility guidelines', async ({
      page,
    }) => {
      const settingsBtn = page.getByRole('button', { name: 'Settings' });
      await expect(settingsBtn).toBeVisible({ timeout: 15000 });
      await settingsBtn.click();
      await safeWaitForURL(
        page,
        (url: URL) => url.href.startsWith(`${MENTOR_NEXTJS_HOST}/platform`),
        { timeout: 60000 }
      );
      const settingsDialog = page
        .getByRole('dialog')
        .filter({ hasText: 'Settings' });
      await expect(settingsDialog).toBeVisible();

      await expectNoAccessibilityViolationsOnDialogs(page);
    });
  });

  test.describe('Sidebar modal accessibility', () => {
    test('ensures My Mentors dialog meets accessibility guidelines', async ({
      page,
    }) => {
      const myMentorBtn = page.getByRole('button', { name: 'My Mentors' });
      await expect(myMentorBtn).toBeVisible({ timeout: 10000 });
      await myMentorBtn.click();

      await expect(
        page.getByRole('dialog').filter({ hasText: 'My Mentors' })
      ).toBeVisible();
      await expectNoAccessibilityViolationsOnDialogs(page);
    });
  });

  test.describe('Mentor dropdown modal accessibility', () => {
    test('ensures embed dialog is accessible', async ({ page }) => {
      await page
        .locator('button[aria-label="Selected mentor dropdown button"]')
        .click();
      await expect(
        page.getByRole('menuitem', { name: 'New chat' })
      ).toBeVisible();
      const embedMenuBtn = page.getByRole('menuitem', { name: 'Embed' });
      await expect(embedMenuBtn).toBeVisible({ timeout: 10000 });
      await embedMenuBtn.click();
      const embedDialog = page
        .getByRole('dialog')
        .filter({ hasText: 'Edit Mentor' });
      await expect(embedDialog).toBeVisible({ timeout: 10_000 });

      await expectNoAccessibilityViolationsOnDialogs(page);
    });

    test('ensures dataset dialog is accessible', async ({ page }) => {
      await page
        .locator('button[aria-label="Selected mentor dropdown button"]')
        .click();
      await expect(
        page.getByRole('menuitem', { name: 'New chat' })
      ).toBeVisible();
      await page.getByRole('menuitem', { name: 'Dataset' }).click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      const datasetDialog = page
        .getByRole('dialog')
        .filter({ hasText: 'Edit Mentor' });
      await expect(datasetDialog).toBeVisible();
      await expectNoAccessibilityViolationsOnDialogs(page);
    });

    test('ensures mentor settings dialog is accessible', async ({ page }) => {
      await page
        .locator('button[aria-label="Selected mentor dropdown button"]')
        .click();
      await expect(
        page.getByRole('menuitem', { name: 'New chat' })
      ).toBeVisible();
      await page.getByRole('menuitem', { name: 'Settings' }).click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      const settingsDialog = page
        .getByRole('dialog')
        .filter({ hasText: 'Edit Mentor' });
      await expect(settingsDialog).toBeVisible();

      await expectNoAccessibilityViolationsOnDialogs(page);
    });

    test('ensures LLM provider dialog is accessible', async ({ page }) => {
      await expect(
        page.locator('button[aria-label="Selected mentor dropdown button"]')
      ).toBeVisible({ timeout: 5000 });
      await page
        .locator('button[aria-label="Selected mentor dropdown button"]')
        .click();
      await expect(
        page.getByRole('menuitem', { name: 'New chat' })
      ).toBeVisible();
      await page.getByRole('menuitem', { name: 'LLM' }).click();
      await expect(
        page.getByRole('dialog').filter({ hasText: 'Edit Mentor' })
      ).toBeVisible();
      await expectNoAccessibilityViolationsOnDialogs(page);
    });

    test('ensures prompts dialog is accessible', async ({ page }) => {
      await page
        .locator('button[aria-label="Selected mentor dropdown button"]')
        .click();
      await expect(
        page.getByRole('menuitem', { name: 'New chat' })
      ).toBeVisible();
      await page.getByRole('menuitem', { name: 'Prompts' }).click();
      await expect(
        page.getByRole('dialog').filter({ hasText: 'Edit Mentor' })
      ).toBeVisible();
      await expectNoAccessibilityViolationsOnDialogs(page);
    });

    test('ensures tools dialog is accessible', async ({ page }) => {
      await page
        .locator('button[aria-label="Selected mentor dropdown button"]')
        .click();
      await expect(
        page.getByRole('menuitem', { name: 'New chat' })
      ).toBeVisible();
      await page.getByRole('menuitem', { name: 'Tools' }).click();
      await expect(
        page.getByRole('dialog').filter({ hasText: 'Edit Mentor' })
      ).toBeVisible();
      await expectNoAccessibilityViolationsOnDialogs(page);
    });

    test('ensures add resources dialog is accessible', async ({ page }) => {
      await page
        .locator('button[aria-label="Selected mentor dropdown button"]')
        .click({ force: true });
      await expect(
        page.getByRole('menuitem', { name: 'New chat' })
      ).toBeVisible();
      const datasetMenuBtn = page.getByRole('menuitem', { name: 'Dataset' });
      await expect(datasetMenuBtn).toBeVisible({ timeout: 10000 });
      await datasetMenuBtn.click({ force: true });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      const datasetDialog = page
        .getByRole('dialog')
        .filter({ hasText: 'Edit Mentor' });
      await datasetDialog.getByRole('button', { name: 'Add Resource' }).click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      await expect(
        page.getByRole('dialog').filter({ hasText: 'Add Resources' })
      ).toBeVisible();
      await expectNoAccessibilityViolationsOnDialogs(page);
    });

    test('ensures history dialog is accessible', async ({ page }) => {
      await page
        .locator('button[aria-label="Selected mentor dropdown button"]')
        .click();
      await expect(
        page.getByRole('menuitem', { name: 'New chat' })
      ).toBeVisible();
      await page
        .getByRole('menuitem', { name: 'History' })
        .click({ force: true });
      await expect(
        page.getByRole('dialog').filter({ hasText: 'Edit Mentor' })
      ).toBeVisible({ timeout: 10000 });
      await expectNoAccessibilityViolationsOnDialogs(page);
    });

    test('ensures safety dialog is accessible', async ({ page }) => {
      await page
        .locator('button[aria-label="Selected mentor dropdown button"]')
        .click();
      await expect(
        page.getByRole('menuitem', { name: 'New chat' })
      ).toBeVisible();
      const safetyMenuBtn = page.getByRole('menuitem', { name: 'Safety' });
      await expect(safetyMenuBtn).toBeVisible({ timeout: 10000 });
      await safetyMenuBtn.click({ force: true });
      await expect(
        page.getByRole('dialog').filter({ hasText: 'Edit Mentor' })
      ).toBeVisible();
      await expectNoAccessibilityViolationsOnDialogs(page);
    });

    test('ensures API key dialog is accessible', async ({ page }) => {
      await page
        .locator('button[aria-label="Selected mentor dropdown button"]')
        .click();
      await expect(
        page.getByRole('menuitem', { name: 'New chat' })
      ).toBeVisible();
      await page.getByRole('menuitem', { name: 'API' }).click();
      await expect(
        page.getByRole('dialog').filter({ hasText: 'Edit Mentor' })
      ).toBeVisible();
      await expectNoAccessibilityViolationsOnDialogs(page);
    });
  });

  // test.describe('Mentor Tools Tab', () => {
  //   test.setTimeout(200000);
  //   test.beforeEach(async ({ page }) => {
  //     await page.goto(MENTOR_NEXTJS_HOST);
  //     await page.waitForTimeout(10000);
  //   });

  //   test('Accessibility test on the mentors page after deleting a mentor', async ({
  //     page,
  //   }) => {
  //     await fillCreateMentorForm({ page });

  //     await page
  //       .locator('button[aria-label="Selected mentor dropdown button"]')
  //       .click();
  //     await expect(
  //       page.getByRole('menuitem', { name: 'New chat' })
  //     ).toBeVisible();
  //     await page.getByRole('menuitem', { name: 'Settings' }).click();
  //     await page.waitForLoadState('domcontentloaded');
  //     await page.waitForTimeout(1000);
  //     const settingsDialog = page
  //       .getByRole('dialog')
  //       .filter({ hasText: 'Edit Mentor' });
  //     await expect(settingsDialog).toBeVisible();

  //     await settingsDialog.getByRole('button', { name: 'Delete' }).click();
  //     await page.waitForTimeout(1000);
  //     await expect(
  //       page.getByRole('alertdialog').filter({ hasText: 'Delete Mentor' })
  //     ).toBeVisible();
  //     const deleteBtn = page
  //       .getByRole('alertdialog')
  //       .filter({ hasText: 'Delete Mentor' });
  //     await expect(deleteBtn).toBeVisible();
  //     await deleteBtn.getByRole('button', { name: 'Delete' }).click();
  //     await page.waitForURL((url) => url.pathname.endsWith('/explore'), {
  //       timeout: 60000,
  //     });
  //     await page.waitForLoadState('networkidle');
  //     await page.waitForTimeout(1000);
  //     await expectNoAccessibilityViolations(page);
  //   });
  // });
});
