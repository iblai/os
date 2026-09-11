//! Embedded on-device LLM runtime for platforms with no Ollama (iOS today).
//!
//! Ollama cannot run on iOS — the OS forbids spawning downloaded binaries — so
//! this module serves the same job in-process: a tiny HTTP server speaking the
//! subset of Ollama's API the app already uses (`/api/version`, `/api/tags`,
//! `/api/pull`, `/api/chat`), backed by llama.cpp (Metal) for inference and by
//! plain HTTPS downloads of GGUF weights for pulls.
//!
//! Speaking Ollama's wire format is the whole design: `model_manager.rs`
//! (status, pull progress, install checks) and the SDK's Tauri chat transport
//! work against this server unchanged. The server prefers Ollama's port 11434
//! so even direct-URL callers keep working, but callers in this crate must use
//! [`server_url`], which reflects the actual bound port.
//!
//! The HTTP layer compiles on every platform so its tests run on the host; the
//! inference engine is heavy (it builds llama.cpp), so it compiles only for
//! iOS and behind the opt-in `embedded-llm` feature for on-Mac testing. Where
//! the engine is absent, `/api/chat` answers 501.

use std::io::Write as _;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use axum::body::Body;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use futures_util::StreamExt;
use serde_json::{json, Value};
use tokio::sync::mpsc;

/// One downloadable model: an app-facing Ollama-style id mapped to a single
/// public GGUF file. Quantizations are chosen for phone RAM budgets, which is
/// also why some ids resolve to a smaller variant than Ollama's `:latest`
/// (e.g. `llama3.2` → 1B here, 3B on Ollama): a 3B+ pull that the device can
/// download but never load would be strictly worse than a smaller model that
/// runs.
pub struct CatalogEntry {
    /// Base id (no tag) this entry serves.
    pub id: &'static str,
    /// Tag reported in `/api/tags` (keeps base-name matching working while
    /// being honest about what was installed).
    pub tag: &'static str,
    pub url: &'static str,
    /// Expected size in bytes; the progress `total` until Content-Length is known.
    pub size: u64,
}

/// Models available for on-device download. Ids must cover what the SDK's
/// hard-coded `LOCAL_MODELS` list sends (base names like `llama3.2`); ids not
/// listed here fail the pull with a clear "not available on this device" error
/// rather than a mystery.
static CATALOG: &[CatalogEntry] = &[
    CatalogEntry {
        id: "llama3.2",
        tag: "llama3.2:1b",
        url: "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf",
        size: 807_694_464,
    },
    CatalogEntry {
        id: "llama3.2:1b",
        tag: "llama3.2:1b",
        url: "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf",
        size: 807_694_464,
    },
    CatalogEntry {
        id: "llama3.2:3b",
        tag: "llama3.2:3b",
        url: "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
        size: 2_019_377_696,
    },
    CatalogEntry {
        id: "qwen3",
        tag: "qwen3:1.7b",
        url: "https://huggingface.co/Qwen/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q8_0.gguf",
        size: 1_834_426_016,
    },
    // Sizes below are the EXACT byte counts of the GGUF files on Hugging Face
    // (api/models/<repo>/tree/main), not estimates — the UI shows them and the
    // disk check budgets from them.
    CatalogEntry {
        id: "deepseek-r1",
        tag: "deepseek-r1:1.5b",
        url: "https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf",
        size: 1_117_320_800,
    },
    CatalogEntry {
        id: "phi4-mini",
        tag: "phi4-mini:latest",
        url: "https://huggingface.co/bartowski/microsoft_Phi-4-mini-instruct-GGUF/resolve/main/microsoft_Phi-4-mini-instruct-Q4_K_M.gguf",
        size: 2_491_874_688,
    },
    // Tiny model the Tauri e2e suite pulls; also handy as a smoke-test target.
    CatalogEntry {
        id: "smollm",
        tag: "smollm:135m",
        url: "https://huggingface.co/bartowski/SmolLM2-135M-Instruct-GGUF/resolve/main/SmolLM2-135M-Instruct-Q8_0.gguf",
        size: 144_811_360,
    },
];

/// Resolve an Ollama-style id (tag optional) to a catalog entry. Matching is
/// by base name, mirroring how the SDK decides a model is installed.
pub fn resolve(model: &str) -> Option<&'static CatalogEntry> {
    let model = model.trim();
    // Exact id (with tag) first so llama3.2:3b doesn't collapse onto 1b.
    if let Some(e) = CATALOG.iter().find(|e| e.id == model) {
        return Some(e);
    }
    let base = model.split(':').next().unwrap_or(model);
    CATALOG.iter().find(|e| e.id == base)
}

/// Server state: where models live. The manifest (`manifest.json` in this dir)
/// maps installed tag → GGUF file name, so `/api/tags` never has to guess what
/// a file on disk is.
#[derive(Clone)]
struct AppState {
    models_dir: PathBuf,
}

fn manifest_path(dir: &Path) -> PathBuf {
    dir.join("manifest.json")
}

fn read_manifest(dir: &Path) -> serde_json::Map<String, Value> {
    std::fs::read_to_string(manifest_path(dir))
        .ok()
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .and_then(|v| v.as_object().cloned())
        .unwrap_or_default()
}

fn write_manifest(dir: &Path, m: &serde_json::Map<String, Value>) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    std::fs::write(
        manifest_path(dir),
        serde_json::to_string_pretty(&Value::Object(m.clone())).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}

