/**
 * Journey 60 — Mentor LTI Tab
 *
 * Covers the LTI top-level tab added to the Edit Mentor (Agent) modal. The tab
 * is rendered by the SDK's `AgentLtiTab` (`@iblai/iblai-js/web-containers/next`)
 * via `components/modals/edit-mentor-modal/tabs/lti-tab.tsx`.
 *
 * ── Visibility rules (as of feat/1853) ───────────────────────────────────────
 *
 *   1. Admin-only — non-admin users never see the tab (MENTOR_SEGMENTS filter).
 *   2. Always visible to admins — the `is_lti_accessible` gate was REMOVED.
 *      The "Enable LTI launches" toggle (formerly "Allow LTI launches") in
 *      Settings → Capabilities still controls whether the backend allows LTI
 *      launches, but the sidebar tab is always mounted for admins so they can
 *      reach the Links sub-tab to create the first link (which auto-enables
 *      access via the backend when that SDK callback is implemented).
 *
 * ── Sub-resource note ────────────────────────────────────────────────────────
 *
 * Sub-resource tests (Links / Keys / Tools) still require `is_lti_accessible=true`
 * on the backend — auto-enable-on-link-creation (lti-sdk-01) is not yet
 * implemented in the SDK. The worker fixture therefore still calls
 * `setEnableLtiLaunchesAndSave(true)` before running sub-resource tests.
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
 *     EXCEPTION — LTI links: the backend allows a single link per mentor and
 *     the SDK has no delete-link helper, so only lti-07 may create a link on
 *     the shared mentor; other link-mutating tests are self-contained.
 *
 *   • Self-contained tests — the gating tests (lti-01, lti-03, lti-04) and the
 *     empty-state tests (which need a guaranteed-empty mentor) each create
 *     their OWN fresh mentor and delete it in a `finally` block. They never
 *     touch the shared fixture mentor.
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
import { reapStaleLtiResidue } from '../utils/lti-residue';

// ---------------------------------------------------------------------------
// Worker-scoped fixture: one LTI-enabled mentor per worker.
// ---------------------------------------------------------------------------

type LtiWorkerFixtures = {
  /**
   * URL of an LTI-enabled mentor, created once per worker and deleted on worker
   * teardown. `null` on a non-admin worker (the mentor cannot be created); such
   * tests skip via their own admin guard. Shared by read-only / mutation tests
   * that just need an LTI-enabled mentor.
   *
   * NOTE: `setEnableLtiLaunchesAndSave(true)` is called here so that the
   * backend's `is_lti_accessible` flag is set — the LTI tab is always visible
   * to admins, but creating sub-resources (links / keys / tools) still requires
   * the flag to be on until the SDK implements auto-enable-on-link-creation.
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
          // Reap stale platform-wide LTI tools/keys from earlier runs. The
          // SDK renders only page 1 of those lists (no pagination), so
          // accumulated residue pushes freshly created keys/tools off the
          // page and breaks the in-list assertions. Best-effort, only
          // touches e2e-named resources older than 2h — see
          // e2e/utils/lti-residue.ts.
          await reapStaleLtiResidue(page);
          const createPage = new CreateMentorPage(page);
          await createPage.openAndCreate();
          await waitForPageReady(page);
          mentorUrl = page.url();

          const editPage = new EditMentorPage(page);
          // Enable LTI access on the backend so sub-resource tests can create
          // links/keys/tools. The LTI tab itself would be visible without this,
          // but the sub-resource APIs require is_lti_accessible=true. The
          // "Enable LTI launches" toggle now lives in-tab (feat/2040 — moved
          // off Settings → Capabilities into the LTI tab's own
          // `CapabilityGate`).
          await editPage.lti.switchToTab();
          await editPage.lti.setCapabilityEnabled(true);
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
 * Create a fresh ephemeral mentor and leave the page on it. When `enableLti`
 * is true, flips "Enable LTI launches" on via the LTI tab's own in-tab
 * `CapabilityGate` toggle (feat/2040 — moved off Settings → Capabilities)
 * and confirms the LTI tab is visible (it would be visible anyway — this
 * call just also enables is_lti_accessible for sub-resource operations),
 * then closes the modal.
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
    // Open the Edit Agent modal first — the LTI page object drives tabs
    // INSIDE the dialog and (deliberately) never opens it itself. open()
    // also blocks until the modal hydrates past its loading spinner.
    await editMentorPage.open();
    await editMentorPage.lti.switchToTab();
    await editMentorPage.lti.setCapabilityEnabled(true);
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

test.describe('Journey 60 — LTI tab visibility', () => {
  test.describe.configure({ mode: 'parallel' });
  test.setTimeout(240_000);

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'LTI tab visibility checks require admin access');
    }
  });

  // Each gating test is self-contained: it creates its OWN mentor and deletes
  // it in a finally block. No shared module state, so no test can be skipped
  // by a sibling's setup running in a different worker process.

  // ── lti-01: tab visible by default (no toggle needed) ────────────────────

  // lti-01: Fresh mentor — LTI tab IS visible by default even without enabling
  // "Enable LTI launches" (is_lti_accessible=false). The gate on is_lti_accessible
  // was removed in feat/1853 so the tab is always reachable for admins.
  test('admin sees the LTI tab visible by default on a fresh mentor without enabling the toggle', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    // Create a fresh mentor WITHOUT enabling LTI (is_lti_accessible stays false).
    await createTestMentor(page, createMentorPage, editMentorPage, {
      enableLti: false,
    });
    try {
      await editMentorPage.open('Settings');
      await waitForPageReady(page);
      // Tab must be visible even though is_lti_accessible is false.
      await editMentorPage.lti.expectTabVisible();
      await editMentorPage.close();
    } finally {
      await deleteTestMentor(editMentorPage);
    }
  });

  // ── lti-03: disabling "Enable LTI launches" regates the tab content ──────

  // lti-03: The LTI tab is unconditionally mounted for admins (feat/2040) —
  // "the tab stays visible after disabling" guards nothing anymore. What
  // matters is the capability toggle's effect on the GATED CONTENT: flipping
  // "Enable LTI launches" off must flip `capability-gate-content` back to
  // `data-enabled="false"` (grayed + inert sub-tabs), mirroring every other
  // in-tab capability.
  test('admin disables Enable LTI launches in the LTI tab and the gated content regates', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    // Start from LTI enabled.
    await createTestMentor(page, createMentorPage, editMentorPage, {
      enableLti: true,
    });
    try {
      // createTestMentor closes the modal after enabling LTI — reopen it.
      await editMentorPage.open();
      await editMentorPage.lti.switchToTab();
      await waitForPageReady(page);
      // Content is ungated while the capability is on.
      await expect(editMentorPage.lti.capabilityContent).toHaveAttribute(
        'data-enabled',
        'true',
        { timeout: 10_000 },
      );
      // Flip the toggle off — in-tab now (feat/2040), auto-saves on click.
      await editMentorPage.lti.setCapabilityEnabled(false);
      await expect(editMentorPage.lti.capabilityContent).toHaveAttribute(
        'data-enabled',
        'false',
        { timeout: 10_000 },
      );
      await editMentorPage.close();
    } finally {
      await deleteTestMentor(editMentorPage);
    }
  });

  // ── lti-04: non-admin does not see the LTI tab ───────────────────────────

  // lti-04: The LTI tab is admin-only. Non-admin users should never see it.
  // We use the nonadmin browser context to verify the tab trigger is absent
  // inside the Integrations category.
  test('non-admin user does not see the LTI tab in the Edit Mentor modal', async ({
    nonadminPage,
    nonadminEditMentorPage,
  }) => {
    await navigateToMentorApp(nonadminPage);

    // Non-admin cannot open the edit mentor modal via the mentor dropdown
    // (the Settings menu item is hidden for non-admins). Verify absence by
    // checking the dropdown first; if the dialog is somehow reachable, assert
    // the LTI tab trigger is not present in the Integrations category.
    const dropdown = nonadminPage.getByRole('button', {
      name: /^Selected (agent|mentor) dropdown button$/,
    });
    await expect(dropdown).toBeVisible({ timeout: 15_000 });
    await dropdown.click();

    const modifyItem = nonadminPage
      .getByRole('menuitem', { name: /modify/i })
      .or(nonadminPage.getByRole('menuitem', { name: /settings/i }).first());

    let menuItemVisible = false;
    try {
      await modifyItem.waitFor({ state: 'visible', timeout: 3_000 });
      menuItemVisible = true;
    } catch {
      menuItemVisible = false;
    }

    if (!menuItemVisible) {
      // Non-admin cannot open the edit dialog at all — LTI tab is definitively
      // not visible. Test passes.
      await nonadminPage.keyboard.press('Escape');
      return;
    }

    // If (in some env) the non-admin can open the dialog, assert the LTI tab
    // trigger is absent in the Integrations category.
    await modifyItem.click();
    await expect(nonadminEditMentorPage.dialog).toBeVisible({
      timeout: 15_000,
    });
    await nonadminEditMentorPage.lti.expectTabHidden();
    await nonadminEditMentorPage.close();
  });
});

test.describe('Journey 60 — LTI tab sub-resource tests', () => {
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
  //
  // The backend allows only ONE LTI link per mentor — once a link exists the
  // create button is no longer rendered, and the SDK exposes no delete-link
  // helper. This must therefore remain the ONLY test that creates a link on
  // the shared worker mentor; any other link-mutating test needs its own
  // self-contained mentor (see lti-08).
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

  // lti-08: Rename a link — self-contained mentor. This test must create the
  // link it renames, and the shared worker mentor already carries the single
  // allowed link (created by lti-07 or the fixture's other users), so a
  // second create there times out waiting for a create button that is no
  // longer rendered. A fresh mentor guarantees the create button exists.
  test('admin edits (renames) an LTI link and the new name appears in the list', async ({
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

      const name = LtiTab.uniqueName('e2e-link-orig');
      const renamed = LtiTab.uniqueName('e2e-link-renamed');
      await editMentorPage.lti.createLink(name);
      await editMentorPage.lti.expectLinkInList(name);
      await editMentorPage.lti.editLink(name, renamed);
      await editMentorPage.lti.expectLinkInList(renamed);
      await editMentorPage.lti.expectLinkNotInList(name);

      await editMentorPage.close();
    } finally {
      await deleteTestMentor(editMentorPage);
    }
  });

  // ── lti-10..lti-12: Keys sub-tab ──────────────────────────────────────────

  // lti-10: Create a key; detail shows non-empty public key + JWK.
  // FIXME: blocked on a backend issue (LTI keys/tools API) — re-enable once fixed.
  test.fixme(
    'admin creates an LTI key and the key detail shows non-empty public key and JWK',
    async ({ page, editMentorPage, ltiMentorUrl }) => {
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
    },
  );

  // lti-11: Rename a key.
  // FIXME: blocked on a backend issue (LTI keys/tools API) — re-enable once fixed.
  test.fixme(
    'admin renames an LTI key and the new name appears in the list',
    async ({ page, editMentorPage, ltiMentorUrl }) => {
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
    },
  );

  // lti-12: Delete a key.
  // FIXME: blocked on a backend issue (LTI keys/tools API) — re-enable once fixed.
  test.fixme(
    'admin deletes an LTI key and the key is no longer in the list',
    async ({ page, editMentorPage, ltiMentorUrl }) => {
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
        if (present)
          await editMentorPage.lti.deleteKey(keyName).catch(() => {});
      }

      await editMentorPage.close();
    },
  );

  // ── lti-13..lti-14: Tools sub-tab ─────────────────────────────────────────

  // lti-13: Tools surface renders. Unlike links and keys, LTI tools are
  // PLATFORM-WIDE (tenant-scoped — the SDK surface reads "Platform-wide
  // integrations with external LTI platforms"), NOT mentor-scoped: a fresh
  // mentor still lists every tool on the tenant, tools created by
  // lti-14 persist across runs (no delete-tool UI; stale ones are reaped
  // by the fixture janitor after 2h — see e2e/utils/lti-residue.ts),
  // and parallel workers can create tools at any moment. A guaranteed-empty
  // list is therefore unreachable, so this checkpoint asserts the surface
  // renders in whichever state the tenant is in: the create button plus
  // either the empty state or at least one tool row.
  test('admin opens the LTI Tools sub-tab and the platform-wide tools surface renders', async ({
    page,
    editMentorPage,
    ltiMentorUrl,
  }) => {
    test.skip(!ltiMentorUrl, 'LTI mentor unavailable on this worker');
    await openLtiTabOnSharedMentor(page, editMentorPage, ltiMentorUrl!);
    await editMentorPage.lti.switchToSubTab('tools');

    const { dialog } = editMentorPage;
    await expect(
      dialog.getByTestId(LtiTab.TEST_IDS.tools.createButton),
    ).toBeVisible({ timeout: 15_000 });
    // Tenant state decides which of the two renders — both are correct.
    await expect(
      dialog
        .getByTestId(LtiTab.TEST_IDS.tools.empty)
        .or(dialog.getByTestId(LtiTab.TEST_IDS.tools.row))
        .first(),
    ).toBeVisible({ timeout: 15_000 });

    await editMentorPage.close();
  });

  // lti-14: Create a tool with a JWKS URL signing config.
  // FIXME: blocked on a backend issue (LTI keys/tools API) — re-enable once fixed.
  test.fixme(
    'admin creates an LTI tool with a JWKS URL signing config and it appears in the tools list',
    async ({ page, editMentorPage, ltiMentorUrl }) => {
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
        // No in-test cleanup is possible: tools and keys are PLATFORM-wide
        // (they do NOT die with the worker mentor), the SDK exposes no
        // delete-tool UI, and the key cannot be deleted while the tool
        // references it. Both are uniquely named and reaped by
        // `reapStaleLtiResidue` in the worker fixture once they are >2h old.
      }

      await editMentorPage.close();
    },
  );

  // NOTE: the raw-JWKS-JSON tool variant (formerly lti-15) is intentionally
  // not covered for now. The SDK's ToolModal submitted `key_set` as a parsed
  // object while the backend serializer requires a JSON *string* (400 "Not a
  // valid string.", masked as a "Creating…" hang by data-layer retries). The
  // fix (send the raw string) is on the SDK branch feat/web-containers/1853;
  // re-add a raw-JSON checkpoint once mentorai bumps to an @iblai/iblai-js
  // release containing it. Tool creation stays covered via lti-14 (URL mode).

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

  // ── lti-sdk-01: auto-enable on link creation (SDK-PENDING) ───────────────

  /**
   * lti-sdk-01 (PENDING — SDK dependency):
   *
   * When an admin creates the first LTI link, `is_lti_accessible` should be
   * automatically set to `true` via the API so the admin does not need to
   * manually enable the "Enable LTI launches" toggle first.
   *
   * This is NOT implemented: the SDK's `AgentLtiTab` exposes no callback hook
   * for post-create side effects, and there are no public LTI data-layer hooks
   * available from `@iblai/iblai-js`. The feature must be added to the SDK.
   *
   * Until then: tests that require is_lti_accessible=true call
   * `setEnableLtiLaunchesAndSave(true)` explicitly (see the `ltiMentorUrl`
   * worker fixture and `createTestMentor` with `enableLti: true`).
   *
   * DO NOT uncomment this test until the SDK ships the auto-enable callback.
   */
  // test('admin creates the first LTI link and is_lti_accessible is auto-enabled', ...)
});
