//! Managed runtime + ACP adapters for the subscription agents Code mode runs
//! next to opencode: Codex (`@agentclientprotocol/codex-acp`) and Claude Code
//! (`@agentclientprotocol/claude-agent-acp`). Both adapters are Node programs
//! that spawn the vendor's native binary shipped inside their own npm
//! packages, so this module does what Zed does for the same two packages:
//! download a pinned Node into the app data dir, npm-install the pinned
//! adapter versions into it, and run everything by absolute path. Nothing
//! here touches the user's own Node, npm, `~/.codex` or `~/.claude`; sign-in
//! state is read through the adapters' CLI passthroughs (`cli login status`,
//! `--cli auth status --json`).
//!
//! Mirrors `cua_driver_installer.rs` for the download half (the archive is
//! verified against the release's `SHASUMS256.txt`, downloads have explicit
//! timeouts) and `opencode_installer.rs` for extraction and status reporting.

#![cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]

use std::collections::{HashMap, VecDeque};
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::OnceLock;
use std::time::Duration;

use serde_json::{json, Value};
use tauri::{command, AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::Mutex;

use crate::cua_driver_installer::{expected_sha256, sha256_hex};
use crate::opencode_acp::{augmented_path, iblai_data_dir, strip_agent_env, Backend};

/// Pinned Node release (an LTS line; the adapters need `node >= 22`). Bump
/// together with the adapter pins and re-run the `code_agent_pins` tests.
/// Override at runtime with `IBL_NODE_VERSION`.
const NODE_VERSION: &str = "v24.21.0";
/// Pinned adapter versions — exactly what `npm install <pkg>@<version>` gets.
/// Override with `IBL_CODEX_ACP_VERSION` / `IBL_CLAUDE_AGENT_ACP_VERSION`.
const CODEX_ACP_VERSION: &str = "2.0.0";
const CLAUDE_AGENT_ACP_VERSION: &str = "0.83.0";

/// Give up rather than hang forever on a stalled connection.
const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(300);
/// npm pulls a ~300 MB native agent per adapter.
const NPM_INSTALL_TIMEOUT: Duration = Duration::from_secs(1800);
/// A browser login the user may take their time over.
const SIGN_IN_TIMEOUT: Duration = Duration::from_secs(600);
/// One `--version` or sign-in-status probe.
const PROBE_TIMEOUT: Duration = Duration::from_secs(20);

/// Whether Claude Code can be signed in from the app the way Codex is
/// (`--cli auth login --claudeai` driven with piped stdio). Spiked once during
/// implementation: with no TTY the CLI does start — it prints the sign-in URL
/// and "Paste code here if prompted >" — but it uses the pasted-code OAuth
/// variant (`redirect_uri=…/oauth/code/callback`, `code=true`), so completing
/// it needs the authorization code written to its stdin. That paste-back UI is
/// not built, so the popover shows the terminal hint instead. Flip this once
/// a `code_agent_sign_in_code` command feeds the code to the running login.
const CLAUDE_IN_APP_LOGIN: bool = false;

fn node_pin() -> String {
    std::env::var("IBL_NODE_VERSION").unwrap_or_else(|_| NODE_VERSION.to_string())
}

fn adapter_pin(backend: Backend) -> String {
    match backend {
        Backend::Codex => {
            std::env::var("IBL_CODEX_ACP_VERSION").unwrap_or_else(|_| CODEX_ACP_VERSION.to_string())
        }
        Backend::Claude => std::env::var("IBL_CLAUDE_AGENT_ACP_VERSION")
            .unwrap_or_else(|_| CLAUDE_AGENT_ACP_VERSION.to_string()),
        Backend::Opencode => String::new(),
    }
}

fn adapter_package(backend: Backend) -> &'static str {
    match backend {
        Backend::Codex => "@agentclientprotocol/codex-acp",
        Backend::Claude => "@agentclientprotocol/claude-agent-acp",
        Backend::Opencode => "",
    }
}

pub(crate) fn display_name(backend: Backend) -> &'static str {
    match backend {
        Backend::Codex => "Codex",
        Backend::Claude => "Claude Code",
        Backend::Opencode => "opencode",
    }
}

/// Where the subscription agents can run at all: Windows has no Code, and the
/// Mac App Store sandbox can't spawn them.
fn supported() -> bool {
    cfg!(unix) && !crate::opencode_installer::is_sandboxed()
}

/// What the popover shows for an agent beyond the file checks: an install in
/// flight (launch-time or from its Install button), or why the last one
/// failed. Process-wide, like the install lock it mirrors.
#[derive(Clone, Default, PartialEq, Debug)]
enum Phase {
    #[default]
    Idle,
    Installing,
    Failed(String),
}

fn phases() -> &'static std::sync::Mutex<HashMap<&'static str, Phase>> {
    static PHASES: OnceLock<std::sync::Mutex<HashMap<&'static str, Phase>>> = OnceLock::new();
    PHASES.get_or_init(|| std::sync::Mutex::new(HashMap::new()))
}

fn phase(backend: Backend) -> Phase {
    phases()
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .get(backend.id())
        .cloned()
        .unwrap_or_default()
}

