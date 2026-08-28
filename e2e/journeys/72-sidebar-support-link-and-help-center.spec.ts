/**
 * Journey 72 — Sidebar Support Link & Help Center Resolution (#uat-9)
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
 *                       (config default: https://ibl.ai/support)
 *   showHelp          = metadata.show_help !== false
 *
 * Both values are passed through `addProtocolToUrl`, which prefixes
 * `https://` onto a scheme-less value. The nav-bar item is driven by the
 * SDK's OWN internal read of the same tenant metadata keys (verified
 * against the installed `@iblai/iblai-js@2.7.0` source: `getHelpUrl()` in
 * `UserProfileDropdown` computes
 * `addProtocolToUrl(metadata?.support_url || metadata?.help_center_url ||
 * helpCenterUrl)`, gated on `getShowHelp() === metadata?.show_help !==
 * false`) — independent code, but the SAME resolution formula and the SAME
 * tenant metadata.
 *
 * ── READ-ONLY BY DESIGN (redesigned after a real incident) ────────────────
 *
 * This journey used to mutate ORG-SCOPED tenant metadata (`support_url`,
 * `help_center_url`, `documentation_url`, `show_help`) on the shared LIVE
 * `conradtesttenant` backend, guarded by `describe.serial` + a captured
 * "original" snapshot restored in `afterAll`. That was NOT actually safe:
 *
 *   1. `describe.serial` only serialises tests INSIDE this file. Other
 *      journeys (e.g. journey 02, which reads `show_help` to find the Help
 *      menu item) run in OTHER parallel workers within the same run, and
 *      would observe this journey's in-flight mutations.
 *   2. Different PRs' CI jobs hit the SAME shared live tenant concurrently.
 *      No amount of in-suite `describe.serial`/`try-finally`/`afterAll`
 *      cleanup can fix a race between two independent CI jobs — only NOT
 *      WRITING does.
 *   3. `afterAll` never runs on a killed process or a cancelled CI job. A
 *      crashed run of the old version of this journey left
 *      `show_help: false` PERMANENTLY on the live tenant, and the next
 *      run's `beforeAll` captured that `false` as "the original value" and
 *      faithfully restored it forever — silently breaking an unrelated
 *      team's PR (os-222), whose journey could no longer find the Help
 *      menu item.
 *
 * So this journey NEVER writes tenant metadata. Every checkpoint below
 * fetches the tenant's metadata via `getTenantMetadata` (a plain
 * authenticated GET, `e2e/utils/tenant-metadata.ts`), computes the SAME
 * expected value the app/SDK would compute from that exact reading, and
 * asserts the live UI matches it — whatever the tenant's metadata happens
 * to be right now. There is nothing to restore, no shared mutable state, no
 * cross-worker or cross-job race: two runs reading the same tenant
 * concurrently, or a third party editing it mid-run, can never break this
 * suite, because it never asserts against a fixed expectation, only against
 * "does the UI match what the API says right now."
 *
 * ── What moved to unit tests instead ───────────────────────────────────
 *
 * The tenant-override PRECEDENCE logic previously exercised by mutating the
 * live tenant (`documentation_url` with/without a scheme, `show_help`
 * gating in both sidebar layouts, `help_center_url` fallback when
 * `support_url` is absent) needs no live browser or live tenant to prove —
 * it's pure prop-in/render-out logic, and turns out to already be covered
 * at 100% with zero gap, at TWO levels:
 *   - `hooks/__tests__/use-help-center.test.ts` — the resolution formula
 *     itself (scheme prefixing, every `||` fallback branch, `show_help
 *     !== false`).
 *   - `app-sidebar/__tests__/index.test.tsx` ("AppSidebar — Support footer
 *     link" and its rail-mode counterpart) — the COMPONENT-level behavior:
 *     `documentation_url` override with AND without a scheme, `show_help:
 *     false` hiding the Support link in BOTH expanded and rail-collapsed
 *     layouts, and `help_center_url` never leaking into the Support link's
 *     href.
 * `page.route()` stubbing of just the tenant-metadata GET was considered as
 * a middle ground, but rejected: once BOTH the resolution formula and the
 * component's conditional rendering are unit-tested, a stubbed E2E variant
 * would only be re-verifying `useTenantMetadata`'s SWR/fetch wiring (not
 * this app's logic) at far higher runtime cost and with real browser flake
 * risk, for zero net coverage gained. The former `shc-03`/`shc-04`/`shc-05`/
 * `shc-07` checkpoints are marked `deprecated` in `coverage.json` per the
 * project's established deprecation pattern (checkpoint count is preserved,
 * not deleted — see journeys 15/16 for precedent).
 *
 * shc-01/02/06 remain as REAL, READ-ONLY E2E — proving the actual live
 * wiring (app hook → sidebar component → SDK dropdown → tenant API) still
 * works end-to-end, which no unit test can substitute for.
 *
 * Requires the `DM_URL` env var (the DM API base, e.g.
 * `https://api.iblai.org/dm`) to read the tenant-metadata endpoint. There
 * IS a UI path to these keys — verified directly in the installed SDK
 * source (`@iblai/iblai-js@2.7.0`'s `TenantSwitcher.handleTenantClick`):
 * clicking the tenant-name row in the nav-bar's `⋯ More options` menu (for
 * an admin/manager of the CURRENT tenant) calls `setOpenAccount('organization')`,
 * opening the SDK's account modal on its Organization tab, where Support
 * URL / Help Center URL / Documentation URL are all editable. That path is
 * gated on tenant-management RBAC permissions, not on `showAccountTab`
 * (`showAccountTab={false}` in `user-profile.tsx` only hides the SEPARATE
 * "Account" dropdown item — a different code path). Driving that dialog for
 * a read-only assertion would be slower and more failure-prone than a
 * direct GET for no added confidence, so this journey still reads via the
 * API — but the API is not the ONLY path, which the previous version of
 * this comment incorrectly claimed. Every test self-skips when `DM_URL` is
 * absent, matching the established convention in journey 43.
 */

