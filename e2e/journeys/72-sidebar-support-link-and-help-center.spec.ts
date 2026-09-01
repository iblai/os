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
 * observes the tenant's real metadata (see below), computes the SAME
 * expected value the app/SDK would compute from that exact reading, and
 * asserts the live UI matches it — whatever the tenant's metadata happens
 * to be right now. There is nothing to restore, no shared mutable state, no
 * cross-worker or cross-job race: two runs reading the same tenant
 * concurrently, or a third party editing it mid-run, can never break this
 * suite, because it never asserts against a fixed expectation, only against
 * "does the UI match what the API says right now."
 *
 * ── Zero-configuration: observe the app's OWN traffic, not the DM API ────
 *
 * This journey used to call the DM API directly (`GET
 * /api/core/orgs/<org>/metadata/` with a `dm_token`, via
 * `e2e/utils/tenant-metadata.ts`'s `getTenantMetadata`), gated on `DM_URL`
 * being set — an env var exported only in CI, never in
 * `e2e/.env.local`. That meant this journey silently SKIPPED on every
 * environment except CI: a green run that tested nothing, and worse than
 * failing, because nothing ever pointed at the missing configuration.
 *
 * The app itself already fetches this exact endpoint on every load —
 * `providers/index.tsx`'s top-level `Providers` component calls the SDK's
 * `useTenantMetadata({ org: tenantKeyParams })` (`@iblai/web-utils` →
 * `@iblai/data-layer`'s `useGetTenantMetadataQuery` →
 * `CoreService.coreOrgsMetadataRetrieve`, `GET
 * /api/core/orgs/<org>/metadata/`), which wraps the whole app tree, so it
 * fires on every authenticated render. This journey now OBSERVES that
 * response instead of issuing its own
 * authenticated request — see
 * `e2e/utils/tenant-metadata-observed.ts`'s
 * `navigateAndObserveTenantMetadata`, which arms a `page.waitForResponse`
 * listener BEFORE `navigateToMentorApp` starts navigating (so it cannot
 * miss an early/cached response — see that file for the full race
 * analysis). This needs no `DM_URL`, no API credentials, and no
 * per-environment setup — it uses traffic the app already makes on any
 * environment, unconditionally. If the response genuinely cannot be
 * observed, the journey FAILS loudly; it never skips.
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
 * works end-to-end, which no unit test can substitute for. They run on
 * ANY environment with zero configuration.
 *
 * ── The deployment's config comes from the BROWSER, not process.env ──────
 *
 * When the tenant overrides nothing, both destinations fall back to the
 * deployment's `NEXT_PUBLIC_DOCUMENTATION_URL` / `NEXT_PUBLIC_HELP_CENTER_URL`.
 * Those are read from `window.__ENV__` (written by the container's
 * `entrypoint.sh`) via `e2e/utils/runtime-env.ts` — NOT from the Playwright
 * runner's `process.env`, which belongs to a different machine entirely and
 * is never given the deployment's values. Reading the runner's env made
 * shc-06 fail on stg2 (which sets `NEXT_PUBLIC_HELP_CENTER_URL=
 * https://docs.ibl.ai`) while passing on every environment that leaves it
 * unset.
 *
 * shc-06 also asserts on the URL handed to `window.open` rather than on the
 * opened tab's settled URL: `https://docs.ibl.ai` redirects three times
 * before landing on `https://ibl.ai/docs/os/overview`, so reading the tab's
 * URL raced the redirect chain and depended on ibl.ai being reachable.
 */

import type { Page } from '@playwright/test';

import { test, expect } from '../fixtures/mentor-test';
import { waitForPageReady } from '../utils/resilient';
import { navigateAndObserveTenantMetadata } from '../utils/tenant-metadata-observed';
import { getRuntimeEnv } from '../utils/runtime-env';

// ─── Constants ────────────────────────────────────────────────────────────

// The LAST-RESORT defaults hardcoded in lib/config.ts's `documentationUrl()`
// / `helpCenterUrl()`. These apply only when the deployment configures
// nothing — `configuredDocumentationUrl` / `configuredHelpCenterUrl` below
// ask the running app for its real value first.
//
// These used to be `process.env.NEXT_PUBLIC_* || <default>`, on the theory
// that the spec "reads the SAME env vars the app build reads". It does not.
// `process.env` here is the PLAYWRIGHT RUNNER's environment; the app reads
// the deployed container's, published as `window.__ENV__` by
// `entrypoint.sh`. The runner is never given those variables, so the
// expression always collapsed to the hardcoded default and only agreed with
// the app on deployments that configure nothing. stg2 sets
// `NEXT_PUBLIC_HELP_CENTER_URL=https://docs.ibl.ai`, so shc-06 failed there
// while passing everywhere else — see the header note on shc-06.
const FALLBACK_DOCUMENTATION_URL = 'https://ibl.ai/docs';
const FALLBACK_HELP_CENTER_URL = 'https://ibl.ai/support';

/** The documentation URL THIS deployment is configured with. */
async function configuredDocumentationUrl(page: Page): Promise<string> {
  return (
    (await getRuntimeEnv(page, 'NEXT_PUBLIC_DOCUMENTATION_URL')) ??
    FALLBACK_DOCUMENTATION_URL
  );
}

/** The help-center URL THIS deployment is configured with. */
async function configuredHelpCenterUrl(page: Page): Promise<string> {
  return (
    (await getRuntimeEnv(page, 'NEXT_PUBLIC_HELP_CENTER_URL')) ??
    FALLBACK_HELP_CENTER_URL
  );
}

/**
 * Records every `window.open(url, target)` the app performs from here on
 * and suppresses the popup, returning a reader for what was captured.
 *
 * shc-06 used to open the real tab and assert on `newPage.url()`. That is a
 * race against redirects the app has no part in: stg2's help URL
 * `https://docs.ibl.ai` answers `301 → https://ibl.ai/docs/`, which answers
 * `308 → /docs`, which answers `301 → /docs/os/overview`. `newPage.url()`
 * right after the `page` event returns whichever of those four URLs the
 * popup happens to have reached, so the same build can pass or fail on the
 * same environment depending on how fast ibl.ai answers — and the assertion
 * additionally depended on ibl.ai being reachable at all.
 *
 * What the app is actually responsible for is the URL it hands to
 * `window.open`. That is what this captures, exactly once, with no network
 * and no timing window.
 */
async function captureWindowOpen(
  page: Page,
): Promise<() => Promise<{ url: string; target: string }[]>> {
  await page.evaluate(() => {
    const opened: { url: string; target: string }[] = [];
    (window as unknown as Record<string, unknown>).__e2eWindowOpenCalls =
      opened;
    window.open = (url?: string | URL, target?: string) => {
      opened.push({ url: String(url ?? ''), target: String(target ?? '') });
      return null;
    };
  });

  return () =>
    page.evaluate(
      () =>
        ((window as unknown as Record<string, unknown>)
          .__e2eWindowOpenCalls as { url: string; target: string }[]) ?? [],
    );
}

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
// observes the app's own tenant-metadata response and computes its own
// expectation from that same reading. Fully parallel-safe, and requires no
// env var: each test performs its own navigation + observation, so there is
// nothing to set up in `beforeEach`.

test.describe('Journey 72: Sidebar Support Link & Help Center', () => {
  // ── shc-01/02: sidebar Support link resolves the LIVE documentation_url ─

  test('shc-01/02: sidebar Support link resolves the live tenant documentation_url (or hides when show_help is false) in both expanded and rail-collapsed layouts', async ({
    page,
    sidebarPage,
  }) => {
    const metadata = await navigateAndObserveTenantMetadata(page);
    await waitForPageReady(page);

    const showHelp = metadata.show_help !== false;
    const expectedHref = addProtocolToUrl(
      (metadata.documentation_url as string) ||
        (await configuredDocumentationUrl(page)),
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
    const metadata = await navigateAndObserveTenantMetadata(page);
    await waitForPageReady(page);

    const showHelp = metadata.show_help !== false;
    const expectedHelpUrl = addProtocolToUrl(
      (metadata.support_url as string) ||
        (metadata.help_center_url as string) ||
        (await configuredHelpCenterUrl(page)),
    );

    const readWindowOpenCalls = await captureWindowOpen(page);

    await navbarPage.openProfileDropdown();

    if (!showHelp) {
      // The SDK computes `helpUrl = getShowHelp() ? getHelpUrl() : null` and
      // renders no menu item at all when it's null.
      await expect(navbarPage.helpItem).not.toBeVisible();
      return;
    }

    await expect(navbarPage.helpItem).toBeVisible({ timeout: 10_000 });
    await navbarPage.helpItem.click();

    // Assert on the URL the app asked the browser to open, not on where the
    // popup ended up: the configured help URL redirects, and the item is a
    // `div[role=menuitem]` with no href, so `window.open`'s argument is the
    // only place the app's own resolution is observable.
    await expect
      .poll(readWindowOpenCalls, { timeout: 10_000 })
      .toEqual([{ url: expectedHelpUrl, target: '_blank' }]);
  });
});
