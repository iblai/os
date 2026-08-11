/**
 * Journey 67 — Agent Skills
 *
 * Covers the feat/2215 "Agent Skills" frontend surface, which has two parts:
 *
 *   1. Edit Mentor "Skills" tab — GATED BY MENTOR TYPE. Rendered by
 *      `components/modals/edit-mentor-modal/tabs/skills-tab.tsx`, but only
 *      MOUNTED (as a top-level segment tab) when the current mentor resolves
 *      to "Base Agent" — `hooks/use-mentor-segments.ts` →
 *      `resolveIsBaseAgentMentor` (own mentor slug, or its template mentor's
 *      slug, must be one of `base-agent` / `ai-mentor` / `ai-agent`, mirrored
 *      from the SDK's `isBaseAgentMentor` / `BASE_AGENT_TEMPLATE_SLUGS`).
 *      The gate FAILS OPEN (tab stays visible) when the type can't be
 *      determined from the mentor-settings response — e.g. `template_mentor`
 *      is a numeric PK rather than a slug/object the frontend can read.
 *
 *      `CreateMentorPage`'s UI (this suite's only mentor-creation path) has
 *      no agent-type picker and always produces Base Agent mentors — so
 *      there is no way to reach a real non-base-agent mentor through the UI.
 *      The gating tests below therefore mock the mentor-settings response
 *      (`GET .../mentors/{mentor}/settings/`) for a freshly-created,
 *      real mentor, overriding only `mentor_slug`/`template_mentor` via
 *      `route.fetch()` + mutate + `route.fulfill()` (same pattern as
 *      `journeys/auth.setup.ts` and `ChatPage.mockSharedChatSession`) — every
 *      other field in the response stays authentic, so the rest of the Edit
 *      Mentor modal keeps working normally.
 *
 *   2. Skills SECTION management — the SDK's `AgentSkills` component
 *      (sub-tabs, rows, enable toggles, New/Edit/Delete Skill dialogs),
 *      driven exclusively through the dedicated helpers in
 *      `@iblai/iblai-js/playwright`. Moved here from journey 44: Agent
 *      Skills is fully independent of the sandbox (feat/2040 + feat/2215),
 *      so ALL skills coverage — gating, section management, composer —
 *      lives in this journey and the sandbox journey carries none.
 *
 *   3. Chat composer `/` skill picker — `components/chat-input-form.tsx` +
 *      `components/auto-resize-text-area.tsx`, backed by the SDK's
 *      `SlashSkillPicker` / `useSlashSkillPicker`
 *      (`@iblai/iblai-js/web-containers`). Typing `/` as the start of a
 *      single-token message opens a filterable listbox of the mentor's
 *      enabled skills, read from the mentor's skill assignments
 *      (`GET .../agents/{uuid}/skills/` — the platform-wide catalog is
 *      deliberately not fetched from chat). The composer fetches eagerly on
 *      mount — not lazily on first keypress — and its accessible role flips
 *      from `textbox` to `combobox` once that list is non-empty. Determinism
 *      here comes from `ChatPage.mockEffectiveSkills`, which fully replaces
 *      the network response, so these tests run against ANY mentor (no
 *      dedicated mentor / cleanup needed — no mentor state is read or
 *      written).
 *
 * ── Isolation ────────────────────────────────────────────────────────────
 *
 * Skills-tab gating tests each create their own dedicated mentor
 * (`MentorTracker` + `afterAll`, per house style) and run in `parallel`
 * mode: no test touches another test's mentor, and the mentor-settings
 * mock is scoped to one specific mentor id per test, so there is no shared
 * server-side resource to race. Skills SECTION management tests also get a
 * dedicated mentor per test but run `serial` — create/edit/delete mutate
 * the PLATFORM-WIDE skills catalog (shared across the tenant), which must
 * not be raced from parallel workers. Chat composer tests need no mentor
 * isolation at all — see above — and run in `parallel` mode.
 */

import { test, expect } from '../fixtures/mentor-test';
// The SDK's dedicated Agent Skills helpers (split out of the sandbox
// helpers) drive everything inside the skills SECTION; host-owned bits
// (tab heading/info box) stay on the local SkillsTab page object.
import {
  verifySkillsTabVisible,
  switchToAgentSkillsSubTab,
  switchToAvailableSkillsSubTab,
  addSkillToAgent,
  removeSkillFromAgent,
  disableSkill,
  enableSkill,
  verifySkillVisible,
  createSkill,
  editSkill,
  deleteSkill,
} from '@iblai/iblai-js/playwright';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';
import { MentorTracker } from '../utils/mentor-cleanup';
import type { EffectiveSkillFixture } from '../page-objects/chat.page';
import type { Locator, Page } from '@playwright/test';

// ─── Helpers (Skills tab gating) ──────────────────────────────────────────

/** Text labels of the currently-visible Configurations-category segment tabs. */
async function visibleSegmentTabLabels(dialog: Locator): Promise<string[]> {
  return dialog
    .locator('[role="tab"][aria-controls^="panel-"]:visible')
    .allTextContents();
}

/**
 * SEGMENT-tab locator by exact label, resolved FROM the dialog (never the
 * page) so it can only ever match inside the Edit Agent modal. The
 * `[aria-controls^="panel-"]:visible` intersection excludes the category
 * pills (which share `role="tab"` but own no `aria-controls`) and each
 * segment's hidden responsive twin — mirrors journey 44's helper.
 */
