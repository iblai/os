//! Sentry reporting for the Rust side of the app.
//!
//! The WebView already reports its own errors (`sentry.client.config.ts`),
//! but nothing here did: a Rust failure existed only as a line on a stderr
//! no desktop user ever reads, so a background installer that 404s showed as
//! a spinner that never resolves and produced no signal at all.
//!
//! Deliberately the native Rust SDK rather than a Tauri event the WebView
//! turns into `Sentry.captureException`:
//!
//! - The WebView runs the DEPLOYED web app, which can be older than this
//!   binary (the same skew `coding-mode-button.tsx` works around), so a
//!   listener for a new event may simply not exist on a user's machine —
//!   reporting that silently stops working is worse than none.
//! - A bridge covers nothing before the WebView loads: all of `setup()` and
//!   the installers spawned there, which is where the failures worth knowing
//!   about happen.
//! - Rust frames would arrive as JavaScript-platform events and group as
//!   noise.
//!
//! Reports into the SAME self-hosted project as the web app
//! (`sentry.client.config.ts`), so this needs no setup to work and both halves
//! of one user's bad session land in one place. Two things keep the Rust
//! events findable in a project whose console integration reports every
//! `console.error` of a streaming chat app: the `runtime` tag below, and a
//! `release` of `ibl-ai-os@<version>` rather than the web app's.
//!
//! Grouping is safe to share because every [`report`] sets its own
//! `fingerprint` and panics group on the Rust stack — nothing here leans on
//! Sentry's default algorithm. Splitting later needs no code change: set
//! `IBL_SENTRY_DSN_DESKTOP` to a new project's DSN.
//!
//! Scope, by decision: error events only, no performance tracing (the web
//! side already samples that, and nothing consumes Rust traces). Rust panics
//! are covered; an abort or a segfault inside the `llama-cpp-2` FFI is NOT —
//! that needs minidumps and a separate monitoring process, which is not part
//! of this.

use std::borrow::Cow;
use std::fmt::Display;

use sentry::protocol::{Event, Value};
use sentry::types::Dsn;
use sentry::{ClientInitGuard, ClientOptions, Level, TracesSamplingStrategy};

/// `settings.json` key: `false` turns reporting off for this machine.
/// Absent means on — the opt-out has to be chosen, not defaulted into.
const SETTINGS_TELEMETRY: &str = "telemetry";

/// Env name for the DSN override, read at runtime first (so a dev build can
/// be aimed at a scratch project from `.env.local`), then from the value
/// `build.rs` baked in, then [`DEFAULT_DSN`].
const DSN_VAR: &str = "IBL_SENTRY_DSN_DESKTOP";

/// The web app's project, shared by default — same literal as the fallback in
/// `sentry.client.config.ts` / `components/sentry-init.tsx`. A DSN is a public
/// ingest key, not a secret: this one already ships in the web bundle under
/// `NEXT_PUBLIC_IBL_SENTRY_DSN`.
const DEFAULT_DSN: &str =
    "https://f953ef66c4e0d5bda480069132dc9aee@sentry.ibl.network/33";

/// Start reporting. Returns the guard, which **must be bound to a named
/// local** for the lifetime of the process: `let _sentry = …`. A bare
/// `let _ = …` drops it immediately and every queued event dies with it.
///
/// Returns `None` — and reports nothing, at zero cost — when the machine has
/// opted out, when the configured DSN is unusable, or in a debug build that
/// hasn't opted in. Call it AFTER the dotenv loads (so a DSN override in
/// `.env.local` is visible) and BEFORE `tauri::Builder`, so `setup()` and
/// every task spawned there is already covered.
pub fn init() -> Option<ClientInitGuard> {
    // Dev noise would drown the production signal they share an issue
    // stream with, so a debug build has to ask.
    if cfg!(debug_assertions) && std::env::var_os("IBL_SENTRY_DEBUG").is_none() {
        return None;
    }
    if opted_out() {
        return None;
    }
    install_crypto_provider();
    let guard = sentry::init((dsn()?, options()));

    sentry::configure_scope(|scope| {
        // The one filter that separates these events from the web app's in the
        // shared project. `is:unresolved runtime:tauri-rust` is the Rust view,
        // and an alert rule can scope to it.
        scope.set_tag("runtime", "tauri-rust");
        // An anonymous per-install id (8 hex chars, no identity in it) so an
        // issue can be counted in machines rather than events. Reusing Code's
        // existing `device-id` rather than minting a second one keeps one id
        // per install.
        if let Some(id) = install_id() {
            scope.set_user(Some(sentry::User {
                id: Some(id),
                ..Default::default()
            }));
        }
    });
    Some(guard)
}

