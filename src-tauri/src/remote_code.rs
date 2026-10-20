//! Remote Code host (desktop): runs the managed opencode binary in its
//! first-party `serve` mode so the mobile app (or any client on the same
//! network / tailnet) can drive Code against this machine over HTTP + SSE.
//!
//! This is the desktop half of iOS Code support — phones cannot run opencode
//! (no spawning of downloaded binaries), so the desktop hosts it and the phone
//! connects. Auth is opencode's built-in HTTP Basic password
//! (`OPENCODE_SERVER_PASSWORD`), generated fresh per enable and surfaced to
//! the UI for pairing (QR / manual entry). The server binds `0.0.0.0` — LAN
//! reachability is the point — so a password is always set, never optional.
//!
//! Lifecycle: `remote_code_enable` is idempotent (re-enabling returns the
//! running host, restarting it only when the platform/tenant changed),
//! `remote_code_disable` kills it, and both entry points (`main.rs` and
//! `lib.rs`) reap it from their `RunEvent::Exit` handler via
//! [`shutdown_sync`].

use serde::Serialize;
use std::net::{IpAddr, TcpListener};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::command;

use crate::opencode_acp::{augmented_path, opencode_program, workspaces_root, SandboxPaths};

/// Preferred port, matching opencode's own default. Any free port works — the
/// phone learns the real one from the pairing payload, never by assumption.
const PREFERRED_PORT: u16 = 4096;

struct Host {
    child: Child,
    port: u16,
    password: String,
    /// Loopback-proxy secret registered for this host; unregistered on disable
    /// so the credentials don't outlive the server.
    proxy_secret: String,
    /// Which platform tenant / API base the served config was provisioned
    /// for (its model catalog and upstream). A re-enable for a different
    /// pair restarts the server: the running one only knows the previous
    /// platform's model ids, and an unknown id dies as a silent async
    /// ProviderModelNotFoundError — no event, no message, just a phone turn
    /// spinning to its deadline.
    tenant: String,
    api_base: String,
    /// The AGENTS.md guidance (policy + per-user identity lines) last
    /// written for this host; refreshed in place when the signed-in user
    /// changes, since opencode re-reads the file on every model call.
    guidance: String,
    /// Companion workspace-management API (see [`companion_router`]).
    companion_port: u16,
    companion: tauri::async_runtime::JoinHandle<()>,
}

static HOST: Mutex<Option<Host>> = Mutex::new(None);

/// Serializes `remote_code_enable` end to end. Two concurrent enables (the
/// launch auto-restore racing the popover's Enable) each provisioned the
/// shared serve config with their OWN proxy secret; the loser then
/// unregistered its secret while the config still named it, and every
/// phone turn 401'd until the next enable.
static ENABLE_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

/// The served process's nominal model: the loopback "iblai" provider with a
/// placeholder id; the tenant's real catalog is registered on top.
fn serve_model_spec() -> crate::opencode_acp::ModelSpec {
    crate::opencode_acp::ModelSpec {
        provider: "iblai",
        model: "openai/gpt-4o".to_string(),
        local: false,
    }
}

/// What the pairing UI shows: where to connect and with which credential.
/// `urls` lists every candidate (one per LAN interface), primary first — the
/// phone tries them in order.
#[derive(Serialize, Clone)]
pub struct RemoteCodeStatus {
    pub running: bool,
    pub port: Option<u16>,
    pub password: Option<String>,
    pub urls: Vec<String>,
    /// Companion (workspace management) URLs, same order as `urls`.
    pub mgmt_urls: Vec<String>,
    /// Phone access was on before this app launch and should be brought back
    /// up (set only by `remote_code_status`).
    #[serde(default)]
    pub auto_enable: bool,
}

/// This machine's IPv4 addresses, most-likely-reachable-from-a-phone first.
///
/// Every non-loopback interface is listed (the phone tries them in order),
/// but real NICs (`en*` — Wi-Fi/Ethernet on macOS) outrank VPN tunnels
/// (`utun*`/`tap*`/`ppp*`): the default route often goes through the VPN, and
/// a phone on the same Wi-Fi can't reach the Mac's VPN address. That is
/// exactly the failure the old default-route (UDP-connect) trick produced.
fn lan_ips() -> Vec<IpAddr> {
    let mut ranked: Vec<(u8, IpAddr)> = if_addrs::get_if_addrs()
        .unwrap_or_default()
        .into_iter()
        .filter(|i| !i.is_loopback())
        .filter_map(|i| {
            let ip = i.ip();
            if !ip.is_ipv4() {
                return None;
            }
            let rank = if i.name.starts_with("en") {
                0 // physical NIC
            } else if i.name.starts_with("utun")
                || i.name.starts_with("tun")
                || i.name.starts_with("tap")
                || i.name.starts_with("ppp")
            {
                2 // VPN tunnel: reachable only from inside the tunnel
            } else {
                1 // bridges, hotspots, everything else
            };
            Some((rank, ip))
        })
        .collect();
    ranked.sort_by_key(|(rank, _)| *rank);
    ranked.into_iter().map(|(_, ip)| ip).collect()
}

/// A port the server can bind right now: the preferred one, else OS-assigned.
/// (Racy by nature — the bind is dropped before opencode rebinds — but the
/// window is tiny and a lost race surfaces as a clean enable error.)
fn free_port() -> Result<u16, String> {
    if TcpListener::bind(("0.0.0.0", PREFERRED_PORT)).is_ok() {
        return Ok(PREFERRED_PORT);
    }
    TcpListener::bind("0.0.0.0:0")
        .and_then(|l| l.local_addr())
        .map(|a| a.port())
        .map_err(|e| format!("no bindable port for remote code: {e}"))
}

/// The companion's listener: the serve port's neighbour when free, else any
/// OS-assigned port. `checked_add`: a serve port of 65535 has no neighbour —
/// fall through instead of wrapping to 0 (a debug panic, a random port in
/// release).
fn companion_listener_for(port: u16) -> std::io::Result<TcpListener> {
    port.checked_add(1)
        .and_then(|p| TcpListener::bind(("0.0.0.0", p)).ok())
        .map_or_else(|| TcpListener::bind("0.0.0.0:0"), Ok)
}

impl Host {
    /// The ONE teardown every exit path uses: kill + reap the serve child,
    /// abort the companion (or its server squats port+1 and the next enable
    /// lands on a random port hand-typed pairings can't derive), drop the
    /// pid file, and hand back the proxy secret for the caller to unregister
    /// in its own sync/async style. Four hand-written copies of this had
    /// already drifted (one skipped wait(), one never unregistered).
    fn teardown(mut self) -> String {
        let _ = self.child.kill();
        let _ = self.child.wait();
        self.companion.abort();
        let _ = std::fs::remove_file(serve_pid_file());
        self.proxy_secret
    }
}

fn status_locked(host: &mut Option<Host>) -> RemoteCodeStatus {
    // A crashed/killed server must read as stopped, not haunt the UI — and
    // it gets the SAME teardown as every other path, including unregistering
    // the proxy secret holding the platform token.
    if let Some(h) = host.as_mut() {
        if h.child.try_wait().ok().flatten().is_some() {
            if let Some(dead) = host.take() {
                let secret = dead.teardown();
                tauri::async_runtime::spawn(async move {
                    crate::opencode_proxy::unregister(&secret).await;
                });
            }
        }
    }
    match host.as_ref() {
        Some(h) => {
            let ips = lan_ips();
            RemoteCodeStatus {
                running: true,
                port: Some(h.port),
                password: Some(h.password.clone()),
                urls: ips
                    .iter()
                    .map(|ip| format!("http://{ip}:{}", h.port))
                    .collect(),
                mgmt_urls: ips
                    .iter()
                    .map(|ip| format!("http://{ip}:{}", h.companion_port))
                    .collect(),
                auto_enable: false,
            }
        }
        None => RemoteCodeStatus {
            running: false,
            port: None,
            password: None,
            urls: Vec::new(),
            mgmt_urls: Vec::new(),
            auto_enable: false,
        },
    }
}

/// Poll until the served port accepts TCP connections (any HTTP answer means
/// up; auth happens per request). False = the child died or never bound.
async fn wait_until_serving(port: u16, timeout_secs: u64) -> bool {
    for _ in 0..timeout_secs * 4 {
        if tokio::net::TcpStream::connect(("127.0.0.1", port))
            .await
            .is_ok()
        {
            return true;
        }
        tokio::time::sleep(std::time::Duration::from_millis(250)).await;
    }
    false
}

