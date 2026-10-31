import type { JSHandle, Page } from '@playwright/test';

/**
 * The current user's metadata no longer arrives via a per-request GET
 * (`/api/ibl/users/manage/metadata/` or `/api/core/users/metadata/proxy/`)
 * for every consumer — the auth app forwards it into the `user_metadata`
 * localStorage key at login, and components read it synchronously from
 * there via `useStoredUserMetadata` (`@iblai/web-utils`, mirrored by
 * mentorai's own `hooks/use-stored-user-metadata.ts`). The SDK's
 * `WelcomeHeading` (`@iblai/iblai-js` welcome-chat/welcome-heading.js) is
 * one such consumer: its personal-greeting first name is
 * `userMetadata?.name || userMetadata?.public_metadata?.name || ''` — no
 * network call. This module reads/writes that same key so specs stay in
 * sync with the app instead of waiting on a GET that no longer fires.
 */
const USER_METADATA_STORAGE_KEY = 'user_metadata';

type StoredUserMetadata = {
  name?: string;
  public_metadata?: { name?: string } & Record<string, unknown>;
} & Record<string, unknown>;

/**
 * The full name `WelcomeHeading` would greet this user with, read from the
 * SAME place it reads it: the `user_metadata` storage key (session-first,
 * localStorage seed fallback — `user_metadata` is a per-tab auth key, see
 * `lib/auth-storage.ts`). Call AFTER navigating in; the key is seeded at
 * login (by the real auth app, or by `markProductTourSeen`/
 * `forceStoredUserFullName` in e2e), not fetched per-navigation, so this
 * does not need to wait for a response — but does poll briefly in case the
 * page hasn't finished hydrating storage into memory yet.
 *
 * Throws if the key never appears — a user with no metadata at all is a
 * real failure (the app depends on the same key), never a "skip" signal.
 */
export async function readStoredUserFullName(page: Page): Promise<string> {
  let handle: JSHandle<string> | undefined;
  try {
    handle = await page.waitForFunction(
      (storageKey) => {
        const raw =
          window.sessionStorage.getItem(storageKey) ??
          window.localStorage.getItem(storageKey);
        if (!raw) return null;
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          return null;
        }
        if (!parsed || typeof parsed !== 'object') return null;
        return '__present__';
      },
      USER_METADATA_STORAGE_KEY,
      { timeout: 15_000 },
    );
    return await page.evaluate((storageKey) => {
      const raw =
        window.sessionStorage.getItem(storageKey) ??
        window.localStorage.getItem(storageKey);
      const meta = raw ? JSON.parse(raw) : null;
      return meta?.name || meta?.public_metadata?.name || '';
    }, USER_METADATA_STORAGE_KEY);
  } catch (error) {
    throw new Error(
      `Could not read \`${USER_METADATA_STORAGE_KEY}\` from storage after ` +
        "navigating into the app. The welcome greeting reads the user's " +
        'name from this key (no GET fires for it anymore); this must FAIL, ' +
        `not skip. Underlying error: ${error}`,
    );
  } finally {
    await handle?.dispose();
  }
}

/**
 * Forces the given full name onto the `name` field of the `user_metadata`
 * storage key, merging into whatever is already there (so other fields —
 * including the product-tour record other e2e setup seeds — survive).
 * `WelcomeHeading` reads `name` before `public_metadata.name`, so setting
 * only the top-level field is sufficient to control the greeting.
 *
 * Call BEFORE the navigation that renders the greeting. This is a
 * same-origin write on the page's own storage — use it for a plain (or
 * same-origin `?embed=true`) navigation. It is not a substitute for
 * `forceTenantMetadata`-style route interception on a genuinely
 * cross-origin embed iframe, which has its own storage partition.
 */
export async function forceStoredUserFullName(
  page: Page,
  name: string,
): Promise<void> {
  await page.evaluate(
    ({ storageKey, value }) => {
      let meta: StoredUserMetadata = {};
      try {
        const raw = localStorage.getItem(storageKey);
        meta = raw ? JSON.parse(raw) : {};
      } catch {
        meta = {};
      }
      if (!meta || typeof meta !== 'object') meta = {};
      meta.name = value;
      localStorage.setItem(storageKey, JSON.stringify(meta));
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(meta));
      } catch {
        // sessionStorage may be unavailable in some contexts; localStorage
        // (the seed `getAuthItem` falls back to) is the one that matters.
      }
    },
    { storageKey: USER_METADATA_STORAGE_KEY, value: name },
  );
}
