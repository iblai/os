/**
 * Journey 101 — Create Agent shows only the fields the caller may set
 * (iblai/iblai-platform#2766)
 *
 * Opening Create Agent asks the DM backend which fields of the create form the
 * caller may write: GET <DM base>/v1/agents/settings/field-permissions with the
 * `iblai-org` header, answered `{ "<field>": { "write": boolean } }`. A field
 * answered `write: false` is not rendered and not sent; while the answer is
 * unknown (403, 404, network error) every field is writable, as before.
 *
 *  - cafp-01 runs against the real backend: the request, its header and the
 *    answer's shape, and an admin getting every Settings field.
 *  - cafp-02..04 mock the answer (the real one grants an admin everything) and
 *    check the form and the create request it sends.
 *
 * cafp-02 and cafp-03 each create one throwaway agent. `createAndCaptureRequest`
 * / `createFromSettingsTab` register it for the run-level residue teardown, and
 * the suite's `MentorTracker` follows the usual afterAll pattern.
 */

import type { Page, Request, Route } from '@playwright/test';
import { test, expect } from '../fixtures/mentor-test';
import { generateMentorName } from '../fixtures/test-data';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';
import { MentorTracker } from '../utils/mentor-cleanup';
import { CreateMentorPage } from '../page-objects/create-mentor.page';

const UI_TIMEOUT = 15_000;
const REQUEST_TIMEOUT = 30_000;

const FIELD_PERMISSIONS_GLOB = '**/v1/agents/settings/field-permissions*';
const FIELD_PERMISSIONS_PATH = /\/v1\/agents\/settings\/field-permissions\/?$/;

const FORM_FIELDS = [
  'new_mentor_name',
  'display_name',
  'description',
  'categories',
  'metadata',
  'uploaded_profile_image',
  'template_name',
  'mentor_visibility',
  'system_prompt',
  'proactive_prompt',
  'guided_prompt_instructions',
  'moderation_system_prompt',
] as const;

const PROMPT_FIELDS = [
  'system_prompt',
  'proactive_prompt',
  'guided_prompt_instructions',
] as const;

const CORE_FIELDS = ['new_mentor_name', 'display_name', 'description'];

const isFieldPermissionsGet = (request: Request) =>
  request.method() === 'GET' &&
  FIELD_PERMISSIONS_PATH.test(new URL(request.url()).pathname);

function permissionsBody(denied: readonly string[] = []) {
  return Object.fromEntries(
    FORM_FIELDS.map((field) => [field, { write: !denied.includes(field) }]),
  );
}

async function withFieldPermissions(
  page: Page,
  answer: { status: number; body: unknown },
  run: (served: string[]) => Promise<void>,
): Promise<void> {
  const served: string[] = [];
  const handler = async (route: Route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    served.push(route.request().url());
    await route.fulfill({ status: answer.status, json: answer.body });
  };
  await page.route(FIELD_PERMISSIONS_GLOB, handler);
  try {
    await run(served);
  } finally {
    await page.unroute(FIELD_PERMISSIONS_GLOB, handler);
  }
}

async function openCreateAgent(
  page: Page,
  createMentorPage: CreateMentorPage,
): Promise<void> {
  await Promise.all([
    page.waitForRequest(isFieldPermissionsGet, { timeout: REQUEST_TIMEOUT }),
    createMentorPage.open(),
  ]);
  await createMentorPage.waitUntilEditable();
}

async function expectEveryField(
  createMentorPage: CreateMentorPage,
): Promise<void> {
  await expect(createMentorPage.nameInput).toBeVisible({
    timeout: UI_TIMEOUT,
  });
  await expect(createMentorPage.descriptionInput).toBeVisible({
    timeout: UI_TIMEOUT,
  });
  await expect(createMentorPage.categoryCombobox).toBeVisible({
    timeout: UI_TIMEOUT,
  });
  await expect(createMentorPage.visibilityCombobox).toBeVisible({
    timeout: UI_TIMEOUT,
  });
  await expect(createMentorPage.imageUploadButton).toBeVisible({
    timeout: UI_TIMEOUT,
  });
}

test.describe.configure({ mode: 'default', timeout: 240_000 });

