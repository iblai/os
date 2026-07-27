import { Page } from '@playwright/test';
import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { parsePlatformUrl, safeWaitForURL } from '../utils/navigation';
import { waitForPageReady } from '../utils/resilient';
import { MENTOR_NEXTJS_HOST } from '../fixtures/test-data';
import { CreateMentorPage } from '../page-objects/create-mentor.page';
import { EditMentorPage } from '../page-objects/edit-mentor/edit-mentor.page';
import { MentorTracker } from '../utils/mentor-cleanup';
import { logger } from '@iblai/iblai-js/playwright';

/**
 * Journey 64: Shareable Link RBAC Bypass (issue #2155)
 *
 * `components/chat-input-form.tsx` disables the chat send controls while
 * `isChatDisabledByRbac || !sessionId`, and additionally disables the
 * textarea itself while `isChatDisabledByRbac`. A shareable-link `?token=`
 * only clears `isChatDisabledByRbac` once the backend has ACCEPTED the token
 * and a chat `sessionId` has actually been created
 * (`hasChatPermission = (hasShareableToken && !!sessionId) || <rbac check>`)
 * — the token query param's mere *presence* is not enough. That's the load-
 * bearing design point this journey proves: the backend stays the authority,
 * the frontend never trusts the token by itself.
 *
 * This journey proves that end-to-end against a LIVE backend using real
 * access restrictions configured through the Embed tab's "Who Can View?" /
 * "Who Can Chat?" selects (no `page.route` mocking of RBAC — see the note
 * below on why an anonymous-visitor scenario can't be built this way). Each
 * test provisions its OWN fresh mentor rather than sharing one fixture
 * mentor across cases, so a failure or leftover state in one case can never
 * bleed into another.
 *
 * Cleanup: every provisioned mentor id is registered with `MentorTracker`
 * (`e2e/utils/mentor-cleanup.ts`) and batch-deleted via its fast API-based
 * `deleteAll()` in a single `afterAll` — the same pattern journeys 22, 42,
 * 44, 47 and 52 use, and strictly better than a per-test UI delete (no
 * Edit-Agent-modal navigation/flakiness, one DELETE request per mentor).
 * Mentor names are prefixed "E2E " with a trailing 13-digit timestamp so
 * `mentor-sweeper.ts`'s `globalTeardown` can also reap them as a backstop if
 * a run crashes before `afterAll` runs.
 *
 * Why no anonymous-visitor case: `@iblai/web-utils`'s `MentorProvider` only
 * calls `loadMentorsPermissions` (the mutation that populates the
 * `rbacPermissions` Redux slice `chat-input-form.tsx` reads) when
 * `isLoggedIn` is true. For a never-authenticated visitor, `rbacPermissions`
 * is always `{}`, so `hasMentorRbacData` is always `false` and
 * `hasChatPermission` always defaults to `true` — the RBAC gate this fix
 * touches structurally never applies to anonymous users, with or without a
 * token, with or without this fix. This was verified empirically against the
 * live server: an anonymous visitor on a "Who Can View: Administrators, Who
 * Can Chat: Anyone" mentor gets a fully enabled chat textarea with NO token
 * at all. An anonymous-visitor "token bypass" test would therefore pass
 * identically on unpatched `main` and prove nothing about issue #2155 —
 * Journey 14 already covers the anonymous/public-access happy path.
 *
 * This file must run single-worker/serial: every test provisions and tears
 * down a mentor through the same admin session, and concurrent provisioning
 * against the shared backend has been a source of flakiness in other
 * mentor-lifecycle journeys (see Journey 14).
 */

const RBAC_DENIAL_PLACEHOLDER =
  "Sorry about that! You don't have permission to chat.";

interface ProvisionedMentor {
  mentorId: string;
  platformKey: string;
  shareableToken: string;
}

function mentorUrl(platformKey: string, mentorId: string): string {
  return `${MENTOR_NEXTJS_HOST}/platform/${platformKey}/${mentorId}`;
}

