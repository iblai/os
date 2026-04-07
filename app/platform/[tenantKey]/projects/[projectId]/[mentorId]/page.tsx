'use client';

// Prevent static generation - this page uses browser APIs
export const dynamic = 'force-dynamic';

import React from 'react';
import { useParams, useSearchParams } from 'next/navigation';

import { ProjectPageParams } from '@/lib/types';
import ErrorBoundary from '@/components/error-boundary';
import { DocumentSidebar } from '@/components/document-sidebar';
import {
  chatActions,
  selectSessionId,
  useTenantMetadata,
} from '@iblai/iblai-js/web-utils';
import '../../../[mentorId]/page.css';
import { Chat } from '@/components/chat';
import { useIsPreviewMode } from '@/hooks/use-is-preview-mode';
import { useChatMode } from '@/hooks/use-chat-mode';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { TenantKeyMentorIdParams } from '@/lib/types';
import {
  useLazyGetShareableLinkPublicQuery,
  useLazyGetShareableLinkQuery,
} from '@iblai/iblai-js/data-layer';
import { useMediaQuery } from 'react-responsive';
import { toast } from 'sonner';
import { config } from '@/lib/config';

export default function Page() {
  const { tenantKey } = useParams<ProjectPageParams>();
  const { mentorId } = useParams<TenantKeyMentorIdParams>();

  const isMobile = useMediaQuery({ maxWidth: 767 });
  const sessionId = useAppSelector(selectSessionId);
  const dispatch = useAppDispatch();
  const [, { data: shareableTokenData }] = useLazyGetShareableLinkQuery();
  const [getShareableTokenPublic, { data: shareableTokenDataPublic }] =
    useLazyGetShareableLinkPublicQuery();

  const isPreviewMode = useIsPreviewMode();
  const chatMode = useChatMode();

  const searchParams = useSearchParams();

  const { metadata } = useTenantMetadata({
    org: tenantKey,
  });

  React.useEffect(() => {
    dispatch(chatActions.setShouldStartNewChat(true));
  }, []);

  React.useEffect(() => {
    if (!isMobile) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [isMobile]);

  React.useEffect(() => {
    if (shareableTokenDataPublic) {
      dispatch(chatActions.updateToken(shareableTokenDataPublic.token));
    }
    if (searchParams.get('token')) {
      getShareableTokenPublic({
        mentor: mentorId,
        org: tenantKey,
        // @ts-expect-error: Expect token to be a param
        token: searchParams.get('token'),
      })
        .unwrap()
        .then((res) => {
          dispatch(chatActions.updateTokenEnabled(res.enabled));
          if (!res.enabled) {
            toast.error(
              <>
                <p>
                  The shareable link is not enabled. Please contact support to
                  enable it.{' '}
                  <a
                    href={`mailto:${metadata?.support_email || config.supportEmail()}`}
                    style={{ color: '#2563eb', textDecoration: 'underline' }}
                  >
                    Contact Support
                  </a>
                </p>
              </>,
              { duration: Infinity, position: 'top-right', closeButton: true },
            );
          }
        });
    }
  }, [searchParams]);

  React.useEffect(() => {
    const shareableToken = searchParams.get('token');
    if (shareableToken) {
      dispatch(chatActions.updateToken(shareableToken));
    }
  }, [shareableTokenData, searchParams]);

  return (
    <ErrorBoundary>
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 w-full flex-1 flex-col px-1 md:px-4">
          <Chat
            isPreviewMode={isPreviewMode}
            mode={chatMode}
            hasBorder={false}
          />
        </div>
        {!isMobile && <DocumentSidebar sessionId={sessionId} />}
      </div>
    </ErrorBoundary>
  );
}
