import { test, expect } from '../fixtures/mentor-test';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { MentorTracker } from '../utils/mentor-cleanup';
import { ToolsTab } from '../page-objects/edit-mentor/tools.tab';

/**
 * Journey 77 — Mentor Tools Tab.
 *
 * The Tools tab (`components/modals/edit-mentor-modal/tabs/tools-tab.tsx`)
 * was just moved onto the SDK: it is now a thin wrapper that returns null
 * until tenantKey/agentId/username are known, then renders the SDK's
 * `AgentToolsTab` (`@iblai/iblai-js/web-containers/next`) inside an
 * `AgentSettingsProvider`. All copy — header, the new
 * `data-testid="tools-info-box"` info box, per-tool info-icon and switch
 * aria-labels, and toast text — comes from the SDK's own i18n catalog; OS
 * passes no `labels` override (confirmed by the
 * `chore(i18n): drop the tabsToolsTab messages now owned by the SDK`
 * commit on this branch, which deleted OS's now-dead override strings).
 * See `e2e/page-objects/edit-mentor/tools.tab.ts` for the pinned copy this
 * journey asserts against.
 *
 * ── What the tab renders ───────────────────────────────────────────────
 * One row per tool in the tenant's tool catalogue (`useGetToolsQuery`):
 * the tool's `display_name`, an info ("i") icon (`aria-label`
 * "More info about {name}", a Radix tooltip showing `description` on
 * hover/focus), and a switch (`role=switch`, `aria-label`
 * "{name} enabled"/"{name} disabled", `aria-checked`) whose state is
 * derived from whether the mentor's settings (`useGetMentorSettingsQuery`)
 * include that tool's slug in `mentor_tools`. Toggling calls `editMentor`
 * with the updated `tool_slugs` (+ `can_use_tools`) and shows the
 * "Agent updated successfully" toast — the mutation invalidates the
 * `mentorSettings` RTK Query tag for this mentor, so the tab's own state
 * refreshes without a reload; this journey still verifies persistence via a
 * full `page.reload()` (Settings-tab-modal → close → reload → reopen) to
 * prove the write actually landed server-side rather than only in the
 * client cache.
 *
 * ── Tenant tool-catalogue dependency ───────────────────────────────────
 * A freshly created mentor starts with zero tools attached (`mentor_tools`
 * empty). Every checkpoint that needs at least one existing tool row skips
 * gracefully (never fails) when the tenant's catalogue is empty — mirrors
 * the Grader tab journey's (66) `tryEnableGrading` skip-on-missing-tool
 * pattern, just for "the whole tab has nothing to show" rather than one
 * named tool.
 *
 * ── Isolation strategy ──────────────────────────────────────────────────
 * Toggling a tool mutates the mentor's `tool_slugs` — the exact same field
 * journey 06's mgmt-04 smoke test and the Grader tab's capability toggle
 * both touch. Running this destructively against the shared
 * most-recently-accessed mentor would risk racing (or being raced by) any
 * other suite mutating that mentor's tool list concurrently. Mirrors
 * journeys 47 (Voice) and 66 (Grader) exactly: the whole file runs serially
 * in a single worker (`test.describe.configure({ mode: 'serial' })`) AND
 * every test gets its own freshly-created, disposable mentor via
 * `createMentorPage.openAndCreate()` in `beforeEach` (pinned to the cheap
 * ibl.ai model by `createWithName`'s own `pinLlm()`), tracked and deleted
 * in `afterAll` via `MentorTracker`.
 *
 * ── RBAC / read-only ──────────────────────────────────────────────────
 * `AgentToolsTab` wraps its switches in `WithFormPermissions` (field
 * "mentor_tools"), which only disables a control when EITHER (a) RBAC is
 * enabled (`enableRBAC` prop, wired from `config.enableRBAC()` →
 * `NEXT_PUBLIC_ENABLE_RBAC`) or (b) the mentor-settings response's
 * `permissions.field.mentor_tools` entry explicitly says `write: false`
 * (see `@iblai/web-utils`'s `WithFormPermissions`: an explicit permissions
 * entry is authoritative regardless of the RBAC flag; a field ABSENT from
 * the map is writable whenever RBAC gating is off). This e2e environment's
 * `.env.local` sets no `NEXT_PUBLIC_ENABLE_RBAC` (defaults `false` per
 * `lib/config.ts`), and no fixture here seeds a `permissions.field`
 * response with an explicit `mentor_tools: { write: false }` entry — so the
 * read-only/disabled-switch path is NOT reproducible in this environment.
 * Documented as `tools-06` (status `not-reproducible`) in
 * `e2e/coverage.json` rather than faked with a mocked network response.
 *
 * ── Locale coverage ──────────────────────────────────────────────────────
 * The tab's copy is fully translated (en/es/fr/zh) via the SDK's i18n
 * catalog, but this repo has no established, reliable e2e mechanism for
 * switching the *rendered app's* locale and asserting on the resulting
 * translated text — `ProfilePage.languageSelector` (journey 04) only
 * asserts the selector itself is visible, never that choosing a language
 * actually re-renders visible strings, and no other journey exercises a
 * real locale switch. Building a first one specifically for this tab would
 * go beyond "Tools tab" scope and risks being flaky/unverified. See
 * `tools-07` (status `not-reproducible`) in `e2e/coverage.json`.
 */