import { test, expect } from '../fixtures/mentor-test';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { getTenantMetadata } from '../utils/tenant-metadata';
import { DM_URL } from '../fixtures/test-data';

// ─── Constants ────────────────────────────────────────────────────────────

// Mirrors lib/config.ts's `documentationUrl()` / `helpCenterUrl()` defaults.
// Not imported directly (the app's config module isn't part of the e2e TS
// project) — these read the SAME env vars the app build reads, so they stay
// correct if a deployment ever overrides them.
const DEFAULT_DOCUMENTATION_URL =
  process.env.NEXT_PUBLIC_DOCUMENTATION_URL || 'https://ibl.ai/docs';
const DEFAULT_HELP_CENTER_URL =
  process.env.NEXT_PUBLIC_HELP_CENTER_URL || 'https://ibl.ai/support';

/**
 * Mirrors the app's / SDK's `addProtocolToUrl`: an empty/falsy value stays
 * empty, an already-schemed value passes through verbatim, anything else is
 * prefixed with `https://`. Verified byte-for-byte against the installed
 * `@iblai/iblai-js@2.7.0` source.
 */
function addProtocolToUrl(url: string): string {
  if (!url) return '';
  return url.startsWith('http://') || url.startsWith('https://')
    ? url
    : `https://${url}`;
}

// ─── Suite ───────────────────────────────────────────────────────────────
//
// No shared mutable state, so no `describe.serial` — every test only ever
// GETs tenant metadata and computes its own expectation from that same
// reading. Fully parallel-safe.

test.describe('Journey 72: Sidebar Support Link & Help Center', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !DM_URL,
      'DM_URL env var is required to read tenant-metadata-backed sidebar/help-center resolution',
    );

    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Requires admin access to read tenant metadata');
      return;
    }
    await waitForPageReady(page);
  });

  // ── shc-01/02: sidebar Support link resolves the LIVE documentation_url ─

  test('shc-01/02: sidebar Support link resolves the live tenant documentation_url (or hides when show_help is false) in both expanded and rail-collapsed layouts', async ({
    page,
    sidebarPage,
  }) => {
    const { tenantKey } = await getPlatformContext(page);
    const metadata = await getTenantMetadata(page, tenantKey);
    const showHelp = metadata.show_help !== false;
    const expectedHref = addProtocolToUrl(
      (metadata.documentation_url as string) || DEFAULT_DOCUMENTATION_URL,
    );

    await sidebarPage.ensureExpanded(20_000);
    if (showHelp) {
      expect(await sidebarPage.getSupportLinkHref(10_000)).toBe(expectedHref);
    } else {
      expect(await sidebarPage.isSupportLinkVisible(5_000)).toBe(false);
    }

    await sidebarPage.ensureCollapsed(20_000);
    if (showHelp) {
      expect(await sidebarPage.getSupportLinkHref(10_000)).toBe(expectedHref);
    } else {
      expect(await sidebarPage.isSupportLinkVisible(5_000)).toBe(false);
    }
  });

  // ── shc-06: Help dropdown item resolves the LIVE support/help-center URL ─

  test('shc-06: the More options -> Help menu item resolves the live tenant support_url/help_center_url (or is absent when show_help is false)', async ({
    page,
    navbarPage,
  }) => {
    const { tenantKey } = await getPlatformContext(page);
    const metadata = await getTenantMetadata(page, tenantKey);
    const showHelp = metadata.show_help !== false;
    const expectedHelpUrl = addProtocolToUrl(
      (metadata.support_url as string) ||
        (metadata.help_center_url as string) ||
        DEFAULT_HELP_CENTER_URL,
    );

    await navbarPage.openProfileDropdown();

    if (!showHelp) {
      // The SDK computes `helpUrl = getShowHelp() ? getHelpUrl() : null` and
      // renders no menu item at all when it's null.
      await expect(navbarPage.helpItem).not.toBeVisible();
      return;
    }

    await expect(navbarPage.helpItem).toBeVisible({ timeout: 10_000 });
    const [newPage] = await Promise.all([
      page.context().waitForEvent('page', { timeout: 10_000 }),
      navbarPage.helpItem.click(),
    ]);
    expect(newPage.url()).toBe(expectedHelpUrl);
    await newPage.close();
  });
});
