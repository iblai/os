# Desktop auto-update: setup, release flow, and local end-to-end test

Runbook for the in-app updater of the ibl.ai desktop app (macOS DMG and
Windows installers). The app-side code, the Tauri config, the release
workflows and a local test harness are in the repo. Enabling updates is a
matter of having a signing key pair whose public half is committed and whose
private half lives in two GitHub secrets — this doc covers both the case
where that key already exists and the case where you have to create one.

Repo: `github.com/iblai/os` (the old `iblai/mentorai` name redirects there).

## How it works (30-second version)

1. Every `app-v<X>` release build signs its update bundle with a **minisign
   private key** and uploads extra assets to that release:
   `ibl.ai_<X>_universal.app.tar.gz`, its `.sig`, and
   `latest-darwin-<arch>.json` (Windows: the `-setup.exe.sig` and
   `latest-windows-<arch>.json`).
2. The manifests are also copied to a **rolling release tagged `app-latest`**.
   That is the fixed URL every installed app polls at launch:
   `https://github.com/iblai/os/releases/download/app-latest/latest-<target>-<arch>.json`
3. The installed app verifies the download against the **public key baked
   into `src-tauri/tauri.conf.json`** (`plugins.updater.pubkey`), installs it,
   and relaunches.

Nothing runs on our servers. GitHub Releases is the whole update feed.

### What the user sees

On **every open of the app** (and every full reload, e.g. right after
sign-in) the app asks the feed. If a newer version exists it shows a dialog:

> **Update Available**
> Version 0.96.0 is ready to install. You are running an older version.
> [Later] [**Update Now**]

- **Update Now** — desktop: download, verify the signature, install, relaunch
  (a progress bar shows meanwhile). iOS/Android: opens the App Store / Play
  Store page (stores own installation there).
- **Later** — quiet for the rest of this app session only. The next launch
  asks again. There is deliberately no "skip this version".

The dialog is React code in the web frontend (`components/app-update-prompt.tsx`,
mounted in `app/layout.tsx`), so it only appears once the platform the app
loads has been deployed from a branch that contains it, and only after sign-in
(the layout does not render for anonymous visitors).

The dialog shows no release notes (decided 2026-09-14: git-derived notes
would surface developer-facing commit subjects; revisit with a curated
source if notes are wanted).

## The signing key pair

The updater is only as trustworthy as this key pair:

| Half        | Lives in                                                                  | Used for                                          |
| ----------- | ------------------------------------------------------------------------- | ------------------------------------------------- |
| Public key  | `src-tauri/tauri.conf.json` → `plugins.updater.pubkey` (committed)        | Every installed app verifies downloads against it |
| Private key | GitHub secret `TAURI_SIGNING_PRIVATE_KEY` + the password manager          | CI signs each release's update bundle             |
| Password    | GitHub secret `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` + the password manager | Unlocks the private key in CI                     |

Rules that follow from this:

- **The key must have a password.** The Tauri CLI cannot sign
  non-interactively with a password-less minisign key (it tries to prompt on
  a terminal, which CI does not have) — the build fails with "Wrong password
  for that key". Always generate with `--password`.
- **The private key + password are the only things that can produce an
  update installed apps will accept.** Losing them strands every installed
  app on its current version (users reinstall by hand). Store both in the
  shared password manager (suggested entry: "ibl.ai desktop updater key").
  Never share them through chat or email.
- **Public and private halves are a pair.** Signing with a key whose public
  half is not the one in `tauri.conf.json` produces updates that every app
  rejects with a signature error.

### Which situation are you in?

Check what is pinned in the repo:

```bash
jq -r .plugins.updater.pubkey src-tauri/tauri.conf.json | base64 -d | head -1
# -> "untrusted comment: minisign public key: <KEY ID>"
```

