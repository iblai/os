//! The per-machine model choice for the subscription agents (Codex, Claude
//! Code) and the model lists they offer. ACP lists models per session only
//! (`configOptions` on `session/new`), so Claude's list is captured from every
//! handshake — or from a short probe when nothing is cached yet — while
//! Codex's is the bundled CLI's `codex debug models` catalog (the one its
//! app-server serves, listable signed out), fetched on every request so it is
//! current at every app open; both are kept per agent under the data dir. The
//! choice lives in `settings.json` next to
//! the Approvals mode; the handshake applies it to every new session and
//! `set_code_agent_model` pushes it to the live ones with
//! `session/set_config_option`, so a pick reaches a running chat without a
//! respawn. Never written to the mentor: installs and logins are local, and so
//! is this.

#![cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]

use std::path::PathBuf;
use std::time::Duration;

use serde_json::{json, Value};
use tauri::command;

use crate::code_agent_installer::{agent_cli, display_name};
use crate::opencode_acp::{iblai_data_dir, read_settings, write_settings, Backend};

/// `settings.json` key: `{ "codex": "<model id>", "claude": "<model id>" }`.
/// An absent agent runs its own default.
const SETTINGS_KEY: &str = "code_agent_models";
/// The ACP config option both adapters use for the model.
pub(crate) const MODEL_CONFIG_ID: &str = "model";

/// The model saved for this agent on this machine, if any.
pub(crate) fn saved(backend: Backend) -> Option<String> {
    read_settings()
        .get(SETTINGS_KEY)?
        .get(backend.id())?
        .as_str()
        .map(str::to_string)
}

fn save(backend: Backend, model: Option<&str>) -> Result<(), String> {
    let mut settings = read_settings();
    let mut map = settings
        .get(SETTINGS_KEY)
        .and_then(|v| v.as_object().cloned())
        .unwrap_or_default();
    match model {
        Some(m) => {
            map.insert(backend.id().to_string(), json!(m));
        }
        None => {
            map.remove(backend.id());
        }
    }
    settings.insert(SETTINGS_KEY.to_string(), Value::Object(map));
    write_settings(&settings)
}

/// `<data>/acp/<agent>/config-options.json`: the agent's last reported
/// `configOptions` plus `default_model`, the model it picked by itself — the
/// `currentValue` of a fresh session's opening snapshot, before any saved model
/// was applied.
fn cache_path(backend: Backend) -> PathBuf {
    iblai_data_dir()
        .join("acp")
        .join(backend.id())
        .join("config-options.json")
}

fn cached(backend: Backend) -> Option<Value> {
    serde_json::from_str(&std::fs::read_to_string(cache_path(backend)).ok()?).ok()
}

/// The `model` option of a `configOptions` array.
fn model_option(options: &Value) -> Option<&Value> {
    options
        .as_array()?
        .iter()
        .find(|o| o.get("id").and_then(|i| i.as_str()) == Some(MODEL_CONFIG_ID))
}

/// Record what an agent reported. `first` = a fresh session's opening
/// snapshot, whose `currentValue` is the agent's own default; every later
/// snapshot (a resumed session, the answer to a model change) keeps the
/// recorded default. Options without a `model` entry are not a list.
pub(crate) fn remember(backend: Backend, options: &Value, first: bool) {
    let Some(option) = model_option(options) else {
        return;
    };
    let default_model = if first {
        option.get("currentValue").cloned()
    } else {
        cached(backend).and_then(|c| c.get("default_model").cloned())
    }
    .unwrap_or(Value::Null);
    let cache = json!({ "options": options, "default_model": default_model });
    let path = cache_path(backend);
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Err(e) = std::fs::write(&path, cache.to_string()) {
        eprintln!(
            "[code-agent] could not cache the {} config options: {e}",
            backend.id()
        );
    }
}