/// The GGUF path for an installed model id, if present in the manifest.
///
/// A TAGGED request (`llama3.2:3b`) matches only its exact tag: the catalog
/// deliberately maps `llama3.2` and `llama3.2:3b` to different weights, and
/// the old base-name match made a pull of the larger variant short-circuit
/// as "already installed" while chat then served the smaller one. Only an
/// untagged request (`llama3.2` — how the SDK refers to models) may fall
/// back to any installed tag of that base.
pub fn installed_model_path(dir: &Path, model: &str) -> Option<PathBuf> {
    let manifest = read_manifest(dir);
    let untagged = !model.contains(':');
    manifest.iter().find_map(|(tag, v)| {
        let tag_base = tag.split(':').next().unwrap_or(tag);
        if tag == model || (untagged && tag_base == model) {
            let file = v.get("file")?.as_str()?;
            let path = dir.join(file);
            path.exists().then_some(path)
        } else {
            None
        }
    })
}

/// Ollama `GET /api/tags` shape, from the manifest (files that vanished from
/// disk are skipped rather than advertised).
fn tags_json(dir: &Path) -> Value {
    let manifest = read_manifest(dir);
    let models: Vec<Value> = manifest
        .iter()
        .filter_map(|(tag, v)| {
            let file = v.get("file")?.as_str()?;
            let path = dir.join(file);
            let size = std::fs::metadata(&path).ok()?.len();
            Some(json!({
                "name": tag,
                "model": tag,
                "size": size,
                "digest": format!("sha256:{file}"),
                "details": { "format": "gguf" },
            }))
        })
        .collect();
    json!({ "models": models })
}

async fn get_version() -> Json<Value> {
    Json(json!({ "version": "0.1.0-iblai-embedded" }))
}

async fn get_tags(State(state): State<AppState>) -> Json<Value> {
    Json(tags_json(&state.models_dir))
}

/// One NDJSON line, Ollama-style.
fn ndjson(v: Value) -> String {
    let mut s = v.to_string();
    s.push('\n');
    s
}

/// `POST /api/pull` — download the mapped GGUF, streaming Ollama-style
/// progress lines. The `digest` field is required by `pull_model`'s progress
/// accumulator (lines without one are ignored for byte counts).
async fn post_pull(State(state): State<AppState>, Json(body): Json<Value>) -> Response {
    let name = body
        .get("name")
        .or_else(|| body.get("model"))
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();

    let (tx, rx) = mpsc::channel::<String>(16);
    let dir = state.models_dir.clone();
    tokio::spawn(async move {
        // Errors surface as Ollama-style {"error": ...} lines: pull_model
        // forwards them verbatim to the UI, so make them user-readable.
        if let Err(e) = pull_into(&dir, &name, &tx).await {
            let _ = tx.send(ndjson(json!({ "error": e }))).await;
        }
    });

    let stream = tokio_stream::wrappers::ReceiverStream::new(rx)
        .map(|line| Ok::<_, std::convert::Infallible>(line));
    Response::builder()
        .header("content-type", "application/x-ndjson")
        .body(Body::from_stream(stream))
        .unwrap()
}

/// Emit-progress cadence: every `PROGRESS_STEP_BYTES` or on completion.
/// `pull_model` re-emits every line as a Tauri event, so keep this coarse
/// enough not to flood the webview.
const PROGRESS_STEP_BYTES: u64 = 4 * 1024 * 1024;

/// Free space (GB) on the filesystem holding `path`, via statvfs.
#[cfg(unix)]
pub fn available_disk_gb(path: &Path) -> Result<f64, String> {
    use std::os::unix::ffi::OsStrExt;
    // statvfs wants an existing path; walk up until one exists.
    let mut probe = path;
    while !probe.exists() {
        probe = probe.parent().ok_or("no existing parent for disk check")?;
    }
    let c = std::ffi::CString::new(probe.as_os_str().as_bytes()).map_err(|e| e.to_string())?;
    let mut vfs: libc::statvfs = unsafe { std::mem::zeroed() };
    if unsafe { libc::statvfs(c.as_ptr(), &mut vfs) } != 0 {
        return Err(format!(
            "statvfs failed: {}",
            std::io::Error::last_os_error()
        ));
    }
    let avail = vfs.f_bavail as u64 * vfs.f_frsize as u64;
    Ok(avail as f64 / (1024.0 * 1024.0 * 1024.0))
}

#[cfg(not(unix))]
pub fn available_disk_gb(_path: &Path) -> Result<f64, String> {
    Err("disk check unsupported on this platform".to_string())
}