fn set_phase(backend: Backend, phase: Phase) {
    phases()
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .insert(backend.id(), phase);
}

/// (os, arch) as nodejs.org names its release assets.
fn node_platform() -> Result<(&'static str, &'static str), String> {
    let os = match std::env::consts::OS {
        "macos" => "darwin",
        "linux" => "linux",
        "windows" => "win",
        other => return Err(format!("unsupported OS: {other}")),
    };
    let arch = match std::env::consts::ARCH {
        "x86_64" => "x64",
        "aarch64" => "arm64",
        other => return Err(format!("unsupported arch: {other}")),
    };
    Ok((os, arch))
}

/// The folder inside the tarball, e.g. `node-v24.21.0-linux-x64`.
fn node_folder(version: &str) -> Result<String, String> {
    let (os, arch) = node_platform()?;
    Ok(format!("node-{version}-{os}-{arch}"))
}

/// The release asset for this platform, e.g. `node-v24.21.0-linux-x64.tar.gz`.
fn node_asset(version: &str) -> Result<String, String> {
    let ext = if cfg!(target_os = "windows") {
        "zip"
    } else {
        "tar.gz"
    };
    Ok(format!("{}.{ext}", node_folder(version)?))
}

/// `~/.local/share/iblai/node` — one extracted release lives inside it.
fn node_root() -> PathBuf {
    iblai_data_dir().join("node")
}

fn node_dir() -> PathBuf {
    node_root().join(node_folder(&node_pin()).unwrap_or_default())
}

/// The managed Node binary, by absolute path — never resolved off PATH.
pub(crate) fn node_bin() -> PathBuf {
    if cfg!(target_os = "windows") {
        node_dir().join("node.exe")
    } else {
        node_dir().join("bin").join("node")
    }
}

/// npm's CLI entry inside the managed Node, run as `node <npm-cli.js>` (the
/// `bin/npm` shim would need `node` on PATH).
fn npm_cli() -> PathBuf {
    if cfg!(target_os = "windows") {
        node_dir().join("node_modules/npm/bin/npm-cli.js")
    } else {
        node_dir().join("lib/node_modules/npm/bin/npm-cli.js")
    }
}

/// `~/.local/share/iblai/acp/<agent>` — the adapter's own npm prefix.
fn agent_dir(backend: Backend) -> PathBuf {
    iblai_data_dir().join("acp").join(backend.id())
}

/// The adapter's ACP entry point (`dist/index.js` of the installed package).
pub(crate) fn adapter_entry(backend: Backend) -> PathBuf {
    agent_dir(backend)
        .join("node_modules")
        .join(adapter_package(backend))
        .join("dist")
        .join("index.js")
}

/// Written only after the installed adapter passed its `--version` smoke
/// test, so a half-finished install never reads as installed.
fn marker(backend: Backend) -> PathBuf {
    agent_dir(backend).join(".installed-version")
}

/// `PATH` for anything that runs the managed Node: its `bin` dir first, so
/// `#!/usr/bin/env node` scripts inside the packages resolve to OUR node,
/// then the usual augmented PATH for the agent's own shell commands.
pub(crate) fn agent_path() -> OsString {
    let mut dirs: Vec<PathBuf> = Vec::new();
    if let Some(bin) = node_bin().parent() {
        dirs.push(bin.to_path_buf());
    }
    dirs.extend(std::env::split_paths(&augmented_path()));
    std::env::join_paths(dirs).unwrap_or_else(|_| augmented_path())
}

/// A tokio Command with a hidden console window on Windows.
fn create_command(program: &Path) -> Command {
    let cmd = Command::new(program);
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let mut cmd = cmd;
        cmd.creation_flags(CREATE_NO_WINDOW);
        return cmd;
    }
    #[allow(unreachable_code)]
    cmd
}

/// Last whitespace-separated token of a `--version` output: codex-acp prints
/// `@agentclientprotocol/codex-acp 2.0.0`, claude-agent-acp a bare `0.83.0`,
/// node `v24.21.0`.
fn last_token(out: &str) -> Option<String> {
    out.split_whitespace().last().map(|s| s.to_string())
}

/// Argv after `node` for one npm call: Zed's isolation flags (own cache, blank
/// user/global npmrc), so the user's npm config never leaks into the managed
/// install, then the subcommand's own args.
fn npm_args(prefix: Option<&Path>, subcommand: &str, args: &[&str]) -> Vec<String> {
    let dir = node_dir();
    let mut argv = vec![npm_cli().to_string_lossy().into_owned()];
    if let Some(p) = prefix {
        argv.push("--prefix".to_string());
        argv.push(p.to_string_lossy().into_owned());
    }
    argv.push(subcommand.to_string());
    argv.push(format!("--cache={}", dir.join("cache").display()));
    argv.push("--userconfig".to_string());
    argv.push(dir.join("blank_user_npmrc").to_string_lossy().into_owned());
    argv.push("--globalconfig".to_string());
    argv.push(
        dir.join("blank_global_npmrc")
            .to_string_lossy()
            .into_owned(),
    );
    argv.extend(args.iter().map(|a| a.to_string()));
    argv
}

