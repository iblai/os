/**
 * Journey 95 — Limiting an agent to administrators asks first (issue #2731)
 *
 * Edit Agent → Settings → Discovery → "Who Can View?":
 *  - while the dropdown says Administrators, the note
 *    (`admin-only-visibility-note`) warns that everyone else loses access;
 *  - saving a change from Users/Anyone to Administrators opens an alertdialog
 *    ("Limit this agent to administrators?") instead of saving at once.
 *    Cancel saves nothing; "Limit to Administrators" saves as usual;
 *  - no prompt when the agent is already Administrators or goes the other way.
 *
 * One throwaway agent (auto-tracked and deleted by `createWithName`) is shared
 * by the serial checkpoints, which walk its visibility through the states.
 */

import type { Page, Request } from '@playwright/test';
import { test, expect } from '../fixtures/mentor-test';
import { MENTOR_NEXTJS_HOST, generateMentorName } from '../fixtures/test-data';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';

const isVisibilitySave = (req: Request) =>
  ['PUT', 'PATCH'].includes(req.method()) &&
  (req.postData() ?? '').includes('mentor_visibility');

async function skipIfNotAdmin(page: Page): Promise<void> {
  if (!(await checkAdminStatus(page))) test.skip(true, 'Requires admin access');
}

test.describe.serial('Journey 95: Admin visibility confirmation', () => {
  test.setTimeout(180_000);

  let mentorUrl = '';

  test('avs-01: picking Administrators shows the note, and Save on a Users/Anyone agent opens the confirmation', async ({
    page,
    editMentorPage,
    createMentorPage,
  }) => {
    await navigateToMentorApp(page);
    await skipIfNotAdmin(page);

    await createMentorPage.openAndCreate(generateMentorName());
    await waitForPageReady(page);
    const { tenantKey, mentorId } = await getPlatformContext(page);
    mentorUrl = `${MENTOR_NEXTJS_HOST}/platform/${tenantKey}/${mentorId}`;

    const settings = editMentorPage.settings;
    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    // Start from a saved Users value so narrowing to Administrators is a change.
    await settings.setVisibility('Users');
    await settings.saveConfirmingAdminVisibility();
    await expect(settings.adminOnlyVisibilityNote).toBeHidden();

    await settings.setVisibility('Administrators');
    await expect(settings.adminOnlyVisibilityNote).toBeVisible();
    await expect(settings.adminOnlyVisibilityNote).toContainText(
      /only administrators can see and chat with this agent/i,
    );

    await settings.saveButton.click();
    await expect(settings.adminVisibilityConfirm).toBeVisible({
      timeout: 10_000,
    });
    await expect(settings.adminVisibilityConfirm).toContainText(
      'Limit this agent to administrators?',
    );
    await settings.cancelAdminVisibility();
    await editMentorPage.close();
  });

  test('avs-02: Cancel saves nothing and keeps Administrators in the form', async ({
    page,
    editMentorPage,
  }) => {
    test.skip(!mentorUrl, 'avs-01 setup did not run');
    await navigateToMentorApp(page, mentorUrl);
    await skipIfNotAdmin(page);

    const settings = editMentorPage.settings;
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await settings.setVisibility('Administrators');

    const saves: Request[] = [];
    const onRequest = (req: Request) => {
      if (isVisibilitySave(req)) saves.push(req);
    };
    page.on('request', onRequest);

    await settings.saveButton.click();
    await settings.cancelAdminVisibility();
    await expect(settings.visibilityCombobox).toContainText(/Administrators/i);
    await expect(settings.adminOnlyVisibilityNote).toBeVisible();
    page.off('request', onRequest);
    expect(saves, 'Cancel must not send a visibility save').toHaveLength(0);

    // Server still has Users.
    await editMentorPage.close();
    await navigateToMentorApp(page, mentorUrl);
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await settings.selectSubTab('Discovery');
    await expect(settings.visibilityCombobox).toContainText(/Users/i);
    await editMentorPage.close();
  });

  test('avs-03: "Limit to Administrators" saves viewable_by_tenant_admins, and the note shows when reopened', async ({
    page,
    editMentorPage,
  }) => {
    test.skip(!mentorUrl, 'avs-01 setup did not run');
    await navigateToMentorApp(page, mentorUrl);
    await skipIfNotAdmin(page);

    const settings = editMentorPage.settings;
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await settings.setVisibility('Administrators');

    await settings.saveButton.click();
    const [request] = await Promise.all([
      page.waitForRequest(isVisibilitySave, { timeout: 30_000 }),
      settings.confirmAdminVisibility(),
    ]);
    expect(request.postData() ?? '').toContain('viewable_by_tenant_admins');
    await expect(
      page.getByText(/agent updated successfully/i).first(),
    ).toBeVisible({ timeout: 30_000 });
    await expect(settings.adminVisibilityConfirm).toBeHidden();
    await editMentorPage.close();

    await navigateToMentorApp(page, mentorUrl);
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await settings.selectSubTab('Discovery');
    await expect(settings.visibilityCombobox).toContainText(/Administrators/i);
    await expect(settings.adminOnlyVisibilityNote).toBeVisible();
    await editMentorPage.close();
  });

  test('avs-04: switching away from Administrators hides the note and saves without a prompt, and Users to Anyone saves without a prompt', async ({
    page,
    editMentorPage,
  }) => {
    test.skip(!mentorUrl, 'avs-01 setup did not run');
    await navigateToMentorApp(page, mentorUrl);
    await skipIfNotAdmin(page);

    const settings = editMentorPage.settings;
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await settings.selectSubTab('Discovery');
    await expect(settings.adminOnlyVisibilityNote).toBeVisible();

    await settings.setVisibility('Users');
    await expect(settings.adminOnlyVisibilityNote).toBeHidden();
    await settings.saveButton.click();
    await expect(
      page.getByText(/agent updated successfully/i).first(),
    ).toBeVisible({ timeout: 30_000 });
    await expect(settings.adminVisibilityConfirm).toBeHidden();

    // Users -> Anyone is not a narrowing either.
    await settings.setVisibility('Anyone');
    await settings.saveButton.click();
    await expect(settings.adminVisibilityConfirm).toBeHidden();
    await expect(
      page.getByText(/agent updated successfully/i).first(),
    ).toBeVisible({ timeout: 30_000 });
    await editMentorPage.close();
  });
});
