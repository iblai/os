# ibl.ai — Chrome Side Panel Extension

A Manifest V3 Chrome extension whose **side panel** is the platform's chat and
nothing else — no tabs, no settings row, nothing above it.

- The chat is the
  [`@iblai/agent-ai`](https://github.com/iblai/iblai-web-frontend/tree/main/packages/agent-ai)
  `<agent-ai>` web component (vendored, self-registers the element), in light
  theme. The active tab's text is fed to it as context.
- **Cowork** is a mode of that chat, not a second surface. It is the same pill as
  on the desktop app; here the driver is the extension's **service worker**, which
  reads the page — every frame of it and every open shadow root, so an embedded
  chat, editor or widget is seen too — as one numbered list of elements, decides
  one action, performs it, and repeats until it answers. Model calls go through the platform's
  OpenAI-compatible endpoint with your own session; nothing else leaves the
  browser.

## Build and load

The panel is a Vite + React app; `public/` is copied into the build verbatim.

```bash
pnpm install
pnpm ext:build          # → extensions/chrome/dist
pnpm ext:watch          # rebuild on change (there is no dev server for a packaged panel)
```

1. Open `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select `extensions/chrome/dist`.
3. Click the toolbar icon to open the side panel and sign in.

## Configuration

There is nothing to configure in the UI, and one thing to configure at build
time: copy `.env.example` to `.env.local` (gitignored) and set

- `VITE_MENTOR_URL` — the web app the panel loads in its iframe. Unset it and
  the build points at `https://os.ibl.ai`, which is what CI publishes; set it to
  `http://localhost:3000` to develop against `pnpm dev`. Vite reads `.env.local`
  from this directory, so the value is baked in by `pnpm ext:build` — including
  into the manifest: `public/manifest.json` carries `__MENTOR_ORIGIN__` in
  `frame-src`/`child-src` and the build replaces it with this host's origin
  (`src/mentor-origin.ts`), so whatever you point it at is framed instead of
  blocked by CSP. A platform on another domain still needs its DM hosts added to
  `connect-src` by hand; that comes from `PLATFORM_DOMAIN`, not from here.

The rest are constants in `src/settings.ts`:

- `PLATFORM_DOMAIN` (`iblai.app`) — every DM host derives from it. The platform
  answers on more than one: chat streams from `asgi.data.<domain>` (only the ASGI
  host can stream) while the model list is served from the DM base,
  `base.manager.<domain>` or `api.<domain>/dm`. `apiBases()` tries those in
  order — the same list, for the same reason, as `fetch_tenant_models` in
  `src-tauri/src/remote_code.rs` — and if none answers it reports each host and
  what it said. Pairs with `AUTH_URL` in `src/auth.ts`.
- The model is not configured: the first run lists what the platform can use and
  picks one (`pickModel`: Opus, then Sonnet, then GPT-5, else the first), then
  caches it in `chrome.storage.local`.

There is no allow list: the agent acts on whatever page is in the active tab.
Only `http` and `https` pages can be driven at all, because `chrome.scripting`
cannot inject anywhere else. The manifest's `connect-src` allows `*.iblai.app`
and `*.ibl.ai`; a platform on another domain needs its origin added there before
the build, or every request is blocked by CSP.

Cowork is **on when the panel opens** — driving the tab is what the panel is
for, and there is no consent dialog to dismiss: Chrome asked at install time,
and the panel states what Cowork does to the tab under its own switch. Switch it
off and that is remembered; the pill's panel is also where you switch it back on.

What the agent can do: click, type (never into password or payment fields — it
asks you to type those), select, scroll, open a URL, go back, read the page
again, wait. Controls inside iframes (Gmail's Chat, an embedded editor) and open
shadow roots are numbered like the page's own, and an action lands in the frame
its element lives in. **Approvals** in the Cowork panel decides whether it checks with
you first: _Automatic_ (the default) acts without asking, _Ask Me_ raises an
approve/deny card before a submit, a payment, a send or a delete. Neither mode
lets it type into a password or payment field — that is refused outright, in the
page. A run stops after 40 steps or its token budget — it says which —
and **Stop** aborts it at any time. Closing the panel drops the port that keeps
the worker alive, which ends the run.

Every action is reported as it happens; typed text is never shown.

Language: the agent answers in the first of Chrome's **preferred languages**
(`chrome.i18n.getAcceptLanguages`, i.e. Accept-Language — `chrome://settings/languages`),
named in the system prompt, unless you write to it in another language. The
extension's own strings — the action log, the errors — come from `_locales/` and
follow the **browser UI language** instead, which is the one thing
`chrome.i18n.getMessage` resolves against.

## Files

```
panel.html                 Vite entry: the React panel + the vendored <agent-ai> script
vite.config.ts             the panel build (root is this directory)
vite.worker.config.ts      the service worker, built separately so it is ONE file
tsconfig.json              extension-only typecheck (pnpm typecheck runs it too)
public/manifest.json       MV3 manifest (side_panel, action, permissions, CSP, i18n)
public/_locales/           en, es, fr, zh_CN — every key in all four
public/vendor/agent-ai.umd.js  vendored @iblai/agent-ai build
src/background.ts          the worker's entry point: listeners only
src/browse-worker.ts       the port protocol and the run (this is where the loop lives)
src/browse-bridge.ts       panel-side relay between the iframe and the worker port
src/browse-protocol.ts     the port message types, shared by both ends
src/App.tsx                the panel: the chat, behind a sign-in gate
src/mentor-chat.tsx        <agent-ai> + session install + context feed + bridge
src/settings.ts            the host constants and the cached model
src/mentor-origin.ts       build-time: the mentor URL default and the manifest's CSP hole
src/auth.ts                chrome.identity sign-in against the auth SPA
src/mentor-frame.ts        installs the session into the mentor iframe; context feed
src/page-scripts.ts        the functions injected into the tab (snapshot, act, settle)
src/tools.ts               the agent's tools: gating, confirmations, execution
src/agent.ts               the model loop (Vercel AI SDK, OpenAI-compatible endpoint)
src/__tests__/             vitest, with a chrome.* stub
```

## Tests

```bash
pnpm exec vitest run extensions/chrome
pnpm typecheck
```

## How Cowork is driven here

The pill lives in the mentor app's own composer
(`components/chat-input-form/inside-buttons.tsx`) and reads **Cowork** on every
host — what changes in the panel is the driver, not the name. On the desktop app
it is the Tauri Cua Driver; here it is this extension's service worker, and none
of the Cua Driver's install or OS-permission calls are made.
`hooks/use-in-extension-panel.ts` detects the panel with a handshake it answers,
so the pill appears there and not in an ordinary tab.

Being on means `ibl_cowork_enabled` is set, which is what already routes the
turn through the DM's OpenAI-compatible endpoint — so the panel writes the pref
rather than only its own state: the SDK (`shouldUseRemoteAiChat`, the Cowork tool
list) and the submit in `components/chat/index.tsx` all read it back through
`isCoworkEnabled()`. Only an unset pref defaults on, which is how an explicit off
survives, and the panel's iframe has its own partitioned storage, so none of this
reaches the same app in an ordinary tab. Submitting a goal goes to
`hooks/use-browse-run.ts` instead of the normal send:

    composer → postMessage → browse-bridge.ts → chrome.runtime port
             → browse-worker.ts (the loop, chrome.scripting) → back the same way

The run renders as one ordinary assistant turn, because `use-browse-run` drives
the same Redux lifecycle `useRemoteChat` uses (`setCurrentStreamingMessage` →
`ensureStreamingAssistantMessage` per delta → `appendMessageToActiveTab` on
finish), with each action added via `addToolCall`. Confirmations reuse the
in-thread approve/deny card in `components/chat/code-permission-card.tsx`.

## Release

Bump `public/manifest.json`'s `version` on `main`; the
`release-chrome-extension.yml` workflow installs, builds, zips `dist/` and
publishes to the Chrome Web Store (needs the `CHROME_*` repo secrets — see the
workflow header). CI has no `.env.local`, so what it publishes always points at
`https://os.ibl.ai`; nothing about a local dev setup can leak into a release.

## Updating the agent component

Copy a fresh `dist/index.umd.js` from the SDK's `packages/agent-ai` build over
`public/vendor/agent-ai.umd.js` (the directory is prettier-ignored so it stays
as published). Vendored: `@iblai/agent-ai` 2.6.1.