/// The exact npm argv that installs one adapter: the pinned `<pkg>@<version>`,
/// no lockfile, exact save, no audit/fund chatter, and short fetch retries so
/// a dead registry fails instead of hanging.
fn install_args(backend: Backend) -> Vec<String> {
    let spec = format!("{}@{}", adapter_package(backend), adapter_pin(backend));
    npm_args(
        Some(&agent_dir(backend)),
        "install",
        &[
            &spec,
            "--no-package-lock",
            "--save-exact",
            "--omit=dev",
            "--no-audit",
            "--no-fund",
            "--fetch-retry-mintimeout",
            "2000",
            "--fetch-retry-maxtimeout",
            "5000",
            "--fetch-timeout",
            "30000",
        ],
    )
}

/// Run `cmd` with piped stdio; `Some((success, stdout, stderr))`, or `None`
/// when it could not be spawned or outlived `limit`.
async fn probe(mut cmd: Command, limit: Duration) -> Option<(bool, String, String)> {
    cmd.stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    let child = cmd.spawn().ok()?;
    let out = tokio::time::timeout(limit, child.wait_with_output())
        .await
        .ok()?
        .ok()?;
    Some((
        out.status.success(),
        String::from_utf8_lossy(&out.stdout).into_owned(),
        String::from_utf8_lossy(&out.stderr).into_owned(),
    ))
}

/// Run `cmd`, streaming every stdout/stderr line to `log`; the last lines
/// ride the error so a failed install says why. A stall past `limit` kills
/// the child.
async fn run_logged(
    mut cmd: Command,
    limit: Duration,
    log: &(dyn Fn(&str) + Send + Sync),
) -> Result<(), String> {
    cmd.stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    let mut child = cmd.spawn().map_err(|e| format!("spawn failed: {e}"))?;
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<String>();
    if let Some(out) = child.stdout.take() {
        let tx = tx.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(out).lines();
            while let Ok(Some(l)) = lines.next_line().await {
                let _ = tx.send(l);
            }
        });
    }
    if let Some(err) = child.stderr.take() {
        let tx = tx.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(err).lines();
            while let Ok(Some(l)) = lines.next_line().await {
                let _ = tx.send(l);
            }
        });
    }
    drop(tx);
    let mut tail: VecDeque<String> = VecDeque::new();
    let deadline = tokio::time::Instant::now() + limit;
    loop {
        tokio::select! {
            line = rx.recv() => match line {
                Some(l) => {
                    log(&l);
                    tail.push_back(l);
                    if tail.len() > 20 {
                        tail.pop_front();
                    }
                }
                None => break,
            },
            _ = tokio::time::sleep_until(deadline) => {
                let _ = child.start_kill();
                return Err(format!("timed out after {}s", limit.as_secs()));
            }
        }
    }
    let status = tokio::time::timeout(Duration::from_secs(30), child.wait())
        .await
        .map_err(|_| "process did not exit".to_string())?
        .map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!(
            "exit {:?}: {}",
            status.code(),
            tail.iter().cloned().collect::<Vec<_>>().join("\n")
        ))
    }
}

/// Is this agent installed at the current pins? Pure file checks — the install
/// validated the binaries, and a spawn must not pay for a probe. `Err` carries
/// the sentence the UI or a spawn shows.
fn installed(backend: Backend) -> Result<(), String> {
    let name = display_name(backend);
    let not_installed = || format!("{name} isn't installed — install it from the Code menu.");
    if !node_bin().is_file() {
        return Err(not_installed());
    }
    let recorded = std::fs::read_to_string(marker(backend))
        .ok()
        .map(|s| s.trim().to_string());
    let pin = adapter_pin(backend);
    match recorded {
        None => Err(not_installed()),
        Some(v) if v != pin => Err(format!(
            "{name} needs an update ({v} → {pin}) — install it again from the Code menu."
        )),
        Some(_) if !adapter_entry(backend).is_file() => Err(format!(
            "{name} is missing files — install it again from the Code menu."
        )),
        Some(_) => Ok(()),
    }
}

/// May a spawn (or the status) treat the agent as ready: not while an install
/// is in flight — a turn must fail with "still installing", not with a
/// half-written adapter — then the file checks.
pub(crate) fn agent_ready(backend: Backend) -> Result<(), String> {
    if phase(backend) == Phase::Installing {
        return Err(format!(
            "{} is still installing — it will be ready in the Code menu in a few minutes.",
            display_name(backend)
        ));
    }
    installed(backend)
}