function getTab(dialog: Locator, name: string): Locator {
  return dialog
    .getByRole('tab', { name, exact: true })
    .and(dialog.locator('[aria-controls^="panel-"]:visible'));
}

/**
 * Locate a skill row on the "Available Skills" sub-tab, walking the
 * server-paged catalog (10 per page, ordering NOT guaranteed) page by page
 * until the row shows. `createSkill` makes a PLATFORM skill, so a freshly
 * created skill lists here — never on the (default) "Agent Skills" sub-tab
 * — and on a long-lived tenant it can land on any page.
 *
 * Every wait is an element render: clicking Next flips the active page
 * number (`aria-current="page"`) synchronously, then the new page's rows
 * (or the platform empty state) replace the old ones — no fixed sleeps.
 */
async function locateAvailableSkillRow(
  page: Page,
  skillName: string,
): Promise<Locator> {
  await switchToAvailableSkillsSubTab(page);
  const section = page.getByTestId('agent-skills-content');
  const row = section
    .getByTestId('available-skill-row')
    .filter({ hasText: skillName });
  const nav = section.getByRole('navigation');
  const nextButton = nav.getByRole('link', { name: 'Go to next page' });

  for (let pageNumber = 1; ; pageNumber++) {
    if (
      await row
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      return row.first();
    }
    // The pagination nav renders nothing on a single page; Next is
    // aria-disabled on the last one. Either way: no further pages.
    const nextEnabled =
      (await nextButton.isVisible().catch(() => false)) &&
      (await nextButton.getAttribute('aria-disabled')) !== 'true';
    if (!nextEnabled) break;
    await nextButton.click();
    await expect(
      nav.getByRole('link', { name: String(pageNumber + 1), exact: true }),
    ).toHaveAttribute('aria-current', 'page', { timeout: 10_000 });
    await expect(
      section
        .getByTestId('available-skill-row')
        .first()
        .or(section.getByText(/No skills available for this platform/i)),
    ).toBeVisible({ timeout: 10_000 });
  }

  // Retrying final assert — fails with the locator in the message if the
  // skill genuinely never appeared on any catalog page.
  await expect(row.first()).toBeVisible({ timeout: 10_000 });
  return row.first();
}

/**
 * Intercepts the mentor-settings GET for `mentorId` and fulfills it with the
 * REAL response, mutated to override just `mentor_slug` / `template_mentor`
 * — every other field (name, prompts, tools, etc.) stays authentic so the
 * rest of the modal keeps working. Must be registered BEFORE the settings
 * query re-fires (i.e. before a navigation/reload of a page that already
 * has this mentor's settings cached) — see call sites below.
 */
async function mockMentorType(
  page: Page,
  mentorId: string,
  overrides: { mentor_slug?: string; template_mentor?: unknown },
): Promise<void> {
  await page.route(
    (url) => url.pathname.includes(`/mentors/${mentorId}/settings/`),
    async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      Object.assign(json, overrides);
      await route.fulfill({ response, json });
    },
  );
}

// ─── Helpers (chat composer slash picker) ─────────────────────────────────

/**
 * Place the composer caret at an exact index (`'end'` → after the last
 * character). Keyboard Home/End must NOT be used for this: on macOS
 * Chromium they scroll without moving the caret (caret movement is Cmd+←/→
 * there), so e.g. a Home+Delete sequence silently no-ops at the text's end.
 * `setSelectionRange` is deterministic on every platform.
 */
async function placeComposerCaret(
  composer: Locator,
  index: number | 'end',
): Promise<void> {
  await composer.evaluate((el, at) => {
    const textarea = el as HTMLTextAreaElement;
    const caret = at === 'end' ? textarea.value.length : (at as number);
    textarea.focus();
    textarea.setSelectionRange(caret, caret);
  }, index);
}

const SLASH_SKILLS: EffectiveSkillFixture[] = [
  {
    unique_id: 'e2e-skill-web-research',
    name: 'Web Research',
    slug: 'web-research',
    description: 'Research a topic on the open web.',
    category: 'web',
    enabled: true,
  },
  {
    unique_id: 'e2e-skill-code-review',
    name: 'Code Review',
    slug: 'code-review',
    description: 'Reviews code for quality.',
    enabled: true,
  },
  {
    unique_id: 'e2e-skill-disabled',
    name: 'Disabled Skill',
    slug: 'disabled-skill',
    description: 'Should never be offered.',
    enabled: false,
  },
];

// ─── Skills tab gating (admin, mentor type) ───────────────────────────────

