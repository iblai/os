import { DEFAULT_MENTOR_URL } from './mentor-origin';

/**
 * The platform base domain every DM host is derived from. Paired with `AUTH_URL`
 * in auth.ts (`https://login.iblai.app`) — both name the same deployment, and
 * both are constants rather than settings because there is one right answer per
 * build.
 */
export const PLATFORM_DOMAIN = 'iblai.app';

/**
 * The web app the panel iframes. `https://os.ibl.ai` is the official one; point
 * `VITE_MENTOR_URL` at your own deployment — or at `http://localhost:3000` for
 * `pnpm dev` — in `extensions/chrome/.env.local`, which Vite loads from this
 * directory at build time (see .env.example).
 *
 * A build with no env file is therefore the production build, which is what the
 * release workflow runs: shipping a panel pointed at localhost is no longer
 * something anyone has to remember not to do.
 *
 * The same value reaches the manifest's `frame-src` through the build (see
 * `mentor-origin.ts`), so this host is framed rather than blocked by CSP.
 */
export const MENTOR_URL = import.meta.env.VITE_MENTOR_URL || DEFAULT_MENTOR_URL;

export interface Settings {
  /**
   * `provider/model` id from GET …/v1/models. Empty until the first run, which
   * picks one with `pickModel` and writes it back — a cache, not a preference.
   */
  model: string;
  /**
   * The top of `MODEL_PREFERENCE` in force when `model` was cached. The worker
   * re-picks when it no longer matches, which is what lets a changed preference
   * reach installs that have already run — the cache is otherwise written once
   * and never invalidated. Storing the preference rather than a version number
   * means the next change to that list invalidates old caches by itself.
   */
  preference: string;
}

export const DEFAULT_SETTINGS: Settings = { model: '', preference: '' };

const STORAGE_KEY = 'browse';

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const saved = stored[STORAGE_KEY] as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...saved };
}

export async function saveSettings(
  patch: Partial<Settings>,
): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

/** Completions stream from the ASGI host; the WSGI hosts cannot stream. */
export function completionsBase(): string {
  return `https://asgi.data.${PLATFORM_DOMAIN}`;
}

/**
 * REST bases to try, in order. The platform serves the OpenAI-compat model list
 * from more than one host: the web app reads it off the DM base
 * (`components/chat-input-form/coding-mode-button.tsx` → `config.dmUrl()`) and
 * only the completions proxy uses `asgi.data`, so asking a single host strands
 * the panel on a 403. Mirrors `fetch_tenant_models` in
 * `src-tauri/src/remote_code.rs`, which exists for exactly this reason.
 */
export function apiBases(): string[] {
  return [
    `https://base.manager.${PLATFORM_DOMAIN}`,
    `https://api.${PLATFORM_DOMAIN}/dm`,
    `https://asgi.data.${PLATFORM_DOMAIN}`,
  ];
}

/**
 * Whether a tab can be driven at all. Not a policy list — `chrome.scripting`
 * refuses to inject into `chrome://`, `chrome-extension://`, `view-source:`,
 * the Web Store and the PDF viewer, so anything outside http(s) would throw
 * instead of failing with a message the model can act on.
 */
export function injectable(url: string | undefined): url is string {
  if (!url) return false;
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}
