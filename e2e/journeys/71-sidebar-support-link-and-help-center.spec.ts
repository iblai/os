/**
 * Journey 71 — Sidebar Support Link & Help Center Resolution (#uat-9)
 *
 * UAT bug: the sidebar footer's "Support" link (and the nav-bar "More
 * options → Help" menu item) were hardcoded to `https://ibl.ai/docs`
 * regardless of tenant configuration. `hooks/use-help-center.ts` now
 * resolves both destinations from tenant metadata:
 *
 *   documentationUrl = metadata.documentation_url || config.documentationUrl()
 *                       (config default: https://ibl.ai/docs)
 *   helpCenterUrl     = metadata.support_url || metadata.help_center_url
 *                       || config.helpCenterUrl()
 *   showHelp          = metadata.show_help !== false
 *
 * Both values are passed through `addProtocolToUrl`, which prefixes
 * `https://` onto a scheme-less value.
 *
 * ── Two surfaces under test ──────────────────────────────────────────────
 *
 * 1. Sidebar footer "Support" link (`app-sidebar/index.tsx`) — label stayed
 *    "Support" (kept as-is on product's instruction; only the href and the
 *    show/hide behavior changed), rendered in BOTH the expanded layout
 *    (visible text + href) and the rail-collapsed layout
 *    (`SidebarCollapsedLabelFlyout`, `aria-label="Support"` on the anchor).
 *    Gated on `showHelp`.
 *
 * 2. Nav-bar "More options → Help" dropdown item (SDK `UserProfileDropdown`,
 *    `app/.../_components/nav-bar/user-profile.tsx`) — resolves from
 *    `support_url || help_center_url || helpCenterUrl` (the SDK's own
 *    internal tenant-metadata read, independent of the local
 *    `useHelpCenter` hook, but driven by the SAME tenant metadata keys).
 *
 * Root cause of the original bug: the e2e helper that guarded this surface
 * (`SidebarPage.isSupportLinkVisible`) only ever asserted VISIBILITY, never
 * the link's DESTINATION — so a hardcoded wrong-domain href passed CI
 * unnoticed for months. `SidebarPage.getSupportLinkHref()` (added alongside
 * this journey) closes that gap; every checkpoint below asserts on the
 * resolved href/URL, not just presence.
 *
 * ── Shared, live tenant state — describe.serial is mandatory ─────────────
 *
 * Every test in this file mutates the SAME org-scoped tenant metadata
 * (`support_url`, `help_center_url`, `documentation_url`, `show_help`) on
 * the shared `conradtesttenant` backend, via `setTenantMetadataFlag`
 * (`e2e/utils/tenant-metadata.ts`) — a read-merge-PATCH helper that always
 * re-fetches the current blob before merging, so it never wipes keys this
 * suite didn't touch. Running these tests in parallel workers would race
 * concurrent PATCHes against the same tenant (the same class of bug this
 * project hit with the chat-privacy gate — see journey 50), so the whole
 * file runs `describe.serial`.
 *
 * Restoration is belt-and-braces:
 *   - `beforeAll` captures the FULL tenant metadata blob once, before any
 *     test mutates anything.
 *   - Every mutating test undoes its OWN change in a `try/finally` (or,
 *     for the "restore should bring it back" tests, as part of the test's
 *     own assertions) so the suite stays order-independent even under a
 *     single test failure.
 *   - `afterAll` (runs even on failure) does an ATOMIC full-blob PATCH back
 *     to the captured original via `restoreTenantMetadata` — a single
 *     request, not N sequential per-key patches — as the final safety net,
 *     then re-fetches and asserts every support/help-center-related key
 *     matches what was captured, proving the tenant was left exactly as
 *     found.
 *
 * Requires the `DM_URL` env var (the DM API base, e.g.
 * `https://api.iblai.org/dm`) to reach the tenant-metadata endpoint
 * directly — there is no UI path to `support_url` / `help_center_url` /
 * `documentation_url` / `show_help` in this app (the SDK's
 * `UserProfileDropdown` is mounted with `showAccountTab={false}`, so the
 * Organization tab that would normally expose them is never reachable).
 * Every test self-skips when `DM_URL` is absent, matching the established
 * convention in journey 43.
 */

import path from 'path';
import { test, expect } from '../fixtures/mentor-test';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import {
  getTenantMetadata,
  setTenantMetadataFlag,
  restoreTenantMetadata,
} from '../utils/tenant-metadata';
import { DM_URL } from '../fixtures/test-data';

// ─── Constants ────────────────────────────────────────────────────────────

// Mirrors lib/config.ts's `documentationUrl()` default. Not imported
// directly (the app's config module isn't part of the e2e TS project) —
// this reads the SAME env var the app build reads, so it stays correct if
// a deployment ever overrides it via NEXT_PUBLIC_DOCUMENTATION_URL.
const DEFAULT_DOCUMENTATION_URL =
  process.env.NEXT_PUBLIC_DOCUMENTATION_URL || 'https://ibl.ai/docs';

