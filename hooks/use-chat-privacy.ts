'use client';

import { useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query';
import {
  useGetTenantChatPrivacyConfigQuery,
  useGetChatPrivacyEffectiveQuery,
  chatPrivacyApiSlice,
} from '@iblai/iblai-js/data-layer';
import { chatActions } from '@iblai/iblai-js/web-utils';

import { config } from '@/lib/config';
import { useDmToken } from '@/hooks/use-tokens';

/**
 * SDK gap: the session-level `disable-chathistory/` POST and the
 * `disable_chathistory` field on `POST /sessions/` are not yet in the
 * generated client. Hand-roll them here so the chat UI can wire the
 * "Start temporary chat" and mid-session "Disable chat history" actions
 * without waiting on the SDK regeneration. Drop these helpers once the
 * generated `ChatSessionRequest` includes `disable_chathistory` and a
 * `useDisableSessionChatHistoryMutation` ships.
 */

const ALLOWED_SOURCES = [
  'tenant',
  'mentor',
  'user',
  'session',
  'default',
] as const;
export type ChatPrivacySource = (typeof ALLOWED_SOURCES)[number];

const ALLOWED_MODES = ['normal', 'anonymized', 'disabled'] as const;
export type ChatPrivacyMode = (typeof ALLOWED_MODES)[number];

export interface ChatPrivacyEffective {
  mode: ChatPrivacyMode;
  source: ChatPrivacySource;
  is_locked: boolean;
}

interface UseChatPrivacyArgs {
  org: string | undefined;
  userId: string | undefined;
  mentor?: string;
  session?: string;
}

const DEFAULT_EFFECTIVE: ChatPrivacyEffective = {
  mode: 'normal',
  source: 'default',
  is_locked: false,
};

export function useChatPrivacy({
  org,
  userId,
  mentor,
  session,
}: UseChatPrivacyArgs) {
  const dispatch = useDispatch();
  const dmToken = useDmToken();
  const [isStartingPrivateChat, setIsStartingPrivateChat] = useState(false);
  const [isDisablingChatHistory, setIsDisablingChatHistory] = useState(false);

  const tenantQuery = useGetTenantChatPrivacyConfigQuery(
    org && userId ? { org, userId } : skipToken,
  );
  const featureEnabled = !!tenantQuery.data?.allow_user_chat_privacy_control;

  // The effective-mode endpoint already encodes tenant + user + mentor + session
  // precedence — skip it when the tenant gate is off, otherwise we'd be
  // showing badges based on a tenant-default that isn't truly authoritative.
  const effectiveQuery = useGetChatPrivacyEffectiveQuery(
    org && userId && featureEnabled
      ? { org, userId, mentor, session }
      : skipToken,
  );

  const effective: ChatPrivacyEffective =
    effectiveQuery.data ?? DEFAULT_EFFECTIVE;

  /**
   * `POST /api/ai-mentor/orgs/{org}/sessions/` with `disable_chathistory: true`.
   * Backend honors the flag only when the tenant gate is on and the mentor
   * itself hasn't disabled history. On success we push the new session id
   * through the existing chat Redux slice so the rest of the app picks it up
   * exactly like a regular new chat.
   */
  const startPrivateChat = useCallback(async (): Promise<string | null> => {
    if (!org || !mentor || !dmToken) return null;

    setIsStartingPrivateChat(true);
    try {
      const response = await fetch(
        `${config.dmUrl()}/api/ai-mentor/orgs/${encodeURIComponent(org)}/sessions/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Token ${dmToken}`,
          },
          body: JSON.stringify({ mentor, disable_chathistory: true }),
        },
      );
      if (!response.ok) {
        console.error(
          JSON.stringify({
            tenant: org,
            error: `startPrivateChat ${response.status}`,
          }),
        );
        return null;
      }
      const data = await response.json();
      const newSessionId: string | undefined = data?.session_id;
      if (newSessionId) {
        dispatch(chatActions.updateSessionIds(newSessionId));
        dispatch(
          chatPrivacyApiSlice.util.invalidateTags(['ChatPrivacyEffective']),
        );
      }
      return newSessionId ?? null;
    } catch (error) {
      console.error(JSON.stringify({ tenant: org, error }));
      return null;
    } finally {
      setIsStartingPrivateChat(false);
    }
  }, [dispatch, dmToken, mentor, org]);

  /**
   * `POST /api/ai-mentor/orgs/{org}/users/{user_id}/sessions/{session_id}/disable-chathistory/`.
   * The backend enforces a one-way door for sessions that have already
   * received messages (it rejects `true → false` with HTTP 400). We still
   * accept a `disabled` argument so the icon-toggle can attempt to flip the
   * flag in either direction; for a brand-new session the revert path is
   * the natural "turn off temporary mode" affordance.
   */
  const disableChatHistory = useCallback(
    async (disabled: boolean = true): Promise<boolean> => {
      if (!org || !userId || !session || !dmToken) return false;

      setIsDisablingChatHistory(true);
      try {
        const response = await fetch(
          `${config.dmUrl()}/api/ai-mentor/orgs/${encodeURIComponent(org)}/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(session)}/disable-chathistory/`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Token ${dmToken}`,
            },
            body: JSON.stringify({ disable_chathistory: disabled }),
          },
        );
        if (!response.ok) {
          console.error(
            JSON.stringify({
              tenant: org,
              error: `disableChatHistory ${response.status}`,
            }),
          );
          return false;
        }
        dispatch(
          chatPrivacyApiSlice.util.invalidateTags(['ChatPrivacyEffective']),
        );
        return true;
      } catch (error) {
        console.error(JSON.stringify({ tenant: org, error }));
        return false;
      } finally {
        setIsDisablingChatHistory(false);
      }
    },
    [dispatch, dmToken, org, session, userId],
  );

  return {
    /** Tenant `ALLOW_USER_CHAT_PRIVACY_CONTROL`. When false, hide all privacy UI. */
    featureEnabled,
    /** Currently-resolved privacy mode for the visible chat surface. */
    effective,
    /** True while either query is in flight. */
    isLoading: tenantQuery.isLoading || effectiveQuery.isLoading,
    startPrivateChat,
    disableChatHistory,
    isStartingPrivateChat,
    isDisablingChatHistory,
  };
}
