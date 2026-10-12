---
name: memory-tab-subtabs-feat2415
description: Journey 24 Memory tab is now the SDK AgentMemoryTab with Personal Memories / Shared Memories sub-tabs; sub-tab unmount + inert-gate locator hazards, and MentorTracker is a legacy no-op
metadata:
  type: project
---

Journey 24 (`memory.tab.ts`) targets the SDK `AgentMemoryTab` (feat/2415): CapabilityGate on top, then Radix sub-tabs `memory-sub-tab-personal` (default) / `memory-sub-tab-shared`.

- Radix unmounts the inactive sub-tab, so every Personal Memories helper in `memory.tab.ts` calls `switchToSubTab('personal')` first (it also settles "Loading memories..."). Do the same for any new sub-tab helper.
- The sub-tabs live INSIDE the gate, which is `inert` + `aria-hidden` while the toggle is off: role queries find nothing and clicks are blocked. New tests call `setCapabilityEnabled(true)` before touching sub-tabs.
- The "Saved memories" role=list wrapper is an empty zero-height div when there are no memories, so `toBeVisible` fails; use `toBeAttached` as the readiness signal.
- Duplicate shared memory returns a 409 shown as an inline `role=alert` inside the Add Memory dialog on the Shared Memories sub-tab (not a toast).
- `MentorTracker` (`utils/mentor-cleanup.ts`) is a legacy no-op: mentors register by construction in `CreateMentorPage.createWithName`, run-level `residue.teardown.ts` deletes them, and journey 24 never uses the tracker. Do not wire it into new specs despite older guidance.

**Why:** these cost debugging time otherwise. **How to apply:** when extending journey 24 or adding a gated-tab page object with sub-tabs.
