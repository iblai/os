/**
 * Journey 55 — Mentor LTI Tab
 *
 * Covers the LTI top-level tab added to the Edit Mentor (Agent) modal. The tab
 * is rendered by the SDK's `AgentLtiTab` (`@iblai/iblai-js/web-containers/next`)
 * via `components/modals/edit-mentor-modal/tabs/lti-tab.tsx` and is gated by:
 *   1. Admin-only — non-admin users never see the tab (MENTOR_SEGMENTS filter).
 *   2. `is_lti_accessible = true` — the "Allow LTI launches" toggle in
 *      Settings → Capabilities must be ON.
 *
 * ── Parallel-safety & no-skip design ────────────────────────────────────────
 *
 * Tests are granular (one per checkpoint) and run in `parallel` mode. There is
 * NO shared module state, NO temp-file hand-off, and NO serial dependency
 * between tests, so a test can never be skipped because a sibling's setup ran
 * in a different worker process (the failure mode of the earlier serial
 * design). Two isolation strategies, both race-free:
 *
 *   • Worker-scoped fixture `ltiMentorUrl` — creates ONE LTI-enabled mentor per
 *     worker (using the running project's own storageState, so the auth file is
 *     always correct) and deletes it on worker teardown. Read-only and
 *     mutation tests that just need an LTI-enabled mentor reuse it. Tests in a
 *     worker run sequentially and each mutation test uses uniquely-named
 *     resources cleaned up in a `finally` block, so they never collide; each
 *     worker has its own mentor, so cross-worker runs never collide either.
 *
 *   • Self-contained tests — the gating tests (which toggle `is_lti_accessible`)
 *     and the empty-state tests (which need a guaranteed-empty mentor) each
 *     create their OWN fresh mentor and delete it in a `finally` block. They
 *     never touch the shared fixture mentor.
 *
 * The default shared mentor used by other journeys is never touched by either.
 *
 * The LTI segment lives under the **Integrations** sidebar category; the modal
 * only mounts the active category's tabs, so the `LtiTab` page object activates
 * Integrations before every LTI visibility/navigation check (the SDK's
 * category-blind `switchToLtiTab`/`isLtiTabVisible` are intentionally not used).
 *
 * Resource naming: `LtiTab.uniqueName(prefix)` → `prefix-<Date.now()>-<random5>`
 * (the project-approved pattern from `test-data.ts`), so links/keys/tools never
 * collide across parallel workers.
 */