/// Download, verify and unpack the pinned Node, unless the managed copy
/// already reports the pin. Zed's recipe: the copy is trusted only after
/// `node <npm-cli.js> --version` succeeds with the isolation flags.
async fn ensure_node(log: &(dyn Fn(&str) + Send + Sync)) -> Result<(), String> {
    let pin = node_pin();
    if node_bin().is_file() {
        let mut version = create_command(&node_bin());
        version.arg("--version");
        if let Some((true, out, _)) = probe(version, PROBE_TIMEOUT).await {
            if last_token(&out).as_deref() == Some(pin.as_str()) {
                return Ok(());
            }
        }
        log("the managed Node failed its check — downloading it again");
    }
    let asset = node_asset(&pin)?;
    let base = format!("https://nodejs.org/dist/{pin}");
    let client = reqwest::Client::builder()
        .timeout(DOWNLOAD_TIMEOUT)
        .build()
        .map_err(|e| e.to_string())?;
    log(&format!("downloading Node {pin} ({asset})…"));
    let sums = client
        .get(format!("{base}/SHASUMS256.txt"))
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| format!("Node checksums download failed: {e}"))?
        .text()
        .await
        .map_err(|e| e.to_string())?;
    let expected = expected_sha256(&sums, &asset)
        .ok_or_else(|| format!("no checksum for {asset} in SHASUMS256.txt"))?;
    let bytes = client
        .get(format!("{base}/{asset}"))
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| format!("Node download failed: {e}"))?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;
    let actual = sha256_hex(&bytes);
    if actual != expected {
        return Err(format!(
            "Node download checksum mismatch for {asset}: expected {expected}, got {actual}"
        ));
    }
    log("checksum verified — extracting Node…");
    let root = node_root();
    let _ = std::fs::remove_dir_all(&root);
    std::fs::create_dir_all(&root).map_err(|e| format!("node dir failed: {e}"))?;
    let archive = root.join(&asset);
    std::fs::write(&archive, &bytes).map_err(|e| format!("node archive write failed: {e}"))?;
    let (a, r) = (archive.clone(), root.clone());
    tokio::task::spawn_blocking(move || crate::opencode_installer::extract(&a, &r))
        .await
        .map_err(|e| e.to_string())??;
    let _ = std::fs::remove_file(&archive);
    let dir = node_dir();
    if !node_bin().is_file() {
        return Err(format!(
            "the Node archive did not contain {}",
            node_bin().display()
        ));
    }
    // A downloaded binary carries no quarantine flag when fetched by us, but
    // clear it like the other installers do. No ad-hoc re-sign: the binary
    // ships with the OpenJS Foundation's signature.
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("xattr")
            .args(["-dr", "com.apple.quarantine"])
            .arg(&dir)
            .output();
    }
    std::fs::create_dir_all(dir.join("cache")).map_err(|e| e.to_string())?;
    std::fs::write(dir.join("blank_user_npmrc"), []).map_err(|e| e.to_string())?;
    std::fs::write(dir.join("blank_global_npmrc"), []).map_err(|e| e.to_string())?;
    let mut check = create_command(&node_bin());
    check.args(npm_args(None, "--version", &[]));
    match probe(check, PROBE_TIMEOUT).await {
        Some((true, out, _)) => log(&format!("Node {pin} ready (npm {})", out.trim())),
        other => return Err(format!("the managed npm failed its check: {other:?}")),
    }
    Ok(())
}

/// `npm install` the pinned adapter into its own prefix, then prove the
/// installed entry reports the pin before writing the marker.
async fn install_adapter(
    backend: Backend,
    log: &(dyn Fn(&str) + Send + Sync),
) -> Result<String, String> {
    let pin = adapter_pin(backend);
    let pkg = adapter_package(backend);
    let dir = agent_dir(backend);
    let _ = std::fs::remove_file(marker(backend));
    std::fs::create_dir_all(&dir).map_err(|e| format!("agent dir failed: {e}"))?;
    log(&format!("installing {pkg}@{pin} with npm…"));
    let mut cmd = create_command(&node_bin());
    cmd.args(install_args(backend)).current_dir(&dir);
    strip_agent_env(&mut cmd);
    cmd.env("PATH", agent_path());
    run_logged(cmd, NPM_INSTALL_TIMEOUT, log)
        .await
        .map_err(|e| format!("npm install of {pkg}@{pin} failed: {e}"))?;
    let mut smoke = create_command(&node_bin());
    smoke.arg(adapter_entry(backend)).arg("--version");
    strip_agent_env(&mut smoke);
    smoke.env("PATH", agent_path());
    match probe(smoke, PROBE_TIMEOUT).await {
        Some((true, out, _)) if last_token(&out).as_deref() == Some(pin.as_str()) => {}
        other => {
            return Err(format!(
                "{pkg} did not report version {pin} after install: {other:?}"
            ))
        }
    }
    std::fs::write(marker(backend), &pin).map_err(|e| format!("marker write failed: {e}"))?;
    log(&format!("{} {pin} ready", display_name(backend)));
    Ok(pin)
}

/// Install (or repair) one agent: the managed Node, then its adapter. One at a
/// time — two installs would race on the Node download.
pub(crate) async fn install_with(
    backend: Backend,
    log: &(dyn Fn(&str) + Send + Sync),
) -> Result<String, String> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    let _guard = LOCK.get_or_init(|| Mutex::new(())).lock().await;
    // An Install click queued behind the launch-time install finds the work
    // done — one install per pin, never a second download.
    if installed(backend).is_ok() {
        return Ok(adapter_pin(backend));
    }
    ensure_node(log).await?;
    install_adapter(backend, log).await
}

