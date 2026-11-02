---
description: Protect the app's startup path — never block first render or the mentor redirect on data the UI re-renders on anyway. Read before adding an await, a provider, or a new query that runs on load.
---

# Startup Performance Skill

The startup path was deliberately unblocked. It is easy to put back, because
the tempting shape — "await the thing, then continue" — is exactly what was
removed. This skill exists so that happens on purpose rather than by accident.

## The rule

**Nothing on the path to first render may `await` data that the UI reads
reactively.**

If a value lands in Redux and components re-render when it arrives, awaiting it
before rendering buys nothing and costs a round-trip. Start the request, let the
screen draw, let the value arrive.

## The three places that must stay unblocked

| Location | What must not be awaited before it |
| --- | --- |
| `MentorProvider` | `redirectToMentor(...)` |
| `TenantProvider` / `MentorProvider` | `setIsLoading(false)`, `onComplete?.()` |
| `app/platform/[tenantKey]/[mentorId]/mentor-page-content.tsx` | `<SdkChat>` — it renders unconditionally today, keep it that way |

These sit in `@iblai/iblai-js/web-utils`; the host wires callbacks to them.
A new `await` immediately before any of the above is the regression this skill
is about.

## Before adding a blocking call, answer these

1. **Does anything on this path read the result?** If the only consumer is a
   `dispatch(...)` into a store, nothing does — defer it.
2. **What does the screen show while it waits?** If the honest answer is
   "nothing" or "a spinner", that is a startup regression.
3. **Can the user act without it?** `sendMessage` needs only a session id. It
   does not need chat history, permissions, or tenant metadata.

## Deferring safely — three traps, all hit for real

**1. "Not loaded" is not "denied."** An empty permissions object means both.
Most consumers go through `WithPermissions` and fail closed, but
`chat-input-form.tsx` and `welcome-chat/conversation-starters.tsx` deliberately
fail OPEN when a mentor's key is absent, so anonymous and public routes work.
They read `selectMentorPermissionsLoaded` to tell the cases apart. **Any new
consumer that defaults to allowed must do the same.**

**2. `await` was providing ordering for free.** Fire-and-forget gives that up: a
slow answer for one subject can land after a newer subject's and overwrite it.
Use `createLatestOnly` (`@iblai/web-utils`) rather than a bare `.then`.

**3. A dropped promise is an unhandled rejection.** Terminate the chain with a
`.catch` that at least logs. Loaders that swallow their own errors make a
failure indistinguishable from an empty result, which matters more once nothing
awaits them.

## Specific things that are load-bearing

- **`getChats` ends in `setNewMessages`, which REPLACES the tab's messages.**
  Anything typed while history is loading would be discarded. This is why the
  composer stays hidden during that window. Do not surface a composer there
  without first making that write a merge.
- The chat history fetch (`GET .../sessions/{sessionId}/`) only gates a
  **resumed** session, and only to stop the welcome screen flashing. A new
  session renders immediately. Do not widen that gate.
- The RBAC permissions call is deferred in both providers. Re-adding an `await`
  there reintroduces a round-trip before the chat redirect.

## When the user asks for a new provider or a load-time query

Say what it will cost before writing it: whether it blocks first render, and
what the screen shows meanwhile. If it must block, make that an explicit,
stated decision rather than a side effect of using `await`.

## Verifying a change here

- `pnpm vitest run packages/web-utils/src/providers` (SDK) or
  `pnpm vitest run providers features/rbac` (host) — the provider tests pin the
  non-blocking behaviour with a promise that never settles; on awaited code they
  hang and fail.
- Run the **full** suite before pushing. Provider changes ripple: one mocked
  module missing a new export took out 124 tests in `providers/__tests__/`.
