---
name: spend-limits-user-limits-feat2598
description: Journey 69 Block C (tenant Billing "User Limits" tab, feat/2598) — tenant-wide hazards the tul-* checkpoints must respect, and why there is no non-admin checkpoint
metadata:
  type: project
---

Journey 69 (`e2e/journeys/69-spend-limits.spec.ts`) gained Block C for the tenant Billing "User Limits" tab (SDK branch `feat/web-containers/2598`, app branch feat/2625 → feat/2598). Checkpoints `tul-01..05`; helpers live in the SDK's `spend-limits-helpers.ts` (`*TenantUserSpendLimit`, `*NewUserSpendLimitDefault`).

**Why:** two pieces of TENANT-WIDE state that are easy to leave dirty:

- The "Default for New Users" template (`spend-caps/users/default/`) attaches a user cap to EVERY future signup in the tenant while on — a leftover would silently cap every later signup-journey user. The tul-05 `finally` always switches it back OFF (`setNewUserSpendLimitDefault(page, { enabled: false })`), unconditionally, never "restore as found".
- User-tier caps are keyed by USERNAME (the acting admin's own account via `getCurrentAdminIdentity`), not by mentor, so there is no per-test mentor isolation: browser projects sharing one admin contend for the same row in parallel (same exposure `twl-02` already accepts for the singleton workspace cap). Per-browser admin creds (`PLAYWRIGHT_USERNAME_<BROWSER>` in `fixtures/test-data.ts`) are what keep them apart.

**How to apply:** any new checkpoint touching either card must be `enforcement: 'alert_only'`, clean up in an unconditional `finally`, and start from `removeTenantUserCapIfPresent` (local helper in the spec) so a crashed run's leftover cannot hide the filtered "Set Spend Limit" empty state (the ONLY create entry point on that tab). `tul-06` (non-admin) was deliberately skipped: neither Block B nor journey 21 has a non-admin pattern for the tenant Billing surface (21-C's non-admin test is the Stripe pricing modal), and `sc-09` already pins the admin gate — do not invent one without being asked.