test.describe('Journey 67: Agent Skills — Edit Mentor Skills tab gating', () => {
  test.describe.configure({ mode: 'parallel' });

  // Each gating test creates its OWN mentor and deletes it in afterAll (no
  // shared module state — see journey 60's mirrored note on why `parallel`
  // is safe here).
  const tracker = new MentorTracker();

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Skills tab gating requires admin access');
    }
  });

  test.afterAll(async ({ browser }, testInfo) => {
    await tracker.deleteAll(browser, testInfo);
  });

  // ── ags-01: Base Agent mentor — tab visible with the updated copy ────────

  test('admin sees the Skills tab on a freshly-created (Base Agent) mentor, with the updated description and info box copy', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate();
    const { mentorId } = await getPlatformContext(page);
    tracker.add(mentorId);

    await editMentorPage.open('Settings');
    await editMentorPage.navigateToTab('Skills');

    // Capture the dialog once; every nested lookup below resolves from it
    // (or from the dialog-scoped SkillsTab locators built on it).
    const dialog = editMentorPage.dialog;

    // Element-first readiness: the host copy rendering IS the wait.
    await expect(editMentorPage.skills.description).toBeVisible({
      timeout: 10_000,
    });
    await expect(editMentorPage.skills.infoBox).toContainText(
      /Agent Skills are reusable playbooks/i,
    );
    await expect(editMentorPage.skills.infoBox).toContainText(
      /type \/ to see this agent's skills/i,
    );
    // The SDK skills section (Agent Skills / Available Skills sub-tabs)
    // mounted below the host copy.
    await verifySkillsTabVisible(page);

    // Ordering (moved here from journey 44 — the sandbox journey carries no
    // skills assertions): Skills sits right after Prompts in the
    // Configurations category. The description assert above proves the
    // segment list rendered, so this non-retrying label read can't run
    // against an empty list.
    const configTabs = await visibleSegmentTabLabels(dialog);
    const promptsIdx = configTabs.findIndex((t) => /prompts/i.test(t));
    const skillsIdx = configTabs.findIndex((t) => /skills/i.test(t));
    expect(promptsIdx).toBeGreaterThanOrEqual(0);
    expect(skillsIdx).toBe(promptsIdx + 1);

    await editMentorPage.close();
  });

  // ── ags-02: Non-base-agent mentor — tab hidden ────────────────────────────

  test('Skills tab is hidden when the mentor resolves to a non-base-agent type', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate();
    const { mentorId } = await getPlatformContext(page);
    tracker.add(mentorId);

    // Register the override, then force the settings query to re-fire
    // against a fresh JS runtime (a plain reload wipes the RTK Query store).
    await mockMentorType(page, mentorId, {
      mentor_slug: 'google-agent',
      template_mentor: null,
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    // Element-first wait: the chat composer rendering proves the app
    // re-hydrated after the reload — no fixed sleeps, no networkidle.
    await expect(page.locator('#chat-input-textarea')).toBeVisible({
      timeout: 30_000,
    });

    await editMentorPage.open('Settings');

    // Capture the dialog once, then resolve everything from it. Prove the
    // Configurations segment list actually rendered (Prompts is
    // unconditionally present) BEFORE asserting absence — otherwise a
    // "no Skills tab" check could pass vacuously against a list that
    // simply hadn't mounted yet.
    const dialog = editMentorPage.dialog;
    await expect(getTab(dialog, 'Prompts')).toBeVisible({ timeout: 15_000 });
    await expect(
      dialog.getByRole('tab', { name: 'Skills', exact: true }),
    ).toHaveCount(0);

    await editMentorPage.close();
  });

  // ── ags-03: Indeterminate template_mentor — gate fails OPEN ──────────────

  test('Skills tab stays visible when the mentor type cannot be determined (template_mentor is a numeric PK)', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate();
    const { mentorId } = await getPlatformContext(page);
    tracker.add(mentorId);

    // mentor_slug is present but not a base-agent alias, AND template_mentor
    // is a bare number (no slug the frontend can extract) — the documented
    // "indeterminate" case that must fail open per
    // `resolveIsBaseAgentMentor` in hooks/use-mentor-segments.ts.
    await mockMentorType(page, mentorId, {
      mentor_slug: 'custom-agent-xyz',
      template_mentor: 42,
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    // Element-first wait — see ags-02.
    await expect(page.locator('#chat-input-textarea')).toBeVisible({
      timeout: 30_000,
    });

    await editMentorPage.open('Settings');
    await editMentorPage.navigateToTab('Skills');

    // The host copy rendering is the readiness signal.
    await expect(editMentorPage.skills.description).toBeVisible({
      timeout: 10_000,
    });

    await editMentorPage.close();
  });
});

// ─── Skills section management (SDK AgentSkills component) ────────────────
//
// Moved out of journey 44 (feat/2215): Agent Skills is fully independent of
// the sandbox, so its management flows live here with the rest of the
// skills coverage. Everything inside the skills SECTION is driven through
// the SDK's dedicated helpers (`@iblai/iblai-js/playwright`).

