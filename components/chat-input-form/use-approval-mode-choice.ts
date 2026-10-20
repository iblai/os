'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { invoke } from '@tauri-apps/api/core';
import {
  useGetUserPlatformMetadataQuery,
  useUpdateUserPlatformMetadataMutation,
} from '@iblai/iblai-js/data-layer';
import {
  applyApprovalMode,
  type PermissionMode,
} from './code-approvals-button';

/** The one top-level user-metadata key code mode owns. */
const METADATA_KEY = 'code_mode';

/**
 * How Code's approval mode is picked, from any control: shown at once, saved
 * on this machine, then saved to the profile so a machine with none saved can
 * start on it. The machine's own saved mode is what Code runs, so the profile
 * is written only after this machine took the pick.
 *
 * `profileCodeMode` is the profile's Code settings, undefined until they load.
 * `active: false` fetches nothing, for a surface where Code cannot run.
 */
export function useApprovalModeChoice(active = true) {
  const t = useTranslations('chatInputFormCodingModeButton');
  const tenantKey =
    typeof window === 'undefined' ? '' : localStorage.getItem('tenant') || '';
  const { data: platformMetadata } = useGetUserPlatformMetadataQuery(
    { tenantKey },
    { skip: !active || !tenantKey },
  );
  const [saveMetadata] = useUpdateUserPlatformMetadataMutation();
  const profileCodeMode = useMemo(() => {
    if (!platformMetadata) return undefined;
    const stored = platformMetadata.metadata?.[METADATA_KEY];
    return stored && typeof stored === 'object' && !Array.isArray(stored)
      ? (stored as Record<string, unknown>)
      : {};
  }, [platformMetadata]);

  // `quiet`: the caller tells the user about a failed save itself (the SDK's
  // permission card does), so this neither toasts nor holds it on the profile.
  const chooseMode = async (
    mode: PermissionMode,
    { quiet = false }: { quiet?: boolean } = {},
  ) => {
    const saved = await applyApprovalMode(
      mode,
      (chosen) => invoke('set_opencode_permission_mode', { mode: chosen }),
      (e) => {
        console.error('[coding-mode] could not apply permission mode', e);
        if (!quiet) toast.error(t('permissionModeSaveFailed'));
      },
      () => invoke<string | null>('get_opencode_permission_mode'),
    );
    if (saved && tenantKey) {
      const writing = saveToProfile(mode);
      if (!quiet) await writing;
    }
    return saved;
  };

  const saveToProfile = async (mode: PermissionMode) => {
    try {
      // The endpoint shallow-merges top-level keys, so code_mode is replaced
      // whole. Nothing else lives under it today; the spread keeps any field
      // the loaded profile has, and before it loads only the mode is sent.
      await saveMetadata({
        tenantKey,
        metadata: {
          [METADATA_KEY]: { ...profileCodeMode, permission_mode: mode },
        },
      }).unwrap();
    } catch (e) {
      console.error(
        '[coding-mode] could not save permission mode to the profile',
        e,
      );
    }
  };

  return { chooseMode, profileCodeMode };
}
