import { saveAs } from 'file-saver';

import { isTauriApp, TAURI_COMMANDS } from '@/types/tauri';

// The WebView runs the deployed web app, so it can face a desktop build that
// predates `save_chat_file`; Tauri then reports the command unknown or not
// granted.
const isMissingCommand = (err: unknown) =>
  /not found|not allowed/i.test(String(err));

async function saveWithNativeDialog(blob: Blob, filename: string) {
  const { invoke } = await import('@tauri-apps/api/core');
  const contents = Array.from(new Uint8Array(await blob.arrayBuffer()));
  try {
    await invoke<boolean>(TAURI_COMMANDS.SAVE_CHAT_FILE, {
      fileName: filename,
      contents,
    });
  } catch (err) {
    if (!isMissingCommand(err)) throw err;
    saveAs(blob, filename);
  }
}

/**
 * Saves a chat download. In the browser it is a plain download, started
 * synchronously so Safari still counts it as the user's click. The desktop
 * app's macOS WebView ignores those, so there the native save dialog is used;
 * a cancelled dialog resolves without saving.
 */
export function saveFile(blob: Blob, filename: string): void | Promise<void> {
  if (!isTauriApp()) {
    saveAs(blob, filename);
    return;
  }
  return saveWithNativeDialog(blob, filename);
}
