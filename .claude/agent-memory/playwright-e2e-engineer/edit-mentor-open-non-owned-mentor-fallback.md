---
name: edit-mentor-open-non-owned-mentor-fallback
description: How EditMentorPage.open() now self-heals when navigateToMentorApp lands on a mentor the admin can't edit (no "Settings" in the agent dropdown) — verified live, including why the "Modify" fork approach was abandoned.
type: project
---

`EditMentorPage.open()` (`e2e/page-objects/edit-mentor/edit-mentor.page.ts`) used to hang
forever waiting for a `menuitem` named exactly "Settings" in the "Selected agent" dropdown.
That item is only rendered for mentors the current admin **owns**. `navigateToMentorApp`
(bare `/platform`) redirects to the account-wide most-recently-accessed mentor (see
[[e2e-shared-mentor-isolation]]), which can be a shared/template mentor the admin doesn't
own — its dropdown shows only "New Chat" and (if forkable) "Modify", never "Settings".
Journey 38 (`38-tenant-memory-system-toggle.spec.ts`) hit exactly this and timed out at
`edit-mentor.page.ts:242`.

**Fix (fixed + live-verified 2026-07-10, feat/2040 branch):** `open()` does a short
`waitFor` (10s) on the "Settings" menuitem instead of an unconditional
`expect(...).toBeVisible()`. If it doesn't appear, a private `switchToEditableMentor()`
runs, then the dropdown-open + "Settings" lookup is retried.

**`switchToEditableMentor()` does NOT use the dropdown's "Modify" action.** First attempt
did (one-click server-side fork via `useForkMentorMutation` in `handleModifyMentor`,
`app/platform/[tenantKey]/[mentorId]/_components/nav-bar/index.tsx`) and waited for the
resulting redirect with `safeWaitForURL`. **Live run proved this unreliable**: the fork
completed server-side (a "Copy of agentAI" card appeared under Explore/My Agents) but the
page never navigated, so `safeWaitForURL` timed out at the full 60s with nothing to fall
back to. Abandoned entirely rather than patched — no dependency on the fork's redirect.

**What it does instead:** presses Escape to close the open dropdown, then calls
`SidebarPage.ensureExpanded()` followed by `CreateMentorPage.openAndCreate()` — the same
proven isolation primitive already used by journeys 02/09/44/47/54/56/etc. (see
[[e2e-shared-mentor-isolation]]). `createWithName()` internally asserts the resulting URL
change itself, so there's no ambiguous redirect to wait on.

**The `SidebarPage.ensureExpanded()` call is required, not optional.**
`CreateMentorPage.open()` clicks the "Agents" sidebar button expecting it to expand an
_inline collapsible section_ containing "New Agent" (uses `aria-expanded` on that button).
That assumption breaks when the whole `<aside>` sidebar is collapsed to its icon-only rail
— a _different_, outer collapse state, toggled by a "Expand sidebar"/"Collapse sidebar"
button on the aside itself. When the rail is collapsed, "New Agent" never mounts and
`CreateMentorPage.open()` times out on `getByRole('button', { name: 'New Agent' })`. This
surfaced live because the shared admin storageState this session reused
(`playwright/.auth/user-chrome.json`, account `conrad@ibleducation.com`) carried a
persisted collapsed-rail sidebar state from other concurrent activity on the same shared
tenant (`conradtesttenant`) — plausible any time journeys reuse admin storageState across
many parallel/serial runs. `e2e/page-objects/sidebar.page.ts` already has a proven
`ensureExpanded()` helper (used elsewhere for the same "logo hidden while collapsed"
reason) — reused rather than re-implemented.

**Verification:** live-ran journey 38 four times in a row against `mentor-desktop-chrome`
with the real backend (tenant `conradtesttenant`, mentor `253e389d-...` = "agentAI", a
non-owned/shared mentor — auth consistently redirected here across runs). All 4 runs
passed 3/3. One run had a temporary `console.log` inside the `!hasSettings` branch to
positively confirm the fallback fired (not just infer from timing) — confirmed:
`[TEMP-DEBUG] no-Settings fallback firing, url= .../conradtesttenant/253e389d-...` — then
removed before the final clean run. `open('Memory')` is called twice in journey 38 (body +
`finally`) — both succeed; the second call hits the fast `hasSettings === true` path since
the newly-created mentor from the first call is now the selected/owned one, so no repeated
forking/creating happens within a single test run (idempotent).

**Not fully closed:** why the sidebar rail was collapsed in the first place wasn't root
caused (likely leftover state on the shared storageState/tenant from concurrent test
activity, not something this fix's own code path causes). If `CreateMentorPage.open()`
starts failing on "New Agent" visibility in _other_ journeys (not just this fallback path),
consider moving the `ensureExpanded()` call into `CreateMentorPage.open()` itself so all
~15 call sites benefit — deliberately not done here to keep the change scoped to the
reported failure.

Related: [[e2e-shared-mentor-isolation]], [[capability-gate-refactor-feat2040]]
