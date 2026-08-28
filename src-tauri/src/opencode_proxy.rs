//! Loopback token-injecting proxy for the Code agent's model calls.
//!
//! The agent used to receive the real ibl.ai DM token as `IBL_AUTH_HEADER`, which it
//! could simply read (`echo $IBL_AUTH_HEADER`, `/proc/self/environ`) and exfiltrate —
//! a durable, portable credential. Putting it in `opencode.json` is no better: the
//! agent has to be able to read that file too. A process can't hide a secret from
//! itself, so the fix is to never give it the real one.
//!
//! Instead opencode is pointed at `http://127.0.0.1:<ephemeral>/v1` with a throwaway
//! per-session secret as its API key. This proxy checks that secret, swaps in the real
//! `Authorization: Token <dm_token>`, and forwards upstream. Only the OpenAI-compatible
//! paths the model client needs are routed; everything else 404s.
//!
//! **Residual risk, stated plainly:** the agent can still *use* the proxy for the life
//! of the session, so it could burn model quota. What it can no longer do is steal a
//! credential that works elsewhere or later.
//!
//! One credential IS handed to the child, deliberately: a platform API key this
//! module mints on its behalf ([`platform_api_key`], exported as
//! `IBLAI_API_KEY`). That is a scoped, week-long, revocable key for one tenant,
//! and without it every skill that touches the platform has to ask the user for
//! a token most of them are not allowed to create. The DM token — durable,
//! portable, the user's own — still never leaves this module.

#![cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::OnceLock;
use std::time::Duration;

use axum::body::Body;
use axum::extract::Request;
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::any;
use axum::Router;
use sha2::{Digest, Sha256};
use tokio::sync::{Mutex, RwLock};

/// System-prompt guidance for the coding agent. The proxy injects it as an
/// extra system message into every `chat/completions` body it forwards (for
/// sessions registered with skills wired) — nothing on disk, no extra routes,
/// and opencode never even sees it in its own conversation state.
const IBLAI_INSTRUCTIONS: &str = "\
# ibl.ai guidance

- Keep your visible replies terse and outcome-focused — HARD CAP: three \
short sentences per reply, aim for one. Say the result of what the user \
asked (\"Deployed at <url>\", \"Fixed the failing test\") or the one \
obstacle blocking you and what you need — nothing else. Process narration, \
plan restatements, step-by-step or file-by-file accounts, headings, bullet \
lists and code blocks belong in your reasoning or nowhere, never in the \
reply text. Emit no text between tool calls — no \"I will now…\", no \"X is \
done, next I will…\" — call the next tool directly. Exceed the cap only when \
the user explicitly asks for detail (an explanation, a report, a walkthrough).
- Whenever an available skill covers the task at hand — especially the \
iblai-vibe-* skills — you MUST invoke that skill (via the skill tool) before \
improvising the same work by hand.
- When the user asks to build a website or web app, first ask ONE short \
question: whether to start from our default template, recommending it (\"it's \
the fastest and most reliable way to get started\"). In everything you say to \
the user, call it \"our default template\" — never the internal name \
\"vibe-starter\". If they accept (or clearly already want it), load the \
iblai-vibe-ops-init skill (it scaffolds the template) and wire ibl.ai auth, \
profile, navbar, chat and analytics through the matching iblai-vibe-* skills \
— do NOT hand-roll the scaffold. If they decline, build what they ask for and \
still wire the ibl.ai pieces through the iblai-vibe-* skills.
- That template question is the only stack question you ask: never offer a \
menu of frameworks or an ibl.ai-vs-vanilla choice beyond it, and once it is \
answered do not ask again in that project.
- Do NOT remove ibl.ai components — the navbar, profile, notification buttons, \
chat and the rest stay in place. Always keep the ibl.ai components, whether \
the project started from vibe-starter or otherwise.
- When working with vibe-starter and other ibl.ai projects, always copy \
`.env.example` into `.env.local` (before the first run, so the app boots with \
its expected configuration).
- After building or changing a website, publish it and show the user the \
live site: run `pnpm typecheck` and `pnpm lint`, deploy automatically with \
the iblai-vibe-ops-deploy skill (no Vercel account or token — do not ask \
whether to deploy; the skill's status script does the deploy polling, one \
bounded check every ~10 s — never improvise status commands or extra \
\"is it pushed?\" checks), then open the deployed URL in the user's browser — \
macOS: `open -a \"Google Chrome\" <url>` (plain `open <url>` as a fallback), \
Linux: `xdg-open <url>`, Windows: `start <url>`. The deployed URL is how \
the user sees their site — never show localhost or offer a local dev \
server. If the deploy fails, report the error verbatim and continue \
helping.
- Monetization is optional and on request only: when the user asks to charge \
users to enter the app (a paywall), use the \
iblai-vibe-monetization-app-paywall skill. Do not suggest it unprompted.
- A platform API key is minted for you automatically and exported as the \
IBLAI_API_KEY environment variable. Use it wherever a skill or API call needs a \
platform API key, and NEVER ask the user for a platform API key or token — this \
supersedes any skill instruction that says to ask for one. If IBLAI_API_KEY is \
absent, the signed-in user is not a platform admin and cannot mint one: say so \
plainly and continue with what does work, rather than asking them for a key.
- When you write `iblai.env` or any `.env*` file, write the RESOLVED value of \
IBLAI_API_KEY — env files never expand variables, so a literal \
`${IBLAI_API_KEY}`, `$IBLAI_API_KEY` or `${TOKEN}` line ships no key (`TOKEN` \
is not even exported — only the IBLAI_* variables are). Let your shell expand \
it while writing, e.g. `printf 'TOKEN=%s\\n' \"$IBLAI_API_KEY\" >> iblai.env`, \
then verify without printing it: \
`grep -qF -- \"$IBLAI_API_KEY\" iblai.env && echo TOKEN-ok`. The same rule \
applies to every env line (`PLATFORM`, `DOMAIN`, `NEXT_PUBLIC_*` values).
- When software you are BUILDING needs raw LLM access, IBLAI_API_KEY doubles as \
a standard OpenAI api key: point any OpenAI client at \
`https://asgi.data.<domain>/api/ai-mentor/orgs/<org>/v1` (`<domain>` is the \
platform base domain given in the identity lines below) with \
`Authorization: Bearer $IBLAI_API_KEY` (chat completions and `GET /models`), \
keep it server-side, and never ask the user for an OpenAI or Anthropic key. \
This is for the software you build, never for your own model calls — your own \
inference already runs through the session's metered, learner-attributed proxy, \
and going around it is not allowed.
- Never ask the user for a Stripe API key or secret, and never put raw Stripe \
credentials in code, env files, or the chat. All Stripe work goes through the \
ibl.ai Stripe proxy at \
`https://api.<domain>/dm/api/ai-mentor/orgs/<org>/users/<user_id>/providers/stripe/payments/...`, \
authenticated with `Authorization: Api-Token $IBLAI_API_KEY`. If the proxy \
reports that no Stripe credential is configured for the platform, tell the user \
to connect Stripe in their ibl.ai platform settings — do not collect keys in \
chat.
- Before deploying, run the iblai-vibe-ops-deploy skill's deployment-hash \
check and skip the deploy when nothing has changed since the last one, \
reporting the existing live URL instead. Deploys cost the user credits and \
minutes, so redeploying identical content is waste — the skill carries the \
mechanics.
";

/// Everything the proxy needs to serve one Code session.
struct Upstream {
    /// e.g. `https://asgi.data.iblai.app/api/ai-mentor/orgs/<tenant>/v1`
    base: String,
    /// The real DM token — held here, never handed to the agent.
    token: String,
    /// The platform (tenant) key this session serves — surfaced to the agent
    /// in the injected guidance so skills know which org they act on.
    tenant: String,
    /// Whether this session has skills wired — the gate for injecting
    /// [`IBLAI_INSTRUCTIONS`] into its chat/completions calls.
    inject_guidance: bool,
}

type Sessions = RwLock<HashMap<String, Upstream>>;

fn sessions() -> &'static Sessions {
    static S: OnceLock<Sessions> = OnceLock::new();
    S.get_or_init(|| RwLock::new(HashMap::new()))
}

/// The signed-in user's username, appended as `learner_id=<username>` to every
/// forwarded request so upstream attributes the usage to the learner. App-global
/// rather than per-session — a desktop install has exactly one signed-in user —
/// and read per request rather than captured at registration, so a login (or user
/// switch) that lands while a session is alive takes effect on its next call.
fn learner() -> &'static RwLock<Option<String>> {
    static L: OnceLock<RwLock<Option<String>>> = OnceLock::new();
    L.get_or_init(|| RwLock::new(None))
}

/// Handle for announcing proxy-level events to the webview — today just the 402
/// insufficient-credit signal. Set once at session spawn; absent in unit tests,
/// where the emit is simply skipped.
fn app() -> &'static OnceLock<tauri::AppHandle> {
    static A: OnceLock<tauri::AppHandle> = OnceLock::new();
    &A
}

/// Give the proxy an app handle to emit events through.
pub fn set_app(handle: &tauri::AppHandle) {
    let _ = app().set(handle.clone());
}