/// Current host state, reaping a dead child on the way.
#[command]
pub async fn remote_code_status() -> Result<RemoteCodeStatus, String> {
    let mut st = status_locked(&mut HOST.lock().expect("remote code lock"));
    // The user had this on and the server isn't up (fresh app launch): the
    // frontend auto-enables, so a desktop restart is invisible to phones.
    st.auto_enable = !st.running && read_persisted().enabled;
    Ok(st)
}

/// The dedicated config-home key and shared workspace for the served
/// sessions. One workspace for all phone chats (v1): the phone UI shows the
/// path; per-chat folders can follow once pairing has proven itself.
const SERVE_CONFIG_KEY: &str = "remote-serve";

fn phone_workspace() -> std::path::PathBuf {
    workspaces_root().join("phone")
}

/// Every folder a phone chat works in is under the workspaces root (the
/// companion lists and mints them there), and the one serve process serves
/// them all, so the whole root is the sandbox's workspace.
fn serve_sandbox_paths() -> SandboxPaths {
    SandboxPaths {
        home: crate::opencode_acp::home_dir().unwrap_or_default(),
        workspace: workspaces_root(),
        config_home: crate::opencode_acp::config_home(SERVE_CONFIG_KEY),
    }
}

/// The phone's `opencode serve`, as `remote_code_enable` starts it.
fn phone_serve_command(port: u16, password: &str) -> Result<Command, String> {
    let mut cmd = serve_command(&serve_sandbox_paths(), port, password)?;
    cmd.current_dir(phone_workspace());
    Ok(cmd)
}

/// `opencode serve` inside the same OS sandbox as desktop Code chats.
/// Approvals default to Automatic on the phone as on the desktop, and the
/// sandbox is what makes that safe: without it every command a phone turn
/// runs could change anything in this account.
fn serve_command(paths: &SandboxPaths, port: u16, password: &str) -> Result<Command, String> {
    let sandbox =
        crate::opencode_acp::sandbox_wrapper(paths, crate::opencode_acp::Backend::Opencode)?;
    let mut cmd = Command::new(sandbox.program);
    cmd.args(&sandbox.args).arg(opencode_program()).args([
        "serve",
        "--hostname",
        "0.0.0.0",
        "--port",
        &port.to_string(),
    ]);
    for key in crate::opencode_acp::stripped_env(std::env::vars_os().map(|(k, _)| k)) {
        cmd.env_remove(key);
    }
    cmd.envs(sandbox.env)
        .env("PATH", augmented_path())
        .env("XDG_CONFIG_HOME", &paths.config_home)
        .env("OPENCODE_SERVER_PASSWORD", password)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    Ok(cmd)
}

/// The folders the phone may pick, name-sorted. Real folders only: the phone's
/// serve can write the whole root, and a link it left there would offer the
/// phone its target.
fn listed_workspaces(root: &std::path::Path) -> Vec<serde_json::Value> {
    let mut dirs: Vec<serde_json::Value> = std::fs::read_dir(root)
        .map(|rd| {
            rd.flatten()
                .filter(|e| e.file_type().is_ok_and(|t| t.is_dir()))
                .map(|e| {
                    serde_json::json!({
                        "name": e.file_name().to_string_lossy(),
                        "path": e.path().to_string_lossy(),
                    })
                })
                .collect()
        })
        .unwrap_or_default();
    dirs.sort_by_key(|d| d["name"].as_str().unwrap_or("").to_string());
    dirs
}

/// phone-<hex> under the managed root: readable, collision-free, and clearly
/// phone-born when browsing the Mac later.
fn new_phone_workspace_dir() -> std::path::PathBuf {
    let secret = crate::opencode_proxy::new_secret();
    workspaces_root().join(format!("phone-{}", &secret[..6]))
}

/// The phone's workspace management, which opencode's API cannot provide
/// (there is no "create folder" endpoint): list the folders under the managed
/// workspaces root and mint fresh ones. Same Basic password as the opencode
/// server, bound alongside it, torn down with it.
fn companion_router(password: String) -> axum::Router {
    use axum::http::StatusCode;
    use axum::response::IntoResponse;

    /// Constant shape either way; the phone treats non-200 as "unpaired".
    fn authed(headers: &axum::http::HeaderMap, password: &str) -> bool {
        use base64::Engine as _;
        let expect = format!(
            "Basic {}",
            base64::engine::general_purpose::STANDARD.encode(format!("opencode:{password}"))
        );
        headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .map(|v| ct_eq(v.as_bytes(), expect.as_bytes()))
            .unwrap_or(false)
    }

    let list_pw = password.clone();
    let list = axum::routing::get(move |headers: axum::http::HeaderMap| {
        let password = list_pw.clone();
        async move {
            if !authed(&headers, &password) {
                return (StatusCode::UNAUTHORIZED, "unauthorized").into_response();
            }
            let root = workspaces_root();
            axum::Json(serde_json::json!({
                "root": root.to_string_lossy(),
                "workspaces": listed_workspaces(&root),
            }))
            .into_response()
        }
    });

    let mint_pw = password;
    let mint = axum::routing::post(move |headers: axum::http::HeaderMap| {
        let password = mint_pw.clone();
        async move {
            if !authed(&headers, &password) {
                return (StatusCode::UNAUTHORIZED, "unauthorized").into_response();
            }
            let dir = new_phone_workspace_dir();
            match crate::opencode_acp::ensure_workspace(&dir) {
                Ok(()) => axum::Json(serde_json::json!({
                    "path": dir.to_string_lossy(),
                    "name": dir.file_name().map(|n| n.to_string_lossy().to_string()),
                }))
                .into_response(),
                Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e).into_response(),
            }
        }
    });

    axum::Router::new().route("/workspaces", list.merge(mint))
}

/// Where the served child's pid persists, so a NEXT enable (or app start) can
/// reap a server orphaned by a force-killed app. Orphans are actively harmful:
/// opencode instances coordinate through a machine-global port, and a stale
/// server with a dead password poisons auth for the live one.
fn serve_pid_file() -> std::path::PathBuf {
    crate::opencode_acp::iblai_data_dir().join("remote_code_serve.pid")
}

/// Durable host settings: the pairing password and port live here so a
/// desktop restart does NOT brick every paired phone. (The old behavior —
/// fresh password per enable — meant each restart silently invalidated the
/// phones until someone thought to re-scan the QR.) `enabled` remembers the
/// user's choice so the frontend can bring the server back up on launch.
#[derive(serde::Serialize, serde::Deserialize, Default, Clone)]
struct PersistedHost {
    password: Option<String>,
    port: Option<u16>,
    #[serde(default)]
    enabled: bool,
}

fn persisted_host_file() -> std::path::PathBuf {
    crate::opencode_acp::iblai_data_dir().join("remote_code_host.json")
}

fn read_persisted() -> PersistedHost {
    std::fs::read_to_string(persisted_host_file())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_persisted(p: &PersistedHost) {
    let _ = std::fs::create_dir_all(crate::opencode_acp::iblai_data_dir());
    if let Ok(s) = serde_json::to_string_pretty(p) {
        let path = persisted_host_file();
        let _ = std::fs::write(&path, s);
        // The file holds the pairing password: owner-only on a multi-user
        // machine.
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
        }
    }
}

/// Kill a previously recorded serve child if it is still an opencode process.
/// (Pid reuse guard: never kill a pid whose command doesn't look like ours.)
/// Kill an opencode process squatting `port` (checked by command name, so an
/// unrelated program on the port is never touched). Zombies there predate the
/// pid file, so the recorded-pid reaper can't see them.
/// Constant-time byte comparison for the companion's password check: an
/// early-exit `==` leaks the matching prefix length through timing on a
/// listener that allows unlimited attempts. (Length is not hidden — it is
/// fixed by the password format anyway.)
fn ct_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

/// Whether a process command line is one of OUR `opencode serve` children
/// (the exact argv shape `remote_code_enable` spawns). Anything else on the
/// port — a developer's own `opencode serve` / TUI on 4096 — must be left
/// alone: the reaper used to kill any listener whose argv merely contained
/// "opencode".
fn is_our_serve(cmdline: &str, port: u16) -> bool {
    cmdline.contains("opencode")
        && cmdline.contains("serve")
        && cmdline.contains("--hostname 0.0.0.0")
        && cmdline.contains(&format!("--port {port}"))
}

/// Whether the recorded serve pid still runs one of our serves, on any port
/// (the pid file doesn't keep it), so a reused pid is never killed. On Linux
/// that pid is the bwrap wrapping the serve; on macOS sandbox-exec has become
/// the serve itself.
fn is_recorded_serve(cmdline: &str) -> bool {
    cmdline.contains("opencode") && cmdline.contains(" serve --hostname 0.0.0.0 --port ")
}