/// Download `model`'s GGUF into `dir`, writing progress lines to `tx`.
///
/// Cancellation needs no flag: the UI cancels by dropping the HTTP response,
/// which closes `tx`'s receiver, which makes the next send fail — the partial
/// file is then removed and the task ends.
async fn pull_into(dir: &Path, model: &str, tx: &mpsc::Sender<String>) -> Result<(), String> {
    let entry = resolve(model).ok_or_else(|| {
        format!("model \"{model}\" is not available for on-device download on this device")
    })?;

    let digest = format!("sha256:{}", file_name_for(entry));

    // Already installed → report instant success the way Ollama does.
    if installed_model_path(dir, entry.tag).is_some() {
        let _ = tx
            .send(ndjson(json!({
                "status": format!("pulling {digest}"),
                "digest": digest,
                "total": entry.size,
                "completed": entry.size,
            })))
            .await;
        let _ = tx.send(ndjson(json!({ "status": "success" }))).await;
        return Ok(());
    }

    let needed_gb = entry.size as f64 / (1024.0 * 1024.0 * 1024.0);
    if let Ok(avail) = available_disk_gb(dir) {
        // Model plus 1 GB of headroom — filling the disk to the brim on a
        // phone takes the whole OS down with it.
        if avail < needed_gb + 1.0 {
            return Err(format!(
                "Not enough free space: {avail:.1} GB available, {:.1} GB required",
                needed_gb + 1.0
            ));
        }
    }

    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let final_path = dir.join(file_name_for(entry));
    let part_path = dir.join(format!("{}.part", file_name_for(entry)));

    tx.send(ndjson(json!({ "status": "pulling manifest" })))
        .await
        .map_err(|_| "cancelled".to_string())?;

    let completed =
        match download_with_progress(entry.url, entry.size, &part_path, &digest, tx).await {
            Ok(n) => n,
            Err(e) => {
                let _ = std::fs::remove_file(&part_path);
                return Err(e);
            }
        };

    std::fs::rename(&part_path, &final_path).map_err(|e| e.to_string())?;
    let mut manifest = read_manifest(dir);
    manifest.insert(
        entry.tag.to_string(),
        json!({ "file": file_name_for(entry), "size": completed }),
    );
    write_manifest(dir, &manifest)?;

    let _ = tx
        .send(ndjson(json!({ "status": "verifying sha256 digest" })))
        .await;
    let _ = tx.send(ndjson(json!({ "status": "success" }))).await;
    Ok(())
}

/// The on-disk file name for a catalog entry (last URL path segment).
fn file_name_for(entry: &CatalogEntry) -> &'static str {
    entry.url.rsplit('/').next().unwrap_or("model.gguf")
}

/// Stream `url` into `dest`, writing Ollama-style progress lines to `tx`.
/// Returns bytes written. A closed `tx` receiver aborts the download (that is
/// how cancellation reaches us — the UI drops the pull response).
async fn download_with_progress(
    url: &str,
    size_hint: u64,
    dest: &Path,
    digest: &str,
    tx: &mpsc::Sender<String>,
) -> Result<u64, String> {
    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("download failed to start: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("model host returned {}", resp.status()));
    }
    let total = resp.content_length().unwrap_or(size_hint);

    let mut file = std::fs::File::create(dest).map_err(|e| e.to_string())?;
    let mut stream = resp.bytes_stream();
    let mut completed: u64 = 0;
    let mut last_emit: u64 = 0;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("download interrupted: {e}"))?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        completed += chunk.len() as u64;
        if completed - last_emit >= PROGRESS_STEP_BYTES || completed == total {
            last_emit = completed;
            tx.send(ndjson(json!({
                "status": format!("pulling {digest}"),
                "digest": digest,
                "total": total,
                "completed": completed,
            })))
            .await
            .map_err(|_| "cancelled".to_string())?;
        }
    }
    file.flush().map_err(|e| e.to_string())?;
    Ok(completed)
}

/// `POST /api/chat` — Ollama-format chat, streamed as NDJSON. Delegates to
/// the llama.cpp engine where compiled; answers 501 elsewhere so a
/// misconfigured build fails loudly instead of hanging.
async fn post_chat(State(state): State<AppState>, Json(body): Json<Value>) -> Response {
    let model = body
        .get("model")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();
    let stream_mode = body.get("stream").and_then(|v| v.as_bool()).unwrap_or(true);
    let messages: Vec<(String, String)> = body
        .get("messages")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|m| {
                    Some((
                        m.get("role")?.as_str()?.to_string(),
                        m.get("content")?.as_str()?.to_string(),
                    ))
                })
                .collect()
        })
        .unwrap_or_default();

    let Some(path) = installed_model_path(&state.models_dir, &model) else {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": format!("model \"{model}\" is not downloaded") })),
        )
            .into_response();
    };

    chat_response(&model, path, messages, stream_mode).await
}

#[cfg(any(target_os = "ios", target_os = "android", feature = "embedded-llm"))]
async fn chat_response(
    model: &str,
    path: PathBuf,
    messages: Vec<(String, String)>,
    stream_mode: bool,
) -> Response {
    let model = model.to_string();
    let mut rx = engine::submit(path, messages);

    if !stream_mode {
        let mut full = String::new();
        while let Some(tok) = rx.recv().await {
            match tok {
                Ok(t) => full.push_str(&t),
                Err(e) => {
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({ "error": e })),
                    )
                        .into_response()
                }
            }
        }
        return Json(json!({
            "model": model,
            "message": { "role": "assistant", "content": full },
            "done": true,
            "done_reason": "stop",
        }))
        .into_response();
    }

    // Re-shape engine tokens into Ollama NDJSON lines on a plain channel; the
    // response body streams from its receiver.
    let (line_tx, line_rx) = mpsc::channel::<String>(64);
    tokio::spawn(async move {
        while let Some(tok) = rx.recv().await {
            let line = match tok {
                Ok(t) => ndjson(json!({
                    "model": model,
                    "message": { "role": "assistant", "content": t },
                    "done": false,
                })),
                Err(e) => {
                    let _ = line_tx.send(ndjson(json!({ "error": e }))).await;
                    return;
                }
            };
            if line_tx.send(line).await.is_err() {
                return; // client hung up; dropping rx stops the engine too
            }
        }
        let _ = line_tx
            .send(ndjson(json!({
                "model": model,
                "message": { "role": "assistant", "content": "" },
                "done": true,
                "done_reason": "stop",
            })))
            .await;
    });
    let stream =
        tokio_stream::wrappers::ReceiverStream::new(line_rx).map(Ok::<_, std::convert::Infallible>);
    Response::builder()
        .header("content-type", "application/x-ndjson")
        .body(Body::from_stream(stream))
        .unwrap()
}

