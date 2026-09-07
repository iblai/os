use axum::{
    body::{Body, Bytes},
    extract::{Path, Request, State},
    http::{header, Response, StatusCode},
    response::IntoResponse,
    routing::get,
    Router,
};
use sha2::{Digest, Sha256};
use std::fs::OpenOptions;
use std::io::Write;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::cors::{Any, CorsLayer};

use crate::web_cache::WebCache;

// Helper function to log to file
fn log_to_file(message: &str) {
    let log_path = std::env::temp_dir().join("mentor_offline_server.log");
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&log_path) {
        let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
        writeln!(file, "[{}] {}", timestamp, message).ok();
    }
}

/// Port the offline server prefers. Only a preference — see [`bind_with_fallback`].
const OFFLINE_SERVER_PORT: u16 = 3457;

/// The port the server actually bound. Reads as the preferred one until a bind
/// succeeds, so URL helpers have an answer before startup completes; every
/// consumer goes through [`get_server_url`] rather than hardcoding a number.
static ACTIVE_PORT: std::sync::atomic::AtomicU16 =
    std::sync::atomic::AtomicU16::new(OFFLINE_SERVER_PORT);

/// The port the offline server is serving on.
pub fn active_port() -> u16 {
    ACTIVE_PORT.load(std::sync::atomic::Ordering::Relaxed)
}

/// Bind the offline server: `preferred` when it is free, otherwise an
/// OS-assigned port. A busy 3457 (another app, a second copy of this one) must
/// degrade to a different port, never to "no offline cache".
///
/// `SO_REUSEADDR` only rescues a previous run's socket in `TIME_WAIT`; against
/// a live listener the fallback is what saves the start.
async fn bind_with_fallback(preferred: u16) -> Option<tokio::net::TcpListener> {
    for candidate in [preferred, 0] {
        let socket = match tokio::net::TcpSocket::new_v4() {
            Ok(s) => s,
            Err(e) => {
                println!("[OfflineServer] Failed to create socket: {}", e);
                return None;
            }
        };
        if let Err(e) = socket.set_reuseaddr(true) {
            println!("[OfflineServer] Warning: Failed to set SO_REUSEADDR: {}", e);
        }
        let addr = SocketAddr::from(([127, 0, 0, 1], candidate));
        if let Err(e) = socket.bind(addr) {
            println!("[OfflineServer] Could not bind {}: {}", addr, e);
            continue;
        }
        match socket.listen(1024) {
            Ok(listener) => return Some(listener),
            Err(e) => println!("[OfflineServer] Failed to listen on {}: {}", addr, e),
        }
    }
    None
}

/// Get the app origin URL for cache lookups
/// Uses TAURI_APP_URL env var, with sensible defaults
fn get_app_origin() -> String {
    // First check environment variable
    if let Ok(url) = std::env::var("TAURI_APP_URL") {
        return url;
    }

    // Default app origin (override with TAURI_APP_URL) — same for debug and release
    #[cfg(debug_assertions)]
    return "https://os.ibl.ai".to_string();

    #[cfg(not(debug_assertions))]
    return "https://os.ibl.ai".to_string();
}

#[derive(Clone)]
struct AppState {
    cache: Arc<RwLock<Option<WebCache>>>,
    app_origin: String,
}

/// Start the offline HTTP server
#[allow(dead_code)]
pub async fn start_offline_server(cache: Arc<RwLock<Option<WebCache>>>) {
    start_offline_server_with_signal(cache, None).await;
}

/// Start the offline HTTP server with optional ready signal
pub async fn start_offline_server_with_signal(
    cache: Arc<RwLock<Option<WebCache>>>,
    ready_tx: Option<std::sync::mpsc::Sender<bool>>,
) {
    println!("[OfflineServer] start_offline_server called");

    let app_origin = get_app_origin();
    println!(
        "[OfflineServer] Using app origin for cache lookups: {}",
        app_origin
    );

    let state = AppState { cache, app_origin };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/_health", get(health_check))
        .route("/", get(serve_index))
        .route("/{*path}", get(serve_file).post(handle_post_with_body))
        .layer(cors)
        .with_state(state);

    println!(
        "[OfflineServer] Attempting to bind to http://127.0.0.1:{}",
        OFFLINE_SERVER_PORT
    );

    let Some(listener) = bind_with_fallback(OFFLINE_SERVER_PORT).await else {
        println!("[OfflineServer] No port available; offline server not started");
        if let Some(tx) = ready_tx {
            let _ = tx.send(false);
        }
        return;
    };

    start_server_and_serve(listener, app, ready_tx).await
}