/// Install one agent while the popover watches: the phase it reads through
/// `check_code_agent_status`, progress on `model:installation-log`, and one
/// `code-agent:changed` once the outcome is known (either way), which makes
/// the popover re-read that agent.
async fn install_tracked(app: &AppHandle, backend: Backend) -> Result<String, String> {
    set_phase(backend, Phase::Installing);
    let log = |m: &str| log_line(app, backend, m);
    let result = install_with(backend, &log).await;
    set_phase(
        backend,
        match &result {
            Ok(_) => Phase::Idle,
            Err(e) => Phase::Failed(e.clone()),
        },
    );
    let _ = app.emit("code-agent:changed", json!({ "backend": backend.id() }));
    result
}

/// The agents a launch has to install: not installed, or installed at another
/// pin — so a pin bump reaches every desktop on its next launch.
fn stale_agents() -> Vec<Backend> {
    [Backend::Codex, Backend::Claude]
        .into_iter()
        .filter(|b| installed(*b).is_err())
        .collect()
}

/// Launch-time background install of every stale agent, one after the other
/// (they share the managed Node). Blocks nothing: the popover shows each as
/// loading until its `code-agent:changed` lands, ibl.ai turns run meanwhile,
/// and a failure stays in the phase for the popover's Install to retry (the
/// next launch retries by itself).
pub async fn ensure_agents_current(app: AppHandle) {
    if !supported() {
        return;
    }
    let stale = stale_agents();
    // Both show as loading before the first byte, not one after the other.
    for backend in &stale {
        set_phase(*backend, Phase::Installing);
    }
    for backend in stale {
        if let Err(e) = install_tracked(&app, backend).await {
            log_line(
                &app,
                backend,
                &format!(
                    "{} install failed — Install from the Code menu retries: {e}",
                    display_name(backend)
                ),
            );
        }
    }
}

/// An unsandboxed run of the adapter's CLI passthrough: `cli <args>` for
/// codex-acp (the bundled `codex`), `--cli <args>` for claude-agent-acp (the
/// bundled `claude`). Real HOME, so it sees the user's own login state.
pub(crate) fn agent_cli(backend: Backend, args: &[&str]) -> Command {
    let mut cmd = create_command(&node_bin());
    cmd.arg(adapter_entry(backend));
    match backend {
        Backend::Codex => {
            cmd.arg("cli");
        }
        Backend::Claude => {
            cmd.arg("--cli");
        }
        Backend::Opencode => {}
    }
    cmd.args(args);
    strip_agent_env(&mut cmd);
    cmd.env("PATH", agent_path());
    cmd.kill_on_drop(true);
    cmd
}

/// `claude auth status --json` → (signed in?, account label). The adapter's
/// own rule: a subscription login, an API key, or a non-first-party provider
/// all count as signed in. `None` when the output isn't the status JSON.
fn parse_claude_status(stdout: &str) -> (Option<bool>, Option<String>) {
    // Pretty-printed JSON (the CLI's shape), possibly preceded by log noise:
    // parse from the first `{` to the last `}`.
    let object = match (stdout.find('{'), stdout.rfind('}')) {
        (Some(a), Some(b)) if a < b => &stdout[a..=b],
        _ => return (None, None),
    };
    let Some(v) = serde_json::from_str::<Value>(object)
        .ok()
        .filter(|v| v.is_object())
    else {
        return (None, None);
    };
    let logged_in = v.get("loggedIn").and_then(|b| b.as_bool()).unwrap_or(false);
    let api_key = v
        .get("apiKeySource")
        .and_then(|s| s.as_str())
        .is_some_and(|s| !s.is_empty());
    let external = v
        .get("apiProvider")
        .and_then(|s| s.as_str())
        .is_some_and(|p| !p.is_empty() && p != "firstParty");
    let signed_in = logged_in || api_key || external;
    let account = ["email", "subscriptionType"]
        .iter()
        .find_map(|k| v.get(*k).and_then(|s| s.as_str()))
        .filter(|s| !s.is_empty())
        .map(str::to_string);
    (Some(signed_in), if signed_in { account } else { None })
}

/// (signed in?, account label, reason) for the popover. `None` for signed-in
/// means the probe could not tell.
async fn sign_in_status(backend: Backend) -> (Option<bool>, Option<String>, Option<String>) {
    let name = display_name(backend);
    let unknown = || Some(format!("Couldn't check the {name} sign-in state."));
    match backend {
        Backend::Codex => {
            match probe(agent_cli(backend, &["login", "status"]), PROBE_TIMEOUT).await {
                Some((true, out, err)) => {
                    let label = format!("{err}\n{out}")
                        .lines()
                        .map(str::trim)
                        .find(|l| !l.is_empty())
                        .unwrap_or("Signed in")
                        .to_string();
                    (Some(true), Some(label), None)
                }
                Some((false, _, _)) => {
                    (Some(false), None, Some(backend.sign_in_hint().to_string()))
                }
                None => (None, None, unknown()),
            }
        }
        Backend::Claude => {
            match probe(
                agent_cli(backend, &["auth", "status", "--json"]),
                PROBE_TIMEOUT,
            )
            .await
            {
                Some((_, out, _)) => match parse_claude_status(&out) {
                    (Some(true), account) => (Some(true), account, None),
                    (Some(false), _) => {
                        (Some(false), None, Some(backend.sign_in_hint().to_string()))
                    }
                    (None, _) => (None, None, unknown()),
                },
                None => (None, None, unknown()),
            }
        }
        Backend::Opencode => (None, None, None),
    }
}

