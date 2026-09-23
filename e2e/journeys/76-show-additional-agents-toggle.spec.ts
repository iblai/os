/**
 * Journey 76 — "Show Additional Agents" Toggle (issue #2544)
 *
 * Adds coverage for the new `show_explore_mentors` mentor setting: a switch
 * in the Edit Agent modal's Settings tab → Capabilities sub-tab → Advanced
 * section, labelled "Show additional agents"
 * (`data-testid="settings-show-explore-mentors-switch"`). It gates the
 * OS-specific "Explore Agents" section (`components/welcome-chat/
 * explore-mentors.tsx`) that renders on an agent's own (non-project)
 * welcome screen (`components/welcome-chat-new.tsx`).
 *
 * ── Backend default is NOT what the issue text says ─────────────────────────
 * The issue asks for `show_explore_mentors` to default to `false` on newly
 * created agents. As of this writing the backend actually defaults it to
 * `true` for freshly created agents in this environment. Rather than assert
 * a specific default (which would make this suite fail against the current
 * backend for a reason unrelated to the OS-side change under test), every
 * test below explicitly drives the toggle to a known state first and
 * asserts the round trip. See the final report for this caveat.
 *
 * ── The field-level-RBAC bug this journey specifically guards against ──────
 * `hooks/use-mentors/use-mentor-settings.ts` used to read
 * `effectiveSettings?.show_explore_mentors ?? effectivePublicSettings?.
 * show_explore_mentors ?? false`. Field-level RBAC returns an unreadable
 * field as `""` (not `null`/`undefined`) for a logged-in NON-OWNER's
 * `/settings/` GET, and `"" ?? x` short-circuits to `""` (a falsy but
 * *present* value), so the public-settings fallback and the `false` default
 * were both unreachable — non-owner viewers never saw the section even when
 * the owner had it ON. The fix only treats a real boolean as present
 * (`asBoolean` in the hook). sem-05 below is the regression test: it drives
 * a NON-ADMIN, non-owner session to the same agent and asserts the section
 * is visible.
 *
 * ── Project landing page is intentionally unaffected (not covered here) ────
 * `WelcomeChatNew`'s `projectId` branch renders the SDK's `ProjectLandingPage`
 * with a hard-coded `showExploreMentors` prop (JSX shorthand for `true`) —
 * it never reads the `showExploreMentors` value destructured from
 * `useMentorSettings()` at all. That prop gates a completely different SDK
 * feature (per-project "mentors in this project" list), not the tenant-wide
 * "Explore Agents" section this journey tests. Confirmed by reading
 * `components/welcome-chat-new.tsx`'s `projectId` branch directly; no
 * project fixture is exercised here since the code path provably never
 * consults the new setting.
 *
 * ── Shared-mentor, serial design ─────────────────────────────────────────
 * One throw-away mentor is created by sem-01 and reused (by URL) by every
 * later checkpoint in this file, matching journey 57's rationale: these
 * checkpoints toggle the SAME setting back and forth, so running them out of
 * order (or in parallel) would race. `describe.serial` guarantees order
 * within a worker; the mentor is auto-registered for cleanup by
 * `CreateMentorPage.createWithName` (see `e2e/utils/resource-tracker.ts`) —
 * no manual `MentorTracker` bookkeeping is needed.
 */

import { test, expect } from '../fixtures/mentor-test';
import { MENTOR_NEXTJS_HOST, generateMentorName } from '../fixtures/test-data';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import type { Page } from '@playwright/test';

/** Skips the current test when the acting session isn't admin (must be called after navigation). */
async function skipIfNotAdmin(page: Page): Promise<void> {
  const isAdmin = await checkAdminStatus(page);
  if (!isAdmin) test.skip(true, 'Requires admin access');
}

/**
 * Pulls a form field's value out of a captured request body, supporting
 * both multipart/form-data (the settings PUT's actual encoding) and JSON,
 * so this doesn't need to hard-depend on one wire format.
 */
function extractFieldValue(body: string, field: string): string | undefined {
  const multipart = body.match(
    new RegExp(`name="${field}"\\r?\\n\\r?\\n([^\\r\\n]*)`),
  );
  if (multipart) return multipart[1];
  const json = body.match(new RegExp(`"${field}"\\s*:\\s*("?)([^,"}]*)\\1`));
  if (json) return json[2];
  return undefined;
}

/** The OS-specific welcome-screen section heading (welcome-chat/explore-mentors.tsx). */
function exploreAgentsHeading(page: Page) {
  return page.getByRole('heading', { name: /explore agents/i });
}