/**
 * Creates a fresh mentor via the admin `page`, locks down its "Who Can
 * View?" / "Who Can Chat?" Embed settings, mints a shareable link, and
 * VERIFIES all three actually persisted (by re-opening a clean Embed tab
 * view and re-reading the selects/toggle) before handing control back to
 * the test. This guards against silently proceeding to the RBAC assertions
 * on a mentor whose settings never actually saved.
 */
async function provisionMentor(
  page: Page,
  createMentorPage: CreateMentorPage,
  editMentorPage: EditMentorPage,
  tracker: MentorTracker,
  opts: { namePrefix: string; whoCanView: string; whoCanChat: string },
): Promise<ProvisionedMentor> {
  // "E2E " prefix + trailing 13-digit timestamp matches `E2E_MENTOR_RE` in
  // `mentor-sweeper.ts`, so a crashed run still gets swept as a backstop.
  const mentorName = await createMentorPage.openAndCreate(
    `E2E ${opts.namePrefix} ${Date.now()}`,
  );
  logger.info(`Journey 64: created mentor "${mentorName}"`);

  const { platformKey, mentorId } = parsePlatformUrl(page.url());
  expect(
    mentorId,
    'mentor creation must produce a mentorId in the URL',
  ).toBeTruthy();
  expect(
    platformKey,
    'mentor creation must produce a platformKey in the URL',
  ).toBeTruthy();

  // Register immediately so the mentor is cleaned up in afterAll even if a
  // later assertion in this test throws.
  tracker.add(mentorId);

  await editMentorPage.open('Embed');
  await waitForPageReady(page);

  await editMentorPage.embed.setWhoCanView(opts.whoCanView);
  await editMentorPage.embed.setWhoCanChat(opts.whoCanChat);
  if (opts.whoCanChat === 'Authenticated Users') {
    // "Who Can Chat? = Authenticated Users" reveals the Website URL field
    // (allow_anonymous=false) — syncEmbedSettings() requires a valid URL to
    // persist mentor_visibility/allow_anonymous at all; without it "Create
    // Embed" silently no-ops on the visibility/chat fields. "Anyone" does
    // not render this field.
    await editMentorPage.embed.fillWebsiteUrl('https://example.com');
  }
  await editMentorPage.embed.submit();

  await editMentorPage.embed.enableShareableLink();
  const shareableToken = await editMentorPage.embed.getShareableLinkToken();
  expect(
    shareableToken.length,
    'a shareable link token must be minted',
  ).toBeGreaterThan(0);
  await editMentorPage.close();

  // Verify the mentor is actually working as configured: re-open a clean
  // Embed tab view (not the one we just submitted from) and confirm the
  // Who Can View / Who Can Chat selections and the shareable link toggle
  // all reflect what we just set, i.e. they really persisted server-side.
  await editMentorPage.open('Embed');
  await waitForPageReady(page);
  await expect(editMentorPage.embed.whoCanViewSelect).toContainText(
    new RegExp(opts.whoCanView, 'i'),
    { timeout: 15_000 },
  );
  await expect(editMentorPage.embed.whoCanChatSelect).toContainText(
    new RegExp(opts.whoCanChat, 'i'),
    { timeout: 15_000 },
  );
  await expect(editMentorPage.embed.shareableLinkToggle).toHaveAttribute(
    'aria-checked',
    'true',
    { timeout: 15_000 },
  );
  await editMentorPage.close();

  logger.info(
    `Journey 64: mentor ${mentorId} verified — view="${opts.whoCanView}" ` +
      `chat="${opts.whoCanChat}" token length ${shareableToken.length}`,
  );

  return { mentorId, platformKey, shareableToken };
}