async fn start_server_and_serve(
    listener: tokio::net::TcpListener,
    app: Router,
    ready_tx: Option<std::sync::mpsc::Sender<bool>>,
) {
    let addr = listener.local_addr().unwrap();

    // Record the REAL port before anyone is told the server is ready: every URL
    // helper reads this, so a fallback port must be visible by the time the
    // first consumer composes a URL.
    ACTIVE_PORT.store(addr.port(), std::sync::atomic::Ordering::Relaxed);
    if addr.port() != OFFLINE_SERVER_PORT {
        println!(
            "[OfflineServer] Port {} was taken — serving on {} instead",
            OFFLINE_SERVER_PORT,
            addr.port()
        );
    }

    println!(
        "[OfflineServer] Server bound, starting to serve on http://{}",
        addr
    );

    // Signal that server is ready after successful bind
    if let Some(tx) = ready_tx {
        println!("[OfflineServer] Signaling server ready");
        let _ = tx.send(true);
    }

    println!("[OfflineServer] Server is now listening and serving requests");

    // Start serving - this will block until the server stops
    if let Err(e) = axum::serve(listener, app).await {
        println!("[OfflineServer] Server error: {}", e);
    }

    println!("[OfflineServer] Server stopped");
}

async fn health_check() -> impl IntoResponse {
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/plain")
        .body(Body::from("ok"))
        .unwrap()
}

async fn serve_index(State(state): State<AppState>) -> impl IntoResponse {
    let app_origin = &state.app_origin;
    serve_cached_url(&state, app_origin).await
}

async fn serve_file(
    Path(path): Path<String>,
    State(state): State<AppState>,
    req: Request,
) -> impl IntoResponse {
    // Get the original percent-encoded path from the URI before Axum's decoding
    let original_path = req.uri().path().trim_start_matches('/');
    // URL-decode the path to handle encoded characters like %5B ([) and %5D (])
    // This is critical for matching Next.js dynamic routes like [tenantKey]/[mentorId]
    let decoded_path = urlencoding::decode(&path).unwrap_or(std::borrow::Cow::Borrowed(&path));
    let decoded_path = decoded_path.as_ref();

    log_to_file(&format!(
        "Request received - URI path: '{}', Axum path param: '{}', decoded: '{}'",
        req.uri().path(),
        path,
        decoded_path
    ));

    // Handle API routes specially - check cache first, then return mock responses
    if decoded_path.starts_with("api/") {
        return handle_api_offline_with_cache(&state, decoded_path).await;
    }

    // Handle Next.js Image Optimization API (/_next/image?url=...&w=...&q=...)
    // This serves cached external images (S3, Gravatar, etc.)
    if decoded_path.starts_with("_next/image") {
        return handle_next_image(&state, req.uri().query()).await;
    }

    // Check if this is a static asset or a page route
    let is_static_asset = decoded_path.starts_with("_next/")
        || decoded_path.starts_with("static/")
        || decoded_path.contains('.')
        || decoded_path == "env.js"
        || decoded_path == "favicon.ico";

    let app_origin = &state.app_origin;

    // Special handling for env.js - return empty config in offline mode
    if decoded_path == "env.js" || decoded_path == "/env.js" {
        log_to_file("Serving mock env.js for offline mode");
        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "application/javascript")
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .body(Body::from("window.ENV = {};"))
            .unwrap();
    }

    if is_static_asset {
        // Serve static assets by trying multiple origin patterns
        // This handles cases where chunks were cached from different environments (dev/prod)
        let possible_origins = [
            app_origin.as_str(),
            "https://os.ibl.ai",
            "https://mentorai.iblai.app",
            "http://localhost:3001",
            "http://localhost:3000",
        ];

        log_to_file(&format!(
            "Static asset - original_path: '{}', trying {} origins",
            original_path,
            possible_origins.len()
        ));

        // Try each origin pattern
        for origin in possible_origins {
            let cache_url = format!("{}/{}", origin, original_path);

            // Check if this URL exists in cache before trying to serve
            let cache_guard = state.cache.read().await;
            if let Some(cache) = cache_guard.as_ref() {
                if cache.get_cached(&cache_url).await.is_some() {
                    drop(cache_guard);
                    log_to_file(&format!(
                        "Found static asset in cache with origin: {}",
                        origin
                    ));
                    return serve_cached_url(&state, &cache_url).await;
                }
            }
            drop(cache_guard);
        }

        // If not found in any origin, try with the default app_origin
        // This will return a proper 404 if really not cached
        let cache_url = format!("{}/{}", app_origin, original_path);
        log_to_file(&format!(
            "Static asset not found in any origin, trying default: {}",
            cache_url
        ));
        serve_cached_url(&state, &cache_url).await
    } else {
        // For page routes (SPA), try to serve the cached HTML for the specific route first
        // This ensures Next.js has the correct initial state with route params
        let route_url = format!("{}/{}", app_origin, decoded_path);
        println!("[OfflineServer] SPA route detected: /{}, trying route-specific HTML first (original: {})", decoded_path, path);

        // Check if we have cached HTML for this specific route
        let cache_guard = state.cache.read().await;
        let has_route_html = if let Some(cache) = cache_guard.as_ref() {
            cache.get_cached(&route_url).await.is_some()
        } else {
            false
        };
        drop(cache_guard);

        if has_route_html {
            println!("[OfflineServer] Found cached HTML for route: {}", route_url);
            serve_cached_url(&state, &route_url).await
        } else {
            // Fall back to main page HTML - Next.js will handle client-side routing
            println!("[OfflineServer] No route-specific HTML, falling back to main page");
            serve_cached_url(&state, app_origin).await
        }
    }
}