test.describe('Journey 67: Agent Skills — skills section management', () => {
  // Serial ON PURPOSE: create/edit/delete mutate the PLATFORM-WIDE skills
  // catalog (shared across the whole tenant), so these mutations must not
  // race each other in parallel workers. The toggle test only touches its
  // own dedicated mentor's assignments, but keeping the whole describe
  // serial keeps the isolation story simple.
  test.describe.configure({ mode: 'serial' });

  const tracker = new MentorTracker();

  test.beforeEach(async ({ page, createMentorPage, editMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Skills management requires admin access');
      return;
    }

    // Dedicated mentor per test — the toggle test mutates mentor-scoped
    // skill assignments, so never share a mentor across tests.
    await createMentorPage.openAndCreate();
    const { mentorId } = await getPlatformContext(page);
    tracker.add(mentorId);

    await editMentorPage.open('Settings');
    await editMentorPage.navigateToTab('Skills');
    // Element-first readiness: the SDK section (with its sub-tabs) having
    // mounted is the wait — no fixed sleeps, no networkidle.
    await verifySkillsTabVisible(page);
  });

  test.afterAll(async ({ browser }, testInfo) => {
    await tracker.deleteAll(browser, testInfo);
  });

  // ── ags-04: Attach a skill and toggle it off/on ──────────────────────────
  //
  // The enable Switch lives on rows of the "Agent Skills" sub-tab — i.e. on
  // skills ATTACHED to this agent. A dedicated fresh mentor has none, so the
  // test builds its own fixture through the real UI: create a platform
  // skill, attach it from the "Available Skills" sub-tab (the assignment is
  // created ENABLED), then round-trip its Switch on the "Agent Skills"
  // sub-tab. Detach + delete on cleanup.

  test('admin attaches a skill and its enable switch round-trips off and back on', async ({
    page,
    editMentorPage,
  }) => {
    const ts = Date.now();
    const skillName = `e2e-toggle-skill-${ts}`;

    // The skills section container — captured once; row lookups resolve
    // from it so a switch elsewhere in the dialog can never be matched.
    const section = page.getByTestId('agent-skills-content');
    const agentRow = section
      .getByTestId('agent-skill-row')
      .filter({ hasText: skillName });

    let created = false;
    let attached = false;

    try {
      await createSkill(page, {
        name: skillName,
        slug: `e2e_toggle_skill_${ts}`,
        description: `E2E toggle fixture created at ${ts}`,
        version: '1.0.0',
        instruction: `Instruction for ${skillName}`,
      });
      created = true;

      // The new skill lists on the server-paged catalog sub-tab.
      await locateAvailableSkillRow(page, skillName);
      await addSkillToAgent(page, skillName);
      attached = true;

      await switchToAgentSkillsSubTab(page);
      await verifySkillVisible(page, skillName);

      // addSkillToAgent creates the assignment ENABLED.
      await expect(agentRow.getByRole('switch')).toHaveAttribute(
        'aria-checked',
        'true',
        { timeout: 10_000 },
      );

      // OFF → ON round trip. The SDK helpers wait on the success toasts;
      // the retrying aria-checked asserts cover the refetch that follows.
      await disableSkill(page, skillName);
      await expect(agentRow.getByRole('switch')).toHaveAttribute(
        'aria-checked',
        'false',
        { timeout: 10_000 },
      );

      await enableSkill(page, skillName);
      await expect(agentRow.getByRole('switch')).toHaveAttribute(
        'aria-checked',
        'true',
        { timeout: 10_000 },
      );
    } finally {
      // Best-effort cleanup: detach from the agent, then delete the
      // platform skill so reruns never accumulate fixtures.
      if (attached) {
        try {
          await switchToAgentSkillsSubTab(page);
          await removeSkillFromAgent(page, skillName);
        } catch {
          // Best-effort
        }
      }
      if (created) {
        try {
          await locateAvailableSkillRow(page, skillName);
          await deleteSkill(page, skillName);
        } catch {
          // Best-effort
        }
      }
      await editMentorPage.close();
    }
  });

  // ── ags-05: Create → edit → delete a skill ───────────────────────────────
  //
  // `createSkill` makes a PLATFORM-level skill: it lists on the "Available
  // Skills" catalog sub-tab, NOT on the (default) "Agent Skills" sub-tab —
  // the row must be located there before the edit/delete row menus exist.

  test('admin creates a new skill, edits its description, and deletes it', async ({
    page,
    editMentorPage,
  }) => {
    const ts = Date.now();
    const skillName = `e2e-test-skill-${ts}`;
    const skillSlug = `e2e_test_skill_${ts}`;
    const skillDescription = `E2E test skill created at ${ts}`;
    const updatedDescription = `E2E updated description ${ts}`;

    let created = false;

    try {
      // ── Create (SDK helper: opens the New Skill dialog, fills the form,
      // waits for the toast) ───────────────────────────────────────────────
      await createSkill(page, {
        name: skillName,
        slug: skillSlug,
        description: skillDescription,
        version: '1.0.0',
        instruction: `Instruction for ${skillName}`,
      });
      created = true;

      // Find the row on the catalog sub-tab (paging until found — catalog
      // ordering is not guaranteed).
      const row = await locateAvailableSkillRow(page, skillName);

      // ── Edit (SDK helper: row menu → Edit Skill dialog → save) ──────────
      await editSkill(page, skillName, { description: updatedDescription });

      // The row survived the edit on the catalog sub-tab.
      await expect(row).toBeVisible({ timeout: 10_000 });

      // ── Delete (SDK helper: row menu → confirm dialog → toast) ──────────
      await deleteSkill(page, skillName);
      created = false;
      await expect(row).toBeHidden({ timeout: 10_000 });
    } finally {
      // Best-effort final cleanup — if the flow broke before the delete.
      if (created) {
        try {
          await locateAvailableSkillRow(page, skillName);
          await deleteSkill(page, skillName);
        } catch {
          // Best-effort
        }
      }
      await editMentorPage.close();
    }
  });
});

// ─── Non-admin: Skills tab hidden ──────────────────────────────────────────
//
// The Skills segment is ADMIN-only (`userTypes: [UserType.ADMIN]` in
// `MENTOR_SEGMENTS`) — moved here from journey 44 with the rest of the
// skills coverage. The composer `/` picker below is intentionally NOT
// admin-gated; this is only about the Edit Mentor tab.