fn reap_port_squatter(port: u16) {
    // -n -P: no host/service name resolution — without them lsof routinely
    // takes seconds on macOS.
    let Ok(out) = Command::new("lsof")
        .args(["-nP", "-ti", &format!("tcp:{port}"), "-sTCP:LISTEN"])
        .output()
    else {
        return;
    };
    for pid in String::from_utf8_lossy(&out.stdout).split_whitespace() {
        let ours = Command::new("ps")
            .args(["-p", pid, "-o", "command="])
            .output()
            .ok()
            .map(|o| is_our_serve(&String::from_utf8_lossy(&o.stdout), port))
            .unwrap_or(false);
        if ours {
            println!("[RemoteCode] reaping zombie opencode serve (pid {pid}) on port {port}");
            let _ = Command::new("kill").arg(pid).output();
        }
    }
}

fn reap_stale_serve() {
    let Ok(text) = std::fs::read_to_string(serve_pid_file()) else {
        return;
    };
    let Ok(pid) = text.trim().parse::<i32>() else {
        return;
    };
    // -ww: on Linux the recorded child is bwrap, whose sandbox argv runs long
    // before the `opencode serve` it wraps.
    let looks_like_ours = Command::new("ps")
        .args(["-ww", "-p", &pid.to_string(), "-o", "command="])
        .output()
        .ok()
        .map(|o| is_recorded_serve(&String::from_utf8_lossy(&o.stdout)))
        .unwrap_or(false);
    if looks_like_ours {
        let _ = Command::new("kill").arg(pid.to_string()).output();
    }
    let _ = std::fs::remove_file(serve_pid_file());
}

/// Kill the served child + companion synchronously. Called from the app's
/// exit handler — the one shot we get to not leave an orphan behind.
pub fn shutdown_sync() {
    let mut host = HOST.lock().expect("remote code lock");
    if let Some(h) = host.take() {
        // Process exit: the proxy (and its registrations) die with us, so
        // the returned secret needs no async unregister here.
        let _secret = h.teardown();
    }
}

/// The tenant's provisioned model ids (e.g. "openai/gpt-4o",
/// "iblai/iblai-fast") from the compat models endpoint. Empty on any failure —
/// the config keeps its default model, and the phone's no-model fallback
/// still works.
async fn fetch_tenant_models(api_base: &str, tenant: &str, token: &str) -> Vec<String> {
    let Ok(client) = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
    else {
        return Vec::new();
    };
    // The platform serves the compat models list from more than one host
    // (frontend uses the DM base; the proxy upstream uses asgi.data) — try
    // both, loudly, because a silent miss here strands phones on unknown
    // models.
    let domain = crate::opencode_proxy::platform_base_domain().await;
    let bases = [
        api_base.trim_end_matches('/').to_string(),
        format!("https://base.manager.{domain}"),
        format!("https://api.{domain}/dm"),
    ];
    for base in bases {
        let url = format!("{base}/api/ai-mentor/orgs/{tenant}/v1/models");
        match client
            .get(&url)
            .header("Authorization", format!("Token {token}"))
            .send()
            .await
        {
            Ok(resp) => {
                let status = resp.status();
                if !status.is_success() {
                    println!("[RemoteCode] models fetch {url} -> {status}");
                    continue;
                }
                let Ok(body) = resp.json::<serde_json::Value>().await else {
                    println!("[RemoteCode] models fetch {url} -> unparseable body");
                    continue;
                };
                let ids: Vec<String> = body
                    .get("data")
                    .and_then(|d| d.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|m| m.get("id").and_then(|i| i.as_str()))
                            .map(String::from)
                            .collect()
                    })
                    .unwrap_or_default();
                if !ids.is_empty() {
                    return ids;
                }
                println!("[RemoteCode] models fetch {url} -> empty list");
            }
            Err(e) => println!("[RemoteCode] models fetch {url} failed: {e}"),
        }
    }
    Vec::new()
}

/// Merge model ids into the served config's iblai provider `models` map
/// (after `apply_opencode_model` reset it to just the default).
fn register_models_in_config(models: &[String]) -> Result<(), String> {
    register_models_in(&crate::opencode_acp::config_home(SERVE_CONFIG_KEY), models)
}

fn register_models_in(config_home: &std::path::Path, models: &[String]) -> Result<(), String> {
    let rel = std::path::Path::new("opencode").join("opencode.json");
    let text = crate::opencode_acp::read_config_file(config_home, &rel)
        .map_err(|e| e.to_string())?
        .ok_or("the phone's Code settings file is missing")?;
    let mut cfg: serde_json::Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    let entry = cfg
        .pointer_mut("/provider/iblai/models")
        .and_then(|m| m.as_object_mut())
        .ok_or("config has no iblai models map")?;
    for id in models {
        entry.insert(id.clone(), serde_json::json!({ "name": id }));
    }
    let out = serde_json::to_string_pretty(&cfg).map_err(|e| e.to_string())?;
    crate::opencode_acp::write_config_file(config_home, &rel, out.as_bytes())
        .map_err(|e| e.to_string())
}

/// The platform API base for this desktop: the caller's explicit value, else
/// the default derived from the signed-in platform domain.
async fn resolve_api_base(api_base: Option<String>) -> String {
    match api_base.filter(|b| !b.trim().is_empty()) {
        Some(b) => b,
        None => crate::opencode_acp::default_api_base(
            &crate::opencode_proxy::platform_base_domain().await,
        ),
    }
}

/// The tenant-scoped OpenAI-compatible upstream the loopback proxy forwards to.
fn upstream_for(api_base: &str, tenant: &str) -> String {
    format!(
        "{}/api/ai-mentor/orgs/{}/v1",
        api_base.trim_end_matches('/'),
        tenant
    )
}

