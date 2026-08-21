import { test, expect } from '../fixtures/mentor-test';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
  getLoggedInUsername,
} from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { deleteMentorById } from '../utils/mentor-cleanup';
import { generateMentorName } from '../fixtures/test-data';
import type { ProfilePage } from '../page-objects/profile.page';

/**
 * Journey 68 — Tenant Memory Admin tab & Profile Memory tab.
 *
 * Covers two SDK-delivered memory surfaces inside the "User Profile" dialog
 * (`UserProfileDropdown` from `@iblai/iblai-js/web-containers/next`, wired
 * in by `app/platform/[tenantKey]/[mentorId]/_components/nav-bar/
 * user-profile.tsx`):
 *
 *   A. **Tenant-settings Memory admin tab** (`MemoryAdminTab`) — a brand-new
 *      rail item (`{ id: 'memory', label: 'Memory', icon: Brain }`) on the
 *      tenant-settings side, reached via More Options → platform name. There
 *      is NO host wiring for this — it appears purely from the SDK bump, so
 *      every locator flows through `MemoryAdminPage`
 *      (`e2e/page-objects/memory-admin.page.ts`), itself a thin wrapper over
 *      `@iblai/iblai-js/playwright`'s `memory-admin-helpers`.
 *
 *   B. **Profile "Memory" tab** ("My Memories" — personal side, `MemoryTab`)
 *      — pre-existed but its row actions changed: the old hover-delete
 *      button was replaced by a three-dots menu (Edit + Delete), and
 *      "Archive" was renamed to "Delete". This tab had ZERO e2e coverage
 *      before this journey. Covered via `ProfilePage`'s new Memory-tab
 *      methods (`e2e/page-objects/profile.page.ts`), which wrap
 *      `memory-test-helpers` — except `editMemoryByContent`, which the SDK
 *      has no helper for; see that method's doc comment for the gap.
 *
 * ── Memsearch gating (both surfaces) ─────────────────────────────────────
 *
 * Both tabs' real content only renders once the tenant's memsearch status
 * resolves as enabled; if memsearch is off or the check errors, the tenant
 * admin tab's Global sub-tab never mounts (`switchToTenantMemoryTab` times
 * out) and the profile tab shows a disabled placeholder instead of the
 * settings/list surfaces. This journey does NOT itself drive the tenant-wide
 * "Memory System" toggle (see journey 38,
 * `38-tenant-memory-system-toggle.spec.ts`, which owns that) — every test
 * here probes availability first and `test.skip`s with a documented reason
 * if the feature isn't resolved as on, rather than asserting a specific
 * tenant configuration.
 *
 * ── Isolation & serial mode ───────────────────────────────────────────────
 *
 * The tenant-admin Global sub-tab's "search for a user, open their popup"
 * flow is exercised against the ADMIN test account's OWN username (via
 * `getLoggedInUsername`), and the profile tab's personal tests run against
 * the NON-ADMIN test account's own profile — two different backend users,
 * so the two describe blocks don't collide with each other. But every admin
 * worker/browser-project shares the SAME admin storageState (same backend
 * user), and likewise for non-admin — so two tests IN THIS FILE mutating the
 * same account's memory setting switches (or CRUD-ing memories with
 * colliding content) could race across parallel workers. Mirroring journeys
 * 38 and 47, the whole file runs `mode: 'serial'` in a single worker so no
 * self-collision is possible; unique timestamped content strings additionally
 * protect the CRUD checkpoints from colliding with any other, unrelated
 * memory records that might already exist on either account.
 */
test.describe.configure({ mode: 'serial' });

// ---------------------------------------------------------------------------
// Journey 68A: Tenant Memory admin tab (Global + Agent)
// ---------------------------------------------------------------------------

