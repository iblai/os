'use client';

import { useEffect, useRef } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useGetUserMetadataQuery } from '@iblai/iblai-js/data-layer';

import { useUsername } from '@/hooks/use-user';
import { syncLanguageCookies } from '@/lib/locale-cookie';
import { resolveLocale } from '@/i18n/config';

/**
 * Single sync point for the language switch in the User Profile modal.
 *
 * The modal saves the chosen language to the user's profile
 * (`public_metadata.language`). This watcher shares that same data-layer query
 * cache, so when the saved language changes it:
 *   1. writes the `NEXT_LOCALE` and shared `openedx-language-preference`
 *      (parent-domain) cookies from the frontend, and
 *   2. refreshes so server components re-render in the selected language.
 *
 * It also applies the user's saved language on first load when it differs from
 * the active locale. Renders nothing.
 */
export function LanguagePreferenceSync() {
  const username = useUsername();
  const activeLocale = useLocale();
  const router = useRouter();
  const lastSyncedRef = useRef<string | null>(null);

  const { data: userMetadata } = useGetUserMetadataQuery(
    { params: { username: username ?? '' } },
    { skip: !username },
  );

  const storedLanguage = (
    userMetadata as { public_metadata?: { language?: string } } | undefined
  )?.public_metadata?.language;

  useEffect(() => {
    if (!storedLanguage) return;
    const target = resolveLocale(storedLanguage);
    if (target === activeLocale) return;
    if (lastSyncedRef.current === target) return;
    lastSyncedRef.current = target;
    syncLanguageCookies(target);
    router.refresh();
  }, [storedLanguage, activeLocale, router]);

  return null;
}