/// Start (or return the already-running) opencode server for remote Code.
///
/// `tenant` + `token` come from the signed-in desktop UI; they provision the
/// loopback model proxy exactly the way an ACP Code session does, so the
/// served sessions use ibl.ai models under the caller's platform credentials —
/// the phone never needs (or sees) any model credential beyond the pairing
/// password.
#[command]
pub async fn remote_code_enable(
    app: tauri::AppHandle,
    tenant: String,
    token: String,
    api_base: Option<String>,
) -> Result<RemoteCodeStatus, String> {
    let _serialized = ENABLE_LOCK.lock().await;
    if let Some(why) = crate::opencode_acp::code_unavailable() {
        return Err(why.to_string());
    }
    {
        let running = {
            let mut host = HOST.lock().expect("remote code lock");
            let st = status_locked(&mut host);
            if st.running {
                host.as_ref().map(|h| {
                    (
                        h.proxy_secret.clone(),
                        h.tenant.clone(),
                        h.api_base.clone(),
                        h.guidance.clone(),
                        st,
                    )
                })
            } else {
                None
            }
        };
        if let Some((secret, host_tenant, host_api_base, host_guidance, st)) = running {
            // Already running: re-register the proxy upstream + token. The
            // token expires (a stale one makes every phone turn spin in
            // silent model retries), and the upstream embeds the TENANT — a
            // desktop tenant switch used to leave phone turns sending the
            // new tenant's token to the old tenant's org URL (401 forever).
            if tenant.trim().is_empty() || token.trim().is_empty() {
                if !token.trim().is_empty() {
                    crate::opencode_proxy::set_token(&secret, &token).await;
                }
                return Ok(st);
            }
            let api_base = resolve_api_base(api_base.clone()).await;
            if host_tenant == tenant && host_api_base == api_base {
                let upstream = upstream_for(&api_base, &tenant);
                crate::opencode_proxy::register(&secret, upstream, token.clone()).await;
                // Same platform, possibly a different signed-in user: the
                // identity lines live in AGENTS.md, which the served process
                // re-reads on every model call — rewrite that file alone.
                // (opencode.json is NOT touched: a running serve never
                // re-reads it, verified against the pinned binary.)
                let guidance = crate::opencode_proxy::guidance_with_identity(&tenant).await;
                if guidance != host_guidance {
                    crate::opencode_acp::write_iblai_guidance(
                        &crate::opencode_acp::config_home(SERVE_CONFIG_KEY),
                        Some(guidance.as_str()),
                    )?;
                    if let Some(h) = HOST.lock().expect("remote code lock").as_mut() {
                        h.guidance = guidance;
                    }
                }
                return Ok(st);
            }
            // A different platform/tenant: the served config only registers
            // the PREVIOUS catalog, so restart on the same port + password
            // (both persisted) — paired phones never notice.
            println!(
                "[RemoteCode] platform changed ({host_tenant}@{host_api_base} -> \
                 {tenant}@{api_base}); restarting phone Code"
            );
            let secret = {
                let mut host = HOST.lock().expect("remote code lock");
                host.take().map(Host::teardown)
            };
            if let Some(secret) = secret {
                crate::opencode_proxy::unregister(&secret).await;
            }
        }
    }
    // A serve child orphaned by a force-killed app poisons opencode's
    // machine-global coordination — reap it before starting fresh. Zombies
    // squatting the preferred ports also push the new server onto random
    // ports while phones stay paired to the corpse. The port a previous
    // enable actually bound (persisted; not necessarily the preferred one)
    // gets the same treatment, or an orphan there pushes THIS enable onto
    // yet another port and every phone's stored address goes stale.
    // lsof/ps/kill are blocking process spawns — keep them off the async
    // runtime's worker threads (this also runs at every launch via
    // auto_enable).
    let persisted_port = read_persisted().port;
    let _ = tokio::task::spawn_blocking(move || {
        reap_stale_serve();
        let mut ports = vec![PREFERRED_PORT];
        if let Some(p) = persisted_port.filter(|p| *p != PREFERRED_PORT) {
            ports.push(p);
        }
        for p in ports {
            reap_port_squatter(p);
            if let Some(companion) = p.checked_add(1) {
                reap_port_squatter(companion);
            }
        }
    })
    .await;

    // Model provider: the loopback proxy holds the real token; the served
    // process gets only a throwaway secret (same arrangement as ACP spawns).
    if tenant.trim().is_empty() || token.trim().is_empty() {
        return Err("sign in on this desktop before enabling phone access".to_string());
    }
    let api_base = resolve_api_base(api_base).await;
    let upstream = upstream_for(&api_base, &tenant);
    let proxy_port = crate::opencode_proxy::ensure_started().await?;
    crate::opencode_proxy::set_app(&app);
    let proxy_secret = crate::opencode_proxy::new_secret();
    crate::opencode_proxy::register(&proxy_secret, upstream, token.clone()).await;
    // From here to the host store, EVERY early return must unregister the
    // secret — it holds the user's platform token in the loopback proxy,
    // and each failed enable retry used to stack another live secret. The
    // guard fires on any exit path; it is defused once the secret's
    // lifetime is owned by the stored Host (disable/shutdown unregister it).
    let mut secret_guard = ProxySecretGuard::armed(&proxy_secret);
    // The ibl.ai guidance travels as the per-session AGENTS.md (written by
    // apply_opencode_model below), the same delivery every desktop spawn
    // uses — the retired proxy body-injection path must not come back.
    let guidance = crate::opencode_proxy::guidance_with_identity(&tenant).await;

    // Config home for the served process: iblai provider through the proxy,
    // permission policy pinned to "ask" (the phone answers the prompts), the
    // result-only build prompt, and the synced skills — all via the same
    // config writer ACP spawns use.
    // Started over on every fresh start: the last serve could write this
    // folder, and the app writes into it unsandboxed. (remove_dir_all removes
    // a link, never its target.)
    let _ = std::fs::remove_dir_all(crate::opencode_acp::config_home(SERVE_CONFIG_KEY));
    let spec = serve_model_spec();
    crate::opencode_acp::apply_opencode_model(
        SERVE_CONFIG_KEY,
        None,
        &spec,
        &format!("http://127.0.0.1:{proxy_port}/v1"),
        &proxy_secret,
        "ibl.ai",
        Some(guidance.as_str()),
    )?;
    // opencode only accepts models its config REGISTERS (unknown ids die as a
    // silent async ProviderModelNotFoundError — no event, no message). The
    // desktop ACP flow rewrites its config per spawn with the one chosen
    // model; the served process is long-lived and phones ask for whatever
    // their mentor uses, so register the tenant's ENTIRE catalog up front.
    let models = fetch_tenant_models(&api_base, &tenant, &token).await;
    if !models.is_empty() {
        register_models_in_config(&models)?;
        println!(
            "[RemoteCode] registered {} tenant models for phone Code",
            models.len()
        );
    }

    let workspace = phone_workspace();
    crate::opencode_acp::ensure_workspace(&workspace)?;

    // Re-check after the async provisioning above: a concurrent enable may
    // have won the race. (Checked outside the lock-holding block below so no
    // await ever runs under the mutex.)
    let already = {
        let mut host = HOST.lock().expect("remote code lock");
        let st = status_locked(&mut host);
        st.running.then_some(st)
    };
    if let Some(st) = already {
        // secret_guard unregisters on return.
        return Ok(st);
    }

    let port = {
        let mut host = HOST.lock().expect("remote code lock");
        let mut persisted = read_persisted();
        // Same port and password as last time whenever possible: paired
        // phones keep working across restarts with zero ceremony.
        let port = match persisted.port {
            Some(p) if TcpListener::bind(("0.0.0.0", p)).is_ok() => p,
            _ => free_port()?,
        };
        let password = persisted
            .password
            .clone()
            .unwrap_or_else(crate::opencode_proxy::new_secret);
        persisted.password = Some(password.clone());
        persisted.port = Some(port);
        // `enabled` is written only once the server answers (see below).
        write_persisted(&persisted);
        // Before the companion starts: an early return after it would leave
        // it serving on port+1 with the pairing password.
        let mut serve = phone_serve_command(port, &password)?;
        // Companion right next door (port+1 when free) so a manually-typed
        // pairing can find it; the QR carries the exact port either way.
        let companion_listener = companion_listener_for(port)
            .map_err(|e| format!("no port for workspace management: {e}"))?;
        companion_listener
            .set_nonblocking(true)
            .map_err(|e| e.to_string())?;
        let companion_port = companion_listener
            .local_addr()
            .map_err(|e| e.to_string())?
            .port();
        let companion_router = companion_router(password.clone());
        let companion = tauri::async_runtime::spawn(async move {
            let Ok(listener) = tokio::net::TcpListener::from_std(companion_listener) else {
                return;
            };
            if let Err(e) = axum::serve(listener, companion_router).await {
                crate::telemetry::report("[RemoteCode] companion exited", e);
            }
        });
        let child = serve.spawn().map_err(|e| {
            companion.abort();
            format!("could not start opencode serve: {e}")
        })?;
        let _ = std::fs::write(serve_pid_file(), child.id().to_string());
        host.replace(Host {
            child,
            port,
            password,
            proxy_secret: proxy_secret.clone(),
            tenant: tenant.clone(),
            api_base: api_base.clone(),
            guidance: guidance.clone(),
            companion_port,
            companion,
        });
        port
    }; // lock released before the await below
       // The Host now owns the secret's lifetime — but hold the guard armed
       // until the serve actually answers: the failure branch below tears the
       // Host down again and must still unregister.

    if !wait_until_serving(port, 15).await {
        {
            let mut host = HOST.lock().expect("remote code lock");
            if let Some(h) = host.take() {
                let _secret = h.teardown(); // secret_guard unregisters on return
            }
        }
        return Err("opencode serve did not come up (is opencode installed?)".to_string());
    }

    // Only a CONFIRMED-serving host is remembered as enabled: recording it
    // before the spawn made a machine with no runnable opencode retry the
    // whole 15 s enable dance on every launch via auto_enable, forever.
    {
        let mut persisted = read_persisted();
        persisted.enabled = true;
        write_persisted(&persisted);
    }
    secret_guard.defuse();
    Ok(status_locked(&mut HOST.lock().expect("remote code lock")))
}

/// Unregisters a loopback-proxy secret when dropped, unless defused. The
/// enable flow registers the secret early (the served process needs it in
/// its config) and has many fallible steps before the Host takes ownership;
/// this guarantees no early return leaves a token-bearing secret live.
struct ProxySecretGuard {
    secret: String,
    armed: bool,
}

impl ProxySecretGuard {
    fn armed(secret: &str) -> Self {
        Self {
            secret: secret.to_string(),
            armed: true,
        }
    }

    fn defuse(&mut self) {
        self.armed = false;
    }
}

impl Drop for ProxySecretGuard {
    fn drop(&mut self) {
        if self.armed {
            let secret = std::mem::take(&mut self.secret);
            tauri::async_runtime::spawn(async move {
                crate::opencode_proxy::unregister(&secret).await;
            });
        }
    }
}