#[cfg(not(any(target_os = "ios", target_os = "android", feature = "embedded-llm")))]
async fn chat_response(
    _model: &str,
    _path: PathBuf,
    _messages: Vec<(String, String)>,
    _stream_mode: bool,
) -> Response {
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(json!({ "error": "on-device inference is not built into this binary" })),
    )
        .into_response()
}

fn router(models_dir: PathBuf) -> Router {
    Router::new()
        .route("/api/version", get(get_version))
        .route("/api/tags", get(get_tags))
        .route("/api/pull", post(post_pull))
        .route("/api/chat", post(post_chat))
        .with_state(AppState { models_dir })
}

/// The base URL of the running embedded server, once [`start`] has bound it.
static SERVER_URL: OnceLock<String> = OnceLock::new();
/// Where models live, remembered at the first `start` attempt so a failed
/// launch-time start can be retried later (see `ensure_started`).
static MODELS_DIR: OnceLock<PathBuf> = OnceLock::new();

/// Where models are stored, as remembered by the first `start` attempt.
/// The disk-space check measures THIS filesystem: on Android there is no
/// meaningful `$HOME` (statvfs on `/` reports 0 bytes available to apps),
/// while the app-data models dir is on the real writable partition.
pub fn models_dir() -> Option<PathBuf> {
    MODELS_DIR.get().cloned()
}

/// Start the embedded server if it is not up yet, using the models dir from
/// the first `start` call. The recovery path for a launch-time start failure:
/// callers (e.g. a model download) invoke this instead of giving up.
pub fn ensure_started() -> Result<String, String> {
    if let Some(url) = server_url() {
        return Ok(url);
    }
    match MODELS_DIR.get() {
        Some(dir) => start(dir.clone()),
        None => Err("embedded local LLM server is not running".to_string()),
    }
}

pub fn server_url() -> Option<String> {
    SERVER_URL.get().cloned()
}

/// Start the embedded server on its own thread (own runtime, so it works no
/// matter which async context — or none — the caller is in). Prefers Ollama's
/// 11434 so direct-URL callers keep working; falls back to an OS-assigned port
/// (reachable via [`server_url`]) rather than failing when 11434 is taken.
///
/// Idempotent: repeat calls return the already-bound URL.
pub fn start(models_dir: PathBuf) -> Result<String, String> {
    // Remember the dir even when the bind below fails, so `ensure_started`
    // can retry the start later with the same location.
    let _ = MODELS_DIR.set(models_dir.clone());
    if let Some(url) = server_url() {
        return Ok(url);
    }
    let listener = std::net::TcpListener::bind("127.0.0.1:11434")
        .or_else(|_| std::net::TcpListener::bind("127.0.0.1:0"))
        .map_err(|e| format!("could not bind local LLM server: {e}"))?;
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let addr = listener.local_addr().map_err(|e| e.to_string())?;
    let url = format!("http://127.0.0.1:{}", addr.port());

    std::thread::Builder::new()
        .name("ibl-local-llm".into())
        .spawn(move || {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .expect("local llm runtime");
            rt.block_on(async move {
                let listener =
                    tokio::net::TcpListener::from_std(listener).expect("local llm listener");
                if let Err(e) = axum::serve(listener, router(models_dir)).await {
                    eprintln!("[LocalLLM] server exited: {e}");
                }
            });
        })
        .map_err(|e| e.to_string())?;

    let _ = SERVER_URL.set(url.clone());
    println!("[LocalLLM] embedded server listening on {url}");
    Ok(url)
}

/// Total physical RAM in bytes (Android: /proc/meminfo) so the model-size
/// warnings in the UI work on devices where sysinfo isn't wired up.
#[cfg(target_os = "android")]
pub fn physical_ram_bytes() -> u64 {
    let Ok(meminfo) = std::fs::read_to_string("/proc/meminfo") else {
        return 0;
    };
    meminfo
        .lines()
        .find_map(|l| l.strip_prefix("MemTotal:"))
        .and_then(|rest| rest.split_whitespace().next())
        .and_then(|kb| kb.parse::<u64>().ok())
        .map(|kb| kb * 1024)
        .unwrap_or(0)
}

/// Total physical RAM in bytes (Apple: sysctl hw.memsize) so the model-size
/// warnings in the UI work on devices where sysinfo isn't wired up.
#[cfg(any(target_os = "ios", target_os = "macos"))]
pub fn physical_ram_bytes() -> u64 {
    let mut size: u64 = 0;
    let mut len = std::mem::size_of::<u64>();
    let name = std::ffi::CString::new("hw.memsize").unwrap();
    let rc = unsafe {
        libc::sysctlbyname(
            name.as_ptr(),
            (&mut size as *mut u64).cast(),
            &mut len,
            std::ptr::null_mut(),
            0,
        )
    };
    if rc == 0 {
        size
    } else {
        0
    }
}

/// llama.cpp inference, isolated on one worker thread.
///
/// A single OS thread owns the backend, the loaded model, and every context:
/// this sidesteps the FFI types' thread-affinity questions entirely and gives
/// phones the right behavior for free — inference requests queue rather than
/// competing for the GPU and memory. The loaded model is cached between
/// requests (reloading a GGUF per message would cost seconds); loading a
/// different model drops the previous one first, keeping peak memory at one
/// model.
#[cfg(any(target_os = "ios", target_os = "android", feature = "embedded-llm"))]
mod engine {
    use super::*;
    use llama_cpp_2::context::params::LlamaContextParams;
    use llama_cpp_2::llama_backend::LlamaBackend;
    use llama_cpp_2::llama_batch::LlamaBatch;
    use llama_cpp_2::model::params::LlamaModelParams;
    use llama_cpp_2::model::{AddBos, LlamaChatMessage, LlamaModel};
    use llama_cpp_2::sampling::LlamaSampler;
    use std::num::NonZeroU32;
    use std::sync::mpsc as std_mpsc;
    use std::sync::Mutex;