/**
 * Navigates `nonadminPage` to a freshly-provisioned mentor's chat URL and
 * waits generously for the URL to settle on the intended mentor, returning
 * `false` only if it never does.
 *
 * Empirically (via direct network tracing), a mentor that is only seconds
 * old can trip a transient backend race in the SDK's `MentorProvider` — it
 * can briefly bounce through /error/403 or the Explore page before landing
 * on the intended mentor. This is the exact class of flakiness Journey 59
 * documents for a reload ("Reload can transiently bounce through
 * /error/403 → / → back to the platform URL — wait generously on the
 * [target] rather than asserting the URL immediately") and Journey 32
 * handles with `safeWaitForURL` + a URL predicate rather than a fixed
 * sleep. We follow the same pattern here: `safeWaitForURL` polls
 * (web-first, no blind `waitForTimeout`) until the URL settles on the
 * expected mentor or the generous timeout elapses. A flow that never
 * settles is a genuine failure, not something to paper over — callers must
 * hard-assert the returned boolean (see shl-01/02/03) rather than treat
 * `false` as an alternate pass condition.
 */
async function gotoMentorAsNonAdmin(
  nonadminPage: Page,
  url: string,
  expectedMentorId: string,
): Promise<boolean> {
  await nonadminPage.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });

  try {
    await safeWaitForURL(
      nonadminPage,
      (u) => u.href.includes(expectedMentorId),
      { timeout: 60_000 },
    );
  } catch {
    logger.info(
      `Journey 64: non-admin never settled on mentor ${expectedMentorId} ` +
        `— stuck at ${nonadminPage.url()}`,
    );
    return false;
  }

  await waitForPageReady(nonadminPage);
  // Defensive re-check: safeWaitForURL resolves on the FIRST match, so
  // guard against a later bounce away from the mentor in the brief window
  // before waitForPageReady settles.
  return nonadminPage.url().includes(expectedMentorId);
}

// Every test in this file provisions its own mentor through the same admin
// session against a shared live backend — force single-worker, in-order
// execution so provisioning never overlaps across cases.
test.describe.configure({ mode: 'serial' });

