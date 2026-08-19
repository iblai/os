# Deploying ibl.ai/os against our backend

This guide shows how to ship every surface **Web, macOS, Windows/Surface, Linux, iOS, Android** (and the Chrome extension) — pointed at ibl.ai backend.

> Looking for the web asset-hosting / CDN rollout design instead? See [`DEPLOYMENT.md`](DEPLOYMENT.md).

## The mental model (read this first)

There is **one** frontend — the Next.js web app. Every native app is a thin **native webview shell that loads that web app**. So there are only two things to configure:

| Layer                                                       | What it is                                                | How you point it at our backend                                        |
| ----------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Web app**                                                 | The Next.js SPA (also what you self-host at your domain)  | `NEXT_PUBLIC_*` env vars — build-time **or** runtime (`window.__ENV__`) |
| **Native shells** (macOS / Windows / Linux / iOS / Android) | Tauri wrappers that load your hosted web app in a webview | `TAURI_DEV_URL` **compile-time** env var → your web app's URL           |

So the recipe for every native platform is the same: **deploy the web app at your domain first**, then **build the native shell with `TAURI_DEV_URL=https://your-app.example.com`**.

```
   Our backend services                your web app                 native shells
 (api / auth / lms / asgi / livekit) ──►  Next.js SPA  ◄────────────  macOS · Windows · Linux
        set via NEXT_PUBLIC_*           (Docker / host)   TAURI_DEV_URL   iOS · Android
```

---

## 1. Configure the web app (applies to every surface)

Copy [`.env.example`](../.env.example) → `.env` and point the core URLs at our deployment. The ones that matter for "against our backend":

| Variable                                                           | Points at                                            | Example                       |
| ------------------------------------------------------------------ | ---------------------------------------------------- | ------------------------------|
| `NEXT_PUBLIC_AUTH_URL`                                             | our login / auth SPA                                 | `https://login.iblai.app`     |
| `NEXT_PUBLIC_API_BASE_URL`                                         | our API gateway (SDK derives `/lms`, `/dm`, `/axd`)  | `https://api.iblai.app`       |
| `NEXT_PUBLIC_LEGACY_LMS_URL`                                       | legacy LMS, if separate                              | `https://learn.iblai.app`     |
| `NEXT_PUBLIC_BASE_WS_URL`                                          | our ASGI / websocket host                            | `wss://asgi.data.iblai.app`   |
| `NEXT_PUBLIC_IBL_LIVE_KIT_SERVER_URL`                              | our LiveKit server (voice / screen-share)            | `wss://livekit.call.iblai.app`|
| `NEXT_PUBLIC_MENTOR_URL` / `NEXT_PUBLIC_MENTOR_IFRAME_URL`         | your web app's own URL (embeds / deep-links)         | `https://app.example.com`     |
| `NEXT_PUBLIC_MAIN_TENANT_KEY` / `NEXT_PUBLIC_PLATFORM_BASE_DOMAIN` | your tenant + domain                                 | `main` / `example.com`        |

See [`.env.example`](../.env.example) for the full list (branding, Stripe, feature flags, etc.).

**Build-time vs runtime:** `NEXT_PUBLIC_*` values are baked in at `pnpm build`. For **web / Docker only**, they can also be overridden at container start — `entrypoint.sh` writes them into `public/env.js` as `window.__ENV__`, which `lib/config.ts` prefers over the baked-in values. Native shells have no runtime override; they just load the URL you compile in (below).

---

## 2. Web (Docker / self-hosted)

```bash
pnpm install
pnpm build          # → .next/standalone (self-contained Node server)
node server-wrapper.js
```

Or with Docker (runtime-configurable — no rebuild to change backends):

```bash
docker build -t iblos .
docker run -p 5000:5000 --env-file .env iblos   # entrypoint.sh injects window.__ENV__
```