fn sign_in_supported(backend: Backend) -> bool {
    match backend {
        Backend::Codex => true,
        Backend::Claude => CLAUDE_IN_APP_LOGIN,
        Backend::Opencode => false,
    }
}

/// One line for the Code popover's install/sign-in progress. Rides the
/// existing `model:installation-log` channel; the frontend filters on `source`.
fn log_line(app: &AppHandle, backend: Backend, message: &str) {
    println!("[code-agent:{}] {message}", backend.id());
    let _ = app.emit(
        "model:installation-log",
        json!({ "message": message, "source": "code-agent", "backend": backend.id() }),
    );
}

/// Readiness of one subscription agent for the UI: install state (pure file
/// checks) and, when installed, the live sign-in state.
#[command]
pub async fn check_code_agent_status(backend: String) -> Result<Value, String> {
    let backend = Backend::agent(&backend)?;
    let supported = supported();
    let phase = phase(backend);
    let readiness = agent_ready(backend);
    let installed = readiness.is_ok();
    let (signed_in, account, sign_reason) = if installed && supported {
        sign_in_status(backend).await
    } else {
        (None, None, None)
    };
    Ok(json!({
        "supported": supported,
        "installed": installed,
        "sign_in_supported": sign_in_supported(backend),
        "node_version": installed.then(node_pin),
        "adapter_version": installed.then(|| adapter_pin(backend)),
        "signed_in": signed_in,
        "account": account,
        "reason": readiness.err().or(sign_reason),
        // An install in flight (the popover refuses the choice meanwhile) and
        // why the last one failed (shown with Install to retry).
        "installing": phase == Phase::Installing,
        "error": match &phase {
            Phase::Failed(e) => Some(e.clone()),
            _ => None,
        },
    }))
}

/// Install (or repair) one agent: the managed Node plus its adapter — the
/// retry after a failed launch-time install. Progress streams on
/// `model:installation-log` with `source: "code-agent"`.
#[command]
pub async fn install_code_agent(app: AppHandle, backend: String) -> Result<String, String> {
    let backend = Backend::agent(&backend)?;
    if !supported() {
        return Err("Code agents aren't available on this computer.".to_string());
    }
    install_tracked(&app, backend).await
}