// Distinctive, timestamped test values so failures are unambiguous and a
// stale value from a previous crashed run can never be mistaken for a
// fresh assertion.
const RUN_ID = Date.now();
const TEST_DOC_URL_WITH_SCHEME = `https://docs.e2e-uat9-${RUN_ID}.example/help`;
const TEST_DOC_URL_NO_SCHEME = `docs.e2e-uat9-${RUN_ID}.example`;
const TEST_HELP_CENTER_URL_NO_SCHEME = `help.e2e-uat9-${RUN_ID}.example`;
const BASELINE_SUPPORT_URL = 'ibl.ai/support';

// The keys this journey ever touches — restoration is verified on exactly
// this set (not a deep-equal of the entire tenant metadata blob), since
// OTHER journeys running concurrently in other workers may legitimately
// mutate unrelated keys (e.g. `enable_chat_history_export`) on this same
// shared tenant.
const SUPPORT_RELATED_KEYS = [
  'support_url',
  'help_center_url',
  'documentation_url',
  'show_help',
  'support_email',
] as const;

// ─── Suite ───────────────────────────────────────────────────────────────

test.describe.serial('Journey 71: Sidebar Support Link & Help Center', () => {
  test.setTimeout(180_000);

  let tenantKey = '';
  let originalMetadata: Record<string, unknown> | null = null;

  test.beforeAll(async ({ browser }, testInfo) => {
    if (!DM_URL) return;

    const browserKey = testInfo.project.name
      .replace('mentor-desktop-', '')
      .toLowerCase();
    const authFile = path.join(
      __dirname,
      `../../playwright/.auth/user-${browserKey}.json`,
    );
    const context = await browser.newContext({ storageState: authFile });
    const page = await context.newPage();
    try {
      await navigateToMentorApp(page);
      const isAdmin = await checkAdminStatus(page);
      if (!isAdmin) return;

      const ctx = await getPlatformContext(page);
      tenantKey = ctx.tenantKey;
      originalMetadata = await getTenantMetadata(page, tenantKey);
    } finally {
      await context.close().catch(() => undefined);
    }
  });

  test.afterAll(async ({ browser }, testInfo) => {
    if (!DM_URL || !tenantKey || !originalMetadata) return;
    test.setTimeout(120_000);

    const browserKey = testInfo.project.name
      .replace('mentor-desktop-', '')
      .toLowerCase();
    const authFile = path.join(
      __dirname,
      `../../playwright/.auth/user-${browserKey}.json`,
    );
    const context = await browser.newContext({ storageState: authFile });
    const page = await context.newPage();
    try {
      await navigateToMentorApp(page);

      // Belt-and-braces: every mutating test already undoes its own
      // change, this is the journey-level safety net for anything that
      // crashed before reaching its own restore. Single atomic PATCH of
      // the ENTIRE captured blob — never a partial write of just the
      // keys this journey touched.
      await restoreTenantMetadata(page, tenantKey, originalMetadata);

      // Prove the restore actually worked: re-fetch and compare every
      // support/help-center-related key against what was captured before
      // this journey touched anything.
      const restored = await getTenantMetadata(page, tenantKey);
      for (const key of SUPPORT_RELATED_KEYS) {
        expect(
          restored[key],
          `tenant metadata key "${key}" must match its pre-suite value after restore (restore verification)`,
        ).toEqual(originalMetadata![key]);
      }
    } finally {
      await context.close().catch(() => undefined);
    }
  });

  test.beforeEach(async ({ page }) => {
    test.skip(
      !DM_URL,
      'DM_URL env var is required for tenant-metadata-backed sidebar/help-center tests',
    );

    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Requires admin access to mutate tenant metadata');
      return;
    }
    test.skip(
      !tenantKey,
      'Tenant key was not captured in beforeAll — admin auth or DM_URL is missing',
    );
    await waitForPageReady(page);
  });

  // ── shc-01/02: default resolution (no tenant override) ────────────────

  test('shc-01/02: admin sees the default documentation URL on the sidebar Support link in both expanded and rail-collapsed layouts', async ({
    page,
    sidebarPage,
  }) => {
    // Idempotent precondition: no documentation_url / show_help override
    // — matches the BASELINE tenant state (both absent).
    await setTenantMetadataFlag(
      page,
      tenantKey,
      'documentation_url',
      undefined,
    );
    await setTenantMetadataFlag(page, tenantKey, 'show_help', undefined);
    await navigateToMentorApp(page);
    await waitForPageReady(page);

    await sidebarPage.ensureExpanded(20_000);
    const expandedHref = await sidebarPage.getSupportLinkHref(10_000);
    expect(expandedHref).toBe(DEFAULT_DOCUMENTATION_URL);

    await sidebarPage.ensureCollapsed(20_000);
    const collapsedHref = await sidebarPage.getSupportLinkHref(10_000);
    expect(collapsedHref).toBe(DEFAULT_DOCUMENTATION_URL);
  });

  // ── shc-03/04: tenant documentation_url override (with/without scheme) ─

  test('shc-03/04: tenant documentation_url override (with and without a scheme) is reflected on the sidebar Support link href', async ({
    page,
    sidebarPage,
  }) => {
    try {
      // shc-03: value WITH a scheme is used verbatim.
      await setTenantMetadataFlag(
        page,
        tenantKey,
        'documentation_url',
        TEST_DOC_URL_WITH_SCHEME,
      );
      await navigateToMentorApp(page);
      await waitForPageReady(page);
      await sidebarPage.ensureExpanded(20_000);
      expect(await sidebarPage.getSupportLinkHref(10_000)).toBe(
        TEST_DOC_URL_WITH_SCHEME,
      );

      // shc-04: SCHEME-LESS value is prefixed with https:// by
      // addProtocolToUrl.
      await setTenantMetadataFlag(
        page,
        tenantKey,
        'documentation_url',
        TEST_DOC_URL_NO_SCHEME,
      );
      await navigateToMentorApp(page);
      await waitForPageReady(page);
      await sidebarPage.ensureExpanded(20_000);
      expect(await sidebarPage.getSupportLinkHref(10_000)).toBe(
        `https://${TEST_DOC_URL_NO_SCHEME}`,
      );
    } finally {
      await setTenantMetadataFlag(
        page,
        tenantKey,
        'documentation_url',
        undefined,
      ).catch(() => undefined);
    }
  });

  // ── shc-05: show_help gating on the sidebar Support link ──────────────

  test('shc-05: show_help false hides the sidebar Support link in both layouts, and restoring it brings the link back', async ({
    page,
    sidebarPage,
  }) => {
    try {
      await setTenantMetadataFlag(page, tenantKey, 'show_help', false);
      await navigateToMentorApp(page);
      await waitForPageReady(page);

      await sidebarPage.ensureExpanded(20_000);
      expect(await sidebarPage.isSupportLinkVisible(5_000)).toBe(false);

      await sidebarPage.ensureCollapsed(20_000);
      expect(await sidebarPage.isSupportLinkVisible(5_000)).toBe(false);
    } finally {
      await setTenantMetadataFlag(
        page,
        tenantKey,
        'show_help',
        undefined,
      ).catch(() => undefined);
    }

    // Restoring (removing the override) brings the link back — assert
    // this as part of the checkpoint itself, not just as cleanup.
    await navigateToMentorApp(page);
    await waitForPageReady(page);

    await sidebarPage.ensureExpanded(20_000);
    expect(await sidebarPage.isSupportLinkVisible(10_000)).toBe(true);

    await sidebarPage.ensureCollapsed(20_000);
    expect(await sidebarPage.isSupportLinkVisible(10_000)).toBe(true);
  });

  // ── shc-06: Help dropdown item resolves from support_url ───────────────

  test('shc-06: the More options -> Help menu item resolves from tenant support_url', async ({
    page,
    navbarPage,
  }) => {
    // Idempotent precondition — this tenant's BASELINE support_url,
    // regardless of test execution order within this file.
    await setTenantMetadataFlag(
      page,
      tenantKey,
      'support_url',
      BASELINE_SUPPORT_URL,
    );
    await navigateToMentorApp(page);
    await waitForPageReady(page);

    await navbarPage.openProfileDropdown();
    await expect(navbarPage.helpItem).toBeVisible({ timeout: 10_000 });

    const [newPage] = await Promise.all([
      page.context().waitForEvent('page', { timeout: 10_000 }),
      navbarPage.helpItem.click(),
    ]);
    expect(newPage.url()).toBe(`https://${BASELINE_SUPPORT_URL}`);
    await newPage.close();
  });

  // ── shc-07: Help dropdown falls back to help_center_url ────────────────

  test('shc-07: the More options -> Help menu item falls back to help_center_url when support_url is absent', async ({
    page,
    navbarPage,
  }) => {
    try {
      await setTenantMetadataFlag(page, tenantKey, 'support_url', undefined);
      await setTenantMetadataFlag(
        page,
        tenantKey,
        'help_center_url',
        TEST_HELP_CENTER_URL_NO_SCHEME,
      );
      await navigateToMentorApp(page);
      await waitForPageReady(page);

      await navbarPage.openProfileDropdown();
      await expect(navbarPage.helpItem).toBeVisible({ timeout: 10_000 });

      const [newPage] = await Promise.all([
        page.context().waitForEvent('page', { timeout: 10_000 }),
        navbarPage.helpItem.click(),
      ]);
      expect(newPage.url()).toBe(`https://${TEST_HELP_CENTER_URL_NO_SCHEME}`);
      await newPage.close();
    } finally {
      await setTenantMetadataFlag(
        page,
        tenantKey,
        'support_url',
        BASELINE_SUPPORT_URL,
      ).catch(() => undefined);
      await setTenantMetadataFlag(
        page,
        tenantKey,
        'help_center_url',
        undefined,
      ).catch(() => undefined);
    }
  });
});
