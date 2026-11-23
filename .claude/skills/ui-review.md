---
description: 'Visual review of any UI change: renders the changed screen at desktop, tablet and mobile, overlays every row''s height and the px gap to the next row, and shows the user a before/after contact sheet. Use EVERY time you change something a user sees (TSX/JSX markup, Tailwind or CSS classes, layout, spacing, copy that changes layout), and whenever the user asks about spacing, alignment, layout or "how it looks", without being asked to.'
---

# UI review

**The goal is uniform spacing.** Every UI change must leave the screen evenly spaced on desktop, tablet and mobile: the same gap between rows of the same kind, and a clear step up between levels.

- If the review shows uneven gaps, the change isn't done. Fix them, including ones already on the screen you touched, or show them to the user and get an OK to leave them.
- Never ship a gap that differs from its siblings without a reason you can name.

The person you're working with wants to SEE every UI change, measured, without asking for it. After any change to something a person sees, finish with this review and show the result. Don't call a UI change done without it.

## What to deliver

1. **Three contact sheet images, one per viewport** (**desktop 1440×900, tablet 834×1194, mobile 390×844**), all sent in one `SendUserFile` call (display `render`). Each has **Before | After** columns and a row per scroll step. Each shot has:
   - every row boxed, with its height (`h 24`);
   - a green bar between rows labelled with the gap (`gap 12`);
   - all scroll positions of the screen, so the lower part of a long tab or modal is covered too.
2. **A short table of the gaps:** heading → first row, row → row, last row → next heading, and section → section, before and after.
3. **A list of inconsistencies**, with the cause (the classes involved, with file:line) and whether the change fixes them.

## Spacing rules to check

- **Rows of the same kind have identical gaps**, across the whole screen and across sibling sections. A 16 next to a 12 is a bug.
- **The spacing follows a hierarchy:** heading → first row ≤ row → row < last row → next group heading < section → section. When you change one level, check that the levels above and below still read as steps up. For example, making rows 16 means group gaps need 24.
- **Match the screen you're extending.** Reuse the `space-y-*` / `gap-*` the sibling sections use; don't introduce a new value.
- **Row height comes from the tallest control.** Different controls (a switch, a number input, a button) may make rows taller; that's fine as long as the gap stays the same.
- **Check all three viewports.** Wrapping on tablet or mobile often changes the gaps (`flex-col gap-2` stacks, `md:` grids collapsing).

## Before and after

- **Before** = the code without your change: the deployed .org app, or a server running `main`.
- **After** = your branch, running locally.

Use the same account, the same agent and the same screen state for both. If only one can be captured (a new screen), show it as "Current" and say so.

Run against the iblai.org environment (e.g. https://mentorai.iblai.org), never prod, logged in with the e2e creds from `e2e/.env.local`. Run one heavy browser job at a time.

## How to run it

Write a script in your scratchpad (not the repo) that requires the kit and this repo's Playwright:

```js
const { chromium } = require('<repo>/node_modules/@playwright/test');
const kit = require('<repo>/.claude/skills/ui-review-kit.cjs');

const prepare = async (page) => {
  // log in if needed, open the modal/tab, wait for the content
  await page.getByRole('tab', { name: 'Capabilities' }).click();
  await page.getByText('Global Capabilities').waitFor();
};
const opts = {
  prepare,
  storageState: '<state.json>',
  root: '<css selector of the area to measure>',
};

(async () => {
  const before = await kit.reviewViewports(chromium, {
    ...opts,
    url: '<before url>',
    outDir: '<scratch>/ui-review',
    tag: 'before',
  });
  const after = await kit.reviewViewports(chromium, {
    ...opts,
    url: '<after url>',
    outDir: '<scratch>/ui-review',
    tag: 'after',
  });
  for (const vp of Object.keys(after))
    console.log(vp, JSON.stringify(kit.summarize(after[vp].items)));
  console.log(
    await kit.contactSheet(chromium, {
      before,
      after,
      out: '<scratch>/ui-review/sheet.png',
      title: '<screen> spacing',
    }),
  ); // sheet-desktop.png, sheet-tablet.png, sheet-mobile.png
})();
```

- **`root`** limits the measurement to the changed area, such as the modal's content panel. Without it the whole page is measured, which is noisy.
- **`items`**: pass a CSS selector for the rows when the automatic detection picks the wrong elements. The automatic detection uses the children of every vertical stack, ignoring anything nested inside another row.
- **`prepare(page, viewport)`** runs per viewport. Use it to log in, navigate, open modals, and scroll a container into view. On mobile the layout may differ (drawers instead of sidebars), so branch on `viewport` if needed.
- **The JSON** per viewport (`<tag>-<viewport>.json`) has every row's text, height, gap to the next row and classes. Use it for the gap table and to find the cause of each difference in code.
- **Fonts:** if the demo-video skill is installed in `~/.claude/skills/`, the kit uses its Inter fontconfig so text renders like it does on a Mac; otherwise Linux falls back to DejaVu Sans.

**Delete any saved login-state file afterwards.**
