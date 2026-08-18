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

    let query = parts
        .uri
        .query()
        .map(|q| format!("?{q}"))
        .unwrap_or_default();
    let url = format!("{}/{}{}", base.trim_end_matches('/'), path, query);

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

    let upstream = match http()
        .request(parts.method.clone(), &url)
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
    let mut out = Response::builder().status(status.as_u16());
    for (name, value) in upstream.headers().iter() {
        if !is_skipped(name.as_str()) {
            if let Ok(v) = HeaderValue::from_bytes(value.as_bytes()) {
                out = out.header(name.as_str(), v);
            }
        }
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
    }
}
