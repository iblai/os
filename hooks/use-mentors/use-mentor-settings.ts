import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useGetMentorPublicSettingsQuery, useGetMentorSettingsQuery } from '@iblai/iblai-js/data-layer';

import { useUsername } from '@/providers/use-user';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { MentorVisibilityEnum } from '@iblai/iblai-api';
import { config } from '@/lib/config';
import { ANONYMOUS_USERNAME } from '@/lib/constants';
import {
  getCachedApiResponse,
  setCachedApiResponse,
  isTauriOfflineMode,
  CacheKeys,
} from '@/lib/tauri-api-cache';
import { isTauriApp } from '@/types/tauri';

type Props = {
  mentorId?: string;
  tenantKey?: string;
};

export function useMentorSettings({
  mentorId: mentorIdFromProps,
  tenantKey: tenantKeyFromProps,
}: Props = {}) {
  const { tenantKey: tenantKeyFromParams, mentorId: mentorIdFromParams } =
    useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const COMMUNITY_MENTOR_VISIBILITY = MentorVisibilityEnum.VIEWABLE_BY_ANYONE;
  const mentorId = mentorIdFromProps || mentorIdFromParams;
  const tenantKey = tenantKeyFromProps || tenantKeyFromParams;
  const isLoggedIn = Boolean(username);

  // Check if we're in Tauri offline mode
  const isOffline = isTauriApp() && isTauriOfflineMode();

  // Get cached data for offline mode
  const [cachedSettings, setCachedSettings] = useState<unknown>(null);
  const [cachedPublicSettings, setCachedPublicSettings] = useState<unknown>(null);

  useEffect(() => {
    if (isOffline && mentorId && tenantKey) {
      const cached = getCachedApiResponse(
        CacheKeys.mentorSettings(tenantKey, mentorId, username || ANONYMOUS_USERNAME),
      );
      if (cached) {
        setCachedSettings(cached);
      }

      const cachedPublic = getCachedApiResponse(
        CacheKeys.mentorPublicSettings(tenantKey, mentorId),
      );
      if (cachedPublic) {
        setCachedPublicSettings(cachedPublic);
      }
    }
  }, [isOffline, mentorId, tenantKey, username]);

  // Skip RTK Query when offline
  const { data: mentorSettings, isLoading: isMentorSettingsLoading } = useGetMentorSettingsQuery(
    {
      mentor: mentorId,
      org: tenantKey,
      // @ts-ignore
      userId: username ?? '',
    },
    {
      skip: !mentorId || !tenantKey || !username || !isLoggedIn || isOffline,
    },
  );

  const { data: mentorPublicSettings, isLoading: isMentorPublicSettingsLoading } =
    useGetMentorPublicSettingsQuery(
      {
        mentor: mentorId,
        org: tenantKey,
        // @ts-ignore
        userId: username || ANONYMOUS_USERNAME,
      },
      {
        skip: !tenantKey || !mentorId || isOffline,
      },
    );

  // Cache responses when online for offline use
  useEffect(() => {
    if (isTauriApp() && !isOffline && mentorSettings && mentorId && tenantKey && username) {
      setCachedApiResponse(
        CacheKeys.mentorSettings(tenantKey, mentorId, username),
        mentorSettings,
        { org: tenantKey, mentor: mentorId, userId: username },
      );
    }
  }, [mentorSettings, mentorId, tenantKey, username, isOffline]);

  useEffect(() => {
    if (isTauriApp() && !isOffline && mentorPublicSettings && mentorId && tenantKey) {
      setCachedApiResponse(
        CacheKeys.mentorPublicSettings(tenantKey, mentorId),
        mentorPublicSettings,
        { org: tenantKey, mentor: mentorId },
      );
    }
  }, [mentorPublicSettings, mentorId, tenantKey, isOffline]);

  // Use cached data when offline
  const effectiveSettings = isOffline ? (cachedSettings as typeof mentorSettings) : mentorSettings;
  const effectivePublicSettings = isOffline
    ? (cachedPublicSettings as typeof mentorPublicSettings)
    : mentorPublicSettings;

  // When offline, don't show loading if we have cached data
  const effectiveIsLoading = isOffline
    ? !(cachedSettings || cachedPublicSettings)
    : isMentorSettingsLoading || isMentorPublicSettingsLoading;

  return {
    isLoading: effectiveIsLoading,
    data: {
      profileImage: effectiveSettings?.profile_image ?? effectivePublicSettings?.profile_image,

      greetingMethod:
        effectiveSettings?.greeting_method ?? effectivePublicSettings?.greeting_method,

      proactiveResponse:
        effectiveSettings?.proactive_response ?? effectivePublicSettings?.proactive_response,

      // @ts-ignore
      llmProvider: isLoggedIn
        ? effectiveSettings?.llm_provider || effectivePublicSettings?.llm_provider
        : '',

      llmName: isLoggedIn ? effectiveSettings?.llm_name : effectivePublicSettings?.llm_name,

      mentorUniqueId: isLoggedIn
        ? effectiveSettings?.mentor_unique_id
        : effectivePublicSettings?.mentor_unique_id,

      mentorName: effectiveSettings?.mentor ?? effectivePublicSettings?.mentor,

      enableGuidedPrompts: isLoggedIn
        ? effectiveSettings?.enable_guided_prompts
        : effectivePublicSettings?.enable_guided_prompts,

      mentorSlug: isLoggedIn
        ? effectiveSettings?.mentor_slug
        : effectivePublicSettings?.mentor_slug,

      safetyDisclaimer: isLoggedIn
        ? effectiveSettings?.metadata?.safety_disclaimer
        : effectivePublicSettings?.metadata?.safety_disclaimer,

      isCommunityMentor:
        isLoggedIn &&
        effectiveSettings?.mentor_visibility === COMMUNITY_MENTOR_VISIBILITY &&
        // @ts-ignore
        effectiveSettings?.platform_key === config.mainTenantKey(),

      // @ts-ignore
      disclaimer: isLoggedIn ? effectiveSettings?.disclaimer : effectivePublicSettings?.disclaimer,

      mentorVisibility: isLoggedIn
        ? effectiveSettings?.mentor_visibility
        : effectivePublicSettings?.mentor_visibility,

      allowAnonymous: isLoggedIn
        ? effectiveSettings?.allow_anonymous
        : effectivePublicSettings?.allow_anonymous,

      showAttachment: isLoggedIn
        ? // @ts-ignore - show_attachment exists in API response but not in type
          effectiveSettings?.show_attachment
        : // @ts-ignore - show_attachment exists in API response but not in type
          effectivePublicSettings?.show_attachment,

      showVoiceCall: isLoggedIn
        ? // @ts-ignore - show_voice_call exists in API response but not in type
          effectiveSettings?.show_voice_call
        : // @ts-ignore - show_voice_call exists in API response but not in type
          effectivePublicSettings?.show_voice_call,

      showVoiceRecord: isLoggedIn
        ? // @ts-ignore - show_voice_record exists in API response but not in type
          effectiveSettings?.show_voice_record
        : // @ts-ignore - show_voice_record exists in API response but not in type
          effectivePublicSettings?.show_voice_record,

      // @ts-ignore
      embedShowAttachment: isLoggedIn
        ? effectiveSettings?.embed_show_attachment
        : effectivePublicSettings?.embed_show_attachment,

      // @ts-ignore
      embedShowVoiceCall: isLoggedIn
        ? effectiveSettings?.embed_show_voice_call
        : effectivePublicSettings?.embed_show_voice_call,

      // @ts-ignore
      embedShowVoiceRecord: isLoggedIn
        ? effectiveSettings?.embed_show_voice_record
        : effectivePublicSettings?.embed_show_voice_record,

      // @ts-ignore
      llmConfig: isLoggedIn ? effectiveSettings?.llm_config : effectivePublicSettings?.llm_config,

      // @ts-ignore - mentor_id is the numeric database ID used for RBAC resource paths
      mentorDbId: isLoggedIn ? effectiveSettings?.mentor_id : effectivePublicSettings?.mentor_id,

      starterPrompts: (isLoggedIn
        ? effectiveSettings?.starter_prompts
        : effectivePublicSettings?.starter_prompts) as string | undefined,
    },
  };
}
