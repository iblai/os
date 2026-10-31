---
name: tenant-metadata-refactor-feat-tenant-object
description: Audit findings for the tenant-metadata-from-platforms-list refactor (branch feat/tenant-metadata-from-tenant-object) — confirmed-correct architecture, one real bug found+fixed, two false positives from running e2e against local `pnpm dev`.
type: project
---

Architecture change: tenant metadata no longer comes from a per-org GET
(`/api/core/orgs/<org>/metadata/`). It now rides the platforms list
(`CoreService.coreUsersPlatformsList` → `GET /api/core/users/platforms/`, and
mentorai's own `/api/ibl/users/manage/platform/`), persisted whole to the
`tenants` storage key; `current_tenant` holds only `{key, is_admin, org}`.
`hooks/use-tenant-object-metadata.ts` (`useTenantObjectMetadata`) and the
SDK's own `useTenantMetadata`/`useTenantMetadata` (in
`@iblai/web-utils`'s compiled `index.esm.js`, ~line 6563) BOTH independently
join `current_tenant.key` into the `tenants` list and read `.metadata` off
the match — verified byte-for-byte against the installed SDK source, not
just the app code. No network call either way. This part of the refactor is
solid.

**Why:** Verifying this against the compiled SDK (not just mentorai's app
code) was what caught that `e2e/utils/tenant-metadata-observed.ts`'s
`navigateAndObserveTenantMetadata` genuinely mirrors what BOTH the app hook
and the SDK hook do — so it's a trustworthy read, with one sharp edge (next
item).

**How to apply:** When auditing a future change to this area, re-diff the
compiled `@iblai/web-utils` / `@iblai/iblai-js` dist files for
`useTenantMetadata`/`UserProfileDropdown`'s `getHelpUrl`/`getShowHelp` — the
installed SDK version can silently change the formula.

## Real bug found + fixed: cross-origin embed iframe metadata read

Journey 80 (`e2e/journeys/80-embed-and-lti-redesign.spec.ts`, commit
`e2090a5c`) added a checkpoint that called
`navigateAndObserveTenantMetadata(page)` on the TOP-LEVEL page, then branched
on `metadata.show_help` to predict whether a cross-origin embed iframe
(`gotoEmbedHarness`, hosted on a genuinely different origin via
`embed-harness-server.mjs`) would show "Help". This is unsound: the iframe
resolves its OWN copy of `tenants`/`current_tenant` into its OWN
storage-partitioned localStorage (different top-level site than the parent
page), so the top page's reading is not a reliable proxy for what renders
inside the iframe. `UserProfileDropdown`'s `renderHelpLink()` only omits Help
when `helpUrl` is empty — and `getHelpUrl()` falls back to
`config.helpCenterUrl()`, which defaults to a non-empty URL — so under normal
conditions Help renders regardless almost always; the one path that makes it
disappear is the iframe's OWN `show_help === false`, independently resolved.

**Fix shipped:** added `forceTenantMetadata(page, overrides)` to
`tenant-metadata-observed.ts` — a `page.route()` interceptor (covers every
frame of the page, including child iframes) that forces metadata keys onto
the platforms-list response before navigating. Journey 80 now forces
`show_help: true` instead of reading-then-branching, eliminating the
divergence. See [[capability-gate-refactor-feat2040]] for another case where
reading vs. a component's independently-computed render state diverged.

**How to apply:** Any FUTURE checkpoint that wants to assert something
inside a genuinely-cross-origin embed iframe based on tenant metadata MUST
either (a) force the value via `forceTenantMetadata` before navigating, or
(b) read storage from the iframe's own frame context — never read the
top-level page's storage and assume the iframe matches it.

## Second real bug found + fixed: journey 83's personal-greeting name source

`e2e/journeys/83-settings-welcome-screen.spec.ts` (wss-07, wss-08, wss-09,
wss-13, wss-14) all waited on `page.waitForResponse` for a GET matching
`/api/(ibl/users/manage/metadata|core/users/metadata/proxy)/` to read the
current user's `name`, then asserted the welcome-chat greeting. The SDK's
`WelcomeHeading` (`@iblai/iblai-js` `welcome-chat/welcome-heading.js`)
computes the greeted name as
`userMetadata?.name || userMetadata?.public_metadata?.name || ''`, where
`userMetadata` comes from `useStoredUserMetadata()` (`@iblai/web-utils`) — a
**plain `window.localStorage` read of the `user_metadata` key**, no network
call, no `getAuthItem` even (confirmed in the compiled `useLocalStorage`
source — it does NOT route through the per-tab-auth layer). So the GET
never fires for the current user anymore and every one of those
`waitForResponse` calls times out at 30s.

