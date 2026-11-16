# Skill recorder for the Chrome side panel — proposal

**Status:** proposal, not scheduled. **Date:** 16 November 2026.

A "skill recorder" would let someone demonstrate a task once, in their own
browser, and have the assistant repeat it later — on today's data, on a page
that has since been redesigned, without a second demonstration.

This paper says what that means concretely, how it would be built on what the
extension already does, what it costs, and the three decisions we need before
anyone estimates it.

---

## Decisions we need first

**1. Who owns a recorded skill — the person or the organization?**

A personal macro kept in the browser is a small feature. A catalog where one
person records a procedure and everyone's assistant can run it is a different
product, and it is the one that justifies building this at all: the platform
already has an agent-skills catalog with assign/unassign, so recorded skills
could land there — worth checking first that its sandbox requirement does not
make that route more expensive than it looks. If the answer is "personal only",
Chrome's built-in DevTools Recorder already does much of it for free, and we
should say so rather than rebuild it.

**2. Does a workflow have to span more than one tab?**

A run today drives one tab. Recording a flow that moves between tabs is an
architectural change, not a recorder feature. Worth answering before scoping.

**3. How much review are we willing to put in front of the user?**

Recordings are messy — people take wrong turns and double back. The review
screen is what turns a recording into a skill, and it is most of the new UI
work. Cutting it produces a demo that fails on the second real task.

---

## What the user would see

1. They open the side panel on a page and press **Record**.
2. They do the task by hand. The tab shows it is being recorded, reusing the
   on-page overlay that already marks a live run.
3. They press **Stop**. The panel shows what it captured, in plain sentences,
   and they fix it: delete the wrong turns, correct a step whose reason the
   recording could not know, give the skill a name.
4. Later, they (or a colleague) type "run the weekly sales report" and the
   assistant does it, reading the live page at every step.

---

## The design decision everything rests on

When the user clicks a button, there are two things we could write down.

**The literal one**, which is what macro recorders store:

```json
{
  "type": "click",
  "selectors": [["#app > div.wrap > div:nth-child(3) > button.btn.btn-primary"]]
}
```

This replays exactly until someone adds a `<div>`, and then it clicks the wrong
thing without telling anyone.

**The intent-level one**, which this extension already speaks:

```
[12] button "Export"
```

That is the line `snapshotPage` produces for the model on every step today
(`extensions/chrome/src/page-scripts.ts`, rendered in `tools.ts`): a role and an
accessible name, the way a person identifies a control. It survives redesigns,
because replay does not reproduce a selector — the assistant re-reads the page
and finds the button called "Export" wherever it now is.

**The recorder therefore records sentences, not selectors.** That choice is why
this is weeks of work rather than a doomed test-automation project.

---

## How it works

### Capturing a step

A listener injected into the recorded tab handles `click`, `input`, `change`,
`submit`, `blur` and Enter `keydown`; the worker watches
`chrome.tabs.onUpdated` for navigations. Raw events are meaningless on their own
— `button.btn.btn-primary` tells us nothing in six months — so each one is
turned into a named control **in the page, synchronously, inside the listener**.

That last clause is load-bearing, and it is the one thing the recorder cannot
borrow from the existing code. `snapshotPage` has an `at: {x, y}` mode that
resolves a single element, but it runs as a worker-side `executeScript` round
trip: by the time it answered, the dropdown the click opened would already be
open, or the page would have navigated, and it would describe the wrong thing.
Two further reasons it cannot be the mechanism:

- `change`, `submit` and `blur` carry no coordinates at all — the format
  `<select>` in the appendix has nothing to resolve from — and a
  keyboard-activated click reports `(0, 0)`.
- Injected functions are re-evaluated in an empty scope and may not import
  anything (a rule pinned by `page-scripts.test.ts`), so an injected
  `watchPage()` cannot call `snapshotPage` even in principle.

So `watchPage()` reads `event.target` directly and computes the role and
accessible name itself, applying the same rules `roleOf`/`nameOf` already use.
That logic has to be shared deliberately — either extracted into a string the
build inlines into both, or duplicated with a test asserting the two agree. It
is the one piece of genuinely new, fiddly code in this proposal, and the plan
should say so rather than imply it is free.

Doing it in-page also disposes of frames: the listener is injected with
`allFrames`, each copy resolves its own target in its own document, and nothing
has to translate coordinates across a cross-origin boundary (which
`frameOffset()` cannot do anyway). The frame's URL rides along on the step.

**Listeners do not survive navigation.** An injected script is wiped when the
page unloads, so the worker re-injects on every `tabs.onUpdated` for the
recorded tab — the same pattern the on-page overlay already uses with its
two-second beat. Without that, every step after the first navigation is lost
silently, which is the worst possible failure for a recorder.

