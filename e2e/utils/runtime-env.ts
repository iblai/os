import type { Page } from '@playwright/test';

/**
 * Reads a `NEXT_PUBLIC_*` value the way the RUNNING APP reads it, by asking
 * the browser for `window.__ENV__[key]`.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * A spec that wants to know how the app resolved a configurable value
 * cannot use `process.env.NEXT_PUBLIC_*`. That is the PLAYWRIGHT RUNNER's
 * environment, which has nothing to do with the deployed container the
 * spec is driving:
 *
 *   - The app under test is a Docker image whose `entrypoint.sh` writes
 *     every `NEXT_PUBLIC_*` into `/public/env.js` as `window.__ENV__` at
 *     container start. That is the deployment's value.
 *   - The Playwright process runs on a CI runner (or a laptop) that is
 *     never given those variables.
 *
 * So `process.env.NEXT_PUBLIC_X || <source default>` in a spec silently
 * evaluates to the source default on every environment, and only agrees
 * with the app on deployments that happen not to configure `X`. It is not
 * a mirror of the app's config, it is a guess that is right by accident —
 * and it fails the moment a real deployment sets the variable (see
 * journey 72 / `NEXT_PUBLIC_HELP_CENTER_URL`, which stg2 sets to
 * `https://docs.ibl.ai`).
 *
 * ── Semantics ────────────────────────────────────────────────────────────
 * Mirrors `lib/config.ts`'s `getEnv`: an empty string counts as UNSET,
 * because `entrypoint.sh` emits `KEY: ""` for every variable that is not
 * exported. Returns `undefined` when the runtime env has no usable value,
 * so callers can apply their own fallback with `??`/`||`.
 *
 * ── Known limit ──────────────────────────────────────────────────────────
 * `getEnv` falls back to the BUILD-time inlined `process.env[key]` before
 * its hardcoded default. That value is baked into the JS bundle and is not
 * reachable from the page, so a deployment that bakes a value at build
 * time and does NOT also set it at runtime is invisible here. For mentorai
 * that combination does not occur: `entrypoint.sh` writes every key it
 * knows about on every container start, so the runtime value is the one
 * that wins whenever a deployment configures anything at all.
 */
export async function getRuntimeEnv(
  page: Page,
  key: string,
): Promise<string | undefined> {
  return page.evaluate((envKey) => {
    const runtime = (window as unknown as Record<string, unknown>).__ENV__ as
      | Record<string, unknown>
      | undefined;
    const value = runtime?.[envKey];
    return typeof value === 'string' && value !== '' ? value : undefined;
  }, key);
}
