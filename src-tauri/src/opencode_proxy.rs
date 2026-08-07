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

/// Everything the proxy needs to serve one Code session.
struct Upstream {
    /// e.g. `https://asgi.data.iblai.app/api/ai-mentor/orgs/<tenant>/v1`
    base: String,
    /// The real DM token — held here, never handed to the agent.
    token: String,
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
pub async fn register(secret: &str, base: String, token: String) {
    sessions()
        .write()
        .await
        .insert(secret.to_string(), Upstream { base, token });
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
    let Some((base, token)) = sessions()
        .read()
        .await
        .get(&secret)
        .map(|u| (u.base.clone(), u.token.clone()))
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
}