import type { Page } from '@playwright/test';
import { test as base, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { LtiTab } from '../page-objects/edit-mentor/lti.tab';
import { CreateMentorPage } from '../page-objects/create-mentor.page';
import { EditMentorPage } from '../page-objects/edit-mentor/edit-mentor.page';

// ---------------------------------------------------------------------------
// Worker-scoped fixture: one LTI-enabled mentor per worker.
// ---------------------------------------------------------------------------

type LtiWorkerFixtures = {
  /**
   * URL of an LTI-enabled mentor, created once per worker and deleted on worker
   * teardown. `null` on a non-admin worker (the mentor cannot be created); such
   * tests skip via their own admin guard. Shared by read-only / mutation tests
   * that just need any LTI-enabled mentor.
   */
  ltiMentorUrl: string | null;
};

const test = base.extend<object, LtiWorkerFixtures>({
  ltiMentorUrl: [
    async ({ browser }, use, workerInfo) => {
      // Use the running project's configured storageState so the auth file is
      // always correct (user-chrome.json / user-firefox.json / …) — never a
      // hard-coded guess.
      const storageState = workerInfo.project.use.storageState as
        | string
        | undefined;

      let mentorUrl: string | null = null;

      const setupCtx = await browser.newContext(
        storageState ? { storageState } : {},
      );
      try {
        const page = await setupCtx.newPage();
        await navigateToMentorApp(page);
        if (await checkAdminStatus(page)) {
          const createPage = new CreateMentorPage(page);
          await createPage.openAndCreate();
          await waitForPageReady(page);
          mentorUrl = page.url();

          const editPage = new EditMentorPage(page);
          await editPage.open('Settings');
          await waitForPageReady(page);
          await editPage.settings.setAllowLtiLaunchesAndSave(true);
          await editPage.lti.expectTabVisible();
          await editPage.close();
        }
      } finally {
        await setupCtx.close();
      }

      await use(mentorUrl);

      // Teardown — delete the worker's LTI mentor.
      if (mentorUrl) {
        const teardownCtx = await browser.newContext(
          storageState ? { storageState } : {},
        );
        try {
          const page = await teardownCtx.newPage();
          await navigateToMentorApp(page, mentorUrl);
          await waitForPageReady(page);
          const editPage = new EditMentorPage(page);
          await editPage.open('Settings');
          await editPage.settings.deleteMentor();
        } catch {
          // Best-effort cleanup — an orphaned ephemeral mentor is non-critical.
        } finally {
          await teardownCtx.close();
        }
      }
    },
    { scope: 'worker' },
  ],
});

// ---------------------------------------------------------------------------
// Self-contained mentor helpers (for gating + empty-state tests)
// ---------------------------------------------------------------------------

/**
 * Create a fresh ephemeral mentor and leave the page on it. When `enableLti` is
 * true, flips "Allow LTI launches" on (Settings → Capabilities) and confirms
 * the LTI tab appears, then closes the modal.
 */
async function createTestMentor(
  page: Page,
  createMentorPage: CreateMentorPage,
  editMentorPage: EditMentorPage,
  { enableLti }: { enableLti: boolean },
): Promise<void> {
  await createMentorPage.openAndCreate();
  await waitForPageReady(page);
  await expect(
    page.locator('button[aria-label="Selected agent dropdown button"]'),
  ).toBeVisible({ timeout: 60_000 });

  if (enableLti) {
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await editMentorPage.settings.setAllowLtiLaunchesAndSave(true);
    await editMentorPage.lti.expectTabVisible();
    await editMentorPage.close();
  }
}

/** Delete the mentor the page is currently on. Best-effort. */
async function deleteTestMentor(editMentorPage: EditMentorPage): Promise<void> {
  try {
    await editMentorPage.close().catch(() => {});
    await editMentorPage.open('Settings');
    await waitForPageReady(editMentorPage.page);
    await editMentorPage.settings.deleteMentor();
  } catch {
    // Best-effort cleanup.
  }
}

/**
 * Navigate the test page to the shared worker LTI mentor and open the LTI tab.
 * Returns after the LTI sub-tab bar is interactive.
 */
async function openLtiTabOnSharedMentor(
  page: Page,
  editMentorPage: EditMentorPage,
  mentorUrl: string,
): Promise<void> {
  await navigateToMentorApp(page, mentorUrl);
  await waitForPageReady(page);
  await expect(
    page.locator('button[aria-label="Selected agent dropdown button"]'),
  ).toBeVisible({ timeout: 60_000 });
  await editMentorPage.open();
  await editMentorPage.lti.switchToTab();
}

// ---------------------------------------------------------------------------

test.describe('Journey 55 — LTI tab gating', () => {
  test.describe.configure({ mode: 'parallel' });
  test.setTimeout(240_000);

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'LTI tab is admin-only');
    }
  });

  // Each gating test is self-contained: it creates its OWN mentor (so toggling
  // is_lti_accessible never affects a sibling) and deletes it in a finally
  // block. No shared module state, so no test can be skipped by a sibling's
  // setup running in a different worker process.

  // ── lti-01..lti-03: gating ────────────────────────────────────────────────

  // lti-01: Fresh mentor — LTI tab hidden by default (is_lti_accessible=false).
  test('admin sees the LTI tab hidden by default on a fresh mentor before the toggle is on', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createTestMentor(page, createMentorPage, editMentorPage, {
      enableLti: false,
    });
    try {
      await editMentorPage.open('Settings');
      await waitForPageReady(page);
      // expectTabHidden activates the Integrations category first, so a missing
      // tab reflects the gating, not the segment simply not being mounted.
      await editMentorPage.lti.expectTabHidden();
      await editMentorPage.close();
    } finally {
      await deleteTestMentor(editMentorPage);
    }
  });

  // lti-02: Enabling "Allow LTI launches" reveals the LTI tab.
  test('admin enables Allow LTI launches in Settings and the LTI tab appears in the sidebar', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createTestMentor(page, createMentorPage, editMentorPage, {
      enableLti: false,
    });
    try {
      await editMentorPage.open('Settings');
      await waitForPageReady(page);
      await editMentorPage.settings.setAllowLtiLaunchesAndSave(true);
      await editMentorPage.lti.expectTabVisible();
      await editMentorPage.close();
    } finally {
      await deleteTestMentor(editMentorPage);
    }
  });

  // lti-03: Disabling "Allow LTI launches" hides the LTI tab again.
  test('admin disables Allow LTI launches in Settings and the LTI tab disappears', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createTestMentor(page, createMentorPage, editMentorPage, {
      enableLti: true,
    });
    try {
      await editMentorPage.open('Settings');
      await waitForPageReady(page);
      // Start from enabled (createTestMentor already turned it on).
      await editMentorPage.lti.expectTabVisible();
      // The toggle lives in Settings → Capabilities (Configurations category);
      // we are on Settings, so flip it off and confirm the tab disappears.
      await editMentorPage.settings.setAllowLtiLaunchesAndSave(false);
      await editMentorPage.lti.expectTabHidden();
      await editMentorPage.close();
    } finally {
      await deleteTestMentor(editMentorPage);
    }
  });
});