/// Start the agent's own browser sign-in — Codex through the bundled `codex
/// login`, which opens the browser itself and prints the URL on stderr (the
/// log line reaches the popover if no browser opens). Resolves when the login
/// lands. Claude Code refuses with its terminal hint while in-app login is off.
#[command]
pub async fn code_agent_sign_in(app: AppHandle, backend: String) -> Result<(), String> {
    let backend = Backend::agent(&backend)?;
    agent_ready(backend)?;
    if !sign_in_supported(backend) {
        return Err(backend.sign_in_hint().to_string());
    }
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    let Ok(_guard) = LOCK.get_or_init(|| Mutex::new(())).try_lock() else {
        return Err("A sign-in is already running — finish it in your browser.".to_string());
    };
    let log = move |m: &str| log_line(&app, backend, m);
    let args: &[&str] = match backend {
        Backend::Codex => &["login"],
        Backend::Claude => &["auth", "login", "--claudeai"],
        Backend::Opencode => return Err("opencode has no sign-in".to_string()),
    };
    log(&format!(
        "opening your browser to sign in to {}…",
        display_name(backend)
    ));
    run_logged(agent_cli(backend, args), SIGN_IN_TIMEOUT, &log)
        .await
        .map_err(|e| format!("{} sign-in failed: {e}", display_name(backend)))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The asset name follows nodejs.org's scheme and the checksum lookup
    /// matches the exact asset row, never the `.tar.xz` sibling.
    #[test]
    fn node_assets_match_the_published_shasums() {
        let asset = node_asset("v24.21.0").unwrap();
        assert!(asset.starts_with("node-v24.21.0-"), "{asset}");
        assert!(
            asset.ends_with(".tar.gz") || asset.ends_with(".zip"),
            "{asset}"
        );
        let sums = "\
0be2ab2816a4fa02d1acff014a434f29f56d8d956f5af6a98b70ced6c5f4d201  node-v24.21.0-darwin-arm64.tar.gz
1111111111111111111111111111111111111111111111111111111111111111  node-v24.21.0-darwin-arm64.tar.xz
b3c071cdf47aab867c3b2aa287257df12ec5d7c962bf922b32fd33226c4295fd  node-v24.21.0-linux-x64.tar.gz
";
        assert_eq!(
            expected_sha256(sums, "node-v24.21.0-linux-x64.tar.gz").as_deref(),
            Some("b3c071cdf47aab867c3b2aa287257df12ec5d7c962bf922b32fd33226c4295fd")
        );
        assert_eq!(
            expected_sha256(sums, "node-v24.21.0-darwin-arm64.tar.gz").as_deref(),
            Some("0be2ab2816a4fa02d1acff014a434f29f56d8d956f5af6a98b70ced6c5f4d201")
        );
        assert_eq!(expected_sha256(sums, "node-v24.21.0-win-x64.zip"), None);
    }

    /// npm gets the exact pin (no `^`/`~`), saves it exactly, and runs under
    /// the isolation flags so the user's npm config never leaks in.
    #[test]
    fn adapters_are_pinned_exactly() {
        for pin in [CODEX_ACP_VERSION, CLAUDE_AGENT_ACP_VERSION] {
            assert!(!pin.starts_with('^') && !pin.starts_with('~'), "{pin}");
            assert_eq!(pin.split('.').count(), 3, "{pin}");
        }
        let argv = install_args(Backend::Codex);
        let flat = argv.join(" ");
        assert!(
            flat.contains(&format!(
                "@agentclientprotocol/codex-acp@{CODEX_ACP_VERSION}"
            )),
            "{flat}"
        );
        assert!(
            flat.contains("--save-exact") && flat.contains("--no-package-lock"),
            "{flat}"
        );
        assert!(
            flat.contains("--userconfig") && flat.contains("--globalconfig"),
            "{flat}"
        );
        assert!(flat.contains("--cache="), "{flat}");
        assert!(flat.contains("--prefix"), "{flat}");
        assert!(
            argv[0].ends_with("npm-cli.js"),
            "npm runs as node <npm-cli.js>: {}",
            argv[0]
        );
        assert_eq!(argv.iter().position(|a| a == "install"), Some(3));
        let claude = install_args(Backend::Claude).join(" ");
        assert!(claude.contains(&format!(
            "@agentclientprotocol/claude-agent-acp@{CLAUDE_AGENT_ACP_VERSION}"
        )));
    }

    /// The two adapters print different `--version` shapes.
    #[test]
    fn adapter_version_output_parses_both_shapes() {
        assert_eq!(
            last_token("@agentclientprotocol/codex-acp 2.0.0\n").as_deref(),
            Some("2.0.0")
        );
        assert_eq!(last_token("0.83.0\n").as_deref(), Some("0.83.0"));
        assert_eq!(last_token("v24.21.0\n").as_deref(), Some("v24.21.0"));
        assert_eq!(last_token("  \n"), None);
    }

    /// The adapter's own signed-in rule, applied to `claude auth status --json`.
    #[test]
    fn claude_auth_status_maps_to_signed_in() {
        let (s, a) = parse_claude_status(
            r#"{"loggedIn":true,"email":"me@example.com","subscriptionType":"max"}"#,
        );
        assert_eq!((s, a.as_deref()), (Some(true), Some("me@example.com")));
        let (s, a) = parse_claude_status(r#"{"loggedIn":true,"subscriptionType":"pro"}"#);
        assert_eq!((s, a.as_deref()), (Some(true), Some("pro")));
        let (s, a) = parse_claude_status(r#"{"loggedIn":false}"#);
        assert_eq!((s, a), (Some(false), None));
        let (s, _) =
            parse_claude_status(r#"{"loggedIn":false,"apiKeySource":"ANTHROPIC_API_KEY"}"#);
        assert_eq!(s, Some(true));
        let (s, _) = parse_claude_status(r#"{"loggedIn":false,"apiProvider":"bedrock"}"#);
        assert_eq!(s, Some(true));
        let (s, _) = parse_claude_status(r#"{"loggedIn":false,"apiProvider":"firstParty"}"#);
        assert_eq!(s, Some(false));
        // The CLI pretty-prints; log noise before the JSON is skipped; garbage
        // is "cannot tell".
        let pretty = "{\n  \"loggedIn\": true,\n  \"authMethod\": \"claude.ai\",\n  \"apiProvider\": \"firstParty\",\n  \"email\": \"me@example.com\",\n  \"subscriptionType\": \"max\"\n}\n";
        let (s, a) = parse_claude_status(pretty);
        assert_eq!((s, a.as_deref()), (Some(true), Some("me@example.com")));
        let (s, _) = parse_claude_status("warning: something\n{\"loggedIn\":true}\n");
        assert_eq!(s, Some(true));
        assert_eq!(parse_claude_status("not json at all"), (None, None));
        assert_eq!(parse_claude_status(""), (None, None));
    }

    /// Readiness is a pure file check: no Node → not installed; a marker at a
    /// different pin → update required; a marker without the entry → missing
    /// files; everything present → ready. Uses a scratch data dir.
    #[test]
    #[cfg(unix)]
    fn readiness_distinguishes_missing_stale_and_current() {
        use std::os::unix::fs::PermissionsExt;
        let _lock = crate::opencode_acp::data_dir_lock();
        let scratch = std::env::temp_dir().join(format!("code-agent-ready-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&scratch);
        std::fs::create_dir_all(&scratch).unwrap();
        let prior = std::env::var_os("XDG_DATA_HOME");
        std::env::set_var("XDG_DATA_HOME", &scratch);

        let err = agent_ready(Backend::Codex).unwrap_err();
        assert!(err.contains("isn't installed"), "{err}");
        assert_eq!(stale_agents(), vec![Backend::Codex, Backend::Claude]);

        // A fake managed node that echoes the pin.
        let bin = node_bin();
        std::fs::create_dir_all(bin.parent().unwrap()).unwrap();
        std::fs::write(&bin, format!("#!/bin/sh\necho {}\n", NODE_VERSION)).unwrap();
        std::fs::set_permissions(&bin, std::fs::Permissions::from_mode(0o755)).unwrap();
        let err = agent_ready(Backend::Codex).unwrap_err();
        assert!(err.contains("isn't installed"), "no marker yet: {err}");

        std::fs::create_dir_all(agent_dir(Backend::Codex)).unwrap();
        std::fs::write(marker(Backend::Codex), "1.0.0").unwrap();
        let err = agent_ready(Backend::Codex).unwrap_err();
        assert!(err.contains("needs an update (1.0.0 → 2.0.0)"), "{err}");

        std::fs::write(marker(Backend::Codex), CODEX_ACP_VERSION).unwrap();
        let err = agent_ready(Backend::Codex).unwrap_err();
        assert!(err.contains("missing files"), "{err}");

        let entry = adapter_entry(Backend::Codex);
        std::fs::create_dir_all(entry.parent().unwrap()).unwrap();
        std::fs::write(&entry, "// stub").unwrap();
        assert_eq!(agent_ready(Backend::Codex), Ok(()));
        // Claude is independent of Codex's install — and the only one a
        // launch still has to install.
        assert!(agent_ready(Backend::Claude).is_err());
        assert_eq!(stale_agents(), vec![Backend::Claude]);
        // The status shape reports what readiness says.
        assert!(Backend::agent("gemini").is_err());

        match prior {
            Some(v) => std::env::set_var("XDG_DATA_HOME", v),
            None => std::env::remove_var("XDG_DATA_HOME"),
        }
        let _ = std::fs::remove_dir_all(&scratch);
    }

    /// The popover's view of an install in flight or failed comes from the
    /// phase map, not the files: installing → "still installing" on a spawn
    /// and `installing: true` in the status; failed → the error text with
    /// `installing: false` and the plain not-installed readiness; the other
    /// agent is untouched.
    #[tokio::test]
    #[cfg(unix)]
    async fn an_installing_or_failed_agent_reports_its_phase() {
        let _lock = crate::opencode_acp::data_dir_lock();
        let scratch = std::env::temp_dir().join(format!("code-agent-phase-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&scratch);
        std::fs::create_dir_all(&scratch).unwrap();
        let prior = std::env::var_os("XDG_DATA_HOME");
        std::env::set_var("XDG_DATA_HOME", &scratch);

        set_phase(Backend::Codex, Phase::Installing);
        let err = agent_ready(Backend::Codex).unwrap_err();
        assert!(err.contains("still installing"), "{err}");
        let st = check_code_agent_status("codex".into()).await.unwrap();
        assert_eq!(st["installing"], json!(true));
        assert_eq!(st["installed"], json!(false));
        assert_eq!(st["error"], Value::Null);
        assert!(
            st["reason"].as_str().unwrap().contains("still installing"),
            "{st}"
        );

        set_phase(Backend::Codex, Phase::Failed("npm exploded".into()));
        let st = check_code_agent_status("codex".into()).await.unwrap();
        assert_eq!(st["installing"], json!(false));
        assert_eq!(st["installed"], json!(false));
        assert_eq!(st["error"], json!("npm exploded"));
        let err = agent_ready(Backend::Codex).unwrap_err();
        assert!(err.contains("isn't installed"), "{err}");

        let claude = check_code_agent_status("claude".into()).await.unwrap();
        assert_eq!(claude["installing"], json!(false));
        assert_eq!(claude["error"], Value::Null);

        set_phase(Backend::Codex, Phase::Idle);
        assert_eq!(phase(Backend::Codex), Phase::Idle);
        match prior {
            Some(v) => std::env::set_var("XDG_DATA_HOME", v),
            None => std::env::remove_var("XDG_DATA_HOME"),
        }
        let _ = std::fs::remove_dir_all(&scratch);
    }

    /// The real pins: download the managed Node and both adapters into the
    /// production data dir (skipped when already current), then prove each
    /// adapter loads under our Node and that the sign-in probes answer.
    /// ~700 MB of downloads — run by hand when a pin bumps:
    /// `cargo test code_agent_pins -- --ignored --nocapture`.
    #[tokio::test]
    #[ignore]
    #[cfg(unix)]
    async fn code_agent_pins_install_and_load() {
        let log = |m: &str| println!("[install] {m}");
        for backend in [Backend::Codex, Backend::Claude] {
            if agent_ready(backend).is_err() {
                install_with(backend, &log).await.unwrap();
            }
            assert_eq!(agent_ready(backend), Ok(()));
            assert!(adapter_entry(backend).is_file());
            let (signed_in, account, reason) = sign_in_status(backend).await;
            println!("{backend:?}: signed_in={signed_in:?} account={account:?} reason={reason:?}");
            assert!(
                signed_in.is_some(),
                "the probe must answer, signed in or not"
            );
        }
    }
}
