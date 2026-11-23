/**
 * Journey 99 — Settings > Discovery redesign (iblai/iblai-platform#2788)
 *
 * "Who Can Use This Agent?" (All Members / Admins Only), "List in Public
 * Catalog" and "Allow Chat Without Signing In" replace the old Who Can
 * View / Who Can Chat selects. The three controls map onto the unchanged
 * `mentor_visibility` and `allow_anonymous` fields. One throwaway agent
 * (auto-tracked and deleted by `createWithName`) is shared by the serial
 * checkpoints.
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
import type { EditMentorPage } from '../page-objects/edit-mentor/edit-mentor.page';

interface Row {
  audience: 'All Members' | 'Admins Only';
  catalog: boolean;
  guest: boolean;
  visibility: string;
  anonymous: boolean;
  summary: string;
}

const ROWS: Row[] = [
  {
    audience: 'Admins Only',
    catalog: false,
    guest: false,
    visibility: 'viewable_by_tenant_admins',
    anonymous: false,
    summary:
      'Only admins, the creator, and people given access can find and chat with it.',
  },
  {
    audience: 'Admins Only',
    catalog: false,
    guest: true,
    visibility: 'viewable_by_tenant_admins',
    anonymous: true,
    summary:
      'Hidden from search. Anyone with the link can chat without signing in.',
  },
  {
    audience: 'All Members',
    catalog: false,
    guest: false,
    visibility: 'viewable_by_tenant_students',
    anonymous: false,
    summary: 'Every member can find and chat with it.',
  },
  {
    audience: 'All Members',
    catalog: false,
    guest: true,
    visibility: 'viewable_by_tenant_students',
    anonymous: true,
    summary:
      'Members can find it. Anyone with the link can chat without signing in.',
  },
  {
    audience: 'All Members',
    catalog: true,
    guest: false,
    visibility: 'viewable_by_anyone',
    anonymous: false,
    summary: 'Listed in the public catalog. Visitors must sign in to chat.',
  },
  {
    audience: 'All Members',
    catalog: true,
    guest: true,
    visibility: 'viewable_by_anyone',
    anonymous: true,
    summary:
      'Listed in the public catalog. Anyone can chat without signing in.',
  },
];

const isDiscoverySave = (req: Request) =>
  ['PUT', 'PATCH'].includes(req.method()) &&
  /mentor_visibility|allow_anonymous/.test(req.postData() ?? '');

function field(body: string, name: string): string | undefined {
  return new RegExp(`name="${name}"\\r?\\n\\r?\\n([^\\r\\n]*)`).exec(body)?.[1];
}

async function skipIfNotAdmin(page: Page): Promise<void> {
  if (!(await checkAdminStatus(page))) test.skip(true, 'Requires admin access');
}

async function openDiscovery(
  page: Page,
  editMentorPage: EditMentorPage,
  url: string,
): Promise<void> {
  await navigateToMentorApp(page, url);
  await skipIfNotAdmin(page);
  await editMentorPage.open('Settings');
  await waitForPageReady(page);
  await editMentorPage.settings.selectSubTab('Discovery');
}

test.describe.serial('Journey 99: Discovery audience and catalog', () => {
  test.setTimeout(240_000);

  let mentorUrl = '';
  let tenantKey = '';

  test('dac-01: all six audience / catalog / guest combinations save the mapped fields, and a reload restores controls and summary', async ({
    page,
    editMentorPage,
    createMentorPage,
  }) => {
    test.setTimeout(480_000);
    await navigateToMentorApp(page);
    await skipIfNotAdmin(page);

    await createMentorPage.openAndCreate(generateMentorName());
    await waitForPageReady(page);
    const ctx = await getPlatformContext(page);
    tenantKey = ctx.tenantKey;
    mentorUrl = `${MENTOR_NEXTJS_HOST}/platform/${ctx.tenantKey}/${ctx.mentorId}`;

    const settings = editMentorPage.settings;
    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    for (const row of ROWS) {
      await settings.setAudience(row.audience);
      await settings.setPublicCatalog(row.catalog);
      await settings.setGuestChat(row.guest);
      await expect(settings.discoverySummary).toHaveText(row.summary);

      const saved = page.waitForResponse(
        (res) => isDiscoverySave(res.request()),
        { timeout: 30_000 },
      );
      await settings.saveButton.click();
      if (row.audience === 'Admins Only') {
        // Narrowing to admins asks first (#2731).
        const confirm = settings.adminVisibilityConfirm;
        const toast = page.getByText(/agent updated successfully/i).first();
        await confirm.or(toast).first().waitFor({ timeout: 30_000 });
        if (await confirm.isVisible()) await settings.confirmAdminVisibility();
      }
      const res = await saved;
      expect(res.ok(), `${row.summary} save status ${res.status()}`).toBe(true);
      const body = res.request().postData() ?? '';
      expect(
        field(body, 'mentor_visibility') ?? field(body, 'allow_anonymous'),
        'save body carries the discovery fields',
      ).toBeDefined();
      if (field(body, 'mentor_visibility') !== undefined) {
        expect(field(body, 'mentor_visibility'), row.summary).toBe(
          row.visibility,
        );
      }
      if (field(body, 'allow_anonymous') !== undefined) {
        expect(field(body, 'allow_anonymous'), row.summary).toBe(
          String(row.anonymous),
        );
      }

      await editMentorPage.close();
      await openDiscovery(page, editMentorPage, mentorUrl);
      const state = await settings.readDiscovery();
      expect(state, row.summary).toEqual({
        audience: row.audience,
        catalog: row.catalog,
        guest: row.guest,
        summary: row.summary,
      });
    }
    await editMentorPage.close();
  });

  test('dac-02: Admins Only disables and clears List in Public Catalog; going back to All Members lands with it off', async ({
    page,
    editMentorPage,
  }) => {
    test.skip(!mentorUrl, 'dac-01 setup did not run');
    await openDiscovery(page, editMentorPage, mentorUrl);
    const settings = editMentorPage.settings;

    // dac-01 left the agent public with guest chat on.
    await expect(settings.publicCatalogSwitch).toBeEnabled();
    await expect(settings.publicCatalogSwitch).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await settings.setAudience('Admins Only');
    await expect(settings.publicCatalogSwitch).toBeDisabled();
    await expect(settings.publicCatalogSwitch).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await expect(settings.audienceHelp).toContainText(/only admins/i);

    await settings.setAudience('All Members');
    await expect(settings.publicCatalogSwitch).toBeEnabled();
    await expect(settings.publicCatalogSwitch).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await expect(settings.audienceHelp).toContainText(
      /every member can find and chat with it/i,
    );
    await editMentorPage.close();
  });

  test('dac-03: narrowing a publicly listed agent to Admins Only asks for confirmation, and Cancel saves nothing', async ({
    page,
    editMentorPage,
  }) => {
    test.skip(!mentorUrl, 'dac-01 setup did not run');
    await openDiscovery(page, editMentorPage, mentorUrl);
    const settings = editMentorPage.settings;

    await settings.setAudience('All Members');
    await settings.setPublicCatalog(true);
    await settings.saveButton.click();
    await expect(
      page.getByText(/agent updated successfully/i).first(),
    ).toBeVisible({ timeout: 30_000 });
    await expect(settings.adminVisibilityConfirm).toBeHidden();

    await settings.setAudience('Admins Only');
    await settings.saveButton.click();
    await expect(settings.adminVisibilityConfirm).toContainText(
      'Limit this agent to administrators?',
      { timeout: 10_000 },
    );
    await settings.cancelAdminVisibility();
    await editMentorPage.close();

    await openDiscovery(page, editMentorPage, mentorUrl);
    const state = await settings.readDiscovery();
    expect(state.audience).toBe('All Members');
    expect(state.catalog).toBe(true);
    await editMentorPage.close();
  });

  test('dac-04: the Discovery sub-tab never shows the tenant name', async ({
    page,
    editMentorPage,
  }) => {
    test.skip(!mentorUrl, 'dac-01 setup did not run');
    await openDiscovery(page, editMentorPage, mentorUrl);
    await expect(editMentorPage.settings.discoverySummary).toBeVisible();
    const tenantName = await page.evaluate(() => {
      try {
        const t = JSON.parse(localStorage.getItem('current_tenant') ?? '{}');
        return String(t.name ?? t.platform_name ?? '');
      } catch {
        return '';
      }
    });
    const text = (await editMentorPage.dialog.innerText()).toLowerCase();
    expect(text).not.toContain(tenantKey.toLowerCase());
    if (tenantName.length > 2) {
      expect(text).not.toContain(tenantName.toLowerCase());
    }
    await editMentorPage.close();
  });
});