/// Install the process-wide rustls crypto provider, BEFORE `sentry::init`.
///
/// Not optional. sentry's transport is reqwest 0.13, built eagerly inside
/// `sentry::init`, and it resolves its provider as "whatever is installed
/// process-wide, else our compiled-in default" — where that default is a bare
/// `panic!` under the `rustls-no-provider` feature this crate uses. Nothing
/// else in this process installs one (the app's own reqwest 0.12 only reads
/// the default, it never sets it), so without this call `init` would crash the
/// app at launch: the very failure mode `dsn()` is hardened against, arriving
/// by another door. `cargo test` never builds a transport, so no unit test
/// would have caught it either — hence the explicit client build in the tests.
///
/// `install_default` errs only when a provider is already installed, which is
/// a perfectly good outcome.
fn install_crypto_provider() {
    let _ = rustls::crypto::ring::default_provider().install_default();
}

/// `ClientOptions` is `#[non_exhaustive]`, so these are assigned rather than
/// written as a struct literal. Split out from [`init`] so the privacy-relevant
/// choices are assertable without opening a client.
fn options() -> ClientOptions {
    let mut options = ClientOptions::default();
    options.release = Some(Cow::Owned(format!(
        "ibl-ai-os@{}",
        env!("IBL_APP_VERSION")
    )));
    options.environment = Some(Cow::Borrowed(if cfg!(debug_assertions) {
        "dev"
    } else {
        "production"
    }));
    // This app holds platform tokens, a minted IBLAI_API_KEY and the user's own
    // file paths. Nothing is sent on trust: `send_default_pii` off, and
    // `before_send` scrubs what slipped into a message anyway.
    options.send_default_pii = false;
    options.before_send = Some(std::sync::Arc::new(|mut event| {
        scrub_event(&mut event);
        Some(event)
    }));
    // A reported message carries the reporting thread's stack, which is what
    // makes `report("…")` locatable without a per-site line number.
    options.attach_stacktrace = true;
    // Errors only. Rust performance traces have no consumer here, and this is
    // the SDK default — pinned explicitly so a default change can't start
    // billing us for transactions nobody reads.
    options.traces_sampling_strategy = TracesSamplingStrategy::Disabled;
    options.max_breadcrumbs = 50;
    options
}

/// The signed-in tenant, applied to every event in [`scrub_event`].
///
/// NOT `configure_scope`: that writes the CURRENT hub's scope, which is
/// thread-local. This is called from a tokio worker on the Code spawn path, so
/// a scope write would have tagged only the events that same worker captured —
/// leaving reports from the installers, the LLM thread and `emit_on_main`
/// untagged, which is most of them. A static read in `before_send` reaches
/// every event from every thread.
///
/// (The `runtime` tag and install id set during [`init`] are fine on the scope:
/// threads spawned afterwards inherit it via `Hub::new_from_top`.)
static TENANT: std::sync::Mutex<Option<String>> = std::sync::Mutex::new(None);

/// Tag every later event with the signed-in tenant, so a Rust issue can be
/// matched to the organization that hit it (and to the web app's own events).
/// Called once the tenant is known — the Rust side starts up without one.
pub fn set_tenant(tenant: &str) {
    if tenant.is_empty() {
        return;
    }
    *TENANT.lock().unwrap_or_else(|e| e.into_inner()) = Some(tenant.to_string());
}

fn tenant() -> Option<String> {
    TENANT.lock().unwrap_or_else(|e| e.into_inner()).clone()
}

/// Report a failure, and print it exactly as the `eprintln!` it replaced did.
///
/// `context` is the grouping key, so it must be a STABLE string — one issue
/// per failure site, with the varying error text as a detail inside it.
/// Interpolating an error, a path or an id into `context` splits that one
/// issue into thousands.
pub fn report(context: &str, err: impl Display) {
    emit(context, err, Level::Error);
}

/// As [`report`], at warning level — for a failure that is expected to happen
/// routinely for ordinary reasons (being offline) and so would drown the
/// error stream, but whose rate is still worth watching.
pub fn report_warning(context: &str, err: impl Display) {
    emit(context, err, Level::Warning);
}

/// As [`report`], but captured at most once per process — for a site inside a
/// hot loop, where one underlying fault produces an event per iteration.
///
/// `emit_on_main` is the case this exists for: it runs per streamed token, and
/// once the main thread's event loop is gone (the app is quitting) EVERY
/// remaining emit fails. Unbounded, a single quit mid-stream would spend the
/// project's quota on hundreds of copies of one fact. Still prints every time,
/// so a terminal shows the real rate.
pub fn report_once(context: &str, err: impl Display) {
    if first_time(context) {
        emit(context, err, Level::Error);
    } else {
        eprintln!("{context}: {err}");
    }
}