test.describe.configure({ mode: 'serial' });

test.describe('Journey 77: Mentor Tools Tab', () => {
  const tracker77 = new MentorTracker();

  test.beforeEach(async ({ page, editMentorPage, createMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Tools tab requires admin access');
      return;
    }

    // Fresh, dedicated mentor per test — see isolation note above.
    await createMentorPage.openAndCreate();
    const { mentorId } = await getPlatformContext(page);
    tracker77.add(mentorId);

    await editMentorPage.open('Tools');
    await waitForPageReady(page);
  });

  // TOOLS-01: Header, description, and the new info box render with the
  // SDK's default copy.
  test('admin opens the Tools tab and sees the header, description, and info box', async ({
    editMentorPage,
  }) => {
    const { tools } = editMentorPage;
    await expect(tools.heading).toBeVisible({ timeout: 10_000 });
    await expect(tools.description).toBeVisible({ timeout: 5_000 });
    await expect(tools.infoBox).toBeVisible({ timeout: 5_000 });
    await expect(tools.infoBox).toHaveText(ToolsTab.LABELS.infoBox);

    await editMentorPage.close();
  });

  // TOOLS-02: Toggling a tool ON flips its switch's aria-checked and shows
  // the success toast, THEN persists across a close + full page reload +
  // reopen. Toggling it back OFF persists the same way. Skips gracefully on
  // a tenant with an empty tool catalogue.
  test('admin toggles a tool on, it persists after reload, then toggles it off and that persists too', async ({
    page,
    editMentorPage,
  }) => {
    const { tools } = editMentorPage;
    const toolNames = await tools.getToolNames();
    test.skip(
      toolNames.length === 0,
      'Tenant tool catalogue is empty — nothing to toggle.',
    );
    const toolName = toolNames[0];

    // A freshly created mentor starts with no tools attached.
    expect(await tools.isToolEnabled(toolName)).toBe(false);

    await tools.enableTool(toolName);
    expect(await tools.isToolEnabled(toolName)).toBe(true);

    await editMentorPage.close();
    await page.reload();
    await waitForPageReady(page);
    await editMentorPage.open('Tools');
    await waitForPageReady(page);

    expect(await editMentorPage.tools.isToolEnabled(toolName)).toBe(true);

    await editMentorPage.tools.disableTool(toolName);
    expect(await editMentorPage.tools.isToolEnabled(toolName)).toBe(false);

    await editMentorPage.close();
    await page.reload();
    await waitForPageReady(page);
    await editMentorPage.open('Tools');
    await waitForPageReady(page);

    expect(await editMentorPage.tools.isToolEnabled(toolName)).toBe(false);

    await editMentorPage.close();
  });

  // TOOLS-03: Each tool's info icon exposes an accessible name of
  // "More info about {name}", and its Radix tooltip reveals the tool's
  // description on both hover and keyboard focus.
  test('a tool info icon is labeled and its tooltip shows the description on hover and focus', async ({
    editMentorPage,
  }) => {
    const { tools } = editMentorPage;
    const toolNames = await tools.getToolNames();
    test.skip(
      toolNames.length === 0,
      'Tenant tool catalogue is empty — no info icon to check.',
    );

    // Hover reveals tool 1's tooltip with non-empty description text.
    const firstIcon = tools.infoIcon(toolNames[0]);
    await expect(firstIcon).toBeVisible({ timeout: 10_000 });
    await firstIcon.hover();
    const firstTooltip = await tools.tooltipFor(toolNames[0]);
    await expect(firstTooltip).toBeVisible({ timeout: 5_000 });
    const hoverText = await firstTooltip.textContent();
    expect(hoverText?.trim().length ?? 0).toBeGreaterThan(0);

    // Keyboard focus reveals it too. A live run showed Radix's Tooltip
    // doesn't reliably close on a synthetic `mouse.move` away from the
    // trigger in this headless environment (the hover-opened tooltip stayed
    // open for the full wait even after moving the pointer to the viewport
    // corner), so this focuses a SECOND tool's icon (when the catalogue has
    // one) and scopes its assertion to that tool's own tooltip (via
    // `tooltipFor`, keyed off `aria-describedby`) — proving focus opens a
    // tooltip independently of the still-open hover one, without depending
    // on that one closing first or on a page-wide `role=tooltip` locator
    // staying single-match. Falls back to re-checking the same icon
    // (weaker, but still asserts focus keeps it open) on a single-tool
    // catalogue.
    const secondToolName = toolNames[1] ?? toolNames[0];
    const secondIcon = tools.infoIcon(secondToolName);
    await secondIcon.focus();
    const secondTooltip = await tools.tooltipFor(secondToolName);
    await expect(secondTooltip).toBeVisible({ timeout: 5_000 });
    const focusText = await secondTooltip.textContent();
    expect(focusText?.trim().length ?? 0).toBeGreaterThan(0);

    await editMentorPage.close();
  });

  // TOOLS-04: A tool switch's accessible name reflects its live state —
  // "{name} disabled" flips to "{name} enabled" the moment it's toggled on,
  // and back again when toggled off. Exercised independently of TOOLS-02's
  // persistence check (this one only cares about the immediate aria-label,
  // not what survives a reload).
  test('a tool switch accessible name reflects enabled/disabled state', async ({
    editMentorPage,
  }) => {
    const { tools } = editMentorPage;
    const toolNames = await tools.getToolNames();
    test.skip(
      toolNames.length === 0,
      'Tenant tool catalogue is empty — no switch to check.',
    );
    const toolName = toolNames[0];

    const offSwitch = editMentorPage.dialog.getByRole('switch', {
      name: `${toolName} disabled`,
      exact: true,
    });
    await expect(offSwitch).toBeVisible({ timeout: 10_000 });

    await tools.enableTool(toolName);

    const onSwitch = editMentorPage.dialog.getByRole('switch', {
      name: `${toolName} enabled`,
      exact: true,
    });
    await expect(onSwitch).toBeVisible({ timeout: 10_000 });
    await expect(offSwitch).toHaveCount(0);

    await tools.disableTool(toolName);
    await expect(offSwitch).toBeVisible({ timeout: 10_000 });

    await editMentorPage.close();
  });

  test.afterAll(async ({ browser }, testInfo) => {
    await tracker77.deleteAll(browser, testInfo);
  });
});