/// What the picker shows: the offered models, the agent's own default and the
/// saved choice — kept even when no longer offered, so the picker shows what
/// the next spawn will refuse instead of silently dropping it.
fn model_choice(cache: &Value, saved: Option<&str>) -> Value {
    let models: Vec<Value> = model_option(&cache["options"])
        .and_then(|o| o.get("options"))
        .and_then(|o| o.as_array())
        .map(|opts| {
            opts.iter()
                .map(|o| {
                    json!({
                        "id": o.get("value").cloned().unwrap_or(Value::Null),
                        "name": o.get("name").cloned().unwrap_or(Value::Null),
                        "description": o.get("description").cloned().unwrap_or(Value::Null),
                    })
                })
                .collect()
        })
        .unwrap_or_default();
    json!({
        "models": models,
        "default": cache.get("default_model").cloned().unwrap_or(Value::Null),
        "selected": saved,
    })
}

fn offered(cache: &Value, model: &str) -> bool {
    model_choice(cache, None)["models"]
        .as_array()
        .map(|m| m.iter().any(|x| x["id"] == json!(model)))
        .unwrap_or(false)
}

/// Codex's catalog (`codex debug models`) as the ACP `model` option: the
/// models it lists, in its own order, named as it names them. The catalog
/// carries no current value, so `default_model` stays null and the picker's
/// Default row means "Codex's own choice".
fn model_option_from_catalog(catalog: &Value) -> Result<Value, String> {
    let mut models: Vec<&Value> = catalog
        .get("models")
        .and_then(|m| m.as_array())
        .ok_or_else(|| "Codex's model list has no models.".to_string())?
        .iter()
        .filter(|m| {
            m.get("visibility")
                .and_then(|v| v.as_str())
                .map_or(true, |v| v == "list")
        })
        .collect();
    models.sort_by_key(|m| {
        m.get("priority")
            .and_then(|p| p.as_i64())
            .unwrap_or(i64::MAX)
    });
    let options: Vec<Value> = models
        .iter()
        .filter_map(|m| {
            let slug = m.get("slug")?.as_str()?;
            Some(json!({
                "value": slug,
                "name": m.get("display_name").and_then(|n| n.as_str()).unwrap_or(slug),
                "description": m.get("description").cloned().unwrap_or(Value::Null),
            }))
        })
        .collect();
    if options.is_empty() {
        return Err("Codex lists no models.".to_string());
    }
    Ok(json!({
        "id": MODEL_CONFIG_ID,
        "name": "Model",
        "category": "model",
        "type": "select",
        "options": options,
    }))
}