test.describe('Journey 67: Agent Skills — non-admin gating', () => {
  test('non-admin does not see the Skills tab in the Edit Mentor modal', async ({
    nonadminPage,
    nonadminEditMentorPage,
  }) => {
    await navigateToMentorApp(nonadminPage);

    // Non-admin normally cannot open the edit mentor modal at all (the
    // Settings menu item is hidden from the mentor dropdown). The mentor →
    // agent rename moved the dropdown button's accessible name; accept
    // either label so the test is resilient to further renames.
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
      // Non-admin cannot open the edit dialog at all — the Skills tab is
      // definitively not reachable. Test passes.
      await nonadminPage.keyboard.press('Escape');
      return;
    }

    // If (in some env) non-admin can open the dialog, verify the tab is
    // absent — dialog captured first, nested lookups scoped to it.
    await modifyItem.click();
    const dialog = nonadminEditMentorPage.dialog;
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    await expect(
      dialog.getByRole('tablist').getByRole('tab', {
        name: 'Skills',
        exact: true,
      }),
    ).toHaveCount(0, { timeout: 10_000 });

    await nonadminEditMentorPage.close();
  });
});

// ─── Chat composer `/` skill picker ────────────────────────────────────────

test.describe('Journey 67: Agent Skills — chat composer slash skill picker', () => {
  test.describe.configure({ mode: 'parallel' });

  // No shared beforeEach navigation: each test must register its
  // skills mocks BEFORE navigating (ChatInputForm fetches eagerly
  // on mount, not lazily on first `/` keypress), so mock + navigate both
  // happen inside the test body.

  // ── slash-01: No skills — plain textbox, "/" opens nothing ───────────────

  test('mentor with no effective skills: composer stays a plain textbox and "/" opens nothing', async ({
    page,
    chatPage,
  }) => {
    await chatPage.mockEffectiveSkills([]);
    await navigateToMentorApp(page);

    const composer = chatPage.getComposerTextarea();
    await expect(composer).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole('combobox', { name: 'Ask anything' }),
    ).toHaveCount(0);

    await composer.fill('/');
    await expect(chatPage.slashSkillPicker).not.toBeVisible();
  });

  // ── slash-02: Has skills — combobox wiring + only enabled skills listed ──

  test('mentor with effective skills: composer becomes a combobox and "/" opens the picker with only enabled skills', async ({
    page,
    chatPage,
  }) => {
    await chatPage.mockEffectiveSkills(SLASH_SKILLS);
    await navigateToMentorApp(page);

    const combobox = page.getByRole('combobox', { name: 'Ask anything' });
    await expect(combobox).toBeVisible({ timeout: 15_000 });
    await expect(combobox).toHaveAttribute('aria-expanded', 'false');

    const composer = chatPage.getComposerTextarea();
    await composer.fill('/');

    await expect(chatPage.slashSkillPicker).toBeVisible({ timeout: 10_000 });
    await expect(combobox).toHaveAttribute('aria-expanded', 'true');
    await expect(chatPage.getSlashSkillOption('Web Research')).toBeVisible();
    await expect(chatPage.getSlashSkillOption('Code Review')).toBeVisible();
    await expect(chatPage.getSlashSkillOption('Disabled Skill')).toHaveCount(0);
    // Assignment rows carry no descriptions — options are name + slug only
    // (the platform-wide catalog is deliberately not fetched from chat).
    await expect(
      chatPage.slashSkillPicker.getByText('Research a topic on the open web.'),
    ).toHaveCount(0);
  });

  // ── slash-03: Filtering narrows by name and by slug ──────────────────────

  test('typing after "/" filters the picker by both name and slug', async ({
    page,
    chatPage,
  }) => {
    await chatPage.mockEffectiveSkills(SLASH_SKILLS);
    await navigateToMentorApp(page);

    const composer = chatPage.getComposerTextarea();
    await expect(composer).toBeVisible({ timeout: 15_000 });

    await composer.fill('/web');
    await expect(chatPage.getSlashSkillOption('Web Research')).toBeVisible();
    await expect(chatPage.getSlashSkillOption('Code Review')).toHaveCount(0);

    // Matches by slug, not just name.
    await composer.fill('/code-review');
    await expect(chatPage.getSlashSkillOption('Code Review')).toBeVisible();
    await expect(chatPage.getSlashSkillOption('Web Research')).toHaveCount(0);

    // No match — picker closes entirely.
    await composer.fill('/nonexistentskill');
    await expect(chatPage.slashSkillPicker).not.toBeVisible();
  });

  // ── slash-04: Arrow keys move the active option ───────────────────────────

  test('ArrowDown/ArrowUp move the active option and aria-activedescendant follows', async ({
    page,
    chatPage,
  }) => {
    await chatPage.mockEffectiveSkills(SLASH_SKILLS);
    await navigateToMentorApp(page);

    const composer = chatPage.getComposerTextarea();
    await expect(composer).toBeVisible({ timeout: 15_000 });
    await composer.fill('/');
    await expect(chatPage.slashSkillPicker).toBeVisible({ timeout: 10_000 });

    // Starts on the first option — the resolved list is sorted by name,
    // so Code Review precedes Web Research regardless of fixture order.
    await expect(
      chatPage.slashSkillPicker.locator('[aria-selected="true"]').first(),
    ).toContainText('Code Review');
    let activeId = await chatPage.activeSlashSkillOptionId();
    await expect(composer).toHaveAttribute('aria-activedescendant', activeId!);

    await composer.press('ArrowDown');
    await expect(
      chatPage.slashSkillPicker.locator('[aria-selected="true"]').first(),
    ).toContainText('Web Research');
    activeId = await chatPage.activeSlashSkillOptionId();
    await expect(composer).toHaveAttribute('aria-activedescendant', activeId!);

    await composer.press('ArrowUp');
    await expect(
      chatPage.slashSkillPicker.locator('[aria-selected="true"]').first(),
    ).toContainText('Code Review');
  });

  // ── slash-05: Enter completes the token IN PLACE with a highlight ────────
  //
  // Selecting a skill completes `/<slug> ` at the typed token's index in the
  // textarea; a backdrop layer (`data-testid="skill-token-highlight"`, one
  // element per token) paints the active-pill background behind it so the
  // invocation reads as highlighted exactly where it sits in the message.
  // Nothing is submitted by this step.

  test('Enter completes the active option in place, highlighting the token without submitting', async ({
    page,
    chatPage,
  }) => {
    await chatPage.mockEffectiveSkills(SLASH_SKILLS);
    await navigateToMentorApp(page);

    const composer = chatPage.getComposerTextarea();
    await expect(composer).toBeVisible({ timeout: 15_000 });
    await composer.fill('/');
    await expect(chatPage.slashSkillPicker).toBeVisible({ timeout: 10_000 });

    await composer.press('Enter');

    await expect(chatPage.slashSkillPicker).not.toBeVisible();
    // First option alphabetically (sorted by name) is Code Review.
    await expect(composer).toHaveValue('/code-review ');
    await expect(chatPage.skillTokenHighlights).toHaveCount(1);
    await expect(chatPage.skillTokenHighlights).toContainText('/code-review');
    // Nothing was submitted — no user message bubble appended.
    await expect(chatPage.userMessages).toHaveCount(0);
  });

  // ── slash-06: Click (mousedown) completes the clicked skill in place ─────

  test('clicking a picker option completes that token in place', async ({
    page,
    chatPage,
  }) => {
    await chatPage.mockEffectiveSkills(SLASH_SKILLS);
    await navigateToMentorApp(page);

    const composer = chatPage.getComposerTextarea();
    await expect(composer).toBeVisible({ timeout: 15_000 });
    await composer.fill('/');
    await expect(chatPage.slashSkillPicker).toBeVisible({ timeout: 10_000 });

    await chatPage.getSlashSkillOption('Web Research').click();

    await expect(chatPage.slashSkillPicker).not.toBeVisible();
    await expect(composer).toHaveValue('/web-research ');
    await expect(chatPage.skillTokenHighlights).toContainText('/web-research');
  });

  // ── slash-07: Escape dismisses until the token is cleared ────────────────

  test('Escape dismisses the picker until the slash token is cleared, then "/" reopens it', async ({
    page,
    chatPage,
  }) => {
    await chatPage.mockEffectiveSkills(SLASH_SKILLS);
    await navigateToMentorApp(page);

    const composer = chatPage.getComposerTextarea();
    await expect(composer).toBeVisible({ timeout: 15_000 });
    await composer.fill('/');
    await expect(chatPage.slashSkillPicker).toBeVisible({ timeout: 10_000 });

    await composer.press('Escape');
    await expect(chatPage.slashSkillPicker).not.toBeVisible();

    // Still a single slash token — stays dismissed while typing continues.
    await composer.fill('/we');
    await expect(chatPage.slashSkillPicker).not.toBeVisible();

    // Clearing the token re-arms the picker.
    await composer.fill('');
    await composer.fill('/');
    await expect(chatPage.slashSkillPicker).toBeVisible({ timeout: 10_000 });
  });

  // ── slash-08: Multi-word text starting with "/" never opens the picker ───

  test('multi-word text starting with "/" never opens the picker', async ({
    page,
    chatPage,
  }) => {
    await chatPage.mockEffectiveSkills(SLASH_SKILLS);
    await navigateToMentorApp(page);

    const composer = chatPage.getComposerTextarea();
    await expect(composer).toBeVisible({ timeout: 15_000 });
    await composer.fill('/hello world');
    await expect(chatPage.slashSkillPicker).not.toBeVisible();
  });

  // ── slash-09: Backspace/Delete remove the whole token in one stroke ──────

  test('Backspace at the token end and Delete at its start each remove the whole token', async ({
    page,
    chatPage,
  }) => {
    await chatPage.mockEffectiveSkills(SLASH_SKILLS);
    await navigateToMentorApp(page);

    const composer = chatPage.getComposerTextarea();
    await expect(composer).toBeVisible({ timeout: 15_000 });

    // Complete a token, remove it with one Backspace (caret ends up after
    // the trailing space, which the atomic delete swallows too).
    await composer.fill('/');
    await expect(chatPage.slashSkillPicker).toBeVisible({ timeout: 10_000 });
    await composer.press('Enter');
    await expect(composer).toHaveValue('/code-review ');
    await placeComposerCaret(composer, 'end');
    await composer.press('Backspace');
    await expect(composer).toHaveValue('');
    await expect(chatPage.skillTokenHighlights).toHaveCount(0);

    // Complete again, remove with Delete from the token's start.
    await composer.fill('/');
    await expect(chatPage.slashSkillPicker).toBeVisible({ timeout: 10_000 });
    await composer.press('Enter');
    await placeComposerCaret(composer, 0);
    await composer.press('Delete');
    await expect(composer).toHaveValue('');
    await expect(chatPage.skillTokenHighlights).toHaveCount(0);
  });

  // ── slash-10: Backspace after plain text deletes normally ────────────────

  test('Backspace after plain text deletes characters, leaving the token intact', async ({
    page,
    chatPage,
  }) => {
    await chatPage.mockEffectiveSkills(SLASH_SKILLS);
    await navigateToMentorApp(page);

    const composer = chatPage.getComposerTextarea();
    await expect(composer).toBeVisible({ timeout: 15_000 });
    await composer.fill('/');
    await expect(chatPage.slashSkillPicker).toBeVisible({ timeout: 10_000 });
    await composer.press('Enter');
    await placeComposerCaret(composer, 'end');
    await composer.pressSequentially('hi');
    await expect(composer).toHaveValue('/code-review hi');

    await composer.press('Backspace');
    await expect(composer).toHaveValue('/code-review h');
    await expect(chatPage.skillTokenHighlights).toHaveCount(1);
  });

  // ── slash-11: Mid-sentence token removes atomically, seam collapses ──────

  test('a mid-sentence token is removed atomically and the seam space collapses', async ({
    page,
    chatPage,
  }) => {
    await chatPage.mockEffectiveSkills(SLASH_SKILLS);
    await navigateToMentorApp(page);

    const composer = chatPage.getComposerTextarea();
    await expect(composer).toBeVisible({ timeout: 15_000 });
    await composer.fill('say /web-research please');
    // Put the caret right after the token (index 17), then one Backspace.
    await placeComposerCaret(composer, 17);
    await composer.press('Backspace');

    await expect(composer).toHaveValue('say please');
  });

  // ── slash-12: Multiple invocations highlight independently ───────────────

  test('multiple skill invocations in one message are each highlighted', async ({
    page,
    chatPage,
  }) => {
    await chatPage.mockEffectiveSkills(SLASH_SKILLS);
    await navigateToMentorApp(page);

    const composer = chatPage.getComposerTextarea();
    await expect(composer).toBeVisible({ timeout: 15_000 });
    await composer.fill('/web-research then /code-review after');

    await expect(chatPage.skillTokenHighlights).toHaveCount(2);
    await expect(chatPage.skillTokenHighlights.nth(0)).toContainText(
      '/web-research',
    );
    await expect(chatPage.skillTokenHighlights.nth(1)).toContainText(
      '/code-review',
    );

    // Unknown/disabled slugs never highlight.
    await composer.fill('/disabled-skill and /not-a-skill');
    await expect(chatPage.skillTokenHighlights).toHaveCount(0);
  });

  // ── slash-14: "/" token after existing text triggers and splices cleanly ─

  test('a "/" token typed after existing text opens the picker; selecting completes it at that index', async ({
    page,
    chatPage,
  }) => {
    await chatPage.mockEffectiveSkills(SLASH_SKILLS);
    await navigateToMentorApp(page);

    const composer = chatPage.getComposerTextarea();
    await expect(composer).toBeVisible({ timeout: 15_000 });
    await composer.fill('explain this /web');
    await expect(chatPage.slashSkillPicker).toBeVisible({ timeout: 10_000 });

    await chatPage.getSlashSkillOption('Web Research').click();

    await expect(composer).toHaveValue('explain this /web-research ');
    await expect(chatPage.skillTokenHighlights).toContainText('/web-research');

    // A "/" glued inside a word (URLs, and/or) must never trigger.
    await composer.fill('');
    await composer.fill('see https://example.com/web');
    await expect(chatPage.slashSkillPicker).not.toBeVisible();
  });

  // ── slash-16: Skills dropdown button, synced with the `/` picker ─────────
  //
  // A discoverable alternative to typing `/`: a Skills button next to Canvas
  // opens a dropdown of the mentor's enabled skills. Selecting one arms its
  // `/slug` token (highlighted in the composer); the button shows the armed
  // skill's name. Both surfaces derive from the composer text, so arming via
  // the dropdown or via `/` always agree.

  test('Skills dropdown arms/removes tokens and stays in sync with the "/" picker', async ({
    page,
    chatPage,
  }) => {
    await chatPage.mockEffectiveSkills(SLASH_SKILLS);
    await navigateToMentorApp(page);

    const composer = chatPage.getComposerTextarea();
    await expect(composer).toBeVisible({ timeout: 15_000 });
    await expect(chatPage.skillsMenuTrigger).toBeVisible({ timeout: 15_000 });
    await expect(chatPage.skillsMenuTrigger).toContainText('Skills');

    // Arm via the dropdown → token appears highlighted, button shows name.
    await chatPage.openSkillsMenu();
    const webItem = chatPage.getSkillsMenuItem('web-research');
    await expect(webItem).toBeVisible();
    await expect(webItem).toContainText('Web Research');
    // Name only — descriptions live in the `/` picker, not this menu.
    await expect(webItem).not.toContainText(
      'Research a topic on the open web.',
    );
    // Disabled skills never reach the menu.
    await expect(chatPage.getSkillsMenuItem('disabled-skill')).toHaveCount(0);
    await webItem.click();

    await expect(composer).toHaveValue('/web-research ');
    await expect(chatPage.skillTokenHighlights).toHaveCount(1);
    await expect(chatPage.skillsMenuTrigger).toContainText('Web Research');

    // Toggle the armed skill off from the dropdown → token removed.
    await chatPage.openSkillsMenu();
    await chatPage.getSkillsMenuItem('web-research').click();
    await expect(composer).toHaveValue('');
    await expect(chatPage.skillsMenuTrigger).toContainText('Skills');

    // Sync the other way: arming via the `/` picker updates the button.
    await composer.fill('/code');
    await chatPage.getSlashSkillOption('Code Review').click();
    await expect(composer).toHaveValue('/code-review ');
    await expect(chatPage.skillsMenuTrigger).toContainText('Code Review');

    // Single selection: arming another skill from the dropdown REPLACES the
    // currently-armed token (its highlight goes with it), inserting at the
    // caret with context-aware spacing.
    await chatPage.openSkillsMenu();
    // Rows show the slash-invocation form next to the name.
    await expect(chatPage.getSkillsMenuItem('web-research')).toContainText(
      '/web-research',
    );
    await chatPage.getSkillsMenuItem('web-research').click();
    await expect(composer).toHaveValue('/web-research ');
    await expect(chatPage.skillTokenHighlights).toHaveCount(1);
    await expect(chatPage.skillsMenuTrigger).toContainText('Web Research');

    // The active pill carries the same ✕ as other tool pills — clicking it
    // disarms without opening the menu. (Locator is scoped to the trigger
    // it lives in, so it can never resolve ambiguously.)
    await chatPage.skillsMenuClear.click();
    await expect(composer).toHaveValue('');
    await expect(chatPage.skillTokenHighlights).toHaveCount(0);
    await expect(chatPage.skillsMenuTrigger).toContainText('Skills');
  });

  // ── slash-15: NON-ADMIN uses the picker and gets an AI reply ─────────────
  //
  // The `/` picker is available to students, not just admins — PROVIDED the
  // backend lets them read the assignments endpoint (the composer's only
  // skill source; a 403 degrades to an inactive picker). `mockStudentSkills`
  // simulates that granted state. The invocation is a prompt hint, so after
  // selecting a skill and sending, the agent must reply like any other
  // message (live LLM round trip — same pattern as journey 02's non-admin
  // chat checkpoints).
  //
  // PRECONDITION: the non-admin user must be allowed to CHAT with the
  // default mentor at all. Some environments deny that outright — the
  // composer renders disabled with a "you don't have permission to chat"
  // placeholder. The `/` picker rides on top of chat permission, so that
  // state fails the test's precondition, not the feature: skip, mirroring
  // journey 44's env-precondition skips.

  test('non-admin: "/" offers the mentor\'s skills and the sent invocation gets a reply', async ({
    nonadminPage,
    nonadminChatPage,
  }) => {
    await nonadminChatPage.mockStudentSkills(SLASH_SKILLS);
    await navigateToMentorApp(nonadminPage);

    const composer = nonadminChatPage.getComposerTextarea();
    // Wait for the permission state to SETTLE before branching: the
    // placeholder resolves to either the ready state ("Ask anything") or
    // the denied state — never assert against the in-between.
    await expect(composer).toHaveAttribute(
      'placeholder',
      /Ask anything|permission to chat/i,
      { timeout: 15_000 },
    );
    if (
      /permission to chat/i.test(
        (await composer.getAttribute('placeholder')) ?? '',
      )
    ) {
      test.skip(
        true,
        'Non-admin has no chat permission for this mentor in this environment (composer disabled) — the slash-picker flow requires chat access',
      );
      return;
    }
    await expect(composer).toBeVisible({ timeout: 15_000 });

    await composer.fill('/web');
    await expect(nonadminChatPage.slashSkillPicker).toBeVisible({
      timeout: 10_000,
    });
    await nonadminChatPage.getSlashSkillOption('Web Research').click();

    await expect(composer).toHaveValue('/web-research ');
    await expect(nonadminChatPage.skillTokenHighlights).toContainText(
      '/web-research',
    );

    // Continue the message and send it.
    await placeComposerCaret(composer, 'end');
    await composer.pressSequentially('please say hello');
    await composer.press('Enter');

    await expect(nonadminChatPage.userMessages.last()).toContainText(
      '/web-research',
    );
    await nonadminChatPage.waitForAIResponse();
    await expect(nonadminChatPage.aiMessages.last()).toBeVisible();
  });

  // ── slash-13: Loading popover while the skill list is still resolving ────
  //
  // The assignments fetch (the composer's only skill source) fires eagerly
  // on composer mount. If the user types a `/` token before it settles, a
  // "Loading skills…" popover (data-testid="slash-skill-loading",
  // role=status) renders in the picker's anchor position, then yields to
  // the real picker once the response lands. The route below HOLDS the
  // response until the test releases it, making the in-flight window
  // deterministic.

  test('typing "/" while skills are still loading shows the loading popover, which yields to the picker', async ({
    page,
    chatPage,
  }) => {
    let releaseSkills!: () => void;
    const gate = new Promise<void>((resolve) => (releaseSkills = resolve));
    await page.route(
      (url) => /\/agents\/[^/]+\/skills\//.test(url.pathname),
      async (route) => {
        await gate;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            SLASH_SKILLS.map((skill, index) => ({
              id: index + 1,
              mentor: 'e2e-mentor',
              skill: skill.unique_id,
              skill_name: skill.name,
              skill_slug: skill.slug,
              enabled: true,
            })),
          ),
        });
      },
    );
    await navigateToMentorApp(page);
    const composer = chatPage.getComposerTextarea();
    await expect(composer).toBeVisible({ timeout: 15_000 });

    await composer.fill('/');
    await expect(page.getByTestId('slash-skill-loading')).toBeVisible({
      timeout: 10_000,
    });
    await expect(chatPage.slashSkillPicker).not.toBeVisible();

    releaseSkills();
    await expect(chatPage.slashSkillPicker).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('slash-skill-loading')).not.toBeVisible();
  });
});
