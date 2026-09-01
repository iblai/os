---
name: tts-provider-routing-feat2341
description: How Journey 71 (on-device Kokoro TTS provider routing, issue #2341) is built — why the SDK can't select the iblai voice provider via UI, the exact stubbing techniques used to avoid a real ~310MB model download, and the shared-mentor serial-execution gotcha it hit.
type: project
---

`e2e/journeys/71-tts-provider-routing.spec.ts` covers `lib/tts/iblai-routing.ts`'s
`decide()` arbiter for the `iblai` (Kokoro) voice provider: per-utterance choice between
the cloud `/tts/` endpoint and an on-device WebGPU model, with a background cache warm-up
and mobile/iOS/tablet always staying on cloud.

**The `iblai` voice provider is NOT selectable through the Edit Mentor → Voice tab UI.**
Checked the installed `@iblai/iblai-js` SDK's compiled type defs
(`node_modules/@iblai/iblai-js/dist/playwright/playwright/voice-tab-helpers.d.ts`):
`VoiceProvider = keyof typeof VOICE_LABELS.providers` and `VOICE_LABELS.providers` only has
`browser | openai | google`. There is no UI path to configure a mentor for on-device TTS.
So this journey targets a pre-provisioned mentor instead of creating one: tenant
`conradtesttenant`, mentor "Kokoro Voice Test" (`710a0110-75b7-4f3a-8f89-b70b712438a2`,
same account as `PLAYWRIGHT_USERNAME=conrad@ibleducation.com` against prod), already saved
server-side with `voice_provider: iblai`. No `MentorTracker` needed — nothing is created.

**Never triggers a real model download — three stubbing techniques, not just route
interception:**

1. Route-intercept `https://huggingface.co/**` and `https://us.aws.cdn.hf.co/**`, either
   `route.abort()` (checkpoints that must prove zero requests) or `route.fulfill()` with a
   few fake bytes + 200 (checkpoints that need `lib/tts/model-cache.ts`'s real `download()`
   to succeed and file the response under its real cache keys).
2. Stub `navigator.gpu` via `addInitScript` (`Object.defineProperty(navigator,'gpu',{value:
{requestAdapter: async()=>({})}})`) — forces `probeWebGpu()` true regardless of whether
   the runner has a real/software GPU adapter. Without this, "warm cache → device" could
   never be reached on a GPU-less headless runner.
3. Stub `window.Worker` globally via `addInitScript`. Verified via
   `grep -rn "new Worker(" --include="*.ts*"` that `lib/tts/kokoro-session.ts` is the
   **only** `new Worker(...)` call site in the whole app, so replacing the global
   constructor unconditionally (no URL-matching needed) is safe. The fake worker answers a
   `{type:'generate'}` message with one `{type:'chunk', index:0, pcm:Float32Array(2400),
samplingRate:24000}` then `{type:'complete', blob:...}`, letting `speakViaIblai`
   (`hooks/use-speech.ts`) and `StreamPlayer.enqueue/markComplete` run to completion with
   zero real ONNX/model involvement.

**Why NOT let the real worker run against fake model bytes:** initially considered seeding
Cache Storage with garbage bytes and letting the real `kokoro-js`/onnxruntime-web pipeline
attempt to load them. Traced through `hooks/use-speech.ts`: a worker failure calls
`fallbackFromDevice` → `demoteIblaiRoute` + `speakViaEndpoint` (a **real cloud `/tts/`
call**), which would race against the "device chosen → zero cloud calls" assertion — and
since our interception fulfills the model-host requests locally (near-zero latency), that
failure path could resolve _faster_ than the genuine cloud path's real network round-trip
to production, inverting the intended signal. Stubbing `Worker` sidesteps this: the fake
worker never errors, so the assertion tests the routing decision deterministically instead
of racing a real failure mode.

**No page reload needed between "cold" and "warm" clicks.** `startIblaiWarmUp`
(`lib/tts/iblai-routing.ts`) sets `decided.set(routeKey, DEVICE)` in-memory the instant
`warmModelCache` resolves true — the same tab's next `speak()` call reads the flipped memo
via `peekIblaiRoute` immediately. Just: click Read Aloud (cold, cloud) → poll Cache Storage
via `page.evaluate` until both `transformers-cache` and `kokoro-voices` have entries → click
Stop → click Read Aloud again (same message, same page) → now device.

**Exact cache keys** (`lib/tts/model-cache.ts`, only needed if you ever want to hand-seed
instead of letting the app's own `download()` write them): weight key is the "resolve/main"
spelling (`libraryKey()`), e.g.
`https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model.onnx`
in `transformers-cache`; voice key is the raw unpinned `voiceUrl()` (repo id hardcoded by
`kokoro-js`, independent of `config.modelId`), e.g.
`https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices/af_heart.bin`
in `kokoro-voices`. This journey avoided needing to know the mentor's actual configured
voice id by letting the real `download()` compute and write the key itself (via the
fulfilled-fetch technique above) rather than guessing/hardcoding `af_heart`.

**Shared-mentor race, generalizes [[feedback_shared_tenant_setting_needs_serial]] beyond
PATCHes to any shared conversational resource.** Every test in this file drives chat +
Read Aloud against the SAME mentor/account (no per-test mentor). Reproduced live:
`--workers=1` passed 9/9 across repeats; default parallel workers (2-4) intermittently left
"Read Aloud" never toggling to "Stop Reading Aloud" after a real click (`element(s) not
found` on the stop-button locator, ~15-20% of runs). Fixed with `test.describe.serial(...)`
on the whole file. Note: `--repeat-each=N` on a `.serial` block still runs the N _copies_ of
the whole serial group in parallel workers relative to each other (each copy's own tests
stay serial internally) — so `--repeat-each` is not a clean way to verify a serial fix;
re-running the file N times as separate `playwright test` invocations (each showing
"Running N tests using **1** worker") is the correct verification and is what confirmed the
fix (3 clean runs, chrome; 1 clean run each firefox/edge).

**Environment for this session:** `e2e/.env.local`'s active block was stg2
(`mentorai.stg2.iblai.org`) but the app's `.env` targets production
(`api.iblai.org`/`auth.iblai.org`) — mismatched, per
[[reference_e2e_env_local_override_and_port_discovery]] (memory copy lives in the main
`mentorai` checkout's agent-memory, not this worktree's). Swapped in the file's first
commented block (`localhost:3000` + `auth.iblai.org` + `conrad@ibleducation.com` /
`test_password`) for the session, built+started prod (`pnpm build && pnpm start`,
port 3000 free, ready in ~230ms), ran tests, then **restored `.env.local` to the original
stg2-active block** afterward (per that memory's own advice) since it's a shared dev file.
Auth against prod worked cleanly on first try, no stg2 outage issues encountered this
session. `playwright/.auth/*.json` for chrome/firefox/edge now hold prod/localhost
sessions — gitignored, and will self-regenerate via the `setup-*` projects on the next
normal (non `--no-deps`) run against whatever host is active in `.env.local`.

See also [[edit-mentor-open-non-owned-mentor-fallback]] — irrelevant here since this
journey never opens the Edit Mentor dialog (chat + Read Aloud only, no settings mutation).