    pub enum Job {
        Chat {
            model_path: PathBuf,
            messages: Vec<(String, String)>,
            tx: mpsc::Sender<Result<String, String>>,
        },
        /// Drop the cached model — memory pressure relief when local models
        /// are toggled off (a loaded 1B model holds ~1 GB a phone wants back).
        /// The ack sender is dropped once the unload happened.
        Unload(tokio::sync::oneshot::Sender<()>),
    }

    static JOBS: OnceLock<Mutex<std_mpsc::Sender<Job>>> = OnceLock::new();

    /// Hard cap on generated tokens per reply; a runaway generation on a phone
    /// is a battery and thermals problem, not just a UX one.
    const MAX_NEW_TOKENS: usize = 1536;
    /// Context window requested per chat (clamped to the model's training ctx).
    const N_CTX: u32 = 4096;

    /// Queue a chat; tokens (or one error) arrive on the returned receiver.
    pub fn submit(
        model_path: PathBuf,
        messages: Vec<(String, String)>,
    ) -> mpsc::Receiver<Result<String, String>> {
        let (tx, rx) = mpsc::channel::<Result<String, String>>(64);
        let jobs = JOBS.get_or_init(|| {
            let (jtx, jrx) = std_mpsc::channel::<Job>();
            std::thread::Builder::new()
                .name("ibl-llm-engine".into())
                .spawn(move || worker(jrx))
                .expect("llm engine thread");
            Mutex::new(jtx)
        });
        let job = Job::Chat {
            model_path,
            messages,
            tx: tx.clone(),
        };
        if jobs.lock().expect("jobs lock").send(job).is_err() {
            // Channel has capacity; a fresh receiver can't be full.
            let _ = tx.try_send(Err("inference engine is not running".into()));
        }
        rx
    }

    /// Ask the worker to drop its cached model. Returns a receiver that
    /// resolves (as a channel-closed error) once the unload has happened; a
    /// caller that doesn't care can drop it.
    pub fn unload() -> tokio::sync::oneshot::Receiver<()> {
        let (ack_tx, ack_rx) = tokio::sync::oneshot::channel();
        if let Some(jobs) = JOBS.get() {
            let _ = jobs.lock().expect("jobs lock").send(Job::Unload(ack_tx));
        }
        ack_rx
    }

    fn worker(jobs: std_mpsc::Receiver<Job>) {
        let backend = match LlamaBackend::init() {
            Ok(mut b) => {
                b.void_logs();
                b
            }
            Err(e) => {
                // Fail every job with the init error rather than dying silently.
                for job in jobs {
                    if let Job::Chat { tx, .. } = job {
                        let _ = tx.blocking_send(Err(format!("llama backend init failed: {e}")));
                    }
                }
                return;
            }
        };

        let mut cached: Option<(PathBuf, LlamaModel)> = None;
        for job in jobs {
            match job {
                Job::Chat {
                    model_path,
                    messages,
                    tx,
                } => {
                    if let Err(e) = run_job(&backend, &mut cached, &model_path, &messages, &tx) {
                        let _ = tx.blocking_send(Err(e));
                    }
                }
                Job::Unload(ack) => {
                    cached = None;
                    drop(ack);
                }
            }
        }
    }

    fn run_job(
        backend: &LlamaBackend,
        cached: &mut Option<(PathBuf, LlamaModel)>,
        model_path: &Path,
        messages: &[(String, String)],
        tx: &mpsc::Sender<Result<String, String>>,
    ) -> Result<(), String> {
        // (Re)load the model if the request targets a different file.
        if cached.as_ref().map(|(p, _)| p.as_path()) != Some(model_path) {
            *cached = None; // drop the old model before loading the new one
            let params = LlamaModelParams::default().with_n_gpu_layers(1_000_000);
            let model = LlamaModel::load_from_file(backend, model_path, &params)
                .map_err(|e| format!("could not load model: {e}"))?;
            *cached = Some((model_path.to_path_buf(), model));
        }
        let model = &cached.as_ref().expect("model just cached").1;

        // Render the conversation with the model's own chat template.
        let chat: Vec<LlamaChatMessage> = messages
            .iter()
            .filter_map(|(role, content)| LlamaChatMessage::new(role.clone(), content.clone()).ok())
            .collect();
        let template = model
            .chat_template(None)
            .map_err(|e| format!("model has no chat template: {e}"))?;
        let prompt = model
            .apply_chat_template(&template, &chat, true)
            .map_err(|e| format!("chat template failed: {e}"))?;

        let n_ctx = N_CTX.min(model.n_ctx_train());
        let ctx_params = LlamaContextParams::default()
            .with_n_ctx(NonZeroU32::new(n_ctx))
            .with_n_batch(512);
        // A fresh context per request: chats are stateless at this layer (the
        // full message history arrives each time), and a clean KV cache is
        // cheaper than tracking prefix reuse correctly.
        let mut ctx = model
            .new_context(backend, ctx_params)
            .map_err(|e| format!("could not create context: {e}"))?;

        let tokens = model
            .str_to_token(&prompt, AddBos::Always)
            .map_err(|e| format!("tokenization failed: {e}"))?;
        let budget = n_ctx as usize;
        if tokens.len() + 16 >= budget {
            return Err(format!(
                "conversation too long for on-device context ({} tokens, limit {budget})",
                tokens.len()
            ));
        }
        let max_new = MAX_NEW_TOKENS.min(budget - tokens.len() - 1);

        let n_batch = 512usize;
        let mut batch = LlamaBatch::new(n_batch, 1);
        let mut pos: i32 = 0;
        for chunk in tokens.chunks(n_batch) {
            batch.clear();
            for (i, &tok) in chunk.iter().enumerate() {
                let is_last_of_prompt = pos as usize + i + 1 == tokens.len();
                batch
                    .add(tok, pos + i as i32, &[0], is_last_of_prompt)
                    .map_err(|e| format!("batch add failed: {e}"))?;
            }
            ctx.decode(&mut batch)
                .map_err(|e| format!("prompt decode failed: {e}"))?;
            pos += chunk.len() as i32;
        }

        let seed = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.subsec_nanos())
            .unwrap_or(42);
        let mut sampler = LlamaSampler::chain_simple([
            LlamaSampler::min_p(0.05, 1),
            LlamaSampler::temp(0.7),
            LlamaSampler::dist(seed),
        ]);