test.describe('Journey 101: Create Agent field permissions', () => {
  const tracker = new MentorTracker();

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    if (!(await checkAdminStatus(page))) {
      test.skip(true, 'Requires admin access');
    }
  });

  test.afterAll(async ({ browser }, testInfo) => {
    await tracker.deleteAll(browser, testInfo);
  });

  test('cafp-01: admin opens Create Agent, the field-permissions request carries the tenant key, the answer is {write: boolean} per field, and every Settings field is shown', async ({
    page,
    createMentorPage,
  }) => {
    const { tenantKey } = await getPlatformContext(page);

    const [request, response] = await Promise.all([
      page.waitForRequest(isFieldPermissionsGet, { timeout: REQUEST_TIMEOUT }),
      page.waitForResponse((res) => isFieldPermissionsGet(res.request()), {
        timeout: REQUEST_TIMEOUT,
      }),
      createMentorPage.open(),
    ]);

    expect(
      new URL(request.url()).pathname,
      'mounted at the DM root, not under /api/ai-mentor/',
    ).not.toContain('/api/ai-mentor/');
    expect((await request.allHeaders())['iblai-org']).toBe(tenantKey);

    expect(response.status()).toBe(200);
    const permissions = (await response.json()) as Record<string, unknown>;
    const entries = Object.entries(permissions);
    expect(entries.length, 'at least one field is described').toBeGreaterThan(
      0,
    );
    for (const [field, permission] of entries) {
      expect(
        typeof (permission as { write?: unknown } | null)?.write,
        `write flag of ${field}`,
      ).toBe('boolean');
    }

    await createMentorPage.waitUntilEditable();
    await expectEveryField(createMentorPage);
  });

  test('cafp-02: admin whose mentor_visibility is write:false sees no Visibility field and creates an agent whose request has no mentor_visibility part', async ({
    page,
    createMentorPage,
  }) => {
    await withFieldPermissions(
      page,
      { status: 200, body: permissionsBody(['mentor_visibility']) },
      async (served) => {
        await openCreateAgent(page, createMentorPage);
        expect(served, 'the mocked answer was served').not.toHaveLength(0);

        await expect(createMentorPage.visibilityCombobox).toHaveCount(0);
        await expect(createMentorPage.descriptionInput).toBeVisible({
          timeout: UI_TIMEOUT,
        });
        await expect(createMentorPage.categoryCombobox).toBeVisible({
          timeout: UI_TIMEOUT,
        });
        await expect(createMentorPage.imageUploadButton).toBeVisible({
          timeout: UI_TIMEOUT,
        });
        await expect(createMentorPage.promptsTab).toBeVisible({
          timeout: UI_TIMEOUT,
        });

        const { name, request } =
          await createMentorPage.createAndCaptureRequest(generateMentorName());
        const { mentorId } = await getPlatformContext(page);
        tracker.add(mentorId);

        const fields = CreateMentorPage.createRequestFields(request);
        expect(fields).toEqual(
          expect.arrayContaining([
            ...CORE_FIELDS,
            'template_name',
            ...PROMPT_FIELDS,
          ]),
        );
        expect(fields).not.toContain('mentor_visibility');
        expect(
          CreateMentorPage.createRequestValue(request, 'new_mentor_name'),
        ).toBe(name);
      },
    );
  });

  test('cafp-03: admin whose three prompts are write:false sees no Prompts tab, saves from the Settings tab and the request has none of the prompt parts', async ({
    page,
    createMentorPage,
  }) => {
    await withFieldPermissions(
      page,
      { status: 200, body: permissionsBody([...PROMPT_FIELDS]) },
      async (served) => {
        await openCreateAgent(page, createMentorPage);
        expect(served, 'the mocked answer was served').not.toHaveLength(0);

        await expect(createMentorPage.promptsTab).toHaveCount(0);
        await expect(createMentorPage.nextButton).toHaveCount(0);
        await expect(createMentorPage.saveButton).toBeVisible({
          timeout: UI_TIMEOUT,
        });
        await expectEveryField(createMentorPage);

        const { name, request } =
          await createMentorPage.createFromSettingsTab(generateMentorName());
        const { mentorId } = await getPlatformContext(page);
        tracker.add(mentorId);

        const fields = CreateMentorPage.createRequestFields(request);
        expect(fields).toEqual(
          expect.arrayContaining([...CORE_FIELDS, 'mentor_visibility']),
        );
        for (const prompt of PROMPT_FIELDS) {
          expect(fields, `${prompt} is not sent`).not.toContain(prompt);
        }
        expect(
          CreateMentorPage.createRequestValue(request, 'new_mentor_name'),
        ).toBe(name);
      },
    );
  });

  test('cafp-04: admin whose field-permissions request answers 404 sees every field and the Prompts tab (fail open)', async ({
    page,
    createMentorPage,
  }) => {
    await withFieldPermissions(
      page,
      { status: 404, body: { detail: 'Not found.' } },
      async (served) => {
        await openCreateAgent(page, createMentorPage);
        expect(served, 'the mocked 404 was served').not.toHaveLength(0);

        await expectEveryField(createMentorPage);
        await expect(createMentorPage.promptsTab).toBeVisible({
          timeout: UI_TIMEOUT,
        });
        await expect(createMentorPage.nextButton).toBeVisible({
          timeout: UI_TIMEOUT,
        });
      },
    );
  });
});