Then look in the password manager for the "ibl.ai desktop updater key"
entry, and at `iblai/os` → Settings → Secrets and variables → Actions for
`TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

- **Password-manager entry exists and its key id matches the pinned one** →
  follow [A. You already have the key](#a-you-already-have-the-key).
- **No entry, or the entry's key id does not match, or the entry has no
  password** → follow [B. You need to create the key](#b-you-need-to-create-the-key).
  (A key id mismatch means someone generated a new pair without committing
  the public half, or vice versa; the committed public key is what installed
  apps trust, so "the key" is whichever private key matches it — if that one
  is gone, you are in situation B.)

The key id is the last field of the first line of both the `.key` and the
`.pub` file (`untrusted comment: minisign … key: C8756041C3743C2C`), so
matching is a string comparison.

Secrets cannot be read back from GitHub. If you are unsure whether the stored
secrets are the right pair, just set them again from the password manager —
overwriting with the correct values is always safe.

## A. You already have the key

1. Save the two values from the password manager to files on your machine
   (the paths below are the ones the local test script defaults to):

   ```bash
   mkdir -p ~/.tauri && chmod 700 ~/.tauri
   # paste the full key text (both lines, including "untrusted comment:")
   cat > ~/.tauri/ibl-ai-os-updater.key
   # paste the password, no trailing newline needed
   cat > ~/.tauri/ibl-ai-os-updater.password
   chmod 600 ~/.tauri/ibl-ai-os-updater.key ~/.tauri/ibl-ai-os-updater.password
   ```

2. Set (or overwrite) the two GitHub secrets — either in the web UI, or with
   `gh` logged in with write access:

   ```bash
   gh secret set TAURI_SIGNING_PRIVATE_KEY --repo iblai/os < ~/.tauri/ibl-ai-os-updater.key
   gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --repo iblai/os < ~/.tauri/ibl-ai-os-updater.password
   ```

3. Continue at [Release and verify](#release-and-verify).

## B. You need to create the key

Do this once, on any machine with the repo's Rust/Tauri toolchain
(`cargo tauri --version` works).

1. Generate the pair **with a password**:

   ```bash
   mkdir -p ~/.tauri && chmod 700 ~/.tauri
   openssl rand -hex 24 > ~/.tauri/ibl-ai-os-updater.password
   cd src-tauri
   cargo tauri signer generate \
     -w ~/.tauri/ibl-ai-os-updater.key \
     --password "$(cat ~/.tauri/ibl-ai-os-updater.password)"
   chmod 600 ~/.tauri/ibl-ai-os-updater.key ~/.tauri/ibl-ai-os-updater.password
   ```

   This writes `ibl-ai-os-updater.key` (private) and
   `ibl-ai-os-updater.key.pub` (public) next to each other.

2. Prove the pair signs non-interactively (this is exactly what CI does):

   ```bash
   echo test > /tmp/sigtest && cargo tauri signer sign \
     -f ~/.tauri/ibl-ai-os-updater.key \
     -p "$(cat ~/.tauri/ibl-ai-os-updater.password)" /tmp/sigtest \
     && echo "signing works" && rm /tmp/sigtest /tmp/sigtest.sig
   ```

3. Pin the public half in the repo — replace the value of
   `plugins.updater.pubkey` in `src-tauri/tauri.conf.json` with the
   **single-line** contents of the `.pub` file:

   ```bash
   PUB="$(cat ~/.tauri/ibl-ai-os-updater.key.pub)"
   jq --arg pub "$PUB" '.plugins.updater.pubkey = $pub' src-tauri/tauri.conf.json \
     > /tmp/tauri.conf.json && mv /tmp/tauri.conf.json src-tauri/tauri.conf.json
   pnpm prettier --write src-tauri/tauri.conf.json
   ```

   Commit that change on the branch that will be released. Every app built
   from it trusts the new key; **apps built before it keep trusting the old
   public key** — see "Rotating the key" below before doing this to a
   product that already has updater-enabled installs in the field.

4. Store both halves: the private key and the password go into the password
   manager (entry "ibl.ai desktop updater key", include the key id from the
   file's first line so future readers can match it against
   `tauri.conf.json`). Keep the `.pub` there too for reference.

5. Set the two GitHub secrets exactly as in step A.2, and continue at
   [Release and verify](#release-and-verify).

The other CI secrets — Apple signing/notarization (`APPLE_CERTIFICATE`,
`APPLE_CERTIFICATE_PASSWORD`, `APPLE_ID`, `APPLE_PASSWORD`) — are unrelated to
the updater and are already configured; the existing DMG releases prove that.

## Release and verify

### 1. Ship a release

Any change under `src-tauri/` merged to `main` triggers
`tauri-autoversion.yml`, which bumps the app version in `tauri.conf.json`,
commits, and pushes an `app-v<X>` tag. That tag runs `release-macos-dmg.yml`
and `release-windows.yml`. (The branch carrying the updater work and the
pinned public key must be merged first, obviously.)

The first updater-enabled run creates the `app-latest` release
automatically. **Never delete that release or its tag**: every installed app
polls it.

What a missing/wrong secret does: with no `TAURI_SIGNING_PRIVATE_KEY` the
build still succeeds but silently skips the updater assets (that is why the
pre-updater `app-v0.95.x` releases have none). With the key present but the
password wrong or missing, the build **fails** at "failed to decode secret
key" — recheck both secrets.

### 2. Verify the release

The `app-v<X>` release should list:

```
ibl.ai_<X>_universal.dmg
ibl.ai_<X>_universal.app.tar.gz
ibl.ai_<X>_universal.app.tar.gz.sig
latest-darwin-aarch64.json
latest-darwin-x86_64.json
ibl.ai_<X>_x64-setup.exe        (+ .sig)
ibl.ai_<X>_arm64-setup.exe      (+ .sig)
latest-windows-x86_64.json
latest-windows-aarch64.json
```

And the feed must answer with that version:

```bash
curl -sL https://github.com/iblai/os/releases/download/app-latest/latest-darwin-aarch64.json | jq .version
curl -sL https://github.com/iblai/os/releases/download/app-latest/latest-windows-x86_64.json | jq .version
```

If the `.app.tar.gz` is missing, the workflow log for the "Build, sign &
notarize DMG" step will say the signing key was not found: recheck the
secrets.

### 3. Prove an end-to-end update once, for real

1. Install the DMG from the first updater-enabled release (call it `A`).
2. Ship any `src-tauri` change to `main` so release `B` is produced.
3. Launch `A` and sign in. Within a few seconds the "Update Available"
   dialog should appear; click Update Now. The app downloads, verifies,
   installs and relaunches as `B`. Check the version in About.

## Local end-to-end test (no GitHub release needed)

For reviewing the flow on a Mac before anything is released. Takes ~10 min,
mostly two release builds.

Prerequisites:

- the updater key + password at `~/.tauri/ibl-ai-os-updater.key` and
  `~/.tauri/ibl-ai-os-updater.password` (situation A or B above; any
  password-protected pair works for a local run as long as the app is built
  with its public half — the script builds from the checkout, so the pair
  must match what `tauri.conf.json` pins). Other paths: set
  `UPDATER_KEY_FILE` / `UPDATER_KEY_PASSWORD_FILE`, or export
  `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`;
- the web frontend running locally: `pnpm dev` on `http://127.0.0.1:3000`
  (production does not have the prompt until it is deployed from the branch);
