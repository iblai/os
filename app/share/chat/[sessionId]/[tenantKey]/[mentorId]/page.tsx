'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';

import { ChatMessages } from '@/components/chat/chat-messages';
import { useMentorSettings } from '@/hooks/use-mentors/use-mentor-settings';
import AppLayout from '@/app/platform/_components/app-layout';
import { redirectToAuthSpa } from '@/lib/utils';
import { useSharedChatMessages } from '@/hooks/use-shared-chat-messages';
import { hideInitialLoader } from '@/lib/initial-loader';

export default function ShareChatWithParamsPage() {
  useEffect(() => {
    hideInitialLoader();
  }, []);

  const { sessionId, tenantKey, mentorId } = useParams<{
    sessionId: string;
    tenantKey: string;
    mentorId: string;
  }>();

  const { messages } = useSharedChatMessages({
    sessionId: sessionId ?? '',
    tenantKey: tenantKey ?? 'undefined',
  });

  const { data: mentorSettings } = useMentorSettings({
    mentorId: mentorId,
    tenantKey: tenantKey,
  });

  const handleOnClick = () => {
    console.log('[auth-redirect] User clicked login from shared chat page');
    redirectToAuthSpa();
  };

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-2 py-6">
          <ChatMessages
            messages={messages}
            highlightedMessageId={null}
            profileImage={mentorSettings?.profileImage ?? ''}
            tenantKey={tenantKey ?? ''}
            mentorName={mentorSettings?.mentorName ?? ''}
            mentorId={mentorSettings?.mentorUniqueId ?? ''}
            sessionId={sessionId}
            handleHighlightMessage={handleOnClick}
            handleSubmit={handleOnClick}
          />
        </div>
      </div>
    </AppLayout>
  );
}