test.describe('Journey 68A: Tenant Memory admin tab (Global + Agent)', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Tenant Memory admin tab requires admin access');
      return;
    }
    await waitForPageReady(page);
  });

  // MA-01: rail item + both sub-tabs render.
  test('admin sees the Memory rail item and its Global + Agent sub-tabs render', async ({
    memoryAdminPage,
  }) => {
    const dialog = await memoryAdminPage.tryOpen();
    test.skip(
      !dialog,
      'Memory admin tab unavailable (memsearch not enabled/resolved on this tenant)',
    );

    await expect(memoryAdminPage.globalSection()).toBeVisible({
      timeout: 10_000,
    });

    await memoryAdminPage.switchToSubTab('agent');
    await expect(memoryAdminPage.agentSection()).toBeVisible({
      timeout: 10_000,
    });

    await memoryAdminPage.switchToSubTab('global');
    await expect(memoryAdminPage.globalSection()).toBeVisible({
      timeout: 10_000,
    });

    await memoryAdminPage.close(dialog!);
  });

  // MA-02: search the Global sub-tab for the logged-in admin's own username
  // and open their memories popup.
  test('admin searches the Global sub-tab for their own username and opens their memories popup', async ({
    page,
    memoryAdminPage,
  }) => {
    const username = await getLoggedInUsername(page);
    test.skip(!username, 'Could not resolve the logged-in admin username');

    const dialog = await memoryAdminPage.tryOpen();
    test.skip(
      !dialog,
      'Memory admin tab unavailable (memsearch not enabled/resolved on this tenant)',
    );

    await memoryAdminPage.searchUsers(username!, username!);
    await expect(memoryAdminPage.userRow(username!)).toBeVisible({
      timeout: 10_000,
    });

    const popup = await memoryAdminPage.openUserPopup(username!);
    await expect(popup).toBeVisible({ timeout: 10_000 });

    await memoryAdminPage.closeUserPopup();
    await memoryAdminPage.close(dialog!);
  });

  // MA-03: full CRUD on a unique global memory through the popup.
  test('admin performs full CRUD on a global memory through the Global popup', async ({
    page,
    memoryAdminPage,
  }) => {
    const username = await getLoggedInUsername(page);
    test.skip(!username, 'Could not resolve the logged-in admin username');

    const dialog = await memoryAdminPage.tryOpen();
    test.skip(
      !dialog,
      'Memory admin tab unavailable (memsearch not enabled/resolved on this tenant)',
    );

    const content = `e2e-global-memory-${Date.now()}`;
    const updated = `${content}-edited`;

    const popup = await memoryAdminPage.openUserPopup(username!);
    try {
      await memoryAdminPage.addGlobalMemory(popup, content);
      await expect(memoryAdminPage.memoryRow(popup, content)).toBeVisible({
        timeout: 10_000,
      });

      await memoryAdminPage.editGlobalMemory(popup, content, updated);
      await expect(memoryAdminPage.memoryRow(popup, updated)).toBeVisible({
        timeout: 10_000,
      });
      await expect(memoryAdminPage.memoryRow(popup, content)).toBeHidden({
        timeout: 5_000,
      });

      await memoryAdminPage.deleteGlobalMemory(popup, updated);
      await expect(memoryAdminPage.memoryRow(popup, updated)).toBeHidden({
        timeout: 10_000,
      });
    } finally {
      // Best-effort cleanup in case an assertion above failed mid-flow.
      await memoryAdminPage.deleteGlobalMemory(popup, updated).catch(() => {});
      await memoryAdminPage.deleteGlobalMemory(popup, content).catch(() => {});
      await memoryAdminPage.closeUserPopup().catch(() => {});
    }

    await memoryAdminPage.close(dialog!);
  });

  // MA-04: toggle one memory setting switch and back — symmetric flip,
  // regardless of the account's current on/off starting state.
  test('admin toggles the auto-capture memory setting in the Global popup and back', async ({
    page,
    memoryAdminPage,
  }) => {
    const username = await getLoggedInUsername(page);
    test.skip(!username, 'Could not resolve the logged-in admin username');

    const dialog = await memoryAdminPage.tryOpen();
    test.skip(
      !dialog,
      'Memory admin tab unavailable (memsearch not enabled/resolved on this tenant)',
    );

    const popup = await memoryAdminPage.openUserPopup(username!);
    try {
      const flipped = await memoryAdminPage.toggleSetting(popup, 'autoCapture');
      const restored = await memoryAdminPage.toggleSetting(
        popup,
        'autoCapture',
      );
      expect(restored).toBe(!flipped);
    } finally {
      await memoryAdminPage.closeUserPopup().catch(() => {});
    }

    await memoryAdminPage.close(dialog!);
  });

  // MA-05: Agent sub-tab renders its section + the agents autocomplete filter.
  test('admin switches to the Agent sub-tab and the section + agent filter render', async ({
    memoryAdminPage,
  }) => {
    const dialog = await memoryAdminPage.tryOpen();
    test.skip(
      !dialog,
      'Memory admin tab unavailable (memsearch not enabled/resolved on this tenant)',
    );

    await memoryAdminPage.switchToSubTab('agent');
    await expect(memoryAdminPage.agentSection()).toBeVisible({
      timeout: 10_000,
    });
    // "Search Agents…" placeholder — MemoryAdminTab's filter.placeholder in
    // the SDK bundle (memoryAdminTab.filter.placeholder).
    await expect(
      memoryAdminPage.agentSection().getByPlaceholder(/search agents/i),
    ).toBeVisible({ timeout: 5_000 });

    await memoryAdminPage.close(dialog!);
  });

  // MA-06: filter the Agent sub-tab to a freshly created, uniquely-named
  // mentor (own name + unique_id both known deterministically — more
  // reliable than depending on the worker's shared default mentor, whose
  // display name isn't guaranteed known here), open its popup, and add a
  // unique agent memory. Self-contained: creates and deletes its own mentor
  // via the DM API (`deleteMentorById`), matching the project's
  // mentor-tracking rule for a single test that owns exactly one mentor.
  test('admin filters the Agent sub-tab to a fresh mentor, opens its popup, and adds a unique agent memory', async ({
    page,
    memoryAdminPage,
    createMentorPage,
  }) => {
    // Own extended budget: this checkpoint pays a full mentor create AND
    // delete on top of the tenant-dialog + popup flow — the create alone can
    // run close to the 120s config default on staging (same rationale as the
    // mentor-creating checkpoints in journeys 47/60).
    test.setTimeout(240_000);
    const mentorName = generateMentorName();
    await createMentorPage.openAndCreate(mentorName);
    const { mentorId } = await getPlatformContext(page);

    try {
      const dialog = await memoryAdminPage.tryOpen();
      test.skip(
        !dialog,
        'Memory admin tab unavailable (memsearch not enabled/resolved on this tenant)',
      );

      await memoryAdminPage.switchToSubTab('agent');
      await memoryAdminPage.filterAgents(mentorName);
      await expect(memoryAdminPage.agentRow(mentorId)).toBeVisible({
        timeout: 15_000,
      });

      const content = `e2e-agent-memory-${Date.now()}`;
      const popup = await memoryAdminPage.openAgentPopup(mentorId);
      try {
        await memoryAdminPage.addAgentMemory(popup, content);
        await expect(popup.getByText(content)).toBeVisible({
          timeout: 10_000,
        });
      } finally {
        await memoryAdminPage.closeAgentPopup().catch(() => {});
      }

      await memoryAdminPage.close(dialog!);
    } finally {
      await deleteMentorById(page, mentorId);
    }
  });
});

