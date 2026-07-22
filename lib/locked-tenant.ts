import { isTauriApp, TAURI_COMMANDS } from '@/types/tauri';

/**
 * Build-time tenant lock (Tauri only).
 *
 * A Tauri build can be pinned to a tenant via the `IBL_TENANT` build env,
 * surfaced through the `get_locked_tenant` command. Kept dependency-free (only
 * types/tauri) so both `lib/utils` (redirectToAuthSpa) and the React hook can
 * import it without a cycle. On web there is no lock.
 */

// Resolve once per session and share the promise across all callers.
let lockedTenantPromise: Promise<string> | null = null;

async function fetchLockedTenant(): Promise<string> {
  if (!isTauriApp()) return '';
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const value = await invoke<string>(TAURI_COMMANDS.GET_LOCKED_TENANT);
    return typeof value === 'string' ? value.trim() : '';
  } catch {
    // Command unavailable (older shell / web) → treat as unlocked.
    return '';
  }
}

/** The tenant this build is locked to, or '' when unlocked. Cached per session. */
export function getLockedTenant(): Promise<string> {
  if (!lockedTenantPromise) lockedTenantPromise = fetchLockedTenant();
  return lockedTenantPromise;
}