An unnameable control needs a fallback, because `nameOf` returns `''` for an
unlabelled `<select>` or an icon-only button. The chain: accessible name, then
an associated label, then `placeholder`, then `title`, then the `name`
attribute; and if all of those are empty, the step is flagged in review for the
user to name, rather than stored as `button ""`.

A recorded step is then:

```ts
interface RecordedStep {
  tool: 'click' | 'type' | 'select' | 'navigate';
  target: { role: string; name: string; state?: string }; // resolved in-page
  value?: string; // never set for a secret field; see below
  url: string;
  outcomeUrl?: string; // set when rule 4 attached a navigation to this step
  frameUrl?: string;
  t: number; // used only for coalescing
}
```

Those `tool` names are the assistant's own tool names, so the recorder and the
replayer share a vocabulary. They are not the same as the tools' _arguments_,
though: `click` takes an element **number** from the current snapshot, so replay
still resolves a name to a live number at each step. That indirection is the
point — it is what lets a recorded step survive a page that has changed — but
the proposal should not pretend nothing is translated.

### Cleaning up the noise

Raw capture is filthy. Four rules remove most of it:

1. **Keystrokes become one step.** Buffer `input` events per element and flush
   on `blur`, on Enter, on a change of element — and on Stop, or the last thing
   typed before the user finishes is dropped. Twenty-three events become one
   "typed 'acme corp' into Search".
2. **Scrolling is dropped** when a click follows it. Scrolling to find a control
   is not a step; the assistant scrolls on its own when something is not listed.
   (Scroll is therefore captured for coalescing but never stored as a step.)
3. **`pointerdown` / focus churn is ignored** — only `click` is kept.
4. **A click followed within about a second by a navigation is one step**, with
   the resulting URL recorded as that step's outcome rather than as a separate
   step. The rule attaches the navigation to the click that caused it, which is
   not necessarily the last click of the session.

What no rule catches is a user taking a wrong turn and backing out. That is what
the review screen is for.

### Secrets

`snapshotPage` already marks a field secret, and the recorder reuses that mark:
a secret target records no value and becomes "the user signs in here". This
matches what the assistant is told to do at a password prompt — ask the user to
type it, wait, then carry on — so the skill and the assistant agree without a
special case.

**But the mark is a deny-list, and we should be honest about its edge.** It is
`type="password"` plus a set of `autocomplete` tokens (one-time codes, card
number and CSC, …). An API token or an account number pasted into an ordinary
text input is not covered by it, and the agent path today has two further
guards the recorder would not inherit: it never types a secret at all, and it
suppresses the screenshot when a secret field is on the page.