test.describe.serial('Journey 76: Show Additional Agents Toggle', () => {
  test.setTimeout(120_000);

  let mentorUrl = '';

  test('sem-01: admin sees the "Show additional agents" toggle under Capabilities > Advanced with the right label, testid, and tooltip', async ({
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

    // Make the agent viewable by a non-admin, non-owner tenant user — needed
    // by sem-05's RBAC regression check later in this suite.
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await editMentorPage.settings.setVisibilityAnyone();
    await editMentorPage.settings.setChatAccessAnyone();
    await expect(editMentorPage.settings.saveButton).toBeEnabled({
      timeout: 10_000,
    });
    await editMentorPage.settings.saveButton.click();
    await expect(
      page.getByText(/agent updated successfully/i).first(),
    ).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(500);

    // sem-01: the toggle itself — label, testid, tooltip.
    await editMentorPage.settings.selectSubTab('Capabilities');
    await expect(editMentorPage.settings.showExploreMentorsToggle).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      editMentorPage.settings.showExploreMentorsToggle,
    ).toHaveAttribute('data-testid', 'settings-show-explore-mentors-switch');
    await expect(
      editMentorPage.dialog.getByText('Show additional agents', {
        exact: true,
      }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      editMentorPage.settings.showExploreMentorsInfoButton,
    ).toBeVisible({ timeout: 5_000 });

    await editMentorPage.close();
  });

  test('sem-02: admin toggles it ON, Save PUTs show_explore_mentors=true, and it reads back ON after reopening', async ({
    page,
    editMentorPage,
  }) => {
    test.skip(!mentorUrl, 'sem-01 setup did not run (skipped or failed)');
    await navigateToMentorApp(page, mentorUrl);
    await skipIfNotAdmin(page);

    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    // Start from OFF so the toggle-ON below is a genuine, observable change.
    await editMentorPage.settings.setShowExploreMentors(false);

    const [request] = await Promise.all([
      page.waitForRequest(
        (req) =>
          ['PUT', 'PATCH'].includes(req.method()) &&
          (req.postData() ?? '').includes('show_explore_mentors'),
        { timeout: 30_000 },
      ),
      editMentorPage.settings.setShowExploreMentors(true),
    ]);
    const value = extractFieldValue(
      request.postData() ?? '',
      'show_explore_mentors',
    );
    expect(value, 'settings PUT should carry show_explore_mentors=true').toBe(
      'true',
    );

    await editMentorPage.close();

    // Persistence: close + reopen re-fetches settings from the server.
    await navigateToMentorApp(page, mentorUrl);
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    expect(await editMentorPage.settings.isShowExploreMentorsEnabled()).toBe(
      true,
    );
    await editMentorPage.close();
  });

  test('sem-03: admin toggles it OFF, Save PUTs show_explore_mentors=false, and it reads back OFF after reopening', async ({
    page,
    editMentorPage,
  }) => {
    test.skip(!mentorUrl, 'sem-01 setup did not run (skipped or failed)');
    await navigateToMentorApp(page, mentorUrl);
    await skipIfNotAdmin(page);

    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    // sem-02 left it ON — toggling OFF here is a genuine change.
    const [request] = await Promise.all([
      page.waitForRequest(
        (req) =>
          ['PUT', 'PATCH'].includes(req.method()) &&
          (req.postData() ?? '').includes('show_explore_mentors'),
        { timeout: 30_000 },
      ),
      editMentorPage.settings.setShowExploreMentors(false),
    ]);
    const value = extractFieldValue(
      request.postData() ?? '',
      'show_explore_mentors',
    );
    expect(value, 'settings PUT should carry show_explore_mentors=false').toBe(
      'false',
    );

    await editMentorPage.close();

    await navigateToMentorApp(page, mentorUrl);
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    expect(await editMentorPage.settings.isShowExploreMentorsEnabled()).toBe(
      false,
    );
    await editMentorPage.close();
  });

  test('sem-04: with the toggle ON, the agent welcome screen shows the Explore Agents section for the admin', async ({
    page,
    editMentorPage,
  }) => {
    test.skip(!mentorUrl, 'sem-01 setup did not run (skipped or failed)');
    await navigateToMentorApp(page, mentorUrl);
    await skipIfNotAdmin(page);

    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await editMentorPage.settings.setShowExploreMentors(true);
    await editMentorPage.close();

    // Force a fresh fetch of mentor settings on a clean navigation rather
    // than relying on RTK Query cache-invalidation propagation timing.
    await navigateToMentorApp(page, mentorUrl);
    await waitForPageReady(page);
    await expect(exploreAgentsHeading(page)).toBeVisible({ timeout: 30_000 });
  });

  test('sem-05: with the toggle ON, a non-admin, non-owner viewer of the same agent also sees the Explore Agents section (RBAC redaction regression)', async ({
    nonadminPage,
  }) => {
    test.skip(!mentorUrl, 'sem-01 setup did not run (skipped or failed)');
    // Relies on sem-04 having left the toggle ON on this shared mentor.
    await navigateToMentorApp(nonadminPage, mentorUrl);
    await waitForPageReady(nonadminPage);
    await expect(exploreAgentsHeading(nonadminPage)).toBeVisible({
      timeout: 30_000,
    });
  });

  test('sem-06: with the toggle OFF, the agent welcome screen hides the Explore Agents section', async ({
    page,
    editMentorPage,
  }) => {
    test.skip(!mentorUrl, 'sem-01 setup did not run (skipped or failed)');
    await navigateToMentorApp(page, mentorUrl);
    await skipIfNotAdmin(page);

    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await editMentorPage.settings.setShowExploreMentors(false);
    await editMentorPage.close();

    await navigateToMentorApp(page, mentorUrl);
    await waitForPageReady(page);
    await expect(exploreAgentsHeading(page)).not.toBeVisible({
      timeout: 10_000,
    });
  });
});