/// Whether `context` has not been seen before in this process.
fn first_time(context: &str) -> bool {
    static SEEN: std::sync::Mutex<Option<std::collections::HashSet<String>>> =
        std::sync::Mutex::new(None);
    SEEN.lock()
        .unwrap_or_else(|e| e.into_inner())
        .get_or_insert_with(Default::default)
        .insert(context.to_string())
}

fn emit(context: &str, err: impl Display, level: Level) {
    let detail = err.to_string();
    eprintln!("{context}: {detail}");
    let mut event = Event {
        message: Some(context.to_string()),
        level,
        fingerprint: Cow::Owned(vec![Cow::Owned(context.to_string())]),
        ..Default::default()
    };
    event
        .extra
        .insert("error".to_string(), Value::String(detail));
    sentry::capture_event(event);
}

/// The configured DSN, PARSED — never handed to `sentry::init` as a string.
///
/// `ClientOptions::from` does `into_dsn().expect("invalid value for DSN")`, so
/// a malformed value panics the process. That value can come from CI: a typo'd
/// or shell-quoted `IBL_SENTRY_DSN_DESKTOP` would be baked by `build.rs` into a
/// binary that dies on launch for every user, before a window ever opens.
/// Reporting is the thing allowed to fail here, so a bad DSN disables it and
/// says why.
fn dsn() -> Option<Dsn> {
    let raw = [
        std::env::var(DSN_VAR).ok(),
        option_env!("IBL_SENTRY_DSN_DESKTOP").map(str::to_string),
        Some(DEFAULT_DSN.to_string()),
    ]
    .into_iter()
    .flatten()
    .map(|s| s.trim().to_string())
    .find(|s| !s.is_empty())?;
    match raw.parse::<Dsn>() {
        Ok(dsn) => Some(dsn),
        Err(e) => {
            eprintln!("[telemetry] ignoring an unusable Sentry DSN: {e}");
            None
        }
    }
}

fn opted_out() -> bool {
    if let Some(v) = std::env::var_os("IBL_TELEMETRY") {
        if v.eq_ignore_ascii_case("off") || v == "0" || v.eq_ignore_ascii_case("false") {
            return true;
        }
    }
    opted_out_in_settings()
}

#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
fn opted_out_in_settings() -> bool {
    crate::opencode_acp::read_settings()
        .get(SETTINGS_TELEMETRY)
        .and_then(|v| v.as_bool())
        .is_some_and(|on| !on)
}

/// Mobile has no `settings.json` owner (`opencode_acp` is desktop-only); the
/// env var is the opt-out there.
#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
fn opted_out_in_settings() -> bool {
    let _ = SETTINGS_TELEMETRY;
    false
}

#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
fn install_id() -> Option<String> {
    Some(crate::opencode_proxy::device_id())
}

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
fn install_id() -> Option<String> {
    None
}

/// Strip from an outgoing event everything that identifies the person at the
/// keyboard, then scrub every free-text field a secret could have reached.
fn scrub_event(event: &mut Event<'static>) {
    // `sentry-contexts` fills this with the machine's hostname, which on a
    // personal Mac is usually the owner's name ("sones-macbook-pro.local").
    event.server_name = None;

    if let Some(tenant) = tenant() {
        event.tags.insert("tenant".to_string(), tenant);
    }

    if let Some(message) = event.message.take() {
        event.message = Some(scrub(&message));
    }
    for exception in &mut event.exception.values {
        if let Some(value) = exception.value.take() {
            exception.value = Some(scrub(&value));
        }
    }
    for crumb in &mut event.breadcrumbs.values {
        if let Some(message) = crumb.message.take() {
            crumb.message = Some(scrub(&message));
        }
    }
    for value in event.extra.values_mut() {
        if let Value::String(s) = value {
            *s = scrub(s);
        }
    }
}

/// Redact the home directory and anything secret-shaped out of one string.
fn scrub(text: &str) -> String {
    redact_secrets(&redact_home(text, home_dir().as_deref()))
}

fn home_dir() -> Option<String> {
    for var in ["HOME", "USERPROFILE"] {
        if let Ok(v) = std::env::var(var) {
            let v = v.trim_end_matches(['/', '\\']).to_string();
            if !v.is_empty() {
                return Some(v);
            }
        }
    }
    None
}

/// `/Users/sone/.local/share/iblai` → `~/.local/share/iblai`. The path shape
/// is what makes a filesystem error diagnosable; the username is not, and it
/// is the one piece of identity that appears in nearly every path we log.
fn redact_home(text: &str, home: Option<&str>) -> String {
    match home.map(|h| h.trim_end_matches(['/', '\\'])) {
        Some(home) if !home.is_empty() => text.replace(home, "~"),
        _ => text.to_string(),
    }
}