/// The QR the phone scans to pair: an SVG encoding every candidate address
/// plus the password, so the phone can try the addresses in order without the
/// user typing anything.
///
/// Payload format (also parsed by the phone UI): `iblcode1:` + JSON
/// `{"urls":[...],"password":"..."}`.
#[command]
pub async fn remote_code_pairing_qr() -> Result<String, String> {
    let st = status_locked(&mut HOST.lock().expect("remote code lock"));
    if !st.running {
        return Err("phone access is not enabled".to_string());
    }
    let payload = format!(
        "iblcode1:{}",
        serde_json::json!({
            "urls": st.urls,
            "password": st.password,
            "mgmt": st.mgmt_urls,
        })
    );
    let code = qrcode::QrCode::new(payload.as_bytes()).map_err(|e| e.to_string())?;
    Ok(code
        .render::<qrcode::render::svg::Color>()
        .min_dimensions(220, 220)
        .quiet_zone(true)
        .build())
}

/// Stop the remote Code server and drop its proxy credentials.
#[command]
pub async fn remote_code_disable() -> Result<(), String> {
    let mut persisted = read_persisted();
    persisted.enabled = false;
    // Disabling is the user cutting phones off, so it is also the revoke
    // path: drop the password and the next enable mints a fresh one (the
    // QR must be re-scanned). Restarts of an ENABLED host still reuse it.
    persisted.password = None;
    write_persisted(&persisted);
    let secret = {
        let mut host = HOST.lock().expect("remote code lock");
        host.take().map(Host::teardown)
    };
    if let Some(secret) = secret {
        crate::opencode_proxy::unregister(&secret).await;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    #[test]
    fn the_companion_falls_through_when_the_serve_port_has_no_neighbour() {
        // 65535 + 1 used to overflow the u16 (panic in debug, port 0 in
        // release, i.e. a random port instead of the neighbour).
        let listener = super::companion_listener_for(65535).expect("some port binds");
        assert_ne!(listener.local_addr().unwrap().port(), 0);
    }

    #[tokio::test]
    async fn an_armed_secret_guard_unregisters_on_drop() {
        // The bug this pins (PR review finding): every `?` between proxy
        // registration and the Host store returned without unregistering,
        // leaving a token-bearing secret live in the loopback proxy per
        // failed enable attempt.
        let secret = crate::opencode_proxy::new_secret();
        crate::opencode_proxy::register(&secret, "http://up".into(), "tok".into()).await;
        assert!(crate::opencode_proxy::is_registered(&secret).await);

        drop(ProxySecretGuard::armed(&secret));
        // Drop unregisters via a spawned task; give it a beat.
        for _ in 0..50 {
            if !crate::opencode_proxy::is_registered(&secret).await {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(20)).await;
        }
        assert!(!crate::opencode_proxy::is_registered(&secret).await);

        // A DEFUSED guard leaves the registration alone (the success path —
        // the stored Host owns the secret's lifetime from then on).
        let kept = crate::opencode_proxy::new_secret();
        crate::opencode_proxy::register(&kept, "http://up".into(), "tok".into()).await;
        let mut guard = ProxySecretGuard::armed(&kept);
        guard.defuse();
        drop(guard);
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        assert!(crate::opencode_proxy::is_registered(&kept).await);
        crate::opencode_proxy::unregister(&kept).await;
    }

    use super::*;

    /// Both port tests touch PREFERRED_PORT; running them in parallel makes
    /// one test's squatter race the other's bindability probe.
    static PORT_TEST_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn free_port_is_bindable() {
        let _guard = PORT_TEST_LOCK.lock().unwrap();
        let port = free_port().expect("some port is free");
        // Usable, not merely returned: bind proves opencode could too.
        drop(TcpListener::bind(("0.0.0.0", port)).expect("picked port binds"));
    }

    #[test]
    fn free_port_falls_back_when_preferred_is_taken() {
        let _guard = PORT_TEST_LOCK.lock().unwrap();
        let squatter = TcpListener::bind(("0.0.0.0", PREFERRED_PORT));
        // Whether or not the squat succeeded (another process may already hold
        // it), a port must still come back and it must not be double-held.
        let port = free_port().expect("busy preferred port must not stop us");
        if squatter.is_ok() {
            assert_ne!(port, PREFERRED_PORT);
        }
    }

    #[test]
    fn the_port_reaper_only_recognizes_our_own_serve_argv() {
        // A developer's own `opencode serve` (default port 4096) or TUI on
        // the same port must never be killed — only our exact spawn shape.
        assert!(is_our_serve(
            "opencode serve --hostname 0.0.0.0 --port 4096",
            4096
        ));
        assert!(!is_our_serve(
            "opencode serve --hostname 0.0.0.0 --port 4096",
            4097
        ));
        // theirs
        assert!(!is_our_serve("opencode serve --port 4096", 4096));
        // TUI
        assert!(!is_our_serve("opencode --port 4096", 4096));
        assert!(!is_our_serve("node some-opencode-tool", 4096));
    }

    /// The recorded pid is the sandbox wrapper's: on Linux bwrap, whose argv
    /// starts with its own options; on macOS sandbox-exec has become the
    /// serve. A pid since reused by anything else is left alone.
    #[test]
    fn the_recorded_serve_pid_is_killed_only_while_it_runs_our_serve() {
        assert!(is_recorded_serve(
            "bwrap --ro-bind / / --dev-bind /dev /dev --proc /proc --die-with-parent \
             opencode serve --hostname 0.0.0.0 --port 4096"
        ));
        assert!(is_recorded_serve(
            "opencode serve --hostname 0.0.0.0 --port 61239"
        ));
        assert!(is_recorded_serve(
            "/home/u/.local/share/iblai/bin/opencode serve --hostname 0.0.0.0 --port 4096"
        ));
        assert!(!is_recorded_serve("/usr/bin/vim notes.txt"));
        assert!(!is_recorded_serve("opencode serve --port 4096"));
        assert!(!is_recorded_serve("opencode --port 4096"));
        assert!(!is_recorded_serve("node some-opencode-tool"));
        assert!(!is_recorded_serve(""));
    }

    /// The production paths: every phone folder (the default `phone`, and the
    /// `phone-*` ones the companion mints) is inside the sandbox's workspace,
    /// which is the managed root and not the home.
    #[test]
    fn the_phone_serve_is_confined_to_the_workspaces_root() {
        let data = crate::opencode_acp::ScratchDataDir::new("serve-sbx-paths");
        let paths = serve_sandbox_paths();
        let home = crate::opencode_acp::home_dir().expect("a home dir");
        assert_eq!(
            paths.workspace,
            crate::opencode_acp::iblai_data_dir().join("workspaces")
        );
        assert!(paths.workspace.starts_with(&data.path));
        assert!(phone_workspace().starts_with(&paths.workspace));
        assert_ne!(phone_workspace(), paths.workspace);
        assert!(new_phone_workspace_dir().starts_with(&paths.workspace));
        assert!(!home.starts_with(&paths.workspace));
        assert_eq!(paths.home, home);
        assert_eq!(
            paths.config_home,
            crate::opencode_acp::config_home(SERVE_CONFIG_KEY)
        );
    }

    fn fn_body<'a>(src: &'a str, signature: &str) -> &'a str {
        let at = src.find(signature).unwrap_or_else(|| panic!("{signature}"));
        let rest = &src[at..];
        &rest[..rest.find("\n}\n").expect("function end")]
    }

    /// The unit tests above build the serve from scratch paths; this pins
    /// that phone Code really starts it that way, and in the right order.
    #[test]
    fn phone_code_starts_its_serve_only_through_the_sandboxed_command() {
        let src = include_str!("remote_code.rs");
        let prod = &src[..src.find("#[cfg(test)]\nmod tests").expect("tests")];
        assert!(
            !prod.contains(concat!("Command::new(", "opencode_program())")),
            "the serve must never start as a plain `opencode serve`"
        );
        assert_eq!(
            prod.matches("opencode_program()").count(),
            1,
            "opencode is started in one place only"
        );
        assert!(fn_body(prod, "fn serve_command(").contains("opencode_program()"));
        assert!(fn_body(prod, "fn serve_command(").contains("sandbox_wrapper("));
        assert!(fn_body(prod, "fn phone_serve_command(").contains("serve_sandbox_paths()"));

        let enable = fn_body(prod, "pub async fn remote_code_enable(");
        assert!(enable.contains("code_unavailable()"));
        assert_eq!(enable.matches("serve_command(").count(), 1);
        let at = |needle: &str| enable.find(needle).unwrap_or_else(|| panic!("{needle}"));
        assert!(
            at("phone_serve_command(port, &password)?") < at("companion_router(password"),
            "a serve that can't be built must not leave the companion running"
        );
        assert!(enable.contains("companion.abort()"));
        assert!(
            at("remove_dir_all(crate::opencode_acp::config_home(SERVE_CONFIG_KEY))")
                < at("apply_opencode_model("),
            "the last serve's config home is started over before the app writes into it"
        );
    }

    /// A planted link in the root is neither offered to the phone nor
    /// followed: only real folders are listed.
    #[cfg(unix)]
    #[test]
    fn the_companion_lists_only_real_folders() {
        let scratch =
            std::env::temp_dir().join(format!("serve-companion-links-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&scratch);
        let root = scratch.join("workspaces");
        let outside = scratch.join("outside");
        std::fs::create_dir_all(root.join("phone")).unwrap();
        std::fs::create_dir_all(&outside).unwrap();
        std::os::unix::fs::symlink(&outside, root.join("phone-link")).unwrap();
        std::fs::write(root.join("notes.txt"), "x").unwrap();

        let names: Vec<String> = listed_workspaces(&root)
            .iter()
            .filter_map(|w| w["name"].as_str().map(str::to_string))
            .collect();
        let _ = std::fs::remove_dir_all(&scratch);
        assert_eq!(names, ["phone"]);
    }

    /// The served process can write its config home; the app's model list
    /// write must not follow a link it left there.
    #[cfg(unix)]
    #[test]
    fn registering_models_never_follows_a_planted_link() {
        let scratch =
            std::env::temp_dir().join(format!("serve-models-link-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&scratch);
        let config_home = scratch.join("config");
        std::fs::create_dir_all(config_home.join("opencode")).unwrap();
        let outside = scratch.join("outside.json");
        let original = r#"{"provider":{"iblai":{"models":{}}}}"#;
        std::fs::write(&outside, original).unwrap();
        std::os::unix::fs::symlink(&outside, config_home.join("opencode/opencode.json")).unwrap();

        let result = register_models_in(&config_home, &["openai/gpt-4o".to_string()]);
        let after = std::fs::read_to_string(&outside).unwrap();
        let _ = std::fs::remove_dir_all(&scratch);
        assert!(result.is_err(), "a linked config is not the app's file");
        assert_eq!(after, original, "the link's target must be untouched");
    }

    /// A home, config home and workspaces root for the serve's sandbox, kept
    /// outside every folder the sandbox may write (the temp roots are among
    /// them, so a scratch tree there could never show a write being refused).
    /// The home holds a fake `.ssh/id_rsa` for the secret rules to hide, and a
    /// `.cargo`, which the sandbox may write except for its credentials.
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    struct ServeSandboxScratch {
        root: std::path::PathBuf,
        paths: SandboxPaths,
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    impl ServeSandboxScratch {
        fn new(tag: &str) -> Self {
            let root = crate::opencode_acp::outside_the_sandbox(tag);
            let paths = SandboxPaths {
                home: root.join("home"),
                workspace: root.join("workspaces"),
                config_home: root.join("config"),
            };
            for dir in [
                paths.home.join(".ssh"),
                paths.home.join(".cargo"),
                paths.config_home.clone(),
                paths.workspace.join("phone"),
            ] {
                std::fs::create_dir_all(dir).unwrap();
            }
            std::fs::write(paths.home.join(".ssh").join("id_rsa"), "not-a-real-key").unwrap();
            Self { root, paths }
        }
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    impl Drop for ServeSandboxScratch {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.root);
        }
    }

    /// The composed serve command split at the confined program: everything
    /// before `opencode` is the sandbox wrapper (empty when unwrapped).
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    fn split_serve_argv(cmd: &Command) -> (Vec<String>, Vec<String>) {
        let mut argv: Vec<String> = std::iter::once(cmd.get_program())
            .chain(cmd.get_args())
            .map(|a| a.to_string_lossy().into_owned())
            .collect();
        let at = argv
            .iter()
            .position(|a| *a == opencode_program())
            .expect("opencode in the serve argv");
        let program = argv.split_off(at);
        (argv, program)
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    fn serve_env(cmd: &Command, key: &str) -> Option<std::path::PathBuf> {
        cmd.get_envs()
            .find(|(k, _)| *k == key)
            .and_then(|(_, v)| v.map(std::path::PathBuf::from))
    }

    /// The phone's serve used to start as a plain `opencode serve`, outside
    /// the sandbox desktop Code runs in, so with Automatic approvals a phone
    /// turn could change anything in the Mac account.
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    #[test]
    fn the_phone_serve_runs_inside_the_code_sandbox() {
        // augmented_path() reads the data dir, which other tests repoint.
        let _data_dir = crate::opencode_acp::data_dir_lock();
        let s = ServeSandboxScratch::new("argv");
        let p = &s.paths;
        const SENTINEL: &str = "ANTHROPIC_SBX_SERVE_TEST";
        std::env::set_var(SENTINEL, "x");
        let cmd = serve_command(p, 4321, "pw");
        std::env::remove_var(SENTINEL);
        let cmd = cmd.unwrap();
        // Checked before this test's own `sandbox_wrapper` call below, which
        // would build the decoy itself.
        #[cfg(target_os = "macos")]
        {
            let decoy = p.config_home.join("code-mode-home");
            assert_eq!(serve_env(&cmd, "HOME"), Some(decoy.clone()));
            let ssh = decoy.join(".ssh");
            assert!(
                ssh.is_dir() && !ssh.is_symlink(),
                "serve_command builds the decoy home"
            );
            assert!(std::fs::read_dir(&ssh).unwrap().next().is_none());
        }
        let (wrapper, program) = split_serve_argv(&cmd);
        assert_eq!(
            program,
            [
                "opencode",
                "serve",
                "--hostname",
                "0.0.0.0",
                "--port",
                "4321"
            ]
        );
        assert_eq!(
            serve_env(&cmd, "XDG_CONFIG_HOME"),
            Some(p.config_home.clone())
        );
        assert_eq!(
            serve_env(&cmd, "OPENCODE_SERVER_PASSWORD"),
            Some("pw".into())
        );
        assert_eq!(serve_env(&cmd, "PATH"), Some(augmented_path().into()));
        assert!(
            cmd.get_envs()
                .any(|(k, v)| k == std::ffi::OsStr::new(SENTINEL) && v.is_none()),
            "provider keys and npm_config_* are stripped, as for desktop Code"
        );
        assert!(
            !wrapper.is_empty(),
            "the serve must start inside the sandbox, not as a plain `opencode serve`"
        );
        let shared =
            crate::opencode_acp::sandbox_wrapper(p, crate::opencode_acp::Backend::Opencode)
                .unwrap();
        assert_eq!(
            wrapper,
            std::iter::once(shared.program.to_string())
                .chain(shared.args)
                .collect::<Vec<_>>(),
            "the desktop's one sandbox policy, for opencode"
        );
        for (key, value) in shared.env {
            assert_eq!(serve_env(&cmd, key), Some(value));
        }
        // opencode exits with EPERM at startup when it can't create this.
        let state = p.home.join(".local/state/opencode");

        #[cfg(target_os = "macos")]
        {
            assert_eq!(wrapper[..2], ["/usr/bin/sandbox-exec", "-p"]);
            let profile = &wrapper[2];
            let subpath = |p: &std::path::Path| format!("(subpath \"{}\")", p.display());
            let (allowed, denied) = profile
                .split_once("(deny file*")
                .expect("the profile denies the secrets");
            assert!(allowed.contains(&subpath(&p.workspace)), "{profile}");
            assert!(allowed.contains(&subpath(&p.config_home)), "{profile}");
            assert!(allowed.contains(&subpath(&state)), "{profile}");
            assert!(
                !profile.contains(&subpath(&p.home)),
                "the home at large must stay read-only: {profile}"
            );
            for secret in [".ssh", ".claude", ".codex", "Library/Keychains"] {
                assert!(
                    denied.contains(&subpath(&p.home.join(secret))),
                    "{secret}: {profile}"
                );
            }
        }
        #[cfg(target_os = "linux")]
        {
            assert_eq!(wrapper[0], "bwrap");
            let bound = |p: &std::path::Path| {
                let p = p.to_string_lossy();
                wrapper
                    .windows(3)
                    .any(|w| w[0] == "--bind-try" && w[1] == p && w[2] == p)
            };
            assert!(bound(&p.workspace), "{wrapper:?}");
            assert!(bound(&p.config_home), "{wrapper:?}");
            assert!(bound(&state), "{wrapper:?}");
            assert!(!bound(&p.home), "the home at large must stay read-only");
            let ssh = p.home.join(".ssh").to_string_lossy().into_owned();
            assert!(
                wrapper.windows(2).any(|w| w[0] == "--tmpfs" && w[1] == ssh),
                "{wrapper:?}"
            );
            assert!(wrapper.contains(&"--die-with-parent".to_string()));
        }
    }

    /// Runs `script` in a shell started exactly the way the serve is: its
    /// sandbox wrapper argv and env. Returns stdout and stderr.
    #[cfg(target_os = "macos")]
    fn run_like_the_serve(cmd: &Command, script: &str) -> (String, String) {
        let (wrapper, _) = split_serve_argv(cmd);
        let (program, args) = wrapper.split_first().expect("a sandbox wrapper");
        let mut sh = Command::new(program);
        sh.args(args).args(["/bin/sh", "-c", script]);
        for (key, value) in cmd.get_envs() {
            match value {
                Some(v) => sh.env(key, v),
                None => sh.env_remove(key),
            };
        }
        let out = sh.output().expect("run a shell the way the serve runs");
        let stderr = String::from_utf8_lossy(&out.stderr).into_owned();
        assert!(
            !stderr.contains("sandbox_apply"),
            "sandbox-exec could not start here (a test runner that is itself \
             sandboxed can't nest one), so this proves nothing: {stderr}"
        );
        (String::from_utf8_lossy(&out.stdout).into_owned(), stderr)
    }

    /// The same wrapper, really applied: a shell started exactly the way the
    /// serve is (wrapper argv + env) can write in the workspaces and nowhere
    /// else in the home, and can neither read nor plant a secret.
    #[cfg(target_os = "macos")]
    #[test]
    fn the_phone_serve_can_change_files_only_in_its_workspaces() {
        let s = ServeSandboxScratch::new("run");
        let p = &s.paths;
        let cmd = serve_command(p, 4321, "pw").unwrap();

        let inside = p.workspace.join("phone").join("inside.txt");
        let outside = s.root.join("outside.txt");
        let home_probe = p.home.join("outside.txt");
        let secret = p.home.join(".ssh").join("id_rsa");
        let cargo_ok = p.home.join(".cargo").join("ok");
        let cargo_token = p.home.join(".cargo").join("credentials.toml");
        let script = format!(
            "echo x > '{}'; echo x > '{}'; echo x > '{}'; echo x > '{}'; echo x > '{}'; \
             cat '{}' && echo SECRET-READ",
            inside.display(),
            outside.display(),
            home_probe.display(),
            cargo_ok.display(),
            cargo_token.display(),
            secret.display(),
        );
        let (stdout, stderr) = run_like_the_serve(&cmd, &script);

        assert!(inside.is_file(), "a workspace write must land: {stderr}");
        assert!(
            !outside.exists(),
            "a folder outside the sandbox stays read-only"
        );
        assert!(!home_probe.exists(), "the home must be read-only");
        assert!(
            cargo_ok.is_file(),
            "an allowed toolchain folder is writable"
        );
        assert!(
            !cargo_token.exists(),
            "a secret inside an allowed folder must still refuse writes"
        );
        assert!(
            !stdout.contains("not-a-real-key") && !stdout.contains("SECRET-READ"),
            "a secret must be unreadable: {stdout}"
        );
    }

    /// The serve may change anything inside the workspaces root and its
    /// config home, never those folders themselves. A turn that removed the
    /// root and left a link in its place would have the unsandboxed app
    /// create chat folders and `git init` wherever the link points.
    #[cfg(target_os = "macos")]
    #[test]
    fn the_phone_serve_cannot_remove_or_replace_its_own_folders() {
        let s = ServeSandboxScratch::new("keep");
        let p = &s.paths;
        let cmd = serve_command(p, 4321, "pw").unwrap();
        let root = p.workspace.display().to_string();
        let config = p.config_home.display().to_string();
        let elsewhere = s.root.join("elsewhere");
        std::fs::create_dir_all(&elsewhere).unwrap();
        let elsewhere = elsewhere.display().to_string();
        let script = format!(
            "R='{root}'; C='{config}'; T='{elsewhere}'
             mkdir \"$R/new-chat\" && echo CHILD-MADE
             echo x > \"$R/new-chat/f.txt\" && echo x > \"$R/phone/f.txt\" && echo CHAT-WRITTEN
             rm -r \"$R/new-chat\" && echo CHILD-REMOVED
             mkdir \"$C/opencode\" && echo CONFIG-CHILD-MADE
             mkdir \"$R/spare\" \"$C/spare\"
             for D in \"$R\" \"$C\"; do
               mv \"$D\" \"$C/spare/moved\" && echo \"GONE-MOVED $D\"
               rm -rf \"$D\"
               rmdir \"$D\" && echo \"GONE-REMOVED $D\"
               perl -e 'symlink($ARGV[0], $ARGV[1]) and print \"GONE-LINKED $ARGV[1]\\n\"' \"$T\" \"$D\"
             done
             swap() {{
               mkdir \"$1\"
               perl -e 'rename($ARGV[0], $ARGV[1]) and print \"GONE-REPLACED $ARGV[1]\\n\"' \"$1\" \"$2\"
               rmdir \"$1\"
             }}
             swap \"$C/spare\" \"$R\"
             swap \"$R/spare\" \"$C\"
             true"
        );
        let (stdout, stderr) = run_like_the_serve(&cmd, &script);

        for done in [
            "CHILD-MADE",
            "CHAT-WRITTEN",
            "CHILD-REMOVED",
            "CONFIG-CHILD-MADE",
        ] {
            assert!(stdout.contains(done), "{done}: {stdout}\n{stderr}");
        }
        assert!(!stdout.contains("GONE-"), "{stdout}\n{stderr}");
        for kept in [&p.workspace, &p.config_home] {
            let meta = std::fs::symlink_metadata(kept).unwrap();
            assert!(meta.is_dir(), "{} is still a real folder", kept.display());
        }
    }

    /// A root the user linked elsewhere (say, to another drive) is kept and
    /// followed by the app, so the sandbox must refuse removing or re-pointing
    /// the link itself: its rule names the path as given, never the target.
    #[cfg(target_os = "macos")]
    #[test]
    fn the_phone_serve_cannot_repoint_a_root_the_user_linked() {
        let s = ServeSandboxScratch::new("linked");
        let p = &s.paths;
        let drive = s.root.join("drive");
        std::fs::rename(&p.workspace, &drive).unwrap();
        std::os::unix::fs::symlink(&drive, &p.workspace).unwrap();
        let elsewhere = s.root.join("elsewhere");
        std::fs::create_dir_all(&elsewhere).unwrap();
        let cmd = serve_command(p, 4321, "pw").unwrap();
        let script = format!(
            "rm '{r}' && echo GONE-REMOVED
             ln -sfn '{e}' '{r}' && echo GONE-REPOINTED
             mv '{r}' '{c}/moved' && echo GONE-MOVED
             true",
            r = p.workspace.display(),
            e = elsewhere.display(),
            c = p.config_home.display(),
        );
        let (stdout, stderr) = run_like_the_serve(&cmd, &script);

        assert!(!stdout.contains("GONE-"), "{stdout}\n{stderr}");
        assert_eq!(std::fs::read_link(&p.workspace).unwrap(), drive);
    }

    /// Live: the REAL pinned opencode started exactly as the phone's serve,
    /// on a free port, driven through its own HTTP API (`/session/:id/shell`
    /// needs no model). Needs the managed binary (`cargo test pinned_binary`
    /// fetches it). Run: `cargo test sandboxed_phone_serve -- --ignored --nocapture`.
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    #[tokio::test(flavor = "multi_thread")]
    #[ignore]
    async fn the_sandboxed_phone_serve_answers_and_is_confined() {
        assert!(
            crate::opencode_acp::opencode_bin().is_file(),
            "managed opencode missing at {} — run `cargo test pinned_binary` first",
            crate::opencode_acp::opencode_bin().display()
        );
        let s = ServeSandboxScratch::new("live");
        let p = &s.paths;
        // `/shell` resolves a model before it runs anything (never calls it).
        std::fs::create_dir_all(p.config_home.join("opencode")).unwrap();
        std::fs::write(
            p.config_home.join("opencode").join("opencode.json"),
            serde_json::json!({
                "model": "iblai/stub",
                "provider": { "iblai": {
                    "npm": "@ai-sdk/openai-compatible",
                    "options": { "baseURL": "http://127.0.0.1:9/v1", "apiKey": "unused" },
                    "models": { "stub": { "name": "stub" } }
                } }
            })
            .to_string(),
        )
        .unwrap();
        let chat = p.workspace.join("phone");
        crate::opencode_acp::ensure_workspace(&chat).unwrap();
        let port = TcpListener::bind("127.0.0.1:0")
            .unwrap()
            .local_addr()
            .unwrap()
            .port();
        let mut child = serve_command(p, port, "pw")
            .unwrap()
            .current_dir(&chat)
            .stderr(Stdio::piped())
            .spawn()
            .expect("spawn the sandboxed serve");

        let base = format!("http://127.0.0.1:{port}");
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(180))
            .build()
            .unwrap();
        let mut health = None;
        for _ in 0..240 {
            if let Ok(r) = client
                .get(format!("{base}/global/health"))
                .basic_auth("opencode", Some("pw"))
                .send()
                .await
            {
                health = Some(r.text().await.unwrap_or_default());
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(250)).await;
        }
        let ps = Command::new("ps")
            .args(["-p", &child.id().to_string(), "-o", "command="])
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_default();
        println!("[live] health: {health:?}");
        println!("[live] serve child pid {} command: {ps}", child.id());
        let Some(_) = health else {
            let _ = child.kill();
            let out = child.wait_with_output().unwrap();
            panic!(
                "the sandboxed serve never answered: {}",
                String::from_utf8_lossy(&out.stderr)
            );
        };
        assert!(
            is_our_serve(&ps, port) && is_recorded_serve(&ps),
            "the reapers must still recognise the serve: {ps}"
        );

        let dir = urlencoding::encode(&chat.to_string_lossy()).into_owned();
        let session: serde_json::Value = client
            .post(format!("{base}/session?directory={dir}"))
            .basic_auth("opencode", Some("pw"))
            .json(&serde_json::json!({}))
            .send()
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
        let id = session["id"].as_str().expect("session id").to_string();

        let outside = s.root.join("outside.txt");
        let home_probe = p.home.join("outside.txt");
        let secret = p.home.join(".ssh").join("id_rsa");
        let command = format!(
            "echo x > inside.txt && echo INSIDE-OK; \
             git add inside.txt && git -c user.name=t -c user.email=t@t commit -qm t && echo GIT-OK; \
             echo x > '{}' || echo OUTSIDE-REFUSED; \
             echo x > '{}' || echo HOME-REFUSED; \
             cat '{}' || echo SECRET-REFUSED; \
             mv '{root}' '{config}/moved-root' && echo ROOT-MOVED",
            outside.display(),
            home_probe.display(),
            secret.display(),
            root = p.workspace.display(),
            config = p.config_home.display(),
        );
        let shell = client
            .post(format!("{base}/session/{id}/shell?directory={dir}"))
            .basic_auth("opencode", Some("pw"))
            .json(&serde_json::json!({ "agent": "build", "command": command }))
            .send()
            .await
            .unwrap()
            .text()
            .await
            .unwrap();
        let shell: serde_json::Value =
            serde_json::from_str(&shell).unwrap_or_else(|e| panic!("shell answered {shell}: {e}"));
        let output = shell["parts"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|p| p["state"]["output"].as_str())
            .collect::<Vec<_>>()
            .join("\n");
        println!("[live] shell output:\n{output}");

        let _ = child.kill();
        let _ = child.wait();
        let down = TcpListener::bind(("0.0.0.0", port)).is_ok();
        println!("[live] port {port} free after kill: {down}");

        assert!(chat.join("inside.txt").is_file(), "{output}");
        assert!(output.contains("GIT-OK"), "{output}");
        assert!(!outside.exists(), "{output}");
        assert!(!home_probe.exists(), "{output}");
        assert!(output.contains("SECRET-REFUSED"), "{output}");
        assert!(!output.contains("ROOT-MOVED"), "{output}");
        assert!(std::fs::symlink_metadata(&p.workspace).is_ok_and(|m| m.is_dir()));
        assert!(!output.contains("not-a-real-key"), "{output}");
        assert!(down, "killing the child must take the server down");
    }

    #[test]
    fn companion_password_compare_is_constant_time_shaped() {
        assert!(ct_eq(b"abc", b"abc"));
        assert!(!ct_eq(b"abc", b"abd"));
        assert!(!ct_eq(b"abc", b"ab"));
        assert!(ct_eq(b"", b""));
    }

    #[test]
    fn lan_ips_are_non_loopback() {
        // Offline machines may legitimately return nothing; what's forbidden
        // is advertising 127.0.0.1 to a phone.
        for ip in lan_ips() {
            assert!(!ip.is_loopback());
        }
    }

    /// The companion API is the phone's only folder channel: auth must gate
    /// both routes, and mint must hand back a real, git-initialized folder
    /// that list then shows.
    #[tokio::test(flavor = "multi_thread")]
    async fn companion_lists_and_mints_workspaces_behind_auth() {
        // Both handlers resolve `iblai_data_dir()`, which reads the process-global
        // `XDG_DATA_HOME`: hold the lock the acp settings tests repoint it under, or
        // mint and list can land in different roots (`data_dir_lock` documents the
        // race). Held across the awaits on purpose, like the installer tests.
        let _data_dir = crate::opencode_acp::data_dir_lock();
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let router = companion_router("pw-test".into());
        tokio::spawn(async move { axum::serve(listener, router).await.unwrap() });

        let base = format!("http://{addr}/workspaces");
        let client = reqwest::Client::new();

        // No/wrong password → 401 on both verbs.
        assert_eq!(client.get(&base).send().await.unwrap().status(), 401);
        assert_eq!(
            client
                .post(&base)
                .basic_auth("opencode", Some("wrong"))
                .send()
                .await
                .unwrap()
                .status(),
            401
        );

        // Mint, then see it in the list.
        let minted: serde_json::Value = client
            .post(&base)
            .basic_auth("opencode", Some("pw-test"))
            .send()
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
        let path = minted["path"].as_str().expect("minted path");
        assert!(std::path::Path::new(path).is_dir());

        let listed: serde_json::Value = client
            .get(&base)
            .basic_auth("opencode", Some("pw-test"))
            .send()
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
        let names: Vec<&str> = listed["workspaces"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|w| w["path"].as_str())
            .collect();
        // Clean up before asserting: a red run must not leave a `phone-*` folder in
        // the user's real workspaces root.
        let _ = std::fs::remove_dir_all(path);
        assert!(names.contains(&path), "minted folder must be listed");
    }

    #[test]
    fn status_reports_stopped_with_no_host() {
        let mut host = None;
        let st = status_locked(&mut host);
        assert!(!st.running);
        assert!(st.port.is_none());
        assert!(st.password.is_none());
        assert!(st.urls.is_empty());
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn status_reaps_a_dead_child() {
        // A child that exits (here: `true`, immediately) must flip the status
        // back to stopped instead of advertising a dead server to the phone.
        let child = Command::new(if cfg!(windows) { "cmd" } else { "true" })
            .args(if cfg!(windows) {
                &["/C", "exit"][..]
            } else {
                &[][..]
            })
            .stdout(Stdio::null())
            .spawn()
            .expect("spawn trivial child");
        let mut host = Some(Host {
            child,
            port: 4242,
            password: "pw".into(),
            proxy_secret: "sec".into(),
            tenant: "acme".into(),
            api_base: "https://acme.example".into(),
            guidance: String::new(),
            companion_port: 4243,
            // A future that never completes on its own — only status_locked's
            // abort() can finish it, so the is_finished assertion below
            // actually proves the abort ran (an `async {}` completed
            // immediately and made the assertion vacuous).
            companion: tauri::async_runtime::spawn(std::future::pending::<()>()),
        });
        // Give the trivial process a moment to exit.
        std::thread::sleep(std::time::Duration::from_millis(200));
        let companion = host.as_ref().unwrap().companion.inner().abort_handle();
        // Registered secret must be torn down with the dead host (PR review
        // finding: this branch skipped every teardown shutdown_sync does).
        crate::opencode_proxy::register("sec", "http://up".into(), "tok".into()).await;
        let st = status_locked(&mut host);
        assert!(!st.running);
        assert!(host.is_none());
        // Companion aborted, not left squatting port+1. Abort is processed
        // by the runtime, so poll briefly rather than asserting instantly —
        // with a never-completing future only the abort can finish it.
        for _ in 0..50 {
            if companion.is_finished() {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(20)).await;
        }
        assert!(companion.is_finished());
        // …and the token-bearing secret unregistered (async, give it a beat).
        for _ in 0..50 {
            if !crate::opencode_proxy::is_registered("sec").await {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(20)).await;
        }
        assert!(!crate::opencode_proxy::is_registered("sec").await);
    }
}