- Xcode command-line tools, Rust, `cargo tauri`, `jq`, `python3`.

Run:

```bash
scripts/updater-local-test.sh
```

It builds the app at the current version into `~/Desktop/ibl-update-test/old/`
with its updater pointed at `http://127.0.0.1:8765`, builds the next patch
version into `new/` with a signed update bundle, writes
`server/latest-darwin-<arch>.json`, and starts the manifest server. Then:

```bash
TAURI_APP_URL=http://127.0.0.1:3000 ~/Desktop/ibl-update-test/old/ibl.ai.app/Contents/MacOS/ibl-ai-os
```

Expected: sign in → the dialog shows the new version → **Update Now** →
progress bar → the app relaunches → About shows the new version, and
`~/Desktop/ibl-update-test/old/ibl.ai.app` now _is_ the new version. Check
also: **Later** hides it; Cmd+R re-prompts (it checks on every load); quit and
relaunch after Later prompts again.

`scripts/updater-local-test.sh --reset` puts the old version back to run it
again; `--serve` restarts the manifest server alone.

Why the launch command looks like that: Finder's `open` passes no environment
and a Finder-launched app cannot read `src-tauri/.env.local` under
`~/Documents` without a permission grant, so it would load production — where
the prompt does not exist yet — and nothing would happen.

