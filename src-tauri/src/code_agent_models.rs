//! The per-machine model choice for the subscription agents (Codex, Claude
//! Code) and the model lists they offer. ACP lists models per session only
//! (`configOptions` on `session/new`), so the lists are captured from every
//! handshake — or from a short probe when nothing is cached yet — and kept
//! per agent under the data dir. The choice lives in `settings.json` next to
//! the Approvals mode; the handshake applies it to every new session and
//! `set_code_agent_model` pushes it to the live ones with
//! `session/set_config_option`, so a pick reaches a running chat without a
//! respawn. Never written to the mentor: installs and logins are local, and so
//! is this.

#![cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]

use std::path::PathBuf;

use serde_json::{json, Value};
use tauri::command;

use crate::code_agent_installer::display_name;
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

/// The agent's models for the top-left picker: from the cache, else (or on
/// `refresh`) from a probe session — which needs the agent installed and
/// signed in, and says so otherwise.
#[command]
pub async fn list_code_agent_models(
    backend: String,
    refresh: Option<bool>,
) -> Result<Value, String> {
    let backend = Backend::agent(&backend)?;
    let cache = match (cached(backend), refresh.unwrap_or(false)) {
        (Some(c), false) => c,
        _ => {
            let options = crate::opencode_acp::probe_config_options(backend).await?;
            remember(backend, &options, true);
            cached(backend)
                .ok_or_else(|| format!("{} reported no model option.", display_name(backend)))?
        }
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
}