        let mut utf8 = Utf8Stream::default();
        for _ in 0..max_new {
            let token = sampler.sample(&ctx, batch.n_tokens() - 1);
            sampler.accept(token);
            if model.is_eog_token(token) {
                break;
            }
            // special=false: control tokens render as nothing rather than as
            // literal "<|eot_id|>"-style text in the chat.
            let bytes = model
                .token_to_piece_bytes(token, 256, false, None)
                .unwrap_or_default();
            if let Some(text) = utf8.push(&bytes) {
                if !text.is_empty() && tx.blocking_send(Ok(text)).is_err() {
                    // Receiver gone (user cancelled / navigated away): stop
                    // burning the battery on an answer nobody will read.
                    return Ok(());
                }
            }
            batch.clear();
            batch
                .add(token, pos, &[0], true)
                .map_err(|e| format!("batch add failed: {e}"))?;
            ctx.decode(&mut batch)
                .map_err(|e| format!("decode failed: {e}"))?;
            pos += 1;
        }
        Ok(())
    }
}

/// Drop the engine's cached model (no-op where the engine isn't compiled or
/// nothing is loaded). See `engine::unload`.
#[cfg(any(target_os = "ios", target_os = "android", feature = "embedded-llm"))]
pub fn engine_unload() -> tokio::sync::oneshot::Receiver<()> {
    engine::unload()
}

/// Reassembles a byte stream into valid UTF-8, holding back incomplete
/// trailing sequences (a single emoji regularly spans two tokens).
#[derive(Default)]
pub struct Utf8Stream {
    pending: Vec<u8>,
}