test.describe('Journey 55 — LTI tab sub-resource tests', () => {
  test.describe.configure({ mode: 'parallel' });
  test.setTimeout(240_000);

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'LTI tab is admin-only');
    }
  });

  // Read-only / mutation tests reuse the per-worker LTI-enabled mentor from the
  // `ltiMentorUrl` worker fixture (created once per worker, deleted on
  // teardown). Empty-state tests create their own fresh mentor for a guaranteed
  // clean slate. No shared module state → no skip, no flake; unique resource
  // names + finally cleanup keep same-worker tests from colliding.

  // ── lti-05: header + sub-tabs ─────────────────────────────────────────────

  test('admin opens the LTI tab on an LTI-enabled mentor and sees the header and all sub-tabs', async ({
    page,
    editMentorPage,
    ltiMentorUrl,
  }) => {
    test.skip(!ltiMentorUrl, 'LTI mentor unavailable on this worker');
    await openLtiTabOnSharedMentor(page, editMentorPage, ltiMentorUrl!);

    await editMentorPage.lti.expectHeader();
    for (const subTab of [
      'agentLinks',
      'keys',
      'tools',
      'toolEndpoints',
    ] as const) {
      await expect(
        editMentorPage.dialog.getByTestId(LtiTab.TEST_IDS.subTab[subTab]),
      ).toBeVisible({ timeout: 10_000 });
    }

    await editMentorPage.close();
  });

  // ── lti-06..lti-08: Links sub-tab ─────────────────────────────────────────

  // lti-06: Empty state — self-contained mentor (guaranteed no links yet).
  test('admin opens the LTI Links sub-tab and sees the empty state when no links exist', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createTestMentor(page, createMentorPage, editMentorPage, {
      enableLti: true,
    });
    try {
      await editMentorPage.open();
      await editMentorPage.lti.switchToTab();
      await editMentorPage.lti.switchToSubTab('agentLinks');
      await editMentorPage.lti.expectLinksEmpty();
      await editMentorPage.close();
    } finally {
      await deleteTestMentor(editMentorPage);
    }
  });

  // lti-07: Create a link (shared worker mentor; unique name).
  test('admin creates an LTI link and it appears in the links list', async ({
    page,
    editMentorPage,
    ltiMentorUrl,
  }) => {
    test.skip(!ltiMentorUrl, 'LTI mentor unavailable on this worker');
    await openLtiTabOnSharedMentor(page, editMentorPage, ltiMentorUrl!);
    await editMentorPage.lti.switchToSubTab('agentLinks');

    const name = LtiTab.uniqueName('e2e-link');
    await editMentorPage.lti.createLink(name);
    await editMentorPage.lti.expectLinkInList(name);

    await editMentorPage.close();
  });

  // lti-08: Rename a link (shared worker mentor; unique names).
  test('admin edits (renames) an LTI link and the new name appears in the list', async ({
    page,
    editMentorPage,
    ltiMentorUrl,
  }) => {
    test.skip(!ltiMentorUrl, 'LTI mentor unavailable on this worker');
    await openLtiTabOnSharedMentor(page, editMentorPage, ltiMentorUrl!);
    await editMentorPage.lti.switchToSubTab('agentLinks');

    const name = LtiTab.uniqueName('e2e-link-orig');
    const renamed = LtiTab.uniqueName('e2e-link-renamed');
    await editMentorPage.lti.createLink(name);
    await editMentorPage.lti.expectLinkInList(name);
    await editMentorPage.lti.editLink(name, renamed);
    await editMentorPage.lti.expectLinkInList(renamed);
    await editMentorPage.lti.expectLinkNotInList(name);

    await editMentorPage.close();
  });

  // ── lti-09..lti-12: Keys sub-tab ──────────────────────────────────────────

  // lti-09: Empty state — self-contained mentor (guaranteed no keys yet).
  test('admin opens the LTI Keys sub-tab and sees the empty state when no keys exist', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createTestMentor(page, createMentorPage, editMentorPage, {
      enableLti: true,
    });
    try {
      await editMentorPage.open();
      await editMentorPage.lti.switchToTab();
      await editMentorPage.lti.switchToSubTab('keys');
      await editMentorPage.lti.expectKeysEmpty();
      await editMentorPage.close();
    } finally {
      await deleteTestMentor(editMentorPage);
    }
  });

  // lti-10: Create a key; detail shows non-empty public key + JWK.
  test('admin creates an LTI key and the key detail shows non-empty public key and JWK', async ({
    page,
    editMentorPage,
    ltiMentorUrl,
  }) => {
    test.skip(!ltiMentorUrl, 'LTI mentor unavailable on this worker');
    await openLtiTabOnSharedMentor(page, editMentorPage, ltiMentorUrl!);
    await editMentorPage.lti.switchToSubTab('keys');

    const keyName = LtiTab.uniqueName('e2e-key');
    try {
      await editMentorPage.lti.createKey(keyName);
      await editMentorPage.lti.expectKeyInList(keyName);
      await editMentorPage.lti.openKeyDetail(keyName);
      expect(
        (await editMentorPage.lti.readKeyPublicKey()).trim().length,
      ).toBeGreaterThan(0);
      expect(
        (await editMentorPage.lti.readKeyPublicJwk()).trim().length,
      ).toBeGreaterThan(0);
      await editMentorPage.page.keyboard.press('Escape');
    } finally {
      await editMentorPage.lti.deleteKey(keyName).catch(() => {});
    }

    await editMentorPage.close();
  });

  // lti-11: Rename a key.
  test('admin renames an LTI key and the new name appears in the list', async ({
    page,
    editMentorPage,
    ltiMentorUrl,
  }) => {
    test.skip(!ltiMentorUrl, 'LTI mentor unavailable on this worker');
    await openLtiTabOnSharedMentor(page, editMentorPage, ltiMentorUrl!);
    await editMentorPage.lti.switchToSubTab('keys');

    const name = LtiTab.uniqueName('e2e-key-orig');
    const renamed = LtiTab.uniqueName('e2e-key-renamed');
    try {
      await editMentorPage.lti.createKey(name);
      await editMentorPage.lti.expectKeyInList(name);
      await editMentorPage.lti.renameKey(name, renamed);
      await editMentorPage.lti.expectKeyInList(renamed);
      await editMentorPage.lti.expectKeyNotInList(name);
    } finally {
      await editMentorPage.lti.deleteKey(renamed).catch(() => {});
    }

    await editMentorPage.close();
  });

  // lti-12: Delete a key.
  test('admin deletes an LTI key and the key is no longer in the list', async ({
    page,
    editMentorPage,
    ltiMentorUrl,
  }) => {
    test.skip(!ltiMentorUrl, 'LTI mentor unavailable on this worker');
    await openLtiTabOnSharedMentor(page, editMentorPage, ltiMentorUrl!);
    await editMentorPage.lti.switchToSubTab('keys');

    const keyName = LtiTab.uniqueName('e2e-key-delete');
    let present = false;
    try {
      await editMentorPage.lti.createKey(keyName);
      present = true;
      await editMentorPage.lti.expectKeyInList(keyName);
      await editMentorPage.lti.deleteKey(keyName);
      present = false;
      await editMentorPage.lti.expectKeyNotInList(keyName);
    } finally {
      if (present) await editMentorPage.lti.deleteKey(keyName).catch(() => {});
    }

    await editMentorPage.close();
  });

  // ── lti-13..lti-15: Tools sub-tab ─────────────────────────────────────────

  // lti-13: Empty state — self-contained mentor (guaranteed no tools yet).
  test('admin opens the LTI Tools sub-tab and sees the empty state when no tools exist', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createTestMentor(page, createMentorPage, editMentorPage, {
      enableLti: true,
    });
    try {
      await editMentorPage.open();
      await editMentorPage.lti.switchToTab();
      await editMentorPage.lti.switchToSubTab('tools');
      await editMentorPage.lti.expectToolsEmpty();
      await editMentorPage.close();
    } finally {
      await deleteTestMentor(editMentorPage);
    }
  });

  // lti-14: Create a tool with a JWKS URL signing config.
  test('admin creates an LTI tool with a JWKS URL signing config and it appears in the tools list', async ({
    page,
    editMentorPage,
    ltiMentorUrl,
  }) => {
    test.skip(!ltiMentorUrl, 'LTI mentor unavailable on this worker');
    await openLtiTabOnSharedMentor(page, editMentorPage, ltiMentorUrl!);

    const keyName = LtiTab.uniqueName('e2e-tool-key-url');
    const toolTitle = LtiTab.uniqueName('e2e-tool-url');
    try {
      await editMentorPage.lti.switchToSubTab('keys');
      await editMentorPage.lti.createKey(keyName);
      await editMentorPage.lti.expectKeyInList(keyName);

      await editMentorPage.lti.switchToSubTab('tools');
      await editMentorPage.lti.createTool({
        title: toolTitle,
        issuer: 'https://lms.example.com',
        clientId: `client-${toolTitle}`,
        authLoginUrl: 'https://lms.example.com/lti/auth',
        authTokenUrl: 'https://lms.example.com/lti/token',
        keySetMode: 'url',
        jwksUrl: 'https://lms.example.com/.well-known/jwks.json',
        signingKeyName: keyName,
      });
      await editMentorPage.lti.expectToolInList(toolTitle);
    } finally {
      // The SDK exposes no deleteTool helper; the worker mentor is deleted on
      // teardown, so the tool (and its key) go with it. Nothing to undo here.
    }

    await editMentorPage.close();
  });

  // lti-15: Create a tool with a raw JWKS JSON signing config.
  test('admin creates an LTI tool with raw JWKS JSON signing config and it appears in the tools list', async ({
    page,
    editMentorPage,
    ltiMentorUrl,
  }) => {
    test.skip(!ltiMentorUrl, 'LTI mentor unavailable on this worker');
    await openLtiTabOnSharedMentor(page, editMentorPage, ltiMentorUrl!);

    const keyName = LtiTab.uniqueName('e2e-tool-key-raw');
    const toolTitle = LtiTab.uniqueName('e2e-tool-raw');
    await editMentorPage.lti.switchToSubTab('keys');
    await editMentorPage.lti.createKey(keyName);
    await editMentorPage.lti.expectKeyInList(keyName);

    await editMentorPage.lti.switchToSubTab('tools');
    await editMentorPage.lti.createTool({
      title: toolTitle,
      issuer: 'https://raw-lms.example.com',
      clientId: `raw-client-${toolTitle}`,
      authLoginUrl: 'https://raw-lms.example.com/lti/auth',
      authTokenUrl: 'https://raw-lms.example.com/lti/token',
      keySetMode: 'raw',
      jwksJson: JSON.stringify({
        keys: [{ kty: 'RSA', use: 'sig', kid: 'test-key-1', n: 'AQAB' }],
      }),
      signingKeyName: keyName,
    });
    await editMentorPage.lti.expectToolInList(toolTitle);

    await editMentorPage.close();
  });

  // ── lti-16..lti-18: Tool Endpoints sub-tab (shared worker mentor) ─────────

  // lti-16: All four endpoints render with non-empty URLs.
  test('admin opens the Tool Endpoints sub-tab and all four endpoint URLs are non-empty', async ({
    page,
    editMentorPage,
    ltiMentorUrl,
  }) => {
    test.skip(!ltiMentorUrl, 'LTI mentor unavailable on this worker');
    await openLtiTabOnSharedMentor(page, editMentorPage, ltiMentorUrl!);
    await editMentorPage.lti.switchToSubTab('toolEndpoints');

    await editMentorPage.lti.expectAllEndpointsVisible();

    await editMentorPage.close();
  });

  // lti-17: The redirect-URI copy button flips its label to "Copied".
  test('admin copies the redirect URI endpoint URL and the copy button label flips to Copied', async ({
    page,
    editMentorPage,
    ltiMentorUrl,
  }) => {
    test.skip(!ltiMentorUrl, 'LTI mentor unavailable on this worker');
    await openLtiTabOnSharedMentor(page, editMentorPage, ltiMentorUrl!);
    await editMentorPage.lti.switchToSubTab('toolEndpoints');

    await editMentorPage.lti.copyEndpoint('redirectUri');

    await editMentorPage.close();
  });

  // lti-18: Endpoints are built from the dedicated LMS URL.
  test('admin opens the Tool Endpoints sub-tab and every endpoint URL is built from the LMS URL', async ({
    page,
    editMentorPage,
    ltiMentorUrl,
  }) => {
    test.skip(!ltiMentorUrl, 'LTI mentor unavailable on this worker');
    await openLtiTabOnSharedMentor(page, editMentorPage, ltiMentorUrl!);
    await editMentorPage.lti.switchToSubTab('toolEndpoints');

    // Every endpoint is built from `config.legacyLmsUrl()` in lti-tab.tsx (the
    // dedicated LMS domain, NOT the `<apiBase>/lms` that `lmsUrl()` yields) —
    // absolute https URLs on the /lti/ path sharing one origin
    // (e.g. https://learn.iblai.org/lti/1p3/...).
    const endpoints = ['redirectUri', 'login', 'deepLinking', 'jwks'] as const;
    const urls = await Promise.all(
      endpoints.map((e) => editMentorPage.lti.readEndpointUrl(e)),
    );
    for (const url of urls) {
      expect(url).toMatch(/^https:\/\/.+\/lti\//);
    }
    const origins = new Set(urls.map((u) => new URL(u).origin));
    expect(origins.size).toBe(1);
    const lmsUrl = process.env.NEXT_PUBLIC_LEGACY_LMS_URL;
    if (lmsUrl) {
      expect([...origins][0]).toBe(new URL(lmsUrl).origin);
    }

    await editMentorPage.close();
  });
});
