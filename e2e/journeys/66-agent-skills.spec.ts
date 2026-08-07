/**
 * Journey 66 — Agent Skills
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
 *      Mentor modal keeps working normally. Journey 44 already covers the
 *      tab's content/behavior once mounted (always visible for the Base
 *      Agent mentors it creates); this journey covers the mentor-type gate
 *      itself, which journey 44 cannot reach.
 *
 *   2. Chat composer `/` skill picker — `components/chat-input-form.tsx` +
 *      `components/auto-resize-text-area.tsx`, backed by the SDK's
 *      `SlashSkillPicker` / `useSlashSkillPicker`
 *      (`@iblai/iblai-js/web-containers`). Typing `/` as the start of a
 *      single-token message opens a filterable listbox of the mentor's
 *      enabled effective skills, resolved client-side from skill assignments
 *      (`GET .../agents/{uuid}/skills/`) plus the skill catalog
 *      (`GET .../agent-skills/`). The composer fetches eagerly on
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
 * server-side resource to race (unlike journey 44's sandbox-instance table).
 * Chat composer tests need no mentor isolation at all — see above — and also
 * run in `parallel` mode.
 */

import { test, expect } from '../fixtures/mentor-test';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
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

test.describe('Journey 66: Agent Skills — Edit Mentor Skills tab gating', () => {
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
    await waitForPageReady(page);

    await expect(editMentorPage.skills.description).toBeVisible({
      timeout: 10_000,
    });
    await expect(editMentorPage.skills.infoBox).toContainText(
      /Agent Skills are reusable playbooks/i,
    );
    await expect(editMentorPage.skills.infoBox).toContainText(
      /type \/ to see this agent's skills/i,
    );

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
    await waitForPageReady(page);

    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    const configTabs = await visibleSegmentTabLabels(editMentorPage.dialog);
    expect(configTabs.some((t) => /skills/i.test(t))).toBe(false);

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
    await waitForPageReady(page);

    await editMentorPage.open('Settings');
    await editMentorPage.navigateToTab('Skills');
    await waitForPageReady(page);

    await expect(editMentorPage.skills.description).toBeVisible({
      timeout: 10_000,
    });

    await editMentorPage.close();
  });
});

// ─── Chat composer `/` skill picker ────────────────────────────────────────