/// The signed-in user's email, surfaced to the agent in the injected guidance
/// alongside the username. App-global for the same reason as [`learner`].
fn learner_email() -> &'static RwLock<Option<String>> {
    static E: OnceLock<RwLock<Option<String>>> = OnceLock::new();
    E.get_or_init(|| RwLock::new(None))
}

/// The DM manager host (e.g. `https://api.iblai.app/dm`).
///
/// Not derivable here: the only base this module otherwise sees is the ASGI
/// host that serves streaming completions, which does not serve `/api/core`.
/// The frontend owns the real value (`config.dmUrl()`) and hands it over on the
/// same call that sets the learner.
fn dm_base() -> &'static RwLock<Option<String>> {
    static B: OnceLock<RwLock<Option<String>>> = OnceLock::new();
    B.get_or_init(|| RwLock::new(None))
}

/// Fallback DM host for a build whose frontend hasn't sent one yet. Correct for
/// ibl.ai's own SaaS; a self-hosted tenant needs the frontend value, and minting
/// fails loudly rather than silently targeting the wrong host.
const DEFAULT_DM_BASE: &str = "https://base.manager.iblai.app";

/// The platform's base domain — `iblai.app` (production), or whatever a dev
/// deployment specifies (e.g. `iblai.org`). The ONE value everything else
/// derives from: the agent's identity bullet tells it to write this as
/// `DOMAIN` in `iblai.env` (the vibe skills compose every API host from it),
/// and spawn composes the default streaming upstream `https://asgi.data.<d>`.
fn platform_domain() -> &'static RwLock<Option<String>> {
    static D: OnceLock<RwLock<Option<String>>> = OnceLock::new();
    D.get_or_init(|| RwLock::new(None))
}

/// The deployment's auth SPA URL (`NEXT_PUBLIC_AUTH_URL`) — the one platform
/// host NOT derivable from the base domain (`login.iblai.app` on production,
/// `auth.iblai.org` on the dev platform). Absent → the hardcoded production
/// default rules.
fn auth_url() -> &'static RwLock<Option<String>> {
    static A: OnceLock<RwLock<Option<String>>> = OnceLock::new();
    A.get_or_init(|| RwLock::new(None))
}

/// Set the identity attached to forwarded model calls (empty username clears it).
pub async fn set_learner(
    username: &str,
    email: &str,
    dm_base_url: &str,
    base_domain: &str,
    auth_url_value: &str,
) {
    let name = username.trim();
    // Dev-terminal trace of the frontend→backend hop: no line here during a manual
    // test means the frontend never delivered a learner at all.
    if cfg!(debug_assertions) {
        if name.is_empty() {
            println!("[opencode-proxy] learner cleared (empty username from frontend)");
        } else {
            println!("[opencode-proxy] learner set: {name}");
        }
    }
    *learner().write().await = (!name.is_empty()).then(|| name.to_string());
    let email = email.trim();
    *learner_email().write().await = (!email.is_empty()).then(|| email.to_string());
    let base = dm_base_url.trim().trim_end_matches('/');
    if !base.is_empty() {
        *dm_base().write().await = Some(base.to_string());
    }
    // Same empty-does-not-erase rule as dm_base: a later call carrying only a
    // username must not strand the session on the default domain.
    let domain = base_domain.trim();
    if !domain.is_empty() {
        *platform_domain().write().await = Some(domain.to_string());
    }
    let auth = auth_url_value.trim().trim_end_matches('/');
    if !auth.is_empty() {
        *auth_url().write().await = Some(auth.to_string());
    }
}

/// The signed-in learner's username, for the child's `IBLAI_USERNAME` env var
/// at spawn and the identity line in the injected guidance. `None` until a
/// non-empty username arrives — callers add nothing then.
pub async fn learner_username() -> Option<String> {
    learner().read().await.clone()
}

/// The signed-in user's email, for the identity line in the injected guidance.
pub async fn learner_email_address() -> Option<String> {
    learner_email().read().await.clone()
}

/// The DM manager host to call for non-model endpoints.
async fn dm_base_url() -> String {
    dm_base()
        .read()
        .await
        .clone()
        .unwrap_or_else(|| DEFAULT_DM_BASE.to_string())
}