/// Handle POST requests with body - needed for RBAC permissions check and other POST APIs
/// This extracts the request body to use for cache key lookup
async fn handle_post_with_body(
    State(state): State<AppState>,
    Path(path): Path<String>,
    body: Bytes,
) -> impl IntoResponse {
    let body_str = String::from_utf8_lossy(&body).to_string();
    println!(
        "[OfflineServer] POST request in offline mode: /{} (body: {} bytes)",
        path,
        body_str.len()
    );

    // Handle API routes
    if path.starts_with("api/") {
        return handle_post_api_offline_with_cache(&state, &path, &body_str).await;
    }

    // For non-API POST requests, return method not allowed
    Response::builder()
        .status(StatusCode::METHOD_NOT_ALLOWED)
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(Body::from(
            r#"{"error":"POST not supported for this path in offline mode"}"#,
        ))
        .unwrap()
}

/// Handle POST API requests in offline mode
/// First tries to find cached response, then falls back to mock responses
async fn handle_post_api_offline_with_cache(
    state: &AppState,
    path: &str,
    request_body: &str,
) -> Response<Body> {
    println!(
        "[OfflineServer] POST API request in offline mode: /{}",
        path
    );

    // Generate cache key with body hash (same format as in main.rs caching)
    let body_hash = {
        let mut hasher = Sha256::new();
        hasher.update(request_body.as_bytes());
        hex::encode(hasher.finalize())
    };

    // Try to find cached POST response
    let cache_guard = state.cache.read().await;
    if let Some(cache) = cache_guard.as_ref() {
        // Log cached POST URLs for debugging (first request only)
        static LOGGED_POST_CACHE: std::sync::atomic::AtomicBool =
            std::sync::atomic::AtomicBool::new(false);
        if !LOGGED_POST_CACHE.load(std::sync::atomic::Ordering::Relaxed) {
            LOGGED_POST_CACHE.store(true, std::sync::atomic::Ordering::Relaxed);
            let cached_urls = cache.get_cached_urls().await;
            println!(
                "[OfflineServer] === CACHED POST URLs ({} total) ===",
                cached_urls.len()
            );
            for url in &cached_urls {
                if url.contains("#POST") {
                    println!("[OfflineServer]   {}", url);
                }
            }
            println!("[OfflineServer] === END CACHED POST URLs ===");
        }

        // Try different URL patterns that might have been cached
        let api_hosts = [
            "https://base.manager.iblai.app",
            "https://base.manager.iblai.org",
            "https://learn.iblai.app",
            "https://learn.iblai.org",
        ];

        for host in api_hosts {
            // Try with full body hash
            let cache_key_with_hash = format!("{}/{}#POST#{}", host, path, body_hash);
            if let Some(response) = cache.get_cached(&cache_key_with_hash).await {
                println!(
                    "[OfflineServer] Found cached POST response (with body hash) for: {}",
                    cache_key_with_hash
                );
                return Response::builder()
                    .status(response.status)
                    .header(header::CONTENT_TYPE, response.content_type)
                    .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                    .body(Body::from(response.body))
                    .unwrap();
            }

            // Try without body hash (fallback)
            let cache_key_no_hash = format!("{}/{}#POST", host, path);
            if let Some(response) = cache.get_cached(&cache_key_no_hash).await {
                println!(
                    "[OfflineServer] Found cached POST response (no body hash) for: {}",
                    cache_key_no_hash
                );
                return Response::builder()
                    .status(response.status)
                    .header(header::CONTENT_TYPE, response.content_type)
                    .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                    .body(Body::from(response.body))
                    .unwrap();
            }
        }
    }
    drop(cache_guard);

    // No cache found - fall back to mock responses for critical endpoints
    println!(
        "[OfflineServer] No cached POST response found, using fallback for: /{}",
        path
    );

    // Analytics time update - acknowledge but don't track (non-critical)
    if path.contains("analytics") && path.contains("time/update") {
        println!("[OfflineServer] Returning fallback analytics response");
        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .body(Body::from(r#"{"success":true,"offline":true}"#))
            .unwrap();
    }

    // RBAC permissions check - return empty permissions as fallback
    // This allows the app to function without special permissions
    if path.contains("rbac/permissions/check") {
        println!("[OfflineServer] Returning fallback RBAC permissions response (no cache found)");
        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .body(Body::from(r#"{"permissions":{},"offline":true}"#))
            .unwrap();
    }

    // Default POST response for unhandled/uncached endpoints
    println!(
        "[OfflineServer] No cache or fallback for POST path: /{}",
        path
    );
    Response::builder()
        .status(StatusCode::SERVICE_UNAVAILABLE)
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(Body::from(format!(
            r#"{{"offline":true,"error":"No cached response available","path":"{}"}}"#,
            path
        )))
        .unwrap()
}

/// Handle API requests in offline mode with cache lookup
/// First checks cache for cached API responses, then falls back to mock responses
async fn handle_api_offline_with_cache(state: &AppState, path: &str) -> Response<Body> {
    println!("[OfflineServer] GET API request in offline mode: /{}", path);

    // Log cached URLs on first request (for debugging)
    static LOGGED_CACHE: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
    if !LOGGED_CACHE.load(std::sync::atomic::Ordering::Relaxed) {
        LOGGED_CACHE.store(true, std::sync::atomic::Ordering::Relaxed);
        let cache_guard = state.cache.read().await;
        if let Some(cache) = cache_guard.as_ref() {
            let cached_urls = cache.get_cached_urls().await;
            println!(
                "[OfflineServer] === CACHED API URLs ({} total) ===",
                cached_urls.len()
            );
            for url in &cached_urls {
                if url.contains("/api/") {
                    println!("[OfflineServer]   {}", url);
                }
            }
            println!("[OfflineServer] === END CACHED URLs ===");
        }
        drop(cache_guard);
    }

    // Check if path contains 'undefined' and try to find a matching cached response
    // This handles cases where React params aren't available yet
    let search_paths = if path.contains("undefined") {
        println!(
            "[OfflineServer] Path contains 'undefined', will search for matching cached responses"
        );
        get_corrected_paths(path)
    } else {
        vec![path.to_string()]
    };

    // Try to find cached API response
    // The cached URLs might be in various formats, try multiple patterns
    let app_origin = &state.app_origin;
    let cache_guard = state.cache.read().await;
    if let Some(cache) = cache_guard.as_ref() {
        for search_path in &search_paths {
            // Try different URL patterns that might have been cached
            let possible_urls = vec![
                format!("https://base.manager.iblai.app/{}", search_path),
                format!("https://base.manager.iblai.org/{}", search_path),
                format!("https://learn.iblai.app/{}", search_path),
                format!("https://learn.iblai.org/{}", search_path),
                format!("{}/{}", app_origin, search_path),
            ];

            for url in possible_urls {
                if let Some(response) = cache.get_cached(&url).await {
                    println!("[OfflineServer] Serving cached API response for: {}", url);
                    return Response::builder()
                        .status(response.status)
                        .header(header::CONTENT_TYPE, response.content_type)
                        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                        .body(Body::from(response.body))
                        .unwrap();
                }
            }
        }

        // Try to find cache by matching path without query params
        // Cached URLs often have query params, but requests may not
        if let Some(response) = find_cached_by_path_pattern(cache, path).await {
            println!("[OfflineServer] Serving cached API response (matched by path)");
            return Response::builder()
                .status(response.status)
                .header(header::CONTENT_TYPE, response.content_type)
                .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                .body(Body::from(response.body))
                .unwrap();
        }

        // If path contains undefined, try fuzzy matching on cache keys
        if path.contains("undefined") {
            if let Some(response) = fuzzy_match_cache(cache, path).await {
                println!("[OfflineServer] Serving fuzzy-matched cached API response");
                return Response::builder()
                    .status(response.status)
                    .header(header::CONTENT_TYPE, response.content_type)
                    .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                    .body(Body::from(response.body))
                    .unwrap();
            }
        }
    }
    drop(cache_guard);

    // No cache found, return mock response
    println!(
        "[OfflineServer] No cached API response found, using mock for: /{}",
        path
    );
    handle_api_offline(path)
}

/// Handle Next.js Image Optimization API requests (/_next/image?url=...&w=...&q=...)
/// Extracts the original image URL from query params and serves from cache
async fn handle_next_image(state: &AppState, query: Option<&str>) -> Response<Body> {
    println!("[OfflineServer] Handling _next/image request");

    // Parse query string to extract URL parameter
    let image_url = match query {
        Some(q) => {
            // Query format: url=<encoded-url>&w=<width>&q=<quality>
            let params: Vec<&str> = q.split('&').collect();
            let mut url_param = None;

            for param in params {
                if let Some(value) = param.strip_prefix("url=") {
                    // URL-decode the parameter
                    url_param = Some(
                        urlencoding::decode(value).unwrap_or(std::borrow::Cow::Borrowed(value)),
                    );
                    break;
                }
            }

            match url_param {
                Some(url) => url.to_string(),
                None => {
                    println!("[OfflineServer] No url parameter in _next/image query");
                    return Response::builder()
                        .status(StatusCode::BAD_REQUEST)
                        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                        .body(Body::from("Missing url parameter"))
                        .unwrap();
                }
            }
        }
        None => {
            println!("[OfflineServer] No query string in _next/image request");
            return Response::builder()
                .status(StatusCode::BAD_REQUEST)
                .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                .body(Body::from("Missing query string"))
                .unwrap();
        }
    };

    println!("[OfflineServer] Looking for cached image: {}", image_url);

    // Try to get the image from cache
    let cache_guard = state.cache.read().await;
    if let Some(cache) = cache_guard.as_ref() {
        if let Some(response) = cache.get_cached(&image_url).await {
            println!("[OfflineServer] Serving cached image: {}", image_url);
            return Response::builder()
                .status(response.status)
                .header(header::CONTENT_TYPE, response.content_type)
                .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                .header(header::CACHE_CONTROL, "public, max-age=31536000, immutable")
                .body(Body::from(response.body))
                .unwrap();
        }
    }

    println!("[OfflineServer] Image not found in cache: {}", image_url);

    // Return a 1x1 transparent PNG as fallback
    // This prevents broken image icons in the UI
    let transparent_png = vec![
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, // IHDR length
        0x49, 0x48, 0x44, 0x52, // IHDR
        0x00, 0x00, 0x00, 0x01, // width = 1
        0x00, 0x00, 0x00, 0x01, // height = 1
        0x08, 0x06, 0x00, 0x00, 0x00, // bit depth, color type, etc.
        0x1F, 0x15, 0xC4, 0x89, // CRC
        0x00, 0x00, 0x00, 0x0A, // IDAT length
        0x49, 0x44, 0x41, 0x54, // IDAT
        0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, // data
        0x0D, 0x0A, 0x2D, 0xB4, // CRC
        0x00, 0x00, 0x00, 0x00, // IEND length
        0x49, 0x45, 0x4E, 0x44, // IEND
        0xAE, 0x42, 0x60, 0x82, // CRC
    ];

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "image/png")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(Body::from(transparent_png))
        .unwrap()
}

/// Try to find cached response by matching path pattern, ignoring query parameters
/// e.g., request for /api/search/prompts/ should match cached https://base.manager.iblai.org/api/search/prompts/?limit=10
async fn find_cached_by_path_pattern(
    cache: &WebCache,
    path: &str,
) -> Option<crate::web_cache::CacheResponse> {
    // Normalize the requested path
    let normalized_request_path = if path.starts_with('/') {
        path.to_string()
    } else {
        format!("/{}", path)
    };

    // Get all cached URLs using public API
    let cached_urls = cache.get_cached_urls().await;
    for cached_url in cached_urls {
        // Extract path from cached URL (remove domain and query params)
        // URL format: https://domain.com/path?query
        // We need to extract just the /path part
        if let Some(path_start) = cached_url.find("://") {
            let after_protocol = &cached_url[path_start + 3..];
            if let Some(path_idx) = after_protocol.find('/') {
                let path_and_query = &after_protocol[path_idx..];
                // Remove query params if present
                let cached_path = if let Some(query_idx) = path_and_query.find('?') {
                    &path_and_query[..query_idx]
                } else {
                    path_and_query
                };

                // Check if paths match (ignoring query params)
                if cached_path == normalized_request_path {
                    if let Some(response) = cache.get_cached(&cached_url).await {
                        println!(
                            "[OfflineServer] Found cache match by path: {} -> {}",
                            path, cached_url
                        );
                        return Some(response);
                    }
                }
            }
        }
    }

    None
}

/// Try to find cached response by fuzzy matching the API path pattern
/// e.g., if path is api/ai-mentor/orgs/undefined/users/gillis/mentors/undefined/public-settings/
/// we look for any cached URL that matches /api/ai-mentor/orgs/*/users/*/mentors/*/public-settings/
async fn fuzzy_match_cache(
    cache: &WebCache,
    path: &str,
) -> Option<crate::web_cache::CacheResponse> {
    // Extract the API pattern from the path
    // Convert path with undefined to a pattern for matching
    // Add leading slash if not present
    let normalized_path = if path.starts_with('/') {
        path.to_string()
    } else {
        format!("/{}", path)
    };
    let pattern_parts: Vec<&str> = normalized_path
        .split('/')
        .filter(|s| !s.is_empty())
        .collect();

    println!(
        "[OfflineServer] Fuzzy matching for pattern: {:?}",
        pattern_parts
    );

    // Get all cached URLs and try to find one that matches the pattern
    let cached_urls = cache.get_cached_urls().await;
    println!(
        "[OfflineServer] Checking {} cached URLs for fuzzy match",
        cached_urls.len()
    );

    for cached_url in cached_urls {
        // Only check API URLs
        if !cached_url.contains("/api/") {
            continue;
        }

        // Extract the path from the cached URL
        // URL format: https://base.manager.iblai.app/api/...
        if let Some(api_start) = cached_url.find("/api/") {
            let cached_path = &cached_url[api_start..];
            let cached_parts: Vec<&str> =
                cached_path.split('/').filter(|s| !s.is_empty()).collect();

            // Check if the pattern matches (same length, same structure)
            if cached_parts.len() == pattern_parts.len() {
                let mut matches = true;
                for (cached_part, pattern_part) in cached_parts.iter().zip(pattern_parts.iter()) {
                    // If pattern part is 'undefined', any value matches
                    // Otherwise, parts must be equal
                    if *pattern_part != "undefined" && *cached_part != *pattern_part {
                        matches = false;
                        break;
                    }
                }

                if matches {
                    println!(
                        "[OfflineServer] Fuzzy match found: {} for pattern: {}",
                        cached_url, path
                    );
                    if let Some(response) = cache.get_cached(&cached_url).await {
                        return Some(response);
                    }
                }
            }
        }
    }

    println!("[OfflineServer] No fuzzy match found for: {}", path);
    None
}

/// Get corrected paths by trying to extract org/mentor from the path pattern
fn get_corrected_paths(path: &str) -> Vec<String> {
    // Just return the original path - the fuzzy matching will handle finding the right cache
    vec![path.to_string()]
}

/// Webpack public path + fetch interceptor, injected at the top of every served
/// HTML page so relative URLs resolve against this server.
///
/// `__OFFLINE_SERVER_URL__` is substituted rather than `format!`-ed in: the
/// script is full of JS braces, which a format string would have to escape one
/// by one. The URL is resolved per call because the port is only known once the
/// server has bound.
fn webpack_init_script() -> String {
    const TEMPLATE: &str = r#"<script>
(function() {
  var OFFLINE_SERVER = "__OFFLINE_SERVER_URL__";

  // Set webpack public path BEFORE any webpack code runs
  window.__webpack_public_path__ = OFFLINE_SERVER + "/_next/";
  console.log("[OfflineMode] Webpack public path set to:", window.__webpack_public_path__);

  // Intercept fetch to redirect relative URLs to offline server
  var originalFetch = window.fetch;
  window.fetch = function(input, init) {
    var url = typeof input === "string" ? input : (input && input.url ? input.url : "");
    var isRelativeUrl = url.startsWith("/");
    var isApiCall = url.indexOf("/api/") !== -1;

    if (isRelativeUrl || isApiCall) {
      var newUrl = isRelativeUrl ? OFFLINE_SERVER + url : url;
      input = typeof input === "string" ? newUrl : new Request(newUrl, input);
    }

    return originalFetch.call(this, input, init);
  };
  console.log("[OfflineMode] Fetch interceptor installed");
})();
</script>"#;

    TEMPLATE.replace("__OFFLINE_SERVER_URL__", &get_server_url())
}

/// Rewrite relative asset URLs in HTML to point to offline server
/// This function rewrites src and href attributes that start with /
fn rewrite_asset_urls(html: &str) -> String {
    let mut result = String::with_capacity(html.len() + 1024);
    let offline_server = get_server_url();
    let offline_server = offline_server.as_str();

    let mut current_pos = 0;
    let html_bytes = html.as_bytes();

    while current_pos < html_bytes.len() {
        // Look for src=" or href=" patterns
        if current_pos + 5 < html_bytes.len() {
            let slice = &html[current_pos..];

            if let Some(attr_start) = slice.find("src=\"/").or_else(|| slice.find("href=\"/")) {
                // Copy everything up to the attribute
                result.push_str(&html[current_pos..current_pos + attr_start]);
                current_pos += attr_start;

                // Check if it's src or href
                let is_src = html[current_pos..].starts_with("src");
                let attr_name = if is_src { "src" } else { "href" };

                // Copy attribute name and ="
                result.push_str(attr_name);
                result.push_str("=\"");
                current_pos += attr_name.len() + 2; // skip attr="

                // Now we're at the / - replace with full URL
                result.push_str(offline_server);

                // Find the closing quote
                if let Some(quote_end) = html[current_pos..].find('"') {
                    // Copy the path including the closing quote
                    result.push_str(&html[current_pos..current_pos + quote_end + 1]);
                    current_pos += quote_end + 1;
                } else {
                    // No closing quote found, just copy rest
                    result.push_str(&html[current_pos..]);
                    break;
                }
            } else {
                // No more src=" or href=" found
                result.push_str(&html[current_pos..]);
                break;
            }
        } else {
            // Not enough characters left
            result.push_str(&html[current_pos..]);
            break;
        }
    }

    result
}

/// Handle API requests in offline mode
/// Returns appropriate mock responses or error responses
fn handle_api_offline(path: &str) -> Response<Body> {
    println!("[OfflineServer] API request in offline mode: {}", path);

    // For auth-redirect, return a response that won't trigger navigation
    if path.starts_with("api/auth-redirect") {
        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .body(Body::from(r#"{"offline":true,"redirect":null}"#))
            .unwrap();
    }

    // For health check
    if path == "api/health" {
        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .body(Body::from(r#"{"status":"offline"}"#))
            .unwrap();
    }

    // For custom-domains - return the expected domain configuration
    // This is critical for the app to know which tenant to use
    if path.starts_with("api/custom-domains") {
        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .body(Body::from(r#"{"offline":true,"domain":"iblai.app"}"#))
            .unwrap();
    }

    // For public-settings - return minimal settings for offline mode
    if path.starts_with("api/public-settings") {
        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .body(Body::from(r#"{"offline":true}"#))
            .unwrap();
    }

    // Default API offline response
    Response::builder()
        .status(StatusCode::SERVICE_UNAVAILABLE)
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(Body::from(format!(
            r#"{{"error":"offline","message":"API not available in offline mode","path":"{}"}}"#,
            path
        )))
        .unwrap()
}

async fn serve_cached_url(state: &AppState, url: &str) -> Response<Body> {
    log_to_file(&format!("serve_cached_url called for: {}", url));
    let cache_guard = state.cache.read().await;

    let cache = match cache_guard.as_ref() {
        Some(c) => c,
        None => {
            log_to_file("ERROR: Cache not initialized!");
            return Response::builder()
                .status(StatusCode::INTERNAL_SERVER_ERROR)
                .body(Body::from("Cache not initialized"))
                .unwrap();
        }
    };

    match cache.fetch(url).await {
        Ok(response) => {
            log_to_file(&format!(
                "Cache HIT for: {} (status: {})",
                url, response.status
            ));
            let content_type = response.content_type.clone();
            let mut body = response.body;

            let mut builder = Response::builder()
                .status(response.status)
                .header(header::CONTENT_TYPE, content_type.clone())
                .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*");

            // For HTML responses, strip restrictive CSP and inject webpack config
            if content_type.contains("text/html") {
                // Convert body to string for manipulation
                if let Ok(mut html) = String::from_utf8(body.clone()) {
                    // Remove any CSP meta tags that might block localStorage
                    html = html.replace(
                        r#"<meta http-equiv="Content-Security-Policy""#,
                        r#"<meta http-equiv="X-Removed-CSP""#,
                    );

                    // Inject webpack public path and fetch interceptor at the very
                    // start of <head>. This MUST run before any other scripts to
                    // ensure webpack initializes correctly.
                    html =
                        html.replace(r#"<head>"#, &format!(r#"<head>{}"#, webpack_init_script()));

                    // Rewrite relative URLs in src/href attributes to point to offline server
                    // This is a simple replacement that handles most cases
                    html = rewrite_asset_urls(&html);

                    body = html.into_bytes();
                }

                builder = builder
                    .header(
                        "Content-Security-Policy",
                        "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;",
                    )
                    .header("X-Frame-Options", "ALLOWALL")
                    .header("Access-Control-Allow-Credentials", "true");
            }

            builder.body(Body::from(body)).unwrap()
        }
        Err(e) => {
            log_to_file(&format!("Cache MISS for: {} (error: {})", url, e));
            // For HTML requests, return a basic offline page
            // Check if this looks like a root URL or page route (not a static asset)
            let is_root_or_page = url == state.app_origin
                || url.ends_with('/')
                || !url.split('/').last().unwrap_or("").contains('.');
            if is_root_or_page {
                return offline_fallback_page();
            }

            Response::builder()
                .status(StatusCode::NOT_FOUND)
                .header(header::CONTENT_TYPE, "text/plain")
                .body(Body::from(format!("Not found in cache: {}", e)))
                .unwrap()
        }
    }
}

fn offline_fallback_page() -> Response<Body> {
    let html = r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ibl.ai - Offline</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: white;
        }
        .container { text-align: center; padding: 2rem; }
        h1 { font-size: 1.5rem; margin-bottom: 1rem; }
        p { color: rgba(255,255,255,0.7); margin-bottom: 1.5rem; }
        button {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 0.5rem;
            cursor: pointer;
            font-size: 1rem;
        }
        button:hover { background: #2563eb; }
    </style>
</head>
<body>
    <div class="container">
        <h1>ibl.ai</h1>
        <p>The app content hasn't been cached yet.<br>Please connect to the internet to load the app first.</p>
        <button onclick="location.reload()">Retry</button>
    </div>
</body>
</html>"#;

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/html")
        .body(Body::from(html))
        .unwrap()
}

/// Check if the offline server is running by hitting the health endpoint
pub async fn is_server_running() -> bool {
    let url = format!("{}/_health", get_server_url());

    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(2))
        .build()
    {
        Ok(c) => c,
        Err(_) => return false,
    };

    match client.get(&url).send().await {
        Ok(resp) => {
            let is_ok = resp.status().is_success();
            println!("[OfflineServer] Health check result: {}", is_ok);
            is_ok
        }
        Err(e) => {
            println!("[OfflineServer] Health check failed: {}", e);
            false
        }
    }
}

/// Get the offline server URL. Reads the port the server actually bound, which
/// is only the preferred one when that port was free at startup.
pub fn get_server_url() -> String {
    format!("http://127.0.0.1:{}", active_port())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::Ordering;

    /// Serializes the tests that write ACTIVE_PORT — it is process-global, so
    /// parallel set-then-assert sequences interleave and flake.
    fn port_state_lock() -> std::sync::MutexGuard<'static, ()> {
        static L: std::sync::Mutex<()> = std::sync::Mutex::new(());
        L.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// Restores whatever port was recorded, so one test's fake port can't leak
    /// into the next.
    struct PortGuard(u16);
    impl Drop for PortGuard {
        fn drop(&mut self) {
            ACTIVE_PORT.store(self.0, Ordering::Relaxed);
        }
    }
    fn with_port(port: u16) -> PortGuard {
        let previous = active_port();
        ACTIVE_PORT.store(port, Ordering::Relaxed);
        PortGuard(previous)
    }

    /// The happy path: 3457 is free, so the documented port is the one served.
    ///
    /// Retried across candidates: "reserve an ephemeral port, release it, bind
    /// it again" races the sibling port tests, which the OS is happy to hand
    /// the just-released number. One stolen candidate is a scheduling accident;
    /// five in a row is a real preference bug.
    #[tokio::test]
    async fn a_free_preferred_port_is_the_one_bound() {
        for _ in 0..5 {
            let free = tokio::net::TcpListener::bind("127.0.0.1:0")
                .await
                .unwrap()
                .local_addr()
                .unwrap()
                .port();

            let listener = bind_with_fallback(free).await.expect("some port binds");
            if listener.local_addr().unwrap().port() == free {
                return;
            }
        }
        panic!("a free preferred port was never the one chosen");
    }

    /// The whole point: a busy 3457 must move the server, not disable offline
    /// mode. The old code adopted the occupant or gave up.
    #[tokio::test]
    async fn a_busy_preferred_port_falls_back_instead_of_failing() {
        // Held for the duration, so the preferred port is genuinely occupied.
        let squatter = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let taken = squatter.local_addr().unwrap().port();

        let listener = bind_with_fallback(taken)
            .await
            .expect("a busy port must not stop the server");
        assert_ne!(
            listener.local_addr().unwrap().port(),
            taken,
            "the occupied port cannot be handed out"
        );
    }

    /// Every URL consumer reads the recorded port, so a fallback reaches them
    /// all — the health check, the `mentor://` proxy and the injected scripts.
    #[test]
    fn the_server_url_follows_the_port_actually_bound() {
        let _guard = port_state_lock();
        let _restore = with_port(31457);
        assert_eq!(get_server_url(), "http://127.0.0.1:31457");
    }

    /// The injected script is what tells the webview where to fetch from: a
    /// stale port here silently breaks every asset and API call in offline mode.
    #[test]
    fn the_injected_script_carries_the_bound_port() {
        let _guard = port_state_lock();
        let _restore = with_port(31458);

        let script = webpack_init_script();
        assert!(
            script.contains(r#"var OFFLINE_SERVER = "http://127.0.0.1:31458";"#),
            "{script}"
        );
        assert!(
            !script.contains("__OFFLINE_SERVER_URL__"),
            "the placeholder must be substituted, not shipped: {script}"
        );
        assert!(
            !script.contains("3457"),
            "no hardcoded default may survive: {script}"
        );
    }

    /// Asset rewriting points at the same live port as everything else.
    #[test]
    fn rewritten_asset_urls_use_the_bound_port() {
        let _guard = port_state_lock();
        let _restore = with_port(31459);

        let out = rewrite_asset_urls(r#"<img src="/logo.png">"#);
        assert!(out.contains("http://127.0.0.1:31459/logo.png"), "{out}");
    }
}