/// A key whose value must never leave the machine. Substring matching, so
/// `IBLAI_API_KEY`, `access_token` and `Authorization` all land; it
/// over-redacts (`monkey=`) rather than under-redacts, by design.
fn is_sensitive_key(key: &str) -> bool {
    const WORDS: [&str; 8] = [
        "token",
        "key",
        "secret",
        "password",
        "passwd",
        "authorization",
        "credential",
        "cookie",
    ];
    let key = key.to_ascii_lowercase();
    WORDS.iter().any(|w| key.contains(w))
}

const REDACTED: &str = "[redacted]";

/// Redact secret VALUES while leaving the surrounding text readable, in the
/// three shapes secrets actually appear in here: `KEY=value` (env vars and
/// query strings), `"key": "value"` (JSON bodies) and `Bearer <token>`.
///
/// Only those three. An earlier, looser rule also redacted after any `:`,
/// which ate the real error out of `could not persist IBLAI_API_KEY: <io
/// error>` — the exact text the report exists to carry.
fn redact_secrets(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    let mut out = String::with_capacity(text.len());
    let mut i = 0;
    while i < chars.len() {
        if let Some(next) = redact_bearer(&chars, i, &mut out) {
            i = next;
            continue;
        }
        if let Some(next) = redact_header(&chars, i, &mut out) {
            i = next;
            continue;
        }
        if chars[i] == '"' {
            if let Some(next) = redact_json_pair(&chars, i, &mut out) {
                i = next;
                continue;
            }
        }
        if chars[i] == '=' && is_sensitive_key(&key_before(&chars, i)) {
            // Into a scratch first: a `KEY=` with no value must leave the text
            // untouched, and a half-written `=` cannot be taken back out.
            let mut redacted = String::new();
            if let Some(next) = redact_value(&chars, i + 1, &mut redacted) {
                out.push('=');
                out.push_str(&redacted);
                i = next;
                continue;
            }
        }
        out.push(chars[i]);
        i += 1;
    }
    out
}

/// The bare key token immediately left of `at`: `IBLAI_API_KEY` out of
/// `env IBLAI_API_KEY=…`, `token` out of `…?token=…`.
fn key_before(chars: &[char], at: usize) -> String {
    let mut start = at;
    while start > 0 {
        let c = chars[start - 1];
        if c.is_alphanumeric() || c == '_' || c == '-' || c == '.' {
            start -= 1;
        } else {
            break;
        }
    }
    chars[start..at].iter().collect()
}

/// `"key": "value"` → `"key": "[redacted]"`. Returns the index past the
/// rewritten pair, or `None` when this is not a sensitive quoted pair.
fn redact_json_pair(chars: &[char], at: usize, out: &mut String) -> Option<usize> {
    let (after_key, key) = read_quoted(chars, at)?;
    if !is_sensitive_key(&key) {
        return None;
    }
    let mut i = skip_whitespace(chars, after_key);
    if chars.get(i) != Some(&':') {
        return None;
    }
    i = skip_whitespace(chars, i + 1);
    let (after_value, _) = read_quoted(chars, i)?;
    out.extend(&chars[at..i]);
    out.push('"');
    out.push_str(REDACTED);
    out.push('"');
    Some(after_value)
}

/// Header names whose whole value is a credential. EXACT names, deliberately:
/// a substring rule on `:` is what once ate the real error out of `could not
/// persist IBLAI_API_KEY: <io error>`, and that error text is the entire point
/// of the report. These five carry nothing but the secret.
const SECRET_HEADERS: [&str; 5] = [
    "authorization",
    "proxy-authorization",
    "cookie",
    "set-cookie",
    "x-api-key",
];

/// `Cookie: sessionid=abc` → `Cookie: [redacted]`. The value runs to the end
/// of the line, since a cookie or auth header is one opaque blob that may
/// itself contain `=`, `;` and spaces.
fn redact_header(chars: &[char], at: usize, out: &mut String) -> Option<usize> {
    if at > 0 && !matches!(chars[at - 1], '\n' | '\r' | ' ' | '{' | ',' | '(') {
        return None;
    }
    let name_end = (at..chars.len()).find(|i| chars[*i] == ':')?;
    let name: String = chars[at..name_end].iter().collect();
    let name = name.trim().to_ascii_lowercase();
    if !SECRET_HEADERS.contains(&name.as_str()) {
        return None;
    }
    let value_start = skip_whitespace(chars, name_end + 1);
    let value_end = (value_start..chars.len())
        .find(|i| matches!(chars[*i], '\n' | '\r'))
        .unwrap_or(chars.len());
    if value_end == value_start {
        return None;
    }
    out.extend(&chars[at..value_start]);
    out.push_str(REDACTED);
    Some(value_end)
}

