# ibl.ai Agent — Chrome Side Panel Extension

A Manifest V3 Chrome extension that opens an ibl.ai agent in the browser
**side panel**. The chat UI is the
[`@iblai/agent-ai`](../../../ibl-frontend/packages/agent-ai) `<agent-ai>` web
component, vendored locally and mounted directly in `panel.html`.

## Load it (unpacked)

1. Open `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select this `extensions/chrome/` folder.
3. Click the toolbar icon to open the side panel.

## Configure the agent

Edit the `<agent-ai>` attributes in [`panel.html`](./panel.html) — set `tenant`
and `mentor` for your agent, and adjust `mentorurl` / `authurl` / `lmsurl` /
`theme` as needed. See the component's
[attribute reference](../../../ibl-frontend/packages/agent-ai/README.md).

## Files

```
manifest.json          MV3 manifest (side_panel, action, CSP)
background.js           opens the panel on toolbar click
panel.html / panel.css  the side panel hosting <agent-ai>
vendor/agent-ai.umd.js  vendored @iblai/agent-ai build (self-registers the element)
icons/
```

## Updating the agent component

```bash
cp ../ibl-frontend/packages/agent-ai/dist/index.umd.js \
   extensions/chrome/vendor/agent-ai.umd.js
```

(Vendored: `@iblai/agent-ai` 2.6.1.)