test.describe('Journey 64: Shareable Link RBAC Bypass', () => {
  const tracker = new MentorTracker();

  test.beforeEach(async ({ page }) => {
    test.setTimeout(240_000);
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    test.skip(
      !isAdmin,
      'Requires admin access to provision the shareable-link fixture mentors',
    );
  });

  test.afterAll(async ({ browser }, testInfo) => {
    await tracker.deleteAll(browser, testInfo);
  });

  // shl-01: a logged-in non-admin, who is denied RBAC #chat permission on
  // this Administrators-only / Authenticated-Users-chat mentor, bypasses
  // that denial with a valid shareable-link token and can chat.
  test('non-admin user opens the admin-only mentor chat with a valid shareable-link token and can chat', async ({
    page,
    createMentorPage,
    editMentorPage,
    nonadminPage,
    nonadminChatPage,
  }) => {
    const mentor = await provisionMentor(
      page,
      createMentorPage,
      editMentorPage,
      tracker,
      {
        namePrefix: 'RBAC Bypass (valid token)',
        whoCanView: 'Administrators',
        whoCanChat: 'Authenticated Users',
      },
    );

    const landed = await gotoMentorAsNonAdmin(
      nonadminPage,
      `${mentorUrl(mentor.platformKey, mentor.mentorId)}?token=${mentor.shareableToken}`,
      mentor.mentorId,
    );
    expect(
      landed,
      `non-admin never landed on mentor ${mentor.mentorId} — stuck at ${nonadminPage.url()}`,
    ).toBe(true);

    const chatInput = nonadminChatPage.chatInput;
    await expect(chatInput).toBeVisible({ timeout: 45_000 });
    await expect(chatInput).toBeEnabled({ timeout: 30_000 });
    const placeholder = await chatInput.getAttribute('placeholder');
    expect(placeholder).not.toBe(RBAC_DENIAL_PLACEHOLDER);

    await nonadminChatPage.sendMessage(
      'Hello from the shareable-link RBAC bypass test (valid token)',
    );
    await nonadminChatPage.waitForAIResponse(120_000);
  });

  // shl-02: safety-boundary guard — token *presence* alone must not unlock
  // chat. A non-admin visits with a syntactically-plausible but never-issued
  // token. The backend never accepts it, so no sessionId is ever created;
  // `hasChatPermission`'s `hasShareableToken && !!sessionId` clause stays
  // false and the RBAC denial (`checkRbacPermission`) still applies — the
  // chat textarea must stay disabled exactly as it does with no token at
  // all. (The RBAC *placeholder text* is suppressed whenever a `token` param
  // is present at all, valid or not — `isChatDisabledByRbac &&
  // !hasShareableToken` — so this case is distinguished from shl-03 only by
  // the disabled textarea, not by the placeholder copy.)
  test('non-admin user opens the admin-only mentor chat with an invalid shareable-link token and still cannot chat', async ({
    page,
    createMentorPage,
    editMentorPage,
    nonadminPage,
    nonadminChatPage,
  }) => {
    const mentor = await provisionMentor(
      page,
      createMentorPage,
      editMentorPage,
      tracker,
      {
        namePrefix: 'RBAC Bypass (invalid token)',
        whoCanView: 'Administrators',
        whoCanChat: 'Authenticated Users',
      },
    );

    const landed = await gotoMentorAsNonAdmin(
      nonadminPage,
      `${mentorUrl(mentor.platformKey, mentor.mentorId)}?token=invalid-garbage-token-does-not-exist-12345`,
      mentor.mentorId,
    );
    expect(
      landed,
      `non-admin never landed on mentor ${mentor.mentorId} — stuck at ${nonadminPage.url()}`,
    ).toBe(true);

    const chatInput = nonadminChatPage.chatInput;
    await expect(chatInput).toBeVisible({ timeout: 45_000 });
    logger.info(
      'shl-02: chat textarea rendered with an invalid token — asserting it stays disabled.',
    );
    await expect(chatInput).toBeDisabled({ timeout: 15_000 });
  });

  // shl-03: regression guard — a non-admin user, no token at all. The one
  // deterministic outcome for this combination (Administrators-only view,
  // Authenticated-Users chat, no token) is that the chat surface renders
  // but stays disabled with the RBAC denial placeholder — see
  // chat-input-form.tsx's `isChatDisabledByRbac && !hasShareableToken`
  // branch. There is no separate "access-denied page" for a logged-in
  // non-admin here (view-restriction does not gate page-level access in
  // this app; only the chat capability is RBAC-gated) — so unlike an
  // earlier draft of this test, we do NOT treat "landed somewhere else" or
  // "chat never rendered" as alternate pass conditions. A flow that never
  // reaches that one real, disabled state is a genuine test failure, full
  // stop — no early `return` before the deterministic assertions below.
  test('non-admin user opens the admin-only mentor with no token and cannot chat', async ({
    page,
    createMentorPage,
    editMentorPage,
    nonadminPage,
    nonadminChatPage,
  }) => {
    const mentor = await provisionMentor(
      page,
      createMentorPage,
      editMentorPage,
      tracker,
      {
        namePrefix: 'RBAC Bypass (no token)',
        whoCanView: 'Administrators',
        whoCanChat: 'Authenticated Users',
      },
    );

    const landed = await gotoMentorAsNonAdmin(
      nonadminPage,
      mentorUrl(mentor.platformKey, mentor.mentorId),
      mentor.mentorId,
    );
    expect(
      landed,
      `non-admin never landed on mentor ${mentor.mentorId} — stuck at ${nonadminPage.url()}`,
    ).toBe(true);

    const chatInput = nonadminChatPage.chatInput;
    await expect(chatInput).toBeVisible({ timeout: 60_000 });
    await expect(chatInput).toBeDisabled({ timeout: 15_000 });
    const placeholder = await chatInput.getAttribute('placeholder');
    expect(placeholder).toBe(RBAC_DENIAL_PLACEHOLDER);
  });
});