/// `Bearer <token>` → `Bearer [redacted]`, case-insensitive.
///
/// Redacts the next word on sight rather than checking it looks like a
/// credential: a length or charset test would be the one rule here that can
/// fail by leaking, and no log line in this app discusses bearers in prose.
fn redact_bearer(chars: &[char], at: usize, out: &mut String) -> Option<usize> {
    const BEARER: &str = "bearer ";
    if at > 0 && (chars[at - 1].is_alphanumeric() || chars[at - 1] == '_') {
        return None;
    }
    let word: String = chars
        .get(at..at + BEARER.len())?
        .iter()
        .collect::<String>()
        .to_ascii_lowercase();
    if word != BEARER {
        return None;
    }
    let mut redacted = String::new();
    let next = redact_value(chars, at + BEARER.len(), &mut redacted)?;
    out.extend(&chars[at..at + BEARER.len()]);
    out.push_str(&redacted);
    Some(next)
}

/// Replace the value starting at `at` with [`REDACTED`], quoted or bare.
/// `None` when there is no value there to redact.
fn redact_value(chars: &[char], at: usize, out: &mut String) -> Option<usize> {
    if let Some(quote) = chars.get(at).copied().filter(|c| *c == '"' || *c == '\'') {
        let (end, _) = read_delimited(chars, at, quote)?;
        out.push(quote);
        out.push_str(REDACTED);
        out.push(quote);
        return Some(end);
    }
    let mut end = at;
    while end < chars.len() && !is_value_terminator(chars[end]) {
        end += 1;
    }
    if end == at {
        return None;
    }
    out.push_str(REDACTED);
    Some(end)
}

fn is_value_terminator(c: char) -> bool {
    c.is_whitespace() || matches!(c, '&' | '"' | '\'' | ',' | ';' | '}' | ')' | ']')
}

fn read_quoted(chars: &[char], at: usize) -> Option<(usize, String)> {
    (chars.get(at) == Some(&'"')).then(|| read_delimited(chars, at, '"'))?
}

/// The string delimited by `quote` starting at `at`, as (index past the
/// closing quote, contents). `None` when unterminated.
fn read_delimited(chars: &[char], at: usize, quote: char) -> Option<(usize, String)> {
    let mut i = at + 1;
    let mut value = String::new();
    while i < chars.len() {
        match chars[i] {
            '\\' if i + 1 < chars.len() => {
                value.push(chars[i]);
                value.push(chars[i + 1]);
                i += 2;
            }
            c if c == quote => return Some((i + 1, value)),
            c => {
                value.push(c);
                i += 1;
            }
        }
    }
    None
}

