# Desktop auto-update: DevOps setup

Runbook for turning on in-app updates for the ibl.ai desktop app (macOS DMG
and Windows installers). The app-side code, the Tauri config and the release
workflows are already in the repo; what remains is one GitHub secret, one
merge, and a verification pass.

Repo: `github.com/iblai/os` (the old `iblai/mentorai` name redirects there).

## How it works (30-second version)

1. Every release build signs its update bundle with a **minisign private
   key** and uploads three extra assets to the `app-v<X>` release:
   `ibl.ai_<X>_universal.app.tar.gz`, its `.sig`, and
   `latest-darwin-<arch>.json` (Windows: the `-setup.exe.sig` and
   `latest-windows-<arch>.json`).
2. The manifests are also copied to a **rolling release tagged `app-latest`**.
   That is the fixed URL every installed app polls at launch:
   `https://github.com/iblai/os/releases/download/app-latest/latest-<target>-<arch>.json`
3. The installed app verifies the download against the **public key baked
   into `src-tauri/tauri.conf.json`**, installs it, and relaunches.

Nothing runs on our servers. GitHub Releases is the whole update feed.

## What to collect from Raza

| Item                | Where it is                                    | Goes to                                                      |
| ------------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| Private signing key | `~/.tauri/ibl-ai-os-updater.key` on Raza's Mac | GitHub secret `TAURI_SIGNING_PRIVATE_KEY` + password manager |

That is the only item. The key was generated without a password, so
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` stays unset.

The public half (`ibl-ai-os-updater.key.pub`, key id `5E1AE1F058F95AC8`) is
already committed in `tauri.conf.json` under `plugins.updater.pubkey`. No
action needed for it.

Share the private key through the password manager, never through chat or
email. It is the only thing that can sign an update that installed apps will
accept.

## Steps

### 1. Back up the private key

Store the full contents of `ibl-ai-os-updater.key` in the shared password
manager (entry name suggestion: "ibl.ai desktop updater key"). If this key is
lost, every installed app is pinned to a public key we can no longer sign
for, and users must reinstall by hand. There is no recovery.

### 2. Add the GitHub secret(s)

In `iblai/os` → Settings → Secrets and variables → Actions → New repository
secret:

- `TAURI_SIGNING_PRIVATE_KEY` = the entire contents of the key file, both
  lines, including the `untrusted comment:` line.
- Do not add `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. The key has no password;
  the workflow reads the unset secret as empty, which is correct.

The Apple signing and notarization secrets (`APPLE_CERTIFICATE`,
`APPLE_CERTIFICATE_PASSWORD`, `APPLE_ID`, `APPLE_PASSWORD`) are already
configured; the existing DMG releases prove that.

If the secret is missing the build still succeeds but silently skips the
updater assets. That is why none of the existing `app-v0.95.x` releases have
them.

### 3. Merge the branch and let the pipeline run

Merge `feat/mobile-local-llms-and-code` (or whichever branch carries the
updater work) into `main`. Any change under `src-tauri/` on `main` triggers
`tauri-autoversion.yml`, which bumps the app version, commits, and pushes an
`app-v<X>` tag. That tag runs `release-macos-dmg.yml` and `release-windows.yml`.

The first run creates the `app-latest` release automatically. **Never delete
that release or its tag**: every installed app polls it.

### 4. Verify the release

After the workflows finish, the `app-v<X>` release should list:

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
notarize DMG" step will say the signing key was not found: recheck step 2.

### 5. Prove an end-to-end update once

1. Install the DMG from the first updater-enabled release (call it `A`).
2. Ship any `src-tauri` change to `main` so release `B` is produced.
3. Launch `A`. Within a few seconds the "Update available" prompt should
   appear; click Update. The app downloads, verifies, installs and relaunches
   as `B`. Check the version in About.

## Things to know

- **Users on the current 0.95.x builds have no updater.** They download the
  first updater-enabled DMG once by hand; from then on updates are in-app.
- **Self-update is off by design** in the Mac App Store build (sandbox), in
  tenant-locked builds (`IBL_TENANT` set), and in debug builds. Those builds
  never see the prompt.
- **A failed feed never breaks the app.** Offline, 404, or a bad manifest all
  resolve to "no update available" with a log line, so a broken release only
  delays updates, it does not crash anyone.
- **Rotating the key** means shipping a release with the new public key in
  `tauri.conf.json` signed by the OLD key first (so installed apps accept it),
  then switching the secret. Do not rotate without that bridge release.

## Troubleshooting

| Symptom                                            | Cause                                                                 | Fix                                                            |
| -------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------- |
| Release has DMG but no `.app.tar.gz` / `.sig`      | `TAURI_SIGNING_PRIVATE_KEY` unset or wrong                            | Recheck the secret; rerun the tag's workflow                   |
| Build fails with a minisign password error         | A `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secret was added               | Delete that secret; the key has no password                    |
| Feed URL returns 404                               | `app-latest` release missing or manifests not uploaded                | Rerun the workflow; check its "Publish updater manifests" step |
| App logs `[AppUpdate] check failed: ... signature` | Public key in the installed app does not match the signing key        | Sign with the key whose `.pub` is in `tauri.conf.json`         |
| Update downloads but install fails on macOS        | App not writable (installed by another user, or running from the DMG) | Install to `/Applications` from the DMG                        |