/// `codex debug models` through the adapter's CLI passthrough — the bundled
/// binary the session's app-server runs, so its slugs are what
/// `session/set_config_option` takes. Lists signed out too, in well under a
/// second; a probe session (Claude's way) needs a signed-in adapter. Refused
/// with the install sentence while Codex isn't installed, as the probe is —
/// never the raw error of a missing binary.
async fn codex_catalog() -> Result<Value, String> {
    crate::code_agent_installer::agent_ready(Backend::Codex)?;
    let output = tokio::time::timeout(
        Duration::from_secs(20),
        agent_cli(Backend::Codex, &["debug", "models"]).output(),
    )
    .await
    .map_err(|_| "Codex took too long to list its models.".to_string())?
    .map_err(|e| format!("Codex could not list its models: {e}"))?;
    if !output.status.success() {
        return Err(format!(
            "Codex could not list its models: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    let catalog: Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Codex's model list is not JSON: {e}"))?;
    Ok(json!([model_option_from_catalog(&catalog)?]))
}

/// The agent's models for the top-left picker. Codex's come from
/// `codex debug models` on every request — a tenth of a second, and the
/// catalog may have grown since the last look — so they are current at every
/// app open; the cache only serves the pick's validation. Claude's come from
/// the cache, else (or on `refresh`) from a probe session, which needs the
/// agent installed and signed in, and says so otherwise.
#[command]
pub async fn list_code_agent_models(
    backend: String,
    refresh: Option<bool>,
) -> Result<Value, String> {
    let backend = Backend::agent(&backend)?;
    let fresh = |options: Value| {
        remember(backend, &options, true);
        cached(backend)
            .ok_or_else(|| format!("{} reported no model option.", display_name(backend)))
    };
    let cache = match backend {
        Backend::Codex => fresh(codex_catalog().await?)?,
        _ => match (cached(backend), refresh.unwrap_or(false)) {
            (Some(c), false) => c,
            _ => fresh(crate::opencode_acp::probe_config_options(backend).await?)?,
        },
    };
    Ok(model_choice(&cache, saved(backend).as_deref()))
}

/// Save the pick (`None` = the agent's default) after applying it to every
/// live session of the agent — a refusal is reported and nothing is saved.
#[command]
pub async fn set_code_agent_model(backend: String, model: Option<String>) -> Result<(), String> {
    let backend = Backend::agent(&backend)?;
    let cache = cached(backend);
    if let (Some(m), Some(c)) = (model.as_deref(), cache.as_ref()) {
        if !offered(c, m) {
            return Err(format!("{} doesn't offer {m}.", display_name(backend)));
        }
    }
    let target = model.clone().or_else(|| {
        cache
            .as_ref()
            .and_then(|c| c.get("default_model"))
            .and_then(|d| d.as_str())
            .map(str::to_string)
    });
    if let Some(value) = target {
        crate::opencode_acp::push_config_option(backend, MODEL_CONFIG_ID, value).await?;
    }
    save(backend, model.as_deref())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn codex_options() -> Value {
        json!([
            { "id": "mode", "category": "mode", "type": "select", "currentValue": "read-only", "options": [] },
            { "id": "model", "name": "Model", "category": "model", "type": "select", "currentValue": "gpt-5.2",
              "options": [
                { "value": "gpt-5.2", "name": "5.2", "description": "Default model" },
                { "value": "gpt-5.3-codex", "name": "5.3 Codex", "description": "Coding" }
              ] }
        ])
    }

    fn claude_options() -> Value {
        json!([
            { "id": "model", "name": "Model", "category": "model", "type": "select", "currentValue": "default",
              "options": [
                { "value": "default", "name": "Default", "description": "Opus 4.6" },
                { "value": "claude-opus-4-6", "name": "Opus 4.6" },
                { "value": "claude-sonnet-4-6", "name": "Sonnet 4.6" }
              ] }
        ])
    }

    /// The picker's view of a cache: every offered model with id / name /
    /// description, the agent's own default, and the saved pick — kept even
    /// when the agent no longer offers it.
    #[test]
    fn the_model_choice_lists_the_agents_offer_with_default_and_selection() {
        let cache = json!({ "options": codex_options(), "default_model": "gpt-5.2" });
        let c = model_choice(&cache, None);
        assert_eq!(c["models"].as_array().unwrap().len(), 2);
        assert_eq!(
            c["models"][1],
            json!({ "id": "gpt-5.3-codex", "name": "5.3 Codex", "description": "Coding" })
        );
        assert_eq!(c["default"], json!("gpt-5.2"));
        assert_eq!(c["selected"], Value::Null);
        let c = model_choice(&cache, Some("gpt-9"));
        assert_eq!(c["selected"], json!("gpt-9"), "a stale pick stays visible");
        assert!(offered(&cache, "gpt-5.3-codex"));
        assert!(!offered(&cache, "gpt-9"));

        let claude = json!({ "options": claude_options(), "default_model": "default" });
        let c = model_choice(&claude, Some("claude-sonnet-4-6"));
        assert_eq!(c["models"][0]["description"], json!("Opus 4.6"));
        assert_eq!(c["models"][1]["description"], Value::Null);
        assert_eq!(c["selected"], json!("claude-sonnet-4-6"));

        // No model option at all → an empty list, nothing else.
        let none = model_choice(&json!({ "options": [{ "id": "mode" }] }), None);
        assert_eq!(none["models"], json!([]));
        assert_eq!(none["default"], Value::Null);
    }

    /// The pick lives in `settings.json` per agent; the cache records the
    /// agent's own default from a fresh session's first snapshot and keeps it
    /// through later snapshots; options without a model entry are ignored.
    #[test]
    #[cfg(unix)]
    fn a_saved_model_survives_in_settings_and_the_cache_keeps_the_agents_default() {
        let _lock = crate::opencode_acp::data_dir_lock();
        let scratch =
            std::env::temp_dir().join(format!("code-agent-models-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&scratch);
        std::fs::create_dir_all(&scratch).unwrap();
        let prior = std::env::var_os("XDG_DATA_HOME");
        std::env::set_var("XDG_DATA_HOME", &scratch);

        assert_eq!(saved(Backend::Codex), None);
        save(Backend::Codex, Some("gpt-5.3-codex")).unwrap();
        assert_eq!(saved(Backend::Codex).as_deref(), Some("gpt-5.3-codex"));
        assert_eq!(saved(Backend::Claude), None);
        save(Backend::Codex, None).unwrap();
        assert_eq!(saved(Backend::Codex), None);

        assert!(cached(Backend::Codex).is_none());
        remember(Backend::Codex, &codex_options(), true);
        assert_eq!(
            cached(Backend::Codex).unwrap()["default_model"],
            json!("gpt-5.2")
        );
        let mut later = codex_options();
        later[1]["currentValue"] = json!("gpt-5.3-codex");
        remember(Backend::Codex, &later, false);
        let c = cached(Backend::Codex).unwrap();
        assert_eq!(
            c["default_model"],
            json!("gpt-5.2"),
            "a later snapshot keeps the default"
        );
        assert_eq!(c["options"][1]["currentValue"], json!("gpt-5.3-codex"));
        remember(Backend::Claude, &json!([{ "id": "mode" }]), true);
        assert!(cached(Backend::Claude).is_none());

        match prior {
            Some(v) => std::env::set_var("XDG_DATA_HOME", v),
            None => std::env::remove_var("XDG_DATA_HOME"),
        }
        let _ = std::fs::remove_dir_all(&scratch);
    }

    /// `codex debug models` → the `model` option: hidden entries dropped, the
    /// rest in priority order, named as the catalog names them; an empty or
    /// missing list is an error, not an empty picker.
    #[test]
    fn a_codex_catalog_becomes_the_model_option() {
        let catalog = json!({ "models": [
            { "slug": "gpt-5.5", "display_name": "GPT-5.5", "description": "Older", "visibility": "list", "priority": 13 },
            { "slug": "gpt-daybreak-red-latest", "display_name": "Daybreak Red", "visibility": "hide", "priority": 12 },
            { "slug": "gpt-6-astra", "display_name": "GPT-6-Astra", "description": "Frontier", "visibility": "list", "priority": 2 },
            { "slug": "gpt-6-sol", "display_name": "GPT-6-Sol", "visibility": "list", "priority": 3 },
            { "slug": "unranked" }
        ] });
        let option = model_option_from_catalog(&catalog).unwrap();
        assert_eq!(option["id"], json!(MODEL_CONFIG_ID));
        let ids: Vec<&str> = option["options"]
            .as_array()
            .unwrap()
            .iter()
            .map(|o| o["value"].as_str().unwrap())
            .collect();
        assert_eq!(ids, ["gpt-6-astra", "gpt-6-sol", "gpt-5.5", "unranked"]);
        assert_eq!(
            option["options"][0],
            json!({ "value": "gpt-6-astra", "name": "GPT-6-Astra", "description": "Frontier" })
        );
        assert_eq!(option["options"][1]["description"], Value::Null);
        assert_eq!(
            option["options"][3]["name"],
            json!("unranked"),
            "a nameless entry is named by its slug"
        );
        assert!(
            option.get("currentValue").is_none(),
            "the catalog names no default"
        );

        // The picker's view of it: every listed model, no default, the saved pick.
        let cache = json!({ "options": [option], "default_model": Value::Null });
        let choice = model_choice(&cache, Some("gpt-6-sol"));
        assert_eq!(choice["models"].as_array().unwrap().len(), 4);
        assert_eq!(choice["default"], Value::Null);
        assert_eq!(choice["selected"], json!("gpt-6-sol"));
        assert!(offered(&cache, "gpt-6-astra"));
        assert!(
            !offered(&cache, "gpt-daybreak-red-latest"),
            "hidden models are not offered"
        );

        let err = model_option_from_catalog(&json!({ "models": [] })).unwrap_err();
        assert_eq!(err, "Codex lists no models.");
        let err = model_option_from_catalog(&json!({ "hidden": true })).unwrap_err();
        assert_eq!(err, "Codex's model list has no models.");
        let only_hidden = json!({ "models": [{ "slug": "x", "visibility": "hide" }] });
        assert_eq!(
            model_option_from_catalog(&only_hidden).unwrap_err(),
            "Codex lists no models."
        );
    }

    /// The real catalog through the managed install:
    /// `cargo test codex_debug_models -- --ignored --nocapture`.
    #[tokio::test]
    #[ignore]
    async fn codex_debug_models_lists_the_catalog() {
        let options = codex_catalog().await.unwrap();
        let option = model_option(&options).expect("a model option");
        let models = option["options"].as_array().unwrap();
        assert!(!models.is_empty());
        for m in models {
            assert!(!m["value"].as_str().unwrap_or("").is_empty(), "{m}");
            assert!(!m["name"].as_str().unwrap_or("").is_empty(), "{m}");
            println!("{} — {}", m["value"], m["name"]);
        }
    }

    /// A pick the agent doesn't offer is refused before anything is saved; an
    /// offered one (with no live session to push to) is saved; `None` clears it.
    #[tokio::test]
    #[cfg(unix)]
    async fn an_unknown_model_is_refused_before_it_is_saved() {
        let _lock = crate::opencode_acp::data_dir_lock();
        let scratch = std::env::temp_dir().join(format!("code-agent-set-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&scratch);
        std::fs::create_dir_all(&scratch).unwrap();
        let prior = std::env::var_os("XDG_DATA_HOME");
        std::env::set_var("XDG_DATA_HOME", &scratch);

        remember(Backend::Codex, &codex_options(), true);
        let err = set_code_agent_model("codex".into(), Some("gpt-9".into()))
            .await
            .unwrap_err();
        assert!(err.contains("Codex doesn't offer gpt-9"), "{err}");
        assert_eq!(saved(Backend::Codex), None);
        set_code_agent_model("codex".into(), Some("gpt-5.3-codex".into()))
            .await
            .unwrap();
        assert_eq!(saved(Backend::Codex).as_deref(), Some("gpt-5.3-codex"));
        set_code_agent_model("codex".into(), None).await.unwrap();
        assert_eq!(saved(Backend::Codex), None);
        assert!(set_code_agent_model("gemini".into(), None).await.is_err());

        match prior {
            Some(v) => std::env::set_var("XDG_DATA_HOME", v),
            None => std::env::remove_var("XDG_DATA_HOME"),
        }
        let _ = std::fs::remove_dir_all(&scratch);
    }

    /// Codex's list is the bundled CLI's catalog, fetched on every request:
    /// hidden entries dropped, no default of its own, the saved pick shown;
    /// and it fails loudly — the install sentence while Codex isn't
    /// installed, the CLI's stderr when it exits non-zero, "not JSON" for
    /// noise, "no models" for an empty catalog — leaving the last good cache
    /// to back the pick's check.
    #[tokio::test]
    #[cfg(unix)]
    async fn the_codex_list_comes_from_the_cli_and_fails_loudly_when_it_cannot() {
        use crate::code_agent_installer::adapter_entry;
        use crate::code_agent_installer::tests::{fake_node, stub_install};
        let _scratch = crate::opencode_acp::ScratchDataDir::new("code-agent-list-codex");
        let err = list_code_agent_models("codex".into(), None)
            .await
            .unwrap_err();
        assert_eq!(
            err,
            "Codex isn't installed — install it from the Code menu."
        );

        fake_node(
            r#"case "$*" in
  *"cli debug models")
    echo "run $*" >> "$(dirname "$1")/runs.log"
    echo '{"models":[{"slug":"gpt-6-sol","display_name":"GPT-6-Sol","description":"Frontier","visibility":"list","priority":2},{"slug":"gpt-daybreak","visibility":"hide","priority":1},{"slug":"gpt-5.5","display_name":"GPT-5.5","visibility":"list","priority":9}]}' ;;
  *) echo "unexpected: $*" >&2; exit 64 ;;
esac"#,
        );
        stub_install(Backend::Codex);
        let runs_log = adapter_entry(Backend::Codex)
            .parent()
            .unwrap()
            .join("runs.log");
        let runs = || {
            std::fs::read_to_string(&runs_log)
                .unwrap_or_default()
                .lines()
                .count()
        };
        let list = list_code_agent_models("codex".into(), None).await.unwrap();
        assert_eq!(
            list["models"],
            json!([
                { "id": "gpt-6-sol", "name": "GPT-6-Sol", "description": "Frontier" },
                { "id": "gpt-5.5", "name": "GPT-5.5", "description": null }
            ])
        );
        assert_eq!(list["default"], Value::Null);
        assert_eq!(list["selected"], Value::Null);
        assert!(cache_path(Backend::Codex).is_file());
        save(Backend::Codex, Some("gpt-6-sol")).unwrap();
        let list = list_code_agent_models("codex".into(), Some(false))
            .await
            .unwrap();
        assert_eq!(list["selected"], json!("gpt-6-sol"));
        assert_eq!(runs(), 2, "the CLI runs on every request, cache or not");

        fake_node(r#"echo "codex: error: unrecognized subcommand 'debug'" >&2; exit 2"#);
        let err = list_code_agent_models("codex".into(), None)
            .await
            .unwrap_err();
        assert_eq!(
            err,
            "Codex could not list its models: codex: error: unrecognized subcommand 'debug'"
        );
        fake_node("echo 'Loading models…'");
        let err = list_code_agent_models("codex".into(), None)
            .await
            .unwrap_err();
        assert!(err.starts_with("Codex's model list is not JSON"), "{err}");
        fake_node(r#"echo '{"models":[]}'"#);
        assert_eq!(
            list_code_agent_models("codex".into(), None)
                .await
                .unwrap_err(),
            "Codex lists no models."
        );
        // The last good list still backs the pick's check.
        assert!(offered(&cached(Backend::Codex).unwrap(), "gpt-6-sol"));
        let err = set_code_agent_model("codex".into(), Some("gpt-9".into()))
            .await
            .unwrap_err();
        assert!(err.contains("doesn't offer gpt-9"), "{err}");
    }

    /// Claude's list is served from the cache without touching the agent; a
    /// refresh, or no cache, needs a probe session — refused with the install
    /// sentence while Claude isn't installed; unknown agents and opencode are
    /// refused by name.
    #[tokio::test]
    #[cfg(unix)]
    async fn claudes_list_is_served_from_the_cache_and_needs_the_install_otherwise() {
        let _scratch = crate::opencode_acp::ScratchDataDir::new("code-agent-list-claude");
        let err = list_code_agent_models("claude".into(), None)
            .await
            .unwrap_err();
        assert_eq!(
            err,
            "Claude Code isn't installed — install it from the Code menu."
        );
        remember(Backend::Claude, &claude_options(), true);
        // No managed node exists here: a probe would fail to spawn.
        let list = list_code_agent_models("claude".into(), None).await.unwrap();
        assert_eq!(list["models"].as_array().unwrap().len(), 3);
        assert_eq!(list["default"], json!("default"));
        let err = list_code_agent_models("claude".into(), Some(true))
            .await
            .unwrap_err();
        assert_eq!(
            err, "Claude Code isn't installed — install it from the Code menu.",
            "a refresh probes, and a probe needs the install"
        );
        assert_eq!(
            list_code_agent_models("gemini".into(), None)
                .await
                .unwrap_err(),
            "unknown code agent: gemini"
        );
        assert_eq!(
            crate::opencode_acp::probe_config_options(Backend::Opencode)
                .await
                .unwrap_err(),
            "opencode has no agent model list."
        );
    }
}
