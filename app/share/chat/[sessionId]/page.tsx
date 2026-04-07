'use client';

import React from 'react';
import { redirect, useParams } from 'next/navigation';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/spinner';
import { customErrorMessages } from '@/lib/error';
import { chatActions, useTenantContext } from '@iblai/iblai-js/web-utils';
import { useAppDispatch } from '@/lib/hooks';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { LOCAL_STORAGE_KEYS } from '@/lib/constants';
import { useSharedChatMessages } from '@/hooks/use-shared-chat-messages';
import { hideInitialLoader } from '@/lib/initial-loader';

export default function ShareChatPage() {
  const router = useRouter();
  const { sessionId, tenantKey } = useParams<{
    sessionId: string;
    tenantKey: string;
  }>();

  const {
    chatDetails,
    messages,
    mentorUniqueId,
    platformKey,
    isLoading,
    isError,
  } = useSharedChatMessages({
    sessionId: sessionId ?? '',
    tenantKey: tenantKey ?? 'undefined',
  });

  const dispatch = useAppDispatch();
  const { setTenantKey } = useTenantContext();

  useEffect(() => {
    hideInitialLoader();
  }, []);

  const [cachedSessionId, saveCachedSessionId] = useLocalStorage<
    Record<string, string>
  >(
    LOCAL_STORAGE_KEYS.SESSION_ID,
    {},
    { deserializer: (value) => JSON.parse(value) },
  );

  useEffect(() => {
    if (chatDetails && messages && messages.length > 0) {
      messages.forEach((result) => {
        dispatch(chatActions.addUserMessage({ tab: 'chat', message: result }));
      });
      dispatch(chatActions.setShowingSharedChat(true));
      saveCachedSessionId({
        ...cachedSessionId,
        [mentorUniqueId as string]: sessionId,
      });
      setTenantKey(platformKey as string);
      router.push(`/platform/${platformKey}/${mentorUniqueId}`);
    }
  }, [mentorUniqueId, platformKey, router]);

  if (isLoading) {
    return (
      <div className="flex h-dvh w-screen items-center justify-center">
        <div className="space-y-3">
          <Spinner />
        </div>
      </div>
    );
  }

  if (isError) {
    redirect(`/error/404?errorType=${customErrorMessages.sessionNotFound.key}`);
  }

  return null;
}
