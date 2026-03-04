'use client';

import React from 'react';

import { useMediaQuery } from 'react-responsive';
import { chatActions, selectSessionId, useTenantMetadata } from '@iblai/iblai-js/web-utils';

import ErrorBoundary from '@/components/error-boundary';
import { DocumentSidebar } from '@/components/document-sidebar';

import './page.css';
import { Chat } from '@/components/chat';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { useIsPreviewMode } from '@/hooks/use-is-preview-mode';
import { useChatMode } from '@/hooks/use-chat-mode';

// Prevent static generation - this page uses browser APIs
export const dynamic = 'force-dynamic';
import {
  useGetMentorPublicSettingsQuery,
  useLazyGetShareableLinkPublicQuery,
} from '@iblai/iblai-js/data-layer';
import { useParams, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { config } from '@/lib/config';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { MentorVisibilityEnum } from '@iblai/iblai-api';
import { isLoggedIn } from '@/lib/utils';
import { useUsername, useUserTenants } from '@/hooks/use-user';
import { ANONYMOUS_USERNAME } from '@/lib/constants';
import {
  useTauriOffline,
  isTauriOfflineMode,
  isOfflineServerOrigin,
} from '@/hooks/use-tauri-offline';
import { isTauriApp } from '@/types/tauri';
import { hideInitialLoader } from '@/lib/initial-loader';

export default function Page() {
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const sessionId = useAppSelector(selectSessionId);
  const dispatch = useAppDispatch();
  const [getShareableTokenPublic, { data: shareableTokenDataPublic }] =
    useLazyGetShareableLinkPublicQuery();
  const username = useUsername();

  // Tauri offline mode - saves route and triggers caching when on mentor routes
  useTauriOffline();

  // Hide initial loader when mentor page is ready
  React.useEffect(() => {
    hideInitialLoader();
  }, []);

  // Check if we're in Tauri offline mode - skip API calls if so
  // Use isOfflineServerOrigin() as primary check since it works before Tauri scripts run
  const isTauriOffline = isOfflineServerOrigin() || (isTauriApp() && isTauriOfflineMode());

  const isPreviewMode = useIsPreviewMode();
  const chatMode = useChatMode();
  const { userTenants } = useUserTenants();

  const searchParams = useSearchParams();
  const { mentorId, tenantKey } = useParams<TenantKeyMentorIdParams>();

  // Skip tenant metadata API call in offline mode
  const { metadata } = useTenantMetadata({
    org: tenantKey,
    skip: isTauriOffline,
  });

  // Skip mentor public settings API call in offline mode
  const { data: mentorPublicSettings } = useGetMentorPublicSettingsQuery(
    {
      mentor: mentorId,
      org: tenantKey,
      // @ts-ignore
      userId: username ?? ANONYMOUS_USERNAME,
    },
    {
      skip: !mentorId || !tenantKey || isTauriOffline,
    },
  );

  const [, setShowLoginBanner] = React.useState(false);

  React.useEffect(() => {
    if (isLoggedIn()) {
      const userInTenant = userTenants.find((t) => t.key === tenantKey);
      if (!userInTenant && !mentorPublicSettings?.allow_anonymous) {
        dispatch(chatActions.setShouldStartNewChat(false));
        return;
      }
    }
    dispatch(chatActions.setShouldStartNewChat(true));
  }, [userTenants, dispatch, chatActions, mentorPublicSettings]);

  React.useEffect(() => {
    if (!mentorPublicSettings) return;

    const requiresAuthentication = mentorPublicSettings.allow_anonymous === false;
    const viewableByAnyone =
      mentorPublicSettings.mentor_visibility === MentorVisibilityEnum.VIEWABLE_BY_ANYONE;

    setShowLoginBanner(requiresAuthentication && viewableByAnyone && !isLoggedIn());
  }, [mentorPublicSettings]);

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
      })
        .unwrap()
        .then((res) => {
          if (!res.enabled) {
            toast.error(
              <>
                <p>
                  The shareable link is not enabled. Please contact support to enable it.{' '}
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
  }, [searchParams]);

  return (
    <ErrorBoundary>
      <div className="flex-1 flex min-h-0">
        <div className="w-full flex-1 flex flex-col min-h-0 px-1 md:px-4">
          {/* {showLoginBanner && (
            <div className="mb-3">
              <LoginRequiredBanner
                message="You must login in order to chat with this mentor"
                actionLabel=""
                onAction={handleLoginBannerClick}
              />
            </div>
          )} */}
          <Chat isPreviewMode={isPreviewMode} mode={chatMode} />
        </div>
        {!isMobile && <DocumentSidebar sessionId={sessionId} />}
      </div>
    </ErrorBoundary>
  );
}