test.describe('Journey 66: Agent Skills — chat composer slash skill picker', () => {
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
    await waitForPageReady(page);

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
    await waitForPageReady(page);

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
    await expect(
      chatPage.slashSkillPicker.getByText('Research a topic on the open web.'),
    ).toBeVisible();
  });

  // ── slash-03: Filtering narrows by name and by slug ──────────────────────

  test('typing after "/" filters the picker by both name and slug', async ({
    page,
    chatPage,
  }) => {
    await chatPage.mockEffectiveSkills(SLASH_SKILLS);
    await navigateToMentorApp(page);
    await waitForPageReady(page);

    const composer = chatPage.getComposerTextarea();

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
    await waitForPageReady(page);

    const composer = chatPage.getComposerTextarea();
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
    await waitForPageReady(page);

    const composer = chatPage.getComposerTextarea();
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
    await waitForPageReady(page);

    const composer = chatPage.getComposerTextarea();
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
    await waitForPageReady(page);

    const composer = chatPage.getComposerTextarea();
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
    await waitForPageReady(page);

    const composer = chatPage.getComposerTextarea();
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
    await waitForPageReady(page);

    const composer = chatPage.getComposerTextarea();

    // Complete a token, remove it with one Backspace (caret ends up after
    // the trailing space, which the atomic delete swallows too).
    await composer.fill('/');
    await expect(chatPage.slashSkillPicker).toBeVisible({ timeout: 10_000 });
    await composer.press('Enter');
    await expect(composer).toHaveValue('/code-review ');
    await composer.press('End');
    await composer.press('Backspace');
    await expect(composer).toHaveValue('');
    await expect(chatPage.skillTokenHighlights).toHaveCount(0);

    // Complete again, remove with Delete from the token's start.
    await composer.fill('/');
    await expect(chatPage.slashSkillPicker).toBeVisible({ timeout: 10_000 });
    await composer.press('Enter');
    await composer.press('Home');
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
    await waitForPageReady(page);

    const composer = chatPage.getComposerTextarea();
    await composer.fill('/');
    await expect(chatPage.slashSkillPicker).toBeVisible({ timeout: 10_000 });
    await composer.press('Enter');
    await composer.press('End');
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
    await waitForPageReady(page);

    const composer = chatPage.getComposerTextarea();
    await composer.fill('say /web-research please');
    // Put the caret right after the token (index 17), then one Backspace.
    await composer.evaluate((el) => {
      (el as HTMLTextAreaElement).setSelectionRange(17, 17);
    });
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
    await waitForPageReady(page);

    const composer = chatPage.getComposerTextarea();
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
    await waitForPageReady(page);

    const composer = chatPage.getComposerTextarea();
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
    await waitForPageReady(page);

    const composer = chatPage.getComposerTextarea();
    await expect(chatPage.skillsMenuTrigger).toBeVisible({ timeout: 15_000 });
    await expect(chatPage.skillsMenuTrigger).toContainText('Skills');

    // Arm via the dropdown → token appears highlighted, button shows name.
    await chatPage.skillsMenuTrigger.click();
    const webItem = chatPage.getSkillsMenuItem('web-research');
    await expect(webItem).toBeVisible();
    await expect(webItem).toContainText('Web Research');
    await expect(webItem).toContainText('Research a topic on the open web.');
    // Disabled skills never reach the menu.
    await expect(chatPage.getSkillsMenuItem('disabled-skill')).toHaveCount(0);
    await webItem.click();

    await expect(composer).toHaveValue('/web-research ');
    await expect(chatPage.skillTokenHighlights).toHaveCount(1);
    await expect(chatPage.skillsMenuTrigger).toContainText('Web Research');

    // Toggle the armed skill off from the dropdown → token removed.
    await chatPage.skillsMenuTrigger.click();
    await chatPage.getSkillsMenuItem('web-research').click();
    await expect(composer).toHaveValue('');
    await expect(chatPage.skillsMenuTrigger).toContainText('Skills');

    // Sync the other way: arming via the `/` picker updates the button.
    await composer.fill('/code');
    await chatPage.getSlashSkillOption('Code Review').click();
    await expect(composer).toHaveValue('/code-review ');
    await expect(chatPage.skillsMenuTrigger).toContainText('Code Review');
  });

  // ── slash-15: NON-ADMIN uses the picker and gets an AI reply ─────────────
  //
  // The `/` picker is available to students, not just admins. This runs in
  // the non-admin browser context under the REALISTIC student permission
  // shape (`mockStudentSkills`): the assignments endpoint 403s and only the
  // student-readable catalog answers, with the fixtures as mentor-private
  // skills. The invocation is a prompt hint, so after selecting a skill and
  // sending, the agent must reply like any other message (live LLM round
  // trip — same pattern as journey 02's non-admin chat checkpoints).

  test('non-admin: "/" offers skills despite the admin-only assignments 403, and the sent invocation gets a reply', async ({
    nonadminPage,
    nonadminChatPage,
  }) => {
    await nonadminChatPage.mockStudentSkills(SLASH_SKILLS);
    await navigateToMentorApp(nonadminPage);
    await waitForPageReady(nonadminPage);

    const composer = nonadminChatPage.getComposerTextarea();
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
    await composer.press('End');
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
  // The skills fetches (assignments + catalog) fire eagerly on composer
  // mount. If the user types a `/` token before they settle, a "Loading
  // skills…" popover (data-testid="slash-skill-loading", role=status)
  // renders in the picker's anchor position, then yields to the real picker
  // once the responses land. The routes below HOLD the responses until the
  // test releases them, making the in-flight window deterministic.

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
    await page.route(
      (url) => url.pathname.includes('/agent-skills/'),
      async (route) => {
        await gate;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            SLASH_SKILLS.map((skill) => ({ ...skill, mentor: null })),
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
