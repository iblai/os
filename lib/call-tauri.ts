// Shared so concurrent callers await ONE dynamic import. Concurrent imports of the
// same module must not race: under vitest's module mocking, the loser can resolve to
// the unmocked alias and reject every call it carries.
let tauriCore: Promise<typeof import('@tauri-apps/api/core')> | undefined;

/** Invoke a command on the desktop host. Rejects outside the Tauri app. */
export async function callTauri<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const { invoke } = await (tauriCore ??= import('@tauri-apps/api/core'));
  return invoke<T>(cmd, args);
}