So the recorder needs its own stance, and the safe default is the stricter one:
**store no typed values at all**, and have the review screen offer each one back
for the user to keep deliberately ("search for _acme corp_" — keep; "type
_sk-live-…_" — never offered, because it was never stored). Recording the fact
of typing is almost always what makes the skill reusable; recording the text is
what creates a liability.

### Review is where intent is added

The captured steps are shown as editable rows. Besides deleting fumbles, this is
where the user supplies what a recording cannot know:

| What was recorded               | What the user corrects it to               |
| ------------------------------- | ------------------------------------------ |
| Clicked option "Last 7 days"    | Choose the date range the person asked for |
| Clicked row "Northwind Traders" | Open whichever account is flagged overdue  |

No recorder can infer the second column. A few seconds of editing is the
difference between a one-shot macro and a skill.

### What gets stored

One model call turns the reviewed steps into a short document — the stored
artifact, readable and diffable:

```markdown
---
name: Weekly sales CSV
sites: [admin.acme.com]
inputs:
  - range: 'which date range to export (default: last 7 days)'
---

1. Go to https://admin.acme.com/reports
2. Open the "Date range" dropdown and choose {{range}}
3. Click "Export", choose CSV as the format, then click "Download"
4. Read the total from the "Total revenue" figure at the top of the table
```

No selectors, no coordinates, no timings — what you would write for a new
colleague, which is exactly why it survives a redesign.

### Replay

Each run is built today as the instructions, then the goal, then a fresh
snapshot of the page. Replay inserts the skill between goal and snapshot, told
to adapt:

> A procedure the user recorded for this task. Follow it, adapting to what the
> page actually shows. If a step does not match the page, use your own judgement
> and carry on.

That is the whole replay engine. The existing loop does the rest: read the page,
find `[12] button "Export"`, act, re-read, continue. Because the assistant
reconciles the procedure against a live snapshot at every step, a button renamed
from "Export" to "Download data" is found anyway.

### Parameters

The skill above takes `{{range}}`. The mechanism is unglamorous: during
generalization, a recorded value that appears in the user's description of the
task becomes a named input, and at replay the run's wording binds it.

- "run the weekly sales CSV" uses the default, last 7 days
- "run the weekly sales CSV **for October**" binds `range` to October, and step
  2 picks October from the dropdown

No parser and no form builder: the skill text says what the input means.

---

## What we would build

| File                     | Change                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| `src/recorder.ts` (new)  | Session state machine, the four coalescing rules, secret redaction, the step buffer               |
| `src/page-scripts.ts`    | One injected `watchPage()` adding the listeners and posting events, self-contained like its peers |
| `src/browse-worker.ts`   | Inject on record start with `allFrames`, watch `tabs.onUpdated`, tear down on stop                |
| `src/browse-protocol.ts` | Three messages: `record:start`, `record:stop`, `record:step`                                      |
| `src/prompt.ts`          | Accept an optional skill in the user turn                                                         |
| `src/skills.ts` (new)    | Storage — browser-local first, platform catalog if we go that way                                 |
| Panel UI                 | Record control, review list, skill picker                                                         |

**No new Chrome permissions** are needed to record the tab the user is already
working in: `scripting`, `tabs` and the existing host permissions cover it.
`chrome.debugger` is used for replay input and is not involved in recording,
since passive listeners see real user events.

The expensive parts are already shipped and tested: traversal of every frame and
open shadow root, accessible naming, trusted input, and the action loop itself.

---

## Where it breaks

- **Wrong turns in a recording** — only the review screen fixes this.
- **Conditional work** ("archive the rows that are overdue") cannot be shown in
  one pass, since a single run demonstrates one branch. The user writes that
  step in words during review; the assistant can execute it although it was
  never recorded.
- **Authentication** is never recorded, by design. Skills start after sign-in,
  and a login wall on replay stops the run and asks the user, as it does today.
- **Timings** from the recording are discarded — a three-second wait is
  meaningless on a faster day, and the assistant already waits for a page to
  settle.
- **Cross-tab flows** are out of scope until decision 2 is answered.

---

## Privacy and the Chrome Web Store

Recording raises the stakes, so the scope is deliberately narrow, and we should
describe it that way on the listing: recording happens **only while the user has
started it, only on the tab they chose, and with a visible indicator on the
page** — the overlay that already marks a live run. Secret fields are never
captured. Stored steps are role-and-name sentences, not page dumps.

That keeps the disclosure close to what we already declare (page content, at the
user's request) rather than opening the "records browsing activity" category,
which is a materially harder review.

---

## Appendix — one task, end to end

The user records: open the admin reports page, set the range to the last 7
days, export as CSV, download the file.

What the listeners and the worker actually see, in order:

```
tabs.onUpdated  url -> https://admin.acme.com/reports      (no click before it)
click    <button class="dd-trigger" aria-expanded="false">
click    <li role="option" data-v="7d">
tabs.onUpdated  url -> https://admin.acme.com/reports?range=7d
click    <button class="btn btn-primary">
change   <select name="fmt">  value="csv"                  (no coordinates)
click    <button id="dl">
```

Each is resolved in-page from `event.target` at the moment it fires. Two of
them exercise the awkward cases: the `change` has no coordinates to resolve
from, and `<select name="fmt">` has no accessible name, so the fallback chain
reaches its associated label, "Format".

Coalescing then applies rule 4 twice: the navigation to `?range=7d` belongs to
the click that caused it — "Last 7 days" — not to a later one. The opening
navigation has no click before it, so it stands as its own step.

```json
[
  {
    "tool": "navigate",
    "target": { "role": "page", "name": "Reports" },
    "url": "https://admin.acme.com/reports"
  },
  {
    "tool": "click",
    "target": { "role": "button", "name": "Date range", "state": "collapsed" },
    "url": "https://admin.acme.com/reports"
  },
  {
    "tool": "click",
    "target": { "role": "option", "name": "Last 7 days" },
    "url": "https://admin.acme.com/reports",
    "outcomeUrl": "https://admin.acme.com/reports?range=7d"
  },
  {
    "tool": "click",
    "target": { "role": "button", "name": "Export" },
    "url": "https://admin.acme.com/reports?range=7d"
  },
  {
    "tool": "select",
    "target": { "role": "combobox", "name": "Format" },
    "value": "CSV",
    "url": "https://admin.acme.com/reports?range=7d"
  },
  {
    "tool": "click",
    "target": { "role": "button", "name": "Download" },
    "url": "https://admin.acme.com/reports?range=7d"
  }
]
```

Six recorded steps become the first three lines of the skill shown earlier.
**Its fourth line — "Read the total from the Total revenue figure" — was never
recorded**: reading a number off the screen produces no event. The user added
it in review, which is the clearest illustration of why that screen exists. A
recording captures what was done to the page; the user supplies what they were
actually there for.
