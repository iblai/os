---
name: capability-gate-refactor-feat2040
description: How the feat/2040 CapabilityGate refactor moved 6 mentor-tab master toggles in-tab, and how to verify SDK behavior when e2e page objects can't trust the installed @iblai/iblai-js Playwright helpers.
type: project
---

feat/2040 (branch `feat/2040`, merged into mentorai as of 2026-07-09) moved 6 capability
toggles OUT of the Edit-Agent modal's Settings → Capabilities sub-tab and INTO each
feature's own top-level tab via a shared `CapabilityGate` component
(`components/modals/edit-mentor-modal/capability-gate.tsx`). The 6 tabs — Sandbox, Voice,
Screen Share, Privacy, Memory, plus LTI's toggle (LTI tab was already always-visible from
feat/1853) — are now **always mounted** in `hooks/use-mentor-segments.ts` regardless of the
toggle's value; only the gated content grays via `data-testid="capability-gate-content"`
`data-enabled` + a `data-testid="capability-gate-off-hint"`.

**Why:** Product wanted each capability's on/off switch co-located with its own
configuration UI instead of buried in a separate Settings sub-tab, and wanted the tabs
reachable even when the capability is off (so admins can see what a feature does before
turning it on).

**How to apply:** When touching any of Sandbox/Voice/Screen Share/Privacy/Memory/LTI e2e
page objects or journeys again:

- Toggle testids: `sandbox-capability-toggle`, `voice-capability-toggle`,
  `screenshare-capability-toggle`, `privacy-capability-toggle`,
  `memory-capability-toggle`, `lti-capability-toggle` — all on the `dialog` scope.
- Gated-content wrapper: `dialog.locator('[data-testid="capability-gate-content"]:visible')`
  — the `:visible` filter is required because top-level tab panels can stay force-mounted
  (CSS-hidden) while inactive, so a bare testid match can resolve multiple gate wrappers
  across tabs.
- Sandbox / Voice / Screen Share / Memory / LTI toggles are **optimistic** (app or SDK
  component keeps local `useState` mirroring the flag, flips instantly on click, rolls back
  on mutation error) — `aria-checked` flips right after `.click()`.
- Privacy is the ONE exception: `AgentPrivacyTab` derives `enabled` straight from the
  `mentorSettings` query result with no local state mirror, so the toggle only flips after
  the `editMentorJson` PUT + refetch round trip lands. Give it a longer timeout (~15-20s)
  than the optimistic tabs.
- Sandbox's per-row instance-table **Connect** action changed from a dropdown menu item to a
  dedicated button `data-testid="connect-instance-<id>"` next to the "Actions" three-dot menu
  (which now only has Run checks / Edit / Delete).
- Privacy's "When PII is detected" dropdown order changed: **Allow** is now first (backed by
  `PRIVACY_ACTIONS = ['allow','redact','mask','block']` from `@iblai/data-layer`), then
  Redact, Mask, Block.

**Verification method used** (since the installed `@iblai/iblai-js` Playwright helper
package — `node_modules/@iblai/iblai-js/dist/**/playwright/*.d.ts` — was STALE and didn't
yet expose helpers for these new toggles): read the actual compiled component source at
`node_modules/@iblai/iblai-js/dist/web-containers/source/next/index.esm.js` (and the
non-next `.../source/index.esm.js` for `SandboxConfig`/`AgentSkills`) to find the real
`data-testid` values, `onToggle` handlers (optimistic vs not), and toast copy. This is a
reliable technique when SDK docs/helpers lag the actual shipped bundle — `grep` the
minified-but-readable esm.js for the testid string or component function name
(`function AgentPrivacyTab(...)`) directly.

**Known gap (unresolved as of 2026-07-09):** the installed SDK bundle does NOT yet implement
two other pieces the task brief described as already shipped — (1) Skills tab / Prompts
tab "agent-config-prompts" grayed-preview content when no sandbox is wired (testids
`agent-skills-content`/`agent-skills-disconnected-hint`,
`agent-config-prompts-fields`/`agent-config-prompts-disconnected-hint` — the bundle still
shows the old plain "connect a sandbox" message with no such testids), and (2) — this one
WAS confirmed present — the Sandbox instance table's dedicated `connect-instance-<id>`
button. `e2e/page-objects/edit-mentor/skills.tab.ts` and `prompts.tab.ts` were written
tolerant of EITHER shape (check new testid first, fall back to old text) pending an SDK
bump. Re-verify against a live run once `@iblai/iblai-js` ships the grayed-preview build and
simplify to the new-only shape.
