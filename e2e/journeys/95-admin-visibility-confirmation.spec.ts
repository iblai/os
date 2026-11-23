/**
 * Journey 95 — Limiting an agent to administrators asks first (issue #2731)
 *
 * Edit Agent → Settings → Discovery → "Who Can Use This Agent?":
 *  - while the dropdown says Admins Only, the help line
 *    (`discovery-audience-help`) says only admins can find and chat with it;
 *  - saving a change from All Members (catalog on or off) to Admins Only
 *    opens an alertdialog
 *    ("Limit this agent to administrators?") instead of saving at once.
 *    Cancel saves nothing; "Limit to Administrators" saves as usual;
 *  - no prompt when the agent is already Admins Only or goes the other way.
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

  test('avs-01: picking Admins Only shows the help line, and Save on an All Members agent opens the confirmation', async ({
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
    await expect(settings.audienceHelp).toContainText(
      /every member can find and chat with it/i,
    );

    await settings.setVisibility('Administrators');
    await expect(settings.audienceHelp).toContainText(
      /only admins, the creator, and people given access/i,
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

  test('avs-02: Cancel saves nothing and keeps Admins Only in the form', async ({
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
    await expect(settings.visibilityCombobox).toContainText(/Admins Only/i);
    page.off('request', onRequest);
    expect(saves, 'Cancel must not send a visibility save').toHaveLength(0);

    // Server still has All Members.
    await editMentorPage.close();
    await navigateToMentorApp(page, mentorUrl);
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await settings.selectSubTab('Discovery');
    await expect(settings.visibilityCombobox).toContainText(/All Members/i);
    await editMentorPage.close();
  });

  test('avs-03: "Limit to Administrators" saves viewable_by_tenant_admins, and Admins Only is shown when reopened', async ({
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
    await expect(settings.visibilityCombobox).toContainText(/Admins Only/i);
    await expect(settings.audienceHelp).toContainText(/only admins/i);
    await editMentorPage.close();
  });

  test('avs-04: switching away from Admins Only saves without a prompt, and Users to Anyone saves without a prompt', async ({
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
    await expect(settings.audienceHelp).toContainText(/only admins/i);

    await settings.setVisibility('Users');
    await expect(settings.audienceHelp).toContainText(/every member/i);
    await settings.saveButton.click();
    await expect(
      page.getByText(/agent updated successfully/i).first(),
    ).toBeVisible({ timeout: 30_000 });
    await expect(settings.adminVisibilityConfirm).toBeHidden();

    // All Members -> public catalog is not a narrowing either.
    await settings.setVisibility('Anyone');
    await settings.saveButton.click();
    await expect(settings.adminVisibilityConfirm).toBeHidden();
    await expect(
      page.getByText(/agent updated successfully/i).first(),
    ).toBeVisible({ timeout: 30_000 });
    await editMentorPage.close();
  });
});