- **Full guide:** [`standalone-deployment.md`](standalone-deployment.md) (output mode, env vars, troubleshooting).
- **Enterprise / Docker images:** README → [Deployment](../README.md#deployment) and [iblai/iblai-infra-cli](https://github.com/iblai/iblai-infra-cli).
- **Release automation (reference):** `release.yml` bumps + tags `v*` → `trigger-docker-build.yml` → `reusable-spa-docker-build.yml` builds and pushes the image.

---

## 3. macOS (.dmg direct download + Mac App Store)

Build the web frontend, then the signed app — pointing it at  backend via `TAURI_DEV_URL`:

```bash
# Direct-download .dmg (Developer ID, notarized):
TAURI_DEV_URL=https://app.example.com pnpm tauri:build:devid

# Mac App Store (sandboxed) build:
TAURI_DEV_URL=https://app.example.com pnpm tauri:build:mas
```

Both run `pnpm build` first, then `cargo tauri build` (universal Intel + Apple Silicon). You'll need **your own** Apple signing identity and notarization credentials — replace the IBL identity in [`src-tauri/tauri.conf.json`](../src-tauri/tauri.conf.json) (`bundle.macOS.signingIdentity`, `providerShortName`, `iOS.developmentTeam`).

- **Full guide (MAS vs Developer ID, certs, notarization):** [`macos-builds.md`](macos-builds.md)
- **Release automation (reference):** a `src-tauri/**` change triggers `tauri-autoversion.yml` → bumps the version, tags `app-v*` → `release-macos-dmg.yml` (→ `reusable-release-macos-dmg.yml`) signs, notarizes, and attaches the DMG to the GitHub Release.

---

## 4. Windows / Surface (NSIS/MSI installer + Microsoft Store)

```bash
TAURI_DEV_URL=https://app.example.com pnpm tauri:build        # NSIS + MSI
```

- Builds **x64 and ARM64** (Surface) installers; set your code-signing cert via `bundle.windows.certificateThumbprint` in `tauri.conf.json` (CI injects it from a secret).
- **Microsoft Store (MSIX):** [`../src-tauri/MSIX-BUILD-GUIDE.md`](../src-tauri/MSIX-BUILD-GUIDE.md) + `src-tauri/build-msix.ps1`.
- **Release automation (reference):** `release-windows.yml` → `reusable-release-windows.yml` (cert import, sign, attach installers to the Release).

---

## 5. Linux

Build from source (no CI release is published for Linux):

```bash
TAURI_DEV_URL=https://app.example.com cargo tauri build --target x86_64-unknown-linux-gnu
# ARM64: --target aarch64-unknown-linux-gnu   (see `make tauri-build-linux-arm`)
```

Produces a `.deb` / binary under `src-tauri/target/`. See [`development.md`](development.md) and the `tauri-build-linux*` targets in the [`Makefile`](../Makefile).

---

## 6. iOS (TestFlight / App Store)

Tauri generates an Xcode project; you archive and submit it manually.

```bash
# Local device/simulator dev (auto-detects your machine's IP as the dev URL):
make dev-mobile        # in one terminal (serves the web app on :3001)
make tauri-ios-dev     # in another

# Release build → produces the Xcode project to archive:
make tauri-ios-build
```

Self-hoster checklist:

- Set **your** Apple `developmentTeam` in `tauri.conf.json` (`bundle.iOS.developmentTeam`).
- Point the app at your backend with `TAURI_DEV_URL` — see `get_app_url()` in [`../src-tauri/src/lib.rs`](../src-tauri/src/lib.rs) (defaults to `https://os.ibl.ai`).
- Update the **deep-link / universal-link hosts** in `tauri.conf.json` (`plugins.deep-link.mobile`) to your domains, and serve an [AASA file](handling-existing-users-aasa.md) at `https://your-domain/.well-known/apple-app-site-association`.
- **Full setup (Xcode, provisioning, device builds, TestFlight):** [`tauri-ios-setup.md`](tauri-ios-setup.md).

> Status: **manual release** — build tooling is automated, but archiving/submitting to App Store Connect is a manual Xcode step (no CI workflow).

---

## 7. Android (Google Play)

```bash
# Local device dev:
make tauri-android-dev

# Release artifacts:
make tauri-android-build       # APK
make tauri-android-build-aab   # AAB for the Play Store
```

Self-hoster checklist:

- Provide a signing keystore via `src-tauri/gen/android/key.properties` (kept local / out of git).
- Point at your backend with `TAURI_DEV_URL`; deep-link schemes are re-injected before each build by `scripts/android-add-deep-link-scheme.sh` (idempotent). Update the deep-link **host** in `tauri.conf.json` to your domain and serve `https://your-domain/.well-known/assetlinks.json`.
- Submit the AAB via the Google Play Console.

> Status: **build-from-source + manual release** — no CI workflow and no dedicated doc yet; the Tauri-mobile flow mirrors iOS ([`tauri-ios-setup.md`](tauri-ios-setup.md)).

---

## 8. Chrome extension (side panel)

Point `extensions/chrome/panel.html`'s `mentorurl` at your web app, bump `extensions/chrome/manifest.json`'s `version`, and the `release-chrome-extension.yml` workflow publishes to the Chrome Web Store (needs the `CHROME_*` repo secrets configured — see the workflow header).

---

## Reference: what's automated vs. manual

| Surface        | Point at your backend                            | Build                             | Official release path             |
| -------------- | ------------------------------------------------ | --------------------------------- | --------------------------------- |
| **Web**        | `NEXT_PUBLIC_*` (build **or** runtime `__ENV__`) | `pnpm build` / Docker             | ✅ CI → Docker image              |
| **macOS**      | `TAURI_DEV_URL` (compile-time)                   | `pnpm tauri:build:devid` / `:mas` | ✅ CI → signed DMG + Release      |
| **Windows**    | `TAURI_DEV_URL`                                  | `pnpm tauri:build`                | ✅ CI → signed NSIS (x64 / ARM64) |
| **Linux**      | `TAURI_DEV_URL`                                  | `cargo tauri build`               | ⚠️ Build from source only         |
| **iOS**        | `TAURI_DEV_URL` + Team ID                        | `make tauri-ios-build`            | ⚠️ Manual Xcode → App Store       |
| **Android**    | `TAURI_DEV_URL` + keystore                       | `make tauri-android-build[-aab]`  | ⚠️ Manual → Play Console          |
| **Chrome ext** | `panel.html` `mentorurl`                         | manifest version bump             | ⚠️ CI (needs `CHROME_*` secrets)  |

**One-line rule:** deploy the web app at your domain, then rebuild each native shell with `TAURI_DEV_URL=https://your-domain` and your own signing credentials.