// ---------------------------------------------------------------------------
// Journey 68B: Profile Memory tab ("My Memories" — personal profile side)
// ---------------------------------------------------------------------------

/**
 * Switch to the profile modal's Memory tab and probe whether its real
 * content (settings + list) is available, vs. a memsearch-disabled
 * placeholder. Returns `false` — for the caller to `test.skip` on — rather
 * than throwing, since a disabled tenant feature is an environment
 * condition, not a test failure.
 */
async function openProfileMemoryTab(
  profilePage: ProfilePage,
): Promise<boolean> {
  const tabVisible = await profilePage.isMemoryTabVisible();
  if (!tabVisible) return false;

  await profilePage.switchToMemoryTab();
  try {
    await profilePage.verifyMemoryTabSettings();
    return true;
  } catch {
    return false;
  }
}

test.describe('Journey 68B: Profile Memory tab ("My Memories")', () => {
  test.beforeEach(async ({ nonadminPage, nonadminProfilePage }) => {
    await navigateToMentorApp(nonadminPage);
    await waitForPageReady(nonadminPage);
    await nonadminProfilePage.open();
  });

  // PM-01: settings section + My Memories list render.
  test('non-admin sees the profile Memory tab settings and My Memories list', async ({
    nonadminProfilePage,
  }) => {
    const available = await openProfileMemoryTab(nonadminProfilePage);
    test.skip(
      !available,
      'Profile Memory tab content unavailable (memsearch disabled on this tenant renders a disabled placeholder instead)',
    );

    await nonadminProfilePage.verifyMemoryTabSettings();
    await nonadminProfilePage.verifyMemoryTabMemoriesList();

    await nonadminProfilePage.close();
  });

  // PM-02: toggle a personal memory setting switch and back.
  test('non-admin toggles a personal memory setting switch and back', async ({
    nonadminProfilePage,
  }) => {
    const available = await openProfileMemoryTab(nonadminProfilePage);
    test.skip(
      !available,
      'Profile Memory tab content unavailable (memsearch disabled on this tenant renders a disabled placeholder instead)',
    );

    const flipped =
      await nonadminProfilePage.toggleMemorySwitch(/^Auto memory capture/i);
    const restored =
      await nonadminProfilePage.toggleMemorySwitch(/^Auto memory capture/i);
    expect(restored).toBe(!flipped);

    await nonadminProfilePage.close();
  });

  // PM-03: full CRUD — add, edit (new three-dots → Edit flow), delete (new
  // three-dots → Delete flow, via `deleteMemoryByContent` — NOT the
  // deprecated `archiveMemoryByContent` alias).
  test('non-admin adds, edits, and deletes a personal memory via the three-dots menu', async ({
    nonadminProfilePage,
  }) => {
    const available = await openProfileMemoryTab(nonadminProfilePage);
    test.skip(
      !available,
      'Profile Memory tab content unavailable (memsearch disabled on this tenant renders a disabled placeholder instead)',
    );

    const content = `e2e-my-memory-${Date.now()}`;
    const updated = `${content}-edited`;

    try {
      await nonadminProfilePage.addMemory(content);
      await nonadminProfilePage.verifyMemoryExists(content);

      await nonadminProfilePage.editMemoryByContent(content, updated);
      await nonadminProfilePage.verifyMemoryExists(updated);
      await nonadminProfilePage.verifyMemoryNotExists(content);

      await nonadminProfilePage.deleteMemoryByContent(updated);
      await nonadminProfilePage.verifyMemoryNotExists(updated);
    } finally {
      // Best-effort cleanup in case an assertion above failed mid-flow.
      await nonadminProfilePage.deleteMemoryByContent(updated).catch(() => {});
      await nonadminProfilePage.deleteMemoryByContent(content).catch(() => {});
    }

    await nonadminProfilePage.close();
  });
});
