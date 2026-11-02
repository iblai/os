'use client';

import { useLocalStorage } from '@/hooks/use-local-storage';
import { LOCAL_STORAGE_KEYS } from '@/lib/constants';

export type StoredUserMetadata = {
  name?: string;
  email?: string;
  username?: string;
  title?: string;
  about?: string;
  bio?: string;
  social_links?: unknown[];
  year_of_birth?: number | null;
  profile_image?: unknown;
  enable_sidebar_ai_mentor_display?: boolean;
  enable_skills_leaderboard_display?: boolean;
  public_metadata?: (Record<string, unknown> & { language?: string }) | null;
};

/**
 * The current user's metadata, read from the `user_metadata` localStorage key
 * that the auth app forwards at login — replacing the `/metadata/proxy/` API
 * call for the current user. Reactive (via `useLocalStorage`), so a writer that
 * refreshes the key re-renders consumers.
 *
 * Returns `[metadata, setMetadata]`; use the setter to keep the key fresh after
 * a profile write so the next read reflects it.
 */
export function useStoredUserMetadata() {
  return useLocalStorage<StoredUserMetadata | null>(
    LOCAL_STORAGE_KEYS.USER_METADATA,
    null,
  );
}
