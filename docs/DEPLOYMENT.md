# Immutable, deployment-ID static hosting

Eliminates the version-skew problem (a browser on build A fetching a chunk from
a node on build B → `ChunkLoadError`) that today forces us to drain LB backend
sets during a blue/green deploy.

## The idea

Every build's `/_next/*` assets are published, **immutable**, to object storage
under a per-release path and served from a CDN. The deployment ID is baked into
the image at build time, so each node emits **self-consistent** absolute asset
URLs for its own release:

```
a node running v0.101.0 emits:
  <cdn>/apps/os/0.101.0/_next/static/chunk-abc.js   ← the browser fetches this from the CDN
```

Because all releases' assets coexist in the CDN and are retained, node build
skew can no longer break chunk loading — so nodes can be updated **rolling, in
place**, with no full-pool drain. Nodes never fetch or look up assets: the ID is
compile-time, the browser pulls from the CDN.

Storage layout (bucket `apps/<app>/<version>/`):

```
apps/os/0.101.0/_next/static/…      immutable, additive
apps/os/0.101.0/public/…            immutable, additive
apps/os/manifest/0.101.0.json       this build's record
apps/os/current.json                desired-live pointer (for GC + rollback tooling)
```

## What's in this repo (the app side — done)

| Change                     | Effect                                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next.config.ts`           | `generateBuildId` = release version; `assetPrefix` = `<NEXT_PUBLIC_ASSET_CDN>/apps/<app>/<version>` **when that env is set**, else unchanged. `crossOrigin: 'anonymous'`. |
| `Dockerfile`               | Passes `NEXT_PUBLIC_ASSET_CDN`, `NEXT_PUBLIC_APP_NAME`, `APP_VERSION` into the build.                                                                                     |
| `scripts/upload-static.sh` | Post-build: syncs `.next/static` + `public` to `apps/<app>/<version>/`, writes manifest + `current.json`.                                                                 |
| `scripts/prune-static.sh`  | Retention/GC: keep newest `KEEP_LAST` + `current`, delete the rest. Dry-run by default.                                                                                   |

**This is a no-op until `NEXT_PUBLIC_ASSET_CDN` is provided at build time.** With
it unset (local dev, Tauri/offline export, and current prod) the app still serves
its own static exactly as before — nothing breaks on merge.

## What you need to do (infra + CI — manual)

1. **OCI Object Storage** — create bucket `ibl-static`, objects public-read (or a
   PAR), and generate an OCI **Customer Secret Key** (access key/secret) for CI.
   Its S3-compatible endpoint is
   `https://<namespace>.compat.objectstorage.<region>.oraclecloud.com`.
2. **OCI CDN** — distribution with **origin = the bucket**, custom domain e.g.
   `cdn.ibl.ai`. Cache `/_next/static/*` forever; **inject CORS
   (`Access-Control-Allow-Origin`) at the edge** (OCI bucket CORS is limited).
   Verify the CDN honors the object `Cache-Control`; if not, set the immutable
   policy in the CDN rules. (Cloudflare-in-front-of-the-bucket is the fallback
   edge if OCI CDN's features fall short.)
3. **CI secrets/vars** (build workflow): `NEXT_PUBLIC_ASSET_CDN=https://cdn.ibl.ai`,
   `NEXT_PUBLIC_APP_NAME=os`, `S3_BUCKET`, `S3_ENDPOINT`, `AWS_ACCESS_KEY_ID`,
   `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`.
4. **Wire the build + publish** (in `reusable-spa-docker-build.yml` or the caller):
   - pass `NEXT_PUBLIC_ASSET_CDN` / `NEXT_PUBLIC_APP_NAME` / `APP_VERSION` as
     `docker build --build-arg`s,
   - after the image builds, extract the built assets and publish them:
     ```bash
     # get .next/static + public out of the built image
     cid=$(docker create "$IMAGE")
     docker cp "$cid:/app/.next/static" .next/static
     docker cp "$cid:/app/public" public
     docker rm "$cid"
     VERSION="$APP_VERSION" GIT_SHA="$GITHUB_SHA" bash scripts/upload-static.sh
     ```
   - invalidate the CDN for **HTML routes only** (static is immutable — never
     invalidate `/_next/static`).
5. **Schedule retention**: a workflow running `scripts/prune-static.sh`
   (`DRY_RUN=false`, `KEEP_LAST` ≥ your rollback horizon).
6. **Switch the rollout** (ops `prod-service-update.sh`): once assets are on the
   CDN, update nodes **rolling, in place** instead of draining a backend set.
   Keep the LB swap only as an optional canary.
7. **Server-Action skew** (the one residual): enable LB **sticky sessions**
   during the rollout window and add a client `ChunkLoadError` → `location.reload()`
   self-heal so a client briefly on an old build silently lands on the current one.

## Rollback

Images are tagged by release version and each is a self-contained deployment.
Roll back = **re-deploy the previous image tag** (e.g. `0.100.1`). That image
emits `0.100.1` asset URLs, and `0.100.1`'s assets are still in the bucket
(retention), so the rollback is complete and instant — no rebuild, no re-upload,
and skew-safe (both versions' assets coexist).

⚠️ Rollback only works while the target version's assets are retained — keep
`KEEP_LAST` (or an age policy) larger than how far back you'd ever roll.

## App-specific cautions

- **Tauri / offline (`output: 'export'`) builds must NOT set `NEXT_PUBLIC_ASSET_CDN`** —
  they need self-contained relative assets.
- **Service worker (`sw.js`) caching** must be reviewed against the new
  cross-origin static origin before Phase 3.
- If a release is ever **rebuilt with different content**, use
  `DEPLOYMENT_ID=<version>-<sha8>` so it doesn't overwrite immutable assets.