// TOOLS-05 — Non-Admin: Tools tab must stay unreachable ────────────────────
//
// The Edit Agent modal (and therefore every segment, including Tools) is
// only reachable via the "Selected agent" dropdown's "Settings" menu item,
// which a plain non-admin account never sees (journey 06's mgmt-02 already
// covers the dropdown-item-level check for Settings AND Tools together).
// This mirrors journeys 47/63/66's non-admin pattern: try the dropdown
// first, and only fall back to opening the dialog directly in the (here,
// unobserved) case where a non-admin CAN somehow reach it.
test.describe('Journey 77: Mentor Tools Tab — Non-Admin', () => {
  test('non-admin does not see the Tools tab in the Edit Mentor modal', async ({
    nonadminPage,
    nonadminEditMentorPage,
  }) => {
    await navigateToMentorApp(nonadminPage);

    const dropdown = nonadminPage.getByRole('button', {
      name: /^Selected (agent|mentor) dropdown button$/,
    });
    await expect(dropdown).toBeVisible({ timeout: 15_000 });
    await dropdown.click();

    const settingsItem = nonadminPage.getByRole('menuitem', {
      name: 'Settings',
      exact: true,
    });

    let menuItemVisible = false;
    try {
      await settingsItem.waitFor({ state: 'visible', timeout: 3_000 });
      menuItemVisible = true;
    } catch {
      menuItemVisible = false;
    }

    if (!menuItemVisible) {
      // Non-admin cannot open the edit dialog at all — Tools is
      // definitively not reachable. Test passes.
      await nonadminPage.keyboard.press('Escape');
      return;
    }

    // If (in some env) non-admin can open the dialog, verify the Tools tab
    // specifically is still absent.
    await settingsItem.click();
    await expect(nonadminEditMentorPage.dialog).toBeVisible({
      timeout: 15_000,
    });

    await expect(
      nonadminEditMentorPage.dialog.getByRole('tab', {
        name: 'Tools',
        exact: true,
      }),
    ).toHaveCount(0);

    await nonadminEditMentorPage.close();
  });
});

// TOOLS-06 (documentation checkpoint, not-reproducible in this
// environment): the "read-only" / disabled-switch path described in the
// RBAC class doc above. `WithFormPermissions` only disables a tool's switch
// when RBAC is enabled AND/OR the mentor-settings response carries an
// explicit `permissions.field.mentor_tools.write === false` entry. This
// e2e tenant runs with `NEXT_PUBLIC_ENABLE_RBAC` unset (defaults `false`),
// and no fixture here seeds a restricted `permissions.field` response, so
// the disabled-switch UI state cannot be reproduced live. See
// `e2e/coverage.json`'s `tools-06` entry.

// TOOLS-07 (documentation checkpoint, not-reproducible in this
// environment): a locale-switched (e.g. es) render of the tab's translated
// copy. No journey in this repo has an established, reliable way to switch
// the app's live locale and assert on the resulting translated strings —
// see the "Locale coverage" class-doc note above. See `e2e/coverage.json`'s
// `tools-07` entry.