## iOS version and build number (App Store Connect)

iOS has its own version line on App Store Connect (last approved `1.1.19`; it
can never go backwards, so the desktop's `0.95.x` in `tauri.conf.json` cannot
be reused). It lives in the iOS-only overlay `src-tauri/tauri.ios.conf.json`,
which Tauri merges over `tauri.conf.json` for iOS builds:

```json
{ "version": "1.1.20", "bundle": { "iOS": { "bundleVersion": "2" } } }
```

- `version` → `CFBundleShortVersionString` (marketing version). Bump per release.
- `bundle.iOS.bundleVersion` → `CFBundleVersion`, a plain counter. App Store
  Connect rejects a repeated build number for the same version, so bump it for
  **every** upload (`3`, `4`, …) and reset it to `1` on a new version.
  Note: `cargo tauri ios build --export-method app-store-connect` exports with
  Xcode's `manageAppVersionAndBuildNumber`, which asks App Store Connect and
  auto-raises the **exported IPA's** build number past any it already holds
  (the archive keeps the repo's value). So an upload may carry a higher build
  than the overlay; after uploading, set `bundleVersion` to that number so the
  repo and the store stay in step.

`cargo tauri ios build` rewrites `gen/apple/ibl-ai-os_iOS/Info.plist` from the
overlay; if you archive from Xcode (Product > Archive) instead, keep the two
plist values in step by hand. The overlay must stay comment-free: Tauri's config
schema rejects unknown keys.

## Things to know

- **Users on pre-updater builds (0.95.19 and older) have no updater.** They
  download the first updater-enabled DMG once by hand; from then on updates
  are in-app.
- **Self-update is off by design** in the Mac App Store build (App Sandbox —
  that is also why local test builds must use `tauri.devid.conf.json`), in
  tenant-locked builds (`IBL_TENANT` set), and in debug builds. Those builds
  never see the prompt.
- **A failed feed never breaks the app.** Offline, 404, or a bad manifest all
  resolve to "no update available" with a log line, so a broken release only
  delays updates, it does not crash anyone.
- **Rotating the key** (situation B while updater-enabled apps are already
  installed) needs a bridge: ship one release that carries the NEW public key
  in `tauri.conf.json` but is still signed by the OLD private key, so
  installed apps accept it; only then switch the secrets to the new key. Skip
  the bridge and every existing install rejects all future updates. Rotating
  before any updater-enabled release exists needs no bridge.

## Troubleshooting

| Symptom                                                        | Cause                                                                      | Fix                                                                                 |
| -------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Release has DMG but no `.app.tar.gz` / `.sig`                  | `TAURI_SIGNING_PRIVATE_KEY` unset                                          | Add the secret; rerun the tag's workflow                                            |
| Build fails: "failed to decode secret key … Wrong password"    | `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` missing/wrong, or a password-less key | Set both secrets from the password manager; if the key has no password, situation B |
| Feed URL returns 404                                           | `app-latest` release missing or manifests not uploaded                     | Rerun the workflow; check its "Publish updater manifests" step                      |
| App logs `[AppUpdate] check failed: … signature`               | Private key in CI is not the pair of the pubkey in the installed app       | Sign with the key whose `.pub` is in `tauri.conf.json` (compare key ids)            |
| Update downloads but install fails on macOS                    | App not writable (installed by another user, or running from the DMG)      | Install to `/Applications` from the DMG                                             |
| Local test: no dialog, `bind: Operation not permitted` in logs | Built with the default (Mac App Store, sandboxed) config                   | Use `scripts/updater-local-test.sh` (Developer ID config)                           |
| Local test: app opens production instead of localhost          | Launched via Finder / `open`                                               | Launch the binary from a terminal with `TAURI_APP_URL=http://127.0.0.1:3000`        |
| Local test: dialog never appears                               | Not signed in, or the frontend loaded has no prompt                        | Sign in; make sure `:3000` serves the branch with `components/app-update-prompt`    |
