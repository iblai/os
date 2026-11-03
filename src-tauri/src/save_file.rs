//! Saves a file the WebView built (a chat download) where the user picks.
//!
//! The macOS WebView ignores `<a download>` blob links, so the web app hands
//! the bytes here instead. The save dialog is opened HERE rather than from JS:
//! the command then can only ever write to a path the user just chose, never
//! one a page passes in.

use std::path::Path;

use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

/// The save dialog's type filter for a file name, e.g. `("Excel", "xlsx")`.
fn filter_for(file_name: &str) -> Option<(&'static str, &'static str)> {
    match Path::new(file_name)
        .extension()?
        .to_str()?
        .to_ascii_lowercase()
        .as_str()
    {
        "xlsx" => Some(("Excel", "xlsx")),
        "txt" => Some(("Text", "txt")),
        _ => None,
    }
}

/// `None` = the user cancelled the dialog: nothing is written.
fn write_chosen(path: Option<&Path>, contents: &[u8]) -> Result<bool, String> {
    let Some(path) = path else { return Ok(false) };
    std::fs::write(path, contents)
        .map(|_| true)
        .map_err(|e| format!("Could not save {}: {e}", path.display()))
}

/// Resolves `true` once saved, `false` when the user cancelled.
#[tauri::command]
pub async fn save_chat_file(
    app: AppHandle,
    file_name: String,
    contents: Vec<u8>,
) -> Result<bool, String> {
    let mut dialog = app.dialog().file().set_file_name(&file_name);
    if let Some((name, extension)) = filter_for(&file_name) {
        dialog = dialog.add_filter(name, &[extension]);
    }
    let (tx, rx) = tokio::sync::oneshot::channel();
    dialog.save_file(move |picked| {
        let _ = tx.send(picked);
    });
    let picked = rx.await.map_err(|e| e.to_string())?;
    let path = picked
        .map(|p| p.into_path().map_err(|e| e.to_string()))
        .transpose()?;
    write_chosen(path.as_deref(), &contents)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_dialog_offers_the_files_own_type() {
        assert_eq!(
            filter_for("chat-Ada-2025-01-01.xlsx"),
            Some(("Excel", "xlsx"))
        );
        assert_eq!(filter_for("message-Ada.TXT"), Some(("Text", "txt")));
        assert_eq!(filter_for("notes.pdf"), None);
        assert_eq!(filter_for("no-extension"), None);
    }

    #[test]
    fn a_cancelled_dialog_writes_nothing() {
        assert_eq!(write_chosen(None, b"data"), Ok(false));
    }

    #[test]
    fn the_chosen_path_gets_the_exact_bytes() {
        let dir = std::env::temp_dir().join(format!("iblai-save-file-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("chat.xlsx");
        let bytes = [0x50, 0x4b, 0x03, 0x04, 0x00, 0xff];

        assert_eq!(write_chosen(Some(&path), &bytes), Ok(true));
        assert_eq!(std::fs::read(&path).unwrap(), bytes);

        assert_eq!(write_chosen(Some(&path), b"again"), Ok(true));
        assert_eq!(std::fs::read(&path).unwrap(), b"again");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_failed_write_says_where() {
        let missing = std::env::temp_dir()
            .join(format!("iblai-no-such-dir-{}", std::process::id()))
            .join("chat.txt");
        let err = write_chosen(Some(&missing), b"x").unwrap_err();
        assert!(err.starts_with("Could not save "), "{err}");
        assert!(err.contains("chat.txt"), "{err}");
    }

    #[test]
    fn the_command_is_granted_to_the_webview() {
        let manifest = Path::new(env!("CARGO_MANIFEST_DIR"));
        let caps = std::fs::read_to_string(manifest.join("capabilities/default.json")).unwrap();
        assert!(caps.contains("\"allow-save-chat-file\""));
        let perms = std::fs::read_to_string(manifest.join("permissions/default.toml")).unwrap();
        assert!(perms.contains("allow = [\"save_chat_file\"]"));
    }
}
