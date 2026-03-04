use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;

const CACHE_DIR: &str = "web_cache";
const CACHE_INDEX_FILE: &str = "index.json";
const CACHE_MAX_AGE_SECS: u64 = 7 * 24 * 60 * 60; // 7 days
const CACHE_VERSION: u32 = 2; // Increment this when cache format changes

// Helper function to log to file
fn log_to_file(message: &str) {
    let log_path = std::env::temp_dir().join("mentor_offline_server.log");
    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
    {
        let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
        writeln!(file, "[{}] {}", timestamp, message).ok();
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedEntry {
    pub url: String,
    pub status: u16,
    pub content_type: String,
    pub headers: HashMap<String, String>,
    pub body_hash: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CacheIndex {
    pub version: u32,
    pub entries: HashMap<String, CachedEntry>,
}

pub struct WebCache {
    client: Client,
    cache_dir: PathBuf,
    index: Arc<RwLock<CacheIndex>>,
    is_online: Arc<RwLock<bool>>,
}

impl WebCache {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let cache_dir = app_data_dir.join(CACHE_DIR);
        fs::create_dir_all(&cache_dir).ok();

        let index = Self::load_index(&cache_dir);

        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .unwrap_or_default(),
            cache_dir,
            index: Arc::new(RwLock::new(index)),
            is_online: Arc::new(RwLock::new(true)),
        }
    }

    fn load_index(cache_dir: &PathBuf) -> CacheIndex {
        let index_path = cache_dir.join(CACHE_INDEX_FILE);
        if let Ok(data) = fs::read_to_string(&index_path) {
            log_to_file(&format!("[WebCache] load_index: Read {} bytes from index.json", data.len()));

            // Try to parse as raw JSON first to count entries
            if let Ok(raw_json) = serde_json::from_str::<serde_json::Value>(&data) {
                if let Some(entries_obj) = raw_json.get("entries") {
                    if let Some(entries_map) = entries_obj.as_object() {
                        log_to_file(&format!("[WebCache] load_index: index.json contains {} entries in raw JSON", entries_map.len()));

                        // Check for 7427.js specifically
                        let has_7427 = entries_map.keys().any(|k| k.contains("7427") || k.contains("7247"));
                        log_to_file(&format!("[WebCache] load_index: index.json contains 7427.js entry: {}", has_7427));
                        if has_7427 {
                            for key in entries_map.keys() {
                                if key.contains("7427") || key.contains("7247") {
                                    log_to_file(&format!("[WebCache] load_index: Found key: {}", key));
                                }
                            }
                        }
                    }
                }
            }

            if let Ok(index) = serde_json::from_str::<CacheIndex>(&data) {
                log_to_file(&format!("[WebCache] load_index: Deserialized CacheIndex with {} entries", index.entries.len()));

                // Check if cache version matches - if not, clear the cache
                if index.version != CACHE_VERSION {
                    log_to_file(&format!(
                        "[WebCache] Cache version mismatch (found: {}, expected: {}). Clearing cache...",
                        index.version, CACHE_VERSION
                    ));
                    // Delete all cached files
                    if let Ok(entries) = fs::read_dir(cache_dir) {
                        for entry in entries.flatten() {
                            if entry.path().is_file() {
                                fs::remove_file(entry.path()).ok();
                            }
                        }
                    }
                    // Return fresh index with new version
                    return CacheIndex {
                        version: CACHE_VERSION,
                        entries: HashMap::new(),
                    };
                }

                // Check if 7427.js is in the deserialized index
                let has_7427_after = index.entries.keys().any(|k| k.contains("7427") || k.contains("7247"));
                log_to_file(&format!("[WebCache] load_index: Deserialized index contains 7427.js entry: {}", has_7427_after));
                if has_7427_after {
                    for key in index.entries.keys() {
                        if key.contains("7427") || key.contains("7247") {
                            log_to_file(&format!("[WebCache] load_index: Deserialized key: {}", key));
                        }
                    }
                }

                return index;
            } else {
                log_to_file("[WebCache] load_index: Failed to deserialize CacheIndex from JSON");
            }
        } else {
            log_to_file("[WebCache] load_index: Failed to read index.json file");
        }
        // No index file or parse error - create fresh index
        CacheIndex {
            version: CACHE_VERSION,
            entries: HashMap::new(),
        }
    }

    async fn save_index(&self) {
        let index = self.index.read().await;
        let index_path = self.cache_dir.join(CACHE_INDEX_FILE);
        if let Ok(data) = serde_json::to_string_pretty(&*index) {
            fs::write(index_path, data).ok();
        }
    }

    fn url_to_hash(url: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(url.as_bytes());
        hex::encode(hasher.finalize())
    }

    pub async fn set_online(&self, online: bool) {
        let mut is_online = self.is_online.write().await;
        *is_online = online;
    }

    pub async fn is_online(&self) -> bool {
        *self.is_online.read().await
    }

    pub async fn fetch(&self, url: &str) -> Result<CacheResponse, String> {
        let is_online = self.is_online().await;
        log_to_file(&format!("[WebCache] fetch called for: {} (is_online: {})", url, is_online));

        if is_online {
            // Try network first
            log_to_file(&format!("[WebCache] Trying network fetch for: {}", url));
            match self.fetch_from_network(url).await {
                Ok(response) => {
                    log_to_file(&format!("[WebCache] Network fetch succeeded for: {}", url));
                    // Cache successful responses
                    if response.status < 400 {
                        self.store_in_cache(url, &response).await;
                    }
                    return Ok(response);
                }
                Err(e) => {
                    log_to_file(&format!("[WebCache] Network fetch failed: {}, trying cache", e));

                    // CRITICAL: If network fetch fails, we're likely offline
                    // Update the online status to avoid wasting time on future requests
                    if e.contains("error sending request") || e.contains("dns error") || e.contains("tcp connect") {
                        log_to_file("[WebCache] Network error detected, setting offline mode");
                        self.set_online(false).await;
                    }

                    // Fall through to cache
                }
            }
        }

        // Try cache
        log_to_file(&format!("[WebCache] Trying cache for: {}", url));
        if let Some(cached) = self.get_from_cache(url).await {
            log_to_file(&format!("[WebCache] Serving from cache: {}", url));
            return Ok(cached);
        }

        log_to_file(&format!("[WebCache] Not found in cache: {}", url));
        Err(format!(
            "Failed to fetch {} - offline and not in cache",
            url
        ))
    }

    async fn fetch_from_network(&self, url: &str) -> Result<CacheResponse, String> {
        println!("[WebCache] Fetching from network: {}", url);

        let response = self
            .client
            .get(url)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let status = response.status().as_u16();
        let mut headers = HashMap::new();
        let mut content_type = "application/octet-stream".to_string();

        for (key, value) in response.headers() {
            if let Ok(v) = value.to_str() {
                if key.as_str().eq_ignore_ascii_case("content-type") {
                    content_type = v.to_string();
                }
                headers.insert(key.to_string(), v.to_string());
            }
        }

        let body = response.bytes().await.map_err(|e| e.to_string())?;

        Ok(CacheResponse {
            status,
            content_type,
            headers,
            body: body.to_vec(),
        })
    }

    async fn store_in_cache(&self, url: &str, response: &CacheResponse) {
        let hash = Self::url_to_hash(url);
        let body_path = self.cache_dir.join(&hash);

        // Save body to file
        if fs::write(&body_path, &response.body).is_err() {
            return;
        }

        let entry = CachedEntry {
            url: url.to_string(),
            status: response.status,
            content_type: response.content_type.clone(),
            headers: response.headers.clone(),
            body_hash: hash,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        };

        let mut index = self.index.write().await;
        index.entries.insert(url.to_string(), entry);
        drop(index);

        self.save_index().await;
    }

    async fn get_from_cache(&self, url: &str) -> Option<CacheResponse> {
        let index = self.index.read().await;
        log_to_file(&format!("[WebCache] get_from_cache: Looking for URL: {}", url));
        log_to_file(&format!("[WebCache] get_from_cache: Index has {} entries", index.entries.len()));
        let entry = index.entries.get(url);
        if entry.is_none() {
            log_to_file("[WebCache] get_from_cache: URL not found in index!");
            return None;
        }
        let entry = entry.unwrap();

        // Check if cache is too old
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        if now - entry.timestamp > CACHE_MAX_AGE_SECS {
            log_to_file(&format!("[WebCache] get_from_cache: Cache entry expired (age: {} seconds)", now - entry.timestamp));
            return None;
        }

        let body_path = self.cache_dir.join(&entry.body_hash);
        log_to_file(&format!("[WebCache] get_from_cache: Reading body from: {:?}", body_path));
        let body = match fs::read(&body_path) {
            Ok(b) => {
                log_to_file(&format!("[WebCache] get_from_cache: Successfully read {} bytes", b.len()));
                b
            },
            Err(e) => {
                log_to_file(&format!("[WebCache] get_from_cache: Failed to read body file: {}", e));
                return None;
            }
        };

        Some(CacheResponse {
            status: entry.status,
            content_type: entry.content_type.clone(),
            headers: entry.headers.clone(),
            body,
        })
    }

    /// Store a response in cache (public API for direct caching)
    pub async fn store_response(&self, url: &str, response: &CacheResponse) {
        self.store_in_cache(url, response).await;
    }

    /// Get a cached response directly (public API)
    pub async fn get_cached(&self, url: &str) -> Option<CacheResponse> {
        self.get_from_cache(url).await
    }

    /// Get all cached URLs (for pattern matching)
    pub async fn get_cached_urls(&self) -> Vec<String> {
        let index = self.index.read().await;
        index.entries.keys().cloned().collect()
    }

    pub async fn clear(&self) -> Result<(), String> {
        {
            let mut index = self.index.write().await;
            index.entries.clear();
        }
        self.save_index().await;

        // Remove all files except index
        if let Ok(entries) = fs::read_dir(&self.cache_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file()
                    && path
                        .file_name()
                        .map(|n| n != CACHE_INDEX_FILE)
                        .unwrap_or(false)
                {
                    fs::remove_file(path).ok();
                }
            }
        }

        Ok(())
    }

    pub async fn get_stats(&self) -> CacheStats {
        let index = self.index.read().await;
        let count = index.entries.len();

        let mut total_size: u64 = 0;
        for entry in index.entries.values() {
            let path = self.cache_dir.join(&entry.body_hash);
            if let Ok(meta) = fs::metadata(&path) {
                total_size += meta.len();
            }
        }

        CacheStats {
            entry_count: count,
            total_size_bytes: total_size,
        }
    }

    /// Pre-cache a URL and all its linked assets (JS, CSS)
    pub async fn precache_with_assets(&self, base_url: &str) -> Result<PrecacheResult, String> {
        let mut cached_urls = Vec::new();
        let mut failed_urls = Vec::new();

        // Extract the origin from the URL for caching the root
        let origin = if let Some(idx) = base_url.find("://") {
            let after_protocol = &base_url[idx + 3..];
            if let Some(path_start) = after_protocol.find('/') {
                &base_url[..idx + 3 + path_start]
            } else {
                base_url
            }
        } else {
            base_url
        };

        println!("[WebCache] Precaching with origin: {}", origin);

        // First, cache the root URL (needed for SPA routing)
        if origin != base_url {
            match self.fetch(origin).await {
                Ok(_) => {
                    println!("[WebCache] Cached root: {}", origin);
                    cached_urls.push(origin.to_string());
                }
                Err(e) => {
                    println!("[WebCache] Failed to cache root: {}", e);
                }
            }
        }

        // Then fetch the specific page
        let response = self.fetch(base_url).await?;
        cached_urls.push(base_url.to_string());

        // Parse HTML to find asset URLs
        let html = String::from_utf8_lossy(&response.body);
        let asset_urls = Self::extract_asset_urls(&html, origin);

        println!(
            "[WebCache] Found {} assets to pre-cache from {}",
            asset_urls.len(),
            base_url
        );

        // Fetch each asset
        for url in asset_urls {
            match self.fetch(&url).await {
                Ok(_) => {
                    println!("[WebCache] Cached: {}", url);
                    cached_urls.push(url);
                }
                Err(e) => {
                    println!("[WebCache] Failed to cache {}: {}", url, e);
                    failed_urls.push(url);
                }
            }
        }

        Ok(PrecacheResult {
            cached_count: cached_urls.len(),
            failed_count: failed_urls.len(),
            cached_urls,
        })
    }

    /// Extract asset URLs from HTML
    fn extract_asset_urls(html: &str, base_url: &str) -> Vec<String> {
        let mut urls = Vec::new();

        // Simple regex-like parsing for src="/_next/..." and href="/_next/..."
        // We'll use a basic approach since we don't have regex crate
        let patterns = [
            (r#"src="/_next/"#, r#"""#),
            (r#"href="/_next/"#, r#"""#),
            (r#"src='/_next/"#, r#"'"#),
            (r#"href='/_next/"#, r#"'"#),
        ];

        for (start_pattern, end_char) in patterns {
            let mut search_from = 0;
            while let Some(start_idx) = html[search_from..].find(start_pattern) {
                let actual_start = search_from + start_idx + start_pattern.len() - 7; // -7 to include /_next/
                if let Some(end_idx) = html[actual_start..].find(end_char) {
                    let path = &html[actual_start..actual_start + end_idx];
                    let full_url = format!("{}{}", base_url, path);
                    if !urls.contains(&full_url) {
                        urls.push(full_url);
                    }
                }
                search_from = search_from + start_idx + 1;
            }
        }

        urls
    }

    /// Extract image URLs from cached API responses and cache them
    /// This caches external images (S3, Gravatar, etc.) referenced in API responses
    pub async fn cache_images_from_api_responses(&self) -> Result<PrecacheResult, String> {
        let mut cached_urls = Vec::new();
        let mut failed_urls = Vec::new();

        println!("[WebCache] Extracting image URLs from cached API responses...");

        // Get all cached URLs
        let cached_api_urls = self.get_cached_urls().await;

        // Filter for API endpoints that likely contain image URLs
        let api_endpoints: Vec<String> = cached_api_urls
            .iter()
            .filter(|url| {
                url.contains("/api/") && (
                    url.contains("/mentors") ||
                    url.contains("/users") ||
                    url.contains("/prompts") ||
                    url.contains("/messages") ||
                    url.contains("/settings")
                )
            })
            .cloned()
            .collect();

        println!("[WebCache] Found {} API endpoints to scan for images", api_endpoints.len());

        let mut all_image_urls = Vec::new();

        // Extract image URLs from each API response
        for api_url in api_endpoints {
            if let Some(response) = self.get_cached(&api_url).await {
                // Try to parse as JSON
                if let Ok(json_str) = String::from_utf8(response.body.clone()) {
                    // Look for common image URL patterns in JSON
                    let image_urls = Self::extract_image_urls_from_json(&json_str);
                    for url in image_urls {
                        if !all_image_urls.contains(&url) {
                            all_image_urls.push(url);
                        }
                    }
                }
            }
        }

        println!("[WebCache] Found {} unique image URLs to cache", all_image_urls.len());

        // Cache each image
        for image_url in all_image_urls {
            match self.fetch(&image_url).await {
                Ok(_) => {
                    println!("[WebCache] Cached image: {}", image_url);
                    cached_urls.push(image_url);
                }
                Err(e) => {
                    println!("[WebCache] Failed to cache image {}: {}", image_url, e);
                    failed_urls.push(image_url);
                }
            }
        }

        Ok(PrecacheResult {
            cached_count: cached_urls.len(),
            failed_count: failed_urls.len(),
            cached_urls,
        })
    }

    /// Extract image URLs from JSON string
    /// Looks for common patterns like "profile_image", "imageUrl", "avatar", etc.
    fn extract_image_urls_from_json(json_str: &str) -> Vec<String> {
        let mut urls = Vec::new();

        // Image field patterns to look for
        let patterns = [
            r#""profile_image":"#,
            r#""imageUrl":"#,
            r#""avatar":"#,
            r#""image":"#,
            r#""picture":"#,
            r#""photo":"#,
            r#""thumbnail":"#,
        ];

        for pattern in patterns {
            let mut search_from = 0;
            while let Some(start_idx) = json_str[search_from..].find(pattern) {
                let value_start = search_from + start_idx + pattern.len();
                // Find the end quote
                if let Some(end_idx) = json_str[value_start..].find('"') {
                    let url = &json_str[value_start..value_start + end_idx];
                    // Only include URLs (not empty strings or null values)
                    if url.starts_with("http") && !urls.contains(&url.to_string()) {
                        urls.push(url.to_string());
                    }
                }
                search_from = value_start;
            }
        }

        urls
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrecacheResult {
    pub cached_count: usize,
    pub failed_count: usize,
    pub cached_urls: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct CacheResponse {
    pub status: u16,
    pub content_type: String,
    pub headers: HashMap<String, String>,
    pub body: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStats {
    pub entry_count: usize,
    pub total_size_bytes: u64,
}
