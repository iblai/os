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

#![cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::OnceLock;

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

- Whenever an available skill covers the task at hand — especially the \
iblai-vibe-* skills — you MUST invoke that skill (via the skill tool) before \
improvising the same work by hand.
- When the user asks to build a website or web app, assume they want to opt in \
to the ibl.ai ecosystem unless they say otherwise: do NOT hand-roll files from \
scratch — load the iblai-vibe-ops-init skill first (it clones the vibe-starter \
scaffold) and wire ibl.ai auth, profile, navbar, chat and analytics through \
the matching iblai-vibe-* skills.
- Never ask whether the user wants the ibl.ai ecosystem or a plain HTML/vanilla \
setup — do not offer that choice at all. Use the ibl.ai stack and the vibe \
starter and go ahead.
- Do NOT remove ibl.ai components — the navbar, profile, notification buttons, \
chat and the rest stay in place. Always keep the ibl.ai components, whether \
the project started from vibe-starter or otherwise.
- When working with vibe-starter and other ibl.ai projects, always copy \
`.env.example` into `.env.local` (before the first run, so the app boots with \
its expected configuration).
- After building or changing a website, show it to the user proactively: start \
the dev server in the background (e.g. `pnpm dev`), then open the site in the \
user's browser — macOS: `open -a \"Google Chrome\" http://localhost:3000` \
(plain `open <url>` as a fallback), Linux: `xdg-open <url>`, Windows: \
`start <url>`.
- Do not run `pnpm build` before the preview — `pnpm typecheck` and `pnpm lint` \
are enough; the dev server is the preview.
- Deployment and monetization are available on request only: when the user asks \
to deploy or publish the app, use the iblai-vibe-ops-deploy skill (ibl.ai \
hosting — no Vercel account or token); when they ask to charge users to enter \
the app, use the iblai-vibe-monetization-app-paywall skill. Do not suggest \
either unprompted.
";

/// Everything the proxy needs to serve one Code session.
struct Upstream {
    /// e.g. `https://asgi.data.iblai.app/api/ai-mentor/orgs/<tenant>/v1`
    base: String,
    /// The real DM token — held here, never handed to the agent.
    token: String,
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

/// Set the learner attached to forwarded model calls (empty clears it).
pub async fn set_learner(username: &str) {
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
}

fn http() -> &'static reqwest::Client {
    static C: OnceLock<reqwest::Client> = OnceLock::new();
    // No timeout: a streamed completion legitimately stays open for minutes.
    C.get_or_init(reqwest::Client::new)
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

/// Start the proxy on an OS-assigned loopback port (once) and return the port.
pub async fn ensure_started() -> Result<u16, String> {
    static PORT: OnceLock<u16> = OnceLock::new();
    static START: OnceLock<Mutex<()>> = OnceLock::new();

    if let Some(p) = PORT.get() {
        return Ok(*p);
    }
    let _guard = START.get_or_init(|| Mutex::new(())).lock().await;
    if let Some(p) = PORT.get() {
        return Ok(*p);
    }

    // Port 0 → the OS picks a free ephemeral port. Never a fixed one.
    let listener = tokio::net::TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], 0)))
        .await
        .map_err(|e| format!("model proxy bind failed: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("model proxy addr failed: {e}"))?
        .port();

    let app = Router::new().route("/v1/{*path}", any(forward));
    tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, app).await {
            eprintln!("[opencode-proxy] server stopped: {e}");
        }
    });
    let _ = PORT.set(port);
    Ok(port)
}

/// Register a session's upstream + real token against its throwaway secret.
/// `inject_guidance` marks a session with skills wired: its chat/completions
/// calls get [`IBLAI_INSTRUCTIONS`] injected as a system message.
pub async fn register(secret: &str, base: String, token: String, inject_guidance: bool) {
    sessions().write().await.insert(
        secret.to_string(),
        Upstream {
            base,
            token,
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

/// Insert [`IBLAI_INSTRUCTIONS`] as a system message into a chat/completions
/// body — after the last LEADING system message, so opencode's own system
/// prompt keeps first position. `None` = forward the body untouched (not
/// JSON, no `messages` array, or the guidance is somehow already present).
fn inject_system_guidance(body: &[u8]) -> Option<Vec<u8>> {
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
    messages.insert(
        at,
        serde_json::json!({ "role": "system", "content": IBLAI_INSTRUCTIONS }),
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
    let Some((base, token, inject)) = sessions()
        .read()
        .await
        .get(&secret)
        .map(|u| (u.base.clone(), u.token.clone(), u.inject_guidance))
    else {
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
    let bytes = if inject && path == "chat/completions" {
        match inject_system_guidance(&bytes) {
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

    /// The credit gate lives upstream: when the DM answers 402 on
    /// `chat/completions`, the agent must receive that 402 and its body EXACTLY.
    /// The proxy swaps auth — it never rewrites outcomes.
    ///
    /// NOTE: `ensure_started()` memoizes its port globally, and the server task it
    /// spawns lives on THIS test's runtime, which dies when the test ends. Keep
    /// this the only test that talks to the live proxy, or restructure first.
    #[tokio::test]
    async fn an_upstream_402_reaches_the_agent_unchanged() {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};

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

        let out = inject_system_guidance(body.as_bytes()).expect("must inject");
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

        let out = inject_system_guidance(body.as_bytes()).unwrap();
        let v: serde_json::Value = serde_json::from_slice(&out).unwrap();
        assert_eq!(v["messages"][0]["role"], "system");
        assert_eq!(v["messages"][1]["role"], "user");
    }

    /// Anything the injector can't handle is forwarded byte-for-byte: a broken
    /// guidance patch must never break the model call it rides on.
    #[test]
    fn unpatchable_bodies_are_left_untouched() {
        assert!(inject_system_guidance(b"not json at all").is_none());
        assert!(inject_system_guidance(br#"{"prompt": "legacy completions"}"#).is_none());

        // Already carrying the guidance → not doubled.
        let body = serde_json::json!({
            "messages": [{ "role": "system", "content": IBLAI_INSTRUCTIONS }]
        })
        .to_string();
        assert!(inject_system_guidance(body.as_bytes()).is_none());
    }

    /// The guidance must keep its load-bearing content: skill priority, the
    /// vibe-starter default for web apps (without offering an opt-out), never
    /// stripping ibl.ai components, and showing the site proactively.
    #[test]
    fn the_iblai_guidance_keeps_its_load_bearing_lines() {
        let text = IBLAI_INSTRUCTIONS;
        assert!(text.contains("iblai-vibe-"), "{text}");
        assert!(text.contains("iblai-vibe-ops-init"), "{text}");
        assert!(text.contains("website or web app"), "{text}");
        assert!(
            text.contains("Never ask") && text.contains("go ahead"),
            "the no-choice rule must survive edits: {text}"
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
            text.contains("pnpm dev") && text.contains("open -a"),
            "the show-the-site guidance must survive edits: {text}"
        );
        assert!(
            text.contains("Do not run `pnpm build`") && text.contains("pnpm typecheck"),
            "the no-build-before-preview rule must survive edits: {text}"
        );
        assert!(
            text.contains("iblai-vibe-ops-deploy")
                && text.contains("iblai-vibe-monetization-app-paywall")
                && text.contains("unprompted"),
            "the deploy/monetization on-request rule must survive edits: {text}"
        );
    }
}