/// Find `key` in `KEY=VALUE` text (`#` comments, blank lines OK). Pure so the
/// parsing is testable without touching the real data dir.
fn env_file_lookup(text: &str, key: &str) -> Option<String> {
    text.lines()
        .map(str::trim)
        .filter(|l| !l.starts_with('#'))
        .filter_map(|l| l.split_once('='))
        .find(|(k, _)| k.trim() == key)
        .map(|(_, v)| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

/// Development-time override files: `src-tauri/.env.local`, then
/// `src-tauri/.env.production` (keys documented in the committed
/// `.env.example`, which itself is never loaded — the defaults are hardcoded).
/// Located via `CARGO_MANIFEST_DIR`, so they exist only on a dev checkout;
/// installed builds skip straight to the hardcoded defaults, which is the
/// point — the dev platform (e.g. iblai.org) is a development-time target.
/// Read per use — it's a dev knob, not a hot path.
fn local_env(key: &str) -> Option<String> {
    let manifest = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
    let candidates = [
        manifest.join(".env.local"),
        manifest.join(".env.production"),
    ];
    candidates
        .iter()
        .find_map(|p| env_file_lookup(&std::fs::read_to_string(p).ok()?, key))
}

/// Resolution order shared by both getters: local dev override → the
/// frontend-delivered holder → the caller's default. Pure so precedence is
/// testable without process-global env vars.
fn resolve_setting(local: Option<String>, held: Option<String>) -> Option<String> {
    local.or(held)
}

/// The hardcoded production defaults, in force until a `src-tauri/.env.local`
/// or `.env.production` (or the signed-in frontend) says otherwise.
const DEFAULT_PLATFORM_DOMAIN: &str = "iblai.app";
const DEFAULT_AUTH_URL: &str = "https://login.iblai.app";

/// The platform base domain: `src-tauri/.env.local`/`.env.production`
/// (`IBLAI_PLATFORM_DOMAIN`) → frontend value → hardcoded `iblai.app`.
pub async fn platform_base_domain() -> String {
    resolve_setting(
        local_env("IBLAI_PLATFORM_DOMAIN"),
        platform_domain().read().await.clone(),
    )
    .unwrap_or_else(|| DEFAULT_PLATFORM_DOMAIN.to_string())
}

/// The auth SPA URL: `src-tauri/.env.local`/`.env.production`
/// (`IBLAI_AUTH_URL`) → frontend value → hardcoded production
/// `login.iblai.app`. Always resolves, so the agent is always told where
/// sign-in lives.
pub async fn auth_url_value() -> String {
    resolve_setting(local_env("IBLAI_AUTH_URL"), auth_url().read().await.clone())
        .unwrap_or_else(|| DEFAULT_AUTH_URL.to_string())
        .trim_end_matches('/')
        .to_string()
}

/// One mint at a time. Two concurrent mints would each hit the duplicate-name
/// path and the second one's DELETE would revoke the key the first just handed
/// out.
fn mint_lock() -> &'static Mutex<()> {
    static L: OnceLock<Mutex<()>> = OnceLock::new();
    L.get_or_init(|| Mutex::new(()))
}

/// Lifetime requested for a minted key, in DM's `[DD] HH:MM:SS` duration form.
/// Short enough that a leaked key expires on its own, long enough that a normal
/// working stretch never re-mints. Must agree with [`PLATFORM_KEY_LIFETIME`] —
/// a test pins the two together.
const PLATFORM_KEY_EXPIRES_IN: &str = "3 00:00:00";

/// [`PLATFORM_KEY_EXPIRES_IN`] as a duration, for computing the `expires_at`
/// recorded in settings.json (computed locally — it's what we requested, and a
/// day of renewal margin swallows any clock skew).
const PLATFORM_KEY_LIFETIME: Duration = Duration::from_secs(3 * 24 * 60 * 60);

/// Re-mint this long before the key expires, so a long-lived install never
/// hands a child a credential that dies mid-task.
const PLATFORM_KEY_RENEW_MARGIN: Duration = Duration::from_secs(24 * 60 * 60);

/// Settings key holding `{ "<dm base>|<tenant>": { "key", "expires_at" } }`
/// (`expires_at` in unix seconds).
///
/// Persisted (in `settings.json`, beside the approval mode) because DM shows a
/// key's raw value exactly once: an in-memory cache would lose it on every app
/// restart and force the delete-and-remint dance each run — which strands the
/// device on platforms that refuse the DELETE. Slotted per (base, tenant) so
/// switching between platforms mid-development never serves a foreign key. No
/// new exposure: the same key already enters the child env and is written into
/// the workspace's `iblai.env` by the ops-init skill.
const SETTINGS_PLATFORM_KEYS: &str = "platform_api_keys";

fn platform_key_slot(base: &str, tenant: &str) -> String {
    format!("{base}|{tenant}")
}

fn unix_now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// The stored `(key, expires_at)` for (base, tenant), while it still has more
/// than the renewal margin left. Pure over the settings map so the freshness
/// rule is testable. Entries without `expires_at` (an older build's format)
/// read as absent — one harmless re-mint.
fn stored_platform_key(
    settings: &serde_json::Map<String, serde_json::Value>,
    base: &str,
    tenant: &str,
    now_secs: u64,
) -> Option<(String, u64)> {
    let entry = settings
        .get(SETTINGS_PLATFORM_KEYS)?
        .get(platform_key_slot(base, tenant))?;
    let expires_at = entry.get("expires_at")?.as_u64()?;
    if now_secs.saturating_add(PLATFORM_KEY_RENEW_MARGIN.as_secs()) >= expires_at {
        return None;
    }
    entry
        .get("key")?
        .as_str()
        .map(str::to_string)
        .filter(|k| !k.is_empty())
        .map(|k| (k, expires_at))
}

/// Record a freshly minted key in its slot, leaving every other settings owner
/// (and every other slot) untouched.
fn record_platform_key(
    settings: &mut serde_json::Map<String, serde_json::Value>,
    base: &str,
    tenant: &str,
    key: &str,
    expires_at: u64,
) {
    let slots = settings
        .entry(SETTINGS_PLATFORM_KEYS)
        .or_insert_with(|| serde_json::json!({}));
    if let Some(obj) = slots.as_object_mut() {
        obj.insert(
            platform_key_slot(base, tenant),
            serde_json::json!({ "key": key, "expires_at": expires_at }),
        );
    }
}

/// How long a DM call may take before it's treated as unreachable. Deliberately
/// short: this runs on the spawn path, and a wedged DM must not stall Code.
const DM_CALL_TIMEOUT: Duration = Duration::from_secs(10);

/// A stable per-device id, generated once and kept beside the app's other
/// data — the `<machine-code>` part of a key name. Resolved once per process:
/// the id names this device and must not shift mid-run, and the uncached read
/// raced the tests that repoint `XDG_DATA_HOME` (the data dir never moves at
/// runtime in the app itself).
fn device_id() -> String {
    static ID: OnceLock<String> = OnceLock::new();
    ID.get_or_init(|| {
        let path = crate::opencode_acp::iblai_data_dir().join("device-id");
        if let Ok(existing) = std::fs::read_to_string(&path) {
            let id = existing.trim().to_string();
            if !id.is_empty() {
                return id;
            }
        }
        let id = new_secret()[..8].to_string();
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let _ = std::fs::write(&path, &id);
        id
    })
    .clone()
}

/// The name for one mint: `<app>-<machine-code>-<suffix>`, the suffix fresh per
/// call. DM key names are unique per platform, and a reused name means the mint
/// only works if DM lets us DELETE the stale one first — a dance the dev DM's
/// RBAC refused. A never-before-seen name cannot collide; superseded keys just
/// age out on their own ([`PLATFORM_KEY_EXPIRES_IN`]).
fn mint_key_name() -> String {
    format!("os-code-{}-{}", device_id(), &new_secret()[..8])
}

/// POST/DELETE helper returning `(status, body)`, or an error when DM is unreachable.
async fn dm_call(req: reqwest::RequestBuilder) -> Result<(u16, String), String> {
    let resp = tokio::time::timeout(DM_CALL_TIMEOUT, req.send())
        .await
        .map_err(|_| "timed out".to_string())?
        .map_err(|e| e.to_string())?;
    let status = resp.status().as_u16();
    let body = resp.text().await.unwrap_or_default();
    Ok((status, body))
}

/// First 200 chars of a response body, for error lines.
fn snippet(text: &str) -> String {
    text.chars().take(200).collect()
}

/// Mint one platform API key under `name` (a fresh, never-reused name from
/// [`mint_key_name`], so a duplicate collision cannot happen).
///
/// `Ok(None)` means the signed-in user simply isn't allowed to mint one (DM
/// restricts this to platform admins, 403) — an expected outcome for a learner,
/// not an error worth failing a spawn over. A 401 is different: the DM didn't
/// recognise the token at all, which is never "not an admin".
async fn mint_platform_key(base: &str, token: &str, name: &str) -> Result<Option<String>, String> {
    let url = format!("{base}/api/core/platform/api-tokens/");
    let auth = format!("Token {token}");
    // `mode` is deliberately NOT sent: DM defaults it to "owner", and naming it
    // explicitly opts the request into DM's privileged-field RBAC gate — which
    // 403s admins who lack the field-level grant on `mode`.
    let (status, text) = dm_call(http().post(&url).header("Authorization", &auth).json(
        &serde_json::json!({
            "name": name,
            "expires_in": PLATFORM_KEY_EXPIRES_IN,
        }),
    ))
    .await?;
    match status {
        200 | 201 => serde_json::from_str::<serde_json::Value>(&text)
            .ok()
            .and_then(|v| v.get("key").and_then(|k| k.as_str()).map(str::to_string))
            .map(Some)
            .ok_or_else(|| format!("mint response carried no key: {}", snippet(&text))),
        403 => Ok(None),
        401 => Err(format!(
            "token rejected (401) by {url} — signed into a different platform domain?"
        )),
        other => Err(format!("HTTP {other}: {}", snippet(&text))),
    }
}

/// A platform API key for this tenant with its expiry (unix secs), minted on
/// demand and persisted in `settings.json` — DM shows the raw value exactly
/// once, so it must outlive the app process or every restart re-mints.
///
/// Handed to the agent as `IBLAI_API_KEY` so skills can act on the platform
/// without the user being asked for a credential they usually can't even
/// create. `None` when the user isn't a platform admin or DM is unreachable —
/// callers carry on without the variable rather than failing the turn.
pub async fn platform_api_key(tenant: &str, token: &str) -> Option<(String, u64)> {
    if tenant.is_empty() || token.is_empty() {
        eprintln!("[opencode-proxy] IBLAI_API_KEY skipped: no signed-in tenant/token yet");
        return None;
    }
    let base = dm_base_url().await;
    let _one_at_a_time = mint_lock().lock().await;
    let now = unix_now();
    if let Some(hit) =
        stored_platform_key(&crate::opencode_acp::read_settings(), &base, tenant, now)
    {
        return Some(hit);
    }
    let name = mint_key_name();
    match mint_platform_key(&base, token, &name).await {
        Ok(Some(key)) => {
            let expires_at = now.saturating_add(PLATFORM_KEY_LIFETIME.as_secs());
            let mut settings = crate::opencode_acp::read_settings();
            record_platform_key(&mut settings, &base, tenant, &key, expires_at);
            if let Err(e) = crate::opencode_acp::write_settings(&settings) {
                // The key still works for this run; only its persistence failed.
                eprintln!("[opencode-proxy] could not persist IBLAI_API_KEY: {e}");
            }
            eprintln!("[opencode-proxy] IBLAI_API_KEY minted for {tenant} at {base}");
            Some((key, expires_at))
        }
        // Not stored as a negative: admin rights can be granted while the app
        // runs, and the cost of retrying is one request per spawn.
        Ok(None) => {
            eprintln!(
                "[opencode-proxy] IBLAI_API_KEY not minted: {base} refused (403) — {tenant} user is not a platform admin"
            );
            None
        }
        Err(e) => {
            eprintln!("[opencode-proxy] IBLAI_API_KEY not minted ({base}): {e}");
            None
        }
    }
}

/// Longest silence tolerated between upstream read operations. Generous — a
/// model can legitimately think for minutes between SSE chunks — but bounded,
/// so a wedged upstream fails the turn instead of hanging it forever.
/// Deliberately a per-read timeout, never a total one: a healthy streamed
/// completion may stay open far longer than any total budget, and the DM side
/// heartbeats every ~15s, so this only trips on a genuinely dead path.
// ponytail: 300s guess; shrink if wedged turns linger, grow if long thinks get cut.
const UPSTREAM_READ_TIMEOUT: Duration = Duration::from_secs(300);

fn http_client(read_timeout: Duration) -> reqwest::Client {
    reqwest::Client::builder()
        .read_timeout(read_timeout)
        .build()
        .expect("reqwest client")
}

fn http() -> &'static reqwest::Client {
    static C: OnceLock<reqwest::Client> = OnceLock::new();
    C.get_or_init(|| http_client(UPSTREAM_READ_TIMEOUT))
}

/// The OpenAI-compatible paths the model client actually calls. Anything else 404s,
/// so the proxy isn't a general-purpose authenticated tunnel into the ibl.ai API.
const ALLOWED_PATHS: [&str; 4] = ["chat/completions", "completions", "models", "embeddings"];

/// A throwaway per-session API key. Not a password — just enough that another local
/// process can't guess its way onto the proxy.
pub fn new_secret() -> String {
    #[cfg(unix)]
    {
        use std::io::Read;
        if let Ok(mut f) = std::fs::File::open("/dev/urandom") {
            let mut buf = [0u8; 24];
            if f.read_exact(&mut buf).is_ok() {
                return hex::encode(buf);
            }
        }
    }
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let mut h = Sha256::new();
    h.update(std::process::id().to_le_bytes());
    h.update(
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
            .to_le_bytes(),
    );
    h.update(COUNTER.fetch_add(1, Ordering::SeqCst).to_le_bytes());
    hex::encode(h.finalize())
}