**Fix shipped:** added `e2e/utils/user-metadata-observed.ts` —
`readStoredUserFullName(page)` (session-first/localStorage read, mirrors
`tenant-metadata-observed.ts`'s pattern, throws rather than skips) for
wss-07/08/13/14, and `forceStoredUserFullName(page, name)` (same-origin
localStorage+sessionStorage write, merge-safe) for wss-09, which used to
intercept the dead GET to inject a synthetic name — now it writes
`user_metadata.name` directly, then needs a `page.reload()` (not just the
write) since `WelcomeHeading` only re-reads on mount, not live, so the
reload is what makes the forced value visible. Verified: a throwaway
diagnostic spec read the REAL admin's name (`"Sone Gillis Ekeh"`) via
`readStoredUserFullName`, then forced `"John Doe"` and read it back
correctly after reload — 5/5 passed live.

**Why:** wss-08 is a same-origin `?embed=true` navigation via plain
`page.goto` (NOT the cross-origin `gotoEmbedHarness`), so unlike journey 80
there is no storage-partition risk here — reading the top page's storage is
valid for all five checkpoints.

**How to apply:** grep for `waitForResponse` + a metadata/profile GET
pattern in any OTHER journey before trusting it — this refactor broke it
silently (times out, doesn't error loudly) everywhere it appears, not just
the checkpoints a bug report happens to name. I found 3 more occurrences
beyond the 2 originally reported (wss-13, wss-14, and the second copy
inside wss-07) just by grepping the same file.

## False positives — local `pnpm dev` vs a built container's `window.__ENV__`

Running the full suite against a LOCAL `pnpm dev` server (not a built Docker
image) produced 3 failures that are NOT caused by this refactor:

1. Journey 70 (`opening the Embed tab does not flip...`) — `createMentorPage`
   fixture failed at `LlmTab.selectProviderAndModel`: the `iblai-fast` model
   button was disabled (`data-availability-status="byok_missing"`). Pure
   environment/fixture gap (no ibl.ai BYOK key configured on this local
   tenant) — unrelated to tenant metadata.
2. Journey 02 ("clicks the help button...") and Journey 72 shc-06 — both
   expected the FALLBACK help URL (`https://ibl.ai/support`, from
   `lib/config.ts`'s hardcoded default) but the real app opened
   `https://docs.iblai.app`. Root cause: `e2e/utils/runtime-env.ts`'s
   `getRuntimeEnv` only reads `window.__ENV__` (populated by `entrypoint.sh`
   in a built container at startup) — it has an explicitly documented "Known
   limit" that it can't see a value baked in only at BUILD time via
   `process.env`. The ROOT `.env.local` (not `e2e/.env.local`) sets
   `NEXT_PUBLIC_HELP_CENTER_URL=https://docs.iblai.app`, which `next dev`
   inlines into the client bundle's build-time tier of `lib/config.ts`'s
   `getEnv` — but `pnpm dev` never runs `entrypoint.sh`, so
   `window.__ENV__` is simply absent, and the helper's `??` fallback picks
   the wrong default. Confirmed via a throwaway diagnostic spec that polled
   `tenants`/`current_tenant` storage for 10s: `support_url`/`help_center_url`
   were stable (empty/absent) the entire time — there is no race, the
   metadata layer reads exactly what's stored.

**Why:** It would be easy to misdiagnose these three as refactor
regressions (I initially suspected a race condition in
`navigateAndObserveTenantMetadata` until the diagnostic ruled it out).

**How to apply:** When this suite is run against local `pnpm dev` instead of
a built container, expect journeys 02/70/72 (and anything else gated on
`getRuntimeEnv`) to show false failures tied to the root `.env.local`'s
`NEXT_PUBLIC_*` values vs the absence of `window.__ENV__`. Don't chase these
as app bugs without first checking which server the run targeted. Not
fixed — flagged only, since it's outside the tenant-metadata audit's scope
and the existing doc comment in `runtime-env.ts` already names the
tradeoff deliberately.