/// Any whitespace, not just `' '`: a pretty-printed body puts a newline (and
/// indentation) between the key and its value, and that slipped a secret
/// through [`redact_json_pair`] completely — the `KEY=value` rule does not
/// catch the JSON shape either.
fn skip_whitespace(chars: &[char], at: usize) -> usize {
    let mut i = at;
    while chars.get(i).is_some_and(|c| c.is_whitespace()) {
        i += 1;
    }
    i
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A debug build must stay silent unless it asks — the state every
    /// developer and every `cargo test` run is in. Without this the suite
    /// would post on every run, and since the DSN now defaults to the web
    /// app's, it would post into the project the whole product reports to.
    #[test]
    fn a_debug_build_does_not_report_unless_it_asks() {
        let _g = env_lock();
        let restore = Restore::of(&["IBL_SENTRY_DEBUG"]);
        std::env::remove_var("IBL_SENTRY_DEBUG");
        assert!(cfg!(debug_assertions), "tests only ever run in debug");
        assert!(init().is_none());
        drop(restore);
    }

    /// The override has to actually override, and a blank or whitespace value
    /// (an env var set to nothing by a shell script) must fall through to the
    /// default rather than opening a client on an empty DSN.
    #[test]
    fn the_dsn_override_wins_and_a_blank_one_falls_through() {
        let _g = env_lock();
        let restore = Restore::of(&[DSN_VAR]);
        // `option_env!` only takes a literal, so the compile-time half of
        // `dsn()` cannot reference DSN_VAR. Pin them equal: drift would leave
        // the runtime override reading a name the build never bakes.
        assert_eq!(DSN_VAR, "IBL_SENTRY_DSN_DESKTOP");

        // Compared as parsed values: `Dsn`'s own `to_string` re-serializes an
        // absent secret key as a bare `:`, so round-tripped strings never
        // match what was configured.
        let parse = |s: &str| s.parse::<Dsn>().unwrap();
        std::env::set_var(DSN_VAR, "https://abc@sentry.example/9");
        assert_eq!(dsn(), Some(parse("https://abc@sentry.example/9")));
        for blank in ["", "   "] {
            std::env::set_var(DSN_VAR, blank);
            assert_eq!(
                dsn(),
                Some(parse(DEFAULT_DSN)),
                "a blank override is not a DSN"
            );
        }
        drop(restore);
    }

    /// `ClientOptions::from` does `into_dsn().expect(...)`, so handing it an
    /// unparseable string panics the process. The value can come from CI, where
    /// a typo or a shell-quoted DSN would be baked into a release that then
    /// dies on launch for every user, before a window opens. Reporting is what
    /// is allowed to fail here — never the app.
    #[test]
    fn an_unusable_dsn_disables_reporting_instead_of_panicking() {
        let _g = env_lock();
        let restore = Restore::of(&[DSN_VAR, "IBL_SENTRY_DEBUG"]);
        std::env::set_var("IBL_SENTRY_DEBUG", "1");
        for bad in [
            "not-a-url",
            "https://sentry.ibl.network/33",   // no public key
            "\"https://abc@sentry.example/1\"", // shell quotes kept
            "https://abc@/1",
        ] {
            std::env::set_var(DSN_VAR, bad);
            assert!(dsn().is_none(), "{bad:?} must not parse as a DSN");
            assert!(
                init().is_none(),
                "{bad:?} must disable reporting, not panic the app"
            );
        }
        drop(restore);
    }

    /// Shared project, so the Rust events need a handle to be found by. These
    /// two are that handle — losing either buries them in the web app's
    /// console-error stream.
    #[test]
    fn rust_events_stay_findable_in_the_shared_project() {
        assert_eq!(
            DEFAULT_DSN, "https://f953ef66c4e0d5bda480069132dc9aee@sentry.ibl.network/33",
            "must stay the project sentry.client.config.ts reports to"
        );
        let release = options().release.expect("a release tag");
        assert!(
            release.starts_with("ibl-ai-os@"),
            "the release must not collide with the web app's: {release}"
        );
    }

    #[test]
    fn the_env_var_opts_a_machine_out() {
        let _g = env_lock();
        let restore = Restore::of(&["IBL_TELEMETRY"]);
        for value in ["off", "OFF", "0", "false"] {
            std::env::set_var("IBL_TELEMETRY", value);
            assert!(opted_out(), "IBL_TELEMETRY={value} must disable reporting");
        }
        std::env::set_var("IBL_TELEMETRY", "on");
        assert!(!opted_out());
        drop(restore);
    }

    #[test]
    fn the_users_name_never_leaves_in_a_path() {
        assert_eq!(
            redact_home(
                "failed writing /Users/sone/.local/share/iblai/settings.json",
                Some("/Users/sone")
            ),
            "failed writing ~/.local/share/iblai/settings.json"
        );
        assert_eq!(
            redact_home(r"C:\Users\sone\AppData", Some(r"C:\Users\sone\")),
            r"~\AppData",
            "a trailing separator on HOME must not defeat the match"
        );
        assert_eq!(redact_home("no home known", None), "no home known");
    }

    #[test]
    fn secret_values_are_redacted_in_every_shape_we_log() {
        assert_eq!(
            redact_secrets("spawning with IBLAI_API_KEY=sk-live-abc123 and PATH=/usr/bin"),
            "spawning with IBLAI_API_KEY=[redacted] and PATH=/usr/bin",
            "an env dump keeps the harmless variables readable"
        );
        assert_eq!(
            redact_secrets("GET /v1/chat?tenant=main&token=eyJhbGciOi.abc&page=2"),
            "GET /v1/chat?tenant=main&token=[redacted]&page=2"
        );
        assert_eq!(
            redact_secrets(r#"{"access_token": "abc.def", "model": "gpt-5"}"#),
            r#"{"access_token": "[redacted]", "model": "gpt-5"}"#
        );
        assert_eq!(
            redact_secrets("authorization: Bearer eyJhbGciOiJIUzI1NiJ9.x"),
            "authorization: [redacted]"
        );
        // A pretty-printed body puts a newline and indentation between the key
        // and its value. Only `' '` was skipped, so this leaked in full.
        assert_eq!(
            redact_secrets("{\n  \"access_token\":\n    \"ey.secret\"\n}"),
            "{\n  \"access_token\":\n    \"[redacted]\"\n}"
        );
        assert_eq!(
            redact_secrets("{\"api_key\":\t\"sk-live\"}"),
            "{\"api_key\":\t\"[redacted]\"}"
        );
        // Header values are one opaque blob to the end of the line, and the
        // cookie name itself is not a word `is_sensitive_key` knows.
        assert_eq!(
            redact_secrets("Cookie: sessionid=abc; csrftoken=def\nnext line"),
            "Cookie: [redacted]\nnext line"
        );
        assert_eq!(
            redact_secrets("X-Api-Key: sk-live-1"),
            "X-Api-Key: [redacted]"
        );
    }

    /// The whole point of a report is the error text inside it. A scrubber
    /// that eats the error because the CONTEXT names a key is a scrubber
    /// that makes every report useless.
    #[test]
    fn scrubbing_keeps_the_error_the_report_exists_to_carry() {
        assert_eq!(
            redact_secrets(
                "[opencode-proxy] could not persist IBLAI_API_KEY: No space left on device"
            ),
            "[opencode-proxy] could not persist IBLAI_API_KEY: No space left on device"
        );
        assert_eq!(
            redact_secrets("[AppUpdate] check failed: error sending request"),
            "[AppUpdate] check failed: error sending request"
        );
        // The header rule matches EXACT names only, so a context naming a key
        // still keeps its error — the regression the loose `:` rule caused.
        assert_eq!(
            redact_secrets("Authorization-ish: No space left on device"),
            "Authorization-ish: No space left on device"
        );
        assert_eq!(
            redact_secrets("a bare = sign and an empty KEY= stay as they are"),
            "a bare = sign and an empty KEY= stay as they are"
        );
        // Over-redaction, on purpose: prose about a "bearer" loses the next
        // word. Nothing here logs such prose, and the opposite error leaks a
        // credential — so the rule stays blunt. Same stance as
        // `is_sensitive_key` taking `monkey=`.
        assert_eq!(
            redact_secrets("the word bearer alone is not a header"),
            "the word bearer [redacted] is not a header"
        );
    }

    /// The pure helpers above are only worth anything if `before_send`
    /// actually reaches every free-text field of a real event. A panic's text
    /// lands in `exception[].value`, a report's in `message` + `extra`, and
    /// `sentry-contexts` fills `server_name` with the machine's hostname —
    /// which on a personal Mac is usually the owner's name.
    #[test]
    fn the_outgoing_event_is_scrubbed_in_every_field() {
        let mut event = Event {
            message: Some("writing /Users/sone/x failed".to_string()),
            server_name: Some(Cow::Borrowed("sones-macbook-pro.local")),
            ..Default::default()
        };
        event.exception.values.push(sentry::protocol::Exception {
            ty: "panic".to_string(),
            value: Some("spawn failed: IBLAI_API_KEY=sk-live-abc".to_string()),
            ..Default::default()
        });
        event.breadcrumbs.values.push(sentry::protocol::Breadcrumb {
            message: Some("GET /v1/chat?token=eyJhbGciOi.abc".to_string()),
            ..Default::default()
        });
        event.extra.insert(
            "error".to_string(),
            Value::String(r#"{"access_token": "abc.def"}"#.to_string()),
        );

        let home = home_dir();
        scrub_event(&mut event);

        assert_eq!(event.server_name, None, "the hostname names the owner");
        if home.as_deref() == Some("/Users/sone") {
            assert_eq!(event.message.as_deref(), Some("writing ~/x failed"));
        }
        assert_eq!(
            event.exception.values[0].value.as_deref(),
            Some("spawn failed: IBLAI_API_KEY=[redacted]")
        );
        assert_eq!(
            event.breadcrumbs.values[0].message.as_deref(),
            Some("GET /v1/chat?token=[redacted]")
        );
        assert_eq!(
            event.extra["error"],
            Value::String(r#"{"access_token": "[redacted]"}"#.to_string())
        );
    }

    /// One fault in a per-token loop must cost one event, not one per token.
    #[test]
    fn report_once_captures_only_the_first_of_its_kind() {
        let context = "[test] a repeated failure in a hot loop";
        assert!(first_time(context), "the first call is the one that reports");
        for _ in 0..500 {
            assert!(!first_time(context), "every later call is print-only");
        }
        assert!(first_time("[test] a different failure"));
    }

    /// The tenant has to reach events captured on ANY thread, which is why it
    /// is a static read in `before_send` rather than a scope write — a scope
    /// is thread-local, and the one caller runs on a tokio worker.
    #[test]
    fn the_tenant_tag_is_applied_to_every_event_not_one_thread() {
        let _g = env_lock();
        set_tenant("acme");
        let tagged = std::thread::spawn(|| {
            let mut event = Event::default();
            scrub_event(&mut event);
            event.tags.get("tenant").cloned()
        })
        .join()
        .unwrap();
        assert_eq!(
            tagged.as_deref(),
            Some("acme"),
            "an event captured on another thread must still carry the tenant"
        );
        *TENANT.lock().unwrap() = None;
    }

    /// `init` must be able to BUILD its transport, not merely be constructed.
    /// sentry's reqwest 0.13 client is created eagerly inside `sentry::init`
    /// and panics if no crypto provider is installed — and because this crate
    /// uses `rustls-no-provider`, the compiled-in fallback IS that panic. No
    /// other test here builds a client, so nothing else would notice.
    ///
    /// The DSN points at a port nothing listens on: the client is constructed
    /// and the transport spawned, but no event can reach a real project.
    #[test]
    fn init_can_actually_build_its_transport() {
        let _g = env_lock();
        let restore = Restore::of(&[DSN_VAR, "IBL_SENTRY_DEBUG", "IBL_TELEMETRY"]);
        std::env::set_var("IBL_SENTRY_DEBUG", "1");
        std::env::remove_var("IBL_TELEMETRY");
        std::env::set_var(DSN_VAR, "https://abc@127.0.0.1:1/1");
        let guard = init().expect("a valid DSN in a debug build that asked");
        assert!(guard.is_enabled(), "the client must be live, not a no-op");
        drop(guard);
        drop(restore);
    }

    /// Reporting must survive being called before (or without) `init`, since
    /// the opt-out and the no-DSN paths leave no client at all and the call
    /// sites are spread through code that knows nothing about either.
    #[test]
    fn reporting_without_a_client_is_a_no_op() {
        report("[test] a failure with no client", "boom");
        report_warning("[test] a warning with no client", "meh");
        set_tenant("main");
        set_tenant("");
    }

    /// Sentry groups by release, so the baked tag has to be the version the
    /// app actually ships as — the one in `tauri.conf.json`, on the DMG and on
    /// the updater feed — not the 0.1.0 `Cargo.toml` has carried since the
    /// start. Tagged 0.1.0, every issue ever filed would look like one build.
    ///
    /// Asserted here rather than in `build.rs`, whose `mod tests` cargo never
    /// builds: a test that cannot run pins nothing.
    #[test]
    fn the_release_tag_is_the_shipped_version() {
        let baked = env!("IBL_APP_VERSION");
        assert_ne!(baked, env!("CARGO_PKG_VERSION"));

        let manifest = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
        let conf: serde_json::Value = serde_json::from_str(
            &std::fs::read_to_string(manifest.join("tauri.conf.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(
            conf["version"].as_str(),
            Some(baked),
            "build.rs must bake tauri.conf.json's version, not another source"
        );
        assert_eq!(
            options().release.as_deref(),
            Some(format!("ibl-ai-os@{baked}").as_str())
        );
    }

    /// The privacy-relevant options are the ones a refactor can silently
    /// flip — and each costs something real if it does: PII attached to every
    /// event, an unscrubbed message, or a transaction bill for traces nobody
    /// reads.
    #[test]
    fn the_privacy_and_cost_options_stay_pinned() {
        let options = options();
        assert!(!options.send_default_pii);
        assert!(options.before_send.is_some(), "nothing goes out unscrubbed");
        assert!(matches!(
            options.traces_sampling_strategy,
            TracesSamplingStrategy::Disabled
        ));
    }

    /// `main.rs` (desktop) and `lib.rs` (mobile) are hand-synced twins — a
    /// module wired into only one of them is dead on that platform, which is
    /// exactly how a reporting gap goes unnoticed. Pin both halves.
    #[test]
    fn both_entry_points_start_reporting() {
        let manifest = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
        for twin in ["src/main.rs", "src/lib.rs"] {
            let src = std::fs::read_to_string(manifest.join(twin)).unwrap();
            assert!(
                src.contains("mod telemetry;"),
                "{twin} must declare the telemetry module"
            );
            assert!(
                src.contains("let _sentry = telemetry::init();"),
                "{twin} must start reporting, and must BIND the guard — a bare \
                 `let _ =` drops it and discards every queued event"
            );
        }
    }

    fn env_lock() -> std::sync::MutexGuard<'static, ()> {
        static L: std::sync::Mutex<()> = std::sync::Mutex::new(());
        L.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// Puts back whatever the process-global env held, so these tests can't
    /// leak a DSN or an opt-out into another test's view of the world.
    struct Restore(Vec<(&'static str, Option<std::ffi::OsString>)>);

    impl Restore {
        fn of(vars: &[&'static str]) -> Self {
            Self(vars.iter().map(|v| (*v, std::env::var_os(v))).collect())
        }
    }

    impl Drop for Restore {
        fn drop(&mut self) {
            for (var, value) in &self.0 {
                match value {
                    Some(v) => std::env::set_var(var, v),
                    None => std::env::remove_var(var),
                }
            }
        }
    }
}