/// Start the proxy on an OS-assigned loopback port and return the port,
/// re-binding when a previously started server no longer answers — the server
/// task dies with its runtime (tests) or on a fatal accept error, and a
/// memoized dead port would wedge every future session until an app restart.
pub async fn ensure_started() -> Result<u16, String> {
    static PORT: Mutex<Option<u16>> = Mutex::const_new(None);

    // Holding the lock across probe + bind serializes concurrent starts.
    let mut port = PORT.lock().await;
    if let Some(p) = *port {
        // Probe, don't trust: one loopback connect per session spawn.
        if tokio::net::TcpStream::connect(("127.0.0.1", p))
            .await
            .is_ok()
        {
            return Ok(p);
        }
        eprintln!("[opencode-proxy] server on port {p} is gone — rebinding");
    }

    // Port 0 → the OS picks a free ephemeral port. Never a fixed one.
    let listener = tokio::net::TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], 0)))
        .await
        .map_err(|e| format!("model proxy bind failed: {e}"))?;
    let p = listener
        .local_addr()
        .map_err(|e| format!("model proxy addr failed: {e}"))?
        .port();

    let app = Router::new().route("/v1/{*path}", any(forward));
    tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, app).await {
            eprintln!("[opencode-proxy] server stopped: {e}");
        }
    });
    *port = Some(p);
    Ok(p)
}

/// Register a session's upstream + real token against its throwaway secret.
/// `tenant` is the platform key the session serves (surfaced in the injected
/// guidance); `inject_guidance` marks a session with skills wired: its
/// chat/completions calls get [`IBLAI_INSTRUCTIONS`] injected as a system
/// message.
pub async fn register(
    secret: &str,
    base: String,
    token: String,
    tenant: String,
    inject_guidance: bool,
) {
    sessions().write().await.insert(
        secret.to_string(),
        Upstream {
            base,
            token,
            tenant,
            inject_guidance,
        },
    );
}

/// Refresh the held token in place — the whole point of holding it here rather than
/// baking it into the agent's environment, where expiry meant respawning the process.
pub async fn set_token(secret: &str, token: &str) {
    if let Some(u) = sessions().write().await.get_mut(secret) {
        u.token = token.to_string();
    }
}

/// Drop a session's credentials (process closed).
pub async fn unregister(secret: &str) {
    sessions().write().await.remove(secret);
}

/// The identity bullets appended to the guidance: who is signed in and which
/// platform the session serves, plus the env vars carrying the same values —
/// so skills never have to ask (or guess) the username or platform key.
fn identity_lines(
    learner: Option<&str>,
    tenant: Option<&str>,
    email: Option<&str>,
    base_domain: Option<&str>,
    auth: Option<&str>,
) -> String {
    let mut out = String::new();
    if let Some(l) = learner {
        out.push_str(&format!(
            "- The signed-in platform username is `{l}` (also exported to your \
shell as the IBLAI_USERNAME environment variable) — use it wherever a skill \
needs the platform username.\n"
        ));
    }
    if let Some(e) = email {
        out.push_str(&format!(
            "- The signed-in user's email address is `{e}` — use it wherever a \
skill or app needs the user's email, and never ask them for it.\n"
        ));
    }
    if let Some(t) = tenant {
        out.push_str(&format!(
            "- The active platform (tenant) key is `{t}` (also exported as the \
IBLAI_PLATFORM_KEY environment variable) — use it wherever a skill needs the \
platform key.\n"
        ));
    }
    if let Some(d) = base_domain {
        out.push_str(&format!(
            "- The platform's base domain is `{d}` — when you create or update \
`iblai.env`, set `DOMAIN={d}`, and wherever guidance or skills mention \
`<domain>`, use `{d}`.\n"
        ));
    }
    if let Some(a) = auth {
        out.push_str(&format!(
            "- The platform's sign-in (auth SPA) URL is `{a}` — use it for \
`NEXT_PUBLIC_AUTH_URL` in apps you build, and never derive an auth host from \
the domain.\n"
        ));
    }
    out
}

/// Insert [`IBLAI_INSTRUCTIONS`] (plus the caller's [`identity_lines`]) as a
/// system message into a chat/completions body — after the last LEADING system
/// message, so opencode's own system prompt keeps first position. `None` =
/// forward the body untouched (not JSON, no `messages` array, or the guidance
/// is somehow already present).
fn inject_system_guidance(
    body: &[u8],
    learner: Option<&str>,
    tenant: Option<&str>,
    email: Option<&str>,
    base_domain: Option<&str>,
    auth: Option<&str>,
) -> Option<Vec<u8>> {
    let mut v: serde_json::Value = serde_json::from_slice(body).ok()?;
    let messages = v.get_mut("messages")?.as_array_mut()?;
    if messages.iter().any(|m| {
        m.get("content")
            .and_then(|c| c.as_str())
            .is_some_and(|c| c.contains("# ibl.ai guidance"))
    }) {
        return None;
    }
    let at = messages
        .iter()
        .take_while(|m| m.get("role").and_then(|r| r.as_str()) == Some("system"))
        .count();
    let content = format!(
        "{IBLAI_INSTRUCTIONS}{}",
        identity_lines(learner, tenant, email, base_domain, auth)
    );
    messages.insert(
        at,
        serde_json::json!({ "role": "system", "content": content }),
    );
    serde_json::to_vec(&v).ok()
}

/// Read the throwaway secret from `Authorization: Bearer <secret>` (what an
/// OpenAI-compatible client sends for its `apiKey`).
fn bearer(headers: &HeaderMap) -> Option<String> {
    let v = headers
        .get(axum::http::header::AUTHORIZATION)?
        .to_str()
        .ok()?;
    v.strip_prefix("Bearer ")
        .or_else(|| v.strip_prefix("bearer "))
        .map(|s| s.trim().to_string())
}

/// Headers we never copy through: hop-by-hop, or ones the client/server must set.
fn is_skipped(name: &str) -> bool {
    matches!(
        name,
        "host" | "authorization" | "content-length" | "connection" | "transfer-encoding"
    )
}

/// Build the upstream URL: `{base}/{path}` plus the client's query string, with any
/// client-supplied `learner_id` stripped and the app-set learner appended. The agent
/// controls its own query string, so attribution must come from the app — a request
/// can never pin its usage on someone else.
fn upstream_url(
    base: &str,
    path: &str,
    query: Option<&str>,
    learner: Option<&str>,
) -> Result<url::Url, String> {
    let joined = match query {
        Some(q) if !q.is_empty() => format!("{}/{}?{}", base.trim_end_matches('/'), path, q),
        _ => format!("{}/{}", base.trim_end_matches('/'), path),
    };
    let mut url = url::Url::parse(&joined).map_err(|e| format!("bad upstream url: {e}"))?;
    let spoofed = url.query_pairs().any(|(k, _)| k == "learner_id");
    if learner.is_some() || spoofed {
        let kept: Vec<(String, String)> = url
            .query_pairs()
            .filter(|(k, _)| k != "learner_id")
            .map(|(k, v)| (k.into_owned(), v.into_owned()))
            .collect();
        let mut pairs = url.query_pairs_mut();
        pairs.clear();
        for (k, v) in &kept {
            pairs.append_pair(k, v);
        }
        if let Some(l) = learner {
            pairs.append_pair("learner_id", l);
        }
        drop(pairs);
        // A stripped-to-nothing query would otherwise leave a dangling `?`.
        if url.query() == Some("") {
            url.set_query(None);
        }
    }
    Ok(url)
}