impl Utf8Stream {
    /// Feed bytes; returns the longest valid UTF-8 prefix now available.
    pub fn push(&mut self, bytes: &[u8]) -> Option<String> {
        self.pending.extend_from_slice(bytes);
        match std::str::from_utf8(&self.pending) {
            Ok(s) => {
                let out = s.to_string();
                self.pending.clear();
                Some(out)
            }
            Err(e) => {
                let valid = e.valid_up_to();
                // An unfinished sequence can be at most 3 bytes; anything
                // longer held back means genuinely invalid bytes. Emit the
                // VALID PREFIX and drop only the bad tail — clearing the
                // whole buffer here used to throw away already-valid text
                // that arrived in the same chunk as the bad bytes.
                if self.pending.len() - valid > 3 {
                    let out = (valid > 0)
                        .then(|| String::from_utf8_lossy(&self.pending[..valid]).into_owned());
                    self.pending.clear();
                    return out;
                }
                if valid == 0 {
                    return None;
                }
                let out = String::from_utf8_lossy(&self.pending[..valid]).into_owned();
                self.pending.drain(..valid);
                Some(out)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_matches_sdk_ids_by_base_name() {
        // The SDK sends bare base names; tags must not change the target.
        assert_eq!(resolve("llama3.2").unwrap().tag, "llama3.2:1b");
        assert_eq!(resolve("llama3.2:latest").unwrap().tag, "llama3.2:1b");
        assert_eq!(resolve("llama3.2:1b").unwrap().tag, "llama3.2:1b");
        // An explicit bigger tag must NOT collapse onto the 1B entry.
        assert_eq!(resolve("llama3.2:3b").unwrap().tag, "llama3.2:3b");
        assert_eq!(resolve("smollm:135m").unwrap().tag, "smollm:135m");
    }

    #[test]
    fn resolve_rejects_models_too_big_for_devices() {
        // Ids the SDK can send but that have no phone-sized mapping fail the
        // pull with a clear error instead of downloading something unusable.
        assert!(resolve("gpt-oss:20b").is_none());
        assert!(resolve("gemma4:31b").is_none());
        assert!(resolve("unknown-model").is_none());
    }

    #[test]
    fn tagged_model_requests_never_fall_back_to_another_variant() {
        // The bug this pins (PR review finding): with llama3.2:1b installed,
        // a pull of llama3.2:3b short-circuited as "already installed" via
        // the base-name match — and chat then served the 1B weights while
        // claiming to be the 3B model. Tagged requests must match exactly;
        // only an untagged base name may take any installed variant.
        let dir = std::env::temp_dir().join(format!("ibl-tagmatch-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("small.gguf"), b"x").unwrap();
        let mut m = serde_json::Map::new();
        m.insert(
            "llama3.2:1b".to_string(),
            json!({ "file": "small.gguf", "size": 1 }),
        );
        write_manifest(&dir, &m).unwrap();

        // Exact tag and untagged base both find the installed variant…
        assert!(installed_model_path(&dir, "llama3.2:1b").is_some());
        assert!(installed_model_path(&dir, "llama3.2").is_some());
        // …but a DIFFERENT tag of the same base must not.
        assert!(installed_model_path(&dir, "llama3.2:3b").is_none());
    }

    #[test]
    fn manifest_roundtrip_and_tags_shape() {
        let dir = std::env::temp_dir().join(format!("ibl-llm-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();

        // Manifest entry whose file exists shows up in /api/tags…
        std::fs::write(dir.join("a.gguf"), b"fake-weights").unwrap();
        let mut m = serde_json::Map::new();
        m.insert(
            "llama3.2:1b".into(),
            json!({ "file": "a.gguf", "size": 12 }),
        );
        // …one whose file is missing is skipped.
        m.insert(
            "ghost:1b".into(),
            json!({ "file": "missing.gguf", "size": 1 }),
        );
        write_manifest(&dir, &m).unwrap();

        let tags = tags_json(&dir);
        let models = tags["models"].as_array().unwrap();
        assert_eq!(models.len(), 1);
        assert_eq!(models[0]["name"], "llama3.2:1b");
        assert_eq!(models[0]["size"], 12);

        // installed_model_path matches by base name, like the SDK does.
        assert!(installed_model_path(&dir, "llama3.2").is_some());
        assert!(installed_model_path(&dir, "llama3.2:1b").is_some());
        assert!(installed_model_path(&dir, "ghost:1b").is_none());
        assert!(installed_model_path(&dir, "other").is_none());

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn utf8_stream_holds_back_split_sequences() {
        let mut s = Utf8Stream::default();
        let emoji = "🎉".as_bytes(); // 4 bytes
        assert_eq!(s.push(&emoji[..2]), None);
        assert_eq!(s.push(&emoji[2..]).as_deref(), Some("🎉"));
        assert_eq!(s.push(b"ok").as_deref(), Some("ok"));
    }

    #[test]
    fn utf8_stream_keeps_the_valid_prefix_before_invalid_bytes() {
        // The bug this pins (PR review finding): >3 invalid trailing bytes
        // cleared the WHOLE buffer, discarding valid text that arrived in
        // the same chunk.
        let mut s = Utf8Stream::default();
        let mut bytes = b"hello ".to_vec();
        bytes.extend_from_slice(&[0xFF, 0xFF, 0xFF, 0xFF, 0xFF]);
        assert_eq!(s.push(&bytes).as_deref(), Some("hello "));
        // The bad tail is gone, not held: clean text flows right after.
        assert_eq!(s.push(b"world").as_deref(), Some("world"));
    }

    #[test]
    fn utf8_stream_drops_invalid_bytes() {
        let mut s = Utf8Stream::default();
        // 4 continuation bytes can never complete a sequence.
        assert_eq!(s.push(&[0x80, 0x80, 0x80, 0x80]), None);
        assert_eq!(s.push(b"next").as_deref(), Some("next"));
    }

    /// End-to-end liveness: start() must yield a server that actually
    /// ANSWERS — a thread that binds, registers the URL, then dies leaves
    /// server_url() pointing at a dead port and every download failing with
    /// "embedded model server is not responding".
    #[tokio::test(flavor = "multi_thread")]
    async fn embedded_server_answers_version_after_start() {
        let dir = std::env::temp_dir()
            .join(format!("ibl-live-{}", std::process::id()))
            .join("models");
        let url = start(dir).expect("start embedded server");
        let mut last_err = String::new();
        for _ in 0..50 {
            match reqwest::get(format!("{url}/api/version")).await {
                Ok(r) if r.status().is_success() => {
                    let v: Value = r.json().await.expect("version json");
                    assert!(v.get("version").is_some());
                    return;
                }
                Ok(r) => last_err = format!("status {}", r.status()),
                Err(e) => last_err = e.to_string(),
            }
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        }
        panic!("embedded server never answered /api/version: {last_err}");
    }

    #[test]
    fn models_dir_is_recorded_by_start_attempts_and_probeable() {
        // The disk check measures models_dir(), not $HOME — on Android HOME
        // is unset and statvfs("/") reports 0 bytes, which blocked every
        // download. start() must record the dir even when binding fails,
        // and a just-created dir must probe to a real, positive number.
        let dir = std::env::temp_dir()
            .join(format!("ibl-models-dir-{}", std::process::id()))
            .join("models");
        let _ = start(dir.clone());
        assert_eq!(models_dir().as_deref(), Some(dir.as_path()));
        std::fs::create_dir_all(&dir).unwrap();
        let gb = available_disk_gb(&dir).expect("probe fresh models dir");
        assert!(gb > 0.0, "created dir must report positive space, got {gb}");
    }

    #[test]
    fn disk_space_reports_positive_for_temp_dir() {
        let gb = available_disk_gb(&std::env::temp_dir()).unwrap();
        assert!(gb > 0.0);
    }

    #[tokio::test]
    async fn pull_rejects_unknown_model_with_error_line() {
        let dir = std::env::temp_dir().join(format!("ibl-llm-pull-{}", std::process::id()));
        let (tx, mut rx) = mpsc::channel::<String>(16);
        let err = pull_into(&dir, "gpt-oss:20b", &tx).await.unwrap_err();
        assert!(err.contains("not available"), "got: {err}");
        // No progress lines should have been emitted for an unknown model.
        drop(tx);
        assert!(rx.recv().await.is_none());
    }

    /// The download loop `pull_into` runs — streaming HTTP into a file with
    /// digest-tagged, monotonic progress lines — against a local server
    /// standing in for the model host.
    #[tokio::test]
    async fn download_streams_progress_lines() {
        let payload: Vec<u8> = vec![7u8; 9 * 1024 * 1024];
        let body = payload.clone();
        let app = Router::new().route(
            "/weights.gguf",
            get(move || {
                let body = body.clone();
                async move { body }
            }),
        );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });

        let dir = std::env::temp_dir().join(format!("ibl-llm-dl-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let dest = dir.join("weights.gguf.part");

        let (tx, mut rx) = mpsc::channel::<String>(64);
        let url = format!("http://{addr}/weights.gguf");
        let written = download_with_progress(&url, 0, &dest, "sha256:weights.gguf", &tx)
            .await
            .unwrap();
        drop(tx);
        assert_eq!(written, payload.len() as u64);
        assert_eq!(std::fs::metadata(&dest).unwrap().len(), written);

        // Progress lines parse as Ollama pull JSON: digest present (the
        // accumulator in pull_model requires it), completed monotonic, and the
        // final line reports the full byte count.
        let mut last_completed = 0u64;
        let mut lines = 0;
        while let Some(line) = rx.recv().await {
            let v: Value = serde_json::from_str(line.trim()).unwrap();
            assert_eq!(v["digest"], "sha256:weights.gguf");
            let completed = v["completed"].as_u64().unwrap();
            assert!(completed >= last_completed);
            last_completed = completed;
            lines += 1;
        }
        assert!(lines >= 2, "expected multiple progress lines, got {lines}");
        assert_eq!(last_completed, written);

        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Real end-to-end inference through the same code path iOS uses:
    /// manifest → /api/chat handler → engine worker → streamed NDJSON.
    ///
    /// Needs real weights, so it's opt-in:
    /// `IBL_LLM_TEST_MODEL=/path/to/model.gguf cargo test --features embedded-llm -- --ignored llm_generates`
    #[cfg(any(target_os = "ios", target_os = "android", feature = "embedded-llm"))]
    #[tokio::test(flavor = "multi_thread")]
    #[ignore = "downloads/loads real model weights; run explicitly with IBL_LLM_TEST_MODEL set"]
    async fn llm_generates_a_streamed_reply() {
        let Ok(model_path) = std::env::var("IBL_LLM_TEST_MODEL") else {
            panic!("set IBL_LLM_TEST_MODEL to a local .gguf file");
        };
        let dir = std::env::temp_dir().join(format!("ibl-llm-e2e-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let file = "test-model.gguf";
        std::fs::copy(&model_path, dir.join(file)).unwrap();
        let mut m = serde_json::Map::new();
        m.insert("smollm:135m".into(), json!({ "file": file, "size": 1 }));
        write_manifest(&dir, &m).unwrap();

        // Through the real HTTP surface, exactly as ollama_chat_stream calls it.
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move { axum::serve(listener, router(dir)).await.unwrap() });

        let resp = reqwest::Client::new()
            .post(format!("http://{addr}/api/chat"))
            .json(&json!({
                "model": "smollm",
                "stream": true,
                "messages": [
                    { "role": "system", "content": "You are a helpful assistant." },
                    { "role": "user", "content": "Say hello in one short sentence." }
                ]
            }))
            .send()
            .await
            .unwrap();
        assert!(
            resp.status().is_success(),
            "chat returned {}",
            resp.status()
        );

        let body = resp.text().await.unwrap();
        let mut content = String::new();
        let mut saw_done = false;
        for line in body.lines() {
            let v: Value = serde_json::from_str(line).unwrap();
            assert!(v.get("error").is_none(), "engine error: {v}");
            if let Some(c) = v["message"]["content"].as_str() {
                content.push_str(c);
            }
            if v["done"].as_bool() == Some(true) {
                saw_done = true;
            }
        }
        assert!(saw_done, "stream must end with a done line");
        assert!(
            !content.trim().is_empty(),
            "model produced no text; raw body: {body}"
        );
        println!("[llm test] model said: {content}");

        // Free the cached model before the process exits: ggml's Metal
        // teardown asserts if buffers are still alive at exit, which would
        // turn a passing test into a SIGABRT.
        let _ = engine::unload().await;
    }

    /// A model already in the manifest short-circuits `pull_into` with an
    /// instant success — no network touched (the catalog URL would 404 here).
    #[tokio::test]
    async fn pull_short_circuits_when_already_installed() {
        let dir = std::env::temp_dir().join(format!("ibl-llm-sc-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("fake.gguf"), b"weights").unwrap();
        let mut m = serde_json::Map::new();
        m.insert(
            "llama3.2:1b".into(),
            json!({ "file": "fake.gguf", "size": 7 }),
        );
        write_manifest(&dir, &m).unwrap();

        let (tx, mut rx) = mpsc::channel::<String>(16);
        pull_into(&dir, "llama3.2", &tx).await.unwrap();
        drop(tx);

        let mut statuses = Vec::new();
        while let Some(line) = rx.recv().await {
            let v: Value = serde_json::from_str(line.trim()).unwrap();
            if let Some(s) = v["status"].as_str() {
                statuses.push(s.to_string());
            }
        }
        assert_eq!(statuses.last().map(String::as_str), Some("success"));

        let _ = std::fs::remove_dir_all(&dir);
    }
}
