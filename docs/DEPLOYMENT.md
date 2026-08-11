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

1. **AWS S3** — create a bucket (**any name** — the scripts read it from
   `S3_BUCKET`; nothing assumes a particular one). Keep it **private** and reach
   it via CloudFront OAC (a public-read bucket also works). Create an IAM
   user/role for CI with `s3:PutObject` + `s3:ListBucket` on the bucket (add
   `s3:DeleteObject` for the retention job) → access key/secret.
2. **CloudFront** — distribution with **origin = the S3 bucket** (via an Origin
   Access Control so the bucket stays private), alternate domain
   **`assets.ibl.ai`** + an ACM cert **in us-east-1**. Cache `/_next/static/*`
   forever (the objects already carry `Cache-Control: immutable`); attach a
   **response-headers policy with CORS** (`Access-Control-Allow-Origin`) so
   fonts/workers load cross-origin. Point the `assets.ibl.ai` DNS record at the
   distribution. **No cache invalidation is ever needed** — this distribution
   only serves immutable, version-namespaced static; HTML is served by the app
   nodes, not CloudFront. Verify CloudFront serves keys **1:1** (no origin-path
   rewrite) so `assets.ibl.ai/apps/os/<v>/…` maps to bucket key `apps/os/<v>/…`.
3. **CI secrets/vars** (set on the build repo, `iblai/os` → Settings → Secrets
   and variables → Actions):
   - **Variables**: `NEXTJS_PUBLIC_ASSET_CDN=https://assets.ibl.ai`,
     `NEXTJS_S3_BUCKET=<your bucket>`.
   - **Secrets**: `NEXTJS_S3_ACCESS_KEY`, `NEXTJS_S3_ACCESS_SECRET`,
     `NEXTJS_S3_AWS_REGION`.

   (`NEXT_PUBLIC_APP_NAME` is taken from the workflow's `app_name` — `os`.
   `S3_ENDPOINT` is only for a non-AWS S3-compatible store; leave it unset.)
4. **Build + publish wiring — DONE** in `reusable-spa-docker-build.yml`: when
   `NEXTJS_PUBLIC_ASSET_CDN` is set it passes the `NEXT_PUBLIC_ASSET_CDN` /
   `NEXT_PUBLIC_APP_NAME` / `APP_VERSION` build-args, then a **Publish static
   assets to S3** step extracts `.next/static` + `public` from the built image
   and runs `scripts/upload-static.sh`. Gated on the variable, so it's a no-op
   for every other app. (The step installs the aws CLI to `$HOME` if the runner
   lacks it.) Nothing more to wire — just set the values in step 3.
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