async fn forward(req: Request) -> Response {
    let (parts, body) = req.into_parts();

    let path = parts.uri.path().strip_prefix("/v1/").unwrap_or_default();
    if !ALLOWED_PATHS.contains(&path) {
        return (StatusCode::NOT_FOUND, "not proxied").into_response();
    }

    let Some(secret) = bearer(&parts.headers) else {
        return (StatusCode::UNAUTHORIZED, "missing key").into_response();
    };
    let Some((base, token, tenant, inject)) = sessions().read().await.get(&secret).map(|u| {
        (
            u.base.clone(),
            u.token.clone(),
            u.tenant.clone(),
            u.inject_guidance,
        )
    }) else {
        return (StatusCode::UNAUTHORIZED, "unknown key").into_response();
    };

    let learner = learner().read().await.clone();
    let url = match upstream_url(&base, path, parts.uri.query(), learner.as_deref()) {
        Ok(u) => u,
        Err(e) => return (StatusCode::BAD_GATEWAY, e).into_response(),
    };

    // 16 MiB is far above any chat payload and still bounds a runaway body.
    let bytes = match axum::body::to_bytes(body, 16 * 1024 * 1024).await {
        Ok(b) => b,
        Err(e) => return (StatusCode::BAD_REQUEST, format!("bad body: {e}")).into_response(),
    };
    // Skills-wired sessions get the ibl.ai guidance injected as a system
    // message, in flight — opencode's own conversation state never sees it.
    // The identity lines read the app-global learner per request, so a login
    // that lands mid-session takes effect on the next call.
    let bytes = if inject && path == "chat/completions" {
        let tenant_line = (!tenant.is_empty()).then_some(tenant.as_str());
        let email = learner_email_address().await;
        // The ONE domain everything derives from and the auth SPA URL (the
        // sole non-derivable host) — both resolved, so both bullets are always
        // present: production values unless a dev override or the signed-in
        // frontend says otherwise.
        let domain = platform_base_domain().await;
        let auth = auth_url_value().await;
        match inject_system_guidance(
            &bytes,
            learner.as_deref(),
            tenant_line,
            email.as_deref(),
            Some(domain.as_str()),
            Some(auth.as_str()),
        ) {
            Some(patched) => axum::body::Bytes::from(patched),
            None => bytes,
        }
    } else {
        bytes
    };

    let mut headers = reqwest::header::HeaderMap::new();
    for (name, value) in parts.headers.iter() {
        if !is_skipped(name.as_str()) {
            if let (Ok(n), Ok(v)) = (
                reqwest::header::HeaderName::from_bytes(name.as_str().as_bytes()),
                reqwest::header::HeaderValue::from_bytes(value.as_bytes()),
            ) {
                headers.insert(n, v);
            }
        }
    }
    // The swap this whole module exists for.
    if let Ok(v) = reqwest::header::HeaderValue::from_str(&format!("Token {token}")) {
        headers.insert(reqwest::header::AUTHORIZATION, v);
    }

    // Request log for `pnpm tauri:dev`: full URL (query params included), redacted
    // auth, payload. Debug builds only — the payload is the user's chat and the
    // token prefix is still a credential fragment; neither belongs in release stdout.
    if cfg!(debug_assertions) {
        // ponytail: 4 KiB payload preview; raise if the part you're debugging is deeper in.
        let shown = String::from_utf8_lossy(&bytes[..bytes.len().min(4096)]);
        let cut = bytes.len().saturating_sub(4096);
        println!(
            "[opencode-proxy] {} {}\n  learner: {}\n  authorization: Token {}…({} chars)\n  payload: {}{}",
            parts.method,
            url,
            learner.as_deref().unwrap_or("(none — set_opencode_learner never arrived)"),
            token.get(..8).unwrap_or(""),
            token.len(),
            shown,
            if cut > 0 {
                format!(" …(+{cut} bytes)")
            } else {
                String::new()
            },
        );
    }

    let upstream = match http()
        .request(parts.method.clone(), url)
        .headers(headers)
        .body(bytes)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return (StatusCode::BAD_GATEWAY, format!("upstream failed: {e}")).into_response()
        }
    };

    let status = upstream.status();
    // Response log, paired with the request log above: an upstream refusal — 402
    // insufficient credit above all — must be visible in the tauri:dev terminal.
    if cfg!(debug_assertions) {
        println!(
            "[opencode-proxy] ← {} {} {}",
            status,
            parts.method,
            upstream.url()
        );
    }
    let mut out = Response::builder().status(status.as_u16());
    for (name, value) in upstream.headers().iter() {
        if !is_skipped(name.as_str()) {
            if let Ok(v) = HeaderValue::from_bytes(value.as_bytes()) {
                out = out.header(name.as_str(), v);
            }
        }
    }
    // 402 = insufficient credit. The agent still receives the 402 + body verbatim,
    // but the app is told too: the frontend then shows the same insufficient-balance
    // UX as normal chat (toast + upgrade dialog) — the agent's own error path would
    // reduce this to an opaque string, or swallow it entirely.
    if status == reqwest::StatusCode::PAYMENT_REQUIRED {
        let bytes = upstream.bytes().await.unwrap_or_default();
        if let Some(app) = app().get() {
            use tauri::Emitter;
            let payload: serde_json::Value =
                serde_json::from_slice(&bytes).unwrap_or_else(|_| serde_json::json!({}));
            let _ = app.emit("opencode:payment-required", payload);
        }
        return out.body(Body::from(bytes)).unwrap_or_else(|e| {
            (
                StatusCode::BAD_GATEWAY,
                format!("bad upstream response: {e}"),
            )
                .into_response()
        });
    }

    // Streamed, not buffered — completions arrive as SSE and must reach the agent
    // token by token, exactly as they would from the real endpoint.
    out.body(Body::from_stream(upstream.bytes_stream()))
        .unwrap_or_else(|e| {
            (
                StatusCode::BAD_GATEWAY,
                format!("bad upstream response: {e}"),
            )
                .into_response()
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn secrets_are_unique_and_long_enough_to_not_guess() {
        let a = new_secret();
        let b = new_secret();
        assert_ne!(a, b);
        assert!(a.len() >= 32, "secret too short: {a}");
    }

    #[test]
    fn only_the_model_paths_are_proxied() {
        assert!(ALLOWED_PATHS.contains(&"chat/completions"));
        // Not a general tunnel into the authenticated API.
        assert!(!ALLOWED_PATHS.contains(&"users/me"));
    }

    #[test]
    fn the_real_token_header_is_never_copied_from_the_agent() {
        assert!(is_skipped("authorization"));
        assert!(is_skipped("host"));
        assert!(!is_skipped("content-type"));
    }

    const BASE: &str = "https://dm.example/api/ai-mentor/orgs/main/v1";

    #[test]
    fn the_learner_is_attached_to_forwarded_urls() {
        let url = upstream_url(BASE, "chat/completions", None, Some("myuser")).unwrap();
        assert_eq!(
            url.as_str(),
            "https://dm.example/api/ai-mentor/orgs/main/v1/chat/completions?learner_id=myuser"
        );
    }

    #[test]
    fn no_learner_leaves_the_url_untouched() {
        let url = upstream_url(BASE, "models", None, None).unwrap();
        assert_eq!(
            url.as_str(),
            "https://dm.example/api/ai-mentor/orgs/main/v1/models"
        );
        let url = upstream_url(BASE, "models", Some("a=1"), None).unwrap();
        assert_eq!(url.query(), Some("a=1"));
    }

    #[test]
    fn the_clients_own_query_params_survive() {
        let url = upstream_url(BASE, "chat/completions", Some("a=1&b=2"), Some("me")).unwrap();
        assert_eq!(url.query(), Some("a=1&b=2&learner_id=me"));
    }

    #[test]
    fn a_learner_id_spoofed_by_the_agent_is_replaced_with_the_real_one() {
        let url = upstream_url(
            BASE,
            "chat/completions",
            Some("learner_id=victim&a=1"),
            Some("me"),
        )
        .unwrap();
        assert_eq!(url.query(), Some("a=1&learner_id=me"));
    }

    #[test]
    fn a_spoofed_learner_id_is_stripped_even_before_anyone_signs_in() {
        let url = upstream_url(BASE, "chat/completions", Some("learner_id=victim"), None).unwrap();
        assert_eq!(url.query(), None);
        assert!(!url.as_str().ends_with('?'));
    }

    #[test]
    fn learner_names_are_url_encoded_not_interpolated() {
        let url = upstream_url(BASE, "chat/completions", None, Some("us er&x=y")).unwrap();
        // One pair, hostile characters escaped — a name can't smuggle extra params.
        assert_eq!(url.query(), Some("learner_id=us+er%26x%3Dy"));
    }

    /// Serializes the tests that talk to the live proxy: `ensure_started()`
    /// memoizes its port globally and each test's runtime kills the server it
    /// spawned — the rebind probe recovers from that, but two live tests
    /// interleaving could still race one another's requests mid-rebind.
    fn live_proxy_lock() -> std::sync::MutexGuard<'static, ()> {
        static L: OnceLock<std::sync::Mutex<()>> = OnceLock::new();
        L.get_or_init(|| std::sync::Mutex::new(()))
            .lock()
            .unwrap_or_else(|e| e.into_inner())
    }

    /// Serializes the tests that write the process-global learner/dm_base/
    /// domain/auth holders — run in parallel they interleave set-then-assert
    /// sequences on the same statics and flake.
    fn learner_state_lock() -> std::sync::MutexGuard<'static, ()> {
        static L: OnceLock<std::sync::Mutex<()>> = OnceLock::new();
        L.get_or_init(|| std::sync::Mutex::new(()))
            .lock()
            .unwrap_or_else(|e| e.into_inner())
    }

    /// The credit gate lives upstream: when the DM answers 402 on
    /// `chat/completions`, the agent must receive that 402 and its body EXACTLY.
    /// The proxy swaps auth — it never rewrites outcomes.
    #[tokio::test]
    async fn an_upstream_402_reaches_the_agent_unchanged() {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};

        let _live = live_proxy_lock();

        const BODY: &str = r#"{"error":"Payment required","status_code":402}"#;

        // Canned upstream: capture the request head, answer 402 + JSON, done.
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let upstream_addr = listener.local_addr().unwrap();
        let (seen_tx, seen_rx) = tokio::sync::oneshot::channel::<String>();
        tokio::spawn(async move {
            let (mut sock, _) = listener.accept().await.unwrap();
            let mut data = Vec::new();
            loop {
                let mut buf = [0u8; 4096];
                let n = sock.read(&mut buf).await.unwrap();
                if n == 0 {
                    break;
                }
                data.extend_from_slice(&buf[..n]);
                // The client sends no body, so the head is the whole request.
                if data.windows(4).any(|w| w == b"\r\n\r\n") {
                    break;
                }
            }
            let _ = seen_tx.send(String::from_utf8_lossy(&data).to_string());
            let resp = format!(
                "HTTP/1.1 402 Payment Required\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{BODY}",
                BODY.len()
            );
            let _ = sock.write_all(resp.as_bytes()).await;
        });

        let port = ensure_started().await.unwrap();
        let secret = new_secret();
        // No guidance injection: the passthrough must stay byte-verbatim.
        register(
            &secret,
            format!("http://{upstream_addr}/v1"),
            "real-dm-token".to_string(),
            "main-tenant".to_string(),
            false,
        )
        .await;

        let resp = reqwest::Client::new()
            .post(format!("http://127.0.0.1:{port}/v1/chat/completions"))
            .header("authorization", format!("Bearer {secret}"))
            .send()
            .await
            .unwrap();

        assert_eq!(resp.status().as_u16(), 402, "status must pass through");
        assert_eq!(resp.text().await.unwrap(), BODY, "body must pass through");

        // The refusal still went out with the REAL token — the swap is
        // unconditional, not a success-path feature.
        let seen = seen_rx.await.unwrap().to_lowercase();
        assert!(
            seen.contains("authorization: token real-dm-token"),
            "upstream did not get the swapped token; request was:\n{seen}"
        );

        unregister(&secret).await;
    }

    /// The guidance complements opencode's own system prompt — it must land
    /// AFTER the leading system block, never in front of it.
    #[test]
    fn guidance_lands_after_the_leading_system_block() {
        let body = serde_json::json!({
            "model": "openai/gpt-5.5",
            "messages": [
                { "role": "system", "content": "opencode system prompt" },
                { "role": "system", "content": "environment" },
                { "role": "user", "content": "build a todo app" }
            ]
        })
        .to_string();

        let out = inject_system_guidance(body.as_bytes(), None, None, None, None, None)
            .expect("must inject");
        let v: serde_json::Value = serde_json::from_slice(&out).unwrap();
        let msgs = v["messages"].as_array().unwrap();

        assert_eq!(msgs.len(), 4);
        assert_eq!(msgs[0]["content"], "opencode system prompt");
        assert_eq!(msgs[2]["role"], "system");
        assert!(
            msgs[2]["content"]
                .as_str()
                .unwrap()
                .contains("iblai-vibe-ops-init"),
            "the injected message carries the guidance"
        );
        assert_eq!(msgs[3]["role"], "user", "the user turn stays last");
        assert_eq!(
            v["model"], "openai/gpt-5.5",
            "the rest of the body survives"
        );
    }

    #[test]
    fn a_body_with_no_system_prompt_gets_the_guidance_first() {
        let body = serde_json::json!({
            "messages": [{ "role": "user", "content": "hi" }]
        })
        .to_string();

        let out = inject_system_guidance(body.as_bytes(), None, None, None, None, None).unwrap();
        let v: serde_json::Value = serde_json::from_slice(&out).unwrap();
        assert_eq!(v["messages"][0]["role"], "system");
        assert_eq!(v["messages"][1]["role"], "user");
    }

    /// Anything the injector can't handle is forwarded byte-for-byte: a broken
    /// guidance patch must never break the model call it rides on.
    #[test]
    fn unpatchable_bodies_are_left_untouched() {
        assert!(inject_system_guidance(b"not json at all", None, None, None, None, None).is_none());
        assert!(inject_system_guidance(
            br#"{"prompt": "legacy completions"}"#,
            None,
            None,
            None,
            None,
            None
        )
        .is_none());

        // Already carrying the guidance → not doubled, identity or not.
        let body = serde_json::json!({
            "messages": [{ "role": "system", "content": IBLAI_INSTRUCTIONS }]
        })
        .to_string();
        assert!(inject_system_guidance(body.as_bytes(), None, None, None, None, None).is_none());
        assert!(inject_system_guidance(
            body.as_bytes(),
            Some("codey"),
            Some("acme"),
            None,
            Some("iblai.org"),
            None
        )
        .is_none());
    }

    /// The agent must be TOLD who it acts for: the identity bullets carry the
    /// username and platform key plus the env vars that mirror them.
    #[test]
    fn identity_lines_land_in_the_guidance() {
        let body = serde_json::json!({
            "messages": [{ "role": "user", "content": "deploy this" }]
        })
        .to_string();

        let out = inject_system_guidance(
            body.as_bytes(),
            Some("codey"),
            Some("acme"),
            Some("codey@example.com"),
            Some("iblai.org"),
            Some("https://auth.iblai.org"),
        )
        .unwrap();
        let v: serde_json::Value = serde_json::from_slice(&out).unwrap();
        let content = v["messages"][0]["content"].as_str().unwrap();
        assert!(content.contains("username is `codey`"), "{content}");
        assert!(content.contains("IBLAI_USERNAME"), "{content}");
        assert!(
            content.contains("platform (tenant) key is `acme`"),
            "{content}"
        );
        assert!(content.contains("IBLAI_PLATFORM_KEY"), "{content}");
        assert!(
            content.contains("email address is `codey@example.com`"),
            "{content}"
        );
        // The ONE domain the agent derives everything from, and the sole
        // non-derivable host beside it.
        assert!(content.contains("base domain is `iblai.org`"), "{content}");
        assert!(content.contains("DOMAIN=iblai.org"), "{content}");
        assert!(
            content.contains("auth SPA) URL is `https://auth.iblai.org`"),
            "{content}"
        );
        assert!(content.contains("NEXT_PUBLIC_AUTH_URL"), "{content}");

        // No identity known → the guidance is exactly the base text, no stubs.
        let out = inject_system_guidance(body.as_bytes(), None, None, None, None, None).unwrap();
        let v: serde_json::Value = serde_json::from_slice(&out).unwrap();
        assert_eq!(v["messages"][0]["content"], IBLAI_INSTRUCTIONS);

        // Each line stands alone when only one part of the identity is known.
        assert!(identity_lines(Some("codey"), None, None, None, None).contains("IBLAI_USERNAME"));
        assert!(
            !identity_lines(Some("codey"), None, None, None, None).contains("IBLAI_PLATFORM_KEY")
        );
        assert!(identity_lines(None, Some("acme"), None, None, None).contains("IBLAI_PLATFORM_KEY"));
        assert!(identity_lines(None, None, Some("a@b.c"), None, None)
            .contains("email address is `a@b.c`"));
        let domain_only = identity_lines(None, None, None, Some("iblai.app"), None);
        assert!(domain_only.contains("DOMAIN=iblai.app"), "{domain_only}");
        assert!(!domain_only.contains("auth SPA"), "{domain_only}");
        assert_eq!(identity_lines(None, None, None, None, None), "");
    }

    /// The env-var half of the same contract: what spawn exports as
    /// `IBLAI_USERNAME` comes from here, and empty input must yield `None` so
    /// the variable is not set at all rather than set to "".
    #[tokio::test]
    async fn the_signed_in_learner_is_exposed_for_the_child_env() {
        let _state = learner_state_lock();
        set_learner(
            "codey",
            "codey@example.com",
            "https://dm.example/dm",
            " iblai.org ",
            "https://auth.iblai.org/",
        )
        .await;
        assert_eq!(learner_username().await.as_deref(), Some("codey"));
        assert_eq!(
            learner_email_address().await.as_deref(),
            Some("codey@example.com")
        );
        // Trimmed on the way in; the auth URL also loses its trailing slash.
        // (Asserted on the holders, not the resolved getters, so a dev
        // machine's IBLAI_* override env cannot flake this test.)
        assert_eq!(platform_domain().read().await.as_deref(), Some("iblai.org"));
        assert_eq!(
            auth_url().read().await.as_deref(),
            Some("https://auth.iblai.org")
        );
        set_learner("   ", "  ", "", "", "").await;
        assert_eq!(learner_username().await, None);
        assert_eq!(learner_email_address().await, None);
        // An empty base must not erase a good one — a later call that only
        // carries a username would otherwise strand minting on the default host.
        // Same rule for the domain and auth URL.
        assert_eq!(dm_base_url().await, "https://dm.example/dm");
        assert_eq!(platform_domain().read().await.as_deref(), Some("iblai.org"));
        assert_eq!(
            auth_url().read().await.as_deref(),
            Some("https://auth.iblai.org")
        );
    }

    /// The DM host is only knowable from the frontend, but minting must still
    /// aim somewhere sane before it arrives.
    #[tokio::test]
    async fn the_dm_base_falls_back_and_loses_its_trailing_slash() {
        let _state = learner_state_lock();
        set_learner("codey", "", "https://api.iblai.app/dm/", "", "").await;
        assert_eq!(dm_base_url().await, "https://api.iblai.app/dm");
        assert!(DEFAULT_DM_BASE.starts_with("https://"));
    }

    /// The dev-override chain is pure precedence plus a tiny KEY=VALUE parser —
    /// tested without touching the process env or the real data dir.
    #[test]
    fn the_dev_override_outranks_the_frontend_and_the_default_holds() {
        assert_eq!(
            resolve_setting(Some("iblai.org".into()), Some("iblai.app".into())).as_deref(),
            Some("iblai.org")
        );
        assert_eq!(
            resolve_setting(None, Some("iblai.app".into())).as_deref(),
            Some("iblai.app")
        );
        // Nothing anywhere → the caller's default rules (`iblai.app` for the
        // domain, `None` — say nothing — for the auth URL).
        assert_eq!(resolve_setting(None, None), None);

        let file = "# dev overrides\nIBLAI_PLATFORM_DOMAIN = iblai.org\nIBLAI_AUTH_URL=\n";
        assert_eq!(
            env_file_lookup(file, "IBLAI_PLATFORM_DOMAIN").as_deref(),
            Some("iblai.org")
        );
        assert_eq!(
            env_file_lookup(file, "IBLAI_AUTH_URL"),
            None,
            "empty value = unset"
        );
        assert_eq!(env_file_lookup(file, "MISSING"), None);
        assert_eq!(
            env_file_lookup("# IBLAI_PLATFORM_DOMAIN=x\n", "IBLAI_PLATFORM_DOMAIN"),
            None
        );

        // The hardcoded production defaults — in force until a
        // src-tauri/.env.local or .env.production overrides them.
        assert_eq!(DEFAULT_PLATFORM_DOMAIN, "iblai.app");
        assert_eq!(DEFAULT_AUTH_URL, "https://login.iblai.app");
    }

    /// `<app>-<machine-code>-<suffix>`: the machine code is stable (it names
    /// this device on the platform), the suffix is fresh per mint (a reused
    /// name can collide with a stranded key and the mint then depends on a
    /// DELETE the platform may refuse).
    #[test]
    fn the_key_name_keeps_its_device_stem_and_varies_its_suffix() {
        let id = device_id();
        assert!(!id.is_empty());
        assert_eq!(id, device_id(), "the machine code is minted once");

        let first = mint_key_name();
        let second = mint_key_name();
        for name in [&first, &second] {
            assert!(name.starts_with(&format!("os-code-{id}-")), "{name}");
        }
        assert_ne!(first, second, "every mint gets a never-before-seen name");
    }

    /// A canned DM that answers `responses` in order, recording each request as
    /// `(method, path, body)`.
    ///
    /// Real HTTP over loopback rather than a mocked client, so what gets
    /// asserted is the request this module actually builds — including the
    /// detail route's missing trailing slash, which DM is strict about.
    #[allow(clippy::type_complexity)]
    async fn canned_dm(
        responses: Vec<(u16, String)>,
    ) -> (
        std::net::SocketAddr,
        std::sync::Arc<Mutex<Vec<(String, String, String)>>>,
    ) {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let seen = std::sync::Arc::new(Mutex::new(Vec::new()));
        let log = seen.clone();

        tokio::spawn(async move {
            for (status, body) in responses {
                let Ok((mut sock, _)) = listener.accept().await else {
                    return;
                };
                let mut data = Vec::new();
                let mut split = None;
                while split.is_none() {
                    let mut buf = [0u8; 4096];
                    match sock.read(&mut buf).await {
                        Ok(0) | Err(_) => break,
                        Ok(n) => data.extend_from_slice(&buf[..n]),
                    }
                    split = data.windows(4).position(|w| w == b"\r\n\r\n");
                }
                let Some(head_end) = split else { continue };
                let head = String::from_utf8_lossy(&data[..head_end]).to_string();
                let content_len = head
                    .lines()
                    .find(|l| l.to_ascii_lowercase().starts_with("content-length:"))
                    .and_then(|l| l.split(':').nth(1)?.trim().parse::<usize>().ok())
                    .unwrap_or(0);
                while data.len() < head_end + 4 + content_len {
                    let mut buf = [0u8; 4096];
                    match sock.read(&mut buf).await {
                        Ok(0) | Err(_) => break,
                        Ok(n) => data.extend_from_slice(&buf[..n]),
                    }
                }
                let mut start = head.split_whitespace();
                let method = start.next().unwrap_or_default().to_string();
                let path = start.next().unwrap_or_default().to_string();
                let payload = String::from_utf8_lossy(&data[(head_end + 4).min(data.len())..])
                    .trim_end_matches('\0')
                    .to_string();
                log.lock().await.push((method, path, payload));

                let resp = format!(
                    "HTTP/1.1 {status} X\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}",
                    body.len()
                );
                let _ = sock.write_all(resp.as_bytes()).await;
            }
        });
        (addr, seen)
    }

    /// A learner who can't mint (DM allows platform admins only) must not fail
    /// the spawn — the agent is told to say so instead of asking for a key.
    #[tokio::test]
    async fn a_non_admin_gets_no_key_and_no_error() {
        // Same lock as the proxy-lifecycle tests: this binds an ephemeral port,
        // and the OS will happily hand back the one `ensure_started_rebinds…`
        // just freed — which would make its "the old server is gone"
        // precondition fail for reasons that have nothing to do with it.
        let _live = live_proxy_lock();
        let (addr, _seen) = canned_dm(vec![(403, r#"{"detail":"forbidden"}"#.to_string())]).await;
        let base = format!("http://{addr}");
        assert_eq!(
            mint_platform_key(&base, "dm-token", "os-code-test").await,
            Ok(None)
        );
    }

    /// Every mint POSTs once under a never-before-seen name — no duplicate
    /// branch, no DELETE for the platform to refuse. This is what makes the
    /// mint independent of any stranded key from an earlier build.
    #[tokio::test]
    async fn every_mint_asks_once_under_a_fresh_name() {
        let _live = live_proxy_lock(); // see the note in the 403 test above
        let (addr, requests) = canned_dm(vec![
            (201, r#"{"key":"minted-1"}"#.to_string()),
            (201, r#"{"key":"minted-2"}"#.to_string()),
        ])
        .await;
        let base = format!("http://{addr}");
        let stem = format!("os-code-{}-", device_id());

        for expected in ["minted-1", "minted-2"] {
            let key = mint_platform_key(&base, "dm-token", &mint_key_name())
                .await
                .unwrap();
            assert_eq!(key.as_deref(), Some(expected));
        }

        let seen = requests.lock().await.clone();
        assert_eq!(seen.len(), 2, "one POST per mint, nothing else: {seen:?}");
        for req in &seen {
            assert_eq!(req.0, "POST");
            assert!(
                req.2.contains(&format!("\"name\":\"{stem}")),
                "the name keeps the <app>-<machine-code>- stem: {}",
                req.2
            );
            assert!(
                !req.2.contains("\"mode\""),
                "the mint must NOT send `mode` — DM defaults it to owner, and \
                 naming it opts into the privileged-field RBAC gate: {}",
                req.2
            );
            assert!(
                req.2.contains(PLATFORM_KEY_EXPIRES_IN),
                "the mint asks for the pinned lifetime: {}",
                req.2
            );
        }
        assert_ne!(seen[0].2, seen[1].2, "the suffix differs per mint");
    }

    /// A 401 is an auth failure — the DM didn't recognise the token (usually a
    /// platform-domain mismatch) — and must surface as an error, never be
    /// mislabelled as "not a platform admin".
    #[tokio::test]
    async fn a_rejected_token_is_an_auth_failure_not_a_missing_admin() {
        let _live = live_proxy_lock(); // see the note in the 403 test above
        let (addr, _seen) =
            canned_dm(vec![(401, r#"{"detail":"invalid token"}"#.to_string())]).await;
        let base = format!("http://{addr}");
        let err = mint_platform_key(&base, "dm-token", "os-code-test")
            .await
            .expect_err("401 is an error, not Ok(None)");
        assert!(err.contains("401"), "{err}");
        assert!(err.contains(&base), "names the DM it called: {err}");
    }

    /// With unique names a 400 can only be a genuine validation error — it
    /// must surface loudly with the body, never trigger recovery machinery.
    #[tokio::test]
    async fn a_validation_error_surfaces_with_the_dm_body() {
        let _live = live_proxy_lock(); // see the note in the 403 test above
        let (addr, requests) = canned_dm(vec![(
            400,
            r#"{"expires_in":["bad duration"]}"#.to_string(),
        )])
        .await;
        let base = format!("http://{addr}");
        let err = mint_platform_key(&base, "dm-token", &mint_key_name())
            .await
            .expect_err("a 400 is an error now, not a duplicate to recover from");
        assert!(err.contains("400"), "{err}");
        assert!(
            err.contains("bad duration"),
            "carries DM's own words: {err}"
        );
        assert_eq!(requests.lock().await.len(), 1, "and nothing was retried");
    }

    /// The persisted key is reused until the renewal margin before its
    /// recorded expiry, and slots are strictly per (DM base, tenant) —
    /// switching platforms mid-development must never serve a key minted
    /// against the other DM.
    #[test]
    fn the_persisted_key_is_reused_until_it_nears_expiry() {
        let mut settings = serde_json::Map::new();
        let now = 1_000_000u64;
        let expires = now + PLATFORM_KEY_LIFETIME.as_secs();
        let margin = PLATFORM_KEY_RENEW_MARGIN.as_secs();
        assert_eq!(
            stored_platform_key(&settings, "https://dm.a", "acme", now),
            None
        );

        record_platform_key(&mut settings, "https://dm.a", "acme", "key-a", expires);
        assert_eq!(
            stored_platform_key(&settings, "https://dm.a", "acme", now),
            Some(("key-a".to_string(), expires)),
            "the expiry rides along for the child env"
        );
        assert_eq!(
            stored_platform_key(&settings, "https://dm.a", "acme", expires - margin - 1)
                .map(|(k, _)| k)
                .as_deref(),
            Some("key-a"),
            "still fresh just inside the margin"
        );
        assert_eq!(
            stored_platform_key(&settings, "https://dm.a", "acme", expires - margin),
            None,
            "re-mints once the renewal margin is reached"
        );

        // Foreign slots never borrow this key.
        assert_eq!(
            stored_platform_key(&settings, "https://dm.b", "acme", now),
            None
        );
        assert_eq!(
            stored_platform_key(&settings, "https://dm.a", "other", now),
            None
        );

        // A second slot and foreign settings owners coexist untouched.
        settings.insert("permission_mode".into(), serde_json::json!("auto"));
        record_platform_key(&mut settings, "https://dm.b", "acme", "key-b", expires);
        assert_eq!(
            stored_platform_key(&settings, "https://dm.a", "acme", now)
                .map(|(k, _)| k)
                .as_deref(),
            Some("key-a")
        );
        assert_eq!(
            stored_platform_key(&settings, "https://dm.b", "acme", now)
                .map(|(k, _)| k)
                .as_deref(),
            Some("key-b")
        );
        assert_eq!(settings["permission_mode"], serde_json::json!("auto"));

        // An older build's entry (minted_at, no expires_at) reads as absent —
        // one harmless re-mint, never a wrong freshness guess.
        settings[SETTINGS_PLATFORM_KEYS]["https://dm.c|acme"] =
            serde_json::json!({ "key": "old-key", "minted_at": now });
        assert_eq!(
            stored_platform_key(&settings, "https://dm.c", "acme", now),
            None
        );
    }

    /// The duration string DM receives and the locally computed `expires_at`
    /// must describe the same lifetime, or the recorded expiry lies.
    #[test]
    fn the_requested_and_recorded_key_lifetimes_agree() {
        let days: u64 = PLATFORM_KEY_EXPIRES_IN
            .split_whitespace()
            .next()
            .unwrap()
            .parse()
            .expect("PLATFORM_KEY_EXPIRES_IN starts with a day count");
        assert_eq!(PLATFORM_KEY_EXPIRES_IN.ends_with("00:00:00"), true);
        assert_eq!(days * 24 * 60 * 60, PLATFORM_KEY_LIFETIME.as_secs());
        assert!(
            PLATFORM_KEY_RENEW_MARGIN < PLATFORM_KEY_LIFETIME,
            "a margin >= lifetime would re-mint on every call"
        );
    }

    /// The "can't reconnect" half of the lost-connection bug: the old code
    /// memoized the port forever, so once the server task died (its runtime
    /// went away, or accept failed fatally) every future session registered
    /// against a dead port until an app restart. The probe must detect the
    /// death and rebind.
    #[tokio::test]
    async fn ensure_started_rebinds_after_its_server_dies() {
        let _live = live_proxy_lock();

        // Start the proxy on a runtime that then dies, taking the server with it.
        let dead_port = std::thread::spawn(|| {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();
            rt.block_on(ensure_started()).unwrap()
            // rt drops here → the spawned axum task and its listener die.
        })
        .join()
        .unwrap();
        // Precondition, not an assertion: the kernel is free to hand that just
        // released ephemeral port to the next listener that asks — several
        // tests here bind one — and when it does, "the old server is gone"
        // becomes unprovable rather than false. Bail out instead of failing;
        // the rebind path below is exercised on every run that keeps the port.
        if tokio::net::TcpStream::connect(("127.0.0.1", dead_port))
            .await
            .is_ok()
        {
            return;
        }

        // Pre-fix: the memoized dead port comes back and this connect fails.
        let port = ensure_started().await.unwrap();
        assert!(
            tokio::net::TcpStream::connect(("127.0.0.1", port))
                .await
                .is_ok(),
            "ensure_started must hand out a port that answers"
        );
    }

    /// A wedged upstream must fail the turn, not hang it forever: the client's
    /// read timeout is per-read (between chunks), so a stream that stops
    /// mid-body errors out once the silence exceeds the budget.
    #[tokio::test]
    async fn a_stalled_upstream_read_times_out_between_chunks() {
        use futures_util::StreamExt;
        use tokio::io::{AsyncReadExt, AsyncWriteExt};

        // Canned upstream: send headers + a partial body, then hold the socket
        // open silently forever.
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            let (mut sock, _) = listener.accept().await.unwrap();
            let mut buf = [0u8; 4096];
            let _ = sock.read(&mut buf).await;
            let _ = sock
                .write_all(b"HTTP/1.1 200 OK\r\ncontent-length: 100\r\n\r\npartial")
                .await;
            tokio::time::sleep(Duration::from_secs(600)).await;
            drop(sock);
        });

        let resp = http_client(Duration::from_millis(200))
            .get(format!("http://{addr}/"))
            .send()
            .await
            .unwrap();
        let mut stream = resp.bytes_stream();

        let first = stream.next().await.expect("the partial chunk arrives");
        assert_eq!(first.unwrap().as_ref(), b"partial");

        let second = tokio::time::timeout(Duration::from_secs(5), stream.next())
            .await
            .expect("the stalled stream must ERROR, not hang — this hang was the wedged-turn bug");
        assert!(
            second
                .expect("stream must yield an item, not end cleanly")
                .is_err(),
            "silence past the read timeout is an error"
        );
    }

    /// The guidance must keep its load-bearing content: skill priority, the
    /// recommended default-template question for web apps (user-facing name
    /// only, never "vibe-starter"), never stripping ibl.ai components, and
    /// publishing + showing the live site.
    #[test]
    fn the_iblai_guidance_keeps_its_load_bearing_lines() {
        let text = IBLAI_INSTRUCTIONS;
        assert!(text.contains("iblai-vibe-"), "{text}");
        assert!(text.contains("iblai-vibe-ops-init"), "{text}");
        assert!(text.contains("website or web app"), "{text}");
        assert!(
            text.contains("our default template")
                && text.contains("fastest and most reliable")
                && text.contains("never the internal name"),
            "the ask-about-the-default-template rule must survive edits: {text}"
        );
        assert!(
            text.contains("Do NOT remove ibl.ai components"),
            "the keep-components rule must survive edits: {text}"
        );
        assert!(
            text.contains(".env.example") && text.contains(".env.local"),
            "the env-file rule must survive edits: {text}"
        );
        assert!(
            text.contains("open -a") && text.contains("deployed URL"),
            "the show-the-live-site guidance must survive edits: {text}"
        );
        assert!(
            text.contains("pnpm typecheck") && text.contains("never show localhost"),
            "the no-localhost rule must survive edits: {text}"
        );
        assert!(
            text.contains("iblai-vibe-ops-deploy")
                && text.contains("do not ask whether to deploy")
                && text.contains("never improvise status commands"),
            "the auto-deploy rule must survive edits: {text}"
        );
        assert!(
            text.contains("iblai-vibe-monetization-app-paywall")
                && text.contains("on request only")
                && text.contains("unprompted"),
            "the optional-monetization rule must survive edits: {text}"
        );
        assert!(
            text.contains("outcome-focused")
                && text.contains("HARD CAP: three short sentences")
                && text.contains("the one obstacle blocking")
                && text.contains("never in the reply text")
                && text.contains("Emit no text between tool calls")
                && text.contains("explicitly asks for detail"),
            "the result-or-obstacle-only rule must survive edits: {text}"
        );
        assert!(
            text.contains("IBLAI_API_KEY")
                && text.contains("NEVER ask the user for a platform API key"),
            "the auto-minted-key rule must survive edits: {text}"
        );
        assert!(
            text.contains("never expand")
                && text.contains("printf 'TOKEN=%s")
                && text.contains("grep -qF"),
            "the resolved-env-value rule must survive edits: {text}"
        );
        assert!(
            text.contains("standard OpenAI api key")
                && text.contains("never for your own model calls"),
            "the v1-key-for-built-apps-not-own-inference rule must survive edits: {text}"
        );
        assert!(
            text.contains("platform base domain given in the identity lines"),
            "the one-domain resolution note must survive edits: {text}"
        );
        assert!(
            text.contains("providers/stripe/payments")
                && text.contains("https://api.<domain>/dm")
                && text.contains("Never ask the user for a Stripe")
                && text.contains("platform settings"),
            "the no-Stripe-keys-in-chat rule must survive edits: {text}"
        );
        assert!(
            text.contains("deployment-hash") && text.contains("skip the deploy"),
            "the deploy-dedupe rule must survive edits: {text}"
        );
    }
}
